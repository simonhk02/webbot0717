/**
 * 插件路由
 */

const express = require('express');
const PluginRepository = require('../repositories/PluginRepository');

module.exports = (container) => {
  const router = express.Router();
  const pluginRepo = new PluginRepository(container);

  // 取得所有插件
  router.get('/', async (req, res) => {
    try {
      const plugins = await pluginRepo.getAllPlugins();
      res.json(plugins);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 安裝插件
  router.post('/', async (req, res) => {
    try {
      const result = await pluginRepo.install(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 更新插件設定
  router.put('/:id/config', async (req, res) => {
    try {
      const result = await pluginRepo.updateConfig(req.params.id, req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 移除插件
  router.delete('/:id', async (req, res) => {
    try {
      const result = await pluginRepo.uninstall(req.params.id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}; 