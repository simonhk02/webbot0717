require('dotenv').config();
const axios = require('axios');

async function testAnthropicKey() {
    console.log('開始測試 Anthropic API 金鑰...');
    console.log(`使用的 API 金鑰: ${process.env.ANTHROPIC_API_KEY}`);
    
    try {
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
                    'x-api-key': process.env.ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                }
            }
        );

        console.log('API 測試成功!');
        console.log('回應狀態:', response.status);
        console.log('回應內容:', response.data);
        return true;
    } catch (error) {
        console.error('API 測試失敗!');
        console.error('錯誤訊息:', error.message);
        if (error.response) {
            console.error('錯誤詳情:', error.response.data);
            console.error('錯誤狀態碼:', error.response.status);
        }
        return false;
    }
}

// 執行測試
testAnthropicKey()
    .then(success => {
        if (!success) {
            console.log('\n可能的問題:');
            console.log('1. API 金鑰格式不正確');
            console.log('2. API 金鑰已過期或被撤銷');
            console.log('3. API 金鑰沒有正確設置在環境變數中');
            process.exit(1);
        }
    })
    .catch(err => {
        console.error('測試執行出錯:', err);
        process.exit(1);
    }); 