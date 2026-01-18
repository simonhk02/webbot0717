/**
 * 觸發器系統路由 - 階段4 API接口
 * 提供觸發器的創建、管理、監控等功能
 */

const express = require('express');
const router = express.Router();
const { businessLogger } = require('../../utils/logger');

/**
 * 創建觸發器
 * POST /api/triggers
 */
router.post('/', async (req, res) => {
  try {
    const { name, type, config, workflowId } = req.body;
    const userId = req.user?.id || 'default_user';
    const tenantId = req.tenant?.id || 'default_tenant';

    // 獲取觸發器系統服務
    const triggerSystem = req.app.locals.workflowContainer.getService('triggerSystem');

    // 創建觸發器
    const trigger = await triggerSystem.createTrigger({
      name,
      type,
      config,
      workflowId
    }, userId, tenantId);

    businessLogger.info(`創建觸發器成功: ${name}`, { 
      triggerId: trigger.id, 
      type, 
      userId, 
      tenantId 
    });

    res.status(201).json({
      success: true,
      message: '觸發器創建成功',
      data: trigger
    });
  } catch (error) {
    businessLogger.error('創建觸發器失敗:', error);
    res.status(500).json({
      success: false,
      message: '創建觸發器失敗',
      error: error.message
    });
  }
});

/**
 * 獲取觸發器列表
 * GET /api/triggers
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id || 'default_user';
    const tenantId = req.tenant?.id || 'default_tenant';

    // 獲取觸發器系統服務
    const triggerSystem = req.app.locals.workflowContainer.getService('triggerSystem');
    const dbAdapter = req.app.locals.workflowContainer.getAdapter('databaseService');

    // 獲取用戶的觸發器列表
    const triggers = await dbAdapter.safeRead('all', `
      SELECT t.*, w.name as workflow_name
      FROM triggers t
      LEFT JOIN workflows w ON t.workflow_id = w.id
      WHERE t.user_id = ? AND t.tenant_id = ? AND t.status = 'active'
      ORDER BY t.created_at DESC
    `, [userId, tenantId]);

    // 解析配置
    const triggersWithConfig = triggers.map(trigger => ({
      ...trigger,
      config: JSON.parse(trigger.config)
    }));

    res.json({
      success: true,
      data: triggersWithConfig
    });
  } catch (error) {
    businessLogger.error('獲取觸發器列表失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取觸發器列表失敗',
      error: error.message
    });
  }
});

/**
 * 獲取觸發器詳情
 * GET /api/triggers/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const triggerId = parseInt(req.params.id);
    const userId = req.user?.id || 'default_user';
    const tenantId = req.tenant?.id || 'default_tenant';

    const dbAdapter = req.app.locals.workflowContainer.getAdapter('databaseService');

    const trigger = await dbAdapter.safeRead('get', `
      SELECT t.*, w.name as workflow_name
      FROM triggers t
      LEFT JOIN workflows w ON t.workflow_id = w.id
      WHERE t.id = ? AND t.user_id = ? AND t.tenant_id = ?
    `, [triggerId, userId, tenantId]);

    if (!trigger) {
      return res.status(404).json({
        success: false,
        message: '觸發器不存在'
      });
    }

    res.json({
      success: true,
      data: {
        ...trigger,
        config: JSON.parse(trigger.config)
      }
    });
  } catch (error) {
    businessLogger.error('獲取觸發器詳情失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取觸發器詳情失敗',
      error: error.message
    });
  }
});

/**
 * 更新觸發器
 * PUT /api/triggers/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const triggerId = parseInt(req.params.id);
    const { name, type, config, workflowId, status } = req.body;
    const userId = req.user?.id || 'default_user';
    const tenantId = req.tenant?.id || 'default_tenant';

    const dbAdapter = req.app.locals.workflowContainer.getAdapter('databaseService');

    // 檢查觸發器是否存在
    const existingTrigger = await dbAdapter.safeRead('get', `
      SELECT * FROM triggers 
      WHERE id = ? AND user_id = ? AND tenant_id = ?
    `, [triggerId, userId, tenantId]);

    if (!existingTrigger) {
      return res.status(404).json({
        success: false,
        message: '觸發器不存在'
      });
    }

    // 更新觸發器
    await dbAdapter.safeRead('run', `
      UPDATE triggers 
      SET name = ?, type = ?, config = ?, workflow_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ? AND tenant_id = ?
    `, [
      name || existingTrigger.name,
      type || existingTrigger.type,
      JSON.stringify(config || JSON.parse(existingTrigger.config)),
      workflowId || existingTrigger.workflow_id,
      status || existingTrigger.status,
      triggerId,
      userId,
      tenantId
    ]);

    businessLogger.info(`更新觸發器成功: ${name || existingTrigger.name}`, { 
      triggerId, 
      userId, 
      tenantId 
    });

    res.json({
      success: true,
      message: '觸發器更新成功'
    });
  } catch (error) {
    businessLogger.error('更新觸發器失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新觸發器失敗',
      error: error.message
    });
  }
});

/**
 * 刪除觸發器
 * DELETE /api/triggers/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const triggerId = parseInt(req.params.id);
    const userId = req.user?.id || 'default_user';
    const tenantId = req.tenant?.id || 'default_tenant';

    const dbAdapter = req.app.locals.workflowContainer.getAdapter('databaseService');

    // 軟刪除觸發器
    const result = await dbAdapter.safeRead('run', `
      UPDATE triggers 
      SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ? AND tenant_id = ?
    `, [triggerId, userId, tenantId]);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: '觸發器不存在'
      });
    }

    businessLogger.info(`刪除觸發器成功`, { 
      triggerId, 
      userId, 
      tenantId 
    });

    res.json({
      success: true,
      message: '觸發器刪除成功'
    });
  } catch (error) {
    businessLogger.error('刪除觸發器失敗:', error);
    res.status(500).json({
      success: false,
      message: '刪除觸發器失敗',
      error: error.message
    });
  }
});

/**
 * 手動執行觸發器
 * POST /api/triggers/:id/execute
 */
