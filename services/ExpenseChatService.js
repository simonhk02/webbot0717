const { businessLogger } = require('../utils/logger');
const { createSuccessMessage, createErrorMessage, createWarningMessage, formatMessage } = require('../utils/messageUtils');
const { uploadImageToDrive, writeToSheet } = require('../googleService');
const config = require('../config');
const stateManager = require('../core/StateManager');
const eventBus = require('../core/EventBus');
const { EventTypes, EventSource } = require('../core/EventTypes');
const pLimit = require('p-limit');

const processLimit = pLimit(config.app.imageProcessingLimit);

class ExpenseChatService {
  constructor() {
    businessLogger.info('費用對話服務已初始化');
  }

  async startExpenseChat(chatId, media, defaultDate, client, driveFolderId, msgId) {
    businessLogger.info(`開始費用對話流程：chatId=${chatId}，msgId=${msgId}`);
    let userId;
    const { getClients } = require('./whatsappConnection');
    
    for (const [id, data] of getClients().entries()) {
      if (data.client === client) {
        userId = id;
        break;
      }
    }
    if (!userId) {
      businessLogger.error(`無法找到 chatId ${chatId} 對應的用戶 ID`);
      stateManager.deleteExpenseState(chatId, msgId);
      stateManager.markImageProcessed(msgId);
      stateManager.setImageProcessingStatus(false);
      this.processImageQueue();
      return;
    }

    const clientData = getClients().get(userId);
    if (!clientData.ready || !clientData.client.ws.isOpen) {
      businessLogger.warn(`用戶 ${userId} 的客戶端未就緒或連線已關閉，忽略費用對話流程`);
      stateManager.deleteExpenseState(chatId, msgId);
      stateManager.markImageProcessed(msgId);
      stateManager.setImageProcessingStatus(false);
      this.processImageQueue();
      return;
    }

    // 檢查是否啟用 AI 功能
    if (clientData.enableAI) {
      businessLogger.info(`用戶 ${userId} 已啟用 AI 功能，開始圖片識別`);
      try {
        const imageBuffer = Buffer.from(media.data, 'base64');
        const AIService = require('./aiService');
        const aiService = new AIService();
        await aiService.initialize();
        const { rawText, parsedData } = await aiService.recognizeImage(imageBuffer, userId);
        if (!parsedData) {
          throw new Error('AI 未返回有效數據');
        }

        businessLogger.info(`AI 識別成功，開始確認流程：chatId=${chatId}，msgId=${msgId}`);

        // 儲存AI識別結果到狀態管理器，等待用戶確認
        stateManager.setAIConfirmationState(chatId, msgId, {
          parsedData,
          media,
          userId,
          driveFolderId: clientData.driveFolderId,
          sheetId: clientData.sheetId,
          sheetName: clientData.sheetName,
          customQuestions: clientData.customQuestions || []
        });

        // 格式化並發送識別結果（第一段訊息）
        let resultMessage = '🤖 **AI 識別結果**\n\n';
        for (const [field, value] of Object.entries(parsedData)) {
          resultMessage += `${field}: ${value || '未知'}\n`;
        }

        await client.sendMessage(chatId, { text: resultMessage });

        // 發送確認請求（第二段訊息）
        const confirmationMessage = `📝 **請確認或修改**\n\n` +
          `請檢查以上識別結果是否正確：\n\n` +
          `✅ 回覆「確認」直接上傳\n` +
          `✏️ 或直接復製上方結果並修改後發送\n` +
          `❌ 回覆「取消」放棄此次記錄`;

        await client.sendMessage(chatId, { text: confirmationMessage });
        businessLogger.info(`AI 確認流程啟動：chatId=${chatId}，msgId=${msgId}`);

        // 清理圖片處理狀態，但不標記為完全處理完成
        stateManager.setImageProcessingStatus(false);
        this.processImageQueue();
        return;
      } catch (err) {
        businessLogger.error(`AI 識別失敗：${err.message}`);
        if (clientData.ready && clientData.client.ws.isOpen) {
          try {
            await client.sendMessage(chatId, { text: createWarningMessage(`AI 識別失敗：${err.message}，將使用一般對話流程`) });
          } catch (sendErr) {
            businessLogger.warn(`無法發送 AI 失敗訊息：${sendErr.message}`);
          }
        }
      }
    }

    // 一般對話流程
    let questions = [];
    if (clientData.customQuestions && Array.isArray(clientData.customQuestions) && clientData.customQuestions.length > 0) {
      questions = clientData.customQuestions.filter(q => q.question && q.field);
      if (questions.length === 0) {
        businessLogger.warn(`用戶 ${userId} 的自訂問題無有效問題，使用預設問題`);
        questions = [{ question: '請輸入店鋪名稱', field: 'shop' }];
      }
    } else {
      questions = [{ question: '請輸入店鋪名稱', field: 'shop' }];
    }
    businessLogger.info(`啟動費用對話流程：問題數量=${questions.length}，問題=${JSON.stringify(questions)}`);

    stateManager.setExpenseState(chatId, msgId, {
      step: 1,
      answers: { media },
      questions,
      lastActive: Date.now(),
      lastMessageId: null,
      msgId,
      userId
    });

    try {
      if (client.ws.isOpen) {
        await client.sendMessage(chatId, { text: questions[0].question });
        businessLogger.info(`費用對話流程開始：已發送第一個問題：${questions[0].question}`);
      }
    } catch (err) {
      businessLogger.warn(`為用戶 ${userId} 發送問題失敗：${err.message}`);
      stateManager.deleteExpenseState(chatId, msgId);
      stateManager.markImageProcessed(msgId);
      stateManager.setImageProcessingStatus(false);
      this.processImageQueue();
    }
  }

