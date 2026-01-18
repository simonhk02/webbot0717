require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { google } = require('googleapis');
const { businessLogger } = require('../utils/logger');

class AnalyticsAIService {
    constructor() {
        this.anthropic = null;
        this.isInitialized = false;
        this.sheets = null;
        this.auth = null;
        
        // 高級分析配置
        this.analysisConfig = {
            enablePrediction: true,
            enableAnomalyDetection: true,
            enablePatternAnalysis: true,
            enableRiskAssessment: true,
            enablePersonalization: true,
            minDataPoints: 10,
            predictionDays: 30,
            anomalyThreshold: 2, // 標準差倍數
        };
    }

    async initialize() {
        try {
            if (!process.env.ANTHROPIC_API_KEY) {
                throw new Error('ANTHROPIC_API_KEY not found in environment variables');
            }

            this.anthropic = new Anthropic({
                apiKey: process.env.ANTHROPIC_API_KEY,
            });

            // 初始化Google Sheets API
            await this.initializeGoogleSheets();
            
            this.isInitialized = true;
            businessLogger.info('🧠 AnalyticsAI服務初始化成功');
            
        } catch (error) {
            businessLogger.error(`❌ AnalyticsAI服務初始化失敗: ${error.message}`);
            throw error;
        }
    }

