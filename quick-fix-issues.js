const http = require('http');
const fs = require('fs');

class QuickFixManager {
    constructor() {
        this.workflowPort = 3001;
        this.fixes = [];
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
                    'User-Agent': 'QuickFix/1.0'
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

    // 修復1: 檢查路由重定向問題
    async fixRouteRedirection() {
        this.log('開始檢查路由重定向問題...');
        
        try {
            const response = await this.makeRequest(this.workflowPort, '/workflow', 'GET');
            
            if (response.statusCode === 301) {
                this.log('發現301重定向，檢查Location頭部...');
                const location = response.headers.location;
                this.log(`重定向到: ${location}`);
                
                if (location) {
                    // 嘗試跟隨重定向
                    const redirectResponse = await this.makeRequest(this.workflowPort, location, 'GET');
                    if (redirectResponse.statusCode === 200) {
                        this.log('重定向目標正常工作', 'SUCCESS');
                        this.fixes.push({
                            issue: '路由重定向',
                            status: 'RESOLVED',
                            solution: '重定向目標正常工作'
                        });
                    } else {
                        this.log(`重定向目標返回狀態碼: ${redirectResponse.statusCode}`, 'ERROR');
                    }
                }
            } else if (response.statusCode === 200) {
                this.log('路由正常工作', 'SUCCESS');
                this.fixes.push({
                    issue: '路由重定向',
                    status: 'NO_ISSUE',
                    solution: '路由正常工作'
                });
            } else {
                this.log(`路由返回狀態碼: ${response.statusCode}`, 'ERROR');
            }
        } catch (error) {
            this.log(`路由檢查失敗: ${error.message}`, 'ERROR');
        }
    }

    // 修復2: 檢查機械人列表更新問題
    async fixBotListUpdate() {
        this.log('開始檢查機械人列表更新問題...');
        
        try {
            // 先檢查當前機械人列表
            const listResponse = await this.makeRequest(this.workflowPort, '/workflow/api/bots');
            if (listResponse.statusCode === 200) {
                const listData = JSON.parse(listResponse.body);
                const currentCount = listData.bots ? listData.bots.length : 0;
                this.log(`當前機械人列表數量: ${currentCount}`);
                
                // 創建測試機械人
                const testBot = {
                    name: 'QuickFixTestBot_' + Date.now(),
                    type: 'whatsapp',
                    purpose: 'testing list update',
                    aiLevel: 'basic',
                    personality: 'friendly'
                };
                
                this.log(`創建測試機械人: ${testBot.name}`);
                const createResponse = await this.makeRequest(this.workflowPort, '/workflow/api/bots', 'POST', testBot);
                
                if (createResponse.statusCode === 200 || createResponse.statusCode === 201) {
                    this.log('機械人創建成功', 'SUCCESS');
                    
                    // 等待一小段時間讓數據庫更新
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // 再次檢查列表
                    const updatedListResponse = await this.makeRequest(this.workflowPort, '/workflow/api/bots');
                    if (updatedListResponse.statusCode === 200) {
                        const updatedListData = JSON.parse(updatedListResponse.body);
                        const updatedCount = updatedListData.bots ? updatedListData.bots.length : 0;
                        
                        this.log(`更新後機械人列表數量: ${updatedCount}`);
                        
                        if (updatedCount > currentCount) {
                            this.log('機械人列表成功更新', 'SUCCESS');
                            this.fixes.push({
                                issue: '機械人列表更新',
                                status: 'RESOLVED',
                                solution: '列表更新正常工作'
                            });
                        } else {
                            this.log('機械人列表未更新', 'ERROR');
                            this.fixes.push({
                                issue: '機械人列表更新',
                                status: 'UNRESOLVED',
                                solution: '需要檢查數據庫事務處理'
                            });
                        }
                    }
                } else {
                    this.log(`機械人創建失敗，狀態碼: ${createResponse.statusCode}`, 'ERROR');
                }
            }
        } catch (error) {
            this.log(`機械人列表檢查失敗: ${error.message}`, 'ERROR');
        }
    }

    // 修復3: 檢查系統健康狀態
    async checkSystemHealth() {
        this.log('開始檢查系統健康狀態...');
        
        try {
            const response = await this.makeRequest(this.workflowPort, '/workflow/health');
            if (response.statusCode === 200) {
                const healthData = JSON.parse(response.body);
                this.log(`系統健康狀態: ${healthData.status}`, 'SUCCESS');
                
                // 檢查詳細健康信息
                if (healthData.details) {
                    this.log('系統詳細信息:');
                    Object.entries(healthData.details).forEach(([key, value]) => {
                        this.log(`  ${key}: ${JSON.stringify(value)}`);
                    });
                }
                
                this.fixes.push({
                    issue: '系統健康檢查',
                    status: 'HEALTHY',
                    solution: '系統運行正常'
                });
            } else {
                this.log(`健康檢查失敗，狀態碼: ${response.statusCode}`, 'ERROR');
            }
        } catch (error) {
            this.log(`健康檢查失敗: ${error.message}`, 'ERROR');
        }
    }

    // 修復4: 檢查數據庫連接
    async checkDatabaseConnection() {
        this.log('開始檢查數據庫連接...');
        
        try {
            // 檢查數據庫文件
            const dbFile = 'workflow.db';
            if (fs.existsSync(dbFile)) {
                const stats = fs.statSync(dbFile);
                this.log(`數據庫文件存在，大小: ${stats.size} 字節`, 'SUCCESS');
                
                // 通過API檢查數據庫連接
                const response = await this.makeRequest(this.workflowPort, '/workflow/api/bots');
                if (response.statusCode === 200) {
                    this.log('數據庫API連接正常', 'SUCCESS');
                    this.fixes.push({
                        issue: '數據庫連接',
                        status: 'HEALTHY',
                        solution: '數據庫連接正常'
                    });
                } else {
                    this.log(`數據庫API連接失敗，狀態碼: ${response.statusCode}`, 'ERROR');
                }
            } else {
                this.log('數據庫文件不存在', 'ERROR');
            }
        } catch (error) {
            this.log(`數據庫檢查失敗: ${error.message}`, 'ERROR');
        }
    }

    // 生成修復報告
    generateReport() {
        console.log('\n📊 === 快速修復報告 ===');
        
        const totalFixes = this.fixes.length;
        const resolvedFixes = this.fixes.filter(f => f.status === 'RESOLVED' || f.status === 'HEALTHY' || f.status === 'NO_ISSUE').length;
        const unresolvedFixes = this.fixes.filter(f => f.status === 'UNRESOLVED').length;
        
        this.log(`總檢查項目: ${totalFixes}`);
        this.log(`已解決/正常: ${resolvedFixes}`);
        this.log(`未解決: ${unresolvedFixes}`);
        
        console.log('\n詳細修復信息:');
        this.fixes.forEach((fix, index) => {
            const statusIcon = fix.status === 'RESOLVED' || fix.status === 'HEALTHY' || fix.status === 'NO_ISSUE' ? '✅' : '❌';
            console.log(`${statusIcon} ${index + 1}. ${fix.issue}: ${fix.solution}`);
        });
        
        return {
            total: totalFixes,
            resolved: resolvedFixes,
            unresolved: unresolvedFixes,
            fixes: this.fixes
        };
    }

    // 執行所有修復
    async runAllFixes() {
        console.log('🔧 開始執行快速修復檢查...\n');
        
        await this.checkSystemHealth();
        await this.checkDatabaseConnection();
        await this.fixRouteRedirection();
        await this.fixBotListUpdate();
        
        return this.generateReport();
    }
}

// 執行修復
async function main() {
    const fixer = new QuickFixManager();
    const report = await fixer.runAllFixes();
    
    // 保存報告
    try {
        fs.writeFileSync('quick-fix-report.json', JSON.stringify(report, null, 2));
        console.log('\n📝 修復報告已保存到: quick-fix-report.json');
    } catch (error) {
        console.log(`\n❌ 無法保存修復報告: ${error.message}`);
    }
}

// 如果直接運行此檔案，則執行修復
if (require.main === module) {
    main().catch(console.error);
}

module.exports = QuickFixManager; 