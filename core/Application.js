/**
 * 應用程式啟動器
 * 管理應用程式的生命週期和服務初始化
 */

const express = require('express');
const path = require('path');
const session = require('express-session');
const { businessLogger } = require('../utils/logger');

class Application {
  constructor(container) {
    this.container = container;
    this.app = express();
    this.logger = businessLogger;
    this.services = [];
    this.isShuttingDown = false;
    this.server = null;
  }

  /**
   * 初始化應用程式
   */
  async initialize() {
    try {
      // 初始化基礎設施
      await this.initializeInfrastructure();
      
      // 初始化中間件
      this.initializeMiddleware();
      
      // 初始化路由
      this.initializeRoutes();
      
      // 初始化錯誤處理
      this.initializeErrorHandling();
      
      // 註冊清理處理程序
      this.registerCleanupHandlers();
      
      this.logger.info('應用程式初始化完成');
    } catch (error) {
      this.logger.error('應用程式初始化失敗:', error);
      throw error;
    }
  }

  /**
   * 初始化基礎設施
   */
  async initializeInfrastructure() {
    try {
      // 只將服務加入管理列表，不重複初始化（已在 app.js 中初始化）
      const databaseService = this.container.resolve('databaseService');
      this.services.push(databaseService);
      this.logger.info('資料庫服務已加入管理');

      const redisService = this.container.resolve('redisService');
      this.services.push(redisService);
      this.logger.info('Redis 服務已加入管理');

      const whatsAppService = this.container.resolve('whatsAppService');
      this.services.push(whatsAppService);
      this.logger.info('WhatsApp 服務已加入管理');

      const aiService = this.container.resolve('aiService');
      this.services.push(aiService);
      this.logger.info('AI 服務已加入管理');

      const userService = this.container.resolve('userService');
      this.services.push(userService);
      this.logger.info('用戶服務已加入管理');

      // 加入其他服務到管理列表
      try {
        const queueService = this.container.resolve('queueService');
        this.services.push(queueService);
        this.logger.info('佇列服務已加入管理');
      } catch (err) {
        this.logger.warn('佇列服務未註冊，跳過');
      }

      try {
        const imageProcessingService = this.container.resolve('imageProcessingService');
        this.services.push(imageProcessingService);
        this.logger.info('圖片處理服務已加入管理');
      } catch (err) {
        this.logger.warn('圖片處理服務未註冊，跳過');
      }

      try {
        const expenseChatService = this.container.resolve('expenseChatService');
        this.services.push(expenseChatService);
        this.logger.info('費用對話服務已加入管理');
      } catch (err) {
        this.logger.warn('費用對話服務未註冊，跳過');
      }

      try {
        const websocketService = this.container.resolve('websocketService');
        this.services.push(websocketService);
        this.logger.info('WebSocket 服務已加入管理');
      } catch (err) {
        this.logger.warn('WebSocket 服務未註冊，跳過');
      }

    } catch (error) {
      this.logger.error('基礎設施初始化失敗:', error);
      throw error;
    }
  }

  /**
   * 初始化中間件
   */
  initializeMiddleware() {
    try {
      this.app.use(express.json());
      this.app.use(express.urlencoded({ extended: true }));
      this.app.use(express.static(path.join(__dirname, '../public')));
      
      // 設定 session
      this.app.use(session({
        secret: process.env.SESSION_SECRET || 'simonhk02',
        resave: false,
        saveUninitialized: true, // 修改為 true 以確保會話被初始化和保存
        cookie: { 
          maxAge: 24 * 60 * 60 * 1000, // 24 小時
          httpOnly: true,
          secure: false // 在開發環境中設為 false
        }
      }));
      
      // 載入自定義中間件
      try {
        const pluginMiddleware = this.container.resolve('pluginMiddleware');
        this.app.use('/api/plugins', pluginMiddleware());
      } catch (err) {
        // 如果插件中間件未註冊，載入默認的
        const pluginMiddleware = require('../middleware/pluginMiddleware');
        this.app.use('/api/plugins', pluginMiddleware());
      }

      this.logger.info('中間件初始化完成');
    } catch (error) {
      this.logger.error('中間件初始化失敗:', error);
      throw error;
    }
  }

