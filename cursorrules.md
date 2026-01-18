# Cursor Rules - WhatsApp Bot 萬人級 SAAS 架構重構

現時主要project進度表 @ServicesChangeLog.md 每次開始對話前需要跟據現在的rules及project進度表執行

## 對話原則及前設
- 每次對話前, 讀出你現在是那一個模型(對話模型)為我進行服務
例如:gpt4o, gemini 2.5pro 等等或其他
輸出格式:現在是[語言模型]為你進行服務

## 更新進度原則及流程
- 將現有進行中的工作, 寫做進度表
每次開始工作前, 更新進度表
例如:
建設0001模組|service.js|已完成|完成度100%|
建設xxxx模組|ffffff.js|執行中|完成度30%|
建設0002模組|dsdsdsd|未執行|
測試xxxx模組|xxx|xxx|xxx|

- 必須嚴格遵守[用戶無感規則]
## 用戶無感規則
- 每一個更新及重構步驟, 都要先做相關測試, 確保功能正常, 上下文正常, 最後才實裝
- 實裝前後, 用戶必須要完全不感覺到程式在重構或優化, 每個細微功能都保持正常

## 當前專案狀態 (PROJECT STATUS)

### 主要目標
將現有 WhatsApp Bot 系統重構為支援萬人級別的 SAAS 系統，實現：
- 用戶完全隔離 (Multi-tenant Architecture)
- 乾淨的中央啟動核心 (Clean Central Bootstrap)
- 服務完全解耦 (Service Decoupling)
- 零停機重構 (Zero-Downtime Refactoring)

### 重構方法論
採用「混合絞殺者模式」：
1. **第一階段**：建立適配器層 (Adapter Layer)
2. **第二階段**：服務替換 (Service Replacement)
3. **第三階段**：清理優化 (Cleanup & Optimization)

### 核心原則
- **零影響原則**：任何時候都不能影響現有功能
- **漸進式遷移**：一次只改一個服務
- **完整測試**：每步都要有測試驗證
- **可回滾**：每個變更都要能快速回滾

## 標準化執行流程 (STANDARDIZED PROCESSES)

### 1. 創建檔案原則 (FILE CREATION PRINCIPLES)

#### 1.1 新服務創建流程
```
步驟1: 分析現有服務依賴
- 使用 codebase_search 找出所有相關依賴
- 確認服務邊界和接口
- 識別潛在衝突點

步驟2: 創建適配器接口
- 在 core/adapters/ 創建接口定義
- 定義新舊服務的轉換邏輯
- 確保向後兼容性

步驟3: 實現新服務
- 在 services/v2/ 創建新服務
- 遵循依賴注入模式
- 實現完整的錯誤處理

步驟4: 創建測試檔案
- 單元測試：test-[service-name]-unit.js
- 集成測試：test-[service-name]-integration.js
- 端到端測試：test-[service-name]-e2e.js
```

#### 1.2 檔案命名規範
```
新服務：services/v2/[ServiceName]V2.js
適配器：core/adapters/[ServiceName]Adapter.js
測試檔：test-[service-name]-[type].js
配置檔：config/v2/[service-name].js
遷移檔：migrations/[timestamp]-[service-name].js
```

### 2. 新增功能原則 (FEATURE ADDITION PRINCIPLES)

#### 2.1 功能開發流程
```
步驟1: 需求分析
- 確認功能邊界
- 識別受影響的服務
- 評估風險等級

步驟2: 設計階段
- 創建功能設計文檔
- 定義 API 接口
- 規劃數據結構

步驟3: 實現階段
- 使用功能開關 (Feature Toggle)
- 實現向後兼容
- 添加詳細日誌

步驟4: 測試階段
- 單元測試覆蓋率 > 80%
- 集成測試驗證
- 性能測試檢查
```

#### 2.2 功能開關管理
```javascript
// 在 config/featureFlags.js 中管理
const FEATURE_FLAGS = {
  USE_V2_USER_SERVICE: process.env.USE_V2_USER_SERVICE === 'true',
  USE_V2_AI_SERVICE: process.env.USE_V2_AI_SERVICE === 'true',
  ENABLE_MULTI_TENANT: process.env.ENABLE_MULTI_TENANT === 'true'
};
```

### 3. 測試原則 (TESTING PRINCIPLES)

