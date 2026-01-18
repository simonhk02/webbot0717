/**
 * WhatsApp 服務適配器
 * 實現新舊 WhatsApp 服務的轉換邏輯，支援多租戶架構
 * 採用適配器模式，確保向後兼容性
 */

const { businessLogger } = require('../../utils/logger');

class WhatsAppServiceAdapter {
  constructor(legacyService, modernService, featureFlags) {
    this.legacyService = legacyService;
    this.modernService = modernService;
    this.featureFlags = featureFlags;
    this.logger = businessLogger;
    
    this.logger.info('WhatsApp 服務適配器已初始化', {
      useModernService: featureFlags?.USE_V2_WHATSAPP_SERVICE || false,
      enableMultiTenant: featureFlags?.ENABLE_MULTI_TENANT || false
    });
  }

  /**
   * 統一接口：初始化服務
   * @param {Object} context - 上下文信息
   * @returns {Promise<void>}
   */
  async initialize(context = {}) {
    try {
      if (this.featureFlags?.USE_V2_WHATSAPP_SERVICE && this.modernService) {
        // 使用新版服務
        const tenantId = context.tenantId || 'default';
        await this.modernService.initialize(tenantId);
        
        this.logger.info('使用新版 WhatsApp 服務初始化', {
          tenantId
        });
      } else {
        // 使用舊版服務
        await this.legacyService.initialize();
        
        this.logger.info('使用舊版 WhatsApp 服務初始化');
      }
    } catch (error) {
      this.logger.error('WhatsApp 服務初始化失敗', {
        error: error.message,
        service: this.featureFlags?.USE_V2_WHATSAPP_SERVICE ? 'v2' : 'v1'
      });
      throw error;
    }
  }

  /**
   * 統一接口：獲取連接狀態
   * @param {string} userId - 用戶ID
   * @param {Object} context - 上下文信息
   * @returns {Promise<Object>} 連接狀態
   */
  async getConnectionStatus(userId, context = {}) {
    try {
      if (this.featureFlags?.USE_V2_WHATSAPP_SERVICE && this.modernService) {
        // 使用新版服務
        const tenantId = context.tenantId || 'default';
        const result = await this.modernService.getConnectionStatus(userId, tenantId);
        
        this.logger.info('使用新版 WhatsApp 服務獲取連接狀態', {
          userId,
          tenantId
        });
        
        return this.transformToLegacyFormat(result, context);
      } else {
        // 使用舊版服務
        const result = await this.legacyService.getConnectionStatus(userId);
        
        this.logger.info('使用舊版 WhatsApp 服務獲取連接狀態', {
          userId
        });
        
        return result;
      }
    } catch (error) {
      this.logger.error('獲取連接狀態失敗', {
        userId,
        error: error.message,
        service: this.featureFlags?.USE_V2_WHATSAPP_SERVICE ? 'v2' : 'v1'
      });
      throw error;
    }
  }

  /**
   * 統一接口：獲取 QR 碼
   * @param {string} userId - 用戶ID
   * @param {Object} context - 上下文信息
   * @returns {Promise<Object>} QR 碼信息
   */
  async getQRCode(userId, context = {}) {
    try {
      if (this.featureFlags?.USE_V2_WHATSAPP_SERVICE && this.modernService) {
        // 使用新版服務
        const tenantId = context.tenantId || 'default';
        const result = await this.modernService.getQRCode(userId, tenantId);
        
        this.logger.info('使用新版 WhatsApp 服務獲取 QR 碼', {
          userId,
          tenantId
        });
        
        return this.transformToLegacyFormat(result, context);
      } else {
        // 使用舊版服務
        const result = await this.legacyService.getQRCode(userId);
        
        this.logger.info('使用舊版 WhatsApp 服務獲取 QR 碼', {
          userId
        });
        
        return result;
      }
    } catch (error) {
      this.logger.error('獲取 QR 碼失敗', {
        userId,
        error: error.message,
        service: this.featureFlags?.USE_V2_WHATSAPP_SERVICE ? 'v2' : 'v1'
      });
      throw error;
    }
  }

