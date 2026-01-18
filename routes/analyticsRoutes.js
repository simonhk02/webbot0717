const express = require('express');
const AnalyticsAIService = require('../services/analyticsAIService');
const { businessLogger } = require('../utils/logger');

module.exports = (container) => {
  const router = express.Router();
  const analyticsService = new AnalyticsAIService();

  // 初始化服務
  analyticsService.initialize().catch(err => {
    businessLogger.error(`Analytics服務初始化失敗: ${err.message}`);
  });

  /**
   * 🚀 生成智能儀表板
   * GET /api/analytics/dashboard?userId=xxx&filterMonth=2025-06
   */
  router.get('/dashboard', async (req, res) => {
    try {
      const { userId, filterMonth } = req.query;
      
      if (!userId) {
        return res.status(400).json({ 
          error: '缺少用戶ID',
          code: 'MISSING_USER_ID' 
        });
      }

      businessLogger.info(`🎯 開始生成用戶 ${userId} 的智能儀表板${filterMonth ? ` (篩選月份: ${filterMonth})` : ''}`);
      
      const dashboardConfig = await analyticsService.generateSmartDashboard(userId, filterMonth);
      
      res.json({
        success: true,
        data: dashboardConfig,
        message: '智能儀表板生成成功'
      });
      
    } catch (error) {
      businessLogger.error(`❌ 生成儀表板失敗: ${error.message}`);
      
      res.status(500).json({
        error: error.message,
        code: 'DASHBOARD_GENERATION_FAILED',
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * 📊 獲取圖表數據
   * POST /api/analytics/chart-data
   */
  router.post('/chart-data', async (req, res) => {
    try {
      const { userId, chartConfig } = req.body;
      
      if (!userId || !chartConfig) {
        return res.status(400).json({ 
          error: '缺少必要參數',
          code: 'MISSING_PARAMETERS' 
        });
      }

      businessLogger.info(`📈 獲取用戶 ${userId} 的圖表數據`);
      
      const chartData = await analyticsService.getChartData(userId, chartConfig);
      
      res.json({
        success: true,
        data: chartData,
        message: '圖表數據獲取成功'
      });
      
    } catch (error) {
      businessLogger.error(`❌ 獲取圖表數據失敗: ${error.message}`);
      
      res.status(500).json({
        error: error.message,
        code: 'CHART_DATA_FAILED',
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * 🔄 重新分析數據
   * POST /api/analytics/reanalyze
   */
  router.post('/reanalyze', async (req, res) => {
    try {
      const { userId, filterMonth } = req.body;
      
      if (!userId) {
        return res.status(400).json({ 
          error: '缺少用戶ID',
          code: 'MISSING_USER_ID' 
        });
      }

      businessLogger.info(`🔄 重新分析用戶 ${userId} 的數據${filterMonth ? ` (篩選月份: ${filterMonth})` : ''}`);
      
      // 調用升級後的智能儀表板生成方法
      const dashboardConfig = await analyticsService.generateSmartDashboard(userId, filterMonth);
      
      res.json({
        success: true,
        data: dashboardConfig,
        message: '數據重新分析完成'
      });
      
    } catch (error) {
      businessLogger.error(`❌ 重新分析失敗: ${error.message}`);
      
      res.status(500).json({
        error: error.message,
        code: 'REANALYSIS_FAILED',
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * 📋 獲取數據概要
   * GET /api/analytics/summary?userId=xxx
   */
  router.get('/summary', async (req, res) => {
    try {
      const { userId } = req.query;
      
      if (!userId) {
        return res.status(400).json({ 
          error: '缺少用戶ID',
          code: 'MISSING_USER_ID' 
        });
      }

      const userData = await analyticsService.fetchUserSheetData(userId);
      
      const summary = {
        userId,
        totalRecords: userData.totalRecords,
        headers: userData.headers,
        sheetName: userData.sheetName,
        lastUpdated: new Date().toISOString(),
        dataStatus: userData.totalRecords > 0 ? '有數據' : '無數據'
      };
      
      res.json({
        success: true,
        data: summary,
        message: '數據概要獲取成功'
      });
      
    } catch (error) {
      businessLogger.error(`❌ 獲取數據概要失敗: ${error.message}`);
      
      res.status(500).json({
        error: error.message,
        code: 'SUMMARY_FAILED',
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * 🧠 AI 分析狀態
   * GET /api/analytics/ai-status
   */
  router.get('/ai-status', async (req, res) => {
    try {
      const status = {
        aiService: analyticsService.isInitialized ? '已初始化' : '未初始化',
        claudeModel: 'claude-3-haiku-20240307',
        features: [
          '自動數據結構識別',
          '智能圖表推薦', 
          '個性化洞察生成',
          '實時數據更新'
        ],
        timestamp: new Date().toISOString()
      };
      
      res.json({
        success: true,
        data: status,
        message: 'AI 服務狀態正常'
      });
      
    } catch (error) {
      businessLogger.error(`❌ 獲取AI狀態失敗: ${error.message}`);
      
      res.status(500).json({
        error: error.message,
        code: 'AI_STATUS_FAILED',
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * 📅 獲取可用月份列表
   * GET /api/analytics/available-months?userId=xxx
   */
  router.get('/available-months', async (req, res) => {
    try {
      const { userId } = req.query;
      
      if (!userId) {
        return res.status(400).json({ 
          error: '缺少用戶ID',
          code: 'MISSING_USER_ID' 
        });
      }

      businessLogger.info(`📅 獲取用戶 ${userId} 的可用月份列表`);
      
      const userData = await analyticsService.fetchUserSheetData(userId);
      const availableMonths = analyticsService.getAvailableMonths(userData);
      
      res.json({
        success: true,
        data: {
          availableMonths,
          totalMonths: availableMonths.length,
          latestMonth: availableMonths[0] || null,
          oldestMonth: availableMonths[availableMonths.length - 1] || null
        },
        message: '可用月份列表獲取成功'
      });
      
    } catch (error) {
      businessLogger.error(`❌ 獲取可用月份失敗: ${error.message}`);
      
      res.status(500).json({
        error: error.message,
        code: 'AVAILABLE_MONTHS_FAILED',
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
}; 