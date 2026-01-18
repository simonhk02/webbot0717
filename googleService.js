const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const pRetry = require("p-retry").default;
const { businessLogger } = require("./utils/logger");

// 自定義錯誤類
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

class ApiError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

function handleError(error, context) {
  businessLogger.error(`${context} 錯誤: ${error.message}`, { stack: error.stack });
  return { error: error.message };
}

// Google 認證
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, "credentials", "service-account.json"),
  scopes: [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
  ],
});

// 上傳圖片到 Google Drive
async function uploadImageToDrive(base64Data, mimeType, filename, folderId) {
  const drive = google.drive({ version: "v3", auth });
  const context = "Google Drive 圖片上傳";

  try {
    if (!folderId || folderId.length < 20) {
      throw new ValidationError(`無效的 Google Drive 文件夾 ID: ${folderId}`);
    }

    const buffer = Buffer.from(base64Data, "base64");
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const fileMetadata = {
      name: filename,
      parents: [folderId],
    };
    const media = {
      mimeType,
      body: stream,
    };

    const res = await pRetry(
      async () => {
        return await drive.files.create({
          resource: fileMetadata,
          media,
          fields: "id, webViewLink",
        });
      },
      {
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 5000,
        onFailedAttempt: (err) => {
          businessLogger.error(`Drive API 重試: ${err.message}`);
        },
      }
    );

    await drive.permissions.create({
      fileId: res.data.id,
      requestBody: { role: "reader", type: "anyone" },
    });

    businessLogger.info(
      `✅ 圖片上傳成功，ID: ${res.data.id}, 連結: ${res.data.webViewLink}, 檔案名稱: ${filename}`
    );
    return res.data.webViewLink;
  } catch (err) {
    const errorResponse = handleError(
      new ApiError(`圖片上傳失敗：${err.message}`, 500),
      context
    );
    throw new Error(errorResponse.error);
  }
}

// 讀取現有表頭（第一行）
async function getExistingHeaders(sheets, spreadsheetId, sheetName) {
  const context = "Google Sheets 獲取表頭";
  try {
    const response = await pRetry(
      async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A1:Z1`,
        });
      },
      {
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 5000,
        onFailedAttempt: (err) => {
          businessLogger.error(`Sheets API 重試: ${err.message}`);
        },
      }
    );
    return response.data.values ? response.data.values[0] : [];
  } catch (error) {
    handleError(new ApiError(`獲取表頭失敗: ${error.message}`, 500), context);
    return [];
  }
}

// 搵下一個可用行（修改為追加到最後一行）
async function getNextRowIndex(sheets, spreadsheetId, sheetName) {
  // 搜索較大範圍以確保找到所有資料
  const dataRange = `${sheetName}!A2:Z1000`;
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: dataRange,
    });
    const dataRows = response.data.values || [];
    
    // 找到最後一行有資料的行號
    let lastDataRowIndex = 1; // 從第1行開始（表頭行）
    
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      // 檢查這一行是否有任何非空資料
      if (row && row.some(cell => cell && cell.toString().trim() !== '')) {
        lastDataRowIndex = 2 + i; // +2 因為資料從第2行開始，索引從0開始
      }
    }
    
    // 下一個可用行是最後一行資料的下一行
    const nextRowIndex = lastDataRowIndex + 1;
    
    businessLogger.info(`✅ 找到最後一行資料: ${lastDataRowIndex}, 下一個可用行: ${nextRowIndex}`);
    return nextRowIndex;
  } catch (error) {
    businessLogger.error(`獲取下一個可用行失敗: ${error.message}`);
    return 2; // 默認從第二行開始
  }
}

// 寫入/更新表頭
async function createHeaders(sheets, spreadsheetId, sheetName, headers) {
  const context = "Google Sheets 創建表頭";
  try {
    await pRetry(
      async () => {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!A1`,
          valueInputOption: "RAW",
          resource: { values: [headers] },
        });
      },
      {
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 5000,
        onFailedAttempt: (err) => {
          businessLogger.error(`Sheets API 重試: ${err.message}`);
        },
      }
    );
    businessLogger.info(`✅ 已在第 1 行創建表頭: ${headers}`);
    return true;
  } catch (error) {
    handleError(new ApiError(`創建表頭失敗: ${error.message}`, 500), context);
    return false;
  }
}