    async initializeGoogleSheets() {
        try {
            // 檢查環境變數
            if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
                throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY環境變數未設置');
            }

            // 解析Service Account金鑰
            let serviceAccountKey;
            try {
                serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
            } catch (parseError) {
                throw new Error(`GOOGLE_SERVICE_ACCOUNT_KEY格式無效: ${parseError.message}`);
            }
            
            this.auth = new google.auth.GoogleAuth({
                credentials: serviceAccountKey,
                scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
            });

            this.sheets = google.sheets({ version: 'v4', auth: this.auth });
            
            // 驗證API是否可用
            if (!this.sheets || !this.sheets.spreadsheets) {
                throw new Error('Google Sheets API客戶端初始化失敗');
            }
            
            businessLogger.info('✅ Google Sheets API初始化成功');
            
        } catch (error) {
            businessLogger.error(`❌ Google Sheets API初始化失敗: ${error.message}`);
            this.sheets = null; // 確保失敗時設為null
            throw error;
        }
    }

    async generateSmartDashboard(userId, filterMonth = null) {
        try {
            businessLogger.info(`🎯 [DEBUG] 開始生成用戶 ${userId} 的專業級智能儀表板 - 升級版本`);
            
            // 階段1：獲取用戶數據
            businessLogger.info('📊 [DEBUG] 步驟1：開始獲取用戶數據');
            const userData = await this.fetchUserSheetData(userId);
            businessLogger.info(`📊 [DEBUG] 步驟1完成：獲取到 ${userData.totalRecords} 條記錄`);
            
            // 如果有月份篩選，過濾數據
            if (filterMonth) {
                userData.structuredData = this.filterDataByMonth(userData.structuredData, filterMonth);
                userData.totalRecords = userData.structuredData.length;
                businessLogger.info(`📅 [DEBUG] 月份篩選完成：${filterMonth}，剩餘 ${userData.totalRecords} 條記錄`);
            }

            // 階段2：深度AI分析
            businessLogger.info('🧠 [DEBUG] 步驟2：開始執行深度AI分析');
            const dataInsights = await this.performDeepDataReading(userData);
            const analysisReport = await this.performIntelligentAnalysis(userData, dataInsights);
            businessLogger.info(`🧠 [DEBUG] 步驟2完成：AI分析完成，包含鍵值: ${Object.keys(analysisReport).join(',')}`);

            // 階段3：生成專業級儀表板
            businessLogger.info('📈 [DEBUG] 步驟3：開始生成專業級儀表板');
            const dashboard = await this.generateAdvancedDashboard(userData, analysisReport, filterMonth);
            businessLogger.info('📈 [DEBUG] 步驟3完成：儀表板配置生成完成');

            const insightCount = dashboard.insights ? dashboard.insights.length : 0;
            const chartCount = dashboard.charts ? dashboard.charts.length : 0;
            
            businessLogger.info(`✅ [升級版] 專業級智能儀表板生成完成，包含 ${chartCount} 個圖表，${insightCount} 個深度洞察`);
            
            return dashboard;

        } catch (error) {
            businessLogger.error(`❌ [DEBUG] 生成智能儀表板失敗: ${error.message}`);
            businessLogger.error(`❌ [DEBUG] 錯誤堆疊: ${error.stack}`);
            throw error;
        }
    }

    async fetchUserSheetData(userId) {
        try {
            const UserService = require('./userService');
            const userService = new UserService();
            await userService.initialize();
            
            const user = await userService.getUserById(userId);
            
            if (!user || !user.googleSheetsId) {
                throw new Error('用戶或Google Sheets ID不存在');
            }

            businessLogger.info(`📊 開始獲取用戶 ${userId} 的完整數據`);
            businessLogger.info(`📊 Google Sheets ID: ${user.googleSheetsId}`);

            // 檢查Google Sheets API是否可用
            if (!this.sheets || !this.sheets.spreadsheets) {
                throw new Error('Google Sheets API未正確初始化，請檢查環境變數設置');
            }

            // 獲取工作表列表
            const spreadsheet = await this.sheets.spreadsheets.get({
                spreadsheetId: user.googleSheetsId,
            });

            const sheets = spreadsheet.data.sheets;
            if (!sheets || sheets.length === 0) {
                throw new Error('找不到任何工作表');
            }

            // 使用第一個工作表
            const firstSheet = sheets[0];
            const sheetName = firstSheet.properties.title;
            
            businessLogger.info(`📊 找到工作表: ${sheetName}`);

            // 獲取完整數據範圍
            const range = `${sheetName}!A:Z`;
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: user.googleSheetsId,
                range: range,
            });

            const rows = response.data.values;
            if (!rows || rows.length === 0) {
                throw new Error('工作表中沒有數據');
            }

            // 處理數據結構
            const headers = rows[0];
            const dataRows = rows.slice(1);
            
            // 轉換為結構化數據
            const structuredData = dataRows.map(row => {
                const record = {};
                headers.forEach((header, index) => {
                    record[header] = row[index] || '';
                });
                return record;
            });

            businessLogger.info(`✅ 成功獲取 ${dataRows.length} 條記錄，${headers.length} 個欄位`);

            return {
                userId,
                spreadsheetId: user.googleSheetsId,
                sheetName,
                headers,
                rawData: dataRows,
                structuredData,
                totalRecords: dataRows.length,
                lastSync: new Date().toISOString()
            };

        } catch (error) {
            businessLogger.error(`❌ 獲取用戶數據失敗: ${error.message}`);
            throw error;
        }
    }

    async performDeepDataReading(userData) {
        try {
            businessLogger.info('🧠 開始AI深度數據閱讀');
            
            // 準備數據樣本供AI分析
            const dataSample = userData.structuredData.slice(0, 20); // 取前20條記錄進行深度分析
            const dataStructureInfo = {
                totalRecords: userData.totalRecords,
                headers: userData.headers,
                sheetName: userData.sheetName,
                sampleData: dataSample
            };

            const readingPrompt = `
你是一位資深的數據分析師。請深度閱讀並理解以下數據結構和內容：

=== 數據概況 ===
- 工作表名稱：${userData.sheetName}
- 總記錄數：${userData.totalRecords}
- 數據欄位：${userData.headers.join(', ')}

=== 數據樣本（前20條記錄）===
${dataSample.map((record, index) => `
記錄 ${index + 1}:
${userData.headers.map(header => `${header}: ${record[header] || '空值'}`).join('\n')}
---`).join('\n')}

請仔細分析並回答以下問題：

1. 這是什麼類型的數據？（如：個人支出、商業記錄、庫存管理等）
2. 數據中包含哪些時間維度？（年、月、日、時間範圍等）
3. 數據中有哪些主要的數值欄位？每個欄位代表什麼意義？
4. 數據中有哪些分類欄位？主要的分類有哪些？
5. 從樣本數據中你發現了什麼有趣的模式或特徵？
6. 數據品質如何？是否有缺失值或異常值？
7. 這個數據集最適合進行什麼類型的分析？

請用繁體中文詳細回答，每個問題都要基於實際數據內容來分析。
`;

            const response = await this.anthropic.messages.create({
                model: 'claude-3-haiku-20240307',
                max_tokens: 3000,
                temperature: 0.1,
                messages: [{
                    role: 'user',
                    content: readingPrompt
                }]
            });

            const dataReadingResult = response.content[0].text;
            businessLogger.info(`✅ AI數據閱讀完成，內容長度: ${dataReadingResult.length} 字符`);
            
            return {
                dataType: this.extractDataType(dataReadingResult),
                timeStructure: this.extractTimeStructure(userData),
                valueFields: this.extractValueFields(userData),
                categoryFields: this.extractCategoryFields(userData),
                patterns: dataReadingResult,
                rawAnalysis: dataReadingResult
            };

        } catch (error) {
            businessLogger.error(`❌ AI數據閱讀失敗: ${error.message}`);
            // 提供備用分析
            return this.generateFallbackDataReading(userData);
        }
    }

    async performIntelligentAnalysis(userData, dataInsights) {
        try {
            businessLogger.info('🤖 開始AI智能分析');

            // 先分析數據結構和內容
            const dataStructure = this.analyzeDataStructure(userData);
            const sampleAnalysis = this.generateSampleAnalysis(userData);
            
            const analysisPrompt = `
你是頂尖的AI數據分析專家，擁有哈佛商學院財務分析PhD學位。請基於以下真實數據進行深度專業分析：

=== 核心數據信息 ===
📊 工作表名稱：${userData.sheetName}
📈 記錄總數：${userData.totalRecords.toLocaleString()} 筆
🏷️ 欄位數量：${userData.headers.length} 個
📅 時間跨度：${this.getTimeRange(userData)}
🎯 數據類型：${dataInsights.dataType}

=== 完整欄位清單 ===
${userData.headers.map((header, i) => `${i+1}. ${header}`).join('\n')}

=== 數據結構深度分析 ===
${dataStructure.analysis}

=== 真實數據樣本（最新20筆記錄）===
${userData.structuredData.slice(-20).map((record, index) => {
    const recordNum = userData.totalRecords - 19 + index;
    const dataStr = userData.headers.map(header => {
        const value = record[header] || '空值';
        return `${header}=${value}`;
    }).join(' | ');
    return `第${recordNum}筆: ${dataStr}`;
}).join('\n')}

=== AI分析任務 ===
請仔細閱讀上述所有數據，然後生成一份令人驚艷的專業分析報告。

**重要要求：**
1. 必須基於實際數據內容進行分析，引用具體數值和欄位
2. 分析每個重要欄位的含義和分布
3. 識別時間模式（年度、月度、季節性）
4. 找出數據中的異常值和特殊模式
5. 提供具體的商業洞察和建議

請按以下結構撰寫詳細報告：

# ${userData.sheetName} - 專業數據分析報告

## 📋 執行摘要
（基於實際數據的核心發現，包含具體數字）

## 📊 數據概況深度分析
（分析每個重要欄位的含義、分布和品質）

## 📅 時間維度專業分析
（年度趋势、月度模式、季節性變化 - 引用具體時間數據）

## 💰 財務/數值分析
（金額分布、統計特徵、異常值識別 - 使用實際數值）

## 🏷️ 分類維度深度分析
（各類別分布、交叉分析、隱藏關聯 - 基於實際分類數據）

## 🔍 數據品質評估
（完整性、一致性、異常值檢測 - 具體指出問題）

## 💡 專業商業洞察
（基於數據的具體建議和風險預警）

## 📈 預測性分析與建議
（未來趨勢預測和行動建議）

**撰寫要求：**
- 使用繁體中文
- 每個分析都要引用具體的數據和數字
- 避免空泛的描述，要具體且有見地
- 報告長度至少2000字，充滿專業洞察
`;

            const response = await this.anthropic.messages.create({
                model: 'claude-3-haiku-20240307',
                max_tokens: 4000,
                temperature: 0.2,
                messages: [{
                    role: 'user',
                    content: analysisPrompt
                }]
            });

            const analysisReport = response.content[0].text;
            businessLogger.info(`✅ AI智能分析完成，報告長度: ${analysisReport.length} 字符`);
            
            return {
                fullReport: analysisReport,
                timestamp: new Date().toISOString(),
                confidence: 0.9,
                sourceData: {
                    totalRecords: userData.totalRecords,
                    timeRange: this.getTimeRange(userData),
                    categories: this.extractMainCategories(userData)
                }
            };

        } catch (error) {
            businessLogger.error(`❌ AI智能分析失敗: ${error.message}`);
            return this.generateFallbackAnalysis(userData);
        }
    }

    async generateIntelligentDashboard(userData, analysisReport) {
        try {
            businessLogger.info('📈 生成智能儀表板');

            // 從分析報告中提取關鍵信息
            const keyInsights = this.extractKeyInsights(analysisReport.fullReport);
            const categories = this.extractMainCategories(userData);
            const timeData = this.extractTimeData(userData);
            const financialData = this.extractFinancialData(userData);

            return {
                title: `${userData.sheetName} - AI深度分析報告`,
                subtitle: `基於 ${userData.totalRecords.toLocaleString()} 筆記錄的智能洞察`,
                userId: userData.userId,
                lastUpdated: new Date().toISOString(),
                
                // 統計卡片
                stats: [
                    {
                        title: "總記錄數",
                        value: userData.totalRecords.toLocaleString(),
                        icon: "📊",
                        trend: "neutral"
                    },
                    {
                        title: "數據欄位",
                        value: userData.headers.length,
                        icon: "🏷️",
                        trend: "neutral" 
                    },
                    {
                        title: "時間跨度",
                        value: this.getTimeRange(userData),
                        icon: "📅",
                        trend: "neutral"
                    },
                    {
                        title: "主要類別",
                        value: categories.length,
                        icon: "📋",
                        trend: "neutral"
                    }
                ],

                // 智能圖表
                charts: this.generateIntelligentCharts(userData, categories, timeData, financialData),

                // AI洞察
                insights: keyInsights,

                // 完整分析報告
                fullAnalysisReport: analysisReport.fullReport,

                // 數據源信息
                dataSource: {
                    spreadsheetId: userData.spreadsheetId,
                    sheetName: userData.sheetName,
                    headers: userData.headers,
                    lastSync: userData.lastSync,
                    confidence: analysisReport.confidence
                }
            };

        } catch (error) {
            businessLogger.error(`❌ 生成智能儀表板失敗: ${error.message}`);
            throw error;
        }
    }

    // === 輔助方法 ===
    
    analyzeDataStructure(userData) {
        const analysis = [];
        const fieldTypes = {};
        const completeness = {};
        
        // 分析每個欄位的類型和完整度
        userData.headers.forEach(header => {
            const values = userData.structuredData.map(record => record[header]).filter(v => v && v.trim());
            const nonEmptyCount = values.length;
            const totalCount = userData.structuredData.length;
            
            // 判斷欄位類型
            let fieldType = 'text';
            if (values.some(v => !isNaN(parseFloat(v)) && isFinite(v))) {
                fieldType = 'numeric';
            }
            if (values.some(v => !isNaN(Date.parse(v)))) {
                fieldType = 'date';
            }
            
            fieldTypes[header] = fieldType;
            completeness[header] = Math.round((nonEmptyCount / totalCount) * 100);
            
            analysis.push(`${header}: ${fieldType}類型, ${completeness[header]}%完整度`);
        });
        
        const avgCompleteness = Math.round(
            Object.values(completeness).reduce((a, b) => a + b, 0) / Object.keys(completeness).length
        );
        
        return {
            analysis: analysis.join('\n'),
            fieldTypes,
            completeness,
            avgCompleteness
        };
    }
    
    generateSampleAnalysis(userData) {
        const sample = userData.structuredData.slice(0, 5);
        const analysis = [];
        
        sample.forEach((record, index) => {
            const insights = [];
            
            // 分析每條記錄的特徵
            Object.keys(record).forEach(key => {
                const value = record[key];
                if (value && value.toString().trim()) {
                    if (!isNaN(parseFloat(value))) {
                        insights.push(`${key}=${value}(數值)`);
                    } else if (!isNaN(Date.parse(value))) {
                        insights.push(`${key}=${value}(日期)`);
                    } else {
                        insights.push(`${key}=${value}(文字)`);
                    }
                }
            });
            
            analysis.push(`記錄${index + 1}: ${insights.join(', ')}`);
        });
        
        return analysis.join('\n');
    }

    extractDataType(analysisText) {
        if (analysisText.includes('支出') || analysisText.includes('費用')) return '支出記錄';
        if (analysisText.includes('收入') || analysisText.includes('營收')) return '收入記錄';
        if (analysisText.includes('庫存') || analysisText.includes('商品')) return '庫存管理';
        return '未知類型';
    }

    extractTimeStructure(userData) {
        const timeFields = userData.headers.filter(header => 
            header && header.trim() && (
                header.includes('日期') || header.includes('時間') || 
                header.includes('date') || header.includes('time') ||
                header.includes('年') || header.includes('月') ||
                header.includes('day') || header.includes('when')
            )
        );
        return timeFields;
    }

    extractValueFields(userData) {
        return userData.headers.filter(header => 
            header && header.trim() && (
                header.includes('金額') || header.includes('價格') || 
                header.includes('amount') || header.includes('price') ||
                header.includes('數量') || header.includes('quantity') ||
                header.includes('支出') || header.includes('收入') ||
                header.includes('費用') || header.includes('成本') ||
                header.includes('錢') || header.includes('元') ||
                header.includes('dollar') || header.includes('cost')
            )
        );
    }

    extractCategoryFields(userData) {
        return userData.headers.filter(header => 
            header && header.trim() && (
                header.includes('類別') || header.includes('分類') || 
                header.includes('項目') || header.includes('category') ||
                header.includes('type') || header.includes('種類') ||
                header.includes('用途') || header.includes('目的') ||
                header.includes('商品') || header.includes('服務')
            )
        );
    }

    extractMainCategories(userData) {
        const categoryFields = this.extractCategoryFields(userData);
        const categories = new Set();
        
        categoryFields.forEach(field => {
            userData.structuredData.forEach(record => {
                if (record[field] && record[field].trim()) {
                    categories.add(record[field].trim());
                }
            });
        });
        
        return Array.from(categories).slice(0, 10); // 取前10個主要類別
    }

    getTimeRange(userData) {
        const dateFields = this.extractTimeStructure(userData);
        if (dateFields.length === 0) return '未知時間範圍';
        
        const dates = [];
        dateFields.forEach(field => {
            userData.structuredData.forEach(record => {
                if (record[field]) {
                    const date = new Date(record[field]);
                    if (!isNaN(date)) dates.push(date);
                }
            });
        });
        
        if (dates.length === 0) return '未知時間範圍';
        
        dates.sort();
        const startDate = dates[0];
        const endDate = dates[dates.length - 1];
        
        return `${startDate.toLocaleDateString('zh-TW')} - ${endDate.toLocaleDateString('zh-TW')}`;
    }

    extractTimeData(userData) {
        const dateFields = this.extractTimeStructure(userData);
        const timeData = {};
        
        dateFields.forEach(field => {
            userData.structuredData.forEach(record => {
                if (record[field]) {
                    const date = new Date(record[field]);
                    if (!isNaN(date)) {
                        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                        timeData[month] = (timeData[month] || 0) + 1;
                    }
                }
            });
        });
        
        return timeData;
    }

    extractFinancialData(userData) {
        const valueFields = this.extractValueFields(userData);
        const financialData = {};
        
        valueFields.forEach(field => {
            const values = [];
            userData.structuredData.forEach(record => {
                const value = parseFloat(record[field]);
                if (!isNaN(value)) values.push(value);
            });
            
            if (values.length > 0) {
                financialData[field] = {
                    total: values.reduce((a, b) => a + b, 0),
                    average: values.reduce((a, b) => a + b, 0) / values.length,
                    count: values.length,
                    max: Math.max(...values),
                    min: Math.min(...values)
                };
            }
        });
        
        return financialData;
    }

    extractKeyInsights(reportText) {
        const insights = [];
        const sections = reportText.split('\n');
        
        sections.forEach(line => {
            if (line.includes('發現') || line.includes('分析') || line.includes('建議')) {
                const cleaned = line.replace(/^[#*-\s]+/, '').trim();
                if (cleaned.length > 10) {
                    insights.push(cleaned);
                }
            }
        });
        
        return insights.slice(0, 10); // 取前10個洞察
    }

    generateIntelligentCharts(userData, categories, timeData, financialData) {
        const charts = [];
        
        // 1. 類別分布圖
        if (categories.length > 0) {
            const categoryData = this.generateCategoryChartData(userData, categories);
            charts.push({
                id: `category_${Date.now()}`,
                type: 'doughnut',
                title: '支出類別分布',
                description: 'AI智能分析各類別支出佔比',
                data: categoryData
            });
        }
        
        // 2. 時間趨勢圖
        if (Object.keys(timeData).length > 0) {
            const trendData = this.generateTimeChartData(timeData);
            charts.push({
                id: `trend_${Date.now()}`,
                type: 'line',
                title: '時間趨勢分析',
                description: '記錄數量隨時間的變化趨勢',
                data: trendData
            });
        }
        
        return charts;
    }

    generateCategoryChartData(userData, categories) {
        const categoryCounts = {};
        const categoryField = this.extractCategoryFields(userData)[0];
        
        if (!categoryField) return { labels: [], datasets: [] };
        
        categories.forEach(cat => categoryCounts[cat] = 0);
        
        userData.structuredData.forEach(record => {
            const category = record[categoryField];
            if (category && categoryCounts.hasOwnProperty(category)) {
                categoryCounts[category]++;
            }
        });
        
        const colors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
            '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF',
            '#4BC0C0', '#FF9F40'
        ];
        
        return {
            labels: Object.keys(categoryCounts),
            datasets: [{
                data: Object.values(categoryCounts),
                backgroundColor: colors.slice(0, Object.keys(categoryCounts).length),
                borderWidth: 2
            }]
        };
    }

    generateTimeChartData(timeData) {
        const sortedMonths = Object.keys(timeData).sort();
        
        return {
            labels: sortedMonths.map(month => {
                const [year, monthNum] = month.split('-');
                return `${year}年${monthNum}月`;
            }),
            datasets: [{
                label: '記錄數量',
                data: sortedMonths.map(month => timeData[month]),
                borderColor: '#36A2EB',
                backgroundColor: 'rgba(54, 162, 235, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        };
    }

    generateFallbackDataReading(userData) {
        return {
            dataType: '數據記錄',
            timeStructure: this.extractTimeStructure(userData),
            valueFields: this.extractValueFields(userData),
            categoryFields: this.extractCategoryFields(userData),
            patterns: '基於規則的數據模式分析',
            rawAnalysis: `這是一個包含 ${userData.totalRecords} 筆記錄的數據集，共有 ${userData.headers.length} 個欄位。主要欄位包括：${userData.headers.slice(0, 5).join('、')}等。`
        };
    }

    generateFallbackAnalysis(userData) {
        return {
            fullReport: `
# ${userData.sheetName} 數據分析報告

## 執行摘要
本數據集包含 ${userData.totalRecords} 筆記錄，涵蓋 ${userData.headers.length} 個不同欄位的信息。

## 數據概況
- 總記錄數：${userData.totalRecords.toLocaleString()}
- 數據欄位：${userData.headers.length}
- 工作表名稱：${userData.sheetName}
- 時間範圍：${this.getTimeRange(userData)}

## 主要發現
1. 數據記錄豐富，包含多個維度的信息
2. 時間跨度覆蓋了較長的週期
3. 數據結構完整，適合深度分析

## 建議
建議定期更新數據並進行趨勢分析，以獲得更多商業洞察。
            `,
            timestamp: new Date().toISOString(),
            confidence: 0.7,
            sourceData: {
                totalRecords: userData.totalRecords,
                timeRange: this.getTimeRange(userData),
                categories: this.extractMainCategories(userData)
            }
        };
    }

    async getChartData(userId, chartConfig) {
        try {
            const userData = await this.fetchUserSheetData(userId);
            return {
                success: true,
                data: chartConfig.data || {}
            };
        } catch (error) {
            businessLogger.error(`❌ 獲取圖表數據失敗: ${error.message}`);
            throw error;
        }
    }

    // 新增：按月份篩選數據
    filterDataByMonth(data, filterMonth) {
        if (!filterMonth) return data;
        
        // filterMonth 格式: "2025-06"
        const [year, month] = filterMonth.split('-');
        
        return data.filter(record => {
            // 查找日期欄位
            const dateFields = ['timestamp', '日期', 'date', '時間', 'created_at'];
            for (const field of dateFields) {
                if (record[field]) {
                    const recordDate = new Date(record[field]);
                    if (!isNaN(recordDate)) {
                        const recordYear = recordDate.getFullYear().toString();
                        const recordMonth = (recordDate.getMonth() + 1).toString().padStart(2, '0');
                        return recordYear === year && recordMonth === month;
                    }
                }
            }
            return true; // 如果沒有日期欄位，保留所有記錄
        });
    }

    // 重構：生成高級儀表板
    async generateAdvancedDashboard(userData, analysisReport, filterMonth) {
        try {
            businessLogger.info('📈 生成高級智能儀表板');

            // 提取關鍵數據
            const financialData = this.extractAdvancedFinancialData(userData);
            const categoryData = this.extractAdvancedCategoryData(userData);
            const timeData = this.extractAdvancedTimeData(userData);
            const keyInsights = this.extractKeyInsights(analysisReport.fullReport);

            return {
                title: `${userData.sheetName} - AI智能分析報告`,
                subtitle: filterMonth 
                    ? `${filterMonth} 月份分析 (${userData.totalRecords.toLocaleString()} 筆記錄)`
                    : `完整數據分析 (${userData.totalRecords.toLocaleString()} 筆記錄)`,
                userId: userData.userId,
                lastUpdated: new Date().toISOString(),
                filterMonth: filterMonth,
                dataQuality: this.assessDataQuality(userData),
                
                // 豐富的統計卡片
                stats: this.generateAdvancedStats(userData, financialData, categoryData, timeData, filterMonth),

                // 智能圖表（顯示金額而非筆數）
                charts: this.generateAdvancedCharts(userData, categoryData, timeData, financialData),

                // AI洞察
                insights: keyInsights,

                // 完整分析報告
                fullAnalysisReport: analysisReport.fullReport,

                // 數據源信息
                dataSource: {
                    spreadsheetId: userData.spreadsheetId,
                    sheetName: userData.sheetName,
                    headers: userData.headers,
                    lastSync: userData.lastSync,
                    confidence: analysisReport.confidence || 0.9
                },

                // 可用月份列表（用於前端篩選）
                availableMonths: this.getAvailableMonths(userData)
            };

        } catch (error) {
            businessLogger.error(`❌ 生成高級儀表板失敗: ${error.message}`);
            throw error;
        }
    }

    // 新增：提取高級財務數據
    extractAdvancedFinancialData(userData) {
        const valueFields = this.extractValueFields(userData);
        const financialData = {};
        let totalAmount = 0;
        let transactionCount = 0;
        
        // 如果沒有找到明確的金額欄位，嘗試智能識別
        let fieldsToCheck = valueFields;
        if (fieldsToCheck.length === 0) {
            // 智能識別：查找包含數字的欄位
            fieldsToCheck = userData.headers.filter(header => {
                if (!header || !header.trim()) return false;
                
                // 檢查該欄位是否包含數字數據
                const hasNumbers = userData.structuredData.some(record => {
                    const value = record[header];
                    return value && !isNaN(parseFloat(value)) && isFinite(value);
                });
                
                return hasNumbers;
            });
        }
        
        fieldsToCheck.forEach(field => {
            const values = [];
            userData.structuredData.forEach(record => {
                let value = record[field];
                
                // 數據清理：移除貨幣符號和空格
                if (typeof value === 'string') {
                    value = value.replace(/[$,\s]/g, '').trim();
                }
                
                const numValue = parseFloat(value);
                if (!isNaN(numValue) && numValue > 0) {
                    values.push(numValue);
                    totalAmount += numValue;
                    transactionCount++;
                }
            });
            
            if (values.length > 0) {
                financialData[field] = {
                    total: values.reduce((a, b) => a + b, 0),
                    average: values.reduce((a, b) => a + b, 0) / values.length,
                    count: values.length,
                    max: Math.max(...values),
                    min: Math.min(...values),
                    median: this.calculateMedian(values)
                };
            }
        });
        
        // 添加總體統計
        financialData._summary = {
            totalAmount,
            transactionCount,
            averagePerTransaction: transactionCount > 0 ? totalAmount / transactionCount : 0
        };
        
        return financialData;
    }

    // 新增：提取高級類別數據（按金額）
    extractAdvancedCategoryData(userData) {
        const categoryField = this.extractCategoryFields(userData)[0];
        const valueFields = this.extractValueFields(userData);
        const categoryData = {};
        
        if (!categoryField || valueFields.length === 0) return {};
        
        const primaryValueField = valueFields[0]; // 使用第一個數值欄位
        
        userData.structuredData.forEach(record => {
            const category = record[categoryField];
            const amount = parseFloat(record[primaryValueField]);
            
            if (category && !isNaN(amount) && amount > 0) {
                if (!categoryData[category]) {
                    categoryData[category] = {
                        totalAmount: 0,
                        count: 0,
                        averageAmount: 0
                    };
                }
                
                categoryData[category].totalAmount += amount;
                categoryData[category].count++;
                categoryData[category].averageAmount = categoryData[category].totalAmount / categoryData[category].count;
            }
        });
        
        return categoryData;
    }

    // 新增：提取高級時間數據
    extractAdvancedTimeData(userData) {
        const dateFields = this.extractTimeStructure(userData);
        const valueFields = this.extractValueFields(userData);
        const timeData = {};
        
        if (dateFields.length === 0) return {};
        
        const primaryDateField = dateFields[0];
        const primaryValueField = valueFields[0] || null;
        
        userData.structuredData.forEach(record => {
            if (record[primaryDateField]) {
                const date = new Date(record[primaryDateField]);
                if (!isNaN(date)) {
                    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    
                    if (!timeData[month]) {
                        timeData[month] = {
                            count: 0,
                            totalAmount: 0,
                            averageAmount: 0
                        };
                    }
                    
                    timeData[month].count++;
                    
                    if (primaryValueField) {
                        const amount = parseFloat(record[primaryValueField]);
                        if (!isNaN(amount) && amount > 0) {
                            timeData[month].totalAmount += amount;
                            timeData[month].averageAmount = timeData[month].totalAmount / timeData[month].count;
                        }
                    }
                }
            }
        });
        
        return timeData;
    }

    // 新增：生成高級統計卡片
    generateAdvancedStats(userData, financialData, categoryData, timeData, filterMonth) {
        const stats = [];
        
        // 基本統計
        stats.push({
            title: "記錄數量",
            value: userData.totalRecords.toLocaleString(),
            icon: "📊",
            trend: "neutral"
        });

        // 財務統計
        if (financialData._summary) {
            const summary = financialData._summary;
            
            stats.push({
                title: "總支出金額",
                value: `$${summary.totalAmount.toLocaleString()}`,
                icon: "💰",
                trend: "neutral"
            });
            
            stats.push({
                title: "平均單筆",
                value: `$${Math.round(summary.averagePerTransaction).toLocaleString()}`,
                icon: "📈",
                trend: "neutral"
            });
            
            stats.push({
                title: "交易筆數",
                value: summary.transactionCount.toLocaleString(),
                icon: "🧾",
                trend: "neutral"
            });
        }

        // 類別統計
        const categoryCount = Object.keys(categoryData).length;
        if (categoryCount > 0) {
            stats.push({
                title: "支出類別",
                value: categoryCount.toString(),
                icon: "🏷️",
                trend: "neutral"
            });
            
            // 最大支出類別
            const topCategory = Object.entries(categoryData)
                .sort(([,a], [,b]) => b.totalAmount - a.totalAmount)[0];
            
            if (topCategory) {
                stats.push({
                    title: "最大支出類別",
                    value: topCategory[0],
                    icon: "🎯",
                    trend: "neutral",
                    subtitle: `$${Math.round(topCategory[1].totalAmount).toLocaleString()}`
                });
            }
        }

        // 時間統計
        const monthCount = Object.keys(timeData).length;
        if (monthCount > 0) {
            stats.push({
                title: filterMonth ? "篩選月份" : "時間跨度",
                value: filterMonth || `${monthCount} 個月`,
                icon: "📅",
                trend: "neutral"
            });
            
            // 最活躍月份
            if (!filterMonth) {
                const topMonth = Object.entries(timeData)
                    .sort(([,a], [,b]) => b.totalAmount - a.totalAmount)[0];
                
                if (topMonth) {
                    stats.push({
                        title: "最高支出月份",
                        value: topMonth[0],
                        icon: "📊",
                        trend: "neutral",
                        subtitle: `$${Math.round(topMonth[1].totalAmount).toLocaleString()}`
                    });
                }
            }
        }

        // 數據品質
        stats.push({
            title: "數據欄位",
            value: userData.headers.length.toString(),
            icon: "🔍",
            trend: "neutral"
        });

        return stats;
    }

    // 新增：生成高級圖表（顯示金額）
    generateAdvancedCharts(userData, categoryData, timeData, financialData) {
        const charts = [];
        
        // 1. 支出類別分布圖（按金額）
        if (Object.keys(categoryData).length > 0) {
            const categoryAmountData = this.generateCategoryAmountChartData(categoryData);
            charts.push({
                id: `category_amount_${Date.now()}`,
                type: 'doughnut',
                title: '支出類別分布',
                description: '各類別支出金額佔比',
                data: categoryAmountData
            });
        }
        
        // 2. 時間趨勢圖（按金額）
        if (Object.keys(timeData).length > 0) {
            const trendAmountData = this.generateTimeAmountChartData(timeData);
            charts.push({
                id: `trend_amount_${Date.now()}`,
                type: 'line',
                title: '支出趨勢分析',
                description: '支出金額隨時間的變化趨勢',
                data: trendAmountData
            });
        }
        
        // 3. 支出分佈直方圖
        if (financialData._summary && financialData._summary.transactionCount > 5) {
            const distributionData = this.generateAmountDistributionChartData(userData);
            charts.push({
                id: `distribution_${Date.now()}`,
                type: 'bar',
                title: '支出金額分佈',
                description: '不同金額區間的交易頻率',
                data: distributionData
            });
        }
        
        return charts;
    }

    // 新增：生成類別金額圖表數據
    generateCategoryAmountChartData(categoryData) {
        const sortedCategories = Object.entries(categoryData)
            .sort(([,a], [,b]) => b.totalAmount - a.totalAmount)
            .slice(0, 10); // 只顯示前10個類別
        
        const colors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
            '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF',
            '#4BC0C0', '#FF9F40'
        ];
        
        return {
            labels: sortedCategories.map(([name]) => name),
            datasets: [{
                label: '支出金額',
                data: sortedCategories.map(([, data]) => Math.round(data.totalAmount)),
                backgroundColor: colors.slice(0, sortedCategories.length),
                borderWidth: 2
            }]
        };
    }

    // 新增：生成時間金額圖表數據
    generateTimeAmountChartData(timeData) {
        const sortedMonths = Object.keys(timeData).sort();
        
        return {
            labels: sortedMonths.map(month => {
                const [year, monthNum] = month.split('-');
                return `${year}年${monthNum}月`;
            }),
            datasets: [{
                label: '支出金額',
                data: sortedMonths.map(month => Math.round(timeData[month].totalAmount)),
                borderColor: '#36A2EB',
                backgroundColor: 'rgba(54, 162, 235, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }, {
                label: '交易筆數',
                data: sortedMonths.map(month => timeData[month].count),
                borderColor: '#FF6384',
                backgroundColor: 'rgba(255, 99, 132, 0.1)',
                borderWidth: 2,
                fill: false,
                tension: 0.4,
                yAxisID: 'y1'
            }]
        };
    }

    // 新增：生成金額分佈圖表數據
    generateAmountDistributionChartData(userData) {
        const valueFields = this.extractValueFields(userData);
        if (valueFields.length === 0) return { labels: [], datasets: [] };
        
        const amounts = [];
        userData.structuredData.forEach(record => {
            const amount = parseFloat(record[valueFields[0]]);
            if (!isNaN(amount) && amount > 0) {
                amounts.push(amount);
            }
        });
        
        if (amounts.length === 0) return { labels: [], datasets: [] };
        
        // 創建金額區間
        const max = Math.max(...amounts);
        const min = Math.min(...amounts);
        const range = max - min;
        const binCount = Math.min(10, Math.max(5, Math.floor(amounts.length / 10)));
        const binSize = range / binCount;
        
        const bins = [];
        const binLabels = [];
        
        for (let i = 0; i < binCount; i++) {
            const binStart = min + (i * binSize);
            const binEnd = min + ((i + 1) * binSize);
            const count = amounts.filter(amount => amount >= binStart && amount < binEnd).length;
            
            bins.push(count);
            binLabels.push(`$${Math.round(binStart)}-$${Math.round(binEnd)}`);
        }
        
        return {
            labels: binLabels,
            datasets: [{
                label: '交易數量',
                data: bins,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: '#36A2EB',
                borderWidth: 1
            }]
        };
    }

    // 新增：獲取可用月份列表
    getAvailableMonths(userData) {
        const dateFields = this.extractTimeStructure(userData);
        const months = new Set();
        
        dateFields.forEach(field => {
            userData.structuredData.forEach(record => {
                if (record[field]) {
                    const date = new Date(record[field]);
                    if (!isNaN(date)) {
                        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                        months.add(month);
                    }
                }
            });
        });
        
        return Array.from(months).sort().reverse(); // 最新的月份在前
    }

    // 新增：評估數據品質
    assessDataQuality(userData) {
        let totalFields = userData.headers.length;
        let completenessScore = 0;
        
        userData.headers.forEach(header => {
            const filledCount = userData.structuredData.filter(record => 
                record[header] && record[header].toString().trim()
            ).length;
            const completeness = filledCount / userData.totalRecords;
            completenessScore += completeness;
        });
        
        const avgCompleteness = completenessScore / totalFields;
        
        if (avgCompleteness > 0.8) return 'excellent';
        if (avgCompleteness > 0.6) return 'good';
        if (avgCompleteness > 0.4) return 'fair';
        return 'poor';
    }

    // 新增：計算中位數
    calculateMedian(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
}

module.exports = AnalyticsAIService; 