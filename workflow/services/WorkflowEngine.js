/**
 * 工作流引擎
 * 新系統的核心服務，負責工作流的執行和管理
 */

const { businessLogger } = require('../../utils/logger');
const config = require('../config');

class WorkflowEngine {
  constructor(container) {
    this.container = container;
    this.logger = businessLogger;
    this.workflows = new Map();
    this.executions = new Map();
    this.isInitialized = false;
  }

  /**
   * 初始化工作流引擎
   */
  async initialize() {
    if (this.isInitialized) {
      this.logger.warn('工作流引擎已初始化，跳過重複初始化');
      return;
    }

    try {
      this.logger.info('開始初始化工作流引擎...');

      // 初始化數據庫
      await this.initializeDatabase();

      // 載入現有工作流
      await this.loadWorkflows();

      this.isInitialized = true;
      this.logger.info('工作流引擎初始化完成');
    } catch (error) {
      this.logger.error('工作流引擎初始化失敗:', error);
      throw error;
    }
  }

  /**
   * 初始化數據庫
   */
  async initializeDatabase() {
    try {
      // 使用適配器訪問現有數據庫服務
      const dbAdapter = this.container.getAdapter('databaseService');
      
      // 創建工作流相關表
      const createTablesSQL = [
        `CREATE TABLE IF NOT EXISTS workflows (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          steps TEXT NOT NULL,
          triggers TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          user_id TEXT NOT NULL,
          tenant_id TEXT NOT NULL,
          status TEXT DEFAULT 'active'
        )`,
        `CREATE TABLE IF NOT EXISTS workflow_executions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workflow_id INTEGER NOT NULL,
          status TEXT DEFAULT 'running',
          started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME,
          result TEXT,
          error TEXT,
          user_id TEXT NOT NULL,
          tenant_id TEXT NOT NULL,
          FOREIGN KEY (workflow_id) REFERENCES workflows (id)
        )`,
        `CREATE TABLE IF NOT EXISTS bots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          config TEXT,
          status TEXT DEFAULT 'inactive',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          user_id TEXT NOT NULL,
          tenant_id TEXT NOT NULL
        )`
      ];

      // 逐個執行創建表語句
      for (const sql of createTablesSQL) {
        await dbAdapter.safeRead('query', sql);
      }
      
      this.logger.info('工作流數據庫表創建完成');
    } catch (error) {
      this.logger.error('初始化工作流數據庫失敗:', error);
      throw error;
    }
  }

