const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const path = require('path');
const fsp = require('fs').promises;
const pino = require('pino');
const db = require('../database');
const QRCode = require('qrcode');
const { getRedisInstance } = require('./redisService');
const { businessLogger } = require('../utils/logger');

const logger = businessLogger;

// 動態獲取 Redis 實例，而不是在模組載入時獲取
function getRedis() {
  return getRedisInstance();
}

let clients = new Map();
let initializingClients = new Map();
const clientQueue = [];

// 刪除用戶的認證資料
async function deleteAuthData(userId) {
  try {
    const authPath = path.join(__dirname, '..', 'auth', `baileys_auth_${userId}`);
    await fsp.rm(authPath, { recursive: true, force: true });
    logger.info(`已刪除用戶 ${userId} 的認證資料`);
    
    try {
      await getRedis().del(`session:${userId}`);
      await getRedis().del(`qr:${userId}`);
    } catch (redisError) {
      logger.warn(`Redis 清理失敗：${redisError.message}`);
    }
  } catch (err) {
    logger.error(`刪除用戶 ${userId} 的認證資料失敗：${err.message}`);
  }
}

// 檢查認證資料是否存在
function checkAuthValidity(userId) {
  const authPath = path.join(__dirname, '..', 'auth', `baileys_auth_${userId}`);
  try {
    return require('fs').existsSync(authPath);
  } catch (err) {
    logger.error(`檢查用戶 ${userId} 的認證資料存在性失敗：${err.message}`);
    return false;
  }
}

// 清理客戶端
async function cleanupClient(userId, client) {
  try {
    // 移除事件監聽器以防止重複處理
    const clientData = clients.get(userId);
    if (clientData && clientData.messageHandler && client) {
      try {
        client.ev.off('messages.upsert', clientData.messageHandler);
        logger.info(`用戶 ${userId} 的訊息處理器已移除`);
      } catch (evError) {
        logger.warn(`移除用戶 ${userId} 的訊息處理器失敗：${evError.message}`);
      }
    }

    // 移除所有事件監聽器
    if (client && client.ev) {
      try {
        client.ev.removeAllListeners();
        logger.info(`用戶 ${userId} 的所有事件監聽器已移除`);
      } catch (evError) {
        logger.warn(`移除用戶 ${userId} 的事件監聽器失敗：${evError.message}`);
      }
    }

    // 關閉 WebSocket 連接
    if (client && client.ws) {
      try {
        client.ws.close();
        logger.info(`用戶 ${userId} 的 WebSocket 連接已關閉`);
      } catch (wsError) {
        logger.warn(`關閉用戶 ${userId} 的 WebSocket 失敗：${wsError.message}`);
      }
    }

    // 清理客戶端引用
    clients.delete(userId);
    initializingClients.delete(userId);
    
    // 更新數據庫狀態
    db.run('UPDATE users SET isAuthenticated = ? WHERE userId = ?', [false, userId], (err) => {
      if (err) {
        logger.error(`無法更新用戶 ${userId} 的認證狀態：${err.message}`);
      } else {
        logger.info(`用戶 ${userId} 的認證狀態已更新為未認證`);
        
        // 發送WebSocket通知用戶連接已斷開
        try {
          const ServiceContainer = require('../core/ServiceContainer');
          const container = ServiceContainer.getInstance();
          const websocketService = container.resolve('websocketService');
          websocketService.notifyWhatsAppDisconnected(userId);
        } catch (wsError) {
          logger.warn(`發送WebSocket通知失敗：${wsError.message}`);
        }
      }
    });
    
    try {
      await getRedis().del(`session:${userId}`);
      await getRedis().del(`qr:${userId}`);
    } catch (redisError) {
      logger.warn(`Redis 清理失敗：${redisError.message}`);
    }
    
    logger.info(`已完全清理用戶 ${userId} 的客戶端資源和事件監聽器`);
  } catch (err) {
    logger.error(`清理用戶 ${userId} 的客戶端失敗：${err.message}`);
  }
}

