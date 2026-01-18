/**
 * AI 控制器
 * 處理所有與 AI 服務相關的 HTTP 請求
 */

class AIController {
  constructor(container) {
    this.aiService = container.resolve('aiService');
    this.logger = container.resolve('logger');
  }

  /**
   * 處理 AI 對話請求
   */
  async chat(req, res) {
    try {
      const { message, context } = req.body;
      const response = await this.aiService.generateResponse(message, context);
      res.json({ response });
    } catch (error) {
      this.logger.error('AI 對話失敗:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * 處理圖片分析請求
   */
  async analyzeImage(req, res) {
    try {
      const { imageUrl } = req.body;
      const analysis = await this.aiService.analyzeImage(imageUrl);
      res.json(analysis);
    } catch (error) {
      this.logger.error('圖片分析失敗:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * 取得 AI 服務狀態
   */
  async getStatus(req, res) {
    try {
      const status = await this.aiService.getServiceStatus();
      res.json({ status });
    } catch (error) {
      this.logger.error('取得 AI 服務狀態失敗:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * 重置 AI 對話上下文
   */
  async resetContext(req, res) {
    try {
      const { userId } = req.body;
      await this.aiService.resetUserContext(userId);
      res.json({ success: true });
    } catch (error) {
      this.logger.error('重置上下文失敗:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = AIController; 