#### 3.1 測試層級
```
L1 - 單元測試 (Unit Tests)
- 測試單個函數/方法
- 模擬所有外部依賴
- 快速執行 (< 1秒)

L2 - 集成測試 (Integration Tests)
- 測試服務間交互
- 使用真實依賴
- 中等執行時間 (< 10秒)

L3 - 端到端測試 (E2E Tests)
- 測試完整用戶流程
- 使用真實環境
- 較長執行時間 (< 60秒)
```

#### 3.2 測試創建標準
```javascript
// 測試檔案模板
describe('[ServiceName] Tests', () => {
  let service;
  let mockDependencies;
  
  beforeEach(() => {
    // 設置測試環境
    mockDependencies = createMockDependencies();
    service = new ServiceName(mockDependencies);
  });
  
  afterEach(() => {
    // 清理測試環境
    cleanupTestEnvironment();
  });
  
  describe('核心功能測試', () => {
    it('應該正確處理正常情況', async () => {
      // Arrange - 準備測試數據
      // Act - 執行測試操作
      // Assert - 驗證結果
    });
    
    it('應該正確處理錯誤情況', async () => {
      // 測試錯誤處理
    });
  });
});
```

### 4. 修復與 DEBUG 原則 (DEBUGGING PRINCIPLES)
當我輸入 /修復檔案 
跟據以下標準 DEBUG 流程工作
並說出 收到/修復檔案指令,修復流程開始

#### 4.1 標準 DEBUG 流程
```
步驟1: 問題識別
- 創建 test-debug-[issue].js 重現問題
- 收集錯誤日誌和堆棧跟蹤
- 確認問題範圍和影響

步驟2: 根因分析
- 使用 codebase_search 找出相關代碼
- 使用 grep_search 搜索錯誤模式
- 分析數據流和控制流

步驟3: 解決方案設計
- 評估多種解決方案
- 選擇最小影響方案
- 考慮向後兼容性

步驟4: 實施修復
- 創建修復分支
- 實施最小化變更
- 添加防護性代碼

步驟5: 驗證修復
- 運行原有測試套件
- 運行新的修復測試
- 進行回歸測試
```

#### 4.2 DEBUG 工具使用
```javascript
// 使用結構化日誌
const logger = require('./utils/logger');

logger.debug('Service operation started', {
  service: 'UserService',
  operation: 'createUser',
  userId: userId,
  timestamp: new Date().toISOString()
});

// 使用錯誤追蹤
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', {
    error: error.message,
    stack: error.stack,
    context: { userId, operation: 'createUser' }
  });
  throw error;
}
```

## 架構重構執行指南 (ARCHITECTURE REFACTORING GUIDE)

### 1. 依賴分析方法
```
工具使用順序：
1. codebase_search "how does [service] work" - 理解服務功能
2. grep_search "require.*[service]" - 找出直接依賴
3. grep_search "new [Service]" - 找出實例化位置
4. codebase_search "where is [service] used" - 找出使用位置
```

### 2. 服務解耦策略
```
解耦順序：
1. 識別服務邊界
2. 創建接口定義
3. 實現適配器層
4. 逐步替換調用
5. 清理舊代碼
```

### 3. 多租戶實現步驟
```
步驟1: 數據隔離
- 添加 tenantId 到所有數據表
- 創建租戶上下文管理器
- 實現數據訪問控制

步驟2: 服務隔離
- 創建租戶特定的服務實例
- 實現資源配額管理
- 添加租戶級別的配置

步驟3: 用戶隔離
- 實現用戶認證和授權
- 創建用戶上下文
- 添加跨租戶訪問控制
```

## 風險控制與回滾機制 (RISK CONTROL & ROLLBACK)

### 1. 風險評估矩陣
```
高風險操作：
- 修改核心服務 (Application.js, ServiceContainer.js)
- 更改數據庫結構
- 修改 WhatsApp 連接邏輯

中風險操作：
- 添加新服務
- 修改業務邏輯
- 更新依賴關係

低風險操作：
- 添加日誌
- 修改配置
- 添加測試
```

### 2. 回滾策略
```
即時回滾：
- 使用功能開關立即禁用新功能
- 恢復到上一個穩定版本
- 通知相關人員

數據回滾：
- 使用數據庫事務
- 創建數據備份點
- 實現數據遷移腳本
```

## 執行思維框架 (EXECUTION MINDSET)

### 1. 分析思維 (ANALYTICAL THINKING)

