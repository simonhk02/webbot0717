/**
 * 服務適配器
 * 確保新系統只能讀取現有服務，不能修改
 * 實現零影響的服務重用
 */

const { businessLogger } = require('../../utils/logger');

class ServiceAdapter {
  constructor(serviceName, originalService, logger = null) {
    this.serviceName = serviceName;
    this.originalService = originalService;
    this.logger = logger || businessLogger;
    this.accessLog = [];

    // 只讀方法白名單，使用 Map 存儲方法名稱和其預期的行為類型
    this.readOnlyWhitelist = new Map([
      ['get', { type: 'read', validateArgs: this._validateGetArgs, validateResult: this._validateReadResult }],
      ['all', { type: 'read', validateArgs: this._validateNoArgs, validateResult: this._validateReadResult }],
      ['find', { type: 'read', validateArgs: this._validateFindArgs, validateResult: this._validateReadResult }],
      ['list', { type: 'read', validateArgs: this._validateNoArgs, validateResult: this._validateReadResult }],
      ['findOne', { type: 'read', validateArgs: this._validateFindOneArgs, validateResult: this._validateReadResult }],
      ['findAll', { type: 'read', validateArgs: this._validateNoArgs, validateResult: this._validateReadResult }],
      ['count', { type: 'read', validateArgs: this._validateNoArgs, validateResult: this._validateNumericResult }],
      ['exists', { type: 'read', validateArgs: this._validateExistsArgs, validateResult: this._validateBooleanResult }],
      ['healthCheck', { type: 'read', validateArgs: this._validateNoArgs, validateResult: this._validateHealthCheckResult }],
      ['getAccessLog', { type: 'read', validateArgs: this._validateNoArgs, validateResult: this._validateReadResult }]
    ]);

    // 凍結整個實例，防止運行時修改
    Object.freeze(this);
    Object.freeze(this.readOnlyWhitelist);
  }

  /**
   * 安全的只讀訪問方法
   * @param {string} method - 方法名稱
   * @param {Array} args - 參數
   * @returns {Promise<any>} - 結果
   */
  async safeRead(method, ...args) {
    try {
      // 1. 基本安全檢查
      if (typeof method !== 'string') {
        throw new Error('不允許的操作: 方法名必須是字符串');
      }

      // 2. 白名單檢查
      const methodConfig = this.readOnlyWhitelist.get(method);
      if (!methodConfig) {
        this.logger.error(`不允許的操作: ${method}`, {
          serviceName: this.serviceName,
          method,
        });
        throw new Error(`不允許的操作: ${method}`);
      }

      // 3. 參數驗證
      await methodConfig.validateArgs.call(this, args);

      // 4. 檢查方法是否存在且是函數
      if (typeof this.originalService[method] !== 'function') {
        throw new Error(`方法 ${method} 不存在於服務 ${this.serviceName}`);
      }

      // 5. 記錄訪問日誌
      this.logAccess('read', method, args);

      // 6. 執行只讀操作並驗證結果
      const result = await Promise.resolve(this.originalService[method](...args));
      
      // 7. 驗證結果
      const validatedResult = await methodConfig.validateResult.call(this, result);

      this.logger.info(`服務適配器成功調用 ${this.serviceName}.${method}`, {
        serviceName: this.serviceName,
        method,
        argsCount: args.length
      });

      return validatedResult;
    } catch (error) {
      this.logger.error(`服務適配器調用失敗 ${this.serviceName}.${method}`, {
        serviceName: this.serviceName,
        method,
        error: error.message
      });
      throw error;
    }
  }

  // 參數驗證方法
  async _validateGetArgs(args) {
    if (args.length !== 1 || typeof args[0] !== 'string') {
      throw new Error('get 方法需要一個字符串參數');
    }
  }

  async _validateNoArgs(args) {
    if (args.length !== 0) {
      throw new Error('此方法不接受任何參數');
    }
  }

  async _validateFindArgs(args) {
    if (args.length !== 1 || typeof args[0] !== 'object') {
      throw new Error('find 方法需要一個對象參數');
    }
    // 深度驗證查詢參數
    this._validateQueryObject(args[0]);
  }

  async _validateFindOneArgs(args) {
    if (args.length !== 1 || typeof args[0] !== 'object') {
      throw new Error('findOne 方法需要一個對象參數');
    }
    // 深度驗證查詢參數
    this._validateQueryObject(args[0]);
  }