// 設置客戶端事件處理器
async function setupClientEventHandlers(client, userId, saveCreds) {
  const { setupMessageHandler } = require('./whatsappMessage');
  const stateManager = require('../core/StateManager');
  const eventBus = require('../core/EventBus');
  const { EventTypes, EventSource } = require('../core/EventTypes');
  
  try {
    client.ev.on('creds.update', saveCreds);
    
    // 添加全面的錯誤處理
    client.ev.on('error', async (err) => {
      logger.error(`用戶 ${userId} 的客戶端發生錯誤: ${err.message}`);
      
      // 不同類型的錯誤採用不同處理策略
      try {
        if (err.message.includes('Bad MAC') || err.message.includes('Failed to decrypt')) {
          logger.warn(`用戶 ${userId} 的加密會話出現問題，清理並準備重新認證`);
          await cleanupClient(userId, client);
          return;
        }
        
        if (err.message.includes('Connection Closed') || err.message.includes('WebSocket')) {
          logger.warn(`用戶 ${userId} 的連接已關閉，觸發清理流程`);
          await cleanupClient(userId, client);
          return;
        }
        
        // 其他錯誤記錄但不立即清理
        logger.warn(`用戶 ${userId} 的客戶端錯誤已記錄，繼續監控`);
      } catch (cleanupError) {
        logger.error(`清理用戶 ${userId} 客戶端時發生錯誤: ${cleanupError.message}`);
      }
    });

    // 使用事件系統而不是直接傳遞函數
    setupMessageHandler(client, userId, clients, stateManager, eventBus, EventTypes, EventSource);
    
    logger.info(`用戶 ${userId} 的事件處理器設置完成`);
  } catch (err) {
    logger.error(`設置用戶 ${userId} 的事件處理器失敗: ${err.message}`);
    throw err;
  }
}

