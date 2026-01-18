const businessLogger = require('../utils/logger').businessLogger;

/**
 * 狀態管理器 - 統一管理應用程式狀態
 */
class StateManager {
  constructor() {
    // 費用對話狀態
    this.expenseState = new Map();
    
    // 訊息處理狀態
    this.processedMessages = new Set();
    this.suppressedMessages = new Set();
    
    // 圖片處理狀態
    this.imageProcessingQueue = [];
    this.processingImages = new Set();
    this.isProcessingImage = false;
    
    // AI確認狀態
    this.aiConfirmationState = new Map();
    this.processingMessages = new Set();
    
    // 統計資訊
    this.stats = {
      totalMessages: 0,
      processedMessages: 0,
      suppressedMessages: 0,
      activeExpenseChats: 0,
      queuedImages: 0,
      processingImages: 0,
      pendingAIConfirmations: 0
    };
    
    businessLogger.info('狀態管理器已初始化');
  }

  // ==================== 費用對話狀態管理 ====================
  
  /**
   * 設置費用對話狀態
   */
  setExpenseState(chatId, msgId, state) {
    const key = `${chatId}:${msgId}`;
    this.expenseState.set(key, {
      ...state,
      lastActive: Date.now()
    });
    this.updateStats();
    businessLogger.info(`設置費用對話狀態：${key}，步驟：${state.step}`);
  }

  /**
   * 獲取費用對話狀態
   */
  getExpenseState(chatId, msgId) {
    const key = `${chatId}:${msgId}`;
    return this.expenseState.get(key);
  }

  /**
   * 刪除費用對話狀態
   */
  deleteExpenseState(chatId, msgId) {
    const key = `${chatId}:${msgId}`;
    const deleted = this.expenseState.delete(key);
    if (deleted) {
      businessLogger.info(`刪除費用對話狀態：${key}`);
    }
    this.updateStats();
    return deleted;
  }

  /**
   * 獲取用戶的所有費用對話狀態
   */
  getExpenseStatesByUserId(userId) {
    const states = [];
    for (const [key, state] of this.expenseState.entries()) {
      if (state.userId === userId) {
        states.push({ key, state });
      }
    }
    return states;
  }

