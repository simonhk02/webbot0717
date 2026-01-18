const fs = require('fs').promises;
const path = require('path');
const moduleManager = require('./moduleManager');
const { businessLogger } = require('../utils/logger');

class PluginLoader {
    constructor() {
        this.pluginsDir = path.join(__dirname, 'plugins');
    }

    async initialize() {
        try {
            await this.ensurePluginsDirectory();
            await this.loadAllPlugins();
        } catch (error) {
            businessLogger.error(`初始化插件載入器失敗: ${error.message}`);
        }
    }

    async ensurePluginsDirectory() {
        try {
            await fs.access(this.pluginsDir);
        } catch {
            await fs.mkdir(this.pluginsDir, { recursive: true });
            businessLogger.info('創建插件目錄');
        }
    }

    async loadAllPlugins() {
        try {
            const files = await fs.readdir(this.pluginsDir);
            const pluginFiles = files.filter(file => file.endsWith('.js'));

            for (const file of pluginFiles) {
                const pluginPath = path.join(this.pluginsDir, file);
                await moduleManager.loadPlugin(pluginPath);
            }

            businessLogger.info(`已載入 ${pluginFiles.length} 個插件`);
        } catch (error) {
            businessLogger.error(`載入插件失敗: ${error.message}`);
        }
    }

    async watchPlugins() {
        try {
            const watcher = fs.watch(this.pluginsDir, async (eventType, filename) => {
                if (filename && filename.endsWith('.js')) {
                    const pluginId = path.basename(filename, '.js');
                    if (eventType === 'change') {
                        await moduleManager.reloadPlugin(pluginId);
                    }
                }
            });

            businessLogger.info('開始監視插件目錄');
            return watcher;
        } catch (error) {
            businessLogger.error(`監視插件目錄失敗: ${error.message}`);
        }
    }

    async uploadPlugin(file) {
        try {
            const pluginPath = path.join(this.pluginsDir, file.name);
            await fs.writeFile(pluginPath, file.data);
            await moduleManager.loadPlugin(pluginPath);
            businessLogger.info(`上傳並載入插件: ${file.name}`);
            return true;
        } catch (error) {
            businessLogger.error(`上傳插件失敗: ${error.message}`);
            return false;
        }
    }

    async deletePlugin(pluginId) {
        try {
            const pluginPath = path.join(this.pluginsDir, `${pluginId}.js`);
            await moduleManager.unloadPlugin(pluginId);
            await fs.unlink(pluginPath);
            businessLogger.info(`刪除插件: ${pluginId}`);
            return true;
        } catch (error) {
            businessLogger.error(`刪除插件失敗: ${error.message}`);
            return false;
        }
    }
}

module.exports = new PluginLoader(); 