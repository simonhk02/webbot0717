/**
 * AIService V2 - 多租戶 AI 服務
 * 支援租戶級別的 AI 配置、使用配額管理、性能優化
 */

const { businessLogger } = require('../../utils/logger');
const { TenantContext } = require('../../core/context/TenantContext');

class AIServiceV2 {
  constructor() {
    this.logger = businessLogger;
    this.tenantContexts = new Map();
    this.aiConfigs = new Map();
    this.usageQuotas = new Map();
    this.requestCounts = new Map();
  }

  /**
   * 初始化服務
   * @param {string} tenantId - 租戶ID
   * @returns {Promise<void>}
   */
  async initialize(tenantId) {
    try {
      this.logger.info('AIServiceV2 初始化開始', { tenantId });
      
      // 創建租戶上下文
      const tenantContext = TenantContext.create(tenantId, 'system', ['ai_access'], {
        service: 'AIServiceV2',
        initializedAt: new Date().toISOString()
      });
      
      this.tenantContexts.set(tenantId, tenantContext);
      
      // 初始化 AI 配置
      const aiConfig = {
        model: 'claude-3-sonnet-20240229',
        maxTokens: 4096,
        temperature: 0.7,
        maxRequestsPerMinute: 60,
        maxRequestsPerHour: 1000,
        maxRequestsPerDay: 10000
      };
      this.aiConfigs.set(tenantId, aiConfig);
      
      // 初始化使用配額
      const usageQuota = {
        dailyRequests: 0,
        monthlyRequests: 0,
        totalRequests: 0,
        lastResetDate: new Date().toISOString()
      };
      this.usageQuotas.set(tenantId, usageQuota);
      
      // 初始化請求計數
      this.requestCounts.set(tenantId, {
        currentMinute: 0,
        currentHour: 0,
        lastMinuteReset: Date.now(),
        lastHourReset: Date.now()
      });
      
      this.logger.info('AIServiceV2 初始化完成', { tenantId });
    } catch (error) {
      this.logger.error('AIServiceV2 初始化失敗', { 
        tenantId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * 處理 AI 請求
   * @param {string} prompt - 提示詞
   * @param {Object} options - 選項
   * @param {string} tenantId - 租戶ID
   * @returns {Promise<Object>} AI 響應
   */
  async processRequest(prompt, options = {}, tenantId) {
    try {
      this.logger.info('開始處理 AI 請求', { tenantId, promptLength: prompt.length });

      // 驗證租戶上下文
      const tenantContext = this.tenantContexts.get(tenantId);
      if (!tenantContext) {
        throw new Error(`租戶 ${tenantId} 未初始化`);
      }

      // 檢查配額
      await this.checkQuota(tenantId);

      // 獲取 AI 配置
      const aiConfig = this.aiConfigs.get(tenantId);
      if (!aiConfig) {
        throw new Error(`租戶 ${tenantId} 的 AI 配置未找到`);
      }

      // 更新請求計數
      this.updateRequestCount(tenantId);

      // 這裡應該調用實際的 AI API
      // 暫時返回模擬響應
      const response = {
        content: `這是對 "${prompt}" 的 AI 響應`,
        model: aiConfig.model,
        usage: {
          promptTokens: prompt.length,
          completionTokens: 100,
          totalTokens: prompt.length + 100
        },
        tenantId,
        timestamp: new Date().toISOString()
      };

      this.logger.info('AI 請求處理成功', { 
        tenantId, 
        responseLength: response.content.length 
      });

      return response;
    } catch (error) {
      this.logger.error('AI 請求處理失敗', { 
        tenantId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * 處理圖片識別
   * @param {Buffer} imageBuffer - 圖片緩衝區
   * @param {Object} options - 選項
   * @param {string} tenantId - 租戶ID
   * @returns {Promise<Object>} 識別結果
   */
  async processImage(imageBuffer, options = {}, tenantId) {
    try {
      this.logger.info('開始處理圖片識別', { 
        tenantId, 
        imageSize: imageBuffer.length 
      });

      // 驗證租戶上下文
      const tenantContext = this.tenantContexts.get(tenantId);
      if (!tenantContext) {
        throw new Error(`租戶 ${tenantId} 未初始化`);
      }

      // 檢查配額
      await this.checkQuota(tenantId);

      // 更新請求計數
      this.updateRequestCount(tenantId);

      // 這裡應該調用實際的圖片識別 API
      // 暫時返回模擬結果
      const result = {
        recognized: true,
        fields: {
          amount: '150.00',
          date: '2025-01-15',
          merchant: '星巴克咖啡',
          category: '餐飲'
        },
        confidence: 0.95,
        tenantId,
        timestamp: new Date().toISOString()
      };

      this.logger.info('圖片識別處理成功', { 
        tenantId, 
        confidence: result.confidence 
      });

      return result;
    } catch (error) {
      this.logger.error('圖片識別處理失敗', { 
        tenantId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * 檢查配額
   * @param {string} tenantId - 租戶ID
   * @returns {Promise<void>}
   */
  async checkQuota(tenantId) {
    try {
      const quota = this.usageQuotas.get(tenantId);
      const config = this.aiConfigs.get(tenantId);
      const requestCount = this.requestCounts.get(tenantId);

      if (!quota || !config || !requestCount) {
        throw new Error(`租戶 ${tenantId} 的配額配置未找到`);
      }

      // 檢查分鐘限制
      if (requestCount.currentMinute >= config.maxRequestsPerMinute) {
        throw new Error(`租戶 ${tenantId} 已達到每分鐘請求限制`);
      }

      // 檢查小時限制
      if (requestCount.currentHour >= config.maxRequestsPerHour) {
        throw new Error(`租戶 ${tenantId} 已達到每小時請求限制`);
      }

      // 檢查日限制
      if (quota.dailyRequests >= config.maxRequestsPerDay) {
        throw new Error(`租戶 ${tenantId} 已達到每日請求限制`);
      }

      this.logger.debug('配額檢查通過', { tenantId });
    } catch (error) {
      this.logger.error('配額檢查失敗', { 
        tenantId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * 更新請求計數
   * @param {string} tenantId - 租戶ID
   */
  updateRequestCount(tenantId) {
    try {
      const quota = this.usageQuotas.get(tenantId);
      const requestCount = this.requestCounts.get(tenantId);

      if (!quota || !requestCount) {
        throw new Error(`租戶 ${tenantId} 的計數配置未找到`);
      }

      const now = Date.now();

      // 檢查是否需要重置分鐘計數
      if (now - requestCount.lastMinuteReset >= 60 * 1000) {
        requestCount.currentMinute = 0;
        requestCount.lastMinuteReset = now;
      }

      // 檢查是否需要重置小時計數
      if (now - requestCount.lastHourReset >= 60 * 60 * 1000) {
        requestCount.currentHour = 0;
        requestCount.lastHourReset = now;
      }

      // 檢查是否需要重置日計數
      const lastResetDate = new Date(quota.lastResetDate);
      const currentDate = new Date();
      if (lastResetDate.getDate() !== currentDate.getDate()) {
        quota.dailyRequests = 0;
        quota.lastResetDate = currentDate.toISOString();
      }

      // 增加計數
      requestCount.currentMinute++;
      requestCount.currentHour++;
      quota.dailyRequests++;
      quota.monthlyRequests++;
      quota.totalRequests++;

      this.logger.debug('請求計數已更新', { 
        tenantId, 
        currentMinute: requestCount.currentMinute,
        currentHour: requestCount.currentHour,
        dailyRequests: quota.dailyRequests
      });
    } catch (error) {
      this.logger.error('更新請求計數失敗', { 
        tenantId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * 更新 AI 配置
   * @param {Object} config - 新配置
   * @param {string} tenantId - 租戶ID
   * @returns {Promise<Object>} 更新後的配置
   */
  async updateConfig(config, tenantId) {
    try {
      this.logger.info('開始更新 AI 配置', { tenantId, config });

      // 驗證租戶上下文
      const tenantContext = this.tenantContexts.get(tenantId);
      if (!tenantContext) {
        throw new Error(`租戶 ${tenantId} 未初始化`);
      }

      // 合併配置
      const currentConfig = this.aiConfigs.get(tenantId) || {};
      const updatedConfig = {
        ...currentConfig,
        ...config,
        updatedAt: new Date().toISOString()
      };

      this.aiConfigs.set(tenantId, updatedConfig);

      this.logger.info('AI 配置更新成功', { tenantId });

      return updatedConfig;
    } catch (error) {
      this.logger.error('AI 配置更新失敗', { 
        tenantId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * 獲取使用統計
   * @param {string} tenantId - 租戶ID
   * @returns {Object} 使用統計
   */
  getUsageStats(tenantId) {
    try {
      const quota = this.usageQuotas.get(tenantId);
      const config = this.aiConfigs.get(tenantId);
      const requestCount = this.requestCounts.get(tenantId);

      if (!quota || !config || !requestCount) {
        throw new Error(`租戶 ${tenantId} 的統計數據未找到`);
      }

      const stats = {
        tenantId,
        currentMinute: requestCount.currentMinute,
        currentHour: requestCount.currentHour,
        dailyRequests: quota.dailyRequests,
        monthlyRequests: quota.monthlyRequests,
        totalRequests: quota.totalRequests,
        limits: {
          maxRequestsPerMinute: config.maxRequestsPerMinute,
          maxRequestsPerHour: config.maxRequestsPerHour,
          maxRequestsPerDay: config.maxRequestsPerDay
        },
        timestamp: new Date().toISOString()
      };

      this.logger.info('獲取使用統計', { tenantId, stats });

      return stats;
    } catch (error) {
      this.logger.error('獲取使用統計失敗', { 
        tenantId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * 獲取服務狀態
   * @param {string} tenantId - 租戶ID
   * @returns {Object} 服務狀態
   */
  getServiceStatus(tenantId) {
    try {
      const tenantContext = this.tenantContexts.get(tenantId);
      const isInitialized = !!tenantContext;
      
      const status = {
        service: 'AIServiceV2',
        tenantId,
        initialized: isInitialized,
        activeConfigs: this.aiConfigs.size,
        activeQuotas: this.usageQuotas.size,
        timestamp: new Date().toISOString()
      };

      this.logger.info('獲取服務狀態', status);

      return status;
    } catch (error) {
      this.logger.error('獲取服務狀態失敗', { 
        tenantId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * 清理資源
   * @param {string} tenantId - 租戶ID
   * @returns {Promise<void>}
   */
  async cleanup(tenantId) {
    try {
      this.logger.info('開始清理資源', { tenantId });

      // 清理租戶上下文
      this.tenantContexts.delete(tenantId);

      // 清理配置和配額
      this.aiConfigs.delete(tenantId);
      this.usageQuotas.delete(tenantId);
      this.requestCounts.delete(tenantId);

      this.logger.info('資源清理完成', { tenantId });
    } catch (error) {
      this.logger.error('資源清理失敗', { 
        tenantId, 
        error: error.message 
      });
      throw error;
    }
  }
}

module.exports = AIServiceV2;
module.exports.AIServiceV2 = AIServiceV2; 