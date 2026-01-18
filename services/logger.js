const winston = require('winston');
const config = require('../config');

// 創建日誌格式
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// 創建日誌傳輸器
const transports = [
  // 控制台輸出
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }),
  // 一般日誌文件
  new winston.transports.File({
    filename: config.logging.filename,
    level: 'info'
  }),
  // 錯誤日誌文件
  new winston.transports.File({
    filename: config.logging.errorFilename,
    level: 'error'
  })
];

// 創建日誌實例
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports,
  // 處理未捕獲的異常
  handleExceptions: true,
  handleRejections: true
});

// 創建請求日誌中間件
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

// 創建錯誤日誌中間件
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

module.exports = {
  logger,
  requestLogger,
  errorLogger
}; 