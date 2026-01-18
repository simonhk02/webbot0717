const sqlite3 = require('sqlite3').verbose();

async function checkTableStructure() {
  const db = new sqlite3.Database('./whatsappBot.db');
  
  console.log('🔍 檢查tenant_configs表結構...');
  
  db.all('PRAGMA table_info(tenant_configs)', (err, columns) => {
    if (err) {
      console.error('查詢表結構失敗:', err);
      return;
    }
    
    console.log('📋 tenant_configs表結構:');
    columns.forEach(col => {
      console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
    });
    
    // 檢查是否有數據
    db.all('SELECT COUNT(*) as count FROM tenant_configs', (err, result) => {
      if (err) {
        console.error('查詢數據數量失敗:', err);
      } else {
        console.log(`\n📊 數據數量: ${result[0].count}`);
      }
      
      // 嘗試插入測試數據
      console.log('\n🧪 嘗試插入測試數據...');
      db.run('INSERT INTO tenant_configs (tenantId, configKey, configValue) VALUES (?, ?, ?)', 
        ['test-tenant', 'test-key', 'test-value'], function(err) {
        if (err) {
          console.error('插入失敗:', err.message);
        } else {
          console.log('✅ 插入成功，ID:', this.lastID);
        }
        
        db.close();
      });
    });
  });
}

checkTableStructure(); 