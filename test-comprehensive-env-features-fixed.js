#!/usr/bin/env node

/**
 * WhatsApp Bot 全面功能測試程式 (修復版)
 * 基於當前 .env 配置測試所有啟用的功能
 */

const path = require('path');
const fs = require('fs');

// 顏色輸出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

class ComprehensiveTester {
  constructor() {
    this.testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      details: []
    };
    this.startTime = Date.now();
  }

  log(message, color = 'white') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  logHeader(message) {
    console.log('\n' + '='.repeat(60));
    this.log(`🧪 ${message}`, 'cyan');
    console.log('='.repeat(60));
  }

  logTest(testName, result, details = '') {
    this.testResults.total++;
    const status = result ? '✅ PASS' : '❌ FAIL';
    const color = result ? 'green' : 'red';
    
    this.log(`${status} ${testName}`, color);
    if (details) {
      this.log(`   ${details}`, 'yellow');
    }
    
    if (result) {
      this.testResults.passed++;
    } else {
      this.testResults.failed++;
    }
    
    this.testResults.details.push({
      name: testName,
      result,
      details
    });
  }

  logSkip(testName, reason = '') {
    this.testResults.total++;
    this.testResults.skipped++;
    this.log(`⏭️  SKIP ${testName}`, 'yellow');
    if (reason) {
      this.log(`   ${reason}`, 'yellow');
    }
  }

  async testEnvironmentConfiguration() {
    this.logHeader('環境配置測試');
    
    // 測試 .env 文件存在
    const envPath = path.join(__dirname, '.env');
    const envExists = fs.existsSync(envPath);
    this.logTest('ENV文件存在', envExists, envExists ? '找到 .env 文件' : '未找到 .env 文件');
    
    // 測試關鍵配置
    try {
      require('dotenv').config();
      
      const requiredConfigs = [
        'PORT',
        'SESSION_SECRET',
        'DB_PATH',
        'ANTHROPIC_API_KEY'
      ];
      
      for (const config of requiredConfigs) {
        const value = process.env[config];
        const exists = value && value.trim() !== '';
        this.logTest(`${config} 配置存在`, exists, exists ? `值: ${config === 'ANTHROPIC_API_KEY' ? '***' : value}` : '未設置');
      }
      
      // 測試功能開關
      const featureFlags = [
        'USE_V2_SERVICES',
        'USE_MULTI_TENANT',
        'USE_ADAPTER_LAYER',
        'USE_MONITORING_SYSTEM',
        'USE_HOT_RELOAD',
        'ENABLE_DEBUG_MODE'
      ];
      
      for (const flag of featureFlags) {
        const value = process.env[flag];
        const enabled = value === 'true';
        this.logTest(`${flag} 功能開關`, true, `${flag}: ${enabled ? '啟用' : '禁用'}`);
      }
      
    } catch (error) {
      this.logTest('環境配置載入', false, error.message);
    }
  }

  async testCoreServices() {
    this.logHeader('核心服務測試');
    
    try {
      // 測試 ServiceContainer
      const ServiceContainer = require('./core/ServiceContainer');
      const container = ServiceContainer.getInstance();
      this.logTest('ServiceContainer 初始化', !!container, '服務容器成功創建');
      
      // 測試 ServiceBootstrap
      const ServiceBootstrap = require('./core/ServiceBootstrap');
      const bootstrap = new ServiceBootstrap();
      this.logTest('ServiceBootstrap 初始化', !!bootstrap, '服務啟動器成功創建');
      
      // 測試 EventBus
      const eventBus = require('./core/EventBus');
      this.logTest('EventBus 初始化', !!eventBus, '事件總線成功創建');
      
      // 測試 StateManager
      const stateManager = require('./core/StateManager');
      this.logTest('StateManager 初始化', !!stateManager, '狀態管理器成功創建');
      
    } catch (error) {
      this.logTest('核心服務初始化', false, error.message);
    }
  }

  async testV2Services() {
    this.logHeader('V2服務系統測試');
    
    if (process.env.USE_V2_SERVICES !== 'true') {
      this.logSkip('V2服務測試', 'USE_V2_SERVICES 未啟用');
      return;
    }
    
    try {
      // 測試 V2 服務
      const v2Services = require('./services/v2');
      this.logTest('V2服務模組載入', !!v2Services, 'V2服務模組成功載入');
      
      // 測試 UserServiceV2
      const UserServiceV2 = require('./services/v2/UserServiceV2');
      const userServiceV2 = new UserServiceV2();
      this.logTest('UserServiceV2 初始化', !!userServiceV2, 'V2用戶服務成功創建');
      
      // 測試 AIServiceV2
      const AIServiceV2 = require('./services/v2/AIServiceV2');
      const aiServiceV2 = new AIServiceV2();
      this.logTest('AIServiceV2 初始化', !!aiServiceV2, 'V2 AI服務成功創建');
      
    } catch (error) {
      this.logTest('V2服務系統', false, error.message);
    }
  }

  async testMultiTenantSystem() {
    this.logHeader('多租戶架構測試');
    
    if (process.env.USE_MULTI_TENANT !== 'true') {
      this.logSkip('多租戶測試', 'USE_MULTI_TENANT 未啟用');
      return;
    }
    
    try {
      // 測試 TenantContext
      const { TenantContext } = require('./core/context/TenantContext');
      const context = TenantContext.create('test-tenant', 'test-user');
      this.logTest('TenantContext 創建', !!context, '租戶上下文成功創建');
      this.logTest('TenantContext.tenantId', context.tenantId === 'test-tenant', `租戶ID: ${context.tenantId}`);
      this.logTest('TenantContext.userId', context.userId === 'test-user', `用戶ID: ${context.userId}`);
      
    } catch (error) {
      this.logTest('多租戶架構', false, error.message);
    }
  }

  async testAdapterLayer() {
    this.logHeader('適配器層測試');
    
    if (process.env.USE_ADAPTER_LAYER !== 'true') {
      this.logSkip('適配器層測試', 'USE_ADAPTER_LAYER 未啟用');
      return;
    }
    
    try {
      // 測試適配器
      const adapters = [
        './core/adapters/UserServiceAdapter',
        './core/adapters/AIServiceAdapter',
        './core/adapters/WhatsAppServiceAdapter'
      ];
      
      for (const adapterPath of adapters) {
        try {
          const adapter = require(adapterPath);
          this.logTest(`${path.basename(adapterPath)} 載入`, !!adapter, '適配器成功載入');
        } catch (error) {
          this.logTest(`${path.basename(adapterPath)} 載入`, false, error.message);
        }
      }
      
    } catch (error) {
      this.logTest('適配器層', false, error.message);
    }
  }

  async testMonitoringSystem() {
    this.logHeader('監控系統測試');
    
    if (process.env.USE_MONITORING_SYSTEM !== 'true') {
      this.logSkip('監控系統測試', 'USE_MONITORING_SYSTEM 未啟用');
      return;
    }
    
    try {
      // 測試 MonitoringService
      const MonitoringService = require('./services/MonitoringService');
      const monitoringService = new MonitoringService();
      this.logTest('MonitoringService 初始化', !!monitoringService, '監控服務成功創建');
      
      // 測試指標收集
      const metrics = monitoringService.getMetrics();
      this.logTest('指標收集功能', !!metrics, '系統指標成功收集');
      
      // 測試健康檢查
      const health = monitoringService.getStatus();
      this.logTest('健康檢查功能', !!health, '系統健康狀態檢查成功');
      
    } catch (error) {
      this.logTest('監控系統', false, error.message);
    }
  }

  async testHotReloadSystem() {
    this.logHeader('熱重載系統測試');
    
    if (process.env.USE_HOT_RELOAD !== 'true') {
      this.logSkip('熱重載測試', 'USE_HOT_RELOAD 未啟用');
      return;
    }
    
    try {
      // 測試 HotReloadService
      const HotReloadService = require('./services/hotReloadService');
      const hotReloadService = new HotReloadService();
      this.logTest('HotReloadService 初始化', !!hotReloadService, '熱重載服務成功創建');
      
      // 測試文件監控
      const stats = hotReloadService.getStats();
      this.logTest('文件監控狀態', !!stats, `監控狀態: ${JSON.stringify(stats)}`);
      
    } catch (error) {
      this.logTest('熱重載系統', false, error.message);
    }
  }

  async testDatabaseConnection() {
    this.logHeader('數據庫連接測試');
    
    try {
      // 測試數據庫服務
      const DatabaseService = require('./services/databaseService');
      const dbService = new DatabaseService();
      this.logTest('DatabaseService 初始化', !!dbService, '數據庫服務成功創建');
      
      // 測試數據庫連接
      const health = await dbService.healthCheck();
      this.logTest('數據庫連接狀態', health.status === 'healthy', health.status === 'healthy' ? '數據庫連接正常' : `數據庫連接失敗: ${health.error}`);
      
    } catch (error) {
      this.logTest('數據庫連接', false, error.message);
    }
  }

  async testWhatsAppService() {
    this.logHeader('WhatsApp服務測試');
    
    try {
      // 測試 WhatsAppService
      const whatsappService = require('./services/WhatsAppService');
      this.logTest('WhatsAppService 初始化', !!whatsappService, 'WhatsApp服務成功創建');
      
      // 測試連接管理
      const hasConnectionManager = !!whatsappService.getClients;
      this.logTest('連接管理器', hasConnectionManager, 'WhatsApp連接管理器存在');
      
    } catch (error) {
      this.logTest('WhatsApp服務', false, error.message);
    }
  }

  async testAIService() {
    this.logHeader('AI服務測試');
    
    try {
      // 測試 AI服務
      const aiService = require('./services/aiService');
      this.logTest('AI服務模組載入', !!aiService, 'AI服務模組成功載入');
      
      // 測試 API 配置
      const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
      this.logTest('Anthropic API Key', hasApiKey, hasApiKey ? 'API Key 已配置' : 'API Key 未配置');
      
    } catch (error) {
      this.logTest('AI服務', false, error.message);
    }
  }

  async testSecurityMechanisms() {
    this.logHeader('安全機制測試');
    
    try {
      // 測試加密服務
      const { encryptionService } = require('./utils/encryption');
      this.logTest('加密服務載入', !!encryptionService, '加密服務成功載入');
      
      // 測試加密功能
      const testData = 'test-data';
      const encrypted = encryptionService.encrypt(testData);
      const decrypted = encryptionService.decrypt(encrypted);
      this.logTest('加密/解密功能', decrypted === testData, '加密解密功能正常');
      
    } catch (error) {
      this.logTest('安全機制', false, error.message);
    }
  }

  async testWebSocketService() {
    this.logHeader('WebSocket服務測試');
    
    try {
      // 測試 WebSocket服務
      const WebSocketService = require('./services/websocketService');
      const wsService = new WebSocketService();
      this.logTest('WebSocketService 初始化', !!wsService, 'WebSocket服務成功創建');
      
    } catch (error) {
      this.logTest('WebSocket服務', false, error.message);
    }
  }

  async testPluginSystem() {
    this.logHeader('插件系統測試');
    
    try {
      // 測試插件載入器
      const pluginLoader = require('./services/pluginLoader');
      this.logTest('PluginLoader 載入', !!pluginLoader, '插件載入器成功載入');
      
      // 測試插件目錄
      const pluginsDir = path.join(__dirname, 'services/plugins');
      const pluginsExist = fs.existsSync(pluginsDir);
      this.logTest('插件目錄存在', pluginsExist, pluginsExist ? '插件目錄找到' : '插件目錄不存在');
      
    } catch (error) {
      this.logTest('插件系統', false, error.message);
    }
  }

  async testControllers() {
    this.logHeader('控制器測試');
    
    try {
      // 測試控制器
      const controllers = [
        './controllers/UserController',
        './controllers/AIController',
        './controllers/WhatsAppController'
      ];
      
      for (const controllerPath of controllers) {
        try {
          const controller = require(controllerPath);
          this.logTest(`${path.basename(controllerPath)} 載入`, !!controller, '控制器成功載入');
        } catch (error) {
          this.logTest(`${path.basename(controllerPath)} 載入`, false, error.message);
        }
      }
      
    } catch (error) {
      this.logTest('控制器系統', false, error.message);
    }
  }

  async testRoutes() {
    this.logHeader('路由系統測試');
    
    try {
      // 測試路由
      const routes = [
        './routes/userRoutes',
        './routes/aiRoutes',
        './routes/whatsappRoutes',
        './routes/healthRoutes',
        './routes/monitoringRoutes',
        './routes/hotReloadRoutes'
      ];
      
      for (const routePath of routes) {
        try {
          const route = require(routePath);
          this.logTest(`${path.basename(routePath)} 載入`, !!route, '路由成功載入');
        } catch (error) {
          this.logTest(`${path.basename(routePath)} 載入`, false, error.message);
        }
      }
      
    } catch (error) {
      this.logTest('路由系統', false, error.message);
    }
  }

  async testMiddleware() {
    this.logHeader('中間件測試');
    
    try {
      // 測試中間件
      const middlewares = [
        './middleware/authMiddleware',
        './middleware/pluginMiddleware'
      ];
      
      for (const middlewarePath of middlewares) {
        try {
          const middleware = require(middlewarePath);
          this.logTest(`${path.basename(middlewarePath)} 載入`, !!middleware, '中間件成功載入');
        } catch (error) {
          this.logTest(`${path.basename(middlewarePath)} 載入`, false, error.message);
        }
      }
      
    } catch (error) {
      this.logTest('中間件系統', false, error.message);
    }
  }

  async testUtils() {
    this.logHeader('工具函數測試');
    
    try {
      // 測試工具函數
      const utils = [
        './utils/logger',
        './utils/dateUtils',
        './utils/envCheck'
      ];
      
      for (const utilPath of utils) {
        try {
          const util = require(utilPath);
          this.logTest(`${path.basename(utilPath)} 載入`, !!util, '工具函數成功載入');
        } catch (error) {
          this.logTest(`${path.basename(utilPath)} 載入`, false, error.message);
        }
      }
      
    } catch (error) {
      this.logTest('工具函數系統', false, error.message);
    }
  }

  async testApplicationStartup() {
    this.logHeader('應用程式啟動測試');
    
    try {
      // 測試應用程式模組
      const Application = require('./core/Application');
      this.logTest('應用程式模組載入', !!Application, '應用程式模組成功載入');
      
      // 測試應用程式實例化
      const app = new Application();
      this.logTest('應用程式實例化', !!app, '應用程式實例成功創建');
      
    } catch (error) {
      this.logTest('應用程式啟動', false, error.message);
    }
  }

  async runAllTests() {
    this.logHeader('WhatsApp Bot 全面功能測試開始');
    
    await this.testEnvironmentConfiguration();
    await this.testCoreServices();
    await this.testV2Services();
    await this.testMultiTenantSystem();
    await this.testAdapterLayer();
    await this.testMonitoringSystem();
    await this.testHotReloadSystem();
    await this.testDatabaseConnection();
    await this.testWhatsAppService();
    await this.testAIService();
    await this.testSecurityMechanisms();
    await this.testWebSocketService();
    await this.testPluginSystem();
    await this.testControllers();
    await this.testRoutes();
    await this.testMiddleware();
    await this.testUtils();
    await this.testApplicationStartup();
    
    this.generateReport();
  }

  generateReport() {
    this.logHeader('測試報告');
    
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
    const successRate = ((this.testResults.passed / this.testResults.total) * 100).toFixed(1);
    
    this.log(`\n📊 測試統計:`, 'cyan');
    this.log(`   總測試數: ${this.testResults.total}`, 'white');
    this.log(`   通過: ${this.testResults.passed}`, 'green');
    this.log(`   失敗: ${this.testResults.failed}`, 'red');
    this.log(`   跳過: ${this.testResults.skipped}`, 'yellow');
    this.log(`   成功率: ${successRate}%`, 'cyan');
    this.log(`   執行時間: ${duration}秒`, 'white');
    
    if (this.testResults.failed > 0) {
      this.log(`\n❌ 失敗的測試:`, 'red');
      this.testResults.details
        .filter(test => !test.result)
        .forEach(test => {
          this.log(`   - ${test.name}: ${test.details}`, 'red');
        });
      
      this.log(`\n🎯 建議:`, 'yellow');
      this.log(`⚠️  請檢查失敗的測試並修復問題。`, 'yellow');
    } else {
      this.log(`\n🎉 所有測試通過！`, 'green');
    }
    
    this.logHeader('');
  }
}

async function main() {
  const tester = new ComprehensiveTester();
  await tester.runAllTests();
}

// 執行測試
main().catch(error => {
  console.error('測試執行失敗:', error);
  process.exit(1);
}); 