  /**
   * 清理過期的費用對話狀態
   */
  cleanupExpiredExpenseStates(timeout = 30 * 60 * 1000) { // 30分鐘
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, state] of this.expenseState.entries()) {
      if (now - state.lastActive > timeout) {
        this.expenseState.delete(key);
        cleanedCount++;
        businessLogger.info(`清理過期費用對話狀態：${key}`);
      }
    }
    
    if (cleanedCount > 0) {
      businessLogger.info(`清理了 ${cleanedCount} 個過期的費用對話狀態`);
    }
    
    this.updateStats();
    return cleanedCount;
  }

  // ==================== 訊息處理狀態管理 ====================
  
  /**
   * 標記訊息為已處理
   */
  markMessageProcessed(msgId) {
    // 儲存時間戳以便追蹤
    this.processedMessages.add(msgId + ':' + Date.now());
    this.stats.processedMessages++;
    this.stats.totalMessages++;
    businessLogger.debug(`標記訊息已處理：${msgId}`);
  }

  /**
   * 標記訊息為已忽略
   */
  markMessageSuppressed(msgId) {
    this.suppressedMessages.add(msgId + ':' + Date.now());
    this.stats.suppressedMessages++;
    this.stats.totalMessages++;
    businessLogger.debug(`標記訊息已忽略：${msgId}`);
  }

  /**
   * 檢查訊息是否已處理
   */
  isMessageProcessed(msgId) {
    // 檢查是否存在以該 msgId 開頭的記錄
    for (const processedMsg of this.processedMessages) {
      if (processedMsg.startsWith(msgId + ':')) {
        businessLogger.debug(`訊息 ${msgId} 已處理過`);
        return true;
      }
    }
    return false;
  }

  /**
   * 檢查訊息是否已忽略
   */
  isMessageSuppressed(msgId) {
    // 檢查是否存在以該 msgId 開頭的記錄
    for (const suppressedMsg of this.suppressedMessages) {
      if (suppressedMsg.startsWith(msgId + ':')) {
        businessLogger.debug(`訊息 ${msgId} 已忽略過`);
        return true;
      }
    }
    return false;
  }

  /**
   * 檢查訊息是否正在處理中（防止重複處理）
   */
  isMessageProcessing(msgId) {
    return this.processingMessages && this.processingMessages.has(msgId);
  }

  /**
   * 標記訊息為處理中
   */
  markMessageProcessing(msgId) {
    if (!this.processingMessages) {
      this.processingMessages = new Set();
    }
    this.processingMessages.add(msgId);
    businessLogger.debug(`標記訊息處理中：${msgId}`);
  }

  /**
   * 完成訊息處理
   */
  completeMessageProcessing(msgId) {
    if (this.processingMessages) {
      this.processingMessages.delete(msgId);
    }
    this.markMessageProcessed(msgId);
    businessLogger.debug(`完成訊息處理：${msgId}`);
  }

  /**
   * 清理舊的訊息記錄
   */
  cleanupOldMessages(maxSize = 10000) {
    // 清理處理中的訊息（超過5分鐘的）
    if (this.processingMessages) {
      const now = Date.now();
      const oldProcessingMessages = Array.from(this.processingMessages);
      for (const msgId of oldProcessingMessages) {
        // 如果訊息處理超過5分鐘，移除處理中標記
        // 這裡簡化處理，實際應該加入時間戳
        if (oldProcessingMessages.length > 100) {
          this.processingMessages.delete(msgId);
        }
      }
    }

    if (this.processedMessages.size > maxSize) {
      const oldSize = this.processedMessages.size;
      // 只保留最近的記錄
      const recentMessages = Array.from(this.processedMessages)
        .sort((a, b) => {
          const timeA = parseInt(a.split(':').pop());
          const timeB = parseInt(b.split(':').pop());
          return timeB - timeA;
        })
        .slice(0, Math.floor(maxSize / 2));
      
      this.processedMessages.clear();
      recentMessages.forEach(msg => this.processedMessages.add(msg));
      businessLogger.info(`清理已處理訊息記錄：${oldSize} -> ${this.processedMessages.size}`);
    }
    
    if (this.suppressedMessages.size > maxSize) {
      const oldSize = this.suppressedMessages.size;
      // 只保留最近的記錄
      const recentMessages = Array.from(this.suppressedMessages)
        .sort((a, b) => {
          const timeA = parseInt(a.split(':').pop());
          const timeB = parseInt(b.split(':').pop());
          return timeB - timeA;
        })
        .slice(0, Math.floor(maxSize / 2));
      
      this.suppressedMessages.clear();
      recentMessages.forEach(msg => this.suppressedMessages.add(msg));
      businessLogger.info(`清理已忽略訊息記錄：${oldSize} -> ${this.suppressedMessages.size}`);
    }
  }

  // ==================== AI確認狀態管理 ====================
  
  /**
   * 設置AI確認狀態
   */
  setAIConfirmationState(chatId, msgId, aiData) {
    const key = `${chatId}:${msgId}`;
    this.aiConfirmationState.set(key, {
      ...aiData,
      chatId,
      msgId,
      createdAt: Date.now(),
      lastActive: Date.now()
    });
    this.updateStats();
    businessLogger.info(`設置AI確認狀態：${key}，欄位數量：${Object.keys(aiData.parsedData || {}).length}`);
  }

  /**
   * 獲取AI確認狀態
   */
  getAIConfirmationState(chatId, msgId) {
    const key = `${chatId}:${msgId}`;
    return this.aiConfirmationState.get(key);
  }

  /**
   * 檢查是否存在AI確認狀態
   */
  hasAIConfirmationState(chatId, msgId) {
    const key = `${chatId}:${msgId}`;
    return this.aiConfirmationState.has(key);
  }

  /**
   * 刪除AI確認狀態
   */
  deleteAIConfirmationState(chatId, msgId) {
    const key = `${chatId}:${msgId}`;
    const deleted = this.aiConfirmationState.delete(key);
    if (deleted) {
      businessLogger.info(`刪除AI確認狀態：${key}`);
    }
    this.updateStats();
    return deleted;
  }

  /**
   * 獲取用戶的所有AI確認狀態
   */
  getAIConfirmationStatesByUserId(userId) {
    const states = [];
    for (const [key, state] of this.aiConfirmationState.entries()) {
      if (state.userId === userId) {
        states.push({ key, state });
      }
    }
    return states;
  }

  /**
   * 清理過期的AI確認狀態
   */
  cleanupExpiredAIConfirmationStates(timeout = 10 * 60 * 1000) { // 10分鐘
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, state] of this.aiConfirmationState.entries()) {
      if (now - state.lastActive > timeout) {
        this.aiConfirmationState.delete(key);
        cleanedCount++;
        businessLogger.info(`清理過期AI確認狀態：${key}`);
      }
    }
    
    if (cleanedCount > 0) {
      businessLogger.info(`清理了 ${cleanedCount} 個過期的AI確認狀態`);
    }
    
    this.updateStats();
    return cleanedCount;
  }

  // ==================== 圖片處理狀態管理 ====================
  
  /**
   * 添加圖片到處理佇列
   */
  addImageToQueue(imageData) {
    this.imageProcessingQueue.push(imageData);
    this.updateStats();
    businessLogger.info(`圖片已加入佇列：長度=${this.imageProcessingQueue.length}，msgId=${imageData.msgId}`);
  }

  /**
   * 從佇列中移除圖片
   */
  removeImageFromQueue() {
    const image = this.imageProcessingQueue.shift();
    this.updateStats();
    if (image) {
      businessLogger.info(`從佇列移除圖片：新長度=${this.imageProcessingQueue.length}，msgId=${image.msgId}`);
    }
    return image;
  }

  /**
   * 獲取佇列中的下一張圖片
   */
  getNextImage() {
    return this.imageProcessingQueue[0];
  }

  /**
   * 標記圖片為處理中
   */
  markImageProcessing(msgId) {
    this.processingImages.add(msgId);
    this.updateStats();
  }

  /**
   * 標記圖片處理完成
   */
  markImageProcessed(msgId) {
    this.processingImages.delete(msgId);
    this.updateStats();
  }

  /**
   * 檢查圖片是否正在處理
   */
  isImageProcessing(msgId) {
    return this.processingImages.has(msgId);
  }

  /**
   * 設置圖片處理狀態
   */
  setImageProcessingStatus(status) {
    this.isProcessingImage = status;
    this.updateStats();
  }

  /**
   * 獲取圖片處理狀態
   */
  getImageProcessingStatus() {
    return this.isProcessingImage;
  }

  // ==================== 統計資訊管理 ====================
  
  /**
   * 更新統計資訊
   */
  updateStats() {
    this.stats.activeExpenseChats = this.expenseState.size;
    this.stats.queuedImages = this.imageProcessingQueue.length;
    this.stats.processingImages = this.processingImages.size;
    this.stats.pendingAIConfirmations = this.aiConfirmationState.size;
  }

  /**
   * 獲取統計資訊
   */
  getStats() {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * 重置統計資訊
   */
  resetStats() {
    this.stats = {
      totalMessages: 0,
      processedMessages: 0,
      suppressedMessages: 0,
      activeExpenseChats: 0,
      queuedImages: 0,
      processingImages: 0,
      pendingAIConfirmations: 0
    };
    businessLogger.info('統計資訊已重置');
  }

  // ==================== 清理和維護 ====================
  
  /**
   * 清理所有狀態
   */
  cleanup() {
    const expenseStateSize = this.expenseState.size;
    const processedMessagesSize = this.processedMessages.size;
    const suppressedMessagesSize = this.suppressedMessages.size;
    const queueSize = this.imageProcessingQueue.length;
    const processingSize = this.processingImages.size;
    const aiConfirmationSize = this.aiConfirmationState.size;
    
    this.expenseState.clear();
    this.processedMessages.clear();
    this.suppressedMessages.clear();
    this.imageProcessingQueue = [];
    this.processingImages.clear();
    this.aiConfirmationState.clear();
    this.isProcessingImage = false;
    
    businessLogger.info(`狀態清理完成：費用對話=${expenseStateSize}，已處理訊息=${processedMessagesSize}，已忽略訊息=${suppressedMessagesSize}，佇列=${queueSize}，處理中=${processingSize}，AI確認=${aiConfirmationSize}`);
  }

  /**
   * 獲取狀態摘要
   */
  getStatusSummary() {
    this.updateStats();
    return {
      expenseStates: this.expenseState.size,
      processedMessages: this.processedMessages.size,
      suppressedMessages: this.suppressedMessages.size,
      imageQueue: this.imageProcessingQueue.length,
      processingImages: this.processingImages.size,
      aiConfirmations: this.aiConfirmationState.size,
      isProcessingImage: this.isProcessingImage,
      stats: this.stats
    };
  }
}

// 建立單例實例
const stateManager = new StateManager();

module.exports = stateManager; 