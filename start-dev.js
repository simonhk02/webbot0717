#!/usr/bin/env node

// 首先載入環境變數
require('dotenv').config();

const logger = require('./utils/logger');

// 設置開發環境變數
process.env.NODE_ENV = 'development';
process.env.LOG_LEVEL = 'debug';

logger.info('🚀 啟動 WhatsApp Bot 開發環境...');

// 檢查必要的目錄
const fs = require('fs');
const path = require('path');

const requiredDirs = ['logs', 'auth', 'public'];
requiredDirs.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    logger.info(`📁 建立目錄: ${dir}`);
  }
});

// 檢查 Google 憑證
const credentialsPath = path.join(__dirname, 'credentials', 'service-account.json');
if (!fs.existsSync(credentialsPath)) {
  logger.warn('⚠️  未找到 Google 憑證檔案，Google 服務可能無法正常運行');
  logger.info('請將 service-account.json 放在 credentials/ 目錄中');
} else {
  logger.info('✅ Google 憑證檔案已找到');
}

// 啟動應用程式
try {
  require('./app.js');
  logger.info('✅ 應用程式啟動成功');
  logger.info('🌐 伺服器運行在: http://localhost:3002');
  logger.info('📱 WhatsApp Bot 已準備就緒');
} catch (error) {
  logger.error('❌ 應用程式啟動失敗:', error);
  process.exit(1);
}

// 優雅關閉
process.on('SIGINT', () => {
  logger.info('🛑 收到關閉信號，正在優雅關閉...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('🛑 收到終止信號，正在優雅關閉...');
  process.exit(0);
}); 