  /**
   * 初始化路由
   */
  initializeRoutes() {
    try {
      // 載入路由
      const userRoutes = require('../routes/userRoutes');
      const aiRoutes = require('../routes/aiRoutes');
      const analyticsRoutes = require('../routes/analyticsRoutes');
      const pluginRoutes = require('../routes/pluginRoutes');
      const healthRoutes = require('../routes/healthRoutes');
      const whatsappRoutes = require('../routes/whatsappRoutes');
      const hotReloadRoutes = require('../routes/hotReloadRoutes');

      // 根路由
      this.app.get('/', (req, res) => {
        res.json({ status: 'ok', message: '伺服器運行中' });
      });

      // 設置靜態路由
      this.app.get('/settings', (req, res) => {
        res.sendFile(path.join(__dirname, '../public', 'settings.html'));
      });

      // 熱重載管理頁面路由
      this.app.get('/hot-reload', (req, res) => {
        res.sendFile(path.join(__dirname, '../public', 'hot-reload.html'));
      });

      // AI 智能儀表板頁面路由
      this.app.get('/analytics', (req, res) => {
        res.sendFile(path.join(__dirname, '../public', 'analytics.html'));
      });

      // 監控儀表板頁面路由
      this.app.get('/monitoring', (req, res) => {
        res.sendFile(path.join(__dirname, '../public', 'monitoring.html'));
      });

      // 上傳頁面路由
      this.app.get('/upload', (req, res) => {
        res.json({ 
          status: 'ok', 
          message: '上傳功能可用',
          endpoints: {
            'plugin_upload': '/api/plugins',
            'file_upload': '/api/upload'
          }
        });
      });

      // 註冊 API 路由
      this.app.use('/api', userRoutes(this.container));
      this.app.use('/api/whatsapp', whatsappRoutes(this.container));
      this.app.use('/api/health', healthRoutes(this.container));
      
      // 註冊監控路由
      try {
        const monitoringRoutes = require('../routes/monitoringRoutes');
        this.app.use('/api/monitoring', monitoringRoutes(this.container));
        this.logger.info('監控路由已註冊');
      } catch (err) {
        this.logger.warn('監控路由未找到，跳過');
      }
      this.app.use('/api/plugins', pluginRoutes(this.container));
      this.app.use('/api/ai', aiRoutes(this.container));
      this.app.use('/api/analytics', analyticsRoutes(this.container));
      this.app.use('/api/hot-reload', hotReloadRoutes(this.container));

      this.logger.info('路由初始化完成');
    } catch (error) {
      this.logger.error('路由初始化失敗:', error);
      throw error;
    }
  }

  /**
   * 初始化錯誤處理
   */
  initializeErrorHandling() {
    try {
      // 404 處理
      this.app.use((req, res) => {
        this.logger.warn(`找不到請求的資源: ${req.method} ${req.url}`);
        res.status(404).json({ error: '找不到請求的資源' });
      });

      // 錯誤處理中間件
      this.app.use((err, req, res, next) => {
        this.logger.error('未處理的錯誤:', err);
        res.status(500).json({ error: '伺服器內部錯誤' });
      });

      this.logger.info('錯誤處理初始化完成');
    } catch (error) {
      this.logger.error('錯誤處理初始化失敗:', error);
      throw error;
    }
  }

  /**
   * 註冊清理處理程序
   */
  registerCleanupHandlers() {
    const cleanup = async () => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      this.logger.info('開始清理應用程式...');

      // 依序清理所有服務
      for (const service of this.services.reverse()) {
        try {
          await service.cleanup();
          this.logger.info(`服務 ${service.constructor.name} 清理完成`);
        } catch (error) {
          this.logger.error(`清理服務 ${service.constructor.name} 失敗:`, error);
        }
      }

      // 關閉伺服器
      if (this.server) {
        await new Promise((resolve) => {
          this.server.close(() => {
            this.logger.info('伺服器已關閉');
            resolve();
          });
        });
      }

      this.logger.info('應用程式清理完成');
      process.exit(0);
    };

    // 防止意外退出的機制
    let exitAttempts = 0;
    const maxExitAttempts = 3;
    
    // 攔截 process.exit 調用（針對某些庫可能調用的退出）
    const originalExit = process.exit;
    process.exit = (code = 0) => {
      if (code === 0) {
        // 正常退出允許
        originalExit.call(process, code);
      } else {
        exitAttempts++;
        this.logger.warn(`⚠️ 攔截到異常退出嘗試 (${exitAttempts}/${maxExitAttempts})，代碼: ${code}`);
        
        if (exitAttempts >= maxExitAttempts) {
          this.logger.error('💥 多次異常退出嘗試，執行強制清理');
          cleanup();
        } else {
          this.logger.info('🔄 忽略退出嘗試，繼續運行');
          // 觸發 WhatsApp 服務恢復
          this.triggerWhatsAppRecovery();
        }
      }
    };

    // 註冊進程事件處理程序
    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
    
    // 處理未捕獲的異常
    process.on('uncaughtException', (error) => {
      this.logger.error('💥 未捕獲的異常:', error);
      
      // 檢查是否是 WhatsApp 相關錯誤
      if (this.isWhatsAppRelatedError(error)) {
        this.logger.warn('🔄 WhatsApp 相關異常，執行恢復而不關閉程式');
        this.triggerWhatsAppRecovery();
        return;
      }
      
      cleanup();
    });

    // 處理未處理的 Promise rejection（重要：防止程式崩潰）
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('未處理的 Promise rejection:', {
        reason: reason,
        stack: reason?.stack,
        promise: promise
      });
      
