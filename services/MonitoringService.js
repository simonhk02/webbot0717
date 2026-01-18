const EventEmitter = require('events');
const os = require('os');
const process = require('process');

/**
 * 企業級監控服務
 * 實現應用程式監控、性能指標收集、警報機制
 */
class MonitoringService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      collectionInterval: options.collectionInterval || 30000, // 30秒
      retentionPeriod: options.retentionPeriod || 24 * 60 * 60 * 1000, // 24小時
      alertThresholds: options.alertThresholds || {
        cpuUsage: 80,
        memoryUsage: 85,
        errorRate: 5,
        responseTime: 2000
      },
      ...options
    };
    
    this.metrics = {
      system: new Map(),
      application: new Map(),
      business: new Map(),
      errors: []
    };
    
    this.alerts = [];
    this.isRunning = false;
    this.collectionTimer = null;
    
    this.logger = options.logger || console;
  }
  
  /**
   * 初始化監控服務
   */
  async initialize() {
    try {
      this.logger.info('監控服務初始化開始', {
        service: 'MonitoringService',
        timestamp: new Date().toISOString(),
        type: 'business'
      });
      
      // 初始化指標收集器
      await this.initializeMetrics();
      
      // 設置事件監聽器
      this.setupEventListeners();
      
      // 啟動指標收集
      this.startCollection();
      
      this.isRunning = true;
      
      this.logger.info('監控服務初始化完成', {
        service: 'MonitoringService',
        timestamp: new Date().toISOString(),
        type: 'business'
      });
      
      return true;
    } catch (error) {
      this.logger.error('監控服務初始化失敗', {
        error: error.message,
        stack: error.stack,
        service: 'MonitoringService',
        timestamp: new Date().toISOString(),
        type: 'business'
      });
      throw error;
    }
  }
  
  /**
   * 初始化指標收集器
   */
  async initializeMetrics() {
    // 系統指標
    this.metrics.system.set('cpu', {
      usage: 0,
      load: [0, 0, 0],
      cores: os.cpus().length
    });
    
    this.metrics.system.set('memory', {
      total: os.totalmem(),
      free: os.freemem(),
      used: 0,
      usage: 0
    });
    
    this.metrics.system.set('network', {
      bytesIn: 0,
      bytesOut: 0,
      connections: 0
    });
    
    // 應用程式指標
    this.metrics.application.set('process', {
      pid: process.pid,
      uptime: 0,
      memory: {
        rss: 0,
        heapUsed: 0,
        heapTotal: 0,
        external: 0
      }
    });
    
    this.metrics.application.set('performance', {
      responseTime: [],
      throughput: 0,
      errorRate: 0,
      activeConnections: 0
    });
    
    // 業務指標
    this.metrics.business.set('users', {
      active: 0,
      total: 0,
      newToday: 0
    });
    
    this.metrics.business.set('messages', {
      processed: 0,
      failed: 0,
      queueSize: 0
    });
    
    this.metrics.business.set('ai', {
      requests: 0,
      successRate: 100,
      averageResponseTime: 0
    });
  }
  
  /**
   * 設置事件監聽器
   */
  setupEventListeners() {
    // 監聽未處理的異常
    process.on('uncaughtException', (error) => {
      this.recordError('uncaughtException', error);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      this.recordError('unhandledRejection', reason);
    });
    
    // 監聽應用程式事件
    this.on('metric:record', (metric) => {
      this.recordMetric(metric);
    });
    
    this.on('alert:trigger', (alert) => {
      this.triggerAlert(alert);
    });
  }
  
  /**
   * 記錄通用指標
   */
  recordMetric(metric) {
    try {
      const { category, key, value, type } = metric;
      
      if (category === 'business') {
        this.recordBusinessMetric(key, value);
      } else if (category === 'performance') {
        this.recordPerformanceMetric(type || key, value);
      } else if (category === 'system') {
        // 系統指標通常由內部收集，這裡只是記錄
        this.logger.debug('系統指標已記錄', {
          key,
          value,
          service: 'MonitoringService',
          timestamp: new Date().toISOString(),
          type: 'business'
        });
      }
    } catch (error) {
      this.logger.error('記錄指標失敗', {
        error: error.message,
        metric,
        service: 'MonitoringService',
        timestamp: new Date().toISOString(),
        type: 'business'
      });
    }
  }
  
  /**
   * 開始指標收集
   */
  startCollection() {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
    }
    
    this.collectionTimer = setInterval(() => {
      this.collectMetrics();
    }, this.options.collectionInterval);
    
    this.logger.info('指標收集已啟動', {
      interval: this.options.collectionInterval,
      service: 'MonitoringService',
      timestamp: new Date().toISOString(),
      type: 'business'
    });
  }
  
  /**
   * 收集系統指標
   */
  collectMetrics() {
    try {
      // 收集系統指標
      this.collectSystemMetrics();
      
      // 收集應用程式指標
      this.collectApplicationMetrics();
      
      // 檢查警報條件
      this.checkAlerts();
      
      // 清理舊數據
      this.cleanupOldData();
      
    } catch (error) {
      this.logger.error('指標收集失敗', {
        error: error.message,
        service: 'MonitoringService',
        timestamp: new Date().toISOString(),
        type: 'business'
      });
    }
  }
  
  /**
   * 收集系統指標
   */
  collectSystemMetrics() {
    // CPU 使用率
    const cpuUsage = this.calculateCPUUsage();
    this.metrics.system.get('cpu').usage = cpuUsage;
    this.metrics.system.get('cpu').load = os.loadavg();
    
    // 記憶體使用率
    const freeMem = os.freemem();
    const totalMem = os.totalmem();
    const usedMem = totalMem - freeMem;
    const memUsage = (usedMem / totalMem) * 100;
    
    this.metrics.system.get('memory').free = freeMem;
    this.metrics.system.get('memory').used = usedMem;
    this.metrics.system.get('memory').usage = memUsage;
    
    // 網路統計
    const networkStats = this.getNetworkStats();
    this.metrics.system.get('network').bytesIn = networkStats.bytesIn;
    this.metrics.system.get('network').bytesOut = networkStats.bytesOut;
  }
  
  /**
   * 收集應用程式指標
   */
  collectApplicationMetrics() {
    const memUsage = process.memoryUsage();
    
    this.metrics.application.get('process').uptime = process.uptime();
    this.metrics.application.get('process').memory = {
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external
    };
  }
  
  /**
   * 計算 CPU 使用率
   */
  calculateCPUUsage() {
    // 簡化實現，實際應該使用更精確的CPU監控
    const loadAvg = os.loadavg();
    const cpuCount = os.cpus().length;
    
    // 基於負載平均值計算CPU使用率
    const load1 = loadAvg[0];
    const usage = Math.min((load1 / cpuCount) * 100, 100);
    
    return Math.round(usage);
  }
  
  /**
   * 獲取網路統計
   */
  getNetworkStats() {
    // 簡化實現，實際應該使用更詳細的網路監控
    return {
      bytesIn: Math.random() * 1000000,
      bytesOut: Math.random() * 500000
    };
  }
  
  /**
   * 記錄業務指標
   */
  recordBusinessMetric(category, key, value) {
    if (!this.metrics.business.has(category)) {
      this.metrics.business.set(category, {});
    }
    
    const categoryMetrics = this.metrics.business.get(category);
    categoryMetrics[key] = value;
    
    this.logger.debug('業務指標已記錄', {
      category,
      key,
      value,
      service: 'MonitoringService',
      timestamp: new Date().toISOString(),
      type: 'business'
    });
  }
  
  /**
   * 記錄性能指標
   */
  recordPerformanceMetric(type, value) {
    const performance = this.metrics.application.get('performance');
    
    switch (type) {
      case 'responseTime':
        performance.responseTime.push({
          value,
          timestamp: Date.now()
        });
        // 只保留最近100個記錄
        if (performance.responseTime.length > 100) {
          performance.responseTime.shift();
        }
        break;
        
      case 'throughput':
        performance.throughput = value;
        break;
        
      case 'errorRate':
        performance.errorRate = value;
        break;
        
      case 'activeConnections':
        performance.activeConnections = value;
        break;
    }
  }
  
  /**
   * 記錄錯誤
   */
  recordError(type, error) {
    const errorRecord = {
      type,
      message: error.message || error,
      stack: error.stack,
      timestamp: Date.now()
    };
    
    this.metrics.errors.push(errorRecord);
    
    // 只保留最近1000個錯誤
    if (this.metrics.errors.length > 1000) {
      this.metrics.errors.shift();
    }
    
    this.logger.error('錯誤已記錄', {
      type,
      message: errorRecord.message,
      service: 'MonitoringService',
      timestamp: new Date().toISOString(),
      type: 'business'
    });
    
    // 檢查是否需要觸發警報
    this.checkErrorAlert(errorRecord);
  }
  
  /**
   * 檢查警報條件
   */
  checkAlerts() {
    const thresholds = this.options.alertThresholds;
    
    // CPU 使用率警報
    const cpuUsage = this.metrics.system.get('cpu').usage;
    if (cpuUsage > thresholds.cpuUsage) {
      this.triggerAlert({
        type: 'high_cpu_usage',
        level: 'warning',
        message: `CPU 使用率過高: ${cpuUsage}%`,
        value: cpuUsage,
        threshold: thresholds.cpuUsage
      });
    }
    
    // 記憶體使用率警報
    const memUsage = this.metrics.system.get('memory').usage;
    if (memUsage > thresholds.memoryUsage) {
      this.triggerAlert({
        type: 'high_memory_usage',
        level: 'warning',
        message: `記憶體使用率過高: ${memUsage}%`,
        value: memUsage,
        threshold: thresholds.memoryUsage
      });
    }
    
    // 錯誤率警報
    const errorRate = this.metrics.application.get('performance').errorRate;
    if (errorRate > thresholds.errorRate) {
      this.triggerAlert({
        type: 'high_error_rate',
        level: 'critical',
        message: `錯誤率過高: ${errorRate}%`,
        value: errorRate,
        threshold: thresholds.errorRate
      });
    }
  }
  
  /**
   * 檢查錯誤警報
   */
  checkErrorAlert(errorRecord) {
    // 檢查最近5分鐘的錯誤數量
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const recentErrors = this.metrics.errors.filter(
      error => error.timestamp > fiveMinutesAgo
    );
    
    if (recentErrors.length > 10) {
      this.triggerAlert({
        type: 'error_spike',
        level: 'critical',
        message: `檢測到錯誤激增: ${recentErrors.length} 個錯誤在最近5分鐘`,
        value: recentErrors.length,
        threshold: 10
      });
    }
  }
  
  /**
   * 觸發警報
   */
  triggerAlert(alert) {
    alert.id = this.generateAlertId();
    alert.timestamp = Date.now();
    
    this.alerts.push(alert);
    
    // 只保留最近100個警報
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }
    
    this.logger.warn('警報已觸發', {
      alert: alert.message,
      level: alert.level,
      service: 'MonitoringService',
      timestamp: new Date().toISOString(),
      type: 'business'
    });
    
    // 發送警報事件
    this.emit('alert', alert);
  }
  
  /**
   * 生成警報ID
   */
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * 清理舊數據
   */
  cleanupOldData() {
    const cutoff = Date.now() - this.options.retentionPeriod;
    
    // 清理舊的響應時間數據
    const performance = this.metrics.application.get('performance');
    performance.responseTime = performance.responseTime.filter(
      record => record.timestamp > cutoff
    );
    
    // 清理舊的錯誤記錄
    this.metrics.errors = this.metrics.errors.filter(
      error => error.timestamp > cutoff
    );
    
    // 清理舊的警報
    this.alerts = this.alerts.filter(
      alert => alert.timestamp > cutoff
    );
  }
  
  /**
   * 獲取監控數據
   */
  getMetrics() {
    return {
      system: Object.fromEntries(this.metrics.system),
      application: Object.fromEntries(this.metrics.application),
      business: Object.fromEntries(this.metrics.business),
      errors: this.metrics.errors.length,
      alerts: this.alerts.length,
      isRunning: this.isRunning,
      timestamp: Date.now()
    };
  }
  
  /**
   * 獲取警報列表
   */
  getAlerts(limit = 50) {
    return this.alerts
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
  
  /**
   * 獲取錯誤列表
   */
  getErrors(limit = 50) {
    return this.metrics.errors
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
  
  /**
   * 獲取服務狀態
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      uptime: process.uptime(),
      collectionInterval: this.options.collectionInterval,
      metricsCount: {
        system: this.metrics.system.size,
        application: this.metrics.application.size,
        business: this.metrics.business.size,
        errors: this.metrics.errors.length,
        alerts: this.alerts.length
      },
      timestamp: Date.now()
    };
  }
  
  /**
   * 停止監控服務
   */
  async stop() {
    try {
      this.logger.info('監控服務停止開始', {
        service: 'MonitoringService',
        timestamp: new Date().toISOString(),
        type: 'business'
      });
      
      if (this.collectionTimer) {
        clearInterval(this.collectionTimer);
        this.collectionTimer = null;
      }
      
      this.isRunning = false;
      
      this.logger.info('監控服務停止完成', {
        service: 'MonitoringService',
        timestamp: new Date().toISOString(),
        type: 'business'
      });
      
      return true;
    } catch (error) {
      this.logger.error('監控服務停止失敗', {
        error: error.message,
        service: 'MonitoringService',
        timestamp: new Date().toISOString(),
        type: 'business'
      });
      throw error;
    }
  }

  /**
   * 關閉監控服務 (shutdown 別名)
   */
  async shutdown() {
    return await this.stop();
  }
}

module.exports = MonitoringService; 