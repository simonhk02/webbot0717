/**
 * V2 服務統一導出
 * 提供多租戶架構的企業級服務
 */

const UserServiceV2 = require('./UserServiceV2');
const AIServiceV2 = require('./AIServiceV2');
const WhatsAppServiceV2 = require('./WhatsAppServiceV2');

module.exports = {
  UserServiceV2,
  AIServiceV2,
  WhatsAppServiceV2
};

// 同時導出建構函數
module.exports.UserServiceV2 = UserServiceV2;
module.exports.AIServiceV2 = AIServiceV2;
module.exports.WhatsAppServiceV2 = WhatsAppServiceV2; 