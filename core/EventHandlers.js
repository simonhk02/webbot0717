const eventBus = require('./EventBus');
const { EventTypes, EventPriority, EventSource } = require('./EventTypes');
const { businessLogger } = require('../utils/logger');
const stateManager = require('./StateManager');

// 引入新的服務
const imageProcessingService = require('../services/ImageProcessingService');
const expenseChatService = require('../services/ExpenseChatService');
const whatsAppService = require('../services/WhatsAppService');

/**
 * 核心事件處理器
 * 處理所有主要業務邏輯的事件
 */
class EventHandlers {
  constructor() {
    this.initializeHandlers();
    businessLogger.info('事件處理器已初始化');
  }

  /**
   * 初始化所有事件處理器
   */
  initializeHandlers() {
    // 訊息相關事件處理器
    this.setupMessageHandlers();
    
    // 圖片處理相關事件處理器
    this.setupImageHandlers();
    
    // 費用對話相關事件處理器
    this.setupExpenseChatHandlers();
    
    // 用戶相關事件處理器
    this.setupUserHandlers();
    
    // WhatsApp 相關事件處理器
    this.setupWhatsAppHandlers();
    
    // 系統相關事件處理器
    this.setupSystemHandlers();
  }

  // ==================== 訊息處理事件 ====================
  
  setupMessageHandlers() {
    // 訊息接收處理
    eventBus.on(EventTypes.MESSAGE.RECEIVED, async (event) => {
      const { message, userId, chatId } = event.data;
      businessLogger.info(`處理接收到的訊息：userId=${userId}, chatId=${chatId}`);
      
      try {
        // 標記訊息為已處理
        stateManager.markMessageProcessed(message.key.id);
        
        // 發送訊息處理完成事件
        await eventBus.emit(EventTypes.MESSAGE.PROCESSED, {
          messageId: message.key.id,
          userId,
          chatId
        }, { source: EventSource.WHATSAPP_MESSAGE });
        
      } catch (error) {
        businessLogger.error(`訊息處理失敗：${error.message}`);
        await eventBus.emit(EventTypes.MESSAGE.ERROR, {
          messageId: message.key.id,
          userId,
          chatId,
          error: error.message
        }, { source: EventSource.WHATSAPP_MESSAGE });
      }
    }, { priority: EventPriority.HIGH });

    // 訊息處理完成
    eventBus.on(EventTypes.MESSAGE.PROCESSED, (event) => {
      const { messageId, userId, chatId } = event.data;
      businessLogger.debug(`訊息處理完成：messageId=${messageId}`);
    });

    // 訊息處理錯誤
    eventBus.on(EventTypes.MESSAGE.ERROR, (event) => {
      const { messageId, userId, chatId, error } = event.data;
      businessLogger.error(`訊息處理錯誤：messageId=${messageId}, error=${error}`);
    });
  }

  // ==================== 圖片處理事件 ====================
  
