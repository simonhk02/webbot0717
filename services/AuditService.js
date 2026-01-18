/**
 * 安全審計日誌服務
 * 實現安全事件的記錄、查詢和分析功能
 */

const { businessLogger } = require('../utils/logger');
const { encryptionService } = require('../utils/encryption');

class AuditService {
  constructor(container) {
    this.container = container;
    this.logger = businessLogger;
    this.database = null;
    
    // 嘗試從容器獲取數據庫服務
    try {
      this.database = container.resolve('databaseService');
    } catch (error) {
      this.logger.warn('DatabaseService 未註冊，使用內存存儲');
      this.auditLogs = new Map();
    }
    
    // 審計事件類型
    this.eventTypes = {
      // 認證相關
      AUTH_LOGIN: 'auth_login',
      AUTH_LOGOUT: 'auth_logout',
      AUTH_FAILED: 'auth_failed',
      AUTH_PASSWORD_CHANGE: 'auth_password_change',
      AUTH_TOKEN_REFRESH: 'auth_token_refresh',
      
      // 用戶管理
      USER_CREATE: 'user_create',
      USER_UPDATE: 'user_update',
      USER_DELETE: 'user_delete',
      USER_STATUS_CHANGE: 'user_status_change',
      
      // 權限相關
      PERMISSION_GRANT: 'permission_grant',
      PERMISSION_REVOKE: 'permission_revoke',
      ROLE_ASSIGN: 'role_assign',
      ROLE_REMOVE: 'role_remove',
      
      // 數據訪問
      DATA_READ: 'data_read',
      DATA_WRITE: 'data_write',
      DATA_DELETE: 'data_delete',
      DATA_EXPORT: 'data_export',
      
      // 系統操作
      SYSTEM_CONFIG_CHANGE: 'system_config_change',
      SYSTEM_BACKUP: 'system_backup',
      SYSTEM_RESTORE: 'system_restore',
      
      // 安全事件
      SECURITY_ALERT: 'security_alert',
      SUSPICIOUS_ACTIVITY: 'suspicious_activity',
      BRUTE_FORCE_ATTEMPT: 'brute_force_attempt',
      UNAUTHORIZED_ACCESS: 'unauthorized_access',
      
      // API 訪問
      API_ACCESS: 'api_access',
      API_RATE_LIMIT: 'api_rate_limit',
      API_ERROR: 'api_error'
    };
    
    // 風險等級
    this.riskLevels = {
      LOW: 'low',
      MEDIUM: 'medium',
      HIGH: 'high',
      CRITICAL: 'critical'
    };
  }

