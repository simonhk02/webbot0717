const { businessLogger } = require('../utils/logger');

/**
 * 服務容器
 * 管理應用程式中的服務實例和依賴注入
 */

class ServiceContainer {
  constructor() {
    this.services = new Map();
    this.singletons = new Map();
    this.isInitialized = false;
    this.logger = businessLogger;
    this.logger.info('服務容器已建立');
  }

  /**
   * 獲取單例實例
   */
  static getInstance() {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  /**
   * 註冊服務
   * @param {string} name - 服務名稱
   * @param {object|function} instance - 服務實例或工廠函數
   * @param {object} options - 註冊選項
   */
  register(name, instance, options = {}) {
    try {
      if (!name) {
        throw new Error('服務名稱不能為空');
      }
      if (!instance) {
        throw new Error('服務實例不能為空');
      }

      // 支援工廠函數模式
      if (typeof instance === 'function' && !options.singleton) {
        this.services.set(name, {
          factory: instance,
          options: options
        });
      } else {
        this.services.set(name, {
          instance: instance,
          options: options
        });
      }
      
      this.logger.info(`服務 ${name} 已註冊`);
    } catch (error) {
      this.logger.error(`註冊服務 ${name} 失敗:`, error);
      throw error;
    }
  }

  /**
   * 解析服務
   * @param {string} name - 服務名稱
   * @param {object} context - 上下文（用於租戶級服務）
   * @returns {object} - 服務實例
   */
  resolve(name, context = {}) {
    try {
      if (!name) {
        throw new Error('服務名稱不能為空');
      }

      const serviceEntry = this.services.get(name);
      if (!serviceEntry) {
        throw new Error(`找不到服務: ${name}`);
      }

      // 如果是工廠函數，需要創建實例
      if (serviceEntry.factory) {
        const tenantId = context.tenantId || 'default';
        return serviceEntry.factory(tenantId);
      }

      // 返回已存在的實例
      return serviceEntry.instance;
    } catch (error) {
      this.logger.error(`解析服務 ${name} 失敗:`, error);
      throw error;
    }
  }

  /**
   * 獲取服務（resolve方法的別名，保持向後兼容性）
   * @param {string} name - 服務名稱
   * @returns {object} - 服務實例
   */
  get(name) {
    return this.resolve(name);
  }

  /**
   * 檢查服務是否已註冊
   * @param {string} name - 服務名稱
   * @returns {boolean} - 是否已註冊
   */
  has(name) {
    try {
      if (!name) {
        throw new Error('服務名稱不能為空');
      }

      return this.services.has(name);
    } catch (error) {
      this.logger.error(`檢查服務 ${name} 失敗:`, error);
      throw error;
    }
  }

  /**
   * 移除服務
   * @param {string} name - 服務名稱
   */
  remove(name) {
    try {
      if (!name) {
        throw new Error('服務名稱不能為空');
      }

      if (!this.services.has(name)) {
        throw new Error(`找不到服務: ${name}`);
      }

      this.services.delete(name);
      this.logger.info(`服務 ${name} 已移除`);
    } catch (error) {
      this.logger.error(`移除服務 ${name} 失敗:`, error);
      throw error;
    }
  }

  /**
   * 清理所有服務
   */
  clear() {
    try {
      this.services.clear();
      this.logger.info('所有服務已清理');
    } catch (error) {
      this.logger.error('清理所有服務失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取所有已註冊的服務名稱
   * @returns {Array<string>} - 服務名稱列表
   */
  getServiceNames() {
    try {
      return Array.from(this.services.keys());
    } catch (error) {
      this.logger.error('獲取服務名稱列表失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取服務數量
   * @returns {number} - 服務數量
   */
  size() {
    try {
      return this.services.size;
    } catch (error) {
      this.logger.error('獲取服務數量失敗:', error);
      throw error;
    }
  }

  // 獲取服務的依賴關係
  getDependencyGraph() {
    const graph = {};
    for (const [name, service] of this.services.entries()) {
      graph[name] = service.dependencies;
    }
    return graph;
  }

  // 檢查循環依賴
  checkCircularDependencies() {
    const graph = this.getDependencyGraph();
    const visited = new Set();
    const recursionStack = new Set();

    const hasCycle = (node) => {
      if (recursionStack.has(node)) {
        return true;
      }
      if (visited.has(node)) {
        return false;
      }

      visited.add(node);
      recursionStack.add(node);

      const dependencies = graph[node] || [];
      for (const dep of dependencies) {
        if (hasCycle(dep)) {
          return true;
        }
      }

      recursionStack.delete(node);
      return false;
    };

    for (const node of Object.keys(graph)) {
      if (hasCycle(node)) {
        throw new Error(`檢測到循環依賴：${node}`);
      }
    }

    this.logger.info('依賴關係檢查通過，無循環依賴');
  }

  // 初始化所有服務
  async initialize() {
    if (this.isInitialized) {
      this.logger.warn('服務容器已初始化，跳過重複初始化');
      return;
    }

    try {
      // 檢查循環依賴
      this.checkCircularDependencies();

      // 獲取所有服務名稱
      const serviceNames = this.getServiceNames();
      this.logger.info(`開始初始化 ${serviceNames.length} 個服務`);

      // 初始化每個服務
      for (const name of serviceNames) {
        try {
          const service = this.resolve(name);
          if (service && typeof service.initialize === 'function') {
            await service.initialize();
            this.logger.info(`服務 ${name} 初始化完成`);
          }
        } catch (err) {
          this.logger.error(`服務 ${name} 初始化失敗: ${err.message}`);
          throw err;
        }
      }

      this.isInitialized = true;
      this.logger.info('所有服務初始化完成');
    } catch (err) {
      this.logger.error(`服務容器初始化失敗: ${err.message}`);
      throw err;
    }
  }

  // 清理所有服務
  async cleanup() {
    if (!this.isInitialized) {
      this.logger.warn('服務容器未初始化，跳過清理');
      return;
    }

    try {
      const serviceNames = this.getServiceNames();
      this.logger.info(`開始清理 ${serviceNames.length} 個服務`);

      // 反向清理服務（避免依賴問題）
      for (let i = serviceNames.length - 1; i >= 0; i--) {
        const name = serviceNames[i];
        try {
          const service = this.resolve(name);
          if (service && typeof service.cleanup === 'function') {
            await service.cleanup();
            this.logger.info(`服務 ${name} 清理完成`);
          }
        } catch (err) {
          this.logger.error(`服務 ${name} 清理失敗: ${err.message}`);
        }
      }

      this.isInitialized = false;
      this.logger.info('所有服務清理完成');
    } catch (err) {
      this.logger.error(`服務容器清理失敗: ${err.message}`);
      throw err;
    }
  }

  // 健康檢查
  async healthCheck() {
    const results = {};
    const serviceNames = this.getServiceNames();

    for (const name of serviceNames) {
      try {
        const service = this.resolve(name);
        if (service && typeof service.healthCheck === 'function') {
          results[name] = await service.healthCheck();
        } else {
          results[name] = {
            status: 'unknown',
            service: name,
            timestamp: new Date().toISOString(),
            details: { message: '服務無健康檢查方法' }
          };
        }
      } catch (err) {
        results[name] = {
          status: 'unhealthy',
          service: name,
          timestamp: new Date().toISOString(),
          error: err.message
        };
      }
    }

    return {
      status: 'healthy',
      service: 'ServiceContainer',
      timestamp: new Date().toISOString(),
      details: {
        isInitialized: this.isInitialized,
        totalServices: serviceNames.length,
        services: results
      }
    };
  }

  // 獲取服務狀態
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      totalServices: this.services.size,
      registeredServices: this.getServiceNames(),
      dependencyGraph: this.getDependencyGraph()
    };
  }

  /**
   * 熱重載服務
   * @param {string} serviceName - 服務名稱
   * @param {string} modulePath - 模組路徑（可選，自動推斷）
   */
  async reloadService(serviceName, modulePath = null) {
    try {
      this.logger.info(`開始熱重載服務: ${serviceName}`);
      
      // 獲取舊服務實例
      const oldService = this.services.get(serviceName);
      if (!oldService) {
        throw new Error(`找不到要重載的服務: ${serviceName}`);
      }

      // 清理舊服務（如果有清理方法）
      if (oldService && typeof oldService.cleanup === 'function') {
        this.logger.info(`清理舊服務實例: ${serviceName}`);
        await oldService.cleanup();
      }

      // 推斷模組路徑
      if (!modulePath) {
        modulePath = this._inferModulePath(serviceName);
      }

      // 清除 require cache
      this._clearRequireCache(modulePath);

      // 重新載入模組
      delete require.cache[require.resolve(modulePath)];
      const ServiceClass = require(modulePath);
      
      // 創建新服務實例
      let newService;
      if (typeof ServiceClass === 'function') {
        // 如果是類，創建實例
        newService = new ServiceClass(this);
      } else {
        // 如果是對象，直接使用
        newService = ServiceClass;
      }

      // 初始化新服務（如果有初始化方法）
      if (newService && typeof newService.initialize === 'function') {
        this.logger.info(`初始化新服務實例: ${serviceName}`);
        await newService.initialize();
      }

      // 註冊新服務
      this.services.set(serviceName, newService);
      
      this.logger.info(`服務 ${serviceName} 熱重載完成`);
      return true;
    } catch (error) {
      this.logger.error(`熱重載服務 ${serviceName} 失敗:`, error);
      throw error;
    }
  }

  /**
   * 推斷服務模組路徑
   * @param {string} serviceName - 服務名稱
   * @returns {string} - 模組路徑
   */
  _inferModulePath(serviceName) {
    const commonPaths = [
      `../services/${serviceName}`,
      `../services/${serviceName}.js`,
      `../controllers/${serviceName}`,
      `../controllers/${serviceName}.js`,
      `../repositories/${serviceName}`,
      `../repositories/${serviceName}.js`
    ];

    for (const path of commonPaths) {
      try {
        require.resolve(path);
        return path;
      } catch (e) {
        // 繼續嘗試下一個路徑
      }
    }

    // 如果都找不到，拋出錯誤
    throw new Error(`無法推斷服務 ${serviceName} 的模組路徑`);
  }

  /**
   * 清除 require cache 及其依賴
   * @param {string} modulePath - 模組路徑
   */
  _clearRequireCache(modulePath) {
    try {
      const resolvedPath = require.resolve(modulePath);
      
      // 遞歸清除依賴的模組
      const clearDependencies = (path) => {
        const module = require.cache[path];
        if (module) {
          // 清除子依賴
          if (module.children) {
            module.children.forEach(child => {
              // 只清除項目內的模組，不清除 node_modules
              if (!child.filename.includes('node_modules')) {
                clearDependencies(child.filename);
              }
            });
          }
          // 清除當前模組
          delete require.cache[path];
        }
      };

      clearDependencies(resolvedPath);
      this.logger.info(`已清除模組 ${modulePath} 的 require cache`);
    } catch (error) {
      this.logger.warn(`清除 require cache 失敗: ${error.message}`);
    }
  }

  /**
   * 批量重載服務
   * @param {Array<string>} serviceNames - 服務名稱列表
   */
  async reloadServices(serviceNames) {
    const results = [];
    for (const serviceName of serviceNames) {
      try {
        await this.reloadService(serviceName);
        results.push({ serviceName, success: true });
      } catch (error) {
        results.push({ serviceName, success: false, error: error.message });
      }
    }
    return results;
  }
}

module.exports = ServiceContainer; 