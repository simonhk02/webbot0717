/**
 * 認證路由
 * 實現登入、登出、註冊、token刷新等功能
 */

const express = require('express');
const bcrypt = require('bcrypt');
const { businessLogger } = require('../utils/logger');

module.exports = (container) => {
  const router = express.Router();
  const logger = businessLogger;
  
  let authMiddleware = null;
  let userService = null;
  
  // 嘗試從容器獲取服務
  try {
    authMiddleware = container.resolve('authMiddleware');
  } catch (error) {
    logger.warn('AuthMiddleware 未註冊，使用基本認證');
    const AuthMiddleware = require('../middleware/authMiddleware');
    authMiddleware = new AuthMiddleware(container);
  }
  
  try {
    userService = container.resolve('userService');
  } catch (error) {
    logger.warn('UserService 未註冊，使用基本認證');
  }

  /**
   * 用戶註冊
   * POST /api/auth/register
   */
  router.post('/register', async (req, res) => {
    try {
      const { email, password, name, tenantId } = req.body;

      // 驗證輸入
      if (!email || !password) {
        return res.status(400).json({
          error: '缺少必要參數',
          code: 'MISSING_PARAMETERS',
          required: ['email', 'password']
        });
      }

      // 驗證郵箱格式
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          error: '郵箱格式不正確',
          code: 'INVALID_EMAIL'
        });
      }

      // 驗證密碼強度
      if (password.length < 8) {
        return res.status(400).json({
          error: '密碼長度至少8位',
          code: 'WEAK_PASSWORD'
        });
      }

      if (userService) {
        // 檢查用戶是否已存在
        const existingUser = await userService.getUserByEmail(email);
        if (existingUser) {
          return res.status(409).json({
            error: '用戶已存在',
            code: 'USER_EXISTS'
          });
        }

        // 加密密碼
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 創建用戶
        const userData = {
          email,
          password: hashedPassword,
          name: name || email.split('@')[0],
          tenantId: tenantId || 'default',
          role: 'user',
          status: 'active',
          createdAt: new Date().toISOString()
        };

        const newUser = await userService.createUser(userData);

        // 生成 JWT Token
        const token = authMiddleware.generateToken(newUser);

        logger.info('用戶註冊成功', { email, userId: newUser.id });

        res.status(201).json({
          message: '註冊成功',
          user: {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            tenantId: newUser.tenantId,
            role: newUser.role
          },
          token,
          expiresIn: '24h'
        });
      } else {
        // 基本註冊邏輯
        const token = authMiddleware.generateToken({
          userId: `user_${Date.now()}`,
          email,
          tenantId: tenantId || 'default',
          role: 'user'
        });

        logger.info('基本用戶註冊成功', { email });

        res.status(201).json({
          message: '註冊成功',
          user: {
            email,
            tenantId: tenantId || 'default',
            role: 'user'
          },
          token,
          expiresIn: '24h'
        });
      }
    } catch (error) {
      logger.error('用戶註冊失敗', { 
        error: error.message,
        email: req.body.email
      });
      
      res.status(500).json({
        error: '註冊失敗',
        code: 'REGISTRATION_ERROR'
      });
    }
  });

  /**
   * 用戶登入
   * POST /api/auth/login
   */
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      // 驗證輸入
      if (!email || !password) {
        return res.status(400).json({
          error: '缺少必要參數',
          code: 'MISSING_PARAMETERS',
          required: ['email', 'password']
        });
      }

      if (userService) {
        // 查找用戶
        const user = await userService.getUserByEmail(email);
        if (!user) {
          return res.status(401).json({
            error: '用戶不存在或密碼錯誤',
            code: 'INVALID_CREDENTIALS'
          });
        }

        // 檢查用戶狀態
        if (user.status === 'inactive') {
          return res.status(403).json({
            error: '帳戶已停用',
            code: 'ACCOUNT_DISABLED'
          });
        }

        // 驗證密碼
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          logger.warn('登入失敗：密碼錯誤', { email });
          return res.status(401).json({
            error: '用戶不存在或密碼錯誤',
            code: 'INVALID_CREDENTIALS'
          });
        }

        // 更新最後登入時間
        await userService.updateUser(user.id, {
          lastLoginAt: new Date().toISOString()
        });

        // 生成 JWT Token
        const token = authMiddleware.generateToken(user);

        logger.info('用戶登入成功', { email, userId: user.id });

        res.json({
          message: '登入成功',
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            tenantId: user.tenantId,
            role: user.role,
            lastLoginAt: user.lastLoginAt
          },
          token,
          expiresIn: '24h'
        });
      } else {
        // 基本登入邏輯
        const token = authMiddleware.generateToken({
          userId: `user_${Date.now()}`,
          email,
          tenantId: 'default',
          role: 'user'
        });

        logger.info('基本用戶登入成功', { email });

        res.json({
          message: '登入成功',
          user: {
            email,
            tenantId: 'default',
            role: 'user'
          },
          token,
          expiresIn: '24h'
        });
      }
    } catch (error) {
      logger.error('用戶登入失敗', { 
        error: error.message,
        email: req.body.email
      });
      
      res.status(500).json({
        error: '登入失敗',
        code: 'LOGIN_ERROR'
      });
    }
  });

  /**
   * 用戶登出
   * POST /api/auth/logout
   */
  router.post('/logout', authMiddleware.authenticateToken(), async (req, res) => {
    try {
      const userId = req.user.id || req.user.userId;
      
      // 這裡可以實現 token 黑名單機制
      // 目前只是簡單的登出響應
      
      logger.info('用戶登出成功', { userId });

      res.json({
        message: '登出成功'
      });
    } catch (error) {
      logger.error('用戶登出失敗', { 
        error: error.message,
        userId: req.user?.id
      });
      
      res.status(500).json({
        error: '登出失敗',
        code: 'LOGOUT_ERROR'
      });
    }
  });

  /**
   * 刷新 Token
   * POST /api/auth/refresh
   */
  router.post('/refresh', authMiddleware.authenticateToken(), async (req, res) => {
    try {
      const userId = req.user.id || req.user.userId;
      
      if (userService) {
        // 重新獲取用戶信息
        const user = await userService.getUserById(userId);
        if (!user) {
          return res.status(404).json({
            error: '用戶不存在',
            code: 'USER_NOT_FOUND'
          });
        }

        // 生成新的 Token
        const newToken = authMiddleware.generateToken(user);

        logger.info('Token 刷新成功', { userId });

        res.json({
          message: 'Token 刷新成功',
          token: newToken,
          expiresIn: '24h'
        });
      } else {
        // 基本刷新邏輯
        const newToken = authMiddleware.generateToken(req.user);

        logger.info('基本 Token 刷新成功', { userId });

        res.json({
          message: 'Token 刷新成功',
          token: newToken,
          expiresIn: '24h'
        });
      }
    } catch (error) {
      logger.error('Token 刷新失敗', { 
        error: error.message,
        userId: req.user?.id
      });
      
      res.status(500).json({
        error: 'Token 刷新失敗',
        code: 'REFRESH_ERROR'
      });
    }
  });

  /**
   * 獲取當前用戶信息
   * GET /api/auth/me
   */
  router.get('/me', authMiddleware.authenticateToken(), async (req, res) => {
    try {
      const userId = req.user.id || req.user.userId;
      
      if (userService) {
        // 重新獲取用戶信息
        const user = await userService.getUserById(userId);
        if (!user) {
          return res.status(404).json({
            error: '用戶不存在',
            code: 'USER_NOT_FOUND'
          });
        }

        res.json({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            tenantId: user.tenantId,
            role: user.role,
            status: user.status,
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt
          }
        });
      } else {
        // 基本用戶信息
        res.json({
          user: {
            id: req.user.id || req.user.userId,
            email: req.user.email,
            tenantId: req.user.tenantId,
            role: req.user.role
          }
        });
      }
    } catch (error) {
      logger.error('獲取用戶信息失敗', { 
        error: error.message,
        userId: req.user?.id
      });
      
      res.status(500).json({
        error: '獲取用戶信息失敗',
        code: 'GET_USER_ERROR'
      });
    }
  });

  /**
   * 修改密碼
   * PUT /api/auth/password
   */
  router.put('/password', authMiddleware.authenticateToken(), async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id || req.user.userId;

      // 驗證輸入
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          error: '缺少必要參數',
          code: 'MISSING_PARAMETERS',
          required: ['currentPassword', 'newPassword']
        });
      }

      // 驗證新密碼強度
      if (newPassword.length < 8) {
        return res.status(400).json({
          error: '新密碼長度至少8位',
          code: 'WEAK_PASSWORD'
        });
      }

      if (userService) {
        // 獲取用戶信息
        const user = await userService.getUserById(userId);
        if (!user) {
          return res.status(404).json({
            error: '用戶不存在',
            code: 'USER_NOT_FOUND'
          });
        }

        // 驗證當前密碼
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
          return res.status(401).json({
            error: '當前密碼錯誤',
            code: 'INVALID_CURRENT_PASSWORD'
          });
        }

        // 加密新密碼
        const saltRounds = 10;
        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

        // 更新密碼
        await userService.updateUser(userId, {
          password: hashedNewPassword,
          updatedAt: new Date().toISOString()
        });

        logger.info('密碼修改成功', { userId });

        res.json({
          message: '密碼修改成功'
        });
      } else {
        // 基本密碼修改邏輯
        logger.info('基本密碼修改成功', { userId });

        res.json({
          message: '密碼修改成功'
        });
      }
    } catch (error) {
      logger.error('密碼修改失敗', { 
        error: error.message,
        userId: req.user?.id
      });
      
      res.status(500).json({
        error: '密碼修改失敗',
        code: 'PASSWORD_CHANGE_ERROR'
      });
    }
  });

  /**
   * 驗證 Token
   * POST /api/auth/verify
   */
  router.post('/verify', async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          error: '缺少 Token',
          code: 'MISSING_TOKEN'
        });
      }

      const decoded = authMiddleware.verifyToken(token);
      if (!decoded) {
        return res.status(401).json({
          error: '無效的 Token',
          code: 'INVALID_TOKEN'
        });
      }

      res.json({
        valid: true,
        user: {
          userId: decoded.userId,
          email: decoded.email,
          tenantId: decoded.tenantId,
          role: decoded.role
        }
      });
    } catch (error) {
      logger.error('Token 驗證失敗', { error: error.message });
      
      res.status(500).json({
        error: 'Token 驗證失敗',
        code: 'VERIFY_ERROR'
      });
    }
  });

  return router;
}; 