#### 1.1 問題分析思路
```
第一層分析 - 表象識別：
- 觀察現象：系統出現什麼問題？用戶反饋什麼？
- 收集數據：日誌、錯誤信息、性能指標
- 初步判斷：這是功能問題、性能問題還是架構問題？

第二層分析 - 根因挖掘：
- 使用 5WHY 方法：連續問5個為什麼
- 追蹤數據流：數據從哪裡來，到哪裡去
- 分析調用鏈：哪個服務調用了哪個服務
- 檢查時間順序：問題是什麼時候開始的

第三層分析 - 影響評估：
- 影響範圍：哪些用戶受影響？哪些功能受影響？
- 影響程度：是完全不可用還是部分功能異常？
- 影響時間：問題持續多長時間？恢復需要多長時間？
```

#### 1.2 系統思維原理
```
整體性原理：
- 系統是由相互關聯的部分組成的整體
- 改變一個部分會影響其他部分
- 必須考慮整個系統的平衡

層次性原理：
- 系統有不同的層次：應用層、服務層、數據層
- 每個層次有不同的職責和邊界
- 問題可能在任何層次發生

動態性原理：
- 系統是動態變化的
- 今天的解決方案可能明天就不適用
- 需要持續監控和調整
```

#### 1.3 依賴分析實現方法
```javascript
// 實際分析步驟
步驟1: 靜態分析
- 使用 codebase_search "require.*ServiceName" 找出所有import
- 使用 grep_search "new ServiceName" 找出所有實例化
- 使用 codebase_search "ServiceName.method" 找出所有調用

步驟2: 動態分析
- 在關鍵方法添加日誌追蹤調用鏈
- 使用調試工具查看運行時依賴
- 分析錯誤堆棧找出實際執行路徑

步驟3: 依賴圖構建
const dependencyMap = {
  'UserService': ['DatabaseService', 'LoggerService'],
  'AIService': ['UserService', 'ConfigService'],
  'WhatsAppService': ['UserService', 'QueueService']
};

// 檢查循環依賴
function findCircularDependencies(depMap) {
  const visited = new Set();
  const recursionStack = new Set();
  
  function dfs(service) {
    if (recursionStack.has(service)) return true; // 發現循環
    if (visited.has(service)) return false;
    
    visited.add(service);
    recursionStack.add(service);
    
    const dependencies = depMap[service] || [];
    for (const dep of dependencies) {
      if (dfs(dep)) return true;
    }
    
    recursionStack.delete(service);
    return false;
  }
  
  for (const service in depMap) {
    if (dfs(service)) {
      console.log(`發現循環依賴: ${service}`);
    }
  }
}
```

### 2. 實施思維 (IMPLEMENTATION THINKING)

#### 2.1 漸進式思維原理
```
最小可行變更原理 (MVP Principle)：
- 每次只改變系統的最小單元
- 確保每個變更都是可測試的
- 每個變更都要能獨立回滾

增量交付原理 (Incremental Delivery)：
- 將大的變更分解為小的增量
- 每個增量都要提供業務價值
- 用戶可以逐步體驗到改進

快速反饋原理 (Fast Feedback)：
- 盡快獲得變更的反饋
- 基於反饋調整後續策略
- 建立快速迭代的循環
```

#### 2.2 適配器模式實現思路
```javascript
// 適配器模式的核心思想：
// 1. 保持舊接口不變
// 2. 新功能通過適配器提供
// 3. 逐步遷移到新接口

// 舊服務接口
class OldUserService {
  async getUser(id) {
    // 舊的實現
    return await this.database.findUser(id);
  }
}

// 新服務接口
class NewUserService {
  async getUser(id, tenantId) {
    // 新的實現，支援多租戶
    return await this.database.findUser(id, tenantId);
  }
}

// 適配器實現
class UserServiceAdapter {
  constructor(oldService, newService, featureFlags) {
    this.oldService = oldService;
    this.newService = newService;
    this.featureFlags = featureFlags;
  }
  
  async getUser(id, context = {}) {
    // 根據功能開關決定使用哪個服務
    if (this.featureFlags.USE_NEW_USER_SERVICE) {
      const tenantId = context.tenantId || 'default';
      return await this.newService.getUser(id, tenantId);
    } else {
      return await this.oldService.getUser(id);
    }
  }
}

// 使用方式
const adapter = new UserServiceAdapter(oldService, newService, featureFlags);
const user = await adapter.getUser(userId, { tenantId: 'tenant123' });
```

