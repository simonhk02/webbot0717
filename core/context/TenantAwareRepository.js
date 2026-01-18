/**
 * 租戶感知的 Repository 模式
 * 實現數據層的完全隔離
 */

const { businessLogger } = require('../../utils/logger');

class TenantAwareRepository {
  constructor(database, tenantContext) {
    this.database = database;
    this.tenantContext = tenantContext;
    this.logger = businessLogger;
    
    // 定義允許的表名白名單 - 防止SQL注入
    this.allowedTables = [
      'users',
      'tenant_configs', 
      'messages',
      'sessions',
      'expenses',
      'analytics',
      'audit_logs',
      'plugin_configs',
      'counters',
      'resource_locks'
    ];
    
    // 欄位映射配置 - 支援camelCase與snake_case自動轉換
    this.fieldMappings = {
      // 用戶表欄位映射
      'users': {
        'userId': 'user_id',
        'tenantId': 'tenant_id', 
        'companyName': 'company_name',
        'createdAt': 'created_at',
        'updatedAt': 'updated_at'
      },
      // 租戶配置表欄位映射
      'tenant_configs': {
        'configKey': 'config_key',
        'configValue': 'config_value',
        'tenantId': 'tenant_id',
        'createdAt': 'created_at'
      },
      // 計數器表欄位映射
      'counters': {
        'counterName': 'counter_name',
        'tenantId': 'tenant_id',
        'updatedAt': 'updated_at'
      },
      // 資源鎖表欄位映射
      'resource_locks': {
        'lockName': 'lock_name',
        'tenantId': 'tenant_id',
        'acquiredAt': 'acquired_at',
        'expiresAt': 'expires_at'
      }
    };
    
    // 驗證租戶上下文
    if (!this.tenantContext || !this.tenantContext.tenantId) {
      throw new Error('TenantAwareRepository requires valid tenant context');
    }
  }

  /**
   * 驗證表名安全性 - 防止SQL注入
   * @param {string} table - 表名
   * @returns {boolean} 是否安全
   */
  validateTableName(table) {
    if (!table || typeof table !== 'string') {
      throw new Error('表名必須是非空字符串');
    }
    
    // 檢查是否在白名單中
    if (!this.allowedTables.includes(table)) {
      this.logger.error('嘗試訪問未授權的表', {
        table,
        tenantId: this.tenantContext?.tenantId,
        allowedTables: this.allowedTables
      });
      throw new Error(`不允許訪問表: ${table}`);
    }
    
    // 檢查是否包含危險字符
    const dangerousChars = [';', '--', '/*', '*/', 'DROP', 'DELETE', 'UPDATE', 'INSERT', 'CREATE', 'ALTER'];
    const upperTable = table.toUpperCase();
    for (const char of dangerousChars) {
      if (upperTable.includes(char)) {
        this.logger.error('表名包含危險字符', {
          table,
          dangerousChar: char,
          tenantId: this.tenantContext?.tenantId
        });
        throw new Error(`表名包含危險字符: ${char}`);
      }
    }
    
    return true;
  }

  /**
   * 安全構建SQL語句 - 使用參數化查詢
   * @param {string} table - 表名
   * @param {string} operation - 操作類型 (SELECT, INSERT, UPDATE, DELETE)
   * @param {Object} data - 數據對象
   * @returns {Object} {sql, values} SQL語句和參數
   */
  buildSafeSQL(table, operation, data = {}) {
    this.validateTableName(table);
    
    switch (operation.toUpperCase()) {
      case 'INSERT':
        const columns = Object.keys(data);
        const placeholders = columns.map(() => '?').join(', ');
        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
        return { sql, values: Object.values(data) };
        
      case 'SELECT':
        const conditions = Object.keys(data).map(key => `${key} = ?`).join(' AND ');
        const selectSQL = `SELECT * FROM ${table} WHERE ${conditions}`;
        return { sql: selectSQL, values: Object.values(data) };
        
      case 'UPDATE':
        const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
        const updateSQL = `UPDATE ${table} SET ${setClause}`;
        return { sql: updateSQL, values: Object.values(data) };
        
      default:
        throw new Error(`不支援的操作類型: ${operation}`);
    }
  }

  /**
   * 欄位映射方法：camelCase -> snake_case
   * @param {string} tableName - 表名
   * @param {Object} data - 數據對象
   * @returns {Object} 映射後的數據
   */
  mapToDatabaseFields(tableName, data) {
    const mapping = this.fieldMappings[tableName] || {};
    const mappedData = {};
    
    for (const [key, value] of Object.entries(data)) {
      const dbField = mapping[key] || key;
      mappedData[dbField] = value;
    }
    
    return mappedData;
  }

  /**
   * 欄位映射方法：snake_case -> camelCase
   * @param {string} tableName - 表名
   * @param {Object} data - 數據對象
   * @returns {Object} 映射後的數據
   */
  mapFromDatabaseFields(tableName, data) {
    const mapping = this.fieldMappings[tableName] || {};
    const reverseMapping = {};
    
    // 創建反向映射
    for (const [camelCase, snakeCase] of Object.entries(mapping)) {
      reverseMapping[snakeCase] = camelCase;
    }
    
    const mappedData = {};
    for (const [key, value] of Object.entries(data)) {
      const camelCaseField = reverseMapping[key] || key;
      mappedData[camelCaseField] = value;
    }
    
    return mappedData;
  }

