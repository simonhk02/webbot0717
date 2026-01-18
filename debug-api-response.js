const http = require('http');

async function debugAPIResponse() {
    const userId = 'ba769b8c-be26-4cda-90fd-77e580015a37';
    const url = `http://localhost:3002/api/analytics/dashboard?userId=${userId}`;
    
    console.log('🔍 調試API響應內容...');
    
    return new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log('📊 原始響應內容:');
                console.log('長度:', data.length);
                console.log('前1000字符:');
                console.log(data.substring(0, 1000));
                console.log('\n=== 分析響應結構 ===');
                
                try {
                    const result = JSON.parse(data);
                    console.log('✅ JSON解析成功');
                    console.log('響應鍵值:', Object.keys(result));
                    
                    if (result.title) console.log('標題:', result.title);
                    if (result.subtitle) console.log('副標題:', result.subtitle);
                    if (result.charts) console.log('圖表類型:', result.charts.map(c => c.type));
                    if (result.insights) console.log('洞察數量:', result.insights.length);
                    if (result.executiveSummary) console.log('執行摘要存在:', !!result.executiveSummary);
                    
                    resolve(result);
                } catch (error) {
                    console.log('❌ JSON解析失敗:', error.message);
                    reject(error);
                }
            });
            
        }).on('error', (error) => {
            console.log('❌ 請求錯誤:', error.message);
            reject(error);
        });
    });
}

debugAPIResponse().then(() => {
    console.log('✅ 調試完成');
}).catch(error => {
    console.log('❌ 調試失敗:', error.message);
}); 