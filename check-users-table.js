const sqlite3 = require('sqlite3').verbose();

async function checkUsersTable() {
  const db = new sqlite3.Database('./whatsappBot.db');
  
  console.log('🔍 檢查users表結構...');
  
  db.all('PRAGMA table_info(users)', (err, columns) => {
    if (err) {
      console.error('查詢表結構失敗:', err);
      return;
    }
    
    console.log('📋 users表結構:');
    columns.forEach(col => {
      console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
    });
    
    // 檢查是否有數據
    db.all('SELECT COUNT(*) as count FROM users', (err, result) => {
      if (err) {
        console.error('查詢數據數量失敗:', err);
      } else {
        console.log(`\n📊 數據數量: ${result[0].count}`);
      }
      
      // 檢查是否有tenantId欄位
      const hasTenantId = columns.some(col => col.name === 'tenantId');
      console.log(`\n🔍 是否有tenantId欄位: ${hasTenantId}`);
      
      // 檢查是否有secretData欄位
      const hasSecretData = columns.some(col => col.name === 'secretData');
      console.log(`🔍 是否有secretData欄位: ${hasSecretData}`);
      
      db.close();
    });
  });
}

checkUsersTable(); 