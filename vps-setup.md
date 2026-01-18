# 🚀 VPS 部署指南

## 📋 系統需求

### 最低配置建議
- **CPU**: 1核心
- **RAM**: 1GB (建議2GB)
- **硬碟**: 10GB
- **系統**: Ubuntu 20.04+ / CentOS 7+
- **網路**: 穩定的網際網路連線

### 必要軟體
- Node.js 18+
- Redis 6+
- PM2 (程序管理器)
- Nginx (可選，用作反向代理)

## 🔧 VPS 初始設置

### 1. 更新系統
```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y

# CentOS/RHEL
sudo yum update -y
```

### 2. 安裝 Node.js
```bash
# 使用 NodeSource 倉庫
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 驗證安裝
node -v
npm -v
```

### 3. 安裝 Redis
```bash
# Ubuntu/Debian
sudo apt install redis-server -y

# 啟動並設為開機自啟
sudo systemctl start redis
sudo systemctl enable redis

# 測試 Redis
redis-cli ping
```

### 4. 安裝 PM2
```bash
sudo npm install -g pm2
```

## 📦 應用程式部署

### 方法一：使用自動部署腳本

1. **上傳程式碼到 VPS**
```bash
# 在本地打包
tar -czf whatsapp-bot.tar.gz --exclude=node_modules --exclude=.git .

# 上傳到 VPS (替換為你的 VPS IP)
scp whatsapp-bot.tar.gz user@你的VPS_IP:/home/user/

# 在 VPS 上解壓
ssh user@你的VPS_IP
tar -xzf whatsapp-bot.tar.gz
cd whatsapp-bot
```

2. **執行部署腳本**
```bash
chmod +x deploy.sh
sudo ./deploy.sh
```

### 方法二：手動部署

1. **建立應用程式目錄**
```bash
sudo mkdir -p /var/www/whatsapp-bot
sudo chown -R $USER:$USER /var/www/whatsapp-bot
```

2. **複製檔案**
```bash
cp -r ./* /var/www/whatsapp-bot/
cd /var/www/whatsapp-bot
```

3. **安裝依賴**
```bash
npm install --production
```

4. **配置環境變數**
```bash
cp env.production .env
nano .env  # 編輯配置
```

5. **建立必要目錄**
```bash
mkdir -p logs auth credentials
```

6. **啟動應用程式**
```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

## ⚙️ 重要配置修改

### 1. 環境變數設置
編輯 `.env` 文件：
```bash
# 必須修改的設置
REDIS_HOST=127.0.0.1              # VPS 內部 IP
GOOGLE_REDIRECT_URI=http://你的VPS_IP:3002/auth/google/callback
SESSION_SECRET=生成一個超強密碼
DB_PATH=/var/www/whatsapp-bot/whatsappBot.db
```

### 2. Google 服務設置
```bash
# 上傳 Google 憑證
scp credentials/service-account.json user@VPS_IP:/var/www/whatsapp-bot/credentials/

# 確保權限正確
chmod 600 /var/www/whatsapp-bot/credentials/service-account.json
```

### 3. 防火牆設置
```bash
# Ubuntu UFW
sudo ufw allow 3002
sudo ufw allow ssh
sudo ufw enable

# CentOS Firewall
sudo firewall-cmd --add-port=3002/tcp --permanent
sudo firewall-cmd --reload
```

## 🔧 Nginx 反向代理 (建議)

### 1. 安裝 Nginx
```bash
sudo apt install nginx -y
```

### 2. 配置 Nginx
```bash
sudo nano /etc/nginx/sites-available/whatsapp-bot
```

添加以下配置：
```nginx
server {
    listen 80;
    server_name 你的域名或IP;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. 啟用配置
```bash
sudo ln -s /etc/nginx/sites-available/whatsapp-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 📊 監控和維護

### 1. 查看應用程式狀態
```bash
pm2 status
pm2 logs whatsapp-bot
pm2 monit
```

### 2. 重啟應用程式
```bash
pm2 restart whatsapp-bot
```

### 3. 更新應用程式
```bash
cd /var/www/whatsapp-bot
git pull  # 如果使用 Git
npm install --production
pm2 restart whatsapp-bot
```

### 4. 備份資料庫
```bash
# 建立每日備份腳本
sudo nano /etc/cron.daily/backup-whatsapp-bot
```

```bash
#!/bin/bash
cp /var/www/whatsapp-bot/whatsappBot.db /var/backups/whatsappBot-$(date +%Y%m%d).db
# 保留最近 7 天的備份
find /var/backups -name "whatsappBot-*.db" -mtime +7 -delete
```

## 🐛 故障排除

### 1. 應用程式無法啟動
```bash
# 查看詳細日誌
pm2 logs whatsapp-bot --lines 100

# 檢查端口是否被佔用
netstat -tlnp | grep 3002

# 檢查磁碟空間
df -h
```

### 2. Redis 連線問題
```bash
# 檢查 Redis 狀態
systemctl status redis
redis-cli ping

# 檢查 Redis 配置
sudo nano /etc/redis/redis.conf
```

### 3. 權限問題
```bash
# 修復權限
sudo chown -R $USER:$USER /var/www/whatsapp-bot
chmod -R 755 /var/www/whatsapp-bot
```

## 🔒 安全性建議

1. **使用防火牆** - 只開放必要端口
2. **定期更新** - 保持系統和依賴更新
3. **強密碼** - 使用強烈的 SESSION_SECRET
4. **SSL/TLS** - 在生產環境中使用 HTTPS
5. **監控** - 設置日誌監控和警報

## 📞 支援

如果遇到問題：
1. 查看 PM2 日誌: `pm2 logs whatsapp-bot`
2. 檢查系統日誌: `sudo journalctl -u your-service`
3. 檢查網路連線和防火牆設置 