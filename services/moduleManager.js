const fs = require('fs').promises;
const path = require('path');
const { businessLogger } = require('../utils/logger');

class ModuleManager {
    constructor() {
        this.plugins = new Map();
        this.pluginStates = new Map();
        this.pluginConfigs = new Map();
    }

    async loadPlugin(pluginPath) {
        try {
            const plugin = require(pluginPath);
            if (!this.validatePlugin(plugin)) {
                throw new Error('插件格式無效');
            }

            const pluginId = path.basename(pluginPath, '.js');
            this.plugins.set(pluginId, plugin);
            this.pluginStates.set(pluginId, 'loaded');
            
            businessLogger.info(`插件 ${pluginId} 已載入`);
            return true;
        } catch (error) {
            businessLogger.error(`載入插件失敗: ${error.message}`);
            return false;
        }
    }

    async unloadPlugin(pluginId) {
        try {
            const plugin = this.plugins.get(pluginId);
            if (!plugin) {
                throw new Error('插件不存在');
            }

            if (plugin.cleanup) {
                await plugin.cleanup();
            }

            this.plugins.delete(pluginId);
            this.pluginStates.set(pluginId, 'unloaded');
            
            businessLogger.info(`插件 ${pluginId} 已卸載`);
            return true;
        } catch (error) {
            businessLogger.error(`卸載插件失敗: ${error.message}`);
            return false;
        }
    }

    async reloadPlugin(pluginId) {
        try {
            await this.unloadPlugin(pluginId);
            const pluginPath = path.join(__dirname, 'plugins', `${pluginId}.js`);
            return await this.loadPlugin(pluginPath);
        } catch (error) {
            businessLogger.error(`重新載入插件失敗: ${error.message}`);
            return false;
        }
    }

    validatePlugin(plugin) {
        return (
            plugin &&
            typeof plugin === 'object' &&
            typeof plugin.init === 'function' &&
            typeof plugin.name === 'string' &&
            typeof plugin.version === 'string'
        );
    }

    getPluginState(pluginId) {
        return this.pluginStates.get(pluginId) || 'unknown';
    }

    getAllPlugins() {
        return Array.from(this.plugins.entries()).map(([id, plugin]) => ({
            id,
            name: plugin.name,
            version: plugin.version,
            state: this.pluginStates.get(id)
        }));
    }

    async initializePlugin(pluginId, config = {}) {
        try {
            const plugin = this.plugins.get(pluginId);
            if (!plugin) {
                throw new Error('插件不存在');
            }

            this.pluginConfigs.set(pluginId, config);
            await plugin.init(config);
            this.pluginStates.set(pluginId, 'initialized');
            
            businessLogger.info(`插件 ${pluginId} 已初始化`);
            return true;
        } catch (error) {
            businessLogger.error(`初始化插件失敗: ${error.message}`);
            return false;
        }
    }
}

module.exports = new ModuleManager(); 