  async _validateExistsArgs(args) {
    if (args.length !== 1) {
      throw new Error('exists 方法需要一個參數');
    }
  }

  // 查詢對象驗證
  _validateQueryObject(query) {
    if (!query || typeof query !== 'object') {
      throw new Error('查詢參數必須是對象');
    }

    // 檢查是否包含不安全的查詢操作符
    const unsafeOperators = ['$where', '$expr', '$function'];
    Object.keys(query).forEach(key => {
      if (unsafeOperators.includes(key)) {
        throw new Error(`不允許使用不安全的查詢操作符: ${key}`);
      }
    });
  }

  // 結果驗證方法
  async _validateReadResult(result) {
    // 防止返回函數或其他可能被執行的內容
    if (typeof result === 'function') {
      throw new Error('不允許返回函數類型');
    }

    // 如果是對象，進行深度凍結和驗證
    if (typeof result === 'object' && result !== null) {
      this._validateObjectSafety(result);
      return Object.freeze(this._deepClone(result));
    }

    return result;
  }

  async _validateNumericResult(result) {
    if (typeof result !== 'number') {
      throw new Error('結果必須是數字類型');
    }
    return result;
  }

  async _validateBooleanResult(result) {
    if (typeof result !== 'boolean') {
      throw new Error('結果必須是布爾類型');
    }
    return result;
  }

  async _validateHealthCheckResult(result) {
    if (!result || typeof result !== 'object') {
      throw new Error('健康檢查結果必須是對象');
    }
    return Object.freeze({
      status: String(result.status || 'unknown'),
      service: this.serviceName,
      adapter: true,
      timestamp: new Date().toISOString()
    });
  }

  // 深度驗證對象安全性
  _validateObjectSafety(obj, seen = new Set()) {
    if (seen.has(obj)) {
      throw new Error('不允許循環引用');
    }
    seen.add(obj);

    for (const [key, value] of Object.entries(obj)) {
      // 檢查鍵名安全性
      if (key.startsWith('__') || key.startsWith('$')) {
        throw new Error(`不安全的屬性名: ${key}`);
      }

      // 檢查值類型安全性
      if (typeof value === 'function') {
        throw new Error(`不允許函數類型的值: ${key}`);
      }

      // 遞歸檢查嵌套對象
      if (value && typeof value === 'object') {
        this._validateObjectSafety(value, seen);
      }
    }
  }

  // 深度克隆對象
  _deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * 記錄訪問日誌
   * @param {string} operation - 操作類型
   * @param {string} method - 方法名稱
   * @param {Array} args - 參數
   */
  logAccess(operation, method, args) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      operation,
      serviceName: this.serviceName,
      method,
      argsCount: args.length
    };

    this.accessLog.push(logEntry);

    // 限制日誌條目數量
    if (this.accessLog.length > 100) {
      this.accessLog = this.accessLog.slice(-50);
    }
  }

  /**
   * 獲取訪問日誌
   * @returns {Array} - 訪問日誌
   */
  getAccessLog() {
    return Object.freeze([...this.accessLog]);
  }

  /**
   * 健康檢查
   * @returns {Object} - 健康狀態
   */
  async healthCheck() {
    try {
      if (this.originalService.healthCheck) {
        const result = await this.originalService.healthCheck();
        return Object.freeze({
          ...result,
          adapter: true,
          timestamp: new Date().toISOString()
        });
      }

      return Object.freeze({
        status: 'healthy',
        service: this.serviceName,
        adapter: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return Object.freeze({
        status: 'unhealthy',
        service: this.serviceName,
        adapter: true,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}

/**
 * 創建服務適配器工廠
 * @param {string} serviceName - 服務名稱
 * @param {Object} originalService - 原始服務
 * @returns {ServiceAdapter} - 服務適配器
 */
function createServiceAdapter(serviceName, originalService) {
  if (!serviceName || typeof serviceName !== 'string') {
    throw new Error('服務名稱必須是非空字符串');
  }
  if (!originalService || typeof originalService !== 'object') {
    throw new Error('原始服務必須是有效的對象');
  }
  return new ServiceAdapter(serviceName, originalService);
}

module.exports = {
  ServiceAdapter,
  createServiceAdapter
}; 