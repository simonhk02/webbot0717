const { businessLogger } = require('../utils/logger');
const stateManager = require('../core/StateManager');
const eventBus = require('../core/EventBus');
const { EventTypes, EventSource } = require('../core/EventTypes');
const imageProcessingService = require('./ImageProcessingService');
const expenseChatService = require('./ExpenseChatService');

// 引入現有的 WhatsApp 服務
const { 
  initializeAuthenticatedClients, 
  cleanupQRCode, 
  getQRCode, 
  getLoginStatus, 
  getClients,
  reloadUserSettings
} = require('./whatsappConnection');

const { setupMessageHandler } = require('./whatsappMessage');

class WhatsAppService {
  constructor() {
    this.isInitialized = false;
    businessLogger.info('WhatsApp 服務已初始化');
  }

  async initialize() {
    if (this.isInitialized) {
      businessLogger.warn('WhatsApp 服務已初始化，跳過重複初始化');
      return;
    }

    try {
      // 初始化已認證的客戶端
      await initializeAuthenticatedClients();
      
      // 設置事件監聽器
      this.setupEventListeners();
      
      this.isInitialized = true;
      businessLogger.info('WhatsApp 服務初始化完成');
    } catch (err) {
      businessLogger.error(`WhatsApp 服務初始化失敗：${err.message}`);
      throw err;
    }
  }

  setupEventListeners() {
    // 監聽圖片處理事件
    eventBus.on(EventTypes.IMAGE.PROCESSING, async (data, context) => {
      try {
        const { chatId, media, defaultDate, client, driveFolderId, msgId, userId } = data;
        businessLogger.info(`處理圖片事件：msgId=${msgId}, userId=${userId}`);
        
        await expenseChatService.startExpenseChat(chatId, media, defaultDate, client, driveFolderId, msgId);
      } catch (err) {
        businessLogger.error(`處理圖片事件失敗：${err.message}`);
      }
    }, { source: EventSource.WHATSAPP_SERVICE });

    // 監聽費用對話完成事件
    eventBus.on(EventTypes.EXPENSE_CHAT.FINISHED, async (data, context) => {
      try {
        const { chatId, state, client } = data;
        businessLogger.info(`完成費用對話：chatId=${chatId}`);
        
        await expenseChatService.finishExpenseChat(chatId, state, client);
      } catch (err) {
        businessLogger.error(`完成費用對話失敗：${err.message}`);
      }
    }, { source: EventSource.WHATSAPP_SERVICE });

    // 監聽用戶認證事件
    eventBus.on(EventTypes.USER.AUTHENTICATED, async (data, context) => {
      try {
        const { userId, client } = data;
        businessLogger.info(`用戶認證成功：userId=${userId}`);
        
        // 重新載入用戶設置
        await reloadUserSettings(userId);
      } catch (err) {
        businessLogger.error(`重新載入用戶設置失敗：${err.message}`);
      }
    }, { source: EventSource.WHATSAPP_SERVICE });
  }

  // 獲取 QR 碼
  async getQRCode(userId, session) {
    try {
      return await getQRCode(userId, session);
    } catch (err) {
      businessLogger.error(`獲取 QR 碼失敗：${err.message}`);
      throw err;
    }
  }

  // 獲取登入狀態
  async getLoginStatus(userId, session) {
    try {
      return await getLoginStatus(userId, session);
    } catch (err) {
      businessLogger.error(`獲取登入狀態失敗：${err.message}`);
      throw err;
    }
  }

  // 重新載入用戶設置
  async reloadUserSettings(userId) {
    try {
      await reloadUserSettings(userId);
      businessLogger.info(`用戶設置重新載入成功：userId=${userId}`);
    } catch (err) {
      businessLogger.error(`重新載入用戶設置失敗：${err.message}`);
      throw err;
    }
  }

  // 獲取客戶端列表
  getClients() {
    return getClients();
  }

  // 獲取特定用戶的客戶端
  getClient(userId) {
    const clients = getClients();
    return clients.get(userId);
  }

  // 檢查用戶是否已連接
  isUserConnected(userId) {
    const client = this.getClient(userId);
    return client && client.ready && client.client.ws.isOpen;
  }

  // 發送訊息
  async sendMessage(userId, chatId, message) {
    try {
      const client = this.getClient(userId);
      if (!client || !client.ready || !client.client.ws.isOpen) {
        throw new Error('客戶端未就緒或連線已關閉');
      }

      await client.client.sendMessage(chatId, message);
      businessLogger.info(`訊息發送成功：userId=${userId}, chatId=${chatId}`);
    } catch (err) {
      businessLogger.error(`發送訊息失敗：${err.message}`);
      throw err;
    }
  }

  // 處理費用對話訊息
  async handleExpenseMessage(chatId, message, client) {
    try {
      await expenseChatService.handleExpenseMessage(chatId, message, client);
    } catch (err) {
      businessLogger.error(`處理費用對話訊息失敗：${err.message}`);
      throw err;
    }
  }

  // 添加圖片到處理佇列
  async addImageToQueue(imageData) {
    try {
      await imageProcessingService.addImageToQueue(imageData);
      businessLogger.info(`圖片已添加到處理佇列：msgId=${imageData.msgId}`);
    } catch (err) {
      businessLogger.error(`添加圖片到佇列失敗：${err.message}`);
      throw err;
    }
  }

  // 獲取服務狀態
  getServiceStatus() {
    const clients = getClients();
    const connectedUsers = Array.from(clients.entries())
      .filter(([userId, client]) => client.ready && client.client.ws.isOpen)
      .map(([userId]) => userId);

    return {
      isInitialized: this.isInitialized,
      totalClients: clients.size,
      connectedUsers,
      connectionCount: connectedUsers.length,
      imageQueueStats: imageProcessingService.getQueueStats()
    };
  }

  // 健康檢查
  async healthCheck() {
    try {
      const status = this.getServiceStatus();
      const clients = getClients();
      
      const health = {
        status: 'healthy',
        service: 'WhatsApp',
        timestamp: new Date().toISOString(),
        details: {
          ...status,
          clients: Array.from(clients.entries()).map(([userId, client]) => ({
            userId,
            ready: client.ready,
            connected: client.client?.ws?.isOpen || false,
            lastActive: client.lastActive
          }))
        }
      };

      // 檢查是否有連接問題
      if (status.connectionCount === 0 && clients.size > 0) {
        health.status = 'warning';
        health.message = '所有客戶端都未連接';
      }

      return health;
    } catch (err) {
      return {
        status: 'unhealthy',
        service: 'WhatsApp',
        timestamp: new Date().toISOString(),
        error: err.message
      };
    }
  }

  // 清理資源
  async cleanup() {
    try {
      businessLogger.info('開始清理 WhatsApp 服務...');
      
      // 清理 QR 碼
      await cleanupQRCode();
      
      // 清理圖片處理服務
      await imageProcessingService.cleanup();
      
      this.isInitialized = false;
      businessLogger.info('WhatsApp 服務已清理');
    } catch (err) {
      businessLogger.error(`清理 WhatsApp 服務失敗：${err.message}`);
      throw err;
    }
  }

  // 重新初始化
  async reinitialize() {
    try {
      businessLogger.info('重新初始化 WhatsApp 服務...');
      await this.cleanup();
      await this.initialize();
      businessLogger.info('WhatsApp 服務重新初始化完成');
    } catch (err) {
      businessLogger.error(`重新初始化 WhatsApp 服務失敗：${err.message}`);
      throw err;
    }
  }
}

// 建立單例實例
const whatsAppService = new WhatsAppService();

module.exports = whatsAppService; 