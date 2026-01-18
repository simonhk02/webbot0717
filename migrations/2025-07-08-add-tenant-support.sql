-- 數據庫遷移：添加多租戶支持
-- 日期：2025-07-08
-- 描述：為所有表添加 tenantId 欄位，實現租戶隔離

-- 1. 為用戶表添加租戶支持
ALTER TABLE users ADD COLUMN tenantId TEXT DEFAULT 'default';
CREATE INDEX idx_users_tenant_id ON users(tenantId);

-- 2. 為設置表添加租戶支持
ALTER TABLE settings ADD COLUMN tenantId TEXT DEFAULT 'default';
CREATE INDEX idx_settings_tenant_id ON settings(tenantId);

-- 3. 為消息表添加租戶支持
ALTER TABLE messages ADD COLUMN tenantId TEXT DEFAULT 'default';
CREATE INDEX idx_messages_tenant_id ON messages(tenantId);

-- 4. 為會話表添加租戶支持
ALTER TABLE sessions ADD COLUMN tenantId TEXT DEFAULT 'default';
CREATE INDEX idx_sessions_tenant_id ON sessions(tenantId);

-- 5. 為日誌表添加租戶支持
ALTER TABLE logs ADD COLUMN tenantId TEXT DEFAULT 'default';
CREATE INDEX idx_logs_tenant_id ON logs(tenantId);

-- 6. 為審計表添加租戶支持
ALTER TABLE audit_logs ADD COLUMN tenantId TEXT DEFAULT 'default';
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenantId);

-- 7. 創建租戶表
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT UNIQUE,
    status TEXT DEFAULT 'active',
    plan TEXT DEFAULT 'basic',
    maxUsers INTEGER DEFAULT 10,
    maxStorage INTEGER DEFAULT 1000000,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
);

-- 8. 創建租戶配置表
CREATE TABLE IF NOT EXISTS tenant_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenantId TEXT NOT NULL,
    configKey TEXT NOT NULL,
    configValue TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    UNIQUE(tenantId, configKey),
    FOREIGN KEY (tenantId) REFERENCES tenants(id)
);

-- 9. 創建租戶資源使用表
CREATE TABLE IF NOT EXISTS tenant_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenantId TEXT NOT NULL,
    resourceType TEXT NOT NULL,
    usageCount INTEGER DEFAULT 0,
    usageLimit INTEGER DEFAULT 0,
    resetDate TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    UNIQUE(tenantId, resourceType),
    FOREIGN KEY (tenantId) REFERENCES tenants(id)
);

-- 10. 插入默認租戶
INSERT OR IGNORE INTO tenants (id, name, domain, status, plan) 
VALUES ('default', 'Default Tenant', 'default.local', 'active', 'basic');

-- 11. 更新現有數據的租戶ID
UPDATE users SET tenantId = 'default' WHERE tenantId IS NULL;
UPDATE settings SET tenantId = 'default' WHERE tenantId IS NULL;
UPDATE messages SET tenantId = 'default' WHERE tenantId IS NULL;
UPDATE sessions SET tenantId = 'default' WHERE tenantId IS NULL;
UPDATE logs SET tenantId = 'default' WHERE tenantId IS NULL;
UPDATE audit_logs SET tenantId = 'default' WHERE tenantId IS NULL;

-- 12. 創建租戶隔離視圖
CREATE VIEW IF NOT EXISTS tenant_users AS
SELECT u.*, t.name as tenant_name, t.status as tenant_status
FROM users u
JOIN tenants t ON u.tenantId = t.id;

-- 13. 創建租戶統計視圖
CREATE VIEW IF NOT EXISTS tenant_stats AS
SELECT 
    t.id as tenant_id,
    t.name as tenant_name,
    t.plan as tenant_plan,
    COUNT(DISTINCT u.id) as user_count,
    COUNT(DISTINCT s.id) as session_count,
    COUNT(DISTINCT m.id) as message_count
FROM tenants t
LEFT JOIN users u ON t.id = u.tenantId
LEFT JOIN sessions s ON t.id = s.tenantId
LEFT JOIN messages m ON t.id = m.tenantId
GROUP BY t.id, t.name, t.plan; 