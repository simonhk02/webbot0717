/**
 * WhatsApp 路由
 */

const express = require('express');
const { businessLogger } = require('../utils/logger');

module.exports = (container) => {
  const router = express.Router();
  const whatsappService = container.resolve('whatsAppService');
  const logger = businessLogger;

  // 獲取 QR 碼
  router.get('/qr', async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({ error: '缺少 userId 參數' });
      }
      
      const result = await whatsappService.getQRCode(userId, req.session);
      
      if (result.status === 200) {
        res.json(result.data);
        logger.info(`獲取 QR 碼成功: ${userId}`);
      } else {
        res.status(result.status).json({ error: result.message });
        logger.warn(`獲取 QR 碼失敗: ${userId}, 狀態: ${result.status}, 訊息: ${result.message}`);
      }
    } catch (error) {
      logger.error(`獲取 QR 碼失敗: ${error.message}`);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
    }
  });

  // 獲取登入狀態
  router.get('/status', async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({ error: '缺少 userId 參數' });
      }
      
      const result = await whatsappService.getLoginStatus(userId, req.session);
      
      if (result.status === 200) {
        res.json(result.data);
        logger.info(`獲取 WhatsApp 狀態成功: ${userId}`);
      } else {
        res.status(result.status).json({ error: result.message });
        logger.warn(`獲取 WhatsApp 狀態失敗: ${userId}, 狀態: ${result.status}, 訊息: ${result.message}`);
      }
    } catch (error) {
      logger.error(`獲取 WhatsApp 狀態失敗: ${error.message}`);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
    }
  });

  // 獲取連接狀態（詳細）
  router.get('/connection-status', async (req, res) => {
    try {
      const { getClients } = require('../services/whatsappConnection');
      const clients = getClients();
      
      const health = {
        status: 'ok',
        service: 'WhatsApp Service',
        timestamp: new Date().toISOString(),
        connections: {
          total: clients.size,
          active: Array.from(clients.values()).filter(client => client.ready).length,
          inactive: Array.from(clients.values()).filter(client => !client.ready).length
        }
      };
      
      res.json(health);
      logger.info('獲取 WhatsApp 連接狀態成功');
    } catch (error) {
      logger.error(`獲取 WhatsApp 連接狀態失敗: ${error.message}`);
      res.status(500).json({
        status: 'error',
        service: 'WhatsApp Service',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
}; 