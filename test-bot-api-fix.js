const http = require('http');
const fs = require('fs');

class BotAPIFixTest {
    constructor() {
        this.workflowPort = 3001;
        this.results = [];
    }

    log(message, status = 'INFO') {
        const timestamp = new Date().toISOString();
        const statusIcon = status === 'SUCCESS' ? '✅' : status === 'ERROR' ? '❌' : '🔧';
        console.log(`${statusIcon} [${timestamp}] ${message}`);
    }

    async makeRequest(port, path, method = 'GET', data = null) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'localhost',
                port: port,
                path: path,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'BotAPITest/1.0',
                    'x-user-id': 'test-user',
                    'x-tenant-id': 'test-tenant'
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

    async testBotListAPI() {
        this.log('開始測試機械人列表API...');
        
        try {
            const response = await this.makeRequest(this.workflowPort, '/workflow/api/bots');
            
            if (response.statusCode === 200) {
                const data = JSON.parse(response.body);
                this.log(`機械人列表API響應: ${JSON.stringify(data)}`);
                
                // 檢查響應格式
                if (data.success && Array.isArray(data.data)) {
                    this.log(`機械人列表API正常，當前機械人數量: ${data.count}`, 'SUCCESS');
                    return { success: true, count: data.count, bots: data.data };
                } else {
                    this.log('機械人列表API響應格式錯誤', 'ERROR');
                    return { success: false, error: 'Invalid response format' };
                }
            } else {
                this.log(`機械人列表API失敗，狀態碼: ${response.statusCode}`, 'ERROR');
                return { success: false, error: 'API failed' };
            }
        } catch (error) {
            this.log(`機械人列表API異常: ${error.message}`, 'ERROR');
            return { success: false, error: error.message };
        }
    }

    async testBotCreationAPI() {
        this.log('開始測試機械人創建API...');
        
        try {
            const testBot = {
                name: 'APIFixTestBot_' + Date.now(),
                type: 'whatsapp',
                config: {
                    purpose: 'API testing',
                    aiLevel: 'basic',
                    personality: 'friendly'
                }
            };

            this.log(`創建測試機械人: ${testBot.name}`);
            const response = await this.makeRequest(this.workflowPort, '/workflow/api/bots', 'POST', testBot);
            
            if (response.statusCode === 201) {
                const data = JSON.parse(response.body);
                this.log(`機械人創建API響應: ${JSON.stringify(data)}`);
                
                if (data.success && data.data) {
                    this.log(`機械人創建成功，ID: ${data.data.id}`, 'SUCCESS');
                    return { success: true, bot: data.data };
                } else {
                    this.log('機械人創建API響應格式錯誤', 'ERROR');
                    return { success: false, error: 'Invalid response format' };
                }
            } else {
                this.log(`機械人創建API失敗，狀態碼: ${response.statusCode}`, 'ERROR');
                const errorData = JSON.parse(response.body);
                this.log(`錯誤信息: ${errorData.error}`);
                return { success: false, error: errorData.error };
            }
        } catch (error) {
            this.log(`機械人創建API異常: ${error.message}`, 'ERROR');
            return { success: false, error: error.message };
        }
    }

    async testBotListUpdateAfterCreation() {
        this.log('開始測試機械人列表更新...');
        
        try {
            // 1. 獲取當前機械人列表
            const initialList = await this.testBotListAPI();
            if (!initialList.success) {
                this.log('無法獲取初始機械人列表', 'ERROR');
                return { success: false, error: 'Cannot get initial bot list' };
            }
            
            const initialCount = initialList.count;
            this.log(`初始機械人數量: ${initialCount}`);

            // 2. 創建新機械人
            const creationResult = await this.testBotCreationAPI();
            if (!creationResult.success) {
                this.log('機械人創建失敗', 'ERROR');
                return { success: false, error: 'Bot creation failed' };
            }

            // 3. 等待一小段時間讓數據庫更新
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 4. 重新獲取機械人列表
            const updatedList = await this.testBotListAPI();
            if (!updatedList.success) {
                this.log('無法獲取更新後的機械人列表', 'ERROR');
                return { success: false, error: 'Cannot get updated bot list' };
            }

            const updatedCount = updatedList.count;
            this.log(`更新後機械人數量: ${updatedCount}`);

            // 5. 檢查機械人是否出現在列表中
            if (updatedCount > initialCount) {
                this.log('機械人列表更新成功！', 'SUCCESS');
                
                // 檢查新機械人是否在列表中
                const newBot = updatedList.bots.find(bot => bot.id === creationResult.bot.id);
                if (newBot) {
                    this.log(`新機械人 ${newBot.name} 已出現在列表中`, 'SUCCESS');
                    return { success: true, newBot: newBot };
                } else {
                    this.log('新機械人未在列表中找到', 'ERROR');
                    return { success: false, error: 'New bot not found in list' };
                }
            } else {
                this.log('機械人列表未更新', 'ERROR');
                return { success: false, error: 'Bot list not updated' };
            }
        } catch (error) {
            this.log(`機械人列表更新測試異常: ${error.message}`, 'ERROR');
            return { success: false, error: error.message };
        }
    }