// 檢查並擴展 Google Sheets 行數
async function ensureSheetRowsCapacity(sheets, spreadsheetId, sheetName, requiredRows) {
  const context = "Google Sheets 擴展行數";
  try {
    // 獲取工作表的元數據
    const sheetResponse = await pRetry(
      async () => {
        return await sheets.spreadsheets.get({
          spreadsheetId,
          fields: 'sheets(properties(title,sheetId,gridProperties))'
        });
      },
      {
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 5000,
        onFailedAttempt: (err) => {
          businessLogger.error(`Sheets API 重試: ${err.message}`);
        },
      }
    );

    businessLogger.info(`🔍 工作表列表: ${JSON.stringify(sheetResponse.data.sheets.map(s => ({title: s.properties.title, sheetId: s.properties.sheetId, rowCount: s.properties.gridProperties.rowCount})))}`);

    const sheet = sheetResponse.data.sheets.find(s => s.properties.title === sheetName);
    if (!sheet) {
      throw new Error(`找不到工作表: ${sheetName}，可用工作表: ${sheetResponse.data.sheets.map(s => s.properties.title).join(', ')}`);
    }
    
    businessLogger.info(`✅ 找到目標工作表: ${sheetName}, 完整屬性: ${JSON.stringify(sheet.properties)}`);

    const currentRows = sheet.properties.gridProperties.rowCount;
    const sheetId = sheet.properties.sheetId;
    businessLogger.info(`📊 工作表 ${sheetName} 當前行數: ${currentRows}, 需要行數: ${requiredRows}, sheetId: ${sheetId}`);

    if (currentRows < requiredRows) {
      const additionalRows = requiredRows - currentRows + 10; // 額外添加10行作為緩衝
      businessLogger.info(`🔧 需要擴展工作表，添加 ${additionalRows} 行`);

      businessLogger.info(`🔧 準備擴展工作表，sheetId: ${sheetId}, 添加行數: ${additionalRows}`);
      
      await pRetry(
        async () => {
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
          
          return await sheets.spreadsheets.batchUpdate(batchUpdateRequest);
        },
        {
          retries: 3,
          factor: 2,
          minTimeout: 1000,
          maxTimeout: 5000,
          onFailedAttempt: (err) => {
            businessLogger.error(`Sheets API 重試: ${err.message}`);
          },
        }
      );

      businessLogger.info(`✅ 成功擴展工作表 ${sheetName}，新增 ${additionalRows} 行`);
      return true;
    } else {
      businessLogger.info(`✅ 工作表 ${sheetName} 已有足夠行數`);
      return true;
    }
  } catch (error) {
    businessLogger.error(`擴展工作表行數失敗: ${error.message}`);
    handleError(new ApiError(`擴展工作表行數失敗: ${error.message}`, 500), context);
    return false;
  }
}

// 動態寫入數據到正確欄位
async function writeToSheet(sheetId, sheetName, answers, fields) {
  const sheets = google.sheets({ version: "v4", auth });
  const context = "Google Sheets 寫入";
  try {
    if (!sheetId || !sheetName) {
      throw new ValidationError(
        `無效的 Google Sheet ID 或 Sheet 名稱: ${sheetId}, ${sheetName}`
      );
    }

    // 確保 imageUrl 包含喺表頭
    const uniqueFields = [...new Set([...fields.filter((f) => f !== "imageUrl"), "imageUrl"])];
    const requiredFields = uniqueFields;

    // 獲取現有表頭
    let headers = await getExistingHeaders(sheets, sheetId, sheetName);
    const hasRequiredField = headers.some((cell) => requiredFields.includes(cell));
    businessLogger.info(`📋 第一行表頭: ${headers}, 是否包含所需欄位: ${hasRequiredField}`);

    // 如果表頭無所需欄位，創建新表頭
    if (!hasRequiredField) {
      headers = requiredFields;
      await sheets.spreadsheets.values.clear({
        spreadsheetId: sheetId,
        range: `${sheetName}!A1:Z1`,
      });
      await createHeaders(sheets, sheetId, sheetName, headers);
    } else {
      // 檢查缺少欄位並追加
      const newFields = requiredFields.filter((field) => !headers.includes(field));
      if (newFields.length > 0) {
        headers = [...headers, ...newFields];
        await createHeaders(sheets, sheetId, sheetName, headers);
        businessLogger.info(`✅ 已更新表頭，新增欄位: ${newFields}`);
      }
    }

    // 搵下一個可用行
    const nextRowIndex = await getNextRowIndex(sheets, sheetId, sheetName);

    // 確保工作表有足夠的行數
    const rowsCapacityEnsured = await ensureSheetRowsCapacity(sheets, sheetId, sheetName, nextRowIndex);
    if (!rowsCapacityEnsured) {
      throw new ValidationError(`無法擴展工作表行數到第 ${nextRowIndex} 行`);
    }

    // 準備數據
    const rowData = new Array(headers.length).fill("");
    headers.forEach((header, index) => {
      if (header === "imageUrl") {
        rowData[index] = answers.imageUrl || "";
      } else {
        rowData[index] = answers[header] || "";
      }
    });

    // 寫入數據
    const writeRange = `${sheetName}!A${nextRowIndex}`;
    const writeResponse = await pRetry(
      async () => {
        return await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: writeRange,
          valueInputOption: "USER_ENTERED",
          resource: { values: [rowData] },
        });
      },
      {
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 5000,
        onFailedAttempt: (err) => {
          businessLogger.error(`Sheets API 重試: ${err.message}`);
        },
      }
    );

    businessLogger.info(`✅ 已將資料寫入第 ${nextRowIndex} 行: ${rowData}`);
    return writeResponse.status === 200 || writeResponse.status === 201;
  } catch (err) {
    const errorResponse = handleError(
      new ApiError(`寫入 Google Sheet 失敗：${err.message}`, 500),
      context
    );
    throw new Error(errorResponse.error);
  }
}

module.exports = {
  uploadImageToDrive,
  writeToSheet,
  getExistingHeaders,
  createHeaders,
  ensureSheetRowsCapacity,
};