#### 2.3 防護性編程實現
```javascript
// 防護性編程的核心原則：
// 1. 假設所有外部調用都可能失敗
// 2. 提供有意義的錯誤信息
// 3. 實現優雅降級

class DefensiveService {
  constructor(dependencies) {
    this.dependencies = dependencies;
    this.circuitBreaker = new CircuitBreaker();
    this.logger = dependencies.logger;
  }
  
  async processRequest(request) {
    // 輸入驗證
    if (!this.validateInput(request)) {
      throw new ValidationError('Invalid request format');
    }
    
    try {
      // 使用斷路器保護外部調用
      const result = await this.circuitBreaker.execute(async () => {
        return await this.externalService.process(request);
      });
      
      // 結果驗證
      if (!this.validateOutput(result)) {
        throw new ProcessingError('Invalid response from external service');
      }
      
      return result;
    } catch (error) {
      // 錯誤處理和日誌記錄
      this.logger.error('Service processing failed', {
        error: error.message,
        stack: error.stack,
        request: this.sanitizeRequest(request)
      });
      
      // 優雅降級
      return this.fallbackResponse(request);
    }
  }
  
  validateInput(request) {
    return request && typeof request === 'object' && request.id;
  }
  
  validateOutput(result) {
    return result && result.status === 'success';
  }
  
  fallbackResponse(request) {
    return {
      status: 'degraded',
      message: 'Service temporarily unavailable',
      requestId: request.id
    };
  }
}
```

### 3. 質量思維 (QUALITY THINKING)

#### 3.1 測試驅動開發思路
```
TDD 三步驟原理：
1. Red - 寫一個失敗的測試
2. Green - 寫最少的代碼讓測試通過
3. Refactor - 重構代碼保持測試通過

測試金字塔原理：
- 70% 單元測試：快速、獨立、可重複
- 20% 集成測試：驗證組件間交互
- 10% 端到端測試：驗證用戶流程
```

#### 3.2 測試實現方法
```javascript
// 測試驅動開發實例
describe('UserServiceAdapter', () => {
  let adapter;
  let mockOldService;
  let mockNewService;
  let mockFeatureFlags;
  
  beforeEach(() => {
    // 創建模擬對象
    mockOldService = {
      getUser: jest.fn()
    };
    
    mockNewService = {
      getUser: jest.fn()
    };
    
    mockFeatureFlags = {
      USE_NEW_USER_SERVICE: false
    };
    
    adapter = new UserServiceAdapter(
      mockOldService, 
      mockNewService, 
      mockFeatureFlags
    );
  });
  
  describe('當功能開關關閉時', () => {
    it('應該使用舊服務', async () => {
      // Arrange
      const userId = 'user123';
      const expectedUser = { id: userId, name: 'Test User' };
      mockOldService.getUser.mockResolvedValue(expectedUser);
      
      // Act
      const result = await adapter.getUser(userId);
      
      // Assert
      expect(mockOldService.getUser).toHaveBeenCalledWith(userId);
      expect(mockNewService.getUser).not.toHaveBeenCalled();
      expect(result).toEqual(expectedUser);
    });
  });
  
  describe('當功能開關開啟時', () => {
    beforeEach(() => {
      mockFeatureFlags.USE_NEW_USER_SERVICE = true;
    });
    
    it('應該使用新服務', async () => {
      // Arrange
      const userId = 'user123';
      const context = { tenantId: 'tenant123' };
      const expectedUser = { id: userId, name: 'Test User', tenantId: 'tenant123' };
      mockNewService.getUser.mockResolvedValue(expectedUser);
      
      // Act
      const result = await adapter.getUser(userId, context);
      
      // Assert
      expect(mockNewService.getUser).toHaveBeenCalledWith(userId, 'tenant123');
      expect(mockOldService.getUser).not.toHaveBeenCalled();
      expect(result).toEqual(expectedUser);
    });
  });
});
```

#### 3.3 用戶體驗思維原理
```
用戶中心設計原理：
- 所有變更都要從用戶角度思考
- 用戶不應該感受到系統內部的變化
- 用戶體驗應該持續改善，不能倒退

漸進式增強原理：
- 基礎功能必須穩定可用
- 新功能作為增強，不能影響基礎功能
- 提供降級機制，確保基礎功能可用

反饋循環原理：
- 收集用戶反饋
- 分析反饋數據
- 基於反饋改進系統
- 向用戶報告改進結果
```

### 4. 架構思維 (ARCHITECTURAL THINKING)

