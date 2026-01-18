/**
 * 對話流程並發測試
 * 專門測試多用戶對話流程的並發安全性
 */

const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');

// 引入核心模組
const TenantStateManager = require('./core/TenantStateManager');
const stateManager = require('./core/StateManager');
const { businessLogger } = require('./utils/logger');

/**
 * 模擬 AI 服務
 */
class MockAIService {
  constructor() {
    this.requestCount = 0;
    this.processingTimes = [];
    this.concurrentRequests = 0;
    this.maxConcurrentRequests = 0;
  }

  async recognizeImage(imageBuffer, userId) {
    this.concurrentRequests++;
    this.maxConcurrentRequests = Math.max(this.maxConcurrentRequests, this.concurrentRequests);
    
    const startTime = performance.now();
    this.requestCount++;
    
    try {
      // 模擬 AI 處理時間（100-500ms）
      await new Promise(resolve => setTimeout(resolve, Math.random() * 400 + 100));
      
      // 模擬識別結果
      const result = {
        rawText: `模擬識別結果 ${this.requestCount}`,
        parsedData: {
          '店舖名稱': `店舖${this.requestCount}`,
          '日期': new Date().toISOString().split('T')[0],
          '銀碼': (Math.random() * 1000).toFixed(2)
        }
      };
      
      const endTime = performance.now();
      this.processingTimes.push(endTime - startTime);
      
      return result;
    } finally {
      this.concurrentRequests--;
    }
  }

  getStats() {
    return {
      totalRequests: this.requestCount,
      maxConcurrentRequests: this.maxConcurrentRequests,
      averageProcessingTime: this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length,
      minProcessingTime: Math.min(...this.processingTimes),
      maxProcessingTime: Math.max(...this.processingTimes)
    };
  }
}

/**
 * 模擬 WhatsApp 客戶端
 */
class MockWhatsAppClient {
  constructor(userId) {
    this.userId = userId;
    this.messageQueue = [];
    this.isProcessing = false;
  }

  async sendMessage(chatId, message) {
    // 模擬發送延遲
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10));
    
    this.messageQueue.push({
      chatId,
      message,
      timestamp: Date.now()
    });
    
    return { id: `msg_${Date.now()}_${Math.random()}` };
  }

  async readMessages(keys) {
    // 模擬讀取延遲
    await new Promise(resolve => setTimeout(resolve, Math.random() * 20 + 5));
    return true;
  }

  async sendPresenceUpdate(presence, chatId) {
    // 模擬 presence 更新
    await new Promise(resolve => setTimeout(resolve, Math.random() * 10 + 2));
    return true;
  }
}

/**
 * 對話流程並發測試類
 */
class ConversationFlowConcurrencyTest {
  constructor() {
    this.users = new Map();
    this.stateManager = stateManager;
    this.tenantStateManager = new TenantStateManager('test-tenant');
    this.aiService = new MockAIService();
    this.results = [];
    this.errors = [];
    this.startTime = Date.now();
  }

  /**
   * 初始化測試環境
   */
  async setup() {
    businessLogger.info('🔧 初始化對話流程並發測試環境...');
    
    // 創建測試用戶
    for (let i = 1; i <= 10; i++) {
      const userId = `user-${i}`;
      const client = new MockWhatsAppClient(userId);
      
      this.users.set(userId, {
        client,
        chatId: `chat-${i}`,
        groupName: `測試群組${i}`,
        enableAI: true,
        customQuestions: [
          { field: '店舖名稱', question: '店舖名稱' },
          { field: '日期', question: '日期' },
          { field: '銀碼', question: '銀碼' }
        ]
      });
    }
    
    businessLogger.info('✅ 對話流程並發測試環境初始化完成');
  }

