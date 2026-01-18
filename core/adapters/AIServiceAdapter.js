/**
 * AI 服務適配器
 * 實現新舊 AI 服務的轉換邏輯，支援多租戶架構
 * 採用適配器模式，確保向後兼容性
 */

const { businessLogger } = require('../../utils/logger');

class AIServiceAdapter {
  constructor(legacyService, modernService, featureFlags) {
    this.legacyService = legacyService;
    this.modernService = modernService;
    this.featureFlags = featureFlags;
    this.logger = businessLogger;
    
    this.logger.info('AI 服務適配器已初始化', {
      useModernService: featureFlags?.USE_V2_AI_SERVICE || false,
      enableMultiTenant: featureFlags?.ENABLE_MULTI_TENANT || false
    });
  }

  /**
   * 統一接口：圖片識別
   * @param {Buffer} imageBuffer - 圖片緩衝區
   * @param {string} userId - 用戶ID
   * @param {Object} context - 上下文信息（包含租戶ID等）
   * @returns {Promise<Object>} 識別結果
   */
  async recognizeImage(imageBuffer, userId, context = {}) {
    try {
      if (this.featureFlags?.USE_V2_AI_SERVICE && this.modernService) {
        // 使用新版服務（支援多租戶）
        const tenantId = context.tenantId || 'default';
        const result = await this.modernService.recognizeImage(imageBuffer, userId, tenantId);
        
        this.logger.info('使用新版 AI 服務識別圖片', {
          userId,
          tenantId,
          imageSize: imageBuffer.length
        });
        
        return this.transformToLegacyFormat(result, context);
      } else {
        // 使用舊版服務
        const result = await this.legacyService.recognizeImage(imageBuffer, userId);
        
        this.logger.info('使用舊版 AI 服務識別圖片', {
          userId,
          imageSize: imageBuffer.length
        });
        
        return result;
      }
    } catch (error) {
      this.logger.error('圖片識別失敗', {
        userId,
        error: error.message,
        service: this.featureFlags?.USE_V2_AI_SERVICE ? 'v2' : 'v1'
      });
      throw error;
    }
  }

  /**
   * 統一接口：生成 AI 回應
   * @param {string} message - 用戶訊息
   * @param {Object} context - 上下文信息
   * @returns {Promise<string>} AI 回應
   */
  async generateResponse(message, context = {}) {
    try {
      if (this.featureFlags?.USE_V2_AI_SERVICE && this.modernService) {
        // 使用新版服務
        const tenantId = context.tenantId || 'default';
        const result = await this.modernService.generateResponse(message, context);
        
        this.logger.info('使用新版 AI 服務生成回應', {
          tenantId,
          messageLength: message.length
        });
        
        return result;
      } else {
        // 使用舊版服務
        const result = await this.legacyService.generateResponse(message, context);
        
        this.logger.info('使用舊版 AI 服務生成回應', {
          messageLength: message.length
        });
        
        return result;
      }
    } catch (error) {
      this.logger.error('AI 回應生成失敗', {
        error: error.message,
        service: this.featureFlags?.USE_V2_AI_SERVICE ? 'v2' : 'v1'
      });
      throw error;
    }
  }

  /**
   * 統一接口：分析圖片
   * @param {string} imageUrl - 圖片URL
   * @param {Object} context - 上下文信息
   * @returns {Promise<Object>} 分析結果
   */
  async analyzeImage(imageUrl, context = {}) {
    try {
      if (this.featureFlags?.USE_V2_AI_SERVICE && this.modernService) {
        // 使用新版服務
        const tenantId = context.tenantId || 'default';
        const result = await this.modernService.analyzeImage(imageUrl, context);
        
        this.logger.info('使用新版 AI 服務分析圖片', {
          tenantId,
          imageUrl
        });
        
        return this.transformToLegacyFormat(result, context);
      } else {
        // 使用舊版服務
        const result = await this.legacyService.analyzeImage(imageUrl);
        
        this.logger.info('使用舊版 AI 服務分析圖片', {
          imageUrl
        });
        
        return result;
      }
    } catch (error) {
      this.logger.error('圖片分析失敗', {
        imageUrl,
        error: error.message,
        service: this.featureFlags?.USE_V2_AI_SERVICE ? 'v2' : 'v1'
      });
      throw error;
    }
  }