  /**
   * 統一接口：發送訊息
   * @param {string} userId - 用戶ID
   * @param {string} chatId - 聊天ID
   * @param {Object} message - 訊息內容
   * @param {Object} context - 上下文信息
   * @returns {Promise<Object>} 發送結果
   */
  async sendMessage(userId, chatId, message, context = {}) {
    try {
      if (this.featureFlags?.USE_V2_WHATSAPP_SERVICE && this.modernService) {
        // 使用新版服務
        const tenantId = context.tenantId || 'default';
        const result = await this.modernService.sendMessage(userId, chatId, message, tenantId);
        
        this.logger.info('使用新版 WhatsApp 服務發送訊息', {
          userId,
          chatId,
          tenantId
        });
        
        return this.transformToLegacyFormat(result, context);
      } else {
        // 使用舊版服務
        const result = await this.legacyService.sendMessage(userId, chatId, message);
        
        this.logger.info('使用舊版 WhatsApp 服務發送訊息', {
          userId,
          chatId
        });
        
        return result;
      }
    } catch (error) {
      this.logger.error('發送訊息失敗', {
        userId,
        chatId,
        error: error.message,
        service: this.featureFlags?.USE_V2_WHATSAPP_SERVICE ? 'v2' : 'v1'
      });
      throw error;
    }
  }

  /**
   * 統一接口：獲取客戶端
   * @param {string} userId - 用戶ID
   * @param {Object} context - 上下文信息
   * @returns {Object} 客戶端信息
   */
  getClient(userId, context = {}) {
    try {
      if (this.featureFlags?.USE_V2_WHATSAPP_SERVICE && this.modernService) {
        // 使用新版服務
        const tenantId = context.tenantId || 'default';
        const result = this.modernService.getClient(userId, tenantId);
        
        this.logger.info('使用新版 WhatsApp 服務獲取客戶端', {
          userId,
          tenantId
        });
        
        return result;
      } else {
        // 使用舊版服務
        const result = this.legacyService.getClient(userId);
        
        this.logger.info('使用舊版 WhatsApp 服務獲取客戶端', {
          userId
        });
        
        return result;
      }
    } catch (error) {
      this.logger.error('獲取客戶端失敗', {
        userId,
        error: error.message,
        service: this.featureFlags?.USE_V2_WHATSAPP_SERVICE ? 'v2' : 'v1'
      });
      throw error;
    }
  }

  /**
   * 統一接口：檢查用戶是否已連接
   * @param {string} userId - 用戶ID
   * @param {Object} context - 上下文信息
   * @returns {boolean} 連接狀態
   */
  isUserConnected(userId, context = {}) {
    try {
      if (this.featureFlags?.USE_V2_WHATSAPP_SERVICE && this.modernService) {
        // 使用新版服務
        const tenantId = context.tenantId || 'default';
        const result = this.modernService.isUserConnected(userId, tenantId);
        
        this.logger.info('使用新版 WhatsApp 服務檢查連接狀態', {
          userId,
          tenantId,
          connected: result
        });
        
        return result;
      } else {
        // 使用舊版服務
        const result = this.legacyService.isUserConnected(userId);
        
        this.logger.info('使用舊版 WhatsApp 服務檢查連接狀態', {
          userId,
          connected: result
        });
        
        return result;
      }
    } catch (error) {
      this.logger.error('檢查連接狀態失敗', {
        userId,
        error: error.message,
        service: this.featureFlags?.USE_V2_WHATSAPP_SERVICE ? 'v2' : 'v1'
      });
      return false;
    }
  }

