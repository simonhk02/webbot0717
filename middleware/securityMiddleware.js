/**
 * 安全中間件
 * 集成SecurityEnhancementService到HTTP請求流程中
 */

const { businessLogger } = require('../utils/logger');

class SecurityMiddleware {
  constructor(container) {
    this.container = container;
    this.logger = businessLogger;
    this.securityService = null;
    
    // 嘗試從容器獲取安全服務
    try {
      this.securityService = container.resolve('securityEnhancementService');
    } catch (error) {
      this.logger.warn('SecurityEnhancementService 未註冊，跳過安全檢查');
    }
  }
  
  /**
   * 安全檢查中間件
   */
  securityCheck() {
    return async (req, res, next) => {
      try {
        if (!this.securityService) {
          return next();
        }
        
        const ipAddress = this.getClientIP(req);
        const userAgent = req.get('User-Agent') || '';
        const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId;
        const userId = req.user?.id || req.user?.userId;
        
        // 基本安全檢查
        const securityResult = await this.performSecurityCheck(req, ipAddress, userAgent, tenantId, userId);
        
        if (!securityResult.valid) {
          return res.status(securityResult.statusCode || 403).json({
            error: securityResult.reason,
            code: securityResult.code || 'SECURITY_VIOLATION',
            timestamp: new Date().toISOString()
          });
        }
        
        // 添加安全信息到請求對象
        req.securityInfo = securityResult;
        
        next();
      } catch (error) {
        this.logger.error('安全檢查失敗', {
          error: error.message,
          path: req.path,
          method: req.method
        });
        
        // 安全檢查失敗時，拒絕請求
        return res.status(500).json({
          error: '安全檢查失敗',
          code: 'SECURITY_CHECK_ERROR'
        });
      }
    };
  }
  
  /**
   * 執行安全檢查
   */
  async performSecurityCheck(req, ipAddress, userAgent, tenantId, userId) {
    try {
      // 檢查1: 輸入數據安全驗證
      const inputValidation = this.validateRequestInput(req);
      if (!inputValidation.valid) {
        return {
          valid: false,
          reason: '輸入數據包含安全風險',
          code: 'INPUT_SECURITY_VIOLATION',
          statusCode: 400,
          details: inputValidation.warnings
        };
      }
      
      // 檢查2: 租戶身份驗證
      if (tenantId && userId) {
        const tenantValidation = await this.securityService.validateTenantIdentity(
          tenantId, userId, ipAddress, userAgent
        );
        
        if (!tenantValidation.valid) {
          return {
            valid: false,
            reason: tenantValidation.reason,
            code: tenantValidation.blocked ? 'IP_BLOCKED' : 'TENANT_VALIDATION_FAILED',
            statusCode: tenantValidation.blocked ? 403 : 401
          };
        }
      }
      
      // 檢查3: 異常檢測
      const anomalyDetails = this.detectAnomalousPatterns(req, ipAddress, userAgent);
      const anomalyResult = await this.securityService.detectAnomaly(
        tenantId, userId, ipAddress, req.method + ' ' + req.path, anomalyDetails
      );
      
      if (anomalyResult.isAnomaly) {
        return {
          valid: false,
          reason: '檢測到異常訪問模式',
          code: 'ANOMALY_DETECTED',
          statusCode: 403,
          details: anomalyResult.anomalies
        };
      }
      
      return {
        valid: true,
        tenantId,
        userId,
        ipAddress,
        anomalyScore: anomalyResult.anomalyScore
      };
      
    } catch (error) {
      this.logger.error('安全檢查執行失敗', {
        error: error.message,
        ipAddress,
        tenantId,
        userId
      });
      
      return {
        valid: false,
        reason: '安全檢查執行失敗',
        code: 'SECURITY_CHECK_EXECUTION_ERROR',
        statusCode: 500
      };
    }
  }
  
  /**
   * 驗證請求輸入
   */
  validateRequestInput(req) {
    try {
      const inputData = {
        body: req.body,
        query: req.query,
        params: req.params,
        headers: req.headers
      };
      
      return this.securityService.validateInputSecurity(inputData, 'http_request');
      
    } catch (error) {
      this.logger.error('請求輸入驗證失敗', {
        error: error.message,
        path: req.path
      });
      
      return {
        valid: false,
        warnings: ['輸入驗證失敗'],
        error: error.message
      };
    }
  }
  
