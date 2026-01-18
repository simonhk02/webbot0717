const { businessLogger } = require('../utils/logger');

/**
 * AI確認服務
 * 處理AI識別結果的確認和修改邏輯
 */
class AIConfirmationService {
  constructor() {
    this.logger = businessLogger;
  }

  /**
   * 解析用戶修改的內容
   * 支援多種格式：
   * 1. 完整複製格式："店舖名稱: 星巴克\n日期: 2025-06-30\n銀碼: 85.50"
   * 2. 部分修改格式："店舖名稱: 麥當勞"
   * 3. 混合格式："店舖名稱: 星巴克, 銀碼: 100.00"
   */
  parseUserModifications(userInput, originalData, customQuestions = []) {
    this.logger.info(`開始解析用戶修改內容：${userInput.substring(0, 100)}...`);
    
    try {
      // 創建動態欄位映射
      const fieldMapping = this.createDynamicFieldMapping(customQuestions);
      
      // 清理和標準化用戶輸入
      const cleanInput = this.cleanUserInput(userInput);
      
      // 解析修改內容
      const modifications = this.extractModifications(cleanInput, fieldMapping);
      
      // 合併原始資料和修改內容
      const finalData = { ...originalData };
      
      for (const [field, value] of Object.entries(modifications)) {
        if (value !== null && value !== undefined && value !== '') {
          finalData[field] = value;
          this.logger.info(`欄位修改：${field} = ${value}`);
        }
      }
      
      this.logger.info(`解析完成，最終資料：${JSON.stringify(finalData)}`);
      return finalData;
      
    } catch (err) {
      this.logger.error(`解析用戶修改失敗：${err.message}`);
      this.logger.info('使用原始AI識別結果');
      return originalData;
    }
  }

  /**
   * 創建動態欄位映射表
   * 根據用戶的自定義問題生成映射關係
   */
  createDynamicFieldMapping(customQuestions = []) {
    const mapping = new Map();
    
    // 基於自定義問題創建映射
    customQuestions.forEach(q => {
      const field = q.field || q.question;
      const question = q.question || q.field;
      
      // 直接映射
      mapping.set(field.toLowerCase(), field);
      mapping.set(question.toLowerCase(), field);
      
      // 部分匹配映射
      const fieldKeywords = this.extractKeywords(field);
      const questionKeywords = this.extractKeywords(question);
      
      [...fieldKeywords, ...questionKeywords].forEach(keyword => {
        if (keyword.length >= 2) {
          mapping.set(keyword.toLowerCase(), field);
        }
      });
    });
    
    // 通用映射（備用，只在沒有自定義欄位匹配時使用）
    const commonMappings = {
      '店舖': '店舖名稱', '店铺': '店舖名稱', '商店': '店舖名稱', '店名': '店舖名稱',
      '日期': '日期', 'date': '日期', '時間': '日期', '时间': '日期',
      '金額': '銀碼', '金额': '銀碼', '價格': '銀碼', '价格': '銀碼', '總額': '銀碼', '银码': '銀碼',
      '備註': '備註', '备注': '備註', '說明': '備註', '说明': '備註', 'note': '備註'
    };
    
    // 檢查通用映射關鍵詞是否與自定義欄位衝突
    Object.entries(commonMappings).forEach(([key, defaultValue]) => {
      const keyLower = key.toLowerCase();
      
      // 如果這個關鍵詞還沒有被自定義欄位佔用，才添加通用映射
      if (!mapping.has(keyLower)) {
        // 檢查是否有自定義欄位包含這個關鍵詞
        let hasCustomMatch = false;
        customQuestions.forEach(q => {
          const field = q.field || q.question;
          if (field.toLowerCase().includes(key.toLowerCase())) {
            mapping.set(keyLower, field);
            hasCustomMatch = true;
          }
        });
        
        // 如果沒有自定義匹配，才使用通用映射
        if (!hasCustomMatch) {
          mapping.set(keyLower, defaultValue);
        }
      }
    });
    
    this.logger.info(`創建動態欄位映射，共 ${mapping.size} 個映射關係`);
    return mapping;
  }

  /**
   * 清理用戶輸入
   */
  cleanUserInput(input) {
    return input
      .replace(/【.*?】/g, '') // 移除【】標記
      .replace(/\*\*(.*?)\*\*/g, '$1') // 移除**粗體標記
      .replace(/^\s*🤖.*$/gm, '') // 移除AI相關行
      .replace(/^\s*📝.*$/gm, '') // 移除確認相關行
      .replace(/^\s*[✅✏️❌].*$/gm, '') // 移除操作指引行
      .replace(/\n+/g, '\n') // 標準化換行
      .trim();
  }