  /**
   * 統一接口：獲取服務狀態
   * @param {Object} context - 上下文信息
   * @returns {Promise<Object>} 服務狀態
   */
  async getServiceStatus(context = {}) {
    try {
      if (this.featureFlags?.USE_V2_AI_SERVICE && this.modernService) {
        // 使用新版服務
        const tenantId = context.tenantId || 'default';
        const result = await this.modernService.getServiceStatus(tenantId);
        
        this.logger.info('使用新版 AI 服務獲取狀態', {
          tenantId
        });
        
        return this.transformToLegacyFormat(result, context);
      } else {
        // 使用舊版服務
        const result = await this.legacyService.getServiceStatus();
        
        this.logger.info('使用舊版 AI 服務獲取狀態');
        
        return result;
      }
    } catch (error) {
      this.logger.error('獲取 AI 服務狀態失敗', {
        error: error.message,
        service: this.featureFlags?.USE_V2_AI_SERVICE ? 'v2' : 'v1'
      });
      throw error;
    }
  }

  /**
   * 統一接口：重置用戶上下文
   * @param {string} userId - 用戶ID
   * @param {Object} context - 上下文信息
   * @returns {Promise<void>}
   */
  async resetUserContext(userId, context = {}) {
    try {
      if (this.featureFlags?.USE_V2_AI_SERVICE && this.modernService) {
        // 使用新版服務
        const tenantId = context.tenantId || 'default';
        await this.modernService.resetUserContext(userId, tenantId);
        
        this.logger.info('使用新版 AI 服務重置用戶上下文', {
          userId,
          tenantId
        });
      } else {
        // 使用舊版服務
        await this.legacyService.resetUserContext(userId);
        
        this.logger.info('使用舊版 AI 服務重置用戶上下文', {
          userId
        });
      }
    } catch (error) {
      this.logger.error('重置用戶上下文失敗', {
        userId,
        error: error.message,
        service: this.featureFlags?.USE_V2_AI_SERVICE ? 'v2' : 'v1'
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
      if (this.featureFlags?.USE_V2_AI_SERVICE && this.modernService) {
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
      this.logger.error('AI 服務健康檢查失敗', {
        error: error.message,
        service: this.featureFlags?.USE_V2_AI_SERVICE ? 'v2' : 'v1'
      });
      throw error;
    }
  }

  /**
   * 統一接口：智能分析（企業級功能）
   * @param {Object} userData - 用戶數據
   * @param {Object} dataInsights - 數據洞察
   * @param {Object} context - 上下文信息
   * @returns {Promise<Object>} 分析結果
   */
  async performIntelligentAnalysis(userData, dataInsights, context = {}) {
    try {
      if (this.featureFlags?.USE_V2_AI_SERVICE && this.modernService) {
        // 使用新版服務
        const tenantId = context.tenantId || 'default';
        const result = await this.modernService.performIntelligentAnalysis(userData, dataInsights, tenantId);
        
        this.logger.info('使用新版 AI 服務進行智能分析', {
          tenantId,
          dataPoints: userData?.length || 0
        });
        
        return this.transformToLegacyFormat(result, context);
      } else {
        // 舊版服務可能不支援此功能
        this.logger.warn('舊版 AI 服務不支援智能分析功能');
        throw new Error('智能分析功能需要升級到新版 AI 服務');
      }
    } catch (error) {
      this.logger.error('智能分析失敗', {
        error: error.message,
        service: this.featureFlags?.USE_V2_AI_SERVICE ? 'v2' : 'v1'
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
      currentService: this.featureFlags?.USE_V2_AI_SERVICE ? 'v2' : 'v1',
      featureFlags: this.featureFlags,
      legacyServiceAvailable: !!this.legacyService,
      modernServiceAvailable: !!this.modernService,
      multiTenantEnabled: this.featureFlags?.ENABLE_MULTI_TENANT || false,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = AIServiceAdapter; 