  /**
   * 記錄審計事件
   * @param {Object} event - 審計事件
   */
  async logEvent(event) {
    try {
      const auditEvent = {
        id: this.generateEventId(),
        timestamp: new Date().toISOString(),
        eventType: event.eventType,
        userId: event.userId || 'system',
        tenantId: event.tenantId || 'system',
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        action: event.action,
        resource: event.resource,
        details: event.details || {},
        riskLevel: event.riskLevel || this.riskLevels.LOW,
        status: event.status || 'success',
        metadata: {
          sessionId: event.sessionId,
          requestId: event.requestId,
          correlationId: event.correlationId
        }
      };

      // 加密敏感信息
      if (auditEvent.details.password) {
        auditEvent.details.password = '[REDACTED]';
      }
      if (auditEvent.details.token) {
        auditEvent.details.token = '[REDACTED]';
      }

      if (this.database) {
        // 使用數據庫存儲
        await this.database.query(
          `INSERT INTO audit_logs (
            id, timestamp, event_type, user_id, tenant_id, ip_address, 
            user_agent, action, resource, details, risk_level, status, metadata
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            auditEvent.id,
            auditEvent.timestamp,
            auditEvent.eventType,
            auditEvent.userId,
            auditEvent.tenantId,
            auditEvent.ipAddress,
            auditEvent.userAgent,
            auditEvent.action,
            auditEvent.resource,
            JSON.stringify(auditEvent.details),
            auditEvent.riskLevel,
            auditEvent.status,
            JSON.stringify(auditEvent.metadata)
          ]
        );
      } else {
        // 使用內存存儲
        this.auditLogs.set(auditEvent.id, auditEvent);
      }

      // 記錄到日誌系統
      this.logger.info('審計事件記錄', {
        eventId: auditEvent.id,
        eventType: auditEvent.eventType,
        userId: auditEvent.userId,
        action: auditEvent.action,
        riskLevel: auditEvent.riskLevel
      });

      // 檢查是否需要觸發安全警報
      if (auditEvent.riskLevel === this.riskLevels.HIGH || 
          auditEvent.riskLevel === this.riskLevels.CRITICAL) {
        await this.triggerSecurityAlert(auditEvent);
      }

      return auditEvent;
    } catch (error) {
      this.logger.error('審計事件記錄失敗', {
        error: error.message,
        event: event
      });
      throw error;
    }
  }

  /**
   * 記錄登入事件
   */
  async logLogin(userId, tenantId, ipAddress, userAgent, status = 'success', details = {}) {
    return await this.logEvent({
      eventType: this.eventTypes.AUTH_LOGIN,
      userId,
      tenantId,
      ipAddress,
      userAgent,
      action: 'login',
      resource: 'auth',
      details,
      riskLevel: status === 'success' ? this.riskLevels.LOW : this.riskLevels.MEDIUM,
      status
    });
  }

  /**
   * 記錄登出事件
   */
  async logLogout(userId, tenantId, ipAddress, userAgent, details = {}) {
    return await this.logEvent({
      eventType: this.eventTypes.AUTH_LOGOUT,
      userId,
      tenantId,
      ipAddress,
      userAgent,
      action: 'logout',
      resource: 'auth',
      details,
      riskLevel: this.riskLevels.LOW,
      status: 'success'
    });
  }

  /**
   * 記錄失敗的認證嘗試
   */
  async logAuthFailure(userId, tenantId, ipAddress, userAgent, reason, details = {}) {
    return await this.logEvent({
      eventType: this.eventTypes.AUTH_FAILED,
      userId: userId || 'unknown',
      tenantId,
      ipAddress,
      userAgent,
      action: 'login_attempt',
      resource: 'auth',
      details: { ...details, reason },
      riskLevel: this.riskLevels.MEDIUM,
      status: 'failed'
    });
  }

  /**
   * 記錄密碼修改事件
   */
  async logPasswordChange(userId, tenantId, ipAddress, userAgent, details = {}) {
    return await this.logEvent({
      eventType: this.eventTypes.AUTH_PASSWORD_CHANGE,
      userId,
      tenantId,
      ipAddress,
      userAgent,
      action: 'password_change',
      resource: 'user',
      details,
      riskLevel: this.riskLevels.MEDIUM,
      status: 'success'
    });
  }

  /**
   * 記錄數據訪問事件
   */
  async logDataAccess(userId, tenantId, action, resource, ipAddress, userAgent, details = {}) {
    return await this.logEvent({
      eventType: this.eventTypes.DATA_READ,
      userId,
      tenantId,
      ipAddress,
      userAgent,
      action,
      resource,
      details,
      riskLevel: this.riskLevels.LOW,
      status: 'success'
    });
  }

  /**
   * 記錄可疑活動
   */
  async logSuspiciousActivity(userId, tenantId, ipAddress, userAgent, activity, details = {}) {
    return await this.logEvent({
      eventType: this.eventTypes.SUSPICIOUS_ACTIVITY,
      userId: userId || 'unknown',
      tenantId,
      ipAddress,
      userAgent,
      action: 'suspicious_activity',
      resource: 'system',
      details: { ...details, activity },
      riskLevel: this.riskLevels.HIGH,
      status: 'warning'
    });
  }

  /**
   * 記錄未授權訪問
   */
  async logUnauthorizedAccess(userId, tenantId, ipAddress, userAgent, resource, details = {}) {
    return await this.logEvent({
      eventType: this.eventTypes.UNAUTHORIZED_ACCESS,
      userId: userId || 'unknown',
      tenantId,
      ipAddress,
      userAgent,
      action: 'unauthorized_access',
      resource,
      details,
      riskLevel: this.riskLevels.HIGH,
      status: 'failed'
    });
  }

  /**
   * 查詢審計日誌
   */
  async queryAuditLogs(filters = {}, options = {}) {
    try {
      const {
        startDate,
        endDate,
        eventType,
        userId,
        tenantId,
        riskLevel,
        status,
        limit = 100,
        offset = 0
      } = filters;

      const {
        sortBy = 'timestamp',
        sortOrder = 'DESC'
      } = options;

      if (this.database) {
        // 構建查詢條件
        let whereClause = 'WHERE 1=1';
        const params = [];

        if (startDate) {
          whereClause += ' AND timestamp >= ?';
          params.push(startDate);
        }

        if (endDate) {
          whereClause += ' AND timestamp <= ?';
          params.push(endDate);
        }

        if (eventType) {
          whereClause += ' AND event_type = ?';
          params.push(eventType);
        }

        if (userId) {
          whereClause += ' AND user_id = ?';
          params.push(userId);
        }

        if (tenantId) {
          whereClause += ' AND tenant_id = ?';
          params.push(tenantId);
        }

        if (riskLevel) {
          whereClause += ' AND risk_level = ?';
          params.push(riskLevel);
        }

        if (status) {
          whereClause += ' AND status = ?';
          params.push(status);
        }

        // 執行查詢
        const query = `
          SELECT * FROM audit_logs 
          ${whereClause}
          ORDER BY ${sortBy} ${sortOrder}
          LIMIT ? OFFSET ?
        `;

        params.push(limit, offset);

        const results = await this.database.query(query, params);

        // 解析 JSON 字段
        return results.map(row => ({
          ...row,
          details: JSON.parse(row.details || '{}'),
          metadata: JSON.parse(row.metadata || '{}')
        }));
      } else {
        // 使用內存存儲查詢
        let logs = Array.from(this.auditLogs.values());

        // 應用過濾器
        if (startDate) {
          logs = logs.filter(log => log.timestamp >= startDate);
        }

        if (endDate) {
          logs = logs.filter(log => log.timestamp <= endDate);
        }

        if (eventType) {
          logs = logs.filter(log => log.eventType === eventType);
        }

        if (userId) {
          logs = logs.filter(log => log.userId === userId);
        }

        if (tenantId) {
          logs = logs.filter(log => log.tenantId === tenantId);
        }

        if (riskLevel) {
          logs = logs.filter(log => log.riskLevel === riskLevel);
        }

        if (status) {
          logs = logs.filter(log => log.status === status);
        }

        // 排序
        logs.sort((a, b) => {
          const aValue = a[sortBy];
          const bValue = b[sortBy];
          
          if (sortOrder === 'ASC') {
            return aValue > bValue ? 1 : -1;
          } else {
            return aValue < bValue ? 1 : -1;
          }
        });

        // 分頁
        return logs.slice(offset, offset + limit);
      }
    } catch (error) {
      this.logger.error('查詢審計日誌失敗', {
        error: error.message,
        filters
      });
      throw error;
    }
  }

  /**
   * 獲取審計統計信息
   */
  async getAuditStats(filters = {}) {
    try {
      const logs = await this.queryAuditLogs(filters, { limit: 10000 });

      const stats = {
        totalEvents: logs.length,
        eventsByType: {},
        eventsByRiskLevel: {},
        eventsByStatus: {},
        eventsByUser: {},
        eventsByTenant: {},
        recentActivity: logs.slice(0, 10)
      };

      // 統計事件類型
      logs.forEach(log => {
        stats.eventsByType[log.eventType] = (stats.eventsByType[log.eventType] || 0) + 1;
        stats.eventsByRiskLevel[log.riskLevel] = (stats.eventsByRiskLevel[log.riskLevel] || 0) + 1;
        stats.eventsByStatus[log.status] = (stats.eventsByStatus[log.status] || 0) + 1;
        stats.eventsByUser[log.userId] = (stats.eventsByUser[log.userId] || 0) + 1;
        stats.eventsByTenant[log.tenantId] = (stats.eventsByTenant[log.tenantId] || 0) + 1;
      });

      return stats;
    } catch (error) {
      this.logger.error('獲取審計統計失敗', {
        error: error.message,
        filters
      });
      throw error;
    }
  }

  /**
   * 觸發安全警報
   */
  async triggerSecurityAlert(auditEvent) {
    try {
      this.logger.warn('安全警報觸發', {
        eventId: auditEvent.id,
        eventType: auditEvent.eventType,
        userId: auditEvent.userId,
        riskLevel: auditEvent.riskLevel,
        action: auditEvent.action,
        resource: auditEvent.resource
      });

      // 這裡可以實現發送郵件、短信、Slack 通知等
      // 暫時記錄到日誌中
      
      return true;
    } catch (error) {
      this.logger.error('安全警報觸發失敗', {
        error: error.message,
        auditEvent
      });
      return false;
    }
  }

  /**
   * 生成事件ID
   */
  generateEventId() {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 清理舊的審計日誌
   */
  async cleanupOldLogs(retentionDays = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      if (this.database) {
        await this.database.query(
          'DELETE FROM audit_logs WHERE timestamp < ?',
          [cutoffDate.toISOString()]
        );
      } else {
        // 清理內存存儲
        for (const [id, log] of this.auditLogs.entries()) {
          if (new Date(log.timestamp) < cutoffDate) {
            this.auditLogs.delete(id);
          }
        }
      }

      this.logger.info('審計日誌清理完成', {
        retentionDays,
        cutoffDate: cutoffDate.toISOString()
      });
    } catch (error) {
      this.logger.error('審計日誌清理失敗', {
        error: error.message,
        retentionDays
      });
      throw error;
    }
  }
}

module.exports = AuditService; 