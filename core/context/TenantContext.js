/**
 * 租戶上下文管理器
 * 實現多租戶架構的核心功能
 */

const { businessLogger } = require('../../utils/logger');

class TenantContext {
  constructor() {
    this.tenantId = null;
    this.userId = null;
    this.permissions = [];
    this.metadata = {};
    this.createdAt = null;
    this.logger = businessLogger;
  }

  /**
   * 創建租戶上下文
   * @param {string} tenantId - 租戶ID
   * @param {string} userId - 用戶ID
   * @param {Array} permissions - 權限列表
   * @param {Object} metadata - 元數據
   * @returns {TenantContext} 租戶上下文實例
   */
  static create(tenantId, userId, permissions = [], metadata = {}) {
    const context = new TenantContext();
    context.tenantId = tenantId;
    context.userId = userId;
    context.permissions = permissions;
    context.metadata = metadata;
    context.createdAt = new Date();
    
    context.logger.info('租戶上下文已創建', {
      tenantId,
      userId,
      permissionsCount: permissions.length
    });
    
    return context;
  }

  /**
   * 檢查是否有指定權限
   * @param {string} permission - 權限名稱
   * @returns {boolean} 是否有權限
   */
  hasPermission(permission) {
    return this.permissions.includes(permission);
  }

  /**
   * 檢查是否有任一權限
   * @param {Array} permissions - 權限列表
   * @returns {boolean} 是否有任一權限
   */
  hasAnyPermission(permissions) {
    return permissions.some(permission => this.hasPermission(permission));
  }

  /**
   * 檢查是否有所有權限
   * @param {Array} permissions - 權限列表
   * @returns {boolean} 是否有所有權限
   */
  hasAllPermissions(permissions) {
    return permissions.every(permission => this.hasPermission(permission));
  }

  /**
   * 添加權限
   * @param {string} permission - 權限名稱
   */
  addPermission(permission) {
    if (!this.hasPermission(permission)) {
      this.permissions.push(permission);
      this.logger.info('權限已添加', {
        tenantId: this.tenantId,
        userId: this.userId,
        permission
      });
    }
  }

  /**
   * 移除權限
   * @param {string} permission - 權限名稱
   */
  removePermission(permission) {
    const index = this.permissions.indexOf(permission);
    if (index > -1) {
      this.permissions.splice(index, 1);
      this.logger.info('權限已移除', {
        tenantId: this.tenantId,
        userId: this.userId,
        permission
      });
    }
  }

  /**
   * 設置元數據
   * @param {string} key - 鍵名
   * @param {*} value - 值
   */
  setMetadata(key, value) {
    this.metadata[key] = value;
  }

  /**
   * 獲取元數據
   * @param {string} key - 鍵名
   * @param {*} defaultValue - 預設值
   * @returns {*} 元數據值
   */
  getMetadata(key, defaultValue = null) {
    return this.metadata[key] !== undefined ? this.metadata[key] : defaultValue;
  }

  /**
   * 獲取上下文摘要
   * @returns {Object} 上下文摘要
   */
  getSummary() {
    return {
      tenantId: this.tenantId,
      userId: this.userId,
      permissions: this.permissions,
      permissionsCount: this.permissions.length,
      metadata: this.metadata,
      createdAt: this.createdAt,
      age: this.createdAt ? Date.now() - this.createdAt.getTime() : 0
    };
  }

  /**
   * 驗證上下文有效性
   * @returns {boolean} 是否有效
   */
  isValid() {
    return this.tenantId && this.userId && this.createdAt;
  }

  /**
   * 克隆上下文
   * @returns {TenantContext} 克隆的上下文
   */
  clone() {
    const cloned = new TenantContext();
    cloned.tenantId = this.tenantId;
    cloned.userId = this.userId;
    cloned.permissions = [...this.permissions];
    cloned.metadata = { ...this.metadata };
    cloned.createdAt = this.createdAt ? new Date(this.createdAt) : null;
    return cloned;
  }

  /**
   * 轉換為 JSON 對象
   * @returns {Object} JSON 對象
   */
  toJSON() {
    return {
      tenantId: this.tenantId,
      userId: this.userId,
      permissions: this.permissions,
      metadata: this.metadata,
      createdAt: this.createdAt?.toISOString(),
      isValid: this.isValid()
    };
  }
}

/**
 * 租戶上下文管理器
 */
class TenantContextManager {
  constructor() {
    this.contexts = new Map(); // requestId -> TenantContext
    this.tenantContexts = new Map(); // tenantId -> Set of TenantContext
    this.logger = businessLogger;
    
    this.logger.info('租戶上下文管理器已初始化');
  }

  /**
   * 創建並存儲租戶上下文
   * @param {string} requestId - 請求ID
   * @param {string} tenantId - 租戶ID
   * @param {string} userId - 用戶ID
   * @param {Array} permissions - 權限列表
   * @param {Object} metadata - 元數據
   * @returns {TenantContext} 租戶上下文
   */
  createContext(requestId, tenantId, userId, permissions = [], metadata = {}) {
    const context = TenantContext.create(tenantId, userId, permissions, metadata);
    
    // 存儲到請求映射
    this.contexts.set(requestId, context);
    
    // 存儲到租戶映射
    if (!this.tenantContexts.has(tenantId)) {
      this.tenantContexts.set(tenantId, new Set());
    }
    this.tenantContexts.get(tenantId).add(context);
    
    this.logger.info('租戶上下文已創建並存儲', {
      requestId,
      tenantId,
      userId
    });
    
    return context;
  }

