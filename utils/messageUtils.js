/**
 * 訊息格式化工具模組
 * 提供統一的訊息格式化和處理功能
 */

/**
 * 格式化費用訊息
 * @param {Object} data - 費用資料
 * @param {string} messageFormat - 訊息格式模板
 * @returns {string} 格式化後的訊息
 */
function formatMessage(data, messageFormat) {
  if (!data || typeof data !== 'object') {
    throw new Error('無效的資料物件');
  }
  
  if (!messageFormat || typeof messageFormat !== 'string') {
    throw new Error('無效的訊息格式');
  }
  
  let message = messageFormat;
  
  // 替換預設欄位
  const defaultFields = {
    date: data.date || '未知',
    item: data.item || '未知',
    amount: data.amount || '0',
    note: data.note || '無',
    imageUrl: data.imageUrl || '無'
  };
  
  // 替換預設欄位
  Object.entries(defaultFields).forEach(([field, value]) => {
    const placeholder = `{${field}}`;
    // 使用字符串替換而非正則表達式，避免特殊字符問題
    message = message.split(placeholder).join(value);
  });
  
  // 替換自訂欄位
  Object.entries(data).forEach(([key, value]) => {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const placeholder = `{${key}}`;
      // 使用字符串替換而非正則表達式，避免特殊字符問題
      message = message.split(placeholder).join(value || '未知');
    }
  });
  
  // 清理未替換的佔位符
  message = message.replace(/\{[^}]+\}/g, '未知');
  
  return message;
}

/**
 * 建立費用摘要訊息
 * @param {Object} data - 費用資料
 * @returns {string} 摘要訊息
 */
function createExpenseSummary(data) {
  if (!data || typeof data !== 'object') {
    return '無效的費用資料';
  }
  
  const fields = [];
  
  // 添加基本欄位
  if (data.date) fields.push(`日期: ${data.date}`);
  if (data.item) fields.push(`項目: ${data.item}`);
  if (data.amount) fields.push(`金額: ${data.amount}`);
  if (data.shop) fields.push(`店鋪: ${data.shop}`);
  if (data.note) fields.push(`備註: ${data.note}`);
  
  // 添加自訂欄位
  Object.entries(data).forEach(([key, value]) => {
    if (!['date', 'item', 'amount', 'shop', 'note', 'imageUrl', 'media'].includes(key) && value) {
      fields.push(`${key}: ${value}`);
    }
  });
  
  return fields.length > 0 ? fields.join('\n') : '無費用資料';
}

/**
 * 建立成功訊息
 * @param {string} action - 動作描述
 * @param {Object} data - 相關資料
 * @returns {string} 成功訊息
 */
function createSuccessMessage(action, data = {}) {
  const summary = data.answers ? createExpenseSummary(data.answers) : '';
  return `✅ ${action}成功！\n\n${summary}`;
}

/**
 * 建立錯誤訊息
 * @param {string} action - 動作描述
 * @param {string} error - 錯誤訊息
 * @returns {string} 錯誤訊息
 */
function createErrorMessage(action, error) {
  return `❌ ${action}失敗：${error}`;
}

/**
 * 建立警告訊息
 * @param {string} message - 警告內容
 * @returns {string} 警告訊息
 */
function createWarningMessage(message) {
  return `⚠️ ${message}`;
}

/**
 * 建立資訊訊息
 * @param {string} message - 資訊內容
 * @returns {string} 資訊訊息
 */
function createInfoMessage(message) {
  return `ℹ️ ${message}`;
}

/**
 * 驗證訊息格式模板
 * @param {string} template - 訊息模板
 * @returns {boolean} 是否為有效模板
 */
function validateMessageTemplate(template) {
  if (!template || typeof template !== 'string') {
    return false;
  }
  
  // 檢查是否包含至少一個佔位符
  const placeholderRegex = /\{[^}]+\}/g;
  const placeholders = template.match(placeholderRegex);
  
  return placeholders && placeholders.length > 0;
}

/**
 * 取得模板中的佔位符列表
 * @param {string} template - 訊息模板
 * @returns {Array} 佔位符列表
 */
function getTemplatePlaceholders(template) {
  if (!template || typeof template !== 'string') {
    return [];
  }
  
  const placeholderRegex = /\{([^}]+)\}/g;
  const placeholders = [];
  let match;
  
  while ((match = placeholderRegex.exec(template)) !== null) {
    placeholders.push(match[1]);
  }
  
  return [...new Set(placeholders)]; // 去重
}

/**
 * 清理訊息文字
 * @param {string} text - 原始文字
 * @returns {string} 清理後的文字
 */
function sanitizeMessage(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  return text
    .trim()
    .replace(/\s+/g, ' ') // 多個空白字元替換為單個
    .replace(/[<>]/g, ''); // 移除可能的 HTML 標籤
}

module.exports = {
  formatMessage,
  createExpenseSummary,
  createSuccessMessage,
  createErrorMessage,
  createWarningMessage,
  createInfoMessage,
  validateMessageTemplate,
  getTemplatePlaceholders,
  sanitizeMessage
}; 