  /**
   * 統一接口：重新載入用戶設置
   * @param {string} userId - 用戶ID
   * @param {Object} context - 上下文信息
   * @returns {Promise<void>}
   */
  async reloadUserSettings(userId, context = {}) {
    try {
      if (this.featureFlags?.USE_V2_WHATSAPP_SERVICE && this.modernService) {
        // 使用新版服務
        const tenantId = context.tenantId || 'default';
        await this.modernService.reloadUserSettings(userId, tenantId);
        
        this.logger.info('使用新版 WhatsApp 服務重新載入設置', {
          userId,
          tenantId
        });
      } else {
        // 使用舊版服務
        await this.legacyService.reloadUserSettings(userId);
        
        this.logger.info('使用舊版 WhatsApp 服務重新載入設置', {
          userId
        });
      }
    } catch (error) {
      this.logger.error('重新載入用戶設置失敗', {
        userId,
        error: error.message,
        service: this.featureFlags?.USE_V2_WHATSAPP_SERVICE ? 'v2' : 'v1'
      });
      throw error;
    }
  }

  /**
   * 統一接口：獲取服務狀態
   * @param {Object} context - 上下文信息
   * @returns {Object} 服務狀態
   */
  getServiceStatus(context = {}) {
    try {
      if (this.featureFlags?.USE_V2_WHATSAPP_SERVICE && this.modernService) {
        // 使用新版服務
        const tenantId = context.tenantId || 'default';
        const result = this.modernService.getServiceStatus(tenantId);
        
        this.logger.info('使用新版 WhatsApp 服務獲取狀態', {
          tenantId
        });
        
        return this.transformToLegacyFormat(result, context);
      } else {
        // 使用舊版服務
        const result = this.legacyService.getServiceStatus();
        
        this.logger.info('使用舊版 WhatsApp 服務獲取狀態');
        
        return result;
      }
    } catch (error) {
      this.logger.error('獲取服務狀態失敗', {
        error: error.message,
        service: this.featureFlags?.USE_V2_WHATSAPP_SERVICE ? 'v2' : 'v1'
      });
      throw error;
    }
  }

  /**
   * 統一接口：清理資源
   * @param {Object} context - 上下文信息
   * @returns {Promise<void>}
   */
  async cleanup(context = {}) {
    try {
      if (this.featureFlags?.USE_V2_WHATSAPP_SERVICE && this.modernService) {
        // 使用新版服務
        const tenantId = context.tenantId || 'default';
        await this.modernService.cleanup(tenantId);
        
        this.logger.info('使用新版 WhatsApp 服務清理資源', {
          tenantId
        });
      } else {
        // 使用舊版服務
        await this.legacyService.cleanup();
        
        this.logger.info('使用舊版 WhatsApp 服務清理資源');
      }
    } catch (error) {
      this.logger.error('清理資源失敗', {
        error: error.message,
        service: this.featureFlags?.USE_V2_WHATSAPP_SERVICE ? 'v2' : 'v1'
      });
      throw error;
    }
  }

  /**
   * 統一接口：重新初始化
   * @param {Object} context - 上下文信息
   * @returns {Promise<void>}
   */
  async reinitialize(context = {}) {
    try {
      if (this.featureFlags?.USE_V2_WHATSAPP_SERVICE && this.modernService) {
        // 使用新版服務
        const tenantId = context.tenantId || 'default';
        await this.modernService.reinitialize(tenantId);
        
        this.logger.info('使用新版 WhatsApp 服務重新初始化', {
          tenantId
        });
      } else {
        // 使用舊版服務
        await this.legacyService.reinitialize();
        
        this.logger.info('使用舊版 WhatsApp 服務重新初始化');
      }
    } catch (error) {
      this.logger.error('重新初始化失敗', {
        error: error.message,
        service: this.featureFlags?.USE_V2_WHATSAPP_SERVICE ? 'v2' : 'v1'
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
      currentService: this.featureFlags?.USE_V2_WHATSAPP_SERVICE ? 'v2' : 'v1',
      featureFlags: this.featureFlags,
      legacyServiceAvailable: !!this.legacyService,
      modernServiceAvailable: !!this.modernService,
      multiTenantEnabled: this.featureFlags?.ENABLE_MULTI_TENANT || false,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = WhatsAppServiceAdapter; 