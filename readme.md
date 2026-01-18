WhatsApp 機器人專案總覽
最後更新：2025-06-09
專案概述
這是一個 WhatsApp 機器人專案，用於在指定群組內處理圖片和支出記錄，自動上傳圖片到 Google Drive，並將資料寫入 Google Sheet。支援用戶註冊、登入、設置（群組名稱、Google 連結等），並通過 QR 碼綁定 WhatsApp 帳號。專案目前處於開發階段，目標是將 app.js 拆分成模組化結構，實現網頁控制和熱插件/熱模組功能，確保不重啟程式（透過 PM2 運行）即可更新功能。
溝通前置

我的背景：非程式員，偏好用簡單語言溝通.
期望回應：建議用簡單語言，說明需要改哪些檔案和邏輯，必須提供完整程式碼。

專案目標

將 app.js 拆分成獨立模組（用戶管理、WhatsApp、圖片處理等），確保修改只影響單一檔案，轉移檔案時保持現有功能及邏輯完全一致。
實現熱插件/熱模組機制，支援動態加載和更新模組，無需重啟程式。
透過網頁（settings.html）控制模組啟用/停用、配置和上傳。
確保系統穩定，模組更新不導致崩潰，與 PM2 長期運行兼容。
保持程式可擴展，支援未來新增功能（如報表）或多人開發。

合作方式

問題描述寫在訊息或 REQUEST.md，格式：目標、相關檔案、期望結果。
我（AI）修改後更新 README.md 的「當前進度」，必要時更新「檔案結構」或「功能地圖」。

檔案結構
目前專案檔案結構如下：
主目錄

app.js：主程式，負責伺服器設置、路由掛載，圖片處理邏輯待拆分至 imageService.js。
googleService.js：Google Drive 圖片上傳和 Google Sheet 資料寫入。
database.js：SQLite 資料庫連線，管理 users 和 plugin_settings 表。
package.json：Node.js 專案依賴和腳本配置。

子目錄

services/
userService.js：用戶註冊、登入、設置、登出邏輯。
whatsappConnection.js：WhatsApp 連線管理（QR 碼生成、客戶端創建、認證）。
whatsappMessage.js：WhatsApp 訊息處理（圖片和文字訊息、費用對話）。


routes/
userRoutes.js：用戶相關 API 路由（註冊、登入、設置等）。


public/
index.html：登入頁面。
settings.html：設置頁面（群組名稱、Google 連結等）。


logs/
error.log：錯誤日誌。
combined.log：綜合日誌。
database.log：資料庫相關日誌。


auth/
儲存 WhatsApp 認證資料（例如 baileys_auth_<userId> 資料夾）。


credentials/
service-account.json：Google API 服務帳戶憑證。



計劃新增檔案

services/imageService.js：圖片下載、上傳、佇列管理和費用對話邏輯。
routes/moduleRoutes.js：模組管理 API。
utils/moduleManager.js：模組管理器，負責動態加載和卸載模組。
utils/common.js：通用工具（日期格式化、URL 解析）。
utils/logger.js：統一日誌管理。
middleware/auth.js：登入檢查。
middleware/errorHandler.js：統一錯誤處理。
config/index.js：設定管理（端口、Redis 等）。
public/js/settings.js：前端 JavaScript，處理網頁與後端 API 互動。
plugins/：儲存上傳的模組檔案。

功能模組地圖
目前功能分為以下模組：
用戶管理

職責：註冊、登入、登出、設置（群組名稱、Google 連結）。
依賴：資料庫（SQLite）、Redis、bcrypt（密碼加密）。
檔案：userService.js、userRoutes.js、database.js。

WhatsApp 連線

職責：連線 WhatsApp、生成 QR 碼、管理客戶端認證。
依賴：資料庫、Redis、Baileys（WhatsApp 庫）。
檔案：whatsappConnection.js、database.js。

WhatsApp 訊息處理

職責：處理群組訊息（圖片和文字），啟動費用對話。
依賴：WhatsApp 連線、圖片處理、Baileys。
檔案：whatsappMessage.js。

