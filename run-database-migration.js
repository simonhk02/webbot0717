/**
 * 數據庫遷移執行腳本
 * 安全地執行數據庫結構改造
 */

const sqlite3 = require('sqlite3').verbose();
const DatabaseMigration = require('./utils/databaseMigration');
const { businessLogger } = require('./utils/logger');

async function runDatabaseMigration() {
  const logger = businessLogger;
  
  console.log('🚀 開始執行數據庫遷移');
  console.log('=' .repeat(50));
  
  let db = null;
  
  try {
    // 1. 連接數據庫
    console.log('📊 步驟1: 連接數據庫...');
    db = new sqlite3.Database('./whatsappBot.db');
    
    // 2. 創建遷移實例
    console.log('🔧 步驟2: 初始化遷移工具...');
    const migration = new DatabaseMigration(db);
    
    // 3. 檢查當前數據庫結構
    console.log('🔍 步驟3: 檢查當前數據庫結構...');
    const currentStructure = await migration.validateDatabaseStructure();
    
    console.log('\n當前數據庫結構:');
    console.log(`  總表數: ${currentStructure.totalTables}`);
    console.log(`  現有表: ${currentStructure.existingTables}`);
    console.log(`  有租戶ID的表: ${currentStructure.tablesWithTenantId}`);
    
    // 4. 檢查遷移狀態
    console.log('\n📋 步驟4: 檢查遷移狀態...');
    const migrationStatus = await migration.getMigrationStatus();
    
    console.log('\n遷移狀態:');
    console.log(`  總遷移文件: ${migrationStatus.total}`);
    console.log(`  已執行: ${migrationStatus.executed}`);
    console.log(`  待執行: ${migrationStatus.pending}`);
    
    if (migrationStatus.pending > 0) {
      console.log('\n待執行的遷移:');
      migrationStatus.pendingFiles.forEach(file => {
        console.log(`  - ${file}`);
      });
    }
    
    // 5. 執行遷移
    if (migrationStatus.pending > 0) {
      console.log('\n🔄 步驟5: 執行數據庫遷移...');
      await migration.runMigrations();
      console.log('✅ 數據庫遷移執行完成');
    } else {
      console.log('\n✅ 所有遷移已完成，無需執行');
    }
    
    // 6. 驗證遷移結果
    console.log('\n🔍 步驟6: 驗證遷移結果...');
    const newStructure = await migration.validateDatabaseStructure();
    
    console.log('\n遷移後數據庫結構:');
    console.log(`  總表數: ${newStructure.totalTables}`);
    console.log(`  現有表: ${newStructure.existingTables}`);
    console.log(`  有租戶ID的表: ${newStructure.tablesWithTenantId}`);
    
    // 7. 檢查租戶數據
    console.log('\n📊 步驟7: 檢查租戶數據...');
    const tenantData = await db.all('SELECT * FROM tenants');
    console.log(`  租戶數量: ${tenantData.length}`);
    
    if (tenantData.length > 0) {
      console.log('  租戶列表:');
      tenantData.forEach(tenant => {
        console.log(`    - ${tenant.name} (${tenant.id}) - ${tenant.status}`);
      });
    }
    
    // 8. 檢查用戶數據
    console.log('\n👥 步驟8: 檢查用戶數據...');
    const userData = await db.all('SELECT COUNT(*) as count, tenantId FROM users GROUP BY tenantId');
    console.log('  用戶分佈:');
    userData.forEach(group => {
      console.log(`    - 租戶 ${group.tenantId}: ${group.count} 個用戶`);
    });
    
    console.log('\n🎉 數據庫遷移完成！');
    console.log('=' .repeat(50));
    
    // 9. 生成總結報告
    const summary = {
      migrationExecuted: migrationStatus.pending > 0,
      tablesWithTenantId: newStructure.tablesWithTenantId,
      totalTenants: tenantData.length,
      totalUsers: userData.reduce((sum, group) => sum + group.count, 0),
      timestamp: new Date().toISOString()
    };
    
    console.log('\n📋 遷移總結:');
    console.log(`  遷移執行: ${summary.migrationExecuted ? '是' : '否'}`);
    console.log(`  有租戶ID的表: ${summary.tablesWithTenantId}`);
    console.log(`  總租戶數: ${summary.totalTenants}`);
    console.log(`  總用戶數: ${summary.totalUsers}`);
    console.log(`  完成時間: ${summary.timestamp}`);
    
    return summary;
    
  } catch (error) {
    console.error('\n❌ 數據庫遷移失敗:', error.message);
    logger.error('數據庫遷移失敗', { error: error.message, stack: error.stack });
    
    // 嘗試回滾
    if (db) {
      try {
        console.log('\n🔄 嘗試回滾最後一次遷移...');
        const migration = new DatabaseMigration(db);
        await migration.rollbackLastMigration();
        console.log('✅ 回滾完成');
      } catch (rollbackError) {
        console.error('❌ 回滾失敗:', rollbackError.message);
      }
    }
    
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
  runDatabaseMigration()
    .then(summary => {
      console.log('\n✅ 數據庫遷移腳本執行成功');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ 數據庫遷移腳本執行失敗');
      process.exit(1);
    });
}

module.exports = runDatabaseMigration; 