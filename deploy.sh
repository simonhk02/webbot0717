#!/bin/bash

# WhatsApp Bot VPS 部署腳本
echo "🚀 開始部署 WhatsApp Bot 到 VPS..."

# 檢查 Node.js 版本
echo "📋 檢查系統環境..."
node_version=$(node -v 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ Node.js 版本: $node_version"
else
    echo "❌ 未安裝 Node.js，請先安裝 Node.js 18+"
    exit 1
fi

# 檢查 PM2
pm2_version=$(pm2 -v 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ PM2 版本: $pm2_version"
else
    echo "⚠️  未安裝 PM2，正在安裝..."
    npm install -g pm2
fi

# 檢查 Redis
redis_status=$(systemctl is-active redis 2>/dev/null)
if [ "$redis_status" = "active" ]; then
    echo "✅ Redis 已運行"
else
    echo "⚠️  Redis 未運行，請確保 Redis 已安裝並啟動"
fi

# 建立必要目錄
echo "📁 建立必要目錄..."
mkdir -p /var/www/whatsapp-bot
mkdir -p /var/www/whatsapp-bot/logs
mkdir -p /var/www/whatsapp-bot/credentials
mkdir -p /var/www/whatsapp-bot/auth

# 設置目錄權限
chown -R $USER:$USER /var/www/whatsapp-bot
chmod -R 755 /var/www/whatsapp-bot

echo "✅ 目錄建立完成"

# 複製文件到 VPS
echo "📦 複製應用程式文件..."
cp -r ./* /var/www/whatsapp-bot/
cd /var/www/whatsapp-bot

echo "📦 安裝依賴..."
npm install --production

echo "🔧 設置環境變數..."
if [ ! -f ".env" ]; then
    echo "⚠️  .env 文件不存在，請從 env.example 建立並修改配置"
    cp env.example .env
    echo "📝 請編輯 .env 文件以配置你的 VPS 設置"
fi

echo "🔥 啟動應用程式..."
pm2 start ecosystem.config.js --env production

echo "📊 顯示應用程式狀態..."
pm2 status

echo "🎉 部署完成！"
echo "🌐 應用程式運行在: http://你的VPS IP:3002"
echo "📋 查看日誌: pm2 logs whatsapp-bot"
echo "🔄 重啟應用: pm2 restart whatsapp-bot"
echo "🛑 停止應用: pm2 stop whatsapp-bot" 