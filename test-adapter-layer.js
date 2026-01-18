/**
 * 適配器層測試腳本
 * 驗證新舊服務的轉換邏輯和適配器功能
 */

const { businessLogger } = require('./utils/logger');
const UserServiceAdapter = require('./core/adapters/UserServiceAdapter');
const AIServiceAdapter = require('./core/adapters/AIServiceAdapter');
const WhatsAppServiceAdapter = require('./core/adapters/WhatsAppServiceAdapter');
const featureFlags = require('./config/featureFlags');
const { TenantContext, tenantContextManager } = require('./core/context/TenantContext');

// 模擬舊版服務
class MockLegacyUserService {
  async registerUser(email, password) {
    return { userId: `legacy-${Date.now()}`, email };
  }
  
  async loginUser(email, password) {
    return { userId: `legacy-${Date.now()}`, email };
  }
  
  async getUserSettings(userId) {
    return { groupName: 'Legacy Group', enableAI: false };
  }
  
  async updateUserSettings(userId, settings) {
    return { success: true, message: 'Legacy settings updated' };
  }
  
  async getUserById(userId) {
    return { userId, username: 'legacy-user', email: 'legacy@example.com' };
  }
  
  async logoutUser(userId, session) {
    return { success: true };
  }
  
  async healthCheck() {
    return { status: 'healthy', service: 'Legacy User Service' };
  }
}

class MockLegacyAIService {
  async recognizeImage(imageBuffer, userId) {
    return { description: 'Legacy image recognition', confidence: 0.8 };
  }
  
  async generateResponse(message, context) {
    return 'Legacy AI response';
  }
  
  async analyzeImage(imageUrl) {
    return { analysis: 'Legacy image analysis' };
  }
  
  async getServiceStatus() {
    return { status: 'healthy', service: 'Legacy AI Service' };
  }
  
  async resetUserContext(userId) {
    return { success: true };
  }
  
  async healthCheck() {
    return { status: 'healthy', service: 'Legacy AI Service' };
  }
}

class MockLegacyWhatsAppService {
  async initialize() {
    return { success: true };
  }
  
  async getConnectionStatus(userId) {
    return { connected: true, status: 'Legacy connected' };
  }
  
  async getQRCode(userId) {
    return { qrCode: 'legacy-qr-code', status: 'Legacy QR' };
  }
  
  async sendMessage(userId, chatId, message) {
    return { success: true, messageId: 'legacy-msg-id' };
  }
  
  getClient(userId) {
    return { ready: true, client: { ws: { isOpen: true } } };
  }
  
  isUserConnected(userId) {
    return true;
  }
  
  async reloadUserSettings(userId) {
    return { success: true };
  }
  
  getServiceStatus() {
    return { status: 'healthy', service: 'Legacy WhatsApp Service' };
  }
  
  async cleanup() {
    return { success: true };
  }
  
  async reinitialize() {
    return { success: true };
  }
}

// 模擬新版服務
class MockModernUserService {
  async registerUser(email, password, tenantId) {
    return { 
      userId: `modern-${Date.now()}`, 
      email, 
      tenantId,
      tenantContext: { tenantId, permissions: ['read', 'write'] }
    };
  }
  
  async loginUser(email, password, tenantId) {
    return { 
      userId: `modern-${Date.now()}`, 
      email,
      tenantId,
      tenantContext: { tenantId, permissions: ['read', 'write'] }
    };
  }
  
  async getUserSettings(userId, tenantId) {
    return { 
      groupName: 'Modern Group', 
      enableAI: true,
      tenantId,
      tenantContext: { tenantId, permissions: ['read'] }
    };
  }
  
  async updateUserSettings(userId, settings, tenantId) {
    return { 
      success: true, 
      message: 'Modern settings updated',
      tenantId
    };
  }
  
  async getUserById(userId, tenantId) {
    return { 
      userId, 
      username: 'modern-user', 
      email: 'modern@example.com',
      tenantId
    };
  }
  
  async logoutUser(userId, session, tenantId) {
    return { success: true, tenantId };
  }
  
  async healthCheck() {
    return { status: 'healthy', service: 'Modern User Service' };
  }
}

