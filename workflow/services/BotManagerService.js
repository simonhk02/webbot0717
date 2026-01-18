/**
 * 機械人管理器服務
 * 管理不同類型的機械人，包括WhatsApp、Telegram、Discord等
 */

const { businessLogger } = require('../../utils/logger');
const config = require('../config');

class BotManagerService {
  constructor(container) {
    this.container = container;
    this.logger = businessLogger;
    this.bots = new Map();
    this.isInitialized = false;
  }

  /**
   * 初始化機械人管理器
   */
  async initialize() {
    if (this.isInitialized) {
      this.logger.warn('機械人管理器已初始化，跳過重複初始化');
      return;
    }

    try {
      this.logger.info('開始初始化機械人管理器...');

      // 載入現有機械人
      await this.loadBots();

      // 初始化機械人連接
      await this.initializeBotConnections();

      this.isInitialized = true;
      this.logger.info('機械人管理器初始化完成');
    } catch (error) {
      this.logger.error('機械人管理器初始化失敗:', error);
      throw error;
    }
  }

  /**
   * 載入現有機械人
   */
  async loadBots() {
    try {
      const dbAdapter = this.container.getAdapter('databaseService');
      const bots = await dbAdapter.safeRead('all', 'SELECT * FROM bots WHERE status = ?', ['active']);
      
      for (const bot of bots) {
        this.bots.set(bot.id, {
          ...bot,
          config: JSON.parse(bot.config || '{}')
        });
      }

      this.logger.info(`載入 ${bots.length} 個機械人`);
    } catch (error) {
      this.logger.error('載入機械人失敗:', error);
      throw error;
    }
  }

  /**
   * 初始化機械人連接
   */
  async initializeBotConnections() {
    try {
      for (const [botId, bot] of this.bots.entries()) {
        await this.connectBot(botId, bot);
      }
    } catch (error) {
      this.logger.error('初始化機械人連接失敗:', error);
      throw error;
    }
  }

  /**
   * 創建機械人
   * @param {Object} botData - 機械人數據
   * @param {string} userId - 用戶ID
   * @param {string} tenantId - 租戶ID
   * @returns {Object} - 創建的機械人
   */
  async createBot(botData, userId, tenantId) {
    try {
      const { name, type, config = {} } = botData;

      // 設置默認配置
      const defaultConfig = {
        autoStart: false,
        defaultWorkflow: '',
        aiModel: 'claude-3-sonnet',
        systemPrompt: '你是一個專業的智能助手，幫助用戶處理各種任務。請保持友善、高效，並提供準確的信息。',
        whitelistMode: false,
        logConversations: true,
        authorizedUsers: '',
        maxConcurrentChats: 10,
        responseDelay: 1,
        timeout: 30,
        ...config
      };

      // 驗證機械人數據
      this.validateBotData(botData);

      const dbAdapter = this.container.getAdapter('databaseService');
      
      const result = await dbAdapter.safeRead('run', `
        INSERT INTO bots (name, type, config, user_id, tenant_id)
        VALUES (?, ?, ?, ?, ?)
      `, [
        name,
        type,
        JSON.stringify(defaultConfig),
        userId,
        tenantId
      ]);

      const botId = result.lastID;
      const bot = {
        id: botId,
        name,
        type,
        config,
        user_id: userId,
        tenant_id: tenantId,
        status: 'inactive'
      };

      this.bots.set(botId, bot);

      this.logger.info(`創建機械人成功: ${name} (ID: ${botId})`);
      return bot;
    } catch (error) {
      this.logger.error('創建機械人失敗:', error);
      throw error;
    }
  }

  /**
   * 連接機械人
   * @param {number} botId - 機械人ID
   * @param {Object} bot - 機械人配置
   */
  async connectBot(botId, bot) {
    try {
      switch (bot.type) {
        case 'whatsapp':
          await this.connectWhatsAppBot(botId, bot);
          break;
        case 'telegram':
          await this.connectTelegramBot(botId, bot);
          break;
        case 'discord':
          await this.connectDiscordBot(botId, bot);
          break;
        default:
          throw new Error(`不支援的機械人類型: ${bot.type}`);
      }

      // 更新機械人狀態
      await this.updateBotStatus(botId, 'active');
      this.logger.info(`機械人連接成功: ${bot.name} (ID: ${botId})`);
    } catch (error) {
      this.logger.error(`機械人連接失敗: ${bot.name} (ID: ${botId})`, error);
      await this.updateBotStatus(botId, 'error');
      throw error;
    }
  }

