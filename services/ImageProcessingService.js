const Queue = require('bull');
const { businessLogger } = require('../utils/logger');
const { createErrorMessage } = require('../utils/messageUtils');
const config = require('../config');
const stateManager = require('../core/StateManager');
const eventBus = require('../core/EventBus');
const { EventTypes, EventSource } = require('../core/EventTypes');

class ImageProcessingService {
  constructor() {
    this.imageQueue = new Queue('image-processing', {
      redis: { 
        host: config.redis.connection.host, 
        port: config.redis.connection.port 
      },
      defaultJobOptions: {
        removeOnComplete: config.queue.imageProcessing.removeOnComplete,
        removeOnFail: config.queue.imageProcessing.removeOnFail
      }
    });

    this.setupQueueProcessor();
    businessLogger.info('圖片處理服務已初始化');
  }

  setupQueueProcessor() {
    this.imageQueue.process(async (job) => {
      const { chatId, media, defaultDate, userId, msgId } = job.data;
      businessLogger.info(`Bull 佇列處理工作：msgId=${msgId}, userId=${userId}`);
      
      const { getClients } = require('./whatsappConnection');
      const clientData = getClients().get(userId);
      
      if (!clientData || !clientData.ready || !clientData.client.ws.isOpen) {
        businessLogger.error(`用戶 ${userId} 無有效客戶端資料或連線已關閉`);
        // 發送友好的錯誤消息
        if (clientData?.client?.ws?.isOpen) {
          try {
            await clientData.client.sendMessage(chatId, { 
              text: '🔌 連接不穩定，圖片處理中斷。請重新發送圖片。' 
            });
          } catch (err) {
            businessLogger.warn(`無法發送連接錯誤消息：${err.message}`);
          }
        }
        stateManager.deleteExpenseState(chatId, msgId);
        stateManager.markImageProcessed(msgId);
        stateManager.setImageProcessingStatus(false);
        this.processImageQueue();
        return;
      }

      // 發送處理開始消息
      if (clientData.ready && clientData.client.ws.isOpen) {
        try {
          await clientData.client.sendMessage(chatId, { 
            text: '🎯 開始處理您的收據圖片...\n\n🔍 步驟 1/3：圖片分析中' 
          });
        } catch (err) {
          businessLogger.warn(`無法發送處理開始消息：${err.message}`);
        }
      }

      try {
        if (!media || !media.data) {
          throw new Error('圖片數據無效');
        }
        
        // 發送 AI 識別進度消息
        if (clientData.ready && clientData.client.ws.isOpen) {
          try {
            setTimeout(async () => {
              try {
                await clientData.client.sendMessage(chatId, { 
                  text: '🤖 步驟 2/3：AI 智能識別中...\n\n⏱️ 正在提取收據資訊，請稍候' 
                });
              } catch (err) {
                businessLogger.warn(`無法發送 AI 識別進度消息：${err.message}`);
              }
            }, 2000);
          } catch (err) {
            // 忽略 setTimeout 錯誤
          }
        }
        
        businessLogger.info(`Bull 佇列發送圖片處理事件：msgId=${msgId}`);
        // 使用事件驅動處理圖片
        await eventBus.emit(EventTypes.IMAGE.PROCESSING, {
          chatId,
          media,
          defaultDate,
          client: clientData.client,
          driveFolderId: clientData.driveFolderId,
          msgId,
          userId
        }, { source: EventSource.IMAGE_PROCESSING });
        businessLogger.info(`Bull 佇列成功發送圖片處理事件：msgId=${msgId}`);
      } catch (err) {
        businessLogger.error(`Bull 佇列圖片處理失敗：${err.message}`);
        if (clientData.ready && clientData.client.ws.isOpen) {
          try {
            let friendlyMessage = '❌ 圖片處理失敗';
            
            // 根據錯誤類型提供更具體的錯誤信息
            if (err.message.includes('timeout')) {
              friendlyMessage = '⏰ 處理超時，請重新發送圖片。可能是圖片太大或網絡不穩定。';
            } else if (err.message.includes('invalid') || err.message.includes('format')) {
              friendlyMessage = '📷 圖片格式不支援，請發送 JPG 或 PNG 格式的圖片。';
            } else if (err.message.includes('size')) {
              friendlyMessage = '📏 圖片太大，請壓縮後重新發送（建議小於 10MB）。';
            } else {
              friendlyMessage = `❌ 圖片處理失敗：${err.message}\n\n💡 建議：\n• 檢查圖片是否清晰\n• 確認網絡連接穩定\n• 重新發送圖片`;
            }
            
            await clientData.client.sendMessage(chatId, { text: friendlyMessage });
          } catch (sendErr) {
            businessLogger.warn(`發送圖片處理失敗訊息時出錯：${sendErr.message}`);
          }
        }
        stateManager.deleteExpenseState(chatId, msgId);
        stateManager.markImageProcessed(msgId);
        stateManager.setImageProcessingStatus(false);
        this.processImageQueue();
      }
    });
  }

