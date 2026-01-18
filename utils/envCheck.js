const { businessLogger } = require('./logger');

const requiredEnvVars = [
  'NODE_ENV',
  'PORT',
  'SESSION_SECRET'
];

const optionalEnvVars = [
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_PASSWORD',
  'REDIS_DB',
  'DB_PATH',
  'WHATSAPP_SESSION_PATH',
  'ANTHROPIC_API_KEY',
  'AI_CONFIDENCE_THRESHOLD',
  'LOG_LEVEL',
  'LOG_FILE_PATH',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI'
];

function checkEnvironmentVariables() {
  const missingVars = [];
  const warnings = [];

  // 檢查必要的環境變數
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missingVars.push(envVar);
    }
  }

  // 檢查可選的環境變數
  for (const envVar of optionalEnvVars) {
    if (!process.env[envVar]) {
      warnings.push(`警告: 環境變數 ${envVar} 未設定，將使用預設值`);
    }
  }

  // 特殊檢查
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'your_session_secret_here') {
      missingVars.push('SESSION_SECRET (不能使用預設值)');
    }
    
    if (!process.env.REDIS_PASSWORD) {
      warnings.push('警告: 生產環境建議設定 REDIS_PASSWORD');
    }
  }

  // 記錄檢查結果
  if (missingVars.length > 0) {
    businessLogger.error('缺少必要的環境變數:', {
      missing: missingVars
    });
    throw new Error(`缺少必要的環境變數: ${missingVars.join(', ')}`);
  }

  if (warnings.length > 0) {
    for (const warning of warnings) {
      businessLogger.warn(warning);
    }
  }

  // 記錄環境設定
  businessLogger.info('環境變數檢查完成', {
    node_env: process.env.NODE_ENV,
    port: process.env.PORT,
    redis_host: process.env.REDIS_HOST,
    redis_port: process.env.REDIS_PORT,
    log_level: process.env.LOG_LEVEL
  });

  return true;
}

module.exports = {
  checkEnvironmentVariables
}; 