// 創建 WhatsApp 客戶端
async function createClient(userId) {
  return new Promise((resolve, reject) => {
    const maxClients = 100;
    if (clients.size >= maxClients) {
      logger.warn(`達到最大客戶端數量限制 (${maxClients})，用戶 ${userId} 進入等待佇列`);
      clientQueue.push({ userId, resolve, reject });
      processClientQueue();
      return;
    }

    if (initializingClients.has(userId)) {
      logger.info(`用戶 ${userId} 正在初始化，返回現有 Promise`);
      resolve(initializingClients.get(userId));
      return;
    }

    if (clients.has(userId)) {
      const existingClient = clients.get(userId);
      if (existingClient.ready && existingClient.client.ws.isOpen) {
        logger.info(`用戶 ${userId} 已連線，返回現有客戶端`);
        resolve(existingClient);
        return;
      } else {
        logger.info(`清理用戶 ${userId} 的舊客戶端狀態`);
        try {
          if (existingClient.client) {
            existingClient.client.ev.removeAllListeners();
            if (existingClient.client.ws.isOpen) {
              existingClient.client.end();
            }
          }
          clients.delete(userId);
        } catch (err) {
          logger.error(`清理用戶 ${userId} 的舊客戶端失敗：${err.message}`);
        }
      }
    }

    logger.info(`為用戶 ${userId} 創建新客戶端`);
    const authPath = path.join(__dirname, '..', 'auth', `baileys_auth_${userId}`);

    // 檢查認證資料是否有效
    if (checkAuthValidity(userId)) {
      logger.info(`用戶 ${userId} 的認證資料存在，嘗試使用現有認證`);
    } else {
      logger.info(`用戶 ${userId} 的認證資料不存在或無效，將創建新的認證`);
      deleteAuthData(userId).catch(err => {
        logger.error(`清理舊認證資料失敗：${err.message}`);
      });
    }

    (async () => {
      try {
        const { state, saveCreds } = await useMultiFileAuthState(authPath);
        const baileyLogger = pino({ level: 'silent' });
        let client = makeWASocket({
          auth: state,
          logger: baileyLogger,
          printQRInTerminal: false,
          // 添加重試選項
          retryRequestDelayMs: 2500,
          connectTimeoutMs: 60000,
          defaultQueryTimeoutMs: 60000,
          markOnlineOnConnect: true
        });

        // 全面的 WebSocket 錯誤處理
        client.ws.on('close', async (code, reason) => {
          logger.warn(`用戶 ${userId} 的 WebSocket 連線斷開，代碼：${code}，原因：${reason || '未知'}`);
          try {
            // 檢查是否是正常關閉或用戶主動登出
            if (code === 1000 || code === 1001) {
              logger.info(`用戶 ${userId} 的 WebSocket 正常關閉，清理資源`);
            } else {
              logger.warn(`用戶 ${userId} 的 WebSocket 異常關閉，代碼：${code}`);
            }
            await cleanupClient(userId, client);
          } catch (cleanupError) {
            logger.error(`清理用戶 ${userId} WebSocket 關閉資源失敗：${cleanupError.message}`);
          }
        });

        // 添加 WebSocket 錯誤處理
        client.ws.on('error', (wsError) => {
          logger.error(`用戶 ${userId} 的 WebSocket 發生錯誤：${wsError.message}`);
          // 不立即清理，讓 close 事件處理
        });

        // 捕獲所有 Baileys 客戶端可能的錯誤
        client.ev.on('error', async (err) => {
          logger.error(`用戶 ${userId} 的 Baileys 客戶端錯誤: ${err.message}`);
          
          try {
            // 不同類型的錯誤採用不同處理策略
            if (err.message.includes('Bad MAC') || err.message.includes('Failed to decrypt')) {
              logger.warn(`用戶 ${userId} 的加密會話出現問題，清理並準備重新認證`);
              await cleanupClient(userId, client);
              return;
            }
            
            if (err.message.includes('Connection Closed') || err.message.includes('WebSocket')) {
              logger.warn(`用戶 ${userId} 的連接已關閉，觸發清理流程`);
              await cleanupClient(userId, client);
              return;
            }
            
            // 其他錯誤記錄但不立即清理
            logger.warn(`用戶 ${userId} 的客戶端錯誤已記錄，繼續監控`);
          } catch (cleanupError) {
            logger.error(`清理用戶 ${userId} 客戶端時發生錯誤: ${cleanupError.message}`);
          }
        });

        // 添加對內部 WebSocket 事件的處理
        if (client.ws && client.ws._socket) {
          client.ws._socket.on('error', (socketError) => {
            logger.warn(`用戶 ${userId} 的底層 Socket 錯誤: ${socketError.message}`);
            // 這些錯誤通常是網路層問題，不需要立即清理
          });
        }

        // 處理可能的 promise rejection
        const originalSend = client.sendMessage;
        client.sendMessage = async function(...args) {
          try {
            return await originalSend.apply(this, args);
          } catch (sendError) {
            logger.error(`用戶 ${userId} 發送訊息失敗: ${sendError.message}`);
            
            // 如果是連接相關錯誤，觸發清理
            if (sendError.message.includes('Connection Closed') || 
                sendError.message.includes('WebSocket') ||
                sendError.statusCode === 428) {
              logger.warn(`用戶 ${userId} 因發送失敗觸發清理`);
              setImmediate(async () => {
                try {
                  await cleanupClient(userId, client);
                } catch (cleanupError) {
                  logger.error(`延遲清理失敗: ${cleanupError.message}`);
                }
              });
            }
            
            throw sendError; // 重新拋出讓調用者處理
          }
        };

        const clientPromise = new Promise((innerResolve, innerReject) => {
          const timeout = setTimeout(() => {
            if (!clients.get(userId)?.ready) {
              logger.warn(`用戶 ${userId} 未在 5 分鐘內掃描 QR 碼，銷毀客戶端`);
              cleanupClient(userId, client).then(() => {
                innerReject(new Error('QR 碼掃描超時'));
              }).catch(err => {
                logger.error(`銷毀用戶 ${userId} 的客戶端失敗：${err.message}`);
                innerReject(err);
              });
            }
          }, 5 * 60 * 1000);

          client.ev.on('connection.update', async (update) => {
            try {
              const { connection, lastDisconnect, qr } = update;

              if (qr) {
                try {
                  const qrKey = `qr:${userId}`;
                  const lastQr = await getRedis().get(qrKey);
                  if (lastQr && (Date.now() - parseInt(lastQr)) < 30 * 1000) {
                    logger.warn(`用戶 ${userId} 的 QR 碼生成過快，忽略`);
                    return;
                  }
                  await getRedis().set(qrKey, Date.now(), 'EX', 30);
                } catch (redisError) {
                  // Redis 錯誤不影響 QR 碼生成
                  logger.warn(`Redis 操作失敗，繼續 QR 碼生成：${redisError.message}`);
                }

                logger.info(`收到用戶 ${userId} 的 QR 碼`);
                clients.set(userId, { client, qr, ready: false, lastActive: Date.now(), reconnectAttempts: 0 });
                innerResolve(clients.get(userId));
              }

              if (connection === 'open') {
                clearTimeout(timeout);
                logger.info(`用戶 ${userId} 的 WhatsApp 客戶端已準備就緒`);
                const existingClientData = clients.get(userId) || {};
                clients.set(userId, {
                  ...existingClientData,
                  client,
                  qr: null,
                  ready: true,
                  lastActive: Date.now(),
                  reconnectAttempts: 0
                });

                try {
                  await loadUserSettings(userId, clients.get(userId));
                  db.run('UPDATE users SET isAuthenticated = ? WHERE userId = ?', [true, userId], async (err) => {
                    if (err) {
                      logger.error(`無法更新用戶 ${userId} 的認證狀態：${err.message}`);
                    } else {
                      logger.info(`用戶 ${userId} 的認證狀態已更新為已認證`);
                      try {
                        await getRedis().set(`session:${userId}`, JSON.stringify({ ready: true }), 'EX', 24 * 60 * 60);
                      } catch (redisError) {
                        logger.warn(`Redis 會話儲存失敗：${redisError.message}`);
                      }
                      
                      // 發送WebSocket通知用戶連接已建立
                      try {
                        const ServiceContainer = require('../core/ServiceContainer');
                        const container = ServiceContainer.getInstance();
                        const websocketService = container.resolve('websocketService');
                        websocketService.notifyWhatsAppConnected(userId);
                      } catch (wsError) {
                        logger.warn(`發送WebSocket通知失敗：${wsError.message}`);
                      }
                    }
                  });
                  await setupClientEventHandlers(client, userId, saveCreds);
                  innerResolve(clients.get(userId));
                } catch (err) {
                  logger.error(`載入用戶 ${userId} 的設置失敗：${err.message}`);
                  innerReject(err);
                }
              }

              if (connection === 'close') {
                clearTimeout(timeout);
                const reason = lastDisconnect?.error?.output?.statusCode;
                const errorMessage = lastDisconnect?.error?.message || '';
                
                logger.warn(`用戶 ${userId} 的客戶端斷開連線，原因：${reason}，錯誤信息：${errorMessage}`);
                initializingClients.delete(userId);

                // 檢查是否為用戶主動登出（多種可能的狀態）
                const isLoggedOut = reason === DisconnectReason.loggedOut || 
                                  reason === 401 || 
                                  reason === 403 ||
                                  errorMessage.includes('logged out') ||
                                  errorMessage.includes('Logged Out') ||
                                  errorMessage.includes('LOGGED_OUT');

                if (isLoggedOut) {
                  logger.info(`✅ 偵測到用戶 ${userId} 已主動登出，開始清理認證資料（不重新連線）`);
                  try {
                    await deleteAuthData(userId);
                    await cleanupClient(userId, client);
                    logger.info(`✅ 用戶 ${userId} 登出清理完成，準備生成新的 QR 碼`);
                  } catch (cleanupError) {
                    logger.error(`清理用戶 ${userId} 登出資料失敗：${cleanupError.message}`);
                  }
                  innerResolve(null);
                  return;
                }

                // 其他錯誤嘗試重新連線（但有限制）
                const existingClient = clients.get(userId);
                const reconnectAttempts = existingClient?.reconnectAttempts || 0;
                const maxReconnectAttempts = 3;

                if (reconnectAttempts >= maxReconnectAttempts) {
                  logger.warn(`用戶 ${userId} 重新連線嘗試已達上限 (${maxReconnectAttempts})，放棄重連`);
                  await cleanupClient(userId, client);
                  innerResolve(null);
                  return;
                }

                logger.info(`嘗試為用戶 ${userId} 重新連線 (第 ${reconnectAttempts + 1}/${maxReconnectAttempts} 次)，原因：${reason}`);
                
                try {
                  const reconnectTimeout = new Promise((_, rej) => 
                    setTimeout(() => rej(new Error('重新連線超時')), 10 * 1000)
                  );
                  
                  const { state: newState, saveCreds: newSaveCreds } = await useMultiFileAuthState(authPath);
                  client = makeWASocket({
                    auth: newState,
                    logger: baileyLogger,
                    printQRInTerminal: false,
                    retryRequestDelayMs: 2500,
                    connectTimeoutMs: 60000,
                    defaultQueryTimeoutMs: 60000
                  });

                  // 添加錯誤處理
                  client.ws.on('close', async () => {
                    logger.warn(`用戶 ${userId} 的 WebSocket 連線斷開，觸發清理流程`);
                    await cleanupClient(userId, client);
                  });

                  client.ws.on('error', (wsError) => {
                    logger.error(`用戶 ${userId} 的 WebSocket 發生錯誤：${wsError.message}`);
                  });

                  const existingClientData = clients.get(userId) || {};
                  clients.set(userId, {
                    ...existingClientData,
                    client,
                    qr: null,
                    ready: false,
                    lastActive: Date.now(),
                    reconnectAttempts: reconnectAttempts + 1
                  });

                  const reconnectPromise = new Promise((res, rej) => {
                    const connectionTimeout = setTimeout(() => {
                      rej(new Error('連接超時'));
                    }, 30000);

                    client.ev.on('connection.update', async (reconUpdate) => {
                      if (reconUpdate.connection === 'open') {
                        clearTimeout(connectionTimeout);
                        logger.info(`✅ 用戶 ${userId} 重新連線成功`);
                        try {
                          await loadUserSettings(userId, clients.get(userId));
                          clients.set(userId, {
                            ...clients.get(userId),
                            ready: true,
                            lastActive: Date.now(),
                            reconnectAttempts: 0 // 重置重連次數
                          });
                          await setupClientEventHandlers(client, userId, newSaveCreds);
                          res();
                        } catch (err) {
                          logger.error(`重新連線後載入用戶 ${userId} 的設置失敗：${err.message}`);
                          rej(err);
                        }
                      } else if (reconUpdate.connection === 'close') {
                        clearTimeout(connectionTimeout);
                        rej(new Error('重新連線立即斷開'));
                      }
                    });
                  });

                  await Promise.race([reconnectPromise, reconnectTimeout]);
                  logger.info(`✅ 用戶 ${userId} 重新連線流程完成`);
                } catch (e) {
                  logger.error(`用戶 ${userId} 重新連線失敗：${e.message}`);
                  await cleanupClient(userId, client);
                  innerResolve(null);
                }
              }
            } catch (connectionError) {
              logger.error(`處理用戶 ${userId} 連接更新時發生錯誤：${connectionError.message}`);
              try {
                await cleanupClient(userId, client);
              } catch (cleanupError) {
                logger.error(`清理用戶 ${userId} 客戶端失敗：${cleanupError.message}`);
              }
              innerReject(connectionError);
            }
          });

          setupClientEventHandlers(client, userId, saveCreds);
        });

        initializingClients.set(userId, clientPromise);
        resolve(clientPromise);
      } catch (err) {
        logger.error(`創建用戶 ${userId} 的客戶端失敗：${err.message}`);
        // 清理失敗的初始化
        try {
          initializingClients.delete(userId);
          if (clients.has(userId)) {
            await cleanupClient(userId, clients.get(userId).client);
          }
        } catch (cleanupError) {
          logger.error(`清理失敗的客戶端初始化失敗：${cleanupError.message}`);
        }
        reject(err);
      }
    })().catch(async (asyncError) => {
      logger.error(`創建用戶 ${userId} 的客戶端異步失敗：${asyncError.message}`);
      try {
        initializingClients.delete(userId);
        if (clients.has(userId)) {
          await cleanupClient(userId, clients.get(userId).client);
        }
      } catch (cleanupError) {
        logger.error(`清理異步失敗的客戶端失敗：${cleanupError.message}`);
      }
      reject(asyncError);
    });
  });
}