  /**
   * 提取修改內容
   */
  extractModifications(cleanInput, fieldMapping) {
    const modifications = {};
    const separators = [':', '：', '=', '＝'];
    const lines = cleanInput.split('\n').filter(line => line.trim());
    
    let lastMappedField = null;

    for (const line of lines) {
      let isNewField = false;
      let mappedField = null;
      let value = '';

      // 檢查是否為一個新的欄位
      for (const sep of separators) {
        if (line.includes(sep)) {
          const parts = line.split(sep);
          const potentialKey = parts[0].trim();
          const field = this.mapFieldName(potentialKey, fieldMapping);

          // 判斷是否為有效的新欄位
          if (field) {
            isNewField = true;
            mappedField = field;
            value = parts.slice(1).join(sep).trim();
            break;
          }
        }
      }

      if (isNewField) {
        // 處理新的 key-value 配對
        modifications[mappedField] = value;
        lastMappedField = mappedField;
      } else if (lastMappedField && modifications[lastMappedField] !== undefined) {
        // 處理多行值，將此行附加到上一個欄位
        modifications[lastMappedField] += '\n' + line.trim();
      }
    }
    
    // 清理所有值的頭尾空格
    for (const key in modifications) {
      modifications[key] = modifications[key].trim();
    }

    return modifications;
  }

  /**
   * 映射欄位名稱
   */
  mapFieldName(input, fieldMapping) {
    const cleanKey = input.toLowerCase().trim();
    
    // 直接匹配
    if (fieldMapping.has(cleanKey)) {
      return fieldMapping.get(cleanKey);
    }
    
    // 優先匹配用戶自定義欄位（避免被通用映射覆蓋）
    const customMatches = [];
    const genericMatches = [];
    
    for (const [key, value] of fieldMapping.entries()) {
      const isMatch = cleanKey.includes(key) || key.includes(cleanKey);
      if (isMatch) {
        // 判斷是否為通用映射
        const isGeneric = ['店舖', '店铺', '商店', '店名', '日期', 'date', '時間', '时间', 
                          '金額', '金额', '價格', '价格', '總額', '银码', '備註', '备注', 
                          '說明', '说明', 'note'].includes(key);
        
        if (isGeneric) {
          genericMatches.push([key, value]);
        } else {
          customMatches.push([key, value]);
        }
      }
    }
    
    // 優先返回自定義匹配，否則返回通用匹配
    if (customMatches.length > 0) {
      // 選擇匹配度最高的（關鍵詞長度最長）
      customMatches.sort((a, b) => b[0].length - a[0].length);
      return customMatches[0][1];
    }
    
    if (genericMatches.length > 0) {
      // 選擇匹配度最高的（關鍵詞長度最長）
      genericMatches.sort((a, b) => b[0].length - a[0].length);
      return genericMatches[0][1];
    }
    
    return null;
  }

  /**
   * 智能解析欄位（無分隔符的情況）
   */
  smartParseField(input, fieldMapping) {
    // 嘗試識別常見模式
    const patterns = [
      /^(\d+\.?\d*)\s*$/,  // 純數字 -> 可能是金額
      /^[\d\-\/\.]+$/,      // 日期格式
    ];
    
    // 如果是純數字，可能是金額
    if (/^\d+\.?\d*$/.test(input)) {
      // 在映射中尋找金額相關欄位
      for (const [key, value] of fieldMapping.entries()) {
        if (key.includes('金額') || key.includes('银码') || key.includes('價格')) {
          return { [value]: input };
        }
      }
    }
    
    return null;
  }

  /**
   * 提取關鍵詞
   */
  extractKeywords(text) {
    // 簡單的關鍵詞提取
    return text
      .replace(/[^\w\u4e00-\u9fff]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length >= 2);
  }

  /**
   * 格式化確認訊息
   */
  formatConfirmationMessage(originalData, modifiedData, customQuestions = []) {
    let message = '🔄 **修改確認**\n\n';
    
    const changes = [];
    const unchanged = [];
    
    for (const [field, value] of Object.entries(modifiedData)) {
      const originalValue = originalData[field];
      if (originalValue !== value) {
        changes.push(`${field}: ~~${originalValue}~~ → **${value}**`);
      } else {
        unchanged.push(`${field}: ${value}`);
      }
    }
    
    if (changes.length > 0) {
      message += '**已修改的欄位：**\n';
      changes.forEach(change => message += `• ${change}\n`);
      message += '\n';
    }
    
    if (unchanged.length > 0) {
      message += '**未修改的欄位：**\n';
      unchanged.forEach(item => message += `• ${item}\n`);
    }
    
    message += '\n📋 **請確認最終結果：**\n';
    message += '✅ 回覆「確認」上傳修改後的資料\n';
    message += '✏️ 或繼續修改其他欄位\n';
    message += '❌ 回覆「取消」放棄記錄';
    
    return message;
  }
}

module.exports = AIConfirmationService; 