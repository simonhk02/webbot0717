const { businessLogger } = require('../utils/logger');

/**
 * 服務引導器
 * 統一管理服務的註冊、初始化和依賴注入
 */
class ServiceBootstrap {
  constructor(container) {
    this.container = container;
    this.logger = businessLogger;
    this.isBootstrapped = false;
    this.config = require('../config');
    this.featureFlags = this.config.featureFlags;
    this.logger.info('服務引導器已建立');
  }

  /**
   * 註冊所有核心服務
   */
  registerCoreServices() {
    try {
      this.logger.info('開始註冊核心服務...');

      // 註冊配置服務
      this.container.register('config', this.config);

      // 註冊日誌服務
      this.container.register('logger', businessLogger);

      // 註冊狀態管理器
      const stateManager = require('./StateManager');
      this.container.register('stateManager', stateManager);

      // 註冊事件總線
      const eventBus = require('./EventBus');
      this.container.register('eventBus', eventBus);

      this.logger.info('核心服務註冊完成');
    } catch (error) {
      this.logger.error(`註冊核心服務失敗: ${error.message}`);
      throw error;
    }
  }

  /**
   * 註冊數據服務
   */
  registerDataServices() {
    try {
      this.logger.info('開始註冊數據服務...');

      // 註冊資料庫服務
      const DatabaseService = require('../services/databaseService');
      const databaseService = new DatabaseService();
      this.container.register('databaseService', databaseService);

      // 註冊 Redis 服務
      const { getRedisInstance } = require('../services/redisService');
      this.container.register('redisService', getRedisInstance());

      this.logger.info('數據服務註冊完成');
    } catch (error) {
      this.logger.error(`註冊數據服務失敗: ${error.message}`);
      throw error;
    }
  }

  /**
   * 註冊業務服務 (支援功能開關)
   */
  registerBusinessServices() {
    try {
      this.logger.info('開始註冊業務服務...');

      // 根據功能開關決定使用哪個版本的服務
      if (this.featureFlags.USE_V2_SERVICES && this.featureFlags.USE_ADAPTER_LAYER) {
        this.logger.info('使用V2服務架構 (適配器模式)');
        this.registerV2ServicesWithAdapters();
      } else {
        this.logger.info('使用V1服務架構 (傳統模式)');
        this.registerV1Services();
      }

      this.logger.info('業務服務註冊完成');
    } catch (error) {
      this.logger.error(`註冊業務服務失敗: ${error.message}`);
      throw error;
    }
  }

  /**
   * 註冊V1服務 (傳統模式)
   */
  registerV1Services() {
    // 註冊用戶服務
    const UserService = require('../services/userService');
    const userService = new UserService();
    this.container.register('userService', userService);

    // 註冊 AI 服務
    const AIService = require('../services/aiService');
    const aiService = new AIService();
    this.container.register('aiService', aiService);

    // 註冊佇列服務
    const queueService = require('../services/QueueService');
    this.container.register('queueService', queueService);

    // 註冊圖片處理服務
    const imageProcessingService = require('../services/ImageProcessingService');
    this.container.register('imageProcessingService', imageProcessingService);

    // 註冊費用對話服務
    const expenseChatService = require('../services/ExpenseChatService');
    this.container.register('expenseChatService', expenseChatService);

    // 註冊 WhatsApp 服務
    const whatsAppService = require('../services/WhatsAppService');
    this.container.register('whatsAppService', whatsAppService);

    // 註冊 WebSocket 服務
    const WebSocketService = require('../services/websocketService');
    const websocketService = new WebSocketService();
    this.container.register('websocketService', websocketService);
  }

