const { businessLogger } = require('../../utils/logger');

module.exports = {
    name: '示例插件',
    version: '1.0.0',
    description: '這是一個示例插件，用於展示插件系統的功能',
    
    // 插件初始化
    init: async (config) => {
        try {
            logger.info('示例插件初始化中...');
            // 這裡可以進行插件的初始化操作
            // 例如：連接資料庫、設置事件監聽器等
            
            // 示例：設置一個定時器
            this.timer = setInterval(() => {
                logger.info('示例插件定時器觸發');
            }, 60000); // 每分鐘執行一次
            
            logger.info('示例插件初始化完成');
            return true;
        } catch (error) {
            businessLogger.error(`示例插件初始化失敗: ${error.message}`);
            return false;
        }
    },
    
    // 插件清理
    cleanup: async () => {
        try {
            logger.info('示例插件清理中...');
            // 清理資源
            if (this.timer) {
                clearInterval(this.timer);
            }
            logger.info('示例插件清理完成');
            return true;
        } catch (error) {
            businessLogger.error(`示例插件清理失敗: ${error.message}`);
            return false;
        }
    },
    
    // 插件功能
    methods: {
        // 示例方法
        hello: () => {
            return '你好，這是示例插件！';
        },
        
        // 獲取插件資訊
        getInfo: () => {
            return {
                name: '示例插件',
                version: '1.0.0',
                description: '這是一個示例插件，用於展示插件系統的功能'
            };
        }
    },
    
    // 插件事件處理
    events: {
        // 處理訊息事件
        onMessage: async (message) => {
            logger.info(`示例插件收到訊息: ${message}`);
            // 這裡可以處理訊息
            return true;
        },
        
        // 處理圖片事件
        onImage: async (image) => {
            logger.info('示例插件收到圖片');
            // 這裡可以處理圖片
            return true;
        }
    }
}; 