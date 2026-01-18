const environment = require('./environment');

module.exports = {
  // Redis 連接配置
  connection: {
    host: environment.get('REDIS_HOST', 'localhost'),
    port: environment.get('REDIS_PORT', 6379),
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3
  },
  
  // 佇列配置
  queue: {
    imageProcessing: {
      name: 'image-processing',
      concurrency: 3,
      removeOnComplete: 10,
      removeOnFail: 5,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    }
  },
  
  // 快取配置
  cache: {
    ttl: 3600, // 1小時
    prefix: 'whatsapp_bot:'
  },
  
  // 會話配置
  session: {
    ttl: 1800, // 30分鐘
    prefix: 'session:'
  }
}; 