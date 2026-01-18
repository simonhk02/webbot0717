/**
 * WhatsApp Bot 主應用程式
 * 重構後的簡化版本 - 使用 Application.js 進行啟動
 */

// 設置環境變數解決Node.js 22與Google API的兼容性問題
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = require('path').join(__dirname, 'credentials', 'service-account.json');
}
if (!process.env.NODE_OPTIONS || !process.env.NODE_OPTIONS.includes('--openssl-legacy-provider')) {
  process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + ' --openssl-legacy-provider';
}

require('dotenv').config();

// DEBUG: 檢查環境變數是否載入
console.log('🔍 DEBUG: 檢查環境變數載入狀態');
console.log('USE_V2_SERVICES:', process.env.USE_V2_SERVICES);
console.log('USE_CACHE_SYSTEM:', process.env.USE_CACHE_SYSTEM);
console.log('ENABLE_DEBUG_MODE:', process.env.ENABLE_DEBUG_MODE);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('🔍 DEBUG: 環境變數檢查完成\n');

const { businessLogger } = require('./utils/logger');
const config = require('./config');

// 引入服務容器和服務引導器
const ServiceContainer = require('./core/ServiceContainer');
const ServiceBootstrap = require('./core/ServiceBootstrap');
const Application = require('./core/Application');

// 建立服務容器和引導器（使用單例模式）
const container = ServiceContainer.getInstance();
const bootstrap = new ServiceBootstrap(container);

process.setMaxListeners(config.app.maxListeners);

/**
 * 初始化並啟動應用程式
 */
async function startApplication() {
    try {
        businessLogger.info('開始初始化 WhatsApp Bot 應用程式...');

        // 1. 引導所有服務
        businessLogger.info('正在初始化服務...');
        await bootstrap.bootstrap();
        businessLogger.info('服務引導完成');

        // 2. 建立並初始化應用程式
        businessLogger.info('正在初始化應用程式...');
        const app = new Application(container);
        await app.initialize();
        businessLogger.info('應用程式初始化完成');

        // 3. 初始化額外的服務邏輯
        await initializeAdditionalServices();

        // 4. 啟動伺服器
        const port = config.server.port;
        await app.start(port);
        businessLogger.info(`WhatsApp Bot 已成功啟動，監聽端口 ${port}`);
        businessLogger.info(`健康檢查端點: http://localhost:${port}/api/health`);

        // 5. 定期檢查和維護
        setupPeriodicMaintenance();

        return app;
    } catch (error) {
        businessLogger.error(`應用程式啟動失敗: ${error.message}`, error);
        process.exit(1);
    }
}

/**
 * 初始化額外的服務邏輯
 * 這些是當前 app.js 特有的邏輯，需要保留以維持向後相容性
 */
async function initializeAdditionalServices() {
    try {
        // 初始化插件系統
        const pluginLoader = container.resolve('pluginLoader');
        await pluginLoader.initialize();
        await pluginLoader.watchPlugins();
        businessLogger.info('插件系統初始化完成');

        // 初始化熱重載服務
        const hotReloadService = container.resolve('hotReloadService');
        await hotReloadService.initialize();
        businessLogger.info('熱重載服務初始化完成');

        // 初始化 WhatsApp 服務
        const whatsAppService = container.resolve('whatsAppService');
        await whatsAppService.initialize();
        businessLogger.info('WhatsApp 服務初始化完成');

        // 啟動 WhatsApp 健康檢查
        const { startHealthCheck } = require('./services/whatsappConnection');
        startHealthCheck();
        businessLogger.info('WhatsApp 健康檢查已啟動');

        // 設置圖片處理佇列處理器
        await setupImageQueueProcessor();
        businessLogger.info('圖片處理佇列處理器設置完成');

        // 初始化事件處理器
        const eventHandlers = require('./core/EventHandlers');
        businessLogger.info('事件處理器已初始化');

        // 初始化監控服務
        const monitoringService = container.resolve('monitoringService');
        await monitoringService.initialize();
        businessLogger.info('監控服務初始化完成');

    } catch (error) {
        businessLogger.error(`額外服務初始化失敗: ${error.message}`, error);
        throw error;
    }
}

/**
 * 設置圖片處理佇列處理器
 * 保留原有的圖片處理邏輯以維持向後相容性
 */
