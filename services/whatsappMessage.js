const { businessLogger: logger } = require('../utils/logger');
const { EventTypes, EventSource } = require('../core/EventTypes');
const userExperienceService = require('./userExperienceService');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

function setupMessageHandler(client, userId, clients, stateManager, eventBus, EventTypes, EventSource) {
  const { formatDate } = require('../utils/dateUtils');

  const warningMessageTimestamps = new Map();

  // 檢查是否已經註冊過訊息處理器
  const clientData = clients.get(userId);
  if (clientData && clientData.messageHandler) {
    logger.warn(`用戶 ${userId} 的訊息處理器已存在，先移除舊的處理器`);
    try {
      client.ev.off('messages.upsert', clientData.messageHandler);
      logger.info(`用戶 ${userId} 的舊訊息處理器已移除`);
    } catch (err) {
      logger.error(`移除用戶 ${userId} 的舊訊息處理器失敗：${err.message}`);
    }
  }

  const messageHandler = async ({ messages }) => {
    try {
      if (!clients) {
        logger.error(`客戶端 Map 未初始化，無法處理用戶 ${userId} 的訊息`);
        return;
      }

      const clientData = clients.get(userId);
      if (!clientData || clientData.isCleaning) {
        logger.warn(`用戶 ${userId} 的客戶端已清理或不存在，忽略訊息`);
        return;
      }

      if (!clientData.ready || !clientData.client?.ws?.isOpen) {
        logger.warn(`用戶 ${userId} 的客戶端無效或連線已關閉，忽略訊息`);
        return;
      }

      const msg = messages[0];
      const chatId = msg.key.remoteJid;
      
      // 強化的重複檢查邏輯
      if (!msg.message) {
        logger.debug(`訊息 ${msg.key.id} 沒有內容，忽略`);
        return;
      }

      // 檢查是否已處理或正在處理中
      if (stateManager.isMessageProcessed(msg.key.id) || 
          stateManager.isMessageSuppressed(msg.key.id) ||
          stateManager.isMessageProcessing(msg.key.id)) {
        logger.debug(`訊息 ${msg.key.id} 已處理/忽略/處理中，跳過重複處理`);
        return;
      }

      // 標記為處理中，防止重複處理
      stateManager.markMessageProcessing(msg.key.id);

      try {
        await client.readMessages([msg.key]);
        logger.info(`用戶 ${userId} 標記訊息為已讀，msgId=${msg.key.id}`);
        await client.sendPresenceUpdate('available', chatId);
        logger.info(`用戶 ${userId} 收到訊息，設置 presence 為 available，chatId=${chatId}，msgId=${msg.key.id}`);
        await client.sendPresenceUpdate('composing', chatId);
        logger.info(`用戶 ${userId} 設置 presence 為 composing，chatId=${chatId}，msgId=${msg.key.id}`);
      } catch (err) {
        logger.error(`用戶 ${userId} 標記訊息為已讀或設置 presence 失敗，msgId=${msg.key.id}：${err.message}`);
      }

      logger.info(`收到用戶 ${userId} 的訊息，類型：${msg.message?.conversation ? '文字' : '媒體'}，ID：${msg.key.id}`);

      clientData.lastActive = Date.now();
      clients.set(userId, clientData);

      const groupName = clientData.groupName;
      if (!groupName) {
        logger.warn(`用戶 ${userId} 未設置群組名稱，msgId=${msg.key.id}`);
        // 直接靜默結束，不發送任何訊息
        stateManager.completeMessageProcessing(msg.key.id);
        return;
      }

      let chat;
      try {
        if (!clientData.client.ws.isOpen) {
          logger.warn(`用戶 ${userId} 的客戶端連線已關閉，忽略群組 ${chatId} 檢查，msgId=${msg.key.id}`);
          stateManager.completeMessageProcessing(msg.key.id);
          return;
        }
        chat = await client.groupMetadata(chatId);
      } catch (err) {
        logger.error(`無法獲取群組元數據，msgId=${msg.key.id}：${err.message}`);
        stateManager.completeMessageProcessing(msg.key.id);
        return;
      }
      logger.info(`檢查群組：isGroup=${chatId.endsWith('@g.us')}，群組名稱：${chat.subject}，預期群組名稱：${groupName}，msgId=${msg.key.id}`);
      if (!chatId.endsWith('@g.us') || chat.subject.toLowerCase() !== groupName.toLowerCase()) {
        logger.info(`非目標群組 ${chat.subject}，預期：${groupName}，msgId=${msg.key.id}`);
        
        // 發送友好的群組錯誤提示
        if (clientData.ready && clientData.client.ws.isOpen) {
          try {
            await client.sendMessage(chatId, { 
              text: `🏷️ 請在正確的群組 "${groupName}" 中使用此功能。\n\n當前群組：${chat.subject}` 
            });
          } catch (err) {
            logger.error(`無法發送群組錯誤提示：${err.message}`);
          }
        }
        
        setTimeout(async () => {
          try {
            await client.sendPresenceUpdate('unavailable', chatId);
            logger.info(`用戶 ${userId} 非目標群組檢查後，恢復 presence 為 unavailable，chatId=${chatId}，msgId=${msg.key.id}`);
          } catch (err) {
            logger.error(`用戶 ${userId} 恢復 presence 為 unavailable 失敗，msgId=${msg.key.id}：${err.message}`);
          }
        }, 5000);
        stateManager.completeMessageProcessing(msg.key.id);
        return;
      }

      logger.info(`處理用戶 ${userId} 的訊息，使用設置，msgId=${msg.key.id}`, {
        groupName: clientData.groupName,
        customQuestions: clientData.customQuestions
      });

      // 檢查用戶是否發送了幫助指令
      if (msg.message?.conversation) {
        const text = msg.message.conversation.toLowerCase().trim();
        const command = userExperienceService.isCommand(text);
        
        if (command) {
          const handled = await userExperienceService.handleCommand(clientData.client, chatId, command);
          if (handled) {
            logger.info(`已處理用戶指令：${command}, userId=${userId}`);
            setTimeout(async () => {
              try {
                await client.sendPresenceUpdate('unavailable', chatId);
                logger.info(`用戶 ${userId} 指令處理後，恢復 presence 為 unavailable，chatId=${chatId}，msgId=${msg.key.id}`);
              } catch (err) {
                logger.error(`用戶 ${userId} 恢復 presence 為 unavailable 失敗，msgId=${msg.key.id}：${err.message}`);
              }
            }, 5000);
            stateManager.completeMessageProcessing(msg.key.id);
            return;
          }
        }
      }

      let targetState = null;
      let latestTimestamp = 0;
      for (const [stateKey, state] of stateManager.expenseState.entries()) {
        if (state.userId === userId) {
          const stateTimestamp = state.lastActive || 0;
          if (stateTimestamp > latestTimestamp) {
            latestTimestamp = stateTimestamp;
            targetState = state;
          }
        }
      }

      if (msg.message?.imageMessage) {
        try {
          if (!clientData.client.ws?.isOpen) {
            logger.warn(`用戶 ${userId} 的客戶端連線已關閉，忽略圖片 ${msg.key.id}`);
            return;
          }
          logger.info(`檢測到圖片訊息，msgId=${msg.key.id}`);
          await client.sendPresenceUpdate('composing', chatId); // 顯示正在輸入
          const mediaData = await downloadMediaMessage(msg, 'buffer', {});
          const media = {
            data: mediaData.toString('base64'),
            mimetype: msg.message.imageMessage.mimetype
          };

          logger.info(`確認資料為圖片，mimeType：${media.mimetype}，msgId=${msg.key.id}`);
          let defaultDate = formatDate(new Date());
          logger.info(`預設日期：${defaultDate}，msgId=${msg.key.id}`);

          if (!stateManager.isImageProcessing(msg.key.id)) {
            logger.info(`圖片訊息 ${msg.key.id} 不在佇列或處理中，加入佇列`);
            stateManager.addImageToQueue({
              chatId,
              media,
              defaultDate,
              client,
              driveFolderId: clientData.driveFolderId,
              msgId: msg.key.id,
              userId
            });
            if (!targetState) {
              eventBus.emit(EventTypes.IMAGE.QUEUED, {
                msgId: msg.key.id,
                userId,
                chatId
              }, { source: EventSource.WHATSAPP_MESSAGE });
            }
          } else {
            logger.warn(`圖片 ${msg.key.id} 已在佇列或處理中，忽略重複`);
          }
          await client.sendPresenceUpdate('paused', chatId);
          logger.info(`用戶 ${userId} 處理圖片後，設置 presence 為 paused，msgId=${msg.key.id}`);
          setTimeout(async () => {
            try {
              await client.sendPresenceUpdate('unavailable', chatId);
              logger.info(`用戶 ${userId} 恢復 presence 為 unavailable，chatId=${chatId}，msgId=${msg.key.id}`);
            } catch (err) {
              logger.error(`用戶 ${userId} 恢復 presence 為 unavailable 失敗，msgId=${msg.key.id}：${err.message}`);
            }
          }, 5000);
        } catch (err) {
          logger.error(`圖片下載失敗，msgId=${msg.key.id}：${err.message}`);
          if (clientData.ready && clientData.client.ws.isOpen) {
            try {
              await client.sendMessage(chatId, { text: `❌ 圖片下載失敗：${err.message}` });
              await client.sendPresenceUpdate('paused', chatId);
              logger.info(`用戶 ${userId} 發送圖片下載失敗訊息後，設置 presence 為 paused，msgId=${msg.key.id}`);
              setTimeout(async () => {
                try {
                  await client.sendPresenceUpdate('unavailable', chatId);
                  logger.info(`用戶 ${userId} 恢復 presence 為 unavailable，chatId=${chatId}，msgId=${msg.key.id}`);
                } catch (err) {
                  logger.error(`用戶 ${userId} 恢復 presence 為 unavailable 失敗，msgId=${msg.key.id}：${err.message}`);
                }
              }, 5000);
            } catch (sendErr) {
              logger.warn(`無法發送圖片下載失敗訊息，msgId=${msg.key.id}：${sendErr.message}`);
            }
          }
        }
        return;
      }

      // 檢查是否存在AI確認狀態
      if (msg.message.conversation) {
        const aiConfirmationState = stateManager.getAIConfirmationState(chatId, msg.key.id);
        
        // 如果沒有找到與當前msgId匹配的AI確認狀態，檢查該聊天是否有其他AI確認狀態
        let activeAIState = aiConfirmationState;
        if (!activeAIState) {
          // 尋找該聊天的任何AI確認狀態
          const allAIStates = stateManager.getAIConfirmationStatesByUserId(userId);
          for (const { key, state } of allAIStates) {
            if (state.chatId === chatId) {
              activeAIState = state;
              break;
            }
          }
        }

        if (activeAIState) {
          logger.info(`檢測到AI確認狀態，處理用戶回覆：${msg.message.conversation}，msgId=${msg.key.id}`);
          
          const userMessage = msg.message.conversation.trim();
          const expenseChatService = require('./ExpenseChatService');

          try {
            if (userMessage === '確認' || userMessage.toLowerCase() === 'confirm') {
              // 用戶確認AI結果，直接上傳
              logger.info(`用戶確認AI結果，開始上傳：chatId=${chatId}`);
              await expenseChatService.handleAIConfirmation(
                chatId, 
                activeAIState.msgId, 
                activeAIState.parsedData, 
                client
              );
              
            } else if (userMessage === '取消' || userMessage.toLowerCase() === 'cancel') {
              // 用戶取消AI結果
              logger.info(`用戶取消AI結果：chatId=${chatId}`);
              stateManager.deleteAIConfirmationState(chatId, activeAIState.msgId);
              stateManager.markImageProcessed(activeAIState.msgId);
              
              if (clientData.ready && clientData.client.ws.isOpen) {
                await client.sendMessage(chatId, { 
                  text: '❌ 已取消本次記錄。您可以重新發送圖片開始新的記錄。' 
                });
              }
              
            } else {
              // 用戶修改AI結果 - 使用階段二的解析邏輯
              logger.info(`用戶提供修改內容，開始解析：chatId=${chatId}`);
              
              try {
                // 使用新的AI確認服務解析修改內容
                const AIConfirmationService = require('./AIConfirmationService');
                const aiConfirmationService = new AIConfirmationService();
                
                // 解析用戶修改的內容
                const modifiedData = aiConfirmationService.parseUserModifications(
                  userMessage,
                  activeAIState.parsedData,
                  activeAIState.customQuestions || []
                );
                
                // 檢測是否有實際修改
                const hasChanges = JSON.stringify(modifiedData) !== JSON.stringify(activeAIState.parsedData);
                
                if (hasChanges) {
                  // 發送修改確認訊息
                  const confirmationMessage = aiConfirmationService.formatConfirmationMessage(
                    activeAIState.parsedData,
                    modifiedData,
                    activeAIState.customQuestions
                  );
                  
                  if (clientData.ready && clientData.client.ws.isOpen) {
                    await client.sendMessage(chatId, { text: confirmationMessage });
                  }
                  
                  // 更新AI確認狀態中的資料
                  stateManager.setAIConfirmationState(chatId, activeAIState.msgId, {
                    ...activeAIState,
                    parsedData: modifiedData,
                    originalData: activeAIState.originalData || activeAIState.parsedData,
                    isModified: true
                  });
                  
                  logger.info(`用戶修改已解析並更新狀態：chatId=${chatId}`);
                  
                } else {
                  // 沒有檢測到修改，直接確認
                  logger.info(`未檢測到修改，直接使用原始資料：chatId=${chatId}`);
                  await expenseChatService.handleAIConfirmation(
                    chatId, 
                    activeAIState.msgId, 
                    activeAIState.parsedData, 
                    client
                  );
                }
                
              } catch (parseError) {
                logger.error(`解析用戶修改失敗：${parseError.message}`);
                
                // 解析失敗，詢問用戶是否使用原始資料
                if (clientData.ready && clientData.client.ws.isOpen) {
                  await client.sendMessage(chatId, { 
                    text: '⚠️ 無法解析您的修改內容，請檢查格式是否正確。\n\n' +
                          '正確格式示例：\n' +
                          '• 店舖名稱: 星巴克\n' +
                          '• 日期: 2025-06-30\n' +
                          '• 銀碼: 85.50\n\n' +
                          '您也可以：\n' +
                          '✅ 回覆「確認」使用原始AI結果\n' +
                          '✏️ 重新輸入修改內容\n' +
                          '❌ 回覆「取消」放棄記錄'
                  });
                }
              }
            }

            await client.sendPresenceUpdate('paused', chatId);
            setTimeout(async () => {
              try {
                await client.sendPresenceUpdate('unavailable', chatId);
              } catch (err) {
                logger.error(`恢復 presence 失敗：${err.message}`);
              }
            }, 5000);

            stateManager.completeMessageProcessing(msg.key.id);
            return;

          } catch (err) {
            logger.error(`處理AI確認失敗：${err.message}`);
            
            // 發送錯誤消息給用戶
            if (clientData.ready && clientData.client.ws.isOpen) {
              try {
                await client.sendMessage(chatId, { 
                  text: `❌ 處理確認時出錯：${err.message}\n\n請重新發送圖片開始新的記錄。` 
                });
              } catch (sendErr) {
                logger.warn(`無法發送AI確認錯誤消息：${sendErr.message}`);
              }
            }
            
            // 清理狀態
            stateManager.deleteAIConfirmationState(chatId, activeAIState.msgId);
            stateManager.markImageProcessed(activeAIState.msgId);
            stateManager.completeMessageProcessing(msg.key.id);
            return;
          }
        }
      }

      if (targetState && msg.message.conversation) {
        const stateKey = `${chatId}:${targetState.msgId}`;
        targetState.lastActive = Date.now();

        if (targetState.lastMessageId === msg.key.id) {
          logger.warn(`訊息已用於回應，忽略重複：chatId=${chatId}，ID=${msg.key.id}`);
          setTimeout(async () => {
            try {
              await client.sendPresenceUpdate('unavailable', chatId);
              logger.info(`用戶 ${userId} 忽略重複訊息後，恢復 presence 為 unavailable，chatId=${chatId}，msgId=${msg.key.id}`);
            } catch (err) {
              logger.error(`用戶 ${userId} 恢復 presence 為 unavailable 失敗，msgId=${msg.key.id}：${err.message}`);
            }
          }, 5000);
          stateManager.completeMessageProcessing(msg.key.id);
          return;
        }
        targetState.lastMessageId = msg.key.id;

        if (targetState.step > targetState.questions.length) {
          logger.error(`狀態錯誤：當前步驟 (${targetState.step}) 超過問題數量 (${targetState.questions.length})，重複流程，msgId=${msg.key.id}`);
          stateManager.deleteExpenseState(chatId, targetState.msgId);
          if (clientData.ready && clientData.client.ws.isOpen) {
            try {
              await client.sendMessage(chatId, { text: '⚠️ 流程錯誤：已重置。請發送新圖片以開始新流程。' });
              await client.sendPresenceUpdate('paused', chatId);
              logger.info(`用戶 ${userId} 發送流程錯誤訊息後，設置 presence 為 paused，msgId=${msg.key.id}`);
              setTimeout(async () => {
                try {
                  await client.sendPresenceUpdate('unavailable', chatId);
                  logger.info(`用戶 ${userId} 恢復 presence 為 unavailable，chatId=${chatId}，msgId=${msg.key.id}`);
                } catch (err) {
                  logger.error(`用戶 ${userId} 恢復 presence 為 unavailable 失敗，msgId=${msg.key.id}：${err.message}`);
                }
              }, 5000);
            } catch (err) {
              logger.warn(`無法發送流程錯誤重置訊息，msgId=${msg.key.id}：${err.message}`);
            }
          }
          // 使用事件系統觸發圖片佇列處理
          eventBus.emit(EventTypes.IMAGE.QUEUED, {
            msgId: msg.key.id,
            userId,
            chatId
          }, { source: EventSource.WHATSAPP_MESSAGE });
          stateManager.completeMessageProcessing(msg.key.id);
          return;
        }

        const currentQuestion = targetState.questions[targetState.step - 1];
        targetState.answers[currentQuestion.field] = msg.message.conversation;
        stateManager.setExpenseState(chatId, targetState.msgId, targetState);
        logger.info(`用戶回應 - ${currentQuestion.field}：${msg.message.conversation}，msgId=${msg.key.id}`);
        logger.info(`當前答案狀態：${JSON.stringify(targetState.answers, (key, value) => key === 'media' ? '[隱藏]' : value)}，msgId=${msg.key.id}`);

        if (targetState.step < targetState.questions.length) {
          targetState.step += 1;
          stateManager.setExpenseState(chatId, targetState.msgId, targetState);
          const nextQuestion = targetState.questions[targetState.step - 1];
          logger.info(`下一個問題：${nextQuestion.question}，步驟=${targetState.step}/${targetState.questions.length}，msgId=${msg.key.id}`);
          if (clientData.ready && clientData.client.ws.isOpen) {
            try {
              await client.sendMessage(chatId, { text: nextQuestion.question });
              await client.sendPresenceUpdate('paused', chatId);
              logger.info(`用戶 ${userId} 發送下一個問題後，設置 presence 為 paused，msgId=${msg.key.id}`);
              setTimeout(async () => {
                try {
                  await client.sendPresenceUpdate('unavailable', chatId);
                  logger.info(`用戶 ${userId} 恢復 presence 為 unavailable，chatId=${chatId}，msgId=${msg.key.id}`);
                } catch (err) {
                  logger.error(`用戶 ${userId} 恢復 presence 為 unavailable 失敗，msgId=${msg.key.id}：${err.message}`);
                }
              }, 5000);
            } catch (sendErr) {
              logger.warn(`無法發送下一個問題，msgId=${msg.key.id}：${sendErr.message}`);
            }
          }
        } else {
          logger.info(`所有問題已回答，結束流程，msgId=${msg.key.id}`);
          // 使用事件系統觸發費用對話完成
          await eventBus.emit(EventTypes.EXPENSE_CHAT.FINISHED, {
            chatId,
            state: targetState,
            client
          }, { source: EventSource.EXPENSE_CHAT });
          await client.sendPresenceUpdate('paused', chatId);
          logger.info(`用戶 ${userId} 結束對話流程後，設置 presence 為 paused，msgId=${msg.key.id}`);
          setTimeout(async () => {
            try {
              await client.sendPresenceUpdate('unavailable', chatId);
              logger.info(`用戶 ${userId} 恢復 presence 為 unavailable，chatId=${chatId}，msgId=${msg.key.id}`);
            } catch (err) {
              logger.error(`用戶 ${userId} 恢復 presence 為 unavailable 失敗，msgId=${msg.key.id}：${err.message}`);
            }
          }, 5000);
        }
        stateManager.completeMessageProcessing(msg.key.id);
        return;
      }

      logger.info(`收到無對應流程的文字訊息，忽略：${msg.message?.conversation || '無內容'}，msgId=${msg.key.id}`);
      setTimeout(async () => {
        try {
          await client.sendPresenceUpdate('unavailable', chatId);
          logger.info(`用戶 ${userId} 無對應流程後，恢復 presence 為 unavailable，chatId=${chatId}，msgId=${msg.key.id}`);
        } catch (err) {
          logger.error(`用戶 ${userId} 恢復 presence 為 unavailable 失敗，msgId=${msg.key.id}：${err.message}`);
        }
      }, 5000);
      stateManager.completeMessageProcessing(msg.key.id);
    } catch (err) {
      logger.warn(`無法處理用戶 ${userId} 的訊息，msgId=${msg.key?.id || '未知'}：${err.message}`);
      setTimeout(async () => {
        try {
          await client.sendPresenceUpdate('unavailable', chatId);
          logger.info(`用戶 ${userId} 異常處理後，恢復 presence 為 unavailable，chatId=${chatId}，msgId=${msg.key?.id || '未知'}`);
        } catch (err) {
          logger.error(`用戶 ${userId} 恢復 presence 為 unavailable 失敗，msgId=${msg.key?.id || '未知'}：${err.message}`);
        }
      }, 5000);
      stateManager.completeMessageProcessing(msg.key.id);
    }
  };

  // 註冊新的訊息處理器
  client.ev.on('messages.upsert', messageHandler);
  
  // 儲存處理器引用以便後續清理
  const updatedClientData = clients.get(userId) || {};
  updatedClientData.messageHandler = messageHandler;
  clients.set(userId, updatedClientData);
  
  logger.info(`用戶 ${userId} 的新訊息處理器已註冊`);
}

module.exports = {
  setupMessageHandler
};