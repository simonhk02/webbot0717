/**
 * 插件資料存取層
 * 處理所有與插件相關的資料庫操作
 */

class PluginRepository {
  constructor(container) {
    const databaseService = container.resolve('databaseService');
    this.db = databaseService.getDatabase();
    this.logger = container.resolve('logger');
  }

  /**
   * 取得所有已安裝的插件
   */
  async getAllPlugins() {
    try {
      // 先檢查表是否存在
      const checkTableQuery = "SELECT name FROM sqlite_master WHERE type='table' AND name='plugins'";
      return new Promise((resolve, reject) => {
        this.db.get(checkTableQuery, (err, row) => {
          if (err) {
            reject(err);
          } else if (!row) {
            // 表不存在，返回空陣列
            this.logger.warn('plugins 表不存在，返回空插件列表');
            resolve([]);
          } else {
            // 表存在，查詢插件
            const query = 'SELECT * FROM plugins WHERE is_installed = 1';
            this.db.all(query, (err, rows) => {
              if (err) {
                this.logger.warn('查詢插件失敗，返回空列表:', err.message);
                resolve([]);
              } else {
                resolve(rows || []);
              }
            });
          }
        });
      });
    } catch (error) {
      this.logger.error('取得插件列表失敗:', error);
      // 返回空陣列而不是拋出錯誤
      return [];
    }
  }

  /**
   * 根據 ID 查找插件
   */
  async findById(id) {
    try {
      const query = 'SELECT * FROM plugins WHERE id = ?';
      return new Promise((resolve, reject) => {
        this.db.get(query, [id], (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        });
      });
    } catch (error) {
      this.logger.error('查找插件失敗:', error);
      throw error;
    }
  }

  /**
   * 根據名稱查找插件
   */
  async findByName(name) {
    try {
      const query = 'SELECT * FROM plugins WHERE name = ?';
      return new Promise((resolve, reject) => {
        this.db.get(query, [name], (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        });
      });
    } catch (error) {
      this.logger.error('查找插件失敗:', error);
      throw error;
    }
  }

  /**
   * 安裝新插件
   */
  async install(pluginData) {
    try {
      const { name, version, config } = pluginData;
      const query = 'INSERT INTO plugins (name, version, config, is_installed) VALUES (?, ?, ?, 1)';
      return new Promise((resolve, reject) => {
        this.db.run(query, [name, version, JSON.stringify(config)], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, changes: this.changes });
          }
        });
      });
    } catch (error) {
      this.logger.error('安裝插件失敗:', error);
      throw error;
    }
  }

  /**
   * 更新插件設定
   */
  async updateConfig(id, config) {
    try {
      const query = 'UPDATE plugins SET config = ? WHERE id = ?';
      return new Promise((resolve, reject) => {
        this.db.run(query, [JSON.stringify(config), id], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ changes: this.changes });
          }
        });
      });
    } catch (error) {
      this.logger.error('更新插件設定失敗:', error);
      throw error;
    }
  }

  /**
   * 移除插件
   */
  async uninstall(id) {
    try {
      const query = 'UPDATE plugins SET is_installed = 0 WHERE id = ?';
      return new Promise((resolve, reject) => {
        this.db.run(query, [id], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ changes: this.changes });
          }
        });
      });
    } catch (error) {
      this.logger.error('移除插件失敗:', error);
      throw error;
    }
  }
}

module.exports = PluginRepository; 