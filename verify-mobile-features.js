const fs = require('fs');
const path = require('path');

// 顏色輸出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

let totalChecks = 0;
let passedChecks = 0;

function checkFeature(name, condition, details = '') {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`${colors.green}✅ ${name}${colors.reset}`);
    if (details) console.log(`   ${colors.blue}${details}${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ ${name}${colors.reset}`);
    if (details) console.log(`   ${colors.yellow}${details}${colors.reset}`);
  }
}

function verifyMobileFeatures() {
  console.log(`${colors.cyan}🚀 驗證移動端用戶體驗功能...${colors.reset}\n`);
  
  try {
    // 讀取 settings.html 文件
    const settingsPath = path.join(__dirname, 'public', 'settings.html');
    const content = fs.readFileSync(settingsPath, 'utf8');
    
    // 1. 檢查移動端 CSS 樣式
    console.log(`${colors.magenta}📱 移動端 CSS 樣式檢查${colors.reset}`);
    checkFeature(
      '移動端媒體查詢',
      content.includes('@media (max-width: 640px)'),
      '支援 640px 以下的移動端設備'
    );
    
    checkFeature(
      '快捷操作區域樣式',
      content.includes('.mobile-quick-actions'),
      '固定在右下角的快捷操作按鈕'
    );
    
    checkFeature(
      '觸摸友好設計',
      content.includes('.thumb-friendly') && content.includes('min-height: 48px'),
      '按鈕尺寸符合觸摸友好標準'
    );
    
    checkFeature(
      '震動反饋樣式',
      content.includes('.vibrate-on-touch') && content.includes('@keyframes vibrate'),
      '觸摸時的視覺震動效果'
    );
    
    checkFeature(
      '模板卡片樣式',
      content.includes('.template-card') && content.includes('linear-gradient'),
      '美觀的漸變模板卡片設計'
    );
    
    console.log('');
    
    // 2. 檢查 HTML 結構
    console.log(`${colors.magenta}🏗️ HTML 結構檢查${colors.reset}`);
    checkFeature(
      '移動端快捷操作區',
      content.includes('id="mobileQuickActions"') && content.includes('block sm:hidden'),
      '只在移動端顯示的快捷操作區域'
    );
    
    checkFeature(
      '快速保存按鈕',
      content.includes('id="quickSave"') && content.includes('title="快速保存"'),
      '移動端專用的快速保存功能'
    );
    
    checkFeature(
      '快速測試按鈕',
      content.includes('id="quickTest"') && content.includes('title="測試連接"'),
      '一鍵測試所有連接狀態'
    );
    
    checkFeature(
      '快速模板按鈕',
      content.includes('id="quickTemplate"') && content.includes('title="快速模板"'),
      '快速選擇和應用模板'
    );
    
    checkFeature(
      '模板選擇器',
      content.includes('id="templateModal"') && content.includes('animate-slide-up'),
      '從底部滑入的模板選擇器'
    );
    
    console.log('');
    
    // 3. 檢查模板系統
    console.log(`${colors.magenta}🎯 一鍵模板系統檢查${colors.reset}`);
    checkFeature(
      '個人記帳模板',
      content.includes('data-template="personal"') && content.includes('個人記帳'),
      '適合個人日常開支記錄的模板'
    );
    
    checkFeature(
      '商業報銷模板',
      content.includes('data-template="business"') && content.includes('商業報銷'),
      '企業員工報銷管理模板'
    );
    
    checkFeature(
      '家庭共用模板',
      content.includes('data-template="family"') && content.includes('家庭共用'),
      '家庭成員共同記帳模板'
    );
    
    checkFeature(
      '旅遊記帳模板',
      content.includes('data-template="travel"') && content.includes('旅遊記帳'),
      '旅行開支追蹤模板'
    );
    
    checkFeature(
      '模板配置對象',
      content.includes('const templates = {') && content.includes('messageFormat:'),
      '完整的模板配置系統'
    );
    
    console.log('');
    
    // 4. 檢查 JavaScript 功能
    console.log(`${colors.magenta}⚡ JavaScript 功能檢查${colors.reset}`);
    checkFeature(
      '震動反饋功能',
      content.includes('function vibrate') && content.includes('navigator.vibrate'),
      '支援手機震動反饋'
    );
    
    checkFeature(
      '模板應用功能',
      content.includes('function applyTemplate') && content.includes('template.messageFormat'),
      '一鍵應用模板設置'
    );
    
    checkFeature(
      '模板選擇器功能',
      content.includes('function showTemplateModal') && content.includes('hideTemplateModal'),
      '模板選擇器的顯示和隱藏'
    );
    
    checkFeature(
      '智能變數插入',
      content.includes('data-variable') && content.includes('insertVariable'),
      '點擊插入格式變數功能'
    );
    
    checkFeature(
      '格式預覽功能',
      content.includes('previewFormat') && content.includes('sampleData'),
      '即時預覽訊息格式'
    );
    
    checkFeature(
      '格式助手功能',
      content.includes('formatHelper') && content.includes('可用變數'),
      '格式幫助和指導'
    );
    
    console.log('');
    
    // 5. 檢查用戶體驗增強
    console.log(`${colors.magenta}✨ 用戶體驗增強檢查${colors.reset}`);
    checkFeature(
      '新功能標籤',
      content.includes('新功能') && content.includes('bg-purple-500'),
      '醒目的新功能提示標籤'
    );
    
    checkFeature(
      '智能訊息格式設定',
      content.includes('智能訊息格式設定') && content.includes('格式助手'),
      '增強的訊息格式設定區域'
    );
    
    checkFeature(
      'Emoji 圖標使用',
      content.includes('📅') && content.includes('💰') && content.includes('🏢'),
      '豐富的 Emoji 圖標提升視覺體驗'
    );
    
    checkFeature(
      '觸摸反饋類別',
      content.includes('touch-feedback') && content.includes('-webkit-tap-highlight-color'),
      '完整的觸摸反饋系統'
    );
    
    checkFeature(
      '響應式網格佈局',
      content.includes('grid-cols-1 sm:grid-cols-2') && content.includes('flex-col sm:flex-row'),
      '完美的響應式佈局適配'
    );
    
    console.log('');
    
    // 6. 檢查動畫效果
    console.log(`${colors.magenta}🎪 動畫效果檢查${colors.reset}`);
    checkFeature(
      '滑入動畫',
      content.includes('animate-slide-in') && content.includes('@keyframes slide-in'),
      '元素滑入動畫效果'
    );
    
    checkFeature(
      '彈跳動畫',
      content.includes('animate-bounce-in') && content.includes('@keyframes bounce-in'),
      '元素彈跳進入動畫'
    );
    
    checkFeature(
      '進度條動畫',
      content.includes('progress-shimmer') && content.includes('background-size: 200%'),
      '流光效果的進度條動畫'
    );
    
    checkFeature(
      '模板卡片懸停效果',
      content.includes('template-card::before') && content.includes('left: 100%'),
      '模板卡片的流光懸停效果'
    );
    
    console.log('');
    
  } catch (error) {
    console.error(`${colors.red}❌ 讀取文件失敗: ${error.message}${colors.reset}`);
    return false;
  }
  
  // 輸出總結
  console.log(`${colors.cyan}📊 驗證總結${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`總檢查項目: ${totalChecks}`);
  console.log(`${colors.green}通過: ${passedChecks}${colors.reset}`);
  console.log(`${colors.red}失敗: ${totalChecks - passedChecks}${colors.reset}`);
  console.log(`成功率: ${colors.yellow}${((passedChecks / totalChecks) * 100).toFixed(1)}%${colors.reset}`);
  
  if (passedChecks === totalChecks) {
    console.log(`\n${colors.green}🎉 所有移動端功能驗證通過！${colors.reset}`);
    console.log(`${colors.green}✨ 您的 WhatsApp Bot 現在具備極致的移動端用戶體驗！${colors.reset}`);
  } else if (passedChecks / totalChecks >= 0.9) {
    console.log(`\n${colors.yellow}⚠️ 大部分功能正常，少數項目需要檢查${colors.reset}`);
  } else {
    console.log(`\n${colors.red}❌ 部分功能缺失，需要進一步完善${colors.reset}`);
  }
  
  console.log(`\n${colors.magenta}🌟 移動端功能亮點:${colors.reset}`);
  console.log(`   • 🎯 四種一鍵快速模板 (個人/商業/家庭/旅遊)`);
  console.log(`   • 📱 右下角浮動快捷操作按鈕`);
  console.log(`   • 🎨 智能格式助手和即時預覽`);
  console.log(`   • 📳 觸摸震動反饋 (支援的設備)`);
  console.log(`   • 🎪 現代化動畫和轉場效果`);
  console.log(`   • 👆 大拇指友好的觸控設計 (48px+ 按鈕)`);
  console.log(`   • 🌈 美觀的漸變色彩和 Emoji 圖標`);
  console.log(`   • 📐 完美的響應式佈局適配`);
  console.log(`   • ⚡ 流暢的用戶交互體驗`);
  console.log(`   • 🚀 極致的移動端優化`);
  
  return passedChecks === totalChecks;
}

// 執行驗證
if (require.main === module) {
  verifyMobileFeatures();
}

module.exports = { verifyMobileFeatures }; 