/**
 * 工作流機器人系統配置
 * 完全獨立於現有免費版系統
 */

require('dotenv').config();

const config = {
  // 應用程式基本配置
  app: {
    name: 'Workflow Bot System',
    version: '1.0.0',
    description: '高級工作流機器人系統 - 收費版'
  },

  // 伺服器配置
  server: {
    port: process.env.WORKFLOW_BOT_PORT || 3001,
    host: process.env.WORKFLOW_BOT_HOST || 'localhost',
    cors: {
      origin: process.env.WORKFLOW_CORS_ORIGIN || '*',
      credentials: true
    }
  },

  // 數據庫配置
  database: {
    path: './workflow/workflowBot.db',
    type: 'sqlite',
    options: {
      verbose: process.env.NODE_ENV === 'development'
    }
  },

  // 功能開關
  features: {
    enableWorkflowEngine: true,
    enableBotManager: true,
    enableWorkflowDesigner: true,
    enableAnalytics: true,
    enableTeamCollaboration: true
  },

  // 安全配置
  security: {
    jwtSecret: process.env.WORKFLOW_JWT_SECRET || 'workflow-secret-key',
    sessionTimeout: 24 * 60 * 60 * 1000, // 24小時
    maxLoginAttempts: 5
  },

  // 日誌配置
  logging: {
    level: process.env.WORKFLOW_LOG_LEVEL || 'info',
    file: './workflow/logs/workflow.log',
    maxSize: '10m',
    maxFiles: 5
  },

  // 外部服務配置
  external: {
    // 重用現有系統的API密鑰，但使用獨立配置
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-3-sonnet-20240229'
    },
    google: {
      credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS
    }
  },

  // 工作流引擎配置
  workflow: {
    maxWorkflowsPerUser: 50,
    maxStepsPerWorkflow: 100,
    maxBotsPerUser: 20,
    executionTimeout: 30000, // 30秒
    retryAttempts: 3
  },

  // 監控配置
  monitoring: {
    enabled: true,
    metricsPort: process.env.WORKFLOW_METRICS_PORT || 3002,
    healthCheckInterval: 30000 // 30秒
  }
};

module.exports = config; 