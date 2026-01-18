const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

/**
 * 企業級日誌服務
 * 實現結構化日誌、日誌聚合、日誌分析工具和日誌保留政策
 */
class LoggingService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      logDir: options.logDir || 'logs',
      maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
      maxFiles: options.maxFiles || 5,
      retentionDays: options.retentionDays || 30,
      logLevel: options.logLevel || 'info',
      enableConsole: options.enableConsole !== false,
      enableFile: options.enableFile !== false,
      enableAggregation: options.enableAggregation !== false,
      aggregationInterval: options.aggregationInterval || 60000, // 1分鐘
      ...options
    };
    
    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    };
    
    this.currentLogFile = null;
    this.aggregationData = {
      errorCount: 0,
      warnCount: 0,
      infoCount: 0,
      debugCount: 0,
      traceCount: 0,
      lastReset: Date.now()
    };
    
    this.aggregationTimer = null;
    this.isInitialized = false;
  }
  
  /**
   * 初始化日誌服務
   */
  async initialize() {
    try {
      // 確保日誌目錄存在
      await this.ensureLogDirectory();
      
      // 創建當前日誌文件
      await this.createLogFile();
      
      // 啟動日誌聚合
      if (this.options.enableAggregation) {
        this.startAggregation();
      }
      
      // 啟動日誌清理
      this.startLogCleanup();
      
      this.isInitialized = true;
      
      this.log('info', 'LoggingService initialized', {
        logDir: this.options.logDir,
        logLevel: this.options.logLevel,
        retentionDays: this.options.retentionDays
      });
      
      this.emit('initialized');
      
    } catch (error) {
      console.error('Failed to initialize LoggingService:', error);
      throw error;
    }
  }
  
  /**
   * 確保日誌目錄存在
   */
  async ensureLogDirectory() {
    try {
      await fs.access(this.options.logDir);
    } catch (error) {
      await fs.mkdir(this.options.logDir, { recursive: true });
    }
  }
  
  /**
   * 創建新的日誌文件
   */
  async createLogFile() {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `app-${timestamp}.log`;
    this.currentLogFile = path.join(this.options.logDir, filename);
    
    // 檢查文件大小，如果超過限制則輪換
    await this.checkAndRotateLogFile();
  }
  
  /**
   * 檢查並輪換日誌文件
   */
  async checkAndRotateLogFile() {
    try {
      const stats = await fs.stat(this.currentLogFile);
      
      if (stats.size > this.options.maxFileSize) {
        await this.rotateLogFile();
      }
    } catch (error) {
      // 文件不存在，創建新文件
      await fs.writeFile(this.currentLogFile, '');
    }
  }
  
  /**
   * 強制檢查文件大小並輪換
   */
  async forceCheckAndRotate() {
    try {
      const stats = await fs.stat(this.currentLogFile);
      
      if (stats.size > this.options.maxFileSize) {
        await this.rotateLogFile();
        return true; // 表示發生了輪換
      }
      return false; // 沒有輪換
    } catch (error) {
      // 文件不存在，創建新文件
      await fs.writeFile(this.currentLogFile, '');
      return false;
    }
  }
  
  /**
   * 輪換日誌文件
   */
  async rotateLogFile() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const oldFile = this.currentLogFile;
    const newFile = `${oldFile}.${timestamp}`;
    try {
      // 修正：輪換前先檢查檔案是否存在
      try {
        await fs.access(oldFile);
        await fs.rename(oldFile, newFile);
        await this.createLogFile();
        this.log('info', 'Log file rotated', {
          oldFile: path.basename(oldFile),
          newFile: path.basename(this.currentLogFile)
        });
      } catch (accessErr) {
        // 若檔案不存在，記錄警告但不中斷流程
        this.log('warn', 'Log file to rotate does not exist, skipping rename', {
          oldFile: path.basename(oldFile),
          error: accessErr.message
        });
        await this.createLogFile();
      }
      // 清理舊文件
      await this.cleanupOldLogFiles();
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }
  
  /**
   * 清理舊的日誌文件
   */
  async cleanupOldLogFiles() {
    try {
      const files = await fs.readdir(this.options.logDir);
      const logFiles = files.filter(file => file.startsWith('app-') && file.endsWith('.log'));
      
      // 按修改時間排序
      const fileStats = await Promise.all(
        logFiles.map(async (file) => {
          const filePath = path.join(this.options.logDir, file);
          const stats = await fs.stat(filePath);
          return { file, filePath, mtime: stats.mtime };
        })
      );
      
      // 保留最新的文件
      fileStats.sort((a, b) => b.mtime - a.mtime);
      
      for (let i = this.options.maxFiles; i < fileStats.length; i++) {
        await fs.unlink(fileStats[i].filePath);
        this.log('info', 'Deleted old log file', { file: fileStats[i].file });
      }
      
    } catch (error) {
      console.error('Failed to cleanup old log files:', error);
    }
  }
  
  /**
   * 記錄日誌
   */
  log(level, message, data = {}) {
    if (!this.isInitialized) {
      console.warn('LoggingService not initialized, falling back to console');
      console.log(`[${level.toUpperCase()}] ${message}`, data);
      return;
    }
    
    if (this.logLevels[level] > this.logLevels[this.options.logLevel]) {
      return; // 日誌級別過低，不記錄
    }
    
    const logEntry = this.createLogEntry(level, message, data);
    
    // 更新聚合數據
    this.updateAggregationData(level);
    
    // 輸出到控制台
    if (this.options.enableConsole) {
      this.outputToConsole(logEntry);
    }
    
    // 寫入文件
    if (this.options.enableFile) {
      this.writeToFile(logEntry);
    }
    
    // 發送事件
    this.emit('log', logEntry);
  }
  
  /**
   * 創建日誌條目
   */
  createLogEntry(level, message, data) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      data,
      service: 'LoggingService',
      pid: process.pid,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };
    
    return logEntry;
  }
  
  /**
   * 更新聚合數據
   */
  updateAggregationData(level) {
    const countKey = `${level}Count`;
    if (this.aggregationData.hasOwnProperty(countKey)) {
      this.aggregationData[countKey]++;
    }
  }
  
  /**
   * 輸出到控制台
   */
  outputToConsole(logEntry) {
    const { timestamp, level, message, data } = logEntry;
    const timeStr = new Date(timestamp).toLocaleTimeString();
    
    let output = `[${timeStr}] [${level}] ${message}`;
    
    if (Object.keys(data).length > 0) {
      output += ` ${JSON.stringify(data)}`;
    }
    
    switch (level) {
      case 'ERROR':
        console.error(output);
        break;
      case 'WARN':
        console.warn(output);
        break;
      case 'INFO':
        console.info(output);
        break;
      case 'DEBUG':
        console.debug(output);
        break;
      default:
        console.log(output);
    }
  }
  
  /**
   * 寫入文件
   */
  async writeToFile(logEntry) {
    try {
      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(this.currentLogFile, logLine);
      
      // 每次寫入後檢查文件大小
      await this.checkAndRotateLogFile();
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }
  
  /**
   * 啟動日誌聚合
   */
  startAggregation() {
    this.aggregationTimer = setInterval(() => {
      this.emitAggregationReport();
      this.resetAggregationData();
    }, this.options.aggregationInterval);
  }
  
  /**
   * 發送聚合報告
   */
  emitAggregationReport() {
    const report = {
      timestamp: new Date().toISOString(),
      duration: this.options.aggregationInterval,
      counts: { ...this.aggregationData },
      totalLogs: Object.values(this.aggregationData).reduce((sum, count) => sum + count, 0)
    };
    
    this.emit('aggregation', report);
    
    this.log('info', 'Log aggregation report', report);
  }
  
  /**
   * 重置聚合數據
   */
  resetAggregationData() {
    this.aggregationData = {
      errorCount: 0,
      warnCount: 0,
      infoCount: 0,
      debugCount: 0,
      traceCount: 0,
      lastReset: Date.now()
    };
  }
  
  /**
   * 啟動日誌清理
   */
  startLogCleanup() {
    // 每天凌晨2點執行清理
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(2, 0, 0, 0);
    
    const timeUntilCleanup = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      this.performLogCleanup();
      // 之後每24小時執行一次
      setInterval(() => this.performLogCleanup(), 24 * 60 * 60 * 1000);
    }, timeUntilCleanup);
  }
  
  /**
   * 執行日誌清理
   */
  async performLogCleanup() {
    try {
      const files = await fs.readdir(this.options.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.options.retentionDays);
      
      let deletedCount = 0;
      
      for (const file of files) {
        if (file.startsWith('app-') && file.endsWith('.log')) {
          const filePath = path.join(this.options.logDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            deletedCount++;
          }
        }
      }
      
      if (deletedCount > 0) {
        this.log('info', 'Log cleanup completed', {
          deletedFiles: deletedCount,
          retentionDays: this.options.retentionDays
        });
      }
      
    } catch (error) {
      console.error('Failed to perform log cleanup:', error);
    }
  }
  
  /**
   * 獲取日誌統計
   */
  getLogStats() {
    return {
      isInitialized: this.isInitialized,
      currentLogFile: this.currentLogFile,
      logLevel: this.options.logLevel,
      retentionDays: this.options.retentionDays,
      aggregationData: { ...this.aggregationData },
      options: { ...this.options }
    };
  }
  
  /**
   * 分析日誌文件
   */
  async analyzeLogFile(filename, options = {}) {
    try {
      const filePath = path.join(this.options.logDir, filename);
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.trim().split('\n');
      
      const analysis = {
        totalLines: lines.length,
        levelCounts: {},
        errorPatterns: {},
        timeDistribution: {},
        topMessages: {},
        fileSize: content.length
      };
      
      for (const line of lines) {
        try {
          const logEntry = JSON.parse(line);
          
          // 統計級別
          analysis.levelCounts[logEntry.level] = (analysis.levelCounts[logEntry.level] || 0) + 1;
          
          // 統計錯誤模式
          if (logEntry.level === 'ERROR') {
            const errorType = this.extractErrorType(logEntry.message);
            analysis.errorPatterns[errorType] = (analysis.errorPatterns[errorType] || 0) + 1;
          }
          
          // 時間分布
          const hour = new Date(logEntry.timestamp).getHours();
          analysis.timeDistribution[hour] = (analysis.timeDistribution[hour] || 0) + 1;
          
          // 常見消息
          const messageKey = logEntry.message.substring(0, 50);
          analysis.topMessages[messageKey] = (analysis.topMessages[messageKey] || 0) + 1;
          
        } catch (parseError) {
          // 跳過無效的JSON行
        }
      }
      
      return analysis;
      
    } catch (error) {
      throw new Error(`Failed to analyze log file: ${error.message}`);
    }
  }
  
  /**
   * 提取錯誤類型
   */
  extractErrorType(message) {
    if (message.includes('ValidationError')) return 'ValidationError';
    if (message.includes('DatabaseError')) return 'DatabaseError';
    if (message.includes('NetworkError')) return 'NetworkError';
    if (message.includes('AuthenticationError')) return 'AuthenticationError';
    return 'Other';
  }
  
  /**
   * 搜索日誌
   */
  async searchLogs(query, options = {}) {
    const {
      level,
      startTime,
      endTime,
      limit = 100,
      filename
    } = options;
    
    try {
      const files = filename ? [filename] : await this.getLogFiles();
      const results = [];
      
      for (const file of files) {
        const filePath = path.join(this.options.logDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.trim().split('\n');
        
        for (const line of lines) {
          if (results.length >= limit) break;
          
          try {
            const logEntry = JSON.parse(line);
            
            // 檢查查詢條件
            if (level && logEntry.level !== level.toUpperCase()) continue;
            if (startTime && new Date(logEntry.timestamp) < new Date(startTime)) continue;
            if (endTime && new Date(logEntry.timestamp) > new Date(endTime)) continue;
            if (query && !logEntry.message.toLowerCase().includes(query.toLowerCase())) continue;
            
            results.push(logEntry);
            
          } catch (parseError) {
            // 跳過無效的JSON行
          }
        }
      }
      
      return results;
      
    } catch (error) {
      throw new Error(`Failed to search logs: ${error.message}`);
    }
  }
  
  /**
   * 獲取日誌文件列表
   */
  async getLogFiles() {
    try {
      const files = await fs.readdir(this.options.logDir);
      return files.filter(file => file.startsWith('app-') && file.endsWith('.log'));
    } catch (error) {
      return [];
    }
  }
  
  /**
   * 停止日誌服務
   */
  async stop() {
    try {
      // 停止聚合定時器
      if (this.aggregationTimer) {
        clearInterval(this.aggregationTimer);
        this.aggregationTimer = null;
      }
      
      // 發送最終聚合報告
      this.emitAggregationReport();
      
      this.log('info', 'LoggingService stopped');
      
      this.isInitialized = false;
      this.emit('stopped');
      
    } catch (error) {
      console.error('Failed to stop LoggingService:', error);
      throw error;
    }
  }
  
  // 便捷方法
  error(message, data) { this.log('error', message, data); }
  warn(message, data) { this.log('warn', message, data); }
  info(message, data) { this.log('info', message, data); }
  debug(message, data) { this.log('debug', message, data); }
  trace(message, data) { this.log('trace', message, data); }
}

module.exports = LoggingService; 