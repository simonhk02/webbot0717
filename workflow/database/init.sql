-- 工作流系統數據庫初始化腳本

-- 創建工作流表
CREATE TABLE IF NOT EXISTS workflows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    steps TEXT NOT NULL, -- JSON格式的工作流步驟
    triggers TEXT, -- JSON格式的觸發器配置
    user_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    status TEXT DEFAULT 'active', -- active, inactive, deleted
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 創建工作流執行歷史表
CREATE TABLE IF NOT EXISTS workflow_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    input_data TEXT, -- JSON格式的輸入數據
    output_data TEXT, -- JSON格式的輸出數據
    status TEXT DEFAULT 'running', -- running, completed, failed
    error_message TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);

-- 創建機械人配置表
CREATE TABLE IF NOT EXISTS bots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- whatsapp, telegram, discord, etc.
    config TEXT NOT NULL, -- JSON格式的配置
    user_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 創建工作流模板表
CREATE TABLE IF NOT EXISTS workflow_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- 模板分類
    steps TEXT NOT NULL, -- JSON格式的步驟模板
    user_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    is_public BOOLEAN DEFAULT 0, -- 是否公開模板
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_workflows_user_tenant ON workflows(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_executions_user_tenant ON workflow_executions(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_bots_user_tenant ON bots(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_templates_category ON workflow_templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_user_tenant ON workflow_templates(user_id, tenant_id); 