/**
 * 觸發器系統 - 階段4核心服務
 * 負責處理各種觸發條件並執行相應工作流
 */

const { businessLogger } = require('../../utils/logger');
const path = require('path');
const fs = require('fs');

class TriggerSystem {
  constructor(container) {
    this.container = container;
    this.logger = businessLogger;
    this.triggers = new Map();
    this.activeTriggers = new Map();
    this.triggerHandlers = new Map();
    this.isInitialized = false;
    
    // 初始化觸發器處理器
    this.initializeTriggerHandlers();
  }

  /**
   * 初始化觸發器系統
   */
  async initialize() {
    if (this.isInitialized) {
      this.logger.warn('觸發器系統已初始化，跳過重複初始化');
      return;
    }

    try {
      this.logger.info('開始初始化觸發器系統...');

      // 初始化觸發器數據庫
      await this.initializeDatabase();

      // 載入現有觸發器
      await this.loadTriggers();

      // 啟動觸發器監聽
      await this.startTriggerListening();

      this.isInitialized = true;
      this.logger.info('觸發器系統初始化完成');
    } catch (error) {
      this.logger.error('觸發器系統初始化失敗:', error);
      throw error;
    }
  }

  /**
   * 初始化觸發器數據庫
   */
  async initializeDatabase() {
    try {
      // 獲取數據庫服務而不是適配器
      const dbService = this.container.getService('databaseService');
      
      // 使用數據庫服務的安全方法創建表
      await dbService.createTable('triggers', {
        id: { type: 'INTEGER', primaryKey: true, autoIncrement: true },
        name: { type: 'TEXT', notNull: true },
        type: { type: 'TEXT', notNull: true },
        config: { type: 'TEXT', notNull: true },
        workflow_id: { type: 'INTEGER', notNull: true, foreignKey: 'workflows.id' },
        status: { type: 'TEXT', default: 'active' },
        created_at: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
        updated_at: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
        user_id: { type: 'TEXT', notNull: true },
        tenant_id: { type: 'TEXT', notNull: true }
      });

      await dbService.createTable('trigger_executions', {
        id: { type: 'INTEGER', primaryKey: true, autoIncrement: true },
        trigger_id: { type: 'INTEGER', notNull: true, foreignKey: 'triggers.id' },
        workflow_id: { type: 'INTEGER', notNull: true, foreignKey: 'workflows.id' },
        input_data: { type: 'TEXT' },
        status: { type: 'TEXT', default: 'pending' },
        started_at: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
        completed_at: { type: 'DATETIME' },
        result: { type: 'TEXT' },
        error: { type: 'TEXT' },
        user_id: { type: 'TEXT', notNull: true },
        tenant_id: { type: 'TEXT', notNull: true }
      });
      
      this.logger.info('觸發器數據庫表創建完成');
    } catch (error) {
      this.logger.error('初始化觸發器數據庫失敗:', error);
      throw error;
    }
  }

  /**
   * 初始化觸發器處理器
   */
  initializeTriggerHandlers() {
    // 圖片觸發器
    this.triggerHandlers.set('image', this.handleImageTrigger.bind(this));
    
    // 文字觸發器
    this.triggerHandlers.set('text', this.handleTextTrigger.bind(this));
    
    // 白名單觸發器
    this.triggerHandlers.set('whitelist', this.handleWhitelistTrigger.bind(this));
    
    // 定時觸發器
    this.triggerHandlers.set('schedule', this.handleScheduleTrigger.bind(this));
    
    // 智能路由觸發器
    this.triggerHandlers.set('smart_routing', this.handleSmartRoutingTrigger.bind(this));
  }

  /**
   * 載入現有觸發器
   */
  async loadTriggers() {
    try {
      // 使用數據庫服務而不是適配器
      const dbService = this.container.getService('databaseService');
      
      // 使用參數化查詢
      const triggers = await dbService.query(
        'SELECT * FROM triggers WHERE status = ? AND tenant_id = ?',
        ['active', this.container.getTenantId()]
      );
      
      for (const trigger of triggers) {
        try {
          const config = JSON.parse(trigger.config);
          // 驗證配置安全性
          this.validateTriggerConfig(config);
          
          this.triggers.set(trigger.id, {
            ...trigger,
            config
          });
        } catch (error) {
          this.logger.error(`載入觸發器配置失敗 (ID: ${trigger.id}):`, error);
          // 跳過無效的觸發器，繼續處理其他觸發器
          continue;
        }
      }

      this.logger.info(`載入 ${triggers.length} 個觸發器`);
    } catch (error) {
      this.logger.error('載入觸發器失敗:', error);
      throw error;
    }
  }