// 初始化已認證用戶的連線
async function initializeAuthenticatedClients() {
  logger.info('程序啟動，為已認證用戶恢復連線');
  return new Promise((resolve, reject) => {
    db.all('SELECT userId FROM users WHERE isAuthenticated = ?', [true], async (err, rows) => {
      if (err) {
        logger.error(`無法讀取已認證用戶列表：${err.message}`);
        reject(err);
        return;
      }

      const initTasks = rows.map(row => require('p-limit')(30)(async () => {
        const userId = row.userId;
        if (!checkAuthValidity(userId)) {
          logger.warn(`用戶 ${userId} 的 WhatsApp 綁定已失效，更新認證狀態`);
          try {
            await deleteAuthData(userId);
            db.run('UPDATE users SET isAuthenticated = ? WHERE userId = ?', [false, userId], async (err) => {
              if (err) {
                logger.error(`無法更新用戶 ${userId} 的認證狀態：${err.message}`);
              } else {
                logger.info(`用戶 ${userId} 的認證狀態已更新為未認證`);
                await getRedis().del(`session:${userId}`);
              }
            });
          } catch (err) {
            logger.error(`清理用戶 ${userId} 的認證資料失敗：${err.message}`);
          }
          return;
        }

        logger.info(`為已認證用戶 ${userId} 恢復連線`);
        try {
          let cachedSession = null;
          try {
            cachedSession = await getRedis().get(`session:${userId}`);
            if (cachedSession) {
              logger.info(`從 Redis 恢復用戶 ${userId} 的會話`);
            }
          } catch (redisError) {
            logger.warn(`Redis 會話讀取失敗：${redisError.message}`);
          }
          
          const clientData = await createClient(userId);
          if (clientData && clientData.ready) {
            try {
              await getRedis().set(`session:${userId}`, JSON.stringify({ ready: true }), 'EX', 24 * 60 * 60);
            } catch (redisError) {
              logger.warn(`Redis 會話儲存失敗：${redisError.message}`);
            }
          }
        } catch (err) {
          logger.error(`為用戶 ${userId} 恢復連線失敗：${err.message}`);
        }
      }));

      await Promise.all(initTasks);
      logger.info('所有已認證用戶連線初始化完成');
      resolve();
    });
  });
}