#### 4.1 服務邊界劃分原理
```
單一職責原理 (Single Responsibility Principle)：
- 每個服務只負責一個業務領域
- 服務內部的變更不應該影響其他服務
- 服務的接口應該穩定且明確

高內聚低耦合原理：
- 服務內部的組件應該緊密相關
- 服務之間的依賴應該最小化
- 通過明確的接口進行服務間通信

領域驅動設計原理：
- 按業務領域劃分服務邊界
- 每個服務擁有自己的數據模型
- 服務間通過領域事件通信
```

#### 4.2 多租戶架構實現思路
```javascript
// 多租戶架構的核心實現

// 1. 租戶上下文管理
class TenantContext {
  constructor() {
    this.tenantId = null;
    this.userId = null;
    this.permissions = [];
  }
  
  static create(tenantId, userId) {
    const context = new TenantContext();
    context.tenantId = tenantId;
    context.userId = userId;
    context.permissions = this.loadPermissions(tenantId, userId);
    return context;
  }
  
  hasPermission(permission) {
    return this.permissions.includes(permission);
  }
}

// 2. 租戶中間件
class TenantMiddleware {
  async handle(req, res, next) {
    try {
      // 從請求中提取租戶信息
      const tenantId = this.extractTenantId(req);
      const userId = this.extractUserId(req);
      
      // 驗證租戶權限
      if (!await this.validateTenantAccess(tenantId, userId)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // 創建租戶上下文
      req.tenantContext = TenantContext.create(tenantId, userId);
      
      next();
    } catch (error) {
      res.status(500).json({ error: 'Tenant validation failed' });
    }
  }
  
  extractTenantId(req) {
    return req.headers['x-tenant-id'] || req.user?.tenantId;
  }
}

// 3. 租戶感知的數據訪問
class TenantAwareRepository {
  constructor(database, tenantContext) {
    this.database = database;
    this.tenantContext = tenantContext;
  }
  
  async findUser(userId) {
    // 自動添加租戶過濾條件
    return await this.database.findOne({
      id: userId,
      tenantId: this.tenantContext.tenantId
    });
  }
  
  async createUser(userData) {
    // 自動添加租戶ID
    return await this.database.create({
      ...userData,
      tenantId: this.tenantContext.tenantId
    });
  }
}
```

#### 4.3 事件驅動架構實現
```javascript
// 事件驅動架構的核心思想：
// 1. 服務間通過事件通信
// 2. 減少直接依賴
// 3. 提高系統彈性

// 事件總線實現
class EventBus {
  constructor() {
    this.handlers = new Map();
    this.middleware = [];
  }
  
  // 註冊事件處理器
  on(eventType, handler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType).push(handler);
  }
  
  // 發布事件
  async emit(eventType, eventData) {
    const event = {
      type: eventType,
      data: eventData,
      timestamp: new Date().toISOString(),
      id: this.generateEventId()
    };
    
    // 執行中間件
    for (const middleware of this.middleware) {
      await middleware(event);
    }
    
    // 執行事件處理器
    const handlers = this.handlers.get(eventType) || [];
    const promises = handlers.map(handler => this.executeHandler(handler, event));
    
    await Promise.allSettled(promises);
  }
  
  async executeHandler(handler, event) {
    try {
      await handler(event);
    } catch (error) {
      console.error(`Event handler failed for ${event.type}:`, error);
      // 可以在這裡實現重試邏輯
    }
  }
}

// 領域事件實現
class DomainEvent {
  constructor(type, aggregateId, data) {
    this.type = type;
    this.aggregateId = aggregateId;
    this.data = data;
    this.timestamp = new Date().toISOString();
    this.version = 1;
  }
}

// 使用示例
class UserService {
  constructor(eventBus, repository) {
    this.eventBus = eventBus;
    this.repository = repository;
  }
  
  async createUser(userData) {
    const user = await this.repository.create(userData);
    
    // 發布領域事件
    const event = new DomainEvent('UserCreated', user.id, {
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId
    });
    
    await this.eventBus.emit('UserCreated', event);
    
    return user;
  }
}
```

### 5. 錯誤處理思維 (ERROR HANDLING THINKING)

