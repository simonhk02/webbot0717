const sqlite3 = require('sqlite3').verbose();

console.log('🔍 檢查資料庫結構...\n');

const db = new sqlite3.Database('whatsappBot.db', (err) => {
  if (err) {
    console.error('❌ 連接資料庫失敗:', err.message);
    return;
  }
  console.log('✅ 成功連接到 whatsappBot.db\n');
});

// 檢查 users 表結構
db.all('PRAGMA table_info(users)', (err, rows) => {
  if (err) {
    console.error('❌ 檢查 users 表失敗:', err.message);
    return;
  }
  
  console.log('📋 users 表結構:');
  console.log('='.repeat(60));
  rows.forEach(row => {
    console.log(`${row.name.padEnd(20)} | ${row.type.padEnd(10)} | ${row.notnull ? 'NOT NULL' : 'NULL'}`);
  });
  console.log('='.repeat(60));
  
  // 檢查是否有資料
  db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
    if (err) {
      console.error('❌ 檢查資料數量失敗:', err.message);
    } else {
      console.log(`\n📊 users 表中有 ${row.count} 筆資料`);
    }
    
    // 檢查 plugin_settings 表
    db.all('PRAGMA table_info(plugin_settings)', (err, rows) => {
      if (err) {
        console.error('❌ 檢查 plugin_settings 表失敗:', err.message);
      } else {
        console.log('\n📋 plugin_settings 表結構:');
        console.log('='.repeat(60));
        rows.forEach(row => {
          console.log(`${row.name.padEnd(20)} | ${row.type.padEnd(10)} | ${row.notnull ? 'NOT NULL' : 'NULL'}`);
        });
        console.log('='.repeat(60));
      }
      
      db.close();
      console.log('\n✅ 資料庫檢查完成');
    });
  });
}); 