  async finishExpenseChat(chatId, state, client) {
    // 添加安全檢查
    if (!state || !state.msgId) {
      businessLogger.error(`費用對話狀態無效：chatId=${chatId}, state=${JSON.stringify(state)}`);
      // 發送友好的錯誤消息給用戶
      if (client && client.ws && client.ws.isOpen) {
        try {
          await client.sendMessage(chatId, { 
            text: '⚠️ 對話流程出現問題，請重新發送圖片開始新的費用記錄。' 
          });
        } catch (err) {
          businessLogger.warn(`無法發送錯誤消息：${err.message}`);
        }
      }
      return;
    }

    businessLogger.info(`結束費用對話流程：chatId=${chatId}，msgId=${state.msgId}`);
    
    // 發送處理中消息給用戶
    if (client && client.ws && client.ws.isOpen) {
      try {
        await client.sendMessage(chatId, { 
          text: '📝 正在處理您的費用記錄，請稍候...' 
        });
      } catch (err) {
        businessLogger.warn(`無法發送處理中消息：${err.message}`);
      }
    }

    let userId;
    const { getClients } = require('./whatsappConnection');
    
    for (const [id, data] of getClients().entries()) {
      if (data.client === client) {
        userId = id;
        break;
      }
    }
    
    if (!userId) {
      businessLogger.error(`無法找到 chatId ${chatId} 對應的用戶 ID`);
      // 發送友好錯誤消息
      if (client && client.ws && client.ws.isOpen) {
        try {
          await client.sendMessage(chatId, { 
            text: '❌ 系統無法識別您的身份，請重新連接 WhatsApp 後再試。' 
          });
        } catch (err) {
          businessLogger.warn(`無法發送用戶ID錯誤消息：${err.message}`);
        }
      }
      this.cleanupFailedExpenseChat(chatId, state.msgId);
      return;
    }

    const clientData = getClients().get(userId);
    if (!clientData || !clientData.ready || !clientData?.client?.ws?.isOpen) {
      businessLogger.warn(`用戶 ${userId} 的客戶端未就緒或連線已關閉，中止費用${chatId} 的對話流程`);
      // 發送友好錯誤消息
      if (client && client.ws && client.ws.isOpen) {
        try {
          await client.sendMessage(chatId, { 
            text: '🔌 連接不穩定，正在嘗試重新連接。請稍後再試或重新發送圖片。' 
          });
        } catch (err) {
          businessLogger.warn(`無法發送連接錯誤消息：${err.message}`);
        }
      }
      this.cleanupFailedExpenseChat(chatId, state.msgId);
      return;
    }

    let imageUrl = '';
    let errorMessage = '';

    // 圖片上傳階段 - 增加進度反饋
    try {
      if (!state.answers.media || !state.answers.media.data) {
        throw new Error('圖片數據無效');
      }
      if (!clientData.driveFolderId) {
        throw new Error('無效的 Google Drive 文件夾 ID');
      }
      
      // 發送上傳進度消息
      if (client && client.ws && client.ws.isOpen) {
        try {
          await client.sendMessage(chatId, { 
            text: '📤 正在上傳圖片到雲端...' 
          });
        } catch (err) {
          businessLogger.warn(`無法發送上傳進度消息：${err.message}`);
        }
      }
      
      const filename = `receipt_${Date.now()}_${Math.random().toString(36).substring(2)}.jpg`;
      imageUrl = await processLimit(() => uploadImageToDrive(
        state.answers.media.data,
        state.answers.media.mimetype,
        filename,
        clientData.driveFolderId
      ));
      businessLogger.info(`圖片上傳結果：imageUrl=${imageUrl}`);
      
      // 發送上傳成功消息
      if (client && client.ws && client.ws.isOpen) {
        try {
          await client.sendMessage(chatId, { 
            text: '✅ 圖片上傳成功！正在寫入表格...' 
          });
        } catch (err) {
          businessLogger.warn(`無法發送上傳成功消息：${err.message}`);
        }
      }
      
    } catch (err) {
      errorMessage = `圖片上傳失敗：${err.message}`;
      businessLogger.error(errorMessage);
      imageUrl = '';
      
      // 發送上傳失敗消息
      if (client && client.ws && client.ws.isOpen) {
        try {
          await client.sendMessage(chatId, { 
            text: '❌ 圖片上傳失敗，但會繼續處理其他資料...' 
          });
        } catch (err) {
          businessLogger.warn(`無法發送上傳失敗消息：${err.message}`);
        }
      }
    }

    const answers = { ...state.answers, imageUrl };
    const fields = clientData.customQuestions?.map(q => q.field).concat(['imageUrl']) || ['imageUrl'];
    businessLogger.info(`提交欄位：${fields.join(', ')}`);

    let success = false;
    try {
      if (!clientData.sheetId || !clientData.sheetName) {
        throw new Error('無效的 Google Sheet ID 或工作表名稱');
      }
      const headers = (clientData.customQuestions || []).map(q => q.field);
      const rowData = {};
      headers.forEach(field => {
        rowData[field] = answers[field] || '';
      });
      if (imageUrl) rowData['imageUrl'] = imageUrl;
      success = await processLimit(() => writeToSheet(
        clientData.sheetId,
        clientData.sheetName,
        rowData,
        headers
      ));
      businessLogger.info(`Google Sheet 寫入結果：${success}`);
    } catch (err) {
      errorMessage = errorMessage || `寫入 Google Sheet 失敗：${err.message}`;
      businessLogger.error(errorMessage);
      success = false;
    }

    const submissionData = { answers: { ...state.answers, imageUrl } };
    const messageFormat = clientData.messageFormat;
    const summary = formatMessage(submissionData.answers, messageFormat);
    const responseMessage = success
      ? createSuccessMessage('提交', submissionData)
      : createErrorMessage('提交', errorMessage || '請檢查設置後重試。');

    try {
      if (clientData.ready && clientData.client.ws.isOpen) {
        await client.sendMessage(chatId, { text: responseMessage });
        businessLogger.info(`提交結果：${success ? '成功' : '失敗'}，總結：${summary}`);
      }
    } catch (err) {
      businessLogger.warn(`無法為用戶 ${userId} 發送提交結果：${err.message}`);
    }

    stateManager.deleteExpenseState(chatId, state.msgId);
    stateManager.markImageProcessed(state.msgId);
    stateManager.setImageProcessingStatus(false);
    this.processImageQueue();
  }

