const sqlite3 = require('sqlite3').verbose();
const { businessLogger } = require('./utils/logger');
const path = require('path');

// 使用絕對路徑
const dbPath = path.join(__dirname, 'whatsappBot.db');
businessLogger.info(`資料庫路徑: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    businessLogger.error(`連接到資料庫失敗：${err.message}`, { 
      stack: err.stack,
      path: dbPath 
    });
  } else {
    businessLogger.info('成功連接到 whatsappBot.db');
  }
});

// 資料庫初始化狀態
let isInitialized = false;
let initializationPromise = null;

// 創建基本資料表（簡化版本）
async function createBasicTables() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 建立 users 表
      db.run(
        `CREATE TABLE IF NOT EXISTS users (
          userId TEXT PRIMARY KEY,
          username TEXT,
          email TEXT UNIQUE,
          password TEXT,
          groupName TEXT,
          messageFormat TEXT,
          customQuestions TEXT,
          driveFolderId TEXT,
          sheetId TEXT,
          sheetName TEXT,
          companyName TEXT,
          companyAddress TEXT,
          companyPhone TEXT,
          invoiceTitle TEXT,
          invoiceNumberPrefix TEXT,
          invoiceFooter TEXT,
          isAuthenticated BOOLEAN,
          enableAI BOOLEAN DEFAULT 0,
          aiConfidenceThreshold REAL DEFAULT 0.8,
          enablePdf BOOLEAN,
          pdfStyle TEXT
        )`,
        (err) => {
          if (err) {
            businessLogger.error(`創建 users 表失敗：${err.message}`, { stack: err.stack });
            reject(err);
            return;
          }
          businessLogger.info('users 表已創建或已存在');
          
          // 建立 plugin_settings 表
          db.run(
            `CREATE TABLE IF NOT EXISTS plugin_settings (
              userId TEXT,
              pluginName TEXT,
              enabled BOOLEAN,
              settings TEXT,
              PRIMARY KEY (userId, pluginName)
            )`,
            (err) => {
              if (err) {
                businessLogger.error(`創建 plugin_settings 表失敗：${err.message}`, { stack: err.stack });
                reject(err);
                return;
              }
              businessLogger.info('plugin_settings 表已創建或已存在');
              resolve();
            }
          );
        }
      );
    });
  });
}

// 創建插件相關的資料表
async function createPluginTables() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS plugins (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          version TEXT NOT NULL,
          enabled BOOLEAN DEFAULT 1,
          config TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          businessLogger.error(`創建 plugins 表失敗：${err.message}`, { stack: err.stack });
          reject(err);
          return;
        }
        businessLogger.info('plugins 表已創建或已存在');
        
        db.run(`
          CREATE TABLE IF NOT EXISTS plugin_settings (
            plugin_id TEXT,
            user_id TEXT,
            settings TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (plugin_id, user_id),
            FOREIGN KEY (plugin_id) REFERENCES plugins(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
          )
        `, (err) => {
          if (err) {
            businessLogger.error(`創建 plugin_settings 表失敗：${err.message}`, { stack: err.stack });
            reject(err);
            return;
          }
          businessLogger.info('plugin_settings 表已創建或已存在');
          resolve();
        });
      });
    });
  });
}

// 初始化資料庫（可控制的初始化）
async function initializeDatabase() {
  if (isInitialized) {
    businessLogger.info('資料庫已初始化，跳過重複初始化');
    return;
  }
  
  if (initializationPromise) {
    businessLogger.info('資料庫正在初始化中，等待完成...');
    return initializationPromise;
  }
  
  initializationPromise = (async () => {
    try {
      businessLogger.info('開始初始化資料庫...');
      await createBasicTables();
      await createPluginTables();
      isInitialized = true;
      businessLogger.info('資料庫初始化完成');
    } catch (error) {
      businessLogger.error(`資料庫初始化失敗: ${error.message}`, { stack: error.stack });
      throw error;
    }
  })();
  
  return initializationPromise;
}

// 匯出資料庫實例和初始化函數，但不在模組載入時自動執行
module.exports = db;
module.exports.initializeDatabase = initializeDatabase;
module.exports.isInitialized = () => isInitialized;