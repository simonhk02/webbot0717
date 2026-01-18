const { businessLogger } = require('../utils/logger');

/**
 * 事件總線 - 統一管理應用程式事件
 * 解決服務間的循環依賴問題
 */
class EventBus {
  constructor() {
    this.listeners = new Map();
    this.middleware = [];
    this.stats = {
      totalEvents: 0,
      eventsByType: new Map(),
      listenersByType: new Map()
    };
    
    businessLogger.info('事件總線已初始化');
  }

  /**
   * 註冊事件監聽器
   * @param {string} eventType - 事件類型
   * @param {Function} listener - 監聽器函數
   * @param {Object} options - 選項
   */
  on(eventType, listener, options = {}) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    
    const listenerInfo = {
      fn: listener,
      options: {
        once: options.once || false,
        priority: options.priority || 0,
        id: options.id || `listener_${Date.now()}_${Math.random()}`
      }
    };
    
    this.listeners.get(eventType).push(listenerInfo);
    
    // 按優先級排序（高優先級在前）
    this.listeners.get(eventType).sort((a, b) => b.options.priority - a.options.priority);
    
    // 更新統計
    const currentCount = this.stats.listenersByType.get(eventType) || 0;
    this.stats.listenersByType.set(eventType, currentCount + 1);
    
    businessLogger.debug(`註冊事件監聽器：${eventType}，優先級：${listenerInfo.options.priority}`);
  }

  /**
   * 註冊一次性事件監聽器
   * @param {string} eventType - 事件類型
   * @param {Function} listener - 監聽器函數
   * @param {Object} options - 選項
   */
  once(eventType, listener, options = {}) {
    this.on(eventType, listener, { ...options, once: true });
  }

  /**
   * 移除事件監聽器
   * @param {string} eventType - 事件類型
   * @param {Function} listener - 監聽器函數
   */
  off(eventType, listener) {
    if (!this.listeners.has(eventType)) {
      return;
    }
    
    const listeners = this.listeners.get(eventType);
    const index = listeners.findIndex(l => l.fn === listener);
    
    if (index !== -1) {
      listeners.splice(index, 1);
      
      // 更新統計
      const currentCount = this.stats.listenersByType.get(eventType) || 0;
      this.stats.listenersByType.set(eventType, Math.max(0, currentCount - 1));
      
      businessLogger.debug(`移除事件監聽器：${eventType}`);
    }
  }

  /**
   * 移除所有指定類型的事件監聽器
   * @param {string} eventType - 事件類型
   */
  removeAllListeners(eventType) {
    if (this.listeners.has(eventType)) {
      this.listeners.delete(eventType);
      this.stats.listenersByType.delete(eventType);
      businessLogger.debug(`移除所有事件監聽器：${eventType}`);
    }
  }

  /**
   * 發送事件
   * @param {string} eventType - 事件類型
   * @param {*} data - 事件數據
   * @param {Object} options - 選項
   */
  async emit(eventType, data = {}, options = {}) {
    const event = {
      type: eventType,
      data,
      timestamp: Date.now(),
      id: options.id || `event_${Date.now()}_${Math.random()}`,
      source: options.source || 'unknown'
    };

    // 更新統計
    this.stats.totalEvents++;
    const currentCount = this.stats.eventsByType.get(eventType) || 0;
    this.stats.eventsByType.set(eventType, currentCount + 1);

    businessLogger.debug(`發送事件：${eventType}，來源：${event.source}`);

    // 執行中間件
    for (const middleware of this.middleware) {
      try {
        await middleware(event);
      } catch (error) {
        businessLogger.error(`事件中間件執行失敗：${error.message}`);
      }
    }

    // 獲取監聽器
    const listeners = this.listeners.get(eventType) || [];
    const results = [];

    // 執行監聽器
    for (let i = 0; i < listeners.length; i++) {
      const listenerInfo = listeners[i];
      
      try {
        const result = await listenerInfo.fn(event);
        results.push({ success: true, result });
        
        // 如果是一次性監聽器，移除它
        if (listenerInfo.options.once) {
          listeners.splice(i, 1);
          i--; // 調整索引
          
          // 更新統計
          const currentCount = this.stats.listenersByType.get(eventType) || 0;
          this.stats.listenersByType.set(eventType, Math.max(0, currentCount - 1));
        }
      } catch (error) {
        businessLogger.error(`事件監聽器執行失敗：${eventType}，錯誤：${error.message}`);
        results.push({ success: false, error: error.message });
      }
    }

    businessLogger.debug(`事件處理完成：${eventType}，監聽器數量：${listeners.length}，結果：${results.length}`);

    return {
      event,
      results,
      listenerCount: listeners.length
    };
  }

  /**
   * 添加中間件
   * @param {Function} middleware - 中間件函數
   */
  use(middleware) {
    this.middleware.push(middleware);
    businessLogger.debug('添加事件中間件');
  }

  /**
   * 獲取事件統計
   */
  getStats() {
    return {
      ...this.stats,
      eventsByType: Object.fromEntries(this.stats.eventsByType),
      listenersByType: Object.fromEntries(this.stats.listenersByType),
      totalListeners: Array.from(this.stats.listenersByType.values()).reduce((sum, count) => sum + count, 0)
    };
  }

  /**
   * 重置統計
   */
  resetStats() {
    this.stats = {
      totalEvents: 0,
      eventsByType: new Map(),
      listenersByType: new Map()
    };
    businessLogger.info('事件統計已重置');
  }

  /**
   * 獲取所有註冊的事件類型
   */
  getEventTypes() {
    return Array.from(this.listeners.keys());
  }

  /**
   * 獲取指定事件類型的監聽器數量
   */
  getListenerCount(eventType) {
    return this.listeners.get(eventType)?.length || 0;
  }

  /**
   * 清理所有監聽器
   */
  clear() {
    this.listeners.clear();
    this.middleware = [];
    this.resetStats();
    businessLogger.info('事件總線已清理');
  }
}

// 建立單例實例
const eventBus = new EventBus();

// 導出單例實例作為主要導出
module.exports = eventBus;

// 同時導出建構函數供測試使用
module.exports.EventBus = EventBus; 