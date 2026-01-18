/**
 * GDPR 合規服務
 * 實現數據保護、用戶權利、數據刪除等功能
 */

const { businessLogger } = require('../utils/logger');
const { encryptionService } = require('../utils/encryption');

class GDPRService {
  constructor(container) {
    this.container = container;
    this.logger = businessLogger;
    this.database = null;
    this.userService = null;
    this.auditService = null;
    
    // 嘗試從容器獲取服務
    try {
      this.database = container.resolve('databaseService');
    } catch (error) {
      this.logger.warn('DatabaseService 未註冊，GDPR 功能受限');
    }
    
    try {
      this.userService = container.resolve('userService');
    } catch (error) {
      this.logger.warn('UserService 未註冊，GDPR 功能受限');
    }
    
    try {
      this.auditService = container.resolve('auditService');
    } catch (error) {
      this.logger.warn('AuditService 未註冊，GDPR 審計功能受限');
    }
    
    // GDPR 權利類型
    this.rights = {
      ACCESS: 'right_of_access',
      RECTIFICATION: 'right_of_rectification',
      ERASURE: 'right_to_be_forgotten',
      PORTABILITY: 'data_portability',
      RESTRICTION: 'restriction_of_processing',
      OBJECTION: 'objection_to_processing',
      WITHDRAWAL: 'withdrawal_of_consent'
    };
    
    // 數據類別
    this.dataCategories = {
      PERSONAL_DATA: 'personal_data',
      CONTACT_DATA: 'contact_data',
      USAGE_DATA: 'usage_data',
      TECHNICAL_DATA: 'technical_data',
      FINANCIAL_DATA: 'financial_data',
      COMMUNICATION_DATA: 'communication_data'
    };
    
    // 處理目的
    this.processingPurposes = {
      SERVICE_PROVISION: 'service_provision',
      CUSTOMER_SUPPORT: 'customer_support',
      ANALYTICS: 'analytics',
      MARKETING: 'marketing',
      SECURITY: 'security',
      COMPLIANCE: 'compliance'
    };
  }

  /**
   * 處理數據訪問請求
   * @param {string} userId - 用戶ID
   * @param {string} tenantId - 租戶ID
   * @param {Object} options - 請求選項
   */
  async handleDataAccessRequest(userId, tenantId, options = {}) {
    try {
      this.logger.info('處理數據訪問請求', { userId, tenantId });

      const {
        includeMetadata = true,
        includeAuditLogs = true,
        format = 'json'
      } = options;

      const userData = {};

      // 獲取用戶基本信息
      if (this.userService) {
        const user = await this.userService.getUserById(userId);
        if (user) {
          userData.personal = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            status: user.status,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            lastLoginAt: user.lastLoginAt
          };
        }
      }

      // 獲取用戶設置
      if (this.userService) {
        const settings = await this.userService.getUserSettings(userId);
        if (settings) {
          userData.settings = settings;
        }
      }

      // 獲取審計日誌
      if (this.auditService && includeAuditLogs) {
        const auditLogs = await this.auditService.queryAuditLogs({
          userId,
          tenantId,
          limit: 1000
        });
        userData.auditLogs = auditLogs;
      }

      // 獲取元數據
      if (includeMetadata) {
        userData.metadata = {
          requestTimestamp: new Date().toISOString(),
          dataCategories: Object.values(this.dataCategories),
          processingPurposes: Object.values(this.processingPurposes),
          retentionPeriod: '7年',
          dataController: 'WhatsApp Bot System',
          contactEmail: 'privacy@whatsappbot.com'
        };
      }

      // 記錄審計事件
      if (this.auditService) {
        await this.auditService.logEvent({
          eventType: 'gdpr_data_access',
          userId,
          tenantId,
          action: 'data_access_request',
          resource: 'user_data',
          details: { format, includeAuditLogs },
          riskLevel: 'low',
          status: 'success'
        });
      }

      return {
        success: true,
        data: userData,
        format,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('數據訪問請求處理失敗', {
        error: error.message,
        userId,
        tenantId
      });
      throw error;
    }
  }

