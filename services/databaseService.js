const { businessLogger } = require('../utils/logger');
const db = require('../database');
const { initializeDatabase, isInitialized } = require('../database');

class DatabaseService {
  constructor() {
    this.isInitialized = false;
    businessLogger.info('資料庫服務已建立');
  }

  async initialize() {
    if (this.isInitialized) {
      businessLogger.warn('資料庫服務已初始化，跳過重複初始化');
      return;
    }

    try {
      // 使用資料庫的統一初始化函數
      await initializeDatabase();
      
      // 設置定期檢查
      this.setupPeriodicCheck();
      
      this.isInitialized = true;
      businessLogger.info('資料庫服務初始化完成');
    } catch (err) {
      businessLogger.error(`資料庫服務初始化失敗：${err.message}`);
      throw err;
    }
  }

  setupPeriodicCheck() {
    // 每小時檢查一次資料庫連接
    setInterval(() => {
      this.healthCheck().then(health => {
        if (health.status === 'unhealthy') {
          businessLogger.warn('定期健康檢查發現資料庫問題:', health.error);
        } else {
          businessLogger.debug('資料庫健康檢查通過');
        }
      }).catch(err => {
        businessLogger.error(`定期資料庫健康檢查失敗: ${err.message}`);
      });
    }, 60 * 60 * 1000);
    
    businessLogger.info('資料庫定期檢查已設置（每小時一次）');
  }

  async healthCheck() {
    try {
      return new Promise((resolve, reject) => {
        db.get('SELECT 1 as test', (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve({
              status: 'healthy',
              service: 'Database',
              timestamp: new Date().toISOString(),
              details: {
                isInitialized: this.isInitialized && isInitialized(),
                test: row?.test === 1 ? 'passed' : 'failed'
              }
            });
          }
        });
      });
    } catch (err) {
      return {
        status: 'unhealthy',
        service: 'Database',
        timestamp: new Date().toISOString(),
        error: err.message
      };
    }
  }

  // 獲取資料庫實例
  getDatabase() {
    return db;
  }

  // 執行查詢（SELECT）
  async query(sql, params = []) {
    if (!this.isInitialized) {
      throw new Error('資料庫服務未初始化');
    }

    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // 執行查詢（SELECT）- all方法別名
  async all(sql, params = []) {
    // all方法是query方法的別名，確保向後兼容
    return this.query(sql, params);
  }

  // 執行查詢獲取單一行（SELECT）- get方法
  async get(sql, params = []) {
    if (!this.isInitialized) {
      throw new Error('資料庫服務未初始化');
    }

    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  // 執行寫入操作（INSERT, UPDATE, DELETE, CREATE TABLE等）
  async run(sql, params = []) {
    if (!this.isInitialized) {
      throw new Error('資料庫服務未初始化');
    }

    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({
            lastID: this.lastID,
            changes: this.changes
          });
        }
      });
    });
  }

  async cleanup() {
    try {
      // 關閉資料庫連接
      db.close((err) => {
        if (err) {
          businessLogger.error(`關閉資料庫連接失敗: ${err.message}`);
        } else {
          businessLogger.info('資料庫連接已關閉');
        }
      });
      this.isInitialized = false;
    } catch (err) {
      businessLogger.error(`清理資料庫服務失敗: ${err.message}`);
    }
  }
}

module.exports = DatabaseService; 