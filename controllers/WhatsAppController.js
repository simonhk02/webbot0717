/**
 * WhatsApp 控制器
 * 處理所有與 WhatsApp 相關的 HTTP 請求
 */

class WhatsAppController {
  constructor(container) {
    this.whatsappService = container.resolve('whatsappService');
    this.logger = container.resolve('logger');
    this.eventBus = container.resolve('eventBus');
  }

  /**
   * 取得 WhatsApp 連線狀態
   */
  async getConnectionStatus(req, res) {
    try {
      const status = await this.whatsappService.getConnectionStatus();
      res.json({ status });
    } catch (error) {
      this.logger.error('取得連線狀態失敗:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * 處理 WhatsApp 訊息
   */
  async handleMessage(req, res) {
    try {
      const message = req.body;
      await this.eventBus.emit('message.received', message);
      res.json({ success: true });
    } catch (error) {
      this.logger.error('處理訊息失敗:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * 發送 WhatsApp 訊息
   */
  async sendMessage(req, res) {
    try {
      const { to, message } = req.body;
      const result = await this.whatsappService.sendMessage(to, message);
      res.json(result);
    } catch (error) {
      this.logger.error('發送訊息失敗:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * 重新連線 WhatsApp
   */
  async reconnect(req, res) {
    try {
      await this.whatsappService.reconnect();
      res.json({ success: true });
    } catch (error) {
      this.logger.error('重新連線失敗:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = WhatsAppController; 