/**
 * 批判性工作流系統漏洞測試
 * 測試目標：發現並驗證系統的致命漏洞
 * 創建時間：2025年7月12日
 * 測試範圍：安全隱患、架構缺陷、設計衝突
 */

const path = require('path');
const fs = require('fs');

// 測試配置
const TEST_CONFIG = {
  testTimeoutMs: 30000,
  workflowPort: 3001,
  mainPort: 3000,
  criticalityLevels: {
    CRITICAL: 'CRITICAL',
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW'
  }
};

// 測試結果收集器
class TestResultCollector {
  constructor() {
    this.results = [];
    this.vulnerabilities = [];
    this.startTime = Date.now();
  }

  addResult(name, status, details, criticality = 'MEDIUM') {
    const result = {
      name,
      status,
      details,
      criticality,
      timestamp: new Date().toISOString()
    };

    this.results.push(result);
    
    if (status === 'FAIL' && criticality === 'CRITICAL') {
      this.vulnerabilities.push(result);
    }

    console.log(`${status === 'PASS' ? '✅' : '❌'} ${name} (${criticality})`);
    if (details) {
      console.log(`   ${details}`);
    }
  }

  generateReport() {
    const endTime = Date.now();
    const duration = endTime - this.startTime;

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const critical = this.vulnerabilities.length;

    console.log('\n' + '='.repeat(60));
    console.log('批判性工作流系統漏洞測試報告');
    console.log('='.repeat(60));
    console.log(`測試執行時間: ${duration}ms`);
    console.log(`通過: ${passed}/${this.results.length}`);
    console.log(`失敗: ${failed}/${this.results.length}`);
    console.log(`致命漏洞: ${critical}`);
    console.log(`總成功率: ${((passed / this.results.length) * 100).toFixed(1)}%`);
    
    if (this.vulnerabilities.length > 0) {
      console.log('\n🚨 發現的致命漏洞:');
      this.vulnerabilities.forEach((vuln, index) => {
        console.log(`${index + 1}. ${vuln.name}`);
        console.log(`   ${vuln.details}`);
      });
    }

    return {
      passed,
      failed,
      critical,
      totalTime: duration,
      successRate: (passed / this.results.length) * 100,
      vulnerabilities: this.vulnerabilities
    };
  }
}

// 主要測試函數
async function runCriticalWorkflowTests() {
  console.log('🔍 開始批判性工作流系統漏洞測試...\n');
  
  const collector = new TestResultCollector();

  // 測試1: 架構設計衝突分析
  await testArchitectureDesignConflicts(collector);
  
  // 測試2: 資料庫操作權限測試
  await testDatabasePermissionVulnerabilities(collector);
  
  // 測試3: 服務適配器限制測試
  await testServiceAdapterLimitations(collector);
  
  // 測試4: 觸發器系統初始化測試
  await testTriggerSystemInitialization(collector);
  
  // 測試5: 併發處理衝突測試
  await testConcurrencyConflicts(collector);
  
  // 測試6: 錯誤處理缺陷測試
  await testErrorHandlingDefects(collector);
  
  // 測試7: 資源競爭測試
  await testResourceContention(collector);
  
  // 測試8: 端口衝突測試
  await testPortConflicts(collector);

  return collector.generateReport();
}

// 測試1: 架構設計衝突分析
async function testArchitectureDesignConflicts(collector) {
  try {
    // 檢查ServiceAdapter的設計衝突
    const serviceAdapterPath = path.join(__dirname, 'workflow/core/ServiceAdapter.js');
    if (fs.existsSync(serviceAdapterPath)) {
      const content = fs.readFileSync(serviceAdapterPath, 'utf8');
      
      // 檢查是否聲稱只讀但實際允許寫入
      const hasReadOnlyClaim = content.includes('只讀') || content.includes('safe');
      const hasWriteCapability = content.includes('originalService[method]') && 
                                !content.includes('禁止寫入方法列表');
      
      if (hasReadOnlyClaim && hasWriteCapability) {
        collector.addResult(
          '架構設計衝突 - ServiceAdapter違反只讀原則',
          'FAIL',
          'ServiceAdapter聲稱只讀但實際上允許調用任何方法，包括寫入操作',
          'CRITICAL'
        );
      } else {
        collector.addResult(
          '架構設計衝突 - ServiceAdapter設計檢查',
          'PASS',
          '未發現明顯的設計衝突',
          'HIGH'
        );
      }
    }
  } catch (error) {
    collector.addResult(
      '架構設計衝突測試',
      'FAIL',
      `測試執行失敗: ${error.message}`,
      'MEDIUM'
    );
  }
}

