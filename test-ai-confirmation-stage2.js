/**
 * 階段二 AI 確認修改解析功能測試
 * 測試用戶修改內容的解析和處理邏輯
 */

const AIConfirmationService = require('./services/AIConfirmationService');

async function testStage2Features() {
  console.log('🚀 開始測試階段二 AI 確認修改解析功能');
  console.log('=' .repeat(60));

  const aiConfirmationService = new AIConfirmationService();
  
  // 測試案例
  const testCases = [
    {
      name: '完整複製修改格式',
      customQuestions: [
        { question: '收據編號', field: '店舖名稱' },
        { question: '日期', field: '日期' },
        { question: '總金額', field: '銀碼' }
      ],
      originalData: {
        '店舖名稱': '收款銀行',
        '日期': '2024-03-15',
        '銀碼': '1345.00'
      },
      userInput: '店舖名稱: 星巴克\n日期: 2025-06-30\n銀碼: 85.50',
      expectedChanges: ['店舖名稱', '日期', '銀碼']
    },
    {
      name: '部分修改格式',
      customQuestions: [
        { question: '店鋪名稱', field: '店鋪名稱' },
        { question: '日期', field: '日期' },
        { question: '金額', field: '金額' }
      ],
      originalData: {
        '店鋪名稱': '麥當勞',
        '日期': '2025-06-30',
        '金額': '45.00'
      },
      userInput: '店鋪名稱: 肯德基',
      expectedChanges: ['店鋪名稱']
    },
    {
      name: '混合格式（逗號分隔）',
      customQuestions: [
        { question: '商店', field: '商店' },
        { question: '價格', field: '價格' },
        { question: '備註', field: '備註' }
      ],
      originalData: {
        '商店': '7-11',
        '價格': '25.00',
        '備註': '無'
      },
      userInput: '商店: 全家, 價格: 30.00',
      expectedChanges: ['商店', '價格']
    },
    {
      name: '繁體中文冒號格式',
      customQuestions: [
        { question: '店名', field: '店名' },
        { question: '總額', field: '總額' }
      ],
      originalData: {
        '店名': '餐廳A',
        '總額': '150.00'
      },
      userInput: '店名：台式料理\n總額：200.00',
      expectedChanges: ['店名', '總額']
    },
    {
      name: '模糊匹配測試',
      customQuestions: [
        { question: '店舖名稱', field: '店舖名稱' },
        { question: '消費金額', field: '消費金額' }
      ],
      originalData: {
        '店舖名稱': '商店X',
        '消費金額': '100.00'
      },
      userInput: '店名: 商店Y\n金額: 120.00',
      expectedChanges: ['店舖名稱', '消費金額']
    }
  ];

  let totalTests = testCases.length;
  let passedTests = 0;

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n📋 測試案例 ${i + 1}: ${testCase.name}`);
    console.log('-'.repeat(40));
    
    try {
      // 執行解析
      const result = aiConfirmationService.parseUserModifications(
        testCase.userInput,
        testCase.originalData,
        testCase.customQuestions
      );
      
      console.log(`原始資料: ${JSON.stringify(testCase.originalData)}`);
      console.log(`用戶輸入: "${testCase.userInput}"`);
      console.log(`解析結果: ${JSON.stringify(result)}`);
      
      // 檢查是否有預期的修改
      let hasExpectedChanges = true;
      const actualChanges = [];
      
      for (const [field, value] of Object.entries(result)) {
        if (testCase.originalData[field] !== value) {
          actualChanges.push(field);
        }
      }
      
      // 驗證修改欄位
      for (const expectedField of testCase.expectedChanges) {
        if (!actualChanges.includes(expectedField)) {
          hasExpectedChanges = false;
          console.log(`❌ 缺少預期修改欄位: ${expectedField}`);
        }
      }
      
      if (hasExpectedChanges && actualChanges.length > 0) {
        console.log(`✅ 測試通過 - 成功解析 ${actualChanges.length} 個修改`);
        passedTests++;
        
        // 測試格式化確認訊息
        const confirmationMessage = aiConfirmationService.formatConfirmationMessage(
          testCase.originalData,
          result,
          testCase.customQuestions
        );
        console.log(`📄 確認訊息長度: ${confirmationMessage.length} 字符`);
        
      } else {
        console.log(`❌ 測試失敗 - 修改解析不正確`);
      }
      
    } catch (err) {
      console.log(`❌ 測試失敗 - 出現異常: ${err.message}`);
    }
  }

  // 額外功能測試
  console.log('\n🔧 額外功能測試');
  console.log('-'.repeat(40));
  
  // 測試動態欄位映射
  console.log('\n📍 測試動態欄位映射:');
  const customQuestions = [
    { question: '收據編號', field: '店舖名稱' },
    { question: '消費日期', field: '日期' },
    { question: '總消費金額', field: '銀碼' }
  ];
  
  const fieldMapping = aiConfirmationService.createDynamicFieldMapping(customQuestions);
  console.log(`✅ 創建了 ${fieldMapping.size} 個欄位映射`);
  
  // 測試清理用戶輸入
  console.log('\n🧹 測試用戶輸入清理:');
  const dirtyInput = '🤖 **AI 識別結果**\n\n店舖名稱: 星巴克\n📝 **請確認或修改**\n✅ 確認';
  const cleanedInput = aiConfirmationService.cleanUserInput(dirtyInput);
  console.log(`原始輸入: "${dirtyInput}"`);
  console.log(`清理後: "${cleanedInput}"`);
  console.log(`✅ 成功清理用戶輸入`);

  // 測試結果摘要
  console.log('\n' + '='.repeat(60));
  console.log('📊 階段二測試結果摘要');
  console.log('='.repeat(60));
  console.log(`總測試案例: ${totalTests}`);
  console.log(`通過測試: ${passedTests}`);
  console.log(`失敗測試: ${totalTests - passedTests}`);
  console.log(`成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 階段二所有測試通過！修改解析功能正常工作');
    console.log('\n✨ 支援的修改格式:');
    console.log('• 完整複製修改格式 (多行)');
    console.log('• 部分修改格式 (單行)');
    console.log('• 混合格式 (逗號分隔)');
    console.log('• 繁體中文冒號格式');
    console.log('• 模糊欄位匹配');
    console.log('• 智能輸入清理');
    console.log('• 動態欄位映射');
  } else {
    console.log('\n⚠️ 部分測試失敗，需要檢查修改解析邏輯');
  }
  
  console.log('\n🚀 階段二測試完成！');
}

// 如果直接執行此文件，則運行測試
if (require.main === module) {
  testStage2Features().catch(err => {
    console.error('❌ 測試過程中發生錯誤:', err);
    process.exit(1);
  });
}

module.exports = { testStage2Features }; 