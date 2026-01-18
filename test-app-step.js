require('dotenv').config();
const { checkEnvironmentVariables } = require('./utils/envCheck');
const ServiceContainer = require('./core/ServiceContainer');
const { businessLogger } = require('./utils/logger');

async function testAppStepByStep() {
  try {
    console.log('=== App 逐步測試開始 ===');
    
    console.log('1. 檢查環境變數...');
    checkEnvironmentVariables();
    console.log('✅ 環境變數檢查通過');

    console.log('2. 建立服務容器...');
    const container = new ServiceContainer();
    container.register('logger', businessLogger);
    console.log('✅ 服務容器建立完成');

    console.log('3. 載入並初始化資料庫服務...');
    const DatabaseService = require('./services/databaseService');
    const databaseService = new DatabaseService();
    container.register('databaseService', databaseService);
    await databaseService.initialize();
    console.log('✅ 資料庫服務初始化完成');

    console.log('4. 載入並初始化 Redis 服務...');
    const RedisService = require('./services/redisService');
    const { setGlobalRedisService } = require('./services/redisService');
    const redisService = new RedisService();
    container.register('redisService', redisService);
    await redisService.initialize();
    setGlobalRedisService(redisService);
    console.log('✅ Redis 服務初始化完成');

    console.log('5. 載入並初始化 AI 服務...');
    const AIService = require('./services/aiService');
    const aiService = new AIService();
    container.register('aiService', aiService);
    await aiService.initialize();
    console.log('✅ AI 服務初始化完成');

    console.log('6. 載入並初始化用戶服務...');
    const UserService = require('./services/userService');
    const userService = new UserService();
    container.register('userService', userService);
    await userService.initialize();
    console.log('✅ 用戶服務初始化完成');

    console.log('7. 載入並初始化 WhatsApp 服務...');
    const WhatsAppService = require('./services/WhatsAppService');
    const whatsappService = new WhatsAppService();
    container.register('whatsappService', whatsappService);
    await whatsappService.initialize();
    console.log('✅ WhatsApp 服務初始化完成');

    console.log('8. 載入並初始化佇列服務...');
    const QueueService = require('./services/QueueService');
    const queueService = new QueueService();
    container.register('queueService', queueService);
    await queueService.initialize();
    console.log('✅ 佇列服務初始化完成');

    console.log('9. 載入並初始化圖片處理服務...');
    const ImageProcessingService = require('./services/ImageProcessingService');
    const imageProcessingService = new ImageProcessingService();
    container.register('imageProcessingService', imageProcessingService);
    await imageProcessingService.initialize();
    console.log('✅ 圖片處理服務初始化完成');

    console.log('10. 載入並初始化費用對話服務...');
    const ExpenseChatService = require('./services/ExpenseChatService');
    const expenseChatService = new ExpenseChatService();
    container.register('expenseChatService', expenseChatService);
    await expenseChatService.initialize();
    console.log('✅ 費用對話服務初始化完成');

    console.log('11. 註冊中間件和控制器...');
    const pluginMiddleware = require('./middleware/pluginMiddleware');
    container.register('pluginMiddleware', pluginMiddleware);
    
    const eventBus = require('./core/EventBus');
    container.register('eventBus', eventBus);

    const UserController = require('./controllers/UserController');
    const AIController = require('./controllers/AIController');
    const WhatsAppController = require('./controllers/WhatsAppController');
    
    container.register('userController', new UserController(container));
    container.register('aiController', new AIController(container));
    container.register('whatsappController', new WhatsAppController(container));
    console.log('✅ 中間件和控制器註冊完成');

    console.log('12. 建立應用程式實例...');
    const Application = require('./core/Application');
    const app = new Application(container);
    console.log('✅ 應用程式實例建立完成');

    console.log('13. 初始化應用程式...');
    await app.initialize();
    console.log('✅ 應用程式初始化完成');

    console.log('14. 啟動應用程式...');
    const port = process.env.PORT || 3002;
    const server = await app.start(port);
    console.log(`✅ 應用程式啟動成功，監聽端口 ${port}`);

    // 等待 3 秒後關閉
    setTimeout(async () => {
      console.log('=== 測試完成，關閉應用程式 ===');
      await app.stop();
      process.exit(0);
    }, 3000);

  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
    console.error('錯誤堆疊:', error.stack);
    process.exit(1);
  }
}

testAppStepByStep(); 