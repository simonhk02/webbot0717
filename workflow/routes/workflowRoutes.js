/**
 * 工作流API路由
 */

const express = require('express');
const router = express.Router();
const { businessLogger } = require('../../utils/logger');

// 中間件：獲取服務容器
const getServiceContainer = (req, res, next) => {
  try {
    const WorkflowServiceContainer = require('../core/WorkflowServiceContainer');
    req.container = WorkflowServiceContainer.getInstance();
    next();
  } catch (error) {
    res.status(500).json({
      error: 'Service Container Error',
      message: error.message
    });
  }
};

// 中間件：驗證用戶
const validateUser = (req, res, next) => {
  // 這裡可以添加用戶驗證邏輯
  // 暫時使用模擬用戶ID
  req.userId = req.headers['x-user-id'] || 'demo-user';
  req.tenantId = req.headers['x-tenant-id'] || 'demo-tenant';
  next();
};

// 應用中間件
router.use(getServiceContainer);
router.use(validateUser);

/**
 * 獲取工作流列表
 * GET /workflow/api/workflows
 */
router.get('/workflows', async (req, res) => {
  try {
    const workflowEngine = req.container.resolve('workflowEngine');
    const workflows = await workflowEngine.getWorkflows(req.userId, req.tenantId);
    
    res.json({
      success: true,
      data: workflows,
      count: workflows.length
    });
  } catch (error) {
    businessLogger.error('獲取工作流列表失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 創建工作流
 * POST /workflow/api/workflows
 */
router.post('/workflows', async (req, res) => {
  try {
    const { name, description, steps, triggers } = req.body;
    
    if (!name || !steps) {
      return res.status(400).json({
        success: false,
        error: '工作流名稱和步驟不能為空'
      });
    }

    const workflowEngine = req.container.resolve('workflowEngine');
    const workflow = await workflowEngine.createWorkflow(
      { name, description, steps, triggers },
      req.userId,
      req.tenantId
    );

    res.status(201).json({
      success: true,
      data: workflow
    });
  } catch (error) {
    businessLogger.error('創建工作流失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 執行工作流
 * POST /workflow/api/workflows/:id/execute
 */
router.post('/workflows/:id/execute', async (req, res) => {
  try {
    const workflowId = parseInt(req.params.id);
    const input = req.body.input || {};

    const workflowEngine = req.container.resolve('workflowEngine');
    const result = await workflowEngine.executeWorkflow(
      workflowId,
      input,
      req.userId,
      req.tenantId
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    businessLogger.error('執行工作流失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 獲取工作流詳情
 * GET /workflow/api/workflows/:id
 */
router.get('/workflows/:id', async (req, res) => {
  try {
    const workflowId = parseInt(req.params.id);
    
    const dbAdapter = req.container.getAdapter('databaseService');
    const workflow = await dbAdapter.safeRead('get', 
      'SELECT * FROM workflows WHERE id = ? AND user_id = ? AND tenant_id = ?',
      [workflowId, req.userId, req.tenantId]
    );

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: '找不到工作流'
      });
    }

    res.json({
      success: true,
      data: {
        ...workflow,
        steps: JSON.parse(workflow.steps),
        triggers: workflow.triggers ? JSON.parse(workflow.triggers) : []
      }
    });
  } catch (error) {
    businessLogger.error('獲取工作流詳情失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 更新工作流
 * PUT /workflow/api/workflows/:id
 */
router.put('/workflows/:id', async (req, res) => {
  try {
    const workflowId = parseInt(req.params.id);
    const { name, description, steps, triggers } = req.body;

    const dbAdapter = req.container.getAdapter('databaseService');
    const result = await dbAdapter.safeRead('run', `
      UPDATE workflows 
      SET name = ?, description = ?, steps = ?, triggers = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ? AND tenant_id = ?
    `, [
      name,
      description,
      JSON.stringify(steps),
      JSON.stringify(triggers),
      workflowId,
      req.userId,
      req.tenantId
    ]);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: '找不到工作流或無權限修改'
      });
    }

    res.json({
      success: true,
      message: '工作流更新成功'
    });
  } catch (error) {
    businessLogger.error('更新工作流失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 刪除工作流
 * DELETE /workflow/api/workflows/:id
 */
router.delete('/workflows/:id', async (req, res) => {
  try {
    const workflowId = parseInt(req.params.id);

    const dbAdapter = req.container.getAdapter('databaseService');
    const result = await dbAdapter.safeRead('run', `
      UPDATE workflows SET status = 'deleted' WHERE id = ? AND user_id = ? AND tenant_id = ?
    `, [workflowId, req.userId, req.tenantId]);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: '找不到工作流或無權限刪除'
      });
    }

    res.json({
      success: true,
      message: '工作流刪除成功'
    });
  } catch (error) {
    businessLogger.error('刪除工作流失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 獲取執行歷史
 * GET /workflow/api/workflows/:id/executions
 */
router.get('/workflows/:id/executions', async (req, res) => {
  try {
    const workflowId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const dbAdapter = req.container.getAdapter('databaseService');
    const executions = await dbAdapter.safeRead('all', `
      SELECT * FROM workflow_executions 
      WHERE workflow_id = ? AND user_id = ? AND tenant_id = ?
      ORDER BY started_at DESC
      LIMIT ? OFFSET ?
    `, [workflowId, req.userId, req.tenantId, limit, offset]);

    res.json({
      success: true,
      data: executions,
      count: executions.length
    });
  } catch (error) {
    businessLogger.error('獲取執行歷史失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 