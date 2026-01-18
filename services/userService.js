const db = require('../database');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { businessLogger } = require('../utils/logger');

class UserService {
  constructor() {
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      businessLogger.warn('用戶服務已初始化，跳過重複初始化');
      return;
    }

    try {
      // 初始化用戶服務
      this.isInitialized = true;
      businessLogger.info('用戶服務初始化完成');
    } catch (err) {
      businessLogger.error(`用戶服務初始化失敗：${err.message}`);
      throw err;
    }
  }

  async cleanup() {
    businessLogger.info('用戶服務清理完成');
  }

  async healthCheck() {
    return {
      status: 'healthy',
      service: 'User',
      timestamp: new Date().toISOString(),
      details: {
        isInitialized: this.isInitialized
      }
    };
  }

  async registerUser(email, password) {
    if (!email || !password) {
      businessLogger.error('註冊失敗：缺少 Email 或密碼');
      throw { status: 400, message: '請輸入 Email 和密碼' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      businessLogger.error('註冊失敗：無效的 Email 格式');
      throw { status: 400, message: '無效的 Email 格式' };
    }

    if (password.length < 6) {
      businessLogger.error('註冊失敗：密碼過短');
      throw { status: 400, message: '密碼需至少 6 個字元' };
    }

    return new Promise((resolve, reject) => {
      db.get('SELECT email FROM users WHERE email = ?', [email], async (err, row) => {
        if (err) {
          businessLogger.error(`資料庫查詢錯誤: ${err.message}`);
          return reject({ status: 500, message: '資料庫錯誤' });
        }
        if (row) {
          businessLogger.error(`註冊失敗：Email ${email} 已存在`);
          return reject({ status: 400, message: '該 Email 已註冊' });
        }

        try {
          const userId = uuidv4();
          const hashedPassword = await bcrypt.hash(password, 10);
          const username = email.split('@')[0];

          db.run(
            'INSERT INTO users (userId, username, email, password, groupName, messageFormat, customQuestions, driveFolderId, sheetId, sheetName, isAuthenticated, enableAI, aiConfidenceThreshold, enablePdf, pdfStyle, companyPhone, invoiceTitle, invoiceNumberPrefix, invoiceFooter) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [userId, username, email, hashedPassword, '', '日期: {date}\n項目: {item}\n銀碼: ${amount}\n備註: {note}\n收據: {imageUrl}', '[]', '', '', '', false, false, 0.8, false, '', '', '', '', ''],
            (err) => {
              if (err) {
                businessLogger.error(`資料庫插入錯誤: ${err.message}`);
                return reject({ status: 500, message: '資料庫錯誤' });
              }
              businessLogger.info(`新用戶 ${email} 註冊成功，userId: ${userId}`);
              resolve({ userId });
            }
          );
        } catch (err) {
          businessLogger.error(`註冊失敗: ${err.message}`);
          reject({ status: 500, message: '註冊失敗，請重試' });
        }
      });
    });
  }

  async loginUser(email, password) {
    return new Promise((resolve, reject) => {
      if (!email || !password) {
        businessLogger.error('登入失敗：缺少 Email 或密碼');
        return reject({ status: 400, message: '請輸入 Email 和密碼' });
      }

      db.get('SELECT userId, password FROM users WHERE email = ?', [email], async (err, row) => {
        if (err) {
          businessLogger.error(`資料庫查詢錯誤: ${err.message}`);
          return reject({ status: 500, message: '資料庫錯誤' });
        }
        if (!row) {
          businessLogger.error(`登入失敗：Email ${email} 不存在`);
          return reject({ status: 400, message: 'Email 不存在' });
        }

        try {
          const match = await bcrypt.compare(password, row.password);
          if (!match) {
            businessLogger.error(`登入失敗：密碼錯誤 for email ${email}`);
            return reject({ status: 400, message: '密碼錯誤' });
          }

          businessLogger.info(`用戶 ${email} 登入成功，userId: ${row.userId}`);
          resolve({ userId: row.userId });
        } catch (err) {
          businessLogger.error(`登入失敗: ${err.message}`);
          reject({ status: 500, message: '登入失敗，請重試' });
        }
      });
    });
  }

  async getUserSettings(userId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE userId = ?', [userId], (err, row) => {
        if (err) {
          businessLogger.error(`資料庫查詢錯誤: ${err.message}`);
          return reject({ status: 500, message: '資料庫錯誤' });
        }

        if (!row) {
          businessLogger.error(`用戶不存在: ${userId}`);
          return reject({ status: 404, message: '用戶不存在' });
        }

        const settings = {
          groupName: row.groupName || '',
          messageFormat: row.messageFormat || '',
          customQuestions: JSON.parse(row.customQuestions || '[]'),
          driveFolderId: row.driveFolderId || '',
          sheetId: row.sheetId || '',
          sheetName: row.sheetName || '',
          companyName: row.companyName || '',
          companyAddress: row.companyAddress || '',
          companyPhone: row.companyPhone || '',
          invoiceTitle: row.invoiceTitle || '',
          invoiceNumberPrefix: row.invoiceNumberPrefix || '',
          invoiceFooter: row.invoiceFooter || '',
          enableAI: Boolean(row.enableAI),
          aiConfidenceThreshold: row.aiConfidenceThreshold || 0.8
        };

        businessLogger.info(`返回用戶 ${userId} 的設置`);
        resolve(settings);
      });
    });
  }

  async getUserById(userId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE userId = ?', [userId], (err, row) => {
        if (err) {
          businessLogger.error(`資料庫查詢錯誤: ${err.message}`);
          return reject({ status: 500, message: '資料庫錯誤' });
        }

        if (!row) {
          businessLogger.error(`用戶不存在: ${userId}`);
          return reject({ status: 404, message: '用戶不存在' });
        }

        const user = {
          userId: row.userId,
          username: row.username,
          email: row.email,
          groupName: row.groupName || '',
          messageFormat: row.messageFormat || '',
          customQuestions: JSON.parse(row.customQuestions || '[]'),
          driveFolderId: row.driveFolderId || '',
          googleSheetsId: row.sheetId || '', // 添加這個別名用於Analytics
          sheetId: row.sheetId || '',
          sheetName: row.sheetName || '',
          companyName: row.companyName || '',
          companyAddress: row.companyAddress || '',
          companyPhone: row.companyPhone || '',
          invoiceTitle: row.invoiceTitle || '',
          invoiceNumberPrefix: row.invoiceNumberPrefix || '',
          invoiceFooter: row.invoiceFooter || '',
          enableAI: Boolean(row.enableAI),
          aiConfidenceThreshold: row.aiConfidenceThreshold || 0.8,
          isAuthenticated: Boolean(row.isAuthenticated)
        };

        businessLogger.info(`取得用戶成功: ${userId}`);
        resolve(user);
      });
    });
  }

  async updateUserSettings(userId, settings) {
    return new Promise((resolve, reject) => {
      // 首先獲取現有的設置
      db.get('SELECT * FROM users WHERE userId = ?', [userId], (err, row) => {
        if (err) {
          businessLogger.error(`資料庫查詢錯誤: ${err.message}`);
          return reject({ status: 500, message: '資料庫錯誤' });
        }

        if (!row) {
          businessLogger.error(`用戶不存在: ${userId}`);
          return reject({ status: 404, message: '用戶不存在' });
        }

        // 合併現有設置和新設置
        const updatedSettings = {
          groupName: settings.groupName !== undefined ? settings.groupName : row.groupName,
          messageFormat: settings.messageFormat !== undefined ? settings.messageFormat : row.messageFormat,
          customQuestions: settings.customQuestions !== undefined ? settings.customQuestions : JSON.parse(row.customQuestions || '[]'),
          driveFolderId: settings.driveFolderId !== undefined ? settings.driveFolderId : row.driveFolderId,
          sheetId: settings.sheetId !== undefined ? settings.sheetId : row.sheetId,
          sheetName: settings.sheetName !== undefined ? settings.sheetName : row.sheetName,
          companyName: settings.companyName !== undefined ? settings.companyName : row.companyName,
          companyAddress: settings.companyAddress !== undefined ? settings.companyAddress : row.companyAddress,
          companyPhone: settings.companyPhone !== undefined ? settings.companyPhone : row.companyPhone,
          invoiceTitle: settings.invoiceTitle !== undefined ? settings.invoiceTitle : row.invoiceTitle,
          invoiceNumberPrefix: settings.invoiceNumberPrefix !== undefined ? settings.invoiceNumberPrefix : row.invoiceNumberPrefix,
          invoiceFooter: settings.invoiceFooter !== undefined ? settings.invoiceFooter : row.invoiceFooter,
          enableAI: settings.enableAI !== undefined ? settings.enableAI : row.enableAI,
          aiConfidenceThreshold: settings.aiConfidenceThreshold !== undefined ? settings.aiConfidenceThreshold : row.aiConfidenceThreshold
        };

        // 處理 URL 解析 - 從完整 URL 中提取 ID
        if (settings.driveFolderUrl !== undefined) {
          try {
            if (settings.driveFolderUrl) {
              const driveFolderMatch = settings.driveFolderUrl.match(/\/folders\/([a-zA-Z0-9-_]+)/);
              updatedSettings.driveFolderId = driveFolderMatch ? driveFolderMatch[1] : '';
            } else {
              updatedSettings.driveFolderId = '';
            }
            businessLogger.info(`解析Drive文件夾URL: ${settings.driveFolderUrl} -> ID: ${updatedSettings.driveFolderId}`);
          } catch (err) {
            businessLogger.warn(`解析Drive文件夾URL失敗: ${err.message}`);
            updatedSettings.driveFolderId = row.driveFolderId;
          }
        }

        if (settings.sheetUrl !== undefined) {
          try {
            if (settings.sheetUrl) {
              const sheetIdMatch = settings.sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
              updatedSettings.sheetId = sheetIdMatch ? sheetIdMatch[1] : '';
            } else {
              updatedSettings.sheetId = '';
            }
            businessLogger.info(`解析Sheet URL: ${settings.sheetUrl} -> ID: ${updatedSettings.sheetId}`);
          } catch (err) {
            businessLogger.warn(`解析Sheet URL失敗: ${err.message}`);
            updatedSettings.sheetId = row.sheetId;
          }
        }

        // 驗證自訂問題
        let validatedQuestions = [];
        if (updatedSettings.customQuestions && Array.isArray(updatedSettings.customQuestions)) {
          validatedQuestions = updatedSettings.customQuestions.filter(q => 
            q && typeof q === 'object' && q.question && q.field
          ).map(q => ({
            question: q.question,
            field: q.field,
            prompts: q.prompts || '' // 確保 prompts 欄位存在，即使為空
          }));

          if (validatedQuestions.length !== updatedSettings.customQuestions.length) {
            businessLogger.warn(`部分 customQuestions 因格式不完整被過濾`);
          }
        }

        // 驗證 AI 設定
        if (updatedSettings.aiConfidenceThreshold < 0 || updatedSettings.aiConfidenceThreshold > 1) {
          businessLogger.error(`無效的 AI 可信度閾值: ${updatedSettings.aiConfidenceThreshold}`);
          return reject({ status: 400, message: 'AI 可信度閾值必須在 0 到 1 之間' });
        }

        // 更新資料庫
        db.run(
          'UPDATE users SET groupName = ?, messageFormat = ?, customQuestions = ?, driveFolderId = ?, sheetId = ?, sheetName = ?, companyName = ?, companyAddress = ?, companyPhone = ?, invoiceTitle = ?, invoiceNumberPrefix = ?, invoiceFooter = ?, enableAI = ?, aiConfidenceThreshold = ? WHERE userId = ?',
          [
            updatedSettings.groupName || '',
            updatedSettings.messageFormat || '',
            JSON.stringify(validatedQuestions),
            updatedSettings.driveFolderId || '',
            updatedSettings.sheetId || '',
            updatedSettings.sheetName || '',
            updatedSettings.companyName || '',
            updatedSettings.companyAddress || '',
            updatedSettings.companyPhone || '',
            updatedSettings.invoiceTitle || '',
            updatedSettings.invoiceNumberPrefix || '',
            updatedSettings.invoiceFooter || '',
            updatedSettings.enableAI ? 1 : 0,
            updatedSettings.aiConfidenceThreshold,
            userId
          ],
          async (err) => {
            if (err) {
              businessLogger.error(`資料庫更新錯誤: ${err.message}`);
              return reject({ status: 500, message: '資料庫錯誤' });
            }
            businessLogger.info(`用戶 ${userId} 的設置已更新`);
            
            // 觸發設置更新事件，重新載入WhatsApp客戶端設置
            try {
              businessLogger.info(`觸發用戶 ${userId} 設置重新載入`);
              const { reloadUserSettings } = require('./whatsappConnection');
              await reloadUserSettings(userId);
              businessLogger.info(`用戶 ${userId} 的WhatsApp客戶端設置已重新載入`);
            } catch (reloadError) {
              businessLogger.warn(`重新載入用戶 ${userId} 設置失敗：${reloadError.message}`);
              // 不拋出錯誤，因為設置已經保存成功
            }
            
            resolve('設置已儲存');
          }
        );
      });
    });
  }

  async logoutUser(userId, session) {
    return new Promise((resolve, reject) => {
      businessLogger.info(`用戶 ${userId} 登出`);
      session.destroy((err) => {
        if (err) {
          businessLogger.error(`Session 銷毀失敗: ${err.message}`);
          return reject({ status: 500, message: '登出失敗' });
        }
        resolve();
      });
    });
  }
}

module.exports = UserService;