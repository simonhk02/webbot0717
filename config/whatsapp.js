const environment = require('./environment');

module.exports = {
  // WhatsApp Web 配置
  web: {
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    },
    
    // 會話配置
    session: {
      path: './sessions',
      clientId: 'whatsapp-bot'
    }
  },
  
  // 訊息處理配置
  message: {
    // 圖片處理配置
    image: {
      maxSize: 10 * 1024 * 1024, // 10MB
      supportedFormats: ['image/jpeg', 'image/png', 'image/webp'],
      processingTimeout: 30000 // 30秒
    },
    
    // 費用對話配置
    expense: {
      timeout: 300000, // 5分鐘
      maxQuestions: 10,
      defaultQuestions: [
        { question: '請輸入店鋪名稱', field: 'shop' }
      ]
    }
  },
  
  // 連接配置
  connection: {
    reconnectInterval: 5000,
    maxReconnectAttempts: 10,
    qrCodeTimeout: 60000 // 1分鐘
  }
}; 