  setupImageHandlers() {
    // 圖片檢測
    eventBus.on(EventTypes.IMAGE.DETECTED, async (event) => {
      const { imageData, userId, chatId, msgId } = event.data;
      businessLogger.info(`檢測到圖片：msgId=${msgId}, userId=${userId}`);
      
      try {
        // 將圖片加入處理佇列
        await imageProcessingService.addImageToQueue({
          chatId,
          media: imageData,
          defaultDate: new Date().toISOString().split('T')[0],
          msgId,
          userId
        });
        
        // 發送圖片加入佇列事件
        await eventBus.emit(EventTypes.IMAGE.QUEUED, {
          msgId,
          userId,
          chatId
        }, { source: EventSource.IMAGE_PROCESSING });
        
      } catch (error) {
        businessLogger.error(`圖片檢測處理失敗：${error.message}`);
        await eventBus.emit(EventTypes.IMAGE.FAILED, {
          msgId,
          userId,
          chatId,
          error: error.message
        }, { source: EventSource.IMAGE_PROCESSING });
      }
    }, { priority: EventPriority.HIGH });

    // 圖片加入佇列
    eventBus.on(EventTypes.IMAGE.QUEUED, async (event) => {
      const { msgId, userId, chatId } = event.data;
      businessLogger.info(`圖片已加入佇列：長度=${stateManager.imageProcessingQueue.length}，msgId=${msgId}`);
      
      try {
        // 觸發圖片佇列處理
        await imageProcessingService.processImageQueue();
        
      } catch (error) {
        businessLogger.error(`圖片佇列處理失敗：${error.message}`);
        await eventBus.emit(EventTypes.IMAGE.FAILED, {
          msgId,
          userId,
          chatId,
          error: error.message
        }, { source: EventSource.IMAGE_PROCESSING });
      }
    });

    // 圖片處理開始
    eventBus.on(EventTypes.IMAGE.PROCESSING, async (event) => {
      const { chatId, media, defaultDate, client, driveFolderId, msgId, userId } = event.data;
      businessLogger.info(`處理圖片事件：msgId=${msgId}, userId=${userId}`);
      
      try {
        // 標記圖片為處理中
        stateManager.markImageProcessing(msgId);
        
        // 調用費用對話服務開始處理
        await expenseChatService.startExpenseChat(chatId, media, defaultDate, client, driveFolderId, msgId);
        
        // 發送圖片處理完成事件
        await eventBus.emit(EventTypes.IMAGE.PROCESSED, {
          msgId,
          userId,
          chatId,
          result: 'success'
        }, { source: EventSource.IMAGE_PROCESSING });
        
      } catch (error) {
        businessLogger.error(`圖片處理開始失敗：${error.message}`);
        await eventBus.emit(EventTypes.IMAGE.FAILED, {
          msgId,
          userId,
          chatId,
          error: error.message
        }, { source: EventSource.IMAGE_PROCESSING });
      }
    });

    // 圖片處理完成
    eventBus.on(EventTypes.IMAGE.PROCESSED, (event) => {
      const { msgId, userId, chatId, result } = event.data;
      businessLogger.info(`圖片處理完成：msgId=${msgId}`);
      
      // 標記圖片處理完成
      stateManager.markImageProcessed(msgId);
    });

    // 圖片處理失敗
    eventBus.on(EventTypes.IMAGE.FAILED, (event) => {
      const { msgId, userId, chatId, error } = event.data;
      businessLogger.error(`圖片處理失敗：msgId=${msgId}, error=${error}`);
      
      // 清理狀態
      stateManager.markImageProcessed(msgId);
    });

    // 圖片上傳完成
    eventBus.on(EventTypes.IMAGE.UPLOADED, (event) => {
      const { msgId, userId, imageUrl } = event.data;
      businessLogger.info(`圖片上傳完成：msgId=${msgId}, url=${imageUrl}`);
    });
  }

  // ==================== 費用對話事件 ====================
  
  setupExpenseChatHandlers() {
    // 費用對話開始
    eventBus.on(EventTypes.EXPENSE_CHAT.STARTED, async (event) => {
      const { chatId, msgId, userId } = event.data;
      businessLogger.info(`開始費用對話：chatId=${chatId}, msgId=${msgId}`);
      
      try {
        // 設置費用對話狀態
        const state = stateManager.getExpenseState(chatId);
        if (state) {
          stateManager.setExpenseState(chatId, msgId, {
            ...state,
            step: 1,
            lastActive: Date.now()
          });
        }
        
        // 發送對話步驟完成事件
        await eventBus.emit(EventTypes.EXPENSE_CHAT.STEP_COMPLETED, {
          chatId,
          step: 1,
          msgId,
          userId
        }, { source: EventSource.EXPENSE_CHAT });
        
      } catch (error) {
        businessLogger.error(`費用對話開始失敗：${error.message}`);
        await eventBus.emit(EventTypes.EXPENSE_CHAT.ERROR, {
          chatId,
          msgId,
          userId,
          error: error.message
        }, { source: EventSource.EXPENSE_CHAT });
      }
    });

    // 費用對話步驟完成
    eventBus.on(EventTypes.EXPENSE_CHAT.STEP_COMPLETED, (event) => {
      const { chatId, step, msgId, userId } = event.data;
      businessLogger.info(`對話步驟完成：chatId=${chatId}, step=${step}`);
    });

    // 費用對話完成
    eventBus.on(EventTypes.EXPENSE_CHAT.FINISHED, async (event) => {
      const { chatId, state, client } = event.data;
      businessLogger.info(`完成費用對話：chatId=${chatId}`);
      
      try {
        // 調用費用對話服務完成處理
        await expenseChatService.finishExpenseChat(chatId, state, client);
        
        // 發送對話完成事件
        await eventBus.emit(EventTypes.EXPENSE_CHAT.COMPLETED, {
          chatId,
          state,
          result: 'success'
        }, { source: EventSource.EXPENSE_CHAT });
        
      } catch (error) {
        businessLogger.error(`費用對話完成失敗：${error.message}`);
        await eventBus.emit(EventTypes.EXPENSE_CHAT.ERROR, {
          chatId,
          state,
          error: error.message
        }, { source: EventSource.EXPENSE_CHAT });
      }
    });

    // 費用對話完成確認
    eventBus.on(EventTypes.EXPENSE_CHAT.COMPLETED, (event) => {
      const { chatId, state, result } = event.data;
      businessLogger.info(`費用對話完成確認：chatId=${chatId}`);
      
      // 清理狀態
      if (state && state.msgId) {
      stateManager.deleteExpenseState(chatId, state.msgId);
      }
    });

    // 費用對話錯誤
    eventBus.on(EventTypes.EXPENSE_CHAT.ERROR, (event) => {
      const { chatId, msgId, userId, error } = event.data;
      businessLogger.error(`費用對話錯誤：chatId=${chatId}, error=${error}`);
      
      // 清理狀態
      if (msgId) {
        stateManager.deleteExpenseState(chatId, msgId);
        stateManager.markImageProcessed(msgId);
      }
    });
  }

