const invoiceService = require('./invoiceService');
const fs = require('fs');
const path = require('path');

// 測試數據
const testData = {
  date: '2024-03-10',
  amount: '1000.00',
  description: '測試發票',
  imageUrl: null // 可以添加測試圖片路徑
};

// 測試 Google Drive 文件夾 ID
const TEST_FOLDER_ID = 'your-test-folder-id';

async function runTests() {
  try {
    console.log('開始測試發票服務...');

    // 測試生成發票編號
    const invoiceNumber = invoiceService.generateInvoiceNumber();
    console.log('生成的發票編號:', invoiceNumber);
    console.assert(invoiceNumber.startsWith('INV'), '發票編號應該以 INV 開頭');

    // 測試生成 PDF
    console.log('測試生成 PDF...');
    const pdfPath = await invoiceService.generatePDF({
      ...testData,
      invoiceNumber
    });
    console.log('PDF 生成成功:', pdfPath);
    console.assert(fs.existsSync(pdfPath), 'PDF 文件應該存在');

    // 測試上傳到 Google Drive
    console.log('測試上傳到 Google Drive...');
    const fileUrl = await invoiceService.uploadToDrive(pdfPath, TEST_FOLDER_ID);
    console.log('文件上傳成功:', fileUrl);
    console.assert(fileUrl.startsWith('https://'), '應該返回有效的文件 URL');

    // 測試完整流程
    console.log('測試完整流程...');
    const completeUrl = await invoiceService.generateAndUploadInvoice(testData, TEST_FOLDER_ID);
    console.log('完整流程測試成功:', completeUrl);

    console.log('所有測試完成！');
  } catch (error) {
    console.error('測試失敗:', error);
  }
}

// 運行測試
runTests(); 