  /**
   * 驗證觸發器配置安全性
   */
  validateTriggerConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('無效的觸發器配置');
    }

    // 檢查必要字段
    const requiredFields = ['type', 'conditions'];
    for (const field of requiredFields) {
      if (!(field in config)) {
        throw new Error(`觸發器配置缺少必要字段: ${field}`);
      }
    }

    // 驗證條件安全性
    if (!Array.isArray(config.conditions)) {
      throw new Error('觸發器條件必須是數組');
    }

    for (const condition of config.conditions) {
      if (!condition || typeof condition !== 'object') {
        throw new Error('無效的觸發器條件');
      }

      // 檢查條件中的不安全表達式
      this._validateConditionSafety(condition);
    }
  }

  /**
   * 驗證條件安全性
   */
  _validateConditionSafety(condition, seen = new Set()) {
    if (seen.has(condition)) {
      throw new Error('不允許循環引用');
    }
    seen.add(condition);

    for (const [key, value] of Object.entries(condition)) {
      // 檢查鍵名安全性
      if (key.startsWith('__') || key.startsWith('$')) {
        throw new Error(`不安全的條件鍵名: ${key}`);
      }

      // 檢查值類型安全性
      if (typeof value === 'function') {
        throw new Error(`不允許函數類型的條件值: ${key}`);
      }

      // 遞歸檢查嵌套對象
      if (value && typeof value === 'object') {
        this._validateConditionSafety(value, seen);
      }
    }
  }

  /**
   * 啟動觸發器監聽
   */
  async startTriggerListening() {
    try {
      // 簡化版觸發器監聽 - 暫時不依賴事件總線
      // TODO: 當事件總線服務準備好後，再恢復完整的事件監聽
      this.logger.info('觸發器監聽啟動完成 (簡化版)');
    } catch (error) {
      this.logger.error('啟動觸發器監聽失敗:', error);
      throw error;
    }
  }

  /**
   * 處理觸發器
   * @param {string} triggerType - 觸發器類型
   * @param {Object} data - 觸發數據
   */
  async processTrigger(triggerType, data) {
    try {
      const { userId, tenantId } = data;
      
      // 驗證租戶權限
      if (!await this.validateTenantAccess(tenantId, userId)) {
        this.logger.warn(`租戶訪問被拒絕: ${tenantId}`, { userId });
        return;
      }
      
      // 獲取匹配的觸發器
      const matchedTriggers = await this.getMatchingTriggers(triggerType, data);
      
      if (matchedTriggers.length === 0) {
        this.logger.debug(`沒有匹配的觸發器: ${triggerType}`);
        return;
      }

      // 執行匹配的觸發器
      for (const trigger of matchedTriggers) {
        await this.executeTrigger(trigger, data);
      }
    } catch (error) {
      this.logger.error(`處理觸發器失敗: ${triggerType}`, error);
    }
  }

  /**
   * 驗證租戶訪問權限
   */
  async validateTenantAccess(tenantId, userId) {
    try {
      const authService = this.container.getService('authService');
      return await authService.validateTenantAccess(tenantId, userId);
    } catch (error) {
      this.logger.error('租戶訪問驗證失敗:', error);
      return false;
    }
  }

  /**
   * 獲取匹配的觸發器
   * @param {string} triggerType - 觸發器類型
   * @param {Object} data - 觸發數據
   * @returns {Array} - 匹配的觸發器列表
   */
  async getMatchingTriggers(triggerType, data) {
    try {
      const { userId, tenantId } = data;
      const matchedTriggers = [];

      for (const [triggerId, trigger] of this.triggers) {
        if (trigger.type === triggerType && 
            trigger.user_id === userId && 
            trigger.tenant_id === tenantId) {
          
          const handler = this.triggerHandlers.get(triggerType);
          if (handler && await handler(trigger, data)) {
            matchedTriggers.push(trigger);
          }
        }
      }

      return matchedTriggers;
    } catch (error) {
      this.logger.error('獲取匹配觸發器失敗:', error);
      return [];
    }
  }

  /**
   * 執行觸發器
   * @param {Object} trigger - 觸發器對象
   * @param {Object} data - 觸發數據
   */
  async executeTrigger(trigger, data) {
    let executionId = null;
    try {
      const { userId, tenantId } = data;
      
      // 記錄觸發器執行
      executionId = await this.createTriggerExecution(trigger, data);
      
      // 獲取工作流引擎
      const workflowEngine = this.container.getService('workflowEngine');
      
      // 執行工作流
      const result = await workflowEngine.executeWorkflow(
        trigger.workflow_id,
        data,
        userId,
        tenantId
      );

      // 更新執行記錄
      await this.updateTriggerExecution(executionId, 'completed', result);
      
      this.logger.info(`觸發器執行成功: ${trigger.name} (ID: ${trigger.id})`);
    } catch (error) {
      this.logger.error(`觸發器執行失敗: ${trigger.name}`, error);
      if (executionId) {
        await this.updateTriggerExecution(executionId, 'failed', null, error.message);
      }
    }
  }

  /**
   * 圖片觸發器處理器
   * @param {Object} trigger - 觸發器配置
   * @param {Object} data - 圖片數據
   * @returns {boolean} - 是否匹配
   */
  async handleImageTrigger(trigger, data) {
    try {
      const { config } = trigger;
      const { imageType, imageSize, imageContent } = data;

      // 檢查檔案類型
      if (config.allowedTypes && config.allowedTypes.length > 0) {
        if (!config.allowedTypes.includes(imageType)) {
          return false;
        }
      }

      // 檢查檔案大小
      if (config.maxSize && imageSize > config.maxSize) {
        return false;
      }

      // 檢查圖片內容（使用AI識別）
      if (config.contentFilters && config.contentFilters.length > 0) {
        const aiService = this.container.getAdapter('AIServiceV2');
        const contentAnalysis = await aiService.analyzeImage(imageContent);
        
        const hasMatchingContent = config.contentFilters.some(filter => {
          return contentAnalysis.includes(filter.toLowerCase());
        });

        if (!hasMatchingContent) {
          return false;
        }
      }

      this.logger.info(`圖片觸發器匹配: ${trigger.name}`);
      return true;
    } catch (error) {
      this.logger.error('圖片觸發器處理失敗:', error);
      return false;
    }
  }

  /**
   * 文字觸發器處理器
   * @param {Object} trigger - 觸發器配置
   * @param {Object} data - 文字數據
   * @returns {boolean} - 是否匹配
   */
  async handleTextTrigger(trigger, data) {
    try {
      const { config } = trigger;
      const { message } = data;

      if (!message || typeof message !== 'string') {
        return false;
      }

      const messageText = message.toLowerCase();

      // 關鍵字匹配
      if (config.keywords && config.keywords.length > 0) {
        const hasKeyword = config.keywords.some(keyword => {
          return messageText.includes(keyword.toLowerCase());
        });

        if (!hasKeyword) {
          return false;
        }
      }

      // 正則表達式匹配
      if (config.patterns && config.patterns.length > 0) {
        const hasPattern = config.patterns.some(pattern => {
          const regex = new RegExp(pattern, 'i');
          return regex.test(messageText);
        });

        if (!hasPattern) {
          return false;
        }
      }

      // 語義匹配（使用AI）
      if (config.semanticFilters && config.semanticFilters.length > 0) {
        const aiService = this.container.getAdapter('AIServiceV2');
        const semanticAnalysis = await aiService.analyzeText(message);
        
        const hasSemanticMatch = config.semanticFilters.some(filter => {
          return semanticAnalysis.intent === filter;
        });

        if (!hasSemanticMatch) {
          return false;
        }
      }

      this.logger.info(`文字觸發器匹配: ${trigger.name}`);
      return true;
    } catch (error) {
      this.logger.error('文字觸發器處理失敗:', error);
      return false;
    }
  }

  /**
   * 白名單觸發器處理器
   * @param {Object} trigger - 觸發器配置
   * @param {Object} data - 用戶數據
   * @returns {boolean} - 是否匹配
   */
  async handleWhitelistTrigger(trigger, data) {
    try {
      const { config } = trigger;
      const { userId, phoneNumber, chatId } = data;

      // 檢查用戶ID白名單
      if (config.allowedUserIds && config.allowedUserIds.length > 0) {
        if (!config.allowedUserIds.includes(userId)) {
          return false;
        }
      }

      // 檢查電話號碼白名單
      if (config.allowedPhoneNumbers && config.allowedPhoneNumbers.length > 0) {
        if (!config.allowedPhoneNumbers.includes(phoneNumber)) {
          return false;
        }
      }

      // 檢查聊天室白名單
      if (config.allowedChatIds && config.allowedChatIds.length > 0) {
        if (!config.allowedChatIds.includes(chatId)) {
          return false;
        }
      }

      this.logger.info(`白名單觸發器匹配: ${trigger.name}`);
      return true;
    } catch (error) {
      this.logger.error('白名單觸發器處理失敗:', error);
      return false;
    }
  }

  /**
   * 定時觸發器處理器
   * @param {Object} trigger - 觸發器配置
   * @param {Object} data - 時間數據
   * @returns {boolean} - 是否匹配
   */
  async handleScheduleTrigger(trigger, data) {
    try {
      const { config } = trigger;
      const now = new Date();

      // 檢查時間範圍
      if (config.timeRange) {
        const { start, end } = config.timeRange;
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const startTime = this.parseTime(start);
        const endTime = this.parseTime(end);

        if (currentTime < startTime || currentTime > endTime) {
          return false;
        }
      }

      // 檢查星期
      if (config.weekdays && config.weekdays.length > 0) {
        const currentWeekday = now.getDay();
        if (!config.weekdays.includes(currentWeekday)) {
          return false;
        }
      }

      // 檢查日期
      if (config.dates && config.dates.length > 0) {
        const currentDate = now.toISOString().split('T')[0];
        if (!config.dates.includes(currentDate)) {
          return false;
        }
      }

      this.logger.info(`定時觸發器匹配: ${trigger.name}`);
      return true;
    } catch (error) {
      this.logger.error('定時觸發器處理失敗:', error);
      return false;
    }
  }

  /**
   * 智能路由觸發器處理器
   * @param {Object} trigger - 觸發器配置
   * @param {Object} data - 訊息數據
   * @returns {boolean} - 是否匹配
   */
  async handleSmartRoutingTrigger(trigger, data) {
    try {
      const { config } = trigger;
      const { message, imageContent, userId, tenantId } = data;

      // 使用AI進行智能分析
      const aiService = this.container.getAdapter('AIServiceV2');
      
      let analysisResult = null;
      
      if (imageContent) {
        analysisResult = await aiService.analyzeImage(imageContent);
      } else if (message) {
        analysisResult = await aiService.analyzeText(message);
      }

      if (!analysisResult) {
        return false;
      }

      // 檢查路由規則
      if (config.routingRules && config.routingRules.length > 0) {
        const hasMatchingRule = config.routingRules.some(rule => {
          switch (rule.type) {
            case 'intent':
              return analysisResult.intent === rule.value;
            case 'category':
              return analysisResult.category === rule.value;
            case 'confidence':
              return analysisResult.confidence >= rule.value;
            default:
              return false;
          }
        });

        if (!hasMatchingRule) {
          return false;
        }
      }

      this.logger.info(`智能路由觸發器匹配: ${trigger.name}`);
      return true;
    } catch (error) {
      this.logger.error('智能路由觸發器處理失敗:', error);
      return false;
    }
  }

  /**
   * 創建觸發器執行記錄
   * @param {Object} trigger - 觸發器對象
   * @param {Object} data - 觸發數據
   * @returns {number} - 執行記錄ID
   */
  async createTriggerExecution(trigger, data) {
    const dbService = this.container.getService('databaseService');
    const execution = await dbService.insert('trigger_executions', {
      trigger_id: trigger.id,
      workflow_id: trigger.workflow_id,
      input_data: JSON.stringify(data),
      status: 'pending',
      user_id: data.userId,
      tenant_id: data.tenantId
    });
    return execution.id;
  }

  /**
   * 更新觸發器執行記錄
   * @param {number} executionId - 執行記錄ID
   * @param {string} status - 狀態
   * @param {Object} result - 結果
   * @param {string} error - 錯誤信息
   */
  async updateTriggerExecution(executionId, status, result = null, error = null) {
    const dbService = this.container.getService('databaseService');
    await dbService.update('trigger_executions', 
      { id: executionId },
      {
        status,
        result: result ? JSON.stringify(result) : null,
        error: error,
        completed_at: new Date().toISOString()
      }
    );
  }

  /**
   * 解析時間字符串
   * @param {string} timeStr - 時間字符串 (HH:MM)
   * @returns {number} - 分鐘數
   */
  parseTime(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * 創建觸發器
   * @param {Object} triggerData - 觸發器數據
   * @param {string} userId - 用戶ID
   * @param {string} tenantId - 租戶ID
   * @returns {Object} - 創建的觸發器
   */
  async createTrigger(triggerData, userId, tenantId) {
    try {
      const { name, type, config, workflowId } = triggerData;

      // 驗證觸發器數據
      this.validateTriggerData(triggerData);

      // 使用數據庫服務而不是適配器
      const dbService = this.container.getService('databaseService');
      
      const result = await dbService.insert('triggers', {
        name,
        type,
        config: JSON.stringify(config),
        workflow_id: workflowId,
        user_id: userId,
        tenant_id: tenantId
      });

      const triggerId = result.id;
      const trigger = {
        id: triggerId,
        name,
        type,
        config,
        workflow_id: workflowId,
        user_id: userId,
        tenant_id: tenantId,
        status: 'active'
      };

      this.triggers.set(triggerId, trigger);

      this.logger.info(`創建觸發器成功: ${name} (ID: ${triggerId})`);
      return trigger;
    } catch (error) {
      this.logger.error('創建觸發器失敗:', error);
      throw error;
    }
  }

  /**
   * 驗證觸發器數據
   * @param {Object} triggerData - 觸發器數據
   */
  validateTriggerData(triggerData) {
    const { name, type, config, workflowId } = triggerData;

    if (!name || typeof name !== 'string') {
      throw new Error('觸發器名稱無效');
    }

    if (!type || typeof type !== 'string') {
      throw new Error('觸發器類型無效');
    }

    if (!config || typeof config !== 'object') {
      throw new Error('觸發器配置無效');
    }

    if (!workflowId || (typeof workflowId !== 'number' && typeof workflowId !== 'string')) {
      throw new Error('工作流ID無效');
    }

    if (!this.triggerHandlers.has(type)) {
      throw new Error(`不支持的觸發器類型: ${type}`);
    }
  }

  /**
   * 獲取觸發器統計
   * @param {string} userId - 用戶ID
   * @param {string} tenantId - 租戶ID
   * @returns {Object} - 統計數據
   */
  async getTriggerStats(userId, tenantId) {
    try {
      // 使用數據庫服務而不是適配器
      const dbService = this.container.getService('databaseService');
      
      const stats = await dbService.query(
        `
        SELECT 
          COUNT(*) as total_triggers,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_triggers,
          COUNT(DISTINCT type) as trigger_types
        FROM triggers 
        WHERE user_id = ? AND tenant_id = ?
        `, [userId, tenantId]
      );

      const executionStats = await dbService.query(
        `
        SELECT 
          COUNT(*) as total_executions,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_executions,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_executions
        FROM trigger_executions 
        WHERE user_id = ? AND tenant_id = ?
        `, [userId, tenantId]
      );

      return {
        ...stats[0],
        ...executionStats[0]
      };
    } catch (error) {
      this.logger.error('獲取觸發器統計失敗:', error);
      throw error;
    }
  }

  /**
   * 健康檢查
   * @returns {Object} - 健康狀態
   */
  async healthCheck() {
    try {
      return {
        status: 'healthy',
        triggersCount: this.triggers.size,
        activeTriggersCount: this.activeTriggers.size,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
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
      // 停止所有活動的觸發器
      this.activeTriggers.clear();
      
      // 清理觸發器集合
      this.triggers.clear();
      
      this.isInitialized = false;
      
      this.logger.info('觸發器系統清理完成');
    } catch (error) {
      this.logger.error('觸發器系統清理失敗:', error);
      throw error;
    }
  }
}

module.exports = TriggerSystem; 