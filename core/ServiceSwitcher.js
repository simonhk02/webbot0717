/**
 * 服務切換器
 * 用於在新舊服務之間進行安全切換
 */

const { isFeatureEnabled } = require('../config/featureFlags');
const { businessLogger } = require('../utils/logger');

class ServiceSwitcher {
  constructor(container) {
    this.container = container;
    this.logger = businessLogger;
    this.serviceCache = new Map();
  }

  /**
   * 獲取服務實例（支援新舊版本切換）
   * @param {string} serviceName - 服務名稱
   * @param {Object} options - 選項
   * @returns {Object} - 服務實例
   */
  getService(serviceName, options = {}) {
    const { useV2 = null, fallbackToV1 = true } = options;
    
    // 決定使用哪個版本
    let shouldUseV2 = useV2 !== null ? useV2 : this.shouldUseV2Service(serviceName);
    
    try {
      if (shouldUseV2) {
        return this.getV2Service(serviceName);
      } else {
        return this.getV1Service(serviceName);
      }
    } catch (error) {
      if (fallbackToV1 && shouldUseV2) {
        this.logger.warn(`V2服務 ${serviceName} 不可用，回退到V1服務`, { error: error.message });
        return this.getV1Service(serviceName);
      }
      throw error;
    }
  }

  /**
   * 判斷是否應該使用V2服務
   * @param {string} serviceName - 服務名稱
   * @returns {boolean} - 是否使用V2
   */
  shouldUseV2Service(serviceName) {
    // 檢查全局V2開關
    if (!isFeatureEnabled('USE_V2_SERVICES')) {
      return false;
    }

    // 檢查特定服務開關
    const serviceFlags = {
      'userService': 'USE_V2_USER_SERVICE',
      'aiService': 'USE_V2_AI_SERVICE',
      'whatsAppService': 'USE_V2_WHATSAPP_SERVICE'
    };

    const flagName = serviceFlags[serviceName];
    if (flagName && !isFeatureEnabled(flagName)) {
      return false;
    }

    return true;
  }

  /**
   * 獲取V1服務
   * @param {string} serviceName - 服務名稱
   * @returns {Object} - V1服務實例
   */
  getV1Service(serviceName) {
    const cacheKey = `v1_${serviceName}`;
    
    if (this.serviceCache.has(cacheKey)) {
      return this.serviceCache.get(cacheKey);
    }

    try {
      const service = this.container.resolve(serviceName);
      this.serviceCache.set(cacheKey, service);
      this.logger.debug(`已獲取V1服務: ${serviceName}`);
      return service;
    } catch (error) {
      this.logger.error(`無法獲取V1服務 ${serviceName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 獲取V2服務
   * @param {string} serviceName - 服務名稱
   * @returns {Object} - V2服務實例
   */
  getV2Service(serviceName) {
    const cacheKey = `v2_${serviceName}`;
    
    if (this.serviceCache.has(cacheKey)) {
      return this.serviceCache.get(cacheKey);
    }

    try {
      // 嘗試獲取V2服務
      const v2ServiceName = `${serviceName}V2`;
      const service = this.container.resolve(v2ServiceName);
      this.serviceCache.set(cacheKey, service);
      this.logger.debug(`已獲取V2服務: ${v2ServiceName}`);
      return service;
    } catch (error) {
      this.logger.error(`無法獲取V2服務 ${serviceName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 獲取適配器服務
   * @param {string} serviceName - 服務名稱
   * @returns {Object} - 適配器實例
   */
  getAdapterService(serviceName) {
    if (!isFeatureEnabled('USE_ADAPTER_LAYER')) {
      return this.getService(serviceName);
    }

    const cacheKey = `adapter_${serviceName}`;
    
    if (this.serviceCache.has(cacheKey)) {
      return this.serviceCache.get(cacheKey);
    }

    try {
      const adapterName = `${serviceName}Adapter`;
      const adapter = this.container.resolve(adapterName);
      this.serviceCache.set(cacheKey, adapter);
      this.logger.debug(`已獲取適配器: ${adapterName}`);
      return adapter;
    } catch (error) {
      this.logger.warn(`適配器 ${serviceName} 不可用，直接使用服務`, { error: error.message });
      return this.getService(serviceName);
    }
  }

  /**
   * 清除服務緩存
   * @param {string} serviceName - 服務名稱（可選）
   */
  clearCache(serviceName = null) {
    if (serviceName) {
      const patterns = [`v1_${serviceName}`, `v2_${serviceName}`, `adapter_${serviceName}`];
      patterns.forEach(pattern => {
        if (this.serviceCache.has(pattern)) {
          this.serviceCache.delete(pattern);
        }
      });
      this.logger.debug(`已清除服務緩存: ${serviceName}`);
    } else {
      this.serviceCache.clear();
      this.logger.debug('已清除所有服務緩存');
    }
  }

  /**
   * 獲取服務狀態報告
   * @returns {Object} - 服務狀態報告
   */
  getServiceStatus() {
    const status = {
      featureFlags: {
        USE_V2_SERVICES: isFeatureEnabled('USE_V2_SERVICES'),
        USE_MULTI_TENANT: isFeatureEnabled('USE_MULTI_TENANT'),
        USE_ADAPTER_LAYER: isFeatureEnabled('USE_ADAPTER_LAYER'),
        USE_V2_USER_SERVICE: isFeatureEnabled('USE_V2_USER_SERVICE'),
        USE_V2_AI_SERVICE: isFeatureEnabled('USE_V2_AI_SERVICE'),
        USE_V2_WHATSAPP_SERVICE: isFeatureEnabled('USE_V2_WHATSAPP_SERVICE')
      },
      cachedServices: Array.from(this.serviceCache.keys()),
      recommendations: []
    };

    // 生成建議
    if (isFeatureEnabled('USE_V2_SERVICES') && !isFeatureEnabled('USE_ADAPTER_LAYER')) {
      status.recommendations.push('建議啟用適配器層以獲得更好的兼容性');
    }

    if (!isFeatureEnabled('USE_V2_SERVICES') && isFeatureEnabled('USE_MULTI_TENANT')) {
      status.recommendations.push('多租戶功能需要V2服務支援');
    }

    return status;
  }

  /**
   * 安全切換服務版本
   * @param {string} serviceName - 服務名稱
   * @param {string} version - 版本 ('v1' 或 'v2')
   * @returns {boolean} - 切換是否成功
   */
  async switchServiceVersion(serviceName, version) {
    try {
      this.logger.info(`開始切換服務版本: ${serviceName} -> ${version}`);
      
      // 清除相關緩存
      this.clearCache(serviceName);
      
      // 測試新版本服務
      const testService = version === 'v2' ? 
        this.getV2Service(serviceName) : 
        this.getV1Service(serviceName);
      
      // 執行健康檢查
      if (typeof testService.healthCheck === 'function') {
        await testService.healthCheck();
      }
      
      this.logger.info(`服務版本切換成功: ${serviceName} -> ${version}`);
      return true;
    } catch (error) {
      this.logger.error(`服務版本切換失敗: ${serviceName} -> ${version}`, { error: error.message });
      return false;
    }
  }
}

module.exports = ServiceSwitcher; 