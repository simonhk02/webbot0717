const database = require('./database');
const redis = require('./redis');
const whatsapp = require('./whatsapp');
const google = require('./google');
const environment = require('./environment');
const { FEATURE_FLAGS, isFeatureEnabled, getAllFeatureFlags } = require('./featureFlags');

module.exports = {
  database,
  redis,
  whatsapp,
  google,
  environment,
  featureFlags: FEATURE_FLAGS,
  isFeatureEnabled,
  getAllFeatureFlags,
  
  // 伺服器配置
  server: {
    port: environment.get('PORT', 3002),
    sessionSecret: environment.get('SESSION_SECRET', 'your-secret-key-change-this-in-production'),
    nodeEnv: environment.get('NODE_ENV', 'development')
  },
  
  // 佇列配置
  queue: {
    imageProcessing: {
      concurrency: 3,
      removeOnComplete: 10,
      removeOnFail: 5
    }
  },
  
  // 應用程式配置
  app: {
    maxListeners: 50,
    sessionTimeout: 30 * 60000, // 30分鐘
    imageProcessingLimit: 3,
    initLimit: 30
  }
}; 