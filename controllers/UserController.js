/**
 * 使用者控制器
 * 處理所有與使用者相關的 HTTP 請求
 */

class UserController {
  constructor(container) {
    this.userService = container.resolve('userService');
    this.logger = container.resolve('logger');
  }

  /**
   * 處理使用者註冊請求
   */
  async register(req, res) {
    try {
      const { username, password, email } = req.body;
      const result = await this.userService.registerUser(email, password);
      res.json(result);
    } catch (error) {
      this.logger.error('註冊失敗:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * 處理使用者登入請求
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;
      const result = await this.userService.loginUser(email, password);
      
      // 設置會話
      req.session.userId = result.userId;
      req.session.email = email;
      
      // 強制保存會話
      req.session.save((err) => {
        if (err) {
          this.logger.error('會話保存失敗:', err);
        } else {
          this.logger.info(`會話已保存，用戶ID: ${result.userId}`);
        }
      });
      
      res.json(result);
    } catch (error) {
      this.logger.error('登入失敗:', error);
      res.status(401).json({ error: error.message });
    }
  }

  /**
   * 處理使用者登出請求
   */
  async logout(req, res) {
    try {
      const userId = req.query.userId || req.body.userId || (req.user && req.user.id);
      if (!userId) {
        return res.status(400).json({ error: '缺少 userId 參數' });
      }
      const result = await this.userService.logoutUser(userId, req.session);
      res.json(result);
    } catch (error) {
      this.logger.error('登出失敗:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * 取得使用者設定
   */
  async getSettings(req, res) {
    try {
      const userId = req.query.userId || req.body.userId || (req.user && req.user.id);
      if (!userId) {
        return res.status(400).json({ error: '缺少 userId 參數' });
      }
      const settings = await this.userService.getUserSettings(userId);
      res.json(settings);
    } catch (error) {
      this.logger.error('取得設定失敗:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * 更新使用者設定
   */
  async updateSettings(req, res) {
    try {
      const userId = req.query.userId || req.body.userId || (req.user && req.user.id);
      if (!userId) {
        return res.status(400).json({ error: '缺少 userId 參數' });
      }
      const settings = req.body;
      const result = await this.userService.updateUserSettings(userId, settings);
      res.json(result);
    } catch (error) {
      this.logger.error('更新設定失敗:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = UserController; 