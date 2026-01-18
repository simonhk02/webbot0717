const http = require('http');
const fs = require('fs');
const path = require('path');

class ComprehensiveSystemTest {
    constructor() {
        this.results = [];
        this.workflowPort = 3001;
        this.mainPort = 3000;
        this.testStartTime = new Date();
    }

    // 測試結果記錄
    log(testName, status, message, details = null) {
        const result = {
            test: testName,
            status: status, // 'PASS', 'FAIL', 'SKIP'
            message: message,
            details: details,
            timestamp: new Date().toISOString()
        };
        this.results.push(result);
        
        const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
        console.log(`${statusIcon} ${testName}: ${message}`);
        if (details) {
            console.log(`   詳情: ${details}`);
        }
    }

    // HTTP請求工具
    async makeRequest(port, path, method = 'GET', data = null) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'localhost',
                port: port,
                path: path,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'SystemTest/1.0'
                }
            };

            const req = http.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => {
                    body += chunk;
                });
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: body
                    });
                });
            });

            req.on('error', (err) => {
                reject(err);
            });

            if (data) {
                req.write(JSON.stringify(data));
            }
            req.end();
        });
    }

    // 1. 系統健康檢查測試
    async testSystemHealth() {
        console.log('\n🔍 === 系統健康檢查測試 ===');
        
        // 檢查工作流系統端口
        try {
            const response = await this.makeRequest(this.workflowPort, '/health');
            if (response.statusCode === 200) {
                this.log('工作流系統端口檢查', 'PASS', `端口${this.workflowPort}正常運行`);
            } else {
                this.log('工作流系統端口檢查', 'FAIL', `端口${this.workflowPort}返回狀態碼${response.statusCode}`);
            }
        } catch (error) {
            this.log('工作流系統端口檢查', 'FAIL', `端口${this.workflowPort}連接失敗`, error.message);
        }

        // 檢查主系統端口
        try {
            const response = await this.makeRequest(this.mainPort, '/health');
            if (response.statusCode === 200) {
                this.log('主系統端口檢查', 'PASS', `端口${this.mainPort}正常運行`);
            } else {
                this.log('主系統端口檢查', 'FAIL', `端口${this.mainPort}返回狀態碼${response.statusCode}`);
            }
        } catch (error) {
            this.log('主系統端口檢查', 'SKIP', `端口${this.mainPort}未運行`, '這是正常的，主系統按需啟動');
        }

        // 檢查工作流系統響應時間
        try {
            const startTime = Date.now();
            await this.makeRequest(this.workflowPort, '/health');
            const responseTime = Date.now() - startTime;
            
            if (responseTime < 1000) {
                this.log('工作流系統響應時間', 'PASS', `響應時間${responseTime}ms，性能良好`);
            } else {
                this.log('工作流系統響應時間', 'FAIL', `響應時間${responseTime}ms，性能較慢`);
            }
        } catch (error) {
            this.log('工作流系統響應時間', 'FAIL', '無法測量響應時間', error.message);
        }
    }

    // 2. 工作流系統功能測試
    async testWorkflowSystemFunctions() {
        console.log('\n🔧 === 工作流系統功能測試 ===');
        
        // 測試工作流列表API
        try {
            const response = await this.makeRequest(this.workflowPort, '/workflow/api/workflows');
            if (response.statusCode === 200) {
                const data = JSON.parse(response.body);
                this.log('工作流列表API', 'PASS', `成功獲取工作流列表，共${data.workflows ? data.workflows.length : 0}個工作流`);
            } else {
                this.log('工作流列表API', 'FAIL', `API返回狀態碼${response.statusCode}`);
            }
        } catch (error) {
            this.log('工作流列表API', 'FAIL', 'API調用失敗', error.message);
        }

        // 測試機械人列表API
        try {
            const response = await this.makeRequest(this.workflowPort, '/workflow/api/bots');
            if (response.statusCode === 200) {
                const data = JSON.parse(response.body);
                this.log('機械人列表API', 'PASS', `成功獲取機械人列表，共${data.bots ? data.bots.length : 0}個機械人`);
            } else {
                this.log('機械人列表API', 'FAIL', `API返回狀態碼${response.statusCode}`);
            }
        } catch (error) {
            this.log('機械人列表API', 'FAIL', 'API調用失敗', error.message);
        }

        // 測試機械人創建API
        try {
            const testBot = {
                name: 'TestBot_' + Date.now(),
                type: 'whatsapp',
                purpose: 'testing',
                aiLevel: 'basic',
                personality: 'friendly'
            };
            
            const response = await this.makeRequest(this.workflowPort, '/workflow/api/bots', 'POST', testBot);
            if (response.statusCode === 200 || response.statusCode === 201) {
                this.log('機械人創建API', 'PASS', `成功創建測試機械人: ${testBot.name}`);
            } else {
                this.log('機械人創建API', 'FAIL', `API返回狀態碼${response.statusCode}`);
            }
        } catch (error) {
            this.log('機械人創建API', 'FAIL', 'API調用失敗', error.message);
        }
    }

    // 3. API接口測試
    async testAPIEndpoints() {
        console.log('\n🌐 === API接口測試 ===');
        
        const endpoints = [
            { path: '/health', method: 'GET', expectedStatus: 200 },
            { path: '/workflow', method: 'GET', expectedStatus: 200 },
            { path: '/workflow/api/workflows', method: 'GET', expectedStatus: 200 },
            { path: '/workflow/api/bots', method: 'GET', expectedStatus: 200 },
            { path: '/workflow/api/health', method: 'GET', expectedStatus: 200 }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.makeRequest(this.workflowPort, endpoint.path, endpoint.method);
                if (response.statusCode === endpoint.expectedStatus) {
                    this.log(`API端點 ${endpoint.method} ${endpoint.path}`, 'PASS', `正常返回狀態碼${response.statusCode}`);
                } else {
                    this.log(`API端點 ${endpoint.method} ${endpoint.path}`, 'FAIL', `預期狀態碼${endpoint.expectedStatus}，實際${response.statusCode}`);
                }
            } catch (error) {
                this.log(`API端點 ${endpoint.method} ${endpoint.path}`, 'FAIL', '連接失敗', error.message);
            }
        }
    }

    // 4. 前端界面測試
    async testFrontendPages() {
        console.log('\n🎨 === 前端界面測試 ===');
        
        // 檢查關鍵前端文件是否存在
        const frontendFiles = [
            'workflow/public/index.html',
            'workflow/public/bots.html',
            'workflow/public/styles.css',
            'workflow/public/script.js'
        ];

        for (const file of frontendFiles) {
            try {
                if (fs.existsSync(file)) {
                    const stats = fs.statSync(file);
                    this.log(`前端文件 ${file}`, 'PASS', `文件存在，大小${stats.size}字節`);
                } else {
                    this.log(`前端文件 ${file}`, 'FAIL', '文件不存在');
                }
            } catch (error) {
                this.log(`前端文件 ${file}`, 'FAIL', '檢查失敗', error.message);
            }
        }

        // 測試前端頁面訪問
        try {
            const response = await this.makeRequest(this.workflowPort, '/workflow');
            if (response.statusCode === 200) {
                this.log('工作流主頁面', 'PASS', '頁面正常加載');
            } else {
                this.log('工作流主頁面', 'FAIL', `頁面返回狀態碼${response.statusCode}`);
            }
        } catch (error) {
            this.log('工作流主頁面', 'FAIL', '頁面無法訪問', error.message);
        }
    }

    // 5. 數據庫連接測試
    async testDatabaseConnection() {
        console.log('\n💾 === 數據庫連接測試 ===');
        
        // 檢查數據庫文件是否存在
        const dbFiles = [
            'workflow/database/workflow.db',
            'shared_user_data.db'
        ];

        for (const dbFile of dbFiles) {
            try {
                if (fs.existsSync(dbFile)) {
                    const stats = fs.statSync(dbFile);
                    this.log(`數據庫文件 ${dbFile}`, 'PASS', `文件存在，大小${stats.size}字節`);
                } else {
                    this.log(`數據庫文件 ${dbFile}`, 'FAIL', '文件不存在');
                }
            } catch (error) {
                this.log(`數據庫文件 ${dbFile}`, 'FAIL', '檢查失敗', error.message);
            }
        }

        // 通過API測試數據庫連接
        try {
            const response = await this.makeRequest(this.workflowPort, '/workflow/api/bots');
            if (response.statusCode === 200) {
                this.log('數據庫連接測試', 'PASS', '數據庫查詢正常');
            } else {
                this.log('數據庫連接測試', 'FAIL', '數據庫查詢失敗');
            }
        } catch (error) {
            this.log('數據庫連接測試', 'FAIL', '數據庫連接失敗', error.message);
        }
    }

    // 6. 性能測試
    async testPerformance() {
        console.log('\n⚡ === 性能測試 ===');
        
        // 併發請求測試
        const concurrentRequests = 10;
        const requests = [];
        
        for (let i = 0; i < concurrentRequests; i++) {
            requests.push(this.makeRequest(this.workflowPort, '/workflow/api/bots'));
        }

        try {
            const startTime = Date.now();
            const responses = await Promise.all(requests);
            const endTime = Date.now();
            
            const successCount = responses.filter(r => r.statusCode === 200).length;
            const totalTime = endTime - startTime;
            
            if (successCount === concurrentRequests && totalTime < 5000) {
                this.log('併發請求測試', 'PASS', `${concurrentRequests}個併發請求全部成功，總時間${totalTime}ms`);
            } else {
                this.log('併發請求測試', 'FAIL', `${successCount}/${concurrentRequests}個請求成功，總時間${totalTime}ms`);
            }
        } catch (error) {
            this.log('併發請求測試', 'FAIL', '併發測試失敗', error.message);
        }
    }

    // 生成測試報告
    generateReport() {
        console.log('\n📊 === 測試報告 ===');
        
        const totalTests = this.results.length;
        const passedTests = this.results.filter(r => r.status === 'PASS').length;
        const failedTests = this.results.filter(r => r.status === 'FAIL').length;
        const skippedTests = this.results.filter(r => r.status === 'SKIP').length;
        
        const successRate = ((passedTests / totalTests) * 100).toFixed(1);
        
        console.log(`\n📈 測試統計:`);
        console.log(`   總測試數: ${totalTests}`);
        console.log(`   通過: ${passedTests} ✅`);
        console.log(`   失敗: ${failedTests} ❌`);
        console.log(`   跳過: ${skippedTests} ⚠️`);
        console.log(`   成功率: ${successRate}%`);
        
        const testDuration = Date.now() - this.testStartTime.getTime();
        console.log(`   測試耗時: ${testDuration}ms`);
        
        // 生成詳細報告
        const report = {
            summary: {
                total: totalTests,
                passed: passedTests,
                failed: failedTests,
                skipped: skippedTests,
                successRate: successRate,
                duration: testDuration,
                timestamp: this.testStartTime.toISOString()
            },
            details: this.results
        };
        
        // 保存報告到文件
        try {
            fs.writeFileSync('test-report.json', JSON.stringify(report, null, 2));
            console.log(`\n📝 詳細報告已保存到: test-report.json`);
        } catch (error) {
            console.log(`\n❌ 無法保存測試報告: ${error.message}`);
        }
        
        return report;
    }

    // 執行所有測試
    async runAllTests() {
        console.log('🚀 開始執行全面系統測試...\n');
        
        await this.testSystemHealth();
        await this.testWorkflowSystemFunctions();
        await this.testAPIEndpoints();
        await this.testFrontendPages();
        await this.testDatabaseConnection();
        await this.testPerformance();
        
        return this.generateReport();
    }
}

// 執行測試
async function main() {
    const tester = new ComprehensiveSystemTest();
    const report = await tester.runAllTests();
    
    // 根據測試結果決定程式退出碼
    const failedTests = report.summary.failed;
    process.exit(failedTests > 0 ? 1 : 0);
}

// 如果直接運行此檔案，則執行測試
if (require.main === module) {
    main().catch(console.error);
}

module.exports = ComprehensiveSystemTest; 