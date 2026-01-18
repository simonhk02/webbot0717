const winston = require('winston');
const path = require('path');
const fs = require('fs');

// 確保 logs 目錄存在
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// 日誌配置
const logConfig = {
  level: process.env.LOG_LEVEL || 'info',
  maxSize: 5 * 1024 * 1024, // 5MB
  maxFiles: 5,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  )
};

// 建立傳輸器
const transports = [
  // 錯誤日誌檔案 - 修復參數名稱
  new winston.transports.File({ 
    filename: path.join(logsDir, 'error.log'), 
    level: 'error',
    maxsize: logConfig.maxSize,
    maxFiles: logConfig.maxFiles,
    handleExceptions: false // 避免與全局異常處理衝突
  }),
  // 所有日誌檔案 - 修復參數名稱和文件名
  new winston.transports.File({ 
    filename: path.join(logsDir, 'app.log'),
    maxsize: logConfig.maxSize,
    maxFiles: logConfig.maxFiles,
    tailable: true, // 確保輪換後文件名正確
    zippedArchive: true // 壓縮舊文件節省空間
  })
];

// 如果不是生產環境，也輸出到控制台
if (process.env.NODE_ENV !== 'production') {
  transports.push(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// 建立日誌實例
const logger = winston.createLogger({
  level: logConfig.level,
  format: logConfig.format,
  defaultMeta: { service: 'whatsapp-bot' },
  transports,
  exitOnError: false // 避免日誌錯誤導致程式退出
});

// 處理未捕獲的異常
logger.exceptions.handle(
  new winston.transports.File({
    filename: path.join(logsDir, 'exceptions.log'),
    maxsize: logConfig.maxSize,
    maxFiles: logConfig.maxFiles,
    handleExceptions: true
  })
);

// 處理未處理的 Promise 拒絕
logger.rejections.handle(
  new winston.transports.File({
    filename: path.join(logsDir, 'rejections.log'),
    maxsize: logConfig.maxSize,
    maxFiles: logConfig.maxFiles,
    handleRejections: true
  })
);

// 建立請求日誌中間件
const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  });
  next();
};

// 建立錯誤日誌中間件
const errorLogger = (err, req, res, next) => {
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    body: req.body,
    params: req.params,
    query: req.query
  });
  next(err);
};

// 建立業務日誌方法
const businessLogger = {
  info: (message, meta = {}) => {
    logger.info(message, { ...meta, type: 'business' });
  },
  
  error: (message, meta = {}) => {
    logger.error(message, { ...meta, type: 'business' });
  },
  
  warn: (message, meta = {}) => {
    logger.warn(message, { ...meta, type: 'business' });
  },
  
  debug: (message, meta = {}) => {
    logger.debug(message, { ...meta, type: 'business' });
  }
};

module.exports = {
  logger,
  requestLogger,
  errorLogger,
  businessLogger
}; 