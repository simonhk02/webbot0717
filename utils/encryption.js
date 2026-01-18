/**
 * 數據加密工具
 * 實現敏感數據的加密和解密功能
 */

const crypto = require('crypto');
const { businessLogger } = require('./logger');

class EncryptionService {
  constructor(options = {}) {
    this.logger = businessLogger;
    this.algorithm = options.algorithm || 'aes-256-gcm';
    this.keyLength = options.keyLength || 32;
    this.ivLength = options.ivLength || 16;
    this.tagLength = options.tagLength || 16;
    
    // 從環境變數獲取加密密鑰
    this.secretKey = process.env.ENCRYPTION_KEY || this.generateSecretKey();
    
    // 確保密鑰長度正確
    if (this.secretKey.length !== this.keyLength) {
      this.secretKey = crypto.scryptSync(this.secretKey, 'salt', this.keyLength);
    }
  }

  /**
   * 生成隨機密鑰
   */
  generateSecretKey(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * 生成隨機 IV
   */
  generateIV() {
    return crypto.randomBytes(this.ivLength);
  }

  /**
   * 加密數據
   * @param {string|Buffer} data - 要加密的數據
   * @param {Object} options - 加密選項
   * @returns {string} 加密後的數據（Base64格式）
   */
  encrypt(data, options = {}) {
    try {
      if (!data) {
        throw new Error('加密數據不能為空');
      }

      const { key = this.secretKey, algorithm = this.algorithm } = options;
      // 生成 IV
      const iv = this.generateIV();
      // 創建加密器（現代API）
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      cipher.setAAD(Buffer.from('additional-data', 'utf8'));
      // 加密數據
      let encrypted = cipher.update(data, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      // 獲取認證標籤
      const tag = cipher.getAuthTag();
      // 組合 IV + 認證標籤 + 加密數據
      const result = Buffer.concat([iv, tag, encrypted]);
      // 返回 Base64 格式
      const encryptedData = result.toString('base64');
      this.logger.debug('數據加密成功', {
        algorithm,
        dataLength: data.length,
        encryptedLength: encryptedData.length
      });
      return encryptedData;
    } catch (error) {
      this.logger.error('數據加密失敗', {
        error: error.message,
        algorithm: options.algorithm || this.algorithm
      });
      throw new Error(`加密失敗: ${error.message}`);
    }
  }

  /**
   * 解密數據
   * @param {string} encryptedData - 加密後的數據（Base64格式）
   * @param {Object} options - 解密選項
   * @returns {string} 解密後的數據
   */
  decrypt(encryptedData, options = {}) {
    try {
      if (!encryptedData) {
        throw new Error('解密數據不能為空');
      }
      const { key = this.secretKey, algorithm = this.algorithm } = options;
      // 將 Base64 轉換為 Buffer
      const encryptedBuffer = Buffer.from(encryptedData, 'base64');
      // 提取 IV、Tag、加密數據
      const iv = encryptedBuffer.slice(0, this.ivLength);
      const tag = encryptedBuffer.slice(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = encryptedBuffer.slice(this.ivLength + this.tagLength);
      // 創建解密器（現代API）
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      decipher.setAAD(Buffer.from('additional-data', 'utf8'));
      decipher.setAuthTag(tag);
      // 解密數據
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      this.logger.debug('數據解密成功', {
        algorithm,
        encryptedLength: encryptedData.length,
        decryptedLength: decrypted.length
      });
      return decrypted.toString('utf8');
    } catch (error) {
      this.logger.error('數據解密失敗', {
        error: error.message,
        algorithm: options.algorithm || this.algorithm
      });
      throw new Error(`解密失敗: ${error.message}`);
    }
  }

  /**
   * 哈希密碼
   * @param {string} password - 原始密碼
   * @param {Object} options - 哈希選項
   * @returns {string} 哈希後的密碼
   */
  hashPassword(password, options = {}) {
    try {
      const { saltRounds = 12, algorithm = 'sha256' } = options;
      
      // 生成隨機鹽值
      const salt = crypto.randomBytes(16).toString('hex');
      
      // 使用 PBKDF2 進行密碼哈希
      const hash = crypto.pbkdf2Sync(password, salt, saltRounds, 64, algorithm);
      
      // 返回 salt:hash 格式
      const hashedPassword = `${salt}:${hash.toString('hex')}`;
      
      this.logger.debug('密碼哈希成功', {
        algorithm,
        saltRounds,
        hashLength: hashedPassword.length
      });
      
      return hashedPassword;
    } catch (error) {
      this.logger.error('密碼哈希失敗', {
        error: error.message,
        algorithm: options.algorithm || 'sha256'
      });
      throw new Error(`密碼哈希失敗: ${error.message}`);
    }
  }

  /**
   * 驗證密碼
   * @param {string} password - 原始密碼
   * @param {string} hashedPassword - 哈希後的密碼
   * @param {Object} options - 驗證選項
   * @returns {boolean} 密碼是否匹配
   */
  verifyPassword(password, hashedPassword, options = {}) {
    try {
      const { algorithm = 'sha256' } = options;
      
      // 分離 salt 和 hash
      const [salt, hash] = hashedPassword.split(':');
      
      if (!salt || !hash) {
        throw new Error('無效的哈希格式');
      }
      
      // 使用相同的參數重新計算哈希
      const testHash = crypto.pbkdf2Sync(password, salt, 12, 64, algorithm);
      
      // 比較哈希值
      const isValid = crypto.timingSafeEqual(
        Buffer.from(hash, 'hex'),
        testHash
      );
      
      this.logger.debug('密碼驗證完成', {
        algorithm,
        isValid
      });
      
      return isValid;
    } catch (error) {
      this.logger.error('密碼驗證失敗', {
        error: error.message,
        algorithm: options.algorithm || 'sha256'
      });
      return false;
    }
  }

  /**
   * 生成安全的隨機字符串
   * @param {number} length - 字符串長度
   * @param {string} charset - 字符集
   * @returns {string} 隨機字符串
   */
  generateRandomString(length = 32, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
    try {
      let result = '';
      const charactersLength = charset.length;
      
      for (let i = 0; i < length; i++) {
        result += charset.charAt(Math.floor(Math.random() * charactersLength));
      }
      
      return result;
    } catch (error) {
      this.logger.error('生成隨機字符串失敗', { error: error.message });
      throw new Error(`生成隨機字符串失敗: ${error.message}`);
    }
  }

  /**
   * 生成 API 密鑰
   * @param {number} length - 密鑰長度
   * @returns {string} API 密鑰
   */
  generateAPIKey(length = 32) {
    try {
      const apiKey = crypto.randomBytes(length).toString('base64url');
      
      this.logger.debug('API 密鑰生成成功', { length });
      
      return apiKey;
    } catch (error) {
      this.logger.error('API 密鑰生成失敗', { error: error.message });
      throw new Error(`API 密鑰生成失敗: ${error.message}`);
    }
  }

  /**
   * 加密敏感字段
   * @param {Object} data - 包含敏感字段的對象
   * @param {Array} sensitiveFields - 敏感字段列表
   * @returns {Object} 加密後的對象
   */
  encryptSensitiveFields(data, sensitiveFields = ['password', 'token', 'secret', 'key']) {
    try {
      const encryptedData = { ...data };
      
      for (const field of sensitiveFields) {
        if (encryptedData[field] && typeof encryptedData[field] === 'string') {
          encryptedData[field] = this.encrypt(encryptedData[field]);
        }
      }
      
      this.logger.debug('敏感字段加密完成', {
        fields: sensitiveFields,
        dataKeys: Object.keys(data)
      });
      
      return encryptedData;
    } catch (error) {
      this.logger.error('敏感字段加密失敗', {
        error: error.message,
        fields: sensitiveFields
      });
      throw new Error(`敏感字段加密失敗: ${error.message}`);
    }
  }

  /**
   * 解密敏感字段
   * @param {Object} data - 包含加密字段的對象
   * @param {Array} sensitiveFields - 敏感字段列表
   * @returns {Object} 解密後的對象
   */
  decryptSensitiveFields(data, sensitiveFields = ['password', 'token', 'secret', 'key']) {
    try {
      const decryptedData = { ...data };
      
      for (const field of sensitiveFields) {
        if (decryptedData[field] && typeof decryptedData[field] === 'string') {
          try {
            decryptedData[field] = this.decrypt(decryptedData[field]);
          } catch (error) {
            // 如果解密失敗，可能是未加密的數據，保持原樣
            this.logger.warn('字段解密失敗，可能未加密', {
              field,
              error: error.message
            });
          }
        }
      }
      
      this.logger.debug('敏感字段解密完成', {
        fields: sensitiveFields,
        dataKeys: Object.keys(data)
      });
      
      return decryptedData;
    } catch (error) {
      this.logger.error('敏感字段解密失敗', {
        error: error.message,
        fields: sensitiveFields
      });
      throw new Error(`敏感字段解密失敗: ${error.message}`);
    }
  }

  /**
   * 生成數字簽名
   * @param {string} data - 要簽名的數據
   * @param {string} privateKey - 私鑰
   * @returns {string} 數字簽名
   */
  signData(data, privateKey) {
    try {
      const sign = crypto.createSign('SHA256');
      sign.update(data);
      sign.end();
      
      const signature = sign.sign(privateKey, 'base64');
      
      this.logger.debug('數據簽名成功', {
        dataLength: data.length,
        signatureLength: signature.length
      });
      
      return signature;
    } catch (error) {
      this.logger.error('數據簽名失敗', { error: error.message });
      throw new Error(`數據簽名失敗: ${error.message}`);
    }
  }

  /**
   * 驗證數字簽名
   * @param {string} data - 原始數據
   * @param {string} signature - 數字簽名
   * @param {string} publicKey - 公鑰
   * @returns {boolean} 簽名是否有效
   */
  verifySignature(data, signature, publicKey) {
    try {
      const verify = crypto.createVerify('SHA256');
      verify.update(data);
      verify.end();
      
      const isValid = verify.verify(publicKey, signature, 'base64');
      
      this.logger.debug('簽名驗證完成', {
        dataLength: data.length,
        isValid
      });
      
      return isValid;
    } catch (error) {
      this.logger.error('簽名驗證失敗', { error: error.message });
      return false;
    }
  }
}

// 創建單例實例
const encryptionService = new EncryptionService();

module.exports = {
  EncryptionService,
  encryptionService
}; 