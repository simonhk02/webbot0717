/**
 * 認證授權中間件
 * 實現API認證、JWT token驗證、權限檢查等功能
 */

const jwt = require('jsonwebtoken');
const { businessLogger } = require('../utils/logger');

class AuthMiddleware {
  constructor(container) {
    this.container = container;
    this.logger = businessLogger;
    this.userService = null;
    this.tenantContextManager = null;
    
    // 嘗試從容器獲取服務
    try {
      this.userService = container.resolve('userService');
    } catch (error) {
      this.logger.warn('UserService 未註冊，使用基本認證');
    }
    
    try {
      this.tenantContextManager = container.resolve('tenantContextManager');
    } catch (error) {
      this.logger.warn('TenantContextManager 未註冊，跳過租戶驗證');
    }
  }

  /**
   * JWT Token 驗證中間件
   */
  authenticateToken() {
    return async (req, res, next) => {
      try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
          return res.status(401).json({ 
            error: '缺少認證令牌',
            code: 'MISSING_TOKEN'
          });
        }

        const secret = process.env.JWT_SECRET || 'your-secret-key';
        
        jwt.verify(token, secret, async (err, decoded) => {
          if (err) {
            this.logger.warn('Token 驗證失敗', { 
              error: err.message,
              token: token.substring(0, 20) + '...'
            });
            
            return res.status(403).json({ 
              error: '無效的認證令牌',
              code: 'INVALID_TOKEN'
            });
          }

          // 驗證用戶是否存在
          if (this.userService) {
            try {
              const user = await this.userService.getUserById(decoded.userId);
              if (!user) {
                return res.status(403).json({ 
                  error: '用戶不存在',
                  code: 'USER_NOT_FOUND'
                });
              }
              
              // 檢查用戶狀態
              if (user.status === 'inactive') {
                return res.status(403).json({ 
                  error: '用戶帳戶已停用',
                  code: 'USER_INACTIVE'
                });
              }
              
              req.user = user;
            } catch (error) {
              this.logger.error('用戶驗證失敗', { 
                userId: decoded.userId,
                error: error.message 
              });
              return res.status(500).json({ 
                error: '用戶驗證失敗',
                code: 'USER_VALIDATION_ERROR'
              });
            }
          } else {
            // 基本驗證，直接使用 decoded 信息
            req.user = {
              id: decoded.userId,
              email: decoded.email,
              tenantId: decoded.tenantId
            };
          }

          req.token = decoded;
          next();
        });
      } catch (error) {
        this.logger.error('認證中間件錯誤', { 
          error: error.message,
          stack: error.stack
        });
        return res.status(500).json({ 
          error: '認證服務錯誤',
          code: 'AUTH_SERVICE_ERROR'
        });
      }
    };
  }

  /**
   * 權限檢查中間件
   */
  requirePermission(permission) {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({ 
            error: '需要認證',
            code: 'AUTHENTICATION_REQUIRED'
          });
        }

        const userId = req.user.id || req.user.userId;
        const tenantId = req.user.tenantId || req.headers['x-tenant-id'];

        if (!tenantId) {
          return res.status(400).json({ 
            error: '缺少租戶信息',
            code: 'MISSING_TENANT'
          });
        }

        // 使用租戶上下文管理器檢查權限
        if (this.tenantContextManager) {
          const hasPermission = this.tenantContextManager.validateAccess(
            tenantId, 
            userId, 
            [permission]
          );

          if (!hasPermission) {
            this.logger.warn('權限不足', {
              userId,
              tenantId,
              requiredPermission: permission,
              path: req.path,
              method: req.method
            });

            return res.status(403).json({ 
              error: '權限不足',
              code: 'INSUFFICIENT_PERMISSIONS',
              requiredPermission: permission
            });
          }
        } else if (this.userService) {
          // 使用用戶服務檢查權限
          const hasPermission = await this.userService.hasPermission(
            userId, 
            permission, 
            tenantId
          );

          if (!hasPermission) {
            this.logger.warn('權限不足', {
              userId,
              tenantId,
              requiredPermission: permission,
              path: req.path,
              method: req.method
            });

            return res.status(403).json({ 
              error: '權限不足',
              code: 'INSUFFICIENT_PERMISSIONS',
              requiredPermission: permission
            });
          }
        } else {
          // 基本權限檢查，假設有權限
          this.logger.warn('無法進行權限檢查，跳過驗證');
        }

        next();
      } catch (error) {
        this.logger.error('權限檢查失敗', { 
          error: error.message,
          userId: req.user?.id,
          permission
        });
        return res.status(500).json({ 
          error: '權限檢查失敗',
          code: 'PERMISSION_CHECK_ERROR'
        });
      }
    };
  }

  /**
   * 角色檢查中間件
   */
  requireRole(role) {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({ 
            error: '需要認證',
            code: 'AUTHENTICATION_REQUIRED'
          });
        }

        const userRole = req.user.role || req.user.userRole;
        
        if (userRole !== role) {
          this.logger.warn('角色不匹配', {
            userId: req.user.id,
            userRole,
            requiredRole: role,
            path: req.path,
            method: req.method
          });

          return res.status(403).json({ 
            error: '角色權限不足',
            code: 'INSUFFICIENT_ROLE',
            requiredRole: role,
            userRole
          });
        }

        next();
      } catch (error) {
        this.logger.error('角色檢查失敗', { 
          error: error.message,
          userId: req.user?.id,
          role
        });
        return res.status(500).json({ 
          error: '角色檢查失敗',
          code: 'ROLE_CHECK_ERROR'
        });
      }
    };
  }

  /**
   * 租戶驗證中間件
   */
  validateTenant() {
    return async (req, res, next) => {
      try {
        const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId;

        if (!tenantId) {
          return res.status(400).json({ 
            error: '缺少租戶信息',
            code: 'MISSING_TENANT'
          });
        }

        if (this.tenantContextManager) {
          const tenantExists = this.tenantContextManager.hasTenant(tenantId);
          
          if (!tenantExists) {
            this.logger.warn('租戶不存在', { tenantId });
            return res.status(404).json({ 
              error: '租戶不存在',
              code: 'TENANT_NOT_FOUND'
            });
          }

          // 檢查租戶狀態
          const tenantStatus = this.tenantContextManager.getTenantStatus(tenantId);
          if (tenantStatus === 'suspended') {
            return res.status(403).json({ 
              error: '租戶已暫停',
              code: 'TENANT_SUSPENDED'
            });
          }
        }

        req.tenantId = tenantId;
        next();
      } catch (error) {
        this.logger.error('租戶驗證失敗', { 
          error: error.message,
          tenantId: req.headers['x-tenant-id']
        });
        return res.status(500).json({ 
          error: '租戶驗證失敗',
          code: 'TENANT_VALIDATION_ERROR'
        });
      }
    };
  }

  /**
   * API 速率限制中間件
   */
  rateLimit(options = {}) {
    const {
      windowMs = 15 * 60 * 1000, // 15分鐘
      max = 100, // 最大請求數
      message = '請求過於頻繁，請稍後再試'
    } = options;

    const requests = new Map();

    return (req, res, next) => {
      const key = req.ip || req.connection.remoteAddress;
      const now = Date.now();
      const windowStart = now - windowMs;

      // 清理過期的請求記錄
      if (requests.has(key)) {
        const userRequests = requests.get(key).filter(time => time > windowStart);
        requests.set(key, userRequests);
      } else {
        requests.set(key, []);
      }

      const userRequests = requests.get(key);

      if (userRequests.length >= max) {
        this.logger.warn('API 速率限制觸發', {
          ip: key,
          requests: userRequests.length,
          max,
          windowMs
        });

        return res.status(429).json({ 
          error: message,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      userRequests.push(now);
      next();
    };
  }

  /**
   * 生成 JWT Token
   */
  generateToken(user, options = {}) {
    const {
      expiresIn = '24h',
      secret = process.env.JWT_SECRET || 'your-secret-key'
    } = options;

    const payload = {
      userId: user.id || user.userId,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role || user.userRole,
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, secret, { expiresIn });
  }

  /**
   * 驗證 JWT Token
   */
  verifyToken(token, secret = process.env.JWT_SECRET || 'your-secret-key') {
    try {
      return jwt.verify(token, secret);
    } catch (error) {
      this.logger.warn('Token 驗證失敗', { error: error.message });
      return null;
    }
  }
}

module.exports = AuthMiddleware; 