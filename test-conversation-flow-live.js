const axios = require('axios');

async function testLiveConversationFlow() {
    console.log('='.repeat(50));
    console.log('🔍 WhatsApp Bot 在線對話流程診斷');
    console.log('='.repeat(50));
    
    const baseURL = 'http://localhost:3002';
    
    try {
        // 1. 檢查服務是否在線
        console.log('\n1. 檢查服務狀態...');
        const healthResponse = await axios.get(`${baseURL}/api/health`);
        console.log('✅ 服務在線');
        console.log(`  - 狀態: ${healthResponse.data.status}`);
        console.log(`  - 運行時間: ${healthResponse.data.uptime}`);
        
        // 2. 檢查 WhatsApp 連接狀態
        console.log('\n2. 檢查 WhatsApp 連接狀態...');
        const connectionResponse = await axios.get(`${baseURL}/api/whatsapp/connection-status`);
        const connectionData = connectionResponse.data;
        
        console.log(`  - 總連接數: ${connectionData.connections.total}`);
        console.log(`  - 活躍連接: ${connectionData.connections.active}`);
        console.log(`  - 非活躍連接: ${connectionData.connections.inactive}`);
        
        if (connectionData.connections.active === 0) {
            console.log('❌ 沒有活躍的 WhatsApp 連接');
            console.log('   建議：重新掃描 QR 碼或檢查 WhatsApp 連接');
            return;
        }
        
        // 3. 檢查用戶設置
        console.log('\n3. 檢查用戶設置...');
        try {
            // 先嘗試獲取用戶列表
            const usersResponse = await axios.get(`${baseURL}/api/users`);
            const users = usersResponse.data.users || [];
            
            if (users.length === 0) {
                console.log('❌ 沒有找到用戶');
                console.log('   建議：請先登入用戶');
                return;
            }
            
            const user = users[0]; // 獲取第一個用戶
            const userId = user.id;
            console.log(`✅ 找到用戶: ${user.email}`);
            console.log(`  - 用戶ID: ${userId.substring(0, 8)}...`);
            
            // 檢查用戶的 WhatsApp 狀態
            const whatsappStatusResponse = await axios.get(`${baseURL}/api/whatsapp/status?userId=${userId}`);
            const whatsappStatus = whatsappStatusResponse.data;
            
            console.log(`  - WhatsApp 連接狀態: ${whatsappStatus.connected ? '✅' : '❌'}`);
            console.log(`  - 客戶端準備狀態: ${whatsappStatus.ready ? '✅' : '❌'}`);
            
            if (!whatsappStatus.connected || !whatsappStatus.ready) {
                console.log('❌ WhatsApp 客戶端未準備就緒');
                console.log('   建議：重新掃描 QR 碼');
                return;
            }
            
            // 檢查用戶設置
            const settingsResponse = await axios.get(`${baseURL}/api/users/settings?userId=${userId}`);
            const settings = settingsResponse.data;
            
            console.log(`  - 群組名稱: ${settings.groupName || '❌ 未設置'}`);
            console.log(`  - AI 啟用: ${settings.enableAI ? '✅' : '❌'}`);
            console.log(`  - 自定義問題: ${settings.customQuestions?.length || 0} 個`);
            console.log(`  - Sheet ID: ${settings.sheetId ? '✅' : '❌'}`);
            console.log(`  - Drive 文件夾: ${settings.driveFolderId ? '✅' : '❌'}`);
            
            if (!settings.groupName) {
                console.log('❌ 關鍵問題：群組名稱未設置');
                console.log('   這是對話流程無法觸發的主要原因！');
                console.log('   解決方案：');
                console.log('   1. 訪問 http://localhost:3002/settings');
                console.log('   2. 設置正確的 WhatsApp 群組名稱');
                console.log('   3. 確保該群組名稱與您要使用的 WhatsApp 群組完全一致');
                return;
            }
            
            // 4. 檢查事件系統
            console.log('\n4. 檢查事件系統...');
            const eventStatsResponse = await axios.get(`${baseURL}/api/health/detailed`);
            const eventStats = eventStatsResponse.data;
            
            if (eventStats.events) {
                console.log(`  - 事件總線: ${eventStats.events.status}`);
                console.log(`  - 註冊監聽器: ${eventStats.events.listeners || 0}`);
                console.log(`  - 發送事件: ${eventStats.events.emitted || 0}`);
            } else {
                console.log('  - 事件統計: 不可用');
            }
            
            // 5. 檢查圖片處理佇列
            console.log('\n5. 檢查圖片處理佇列...');
            // 這裡需要添加 API 端點來檢查佇列狀態
            console.log('  - 佇列狀態檢查: 需要添加 API 端點');
            
            // 6. 提供使用指南
            console.log('\n6. 使用指南...');
            console.log('  要觸發對話流程，請確保：');
            console.log(`  1. 在 WhatsApp 群組 "${settings.groupName}" 中發送圖片`);
            console.log('  2. 圖片格式為 JPG 或 PNG');
            console.log('  3. 圖片大小不超過 10MB');
            console.log('  4. 等待系統回應（可能需要 1-2 分鐘）');
            
            if (settings.enableAI) {
                console.log('  5. AI 功能已啟用，系統會自動識別收據');
            } else {
                console.log('  5. AI 功能未啟用，系統會詢問自定義問題');
                if (settings.customQuestions?.length > 0) {
                    console.log('     自定義問題：');
                    settings.customQuestions.forEach((q, i) => {
                        console.log(`     ${i + 1}. ${q.question}`);
                    });
                }
            }
            
            console.log('\n✅ 系統診斷完成，配置看起來正常');
            console.log('   如果對話流程仍然無法觸發，請檢查：');
            console.log('   - 是否在正確的群組中');
            console.log('   - 群組名稱是否完全匹配（區分大小寫）');
            console.log('   - 網路連接是否穩定');
            
        } catch (userError) {
            console.log('❌ 獲取用戶信息失敗:', userError.response?.data?.error || userError.message);
            console.log('   建議：請先登入用戶');
        }
        
    } catch (error) {
        console.error('❌ 診斷過程中發生錯誤:', error.response?.data?.error || error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('   服務未運行，請先啟動 WhatsApp Bot');
        }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('診斷完成');
    console.log('='.repeat(50));
}

if (require.main === module) {
    testLiveConversationFlow().catch(console.error);
}

module.exports = { testLiveConversationFlow }; 