  processImageQueue() {
    const imageProcessingService = require('./ImageProcessingService');
    imageProcessingService.processImageQueue();
  }

  /**
   * 處理AI確認後的上傳流程
   */
  async handleAIConfirmation(chatId, msgId, confirmedData, client) {
    businessLogger.info(`開始處理AI確認上傳：chatId=${chatId}，msgId=${msgId}`);
    
    try {
      // 獲取AI確認狀態
      const aiState = stateManager.getAIConfirmationState(chatId, msgId);
      if (!aiState) {
        throw new Error('找不到AI確認狀態');
      }

      // 驗證必要參數
      if (!aiState.driveFolderId || !aiState.sheetId || !aiState.sheetName) {
        throw new Error('缺少必要的上傳設置');
      }

      // 發送處理開始消息
      if (client && client.ws && client.ws.isOpen) {
        await client.sendMessage(chatId, { 
          text: '📤 開始上傳資料到雲端...' 
        });
      }

      // 1. 上傳圖片到 Google Drive
      businessLogger.info(`開始上傳圖片到Google Drive：${aiState.driveFolderId}`);
      const filename = `receipt_${Date.now()}_${Math.random().toString(36).substring(2)}.jpg`;
      const imageUrl = await processLimit(() => uploadImageToDrive(
        aiState.media.data,
        aiState.media.mimetype,
        filename,
        aiState.driveFolderId
      ));

      // 發送上傳成功消息
      if (client && client.ws && client.ws.isOpen) {
        await client.sendMessage(chatId, { 
          text: '✅ 圖片上傳成功！正在寫入表格...' 
        });
      }

      // 2. 將確認的資料和圖片URL寫入Google Sheet
      const rowData = { ...confirmedData, imageUrl };
      const headers = Object.keys(confirmedData);
      const success = await processLimit(() => writeToSheet(
        aiState.sheetId,
        aiState.sheetName,
        rowData,
        headers
      ));

      // 3. 發送最終結果
      let responseMessage = success 
        ? '✅ **AI 識別結果已成功保存！**\n\n' 
        : '⚠️ **AI 識別結果（寫入失敗）**\n\n';
      
      for (const [field, value] of Object.entries(confirmedData)) {
        responseMessage += `${field}: ${value || '未知'}\n`;
      }
      responseMessage += `\n📎 圖片連結：${imageUrl}`;

      if (client && client.ws && client.ws.isOpen) {
        await client.sendMessage(chatId, { text: responseMessage });
      }

      businessLogger.info(`AI 確認上傳完成：chatId=${chatId}，msgId=${msgId}，成功=${success}`);

      // 清理狀態
      stateManager.deleteAIConfirmationState(chatId, msgId);
      stateManager.markImageProcessed(msgId);
      stateManager.setImageProcessingStatus(false);
      this.processImageQueue();

      return success;

    } catch (err) {
      businessLogger.error(`AI 確認上傳失敗：${err.message}`);
      
      // 發送錯誤消息
      if (client && client.ws && client.ws.isOpen) {
        try {
          await client.sendMessage(chatId, { 
            text: `❌ 上傳失敗：${err.message}\n\n您可以重新發送圖片再試一次。` 
          });
        } catch (sendErr) {
          businessLogger.warn(`無法發送AI確認上傳失敗訊息：${sendErr.message}`);
        }
      }

      // 清理狀態
      stateManager.deleteAIConfirmationState(chatId, msgId);
      stateManager.markImageProcessed(msgId);
      stateManager.setImageProcessingStatus(false);
      this.processImageQueue();
      
      throw err;
    }
  }