  /**
   * 載入現有工作流
   */
  async loadWorkflows() {
    try {
      const dbAdapter = this.container.getAdapter('databaseService');
      const workflows = await dbAdapter.safeRead('all', 'SELECT * FROM workflows WHERE status = ?', ['active']);
      
      for (const workflow of workflows) {
        this.workflows.set(workflow.id, {
          ...workflow,
          steps: JSON.parse(workflow.steps),
          triggers: workflow.triggers ? JSON.parse(workflow.triggers) : []
        });
      }

      this.logger.info(`載入 ${workflows.length} 個工作流`);
    } catch (error) {
      this.logger.error('載入工作流失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取用戶的工作流列表
   * @param {string} userId - 用戶ID
   * @param {string} tenantId - 租戶ID
   * @returns {Array} - 工作流列表
   */
  async getWorkflows(userId, tenantId) {
    try {
      const dbAdapter = this.container.getAdapter('databaseService');
      const workflows = await dbAdapter.safeRead('all', `
        SELECT * FROM workflows 
        WHERE user_id = ? AND tenant_id = ? AND status = 'active'
        ORDER BY created_at DESC
      `, [userId, tenantId]);

      return workflows.map(workflow => ({
        ...workflow,
        steps: JSON.parse(workflow.steps),
        triggers: workflow.triggers ? JSON.parse(workflow.triggers) : []
      }));
    } catch (error) {
      this.logger.error('獲取工作流列表失敗:', error);
      throw error;
    }
  }

  /**
   * 創建工作流
   * @param {Object} workflowData - 工作流數據
   * @param {string} userId - 用戶ID
   * @param {string} tenantId - 租戶ID
   * @returns {Object} - 創建的工作流
   */
  async createWorkflow(workflowData, userId, tenantId) {
    try {
      const { name, description, steps, triggers } = workflowData;

      // 驗證工作流數據
      this.validateWorkflowData(workflowData);

      const dbAdapter = this.container.getAdapter('databaseService');
      
      const result = await dbAdapter.safeRead('run', `
        INSERT INTO workflows (name, description, steps, triggers, user_id, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        name,
        description,
        JSON.stringify(steps),
        JSON.stringify(triggers),
        userId,
        tenantId
      ]);

      const workflowId = result.lastID;
      const workflow = {
        id: workflowId,
        name,
        description,
        steps,
        triggers,
        user_id: userId,
        tenant_id: tenantId,
        status: 'active'
      };

      this.workflows.set(workflowId, workflow);

      this.logger.info(`創建工作流成功: ${name} (ID: ${workflowId})`);
      return workflow;
    } catch (error) {
      this.logger.error('創建工作流失敗:', error);
      throw error;
    }
  }

  /**
   * 執行工作流
   * @param {number} workflowId - 工作流ID
   * @param {Object} input - 輸入數據
   * @param {string} userId - 用戶ID
   * @param {string} tenantId - 租戶ID
   * @returns {Object} - 執行結果
   */
  async executeWorkflow(workflowId, input, userId, tenantId) {
    try {
      const workflow = this.workflows.get(workflowId);
      if (!workflow) {
        throw new Error(`找不到工作流: ${workflowId}`);
      }

      // 創建執行記錄
      const executionId = await this.createExecutionRecord(workflowId, userId, tenantId);

      try {
        // 執行工作流步驟
        const result = await this.executeSteps(workflow.steps, input, userId, tenantId);

        // 更新執行記錄為成功
        await this.updateExecutionRecord(executionId, 'completed', result);

        this.logger.info(`工作流執行成功: ${workflowId} (執行ID: ${executionId})`);
        return result;
      } catch (error) {
        // 更新執行記錄為失敗
        await this.updateExecutionRecord(executionId, 'failed', null, error.message);
        throw error;
      }
    } catch (error) {
      this.logger.error(`執行工作流失敗: ${workflowId}`, error);
      throw error;
    }
  }

  /**
   * 執行工作流步驟
   * @param {Array} steps - 步驟列表
   * @param {Object} input - 輸入數據
   * @param {string} userId - 用戶ID
   * @param {string} tenantId - 租戶ID
   * @returns {Object} - 執行結果
   */
  async executeSteps(steps, input, userId, tenantId) {
    let context = { ...input };

    for (const step of steps) {
      try {
        this.logger.info(`執行步驟: ${step.type}`, { stepId: step.id, userId, tenantId });

        switch (step.type) {
          case 'ai_process':
            context = await this.executeAIStep(step, context, userId, tenantId);
            break;
          case 'data_collect':
            context = await this.executeDataCollectionStep(step, context, userId, tenantId);
            break;
          case 'condition':
            context = await this.executeConditionStep(step, context, userId, tenantId);
            break;
          case 'loop':
            context = await this.executeLoopStep(step, context, userId, tenantId);
            break;
          default:
            throw new Error(`不支援的步驟類型: ${step.type}`);
        }
      } catch (error) {
        this.logger.error(`步驟執行失敗: ${step.type}`, { stepId: step.id, error: error.message });
        throw error;
      }
    }

    return context;
  }

  /**
   * 執行AI步驟
   */
  async executeAIStep(step, context, userId, tenantId) {
    try {
      const aiAdapter = this.container.getAdapter('AIServiceV2');
      const result = await aiAdapter.safeRead('processRequest', step.config.prompt, step.config.options, tenantId);
      
      return {
        ...context,
        [step.output]: result.content
      };
    } catch (error) {
      this.logger.error('AI步驟執行失敗:', error);
      throw error;
    }
  }

  /**
   * 執行數據收集步驟
   */
  async executeDataCollectionStep(step, context, userId, tenantId) {
    // 這裡可以實現數據收集邏輯
    return {
      ...context,
      [step.output]: step.config.defaultValue || ''
    };
  }

  /**
   * 執行條件步驟
   */
  async executeConditionStep(step, context, userId, tenantId) {
    const condition = step.config.condition;
    const result = eval(condition); // 注意：在生產環境中應該使用更安全的表達式解析器
    
    return {
      ...context,
      [step.output]: result
    };
  }

  /**
   * 執行循環步驟
   */
  async executeLoopStep(step, context, userId, tenantId) {
    const items = context[step.config.items];
    const results = [];

    for (const item of items) {
      const itemContext = { ...context, item };
      const result = await this.executeSteps(step.config.steps, itemContext, userId, tenantId);
      results.push(result);
    }

    return {
      ...context,
      [step.output]: results
    };
  }

  /**
   * 創建執行記錄
   */
  async createExecutionRecord(workflowId, userId, tenantId) {
    const dbAdapter = this.container.getAdapter('databaseService');
    const result = await dbAdapter.safeRead('run', `
      INSERT INTO workflow_executions (workflow_id, user_id, tenant_id)
      VALUES (?, ?, ?)
    `, [workflowId, userId, tenantId]);

    return result.lastID;
  }

  /**
   * 更新執行記錄
   */
  async updateExecutionRecord(executionId, status, result, error = null) {
    const dbAdapter = this.container.getAdapter('databaseService');
    await dbAdapter.safeRead('run', `
      UPDATE workflow_executions 
      SET status = ?, result = ?, error = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, JSON.stringify(result), error, executionId]);
  }

  /**
   * 驗證工作流數據
   */
  validateWorkflowData(workflowData) {
    const { name, steps } = workflowData;

    if (!name || name.trim().length === 0) {
      throw new Error('工作流名稱不能為空');
    }

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      throw new Error('工作流步驟不能為空');
    }

    // 驗證每個步驟
    for (const step of steps) {
      if (!step.type || !step.id) {
        throw new Error('每個步驟必須有 type 和 id');
      }
    }
  }

  /**
   * 健康檢查
   */
  async healthCheck() {
    try {
      return {
        status: 'healthy',
        service: 'WorkflowEngine',
        workflowsCount: this.workflows.size,
        executionsCount: this.executions.size,
        isInitialized: this.isInitialized,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'WorkflowEngine',
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
      this.workflows.clear();
      this.executions.clear();
      this.isInitialized = false;
      this.logger.info('工作流引擎清理完成');
    } catch (error) {
      this.logger.error('工作流引擎清理失敗:', error);
      throw error;
    }
  }
}

module.exports = WorkflowEngine; 