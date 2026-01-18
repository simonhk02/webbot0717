/**
 * AI 路由
 */

const express = require('express');
const AIController = require('../controllers/AIController');

module.exports = (container) => {
  const router = express.Router();
  const aiController = new AIController(container);

  // AI 對話
  router.post('/chat', aiController.chat.bind(aiController));
  
  // 圖片分析
  router.post('/analyze-image', aiController.analyzeImage.bind(aiController));
  
  // 取得服務狀態
  router.get('/status', aiController.getStatus.bind(aiController));
  
  // 重置上下文
  router.post('/reset-context', aiController.resetContext.bind(aiController));

  return router;
}; 