const sqlite3 = require('sqlite3').verbose();

async function checkDatabase() {
  const db = new sqlite3.Database('./whatsappBot.db');
  
  console.log('🔍 檢查數據庫結構...');
  
  // 檢查所有表
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      console.error('查詢表失敗:', err);
      return;
    }
    
    console.log('📋 所有表:');
    tables.forEach(table => {
      console.log(`  - ${table.name}`);
    });
    
    // 檢查tenant_configs表
    if (tables.find(t => t.name === 'tenant_configs')) {
      console.log('\n🔍 檢查tenant_configs表...');
      db.all('SELECT * FROM tenant_configs', (err, rows) => {
        if (err) {
          console.error('查詢tenant_configs失敗:', err);
        } else {
          console.log(`  記錄數量: ${rows.length}`);
          if (rows.length > 0) {
            console.log('  前3條記錄:');
            rows.slice(0, 3).forEach(row => {
              console.log(`    ${JSON.stringify(row)}`);
            });
          }
        }
        
        // 檢查users表
        console.log('\n🔍 檢查users表...');
        db.all('SELECT COUNT(*) as count FROM users', (err, result) => {
          if (err) {
            console.error('查詢users失敗:', err);
          } else {
            console.log(`  用戶數量: ${result[0].count}`);
          }
          
          db.close();
        });
      });
    } else {
      console.log('\n❌ tenant_configs表不存在');
      db.close();
    }
  });
}

checkDatabase(); 