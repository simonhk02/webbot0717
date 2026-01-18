/**
 * 數據庫遷移執行器
 * 安全地執行數據庫結構改造
 */

const fs = require('fs');
const path = require('path');
const { businessLogger } = require('./logger');

class DatabaseMigration {
  constructor(database) {
    this.database = database;
    this.logger = businessLogger;
    this.migrationsPath = path.join(__dirname, '../migrations');
  }

  /**
   * 執行所有待執行的遷移
   * @returns {Promise<void>}
   */
  async runMigrations() {
    try {
      this.logger.info('開始執行數據庫遷移');

      // 創建遷移記錄表
      await this.createMigrationsTable();

      // 獲取已執行的遷移
      const executedMigrations = await this.getExecutedMigrations();

      // 獲取所有遷移文件
      const migrationFiles = await this.getMigrationFiles();

      // 執行待執行的遷移
      for (const file of migrationFiles) {
        if (!executedMigrations.includes(file)) {
          await this.executeMigration(file);
        }
      }

      this.logger.info('數據庫遷移完成');
    } catch (error) {
      this.logger.error('數據庫遷移失敗', { error: error.message });
      throw error;
    }
  }

  /**
   * 創建遷移記錄表
   * @returns {Promise<void>}
   */
  async createMigrationsTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT UNIQUE NOT NULL,
        executed_at TEXT DEFAULT (datetime('now')),
        checksum TEXT,
        status TEXT DEFAULT 'success'
      )
    `;

    await this.database.run(sql);
  }

  /**
   * 獲取已執行的遷移
   * @returns {Promise<Array>}
   */
  async getExecutedMigrations() {
    const result = await this.database.all('SELECT filename FROM migrations WHERE status = "success"');
    return result.map(row => row.filename);
  }

  /**
   * 獲取所有遷移文件
   * @returns {Promise<Array>}
   */
  async getMigrationFiles() {
    try {
      const files = fs.readdirSync(this.migrationsPath);
      return files
        .filter(file => file.endsWith('.sql'))
        .sort(); // 按文件名排序
    } catch (error) {
      this.logger.warn('遷移目錄不存在，跳過遷移', { path: this.migrationsPath });
      return [];
    }
  }

  /**
   * 執行單個遷移
   * @param {string} filename - 遷移文件名
   * @returns {Promise<void>}
   */
  async executeMigration(filename) {
    try {
      this.logger.info('執行遷移', { filename });

      const filePath = path.join(this.migrationsPath, filename);
      const sql = fs.readFileSync(filePath, 'utf8');

      // 計算文件校驗和
      const checksum = this.calculateChecksum(sql);

      // 開始事務
      await this.database.run('BEGIN TRANSACTION');

      try {
        // 執行SQL語句
        const statements = sql.split(';').filter(stmt => stmt.trim());
        
        for (const statement of statements) {
          if (statement.trim()) {
            await this.database.run(statement);
          }
        }

        // 記錄遷移執行
        await this.database.run(
          'INSERT INTO migrations (filename, checksum, status) VALUES (?, ?, ?)',
          [filename, checksum, 'success']
        );

        // 提交事務
        await this.database.run('COMMIT');

        this.logger.info('遷移執行成功', { filename });
      } catch (error) {
        // 回滾事務
        await this.database.run('ROLLBACK');

        // 記錄失敗的遷移
        await this.database.run(
          'INSERT INTO migrations (filename, checksum, status) VALUES (?, ?, ?)',
          [filename, checksum, 'failed']
        );

        throw error;
      }
    } catch (error) {
      this.logger.error('遷移執行失敗', { 
        filename, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * 計算文件校驗和
   * @param {string} content - 文件內容
   * @returns {string} 校驗和
   */
  calculateChecksum(content) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * 回滾最後一次遷移
   * @returns {Promise<void>}
   */
  async rollbackLastMigration() {
    try {
      this.logger.info('開始回滾最後一次遷移');

      // 獲取最後一次成功的遷移
      const result = await this.database.get(
        'SELECT filename FROM migrations WHERE status = "success" ORDER BY executed_at DESC LIMIT 1'
      );

      if (!result) {
        this.logger.warn('沒有可回滾的遷移');
        return;
      }

      const filename = result.filename;
      this.logger.info('回滾遷移', { filename });

      // 這裡應該實現具體的回滾邏輯
      // 由於SQLite的ALTER TABLE限制，回滾可能需要手動處理

      // 標記遷移為已回滾
      await this.database.run(
        'UPDATE migrations SET status = "rolled_back" WHERE filename = ?',
        [filename]
      );

      this.logger.info('遷移回滾完成', { filename });
    } catch (error) {
      this.logger.error('遷移回滾失敗', { error: error.message });
      throw error;
    }
  }

  /**
   * 獲取遷移狀態
   * @returns {Promise<Object>}
   */
  async getMigrationStatus() {
    try {
      const migrations = await this.database.all(`
        SELECT filename, executed_at, status, checksum 
        FROM migrations 
        ORDER BY executed_at DESC
      `);

      const pendingFiles = await this.getMigrationFiles();
      const executedFiles = migrations.map(m => m.filename);
      const pendingMigrations = pendingFiles.filter(file => !executedFiles.includes(file));

      return {
        total: pendingFiles.length,
        executed: migrations.length,
        pending: pendingMigrations.length,
        migrations: migrations,
        pendingFiles: pendingMigrations
      };
    } catch (error) {
      this.logger.error('獲取遷移狀態失敗', { error: error.message });
      throw error;
    }
  }

  /**
   * 驗證數據庫結構
   * @returns {Promise<Object>}
   */
  async validateDatabaseStructure() {
    try {
      this.logger.info('開始驗證數據庫結構');

      const requiredTables = [
        'users', 'settings', 'messages', 'sessions', 
        'logs', 'audit_logs', 'tenants', 'tenant_configs', 'tenant_usage'
      ];

      const validationResults = {};

      for (const table of requiredTables) {
        try {
          const result = await this.database.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table]);
          validationResults[table] = {
            exists: !!result,
            hasTenantId: false
          };

          if (result) {
            // 檢查是否有 tenantId 欄位 - 修復 SQLite 兼容性問題
            const columns = await this.database.all(`PRAGMA table_info(${table})`);
            const hasTenantId = columns && Array.isArray(columns) && columns.some(col => col.name === 'tenantId');
            validationResults[table].hasTenantId = hasTenantId;
          }
        } catch (error) {
          validationResults[table] = {
            exists: false,
            hasTenantId: false,
            error: error.message
          };
        }
      }

      const summary = {
        totalTables: requiredTables.length,
        existingTables: Object.values(validationResults).filter(r => r.exists).length,
        tablesWithTenantId: Object.values(validationResults).filter(r => r.hasTenantId).length,
        validationResults
      };

      this.logger.info('數據庫結構驗證完成', summary);

      return summary;
    } catch (error) {
      this.logger.error('數據庫結構驗證失敗', { error: error.message });
      throw error;
    }
  }
}

module.exports = DatabaseMigration; 