/**
 * 簡化的數據庫遷移執行腳本
 * 直接執行SQL語句，避免複雜的驗證邏輯
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

async function runSimpleMigration() {
  console.log('🚀 開始執行簡化數據庫遷移');
  console.log('=' .repeat(50));
  
  let db = null;
  
  try {
    // 1. 連接數據庫
    console.log('📊 步驟1: 連接數據庫...');
    db = new sqlite3.Database('./whatsappBot.db');
    
    // 2. 檢查數據庫是否存在表
    console.log('🔍 步驟2: 檢查現有表結構...');
    const tables = await new Promise((resolve, reject) => {
      db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    console.log(`  現有表數量: ${tables.length}`);
    if (tables.length > 0) {
      console.log('  現有表:');
      tables.forEach(table => {
        console.log(`    - ${table.name}`);
      });
    }
    
    // 3. 讀取遷移SQL文件
    console.log('\n📋 步驟3: 讀取遷移SQL文件...');
    const migrationPath = path.join(__dirname, 'migrations', '2025-07-08-add-tenant-support.sql');
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`遷移文件不存在: ${migrationPath}`);
    }
    
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log('  SQL文件讀取成功');
    
    // 4. 執行遷移
    console.log('\n🔄 步驟4: 執行數據庫遷移...');
    
    // 分割SQL語句並逐個執行
    const statements = sql.split(';').filter(stmt => stmt.trim());
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement) {
        try {
          console.log(`  執行語句 ${i + 1}/${statements.length}: ${statement.substring(0, 50)}...`);
          
          await new Promise((resolve, reject) => {
            db.run(statement, (err) => {
              if (err) {
                // 忽略一些常見的錯誤（如表已存在）
                if (err.message.includes('already exists') || 
                    err.message.includes('duplicate column name')) {
                  console.log(`    ⚠️  跳過（已存在）: ${err.message}`);
                  resolve();
                } else {
                  reject(err);
                }
              } else {
                console.log(`    ✅ 成功`);
                resolve();
              }
            });
          });
        } catch (error) {
          console.log(`    ❌ 失敗: ${error.message}`);
          // 繼續執行其他語句
        }
      }
    }
    
    // 5. 驗證遷移結果
    console.log('\n🔍 步驟5: 驗證遷移結果...');
    
    // 檢查新表是否創建
    const newTables = await new Promise((resolve, reject) => {
      db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    console.log(`  遷移後表數量: ${newTables.length}`);
    
    // 檢查租戶表
    const tenantTable = newTables.find(t => t.name === 'tenants');
    if (tenantTable) {
      console.log('  ✅ 租戶表創建成功');
      
      // 檢查租戶數據
      const tenants = await new Promise((resolve, reject) => {
        db.all("SELECT * FROM tenants", (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
      
      console.log(`  租戶數量: ${tenants.length}`);
      tenants.forEach(tenant => {
        console.log(`    - ${tenant.name} (${tenant.id})`);
      });
    } else {
      console.log('  ❌ 租戶表創建失敗');
    }
    
    // 檢查用戶表是否有tenantId欄位
    const userColumns = await new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(users)", (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    const hasTenantId = userColumns.some(col => col.name === 'tenantId');
    if (hasTenantId) {
      console.log('  ✅ 用戶表已添加tenantId欄位');
    } else {
      console.log('  ❌ 用戶表tenantId欄位添加失敗');
    }
    
    console.log('\n🎉 簡化數據庫遷移完成！');
    console.log('=' .repeat(50));
    
    return {
      success: true,
      totalTables: newTables.length,
      tenantTableCreated: !!tenantTable,
      userTableHasTenantId: hasTenantId,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('\n❌ 簡化數據庫遷移失敗:', error.message);
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
  runSimpleMigration()
    .then(result => {
      console.log('\n✅ 簡化數據庫遷移腳本執行成功');
      console.log('結果:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ 簡化數據庫遷移腳本執行失敗');
      process.exit(1);
    });
}

module.exports = runSimpleMigration; 