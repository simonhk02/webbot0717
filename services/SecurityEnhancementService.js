/**
 * 安全增強服務
 * 實現惡意訪問防護、異常檢測、訪問控制等安全功能
 */

const { businessLogger } = require('../utils/logger');

class SecurityEnhancementService {
  constructor(container) {
    this.container = container;
    this.logger = businessLogger;
    this.auditService = null;
    this.tenantContextManager = null;
    
    // 嘗試從容器獲取相關服務
    try {
      this.auditService = container.resolve('auditService');
    } catch (error) {
      this.logger.warn('AuditService 未註冊，跳過審計功能');
    }
    
    try {
      this.tenantContextManager = container.resolve('tenantContextManager');
    } catch (error) {
      this.logger.warn('TenantContextManager 未註冊，跳過租戶驗證');
    }
    
    // 安全配置
    this.securityConfig = {
      // 訪問頻率限制
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15分鐘
        maxRequests: 100, // 最大請求數
        blockDuration: 30 * 60 * 1000 // 封鎖30分鐘
      },
      
      // 異常檢測閾值
      anomalyThresholds: {
        failedLoginAttempts: 5, // 失敗登入次數
        suspiciousPatterns: 3, // 可疑模式次數
        crossTenantAttempts: 2, // 跨租戶嘗試次數
        sqlInjectionAttempts: 1 // SQL注入嘗試次數
      },
      
      // 安全規則
      securityRules: {
        requireTenantValidation: true,
        requirePermissionCheck: true,
        requireAuditLogging: true,
        blockSuspiciousIPs: true,
        validateInputData: true
      }
    };
    
    // 內存存儲（生產環境應使用Redis）
    this.accessCounters = new Map(); // IP訪問計數器
    this.blockedIPs = new Map(); // 被封鎖的IP
    this.suspiciousActivities = new Map(); // 可疑活動記錄
    this.failedLoginAttempts = new Map(); // 失敗登入記錄
    
