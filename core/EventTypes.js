/**
 * 事件類型定義
 * 確保整個應用程式中的事件命名一致性
 */

const EventTypes = {
  // ==================== 訊息相關事件 ====================
  MESSAGE: {
    RECEIVED: 'message.received',           // 收到訊息
    PROCESSED: 'message.processed',         // 訊息處理完成
    SUPPRESSED: 'message.suppressed',       // 訊息被忽略
    ERROR: 'message.error'                  // 訊息處理錯誤
  },

  // ==================== 圖片處理相關事件 ====================
  IMAGE: {
    DETECTED: 'image.detected',             // 檢測到圖片
    QUEUED: 'image.queued',                 // 圖片加入佇列
    PROCESSING: 'image.processing',         // 圖片處理開始
    PROCESSED: 'image.processed',           // 圖片處理完成
    FAILED: 'image.failed',                 // 圖片處理失敗
    UPLOADED: 'image.uploaded'              // 圖片上傳完成
  },

  // ==================== 費用對話相關事件 ====================
  EXPENSE_CHAT: {
    STARTED: 'expense.chat.started',        // 費用對話開始
    STEP_COMPLETED: 'expense.chat.step.completed', // 對話步驟完成
    FINISHED: 'expense.chat.finished',      // 費用對話完成
    CANCELLED: 'expense.chat.cancelled',    // 費用對話取消
    ERROR: 'expense.chat.error'             // 費用對話錯誤
  },

  // ==================== 用戶相關事件 ====================
  USER: {
    AUTHENTICATED: 'user.authenticated',    // 用戶認證成功
    LOGIN: 'user.login',                    // 用戶登入
    LOGOUT: 'user.logout',                  // 用戶登出
    SETTINGS_UPDATED: 'user.settings.updated', // 用戶設置更新
    CREATED: 'user.created'                 // 用戶創建
  },

  // ==================== WhatsApp 相關事件 ====================
  WHATSAPP: {
    CLIENT_CREATED: 'whatsapp.client.created',     // 客戶端創建
    CLIENT_READY: 'whatsapp.client.ready',         // 客戶端就緒
    CLIENT_DISCONNECTED: 'whatsapp.client.disconnected', // 客戶端斷線
    QR_GENERATED: 'whatsapp.qr.generated',         // QR 碼生成
    QR_SCANNED: 'whatsapp.qr.scanned',             // QR 碼掃描
    CONNECTION_ERROR: 'whatsapp.connection.error'  // 連接錯誤
  },

  // ==================== 佇列相關事件 ====================
  QUEUE: {
    JOB_ADDED: 'queue.job.added',           // 工作加入佇列
    JOB_STARTED: 'queue.job.started',       // 工作開始
    JOB_COMPLETED: 'queue.job.completed',   // 工作完成
    JOB_FAILED: 'queue.job.failed',         // 工作失敗
    JOB_RETRY: 'queue.job.retry'            // 工作重試
  },

  // ==================== 系統相關事件 ====================
  SYSTEM: {
    STARTUP: 'system.startup',              // 系統啟動
    SHUTDOWN: 'system.shutdown',            // 系統關閉
    HEALTH_CHECK: 'system.health.check',    // 健康檢查
    ERROR: 'system.error',                  // 系統錯誤
    WARNING: 'system.warning'               // 系統警告
  },

  // ==================== 資料庫相關事件 ====================
  DATABASE: {
    CONNECTED: 'database.connected',        // 資料庫連接
    DISCONNECTED: 'database.disconnected',  // 資料庫斷線
    QUERY_EXECUTED: 'database.query.executed', // 查詢執行
    ERROR: 'database.error'                 // 資料庫錯誤
  },

  // ==================== Redis 相關事件 ====================
  REDIS: {
    CONNECTED: 'redis.connected',           // Redis 連接
    DISCONNECTED: 'redis.disconnected',     // Redis 斷線
    KEY_SET: 'redis.key.set',               // 鍵設置
    KEY_GET: 'redis.key.get',               // 鍵獲取
    KEY_DELETED: 'redis.key.deleted',       // 鍵刪除
    ERROR: 'redis.error'                    // Redis 錯誤
  },

  // ==================== Google 服務相關事件 ====================
  GOOGLE: {
    SHEET_UPDATED: 'google.sheet.updated',  // Google Sheet 更新
    DRIVE_UPLOADED: 'google.drive.uploaded', // Google Drive 上傳
    AUTH_SUCCESS: 'google.auth.success',    // Google 認證成功
    AUTH_ERROR: 'google.auth.error',        // Google 認證錯誤
    API_ERROR: 'google.api.error'           // Google API 錯誤
  },

  // ==================== AI 服務相關事件 ====================
  AI: {
    REQUEST_STARTED: 'ai.request.started',  // AI 請求開始
    REQUEST_COMPLETED: 'ai.request.completed', // AI 請求完成
    REQUEST_FAILED: 'ai.request.failed',    // AI 請求失敗
    CONFIDENCE_LOW: 'ai.confidence.low',    // AI 可信度低
    // AI 確認流程相關事件
    CONFIRMATION_REQUESTED: 'ai.confirmation.requested', // 請求AI確認
    CONFIRMED: 'ai.confirmed',              // 用戶確認AI結果
    MODIFIED: 'ai.modified',                // 用戶修改AI結果
    CANCELLED: 'ai.cancelled'               // 用戶取消AI結果
  }
};

/**
 * 事件優先級定義
 */
const EventPriority = {
  CRITICAL: 100,    // 關鍵事件（最高優先級）
  HIGH: 75,         // 高優先級
  NORMAL: 50,       // 正常優先級（預設）
  LOW: 25,          // 低優先級
  BACKGROUND: 0     // 背景事件（最低優先級）
};

/**
 * 事件來源定義
 */
const EventSource = {
  WHATSAPP_CONNECTION: 'whatsapp.connection',
  WHATSAPP_MESSAGE: 'whatsapp.message',
  IMAGE_PROCESSING: 'image.processing',
  EXPENSE_CHAT: 'expense.chat',
  USER_SERVICE: 'user.service',
  QUEUE_SERVICE: 'queue.service',
  AI_SERVICE: 'ai.service',
  GOOGLE_SERVICE: 'google.service',
  DATABASE: 'database',
  REDIS: 'redis',
  SYSTEM: 'system'
};

module.exports = {
  EventTypes,
  EventPriority,
  EventSource
}; 