/**
 * 觸發器API調試腳本
 * 用於診斷觸發器API 500錯誤的詳細原因
 */

const { businessLogger } = require('./utils/logger');

async function debugTriggerAPI() {
  try {
    businessLogger.info('🚀 開始調試觸發器API...');

    // 測試創建觸發器API
    let fetch;
    try {
      fetch = require('node-fetch');
    } catch (e) {
      // 使用Node.js 18+內建fetch (如果可用)
      fetch = globalThis.fetch || require('http').request;
    }
    
    const triggerData = {
      name: "測試圖片觸發器",
      type: "image",
      config: {
        fileTypes: ["jpg", "png", "pdf"],
        contentFilters: ["invoice", "receipt"]
      },
      workflowId: 1
    };

    businessLogger.info('📤 發送創建觸發器請求:', triggerData);

    const response = await fetch('http://localhost:3001/workflow/api/triggers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(triggerData)
    });

    businessLogger.info(`📥 API響應狀態: ${response.status}`);
    
    const responseText = await response.text();
    businessLogger.info('📥 API響應內容:', responseText);

    if (!response.ok) {
      try {
        const errorData = JSON.parse(responseText);
        businessLogger.error('❌ API錯誤詳情:', errorData);
      } catch (e) {
        businessLogger.error('❌ 原始錯誤內容:', responseText);
      }
    }

  } catch (error) {
    businessLogger.error('❌ 調試過程失敗:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
  }
}

// 執行調試
debugTriggerAPI(); 