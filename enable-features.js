/**
 * 功能開關啟用腳本
 * 逐步啟用WhatsApp Bot的進階功能
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 開始啟用WhatsApp Bot進階功能...\n');

// 讀取.env檔案
const envPath = path.join(__dirname, '.env');
let envContent = fs.readFileSync(envPath, 'utf8');

// 功能開關配置
const featureSwitches = {
  // 第一階段：基礎V2服務
  'USE_V2_SERVICES': 'true',
  'USE_V2_USER_SERVICE': 'true',
  'USE_V2_AI_SERVICE': 'true',
  'USE_V2_WHATSAPP_SERVICE': 'true',
  
  // 第二階段：適配器層
  'USE_ADAPTER_LAYER': 'true',
  
  // 第三階段：多租戶
  'USE_MULTI_TENANT': 'true',
  
  // 第四階段：監控和安全
  'USE_MONITORING_SYSTEM': 'true',
  'USE_SECURITY_MECHANISMS': 'true',
  
  // 第五階段：熱重載
  'USE_HOT_RELOAD': 'true',
  
  // 保持啟用的功能
  'USE_CACHE_SYSTEM': 'true',
  'USE_DATABASE_OPTIMIZATION': 'true',
  'ENABLE_DEBUG_MODE': 'true',
  'ENABLE_DETAILED_LOGGING': 'true'
};

console.log('📋 將啟用以下功能開關:');
Object.entries(featureSwitches).forEach(([key, value]) => {
  console.log(`  ${key}=${value}`);
});

console.log('\n🔄 更新.env檔案...');

// 更新每個功能開關
Object.entries(featureSwitches).forEach(([key, value]) => {
  const regex = new RegExp(`^${key}=.*$`, 'm');
  const replacement = `${key}=${value}`;
  
  if (envContent.match(regex)) {
    envContent = envContent.replace(regex, replacement);
    console.log(`✅ 已更新: ${key}=${value}`);
  } else {
    console.log(`⚠️  未找到: ${key}`);
  }
});

// 寫回.env檔案
fs.writeFileSync(envPath, envContent, 'utf8');

console.log('\n✅ .env檔案更新完成！');
console.log('\n📋 下一步操作:');
console.log('1. 重新啟動應用程式: node app.js');
console.log('2. 檢查功能是否正常啟用');
console.log('3. 如果一切正常，可以繼續啟用更多功能');

// 驗證更新
console.log('\n🔍 驗證更新結果...');
const updatedContent = fs.readFileSync(envPath, 'utf8');
Object.entries(featureSwitches).forEach(([key, value]) => {
  const regex = new RegExp(`^${key}=${value}$`, 'm');
  if (updatedContent.match(regex)) {
    console.log(`✅ ${key}=${value} 已正確設置`);
  } else {
    console.log(`❌ ${key} 設置可能有問題`);
  }
});

console.log('\n🎉 功能開關啟用完成！'); 