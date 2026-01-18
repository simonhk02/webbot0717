const { businessLogger } = require('./utils/logger');
const path = require('path');

// 環境變數設置
require('dotenv').config();

async function testConversationFlow() {
    console.log('='.repeat(50));
    console.log('🔍 WhatsApp Bot 對話流程診斷');
    console.log('='.repeat(50));
    
    try {
        // 1. 檢查核心模組
        console.log('\n1. 檢查核心模組...');
        const { EventTypes, EventSource } = require('./core/EventTypes');
        const stateManager = require('./core/StateManager');
        const eventBus = require('./core/EventBus');
        console.log('✅ 核心模組載入成功');
        
        // 2. 檢查 WhatsApp 連接服務
        console.log('\n2. 檢查 WhatsApp 連接服務...');
        const { getClients, getLoginStatus } = require('./services/whatsappConnection');
        const clients = getClients();
        
        if (clients.size === 0) {
            console.log('❌ 沒有找到活躍的 WhatsApp 客戶端');
            console.log('   請確認：');
            console.log('   - WhatsApp 是否已連接');
            console.log('   - 用戶是否已登入');
            return;
        }
        
        console.log(`✅ 找到 ${clients.size} 個活躍客戶端`);
        
        // 3. 檢查每個客戶端的詳細狀態
        console.log('\n3. 檢查客戶端詳細狀態...');
        for (const [userId, clientData] of clients.entries()) {
            console.log(`\n用戶 ID: ${userId.substring(0, 8)}...`);
            console.log(`  - 客戶端準備狀態: ${clientData.ready ? '✅' : '❌'}`);
            console.log(`  - WebSocket 狀態: ${clientData.client?.ws?.isOpen ? '✅' : '❌'}`);
            console.log(`  - 群組名稱: ${clientData.groupName || '❌ 未設置'}`);
            console.log(`  - AI 啟用: ${clientData.enableAI ? '✅' : '❌'}`);
            console.log(`  - 訊息處理器: ${clientData.messageHandler ? '✅' : '❌'}`);
            console.log(`  - 自定義問題: ${clientData.customQuestions?.length || 0} 個`);
            
            if (clientData.customQuestions?.length > 0) {
                console.log('  - 問題清單:');
                clientData.customQuestions.forEach((q, i) => {
                    console.log(`    ${i + 1}. ${q.question} (${q.field})`);
                });
            }
        }
        
        // 4. 檢查狀態管理器
        console.log('\n4. 檢查狀態管理器...');
        console.log(`  - 費用對話狀態數量: ${stateManager.expenseState.size}`);
        console.log(`  - 圖片處理佇列長度: ${stateManager.imageProcessingQueue.length}`);
        console.log(`  - 正在處理的圖片: ${stateManager.processingImages.size}`);
        console.log(`  - 已處理訊息: ${stateManager.processedMessages.size}`);
        
        // 5. 檢查事件總線
        console.log('\n5. 檢查事件總線...');
        const eventStats = eventBus.getStats();
        console.log(`  - 註冊的事件監聽器: ${eventStats.totalListeners}`);
        console.log(`  - 發送的事件: ${eventStats.totalEmitted}`);
        console.log(`  - 處理的事件: ${eventStats.totalProcessed}`);
        
        // 6. 模擬圖片處理流程
        console.log('\n6. 模擬圖片處理流程...');
        const firstClient = clients.values().next().value;
        if (firstClient && firstClient.ready) {
            console.log('  - 模擬圖片加入佇列事件...');
            
            // 測試事件監聽器
            let eventReceived = false;
            eventBus.on(EventTypes.IMAGE.QUEUED, (data) => {
                console.log('  ✅ IMAGE.QUEUED 事件成功接收');
                eventReceived = true;
            });
            
            // 發送測試事件
            await eventBus.emit(EventTypes.IMAGE.QUEUED, {
                msgId: 'test-' + Date.now(),
                userId: 'test-user',
                chatId: 'test-chat'
            });
            
            // 等待一下讓事件處理
            await new Promise(resolve => setTimeout(resolve, 100));
            
            if (eventReceived) {
                console.log('  ✅ 事件系統運作正常');
            } else {
                console.log('  ❌ 事件系統異常');
            }
        }
        
        // 7. 檢查服務依賴
        console.log('\n7. 檢查服務依賴...');
        try {
            const ImageProcessingService = require('./services/ImageProcessingService');
            const ExpenseChatService = require('./services/ExpenseChatService');
            console.log('  ✅ ImageProcessingService 載入成功');
            console.log('  ✅ ExpenseChatService 載入成功');
        } catch (err) {
            console.log(`  ❌ 服務載入失敗: ${err.message}`);
        }
        
        // 8. 提供診斷建議
        console.log('\n8. 診斷建議...');
        
        let hasIssues = false;
        const issues = [];
        
        // 檢查常見問題
        for (const [userId, clientData] of clients.entries()) {
            if (!clientData.ready) {
                issues.push(`用戶 ${userId.substring(0, 8)}... 的客戶端未準備就緒`);
                hasIssues = true;
            }
            if (!clientData.client?.ws?.isOpen) {
                issues.push(`用戶 ${userId.substring(0, 8)}... 的 WebSocket 連接已關閉`);
                hasIssues = true;
            }
            if (!clientData.groupName) {
                issues.push(`用戶 ${userId.substring(0, 8)}... 未設置群組名稱`);
                hasIssues = true;
            }
            if (!clientData.messageHandler) {
                issues.push(`用戶 ${userId.substring(0, 8)}... 訊息處理器未註冊`);
                hasIssues = true;
            }
        }
        
        if (hasIssues) {
            console.log('\n❌ 發現以下問題：');
            issues.forEach(issue => console.log(`  - ${issue}`));
            
            console.log('\n💡 建議解決方案：');
            console.log('  1. 重新啟動 WhatsApp Bot');
            console.log('  2. 檢查 WhatsApp 連接狀態');
            console.log('  3. 確認群組名稱設置正確');
            console.log('  4. 檢查網路連接');
            console.log('  5. 查看完整日誌：npm run logs');
        } else {
            console.log('\n✅ 系統狀態正常');
            console.log('\n🔍 如果對話流程仍然無法觸發，請檢查：');
            console.log('  1. 確認在正確的 WhatsApp 群組中發送圖片');
            console.log('  2. 確認圖片格式正確（JPG/PNG）');
            console.log('  3. 檢查圖片大小不超過 10MB');
            console.log('  4. 嘗試發送簡單的文字訊息測試');
        }
        
        console.log('\n' + '='.repeat(50));
        console.log('診斷完成');
        console.log('='.repeat(50));
        
    } catch (error) {
        console.error('❌ 診斷過程中發生錯誤:', error);
        console.error('堆疊追蹤:', error.stack);
    }
}

// 如果直接執行此腳本
if (require.main === module) {
    testConversationFlow().catch(console.error);
}

module.exports = { testConversationFlow }; 