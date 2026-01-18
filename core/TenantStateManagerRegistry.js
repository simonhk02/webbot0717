const businessLogger = require('../utils/logger').businessLogger;
const TenantStateManager = require('./TenantStateManager');

/**
 * 租戶狀態管理器註冊表 - 管理所有租戶的StateManager實例
 */
class TenantStateManagerRegistry {
  constructor() {
    this.managers = new Map();
    this.cleanupInterval = null;
    this.stats = {
      totalManagers: 0,
      activeManagers: 0,
      inactiveManagers: 0,
      totalMemoryUsage: 0
    };
    
    this.startCleanupTimer();
    businessLogger.info('租戶狀態管理器註冊表已初始化');
  }
  
  /**
   * 獲取或創建租戶StateManager
   */
  getManager(tenantId) {
    if (!tenantId) {
      throw new Error('租戶ID不能為空');
    }
    
    if (!this.managers.has(tenantId)) {
      this.managers.set(tenantId, new TenantStateManager(tenantId));
      this.stats.totalManagers++;
      businessLogger.info(`創建租戶StateManager: ${tenantId}`);
    }
    
    const manager = this.managers.get(tenantId);
    manager.updateActivity();
    return manager;
  }
  
  /**
   * 檢查租戶StateManager是否存在
   */
  hasManager(tenantId) {
    return this.managers.has(tenantId);
  }
  
  /**
   * 移除租戶StateManager
   */
  removeManager(tenantId) {
    if (this.managers.has(tenantId)) {
      const manager = this.managers.get(tenantId);
      manager.reset(); // 清理狀態
      this.managers.delete(tenantId);
      this.stats.totalManagers--;
      businessLogger.info(`移除租戶StateManager: ${tenantId}`);
      return true;
    }
    return false;
  }
  
  /**
   * 獲取所有租戶ID
   */
  getAllTenantIds() {
    return Array.from(this.managers.keys());
  }
  
  /**
   * 獲取所有StateManager
   */
  getAllManagers() {
    return Array.from(this.managers.values());
  }
  
