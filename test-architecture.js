/**
 * 架構測試腳本
 * 測試新的 MVC 架構是否正常運作
 */

const assert = require('assert');
const ServiceContainer = require('./core/ServiceContainer');
const Application = require('./core/Application');
const UserController = require('./controllers/UserController');
const WhatsAppController = require('./controllers/WhatsAppController');
const AIController = require('./controllers/AIController');
const UserRepository = require('./repositories/UserRepository');
const PluginRepository = require('./repositories/PluginRepository');
const logger = require('./utils/logger');

// 模擬服務
class MockDatabaseService {
  async initialize() { return true; }
  async cleanup() { return true; }
  async get() { return {}; }
  async run() { return {}; }
  async all() { return []; }
}

class MockRedisService {
  async initialize() { return true; }
  async cleanup() { return true; }
}

class MockWhatsAppService {
  async initialize() { return true; }
  async cleanup() { return true; }
  async getConnectionStatus() { return 'connected'; }
  async sendMessage() { return { success: true }; }
}

class MockAIService {
  async initialize() { return true; }
  async cleanup() { return true; }
  async generateResponse() { return 'test response'; }
  async analyzeImage() { return { description: 'test image' }; }
}

class MockUserService {
  async initialize() { return true; }
  async cleanup() { return true; }
  async registerUser() { return { id: 1, username: 'test' }; }
  async loginUser() { return { token: 'test-token' }; }
  async getUserSettings() { return { theme: 'dark' }; }
  async updateUserSettings() { return { success: true }; }
}

class MockPluginMiddleware {
  constructor() {
    return (req, res, next) => next();
  }
}

class MockEventBus {
  async emit() { return true; }
  on() { return this; }
  off() { return this; }
}

// 測試函數
async function runTests() {
  console.log('開始架構測試...\n');
  
  try {
    // 建立服務容器
    const container = new ServiceContainer();
    
    // 註冊模擬服務
    container.register('logger', logger);
    container.register('databaseService', new MockDatabaseService());
    container.register('redisService', new MockRedisService());
    container.register('whatsappService', new MockWhatsAppService());
    container.register('aiService', new MockAIService());
    container.register('userService', new MockUserService());
    container.register('pluginMiddleware', new MockPluginMiddleware());
    container.register('eventBus', new MockEventBus());
    
    // 註冊控制器
    container.register('userController', new UserController(container));
    container.register('whatsappController', new WhatsAppController(container));
    container.register('aiController', new AIController(container));
    
    // 測試 1: 測試控制器初始化
    console.log('測試 1: 控制器初始化');
    const userController = new UserController(container);
    const whatsappController = new WhatsAppController(container);
    const aiController = new AIController(container);
    assert(userController, '使用者控制器初始化失敗');
    assert(whatsappController, 'WhatsApp 控制器初始化失敗');
    assert(aiController, 'AI 控制器初始化失敗');
    console.log('✅ 控制器初始化測試通過\n');
    
    // 測試 2: 測試資料存取層初始化
    console.log('測試 2: 資料存取層初始化');
    const userRepo = new UserRepository(container);
    const pluginRepo = new PluginRepository(container);
    assert(userRepo, '使用者資料存取層初始化失敗');
    assert(pluginRepo, '插件資料存取層初始化失敗');
    console.log('✅ 資料存取層初始化測試通過\n');
    
    // 測試 3: 測試應用程式初始化
    console.log('測試 3: 應用程式初始化');
    const app = new Application(container);
    await app.initialize();
    console.log('✅ 應用程式初始化測試通過\n');
    
    // 測試 4: 測試服務依賴注入
    console.log('測試 4: 服務依賴注入');
    assert(container.resolve('logger'), '無法解析 logger 服務');
    assert(container.resolve('databaseService'), '無法解析資料庫服務');
    assert(container.resolve('whatsappService'), '無法解析 WhatsApp 服務');
    assert(container.resolve('aiService'), '無法解析 AI 服務');
    assert(container.resolve('userService'), '無法解析使用者服務');
    console.log('✅ 服務依賴注入測試通過\n');
    
    // 測試 5: 測試控制器方法
    console.log('測試 5: 測試控制器方法');
    const mockReq = { body: {}, user: { id: 1 } };
    const mockRes = {
      json: () => {},
      status: () => ({ json: () => {} })
    };
    await userController.register(mockReq, mockRes);
    await whatsappController.getConnectionStatus(mockReq, mockRes);
    await aiController.chat(mockReq, mockRes);
    console.log('✅ 控制器方法測試通過\n');
    
    // 測試 6: 測試資料存取層方法
    console.log('測試 6: 測試資料存取層方法');
    await userRepo.findById(1);
    await pluginRepo.getAllPlugins();
    console.log('✅ 資料存取層方法測試通過\n');
    
    // 測試 7: 測試應用程式啟動和關閉
    console.log('測試 7: 應用程式生命週期');
    const server = await app.start(3002);
    assert(server.listening, '應用程式啟動失敗');
    server.close();
    console.log('✅ 應用程式生命週期測試通過\n');
    
    console.log('🎉 所有測試通過！');
    
  } catch (error) {
    console.error('❌ 測試失敗:', error);
    process.exit(1);
  }
}

// 執行測試
runTests(); 