    async testBotDatabaseDirectly() {
        this.log('開始直接測試數據庫...');
        
        try {
            // 檢查數據庫文件是否存在
            const dbFile = 'workflow.db';
            if (!fs.existsSync(dbFile)) {
                this.log('數據庫文件不存在', 'ERROR');
                return { success: false, error: 'Database file not found' };
            }

            const stats = fs.statSync(dbFile);
            this.log(`數據庫文件大小: ${stats.size} 字節`, 'SUCCESS');

            // 通過健康檢查API測試數據庫連接
            const healthResponse = await this.makeRequest(this.workflowPort, '/workflow/health');
            if (healthResponse.statusCode === 200) {
                const healthData = JSON.parse(healthResponse.body);
                this.log(`系統健康狀態: ${healthData.status}`, 'SUCCESS');
                
                if (healthData.details) {
                    this.log('健康檢查詳情:');
                    Object.entries(healthData.details).forEach(([key, value]) => {
                        this.log(`  ${key}: ${JSON.stringify(value)}`);
                    });
                }
                
                return { success: true, health: healthData };
            } else {
                this.log(`健康檢查失敗，狀態碼: ${healthResponse.statusCode}`, 'ERROR');
                return { success: false, error: 'Health check failed' };
            }
        } catch (error) {
            this.log(`數據庫測試異常: ${error.message}`, 'ERROR');
            return { success: false, error: error.message };
        }
    }

    async runAllTests() {
        console.log('🚀 開始執行機械人API修復測試...\n');
        
        // 1. 測試數據庫連接
        const dbTest = await this.testBotDatabaseDirectly();
        
        // 2. 測試機械人列表API
        const listTest = await this.testBotListAPI();
        
        // 3. 測試機械人創建API
        const createTest = await this.testBotCreationAPI();
        
        // 4. 測試機械人列表更新
        const updateTest = await this.testBotListUpdateAfterCreation();
        
        // 生成報告
        const results = {
            database: dbTest,
            listAPI: listTest,
            createAPI: createTest,
            listUpdate: updateTest
        };
        
        console.log('\n📊 === 機械人API修復測試報告 ===');
        
        const successCount = Object.values(results).filter(r => r.success).length;
        const totalCount = Object.keys(results).length;
        
        console.log(`✅ 成功測試: ${successCount}/${totalCount}`);
        
        if (successCount === totalCount) {
            console.log('🎉 所有測試通過！機械人API工作正常');
        } else {
            console.log('⚠️ 部分測試失敗，需要進一步調查');
        }
        
        // 保存詳細報告
        try {
            fs.writeFileSync('bot-api-fix-report.json', JSON.stringify(results, null, 2));
            console.log('📝 詳細報告已保存到: bot-api-fix-report.json');
        } catch (error) {
            console.log(`❌ 無法保存報告: ${error.message}`);
        }
        
        return results;
    }
}

// 執行測試
async function main() {
    const tester = new BotAPIFixTest();
    const results = await tester.runAllTests();
    
    // 根據結果決定退出碼
    const failedTests = Object.values(results).filter(r => !r.success).length;
    process.exit(failedTests > 0 ? 1 : 0);
}

// 如果直接運行此檔案，則執行測試
if (require.main === module) {
    main().catch(console.error);
}

module.exports = BotAPIFixTest; 