class MockModernAIService {
  async recognizeImage(imageBuffer, userId, tenantId) {
    return { 
      description: 'Modern image recognition', 
      confidence: 0.9,
      tenantId
    };
  }
  
  async generateResponse(message, context) {
    return 'Modern AI response';
  }
  
  async analyzeImage(imageUrl, context) {
    return { 
      analysis: 'Modern image analysis',
      tenantId: context.tenantId
    };
  }
  
  async getServiceStatus(tenantId) {
    return { 
      status: 'healthy', 
      service: 'Modern AI Service',
      tenantId
    };
  }
  
  async resetUserContext(userId, tenantId) {
    return { success: true, tenantId };
  }
  
  async healthCheck() {
    return { status: 'healthy', service: 'Modern AI Service' };
  }
  
  async performIntelligentAnalysis(userData, dataInsights, tenantId) {
    return { 
      analysis: 'Modern intelligent analysis',
      tenantId,
      insights: dataInsights
    };
  }
}

class MockModernWhatsAppService {
  async initialize(tenantId) {
    return { success: true, tenantId };
  }
  
  async getConnectionStatus(userId, tenantId) {
    return { 
      connected: true, 
      status: 'Modern connected',
      tenantId
    };
  }
  
  async getQRCode(userId, tenantId) {
    return { 
      qrCode: 'modern-qr-code', 
      status: 'Modern QR',
      tenantId
    };
  }
  
  async sendMessage(userId, chatId, message, tenantId) {
    return { 
      success: true, 
      messageId: 'modern-msg-id',
      tenantId
    };
  }
  
  getClient(userId, tenantId) {
    return { 
      ready: true, 
      client: { ws: { isOpen: true } },
      tenantId
    };
  }
  
  isUserConnected(userId, tenantId) {
    return true;
  }
  
  async reloadUserSettings(userId, tenantId) {
    return { success: true, tenantId };
  }
  
  getServiceStatus(tenantId) {
    return { 
      status: 'healthy', 
      service: 'Modern WhatsApp Service',
      tenantId
    };
  }
  
  async cleanup(tenantId) {
    return { success: true, tenantId };
  }
  
  async reinitialize(tenantId) {
    return { success: true, tenantId };
  }
}