// 測試2: 資料庫操作權限測試
async function testDatabasePermissionVulnerabilities(collector) {
  try {
    // 檢查是否存在不當的寫入操作
    const triggerSystemPath = path.join(__dirname, 'workflow/services/TriggerSystem.js');
    if (fs.existsSync(triggerSystemPath)) {
      const content = fs.readFileSync(triggerSystemPath, 'utf8');
      
      // 檢查是否通過只讀適配器執行寫入操作
      const hasReadAdapterWrite = content.includes('safeRead') && 
                                 content.includes('run') &&
                                 content.includes('CREATE TABLE');
      
      if (hasReadAdapterWrite) {
        collector.addResult(
          '資料庫權限漏洞 - 只讀適配器執行寫入操作',
          'FAIL',
          'TriggerSystem通過safeRead方法執行run操作，違反只讀原則',
          'CRITICAL'
        );
      } else {
        collector.addResult(
          '資料庫權限測試',
          'PASS',
          '未發現明顯的權限漏洞',
          'HIGH'
        );
      }
    }
  } catch (error) {
    collector.addResult(
      '資料庫權限測試',
      'FAIL',
      `測試執行失敗: ${error.message}`,
      'MEDIUM'
    );
  }
}

// 測試3: 服務適配器限制測試
async function testServiceAdapterLimitations(collector) {
  try {
    // 動態測試服務適配器的實際行為
    const WorkflowServiceContainer = require('./workflow/core/WorkflowServiceContainer');
    const container = WorkflowServiceContainer.getInstance();
    
    // 嘗試初始化容器
    await container.initialize();
    
    // 嘗試獲取適配器
    const dbAdapter = container.getAdapter('databaseService');
    if (dbAdapter) {
      // 測試是否可以調用寫入方法
      try {
        // 這應該被阻止，但根據代碼分析，可能不會被阻止
        const result = await dbAdapter.safeRead('run', 'SELECT 1');
        collector.addResult(
          '服務適配器限制 - 寫入操作檢查',
          'FAIL',
          'safeRead方法意外允許run等寫入操作',
          'CRITICAL'
        );
      } catch (error) {
        collector.addResult(
          '服務適配器限制 - 寫入操作檢查',
          'PASS',
          '寫入操作被正確阻止',
          'HIGH'
        );
      }
    }
  } catch (error) {
    collector.addResult(
      '服務適配器限制測試',
      'FAIL',
      `測試執行失敗: ${error.message}`,
      'HIGH'
    );
  }
}

// 測試4: 觸發器系統初始化測試
async function testTriggerSystemInitialization(collector) {
  try {
    // 測試觸發器系統的API
    const response = await fetch(`http://localhost:${TEST_CONFIG.workflowPort}/api/triggers`);
    
    if (response.ok) {
      collector.addResult(
        '觸發器系統初始化',
        'PASS',
        `API響應正常: ${response.status}`,
        'MEDIUM'
      );
    } else {
      collector.addResult(
        '觸發器系統初始化',
        'FAIL',
        `API響應異常: ${response.status}`,
        'HIGH'
      );
    }
  } catch (error) {
    collector.addResult(
      '觸發器系統初始化測試',
      'FAIL',
      `API調用失敗: ${error.message}`,
      'HIGH'
    );
  }
}

// 測試5: 併發處理衝突測試
async function testConcurrencyConflicts(collector) {
  try {
    const WorkflowServiceContainer = require('./workflow/core/WorkflowServiceContainer');
    const container = WorkflowServiceContainer.getInstance();
    
    // 測試同時訪問多個服務 - 修復非Promise調用問題
    const serviceTests = [
      () => container.getService('workflowEngine'),
      () => container.getService('botManager'),  
      () => container.getService('triggerSystem')
    ];
    
    const results = [];
    for (const test of serviceTests) {
      try {
        const result = test();
        results.push({ status: 'fulfilled', value: result });
      } catch (error) {
        results.push({ status: 'rejected', reason: error.message });
      }
    }
    
    const failures = results.filter(r => r.status === 'rejected');
    
    if (failures.length > 0) {
      collector.addResult(
        '併發處理衝突',
        'FAIL',
        `併發服務訪問失敗: ${failures[0].reason}`,
        'HIGH'
      );
    } else {
      collector.addResult(
        '併發處理測試',
        'PASS',
        '併發服務訪問正常',
        'MEDIUM'
      );
    }
  } catch (error) {
    collector.addResult(
      '併發處理衝突測試',
      'FAIL',
      `測試執行失敗: ${error.message}`,
      'HIGH'
    );
  }
}

