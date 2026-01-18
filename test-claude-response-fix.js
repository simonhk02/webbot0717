require('dotenv').config();
const { businessLogger } = require('./utils/logger');

// 模擬Claude的實際回應
const mockClaudeResponse = `{
  "店舖名稱": "387 荃安銀行 (ZA Bank)",
  "日期": "2023-04-12",
  "銀碼": "1345.00"
}`;

function parseClaudeResponse(response, userId = 'test-user') {
    console.log('=== 測試 Claude 回應解析 ===\n');
    console.log('原始回應:', response);
    
    let parsedData;
    try {
        // 方法1：直接解析
        parsedData = JSON.parse(response.trim());
        console.log('✅ 方法1（直接解析）成功:', parsedData);
        return parsedData;
    } catch (parseErr) {
        console.log('❌ 方法1（直接解析）失敗:', parseErr.message);
        
        try {
            // 方法2：使用正則表達式提取JSON
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const jsonStr = jsonMatch[0].trim();
                console.log('找到JSON字符串:', jsonStr);
                
                // 檢查JSON字符串是否完整
                if (jsonStr.startsWith('{') && jsonStr.endsWith('}')) {
                    parsedData = JSON.parse(jsonStr);
                    console.log('✅ 方法2（正則提取）成功:', parsedData);
                    return parsedData;
                } else {
                    throw new Error('JSON不完整');
                }
            } else {
                throw new Error('無法找到JSON部分');
            }
        } catch (extractErr) {
            console.log('❌ 方法2（正則提取）失敗:', extractErr.message);
            console.log('原始回應內容：\n', response);
            throw new Error('Claude 回應格式無效');
        }
    }
}

// 測試各種情況
async function runTests() {
    console.log('開始測試各種 Claude 回應格式...\n');

    // 測試1：正常JSON
    try {
        console.log('測試1：正常JSON');
        const result1 = parseClaudeResponse(mockClaudeResponse);
        console.log('測試1結果:', result1, '\n');
    } catch (err) {
        console.log('測試1失敗:', err.message, '\n');
    }

    // 測試2：帶有換行的JSON
    try {
        console.log('測試2：帶有換行的JSON');
        const result2 = parseClaudeResponse(mockClaudeResponse.replace(/}/g, '\n}'));
        console.log('測試2結果:', result2, '\n');
    } catch (err) {
        console.log('測試2失敗:', err.message, '\n');
    }

    // 測試3：不完整的JSON
    try {
        console.log('測試3：不完整的JSON');
        const result3 = parseClaudeResponse(mockClaudeResponse.slice(0, -2));
        console.log('測試3結果:', result3, '\n');
    } catch (err) {
        console.log('測試3失敗:', err.message, '\n');
    }

    // 測試4：帶有額外文本的JSON
    try {
        console.log('測試4：帶有額外文本的JSON');
        const result4 = parseClaudeResponse('這是一些額外文本' + mockClaudeResponse + '更多文本');
        console.log('測試4結果:', result4, '\n');
    } catch (err) {
        console.log('測試4失敗:', err.message, '\n');
    }
}

// 執行測試
runTests().catch(console.error); 