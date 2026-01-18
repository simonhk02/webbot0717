/**
 * 工作流機器人系統 - 主應用程式
 * 完全獨立於現有免費版系統
 * 端口: 3001 (與現有系統的3000端口分離)
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { businessLogger } = require('./utils/logger');
const WorkflowServiceContainer = require('./workflow/core/WorkflowServiceContainer');
const config = require('./workflow/config');

class WorkflowApplication {
  constructor() {
    this.app = express();
    this.container = WorkflowServiceContainer.getInstance();
    this.logger = businessLogger;
    this.server = null;
    this.isInitialized = false;
  }

  /**
   * 初始化應用程式
   */
  async initialize() {
    if (this.isInitialized) {
      this.logger.warn('工作流應用程式已初始化，跳過重複初始化');
      return;
    }

    try {
      this.logger.info('🚀 開始初始化工作流機器人系統...');

      // 設置中間件
      this.setupMiddleware();

      // 初始化服務容器
      await this.container.initialize();

      // 設置路由
      this.setupRoutes();

      // 設置錯誤處理
      this.setupErrorHandling();

      this.isInitialized = true;
      this.logger.info('✅ 工作流應用程式初始化完成');
    } catch (error) {
      this.logger.error('❌ 工作流應用程式初始化失敗:', {
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 設置中間件
   */
  setupMiddleware() {
    // CORS配置
    this.app.use(cors(config.server.cors));

    // 請求日誌
    this.app.use((req, res, next) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
      next();
    });

    // 解析JSON
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // 安全中間件
    this.app.use((req, res, next) => {
      // 添加安全頭
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      next();
    });

    // 注入服務容器 - 讓路由可以訪問服務
    this.app.use((req, res, next) => {
      req.app.locals.workflowContainer = this.container;
      next();
    });
  }

  /**
   * 設置路由
   */
  setupRoutes() {
    // 健康檢查
    this.app.get('/workflow/health', async (req, res) => {
      try {
        const health = await this.container.healthCheck();
        res.json({
          status: 'healthy',
          service: 'Workflow Bot System',
          version: config.app.version,
          timestamp: new Date().toISOString(),
          details: health
        });
      } catch (error) {
        res.status(500).json({
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // 工作流API
    this.app.use('/workflow/api', require('./workflow/routes/workflowRoutes'));

    // 機械人API
    this.app.use('/workflow/api', require('./workflow/routes/botRoutes'));

    // 設計器API
    this.app.use('/workflow/api', require('./workflow/routes/designerRoutes'));

    // 觸發器API - 階段4新增
    this.app.use('/workflow/api/triggers', require('./workflow/routes/triggerRoutes'));

    // 主頁面
    this.app.get('/workflow', (req, res) => {
      res.sendFile(path.join(__dirname, 'workflow/public/index.html'));
    });

    // 機械人管理頁面
    this.app.get('/workflow/bots', (req, res) => {
      res.sendFile(path.join(__dirname, 'workflow/public/bots.html'));
    });

    // 靜態資源 (放在主頁面路由後面，避免衝突)
    this.app.use('/workflow/static', express.static(path.join(__dirname, 'workflow/public')));

    // 404處理
    this.app.use('/workflow/*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `路徑 ${req.path} 不存在`,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * 設置錯誤處理
   */
  setupErrorHandling() {
    // 全局錯誤處理
    this.app.use((error, req, res, next) => {
      this.logger.error('應用程式錯誤:', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
        ip: req.ip
      });

      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : '服務器內部錯誤',
        timestamp: new Date().toISOString()
      });
    });

    // 未處理的Promise拒絕
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('未處理的Promise拒絕:', {
        reason: reason,
        promise: promise
      });
    });

    // 未捕獲的異常
    process.on('uncaughtException', (error) => {
      this.logger.error('未捕獲的異常:', {
        error: error.message,
        stack: error.stack
      });

      // 優雅關閉
      this.shutdown();
    });
  }

  /**
   * 啟動應用程式
   */
  async start() {
    try {
      await this.initialize();

      const port = config.server.port;
      const host = config.server.host;

      this.server = this.app.listen(port, host, () => {
        this.logger.info(`🚀 工作流機器人系統啟動成功!`);
        this.logger.info(`📍 服務地址: http://${host}:${port}/workflow`);
        this.logger.info(`🔧 API文檔: http://${host}:${port}/workflow/api/docs`);
        this.logger.info(`📊 健康檢查: http://${host}:${port}/workflow/health`);
        this.logger.info(`⏰ 啟動時間: ${new Date().toISOString()}`);
      });

      // 優雅關閉處理
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());

    } catch (error) {
      this.logger.error('❌ 工作流應用程式啟動失敗:', error);
      process.exit(1);
    }
  }

  /**
   * 優雅關閉
   */
  async shutdown() {
    try {
      this.logger.info('🔄 開始優雅關閉工作流應用程式...');

      // 關閉HTTP服務器
      if (this.server) {
        this.server.close(() => {
          this.logger.info('✅ HTTP服務器已關閉');
        });
      }

      // 清理服務容器
      if (this.container) {
        await this.container.cleanup();
        this.logger.info('✅ 服務容器已清理');
      }

      this.logger.info('✅ 工作流應用程式已優雅關閉');
      process.exit(0);
    } catch (error) {
      this.logger.error('❌ 關閉工作流應用程式時發生錯誤:', error);
      process.exit(1);
    }
  }
}

// 創建並啟動應用程式
const app = new WorkflowApplication();

// 如果直接運行此文件，則啟動應用程式
if (require.main === module) {
  app.start().catch(error => {
    console.error('❌ 應用程式啟動失敗:', error);
    process.exit(1);
  });
}

module.exports = WorkflowApplication; 