#### 5.1 錯誤分類和處理策略
```javascript
// 錯誤分類體系
class ErrorClassification {
  static RECOVERABLE = 'recoverable';    // 可恢復錯誤
  static TEMPORARY = 'temporary';        // 臨時錯誤
  static PERMANENT = 'permanent';        // 永久錯誤
  static CRITICAL = 'critical';          // 嚴重錯誤
}

// 錯誤處理策略
class ErrorHandler {
  constructor(logger, alertService) {
    this.logger = logger;
    this.alertService = alertService;
    this.retryStrategies = new Map();
    this.setupRetryStrategies();
  }
  
  setupRetryStrategies() {
    // 網絡錯誤：指數退避重試
    this.retryStrategies.set('NetworkError', {
      maxRetries: 3,
      backoffMultiplier: 2,
      initialDelay: 1000
    });
    
    // 資料庫錯誤：線性重試
    this.retryStrategies.set('DatabaseError', {
      maxRetries: 2,
      backoffMultiplier: 1,
      initialDelay: 500
    });
  }
  
  async handleError(error, context) {
    const classification = this.classifyError(error);
    
    switch (classification) {
      case ErrorClassification.RECOVERABLE:
        return await this.handleRecoverableError(error, context);
      
      case ErrorClassification.TEMPORARY:
        return await this.handleTemporaryError(error, context);
      
      case ErrorClassification.PERMANENT:
        return await this.handlePermanentError(error, context);
      
      case ErrorClassification.CRITICAL:
        return await this.handleCriticalError(error, context);
    }
  }
  
  async handleRecoverableError(error, context) {
    // 記錄錯誤但不中斷流程
    this.logger.warn('Recoverable error occurred', {
      error: error.message,
      context
    });
    
    // 返回降級結果
    return this.getFallbackResult(context);
  }
  
  async handleTemporaryError(error, context) {
    // 實施重試策略
    const strategy = this.retryStrategies.get(error.constructor.name);
    if (strategy && context.retryCount < strategy.maxRetries) {
      const delay = strategy.initialDelay * Math.pow(strategy.backoffMultiplier, context.retryCount);
      await this.sleep(delay);
      return { shouldRetry: true };
    }
    
    // 重試次數用完，轉為永久錯誤處理
    return await this.handlePermanentError(error, context);
  }
  
  async handlePermanentError(error, context) {
    // 記錄錯誤並通知相關人員
    this.logger.error('Permanent error occurred', {
      error: error.message,
      stack: error.stack,
      context
    });
    
    // 發送警報
    await this.alertService.sendAlert({
      level: 'error',
      message: `Permanent error in ${context.service}`,
      error: error.message
    });
    
    // 返回錯誤響應
    throw new PermanentError(error.message, error);
  }
  
  async handleCriticalError(error, context) {
    // 記錄嚴重錯誤
    this.logger.fatal('Critical error occurred', {
      error: error.message,
      stack: error.stack,
      context
    });
    
    // 立即發送緊急警報
    await this.alertService.sendUrgentAlert({
      level: 'critical',
      message: `Critical error in ${context.service}`,
      error: error.message,
      requiresImmediateAction: true
    });
    
    // 可能需要觸發熔斷機制
    await this.triggerCircuitBreaker(context.service);
    
    throw new CriticalError(error.message, error);
  }
}
```

#### 5.2 斷路器模式實現
```javascript
// 斷路器模式：防止級聯故障
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000;
    this.monitoringPeriod = options.monitoringPeriod || 10000;
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }
  
  async execute(operation) {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        throw new CircuitBreakerOpenError('Circuit breaker is open');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.failureThreshold) {
        this.state = 'CLOSED';
      }
    }
  }
  
  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
  
  shouldAttemptReset() {
    return Date.now() - this.lastFailureTime >= this.resetTimeout;
  }
}
```

### 6. 性能優化思維 (PERFORMANCE OPTIMIZATION THINKING)

#### 6.1 緩存策略實現
```javascript
// 多層緩存架構
class CacheManager {
  constructor() {
    this.memoryCache = new Map();
    this.redisCache = new RedisClient();
    this.cacheStrategies = new Map();
  }
  
  // 設置緩存策略
  setStrategy(key, strategy) {
    this.cacheStrategies.set(key, strategy);
  }
  
  async get(key) {
    const strategy = this.cacheStrategies.get(key) || 'memory-first';
    
    switch (strategy) {
      case 'memory-first':
        return await this.getMemoryFirst(key);
      case 'redis-first':
        return await this.getRedisFirst(key);
      case 'memory-only':
        return this.memoryCache.get(key);
      default:
        return await this.getMemoryFirst(key);
    }
  }
  
  async getMemoryFirst(key) {
    // 先查內存緩存
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key);
    }
    
    // 再查 Redis 緩存
    const value = await this.redisCache.get(key);
    if (value) {
      // 回寫到內存緩存
      this.memoryCache.set(key, value);
      return value;
    }
    
    return null;
  }
  
  async set(key, value, ttl = 3600) {
    const strategy = this.cacheStrategies.get(key) || 'memory-first';
    
    switch (strategy) {
      case 'memory-first':
        this.memoryCache.set(key, value);
        await this.redisCache.setex(key, ttl, value);
        break;
      case 'redis-first':
        await this.redisCache.setex(key, ttl, value);
        this.memoryCache.set(key, value);
        break;
      case 'memory-only':
        this.memoryCache.set(key, value);
        break;
    }
  }
}
```

