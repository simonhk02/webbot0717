const Redis = require('ioredis');
const { businessLogger } = require('../utils/logger');

class RedisService {
  constructor() {
    this.client = null;
    this.useMock = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  async initialize() {
    try {
      businessLogger.info('開始初始化 Redis 服務...');
      
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB || 0,
        lazyConnect: true,
        enableOfflineQueue: true,
        connectTimeout: 10000,
        commandTimeout: 5000,
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          businessLogger.warn(`Redis 重試連接，第 ${times} 次`);
          if (times > this.maxRetries) {
            businessLogger.warn('Redis 重試次數超過上限，切換到模擬器模式');
            this.switchToMock();
            return null;
          }
          return Math.min(times * this.retryDelay, 5000);
        }
      };

      businessLogger.debug('Redis 配置:', {
        host: redisConfig.host,
        port: redisConfig.port,
        db: redisConfig.db,
        hasPassword: !!redisConfig.password
      });

      this.client = new Redis(redisConfig);

      this.client.on('error', (err) => {
        businessLogger.warn(`Redis 錯誤: ${err.message}`, {
          error: err.message,
          code: err.code,
          stack: err.stack
        });
        
        if (err.code === 'ECONNREFUSED' || 
            err.code === 'ENOTFOUND' || 
            err.message.includes('Stream isn\'t writeable') ||
            err.message.includes('enableOfflineQueue options is false')) {
          this.retryCount++;
          if (this.retryCount > this.maxRetries) {
            businessLogger.warn(`Redis 連接失敗次數超過 ${this.maxRetries} 次，切換到模擬器模式`);
            this.switchToMock();
          }
        }
      });

      this.client.on('connect', () => {
        businessLogger.info('Redis 連接成功');
        this.retryCount = 0;
      });

      this.client.on('ready', () => {
        businessLogger.info('Redis 服務就緒');
      });

      this.client.on('close', () => {
        if (!this.useMock) {
          businessLogger.warn('Redis 連接關閉');
        }
      });

      this.client.on('reconnecting', () => {
        businessLogger.info('Redis 正在重新連接...');
      });

      await this.client.connect();
      
      // 測試連接
      const testResult = await this.client.ping();
      if (testResult !== 'PONG') {
        throw new Error('Redis 連接測試失敗');
      }
      
      businessLogger.info('Redis 服務初始化完成');
    } catch (err) {
      businessLogger.warn(`Redis 初始化失敗，使用模擬器: ${err.message}`, {
        error: err.message,
        stack: err.stack
      });
      this.switchToMock();
    }
  }

  switchToMock() {
    this.useMock = true;
    if (this.client && typeof this.client.disconnect === 'function') {
      try {
        this.client.disconnect();
      } catch (error) {
        businessLogger.warn(`關閉 Redis 連接時發生錯誤: ${error.message}`, {
          error: error.message,
          stack: error.stack
        });
      }
    }
    const RedisMock = require('../utils/redisMock');
    this.client = new RedisMock();
    businessLogger.info('已切換到 Redis 模擬器模式');
  }

  async cleanup() {
    if (this.client && typeof this.client.disconnect === 'function') {
      try {
        await this.client.disconnect();
        businessLogger.info('Redis 連接已關閉');
      } catch (error) {
        businessLogger.warn(`關閉 Redis 連接時發生錯誤: ${error.message}`, {
          error: error.message,
          stack: error.stack
        });
      }
    }
  }

  async healthCheck() {
    try {
      if (this.client.constructor.name === 'RedisMock') {
        return {
          status: 'mock',
          message: '使用 Redis 模擬器',
          connected: true,
          mode: 'mock'
        };
      }
      
      const pingResult = await this.client.ping();
      const info = await this.client.info();
      
      return {
        status: 'connected',
        message: 'Redis 連接正常',
        connected: true,
        ping: pingResult,
        mode: 'real',
        info: this._parseRedisInfo(info)
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Redis 連接錯誤: ${error.message}`,
        connected: false,
        error: error.message,
        stack: error.stack
      };
    }
  }

  _parseRedisInfo(info) {
    const result = {};
    const sections = info.split('\n\n');
    
    for (const section of sections) {
      const lines = section.split('\n');
      for (const line of lines) {
        if (line.startsWith('#')) continue;
        const [key, value] = line.split(':');
        if (key && value) {
          result[key.trim()] = value.trim();
        }
      }
    }
    
    return result;
  }

  getClient() {
    return this.client;
  }
}

// 全域實例管理
let globalRedisService = null;

function getRedisInstance() {
  if (!globalRedisService) {
    // 如果還沒有全域實例，建立一個模擬器
    const RedisMock = require('../utils/redisMock');
    return new RedisMock();
  }
  return globalRedisService.getClient();
}

function setGlobalRedisService(redisService) {
  globalRedisService = redisService;
}

function checkRedisStatus() {
  if (!globalRedisService) {
    return { status: 'not_initialized', message: 'Redis 服務尚未初始化' };
  }
  return globalRedisService.healthCheck();
}

module.exports = RedisService;
module.exports.getRedisInstance = getRedisInstance;
module.exports.setGlobalRedisService = setGlobalRedisService;
module.exports.checkRedisStatus = checkRedisStatus; 