  /**
   * 連接WhatsApp機械人
   */
  async connectWhatsAppBot(botId, bot) {
    try {
      // 使用現有WhatsApp服務的適配器
      const whatsappAdapter = this.container.getAdapter('WhatsAppServiceV2');
      
      // 這裡可以實現WhatsApp機械人的連接邏輯
      // 由於是適配器模式，只能讀取，不能修改現有連接
      this.logger.info(`WhatsApp機械人準備連接: ${bot.name}`);
      
      // 模擬連接成功
      return true;
    } catch (error) {
      this.logger.error('WhatsApp機械人連接失敗:', error);
      throw error;
    }
  }

  /**
   * 連接Telegram機械人
   */
  async connectTelegramBot(botId, bot) {
    try {
      // 這裡實現Telegram機械人的連接邏輯
      this.logger.info(`Telegram機械人準備連接: ${bot.name}`);
      
      // 模擬連接成功
      return true;
    } catch (error) {
      this.logger.error('Telegram機械人連接失敗:', error);
      throw error;
    }
  }

  /**
   * 連接Discord機械人
   */
  async connectDiscordBot(botId, bot) {
    try {
      // 這裡實現Discord機械人的連接邏輯
      this.logger.info(`Discord機械人準備連接: ${bot.name}`);
      
      // 模擬連接成功
      return true;
    } catch (error) {
      this.logger.error('Discord機械人連接失敗:', error);
      throw error;
    }
  }

  /**
   * 發送消息
   * @param {number} botId - 機械人ID
   * @param {string} message - 消息內容
   * @param {Object} options - 選項
   */
  async sendMessage(botId, message, options = {}) {
    try {
      const bot = this.bots.get(botId);
      if (!bot) {
        throw new Error(`找不到機械人: ${botId}`);
      }

      if (bot.status !== 'active') {
        throw new Error(`機械人未連接: ${bot.name}`);
      }

      switch (bot.type) {
        case 'whatsapp':
          return await this.sendWhatsAppMessage(botId, message, options);
        case 'telegram':
          return await this.sendTelegramMessage(botId, message, options);
        case 'discord':
          return await this.sendDiscordMessage(botId, message, options);
        default:
          throw new Error(`不支援的機械人類型: ${bot.type}`);
      }
    } catch (error) {
      this.logger.error(`發送消息失敗: ${botId}`, error);
      throw error;
    }
  }