#### 6.2 數據庫優化策略
```javascript
// 數據庫查詢優化
class OptimizedRepository {
  constructor(database, cacheManager) {
    this.database = database;
    this.cache = cacheManager;
    this.queryCache = new Map();
  }
  
  async findUserWithCache(userId, tenantId) {
    const cacheKey = `user:${tenantId}:${userId}`;
    
    // 先查緩存
    let user = await this.cache.get(cacheKey);
    if (user) {
      return user;
    }
    
    // 數據庫查詢
    user = await this.database.findOne({
      id: userId,
      tenantId: tenantId
    });
    
    if (user) {
      // 緩存結果
      await this.cache.set(cacheKey, user, 1800); // 30分鐘
    }
    
    return user;
  }
  
  async findUsersWithPagination(tenantId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    
    // 使用預編譯查詢
    const query = this.getOrCreateQuery('findUsersPaginated', `
      SELECT * FROM users 
      WHERE tenant_id = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `);
    
    return await query.execute([tenantId, limit, offset]);
  }
  
  getOrCreateQuery(name, sql) {
    if (!this.queryCache.has(name)) {
      this.queryCache.set(name, this.database.prepare(sql));
    }
    return this.queryCache.get(name);
  }
}
```

這些詳細的補充包含了：
1. **完整的架構思維**：服務邊界、多租戶、事件驅動
2. **深入的錯誤處理**：分類策略、斷路器模式
3. **性能優化思維**：緩存策略、數據庫優化
4. **具體的實現代碼**：可以直接使用的代碼模板
5. **深層的設計原理**：每個模式背後的邏輯

現在讓我也補充 ServicesChangeLog.md 檔案：

#### 4.1 服務邊界劃分原理
```
單一職責原理 (Single Responsibility Principle)：
- 每個服務只負責一個業務領域
- 服務內部的變更不應該影響其他服務
- 服務的接口應該穩定且明確

高內聚低耦合原理：
- 服務內部的組件應該緊密相關
- 服務之間的依賴應該最小化
- 通過明確的接口進行服務間通信

領域驅動設計原理：
- 按業務領域劃分服務邊界
- 每個服務擁有自己的數據模型
- 服務間通過領域事件通信
```

#### 4.2 多租戶架構實現思路
```javascript
// 多租戶架構的核心實現

// 1. 租戶上下文管理
class TenantContext {
  constructor() {
    this.tenantId = null;
    this.userId = null;
    this.permissions = [];
  }
  
  static create(tenantId, userId) {
    const context = new TenantContext();
    context.tenantId = tenantId;
    context.userId = userId;
    context.permissions = this.loadPermissions(tenantId, userId);
    return context;
  }
  
  hasPermission(permission) {
    return this.permissions.includes(permission);
  }
}

// 2. 租戶中間件
class TenantMiddleware {
  async handle(req, res, next) {
    try {
      // 從請求中提取租戶信息
      const tenantId = this.extractTenantId(req);
      const userId = this.extractUserId(req);
      
      // 驗證租戶權限
      if (!await this.validateTenantAccess(tenantId, userId)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // 創建租戶上下文
      req.tenantContext = TenantContext.create(tenantId, userId);
      
      next();
    } catch (error) {
      res.status(500).json({ error: 'Tenant validation failed' });
    }
  }
  
  extractTenantId(req) {
    return req.headers['x-tenant-id'] || req.user?.tenantId;
  }
}

// 3. 租戶感知的數據訪問
class TenantAwareRepository {
  constructor(database, tenantContext) {
    this.database = database;
    this.tenantContext = tenantContext;
  }
  
  async findUser(userId) {
    // 自動添加租戶過濾條件
    return await this.database.findOne({
      id: userId,
      tenantId: this.tenantContext.tenantId
    });
  }
  
  async createUser(userData) {
    // 自動添加租戶ID
    return await this.database.create({
      ...userData,
      tenantId: this.tenantContext.tenantId
    });
  }
}
```

