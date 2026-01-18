/**
 * 租戶級別的服務容器
 * 實現服務實例的完全隔離
 */

const { AsyncLocalStorage } = require('async_hooks');
const { businessLogger } = require('../../utils/logger');
const { TenantContext } = require('./TenantContext');
const TenantAwareRepository = require('./TenantAwareRepository');

// 使用 AsyncLocalStorage 實現真正的上下文隔離
const tenantContextStorage = new AsyncLocalStorage();

class TenantServiceContainer {
  constructor() {
    this.logger = businessLogger;
    this.tenantContainers = new Map(); // tenantId -> container
    this.globalServices = new Map(); // 全局共享服務
  }

  /**
   * 獲取當前租戶上下文
   * @returns {Object|null} 當前租戶上下文
   */
  getCurrentTenantContext() {
    return tenantContextStorage.getStore() || null;
  }

  /**
   * 在租戶上下文中執行操作
   * @param {Object} context - 租戶上下文
   * @param {Function} operation - 操作函數
   * @returns {Promise<any>} 操作結果
   */
  async executeInContext(context, operation) {
    return tenantContextStorage.run(context, operation);
  }

  /**
   * 初始化租戶容器
   * @param {string} tenantId - 租戶ID
   * @param {Object} config - 租戶配置
   * @returns {Promise<void>}
   */
  async initializeTenant(tenantId, config = {}) {
    try {
      this.logger.info('初始化租戶容器', { tenantId, config });

      if (this.tenantContainers.has(tenantId)) {
        this.logger.warn('租戶容器已存在，跳過重複初始化', { tenantId });
        return;
      }

      // 創建租戶上下文
      const tenantContext = TenantContext.create(tenantId, 'system', ['admin'], {
        service: 'TenantServiceContainer',
        initializedAt: new Date().toISOString()
      });

      // 創建租戶容器
      const container = {
        tenantId,
        context: tenantContext,
        services: new Map(),
        repositories: new Map(),
        config: config,
        createdAt: new Date().toISOString()
      };

      // 初始化租戶感知的 Repository
      await this.initializeRepositories(container);

      // 初始化租戶服務
      await this.initializeServices(container);

      this.tenantContainers.set(tenantId, container);

      this.logger.info('租戶容器初始化完成', { 
        tenantId, 
        serviceCount: container.services.size,
        repositoryCount: container.repositories.size
      });
    } catch (error) {
      this.logger.error('租戶容器初始化失敗', { 
        tenantId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * 初始化租戶 Repository
   * @param {Object} container - 租戶容器
   * @returns {Promise<void>}
   */
  async initializeRepositories(container) {
    try {
      // 獲取全局數據庫服務
      const database = this.globalServices.get('database');
      if (!database) {
        throw new Error('全局數據庫服務未找到');
      }

      // 創建租戶感知的 Repository
      const userRepository = new TenantAwareRepository(database, container.context);
      const aiRepository = new TenantAwareRepository(database, container.context);
      const whatsappRepository = new TenantAwareRepository(database, container.context);

      container.repositories.set('user', userRepository);
      container.repositories.set('ai', aiRepository);
      container.repositories.set('whatsapp', whatsappRepository);

      this.logger.info('租戶 Repository 初始化完成', { 
        tenantId: container.tenantId,
        repositories: Array.from(container.repositories.keys())
      });
    } catch (error) {
      this.logger.error('租戶 Repository 初始化失敗', { 
        tenantId: container.tenantId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * 初始化租戶服務
   * @param {Object} container - 租戶容器
   * @returns {Promise<void>}
   */
  async initializeServices(container) {
    try {
      // 創建租戶級別的服務實例
      const { UserServiceV2 } = require('../../services/v2/UserServiceV2');
      const { AIServiceV2 } = require('../../services/v2/AIServiceV2');
      const { WhatsAppServiceV2 } = require('../../services/v2/WhatsAppServiceV2');

      // 用戶服務
      const userService = new UserServiceV2();
      await userService.initialize(container.tenantId);
      container.services.set('user', userService);

      // AI服務
      const aiService = new AIServiceV2();
      await aiService.initialize(container.tenantId);
      container.services.set('ai', aiService);

      // WhatsApp服務
      const whatsappService = new WhatsAppServiceV2();
      await whatsappService.initialize(container.tenantId);
      container.services.set('whatsapp', whatsappService);

      this.logger.info('租戶服務初始化完成', { 
        tenantId: container.tenantId,
        services: Array.from(container.services.keys())
      });
    } catch (error) {
      this.logger.error('租戶服務初始化失敗', { 
        tenantId: container.tenantId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * 獲取租戶服務
   * @param {string} tenantId - 租戶ID
   * @param {string} serviceName - 服務名稱
   * @returns {Object} 服務實例
   */
  getTenantService(tenantId, serviceName) {
    try {
      const container = this.tenantContainers.get(tenantId);
      if (!container) {
        throw new Error(`租戶 ${tenantId} 未初始化`);
      }

      const service = container.services.get(serviceName);
      if (!service) {
        throw new Error(`服務 ${serviceName} 在租戶 ${tenantId} 中未找到`);
      }

      return service;
    } catch (error) {
      this.logger.error('獲取租戶服務失敗', { 
        tenantId, 
        serviceName, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * 獲取租戶 Repository
   * @param {string} tenantId - 租戶ID
   * @param {string} repositoryName - Repository名稱
   * @returns {Object} Repository實例
   */
  getTenantRepository(tenantId, repositoryName) {
    try {
      const container = this.tenantContainers.get(tenantId);
      if (!container) {
        throw new Error(`租戶 ${tenantId} 未初始化`);
      }

      const repository = container.repositories.get(repositoryName);
      if (!repository) {
        throw new Error(`Repository ${repositoryName} 在租戶 ${tenantId} 中未找到`);
      }

      return repository;
    } catch (error) {
      this.logger.error('獲取租戶 Repository 失敗', { 
        tenantId, 
        repositoryName, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * 獲取租戶上下文
   * @param {string} tenantId - 租戶ID
   * @returns {Object} 租戶上下文
   */
  getTenantContext(tenantId) {
    try {
      const container = this.tenantContainers.get(tenantId);
      if (!container) {
        throw new Error(`租戶 ${tenantId} 未初始化`);
      }

      return container.context;
    } catch (error) {
      this.logger.error('獲取租戶上下文失敗', { 
        tenantId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * 註冊全局服務
   * @param {string} name - 服務名稱
   * @param {Object} service - 服務實例
   */
  registerGlobalService(name, service) {
    try {
      this.globalServices.set(name, service);
      this.logger.info('全局服務註冊成功', { name });
    } catch (error) {
      this.logger.error('全局服務註冊失敗', { 
        name, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * 獲取全局服務
   * @param {string} name - 服務名稱
   * @returns {Object} 服務實例
   */
  getGlobalService(name) {
    try {
      const service = this.globalServices.get(name);
      if (!service) {
        throw new Error(`全局服務 ${name} 未找到`);
      }

      return service;
    } catch (error) {
      this.logger.error('獲取全局服務失敗', { 
        name, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * 執行租戶操作
   * @param {string} tenantId - 租戶ID
   * @param {Function} operation - 操作函數
   * @returns {Promise<any>} 操作結果
   */
  async executeInTenant(tenantId, operation) {
    try {
      const container = this.tenantContainers.get(tenantId);
      if (!container) {
        throw new Error(`租戶 ${tenantId} 未初始化`);
      }

      // 使用 AsyncLocalStorage 實現真正的上下文隔離
      return await this.executeInContext(container.context, async () => {
        const result = await operation(container);
        return result;
      });
    } catch (error) {
      this.logger.error('租戶操作執行失敗', { 
        tenantId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * 清理租戶資源
   * @param {string} tenantId - 租戶ID
   * @returns {Promise<void>}
   */
  async cleanupTenant(tenantId) {
    try {
      this.logger.info('開始清理租戶資源', { tenantId });

      const container = this.tenantContainers.get(tenantId);
      if (!container) {
        this.logger.warn('租戶容器不存在，跳過清理', { tenantId });
        return;
      }

      // 清理服務資源
      for (const [serviceName, service] of container.services.entries()) {
        try {
          if (service.cleanup) {
            await service.cleanup(tenantId);
          }
        } catch (error) {
          this.logger.warn('清理服務資源失敗', { 
            tenantId, 
            serviceName, 
            error: error.message 
          });
        }
      }

      // 清理容器
      this.tenantContainers.delete(tenantId);

      this.logger.info('租戶資源清理完成', { tenantId });
    } catch (error) {
      this.logger.error('租戶資源清理失敗', { 
        tenantId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * 獲取所有租戶狀態
   * @returns {Array} 租戶狀態列表
   */
  getAllTenantStatus() {
    const status = [];

    for (const [tenantId, container] of this.tenantContainers.entries()) {
      status.push({
        tenantId,
        initialized: true,
        serviceCount: container.services.size,
        repositoryCount: container.repositories.size,
        createdAt: container.createdAt,
        config: container.config
      });
    }

    return status;
  }

  /**
   * 驗證租戶隔離
   * @param {string} tenantId1 - 租戶1
   * @param {string} tenantId2 - 租戶2
   * @returns {boolean} 是否隔離
   */
  validateTenantIsolation(tenantId1, tenantId2) {
    try {
      const container1 = this.tenantContainers.get(tenantId1);
      const container2 = this.tenantContainers.get(tenantId2);

      if (!container1 || !container2) {
        return false;
      }

      // 檢查服務實例是否不同
      for (const serviceName of ['user', 'ai', 'whatsapp']) {
        const service1 = container1.services.get(serviceName);
        const service2 = container2.services.get(serviceName);

        if (service1 === service2) {
          this.logger.warn('發現服務實例共享', { 
            tenantId1, 
            tenantId2, 
            serviceName 
          });
          return false;
        }
      }

      // 檢查 Repository 實例是否不同
      for (const repoName of ['user', 'ai', 'whatsapp']) {
        const repo1 = container1.repositories.get(repoName);
        const repo2 = container2.repositories.get(repoName);

        if (repo1 === repo2) {
          this.logger.warn('發現 Repository 實例共享', { 
            tenantId1, 
            tenantId2, 
            repoName 
          });
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.error('租戶隔離驗證失敗', { 
        tenantId1, 
        tenantId2, 
        error: error.message 
      });
      return false;
    }
  }
}

module.exports = TenantServiceContainer; 