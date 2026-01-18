const environment = require('./environment');

module.exports = {
  path: environment.get('DB_PATH', 'whatsappBot.db'),
  
  // 資料庫連接配置
  connection: {
    timeout: 30000,
    verbose: environment.isDevelopment()
  },
  
  // 資料表結構配置
  tables: {
    users: {
      name: 'users',
      columns: [
        'userId TEXT PRIMARY KEY',
        'username TEXT',
        'email TEXT UNIQUE',
        'password TEXT',
        'groupName TEXT',
        'messageFormat TEXT',
        'customQuestions TEXT',
        'driveFolderId TEXT',
        'sheetId TEXT',
        'sheetName TEXT',
        'companyName TEXT',
        'companyAddress TEXT',
        'companyPhone TEXT',
        'invoiceTitle TEXT',
        'invoiceNumberPrefix TEXT',
        'invoiceFooter TEXT',
        'isAuthenticated INTEGER DEFAULT 0'
      ]
    }
  },
  
  // 新增欄位配置（用於資料庫遷移）
  migrations: {
    newColumns: [
      { name: 'companyName', type: 'TEXT' },
      { name: 'companyAddress', type: 'TEXT' },
      { name: 'companyPhone', type: 'TEXT' },
      { name: 'invoiceTitle', type: 'TEXT' },
      { name: 'invoiceNumberPrefix', type: 'TEXT' },
      { name: 'invoiceFooter', type: 'TEXT' }
    ]
  }
}; 