  /**
   * 自動注入租戶過濾條件（強制覆蓋外部tenantId）
   * @param {string} tableName - 表名
   * @param {Object} conditions - 查詢條件
   * @returns {Object} 帶租戶過濾的查詢
   */
  injectTenantFilter(tableName, conditions = {}) {
    if (!this.allowedTables.includes(tableName)) {
      throw new Error(`Table '${tableName}' is not allowed`);
    }
    
    // 驗證租戶上下文權限
    if (!this.tenantContext.hasPermission('read')) {
      throw new Error('Insufficient permissions for read operation');
    }
    
    return {
      ...conditions,
      tenantId: this.tenantContext.tenantId
    };
  }

  /**
   * 自動注入租戶ID到數據
   * @param {string} tableName - 表名
   * @param {Object} data - 數據對象
   * @returns {Object} 帶租戶ID的數據
   */
  injectTenantId(tableName, data) {
    if (!this.allowedTables.includes(tableName)) {
      throw new Error(`Table '${tableName}' is not allowed`);
    }
    
    // 驗證租戶上下文權限
    if (!this.tenantContext.hasPermission('write')) {
      throw new Error('Insufficient permissions for write operation');
    }
    
    return {
      ...data,
      tenantId: this.tenantContext.tenantId
    };
  }

  /**
   * 創建記錄
   * @param {string} tableName - 表名
   * @param {Object} data - 數據
   * @returns {Promise<Object>} 創建的記錄
   */
  async create(tableName, data) {
    try {
      // 注入租戶ID並映射欄位
      const tenantData = this.injectTenantId(tableName, data);
      const mappedData = this.mapToDatabaseFields(tableName, tenantData);
      
      const columns = Object.keys(mappedData).join(', ');
      const placeholders = Object.keys(mappedData).map(() => '?').join(', ');
      const values = Object.values(mappedData);
      
      const sql = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`;
      
      return new Promise((resolve, reject) => {
        this.database.run(sql, values, function(err) {
          if (err) {
            this.logger.error('Database create error', { error: err.message, table: tableName });
            reject(err);
          } else {
            resolve({ id: this.lastID, ...data });
          }
        });
      });
    } catch (error) {
      this.logger.error('Repository create error', { error: error.message, table: tableName });
      throw error;
    }
  }

  /**
   * 查找記錄
   * @param {string} tableName - 表名
   * @param {Object} conditions - 查詢條件
   * @returns {Promise<Object|null>} 記錄
   */
  async findOne(tableName, conditions = {}) {
    try {
      const tenantConditions = this.injectTenantFilter(tableName, conditions);
      const mappedConditions = this.mapToDatabaseFields(tableName, tenantConditions);
      
      const whereClause = Object.keys(mappedConditions).map(key => `${key} = ?`).join(' AND ');
      const values = Object.values(mappedConditions);
      
      const sql = `SELECT * FROM ${tableName} WHERE ${whereClause} LIMIT 1`;
      
      return new Promise((resolve, reject) => {
        this.database.get(sql, values, (err, row) => {
          if (err) {
            this.logger.error('Database findOne error', { error: err.message, table: tableName });
            reject(err);
          } else {
            // 映射回camelCase
            const mappedRow = row ? this.mapFromDatabaseFields(tableName, row) : null;
            resolve(mappedRow);
          }
        });
      });
    } catch (error) {
      this.logger.error('Repository findOne error', { error: error.message, table: tableName });
      throw error;
    }
  }

  /**
   * 查找多條記錄
   * @param {string} tableName - 表名
   * @param {Object} conditions - 查詢條件
   * @param {Object} options - 選項
   * @returns {Promise<Array>} 記錄列表
   */
  async findMany(tableName, conditions = {}, options = {}) {
    try {
      const tenantConditions = this.injectTenantFilter(tableName, conditions);
      const mappedConditions = this.mapToDatabaseFields(tableName, tenantConditions);
      
      let sql = `SELECT * FROM ${tableName}`;
      let values = [];
      
      if (Object.keys(mappedConditions).length > 0) {
        const whereClause = Object.keys(mappedConditions).map(key => `${key} = ?`).join(' AND ');
        values = Object.values(mappedConditions);
        sql += ` WHERE ${whereClause}`;
      }
      
      // 安全處理ORDER BY - 只允許字母、數字、下劃線和點
      if (options.orderBy && /^[a-zA-Z0-9_.]+$/.test(options.orderBy)) {
        sql += ` ORDER BY ${options.orderBy}`;
      }

      // 安全處理LIMIT和OFFSET - 只允許數字
      if (options.limit && /^\d+$/.test(options.limit.toString())) {
        sql += ` LIMIT ${options.limit}`;
        if (options.offset && /^\d+$/.test(options.offset.toString())) {
          sql += ` OFFSET ${options.offset}`;
        }
      }
      
      return new Promise((resolve, reject) => {
        this.database.all(sql, values, (err, rows) => {
          if (err) {
            this.logger.error('Database findMany error', { error: err.message, table: tableName });
            reject(err);
          } else {
            // 映射回camelCase
            const mappedRows = rows.map(row => this.mapFromDatabaseFields(tableName, row));
            resolve(mappedRows);
          }
        });
      });
    } catch (error) {
      this.logger.error('Repository findMany error', { error: error.message, table: tableName });
      throw error;
    }
  }

  /**
   * 更新記錄
   * @param {string} tableName - 表名
   * @param {Object} conditions - 查詢條件
   * @param {Object} data - 更新數據
   * @returns {Promise<number>} 更新的記錄數
   */
  async update(tableName, conditions, data) {
    try {
      const tenantConditions = this.injectTenantFilter(tableName, conditions);
      const mappedConditions = this.mapToDatabaseFields(tableName, tenantConditions);
      const mappedData = this.mapToDatabaseFields(tableName, data);
      
      const setClause = Object.keys(mappedData).map(key => `${key} = ?`).join(', ');
      const whereClause = Object.keys(mappedConditions).map(key => `${key} = ?`).join(' AND ');
      
      const values = [...Object.values(mappedData), ...Object.values(mappedConditions)];
      const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause}`;
      
      return new Promise((resolve, reject) => {
        this.database.run(sql, values, function(err) {
          if (err) {
            this.logger.error('Database update error', { error: err.message, table: tableName });
            reject(err);
          } else {
            resolve({ changes: this.changes });
          }
        });
      });
    } catch (error) {
      this.logger.error('Repository update error', { error: error.message, table: tableName });
      throw error;
    }
  }

