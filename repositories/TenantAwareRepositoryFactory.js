/**
 * 租戶感知的 Repository 工廠
 * 統一管理所有 Repository 實例
 */

const { businessLogger } = require('../utils/logger');
const TenantAwareRepository = require('../core/context/TenantAwareRepository');

class TenantAwareRepositoryFactory {
  constructor() {
    this.logger = businessLogger;
    this.repositories = new Map(); // tenantId -> Map<repositoryType, repository>
    this.database = null;
  }

  /**
   * 初始化工廠
   * @param {Object} database - 數據庫實例
   */
  initialize(database) {
    this.database = database;
    this.logger.info('租戶感知 Repository 工廠已初始化');
  }

  /**
   * 獲取租戶的 Repository
   * @param {string} tenantId - 租戶ID
   * @param {string} repositoryType - Repository類型
   * @param {Object} tenantContext - 租戶上下文
   * @returns {Object} Repository實例
   */
  getRepository(tenantId, repositoryType, tenantContext) {
    try {
      if (!this.database) {
        throw new Error('Repository 工廠未初始化');
      }

      // 獲取或創建租戶的 Repository 容器
      if (!this.repositories.has(tenantId)) {
        this.repositories.set(tenantId, new Map());
      }

      const tenantRepositories = this.repositories.get(tenantId);

      // 獲取或創建特定類型的 Repository
      if (!tenantRepositories.has(repositoryType)) {
        const repository = new TenantAwareRepository(this.database, tenantContext);
        tenantRepositories.set(repositoryType, repository);

        this.logger.info('創建新的 Repository 實例', {
          tenantId,
          repositoryType
        });
      }

      return tenantRepositories.get(repositoryType);
    } catch (error) {
      this.logger.error('獲取 Repository 失敗', {
        tenantId,
        repositoryType,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 獲取用戶 Repository
   * @param {string} tenantId - 租戶ID
   * @param {Object} tenantContext - 租戶上下文
   * @returns {Object} 用戶 Repository
   */
  getUserRepository(tenantId, tenantContext) {
    return this.getRepository(tenantId, 'user', tenantContext);
  }

  /**
   * 獲取設置 Repository
   * @param {string} tenantId - 租戶ID
   * @param {Object} tenantContext - 租戶上下文
   * @returns {Object} 設置 Repository
   */
  getSettingsRepository(tenantId, tenantContext) {
    return this.getRepository(tenantId, 'settings', tenantContext);
  }

  /**
   * 獲取消息 Repository
   * @param {string} tenantId - 租戶ID
   * @param {Object} tenantContext - 租戶上下文
   * @returns {Object} 消息 Repository
   */
  getMessageRepository(tenantId, tenantContext) {
    return this.getRepository(tenantId, 'message', tenantContext);
  }

  /**
   * 獲取會話 Repository
   * @param {string} tenantId - 租戶ID
   * @param {Object} tenantContext - 租戶上下文
   * @returns {Object} 會話 Repository
   */
  getSessionRepository(tenantId, tenantContext) {
    return this.getRepository(tenantId, 'session', tenantContext);
  }

  /**
   * 獲取日誌 Repository
   * @param {string} tenantId - 租戶ID
   * @param {Object} tenantContext - 租戶上下文
   * @returns {Object} 日誌 Repository
   */
  getLogRepository(tenantId, tenantContext) {
    return this.getRepository(tenantId, 'log', tenantContext);
  }

  /**
   * 獲取審計 Repository
   * @param {string} tenantId - 租戶ID
   * @param {Object} tenantContext - 租戶上下文
   * @returns {Object} 審計 Repository
   */
  getAuditRepository(tenantId, tenantContext) {
    return this.getRepository(tenantId, 'audit', tenantContext);
  }

  /**
   * 清理租戶的 Repository
   * @param {string} tenantId - 租戶ID
   */
  cleanupTenant(tenantId) {
    try {
      if (this.repositories.has(tenantId)) {
        this.repositories.delete(tenantId);
        this.logger.info('清理租戶 Repository', { tenantId });
      }
    } catch (error) {
      this.logger.error('清理租戶 Repository 失敗', {
        tenantId,
        error: error.message
      });
    }
  }

  /**
   * 獲取所有租戶的 Repository 統計
   * @returns {Object} 統計信息
   */
  getRepositoryStats() {
    const stats = {
      totalTenants: this.repositories.size,
      totalRepositories: 0,
      tenantDetails: []
    };

    for (const [tenantId, tenantRepositories] of this.repositories.entries()) {
      const tenantStats = {
        tenantId,
        repositoryCount: tenantRepositories.size,
        repositoryTypes: Array.from(tenantRepositories.keys())
      };

      stats.totalRepositories += tenantRepositories.size;
      stats.tenantDetails.push(tenantStats);
    }

    return stats;
  }

  /**
   * 驗證租戶隔離
   * @param {string} tenantId1 - 租戶1
   * @param {string} tenantId2 - 租戶2
   * @returns {boolean} 是否隔離
   */
  validateTenantIsolation(tenantId1, tenantId2) {
    try {
      const tenant1Repositories = this.repositories.get(tenantId1);
      const tenant2Repositories = this.repositories.get(tenantId2);

      if (!tenant1Repositories || !tenant2Repositories) {
        return false;
      }

      // 檢查 Repository 實例是否不同
      for (const repositoryType of ['user', 'settings', 'message', 'session']) {
        const repo1 = tenant1Repositories.get(repositoryType);
        const repo2 = tenant2Repositories.get(repositoryType);

        if (repo1 && repo2 && repo1 === repo2) {
          this.logger.warn('發現 Repository 實例共享', {
            tenantId1,
            tenantId2,
            repositoryType
          });
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.error('租戶隔離驗證失敗', {
        tenantId1,
        tenantId2,
        error: error.message
      });
      return false;
    }
  }
}

// 創建單例實例
const repositoryFactory = new TenantAwareRepositoryFactory();

module.exports = repositoryFactory;
module.exports.TenantAwareRepositoryFactory = TenantAwareRepositoryFactory; 