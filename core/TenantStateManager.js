const businessLogger = require('../utils/logger').businessLogger;

/**
 * 租戶級狀態管理器 - 為每個租戶提供獨立的狀態管理
 */
class TenantStateManager {
  constructor(tenantId) {
    this.tenantId = tenantId;
    
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
    
    // 活動時間戳
    this.lastActivity = Date.now();
    
    businessLogger.info(`租戶狀態管理器已初始化: ${tenantId}`);
  }
  
  /**
   * 更新最後活動時間
   */
  updateActivity() {
    this.lastActivity = Date.now();
  }
  
  /**
   * 獲取租戶ID
   */
  getTenantId() {
    return this.tenantId;
  }
  
  /**
   * 獲取最後活動時間
   */
  getLastActivity() {
    return this.lastActivity;
  }
  
  // ==================== 費用對話狀態管理 ====================
  
  /**
   * 設置費用對話狀態
   */
  setExpenseState(chatId, messageId, state) {
    const key = `${chatId}:${messageId}`;
    this.expenseState.set(key, {
      ...state,
      tenantId: this.tenantId,
      timestamp: Date.now()
    });
    this.updateActivity();
    businessLogger.debug(`設置費用狀態 [${this.tenantId}]: ${key}`);
  }
  
  /**
   * 獲取費用對話狀態
   */
  getExpenseState(chatId, messageId) {
    const key = `${chatId}:${messageId}`;
    const state = this.expenseState.get(key);
    this.updateActivity();
    return state;
  }
  
  /**
   * 刪除費用對話狀態
   */
  deleteExpenseState(chatId, messageId) {
    const key = `${chatId}:${messageId}`;
    const deleted = this.expenseState.delete(key);
    this.updateActivity();
    if (deleted) {
      businessLogger.debug(`刪除費用狀態 [${this.tenantId}]: ${key}`);
    }
    return deleted;
  }
  
  /**
   * 檢查是否有活躍的費用對話
   */
  hasActiveExpenseChat(chatId) {
    for (const [key, state] of this.expenseState.entries()) {
      if (key.startsWith(`${chatId}:`)) {
        return true;
      }
    }
    return false;
  }
  
  // ==================== 訊息處理狀態管理 ====================
  
  /**
   * 標記訊息已處理
   */
  markMessageProcessed(messageId) {
    this.processedMessages.add(messageId);
    this.updateActivity();
    businessLogger.debug(`標記訊息已處理 [${this.tenantId}]: ${messageId}`);
  }
  
  /**
   * 檢查訊息是否已處理
   */
  isMessageProcessed(messageId) {
    this.updateActivity();
    return this.processedMessages.has(messageId);
  }
  
  /**
   * 標記訊息已抑制
   */
  markMessageSuppressed(messageId) {
    this.suppressedMessages.add(messageId);
    this.updateActivity();
    businessLogger.debug(`標記訊息已抑制 [${this.tenantId}]: ${messageId}`);
  }
  
  /**
   * 檢查訊息是否已抑制
   */
  isMessageSuppressed(messageId) {
    this.updateActivity();
    return this.suppressedMessages.has(messageId);
  }
  
  /**
   * 檢查訊息是否正在處理中（防止重複處理）
   */
  isMessageProcessing(msgId) {
    this.updateActivity();
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
    this.updateActivity();
    businessLogger.debug(`標記訊息處理中 [${this.tenantId}]: ${msgId}`);
  }
  
  /**
   * 完成訊息處理
   */
  completeMessageProcessing(msgId) {
    if (this.processingMessages) {
      this.processingMessages.delete(msgId);
    }
    this.markMessageProcessed(msgId);
    this.updateActivity();
    businessLogger.debug(`完成訊息處理 [${this.tenantId}]: ${msgId}`);
  }
  
  // ==================== 圖片處理狀態管理 ====================
  
  /**
   * 添加圖片到處理佇列
   */
  addImageToQueue(imageData) {
    this.imageProcessingQueue.push({
      ...imageData,
      tenantId: this.tenantId,
      timestamp: Date.now()
    });
    this.updateActivity();
    businessLogger.debug(`添加圖片到佇列 [${this.tenantId}]: ${imageData.messageId}`);
  }
  
  /**
   * 從佇列中獲取下一個圖片
   */
  getNextImageFromQueue() {
    if (this.imageProcessingQueue.length > 0) {
      const image = this.imageProcessingQueue.shift();
      this.updateActivity();
      return image;
    }
    return null;
  }
  
  /**
   * 標記圖片為處理中
   */
  markImageProcessing(messageId) {
    this.processingImages.add(messageId);
    this.isProcessingImage = true;
    this.updateActivity();
    businessLogger.debug(`標記圖片處理中 [${this.tenantId}]: ${messageId}`);
  }
  
