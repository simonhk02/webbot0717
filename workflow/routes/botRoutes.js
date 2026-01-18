/**
 * 機械人API路由
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
 * 獲取機械人列表
 * GET /workflow/api/bots
 */
router.get('/bots', async (req, res) => {
  try {
    const botManager = req.container.resolve('botManager');
    const bots = await botManager.getBots(req.userId, req.tenantId);
    
    res.json({
      success: true,
      data: bots,
      count: bots.length
    });
  } catch (error) {
    businessLogger.error('獲取機械人列表失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 創建機械人
 * POST /workflow/api/bots
 */
router.post('/bots', async (req, res) => {
  try {
    const { name, type, config } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({
        success: false,
        error: '機械人名稱和類型不能為空'
      });
    }

    const botManager = req.container.resolve('botManager');
    const bot = await botManager.createBot(
      { name, type, config },
      req.userId,
      req.tenantId
    );

    res.status(201).json({
      success: true,
      data: bot
    });
  } catch (error) {
    businessLogger.error('創建機械人失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 連接機械人
 * POST /workflow/api/bots/:id/connect
 */
router.post('/bots/:id/connect', async (req, res) => {
  try {
    const botId = parseInt(req.params.id);
    
    const dbAdapter = req.container.getAdapter('databaseService');
    const bot = await dbAdapter.safeRead('get', 
      'SELECT * FROM bots WHERE id = ? AND user_id = ? AND tenant_id = ?',
      [botId, req.userId, req.tenantId]
    );

    if (!bot) {
      return res.status(404).json({
        success: false,
        error: '找不到機械人'
      });
    }

    const botManager = req.container.resolve('botManager');
    await botManager.connectBot(botId, {
      ...bot,
      config: JSON.parse(bot.config || '{}')
    });

    res.json({
      success: true,
      message: '機械人連接成功'
    });
  } catch (error) {
    businessLogger.error('連接機械人失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 發送消息
 * POST /workflow/api/bots/:id/send
 */
router.post('/bots/:id/send', async (req, res) => {
  try {
    const botId = parseInt(req.params.id);
    const { message, options } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: '消息內容不能為空'
      });
    }

    const botManager = req.container.resolve('botManager');
    const result = await botManager.sendMessage(botId, message, options);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    businessLogger.error('發送消息失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 獲取機械人詳情
 * GET /workflow/api/bots/:id
 */
router.get('/bots/:id', async (req, res) => {
  try {
    const botId = parseInt(req.params.id);
    
    const dbAdapter = req.container.getAdapter('databaseService');
    const bot = await dbAdapter.safeRead('get', 
      'SELECT * FROM bots WHERE id = ? AND user_id = ? AND tenant_id = ?',
      [botId, req.userId, req.tenantId]
    );

    if (!bot) {
      return res.status(404).json({
        success: false,
        error: '找不到機械人'
      });
    }

    res.json({
      success: true,
      data: {
        ...bot,
        config: JSON.parse(bot.config || '{}')
      }
    });
  } catch (error) {
    businessLogger.error('獲取機械人詳情失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 更新機械人
 * PUT /workflow/api/bots/:id
 */
router.put('/bots/:id', async (req, res) => {
  try {
    const botId = parseInt(req.params.id);
    const { name, config } = req.body;

    const dbAdapter = req.container.getAdapter('databaseService');
    const result = await dbAdapter.safeRead('run', `
      UPDATE bots 
      SET name = ?, config = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ? AND tenant_id = ?
    `, [
      name,
      JSON.stringify(config),
      botId,
      req.userId,
      req.tenantId
    ]);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: '找不到機械人或無權限修改'
      });
    }

    res.json({
      success: true,
      message: '機械人更新成功'
    });
  } catch (error) {
    businessLogger.error('更新機械人失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 刪除機械人
 * DELETE /workflow/api/bots/:id
 */
router.delete('/bots/:id', async (req, res) => {
  try {
    const botId = parseInt(req.params.id);

    const dbAdapter = req.container.getAdapter('databaseService');
    const result = await dbAdapter.safeRead('run', `
      UPDATE bots SET status = 'deleted' WHERE id = ? AND user_id = ? AND tenant_id = ?
    `, [botId, req.userId, req.tenantId]);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: '找不到機械人或無權限刪除'
      });
    }

    res.json({
      success: true,
      message: '機械人刪除成功'
    });
  } catch (error) {
    businessLogger.error('刪除機械人失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 獲取支援的機械人類型
 * GET /workflow/api/bots/types
 */
router.get('/bots/types', (req, res) => {
  const botTypes = [
    {
      type: 'whatsapp',
      name: 'WhatsApp',
      description: 'WhatsApp 機械人',
      icon: '📱',
      configSchema: {
        phoneNumber: { type: 'string', required: true },
        sessionName: { type: 'string', required: false }
      }
    },
    {
      type: 'telegram',
      name: 'Telegram',
      description: 'Telegram 機械人',
      icon: '📡',
      configSchema: {
        botToken: { type: 'string', required: true },
        chatId: { type: 'string', required: false }
      }
    },
    {
      type: 'discord',
      name: 'Discord',
      description: 'Discord 機械人',
      icon: '🎮',
      configSchema: {
        botToken: { type: 'string', required: true },
        channelId: { type: 'string', required: false }
      }
    }
  ];

  res.json({
    success: true,
    data: botTypes
  });
});

/**
 * 啟用機械人
 * POST /workflow/api/bots/:id/enable
 */
router.post('/bots/:id/enable', async (req, res) => {
  try {
    const botId = parseInt(req.params.id);
    
    if (isNaN(botId)) {
      return res.status(400).json({
        success: false,
        error: '無效的機械人ID'
      });
    }

    const botManager = req.container.resolve('botManager');
    const result = await botManager.enableBot(botId, req.userId, req.tenantId);

    if (result.success) {
      res.json({
        success: true,
        message: '機械人啟用成功',
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message || '啟用失敗'
      });
    }
  } catch (error) {
    businessLogger.error('啟用機械人失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 關閉機械人
 * POST /workflow/api/bots/:id/disable
 */
router.post('/bots/:id/disable', async (req, res) => {
  try {
    const botId = parseInt(req.params.id);
    
    if (isNaN(botId)) {
      return res.status(400).json({
        success: false,
        error: '無效的機械人ID'
      });
    }

    const botManager = req.container.resolve('botManager');
    const result = await botManager.disableBot(botId, req.userId, req.tenantId);

    if (result.success) {
      res.json({
        success: true,
        message: '機械人關閉成功',
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message || '關閉失敗'
      });
    }
  } catch (error) {
    businessLogger.error('關閉機械人失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 獲取機械人狀態
 * GET /workflow/api/bots/:id/status
 */
router.get('/bots/:id/status', async (req, res) => {
  try {
    const botId = parseInt(req.params.id);
    
    if (isNaN(botId)) {
      return res.status(400).json({
        success: false,
        error: '無效的機械人ID'
      });
    }

    const dbAdapter = req.container.getAdapter('databaseService');
    const bot = await dbAdapter.safeRead('get', 
      'SELECT id, name, type, status, created_at, updated_at FROM bots WHERE id = ? AND user_id = ? AND tenant_id = ?',
      [botId, req.userId, req.tenantId]
    );

    if (!bot) {
      return res.status(404).json({
        success: false,
        error: '找不到機械人'
      });
    }

    res.json({
      success: true,
      data: {
        botId: bot.id,
        name: bot.name,
        type: bot.type,
        status: bot.status,
        isEnabled: bot.status === 'enabled',
        lastUpdated: bot.updated_at,
        createdAt: bot.created_at
      }
    });
  } catch (error) {
    businessLogger.error('獲取機械人狀態失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 獲取機械人配置
 * GET /workflow/api/bots/:id/config
 */
router.get('/bots/:id/config', async (req, res) => {
  try {
    const botId = parseInt(req.params.id);
    
    if (isNaN(botId)) {
      return res.status(400).json({
        success: false,
        error: '無效的機械人ID'
      });
    }

    const dbAdapter = req.container.getAdapter('databaseService');
    const bot = await dbAdapter.safeRead('get', 
      'SELECT * FROM bots WHERE id = ? AND user_id = ? AND tenant_id = ?',
      [botId, req.userId, req.tenantId]
    );

    if (!bot) {
      return res.status(404).json({
        success: false,
        error: '找不到機械人'
      });
    }

    const config = JSON.parse(bot.config || '{}');

    res.json({
      success: true,
      config: {
        name: bot.name,
        type: bot.type,
        autoStart: config.autoStart || false,
        defaultWorkflow: config.defaultWorkflow || '',
        aiModel: config.aiModel || 'claude-3-sonnet',
        systemPrompt: config.systemPrompt || '你是一個專業的智能助手，幫助用戶處理各種任務。請保持友善、高效，並提供準確的信息。',
        whitelistMode: config.whitelistMode || false,
        logConversations: config.logConversations !== false,
        authorizedUsers: config.authorizedUsers || '+85212345678\njohn.doe@example.com',
        maxConcurrentChats: config.maxConcurrentChats || 10,
        responseDelay: config.responseDelay || 1,
        timeout: config.timeout || 30
      }
    });
  } catch (error) {
    businessLogger.error('獲取機械人配置失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 更新機械人配置
 * PUT /workflow/api/bots/:id/config
 */
router.put('/bots/:id/config', async (req, res) => {
  try {
    const botId = parseInt(req.params.id);
    
    if (isNaN(botId)) {
      return res.status(400).json({
        success: false,
        error: '無效的機械人ID'
      });
    }

    const {
      name,
      type,
      autoStart,
      defaultWorkflow,
      aiModel,
      systemPrompt,
      whitelistMode,
      logConversations,
      authorizedUsers,
      maxConcurrentChats,
      responseDelay,
      timeout
    } = req.body;

    // 驗證必填欄位
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: '機械人名稱不能為空'
      });
    }

    if (maxConcurrentChats < 1 || maxConcurrentChats > 100) {
      return res.status(400).json({
        success: false,
        error: '並發對話數必須在1-100之間'
      });
    }

    if (responseDelay < 0 || responseDelay > 10) {
      return res.status(400).json({
        success: false,
        error: '回應延遲必須在0-10秒之間'
      });
    }

    if (timeout < 5 || timeout > 120) {
      return res.status(400).json({
        success: false,
        error: '超時時間必須在5-120分鐘之間'
      });
    }

    // 構建配置對象
    const config = {
      autoStart: Boolean(autoStart),
      defaultWorkflow: defaultWorkflow || '',
      aiModel: aiModel || 'claude-3-sonnet',
      systemPrompt: systemPrompt || '你是一個專業的智能助手，幫助用戶處理各種任務。請保持友善、高效，並提供準確的信息。',
      whitelistMode: Boolean(whitelistMode),
      logConversations: logConversations !== false,
      authorizedUsers: authorizedUsers || '',
      maxConcurrentChats: parseInt(maxConcurrentChats),
      responseDelay: parseFloat(responseDelay),
      timeout: parseInt(timeout),
      updatedAt: new Date().toISOString()
    };

    const dbAdapter = req.container.getAdapter('databaseService');
    
    // 檢查機械人是否存在且有權限
    const existingBot = await dbAdapter.safeRead('get', 
      'SELECT id FROM bots WHERE id = ? AND user_id = ? AND tenant_id = ?',
      [botId, req.userId, req.tenantId]
    );

    if (!existingBot) {
      return res.status(404).json({
        success: false,
        error: '找不到機械人或無權限修改'
      });
    }

    // 更新機械人配置
    const result = await dbAdapter.safeRead('run', `
      UPDATE bots 
      SET 
        name = ?,
        type = ?,
        config = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ? AND tenant_id = ?
    `, [
      name.trim(),
      type || 'whatsapp',
      JSON.stringify(config),
      botId,
      req.userId,
      req.tenantId
    ]);

    if (result.changes === 0) {
      return res.status(500).json({
        success: false,
        error: '配置更新失敗'
      });
    }

    businessLogger.info(`機械人配置已更新: ${name} (ID: ${botId})`, {
      userId: req.userId,
      tenantId: req.tenantId,
      botId,
      configKeys: Object.keys(config)
    });

    res.json({
      success: true,
      message: '機械人配置更新成功',
      data: {
        botId,
        name: name.trim(),
        type: type || 'whatsapp',
        config
      }
    });

  } catch (error) {
    businessLogger.error('更新機械人配置失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 