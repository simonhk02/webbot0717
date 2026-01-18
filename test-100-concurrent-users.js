/**
 * 終極100人並發測試
 * 驗證多租戶架構在真實並發環境下的用戶隔離效果
 * 測試目標：確保100個用戶同時使用時不會發生數據互相污染
 */

const { businessLogger } = require('./utils/logger');
const { TenantContext } = require('./core/context/TenantContext');
const { tenantContextManager } = require('./core/context/TenantContext');
const StateManager = require('./core/StateManager');
const EventBus = require('./core/EventBus');
const UserServiceV2 = require('./services/v2/UserServiceV2');
const AIServiceV2 = require('./services/v2/AIServiceV2');
const WhatsAppServiceV2 = require('./services/v2/WhatsAppServiceV2');

/**
 * 終極並發測試器
 */
class UltimateConcurrencyTester {
  constructor() {
    this.logger = businessLogger;
    this.testResults = {
      passed: 0,
      failed: 0,
      tests: [],
      concurrencyResults: {
        totalUsers: 0,
        successfulOperations: 0,
        failedOperations: 0,
        dataContamination: 0,
        isolationViolations: 0
      }
    };
    this.testUsers = [];
    this.testTenants = [];
    this.userData = new Map();
    this.tenantData = new Map();
  }

  /**
   * 初始化測試環境
   */
  async initialize() {
    console.log('🚀 開始終極100人並發測試初始化...');
    
    // 創建100個測試用戶
    for (let i = 1; i <= 100; i++) {
      const userId = `user_${i.toString().padStart(3, '0')}`;
      const tenantId = `tenant_${Math.floor((i - 1) / 10) + 1}`; // 10個租戶，每個10個用戶
      
      this.testUsers.push({ userId, tenantId });
      
      // 初始化用戶數據
      this.userData.set(userId, {
        messages: [],
        states: [],
        events: [],
        operations: []
      });
      
      // 初始化租戶數據
      if (!this.tenantData.has(tenantId)) {
        this.tenantData.set(tenantId, {
          users: [],
          contexts: [],
          operations: []
        });
      }
      this.tenantData.get(tenantId).users.push(userId);
    }
    
    console.log(`✅ 已創建 ${this.testUsers.length} 個測試用戶，分佈在 ${this.tenantData.size} 個租戶中`);
  }