  setProcessingImage(value) {
    stateManager.setImageProcessingStatus(value);
  }

  async processImageQueue() {
    const queueLength = stateManager.imageProcessingQueue.length;
    const isProcessing = stateManager.getImageProcessingStatus();
    businessLogger.info(`處理圖片佇列：長度=${queueLength}，處理中=${isProcessing}`);
    
    if (queueLength === 0 || isProcessing) {
      businessLogger.info(`退出圖片佇列處理：佇列為空或正在處理`);
      return;
    }

    stateManager.setImageProcessingStatus(true);
    const nextImage = stateManager.getNextImage();
    const { chatId, media, defaultDate, client, driveFolderId, userId, msgId } = nextImage;
    businessLogger.info(`處理圖片：msgId=${msgId}`);

    // 發送佇列處理開始消息
    const { getClients } = require('./whatsappConnection');
    const clientData = getClients().get(userId);
    if (clientData?.ready && clientData?.client?.ws?.isOpen) {
      try {
        const remainingQueue = stateManager.imageProcessingQueue.length;
        const positionMessage = remainingQueue > 0 
          ? `\n\n📋 後續還有 ${remainingQueue} 張圖片等待處理` 
          : '';
        
        await clientData.client.sendMessage(chatId, { 
          text: `🚀 開始處理您的圖片！\n\n📊 當前處理：您的收據\n⏳ 預計完成時間：1-2 分鐘${positionMessage}` 
        });
      } catch (err) {
        businessLogger.warn(`無法發送佇列處理開始消息：${err.message}`);
      }
    }

    if (stateManager.isImageProcessing(msgId)) {
      businessLogger.warn(`圖片 msgId=${msgId} 正在處理，跳過重複處理`);
      stateManager.setImageProcessingStatus(false);
      this.processImageQueue();
      return;
    }

    stateManager.markImageProcessing(msgId);
    stateManager.removeImageFromQueue();

    try {
      if (!media || !media.data) {
        throw new Error('圖片數據無效');
      }
      businessLogger.info(`準備處理圖片：msgId=${msgId}，嘗試加入 Bull 佇列`);
      
      // 設置超時，如果Bull佇列響應太慢就直接使用事件驅動
      const timeoutPromise = new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error('Bull 佇列響應超時')), 3000);
      });
      
      try {
        await Promise.race([
          this.imageQueue.add({ chatId, media, defaultDate, userId, msgId }),
          timeoutPromise
        ]);
        businessLogger.info(`圖片已加入 Bull 佇列：msgId=${msgId}`);
      } catch (queueErr) {
        businessLogger.warn(`Bull 佇列失敗，使用事件驅動處理圖片：${queueErr.message}`);
        
        // 通知用戶切換到備用處理方式
        if (clientData?.ready && clientData?.client?.ws?.isOpen) {
          try {
            await clientData.client.sendMessage(chatId, { 
              text: '⚡ 切換到快速處理模式，請稍候...' 
            });
          } catch (err) {
            businessLogger.warn(`無法發送切換處理模式消息：${err.message}`);
          }
        }
        
        // 當 Bull 佇列失敗時，使用事件驅動處理
        if (clientData && clientData.ready && clientData.client.ws.isOpen) {
          businessLogger.info(`發送圖片處理事件：msgId=${msgId}`);
          await eventBus.emit(EventTypes.IMAGE.PROCESSING, {
            chatId,
            media,
            defaultDate,
            client: clientData.client,
            driveFolderId: clientData.driveFolderId,
            msgId,
            userId
          }, { source: EventSource.IMAGE_PROCESSING });
        } else {
          throw new Error('客戶端未就緒，無法處理圖片');
        }
      }
    } catch (err) {
      businessLogger.error(`圖片處理失敗：${err.message}`);
      
      // 發送詳細的錯誤信息和恢復建議
      if (clientData?.ready && clientData?.client?.ws?.isOpen) {
        try {
          let errorMessage = '❌ 圖片處理遇到問題';
          let suggestions = [];
          
          if (err.message.includes('客戶端未就緒')) {
            errorMessage = '🔌 連接問題';
            suggestions = [
              '檢查 WhatsApp 是否正常連接',
              '嘗試重新掃描 QR 碼',
              '稍後重新發送圖片'
            ];
          } else if (err.message.includes('數據無效')) {
            errorMessage = '📷 圖片格式問題';
            suggestions = [
              '確認圖片格式為 JPG 或 PNG',
              '檢查圖片是否完整',
              '嘗試重新拍攝或選擇其他圖片'
            ];
          } else {
            errorMessage = '⚠️ 系統處理異常';
            suggestions = [
              '稍等片刻後重新發送',
              '檢查網絡連線是否穩定',
              '如問題持續，請聯絡管理員'
            ];
          }
          
          const fullMessage = `${errorMessage}\n\n💡 解決建議：\n${suggestions.map(s => `• ${s}`).join('\n')}\n\n🔄 您可以直接重新發送圖片來重試。`;
          
          await clientData.client.sendMessage(chatId, { text: fullMessage });
        } catch (sendErr) {
          businessLogger.warn(`發送圖片處理失敗訊息時出錯：${sendErr.message}`);
        }
      }
      
      stateManager.deleteExpenseState(chatId, msgId);
      stateManager.markImageProcessed(msgId);
      stateManager.setImageProcessingStatus(false);
      businessLogger.info(`圖片處理失敗：清理 ${msgId} 狀態後繼續處理佇列`);
      
      // 繼續處理佇列中的其他圖片
      setTimeout(() => {
        this.processImageQueue();
      }, 1000); // 稍等一秒後處理下一張圖片
    }
  }

  async addImageToQueue(imageData) {
    const queueLength = stateManager.imageProcessingQueue.length;
    stateManager.addImageToQueue(imageData);
    
    // 發送加入佇列的友好提示
    const { chatId, userId } = imageData;
    const { getClients } = require('./whatsappConnection');
    const clientData = getClients().get(userId);
    
    if (clientData?.ready && clientData?.client?.ws?.isOpen) {
      try {
        if (queueLength === 0) {
          await clientData.client.sendMessage(chatId, { 
            text: '📝 收到您的圖片！正在準備處理...' 
          });
        } else {
          const estimatedWaitTime = queueLength * 90; // 假設每張圖片需要 90 秒
          const waitMinutes = Math.ceil(estimatedWaitTime / 60);
          
          await clientData.client.sendMessage(chatId, { 
            text: `⏳ 您的圖片已加入處理佇列\n\n📊 目前排隊：第 ${queueLength + 1} 位\n⏰ 預計等待：${waitMinutes} 分鐘\n\n💡 處理完成後會自動通知您！` 
          });
        }
      } catch (err) {
        businessLogger.warn(`無法發送加入佇列消息：${err.message}`);
      }
    }
    
    this.processImageQueue();
  }

  getQueueStats() {
    return {
      queueLength: stateManager.imageProcessingQueue.length,
      isProcessing: stateManager.getImageProcessingStatus(),
      processingImages: stateManager.processingImages.size
    };
  }

  async cleanup() {
    try {
      await this.imageQueue.close();
      businessLogger.info('圖片處理服務已清理');
    } catch (err) {
      businessLogger.error(`清理圖片處理服務失敗：${err.message}`);
    }
  }
}

// 建立單例實例
const imageProcessingService = new ImageProcessingService();

module.exports = imageProcessingService; 