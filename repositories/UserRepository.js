/**
 * 使用者資料存取層
 * 處理所有與使用者相關的資料庫操作
 */

class UserRepository {
  constructor(container) {
    this.db = container.resolve('databaseService');
    this.logger = container.resolve('logger');
  }

  /**
   * 根據 ID 查找使用者
   */
  async findById(id) {
    try {
      const query = 'SELECT * FROM users WHERE id = ?';
      const user = await this.db.get(query, [id]);
      return user;
    } catch (error) {
      this.logger.error('查找使用者失敗:', error);
      throw error;
    }
  }

  /**
   * 根據使用者名稱查找使用者
   */
  async findByUsername(username) {
    try {
      const query = 'SELECT * FROM users WHERE username = ?';
      const user = await this.db.get(query, [username]);
      return user;
    } catch (error) {
      this.logger.error('查找使用者失敗:', error);
      throw error;
    }
  }

  /**
   * 建立新使用者
   */
  async create(userData) {
    try {
      const { username, password, email } = userData;
      const query = 'INSERT INTO users (username, password, email) VALUES (?, ?, ?)';
      const result = await this.db.run(query, [username, password, email]);
      return result;
    } catch (error) {
      this.logger.error('建立使用者失敗:', error);
      throw error;
    }
  }

  /**
   * 更新使用者資料
   */
  async update(id, userData) {
    try {
      const { username, email, settings } = userData;
      const query = 'UPDATE users SET username = ?, email = ?, settings = ? WHERE id = ?';
      const result = await this.db.run(query, [username, email, JSON.stringify(settings), id]);
      return result;
    } catch (error) {
      this.logger.error('更新使用者失敗:', error);
      throw error;
    }
  }

  /**
   * 取得使用者設定
   */
  async getSettings(id) {
    try {
      const query = 'SELECT settings FROM users WHERE id = ?';
      const result = await this.db.get(query, [id]);
      return result ? JSON.parse(result.settings) : {};
    } catch (error) {
      this.logger.error('取得使用者設定失敗:', error);
      throw error;
    }
  }

  /**
   * 更新使用者設定
   */
  async updateSettings(id, settings) {
    try {
      const query = 'UPDATE users SET settings = ? WHERE id = ?';
      const result = await this.db.run(query, [JSON.stringify(settings), id]);
      return result;
    } catch (error) {
      this.logger.error('更新使用者設定失敗:', error);
      throw error;
    }
  }
}

module.exports = UserRepository; 