// 載入用戶設置
// 在 loadUserSettings 函數中更新 SQL 查詢
async function loadUserSettings(userId, clientData) {
  return new Promise((resolve, reject) => {
    db.get('SELECT groupName, messageFormat, customQuestions, driveFolderId, sheetId, sheetName, enableAI, aiConfidenceThreshold FROM users WHERE userId = ?', [userId], (err, row) => {
      if (err) {
        logger.error(`無法讀取用戶 ${userId} 的設置：${err.message}`);
        return reject(err);
      }
      if (!row) {
        logger.error(`用戶 ${userId} 不存在`);
        return reject(new Error('用戶不存在'));
      }

      logger.info(`用戶 ${userId} 的設置 - 群組名稱: ${row.groupName}, 訊息格式: ${row.messageFormat}, AI 啟用: ${row.enableAI}`);
      let parsedQuestions;
      try {
        parsedQuestions = row.customQuestions ? JSON.parse(row.customQuestions) : [];
        if (!Array.isArray(parsedQuestions) || parsedQuestions.some(q => !q.question || !q.field)) {
          logger.warn(`用戶 ${userId} 的自訂問題格式無效，使用預設問題`);
          parsedQuestions = [{ question: '請輸入店鋪名稱', field: 'shop' }];
        }
      } catch (err) {
        logger.error(`解析用戶 ${userId} 的自訂問題失敗：${err.message}`);
        parsedQuestions = [{ question: '請輸入店鋪名稱', field: 'shop' }];
      }

      const updatedClientData = {
        ...clientData,
        groupName: row.groupName || '',
        messageFormat: row.messageFormat || '日期: {date}\n項目: {item}\n銀碼: ${amount}\n備註: {note}\n收據: {imageUrl}',
        customQuestions: parsedQuestions,
        driveFolderId: row.driveFolderId || '',
        sheetId: row.sheetId || '',
        sheetName: row.sheetName || '',
        enableAI: Boolean(row.enableAI), // 新增
        aiConfidenceThreshold: row.aiConfidenceThreshold || 0.8 // 新增
      };

      clients.set(userId, updatedClientData);
      logger.info(`用戶 ${userId} 的設置已成功載入`);
      resolve(updatedClientData);
    });
  });
}
// 重新載入用戶設置
async function reloadUserSettings(userId) {
  logger.info(`開始重新載入用戶 ${userId} 的 WhatsApp 客戶端設置`);
  const clientData = clients.get(userId);
  if (!clientData) {
    logger.warn(`用戶 ${userId} 無客戶端資料，無法重新載入設置`);
    throw new Error('無客戶端資料');
  }
  if (!clientData.ready || !clientData.client?.ws?.isOpen) {
    logger.warn(`用戶 ${userId} 的客戶端未就緒或連線已關閉，無法重新載入設置`);
    throw new Error('客戶端未就緒或連線已關閉');
  }
  await loadUserSettings(userId, clientData);
  logger.info(`用戶 ${userId} 的 WhatsApp 客戶端設置已重新載入`);
}