  async handleExpenseMessage(chatId, message, client) {
    const { getClients } = require('./whatsappConnection');
    let userId;
    for (const [id, data] of getClients().entries()) {
      if (data.client === client) {
        userId = id;
        break;
      }
    }

    if (!userId) {
      businessLogger.error(`無法找到 chatId ${chatId} 對應的用戶 ID`);
      return;
    }

    const state = stateManager.getExpenseState(chatId);
    if (!state) {
      businessLogger.warn(`chatId ${chatId} 無費用對話狀態`);
      return;
    }

    const clientData = getClients().get(userId);
    if (!clientData.ready || !clientData.client.ws.isOpen) {
      businessLogger.warn(`用戶 ${userId} 的客戶端未就緒或連線已關閉，忽略費用對話訊息`);
      return;
    }

    // 更新最後活動時間
    state.lastActive = Date.now();
    stateManager.setExpenseState(chatId, state.msgId, state);

    const currentQuestion = state.questions[state.step - 1];
    if (!currentQuestion) {
      businessLogger.warn(`chatId ${chatId} 的費用對話步驟無效：step=${state.step}`);
      return;
    }

    // 保存答案
    state.answers[currentQuestion.field] = message;
    businessLogger.info(`保存答案：${currentQuestion.field}=${message}`);

    // 檢查是否還有下一個問題
    if (state.step < state.questions.length) {
      // 還有下一個問題
      state.step++;
      const nextQuestion = state.questions[state.step - 1];
      stateManager.setExpenseState(chatId, state.msgId, state);

      try {
        if (client.ws.isOpen) {
          await client.sendMessage(chatId, { text: nextQuestion.question });
          businessLogger.info(`發送下一個問題：${nextQuestion.question}`);
        }
      } catch (err) {
        businessLogger.warn(`為用戶 ${userId} 發送問題失敗：${err.message}`);
      }
    } else {
      // 所有問題已回答，完成對話
      businessLogger.info(`費用對話完成，開始處理提交：chatId=${chatId}`);
      await this.finishExpenseChat(chatId, state, client);
    }
  }

