/**
 * 工作流服務容器
 * 管理新系統的服務和適配器
 * 確保與現有系統的完全隔離
 */

const { businessLogger } = require('../../utils/logger');
const { createServiceAdapter } = require('./ServiceAdapter');
const config = require('../config');

class WorkflowServiceContainer {
  constructor() {
    this.services = new Map();
    this.adapters = new Map();
    this.logger = businessLogger;
    this.isInitialized = false;
  }

  /**
   * 獲取單例實例
   */
  static getInstance() {
    if (!WorkflowServiceContainer.instance) {
      WorkflowServiceContainer.instance = new WorkflowServiceContainer();
    }
    return WorkflowServiceContainer.instance;
  }

  /**
   * 初始化服務容器
   */
  async initialize() {
    if (this.isInitialized) {
      this.logger.warn('工作流服務容器已初始化，跳過重複初始化');
      return;
    }

    try {
      this.logger.info('開始初始化工作流服務容器...');

      // 初始化適配器層
      await this.initializeAdapters();

      // 初始化工作流專用服務
      await this.initializeWorkflowServices();

      this.isInitialized = true;
      this.logger.info('工作流服務容器初始化完成');
    } catch (error) {
      this.logger.error('工作流服務容器初始化失敗:', error);
      throw error;
    }
  }

  /**
   * 初始化適配器層
   */
  async initializeAdapters() {
    try {
      this.logger.info('初始化服務適配器層...');

      // 創建現有服務的適配器（只讀訪問）
      const existingServices = await this.getExistingServices();
      
      for (const [serviceName, service] of Object.entries(existingServices)) {
        const adapter = createServiceAdapter(serviceName, service);
        this.adapters.set(serviceName, adapter);
        this.logger.info(`創建適配器: ${serviceName}`);
      }

      this.logger.info('服務適配器層初始化完成');
    } catch (error) {
      this.logger.error('服務適配器層初始化失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取現有服務（通過適配器）
   */
  async getExistingServices() {
    try {
      // 動態載入現有服務
      const existingServices = {};

      // 基礎服務
      try {
        const DatabaseService = require('../../services/databaseService');
        const databaseService = new DatabaseService();
        await databaseService.initialize();
        existingServices.databaseService = databaseService;
      } catch (e) {
        this.logger.warn('無法載入 databaseService:', e.message);
      }

      try {
        existingServices.websocketService = require('../../services/websocketService');
      } catch (e) {
        this.logger.warn('無法載入 websocketService:', e.message);
      }

      try {
        existingServices.LoggingService = require('../../services/LoggingService');
      } catch (e) {
        this.logger.warn('無法載入 LoggingService:', e.message);
      }

      // V2服務
      try {
        const v2Services = require('../../services/v2');
        existingServices.AIServiceV2 = v2Services.AIServiceV2;
        existingServices.UserServiceV2 = v2Services.UserServiceV2;
        existingServices.WhatsAppServiceV2 = v2Services.WhatsAppServiceV2;
      } catch (e) {
        this.logger.warn('無法載入 V2服務:', e.message);
      }

      return existingServices;
    } catch (error) {
      this.logger.error('獲取現有服務失敗:', error);
      return {};
    }
  }

  /**
   * 初始化工作流專用服務
   */
  async initializeWorkflowServices() {
    try {
      this.logger.info('初始化工作流專用服務...');

      // 工作流引擎
      const WorkflowEngine = require('../services/WorkflowEngine');
      const workflowEngine = new WorkflowEngine(this);
      this.services.set('workflowEngine', workflowEngine);

      // 機械人管理器
      const BotManagerService = require('../services/BotManagerService');
      const botManager = new BotManagerService(this);
      this.services.set('botManager', botManager);

      // 工作流設計器
      const WorkflowDesignerService = require('../services/WorkflowDesignerService');
      const workflowDesigner = new WorkflowDesignerService(this);
      this.services.set('workflowDesigner', workflowDesigner);

      // 觸發器系統 - 階段4新增
      const TriggerSystem = require('../services/TriggerSystem');
      const triggerSystem = new TriggerSystem(this);
      await triggerSystem.initialize();
      this.services.set('triggerSystem', triggerSystem);

      this.logger.info('工作流專用服務初始化完成');
    } catch (error) {
      this.logger.error('工作流專用服務初始化失敗:', error);
      throw error;
    }
  }

  /**
   * 註冊服務
   * @param {string} name - 服務名稱
   * @param {Object} service - 服務實例
   */
  register(name, service) {
    try {
      if (!name || !service) {
        throw new Error('服務名稱和實例不能為空');
      }

      this.services.set(name, service);
      this.logger.info(`註冊工作流服務: ${name}`);
    } catch (error) {
      this.logger.error(`註冊服務 ${name} 失敗:`, error);
      throw error;
    }
  }

  /**
   * 解析服務
   * @param {string} name - 服務名稱
   * @returns {Object} - 服務實例
   */
  resolve(name) {
    try {
      // 優先查找工作流專用服務
      if (this.services.has(name)) {
        return this.services.get(name);
      }

      // 查找適配器
      if (this.adapters.has(name)) {
        return this.adapters.get(name);
      }

      throw new Error(`找不到服務: ${name}`);
    } catch (error) {
      this.logger.error(`解析服務 ${name} 失敗:`, error);
      throw error;
    }
  }

  /**
   * 獲取服務 (與resolve方法等價，保持API一致性)
   * @param {string} name - 服務名稱
   * @returns {Object} - 服務實例
   */
  getService(name) {
    return this.resolve(name);
  }

  /**
   * 獲取適配器
   * @param {string} serviceName - 服務名稱
   * @returns {ServiceAdapter} - 服務適配器
   */
  getAdapter(serviceName) {
    const adapter = this.adapters.get(serviceName);
    if (!adapter) {
      throw new Error(`找不到適配器: ${serviceName}`);
    }
    return adapter;
  }

  /**
   * 健康檢查
   * @returns {Object} - 健康狀態
   */
  async healthCheck() {
    try {
      const status = {
        status: 'healthy',
        container: 'WorkflowServiceContainer',
        timestamp: new Date().toISOString(),
        services: {},
        adapters: {}
      };

      // 檢查工作流服務
      for (const [name, service] of this.services.entries()) {
        try {
          if (service.healthCheck) {
            status.services[name] = await service.healthCheck();
          } else {
            status.services[name] = { status: 'healthy' };
          }
        } catch (error) {
          status.services[name] = { status: 'unhealthy', error: error.message };
          status.status = 'unhealthy';
        }
      }

      // 檢查適配器
      for (const [name, adapter] of this.adapters.entries()) {
        try {
          status.adapters[name] = await adapter.healthCheck();
        } catch (error) {
          status.adapters[name] = { status: 'unhealthy', error: error.message };
          status.status = 'unhealthy';
        }
      }

      return status;
    } catch (error) {
      this.logger.error('工作流服務容器健康檢查失敗:', error);
      return {
        status: 'unhealthy',
        container: 'WorkflowServiceContainer',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 清理資源
   */
  async cleanup() {
    try {
      this.logger.info('開始清理工作流服務容器...');

      // 清理工作流服務
      for (const [name, service] of this.services.entries()) {
        if (service.cleanup) {
          await service.cleanup();
        }
      }

      this.services.clear();
      this.adapters.clear();
      this.isInitialized = false;

      this.logger.info('工作流服務容器清理完成');
    } catch (error) {
      this.logger.error('工作流服務容器清理失敗:', error);
      throw error;
    }
  }
}

module.exports = WorkflowServiceContainer; 