// 獲取 QR 碼
async function getQRCode(userId, session) {
  if (!userId) {
    logger.error('缺少 userId 參數');
    return { status: 400, message: '缺少 userId' };
  }

  if (!session.userId || session.userId !== userId) {
    logger.warn(`用戶 ${userId} 未登入或會話不匹配`);
    return { status: 401, message: '未登入' };
  }

  logger.info(`收到用戶 ${userId} 的 QR 碼請求`);
  return new Promise((resolve) => {
    db.get('SELECT * FROM users WHERE userId = ?', [userId], async (err, row) => {
      if (err) {
        logger.error(`資料庫查詢錯誤：${err.message}`);
        return resolve({ status: 500, message: '資料庫錯誤' });
      }
      if (!row) {
        logger.error(`用戶不存在：${userId}`);
        return resolve({ status: 404, message: '用戶不存在' });
      }

      if (row.isAuthenticated && checkAuthValidity(userId)) {
        const clientData = clients.get(userId);
        if (clientData && clientData.ready && clientData.client.ws.isOpen) {
          logger.info(`用戶 ${userId} 已認證，跳過 QR 碼掃描`);
          return resolve({ status: 200, data: { status: 'alreadyLoggedIn' } });
        } else {
          logger.warn(`用戶 ${userId} 的認證狀態無效，重置並生成新 QR 碼`);
          try {
            await deleteAuthData(userId);
            db.run('UPDATE users SET isAuthenticated = ? WHERE userId = ?', [false, userId], async (err) => {
              if (err) {
                logger.error(`無法更新用戶 ${userId} 的認證狀態：${err.message}`);
              } else {
                logger.info(`用戶 ${userId} 的認證狀態已更新為未認證`);
                await getRedis().del(`session:${userId}`);
              }
            });
          } catch (err) {
            logger.error(`無法清除用戶 ${userId} 的認證資料：${err.message}`);
            return resolve({ status: 500, message: '無法重置認證狀態，請稍後重試' });
          }
        }
      }

      logger.info(`檢查用戶 ${userId} 的客戶端狀態`);
      const maxRetries = 3;
      const retryInterval = 5000;
      let retryCount = 0;

      const tryCreateClient = async () => {
        try {
          const clientData = await createClient(userId);
          if (clientData && clientData.ready && clientData.client.ws.isOpen) {
            logger.info(`用戶 ${userId} 已登入，返回已登入狀態`);
            return resolve({ status: 200, data: { status: 'alreadyLoggedIn' } });
          }

          if (!clientData || (!clientData.qr && retryCount < maxRetries)) {
            retryCount++;
            logger.warn(`用戶 ${userId} 的 QR 碼尚未生成，重試 ${retryCount}`);
            setTimeout(tryCreateClient, retryInterval);
            return;
          }

          if (!clientData || !clientData.qr) {
            logger.error(`無法為用戶 ${userId} 生成 QR 碼，已達最大重試次數：${maxRetries}`);
            return resolve({ status: 503, message: '無法生成 QR 碼，請稍後重試或聯繫管理員' });
          }

          logger.info(`為用戶 ${userId} 生成 QR 碼圖像`);
          QRCode.toDataURL(clientData.qr, (err, url) => {
            if (err) {
              logger.error(`無法生成 QR 碼：${err.message}`);
              return resolve({ status: 500, message: '無法生成 QR 碼，請重試' });
            }
            logger.info(`為用戶 ${userId} 成功生成 QR 碼圖像`);
            resolve({ status: 200, data: { qrCodeUrl: url } });
          });
        } catch (err) {
          logger.error(`無法為用戶 ${userId} 創建客戶端：${err.message}`);
          return resolve({ status: 503, message: '無法創建客戶端，請稍後重試或聯繫管理員' });
        }
      };

      tryCreateClient();
    });
  });
}

