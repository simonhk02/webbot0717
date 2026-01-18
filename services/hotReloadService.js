const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const { businessLogger } = require('../utils/logger');

/**
 * 熱重載服務
 * 管理所有模組的熱重載功能
 */
class HotReloadService {
  constructor(container) {
    this.container = container;
    this.logger = businessLogger;
    this.watchers = new Map();
    this.reloadQueue = new Set();
    this.isReloading = false;
    this.debounceTimer = null;
    this.config = {
      debounceTime: 1000, // 防抖時間
      watchPaths: [
        'services/**/*.js',
        'controllers/**/*.js',
        'repositories/**/*.js',
        'middleware/**/*.js',
        'utils/**/*.js',
        'routes/**/*.js'
      ],
      excludePaths: [
        'node_modules/**',
        'logs/**',
        'credentials/**',
        '**/*.test.js',
        '**/*.spec.js'
      ]
    };
  }

  /**
   * 初始化熱重載服務
   */
  async initialize() {
    try {
      this.logger.info('初始化熱重載服務...');
      
      // 啟動文件監控
      await this.startFileWatching();
      
      this.logger.info('熱重載服務初始化完成');
      return true;
    } catch (error) {
      this.logger.error(`熱重載服務初始化失敗: ${error.message}`);
      throw error;
    }
  }

  /**
   * 啟動文件監控
   */
  async startFileWatching() {
    try {
      const watcher = chokidar.watch(this.config.watchPaths, {
        ignored: this.config.excludePaths,
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 500,
          pollInterval: 100
        }
      });

      watcher.on('change', (filePath) => {
        this.onFileChanged(filePath);
      });

      watcher.on('add', (filePath) => {
        this.onFileAdded(filePath);
      });

      watcher.on('unlink', (filePath) => {
        this.onFileRemoved(filePath);
      });

      watcher.on('error', (error) => {
        this.logger.error(`文件監控錯誤: ${error.message}`);
      });

      this.watchers.set('main', watcher);
      this.logger.info('文件監控已啟動');
    } catch (error) {
      this.logger.error(`啟動文件監控失敗: ${error.message}`);
      throw error;
    }
  }

  /**
   * 文件變更處理
   */
  onFileChanged(filePath) {
    this.logger.info(`檢測到文件變更: ${filePath}`);
    this.scheduleReload(filePath, 'change');
  }

  /**
   * 文件新增處理
   */
  onFileAdded(filePath) {
    this.logger.info(`檢測到新文件: ${filePath}`);
    this.scheduleReload(filePath, 'add');
  }

  /**
   * 文件刪除處理
   */
  onFileRemoved(filePath) {
    this.logger.info(`檢測到文件刪除: ${filePath}`);
    this.scheduleReload(filePath, 'remove');
  }

  /**
   * 排程重載
   */
  scheduleReload(filePath, action) {
    const serviceName = this.getServiceNameFromPath(filePath);
    if (!serviceName) {
      this.logger.warn(`無法從路徑推斷服務名稱: ${filePath}`);
      return;
    }

    this.reloadQueue.add({ filePath, serviceName, action });

    // 防抖處理
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processReloadQueue();
    }, this.config.debounceTime);
  }

  /**
   * 處理重載隊列
   */
  async processReloadQueue() {
    if (this.isReloading || this.reloadQueue.size === 0) {
      return;
    }

    this.isReloading = true;
    const itemsToReload = Array.from(this.reloadQueue);
    this.reloadQueue.clear();

    try {
      this.logger.info(`開始處理 ${itemsToReload.length} 個重載任務`);

      for (const item of itemsToReload) {
        await this.reloadItem(item);
      }

      this.logger.info('重載隊列處理完成');
    } catch (error) {
      this.logger.error(`處理重載隊列失敗: ${error.message}`);
    } finally {
      this.isReloading = false;
    }
  }

  /**
   * 重載單個項目
   */
  async reloadItem(item) {
    const { filePath, serviceName, action } = item;

    try {
      if (action === 'remove') {
        // 文件被刪除，移除對應服務
        if (this.container.has(serviceName)) {
          this.container.remove(serviceName);
          this.logger.info(`已移除服務: ${serviceName}`);
        }
        return;
      }

      // 文件變更或新增，重載服務
      if (this.container.has(serviceName)) {
        await this.container.reloadService(serviceName, filePath);
        this.logger.info(`服務重載成功: ${serviceName}`);
      } else {
        // 如果是新服務，嘗試自動註冊
        await this.autoRegisterService(serviceName, filePath);
      }
    } catch (error) {
      this.logger.error(`重載項目失敗 (${serviceName}): ${error.message}`);
    }
  }

  /**
   * 自動註冊新服務
   */
  async autoRegisterService(serviceName, filePath) {
    try {
      const ServiceClass = require(path.resolve(filePath));
      let serviceInstance;

      if (typeof ServiceClass === 'function') {
        serviceInstance = new ServiceClass(this.container);
      } else {
        serviceInstance = ServiceClass;
      }

      if (serviceInstance && typeof serviceInstance.initialize === 'function') {
        await serviceInstance.initialize();
      }

      this.container.register(serviceName, serviceInstance);
      this.logger.info(`自動註冊新服務: ${serviceName}`);
    } catch (error) {
      this.logger.error(`自動註冊服務失敗 (${serviceName}): ${error.message}`);
    }
  }

  /**
   * 從文件路徑推斷服務名稱
   */
  getServiceNameFromPath(filePath) {
    const normalizedPath = path.normalize(filePath);
    const parts = normalizedPath.split(path.sep);
    const fileName = parts[parts.length - 1];
    
    // 移除 .js 擴展名
    const serviceName = fileName.replace(/\.js$/, '');
    
    // 特殊處理某些命名模式
    if (serviceName.endsWith('Service')) {
      return serviceName;
    }
    if (serviceName.endsWith('Controller')) {
      return serviceName;
    }
    if (serviceName.endsWith('Repository')) {
      return serviceName;
    }
    
    return serviceName;
  }

  /**
   * 手動重載服務
   */
  async manualReload(serviceName) {
    try {
      if (!this.container.has(serviceName)) {
        throw new Error(`服務不存在: ${serviceName}`);
      }

      await this.container.reloadService(serviceName);
      this.logger.info(`手動重載服務成功: ${serviceName}`);
      return true;
    } catch (error) {
      this.logger.error(`手動重載服務失敗: ${error.message}`);
      throw error;
    }
  }

  /**
   * 獲取重載統計
   */
  getStats() {
    return {
      watchersCount: this.watchers.size,
      queueSize: this.reloadQueue.size,
      isReloading: this.isReloading,
      watchedPaths: this.config.watchPaths
    };
  }

  /**
   * 停止熱重載服務
   */
  async stop() {
    try {
      for (const [name, watcher] of this.watchers) {
        await watcher.close();
        this.logger.info(`已停止文件監控: ${name}`);
      }
      this.watchers.clear();
      
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      
      this.logger.info('熱重載服務已停止');
    } catch (error) {
      this.logger.error(`停止熱重載服務失敗: ${error.message}`);
    }
  }

  /**
   * 清理資源
   */
  async cleanup() {
    await this.stop();
  }
}

module.exports = HotReloadService; 