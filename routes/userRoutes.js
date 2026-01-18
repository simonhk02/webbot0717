/**
 * 使用者路由
 */

const express = require('express');
const { businessLogger } = require('../utils/logger');

module.exports = (container) => {
  const router = express.Router();
  const userController = container.resolve('userController');
  const logger = businessLogger;

  // 註冊
  router.post('/register', async (req, res) => {
    try {
      const { email, password } = req.body;
      await userController.register(req, res);
      logger.info(`用戶註冊成功: ${email}`);
    } catch (error) {
      logger.error(`用戶註冊失敗: ${error.message}`);
      if (!res.headersSent) {
        res.status(error.status || 500).json({ error: error.message });
      }
    }
  });
  
  // 登入
  router.post('/login', async (req, res) => {
    try {
      const { email } = req.body;
      await userController.login(req, res);
      logger.info(`用戶登入成功: ${email}`);
    } catch (error) {
      logger.error(`用戶登入失敗: ${error.message}`);
      if (!res.headersSent) {
        res.status(error.status || 500).json({ error: error.message });
      }
    }
  });

  // 登出
  router.get('/logout', async (req, res) => {
    try {
      const { userId } = req.query;
      await userController.logout(req, res);
      logger.info(`用戶登出成功: ${userId}`);
    } catch (error) {
      logger.error(`用戶登出失敗: ${error.message}`);
      if (!res.headersSent) {
        res.status(error.status || 500).json({ error: error.message });
      }
    }
  });
  
  // 取得設定
  router.get('/settings', async (req, res) => {
    try {
      const { userId } = req.query;
      await userController.getSettings(req, res);
      logger.info(`取得用戶設定成功: ${userId}`);
    } catch (error) {
      logger.error(`取得用戶設定失敗: ${error.message}`);
      if (!res.headersSent) {
        res.status(error.status || 500).json({ error: error.message });
      }
    }
  });
  
  // 更新設定 (PUT)
  router.put('/settings', async (req, res) => {
    try {
      const { userId } = req.query;
      await userController.updateSettings(req, res);
      logger.info(`更新用戶設定成功: ${userId}`);
    } catch (error) {
      logger.error(`更新用戶設定失敗: ${error.message}`);
      if (!res.headersSent) {
        res.status(error.status || 500).json({ error: error.message });
      }
    }
  });

  // 更新設定 (POST) - 前端使用
  router.post('/settings', async (req, res) => {
    try {
      const { userId } = req.body;
      await userController.updateSettings(req, res);
      logger.info(`更新用戶設定成功: ${userId}`);
    } catch (error) {
      logger.error(`更新用戶設定失敗: ${error.message}`);
      if (!res.headersSent) {
        res.status(error.status || 500).json({ error: error.message });
      }
    }
  });

  return router;
};