  /**
   * 發送WhatsApp消息
   */
  async sendWhatsAppMessage(botId, message, options) {
    try {
      // 使用現有WhatsApp服務的適配器
      const whatsappAdapter = this.container.getAdapter('WhatsAppServiceV2');
      
      // 由於適配器只能讀取，這裡模擬發送
      this.logger.info(`WhatsApp消息準備發送: ${message.substring(0, 50)}...`);
      
      return {
        success: true,
        messageId: `msg_${Date.now()}`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('WhatsApp消息發送失敗:', error);
      throw error;
    }
  }

  /**
   * 發送Telegram消息
   */
  async sendTelegramMessage(botId, message, options) {
    try {
      // 這裡實現Telegram消息發送邏輯
      this.logger.info(`Telegram消息準備發送: ${message.substring(0, 50)}...`);
      
      return {
        success: true,
        messageId: `tg_${Date.now()}`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Telegram消息發送失敗:', error);
      throw error;
    }
  }

  /**
   * 發送Discord消息
   */
  async sendDiscordMessage(botId, message, options) {
    try {
      // 這裡實現Discord消息發送邏輯
      this.logger.info(`Discord消息準備發送: ${message.substring(0, 50)}...`);
      
      return {
        success: true,
        messageId: `dc_${Date.now()}`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Discord消息發送失敗:', error);
      throw error;
    }
  }

  /**
   * 更新機械人狀態
   */
  async updateBotStatus(botId, status) {
    try {
      const dbAdapter = this.container.getAdapter('databaseService');
      await dbAdapter.safeRead('run', `
        UPDATE bots SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `, [status, botId]);

      const bot = this.bots.get(botId);
      if (bot) {
        bot.status = status;
      }
    } catch (error) {
      this.logger.error(`更新機械人狀態失敗: ${botId}`, error);
      throw error;
    }
  }

  /**
   * 啟用機械人
   * @param {number} botId - 機械人ID
   * @param {string} userId - 用戶ID
   * @param {string} tenantId - 租戶ID
   * @returns {Object} - 操作結果
   */
  async enableBot(botId, userId, tenantId) {
    try {
      this.logger.info(`開始啟用機械人: ${botId}`);

      // 檢查機械人是否存在且屬於該用戶
      const bot = await this.validateBotOwnership(botId, userId, tenantId);
      if (!bot) {
        throw new Error(`機械人不存在或無權限: ${botId}`);
      }

      // 檢查當前狀態
      if (bot.status === 'active') {
        this.logger.warn(`機械人已處於啟用狀態: ${botId}`);
        return { success: true, message: '機械人已處於啟用狀態', status: 'active' };
      }

      // 嘗試連接機械人
      await this.connectBot(botId, bot);

      // 更新狀態為啟用
      await this.updateBotStatus(botId, 'active');

      this.logger.info(`機械人啟用成功: ${botId}`);
      return { 
        success: true, 
        message: `機械人 ${bot.name} 已成功啟用`, 
        status: 'active',
        botId: botId 
      };
    } catch (error) {
      this.logger.error(`機械人啟用失敗: ${botId}`, error);
      
      // 更新狀態為錯誤
      await this.updateBotStatus(botId, 'error');
      
      return { 
        success: false, 
        message: `機械人啟用失敗: ${error.message}`, 
        status: 'error',
        error: error.message 
      };
    }
  }

  /**
   * 關閉機械人
   * @param {number} botId - 機械人ID
   * @param {string} userId - 用戶ID
   * @param {string} tenantId - 租戶ID
   * @returns {Object} - 操作結果
   */
  async disableBot(botId, userId, tenantId) {
    try {
      this.logger.info(`開始關閉機械人: ${botId}`);

      // 檢查機械人是否存在且屬於該用戶
      const bot = await this.validateBotOwnership(botId, userId, tenantId);
      if (!bot) {
        throw new Error(`機械人不存在或無權限: ${botId}`);
      }

      // 檢查當前狀態
      if (bot.status === 'inactive') {
        this.logger.warn(`機械人已處於關閉狀態: ${botId}`);
        return { success: true, message: '機械人已處於關閉狀態', status: 'inactive' };
      }

      // 斷開機械人連接
      await this.disconnectBot(botId, bot);

      // 更新狀態為關閉
      await this.updateBotStatus(botId, 'inactive');

      this.logger.info(`機械人關閉成功: ${botId}`);
      return { 
        success: true, 
        message: `機械人 ${bot.name} 已成功關閉`, 
        status: 'inactive',
        botId: botId 
      };
    } catch (error) {
      this.logger.error(`機械人關閉失敗: ${botId}`, error);
      
      return { 
        success: false, 
        message: `機械人關閉失敗: ${error.message}`, 
        status: 'error',
        error: error.message 
      };
    }
  }

  /**
   * 斷開機械人連接
   * @param {number} botId - 機械人ID
   * @param {Object} bot - 機械人配置
   */
  async disconnectBot(botId, bot) {
    try {
      switch (bot.type) {
        case 'whatsapp':
          await this.disconnectWhatsAppBot(botId, bot);
          break;
        case 'telegram':
          await this.disconnectTelegramBot(botId, bot);
          break;
        case 'discord':
          await this.disconnectDiscordBot(botId, bot);
          break;
        default:
          this.logger.warn(`不支援的機械人類型斷開: ${bot.type}`);
      }

      this.logger.info(`機械人斷開連接: ${bot.name} (ID: ${botId})`);
    } catch (error) {
      this.logger.error(`機械人斷開連接失敗: ${bot.name} (ID: ${botId})`, error);
      throw error;
    }
  }

  /**
   * 斷開WhatsApp機械人
   */
  async disconnectWhatsAppBot(botId, bot) {
    try {
      this.logger.info(`WhatsApp機械人斷開連接: ${bot.name}`);
      // 這裡實現WhatsApp機械人的斷開邏輯
      // 由於是適配器模式，只能執行安全的斷開操作
      return true;
    } catch (error) {
      this.logger.error('WhatsApp機械人斷開失敗:', error);
      throw error;
    }
  }

  /**
   * 斷開Telegram機械人
   */
  async disconnectTelegramBot(botId, bot) {
    try {
      this.logger.info(`Telegram機械人斷開連接: ${bot.name}`);
      // 這裡實現Telegram機械人的斷開邏輯
      return true;
    } catch (error) {
      this.logger.error('Telegram機械人斷開失敗:', error);
      throw error;
    }
  }

  /**
   * 斷開Discord機械人
   */
  async disconnectDiscordBot(botId, bot) {
    try {
      this.logger.info(`Discord機械人斷開連接: ${bot.name}`);
      // 這裡實現Discord機械人的斷開邏輯
      return true;
    } catch (error) {
      this.logger.error('Discord機械人斷開失敗:', error);
      throw error;
    }
  }

  /**
   * 驗證機械人所有權
   * @param {number} botId - 機械人ID
   * @param {string} userId - 用戶ID
   * @param {string} tenantId - 租戶ID
   * @returns {Object|null} - 機械人信息或null
   */
  async validateBotOwnership(botId, userId, tenantId) {
    try {
      const dbAdapter = this.container.getAdapter('databaseService');
      const bots = await dbAdapter.safeRead('all', `
        SELECT * FROM bots 
        WHERE id = ? AND user_id = ? AND tenant_id = ?
      `, [botId, userId, tenantId]);

      if (bots.length === 0) {
        return null;
      }

      const bot = bots[0];
      bot.config = JSON.parse(bot.config || '{}');
      return bot;
    } catch (error) {
      this.logger.error('驗證機械人所有權失敗:', error);
      throw error;
    }
  }

  /**
   * 驗證機械人數據
   */
  validateBotData(botData) {
    const { name, type } = botData;

    if (!name || name.trim().length === 0) {
      throw new Error('機械人名稱不能為空');
    }

    if (!type || !['whatsapp', 'telegram', 'discord'].includes(type)) {
      throw new Error('不支援的機械人類型');
    }
  }

  /**
   * 獲取機械人列表
   * @param {string} userId - 用戶ID
   * @param {string} tenantId - 租戶ID
   * @returns {Array} - 機械人列表
   */
  async getBots(userId, tenantId) {
    try {
      const dbAdapter = this.container.getAdapter('databaseService');
      const bots = await dbAdapter.safeRead('all', `
        SELECT * FROM bots 
        WHERE user_id = ? AND tenant_id = ?
        ORDER BY created_at DESC
      `, [userId, tenantId]);

      return bots.map(bot => ({
        ...bot,
        config: JSON.parse(bot.config || '{}')
      }));
    } catch (error) {
      this.logger.error('獲取機械人列表失敗:', error);
      throw error;
    }
  }

  /**
   * 健康檢查
   */
  async healthCheck() {
    try {
      const activeBots = Array.from(this.bots.values()).filter(bot => bot.status === 'active');
      
      return {
        status: 'healthy',
        service: 'BotManagerService',
        botsCount: this.bots.size,
        activeBotsCount: activeBots.length,
        isInitialized: this.isInitialized,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'BotManagerService',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 清理資源
   */
  async cleanup() {
    try {
      this.bots.clear();
      this.isInitialized = false;
      this.logger.info('機械人管理器清理完成');
    } catch (error) {
      this.logger.error('機械人管理器清理失敗:', error);
      throw error;
    }
  }
}

module.exports = BotManagerService; 