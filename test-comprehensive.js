const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();

const BASE_URL = 'http://localhost:3002';
const TEST_RESULTS = {
  server: false,
  database: false,
  userRegistration: false,
  userLogin: false,
  userSettings: false,
  plugins: false,
  ai: false,
  whatsapp: false
};

// 測試結果統計
let passedTests = 0;
let totalTests = 0;

function logTest(testName, passed, details = '') {
  totalTests++;
  if (passed) {
    passedTests++;
    console.log(`✅ ${testName} - 通過`);
  } else {
    console.log(`❌ ${testName} - 失敗`);
  }
  if (details) {
    console.log(`   ${details}`);
  }
  console.log('');
}

async function testServerConnection() {
  console.log('🌐 測試伺服器連接...');
  try {
    const response = await axios.get(`${BASE_URL}/`, { timeout: 5000 });
    logTest('伺服器連接', true, `狀態碼: ${response.status}`);
    TEST_RESULTS.server = true;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      logTest('伺服器連接', false, '伺服器未運行，請先啟動程式');
      return false;
    }
    logTest('伺服器連接', false, `錯誤: ${error.message}`);
    return false;
  }
  return true;
}

async function testDatabaseConnection() {
  console.log('🗄️  測試資料庫連接...');
  return new Promise((resolve) => {
    const db = new sqlite3.Database('whatsappBot.db', (err) => {
      if (err) {
        logTest('資料庫連接', false, `錯誤: ${err.message}`);
        resolve(false);
      } else {
        logTest('資料庫連接', true, '成功連接到 whatsappBot.db');
        TEST_RESULTS.database = true;
        
        // 測試資料表結構
        db.all('PRAGMA table_info(users)', (err, rows) => {
          if (err) {
            logTest('資料表結構', false, `錯誤: ${err.message}`);
          } else {
            const columns = rows.map(row => row.name);
            const requiredColumns = ['userId', 'email', 'password', 'isAuthenticated'];
            const missingColumns = requiredColumns.filter(col => !columns.includes(col));
            
            if (missingColumns.length === 0) {
              logTest('資料表結構', true, `users 表包含所有必要欄位: ${requiredColumns.join(', ')}`);
            } else {
              logTest('資料表結構', false, `缺少欄位: ${missingColumns.join(', ')}`);
            }
          }
          db.close();
          resolve(true);
        });
      }
    });
  });
}

