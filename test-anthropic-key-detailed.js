require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function testAnthropicKeyDetailed() {
    console.log('=== 詳細的 Anthropic API 金鑰測試 ===\n');

    // 1. 檢查環境變數文件
    console.log('1. 檢查環境變數文件:');
    const envPath = path.join(process.cwd(), '.env');
    const envExamplePath = path.join(process.cwd(), 'env.example');
    
    if (fs.existsSync(envPath)) {
        console.log('✅ .env 文件存在');
        const envContent = fs.readFileSync(envPath, 'utf8');
        if (envContent.includes('ANTHROPIC_API_KEY=')) {
            console.log('✅ .env 文件包含 ANTHROPIC_API_KEY 設置');
        } else {
            console.log('❌ .env 文件缺少 ANTHROPIC_API_KEY 設置');
        }
    } else {
        console.log('❌ .env 文件不存在');
        if (fs.existsSync(envExamplePath)) {
            console.log('ℹ️ 發現 env.example 文件，建議複製為 .env');
        }
    }

    // 2. 檢查環境變數載入
    console.log('\n2. 檢查環境變數載入:');
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
        console.log('✅ ANTHROPIC_API_KEY 已載入');
        console.log(`ℹ️ API 金鑰前10個字符: ${apiKey.substring(0, 10)}...`);
        if (!apiKey.startsWith('sk-ant-')) {
            console.log('⚠️ 警告：API 金鑰格式可能不正確，應該以 sk-ant- 開頭');
        }
    } else {
        console.log('❌ ANTHROPIC_API_KEY 未載入');
    }

    // 3. 測試 API 連接
    console.log('\n3. 測試 API 連接:');
    try {
        console.log('發送測試請求...');
        const response = await axios.post(
            'https://api.anthropic.com/v1/messages',
            {
                model: 'claude-3-haiku-20240307',
                max_tokens: 1024,
                messages: [
                    {
                        role: 'user',
                        content: '請說 "測試成功"'
                    }
                ]
            },
            {
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                }
            }
        );

        console.log('✅ API 請求成功!');
        console.log('回應狀態:', response.status);
        console.log('回應內容:', response.data);
        
        // 4. 測試圖片識別功能
        console.log('\n4. 測試圖片識別功能:');
        // 創建一個簡單的測試圖片
        const testImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
        
        const imageResponse = await axios.post(
            'https://api.anthropic.com/v1/messages',
            {
                model: 'claude-3-haiku-20240307',
                max_tokens: 1024,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: '這是什麼圖片？'
                            },
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: 'image/png',
                                    data: testImage.toString('base64')
                                }
                            }
                        ]
                    }
                ]
            },
            {
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                }
            }
        );

        console.log('✅ 圖片識別請求成功!');
        console.log('回應內容:', imageResponse.data);
        
        return true;
    } catch (error) {
        console.error('❌ API 測試失敗!');
        console.error('錯誤訊息:', error.message);
        if (error.response) {
            console.error('錯誤詳情:', error.response.data);
            console.error('錯誤狀態碼:', error.response.status);
            console.error('錯誤標頭:', error.response.headers);
        }
        return false;
    }
}

// 執行測試
testAnthropicKeyDetailed()
    .then(success => {
        if (!success) {
            console.log('\n🔍 可能的問題:');
            console.log('1. API 金鑰格式不正確 (應該以 sk-ant- 開頭)');
            console.log('2. API 金鑰已過期或被撤銷');
            console.log('3. API 金鑰沒有正確設置在環境變數中');
            console.log('4. API 金鑰沒有圖片識別權限');
            process.exit(1);
        }
    })
    .catch(err => {
        console.error('測試執行出錯:', err);
        process.exit(1);
    }); 