  // ==================== 用戶事件 ====================
  
  setupUserHandlers() {
    // 用戶登入
    eventBus.on(EventTypes.USER.LOGIN, async (event) => {
      const { userId, email } = event.data;
      businessLogger.info(`用戶登入：userId=${userId}, email=${email}`);
      
      try {
        // 發送用戶認證事件
        await eventBus.emit(EventTypes.USER.AUTHENTICATED, {
          userId,
          email,
          timestamp: Date.now()
        }, { source: EventSource.USER_SERVICE });
        
      } catch (error) {
        businessLogger.error(`用戶登入處理失敗：${error.message}`);
      }
    });

    // 用戶登出
    eventBus.on(EventTypes.USER.LOGOUT, (event) => {
      const { userId } = event.data;
      businessLogger.info(`用戶登出：userId=${userId}`);
    });

    // 用戶認證
    eventBus.on(EventTypes.USER.AUTHENTICATED, async (event) => {
      const { userId, email } = event.data;
      businessLogger.info(`用戶認證成功：userId=${userId}, email=${email}`);
      
      try {
        // 重新載入用戶設置
        await whatsAppService.reloadUserSettings(userId);
        
      } catch (error) {
        businessLogger.error(`重新載入用戶設置失敗：${error.message}`);
      }
    });
  }

  // ==================== WhatsApp 事件 ====================
  
  setupWhatsAppHandlers() {
    // WhatsApp 客戶端就緒
    eventBus.on(EventTypes.WHATSAPP.CLIENT_READY, (event) => {
      const { userId, client } = event.data;
      businessLogger.info(`WhatsApp 客戶端就緒：userId=${userId}`);
    });

    // QR 碼生成
    eventBus.on(EventTypes.WHATSAPP.QR_GENERATED, (event) => {
      const { userId, qrCode } = event.data;
      businessLogger.info(`QR 碼生成：userId=${userId}`);
    });

    // WhatsApp 連接狀態變更
    eventBus.on(EventTypes.WHATSAPP.CONNECTION_CHANGED, (event) => {
      const { userId, status } = event.data;
      businessLogger.info(`WhatsApp 連接狀態變更：userId=${userId}, status=${status}`);
    });
  }

  // ==================== 系統事件 ====================
  
  setupSystemHandlers() {
    // 系統啟動
    eventBus.on(EventTypes.SYSTEM.STARTUP, (event) => {
      const { port, timestamp } = event.data;
      businessLogger.info(`系統啟動事件處理`);
    });

    // 系統錯誤
    eventBus.on(EventTypes.SYSTEM.ERROR, (event) => {
      const { error, context } = event.data;
      businessLogger.error(`系統錯誤：${error}`, { context, test: true });
    });

    // 系統關閉
    eventBus.on(EventTypes.SYSTEM.SHUTDOWN, async (event) => {
      const { reason } = event.data;
      businessLogger.info(`系統關閉：${reason}`);
      
      try {
        // 清理資源
        await this.cleanup();
      } catch (error) {
        businessLogger.error(`系統關閉清理失敗：${error.message}`);
      }
    });
  }

  /**
   * 獲取事件處理器統計
   */
  getStats() {
    return {
      totalHandlers: this.handlers.size,
      eventTypes: this.eventTypes,
      totalEvents: eventBus.getStats().totalEvents,
      totalListeners: eventBus.getStats().totalListeners
    };
  }

  /**
   * 清理事件處理器
   */
  async cleanup() {
    try {
      businessLogger.info('開始清理事件處理器...');
      
      // 移除所有事件監聽器
      eventBus.removeAllListeners();
      
      businessLogger.info('事件處理器已清理');
    } catch (error) {
      businessLogger.error(`清理事件處理器失敗：${error.message}`);
    }
  }
}

// 建立單例實例
const eventHandlers = new EventHandlers();

module.exports = eventHandlers; 