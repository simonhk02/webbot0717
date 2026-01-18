const environment = require('./environment');

module.exports = {
  // OAuth 配置
  oauth: {
    clientId: environment.get('GOOGLE_CLIENT_ID', ''),
    clientSecret: environment.get('GOOGLE_CLIENT_SECRET', ''),
    redirectUri: environment.get('GOOGLE_REDIRECT_URI', 'http://localhost:3002/auth/google/callback'),
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/spreadsheets'
    ]
  },
  
  // Google Drive 配置
  drive: {
    upload: {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      supportedFormats: ['image/jpeg', 'image/png', 'image/webp'],
      folderName: 'WhatsApp Bot Receipts'
    }
  },
  
  // Google Sheets 配置
  sheets: {
    defaultSheetName: 'Sheet1',
    maxRows: 10000,
    batchSize: 100
  },
  
  // API 配置
  api: {
    timeout: 30000,
    retries: 3,
    retryDelay: 1000
  }
}; 