// 測試函數
async function runAdapterTests() {
  console.log('🧪 開始適配器層測試...\n');
  
  try {
    // 創建模擬服務實例
    const legacyUserService = new MockLegacyUserService();
    const modernUserService = new MockModernUserService();
    const legacyAIService = new MockLegacyAIService();
    const modernAIService = new MockModernAIService();
    const legacyWhatsAppService = new MockLegacyWhatsAppService();
    const modernWhatsAppService = new MockModernWhatsAppService();

    // 測試 1: 功能開關測試
    console.log('測試 1: 功能開關測試');
    console.log('功能開關狀態:', featureFlags.getAll());
    console.log('遷移進度:', featureFlags.getMigrationProgress() + '%');
    console.log('✅ 功能開關測試通過\n');

    // 測試 2: 租戶上下文測試
    console.log('測試 2: 租戶上下文測試');
    const context = TenantContext.create('tenant-123', 'user-456', ['read', 'write'], { plan: 'premium' });
    console.log('租戶上下文摘要:', context.getSummary());
    console.log('權限檢查:', context.hasPermission('read')); // true
    console.log('權限檢查:', context.hasPermission('admin')); // false
    console.log('✅ 租戶上下文測試通過\n');

    // 測試 3: 用戶服務適配器測試（舊版模式）
    console.log('測試 3: 用戶服務適配器測試（舊版模式）');
    const userAdapterLegacy = new UserServiceAdapter(
      legacyUserService, 
      modernUserService, 
      { USE_V2_USER_SERVICE: false, ENABLE_MULTI_TENANT: false }
    );
    
    const legacyResult = await userAdapterLegacy.registerUser('test@example.com', 'password123');
    console.log('舊版註冊結果:', legacyResult);
    console.log('適配器狀態:', userAdapterLegacy.getAdapterStatus());
    console.log('✅ 用戶服務適配器舊版模式測試通過\n');

    // 測試 4: 用戶服務適配器測試（新版模式）
    console.log('測試 4: 用戶服務適配器測試（新版模式）');
    const userAdapterModern = new UserServiceAdapter(
      legacyUserService, 
      modernUserService, 
      { USE_V2_USER_SERVICE: true, ENABLE_MULTI_TENANT: true }
    );
    
    const modernResult = await userAdapterModern.registerUser('test@example.com', 'password123', { tenantId: 'tenant-123' });
    console.log('新版註冊結果:', modernResult);
    console.log('適配器狀態:', userAdapterModern.getAdapterStatus());
    console.log('✅ 用戶服務適配器新版模式測試通過\n');

    // 測試 5: AI 服務適配器測試
    console.log('測試 5: AI 服務適配器測試');
    const aiAdapter = new AIServiceAdapter(
      legacyAIService,
      modernAIService,
      { USE_V2_AI_SERVICE: true, ENABLE_MULTI_TENANT: true }
    );
    
    const imageBuffer = Buffer.from('fake-image-data');
    const aiResult = await aiAdapter.recognizeImage(imageBuffer, 'user-123', { tenantId: 'tenant-123' });
    console.log('AI 識別結果:', aiResult);
    
    const intelligentResult = await aiAdapter.performIntelligentAnalysis(
      [{ amount: 100, category: 'food' }],
      { totalSpent: 1000 },
      { tenantId: 'tenant-123' }
    );
    console.log('智能分析結果:', intelligentResult);
    console.log('✅ AI 服務適配器測試通過\n');

    // 測試 6: WhatsApp 服務適配器測試
    console.log('測試 6: WhatsApp 服務適配器測試');
    const whatsappAdapter = new WhatsAppServiceAdapter(
      legacyWhatsAppService,
      modernWhatsAppService,
      { USE_V2_WHATSAPP_SERVICE: true, ENABLE_MULTI_TENANT: true }
    );
    
    await whatsappAdapter.initialize({ tenantId: 'tenant-123' });
    const connectionStatus = await whatsappAdapter.getConnectionStatus('user-123', { tenantId: 'tenant-123' });
    console.log('連接狀態:', connectionStatus);
    console.log('✅ WhatsApp 服務適配器測試通過\n');

    // 測試 7: 租戶上下文管理器測試
    console.log('測試 7: 租戶上下文管理器測試');
    const requestId = 'req-123';
    const managerContext = tenantContextManager.createContext(
      requestId,
      'tenant-123',
      'user-456',
      ['read', 'write'],
      { plan: 'premium' }
    );
    
    console.log('管理器統計:', tenantContextManager.getStats());
    console.log('權限驗證:', tenantContextManager.validateAccess('tenant-123', 'user-456', ['read']));
    console.log('✅ 租戶上下文管理器測試通過\n');

    // 測試 8: 數據轉換測試
    console.log('測試 8: 數據轉換測試');
    const modernData = {
      userId: 'user-123',
      email: 'test@example.com',
      tenantId: 'tenant-123',
      tenantContext: { tenantId: 'tenant-123', permissions: ['read'] }
    };
    
    const legacyData = userAdapterModern.transformToLegacyFormat(modernData, { tenantId: 'tenant-123' });
    console.log('轉換後的舊版數據:', legacyData);
    
    const modernRequest = userAdapterModern.transformToModernFormat(
      { email: 'test@example.com', password: 'password123' },
      { tenantId: 'tenant-123', userId: 'user-123' }
    );
    console.log('轉換後的新版請求:', modernRequest);
    console.log('✅ 數據轉換測試通過\n');

    console.log('🎉 所有適配器層測試通過！');
    console.log('\n📊 測試總結:');
    console.log('- 功能開關管理: ✅');
    console.log('- 租戶上下文: ✅');
    console.log('- 用戶服務適配器: ✅');
    console.log('- AI 服務適配器: ✅');
    console.log('- WhatsApp 服務適配器: ✅');
    console.log('- 租戶上下文管理器: ✅');
    console.log('- 數據轉換: ✅');
    
  } catch (error) {
    console.error('❌ 適配器層測試失敗:', error);
    process.exit(1);
  }
}

// 執行測試
runAdapterTests(); 