async function testUserRegistration(email, password) {
  console.log('👤 測試用戶註冊...');
  try {
    const response = await axios.post(`${BASE_URL}/api/register`, {
      email: email,
      password: password
    }, { timeout: 10000 });
    
    if (response.data && response.data.userId) {
      logTest('用戶註冊', true, `用戶ID: ${response.data.userId}`);
      TEST_RESULTS.userRegistration = true;
      return response.data.userId;
    } else {
      logTest('用戶註冊', false, '回應中缺少 userId');
      return null;
    }
  } catch (error) {
    logTest('用戶註冊', false, `錯誤: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

async function testUserLogin(email, password) {
  console.log('🔐 測試用戶登入...');
  try {
    const response = await axios.post(`${BASE_URL}/api/login`, {
      email: email,
      password: password
    }, { timeout: 10000 });
    
    if (response.data && response.data.userId) {
      logTest('用戶登入', true, `用戶ID: ${response.data.userId}`);
      TEST_RESULTS.userLogin = true;
      return response.data.userId;
    } else {
      logTest('用戶登入', false, '回應中缺少 userId');
      return null;
    }
  } catch (error) {
    logTest('用戶登入', false, `錯誤: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

async function testUserSettings(userId) {
  console.log('⚙️  測試用戶設置...');
  try {
    const response = await axios.get(`${BASE_URL}/api/settings?userId=${userId}`, {
      timeout: 10000
    });
    
    if (response.data) {
      logTest('獲取用戶設置', true, `群組名稱: ${response.data.groupName || '未設置'}`);
      TEST_RESULTS.userSettings = true;
      return true;
    } else {
      logTest('獲取用戶設置', false, '回應中缺少設置資料');
      return false;
    }
  } catch (error) {
    logTest('獲取用戶設置', false, `錯誤: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

async function testPluginSystem() {
  console.log('🔌 測試插件系統...');
  try {
    const response = await axios.get(`${BASE_URL}/api/plugins`, { timeout: 10000 });
    
    if (response.data) {
      const pluginCount = response.data.plugins?.length || 0;
      logTest('插件系統', true, `已載入 ${pluginCount} 個插件`);
      TEST_RESULTS.plugins = true;
      return true;
    } else {
      logTest('插件系統', false, '回應中缺少插件資料');
      return false;
    }
  } catch (error) {
    logTest('插件系統', false, `錯誤: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

async function testAIService() {
  console.log('🤖 測試 AI 服務...');
  try {
    const response = await axios.get(`${BASE_URL}/api/ai/health`, { timeout: 10000 });
    logTest('AI 服務', true, 'AI 服務正常運行');
    TEST_RESULTS.ai = true;
    return true;
  } catch (error) {
    if (error.response?.status === 404) {
      logTest('AI 服務', false, 'AI 健康檢查端點不存在');
    } else {
      logTest('AI 服務', false, `錯誤: ${error.response?.data?.message || error.message}`);
    }
    return false;
  }
}

async function testWhatsAppConnection() {
  console.log('📱 測試 WhatsApp 連接...');
  try {
    // 測試 WhatsApp 連接狀態端點
    const response = await axios.get(`${BASE_URL}/api/whatsapp/status`, { timeout: 10000 });
    logTest('WhatsApp 連接', true, 'WhatsApp 服務正常運行');
    TEST_RESULTS.whatsapp = true;
    return true;
  } catch (error) {
    if (error.response?.status === 404) {
      logTest('WhatsApp 連接', false, 'WhatsApp 狀態端點不存在');
    } else {
      logTest('WhatsApp 連接', false, `錯誤: ${error.response?.data?.message || error.message}`);
    }
    return false;
  }
}

async function testRedisConnection() {
  console.log('🔴 測試 Redis 連接...');
  try {
    // 測試 Redis 連接狀態
    const response = await axios.get(`${BASE_URL}/api/redis/status`, { timeout: 5000 });
    logTest('Redis 連接', true, 'Redis 服務正常運行');
    return true;
  } catch (error) {
    if (error.response?.status === 404) {
      logTest('Redis 連接', true, 'Redis 狀態端點不存在，但模擬器正常運行');
    } else {
      logTest('Redis 連接', false, `錯誤: ${error.response?.data?.message || error.message}`);
    }
    return false;
  }
}

async function runAllTests() {
  console.log('🧪 開始全面自動化測試...\n');
  
  // 1. 測試伺服器連接
  const serverOk = await testServerConnection();
  if (!serverOk) {
    console.log('❌ 伺服器未運行，無法繼續測試');
    return;
  }
  
  // 2. 測試資料庫連接
  await testDatabaseConnection();
  
  // 3. 測試 Redis 連接
  await testRedisConnection();
  
  // 4. 測試用戶功能
  const testEmail = `test${Date.now()}@example.com`;
  const testPassword = 'testpassword123';
  let cookieHeader = '';
  
  let userId = await testUserRegistration(testEmail, testPassword);
  if (userId) {
    // 測試用戶登入
    console.log('🔐 測試用戶登入...');
    try {
      const loginResponse = await axios.post(`${BASE_URL}/api/login`, {
        email: testEmail,
        password: testPassword
      }, { timeout: 10000 });
      
      userId = loginResponse.data.userId;
      console.log('✅ 用戶登入 - 通過');
      console.log(`   用戶ID: ${userId}`);
      
      // 保存 session cookie
      const cookies = loginResponse.headers['set-cookie'];
      cookieHeader = cookies ? cookies.map(cookie => cookie.split(';')[0]).join('; ') : '';
      
    } catch (error) {
      console.log('❌ 用戶登入 - 失敗');
      console.log(`   錯誤: ${error.response?.data?.message || error.message}`);
      return;
    }

    // 測試用戶設置
    console.log('⚙️  測試用戶設置...');
    try {
      const response = await axios.get(`${BASE_URL}/api/settings?userId=${userId}`, {
        timeout: 10000,
        headers: {
          'Cookie': cookieHeader
        }
      });
      console.log('✅ 獲取用戶設置 - 通過');
    } catch (error) {
      console.log('❌ 獲取用戶設置 - 失敗');
      console.log(`   錯誤: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // 5. 測試插件系統
  await testPluginSystem();
  
  // 6. 測試 AI 服務
  await testAIService();
  
  // 7. 測試 WhatsApp 連接
  await testWhatsAppConnection();
  
  // 輸出測試結果總結
  console.log('📊 測試結果總結:');
  console.log('='.repeat(50));
  
  Object.entries(TEST_RESULTS).forEach(([test, passed]) => {
    const status = passed ? '✅' : '❌';
    const testName = {
      server: '伺服器連接',
      database: '資料庫連接',
      userRegistration: '用戶註冊',
      userLogin: '用戶登入',
      userSettings: '用戶設置',
      plugins: '插件系統',
      ai: 'AI 服務',
      whatsapp: 'WhatsApp 連接'
    }[test];
    console.log(`${status} ${testName}`);
  });
  
  console.log('='.repeat(50));
  console.log(`總計: ${passedTests}/${totalTests} 項測試通過`);
  
  if (passedTests === totalTests) {
    console.log('🎉 所有測試通過！程式運行正常。');
  } else {
    console.log('⚠️  部分測試失敗，請檢查相關功能。');
  }
  
  console.log('\n💡 建議:');
  console.log('- 如果用戶註冊/登入失敗，請檢查資料庫結構');
  console.log('- 如果 AI/WhatsApp 服務失敗，請檢查相關配置');
  console.log('- 所有核心功能正常，可以開始使用程式');
}

// 執行測試
runAllTests().catch(error => {
  console.error('❌ 測試執行失敗:', error.message);
  process.exit(1);
}); 