  /**
   * 獲取租戶上下文
   * @param {string} requestId - 請求ID
   * @returns {TenantContext|null} 租戶上下文
   */
  getContext(requestId) {
    return this.contexts.get(requestId) || null;
  }

  /**
   * 獲取租戶的所有上下文
   * @param {string} tenantId - 租戶ID
   * @returns {Array} 上下文列表
   */
  getTenantContexts(tenantId) {
    const contexts = this.tenantContexts.get(tenantId);
    return contexts ? Array.from(contexts) : [];
  }

  /**
   * 移除租戶上下文
   * @param {string} requestId - 請求ID
   */
  removeContext(requestId) {
    const context = this.contexts.get(requestId);
    if (context) {
      // 從請求映射中移除
      this.contexts.delete(requestId);
      
      // 從租戶映射中移除
      const tenantContexts = this.tenantContexts.get(context.tenantId);
      if (tenantContexts) {
        tenantContexts.delete(context);
        if (tenantContexts.size === 0) {
          this.tenantContexts.delete(context.tenantId);
        }
      }
      
      this.logger.info('租戶上下文已移除', {
        requestId,
        tenantId: context.tenantId,
        userId: context.userId
      });
    }
  }

  /**
   * 清理過期的上下文
   * @param {number} maxAge - 最大年齡（毫秒）
   */
  cleanupExpiredContexts(maxAge = 30 * 60 * 1000) { // 預設30分鐘
    const now = Date.now();
    const expiredRequestIds = [];
    
    for (const [requestId, context] of this.contexts) {
      if (context.createdAt && (now - context.createdAt.getTime()) > maxAge) {
        expiredRequestIds.push(requestId);
      }
    }
    
    expiredRequestIds.forEach(requestId => this.removeContext(requestId));
    
    if (expiredRequestIds.length > 0) {
      this.logger.info('已清理過期上下文', {
        count: expiredRequestIds.length,
        maxAge
      });
    }
  }

  /**
   * 獲取管理器統計信息
   * @returns {Object} 統計信息
   */
  getStats() {
    return {
      totalContexts: this.contexts.size,
      totalTenants: this.tenantContexts.size,
      tenants: Array.from(this.tenantContexts.entries()).map(([tenantId, contexts]) => ({
        tenantId,
        contextCount: contexts.size
      })),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 驗證租戶訪問權限
   * @param {string} tenantId - 租戶ID
   * @param {string} userId - 用戶ID
   * @param {Array} requiredPermissions - 所需權限
   * @returns {boolean} 是否有權限
   */
  validateAccess(tenantId, userId, requiredPermissions = []) {
    const tenantContexts = this.getTenantContexts(tenantId);
    const userContext = tenantContexts.find(context => context.userId === userId);
    
    if (!userContext) {
      this.logger.warn('用戶上下文不存在', {
        tenantId,
        userId
      });
      return false;
    }
    
    if (requiredPermissions.length === 0) {
      return true;
    }
    
    const hasAccess = userContext.hasAllPermissions(requiredPermissions);
    
    if (!hasAccess) {
      this.logger.warn('用戶權限不足', {
        tenantId,
        userId,
        requiredPermissions,
        userPermissions: userContext.permissions
      });
    }
    
    return hasAccess;
  }

  /**
   * 獲取用戶在指定租戶中的權限
   * @param {string} tenantId - 租戶ID
   * @param {string} userId - 用戶ID
   * @returns {Array} 權限列表
   */
  getUserPermissions(tenantId, userId) {
    const tenantContexts = this.getTenantContexts(tenantId);
    const userContext = tenantContexts.find(context => context.userId === userId);
    return userContext ? userContext.permissions : [];
  }

  /**
   * 檢查租戶是否存在
   * @param {string} tenantId - 租戶ID
   * @returns {boolean} 租戶是否存在
   */
  hasTenant(tenantId) {
    return this.tenantContexts.has(tenantId);
  }

  /**
   * 獲取用戶上下文
   * @param {string} tenantId - 租戶ID
   * @param {string} userId - 用戶ID
   * @returns {TenantContext|null} 用戶上下文
   */
  getUserContext(tenantId, userId) {
    const tenantContexts = this.getTenantContexts(tenantId);
    return tenantContexts.find(context => context.userId === userId) || null;
  }

  /**
   * 獲取租戶狀態
   * @param {string} tenantId - 租戶ID
   * @returns {string} 租戶狀態
   */
  getTenantStatus(tenantId) {
    // 簡單實現，實際應該從數據庫獲取
    return this.hasTenant(tenantId) ? 'active' : 'inactive';
  }
}

// 創建單例實例
const tenantContextManager = new TenantContextManager();

module.exports = {
  TenantContext,
  TenantContextManager,
  tenantContextManager
}; 