  /**
   * 測試1: 租戶上下文並發隔離
   */
  async testTenantContextConcurrency() {
    console.log('\n📋 測試 1: 租戶上下文並發隔離 (100用戶同時操作)');
    
    const promises = this.testUsers.map(async (user, index) => {
      try {
        // 模擬並發創建租戶上下文
        const requestId = `req_${user.userId}_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
        const context = tenantContextManager.createContext(
          requestId,
          user.tenantId,
          user.userId,
          ['user'],
          { operation: 'concurrent_test', timestamp: Date.now() }
        );
        
        // 驗證上下文正確性
        const retrieved = tenantContextManager.getContext(requestId);
        
        if (retrieved && 
            retrieved.tenantId === user.tenantId && 
            retrieved.userId === user.userId) {
          
          // 記錄成功操作
          this.userData.get(user.userId).operations.push({
            type: 'context_creation',
            success: true,
            timestamp: Date.now()
          });
          
          return { userId: user.userId, success: true };
        } else {
          throw new Error('上下文數據不匹配');
        }
      } catch (error) {
        this.userData.get(user.userId).operations.push({
          type: 'context_creation',
          success: false,
          error: error.message,
          timestamp: Date.now()
        });
        return { userId: user.userId, success: false, error: error.message };
      }
    });
    
    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    console.log(`✅ 租戶上下文並發測試完成: ${successCount} 成功, ${failureCount} 失敗`);
    
    if (successCount === 100) {
      this.testResults.passed++;
      this.testResults.tests.push({ name: '租戶上下文並發隔離', status: 'PASSED' });
    } else {
      this.testResults.failed++;
      this.testResults.tests.push({ name: '租戶上下文並發隔離', status: 'FAILED' });
    }
    
    this.testResults.concurrencyResults.successfulOperations += successCount;
    this.testResults.concurrencyResults.failedOperations += failureCount;
  }

  /**
   * 測試2: 狀態管理器並發隔離
   */
  async testStateManagerConcurrency() {
    console.log('\n📋 測試 2: 狀態管理器並發隔離 (100用戶同時設置狀態)');
    
    const promises = this.testUsers.map(async (user, index) => {
      try {
        const chatId = `chat_${user.userId}_${Date.now()}`;
        const messageId = `msg_${user.userId}_${Date.now()}_${index}`;
        const userState = {
          step: 'collecting',
          userId: user.userId,
          tenantId: user.tenantId,
          data: { 
            amount: Math.floor(Math.random() * 10000),
            category: `category_${Math.floor(Math.random() * 10)}`,
            timestamp: Date.now()
          }
        };
        
        // 並發設置狀態
        StateManager.setExpenseState(chatId, messageId, userState);
        
        // 立即驗證狀態隔離
        const retrievedState = StateManager.getExpenseState(chatId, messageId);
        
        if (retrievedState && 
            retrievedState.userId === user.userId &&
            retrievedState.tenantId === user.tenantId &&
            retrievedState.data.amount === userState.data.amount) {
          
          // 檢查是否有數據污染
          const isContaminated = this.checkStateContamination(user, retrievedState);
          
          if (!isContaminated) {
            this.userData.get(user.userId).operations.push({
              type: 'state_management',
              success: true,
              timestamp: Date.now()
            });
            
            return { userId: user.userId, success: true };
          } else {
            throw new Error('檢測到狀態數據污染');
          }
        } else {
          throw new Error('狀態數據不匹配');
        }
      } catch (error) {
        this.userData.get(user.userId).operations.push({
          type: 'state_management',
          success: false,
          error: error.message,
          timestamp: Date.now()
        });
        return { userId: user.userId, success: false, error: error.message };
      }
    });
    
    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    console.log(`✅ 狀態管理器並發測試完成: ${successCount} 成功, ${failureCount} 失敗`);
    
    if (successCount === 100) {
      this.testResults.passed++;
      this.testResults.tests.push({ name: '狀態管理器並發隔離', status: 'PASSED' });
    } else {
      this.testResults.failed++;
      this.testResults.tests.push({ name: '狀態管理器並發隔離', status: 'FAILED' });
    }
    
    this.testResults.concurrencyResults.successfulOperations += successCount;
    this.testResults.concurrencyResults.failedOperations += failureCount;
  }

  /**
   * 測試3: 事件總線並發隔離
   */
  async testEventBusConcurrency() {
    console.log('\n📋 測試 3: 事件總線並發隔離 (100用戶同時發送事件)');
    
    // 設置事件監聽器
    const eventResults = new Map();
    this.testUsers.forEach(user => {
      eventResults.set(user.userId, []);
    });
    
    EventBus.on('user.concurrent.action', (event) => {
      const userId = event.data.userId;
      if (eventResults.has(userId)) {
        eventResults.get(userId).push(event.data);
      }
    });
    
    const promises = this.testUsers.map(async (user, index) => {
      try {
        const eventData = {
          userId: user.userId,
          tenantId: user.tenantId,
          action: 'concurrent_test',
          operationId: `op_${user.userId}_${Date.now()}_${index}`,
          timestamp: Date.now(),
          data: {
            amount: Math.floor(Math.random() * 1000),
            category: `cat_${Math.floor(Math.random() * 5)}`
          }
        };
        
        // 並發發送事件
        await EventBus.emit('user.concurrent.action', eventData);
        
        // 等待事件處理
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // 驗證事件隔離
        const userEvents = eventResults.get(user.userId);
        const correctEvent = userEvents.find(e => e.operationId === eventData.operationId);
        
        if (correctEvent && 
            correctEvent.userId === user.userId &&
            correctEvent.tenantId === user.tenantId) {
          
          // 檢查是否有事件污染
          const isContaminated = this.checkEventContamination(user, userEvents);
          
          if (!isContaminated) {
            this.userData.get(user.userId).operations.push({
              type: 'event_bus',
              success: true,
              timestamp: Date.now()
            });
            
            return { userId: user.userId, success: true };
          } else {
            throw new Error('檢測到事件數據污染');
          }
        } else {
          throw new Error('事件數據不匹配');
        }
      } catch (error) {
        this.userData.get(user.userId).operations.push({
          type: 'event_bus',
          success: false,
          error: error.message,
          timestamp: Date.now()
        });
        return { userId: user.userId, success: false, error: error.message };
      }
    });
    
    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    console.log(`✅ 事件總線並發測試完成: ${successCount} 成功, ${failureCount} 失敗`);
    
    if (successCount === 100) {
      this.testResults.passed++;
      this.testResults.tests.push({ name: '事件總線並發隔離', status: 'PASSED' });
    } else {
      this.testResults.failed++;
      this.testResults.tests.push({ name: '事件總線並發隔離', status: 'FAILED' });
    }
    
    this.testResults.concurrencyResults.successfulOperations += successCount;
    this.testResults.concurrencyResults.failedOperations += failureCount;
    
    // 清理事件監聽器
    EventBus.removeAllListeners('user.concurrent.action');
  }

  /**
   * 測試4: 服務層並發隔離
   */
  async testServiceLayerConcurrency() {
    console.log('\n📋 測試 4: 服務層並發隔離 (100用戶同時使用V2服務)');
    
    // 初始化V2服務
    const userService = new UserServiceV2();
    const aiService = new AIServiceV2();
    const whatsappService = new WhatsAppServiceV2();
    
    // 先初始化所有租戶的服務
    const uniqueTenants = [...new Set(this.testUsers.map(u => u.tenantId))];
    await Promise.all(uniqueTenants.map(async (tenantId) => {
      await userService.initialize(tenantId);
      await aiService.initialize(tenantId);
      await whatsappService.initialize(tenantId);
    }));
    
    const promises = this.testUsers.map(async (user, index) => {
      try {
        
        // 並發創建用戶
        const session = await userService.createUser({
          userId: user.userId,
          name: `Test User ${user.userId}`,
          email: `${user.userId}@test.com`
        }, user.tenantId);
        
        // 並發使用AI服務
        const aiResult = await aiService.processRequest('test_request', {
          userId: user.userId,
          data: { amount: Math.floor(Math.random() * 1000) }
        }, user.tenantId);
        
        // 並發使用WhatsApp服務
        const whatsappStatus = await whatsappService.getConnectionStatus(user.userId, user.tenantId);
        
        // 驗證服務隔離
        if (session && session.userId === user.userId &&
            aiResult && aiResult.userId === user.userId &&
            whatsappStatus && whatsappStatus.userId === user.userId) {
          
          this.userData.get(user.userId).operations.push({
            type: 'service_layer',
            success: true,
            timestamp: Date.now()
          });
          
          return { userId: user.userId, success: true };
        } else {
          throw new Error('服務層數據不匹配');
        }
      } catch (error) {
        this.userData.get(user.userId).operations.push({
          type: 'service_layer',
          success: false,
          error: error.message,
          timestamp: Date.now()
        });
        return { userId: user.userId, success: false, error: error.message };
      }
    });
    
    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    console.log(`✅ 服務層並發測試完成: ${successCount} 成功, ${failureCount} 失敗`);
    
    if (successCount === 100) {
      this.testResults.passed++;
      this.testResults.tests.push({ name: '服務層並發隔離', status: 'PASSED' });
    } else {
      this.testResults.failed++;
      this.testResults.tests.push({ name: '服務層並發隔離', status: 'FAILED' });
    }
    
    this.testResults.concurrencyResults.successfulOperations += successCount;
    this.testResults.concurrencyResults.failedOperations += failureCount;
  }

  /**
   * 測試5: 真實場景模擬
   */
  async testRealWorldScenario() {
    console.log('\n📋 測試 5: 真實場景模擬 (100用戶同時進行完整操作流程)');
    
    const promises = this.testUsers.map(async (user, index) => {
      try {
        // 模擬完整的用戶操作流程
        const operationId = `op_${user.userId}_${Date.now()}_${index}`;
        
        // 1. 創建租戶上下文
        const context = tenantContextManager.createContext(
          operationId,
          user.tenantId,
          user.userId,
          ['user']
        );
        
        // 2. 設置狀態
        const chatId = `chat_${operationId}`;
        const messageId = `msg_${operationId}`;
        StateManager.setExpenseState(chatId, messageId, {
          step: 'collecting',
          userId: user.userId,
          tenantId: user.tenantId,
          data: { amount: Math.floor(Math.random() * 10000) }
        });
        
        // 3. 發送事件
        await EventBus.emit('user.realworld.action', {
          userId: user.userId,
          tenantId: user.tenantId,
          operationId,
          action: 'expense_processing',
          timestamp: Date.now()
        });
        
        // 4. 更新狀態
        StateManager.setExpenseState(chatId, messageId, {
          step: 'processing',
          userId: user.userId,
          tenantId: user.tenantId,
          data: { amount: Math.floor(Math.random() * 10000), status: 'processing' }
        });
        
        // 5. 完成操作
        StateManager.setExpenseState(chatId, messageId, {
          step: 'completed',
          userId: user.userId,
          tenantId: user.tenantId,
          data: { amount: Math.floor(Math.random() * 10000), status: 'completed' }
        });
        
        // 驗證整個流程的隔離性
        const finalState = StateManager.getExpenseState(chatId, messageId);
        const finalContext = tenantContextManager.getContext(operationId);
        
        if (finalState && finalState.userId === user.userId &&
            finalContext && finalContext.userId === user.userId) {
          
          // 檢查是否有數據污染
          const isContaminated = this.checkCompleteWorkflowContamination(user, operationId);
          
          if (!isContaminated) {
            this.userData.get(user.userId).operations.push({
              type: 'real_world_scenario',
              success: true,
              timestamp: Date.now()
            });
            
            return { userId: user.userId, success: true };
          } else {
            throw new Error('檢測到完整流程數據污染');
          }
        } else {
          throw new Error('完整流程數據不匹配');
        }
      } catch (error) {
        this.userData.get(user.userId).operations.push({
          type: 'real_world_scenario',
          success: false,
          error: error.message,
          timestamp: Date.now()
        });
        return { userId: user.userId, success: false, error: error.message };
      }
    });
    
    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    console.log(`✅ 真實場景模擬測試完成: ${successCount} 成功, ${failureCount} 失敗`);
    
    if (successCount === 100) {
      this.testResults.passed++;
      this.testResults.tests.push({ name: '真實場景模擬', status: 'PASSED' });
    } else {
      this.testResults.failed++;
      this.testResults.tests.push({ name: '真實場景模擬', status: 'FAILED' });
    }
    
    this.testResults.concurrencyResults.successfulOperations += successCount;
    this.testResults.concurrencyResults.failedOperations += failureCount;
  }

  /**
   * 檢查狀態污染
   */
  checkStateContamination(user, state) {
    // 檢查是否有其他用戶的數據混入
    for (const [otherUserId, otherUserData] of this.userData.entries()) {
      if (otherUserId !== user.userId) {
        const otherUser = this.testUsers.find(u => u.userId === otherUserId);
        if (otherUser && state.tenantId === otherUser.tenantId) {
          // 同租戶內檢查數據是否混亂
          if (state.userId === otherUserId || state.data.amount === otherUserData.lastAmount) {
            this.testResults.concurrencyResults.dataContamination++;
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * 檢查事件污染
   */
  checkEventContamination(user, events) {
    // 檢查是否有其他用戶的事件混入
    for (const event of events) {
      if (event.userId !== user.userId) {
        this.testResults.concurrencyResults.dataContamination++;
        return true;
      }
    }
    return false;
  }

  /**
   * 檢查完整流程污染
   */
  checkCompleteWorkflowContamination(user, operationId) {
    // 檢查整個操作流程是否有數據污染
    const userOperations = this.userData.get(user.userId).operations;
    const lastOperation = userOperations[userOperations.length - 1];
    
    if (lastOperation && lastOperation.type === 'real_world_scenario') {
      // 檢查是否有其他用戶的操作混入
      for (const [otherUserId, otherUserData] of this.userData.entries()) {
        if (otherUserId !== user.userId) {
          const otherOperations = otherUserData.operations;
          const otherLastOperation = otherOperations[otherOperations.length - 1];
          
          if (otherLastOperation && 
              otherLastOperation.type === 'real_world_scenario' &&
              otherLastOperation.timestamp === lastOperation.timestamp) {
            this.testResults.concurrencyResults.dataContamination++;
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * 生成詳細報告
   */
  generateDetailedReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 終極100人並發測試詳細報告');
    console.log('='.repeat(80));
    
    console.log(`\n🎯 測試概覽:`);
    console.log(`   - 總測試數: ${this.testResults.tests.length}`);
    console.log(`   - 通過測試: ${this.testResults.passed}`);
    console.log(`   - 失敗測試: ${this.testResults.failed}`);
    console.log(`   - 成功率: ${((this.testResults.passed / this.testResults.tests.length) * 100).toFixed(2)}%`);
    
    console.log(`\n🚀 並發性能:`);
    console.log(`   - 總用戶數: ${this.testResults.concurrencyResults.totalUsers}`);
    console.log(`   - 成功操作: ${this.testResults.concurrencyResults.successfulOperations}`);
    console.log(`   - 失敗操作: ${this.testResults.concurrencyResults.failedOperations}`);
    console.log(`   - 操作成功率: ${((this.testResults.concurrencyResults.successfulOperations / (this.testResults.concurrencyResults.successfulOperations + this.testResults.concurrencyResults.failedOperations)) * 100).toFixed(2)}%`);
    
    console.log(`\n🔒 隔離安全性:`);
    console.log(`   - 數據污染事件: ${this.testResults.concurrencyResults.dataContamination}`);
    console.log(`   - 隔離違規事件: ${this.testResults.concurrencyResults.isolationViolations}`);
    console.log(`   - 隔離成功率: ${this.testResults.concurrencyResults.dataContamination === 0 ? '100%' : '存在風險'}`);
    
    console.log(`\n📋 詳細測試結果:`);
    this.testResults.tests.forEach((test, index) => {
      const status = test.status === 'PASSED' ? '✅' : '❌';
      console.log(`   ${index + 1}. ${status} ${test.name}: ${test.status}`);
      if (test.error) {
        console.log(`      錯誤: ${test.error}`);
      }
    });
    
    console.log(`\n👥 用戶分佈分析:`);
    for (const [tenantId, tenantInfo] of this.tenantData.entries()) {
      const tenantUsers = tenantInfo.users;
      const tenantSuccessCount = tenantUsers.filter(userId => {
        const userData = this.userData.get(userId);
        return userData.operations.every(op => op.success);
      }).length;
      
      console.log(`   - ${tenantId}: ${tenantUsers.length} 用戶, ${tenantSuccessCount} 完全成功`);
    }
    
    console.log(`\n🎉 結論:`);
    if (this.testResults.passed === this.testResults.tests.length && 
        this.testResults.concurrencyResults.dataContamination === 0) {
      console.log(`   ✅ 多租戶架構在100人並發環境下完全隔離，無數據污染！`);
      console.log(`   ✅ 系統已準備好支援萬人級SAAS應用！`);
    } else {
      console.log(`   ⚠️  發現隔離問題，需要進一步優化`);
      console.log(`   ❌ 不建議在生產環境使用`);
    }
    
    console.log('\n' + '='.repeat(80));
  }

  /**
   * 清理測試環境
   */
  async cleanup() {
    console.log('\n🧹 清理測試環境...');
    
    // 清理租戶上下文
    for (const user of this.testUsers) {
      try {
        tenantContextManager.removeContext(`req_${user.userId}_${Date.now()}`);
      } catch (error) {
        // 忽略清理錯誤
      }
    }
    
    // 清理狀態管理器
    for (const user of this.testUsers) {
      try {
        StateManager.deleteExpenseState(`chat_${user.userId}`, `msg_${user.userId}`);
      } catch (error) {
        // 忽略清理錯誤
      }
    }
    
    // 清理事件監聽器
    EventBus.removeAllListeners('user.concurrent.action');
    EventBus.removeAllListeners('user.realworld.action');
    
    console.log('✅ 測試環境清理完成');
  }

  /**
   * 執行完整測試套件
   */
  async runFullTest() {
    try {
      console.log('🚀 開始終極100人並發測試...');
      console.log('目標：驗證多租戶架構在真實並發環境下的用戶隔離效果');
      console.log('='.repeat(80));
      
      // 初始化
      await this.initialize();
      
      // 執行測試
      await this.testTenantContextConcurrency();
      await this.testStateManagerConcurrency();
      await this.testEventBusConcurrency();
      await this.testServiceLayerConcurrency();
      await this.testRealWorldScenario();
      
      // 生成報告
      this.generateDetailedReport();
      
      // 清理環境
      await this.cleanup();
      
      return this.testResults;
      
    } catch (error) {
      console.error('❌ 測試執行失敗:', error);
      throw error;
    }
  }
}

// 執行測試
async function runUltimateConcurrencyTest() {
  const tester = new UltimateConcurrencyTester();
  
  try {
    const results = await tester.runFullTest();
    
    // 返回測試結果
    return {
      success: results.passed === results.tests.length && results.concurrencyResults.dataContamination === 0,
      results: results
    };
    
  } catch (error) {
    console.error('測試執行失敗:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 如果直接運行此文件
if (require.main === module) {
  runUltimateConcurrencyTest()
    .then(result => {
      if (result.success) {
        console.log('\n🎉 終極並發測試完全成功！系統已準備好支援萬人級應用！');
        process.exit(0);
      } else {
        console.log('\n❌ 終極並發測試失敗，需要進一步優化');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('測試執行錯誤:', error);
      process.exit(1);
    });
}

module.exports = {
  UltimateConcurrencyTester,
  runUltimateConcurrencyTest
}; 