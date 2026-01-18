const { businessLogger } = require('../utils/logger');

class UserExperienceService {
  constructor() {
    this.messageTemplates = {
      // 歡迎和幫助消息
      welcome: `🎉 **歡迎使用智能費用記錄系統！**

🚀 **快速上手**：
• 發送收據圖片即可開始記錄
• 系統會自動識別並詢問詳細資訊
• 所有資料自動同步到 Google Sheet

💡 **實用指令**：
• 輸入「幫助」查看詳細說明
• 輸入「狀態」查看處理進度
• 輸入「設定」管理您的配置

🎯 現在就試試發送一張收據圖片吧！`,

      help: `📋 **費用記錄系統使用說明**

🖼️ **記錄費用**：
• 發送收據圖片
• 系統會自動識別並詢問詳細資訊
• 按步驟回答問題即可

⚙️ **功能說明**：
• 圖片會上傳到 Google Drive
• 資料會自動寫入 Google Sheet
• 支援 AI 智能識別收據資訊

🔍 **圖片要求**：
• 支援 JPG、PNG 格式
• 建議圖片清晰、光線充足
• 文件大小小於 10MB

💡 **小提示**：
• 一次只處理一張圖片
• 處理時間約 1-2 分鐘
• 如遇問題請重新發送圖片

🛠️ **常用指令**：
• 輸入「狀態」查看處理進度
• 輸入「設定」管理配置
• 輸入「歡迎」查看快速指南`,

      processing: {
        start: '🎯 開始處理您的收據圖片...\n\n🔍 步驟 1/3：圖片分析中',
        ai: '🤖 步驟 2/3：AI 智能識別中...\n\n⏱️ 正在提取收據資訊，請稍候',
        upload: '📤 步驟 3/3：上傳到雲端...\n\n☁️ 正在保存到 Google Drive',
        sheet: '📊 正在寫入表格...\n\n✍️ 資料同步到 Google Sheet 中',
        complete: '✅ 處理完成！\n\n📋 費用記錄已成功保存'
      },

      queue: {
        added: (position, waitTime) => `⏳ 您的圖片已加入處理佇列\n\n📊 目前排隊：第 ${position} 位\n⏰ 預計等待：${waitTime} 分鐘\n\n💡 處理完成後會自動通知您！`,
        processing: (remaining) => remaining > 0 
          ? `🚀 開始處理您的圖片！\n\n📊 當前處理：您的收據\n⏳ 預計完成時間：1-2 分鐘\n\n📋 後續還有 ${remaining} 張圖片等待處理`
          : `🚀 開始處理您的圖片！\n\n📊 當前處理：您的收據\n⏳ 預計完成時間：1-2 分鐘`
      },

      errors: {
        connection: '🔌 連接不穩定，請稍後再試。如果問題持續，請重新掃描 QR 碼。',
        upload: '📤 圖片上傳失敗，請檢查網絡連接後重試。',
        sheet: '📊 寫入表格失敗，請檢查 Google Sheet 設定。',
        format: '📷 圖片格式不支援，請發送 JPG 或 PNG 格式的圖片。',
        size: '📏 圖片太大，請壓縮後重新發送（建議小於 10MB）。',
        timeout: '⏰ 處理超時，請重新發送圖片。可能是圖片太大或網絡不穩定。',
        general: '❌ 處理過程中出現問題，請重新發送圖片開始新的記錄。',
        invalidData: '⚠️ 數據格式不正確，請重新發送圖片。'
      },

      tips: [
        '💡 小提示：拍攝收據時，請確保光線充足，文字清晰可見。',
        '🎯 建議：可以在圖片上輕點對焦，讓收據內容更清楚。',
        '📱 提示：如果圖片較大，建議先壓縮再發送，處理速度會更快。',
        '⚡ 快速技巧：一次只發送一張圖片，等待處理完成後再發送下一張。',
        '🔍 識別優化：收據平放拍攝效果最佳，避免傾斜或摺疊。'
      ]
    };

    businessLogger.info('用戶體驗服務已初始化');
  }

  // 發送歡迎消息
  async sendWelcomeMessage(client, chatId) {
    return this.sendMessage(client, chatId, this.messageTemplates.welcome);
  }

  // 發送幫助消息
  async sendHelpMessage(client, chatId) {
    return this.sendMessage(client, chatId, this.messageTemplates.help);
  }