  // 清理失敗的費用對話
  cleanupFailedExpenseChat(chatId, msgId) {
    try {
      if (msgId) {
        stateManager.deleteExpenseState(chatId, msgId);
        stateManager.markImageProcessed(msgId);
      }
      stateManager.setImageProcessingStatus(false);
      this.processImageQueue();
      businessLogger.info(`清理失敗的費用對話：chatId=${chatId}, msgId=${msgId}`);
    } catch (err) {
      businessLogger.error(`清理失敗的費用對話時發生錯誤：${err.message}`);
    }
  }

  // 發送友好的錯誤消息
  async sendFriendlyErrorMessage(client, chatId, errorType, details = '') {
    if (!client || !client.ws || !client.ws.isOpen) {
      return;
    }

    const errorMessages = {
      'connection': '🔌 連接不穩定，請稍後再試。如果問題持續，請重新掃描 QR 碼。',
      'upload': '📤 圖片上傳失敗，請檢查網絡連接後重試。',
      'sheet': '📊 寫入表格失敗，請檢查 Google Sheet 設置。',
      'general': '❌ 處理過程中出現問題，請重新發送圖片開始新的記錄。',
      'timeout': '⏰ 處理超時，請重新發送圖片。系統會自動重試。',
      'invalid_data': '⚠️ 數據格式不正確，請重新發送圖片。'
    };

    const message = errorMessages[errorType] || errorMessages['general'];
    const fullMessage = details ? `${message}\n\n詳細信息：${details}` : message;

    try {
      await client.sendMessage(chatId, { text: fullMessage });
      businessLogger.info(`已發送友好錯誤消息：${errorType}, chatId=${chatId}`);
    } catch (err) {
      businessLogger.warn(`無法發送友好錯誤消息：${err.message}`);
    }
  }

  // 發送進度更新消息
  async sendProgressUpdate(client, chatId, step, total, message) {
    if (!client || !client.ws || !client.ws.isOpen) {
      return;
    }

    const progressBar = '▓'.repeat(Math.floor((step / total) * 10)) + '░'.repeat(10 - Math.floor((step / total) * 10));
    const progressMessage = `${message}\n\n進度：${progressBar} ${step}/${total}`;

    try {
      await client.sendMessage(chatId, { text: progressMessage });
      businessLogger.info(`已發送進度更新：${step}/${total}, chatId=${chatId}`);
    } catch (err) {
      businessLogger.warn(`無法發送進度更新：${err.message}`);
    }
  }
}

// 建立單例實例
const expenseChatService = new ExpenseChatService();

module.exports = expenseChatService; 