    // 啟動清理任務
    this.startCleanupTask();
  }
  
  /**
   * 驗證租戶身份
   * @param {string} tenantId - 租戶ID
   * @param {string} userId - 用戶ID
   * @param {string} ipAddress - IP地址
   * @param {string} userAgent - 用戶代理
   * @returns {Promise<Object>} 驗證結果
   */
  async validateTenantIdentity(tenantId, userId, ipAddress, userAgent) {
    try {
      this.logger.info('開始租戶身份驗證', { tenantId, userId, ipAddress });
      
      // 檢查IP是否被封鎖
      if (this.isIPBlocked(ipAddress)) {
        await this.logSecurityEvent('IP_BLOCKED', {
          tenantId,
          userId,
          ipAddress,
          userAgent,
          reason: 'IP已被封鎖'
        });
        return {
          valid: false,
          reason: 'IP已被封鎖',
          blocked: true
        };
      }
      
      // 檢查訪問頻率
      if (this.isRateLimitExceeded(ipAddress)) {
        await this.blockIP(ipAddress, '訪問頻率過高');
        return {
          valid: false,
          reason: '訪問頻率過高',
          rateLimited: true
        };
      }
      
      // 驗證租戶上下文
      if (this.tenantContextManager) {
        const tenantExists = this.tenantContextManager.hasTenant(tenantId);
        if (!tenantExists) {
          await this.logSecurityEvent('INVALID_TENANT', {
            tenantId,
            userId,
            ipAddress,
            userAgent,
            reason: '租戶不存在'
          });
          return {
            valid: false,
            reason: '租戶不存在',
            invalidTenant: true
          };
        }
        
        // 檢查用戶是否屬於該租戶
        const userContext = this.tenantContextManager.getUserContext(tenantId, userId);
        if (!userContext) {
          await this.logSecurityEvent('UNAUTHORIZED_USER', {
            tenantId,
            userId,
            ipAddress,
            userAgent,
            reason: '用戶不屬於該租戶'
          });
          return {
            valid: false,
            reason: '用戶不屬於該租戶',
            unauthorizedUser: true
          };
        }
      }
      
      // 記錄成功訪問
      this.recordAccess(ipAddress);
      
      this.logger.info('租戶身份驗證成功', { tenantId, userId });
      return {
        valid: true,
        tenantId,
        userId
      };
      
    } catch (error) {
      this.logger.error('租戶身份驗證失敗', {
        error: error.message,
        tenantId,
        userId,
        ipAddress
      });
      return {
        valid: false,
        reason: '驗證過程發生錯誤',
        error: error.message
      };
    }
  }
  
  /**
   * 檢測異常訪問模式
   * @param {string} tenantId - 租戶ID
   * @param {string} userId - 用戶ID
   * @param {string} ipAddress - IP地址
   * @param {string} action - 操作類型
   * @param {Object} details - 詳細信息
   * @returns {Promise<Object>} 檢測結果
   */
  async detectAnomaly(tenantId, userId, ipAddress, action, details = {}) {
    try {
      let anomalyScore = 0;
      const anomalies = [];
      
      // 檢測1: 跨租戶訪問嘗試
      if (details.crossTenantAttempt) {
        anomalyScore += 10;
        anomalies.push('跨租戶訪問嘗試');
      }
      
      // 檢測2: SQL注入嘗試
      if (details.sqlInjectionAttempt) {
        anomalyScore += 20;
        anomalies.push('SQL注入嘗試');
        await this.blockIP(ipAddress, 'SQL注入攻擊');
      }
      
      // 檢測3: 權限越界嘗試
      if (details.permissionEscalation) {
        anomalyScore += 15;
        anomalies.push('權限越界嘗試');
      }
      
      // 檢測4: 異常時間訪問
      if (details.anomalousTime) {
        anomalyScore += 5;
        anomalies.push('異常時間訪問');
      }
      
      // 檢測5: 可疑用戶代理
      if (details.suspiciousUserAgent) {
        anomalyScore += 8;
        anomalies.push('可疑用戶代理');
      }
      
      // 檢測6: 失敗登入次數過多
      const failedLogins = this.getFailedLoginCount(ipAddress);
      if (failedLogins >= this.securityConfig.anomalyThresholds.failedLoginAttempts) {
        anomalyScore += 12;
        anomalies.push('失敗登入次數過多');
      }
      
      // 判斷是否為異常
      const isAnomaly = anomalyScore >= 10;
      
      if (isAnomaly) {
        await this.logSecurityEvent('ANOMALY_DETECTED', {
          tenantId,
          userId,
          ipAddress,
          action,
          anomalyScore,
          anomalies,
          details
        });
        
        // 如果異常分數很高，考慮封鎖IP
        if (anomalyScore >= 20) {
          await this.blockIP(ipAddress, `異常分數過高: ${anomalyScore}`);
        }
      }
      
      return {
        isAnomaly,
        anomalyScore,
        anomalies,
        threshold: 10
      };
      
    } catch (error) {
      this.logger.error('異常檢測失敗', {
        error: error.message,
        tenantId,
        userId,
        ipAddress
      });
      return {
        isAnomaly: false,
        anomalyScore: 0,
        anomalies: [],
        error: error.message
      };
    }
  }
  
  /**
   * 驗證輸入數據安全性
   * @param {Object} data - 輸入數據
   * @param {string} dataType - 數據類型
   * @returns {Object} 驗證結果
   */
  validateInputSecurity(data, dataType = 'general') {
    try {
      const validationResult = {
        valid: true,
        sanitized: data,
        warnings: []
      };
      
      // 檢查SQL注入模式
      const sqlInjectionPatterns = [
        /(\b(union|select|insert|update|delete|drop|create|alter)\b)/i,
        /(['"];?\s*--)/,
        /(['"]\s*or\s*['"]?\s*1\s*=\s*1)/i,
        /(['"]\s*and\s*['"]?\s*1\s*=\s*1)/i,
        /(\bxp_cmdshell\b)/i,
        /(\bexec\b)/i
      ];
      
      const dataString = JSON.stringify(data);
      for (const pattern of sqlInjectionPatterns) {
        if (pattern.test(dataString)) {
          validationResult.valid = false;
          validationResult.warnings.push('檢測到SQL注入模式');
          break;
        }
      }
      
      // 檢查XSS模式
      const xssPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi
      ];
      
      for (const pattern of xssPatterns) {
        if (pattern.test(dataString)) {
          validationResult.valid = false;
          validationResult.warnings.push('檢測到XSS模式');
          break;
        }
      }
      
      // 檢查特殊字符
      const dangerousChars = ['<', '>', '"', "'", '&', ';', '--', '/*', '*/'];
      for (const char of dangerousChars) {
        if (dataString.includes(char)) {
          validationResult.warnings.push(`包含特殊字符: ${char}`);
        }
      }
      
      // 數據清理（基本清理）
      if (validationResult.valid) {
        validationResult.sanitized = this.sanitizeData(data);
      }
      
      return validationResult;
      
    } catch (error) {
      this.logger.error('輸入安全驗證失敗', {
        error: error.message,
        dataType
      });
      return {
        valid: false,
        sanitized: null,
        warnings: ['驗證過程發生錯誤'],
        error: error.message
      };
    }
  }
  
  /**
   * 記錄安全事件
   * @param {string} eventType - 事件類型
   * @param {Object} eventData - 事件數據
   */
  async logSecurityEvent(eventType, eventData) {
    try {
      const securityEvent = {
        eventType,
        timestamp: new Date().toISOString(),
        ...eventData
      };
      
      // 記錄到審計服務
      if (this.auditService) {
        await this.auditService.logEvent({
          eventType: 'security_event',
          userId: eventData.userId || 'system',
          tenantId: eventData.tenantId || 'system',
          ipAddress: eventData.ipAddress,
          userAgent: eventData.userAgent,
          action: eventType,
          resource: 'security_system',
          details: eventData,
          riskLevel: 'high',
          status: 'warning'
        });
      }
      
      // 記錄到本地日誌
      this.logger.warn('安全事件記錄', securityEvent);
      
      // 存儲可疑活動
      this.recordSuspiciousActivity(eventData.ipAddress, eventType, eventData);
      
    } catch (error) {
      this.logger.error('安全事件記錄失敗', {
        error: error.message,
        eventType,
        eventData
      });
    }
  }
  
  /**
   * 封鎖IP地址
   * @param {string} ipAddress - IP地址
   * @param {string} reason - 封鎖原因
   */
  async blockIP(ipAddress, reason) {
    try {
      const blockInfo = {
        ipAddress,
        reason,
        blockedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + this.securityConfig.rateLimit.blockDuration).toISOString()
      };
      
      this.blockedIPs.set(ipAddress, blockInfo);
      
      this.logger.warn('IP地址已被封鎖', blockInfo);
      
      // 記錄安全事件
      await this.logSecurityEvent('IP_BLOCKED', {
        ipAddress,
        reason,
        blockedAt: blockInfo.blockedAt,
        expiresAt: blockInfo.expiresAt
      });
      
    } catch (error) {
      this.logger.error('IP封鎖失敗', {
        error: error.message,
        ipAddress,
        reason
      });
    }
  }
  
  /**
   * 檢查IP是否被封鎖
   * @param {string} ipAddress - IP地址
   * @returns {boolean} 是否被封鎖
   */
  isIPBlocked(ipAddress) {
    const blockInfo = this.blockedIPs.get(ipAddress);
    if (!blockInfo) {
      return false;
    }
    
    // 檢查是否過期
    if (new Date() > new Date(blockInfo.expiresAt)) {
      this.blockedIPs.delete(ipAddress);
      return false;
    }
    
    return true;
  }
  
  /**
   * 檢查訪問頻率限制
   * @param {string} ipAddress - IP地址
   * @returns {boolean} 是否超過限制
   */
  isRateLimitExceeded(ipAddress) {
    const counter = this.accessCounters.get(ipAddress);
    if (!counter) {
      return false;
    }
    
    const now = Date.now();
    const windowStart = now - this.securityConfig.rateLimit.windowMs;
    
    // 清理過期的訪問記錄
    counter.requests = counter.requests.filter(timestamp => timestamp > windowStart);
    
    return counter.requests.length >= this.securityConfig.rateLimit.maxRequests;
  }
  
  /**
   * 記錄訪問
   * @param {string} ipAddress - IP地址
   */
  recordAccess(ipAddress) {
    if (!this.accessCounters.has(ipAddress)) {
      this.accessCounters.set(ipAddress, {
        requests: [],
        firstAccess: Date.now()
      });
    }
    
    const counter = this.accessCounters.get(ipAddress);
    counter.requests.push(Date.now());
  }
  
  /**
   * 記錄失敗登入
   * @param {string} ipAddress - IP地址
   */
  recordFailedLogin(ipAddress) {
    if (!this.failedLoginAttempts.has(ipAddress)) {
      this.failedLoginAttempts.set(ipAddress, {
        count: 0,
        firstAttempt: Date.now(),
        lastAttempt: Date.now()
      });
    }
    
    const attempts = this.failedLoginAttempts.get(ipAddress);
    attempts.count++;
    attempts.lastAttempt = Date.now();
    
    // 如果失敗次數過多，考慮封鎖IP
    if (attempts.count >= this.securityConfig.anomalyThresholds.failedLoginAttempts) {
      this.blockIP(ipAddress, '失敗登入次數過多');
    }
  }
  
  /**
   * 獲取失敗登入次數
   * @param {string} ipAddress - IP地址
   * @returns {number} 失敗次數
   */
  getFailedLoginCount(ipAddress) {
    const attempts = this.failedLoginAttempts.get(ipAddress);
    return attempts ? attempts.count : 0;
  }
  
  /**
   * 記錄可疑活動
   * @param {string} ipAddress - IP地址
   * @param {string} activityType - 活動類型
   * @param {Object} details - 詳細信息
   */
  recordSuspiciousActivity(ipAddress, activityType, details) {
    if (!this.suspiciousActivities.has(ipAddress)) {
      this.suspiciousActivities.set(ipAddress, []);
    }
    
    const activities = this.suspiciousActivities.get(ipAddress);
    activities.push({
      type: activityType,
      timestamp: new Date().toISOString(),
      details
    });
    
    // 只保留最近100條記錄
    if (activities.length > 100) {
      activities.splice(0, activities.length - 100);
    }
  }
  
  /**
   * 數據清理
   * @param {Object} data - 原始數據
   * @returns {Object} 清理後的數據
   */
  sanitizeData(data) {
    if (typeof data === 'string') {
      return data
        .replace(/[<>]/g, '') // 移除尖括號
        .replace(/javascript:/gi, '') // 移除javascript協議
        .replace(/on\w+\s*=/gi, '') // 移除事件處理器
        .trim();
    }
    
    if (typeof data === 'object' && data !== null) {
      const sanitized = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeData(value);
      }
      return sanitized;
    }
    
    return data;
  }
  
  /**
   * 啟動清理任務
   */
  startCleanupTask() {
    setInterval(() => {
      this.cleanupExpiredData();
    }, 5 * 60 * 1000); // 每5分鐘清理一次
  }
  
  /**
   * 清理過期數據
   */
  cleanupExpiredData() {
    try {
      const now = Date.now();
      
      // 清理過期的IP封鎖
      for (const [ip, blockInfo] of this.blockedIPs.entries()) {
        if (new Date(blockInfo.expiresAt) < new Date()) {
          this.blockedIPs.delete(ip);
        }
      }
      
      // 清理過期的訪問計數器
      const windowStart = now - this.securityConfig.rateLimit.windowMs;
      for (const [ip, counter] of this.accessCounters.entries()) {
        counter.requests = counter.requests.filter(timestamp => timestamp > windowStart);
        if (counter.requests.length === 0) {
          this.accessCounters.delete(ip);
        }
      }
      
      // 清理過期的失敗登入記錄（保留1小時）
      const loginWindowStart = now - 60 * 60 * 1000;
      for (const [ip, attempts] of this.failedLoginAttempts.entries()) {
        if (attempts.lastAttempt < loginWindowStart) {
          this.failedLoginAttempts.delete(ip);
        }
      }
      
      this.logger.debug('安全數據清理完成', {
        blockedIPs: this.blockedIPs.size,
        accessCounters: this.accessCounters.size,
        failedLogins: this.failedLoginAttempts.size
      });
      
    } catch (error) {
      this.logger.error('安全數據清理失敗', {
        error: error.message
      });
    }
  }
  
  /**
   * 獲取安全統計信息
   * @returns {Object} 統計信息
   */
  getSecurityStats() {
    return {
      blockedIPs: this.blockedIPs.size,
      accessCounters: this.accessCounters.size,
      failedLogins: this.failedLoginAttempts.size,
      suspiciousActivities: this.suspiciousActivities.size,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = SecurityEnhancementService; 