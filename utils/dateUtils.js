/**
 * 日期工具函數模組
 * 提供統一的日期格式化和驗證功能
 */

/**
 * 格式化日期為 YYYY-MM-DD 格式
 * @param {Date} date - 日期物件
 * @returns {string} 格式化後的日期字串
 */
function formatDate(date) {
  if (!date || !(date instanceof Date)) {
    throw new Error('無效的日期物件');
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 格式化日期時間為 YYYY-MM-DD HH:mm 格式
 * @param {Date} date - 日期物件
 * @returns {string} 格式化後的日期時間字串
 */
function formatDateTime(date) {
  if (!date || !(date instanceof Date)) {
    throw new Error('無效的日期物件');
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 格式化日期時間為 YYYY-MM-DD HH:mm:ss 格式
 * @param {Date} date - 日期物件
 * @returns {string} 格式化後的完整日期時間字串
 */
function formatDateTimeFull(date) {
  if (!date || !(date instanceof Date)) {
    throw new Error('無效的日期物件');
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 驗證日期字串格式是否為 YYYY-MM-DD
 * @param {string} dateStr - 日期字串
 * @returns {boolean} 是否為有效格式
 */
function isValidDateFormat(dateStr) {
  if (typeof dateStr !== 'string') {
    return false;
  }
  
  const regex = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
  if (!regex.test(dateStr)) {
    return false;
  }
  
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * 解析日期字串為 Date 物件
 * @param {string} dateStr - 日期字串
 * @returns {Date|null} Date 物件或 null
 */
function parseDate(dateStr) {
  if (!isValidDateFormat(dateStr)) {
    return null;
  }
  
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * 取得當前日期字串
 * @returns {string} 當前日期字串
 */
function getCurrentDate() {
  return formatDate(new Date());
}

/**
 * 取得當前日期時間字串
 * @returns {string} 當前日期時間字串
 */
function getCurrentDateTime() {
  return formatDateTime(new Date());
}

/**
 * 檢查日期是否為今天
 * @param {Date} date - 日期物件
 * @returns {boolean} 是否為今天
 */
function isToday(date) {
  if (!date || !(date instanceof Date)) {
    return false;
  }
  
  const today = new Date();
  return formatDate(date) === formatDate(today);
}

/**
 * 取得日期差異（天數）
 * @param {Date} date1 - 第一個日期
 * @param {Date} date2 - 第二個日期
 * @returns {number} 差異天數
 */
function getDateDifference(date1, date2) {
  if (!date1 || !date2 || !(date1 instanceof Date) || !(date2 instanceof Date)) {
    throw new Error('無效的日期物件');
  }
  
  const timeDiff = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
}

module.exports = {
  formatDate,
  formatDateTime,
  formatDateTimeFull,
  isValidDateFormat,
  parseDate,
  getCurrentDate,
  getCurrentDateTime,
  isToday,
  getDateDifference
}; 