  /**
   * 註冊V2服務 (適配器模式)
   */
  registerV2ServicesWithAdapters() {
    try {
      // 先註冊V1服務，確保適配器有V1、V2可用
      this.logger.info('先註冊V1服務作為適配器基礎...');
      this.registerV1Services();

      // 註冊V2服務
      if (this.featureFlags.USE_V2_USER_SERVICE) {
        const UserServiceV2 = require('../services/v2/UserServiceV2');
        const userServiceV2 = new UserServiceV2();
        this.container.register('userServiceV2', userServiceV2);
        this.logger.info('V2用戶服務已註冊');
      }

      if (this.featureFlags.USE_V2_AI_SERVICE) {
        const AIServiceV2 = require('../services/v2/AIServiceV2');
        const aiServiceV2 = new AIServiceV2();
        this.container.register('aiServiceV2', aiServiceV2);
        this.logger.info('V2 AI服務已註冊');
      }

      if (this.featureFlags.USE_V2_WHATSAPP_SERVICE) {
        const WhatsAppServiceV2 = require('../services/v2/WhatsAppServiceV2');
        const whatsAppServiceV2 = new WhatsAppServiceV2();
        this.container.register('whatsAppServiceV2', whatsAppServiceV2);
        this.logger.info('V2 WhatsApp服務已註冊');
      }

      // 註冊適配器
      this.logger.info('開始註冊適配器...');
      const UserServiceAdapter = require('./adapters/UserServiceAdapter');
      const AIServiceAdapter = require('./adapters/AIServiceAdapter');
      const WhatsAppServiceAdapter = require('./adapters/WhatsAppServiceAdapter');

      // 創建適配器實例
      const userServiceAdapter = new UserServiceAdapter(
        this.container.get('userService'),
        this.container.get('userServiceV2'),
        this.featureFlags
      );

      const aiServiceAdapter = new AIServiceAdapter(
        this.container.get('aiService'),
        this.container.get('aiServiceV2'),
        this.featureFlags
      );

      const whatsAppServiceAdapter = new WhatsAppServiceAdapter(
        this.container.get('whatsAppService'),
        this.container.get('whatsAppServiceV2'),
        this.featureFlags
      );

      // 註冊適配器
      this.container.register('userServiceAdapter', userServiceAdapter);
      this.container.register('aiServiceAdapter', aiServiceAdapter);
      this.container.register('whatsAppServiceAdapter', whatsAppServiceAdapter);

      this.logger.info('V2服務和適配器註冊完成');
    } catch (error) {
      this.logger.error(`註冊V2服務失敗: ${error.message}`);
      // 回退到V1服務
      this.logger.warn('回退到V1服務架構');
      this.registerV1Services();
    }
  }

  /**
   * 註冊控制器
   */
  registerControllers() {
    try {
      this.logger.info('開始註冊控制器...');

      // 註冊用戶控制器
      const UserController = require('../controllers/UserController');
      const userController = new UserController(this.container);
      this.container.register('userController', userController);

      this.logger.info('控制器註冊完成');
    } catch (error) {
      this.logger.error(`註冊控制器失敗: ${error.message}`);
      throw error;
    }
  }

  /**
   * 註冊插件服務 (支援功能開關)
   */
  registerPluginServices() {
    try {
      this.logger.info('開始註冊插件服務...');

      // 註冊插件載入器
      const pluginLoader = require('../services/pluginLoader');
      this.container.register('pluginLoader', pluginLoader);

      // 根據功能開關決定是否註冊熱重載服務
      if (this.featureFlags.USE_HOT_RELOAD) {
        const HotReloadService = require('../services/hotReloadService');
        const hotReloadService = new HotReloadService(this.container);
        this.container.register('hotReloadService', hotReloadService);
        this.logger.info('熱重載服務已註冊');
      } else {
        this.logger.info('熱重載服務已禁用');
      }

      // 根據功能開關決定是否註冊監控服務
      if (this.featureFlags.USE_MONITORING_SYSTEM) {
        const MonitoringService = require('../services/MonitoringService');
        const monitoringService = new MonitoringService();
        this.container.register('monitoringService', monitoringService);
        this.logger.info('監控服務已註冊');
      } else {
        this.logger.info('監控服務已禁用');
      }

      this.logger.info('插件服務註冊完成');
    } catch (error) {
      this.logger.error(`註冊插件服務失敗: ${error.message}`);
      throw error;
    }
  }

  /**
   * 執行完整的服務引導過程
   */
  async bootstrap() {
    if (this.isBootstrapped) {
      this.logger.warn('服務已引導，跳過重複引導');
      return;
    }

    try {
      this.logger.info('開始服務引導過程...');
      this.logger.info(`功能開關狀態: V2服務=${this.featureFlags.USE_V2_SERVICES}, 適配器=${this.featureFlags.USE_ADAPTER_LAYER}`);

      // 1. 註冊所有服務
      this.registerCoreServices();
      this.registerDataServices();
      this.registerBusinessServices();
      this.registerControllers();
      this.registerPluginServices();

      this.isBootstrapped = true;
      this.logger.info('服務引導過程完成');

    } catch (error) {
      this.logger.error(`服務引導失敗: ${error.message}`);
      throw error;
    }
  }
}

module.exports = ServiceBootstrap; 