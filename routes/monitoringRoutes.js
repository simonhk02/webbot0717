const express = require('express');

/**
 * 監控系統API路由
 * 提供系統監控數據和警報管理
 */

module.exports = function(container) {
  const router = express.Router();

  // 獲取監控指標
  router.get('/metrics', async (req, res) => {
    try {
      const monitoringService = container.resolve('monitoringService');
      
      if (!monitoringService) {
        return res.status(503).json({
          success: false,
          message: '監控服務不可用'
        });
      }

      const metrics = monitoringService.getMetrics();
      const alerts = monitoringService.getAlerts(10); // 獲取最近10個警報

      res.json({
        success: true,
        metrics,
        alerts,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('獲取監控指標失敗:', error);
      res.status(500).json({
        success: false,
        message: '獲取監控指標失敗',
        error: error.message
      });
    }
  });

  // 獲取系統狀態
  router.get('/status', async (req, res) => {
    try {
      const monitoringService = container.resolve('monitoringService');
      
      if (!monitoringService) {
        return res.status(503).json({
          success: false,
          message: '監控服務不可用'
        });
      }

      const status = monitoringService.getStatus();

      res.json({
        success: true,
        status,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('獲取系統狀態失敗:', error);
      res.status(500).json({
        success: false,
        message: '獲取系統狀態失敗',
        error: error.message
      });
    }
  });

  // 獲取警報列表
  router.get('/alerts', async (req, res) => {
    try {
      const monitoringService = container.resolve('monitoringService');
      const limit = parseInt(req.query.limit) || 50;
      
      if (!monitoringService) {
        return res.status(503).json({
          success: false,
          message: '監控服務不可用'
        });
      }

      const alerts = monitoringService.getAlerts(limit);

      res.json({
        success: true,
        alerts,
        count: alerts.length,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('獲取警報列表失敗:', error);
      res.status(500).json({
        success: false,
        message: '獲取警報列表失敗',
        error: error.message
      });
    }
  });

  // 獲取錯誤列表
  router.get('/errors', async (req, res) => {
    try {
      const monitoringService = container.resolve('monitoringService');
      const limit = parseInt(req.query.limit) || 50;
      
      if (!monitoringService) {
        return res.status(503).json({
          success: false,
          message: '監控服務不可用'
        });
      }

      const errors = monitoringService.getErrors(limit);

      res.json({
        success: true,
        errors,
        count: errors.length,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('獲取錯誤列表失敗:', error);
      res.status(500).json({
        success: false,
        message: '獲取錯誤列表失敗',
        error: error.message
      });
    }
  });

  // 記錄業務指標
  router.post('/metrics/business', async (req, res) => {
    try {
      const monitoringService = container.resolve('monitoringService');
      const { category, key, value } = req.body;
      
      if (!monitoringService) {
        return res.status(503).json({
          success: false,
          message: '監控服務不可用'
        });
      }

      if (!category || !key || value === undefined) {
        return res.status(400).json({
          success: false,
          message: '缺少必要參數: category, key, value'
        });
      }

      monitoringService.recordBusinessMetric(category, key, value);

      res.json({
        success: true,
        message: '業務指標已記錄',
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('記錄業務指標失敗:', error);
      res.status(500).json({
        success: false,
        message: '記錄業務指標失敗',
        error: error.message
      });
    }
  });

  // 記錄性能指標
  router.post('/metrics/performance', async (req, res) => {
    try {
      const monitoringService = container.resolve('monitoringService');
      const { type, value } = req.body;
      
      if (!monitoringService) {
        return res.status(503).json({
          success: false,
          message: '監控服務不可用'
        });
      }

      if (!type || value === undefined) {
        return res.status(400).json({
          success: false,
          message: '缺少必要參數: type, value'
        });
      }

      monitoringService.recordPerformanceMetric(type, value);

      res.json({
        success: true,
        message: '性能指標已記錄',
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('記錄性能指標失敗:', error);
      res.status(500).json({
        success: false,
        message: '記錄性能指標失敗',
        error: error.message
      });
    }
  });

  // 清除警報
  router.delete('/alerts', async (req, res) => {
    try {
      const monitoringService = container.resolve('monitoringService');
      
      if (!monitoringService) {
        return res.status(503).json({
          success: false,
          message: '監控服務不可用'
        });
      }

      monitoringService.clearAlerts();

      res.json({
        success: true,
        message: '警報已清除',
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('清除警報失敗:', error);
      res.status(500).json({
        success: false,
        message: '清除警報失敗',
        error: error.message
      });
    }
  });

  // 獲取系統健康狀態
  router.get('/health', async (req, res) => {
    try {
      const monitoringService = container.resolve('monitoringService');
      
      if (!monitoringService) {
        return res.status(503).json({
          success: false,
          message: '監控服務不可用'
        });
      }

      const health = monitoringService.getHealthStatus();

      res.json({
        success: true,
        health,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('獲取健康狀態失敗:', error);
      res.status(500).json({
        success: false,
        message: '獲取健康狀態失敗',
        error: error.message
      });
    }
  });

  return router;
}; 