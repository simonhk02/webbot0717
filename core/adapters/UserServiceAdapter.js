/**
 * 用戶服務適配器
 * 實現新舊用戶服務的轉換邏輯，支援多租戶架構
 * 採用適配器模式，確保向後兼容性
 */

const { businessLogger } = require('../../utils/logger');

class UserServiceAdapter {
  constructor(legacyService, modernService, featureFlags) {
    this.legacyService = legacyService;
    this.modernService = modernService;
    this.featureFlags = featureFlags;
    this.logger = businessLogger;
    
    this.logger.info('用戶服務適配器已初始化', {
      useModernService: featureFlags?.USE_V2_USER_SERVICE || false,
      enableMultiTenant: featureFlags?.ENABLE_MULTI_TENANT || false
    });
  }

  /**
   * 統一接口：用戶註冊
   * @param {string} email - 用戶郵箱
   * @param {string} password - 用戶密碼
   * @param {Object} context - 上下文信息（包含租戶ID等）
   * @returns {Promise<Object>} 註冊結果
   */
  async registerUser(email, password, context = {}) {
    try {
      if (this.featureFlags?.USE_V2_USER_SERVICE && this.modernService) {
        // 使用新版服務（支援多租戶）
        const tenantId = context.tenantId || 'default';
        const result = await this.modernService.registerUser(email, password, tenantId);
        
        this.logger.info('使用新版用戶服務註冊用戶', {
          email,
          tenantId,
          userId: result.userId
        });
        
        return this.transformToLegacyFormat(result, context);
      } else {
        // 使用舊版服務
        const result = await this.legacyService.registerUser(email, password);
        
        this.logger.info('使用舊版用戶服務註冊用戶', {
          email,
          userId: result.userId
        });
        
        return result;
      }
    } catch (error) {
      this.logger.error('用戶註冊失敗', {
        email,
        error: error.message,
        service: this.featureFlags?.USE_V2_USER_SERVICE ? 'v2' : 'v1'
      });
      throw error;
    }
  }

  /**
   * 統一接口：用戶登入
   * @param {string} email - 用戶郵箱
   * @param {string} password - 用戶密碼
   * @param {Object} context - 上下文信息
   * @returns {Promise<Object>} 登入結果
   */
  async loginUser(email, password, context = {}) {
    try {
      if (this.featureFlags?.USE_V2_USER_SERVICE && this.modernService) {
        // 使用新版服務
        const tenantId = context.tenantId || 'default';
        const result = await this.modernService.loginUser(email, password, tenantId);
        
        this.logger.info('使用新版用戶服務登入用戶', {
          email,
          tenantId,
          userId: result.userId
        });
        
        return this.transformToLegacyFormat(result, context);
      } else {
        // 使用舊版服務
        const result = await this.legacyService.loginUser(email, password);
        
        this.logger.info('使用舊版用戶服務登入用戶', {
          email,
          userId: result.userId
        });
        
        return result;
      }
    } catch (error) {
      this.logger.error('用戶登入失敗', {
        email,
        error: error.message,
        service: this.featureFlags?.USE_V2_USER_SERVICE ? 'v2' : 'v1'
      });
      throw error;
    }
  }

  /**
   * 統一接口：獲取用戶設置
   * @param {string} userId - 用戶ID
   * @param {Object} context - 上下文信息
   * @returns {Promise<Object>} 用戶設置
   */
  async getUserSettings(userId, context = {}) {
    try {
      if (this.featureFlags?.USE_V2_USER_SERVICE && this.modernService) {
        // 使用新版服務
        const tenantId = context.tenantId || 'default';
        const result = await this.modernService.getUserSettings(userId, tenantId);
        
        this.logger.info('使用新版用戶服務獲取設置', {
          userId,
          tenantId
        });
        
        return this.transformToLegacyFormat(result, context);
      } else {
        // 使用舊版服務
        const result = await this.legacyService.getUserSettings(userId);
        
        this.logger.info('使用舊版用戶服務獲取設置', {
          userId
        });
        
        return result;
      }
    } catch (error) {
      this.logger.error('獲取用戶設置失敗', {
        userId,
        error: error.message,
        service: this.featureFlags?.USE_V2_USER_SERVICE ? 'v2' : 'v1'
      });
      throw error;
    }
  }

  /**
   * 統一接口：更新用戶設置
   * @param {string} userId - 用戶ID
   * @param {Object} settings - 設置對象
   * @param {Object} context - 上下文信息
   * @returns {Promise<Object>} 更新結果
   */
  async updateUserSettings(userId, settings, context = {}) {
    try {
      if (this.featureFlags?.USE_V2_USER_SERVICE && this.modernService) {
        // 使用新版服務
        const tenantId = context.tenantId || 'default';
        const result = await this.modernService.updateUserSettings(userId, settings, tenantId);
        
        this.logger.info('使用新版用戶服務更新設置', {
          userId,
          tenantId
        });
        
        return this.transformToLegacyFormat(result, context);
      } else {
        // 使用舊版服務
        const result = await this.legacyService.updateUserSettings(userId, settings);
        
        this.logger.info('使用舊版用戶服務更新設置', {
          userId
        });
        
        return result;
      }
    } catch (error) {
      this.logger.error('更新用戶設置失敗', {
        userId,
        error: error.message,
        service: this.featureFlags?.USE_V2_USER_SERVICE ? 'v2' : 'v1'
      });
      throw error;
    }
  }

