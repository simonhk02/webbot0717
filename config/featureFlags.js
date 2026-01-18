/**
 * 功能開關配置
 * 用於控制新舊架構的切換和功能啟用
 */

const FEATURE_FLAGS = {
  // 核心架構開關
  USE_V2_SERVICES: process.env.USE_V2_SERVICES === 'true',
  USE_MULTI_TENANT: process.env.USE_MULTI_TENANT === 'true',
  USE_ADAPTER_LAYER: process.env.USE_ADAPTER_LAYER === 'true',
  
  // 服務級別開關
  USE_V2_USER_SERVICE: process.env.USE_V2_USER_SERVICE === 'true',
  USE_V2_AI_SERVICE: process.env.USE_V2_AI_SERVICE === 'true',
  USE_V2_WHATSAPP_SERVICE: process.env.USE_V2_WHATSAPP_SERVICE === 'true',
  
  // 企業級功能開關
  USE_MONITORING_SYSTEM: process.env.USE_MONITORING_SYSTEM === 'true',
  USE_SECURITY_MECHANISMS: process.env.USE_SECURITY_MECHANISMS === 'true',
  USE_HOT_RELOAD: process.env.USE_HOT_RELOAD === 'true',
  
  // 性能優化開關
  USE_CACHE_SYSTEM: process.env.USE_CACHE_SYSTEM === 'true',
  USE_DATABASE_OPTIMIZATION: process.env.USE_DATABASE_OPTIMIZATION === 'true',
  
  // 開發模式開關
  ENABLE_DEBUG_MODE: process.env.NODE_ENV === 'development',
  ENABLE_DETAILED_LOGGING: process.env.ENABLE_DETAILED_LOGGING === 'true'
};

/**
 * 檢查功能是否啟用
 * @param {string} flagName - 功能開關名稱
 * @returns {boolean} - 是否啟用
 */
function isFeatureEnabled(flagName) {
  return FEATURE_FLAGS[flagName] === true;
}

/**
 * 獲取所有功能開關狀態
 * @returns {Object} - 所有功能開關狀態
 */
function getAllFeatureFlags() {
  return { ...FEATURE_FLAGS };
}

/**
 * 獲取啟用的功能列表
 * @returns {Array} - 啟用的功能列表
 */
function getEnabledFeatures() {
  return Object.keys(FEATURE_FLAGS).filter(key => FEATURE_FLAGS[key] === true);
}

/**
 * 獲取禁用的功能列表
 * @returns {Array} - 禁用的功能列表
 */
function getDisabledFeatures() {
  return Object.keys(FEATURE_FLAGS).filter(key => FEATURE_FLAGS[key] === false);
}

/**
 * 驗證功能開關配置
 * @returns {Object} - 驗證結果
 */
function validateFeatureFlags() {
  const validation = {
    isValid: true,
    warnings: [],
    errors: []
  };

  // 檢查依賴關係
  if (isFeatureEnabled('USE_V2_SERVICES') && !isFeatureEnabled('USE_ADAPTER_LAYER')) {
    validation.warnings.push('啟用V2服務時建議同時啟用適配器層');
  }

  if (isFeatureEnabled('USE_MULTI_TENANT') && !isFeatureEnabled('USE_V2_SERVICES')) {
    validation.errors.push('多租戶功能需要V2服務支援');
    validation.isValid = false;
  }

  if (isFeatureEnabled('USE_MONITORING_SYSTEM') && !isFeatureEnabled('USE_V2_SERVICES')) {
    validation.warnings.push('監控系統建議在V2架構下使用');
  }

  return validation;
}

module.exports = {
  FEATURE_FLAGS,
  isFeatureEnabled,
  getAllFeatureFlags,
  getEnabledFeatures,
  getDisabledFeatures,
  validateFeatureFlags
}; 