async function setupImageQueueProcessor() {
    try {
        const queueService = container.resolve('queueService');
        const whatsAppService = container.resolve('whatsAppService');
        const stateManager = container.resolve('stateManager');
        const eventBus = container.resolve('eventBus');
        const imageProcessingService = container.resolve('imageProcessingService');
        const expenseChatService = container.resolve('expenseChatService');
        const { EventTypes, EventSource } = require('./core/EventTypes');

        await queueService.processJob('image-processing', async (job) => {
            const { chatId, media, defaultDate, userId, msgId } = job.data;
            const clientData = whatsAppService.getClient(userId);
            
            if (!clientData || !clientData.ready || !clientData.client.ws.isOpen) {
                businessLogger.error(`用戶 ${userId} 無有效客戶端資料或連線已關閉`);
                stateManager.deleteExpenseState(chatId, msgId);
                stateManager.markImageProcessed(msgId);
                stateManager.setImageProcessingStatus(false);
                imageProcessingService.processImageQueue();
                return;
            }

            try {
                if (!media || !media.data) {
                    throw new Error('圖片數據無效');
                }
                
                businessLogger.info(`app.js Bull Queue 直接處理圖片：msgId=${msgId}`);
                // 直接調用 ExpenseChatService 處理圖片，不再發送事件
                await expenseChatService.startExpenseChat(chatId, media, defaultDate, clientData.client, clientData.driveFolderId, msgId);
                businessLogger.info(`app.js Bull Queue 成功處理圖片：msgId=${msgId}`);
                
            } catch (err) {
                businessLogger.error(`圖片處理失敗：${err.message}`);
                if (clientData.ready && clientData.client.ws.isOpen) {
                    try {
                        const { createErrorMessage } = require('./utils/messageUtils');
                        await clientData.client.sendMessage(chatId, { text: createErrorMessage('圖片處理', err.message) });
                    } catch (sendErr) {
                        businessLogger.warn(`發送圖片處理失敗訊息時出錯：${sendErr.message}`);
                    }
                }
                stateManager.deleteExpenseState(chatId, msgId);
                stateManager.markImageProcessed(msgId);
                stateManager.setImageProcessingStatus(false);
                imageProcessingService.processImageQueue();
            }
        });
    } catch (error) {
        businessLogger.error(`設置圖片處理佇列處理器失敗: ${error.message}`, error);
        throw error;
    }
}

/**
 * 設置定期維護任務
 * 保留原有的資料庫維護邏輯
 */
function setupPeriodicMaintenance() {
    try {
        const db = require('./database');
        
        // 定期檢查資料庫結構的函數
        const checkAndAddColumns = () => {
            const columnsToAdd = [
                { name: 'email', type: 'TEXT UNIQUE' },
                { name: 'password', type: 'TEXT' },
                { name: 'isAuthenticated', type: 'INTEGER DEFAULT 0' },
                { name: 'driveFolderId', type: 'TEXT' },
                { name: 'sheetId', type: 'TEXT' },
                { name: 'sheetName', type: 'TEXT' },
                { name: 'companyName', type: 'TEXT' },
                { name: 'companyAddress', type: 'TEXT' },
                { name: 'companyPhone', type: 'TEXT' },
                { name: 'invoiceTitle', type: 'TEXT' },
                { name: 'invoiceNumberPrefix', type: 'TEXT' },
                { name: 'invoiceFooter', type: 'TEXT' },
                { name: 'enablePdf', type: 'INTEGER DEFAULT 0' },
                { name: 'pdfStyle', type: 'TEXT DEFAULT \'default\'' },
                { name: 'enableAI', type: 'INTEGER DEFAULT 0' },
                { name: 'aiConfidenceThreshold', type: 'REAL DEFAULT 0.7' }
            ];

            columnsToAdd.forEach(column => {
                db.run(`ALTER TABLE users ADD COLUMN ${column.name} ${column.type}`, (err) => {
                    if (err && !err.message.includes('duplicate column name')) {
                        businessLogger.error(`添加 ${column.name} 欄位失敗: ${err.message}`);
                    }
                });
            });
        };

        // 3秒後檢查欄位
        setTimeout(checkAndAddColumns, 3000);
        businessLogger.info('定期維護任務已設置');
    } catch (error) {
        businessLogger.error(`設置定期維護任務失敗: ${error.message}`, error);
    }
}

/**
 * 優雅關閉處理
 */
process.on('SIGINT', async () => {
    businessLogger.info('接收到 SIGINT 信號，開始優雅關閉...');
    try {
        // 清理服務
        if (bootstrap && bootstrap.cleanup) {
            await bootstrap.cleanup();
        }
        businessLogger.info('應用程式清理完成');
        process.exit(0);
    } catch (error) {
        businessLogger.error(`優雅關閉失敗: ${error.message}`, error);
        process.exit(1);
    }
});

// 啟動應用程式
if (require.main === module) {
    startApplication().catch(error => {
        businessLogger.error('應用程式啟動失敗:', error);
        process.exit(1);
    });
}

module.exports = {
    startApplication,
    container,
    bootstrap
};