  /**
   * 刪除記錄
   * @param {string} tableName - 表名
   * @param {Object} conditions - 查詢條件
   * @returns {Promise<number>} 刪除的記錄數
   */
  async delete(tableName, conditions) {
    try {
      const tenantConditions = this.injectTenantFilter(tableName, conditions);
      const mappedConditions = this.mapToDatabaseFields(tableName, tenantConditions);
      
      const whereClause = Object.keys(mappedConditions).map(key => `${key} = ?`).join(' AND ');
      const values = Object.values(mappedConditions);
      
      const sql = `DELETE FROM ${tableName} WHERE ${whereClause}`;
      
      return new Promise((resolve, reject) => {
        this.database.run(sql, values, function(err) {
          if (err) {
            this.logger.error('Database delete error', { error: err.message, table: tableName });
            reject(err);
          } else {
            resolve({ changes: this.changes });
          }
        });
      });
    } catch (error) {
      this.logger.error('Repository delete error', { error: error.message, table: tableName });
      throw error;
    }
  }

  /**
   * 統計記錄數
   * @param {string} tableName - 表名
   * @param {Object} conditions - 查詢條件
   * @returns {Promise<number>} 記錄數
   */
  async count(tableName, conditions = {}) {
    try {
      const tenantConditions = this.injectTenantFilter(tableName, conditions);

      // 驗證表名安全性
      this.validateTableName(tableName);

      let sql = `SELECT COUNT(*) as count FROM ${tableName}`;
      const values = [];

      if (Object.keys(tenantConditions).length > 0) {
        const whereClause = Object.keys(tenantConditions).map(key => `${key} = ?`).join(' AND ');
        sql += ` WHERE ${whereClause}`;
        values.push(...Object.values(tenantConditions));
      }

      const result = await this.database.get(sql, values);
      return result.count || 0;
    } catch (error) {
      this.logger.error('統計記錄數失敗', {
        tableName,
        tenantId: this.tenantContext.tenantId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 執行事務
   * @param {Function} callback - 事務回調函數
   * @returns {Promise<any>} 事務結果
   */
  async transaction(callback) {
    return new Promise((resolve, reject) => {
      this.database.serialize(() => {
        this.database.run('BEGIN TRANSACTION');
        
        try {
          const result = callback(this);
          this.database.run('COMMIT');
          resolve(result);
        } catch (error) {
          this.database.run('ROLLBACK');
          reject(error);
        }
      });
    });
  }

  /**
   * 驗證租戶訪問權限
   * @param {string} resourceId - 資源ID
   * @param {string} action - 操作類型
   * @returns {Promise<boolean>} 是否有權限
   */
  async validateAccess(resourceId, action) {
    try {
      // 檢查資源是否屬於當前租戶
      const resource = await this.findOne('resources', { id: resourceId });
      
      if (!resource) {
        return false;
      }

      // 檢查租戶是否匹配
      if (resource.tenantId !== this.tenantContext.tenantId) {
        this.logger.warn('跨租戶訪問嘗試', {
          resourceId,
          resourceTenantId: resource.tenantId,
          currentTenantId: this.tenantContext.tenantId,
          action
        });
        return false;
      }

      // 檢查用戶權限
      return this.tenantContext.hasPermission(action);
    } catch (error) {
      this.logger.error('權限驗證失敗', {
        resourceId,
        action,
        tenantId: this.tenantContext.tenantId,
        error: error.message
      });
      return false;
    }
  }
}

module.exports = TenantAwareRepository; 