// 獲取登入狀態
async function getLoginStatus(userId, session) {
  if (!userId) {
    logger.error('缺少 userId 參數');
    return { status: 400, message: '缺少 userId' };
  }

  if (!session.userId || session.userId !== userId) {
    logger.warn(`用戶 ${userId} 未登入或會話不匹配`);
    return { status: 200, data: { loggedIn: false } };
  }

  if (initializingClients.has(userId)) {
    logger.info(`用戶 ${userId} 正在初始化，等待客戶端準備就緒`);
    try {
      const clientData = await Promise.race([
        initializingClients.get(userId),
        new Promise((_, reject) => setTimeout(() => reject(new Error('初始化超時')), 10 * 1000))
      ]);
      logger.info(`用戶 ${userId} 初始化完成，客戶端準備狀態：${clientData?.ready || false}`);
      return { status: 200, data: { loggedIn: clientData?.ready && clientData?.client.ws.isOpen } };
    } catch (err) {
      logger.error(`無法等待用戶 ${userId} 初始化：${err.message}`);
      return { status: 200, data: { loggedIn: false } };
    }
  }

  const clientData = clients.get(userId);
  if (!clientData) {
    logger.info(`用戶 ${userId} 無客戶端，檢查資料庫`);
    return new Promise((resolve) => {
      db.get('SELECT isAuthenticated FROM users WHERE userId = ?', [userId], (err, row) => {
        if (err) {
          logger.error(`資料庫查詢錯誤：${err.message}`);
          return resolve({ status: 200, data: { loggedIn: false } });
        }
        const loggedIn = row && row.isAuthenticated;
        logger.info(`用戶 ${userId} 的資料庫狀態：${loggedIn}`);
        resolve({ status: 200, data: { loggedIn } });
      });
    });
  }

  logger.info(`用戶 ${userId} 的客戶端狀態：${clientData.ready}`);
  return { status: 200, data: { loggedIn: clientData.ready && clientData.client.ws.isOpen } };
}

