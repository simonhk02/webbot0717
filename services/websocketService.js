const WebSocket = require('ws');
const { businessLogger } = require('../utils/logger');

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // userId -> Set of WebSocket connections
    this.logger = businessLogger;
  }

  /**
   * 初始化WebSocket服務器
   */
  initialize(server) {
    try {
      this.wss = new WebSocket.Server({ server });
      
      this.wss.on('connection', (ws, req) => {
        this.handleConnection(ws, req);
      });

      this.logger.info('WebSocket 服務已初始化');
    } catch (error) {
      this.logger.error('WebSocket 服務初始化失敗:', error);
      throw error;
    }
  }

  /**
   * 處理新的WebSocket連接
   */
  handleConnection(ws, req) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const userId = url.searchParams.get('userId');
    
    if (!userId) {
      this.logger.warn('WebSocket 連接缺少 userId，關閉連接');
      ws.close(4000, 'Missing userId');
      return;
    }

    // 將客戶端添加到用戶的連接集合中
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId).add(ws);

    this.logger.info(`用戶 ${userId} 建立 WebSocket 連接`);

    // 處理連接關閉
    ws.on('close', () => {
      this.removeClient(userId, ws);
      this.logger.info(`用戶 ${userId} 的 WebSocket 連接已關閉`);
    });

    // 處理錯誤
    ws.on('error', (error) => {
      this.logger.error(`用戶 ${userId} 的 WebSocket 連接錯誤:`, error);
      this.removeClient(userId, ws);
    });

    // 發送連接確認
    this.sendToClient(ws, {
      type: 'connection',
      status: 'connected',
      userId: userId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 移除客戶端連接
   */
  removeClient(userId, ws) {
    if (this.clients.has(userId)) {
      this.clients.get(userId).delete(ws);
      
      // 如果該用戶沒有其他連接，移除整個用戶記錄
      if (this.clients.get(userId).size === 0) {
        this.clients.delete(userId);
      }
    }
  }

  /**
   * 向特定客戶端發送消息
   */
  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        this.logger.error('發送 WebSocket 消息失敗:', error);
        return false;
      }
    }
    return false;
  }

  /**
   * 向特定用戶的所有連接發送消息
   */
  sendToUser(userId, message) {
    const userConnections = this.clients.get(userId);
    if (!userConnections || userConnections.size === 0) {
      this.logger.debug(`用戶 ${userId} 沒有活躍的 WebSocket 連接`);
      return false;
    }

    let sentCount = 0;
    const deadConnections = [];

    userConnections.forEach(ws => {
      if (this.sendToClient(ws, message)) {
        sentCount++;
      } else {
        deadConnections.push(ws);
      }
    });

    // 清理死連接
    deadConnections.forEach(ws => {
      this.removeClient(userId, ws);
    });

    this.logger.info(`向用戶 ${userId} 發送消息到 ${sentCount} 個連接`);
    return sentCount > 0;
  }

  /**
   * 通知用戶WhatsApp已斷開連接
   */
  notifyWhatsAppDisconnected(userId) {
    const message = {
      type: 'whatsapp_disconnected',
      userId: userId,
      timestamp: new Date().toISOString(),
      action: 'show_qr_code'
    };

    this.sendToUser(userId, message);
    this.logger.info(`已通知用戶 ${userId} WhatsApp 連接已斷開`);
  }

  /**
   * 通知用戶WhatsApp已連接
   */
  notifyWhatsAppConnected(userId) {
    const message = {
      type: 'whatsapp_connected',
      userId: userId,
      timestamp: new Date().toISOString(),
      action: 'hide_qr_code'
    };

    this.sendToUser(userId, message);
    this.logger.info(`已通知用戶 ${userId} WhatsApp 已連接`);
  }

  /**
   * 通知用戶新的QR碼已生成
   */
  notifyQRCodeGenerated(userId, qrCodeUrl) {
    const message = {
      type: 'qr_code_generated',
      userId: userId,
      qrCodeUrl: qrCodeUrl,
      timestamp: new Date().toISOString()
    };

    this.sendToUser(userId, message);
    this.logger.info(`已通知用戶 ${userId} 新的 QR 碼已生成`);
  }

  /**
   * 獲取連接統計
   */
  getConnectionStats() {
    const stats = {
      totalUsers: this.clients.size,
      totalConnections: 0,
      users: {}
    };

    this.clients.forEach((connections, userId) => {
      stats.totalConnections += connections.size;
      stats.users[userId] = connections.size;
    });

    return stats;
  }

  /**
   * 獲取服務狀態
   */
  getStatus() {
    return {
      isRunning: this.wss !== null,
      isInitialized: this.wss !== null,
      totalUsers: this.clients.size,
      totalConnections: this.getConnectionStats().totalConnections,
      uptime: process.uptime(),
      timestamp: Date.now()
    };
  }

  /**
   * 關閉WebSocket服務
   */
  async shutdown() {
    if (this.wss) {
      this.logger.info('正在關閉 WebSocket 服務...');
      
      // 通知所有客戶端服務即將關閉
      this.clients.forEach((connections, userId) => {
        connections.forEach(ws => {
          this.sendToClient(ws, {
            type: 'server_shutdown',
            message: '服務器即將關閉',
            timestamp: new Date().toISOString()
          });
        });
      });

      // 關閉所有連接
      this.wss.close();
      this.clients.clear();
      
      this.logger.info('WebSocket 服務已關閉');
    }
  }
}

module.exports = WebSocketService; 