  /**
   * 啟動清理定時器
   */
  startCleanupTimer() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveManagers();
    }, 5 * 60 * 1000); // 每5分鐘清理一次
    
    businessLogger.info('租戶StateManager清理定時器已啟動');
  }
  
  /**
   * 停止清理定時器
   */
  stopCleanupTimer() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      businessLogger.info('租戶StateManager清理定時器已停止');
    }
  }
  
  /**
   * 清理不活躍的StateManager
   */
  cleanupInactiveManagers() {
    const now = Date.now();
    const maxInactiveTime = 60 * 60 * 1000; // 1小時無活動
    const inactiveTenants = [];
    
    for (const [tenantId, manager] of this.managers.entries()) {
      if (manager.isInactive(maxInactiveTime)) {
        inactiveTenants.push(tenantId);
      } else {
        // 清理過期狀態
        manager.cleanup();
      }
    }
    
    // 移除不活躍的租戶
    for (const tenantId of inactiveTenants) {
      this.removeManager(tenantId);
    }
    
    if (inactiveTenants.length > 0) {
      businessLogger.info(`清理不活躍租戶StateManager: ${inactiveTenants.join(', ')}`);
    }
    
    this.updateStats();
  }
  
  /**
   * 手動清理指定租戶
   */
  cleanupTenant(tenantId) {
    if (this.managers.has(tenantId)) {
      const manager = this.managers.get(tenantId);
      manager.cleanup();
      businessLogger.info(`手動清理租戶StateManager: ${tenantId}`);
      return true;
    }
    return false;
  }
  
  /**
   * 清理所有租戶
   */
  cleanupAllTenants() {
    const tenantIds = this.getAllTenantIds();
    for (const tenantId of tenantIds) {
      this.cleanupTenant(tenantId);
    }
    businessLogger.info(`清理所有租戶StateManager: ${tenantIds.length}個`);
  }
  
  /**
   * 更新統計信息
   */
  updateStats() {
    let activeCount = 0;
    let inactiveCount = 0;
    let totalMemoryUsage = 0;
    
    const now = Date.now();
    const maxInactiveTime = 60 * 60 * 1000; // 1小時
    
    for (const manager of this.managers.values()) {
      if (manager.isInactive(maxInactiveTime)) {
        inactiveCount++;
      } else {
        activeCount++;
      }
      
      // 估算記憶體使用（簡單估算）
      totalMemoryUsage += this.estimateMemoryUsage(manager);
    }
    
    this.stats = {
      totalManagers: this.managers.size,
      activeManagers: activeCount,
      inactiveManagers: inactiveCount,
      totalMemoryUsage: Math.round(totalMemoryUsage / 1024 / 1024) // MB
    };
  }
  
  /**
   * 估算StateManager記憶體使用
   */
  estimateMemoryUsage(manager) {
    let usage = 0;
    
    // 基礎對象大小
    usage += 1000; // 基礎對象開銷
    
    // 費用狀態
    usage += manager.expenseState.size * 200;
    
    // 訊息狀態
    usage += manager.processedMessages.size * 50;
    usage += manager.suppressedMessages.size * 50;
    usage += manager.processingMessages.size * 50;
    
    // 圖片狀態
    usage += manager.imageProcessingQueue.length * 300;
    usage += manager.processingImages.size * 100;
    
    // AI確認狀態
    usage += manager.aiConfirmationState.size * 150;
    
    return usage;
  }
  
  /**
   * 獲取統計信息
   */
  getStats() {
    this.updateStats();
    return this.stats;
  }
  
  /**
   * 獲取詳細統計信息
   */
  getDetailedStats() {
    const stats = this.getStats();
    const tenantStats = [];
    
    for (const [tenantId, manager] of this.managers.entries()) {
      tenantStats.push({
        tenantId,
        lastActivity: manager.getLastActivity(),
        isActive: !manager.isInactive(),
        memoryUsage: Math.round(this.estimateMemoryUsage(manager) / 1024), // KB
        ...manager.getStatusSummary()
      });
    }
    
    return {
      ...stats,
      tenants: tenantStats
    };
  }
  
  /**
   * 獲取健康狀態
   */
  getHealthStatus() {
    const stats = this.getStats();
    const health = {
      status: 'healthy',
      issues: []
    };
    
    // 檢查記憶體使用
    if (stats.totalMemoryUsage > 100) { // 超過100MB
      health.status = 'warning';
      health.issues.push(`記憶體使用過高: ${stats.totalMemoryUsage}MB`);
    }
    
    // 檢查不活躍租戶數量
    if (stats.inactiveManagers > stats.totalManagers * 0.5) { // 超過50%不活躍
      health.status = 'warning';
      health.issues.push(`不活躍租戶過多: ${stats.inactiveManagers}/${stats.totalManagers}`);
    }
    
    // 檢查總租戶數量
    if (stats.totalManagers > 1000) { // 超過1000個租戶
      health.status = 'warning';
      health.issues.push(`租戶數量過多: ${stats.totalManagers}`);
    }
    
    return health;
  }
  
  /**
   * 重置所有StateManager
   */
  reset() {
    const tenantIds = this.getAllTenantIds();
    for (const tenantId of tenantIds) {
      this.removeManager(tenantId);
    }
    this.stats = {
      totalManagers: 0,
      activeManagers: 0,
      inactiveManagers: 0,
      totalMemoryUsage: 0
    };
    businessLogger.info('重置所有租戶StateManager');
  }
  
  /**
   * 關閉註冊表
   */
  shutdown() {
    this.stopCleanupTimer();
    this.reset();
    businessLogger.info('租戶StateManager註冊表已關閉');
  }
}

// 創建全局實例
const tenantStateManagerRegistry = new TenantStateManagerRegistry();

// 優雅關閉處理
process.on('SIGINT', () => {
  tenantStateManagerRegistry.shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  tenantStateManagerRegistry.shutdown();
  process.exit(0);
});

module.exports = {
  TenantStateManagerRegistry,
  tenantStateManagerRegistry
}; 