// 清理過期的 QR 碼
async function cleanupQRCode() {
  const now = Date.now();
  const qrTimeout = 30 * 1000;
  for (const [userId, clientData] of clients.entries()) {
    if (!clientData.ready && clientData.qr && (now - clientData.lastActive > qrTimeout)) {
      logger.info(`清除用戶 ${userId} 的不活躍 QR 碼`);
      try {
        if (clientData.client) {
          clientData.client.ev.removeAllListeners();
          if (clientData.client.ws.isOpen) {
            clientData.client.end();
          }
        }
        clients.delete(userId);
        initializingClients.delete(userId);
        await deleteAuthData(userId);
        db.run('UPDATE users SET isAuthenticated = ? WHERE userId = ?', [false, userId], async (err) => {
          if (err) {
            logger.error(`無法更新用戶 ${userId} 的認證狀態：${err.message}`);
          } else {
            logger.info(`用戶 ${userId} 的認證狀態已更新為未認證（因 QR 碼超時）`);
            await getRedis().del(`session:${userId}`);
            await getRedis().del(`qr:${userId}`);
          }
        });
      } catch (err) {
        logger.error(`清除用戶 ${userId} 的不活躍 QR 碼失敗：${err.message}`);
      }
    }
  }
  setTimeout(cleanupQRCode, 30 * 1000);
}

// 處理客戶端佇列
function processClientQueue() {
  if (clientQueue.length === 0 || clients.size >= 100) {
    return;
  }
  const { userId, resolve, reject } = clientQueue.shift();
  createClient(userId).then(resolve).catch(reject);
}

// 定期檢查客戶端健康狀態並自動恢復
function startHealthCheck() {
  const healthCheckInterval = 60 * 1000; // 每分鐘檢查一次
  
  setInterval(async () => {
    try {
      const now = Date.now();
      const inactiveTimeout = 10 * 60 * 1000; // 10分鐘不活躍視為需要檢查
      
      for (const [userId, clientData] of clients.entries()) {
        try {
          // 檢查客戶端是否長時間不活躍
          if (now - clientData.lastActive > inactiveTimeout) {
            logger.info(`檢查用戶 ${userId} 的客戶端健康狀態（不活躍 ${Math.round((now - clientData.lastActive) / 1000 / 60)} 分鐘）`);
            
            // 檢查 WebSocket 連接狀態
            if (!clientData.client?.ws?.isOpen) {
              logger.warn(`用戶 ${userId} 的 WebSocket 連接已關閉，觸發清理`);
              await cleanupClient(userId, clientData.client);
              continue;
            }
            
            // 更新最後活躍時間（避免重複檢查）
            clientData.lastActive = now;
          }
          
          // 檢查認證資料是否仍然有效
          if (clientData.ready && !checkAuthValidity(userId)) {
            logger.warn(`用戶 ${userId} 的認證資料已失效，清理客戶端`);
            await cleanupClient(userId, clientData.client);
          }
        } catch (clientError) {
          logger.error(`檢查用戶 ${userId} 客戶端健康狀態失敗：${clientError.message}`);
        }
      }
      
      // 清理初始化超時的客戶端
      for (const [userId, promise] of initializingClients.entries()) {
        try {
          const clientData = clients.get(userId);
          if (clientData && now - clientData.lastActive > 5 * 60 * 1000) { // 5分鐘初始化超時
            logger.warn(`用戶 ${userId} 初始化超時，清理資源`);
            initializingClients.delete(userId);
            if (clientData.client) {
              await cleanupClient(userId, clientData.client);
            }
          }
        } catch (initError) {
          logger.error(`清理用戶 ${userId} 初始化超時資源失敗：${initError.message}`);
        }
      }
      
      logger.debug(`健康檢查完成，活躍客戶端數量：${clients.size}，初始化中：${initializingClients.size}`);
    } catch (healthError) {
      logger.error(`健康檢查過程中發生錯誤：${healthError.message}`);
    }
  }, healthCheckInterval);
  
  logger.info('WhatsApp 客戶端健康檢查已啟動');
}

// 添加優雅關閉函數
async function gracefulShutdown() {
  logger.info('開始 WhatsApp 服務優雅關閉...');
  
  try {
    // 關閉所有客戶端
    const shutdownPromises = [];
    for (const [userId, clientData] of clients.entries()) {
      shutdownPromises.push(
        cleanupClient(userId, clientData.client).catch(err => {
          logger.error(`關閉用戶 ${userId} 客戶端失敗：${err.message}`);
        })
      );
    }
    
    await Promise.all(shutdownPromises);
    clients.clear();
    initializingClients.clear();
    
    logger.info('WhatsApp 服務優雅關閉完成');
  } catch (shutdownError) {
    logger.error(`WhatsApp 服務關閉過程中發生錯誤：${shutdownError.message}`);
  }
}

module.exports = {
  createClient,
  initializeAuthenticatedClients,
  cleanupClient,
  deleteAuthData,
  checkAuthValidity,
  getClients: () => clients,
  getInitializingClients: () => initializingClients,
  reloadUserSettings,
  getQRCode,
  getLoginStatus,
  cleanupQRCode,
  clientQueue,
  processClientQueue,
  startHealthCheck,
  gracefulShutdown
};