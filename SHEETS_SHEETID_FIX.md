# Google Sheets 工作表 ID 錯誤修復

## 問題描述

用戶報告 WhatsApp Bot 無法擴展 Google Sheets 工作表行數，出現以下錯誤：

```
error: Invalid requests[0].appendDimension: No grid with id: 0
error: 擴展工作表行數失敗: Invalid requests[0].appendDimension: No grid with id: 0
```

## 根本原因分析

1. **錯誤的工作表 ID**：系統使用了 `sheetId: 0`，但實際上 Google Sheets 的工作表 ID 通常不是 0
2. **缺少調試信息**：無法確認實際獲取到的工作表 ID 值
3. **類型轉換問題**：可能需要將 sheetId 轉換為數字格式

## 修復方案

### 1. 強化調試信息
- 添加工作表列表的完整信息日誌
- 顯示目標工作表的完整屬性
- 記錄 batchUpdate 請求的詳細內容

### 2. 修改 `ensureSheetRowsCapacity` 函數

#### 修改前：
```javascript
const currentRows = sheet.properties.gridProperties.rowCount;
businessLogger.info(`📊 工作表 ${sheetName} 當前行數: ${currentRows}, 需要行數: ${requiredRows}`);

await sheets.spreadsheets.batchUpdate({
  spreadsheetId,
  requestBody: {
    requests: [{
      appendDimension: {
        sheetId: sheet.properties.sheetId,
        dimension: 'ROWS',
        length: additionalRows
      }
    }]
  }
});
```

#### 修改後：
```javascript
const currentRows = sheet.properties.gridProperties.rowCount;
const sheetId = sheet.properties.sheetId;
businessLogger.info(`📊 工作表 ${sheetName} 當前行數: ${currentRows}, 需要行數: ${requiredRows}, sheetId: ${sheetId}`);
businessLogger.info(`✅ 找到目標工作表: ${sheetName}, 完整屬性: ${JSON.stringify(sheet.properties)}`);

const batchUpdateRequest = {
  spreadsheetId,
  requestBody: {
    requests: [{
      appendDimension: {
        sheetId: parseInt(sheetId),
        dimension: 'ROWS',
        length: additionalRows
      }
    }]
  }
};

businessLogger.info(`📤 發送 batchUpdate 請求: ${JSON.stringify(batchUpdateRequest.requestBody)}`);
await sheets.spreadsheets.batchUpdate(batchUpdateRequest);
```

### 3. 改進 API 欄位獲取
```javascript
fields: 'sheets(properties(title,sheetId,gridProperties))'
```

### 4. 增強工作表信息顯示
```javascript
businessLogger.info(`🔍 工作表列表: ${JSON.stringify(sheetResponse.data.sheets.map(s => ({
  title: s.properties.title, 
  sheetId: s.properties.sheetId, 
  rowCount: s.properties.gridProperties.rowCount
})))}`);
```

## 技術改進點

1. **明確的類型轉換**：使用 `parseInt(sheetId)` 確保 ID 為數字格式
2. **詳細的請求日誌**：記錄完整的 batchUpdate 請求內容
3. **完整的工作表信息**：顯示所有相關屬性以便調試
4. **錯誤信息優化**：提供更詳細的錯誤上下文

## 驗證方法

1. 重新啟動應用程式
2. 上傳圖片觸發工作表寫入
3. 觀察日誌中的工作表 ID 信息
4. 確認 batchUpdate 請求成功執行

## 預期效果

- 正確獲取和使用工作表的實際 ID
- 成功擴展 Google Sheets 行數
- 提供詳細的調試日誌協助故障排除
- 解決 "No grid with id: 0" 錯誤

## 相關文件

- `googleService.js`：主要修復文件
- `test-sheets-id-fix.js`：測試腳本
- `SHEETS_CAPACITY_FIX.md`：相關的行數擴展修復

## 測試結果

待用戶測試驗證修復效果。 