  /**
   * 統一接口：獲取用戶信息
   * @param {string} userId - 用戶ID
   * @param {Object} context - 上下文信息
   * @returns {Promise<Object>} 用戶信息
   */
  async getUserById(userId, context = {}) {
    try {
      if (this.featureFlags?.USE_V2_USER_SERVICE && this.modernService) {
        // 使用新版服務
        const tenantId = context.tenantId || 'default';
        const result = await this.modernService.getUserById(userId, tenantId);
        
        this.logger.info('使用新版用戶服務獲取用戶信息', {
          userId,
          tenantId
        });
        
        return this.transformToLegacyFormat(result, context);
      } else {
        // 使用舊版服務
        const result = await this.legacyService.getUserById(userId);
        
        this.logger.info('使用舊版用戶服務獲取用戶信息', {
          userId
        });
        
        return result;
      }
    } catch (error) {
      this.logger.error('獲取用戶信息失敗', {
        userId,
        error: error.message,
        service: this.featureFlags?.USE_V2_USER_SERVICE ? 'v2' : 'v1'
      });
      throw error;
    }
  }

  /**
   * 統一接口：用戶登出
   * @param {string} userId - 用戶ID
   * @param {Object} session - 會話對象
   * @param {Object} context - 上下文信息
   * @returns {Promise<void>}
   */
  async logoutUser(userId, session, context = {}) {
    try {
      if (this.featureFlags?.USE_V2_USER_SERVICE && this.modernService) {
        // 使用新版服務
        const tenantId = context.tenantId || 'default';
        await this.modernService.logoutUser(userId, session, tenantId);
        
        this.logger.info('使用新版用戶服務登出用戶', {
          userId,
          tenantId
        });
      } else {
        // 使用舊版服務
        await this.legacyService.logoutUser(userId, session);
        
        this.logger.info('使用舊版用戶服務登出用戶', {
          userId
        });
      }
    } catch (error) {
      this.logger.error('用戶登出失敗', {
        userId,
        error: error.message,
        service: this.featureFlags?.USE_V2_USER_SERVICE ? 'v2' : 'v1'
      });
      throw error;
    }
  }

  /**
   * 統一接口：健康檢查
   * @returns {Promise<Object>} 健康狀態
   */
  async healthCheck() {
    try {
      if (this.featureFlags?.USE_V2_USER_SERVICE && this.modernService) {
        const result = await this.modernService.healthCheck();
        return {
          ...result,
          adapter: 'v2',
          featureFlags: this.featureFlags
        };
      } else {
        const result = await this.legacyService.healthCheck();
        return {
          ...result,
          adapter: 'v1',
          featureFlags: this.featureFlags
        };
      }
    } catch (error) {
      this.logger.error('用戶服務健康檢查失敗', {
        error: error.message,
        service: this.featureFlags?.USE_V2_USER_SERVICE ? 'v2' : 'v1'
      });
      throw error;
    }
  }

  /**
   * 將新版服務結果轉換為舊版格式
   * @param {Object} result - 新版服務結果
   * @param {Object} context - 上下文信息
   * @returns {Object} 舊版格式結果
   */
  transformToLegacyFormat(result, context) {
    // 移除多租戶相關字段，保持向後兼容
    const { tenantId, tenantContext, ...legacyResult } = result;
    
    // 添加適配器元數據
    return {
      ...legacyResult,
      _adapter: {
        version: 'v2',
        tenantId: context.tenantId || 'default',
        transformed: true,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * 將舊版請求轉換為新版格式
   * @param {Object} request - 舊版請求
   * @param {Object} context - 上下文信息
   * @returns {Object} 新版格式請求
   */
  transformToModernFormat(request, context) {
    return {
      ...request,
      tenantId: context.tenantId || 'default',
      tenantContext: {
        tenantId: context.tenantId || 'default',
        userId: context.userId,
        permissions: context.permissions || []
      }
    };
  }

  /**
   * 獲取適配器狀態
   * @returns {Object} 適配器狀態
   */
  getAdapterStatus() {
    return {
      version: '1.0.0',
      currentService: this.featureFlags?.USE_V2_USER_SERVICE ? 'v2' : 'v1',
      featureFlags: this.featureFlags,
      legacyServiceAvailable: !!this.legacyService,
      modernServiceAvailable: !!this.modernService,
      multiTenantEnabled: this.featureFlags?.ENABLE_MULTI_TENANT || false,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = UserServiceAdapter; 