  // 發送處理進度消息
  async sendProcessingMessage(client, chatId, step) {
    const message = this.messageTemplates.processing[step];
    if (message) {
      return this.sendMessage(client, chatId, message);
    }
  }

  // 發送佇列相關消息
  async sendQueueMessage(client, chatId, type, ...args) {
    let message;
    if (type === 'added') {
      message = this.messageTemplates.queue.added(...args);
    } else if (type === 'processing') {
      message = this.messageTemplates.queue.processing(...args);
    }
    
    if (message) {
      return this.sendMessage(client, chatId, message);
    }
  }

  // 發送錯誤消息
  async sendErrorMessage(client, chatId, errorType, details = '') {
    let message = this.messageTemplates.errors[errorType] || this.messageTemplates.errors.general;
    
    if (details) {
      message += `\n\n詳細信息：${details}`;
    }
    
    // 添加重試提示
    message += '\n\n🔄 您可以直接重新發送圖片來重試。';
    
    return this.sendMessage(client, chatId, message);
  }

  // 發送隨機小提示
  async sendRandomTip(client, chatId) {
    const randomTip = this.messageTemplates.tips[Math.floor(Math.random() * this.messageTemplates.tips.length)];
    return this.sendMessage(client, chatId, randomTip);
  }

  // 發送進度條消息
  async sendProgressMessage(client, chatId, current, total, description) {
    const percentage = Math.floor((current / total) * 100);
    const progressBar = '▓'.repeat(Math.floor(percentage / 10)) + '░'.repeat(10 - Math.floor(percentage / 10));
    
    const message = `${description}\n\n進度：${progressBar} ${percentage}%\n步驟：${current}/${total}`;
    return this.sendMessage(client, chatId, message);
  }

  // 發送狀態消息
  async sendStatusMessage(client, chatId, status) {
    const statusMessages = {
      connected: '✅ 系統運行正常，隨時為您服務！',
      processing: '⚙️ 正在處理中，請稍候...',
      idle: '😴 系統待機中，發送圖片開始記錄費用。',
      error: '❌ 系統遇到問題，請稍後重試或聯絡管理員。'
    };
    
    const message = statusMessages[status] || statusMessages.idle;
    return this.sendMessage(client, chatId, message);
  }

  // 檢查是否為指令
  isCommand(text) {
    if (!text) return false;
    
    const commands = {
      help: ['help', '幫助', '說明', '指引', '教學', 'how to', '怎麼用', '使用方法'],
      welcome: ['歡迎', 'welcome', '開始', 'start', '指南'],
      status: ['狀態', 'status', '進度', 'progress'],
      tip: ['提示', 'tip', '建議', 'suggestion'],
      settings: ['設定', 'settings', '配置', 'config']
    };
    
    const lowerText = text.toLowerCase().trim();
    
    for (const [command, keywords] of Object.entries(commands)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return command;
      }
    }
    
    return null;
  }

  // 處理用戶指令
  async handleCommand(client, chatId, command) {
    switch (command) {
      case 'help':
        return this.sendHelpMessage(client, chatId);
      case 'welcome':
        return this.sendWelcomeMessage(client, chatId);
      case 'status':
        return this.sendStatusMessage(client, chatId, 'idle');
      case 'tip':
        return this.sendRandomTip(client, chatId);
      case 'settings':
        return this.sendMessage(client, chatId, '⚙️ 設定功能開發中，敬請期待！\n\n目前您可以聯絡管理員調整設定。');
      default:
        return false;
    }
  }

  // 統一的消息發送方法
  async sendMessage(client, chatId, message) {
    if (!client || !client.ws || !client.ws.isOpen) {
      businessLogger.warn('客戶端未就緒，無法發送消息');
      return false;
    }

    try {
      await client.sendMessage(chatId, { text: message });
      businessLogger.info(`用戶體驗消息已發送：chatId=${chatId}`);
      return true;
    } catch (err) {
      businessLogger.error(`發送用戶體驗消息失敗：${err.message}`);
      return false;
    }
  }

  // 分析用戶互動模式
  analyzeUserPattern(userId, action) {
    // 這裡可以添加用戶行為分析邏輯
    businessLogger.info(`用戶互動分析：userId=${userId}, action=${action}`);
  }

  // 獲取個性化建議
  getPersonalizedSuggestion(userId) {
    // 這裡可以根據用戶歷史返回個性化建議
    return this.messageTemplates.tips[0]; // 暫時返回第一個提示
  }
}

// 建立單例實例
const userExperienceService = new UserExperienceService();

module.exports = userExperienceService; 