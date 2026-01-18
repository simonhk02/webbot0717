const express = require('express');
const { businessLogger } = require('../utils/logger');

/**
 * 熱重載路由
 * 提供熱重載管理的 API 接口
 */
module.exports = (container) => {
  const router = express.Router();

  /**
   * 獲取熱重載狀態
   */
  router.get('/status', (req, res) => {
    try {
      const hotReloadService = container.resolve('hotReloadService');
      const stats = hotReloadService.getStats();
      
      res.json({
        success: true,
        data: {
          ...stats,
          servicesCount: container.size(),
          services: container.getServiceNames()
        }
      });
    } catch (error) {
      businessLogger.error('獲取熱重載狀態失敗:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * 手動重載指定服務
   */
  router.post('/reload/:serviceName', async (req, res) => {
    try {
      const { serviceName } = req.params;
      const hotReloadService = container.resolve('hotReloadService');
      
      await hotReloadService.manualReload(serviceName);
      
      res.json({
        success: true,
        message: `服務 ${serviceName} 重載成功`
      });
    } catch (error) {
      businessLogger.error(`手動重載服務失敗:`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * 批量重載服務
   */
  router.post('/reload-batch', async (req, res) => {
    try {
      const { services } = req.body;
      
      if (!Array.isArray(services)) {
        return res.status(400).json({
          success: false,
          error: '請提供服務名稱陣列'
        });
      }

      const results = await container.reloadServices(services);
      
      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      businessLogger.error('批量重載服務失敗:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * 重載所有可重載的服務
   */
  router.post('/reload-all', async (req, res) => {
    try {
      const serviceNames = container.getServiceNames();
      
      // 排除核心不可重載的服務
      const excludeServices = ['logger', 'config', 'stateManager', 'eventBus'];
      const reloadableServices = serviceNames.filter(name => !excludeServices.includes(name));
      
      const results = await container.reloadServices(reloadableServices);
      
      res.json({
        success: true,
        message: `嘗試重載 ${reloadableServices.length} 個服務`,
        data: results
      });
    } catch (error) {
      businessLogger.error('重載所有服務失敗:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * 獲取服務列表
   */
  router.get('/services', (req, res) => {
    try {
      const serviceNames = container.getServiceNames();
      const services = serviceNames.map(name => {
        const service = container.resolve(name);
        return {
          name,
          type: typeof service,
          hasInitialize: typeof service.initialize === 'function',
          hasCleanup: typeof service.cleanup === 'function'
        };
      });
      
      res.json({
        success: true,
        data: services
      });
    } catch (error) {
      businessLogger.error('獲取服務列表失敗:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * 啟動/停止文件監控
   */
  router.post('/watch/:action', async (req, res) => {
    try {
      const { action } = req.params;
      const hotReloadService = container.resolve('hotReloadService');
      
      if (action === 'start') {
        await hotReloadService.startFileWatching();
        res.json({
          success: true,
          message: '文件監控已啟動'
        });
      } else if (action === 'stop') {
        await hotReloadService.stop();
        res.json({
          success: true,
          message: '文件監控已停止'
        });
      } else {
        res.status(400).json({
          success: false,
          error: '無效的操作，請使用 start 或 stop'
        });
      }
    } catch (error) {
      businessLogger.error('控制文件監控失敗:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * 清空重載隊列
   */
  router.post('/clear-queue', async (req, res) => {
    try {
      const hotReloadService = container.resolve('hotReloadService');
      hotReloadService.reloadQueue.clear();
      
      res.json({
        success: true,
        message: '重載隊列已清空'
      });
    } catch (error) {
      businessLogger.error('清空重載隊列失敗:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}; 