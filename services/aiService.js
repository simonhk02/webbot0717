require('dotenv').config();
const axios = require('axios');
const sharp = require('sharp');
const winston = require('winston');
const db = require('../database');
const { businessLogger } = require('../utils/logger');

// 設定 API 密鑰和端點
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

class AIService {
  constructor() {
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      businessLogger.warn('AI 服務已初始化，跳過重複初始化');
      return;
    }

    try {
      // 檢查 API 密鑰
      if (!ANTHROPIC_API_KEY) {
        businessLogger.warn('未設定 ANTHROPIC_API_KEY，AI 功能將無法使用');
      } else {
        businessLogger.info('AI 服務配置檢查完成');
      }

      this.isInitialized = true;
      businessLogger.info('AI 服務初始化完成');
    } catch (err) {
      businessLogger.error(`AI 服務初始化失敗：${err.message}`);
      throw err;
    }
  }

  async cleanup() {
    businessLogger.info('AI 服務清理完成');
  }

  async healthCheck() {
    return {
      status: 'healthy',
      service: 'AI',
      timestamp: new Date().toISOString(),
      details: {
        isInitialized: this.isInitialized,
        hasApiKey: !!ANTHROPIC_API_KEY
      }
    };
  }

  async recognizeImage(imageBuffer, userId) {
    return recognizeImage(imageBuffer, userId);
  }
}

/**
 * 圖片識別主函數，使用 Claude 3 Haiku API
 * @param {Buffer} imageBuffer - 圖片 buffer
 * @param {string} userId - 用戶 ID，用於讀取 customQuestions
 * @returns {Promise<Object>} - 識別結果，包含原始文字和解析後的資料
 */