  /**
   * 完成圖片處理
   */
  completeImageProcessing(messageId) {
    this.processingImages.delete(messageId);
    if (this.processingImages.size === 0) {
      this.isProcessingImage = false;
    }
    this.updateActivity();
    businessLogger.debug(`完成圖片處理 [${this.tenantId}]: ${messageId}`);
  }
  
  /**
   * 設置圖片處理狀態
   */
  setImageProcessingStatus(value) {
    this.isProcessingImage = value;
    this.updateActivity();
  }
  
  /**
   * 獲取圖片處理狀態
   */
  getImageProcessingStatus() {
    this.updateActivity();
    return this.isProcessingImage;
  }
  
  // ==================== AI確認狀態管理 ====================
  
  /**
   * 設置AI確認狀態
   */
  setAIConfirmationState(messageId, state) {
    this.aiConfirmationState.set(messageId, {
      ...state,
      tenantId: this.tenantId,
      timestamp: Date.now()
    });
    this.updateActivity();
    businessLogger.debug(`設置AI確認狀態 [${this.tenantId}]: ${messageId}`);
  }
  
  /**
   * 獲取AI確認狀態
   */
  getAIConfirmationState(messageId) {
    const state = this.aiConfirmationState.get(messageId);
    this.updateActivity();
    return state;
  }
  
  /**
   * 刪除AI確認狀態
   */
  deleteAIConfirmationState(messageId) {
    const deleted = this.aiConfirmationState.delete(messageId);
    this.updateActivity();
    if (deleted) {
      businessLogger.debug(`刪除AI確認狀態 [${this.tenantId}]: ${messageId}`);
    }
    return deleted;
  }
  
  // ==================== 統計資訊管理 ====================
  
  /**
   * 更新統計資訊
   */
  updateStats() {
    this.stats = {
      totalMessages: this.processedMessages.size + this.suppressedMessages.size,
      processedMessages: this.processedMessages.size,
      suppressedMessages: this.suppressedMessages.size,
      activeExpenseChats: this.expenseState.size,
      queuedImages: this.imageProcessingQueue.length,
      processingImages: this.processingImages.size,
      pendingAIConfirmations: this.aiConfirmationState.size
    };
  }
  
  /**
   * 獲取統計資訊
   */
  getStats() {
    this.updateStats();
    return this.stats;
  }
  
  /**
   * 獲取佇列統計
   */
  getQueueStats() {
    return {
      queueLength: this.imageProcessingQueue.length,
      isProcessing: this.isProcessingImage,
      processingImages: this.processingImages.size
    };
  }
  
  /**
   * 獲取狀態摘要
   */
  getStatusSummary() {
    this.updateStats();
    return {
      tenantId: this.tenantId,
      expenseStates: this.expenseState.size,
      processedMessages: this.processedMessages.size,
      suppressedMessages: this.suppressedMessages.size,
      imageQueue: this.imageProcessingQueue.length,
      processingImages: this.processingImages.size,
      aiConfirmations: this.aiConfirmationState.size,
      isProcessingImage: this.isProcessingImage,
      stats: this.stats,
      lastActivity: this.lastActivity
    };
  }
  
  // ==================== 清理機制 ====================
  
  /**
   * 清理過期狀態
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30分鐘
    
    // 清理過期費用狀態
    let cleanedExpenseStates = 0;
    for (const [key, state] of this.expenseState.entries()) {
      if (now - state.timestamp > maxAge) {
        this.expenseState.delete(key);
        cleanedExpenseStates++;
      }
    }
    
    // 清理過期AI確認狀態
    let cleanedAIConfirmations = 0;
    for (const [messageId, state] of this.aiConfirmationState.entries()) {
      if (now - state.timestamp > maxAge) {
        this.aiConfirmationState.delete(messageId);
        cleanedAIConfirmations++;
      }
    }
    
    if (cleanedExpenseStates > 0 || cleanedAIConfirmations > 0) {
      businessLogger.info(`清理租戶狀態 [${this.tenantId}]: 費用狀態${cleanedExpenseStates}個, AI確認${cleanedAIConfirmations}個`);
    }
    
    this.updateActivity();
  }
  
  /**
   * 檢查是否為不活躍狀態
   */
  isInactive(maxInactiveTime = 60 * 60 * 1000) { // 默認1小時
    return Date.now() - this.lastActivity > maxInactiveTime;
  }
  
  /**
   * 重置所有狀態
   */
  reset() {
    this.expenseState.clear();
    this.processedMessages.clear();
    this.suppressedMessages.clear();
    this.imageProcessingQueue = [];
    this.processingImages.clear();
    this.isProcessingImage = false;
    this.aiConfirmationState.clear();
    this.processingMessages.clear();
    this.updateActivity();
    businessLogger.info(`重置租戶狀態 [${this.tenantId}]`);
  }
}

module.exports = TenantStateManager; 