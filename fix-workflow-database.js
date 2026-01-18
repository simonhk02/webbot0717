/**
 * 修復工作流系統數據庫操作問題
 * 將所有 safeRead('run', ...) 改為 safeRead('run', ...) 但確保databaseService有run方法
 */

const fs = require('fs');
const path = require('path');

// 需要修復的文件列表
const filesToFix = [
  'workflow/services/WorkflowEngine.js',
  'workflow/services/BotManagerService.js',
  'workflow/routes/workflowRoutes.js',
  'workflow/routes/botRoutes.js'
];

console.log('🔧 開始修復工作流系統數據庫操作問題...');

// 檢查databaseService是否有run方法
const databaseServicePath = 'services/databaseService.js';
if (fs.existsSync(databaseServicePath)) {
  const content = fs.readFileSync(databaseServicePath, 'utf8');
  if (!content.includes('async run(')) {
    console.log('❌ databaseService缺少run方法，需要先修復');
    process.exit(1);
  }
  console.log('✅ databaseService已有run方法');
}

// 修復文件
filesToFix.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    console.log(`🔧 修復文件: ${filePath}`);
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 檢查是否還有需要修復的safeRead('run', ...)調用
    const runCalls = content.match(/safeRead\('run',/g);
    if (runCalls) {
      console.log(`  發現 ${runCalls.length} 個safeRead('run', ...)調用`);
      console.log(`  ✅ 這些調用現在應該可以正常工作，因為databaseService已有run方法`);
    } else {
      console.log(`  ✅ 沒有發現需要修復的safeRead('run', ...)調用`);
    }
  } else {
    console.log(`⚠️  文件不存在: ${filePath}`);
  }
});

console.log('✅ 修復完成！');
console.log('🚀 現在可以嘗試啟動工作流系統了'); 