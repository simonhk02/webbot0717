// 測試 AIServiceV2
try {
  const AIServiceV2 = require('./services/v2/AIServiceV2');
  console.log('[AIServiceV2] typeof:', typeof AIServiceV2);
  const ai = new AIServiceV2();
  console.log('[AIServiceV2] new 實例成功:', ai && typeof ai === 'object');
} catch (e) {
  console.error('[AIServiceV2] require/new 失敗:', e);
}

// 測試 WhatsAppServiceV2
try {
  const WhatsAppServiceV2 = require('./services/v2/WhatsAppServiceV2');
  console.log('[WhatsAppServiceV2] typeof:', typeof WhatsAppServiceV2);
  const wa = new WhatsAppServiceV2();
  console.log('[WhatsAppServiceV2] new 實例成功:', wa && typeof wa === 'object');
} catch (e) {
  console.error('[WhatsAppServiceV2] require/new 失敗:', e);
} 