      // 檢查是否是 WhatsApp/Baileys 相關的錯誤
      if (reason && typeof reason === 'object') {
        const errorMessage = reason.message || reason.toString();
        const errorStack = reason.stack || '';
        
        // 擴展 WhatsApp/Baileys 錯誤檢測模式
        const isWhatsAppError = errorMessage.includes('Connection Closed') || 
                               errorMessage.includes('WebSocket') ||
                               errorMessage.includes('Baileys') ||
                               errorMessage.includes('WhatsApp') ||
                               errorMessage.includes('Session error') ||
                               errorMessage.includes('Bad MAC') ||
                               errorMessage.includes('Failed to decrypt') ||
                               errorStack.includes('@whiskeysockets/baileys') ||
                               errorStack.includes('Socket') ||
                               errorStack.includes('sendRawMessage') ||
                               reason.statusCode === 428 ||
                               (reason.output && reason.output.statusCode === 428);

        if (isWhatsAppError) {
          this.logger.warn('🔄 WhatsApp/Baileys 連接相關錯誤，執行自動恢復機制');
          this.triggerWhatsAppRecovery();
          return; // 不關閉程式，讓 WhatsApp 服務自行處理重連
        }

        // 檢查其他可能的非致命錯誤
        const isNonFatalError = errorMessage.includes('timeout') ||
                               errorMessage.includes('ETIMEDOUT') ||
                               errorMessage.includes('ECONNRESET') ||
                               errorMessage.includes('ENOTFOUND') ||
                               reason.code === 'ECONNRESET' ||
                               reason.code === 'ETIMEDOUT';

        if (isNonFatalError) {
          this.logger.warn('⚠️ 非致命網路錯誤，不關閉程式');
          return;
        }
      }
      
      // 其他嚴重錯誤才關閉程式
      this.logger.error('💥 檢測到嚴重錯誤，準備關閉程式');
      cleanup();
    });

    this.logger.info('清理處理程序註冊完成');
  }

  /**
   * 檢查是否是 WhatsApp 相關錯誤
   */
  isWhatsAppRelatedError(error) {
    if (!error) return false;
    
    const message = error.message || error.toString();
    const stack = error.stack || '';
    
    return message.includes('WhatsApp') ||
           message.includes('Baileys') ||
           message.includes('Connection Closed') ||
           message.includes('WebSocket') ||
           message.includes('Bad MAC') ||
           stack.includes('@whiskeysockets/baileys') ||
           stack.includes('Socket');
  }

  /**
   * 觸發 WhatsApp 服務恢復
   */
  triggerWhatsAppRecovery() {
    try {
      // 異步執行恢復操作，不阻塞當前處理
      setImmediate(async () => {
        try {
          this.logger.info('🔧 開始執行 WhatsApp 連接恢復...');
          const { getClients, cleanupClient } = require('../services/whatsappConnection');
          
          // 檢查並清理問題客戶端
          const clients = getClients();
          let cleanedCount = 0;
          
          for (const [userId, clientData] of clients.entries()) {
            if (!clientData.client?.ws?.isOpen) {
              this.logger.warn(`🧹 清理用戶 ${userId} 的失效客戶端`);
              await cleanupClient(userId, clientData.client);
              cleanedCount++;
            }
          }
          
          this.logger.info(`✅ WhatsApp 連接恢復完成，清理了 ${cleanedCount} 個失效客戶端`);
        } catch (recoveryError) {
          this.logger.error('❌ WhatsApp 恢復操作失敗:', recoveryError);
        }
      });
    } catch (serviceError) {
      this.logger.warn('⚠️ 無法執行 WhatsApp 恢復:', serviceError.message);
    }
  }

  /**
   * 啟動應用程式
   */
  async start(port) {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(port, () => {
          this.logger.info(`應用程式已啟動，監聽端口 ${port}`);
          
          // 初始化WebSocket服務
          try {
            const websocketService = this.container.resolve('websocketService');
            websocketService.initialize(this.server);
          } catch (err) {
            this.logger.warn('WebSocket 服務初始化失敗:', err);
          }
          
          resolve(this.server);
        });

        this.server.on('error', (error) => {
          this.logger.error('伺服器啟動失敗:', error);
          reject(error);
        });

        // 設定伺服器超時
        this.server.timeout = 120000; // 2 分鐘
        this.server.keepAliveTimeout = 60000; // 1 分鐘
      } catch (error) {
        this.logger.error('啟動應用程式失敗:', error);
        reject(error);
      }
    });
  }

  /**
   * 停止應用程式
   */
  async stop() {
    if (!this.server) return;

    return new Promise((resolve) => {
      this.server.close(() => {
        this.logger.info('伺服器已停止');
        this.server = null;
        resolve();
      });
    });
  }

  /**
   * 重新啟動應用程式
   */
  async restart(port) {
    await this.stop();
    return this.start(port);
  }
}

module.exports = Application; 