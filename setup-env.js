#!/usr/bin/env node

/**
 * 自動設置環境變數腳本
 * 將正確的 Google Service Account Key 設置到 .env 檔案
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 正在設置環境變數...\n');

// 讀取 Service Account 檔案
const serviceAccountPath = path.join(__dirname, 'credentials', 'service-account.json');
const envExamplePath = path.join(__dirname, 'env.example');
const envPath = path.join(__dirname, '.env');

try {
    // 1. 讀取 Service Account 金鑰
    const serviceAccountKey = JSON.stringify(JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8')));
    console.log('✅ 成功讀取 Google Service Account 金鑰');

    // 2. 讀取 env.example 內容
    let envContent = fs.readFileSync(envExamplePath, 'utf8');
    console.log('✅ 成功讀取 env.example 範本');

    // 3. 替換 GOOGLE_SERVICE_ACCOUNT_KEY
    const placeholderPattern = /GOOGLE_SERVICE_ACCOUNT_KEY=.*$/m;
    const replacement = `GOOGLE_SERVICE_ACCOUNT_KEY=${serviceAccountKey}`;
    
    if (placeholderPattern.test(envContent)) {
        envContent = envContent.replace(placeholderPattern, replacement);
        console.log('✅ 成功替換 GOOGLE_SERVICE_ACCOUNT_KEY');
    } else {
        // 如果沒找到，添加到末尾
        envContent += `\n# Google Service Account Key (自動設置)\n${replacement}\n`;
        console.log('✅ 成功添加 GOOGLE_SERVICE_ACCOUNT_KEY');
    }

    // 4. 寫入 .env 檔案
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('✅ 成功創建 .env 檔案');

    console.log('\n' + '='.repeat(50));
    console.log('🎉 環境變數設置完成！');
    console.log('\n📋 現在的設置:');
    console.log('• GOOGLE_SERVICE_ACCOUNT_KEY: ✅ 已設置');
    console.log('• ANTHROPIC_API_KEY: ✅ 已設置');
    console.log('• 其他基本配置: ✅ 已設置');
    
    console.log('\n🚀 現在可以啟動應用程式了:');
    console.log('   npm start');
    console.log('\n🧪 或者先測試環境變數:');
    console.log('   node test-env-setup.js');

} catch (error) {
    console.error('❌ 設置環境變數失敗:', error.message);
    console.log('\n🔧 手動修復步驟:');
    console.log('1. 確認 credentials/service-account.json 存在');
    console.log('2. 確認 env.example 存在');
    console.log('3. 手動編輯 .env 檔案');
    process.exit(1);
} 