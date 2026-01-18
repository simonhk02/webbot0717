/**
 * 健康檢查路由
 */

const express = require('express');
const { getRedisInstance } = require('../services/redisService');
const db = require('../database');

module.exports = (container) => {
  const router = express.Router();

  // 基本健康檢查
  router.get('/', (req, res) => {
    res.json({ status: 'ok' });
  });

  // 詳細健康檢查
  router.get('/detailed', async (req, res) => {
    try {
      const databaseService = container.resolve('databaseService');
      const redisService = container.resolve('redisService');
      const whatsappService = container.resolve('whatsappService');
      const aiService = container.resolve('aiService');

      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
          database: await databaseService.healthCheck(),
          redis: await redisService.healthCheck(),
          whatsapp: await whatsappService.healthCheck(),
          ai: await aiService.healthCheck()
        }
      };

      // 如果任何服務不健康，將整體狀態設為 error
      const services = Object.values(health.services);
      if (services.some(service => service.status !== 'ok')) {
        health.status = 'error';
      }

      res.json(health);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  });

  // 整體健康檢查
  router.get('/health', async (req, res) => {
    try {
      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
          server: 'running',
          database: 'unknown',
          redis: 'unknown',
          plugins: 'unknown'
        }
      };

      // 檢查資料庫
      try {
        await new Promise((resolve, reject) => {
          db.get('SELECT 1', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        health.services.database = 'ok';
      } catch (err) {
        health.services.database = 'error';
      }

      // 檢查 Redis
      try {
        const redis = getRedisInstance();
        await redis.ping();
        health.services.redis = 'ok';
      } catch (err) {
        health.services.redis = 'error';
      }

      // 檢查插件系統
      try {
        const moduleManager = require('../services/moduleManager');
        const plugins = moduleManager.getAllPlugins();
        health.services.plugins = `ok (${plugins.length} plugins)`;
      } catch (err) {
        health.services.plugins = 'error';
      }

      res.json(health);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // AI 服務健康檢查
  router.get('/ai/health', async (req, res) => {
    try {
      const health = {
        status: 'ok',
        service: 'AI Service',
        timestamp: new Date().toISOString(),
        features: {
          imageProcessing: 'available',
          textAnalysis: 'available',
          confidenceThreshold: 0.8
        }
      };
      res.json(health);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        service: 'AI Service',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // WhatsApp 服務健康檢查
  router.get('/whatsapp/status', async (req, res) => {
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
    } catch (error) {
      res.status(500).json({
        status: 'error',
        service: 'WhatsApp Service',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Redis 服務健康檢查
  router.get('/redis/status', async (req, res) => {
    try {
      const redis = getRedisInstance();
      await redis.ping();
      
      const health = {
        status: 'ok',
        service: 'Redis Service',
        timestamp: new Date().toISOString(),
        type: redis.constructor.name === 'RedisMock' ? 'mock' : 'real'
      };
      res.json(health);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        service: 'Redis Service',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
}; 