router.post('/:id/execute', async (req, res) => {
  try {
    const triggerId = parseInt(req.params.id);
    const { testData } = req.body;
    const userId = req.user?.id || 'default_user';
    const tenantId = req.tenant?.id || 'default_tenant';

    const triggerSystem = req.app.locals.workflowContainer.getService('triggerSystem');
    const dbAdapter = req.app.locals.workflowContainer.getAdapter('databaseService');

    // 獲取觸發器
    const trigger = await dbAdapter.safeRead('get', `
      SELECT * FROM triggers 
      WHERE id = ? AND user_id = ? AND tenant_id = ? AND status = 'active'
    `, [triggerId, userId, tenantId]);

    if (!trigger) {
      return res.status(404).json({
        success: false,
        message: '觸發器不存在或已停用'
      });
    }

    // 解析觸發器配置
    const triggerWithConfig = {
      ...trigger,
      config: JSON.parse(trigger.config)
    };

    // 準備測試數據
    const executionData = {
      userId,
      tenantId,
      ...testData,
      isManualTest: true
    };

    // 執行觸發器
    await triggerSystem.executeTrigger(triggerWithConfig, executionData);

    businessLogger.info(`手動執行觸發器成功`, { 
      triggerId, 
      userId, 
      tenantId 
    });

    res.json({
      success: true,
      message: '觸發器執行成功'
    });
  } catch (error) {
    businessLogger.error('手動執行觸發器失敗:', error);
    res.status(500).json({
      success: false,
      message: '觸發器執行失敗',
      error: error.message
    });
  }
});

/**
 * 獲取觸發器執行記錄
 * GET /api/triggers/:id/executions
 */
