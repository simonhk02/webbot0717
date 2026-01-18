/**
 * 檢查資料庫內容和結構
 * 驗證資料表是否有足夠的測試資料
 */

const sqlite3 = require('sqlite3').verbose();

async function checkDatabaseContent() {
  console.log('🔍 開始檢查資料庫內容和結構');
  console.log('=' .repeat(50));
  
  let db = null;
  
  try {
    // 1. 連接數據庫
    console.log('📊 步驟1: 連接數據庫...');
    db = new sqlite3.Database('./whatsappBot.db');
    
    // 2. 檢查所有表
    console.log('\n📋 步驟2: 檢查所有表...');
    const tables = await new Promise((resolve, reject) => {
      db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log(`  發現 ${tables.length} 個表:`);
    tables.forEach(table => {
      console.log(`    - ${table.name}`);
    });
    
    // 3. 檢查users表結構
    console.log('\n🔧 步驟3: 檢查users表結構...');
    const userColumns = await new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(users)", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log('  users表欄位:');
    userColumns.forEach(col => {
      console.log(`    - ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
    });
    
    // 4. 檢查users表資料
    console.log('\n💾 步驟4: 檢查users表資料...');
    const userData = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM users LIMIT 10", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log(`  總用戶數量: ${userData.length}`);
    console.log('  用戶資料範例:');
    userData.forEach((user, index) => {
      console.log(`    用戶 ${index + 1}:`);
      console.log(`      ID: ${user.id}`);
      console.log(`      名稱: ${user.name || 'N/A'}`);
      console.log(`      郵箱: ${user.email || 'N/A'}`);
      console.log(`      租戶ID: ${user.tenantId || 'N/A'}`);
      console.log(`      創建時間: ${user.createdAt || 'N/A'}`);
      console.log(`      更新時間: ${user.updatedAt || 'N/A'}`);
    });
    
    // 5. 按租戶分組統計
    console.log('\n📊 步驟5: 按租戶分組統計...');
    const tenantStats = await new Promise((resolve, reject) => {
      db.all("SELECT tenantId, COUNT(*) as count FROM users GROUP BY tenantId", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log('  各租戶用戶數量:');
    tenantStats.forEach(stat => {
      console.log(`    租戶 ${stat.tenantId}: ${stat.count} 個用戶`);
    });
    
    // 6. 檢查tenant_configs表
    console.log('\n⚙️ 步驟6: 檢查tenant_configs表...');
    const configData = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM tenant_configs LIMIT 10", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log(`  總配置數量: ${configData.length}`);
    console.log('  配置資料範例:');
    configData.forEach((config, index) => {
      console.log(`    配置 ${index + 1}:`);
      console.log(`      ID: ${config.id}`);
      console.log(`      配置鍵: ${config.configKey}`);
      console.log(`      配置值: ${config.configValue}`);
      console.log(`      租戶ID: ${config.tenantId}`);
    });
    
    // 7. 測試SQL查詢
    console.log('\n🔍 步驟7: 測試SQL查詢...');
    
    // 測試查詢特定租戶的用戶
    const tenant1Users = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM users WHERE tenantId = 'tenant1'", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log(`  租戶1用戶查詢結果: ${tenant1Users.length} 筆`);
    console.log(`  結果類型: ${typeof tenant1Users}`);
    console.log(`  是否為陣列: ${Array.isArray(tenant1Users)}`);
    
    // 測試查詢所有用戶
    const allUsers = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM users", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log(`  所有用戶查詢結果: ${allUsers.length} 筆`);
    console.log(`  結果類型: ${typeof allUsers}`);
    console.log(`  是否為陣列: ${Array.isArray(allUsers)}`);
    
    // 8. 檢查是否有足夠的測試資料
    console.log('\n📈 步驟8: 檢查測試資料充足性...');
    
    if (userData.length < 3) {
      console.log('  ⚠️  測試資料不足，建議添加更多測試資料');
      console.log('  建議每個租戶至少添加 2-3 筆測試資料');
    } else {
      console.log('  ✅ 測試資料充足');
    }
    
    console.log('\n🎉 資料庫內容檢查完成！');
    console.log('=' .repeat(50));
    
    const report = {
      success: true,
      totalTables: tables.length,
      totalUsers: userData.length,
      totalConfigs: configData.length,
      tenantStats: tenantStats,
      hasEnoughTestData: userData.length >= 3,
      timestamp: new Date().toISOString()
    };
    
    console.log('\n📋 檢查報告:');
    console.log(`  總表數: ${report.totalTables}`);
    console.log(`  總用戶數: ${report.totalUsers}`);
    console.log(`  總配置數: ${report.totalConfigs}`);
    console.log(`  測試資料充足: ${report.hasEnoughTestData ? '是' : '否'}`);
    console.log(`  檢查時間: ${report.timestamp}`);
    
    return report;
    
  } catch (error) {
    console.error('\n❌ 資料庫內容檢查失敗:', error.message);
    throw error;
  } finally {
    if (db) {
      db.close();
      console.log('\n🔒 數據庫連接已關閉');
    }
  }
}

// 如果直接運行此腳本
if (require.main === module) {
  checkDatabaseContent()
    .then(report => {
      console.log('\n✅ 資料庫內容檢查腳本執行成功');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ 資料庫內容檢查腳本執行失敗');
      process.exit(1);
    });
}

module.exports = checkDatabaseContent; 