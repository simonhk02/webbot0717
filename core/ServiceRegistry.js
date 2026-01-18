const { businessLogger } = require('../utils/logger');
const serviceContainer = require('./ServiceContainer');

class ServiceRegistry {
  constructor() {
    this.isRegistered = false;
    businessLogger.info('服務註冊器已初始化');
  }

  // 註冊所有核心服務
  registerAllServices() {
    if (this.isRegistered) {
      businessLogger.warn('服務已註冊，跳過重複註冊');
      return;
    }

    try {
      // 註冊核心服務（無依賴）
      this.registerCoreServices();
      
      // 註冊業務服務（有依賴）
      this.registerBusinessServices();
      
      // 註冊外部服務（有依賴）
      this.registerExternalServices();

      this.isRegistered = true;
      businessLogger.info('所有服務註冊完成');
    } catch (err) {
      businessLogger.error(`服務註冊失敗: ${err.message}`);
      throw err;
    }
  }

  // 註冊核心服務（無依賴）
  registerCoreServices() {
    // 租戶狀態管理器註冊表
    serviceContainer.register('tenantStateManagerRegistry', () => {
      return require('./TenantStateManagerRegistry').tenantStateManagerRegistry;
    }, { singleton: true });

    // 狀態管理器（工廠函數，每租戶一個實例）
    serviceContainer.register('stateManager', (tenantId) => {
      const { tenantStateManagerRegistry } = require('./TenantStateManagerRegistry');
      return tenantStateManagerRegistry.getManager(tenantId);
    });

    // 事件總線
    serviceContainer.register('eventBus', () => {
      return require('../core/EventBus');
    }, { singleton: true });

    // 事件處理器
    serviceContainer.register('eventHandlers', () => {
      return require('../core/EventHandlers');
    }, { singleton: true });

    // 配置服務
    serviceContainer.register('config', () => {
      return require('../config');
    }, { singleton: true });

    // Redis 服務
    serviceContainer.register('redisService', () => {
      return require('../services/redisService');
    }, { singleton: true });

    businessLogger.info('核心服務註冊完成');
  }

  // 註冊業務服務（有依賴）
  registerBusinessServices() {
    // 資料庫服務
    serviceContainer.register('databaseService', () => {
      return require('../services/databaseService');
    }, { 
      singleton: true,
      dependencies: ['config']
    });

    // 佇列服務
    serviceContainer.register('queueService', () => {
      return require('../services/QueueService');
    }, { 
      singleton: true,
      dependencies: ['config']
    });

    // 圖片處理服務
    serviceContainer.register('imageProcessingService', () => {
      return require('../services/ImageProcessingService');
    }, { 
      singleton: true,
      dependencies: ['config', 'stateManager', 'eventBus']
    });

    // 費用對話服務
    serviceContainer.register('expenseChatService', () => {
      return require('../services/ExpenseChatService');
    }, { 
      singleton: true,
      dependencies: ['config', 'stateManager', 'eventBus']
    });

    // AI 服務
    serviceContainer.register('aiService', () => {
      return require('../services/aiService');
    }, { 
      singleton: true,
      dependencies: ['config']
    });

    // 用戶服務
    serviceContainer.register('userService', () => {
      return require('../services/userService');
    }, { 
      singleton: true,
      dependencies: ['config']
    });

    // 插件載入器
    serviceContainer.register('pluginLoader', () => {
      return require('../services/pluginLoader');
    }, { 
      singleton: true,
      dependencies: ['config']
    });

    businessLogger.info('業務服務註冊完成');
  }

  // 註冊外部服務（有依賴）
  registerExternalServices() {
    // WhatsApp 服務（依賴多個服務）
    serviceContainer.register('whatsAppService', () => {
      return require('../services/WhatsAppService');
    }, { 
      singleton: true,
      dependencies: [
        'config', 
        'stateManager', 
        'eventBus', 
        'imageProcessingService', 
        'expenseChatService'
      ]
    });

    businessLogger.info('外部服務註冊完成');
  }

  // 獲取服務
  getService(name) {
    return serviceContainer.resolve(name);
  }

  // 檢查服務是否存在
  hasService(name) {
    return serviceContainer.has(name);
  }

  // 獲取所有已註冊的服務
  getAllServices() {
    return serviceContainer.getRegisteredServices();
  }

  // 獲取依賴關係圖
  getDependencyGraph() {
    return serviceContainer.getDependencyGraph();
  }

  // 初始化所有服務
  async initialize() {
    if (!this.isRegistered) {
      this.registerAllServices();
    }
    await serviceContainer.initialize();
  }

  // 清理所有服務
  async cleanup() {
    await serviceContainer.cleanup();
  }

  // 健康檢查
  async healthCheck() {
    return await serviceContainer.healthCheck();
  }

  // 獲取狀態
  getStatus() {
    return {
      isRegistered: this.isRegistered,
      containerStatus: serviceContainer.getStatus()
    };
  }
}

// 建立單例實例
const serviceRegistry = new ServiceRegistry();

module.exports = serviceRegistry; 