router.get('/:id/executions', async (req, res) => {
  try {
    const triggerId = parseInt(req.params.id);
    const userId = req.user?.id || 'default_user';
    const tenantId = req.tenant?.id || 'default_tenant';
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const dbAdapter = req.app.locals.workflowContainer.getAdapter('databaseService');

    const executions = await dbAdapter.safeRead('all', `
      SELECT te.*, t.name as trigger_name, w.name as workflow_name
      FROM trigger_executions te
      LEFT JOIN triggers t ON te.trigger_id = t.id
      LEFT JOIN workflows w ON te.workflow_id = w.id
      WHERE te.trigger_id = ? AND te.user_id = ? AND te.tenant_id = ?
      ORDER BY te.started_at DESC
      LIMIT ? OFFSET ?
    `, [triggerId, userId, tenantId, limit, offset]);

    // 解析JSON數據
    const executionsWithData = executions.map(execution => ({
      ...execution,
      input_data: execution.input_data ? JSON.parse(execution.input_data) : null,
      result: execution.result ? JSON.parse(execution.result) : null
    }));

    res.json({
      success: true,
      data: executionsWithData
    });
  } catch (error) {
    businessLogger.error('獲取觸發器執行記錄失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取執行記錄失敗',
      error: error.message
    });
  }
});

/**
 * 獲取觸發器統計
 * GET /api/triggers/stats
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const userId = req.user?.id || 'default_user';
    const tenantId = req.tenant?.id || 'default_tenant';

    const triggerSystem = req.app.locals.workflowContainer.getService('triggerSystem');
    const stats = await triggerSystem.getTriggerStats(userId, tenantId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    businessLogger.error('獲取觸發器統計失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取統計失敗',
      error: error.message
    });
  }
});

/**
 * 獲取觸發器類型列表
 * GET /api/triggers/types
 */
router.get('/types/list', async (req, res) => {
  try {
    const triggerTypes = [
      {
        type: 'image',
        name: '圖片觸發器',
        description: '當接收到圖片訊息時觸發',
        configSchema: {
          allowedTypes: { type: 'array', description: '允許的圖片類型' },
          maxSize: { type: 'number', description: '最大檔案大小(bytes)' },
          contentFilters: { type: 'array', description: '內容過濾關鍵字' }
        }
      },
      {
        type: 'text',
        name: '文字觸發器',
        description: '當接收到特定文字訊息時觸發',
        configSchema: {
          keywords: { type: 'array', description: '關鍵字列表' },
          patterns: { type: 'array', description: '正則表達式列表' },
          semanticFilters: { type: 'array', description: '語義過濾器' }
        }
      },
      {
        type: 'whitelist',
        name: '白名單觸發器',
        description: '只允許特定用戶觸發',
        configSchema: {
          allowedUserIds: { type: 'array', description: '允許的用戶ID列表' },
          allowedPhoneNumbers: { type: 'array', description: '允許的電話號碼列表' },
          allowedChatIds: { type: 'array', description: '允許的聊天室ID列表' }
        }
      },
      {
        type: 'schedule',
        name: '定時觸發器',
        description: '在特定時間或週期性觸發',
        configSchema: {
          timeRange: { type: 'object', description: '時間範圍' },
          weekdays: { type: 'array', description: '星期列表' },
          dates: { type: 'array', description: '特定日期列表' }
        }
      },
      {
        type: 'smart_routing',
        name: '智能路由觸發器',
        description: '使用AI智能分析並路由到適當工作流',
        configSchema: {
          routingRules: { type: 'array', description: '路由規則列表' },
          aiModel: { type: 'string', description: 'AI模型選擇' },
          confidenceThreshold: { type: 'number', description: '信心度閾值' }
        }
      }
    ];

    res.json({
      success: true,
      data: triggerTypes
    });
  } catch (error) {
    businessLogger.error('獲取觸發器類型失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取類型列表失敗',
      error: error.message
    });
  }
});

/**
 * 觸發器健康檢查
 * GET /api/triggers/health
 */
router.get('/health/check', async (req, res) => {
  try {
    const triggerSystem = req.app.locals.workflowContainer.getService('triggerSystem');
    const health = await triggerSystem.healthCheck();

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json({
      success: health.status === 'healthy',
      data: health
    });
  } catch (error) {
    businessLogger.error('觸發器健康檢查失敗:', error);
    res.status(503).json({
      success: false,
      message: '健康檢查失敗',
      error: error.message
    });
  }
});

module.exports = router; 