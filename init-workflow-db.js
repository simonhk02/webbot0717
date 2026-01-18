/**
 * 工作流系統數據庫初始化腳本
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class WorkflowDatabaseInitializer {
  constructor() {
    this.dbPath = path.join(__dirname, 'workflow.db');
    this.initSqlPath = path.join(__dirname, 'workflow', 'database', 'init.sql');
  }

  async initialize() {
    console.log('🚀 開始初始化工作流系統數據庫...');
    
    try {
      // 檢查SQL文件是否存在
      if (!fs.existsSync(this.initSqlPath)) {
        throw new Error(`SQL初始化文件不存在: ${this.initSqlPath}`);
      }

      // 讀取SQL文件
      const sqlContent = fs.readFileSync(this.initSqlPath, 'utf8');
      
      // 創建數據庫連接
      const db = new sqlite3.Database(this.dbPath);
      
      // 執行SQL語句
      const statements = sqlContent.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          await this.executeStatement(db, statement);
        }
      }

      // 插入一些示例數據
      await this.insertSampleData(db);
      
      db.close();
      
      console.log('✅ 工作流系統數據庫初始化完成！');
      console.log(`📁 數據庫文件: ${this.dbPath}`);
      
    } catch (error) {
      console.error('❌ 數據庫初始化失敗:', error);
      throw error;
    }
  }

  executeStatement(db, sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, (err) => {
        if (err) {
          console.error('SQL執行錯誤:', err);
          console.error('SQL語句:', sql);
          console.error('參數:', params);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async insertSampleData(db) {
    console.log('📝 插入示例數據...');
    
    const sampleWorkflow = {
      name: '示例工作流',
      description: '這是一個示例工作流，用於演示系統功能',
      steps: JSON.stringify([
        {
          id: 'step1',
          type: 'message',
          name: '發送歡迎消息',
          config: {
            message: '歡迎使用工作流系統！'
          }
        },
        {
          id: 'step2',
          type: 'condition',
          name: '檢查條件',
          config: {
            condition: 'input.value > 0'
          }
        }
      ]),
      triggers: JSON.stringify([
        {
          type: 'webhook',
          config: {
            url: '/api/webhook/trigger'
          }
        }
      ]),
      user_id: 'demo-user',
      tenant_id: 'demo-tenant'
    };

    const insertWorkflow = `
      INSERT INTO workflows (name, description, steps, triggers, user_id, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    await this.executeStatement(db, insertWorkflow, [
      sampleWorkflow.name,
      sampleWorkflow.description,
      sampleWorkflow.steps,
      sampleWorkflow.triggers,
      sampleWorkflow.user_id,
      sampleWorkflow.tenant_id
    ]);

    // 插入示例機械人
    const sampleBot = {
      name: '示例WhatsApp機械人',
      type: 'whatsapp',
      config: JSON.stringify({
        phoneNumber: '+1234567890',
        webhookUrl: '/api/bot/webhook'
      }),
      user_id: 'demo-user',
      tenant_id: 'demo-tenant'
    };

    const insertBot = `
      INSERT INTO bots (name, type, config, user_id, tenant_id)
      VALUES (?, ?, ?, ?, ?)
    `;

    await this.executeStatement(db, insertBot, [
      sampleBot.name,
      sampleBot.type,
      sampleBot.config,
      sampleBot.user_id,
      sampleBot.tenant_id
    ]);

    // 插入示例模板
    const sampleTemplate = {
      name: '客戶服務工作流',
      description: '自動化客戶服務流程',
      category: 'customer-service',
      steps: JSON.stringify([
        {
          id: 'welcome',
          type: 'message',
          name: '歡迎客戶',
          config: {
            message: '您好！歡迎使用我們的服務。'
          }
        },
        {
          id: 'collect_info',
          type: 'form',
          name: '收集客戶信息',
          config: {
            fields: ['姓名', '電話', '問題描述']
          }
        }
      ]),
      user_id: 'demo-user',
      tenant_id: 'demo-tenant',
      is_public: 1
    };

    const insertTemplate = `
      INSERT INTO workflow_templates (name, description, category, steps, user_id, tenant_id, is_public)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await this.executeStatement(db, insertTemplate, [
      sampleTemplate.name,
      sampleTemplate.description,
      sampleTemplate.category,
      sampleTemplate.steps,
      sampleTemplate.user_id,
      sampleTemplate.tenant_id,
      sampleTemplate.is_public
    ]);

    console.log('✅ 示例數據插入完成');
  }
}

// 執行初始化
if (require.main === module) {
  const initializer = new WorkflowDatabaseInitializer();
  initializer.initialize()
    .then(() => {
      console.log('🎉 工作流系統數據庫初始化成功！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 初始化失敗:', error);
      process.exit(1);
    });
}

module.exports = WorkflowDatabaseInitializer; 