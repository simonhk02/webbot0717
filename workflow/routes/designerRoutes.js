/**
 * 工作流設計器API路由
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
  req.userId = req.headers['x-user-id'] || 'demo-user';
  req.tenantId = req.headers['x-tenant-id'] || 'demo-tenant';
  next();
};

// 應用中間件
router.use(getServiceContainer);
router.use(validateUser);

/**
 * 獲取模板列表
 * GET /workflow/api/designer/templates
 */
router.get('/designer/templates', async (req, res) => {
  try {
    const category = req.query.category;
    const designerService = req.container.resolve('workflowDesigner');
    const templates = designerService.getTemplates(category);
    
    res.json({
      success: true,
      data: templates,
      count: templates.length
    });
  } catch (error) {
    businessLogger.error('獲取模板列表失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 獲取模板詳情
 * GET /workflow/api/designer/templates/:id
 */
router.get('/designer/templates/:id', async (req, res) => {
  try {
    const templateId = req.params.id;
    const designerService = req.container.resolve('workflowDesigner');
    const template = designerService.getTemplate(templateId);
    
    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    businessLogger.error('獲取模板詳情失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 從模板創建工作流
 * POST /workflow/api/designer/templates/:id/create
 */
router.post('/designer/templates/:id/create', async (req, res) => {
  try {
    const templateId = req.params.id;
    const customizations = req.body;
    
    const designerService = req.container.resolve('workflowDesigner');
    const workflow = await designerService.createFromTemplate(
      templateId,
      customizations,
      req.userId,
      req.tenantId
    );

    res.status(201).json({
      success: true,
      data: workflow
    });
  } catch (error) {
    businessLogger.error('從模板創建工作流失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 驗證工作流設計
 * POST /workflow/api/designer/validate
 */
router.post('/designer/validate', async (req, res) => {
  try {
    const workflowDesign = req.body;
    
    const designerService = req.container.resolve('workflowDesigner');
    const validation = designerService.validateWorkflowDesign(workflowDesign);
    
    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    businessLogger.error('驗證工作流設計失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 獲取步驟類型列表
 * GET /workflow/api/designer/step-types
 */
router.get('/designer/step-types', async (req, res) => {
  try {
    const designerService = req.container.resolve('workflowDesigner');
    const stepTypes = designerService.getStepTypes();
    
    res.json({
      success: true,
      data: stepTypes
    });
  } catch (error) {
    businessLogger.error('獲取步驟類型失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 預覽工作流執行
 * POST /workflow/api/designer/preview
 */
router.post('/designer/preview', async (req, res) => {
  try {
    const { workflowDesign, input } = req.body;
    
    // 驗證工作流設計
    const designerService = req.container.resolve('workflowDesigner');
    const validation = designerService.validateWorkflowDesign(workflowDesign);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: '工作流設計無效',
        details: validation.errors
      });
    }

    // 模擬執行（不保存到數據庫）
    const previewResult = await simulateWorkflowExecution(workflowDesign.steps, input);
    
    res.json({
      success: true,
      data: {
        preview: true,
        result: previewResult,
        executionTime: Date.now()
      }
    });
  } catch (error) {
    businessLogger.error('預覽工作流執行失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 模擬工作流執行
 * @param {Array} steps - 步驟列表
 * @param {Object} input - 輸入數據
 * @returns {Object} - 執行結果
 */
async function simulateWorkflowExecution(steps, input) {
  let context = { ...input };
  const executionLog = [];

  for (const step of steps) {
    const stepStart = Date.now();
    
    try {
      // 模擬步驟執行
      switch (step.type) {
        case 'ai_process':
          context = await simulateAIStep(step, context);
          break;
        case 'data_collect':
          context = await simulateDataCollectionStep(step, context);
          break;
        case 'condition':
          context = await simulateConditionStep(step, context);
          break;
        case 'loop':
          context = await simulateLoopStep(step, context);
          break;
        default:
          context[step.output] = `模擬 ${step.type} 步驟執行`;
      }

      const stepEnd = Date.now();
      executionLog.push({
        stepId: step.id,
        stepName: step.name,
        stepType: step.type,
        status: 'success',
        duration: stepEnd - stepStart,
        output: context[step.output]
      });
    } catch (error) {
      executionLog.push({
        stepId: step.id,
        stepName: step.name,
        stepType: step.type,
        status: 'error',
        error: error.message
      });
      break;
    }
  }

  return {
    context,
    executionLog,
    totalSteps: steps.length,
    successfulSteps: executionLog.filter(log => log.status === 'success').length
  };
}

/**
 * 模擬AI步驟
 */
async function simulateAIStep(step, context) {
  // 模擬AI處理延遲
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return {
    ...context,
    [step.output]: `AI處理結果: ${step.config.prompt.substring(0, 50)}...`
  };
}

/**
 * 模擬數據收集步驟
 */
async function simulateDataCollectionStep(step, context) {
  return {
    ...context,
    [step.output]: `收集的數據: ${step.config.source}`
  };
}

/**
 * 模擬條件步驟
 */
async function simulateConditionStep(step, context) {
  return {
    ...context,
    [step.output]: Math.random() > 0.5
  };
}

/**
 * 模擬循環步驟
 */
async function simulateLoopStep(step, context) {
  const items = ['項目1', '項目2', '項目3'];
  const results = items.map(item => `處理: ${item}`);
  
  return {
    ...context,
    [step.output]: results
  };
}

/**
 * 獲取設計器統計信息
 * GET /workflow/api/designer/stats
 */
router.get('/designer/stats', async (req, res) => {
  try {
    const designerService = req.container.resolve('workflowDesigner');
    const templates = designerService.getTemplates();
    
    const stats = {
      totalTemplates: templates.length,
      templatesByCategory: {},
      stepTypes: designerService.getStepTypes().length,
      lastUpdated: new Date().toISOString()
    };

    // 按分類統計模板
    templates.forEach(template => {
      const category = template.category || 'other';
      stats.templatesByCategory[category] = (stats.templatesByCategory[category] || 0) + 1;
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    businessLogger.error('獲取設計器統計信息失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 