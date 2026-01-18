/**
 * 工作流設計器服務
 * 提供可視化的工作流設計功能
 */

const { businessLogger } = require('../../utils/logger');
const config = require('../config');

class WorkflowDesignerService {
  constructor(container) {
    this.container = container;
    this.logger = businessLogger;
    this.templates = new Map();
    this.isInitialized = false;
  }

  /**
   * 初始化工作流設計器
   */
  async initialize() {
    if (this.isInitialized) {
      this.logger.warn('工作流設計器已初始化，跳過重複初始化');
      return;
    }

    try {
      this.logger.info('開始初始化工作流設計器...');

      // 載入預設模板
      await this.loadTemplates();

      this.isInitialized = true;
      this.logger.info('工作流設計器初始化完成');
    } catch (error) {
      this.logger.error('工作流設計器初始化失敗:', error);
      throw error;
    }
  }

  /**
   * 載入預設模板
   */
  async loadTemplates() {
    try {
      // 預設工作流模板
      const defaultTemplates = [
        {
          id: 'customer-service',
          name: '客戶服務自動化',
          description: '自動處理客戶查詢和投訴',
          category: 'customer-service',
          steps: [
            {
              id: 'receive-message',
              type: 'data_collect',
              name: '接收消息',
              config: {
                source: 'whatsapp',
                field: 'message'
              },
              output: 'userMessage'
            },
            {
              id: 'analyze-intent',
              type: 'ai_process',
              name: '分析意圖',
              config: {
                prompt: '分析以下客戶消息的意圖：{{userMessage}}',
                options: {
                  model: 'claude-3-sonnet-20240229',
                  maxTokens: 1000
                }
              },
              output: 'intent'
            },
            {
              id: 'generate-response',
              type: 'ai_process',
              name: '生成回應',
              config: {
                prompt: '基於意圖 {{intent}} 和消息 {{userMessage}}，生成專業的客戶服務回應',
                options: {
                  model: 'claude-3-sonnet-20240229',
                  maxTokens: 500
                }
              },
              output: 'response'
            },
            {
              id: 'send-response',
              type: 'bot_action',
              name: '發送回應',
              config: {
                botType: 'whatsapp',
                message: '{{response}}'
              }
            }
          ]
        },
        {
          id: 'data-processing',
          name: '數據處理流程',
          description: '自動處理和轉換數據',
          category: 'data-processing',
          steps: [
            {
              id: 'collect-data',
              type: 'data_collect',
              name: '收集數據',
              config: {
                source: 'database',
                query: 'SELECT * FROM raw_data WHERE processed = 0'
              },
              output: 'rawData'
            },
            {
              id: 'validate-data',
              type: 'condition',
              name: '驗證數據',
              config: {
                condition: 'rawData && rawData.length > 0'
              },
              output: 'isValid'
            },
            {
              id: 'process-data',
              type: 'ai_process',
              name: '處理數據',
              config: {
                prompt: '處理以下數據：{{rawData}}',
                options: {
                  model: 'claude-3-sonnet-20240229',
                  maxTokens: 2000
                }
              },
              output: 'processedData'
            },
            {
              id: 'save-result',
              type: 'data_action',
              name: '保存結果',
              config: {
                action: 'insert',
                table: 'processed_data',
                data: '{{processedData}}'
              }
            }
          ]
        },
        {
          id: 'notification-system',
          name: '智能通知系統',
          description: '根據條件發送智能通知',
          category: 'notification',
          steps: [
            {
              id: 'check-condition',
              type: 'condition',
              name: '檢查條件',
              config: {
                condition: '{{triggerData.alert_level}} > 5'
              },
              output: 'shouldNotify'
            },
            {
              id: 'generate-notification',
              type: 'ai_process',
              name: '生成通知',
              config: {
                prompt: '生成緊急通知：{{triggerData.message}}',
                options: {
                  model: 'claude-3-sonnet-20240229',
                  maxTokens: 300
                }
              },
              output: 'notification'
            },
            {
              id: 'send-notification',
              type: 'bot_action',
              name: '發送通知',
              config: {
                botType: 'whatsapp',
                message: '{{notification}}',
                recipients: '{{triggerData.recipients}}'
              }
            }
          ]
        }
      ];

      for (const template of defaultTemplates) {
        this.templates.set(template.id, template);
      }

      this.logger.info(`載入 ${defaultTemplates.length} 個預設模板`);
    } catch (error) {
      this.logger.error('載入模板失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取模板列表
   * @param {string} category - 分類（可選）
   * @returns {Array} - 模板列表
   */
  getTemplates(category = null) {
    try {
      let templates = Array.from(this.templates.values());

      if (category) {
        templates = templates.filter(template => template.category === category);
      }

      return templates;
    } catch (error) {
      this.logger.error('獲取模板列表失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取模板詳情
   * @param {string} templateId - 模板ID
   * @returns {Object} - 模板詳情
   */
  getTemplate(templateId) {
    try {
      const template = this.templates.get(templateId);
      if (!template) {
        throw new Error(`找不到模板: ${templateId}`);
      }

      return template;
    } catch (error) {
      this.logger.error(`獲取模板詳情失敗: ${templateId}`, error);
      throw error;
    }
  }

  /**
   * 從模板創建工作流
   * @param {string} templateId - 模板ID
   * @param {Object} customizations - 自定義配置
   * @param {string} userId - 用戶ID
   * @param {string} tenantId - 租戶ID
   * @returns {Object} - 創建的工作流
   */
  async createFromTemplate(templateId, customizations, userId, tenantId) {
    try {
      const template = this.getTemplate(templateId);
      
      // 合併模板和自定義配置
      const workflowData = {
        name: customizations.name || template.name,
        description: customizations.description || template.description,
        steps: this.customizeSteps(template.steps, customizations),
        triggers: customizations.triggers || []
      };

      // 使用工作流引擎創建工作流
      const workflowEngine = this.container.resolve('workflowEngine');
      const workflow = await workflowEngine.createWorkflow(workflowData, userId, tenantId);

      this.logger.info(`從模板創建工作流成功: ${templateId} -> ${workflow.id}`);
      return workflow;
    } catch (error) {
      this.logger.error(`從模板創建工作流失敗: ${templateId}`, error);
      throw error;
    }
  }

  /**
   * 自定義步驟
   * @param {Array} steps - 原始步驟
   * @param {Object} customizations - 自定義配置
   * @returns {Array} - 自定義後的步驟
   */
  customizeSteps(steps, customizations) {
    try {
      return steps.map(step => {
        const customizedStep = { ...step };

        // 應用自定義配置
        if (customizations.steps && customizations.steps[step.id]) {
          const stepCustomization = customizations.steps[step.id];
          
          if (stepCustomization.config) {
            customizedStep.config = { ...step.config, ...stepCustomization.config };
          }
          
          if (stepCustomization.name) {
            customizedStep.name = stepCustomization.name;
          }
        }

        return customizedStep;
      });
    } catch (error) {
      this.logger.error('自定義步驟失敗:', error);
      throw error;
    }
  }

  /**
   * 驗證工作流設計
   * @param {Object} workflowDesign - 工作流設計
   * @returns {Object} - 驗證結果
   */
  validateWorkflowDesign(workflowDesign) {
    try {
      const errors = [];
      const warnings = [];

      // 檢查基本結構
      if (!workflowDesign.name || workflowDesign.name.trim().length === 0) {
        errors.push('工作流名稱不能為空');
      }

      if (!workflowDesign.steps || !Array.isArray(workflowDesign.steps)) {
        errors.push('工作流步驟不能為空');
      }

      // 檢查步驟
      if (workflowDesign.steps) {
        for (let i = 0; i < workflowDesign.steps.length; i++) {
          const step = workflowDesign.steps[i];
          const stepErrors = this.validateStep(step, i);
          errors.push(...stepErrors.errors);
          warnings.push(...stepErrors.warnings);
        }
      }

      // 檢查循環依賴
      const circularDependency = this.checkCircularDependency(workflowDesign.steps);
      if (circularDependency) {
        errors.push(`檢測到循環依賴: ${circularDependency}`);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      this.logger.error('驗證工作流設計失敗:', error);
      throw error;
    }
  }

  /**
   * 驗證步驟
   * @param {Object} step - 步驟
   * @param {number} index - 步驟索引
   * @returns {Object} - 驗證結果
   */
  validateStep(step, index) {
    const errors = [];
    const warnings = [];

    // 檢查必要欄位
    if (!step.id) {
      errors.push(`步驟 ${index + 1}: 缺少ID`);
    }

    if (!step.type) {
      errors.push(`步驟 ${index + 1}: 缺少類型`);
    }

    if (!step.name) {
      errors.push(`步驟 ${index + 1}: 缺少名稱`);
    }

    // 檢查步驟類型
    const validTypes = ['ai_process', 'data_collect', 'condition', 'loop', 'bot_action', 'data_action'];
    if (step.type && !validTypes.includes(step.type)) {
      errors.push(`步驟 ${index + 1}: 不支援的類型 ${step.type}`);
    }

    // 檢查配置
    if (step.type === 'ai_process' && (!step.config || !step.config.prompt)) {
      errors.push(`步驟 ${index + 1}: AI處理步驟缺少提示詞`);
    }

    if (step.type === 'bot_action' && (!step.config || !step.config.botType)) {
      errors.push(`步驟 ${index + 1}: 機械人動作步驟缺少機械人類型`);
    }

    return { errors, warnings };
  }

  /**
   * 檢查循環依賴
   * @param {Array} steps - 步驟列表
   * @returns {string|null} - 循環依賴描述
   */
  checkCircularDependency(steps) {
    try {
      const visited = new Set();
      const recursionStack = new Set();

      function dfs(stepId) {
        if (recursionStack.has(stepId)) {
          return `步驟 ${stepId} 存在循環依賴`;
        }

        if (visited.has(stepId)) {
          return null;
        }

        visited.add(stepId);
        recursionStack.add(stepId);

        const step = steps.find(s => s.id === stepId);
        if (step && step.config && step.config.dependencies) {
          for (const depId of step.config.dependencies) {
            const result = dfs(depId);
            if (result) {
              return result;
            }
          }
        }

        recursionStack.delete(stepId);
        return null;
      }

      for (const step of steps) {
        const result = dfs(step.id);
        if (result) {
          return result;
        }
      }

      return null;
    } catch (error) {
      this.logger.error('檢查循環依賴失敗:', error);
      return '檢查循環依賴時發生錯誤';
    }
  }

  /**
   * 獲取步驟類型列表
   * @returns {Array} - 步驟類型列表
   */
  getStepTypes() {
    return [
      {
        type: 'ai_process',
        name: 'AI處理',
        description: '使用AI處理數據或生成內容',
        icon: '🤖',
        configSchema: {
          prompt: { type: 'string', required: true },
          options: { type: 'object', required: false }
        }
      },
      {
        type: 'data_collect',
        name: '數據收集',
        description: '從各種來源收集數據',
        icon: '📊',
        configSchema: {
          source: { type: 'string', required: true },
          field: { type: 'string', required: false }
        }
      },
      {
        type: 'condition',
        name: '條件判斷',
        description: '根據條件進行分支',
        icon: '🔀',
        configSchema: {
          condition: { type: 'string', required: true }
        }
      },
      {
        type: 'loop',
        name: '循環處理',
        description: '對數據進行循環處理',
        icon: '🔄',
        configSchema: {
          items: { type: 'string', required: true },
          steps: { type: 'array', required: true }
        }
      },
      {
        type: 'bot_action',
        name: '機械人動作',
        description: '執行機械人相關動作',
        icon: '🤖',
        configSchema: {
          botType: { type: 'string', required: true },
          message: { type: 'string', required: true }
        }
      },
      {
        type: 'data_action',
        name: '數據動作',
        description: '執行數據庫操作',
        icon: '💾',
        configSchema: {
          action: { type: 'string', required: true },
          table: { type: 'string', required: true },
          data: { type: 'object', required: false }
        }
      }
    ];
  }

  /**
   * 健康檢查
   */
  async healthCheck() {
    try {
      return {
        status: 'healthy',
        service: 'WorkflowDesignerService',
        templatesCount: this.templates.size,
        isInitialized: this.isInitialized,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'WorkflowDesignerService',
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
      this.templates.clear();
      this.isInitialized = false;
      this.logger.info('工作流設計器清理完成');
    } catch (error) {
      this.logger.error('工作流設計器清理失敗:', error);
      throw error;
    }
  }
}

module.exports = WorkflowDesignerService; 