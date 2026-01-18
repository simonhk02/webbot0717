const moduleManager = require('../services/moduleManager');
const { businessLogger } = require('../utils/logger');

function pluginMiddleware() {
    return async (req, res, next) => {
        try {
            // 獲取所有已載入的插件
            const plugins = moduleManager.getAllPlugins();
            
            // 將插件資訊添加到請求對象中
            req.plugins = plugins;
            
            // 檢查請求是否需要特定插件
            const requiredPlugin = req.path.split('/')[2]; // 假設路徑格式為 /api/plugins/:pluginId/...
            if (requiredPlugin && plugins.some(p => p.id === requiredPlugin)) {
                const pluginState = moduleManager.getPluginState(requiredPlugin);
                if (pluginState !== 'initialized') {
                    return res.status(503).json({
                        error: '插件未初始化',
                        pluginId: requiredPlugin,
                        state: pluginState
                    });
                }
            }
            
            next();
        } catch (error) {
            businessLogger.error(`插件中間件錯誤: ${error.message}`);
            next(error);
        }
    };
}

module.exports = pluginMiddleware; 