  /**
   * 測試 1: 消息處理競態條件
   */
  async testMessageProcessingRaceCondition() {
    businessLogger.info('🔄 開始測試消息處理競態條件...');
    const startTime = performance.now();
    
    try {
      const concurrentMessages = [];
      
      // 模擬多個用戶同時發送消息
      for (let i = 1; i <= 50; i++) {
        const userId = `user-${(i % 10) + 1}`;
        const msgId = `msg-${i}`;
        
        concurrentMessages.push(
          this.simulateMessageProcessing(userId, msgId, i)
        );
      }
      
      // 等待所有消息處理完成
      const results = await Promise.allSettled(concurrentMessages);
      
      // 分析結果
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      // 檢查是否有重複處理
      const duplicateProcessing = this.checkDuplicateProcessing();
      
      const duration = performance.now() - startTime;
      
      this.results.push({
        testName: 'message_processing_race_condition',
        success: failed === 0 && duplicateProcessing.length === 0,
        duration,
        details: {
          totalMessages: concurrentMessages.length,
          successful,
          failed,
          duplicateProcessing: duplicateProcessing.length,
          duplicateDetails: duplicateProcessing
        },
        message: duplicateProcessing.length > 0 ? 
          `發現 ${duplicateProcessing.length} 個重複處理` : 
          '消息處理正常'
      });
      
      if (duplicateProcessing.length > 0) {
        this.errors.push({
          testName: 'message_processing_race_condition',
          error: `重複處理消息: ${duplicateProcessing.map(d => d.msgId).join(', ')}`,
          details: duplicateProcessing
        });
      }
      
    } catch (error) {
      this.errors.push({
        testName: 'message_processing_race_condition',
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * 模擬消息處理
   */
  async simulateMessageProcessing(userId, msgId, sequence) {
    try {
      // 模擬消息到達
      const msg = {
        key: { id: msgId, remoteJid: `chat-${userId}` },
        message: { conversation: `測試消息 ${sequence}` }
      };
      
      // 檢查是否已處理（模擬競態條件）
      if (this.stateManager.isMessageProcessed(msgId) || 
          this.stateManager.isMessageSuppressed(msgId) ||
          this.stateManager.isMessageProcessing(msgId)) {
        return { userId, msgId, result: 'skipped', reason: 'already_processed' };
      }
      
      // 標記為處理中
      this.stateManager.markMessageProcessing(msgId);
      
      // 模擬處理延遲
      await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10));
      
      // 模擬處理邏輯
      const userData = this.users.get(userId);
      if (userData && userData.enableAI) {
        // 模擬圖片識別
        const imageBuffer = Buffer.from(`fake-image-${sequence}`);
        const aiResult = await this.aiService.recognizeImage(imageBuffer, userId);
        
        // 設置 AI 確認狀態
        this.stateManager.setAIConfirmationState(userData.chatId, msgId, {
          parsedData: aiResult.parsedData,
          userId: userId,
          timestamp: Date.now()
        });
      }
      
      // 完成處理
      this.stateManager.completeMessageProcessing(msgId);
      
      return { userId, msgId, result: 'processed', sequence };
      
    } catch (error) {
      this.errors.push({
        testName: 'message_processing_simulation',
        error: error.message,
        details: { userId, msgId, sequence }
      });
      throw error;
    }
  }

  /**
   * 檢查重複處理
   */
  checkDuplicateProcessing() {
    const duplicates = [];
    const processed = new Set();
    
    // 檢查狀態管理器中的重複
    for (const msgId of this.stateManager.processedMessages) {
      if (processed.has(msgId)) {
        duplicates.push({ msgId, type: 'processed_messages' });
      }
      processed.add(msgId);
    }
    
    // 檢查 AI 確認狀態的重複
    const aiConfirmations = new Map();
    for (const [key, state] of this.stateManager.aiConfirmationState) {
      const msgId = key.split(':')[1];
      if (aiConfirmations.has(msgId)) {
        duplicates.push({ msgId, type: 'ai_confirmation_state' });
      }
      aiConfirmations.set(msgId, state);
    }
    
    return duplicates;
  }

  /**
   * 測試 2: AI 服務並發壓力測試
   */
  async testAIServiceConcurrency() {
    businessLogger.info('🤖 開始測試 AI 服務並發壓力...');
    const startTime = performance.now();
    
    try {
      const concurrentRequests = [];
      
      // 模擬多個用戶同時使用 AI 識別
      for (let i = 1; i <= 30; i++) {
        const userId = `user-${(i % 10) + 1}`;
        const imageBuffer = Buffer.from(`test-image-${i}`);
        
        concurrentRequests.push(
          this.aiService.recognizeImage(imageBuffer, userId)
        );
      }
      
      // 等待所有 AI 請求完成
      const results = await Promise.allSettled(concurrentRequests);
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      const aiStats = this.aiService.getStats();
      const duration = performance.now() - startTime;
      
      this.results.push({
        testName: 'ai_service_concurrency',
        success: failed === 0,
        duration,
        details: {
          totalRequests: concurrentRequests.length,
          successful,
          failed,
          aiStats
        },
        message: `AI 服務並發處理: ${successful}/${concurrentRequests.length} 成功，最大並發: ${aiStats.maxConcurrentRequests}`
      });
      
      if (failed > 0) {
        this.errors.push({
          testName: 'ai_service_concurrency',
          error: `AI 服務並發處理失敗: ${failed} 個請求失敗`,
          details: { aiStats }
        });
      }
      
    } catch (error) {
      this.errors.push({
        testName: 'ai_service_concurrency',
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * 測試 3: 對話狀態並發修改
   */
  async testConversationStateConcurrency() {
    businessLogger.info('💬 開始測試對話狀態並發修改...');
    const startTime = performance.now();
    
    try {
      const concurrentOperations = [];
      
      // 模擬多個用戶同時修改對話狀態
      for (let i = 1; i <= 20; i++) {
        const userId = `user-${(i % 5) + 1}`;
        const chatId = `chat-${userId}`;
        const msgId = `msg-${i}`;
        
        concurrentOperations.push(
          this.simulateConversationStateChange(userId, chatId, msgId, i)
        );
      }
      
      // 等待所有操作完成
      const results = await Promise.allSettled(concurrentOperations);
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      // 檢查狀態一致性
      const consistencyCheck = this.checkStateConsistency();
      
      const duration = performance.now() - startTime;
      
      this.results.push({
        testName: 'conversation_state_concurrency',
        success: failed === 0 && consistencyCheck.isConsistent,
        duration,
        details: {
          totalOperations: concurrentOperations.length,
          successful,
          failed,
          consistencyCheck
        },
        message: consistencyCheck.isConsistent ? 
          '對話狀態並發修改正常' : 
          '發現狀態不一致問題'
      });
      
      if (!consistencyCheck.isConsistent) {
        this.errors.push({
          testName: 'conversation_state_concurrency',
          error: '對話狀態不一致',
          details: consistencyCheck
        });
      }
      
    } catch (error) {
      this.errors.push({
        testName: 'conversation_state_concurrency',
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * 模擬對話狀態變更
   */
  async simulateConversationStateChange(userId, chatId, msgId, sequence) {
    try {
      // 模擬費用對話開始
      this.stateManager.setExpenseState(chatId, msgId, {
        step: 'awaiting_shop_name',
        userId: userId,
        timestamp: Date.now(),
        sequence: sequence
      });
      
      // 模擬處理延遲
      await new Promise(resolve => setTimeout(resolve, Math.random() * 30 + 10));
      
      // 模擬狀態更新
      this.stateManager.setExpenseState(chatId, msgId, {
        step: 'awaiting_amount',
        userId: userId,
        shopName: `店舖${sequence}`,
        timestamp: Date.now(),
        sequence: sequence
      });
      
      // 模擬最終狀態
      await new Promise(resolve => setTimeout(resolve, Math.random() * 20 + 5));
      
      this.stateManager.setExpenseState(chatId, msgId, {
        step: 'completed',
        userId: userId,
        shopName: `店舖${sequence}`,
        amount: Math.random() * 1000,
        timestamp: Date.now(),
        sequence: sequence
      });
      
      return { userId, chatId, msgId, sequence, result: 'success' };
      
    } catch (error) {
      throw new Error(`狀態變更失敗: ${error.message}`);
    }
  }

  /**
   * 檢查狀態一致性
   */
  checkStateConsistency() {
    const inconsistencies = [];
    
    // 檢查費用狀態一致性
    for (const [key, state] of this.stateManager.expenseState) {
      if (!state.userId || !state.timestamp || !state.sequence) {
        inconsistencies.push({
          type: 'expense_state',
          key,
          issue: 'missing_required_fields',
          state
        });
      }
    }
    
    // 檢查 AI 確認狀態一致性
    for (const [key, state] of this.stateManager.aiConfirmationState) {
      if (!state.userId || !state.timestamp) {
        inconsistencies.push({
          type: 'ai_confirmation_state',
          key,
          issue: 'missing_required_fields',
          state
        });
      }
    }
    
    return {
      isConsistent: inconsistencies.length === 0,
      inconsistencies,
      totalExpenseStates: this.stateManager.expenseState.size,
      totalAIConfirmationStates: this.stateManager.aiConfirmationState.size
    };
  }

  /**
   * 測試 4: 記憶體洩露檢測
   */
  async testMemoryLeakDetection() {
    businessLogger.info('🧠 開始測試記憶體洩露檢測...');
    const startTime = performance.now();
    
    try {
      const initialMemory = process.memoryUsage();
      
      // 執行大量對話操作
      for (let cycle = 1; cycle <= 5; cycle++) {
        const operations = [];
        
        for (let i = 1; i <= 100; i++) {
          const userId = `user-${(i % 10) + 1}`;
          const chatId = `chat-${userId}`;
          const msgId = `cycle-${cycle}-msg-${i}`;
          
          operations.push(
            this.simulateConversationStateChange(userId, chatId, msgId, i)
          );
        }
        
        await Promise.allSettled(operations);
        
        // 模擬清理部分狀態
        if (cycle % 2 === 0) {
          this.stateManager.cleanupExpiredExpenseStates();
          this.stateManager.cleanupExpiredAIConfirmationStates();
        }
      }
      
      // 強制垃圾回收
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;
      
      const hasMemoryLeak = memoryIncreasePercent > 100; // 超過 100% 增長認為有洩露
      
      const duration = performance.now() - startTime;
      
      this.results.push({
        testName: 'memory_leak_detection',
        success: !hasMemoryLeak,
        duration,
        details: {
          initialMemory: initialMemory.heapUsed,
          finalMemory: finalMemory.heapUsed,
          memoryIncrease,
          memoryIncreasePercent: memoryIncreasePercent.toFixed(2),
          stateManagerStats: this.stateManager.getStats()
        },
        message: hasMemoryLeak ? 
          `檢測到記憶體洩露: ${memoryIncreasePercent.toFixed(2)}%` : 
          `記憶體使用正常: ${memoryIncreasePercent.toFixed(2)}%`
      });
      
      if (hasMemoryLeak) {
        this.errors.push({
          testName: 'memory_leak_detection',
          error: `記憶體洩露風險: 增長 ${memoryIncreasePercent.toFixed(2)}%`,
          details: { memoryIncrease, memoryIncreasePercent }
        });
      }
      
    } catch (error) {
      this.errors.push({
        testName: 'memory_leak_detection',
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * 執行所有測試
   */
  async runAllTests() {
    businessLogger.info('🚀 開始對話流程並發測試...');
    
    await this.setup();
    
    // 執行所有測試
    const testMethods = [
      { name: 'message_processing_race_condition', method: this.testMessageProcessingRaceCondition },
      { name: 'ai_service_concurrency', method: this.testAIServiceConcurrency },
      { name: 'conversation_state_concurrency', method: this.testConversationStateConcurrency },
      { name: 'memory_leak_detection', method: this.testMemoryLeakDetection }
    ];
    
    for (const test of testMethods) {
      try {
        await test.method.call(this);
        businessLogger.info(`✅ ${test.name} 測試完成`);
      } catch (error) {
        businessLogger.error(`❌ ${test.name} 測試失敗:`, error);
        this.errors.push({
          testName: test.name,
          error: error.message,
          stack: error.stack
        });
      }
    }
    
    return this.generateReport();
  }

  /**
   * 生成測試報告
   */
  generateReport() {
    const totalDuration = Date.now() - this.startTime;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = this.results.filter(r => !r.success).length;
    
    return {
      summary: {
        totalTests: this.results.length,
        passedTests,
        failedTests,
        totalErrors: this.errors.length,
        totalDuration,
        testDate: new Date().toISOString()
      },
      results: this.results,
      errors: this.errors,
      aiServiceStats: this.aiService.getStats(),
      stateManagerStats: this.stateManager.getStats(),
      concurrencyAnalysis: this.analyzeConcurrencyIssues()
    };
  }

  /**
   * 分析並發問題
   */
  analyzeConcurrencyIssues() {
    const issues = [];
    
    // 分析測試結果中的並發問題
    this.results.forEach(result => {
      if (!result.success) {
        if (result.testName === 'message_processing_race_condition') {
          issues.push({
            type: 'race_condition',
            severity: 'high',
            description: '消息處理存在競態條件',
            impact: '可能導致消息重複處理或丟失',
            recommendation: '使用原子操作或分散式鎖'
          });
        }
        
        if (result.testName === 'ai_service_concurrency') {
          issues.push({
            type: 'resource_exhaustion',
            severity: 'medium',
            description: 'AI 服務並發請求過多',
            impact: '可能導致 API 限流或系統過載',
            recommendation: '實現請求速率限制和並發控制'
          });
        }
        
        if (result.testName === 'conversation_state_concurrency') {
          issues.push({
            type: 'state_inconsistency',
            severity: 'high',
            description: '對話狀態並發修改不一致',
            impact: '可能導致對話流程錯亂',
            recommendation: '使用事務或樂觀鎖機制'
          });
        }
        
        if (result.testName === 'memory_leak_detection') {
          issues.push({
            type: 'memory_leak',
            severity: 'medium',
            description: '檢測到記憶體洩露',
            impact: '長期運行可能導致系統崩潰',
            recommendation: '改善狀態清理機制和垃圾回收'
          });
        }
      }
    });
    
    return {
      totalIssues: issues.length,
      highSeverityIssues: issues.filter(i => i.severity === 'high').length,
      mediumSeverityIssues: issues.filter(i => i.severity === 'medium').length,
      lowSeverityIssues: issues.filter(i => i.severity === 'low').length,
      issues
    };
  }
}

/**
 * 主測試執行器
 */
async function runConversationFlowConcurrencyTest() {
  const tester = new ConversationFlowConcurrencyTest();
  
  try {
    const report = await tester.runAllTests();
    
    // 保存測試報告
    const reportPath = path.join(__dirname, 'test-reports', 
      `conversation-flow-concurrency-${Date.now()}.json`);
    
    if (!fs.existsSync(path.dirname(reportPath))) {
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // 輸出測試結果
    console.log('\n🎯 對話流程並發測試結果:');
    console.log('═'.repeat(80));
    console.log(`📊 測試概要:`);
    console.log(`   總測試數: ${report.summary.totalTests}`);
    console.log(`   通過測試: ${report.summary.passedTests}`);
    console.log(`   失敗測試: ${report.summary.failedTests}`);
    console.log(`   錯誤數量: ${report.summary.totalErrors}`);
    console.log(`   總耗時: ${report.summary.totalDuration}ms`);
    console.log('');
    
    console.log(`🔄 並發分析:`);
    console.log(`   總問題數: ${report.concurrencyAnalysis.totalIssues}`);
    console.log(`   高危問題: ${report.concurrencyAnalysis.highSeverityIssues}`);
    console.log(`   中危問題: ${report.concurrencyAnalysis.mediumSeverityIssues}`);
    console.log(`   低危問題: ${report.concurrencyAnalysis.lowSeverityIssues}`);
    console.log('');
    
    console.log(`🤖 AI 服務統計:`);
    console.log(`   總請求數: ${report.aiServiceStats.totalRequests}`);
    console.log(`   最大並發: ${report.aiServiceStats.maxConcurrentRequests}`);
    console.log(`   平均處理時間: ${report.aiServiceStats.averageProcessingTime?.toFixed(2)}ms`);
    console.log('');
    
    console.log(`📁 測試報告: ${reportPath}`);
    console.log('═'.repeat(80));
    
    // 詳細結果
    if (report.results.length > 0) {
      console.log('\n📋 詳細測試結果:');
      report.results.forEach(result => {
        const status = result.success ? '✅' : '❌';
        const duration = result.duration ? ` (${result.duration.toFixed(2)}ms)` : '';
        console.log(`${status} ${result.testName}${duration}: ${result.message}`);
      });
    }
    
    // 並發問題詳情
    if (report.concurrencyAnalysis.issues.length > 0) {
      console.log('\n🚨 並發問題詳情:');
      report.concurrencyAnalysis.issues.forEach(issue => {
        console.log(`⚠️  ${issue.type} (${issue.severity}): ${issue.description}`);
        console.log(`   影響: ${issue.impact}`);
        console.log(`   建議: ${issue.recommendation}`);
        console.log('');
      });
    }
    
    // 錯誤詳情
    if (report.errors.length > 0) {
      console.log('\n❌ 錯誤詳情:');
      report.errors.forEach(error => {
        console.log(`- ${error.testName}: ${error.error}`);
      });
    }
    
    return report;
    
  } catch (error) {
    console.error('❌ 測試執行失敗:', error);
    throw error;
  }
}

// 如果直接執行此文件
if (require.main === module) {
  runConversationFlowConcurrencyTest()
    .then(report => {
      const success = report.summary.failedTests === 0 && report.summary.totalErrors === 0;
      console.log(success ? '\n✅ 所有測試通過!' : '\n❌ 發現並發問題!');
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('測試執行失敗:', error);
      process.exit(1);
    });
}

module.exports = {
  ConversationFlowConcurrencyTest,
  runConversationFlowConcurrencyTest
};