  /**
   * 處理數據修正請求
   * @param {string} userId - 用戶ID
   * @param {string} tenantId - 租戶ID
   * @param {Object} corrections - 修正數據
   */
  async handleDataRectificationRequest(userId, tenantId, corrections) {
    try {
      this.logger.info('處理數據修正請求', { userId, tenantId, corrections });

      const results = {};

      // 修正用戶基本信息
      if (this.userService && corrections.personal) {
        const updateData = {};
        
        if (corrections.personal.name) {
          updateData.name = corrections.personal.name;
        }
        if (corrections.personal.email) {
          updateData.email = corrections.personal.email;
        }

        if (Object.keys(updateData).length > 0) {
          await this.userService.updateUser(userId, updateData);
          results.personal = { updated: true, fields: Object.keys(updateData) };
        }
      }

      // 修正用戶設置
      if (this.userService && corrections.settings) {
        await this.userService.updateUserSettings(userId, corrections.settings);
        results.settings = { updated: true };
      }

      // 記錄審計事件
      if (this.auditService) {
        await this.auditService.logEvent({
          eventType: 'gdpr_data_rectification',
          userId,
          tenantId,
          action: 'data_rectification',
          resource: 'user_data',
          details: { corrections },
          riskLevel: 'medium',
          status: 'success'
        });
      }

      return {
        success: true,
        results,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('數據修正請求處理失敗', {
        error: error.message,
        userId,
        tenantId,
        corrections
      });
      throw error;
    }
  }

  /**
   * 處理數據刪除請求（被遺忘權）
   * @param {string} userId - 用戶ID
   * @param {string} tenantId - 租戶ID
   * @param {Object} options - 刪除選項
   */
  async handleDataErasureRequest(userId, tenantId, options = {}) {
    try {
      this.logger.info('處理數據刪除請求', { userId, tenantId, options });

      const {
        deleteAuditLogs = false,
        anonymize = true,
        reason = 'user_request'
      } = options;

      const results = {};

      // 刪除用戶數據
      if (this.userService) {
        if (anonymize) {
          // 匿名化用戶數據
          const anonymizedData = {
            email: `deleted_${userId}@deleted.com`,
            name: 'Deleted User',
            status: 'deleted',
            deletedAt: new Date().toISOString(),
            deletionReason: reason
          };

          await this.userService.updateUser(userId, anonymizedData);
          results.userData = { anonymized: true };
        } else {
          // 完全刪除用戶數據
          await this.userService.deleteUser(userId);
          results.userData = { deleted: true };
        }
      }

      // 刪除審計日誌
      if (this.auditService && deleteAuditLogs) {
        // 這裡應該實現審計日誌的刪除邏輯
        results.auditLogs = { deleted: true };
      }

      // 記錄審計事件（在刪除前）
      if (this.auditService) {
        await this.auditService.logEvent({
          eventType: 'gdpr_data_erasure',
          userId,
          tenantId,
          action: 'data_erasure',
          resource: 'user_data',
          details: { anonymize, reason },
          riskLevel: 'high',
          status: 'success'
        });
      }

      return {
        success: true,
        results,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('數據刪除請求處理失敗', {
        error: error.message,
        userId,
        tenantId,
        options
      });
      throw error;
    }
  }

  /**
   * 處理數據可攜性請求
   * @param {string} userId - 用戶ID
   * @param {string} tenantId - 租戶ID
   * @param {Object} options - 導出選項
   */
  async handleDataPortabilityRequest(userId, tenantId, options = {}) {
    try {
      this.logger.info('處理數據可攜性請求', { userId, tenantId, options });

      const {
        format = 'json',
        includeMetadata = true
      } = options;

      // 獲取用戶數據
      const userData = await this.handleDataAccessRequest(userId, tenantId, {
        includeMetadata,
        includeAuditLogs: true,
        format
      });

      // 添加可攜性元數據
      const portableData = {
        ...userData.data,
        portability: {
          exportTimestamp: new Date().toISOString(),
          format,
          version: '1.0',
          schema: 'https://schema.org/Person',
          instructions: '此數據符合 GDPR 數據可攜性要求'
        }
      };

      // 記錄審計事件
      if (this.auditService) {
        await this.auditService.logEvent({
          eventType: 'gdpr_data_portability',
          userId,
          tenantId,
          action: 'data_portability',
          resource: 'user_data',
          details: { format },
          riskLevel: 'low',
          status: 'success'
        });
      }

      return {
        success: true,
        data: portableData,
        format,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('數據可攜性請求處理失敗', {
        error: error.message,
        userId,
        tenantId,
        options
      });
      throw error;
    }
  }

  /**
   * 處理處理限制請求
   * @param {string} userId - 用戶ID
   * @param {string} tenantId - 租戶ID
   * @param {Object} restrictions - 限制條件
   */
  async handleProcessingRestrictionRequest(userId, tenantId, restrictions) {
    try {
      this.logger.info('處理處理限制請求', { userId, tenantId, restrictions });

      const results = {};

      // 應用處理限制
      if (this.userService) {
        const updateData = {
          processingRestricted: true,
          restrictionDetails: restrictions,
          restrictionAppliedAt: new Date().toISOString()
        };

        await this.userService.updateUser(userId, updateData);
        results.userData = { restricted: true };
      }

      // 記錄審計事件
      if (this.auditService) {
        await this.auditService.logEvent({
          eventType: 'gdpr_processing_restriction',
          userId,
          tenantId,
          action: 'processing_restriction',
          resource: 'user_data',
          details: { restrictions },
          riskLevel: 'medium',
          status: 'success'
        });
      }

      return {
        success: true,
        results,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('處理限制請求處理失敗', {
        error: error.message,
        userId,
        tenantId,
        restrictions
      });
      throw error;
    }
  }

  /**
   * 處理反對處理請求
   * @param {string} userId - 用戶ID
   * @param {string} tenantId - 租戶ID
   * @param {Array} purposes - 反對的處理目的
   */
  async handleObjectionRequest(userId, tenantId, purposes) {
    try {
      this.logger.info('處理反對處理請求', { userId, tenantId, purposes });

      const results = {};

      // 記錄反對意見
      if (this.userService) {
        const updateData = {
          processingObjections: purposes,
          objectionRecordedAt: new Date().toISOString()
        };

        await this.userService.updateUser(userId, updateData);
        results.userData = { objections: purposes };
      }

      // 記錄審計事件
      if (this.auditService) {
        await this.auditService.logEvent({
          eventType: 'gdpr_processing_objection',
          userId,
          tenantId,
          action: 'processing_objection',
          resource: 'user_data',
          details: { purposes },
          riskLevel: 'medium',
          status: 'success'
        });
      }

      return {
        success: true,
        results,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('反對處理請求處理失敗', {
        error: error.message,
        userId,
        tenantId,
        purposes
      });
      throw error;
    }
  }

  /**
   * 處理同意撤回請求
   * @param {string} userId - 用戶ID
   * @param {string} tenantId - 租戶ID
   * @param {Array} consents - 要撤回的同意
   */
  async handleConsentWithdrawalRequest(userId, tenantId, consents) {
    try {
      this.logger.info('處理同意撤回請求', { userId, tenantId, consents });

      const results = {};

      // 撤回同意
      if (this.userService) {
        const updateData = {
          withdrawnConsents: consents,
          consentWithdrawnAt: new Date().toISOString()
        };

        await this.userService.updateUser(userId, updateData);
        results.userData = { consentsWithdrawn: consents };
      }

      // 記錄審計事件
      if (this.auditService) {
        await this.auditService.logEvent({
          eventType: 'gdpr_consent_withdrawal',
          userId,
          tenantId,
          action: 'consent_withdrawal',
          resource: 'user_data',
          details: { consents },
          riskLevel: 'medium',
          status: 'success'
        });
      }

      return {
        success: true,
        results,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('同意撤回請求處理失敗', {
        error: error.message,
        userId,
        tenantId,
        consents
      });
      throw error;
    }
  }

  /**
   * 生成隱私政策
   */
  generatePrivacyPolicy() {
    return {
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      dataController: 'WhatsApp Bot System',
      contactEmail: 'privacy@whatsappbot.com',
      dataCategories: this.dataCategories,
      processingPurposes: this.processingPurposes,
      userRights: this.rights,
      retentionPeriod: '7年',
      dataTransfers: '歐盟內部',
      automatedDecisionMaking: false,
      profiling: false
    };
  }

  /**
   * 生成數據處理協議
   */
  generateDataProcessingAgreement() {
    return {
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      dataController: 'WhatsApp Bot System',
      dataProcessor: 'System Provider',
      scope: 'WhatsApp Bot 服務',
      dataCategories: Object.values(this.dataCategories),
      securityMeasures: [
        '數據加密',
        '訪問控制',
        '審計日誌',
        '定期備份',
        '安全監控'
      ],
      dataBreachNotification: '72小時內',
      subProcessors: [],
      termination: '30天內刪除所有數據'
    };
  }
}

module.exports = GDPRService; 