async function recognizeImage(imageBuffer, userId) {
  try {
    businessLogger.info(`用戶 ${userId} 開始使用 Claude 3 Haiku 進行圖片識別`);

    const customQuestions = await getCustomQuestions(userId);
    if (!customQuestions.length) {
      businessLogger.warn(`用戶 ${userId} 無有效 customQuestions`);
      return { rawText: '', parsedData: null };
    }

    // 檢查並預處理圖片
    const maxSize = 1024 * 1024; // 1MB
    let processedBuffer = imageBuffer;
    if (imageBuffer.length > maxSize || true) { // 強制預處理以提高清晰度
      businessLogger.info(`用戶 ${userId} 圖片大小 ${imageBuffer.length} 字節，進行預處理`);
      processedBuffer = await sharp(imageBuffer)
        .resize({ width: 1024, withoutEnlargement: true })
        .jpeg({ quality: 90 }) // 提高品質
        .sharpen() // 增強銳度
        .toBuffer();
      businessLogger.info(`預處理後圖片大小：${processedBuffer.length} 字節`);
    }

    const base64Image = processedBuffer.toString('base64');
    if (!base64Image || base64Image.length === 0) {
      throw new Error('圖片 base64 編碼失敗');
    }

    // 動態生成提示，包含用戶自訂的 prompts
    const fieldsDescription = customQuestions.map(q => {
      // 只有當 prompts 有內容時，才加入提示
      const promptHint = q.prompts ? `\n    * 指引: ${q.prompts}` : '';
      return `  - 欄位 "${q.field}": 負責提取 "${q.question}"。${promptHint}`;
    }).join('\n');

    const prompt = `
您是一位專業的數據錄入員，專門從收據圖片中提取信息並以JSON格式輸出。

請根據以下定義的欄位和提取指引，分析提供的收據圖片：

${fieldsDescription}

通用規則：
-嚴格遵循每個欄位的提取指引。
- 金額：僅返回數字和小數點 (例如 HK$100.50 應返回 100.50)。
- 日期：統一為 YYYY-MM-DD 格式 (例如 15/03/2025 應返回 2025-03-15) 如無日期 預設為今天日期。
- 如果根據指引也無法找到對應內容，請返回空字符串 ""。
- 請特別注意識別繁體中文。

輸出要求：
嚴格只返回一個完整的JSON對象，不要包含任何額外的說明、註釋或非JSON內容。
JSON結構範例: {${customQuestions.map(q => `"${q.field}": "範例值"`).join(', ')}}
`;

    // 發送請求到 Claude API
    businessLogger.info(`發送 Claude 請求，模型=claude-3-haiku-20240307`);
    // 為了方便調試，臨時將 prompt 記錄在 info 級別
    businessLogger.info(`Claude Prompt: ${prompt}`);
    const response = await axios.post(CLAUDE_API_URL, {
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024, // 增加 token 限制以容納更複雜的 prompt
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: base64Image
              }
            }
          ]
        }
      ],
      temperature: 0.1, // 降低 temperature 讓輸出更穩定
      stop_sequences: ["}"] // 增加 stop sequence 確保返回完整的 JSON
    }, {
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
        'Content-Type': 'application/json'
      }
    });

    const result = response.data.content[0].text;
    let parsedData;
    try {
        // 首先嘗試直接解析
        parsedData = JSON.parse(result.trim());
    } catch (parseErr) {
        businessLogger.warn(`用戶 ${userId} 直接解析 Claude 回應失敗，嘗試提取 JSON 部分`);
        
        // 修復可能被截斷的JSON
        let jsonStr = result.trim();
        if (!jsonStr.endsWith('}')) {
            jsonStr += '}';
        }
        
        try {
            parsedData = JSON.parse(jsonStr);
            businessLogger.info(`用戶 ${userId} 修復並解析JSON成功`);
        } catch (fixErr) {
            // 如果修復後還是失敗，嘗試使用正則表達式
            const jsonMatch = result.match(/\{[\s\S]*?\}/g);
            if (jsonMatch) {
                try {
                    // 取最後一個匹配（通常是最完整的）
                    const lastMatch = jsonMatch[jsonMatch.length - 1];
                    parsedData = JSON.parse(lastMatch);
                    businessLogger.info(`用戶 ${userId} 使用正則提取JSON成功`);
                } catch (regexErr) {
                    businessLogger.error(`用戶 ${userId} 提取 JSON 部分失敗: ${regexErr.message}, 原始回應: ${result}`);
                    throw new Error('Claude 回應格式無效');
                }
            } else {
                businessLogger.error(`用戶 ${userId} 無法提取 JSON 部分，原始回應: ${result}`);
                throw new Error('Claude 回應格式無效');
            }
        }
    }

    // 驗證返回數據
    const expectedFields = new Set(customQuestions.map(q => q.field));
    const returnedFields = new Set(Object.keys(parsedData));
    if (![...expectedFields].every(field => returnedFields.has(field))) {
      businessLogger.warn(`用戶 ${userId} 返回的字段不完整，預期：${[...expectedFields].join(', ')}, 實際：${[...returnedFields].join(', ')}`);
      const finalData = {};
      customQuestions.forEach(q => {
        finalData[q.field] = parsedData[q.field] || '';
      });
      parsedData = finalData;
    }

    // 簡單驗證金額格式
    if (parsedData.amount && !/^\d+(\.\d{1,2})?$/.test(parsedData.amount)) {
      businessLogger.warn(`用戶 ${userId} 返回的金額格式無效：${parsedData.amount}`);
      throw new Error('金額格式無效');
    }

    businessLogger.info(`用戶 ${userId} Claude 解析後的資料：${JSON.stringify(parsedData)}`);
    return { rawText: 'OCR by Claude Haiku', parsedData };
  } catch (err) {
    businessLogger.error(`用戶 ${userId} Claude 識別失敗: ${err.message} - ${JSON.stringify(err.response?.data || '無回應數據')}`);
    if (err.response?.status === 400) {
      businessLogger.warn('400 錯誤，可能因請求格式或圖片數據問題，請檢查 prompt 或 base64 編碼');
    } else if (err.response?.status === 401) {
      businessLogger.warn('401 錯誤，請檢查 ANTHROPIC_API_KEY');
    } else if (err.response?.status === 403) {
      businessLogger.warn('403 錯誤，API 金鑰無效或無權限，請檢查 ANTHROPIC_API_KEY');
    } else if (err.response?.status === 404) {
      businessLogger.warn('404 錯誤，請確認 CLAUDE_API_URL');
    } else if (err.response?.status === 422) {
      businessLogger.warn('422 錯誤，模型可能不支持圖片，請確認 claude-3-haiku-20240307');
    }
    throw err;
  }
}

/**
 * 從資料庫讀取用戶的 customQuestions
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Array>} - customQuestions 陣列
 */
async function getCustomQuestions(userId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT customQuestions FROM users WHERE userId = ?', [userId], (err, row) => {
      if (err) {
        businessLogger.error(`用戶 ${userId} 讀取 customQuestions 失敗: ${err.message}`);
        return reject(err);
      }
      if (!row) {
        businessLogger.warn(`用戶 ${userId} 不存在`);
        return resolve([]);
      }
      try {
        const customQuestions = row.customQuestions ? JSON.parse(row.customQuestions) : [];
        businessLogger.info(`用戶 ${userId} customQuestions: ${JSON.stringify(customQuestions)}`);
        resolve(customQuestions.filter(q => q.field && q.question));
      } catch (parseErr) {
        businessLogger.error(`用戶 ${userId} 解析 customQuestions 失敗: ${parseErr.message}`);
        resolve([]);
      }
    });
  });
}

module.exports = AIService;