/**
 * 環境變數管理模組
 * 提供統一的環境變數存取介面，包含驗證和預設值
 */

class EnvironmentManager {
  constructor() {
    this.requiredVars = [
      // 暫時移除必需變數，使用預設值
    ];
    
    this.optionalVars = {
      'PORT': 3002,
      'NODE_ENV': 'development',
      'SESSION_SECRET': 'simonhk02-dev-secret',
      'REDIS_HOST': 'localhost',
      'REDIS_PORT': 6379,
      'DB_PATH': 'whatsappBot.db',
      'GOOGLE_CLIENT_ID': '',
      'GOOGLE_CLIENT_SECRET': '',
      'GOOGLE_REDIRECT_URI': 'http://localhost:3002/auth/google/callback',
      'ANTHROPIC_API_KEY': ''
    };
    
    this.validateEnvironment();
  }
  
  /**
   * 驗證環境變數
   */
  validateEnvironment() {
    const missing = this.requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      console.warn(`⚠️  缺少必要的環境變數: ${missing.join(', ')}`);
      console.warn('請檢查 .env 檔案或環境變數設置');
    }
  }
  
  /**
   * 取得環境變數值
   * @param {string} key - 環境變數名稱
   * @param {*} defaultValue - 預設值
   * @returns {*} 環境變數值或預設值
   */
  get(key, defaultValue = null) {
    const value = process.env[key];
    
    if (value !== undefined) {
      // 嘗試轉換為數字
      if (!isNaN(value) && value !== '') {
        return Number(value);
      }
      
      // 布林值轉換
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;
      
      return value;
    }
    
    return defaultValue !== null ? defaultValue : this.optionalVars[key];
  }
  
  /**
   * 檢查是否為開發環境
   * @returns {boolean}
   */
  isDevelopment() {
    return this.get('NODE_ENV') === 'development';
  }
  
  /**
   * 檢查是否為生產環境
   * @returns {boolean}
   */
  isProduction() {
    return this.get('NODE_ENV') === 'production';
  }
  
  /**
   * 取得所有環境變數（用於除錯）
   * @returns {Object}
   */
  getAll() {
    const result = {};
    
    // 取得所有已設置的環境變數
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('NODE_') || 
          key.startsWith('REDIS_') || 
          key.startsWith('GOOGLE_') || 
          key.startsWith('ANTHROPIC_') ||
          key === 'PORT' ||
          key === 'SESSION_SECRET' ||
          key === 'DB_PATH' ||
          key === 'NODE_ENV') {
        result[key] = this.get(key);
      }
    });
    
    return result;
  }
}

module.exports = new EnvironmentManager(); 