### 5. 錯誤處理思維 (ERROR HANDLING THINKING)

#### 5.1 錯誤分類和處理策略
```javascript
// 錯誤分類體系
class ErrorClassification {
  static RECOVERABLE = 'recoverable';    // 可恢復錯誤
  static TEMPORARY = 'temporary';        // 臨時錯誤
  static PERMANENT = 'permanent';        // 永久錯誤
  static CRITICAL = 'critical';          // 嚴重錯誤
}

// 錯誤處理策略
class ErrorHandler {
  constructor(logger, alertService) {
    this.logger = logger;
    this.alertService = alertService;
    this.retryStrategies = new Map();
    this.setupRetryStrategies();
  }
  
  setupRetryStrategies() {
    // 網絡錯誤：指數退避重試
    this.retryStrategies.set('NetworkError', {
      maxRetries: 3,
      backoffMultiplier: 2,
      initialDelay: 1000
    });
    
    // 資料庫錯誤：線性重試
    this.retryStrategies.set('DatabaseError', {
      maxRetries: 2,
      backoffMultiplier: 1,
      initialDelay: 500
    });
  }
  
  async handleError(error, context) {
    const classification = this.classifyError(error);
    
    switch (classification) {
      case ErrorClassification.RECOVERABLE:
        return await this.handleRecoverableError(error, context);
      
      case ErrorClassification.TEMPORARY:
        return await this.handleTemporaryError(error, context);
      
      case ErrorClassification.PERMANENT:
        return await this.handlePermanentError(error, context);
      
      case ErrorClassification.CRITICAL:
        return await this.handleCriticalError(error, context);
    }
  }
  
  async handleRecoverableError(error, context) {
    // 記錄錯誤但不中斷流程
    this.logger.warn('Recoverable error occurred', {
      error: error.message,
      context
    });
    
    // 返回降級結果
    return this.getFallbackResult(context);
  }
  
  async handleTemporaryError(error, context) {
    // 實施重試策略
    const strategy = this.retryStrategies.get(error.constructor.name);
    if (strategy && context.retryCount < strategy.maxRetries) {
      const delay = strategy.initialDelay * Math.pow(strategy.backoffMultiplier, context.retryCount);
      await this.sleep(delay);
      return { shouldRetry: true };
    }
    
    // 重試次數用完，轉為永久錯誤處理
    return await this.handlePermanentError(error, context);
  }
}
```

這樣的詳細補充包含了：
1. **具體的思維原理**：為什麼要這樣思考
2. **實際的實現方法**：如何用代碼實現這些思路
3. **完整的示例代碼**：可以直接使用的代碼模板
4. **深層的邏輯解釋**：每個決策背後的原理

這些內容將幫助您在沒有 Claude 4 Thinking 的情況下，也能按照正確的思路和方法進行架構重構。

## 工具使用指南 (TOOL USAGE GUIDE)

### 1. 代碼搜索策略
```
語義搜索 (codebase_search)：
- 用於理解功能和流程
- 使用完整的問題描述
- 例："How does user authentication work?"

精確搜索 (grep_search)：
- 用於查找特定符號或模式
- 使用正則表達式
- 例："class.*Service" 查找所有服務類
```

### 2. 檔案操作策略
```
讀取檔案：
- 先讀取關鍵部分 (前50行、後50行)
- 根據需要讀取完整檔案
- 注意檔案大小限制

編輯檔案：
- 優先使用 edit_file 進行結構化編輯
- 使用 search_replace 進行精確替換
- 保持最小化變更原則
```

### 3. 測試執行策略
```
測試順序：
1. 單元測試 - 快速驗證核心邏輯
2. 集成測試 - 驗證服務交互
3. 端到端測試 - 驗證完整流程
4. 性能測試 - 確保性能不退化
```

## 成功標準 (SUCCESS CRITERIA)

### 1. 技術標準
- 所有測試通過率 > 95%
- 代碼覆蓋率 > 80%
- 響應時間 < 2秒
- 零停機時間

### 2. 架構標準
- 服務間依賴明確定義
- 支援多租戶架構
- 可水平擴展
- 具備完整的監控和日誌

### 3. 業務標準
- 用戶體驗無影響
- 功能完整性保持
- 數據完整性保證
- 系統穩定性提升

---

**重要提醒**: 每次進行重構操作前，都要仔細閱讀這些原則，確保遵循標準化流程，最大化成功率，最小化風險。 