圖片處理

職責：下載圖片、上傳到 Google Drive、管理佇列。
依賴：Google Drive、Bull（佇列）。
檔案：app.js（臨時），未來移到 imageService.js、googleService.js。

Google 服務

職責：上傳圖片到 Drive，寫入資料到 Sheet。
依賴：Google API。
檔案：googleService.js。

模組管理

職責：動態加載、卸載、更新模組，支援網頁控制。
依賴：資料庫、Redis、檔案系統。
未來檔案：moduleManager.js、moduleRoutes.js。

通用工具

職責：日期格式化、URL 解析、訊息格式化。
依賴：無。
未來檔案：common.js。

當前進度

2025-06-09：
完成專案架構評估和優化建議，確認模組化方向正確。
更新所有文檔（README.md、CHANGELOG.md、REQUEST.md），確保內容一致。
計劃實現以下改進：
- 添加單元測試框架
- 實現更完善的錯誤處理機制
- 添加 API 文檔
- 考慮使用 TypeScript
- 實現更完善的監控系統

2025-06-06：
修復設置更新未即時應用到 WhatsApp 客戶端的問題，新增 reloadUserSettings 函數，實現動態重新載入用戶設置，確保群組名稱和自訂問題即時生效。
在 userRoutes.js 中於設置更新後調用重新載入邏輯，新增日誌追蹤設置應用情況。
在 whatsappMessage.js 中新增日誌，記錄訊息處理時使用的群組名稱和自訂問題。
完成 WhatsApp 連線邏輯拆分，將 app.js 中的連線（QR 碼、客戶端創建、認證）和訊息處理邏輯分別移到 whatsappConnection.js 和 whatsappMessage.js，功能與原 app.js 一致。
修復模組引用問題，解決 clients Map 的 undefined 錯誤（set 和 get 失敗），確保連線、登入和對話流程穩定。
更新 README.md 和 CHANGELOG.md，記錄拆分和修復。


2025-06-01：完成用戶管理模組拆分，將 app.js 中的註冊、登入、設置、登出邏輯移到 userService.js 和 userRoutes.js。
2025-05-31：所有功能集中在 app.js，尚未開始拆分。
2025-05-30：建立資料庫（database.js）和 Google 服務（googleService.js）。
2025-05-29：完成登入和設置頁面（index.html、settings.html）。

下一步計劃

拆分圖片處理：將 app.js 的圖片處理邏輯（processImageQueue、startExpenseChat、finishExpenseChat 等）移到 imageService.js，測試功能完整性。
建立模組管理器：創建 moduleManager.js，實現模組的動態加載和卸載，支援熱插件機制。
擴展網頁控制：修改 settings.html，新增模組管理介面，實現啟用/停用模組和上傳功能。
確保穩定性：新增 middleware/errorHandler.js 和 utils/logger.js，實現錯誤隔離和日誌監控。
優化工具函數：將 formatDate 等函數移到 common.js，減少 app.js 依賴。
新增手機號驗證：在用戶註冊流程中加入手機號驗證。
優化設置更新流程：新增前端通知，提示用戶設置更新是否成功應用到 WhatsApp 客戶端。
實現統一日誌管理：創建 utils/logger.js，統一管理日誌格式，提升問題追蹤效率。

其他資訊

環境：Node.js、Express、SQLite、Redis、Google API、Baileys（WhatsApp）。
常見術語：
支出流程：用戶發送圖片，系統詢問問題（例如店鋪名稱），上傳圖片到 Drive，寫入資料到 Sheet。
群組名稱：WhatsApp 群組的名稱，用於過濾訊息。


版本控制：目前手動維護檔案，未來可能用 Git。
檔案行數（估計）：
app.js：約 450 行（拆分後減少）
userService.js：約 200 行
userRoutes.js：約 100 行
database.js：約 100 行
googleService.js：約 50 行
whatsappConnection.js：約 400 行
whatsappMessage.js：約 200 行



