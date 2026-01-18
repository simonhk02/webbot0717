/**
 * 實際部署測試
 * 啟動app.js並測試不同功能開關組合
 */

const { businessLogger } = require('./utils/logger');

// 測試配置
const TEST_SCENARIOS = [
  {
    name: '基礎模式',
    env: {
      USE_V2_SERVICES: 'false',
      USE_MULTI_TENANT: 'false',
      USE_MONITORING_SYSTEM: 'true'
    }
  },
  {
    name: 'V2服務模式', 
    env: {
      USE_V2_SERVICES: 'true',
      USE_ADAPTER_LAYER: 'true',
      USE_V2_USER_SERVICE: 'true'
    }
  },
  {
    name: '完整企業模式',
    env: {
      USE_V2_SERVICES: 'true',
      USE_MULTI_TENANT: 'true',
      USE_ADAPTER_LAYER: 'true',
      USE_MONITORING_SYSTEM: 'true',
      USE_SECURITY_MECHANISMS: 'true'
    }
  }
];

/**
 * 執行測試場景
 */
async function runTestScenario(scenario) {
  businessLogger.info(`\n🚀 測試場景: ${scenario.name}`);
  
  // 設置環境變數
  Object.entries(scenario.env).forEach(([key, value]) => {
    process.env[key] = value;
    businessLogger.info(`設置 ${key} = ${value}`);
  });
  
  try {
    // 測試服務容器和引導
    const ServiceContainer = require('./core/ServiceContainer');
    const ServiceBootstrap = require('./core/ServiceBootstrap');
    
    const container = ServiceContainer.getInstance();
    const bootstrap = new ServiceBootstrap(container);
    
    // 執行服務引導
    await bootstrap.bootstrap();
    businessLogger.info('✅ 服務引導成功');
    
    // 測試核心服務
    const services = ['userService', 'aiService', 'whatsAppService'];
    for (const serviceName of services) {
      const service = container.resolve(serviceName);
      businessLogger.info(`✅ ${serviceName} 服務解析成功`);
    }
    
    return true;
  } catch (error) {
    businessLogger.error(`❌ ${scenario.name} 測試失敗: ${error.message}`);
    return false;
  }
}

/**
 * 主測試函數
 */
async function runActualDeploymentTest() {
  businessLogger.info('🎯 開始實際部署測試');
  
  let passedScenarios = 0;
  let totalScenarios = TEST_SCENARIOS.length;
  
  for (const scenario of TEST_SCENARIOS) {
    const result = await runTestScenario(scenario);
    if (result) {
      passedScenarios++;
    }
  }
  
  const successRate = (passedScenarios / totalScenarios) * 100;
  businessLogger.info(`\n📊 測試結果: ${passedScenarios}/${totalScenarios} (${successRate.toFixed(1)}%)`);
  
  return successRate >= 80;
}

// 執行測試
if (require.main === module) {
  runActualDeploymentTest()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      businessLogger.error(`測試失敗: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { runActualDeploymentTest }; 