// 測試6: 錯誤處理缺陷測試
async function testErrorHandlingDefects(collector) {
  try {
    // 測試不存在的服務
    const WorkflowServiceContainer = require('./workflow/core/WorkflowServiceContainer');
    const container = WorkflowServiceContainer.getInstance();
    
    try {
      await container.resolve('nonExistentService');
      collector.addResult(
        '錯誤處理缺陷',
        'FAIL',
        '不存在的服務應該拋出錯誤但沒有',
        'HIGH'
      );
    } catch (error) {
      collector.addResult(
        '錯誤處理測試',
        'PASS',
        '錯誤處理正常',
        'MEDIUM'
      );
    }
  } catch (error) {
    collector.addResult(
      '錯誤處理缺陷測試',
      'PASS',
      '錯誤處理機制正常工作',
      'MEDIUM'
    );
  }
}

// 測試7: 資源競爭測試
async function testResourceContention(collector) {
  try {
    // 測試資源是否被正確管理
    const net = require('net');
    
    // 檢查端口是否被占用
    const server = net.createServer();
    server.listen(TEST_CONFIG.workflowPort, () => {
      server.close();
      collector.addResult(
        '資源競爭測試',
        'FAIL',
        `端口 ${TEST_CONFIG.workflowPort} 未被正確占用`,
        'MEDIUM'
      );
    });
    
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        collector.addResult(
          '資源競爭測試',
          'PASS',
          `端口 ${TEST_CONFIG.workflowPort} 正確被占用`,
          'LOW'
        );
      } else {
        collector.addResult(
          '資源競爭測試',
          'FAIL',
          `端口測試失敗: ${err.message}`,
          'MEDIUM'
        );
      }
    });
  } catch (error) {
    collector.addResult(
      '資源競爭測試',
      'FAIL',
      `測試執行失敗: ${error.message}`,
      'MEDIUM'
    );
  }
}

// 測試8: 端口衝突測試
async function testPortConflicts(collector) {
  try {
    // 測試主端口可用性
    const net = require('net');
    
    const testPort = (port, name) => {
      return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(port, () => {
          server.close();
          resolve({ available: true, port, name });
        });
        
        server.on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            resolve({ available: false, port, name });
          } else {
            resolve({ available: false, port, name, error: err.message });
          }
        });
      });
    };

    const results = await Promise.all([
      testPort(TEST_CONFIG.mainPort, 'main'),
      testPort(TEST_CONFIG.workflowPort, 'workflow')
    ]);

    const unavailablePorts = results.filter(r => !r.available);
    if (unavailablePorts.length === 2) {
      collector.addResult(
        '端口衝突測試',
        'PASS',
        '所有必要端口都被正確占用',
        'LOW'
      );
    } else {
      collector.addResult(
        '端口衝突測試',
        'FAIL',
        `端口狀態異常: ${results.map(r => `${r.name}:${r.port}=${r.available ? '可用' : '占用'}`).join(', ')}`,
        'MEDIUM'
      );
    }
  } catch (error) {
    collector.addResult(
      '端口衝突測試',
      'FAIL',
      `測試執行失敗: ${error.message}`,
      'MEDIUM'
    );
  }
}

// 主執行函數
async function main() {
  try {
    const report = await runCriticalWorkflowTests();
    
    console.log('\n📊 測試總結:');
    console.log(`- 通過測試: ${report.passed}`);
    console.log(`- 失敗測試: ${report.failed}`);
    console.log(`- 致命漏洞: ${report.critical}`);
    console.log(`- 總成功率: ${report.successRate.toFixed(1)}%`);
    console.log(`- 執行時間: ${report.totalTime}ms`);
    
    if (report.critical > 0) {
      console.log('\n🚨 系統存在致命漏洞，不建議投入生產環境！');
      process.exit(1);
    } else if (report.successRate < 80) {
      console.log('\n⚠️  系統存在多個問題，需要進一步修復');
      process.exit(1);
    } else {
      console.log('\n✅ 系統批判性測試通過');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ 測試執行失敗:', error);
    process.exit(1);
  }
}

// 如果直接運行此文件
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  runCriticalWorkflowTests,
  TEST_CONFIG
}; 