  /**
   * 檢測異常模式
   */
  detectAnomalousPatterns(req, ipAddress, userAgent) {
    const details = {};
    
    // 檢測1: 跨租戶訪問嘗試
    const currentTenant = req.headers['x-tenant-id'] || req.user?.tenantId;
    const targetTenant = req.body?.tenantId || req.query?.tenantId;
    if (targetTenant && targetTenant !== currentTenant) {
      details.crossTenantAttempt = true;
    }
    
    // 檢測2: SQL注入嘗試
    const requestData = JSON.stringify(req.body) + JSON.stringify(req.query) + JSON.stringify(req.params);
    const sqlInjectionPatterns = [
      /(\b(union|select|insert|update|delete|drop|create|alter)\b)/i,
      /(['"];?\s*--)/,
      /(['"]\s*or\s*['"]?\s*1\s*=\s*1)/i,
      /(\bxp_cmdshell\b)/i
    ];
    
    for (const pattern of sqlInjectionPatterns) {
      if (pattern.test(requestData)) {
        details.sqlInjectionAttempt = true;
        break;
      }
    }
    
    // 檢測3: 權限越界嘗試
    const sensitiveEndpoints = ['/admin', '/system', '/config', '/users'];
    const isSensitiveEndpoint = sensitiveEndpoints.some(endpoint => 
      req.path.includes(endpoint)
    );
    
    if (isSensitiveEndpoint && (!req.user || !req.user.role || req.user.role !== 'admin')) {
      details.permissionEscalation = true;
    }
    
    // 檢測4: 異常時間訪問（簡單檢測）
    const hour = new Date().getHours();
    if (hour < 6 || hour > 23) {
      details.anomalousTime = true;
    }
    
    // 檢測5: 可疑用戶代理
    const suspiciousUserAgents = [
      'curl', 'wget', 'python', 'bot', 'crawler', 'spider'
    ];
    
    const lowerUserAgent = userAgent.toLowerCase();
    for (const suspicious of suspiciousUserAgents) {
      if (lowerUserAgent.includes(suspicious)) {
        details.suspiciousUserAgent = true;
        break;
      }
    }
    
    return details;
  }
  
  /**
   * 獲取客戶端IP地址
   */
  getClientIP(req) {
    return req.headers['x-forwarded-for'] ||
           req.headers['x-real-ip'] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           req.ip ||
           'unknown';
  }
  
  /**
   * 訪問頻率限制中間件
   */
  rateLimit() {
    return async (req, res, next) => {
      try {
        if (!this.securityService) {
          return next();
        }
        
        const ipAddress = this.getClientIP(req);
        
        // 檢查訪問頻率
        if (this.securityService.isRateLimitExceeded(ipAddress)) {
          return res.status(429).json({
            error: '訪問頻率過高，請稍後再試',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: 60 // 1分鐘後重試
          });
        }
        
        // 記錄訪問
        this.securityService.recordAccess(ipAddress);
        
        next();
      } catch (error) {
        this.logger.error('訪問頻率限制檢查失敗', {
          error: error.message,
          ipAddress: this.getClientIP(req)
        });
        next();
      }
    };
  }
  
  /**
   * 登入失敗處理中間件
   */
  loginFailureHandler() {
    return async (req, res, next) => {
      try {
        if (!this.securityService) {
          return next();
        }
        
        const originalSend = res.send;
        const ipAddress = this.getClientIP(req);
        
        // 攔截響應
        res.send = function(data) {
          try {
            const response = JSON.parse(data);
            
            // 如果是登入失敗
            if (response.error && (
              response.error.includes('登入失敗') ||
              response.error.includes('認證失敗') ||
              response.error.includes('密碼錯誤')
            )) {
              this.securityService.recordFailedLogin(ipAddress);
            }
          } catch (e) {
            // 非JSON響應，忽略
          }
          
          return originalSend.call(this, data);
        }.bind(this);
        
        next();
      } catch (error) {
        this.logger.error('登入失敗處理中間件錯誤', {
          error: error.message
        });
        next();
      }
    };
  }
  
  /**
   * 安全響應頭中間件
   */
  securityHeaders() {
    return (req, res, next) => {
      // 設置安全響應頭
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      res.setHeader('Content-Security-Policy', "default-src 'self'");
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      
      next();
    };
  }
  
  /**
   * 安全日誌中間件
   */
  securityLogging() {
    return async (req, res, next) => {
      try {
        if (!this.securityService) {
          return next();
        }
        
        const startTime = Date.now();
        const ipAddress = this.getClientIP(req);
        const userAgent = req.get('User-Agent') || '';
        const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId;
        const userId = req.user?.id || req.user?.userId;
        
        // 記錄請求開始
        this.logger.info('安全日誌 - 請求開始', {
          method: req.method,
          path: req.path,
          ipAddress,
          tenantId,
          userId,
          userAgent: userAgent.substring(0, 100) // 限制長度
        });
        
        // 攔截響應
        const originalSend = res.send;
        res.send = function(data) {
          const duration = Date.now() - startTime;
          
          // 記錄請求完成
          this.logger.info('安全日誌 - 請求完成', {
            method: req.method,
            path: req.path,
            ipAddress,
            tenantId,
            userId,
            statusCode: res.statusCode,
            duration,
            responseSize: data ? data.length : 0
          });
          
          return originalSend.call(this, data);
        }.bind(this);
        
        next();
      } catch (error) {
        this.logger.error('安全日誌中間件錯誤', {
          error: error.message
        });
        next();
      }
    };
  }
}

module.exports = SecurityMiddleware; 