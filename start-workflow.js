/**
 * 工作流系統啟動腳本
 * 用於啟動獨立的工作流機器人系統
 */

const { spawn } = require('child_process');
const { businessLogger } = require('./utils/logger');
const path = require('path');

// 導入 fetch (Node.js 18+ 內建，但為了兼容性使用 node-fetch)
let fetch;
if (typeof globalThis.fetch === 'undefined') {
  fetch = require('node-fetch');
} else {
  fetch = globalThis.fetch;
}

class WorkflowStarter {
  constructor() {
    this.logger = businessLogger;
    this.process = null;
    this.isRunning = false;
  }

  /**
   * 啟動工作流系統
   */
  async start() {
    try {
      this.logger.info('🚀 正在啟動工作流機器人系統...');

      // 檢查端口是否被佔用
      await this.checkPort();

      // 啟動應用程式
      await this.startApplication();

      this.logger.info('✅ 工作流系統啟動成功！');
      this.logger.info('📍 訪問地址: http://localhost:3001/workflow');
      this.logger.info('📊 健康檢查: http://localhost:3001/workflow/health');

    } catch (error) {
      this.logger.error('❌ 啟動工作流系統失敗:', error);
      process.exit(1);
    }
  }

  /**
   * 檢查端口是否被佔用
   */
  async checkPort() {
    return new Promise((resolve, reject) => {
      const net = require('net');
      const server = net.createServer();

      server.listen(3001, 'localhost', () => {
        server.close();
        this.logger.info('✅ 端口 3001 可用');
        resolve();
      });

      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          this.logger.error('❌ 端口 3001 已被佔用，請檢查是否有其他服務在運行');
          reject(new Error('端口被佔用'));
        } else {
          reject(error);
        }
      });
    });
  }

  /**
   * 啟動應用程式
   */
  async startApplication() {
    return new Promise((resolve, reject) => {
      // 設置環境變數
      const env = {
        ...process.env,
        NODE_ENV: 'development',
        WORKFLOW_BOT_PORT: '3001',
        WORKFLOW_BOT_HOST: 'localhost'
      };

      // 啟動工作流應用程式
      this.process = spawn('node', ['workflow-app.js'], {
        stdio: 'pipe',
        env: env,
        cwd: process.cwd()
      });

      // 處理輸出
      this.process.stdout.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          console.log(`[工作流系統] ${output}`);
          this.logger.info(output);
        }
      });

      this.process.stderr.on('data', (data) => {
        const error = data.toString().trim();
        if (error) {
          console.error(`[工作流系統錯誤] ${error}`);
          this.logger.error(error);
        }
      });

      // 處理進程退出
      this.process.on('close', (code) => {
        this.isRunning = false;
        if (code !== 0) {
          this.logger.error(`工作流系統進程異常退出，代碼: ${code}`);
          reject(new Error(`進程退出代碼: ${code}`));
        }
      });

      this.process.on('error', (error) => {
        this.isRunning = false;
        this.logger.error('工作流系統進程錯誤:', error);
        reject(error);
      });

      // 等待啟動完成
      setTimeout(() => {
        this.isRunning = true;
        resolve();
      }, 3000);
    });
  }

  /**
   * 停止工作流系統
   */
  async stop() {
    if (this.process && this.isRunning) {
      this.logger.info('🔄 正在停止工作流系統...');
      
      return new Promise((resolve) => {
        this.process.kill('SIGTERM');
        
        setTimeout(() => {
          if (this.process.killed) {
            this.logger.info('✅ 工作流系統已停止');
          } else {
            this.process.kill('SIGKILL');
            this.logger.info('⚠️ 強制停止工作流系統');
          }
          
          this.isRunning = false;
          resolve();
        }, 5000);
      });
    }
  }

  /**
   * 重啟工作流系統
   */
  async restart() {
    this.logger.info('🔄 正在重啟工作流系統...');
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 2000));
    await this.start();
  }

  /**
   * 檢查系統狀態
   */
  async checkStatus() {
    try {
      const response = await fetch('http://localhost:3001/workflow/health');
      const data = await response.json();
      
      if (data.status === 'healthy') {
        this.logger.info('✅ 工作流系統運行正常');
        return true;
      } else {
        this.logger.warn('⚠️ 工作流系統狀態異常');
        return false;
      }
    } catch (error) {
      this.logger.error('❌ 無法連接到工作流系統');
      return false;
    }
  }
}

// 命令行參數處理
const args = process.argv.slice(2);
const command = args[0];

const starter = new WorkflowStarter();

async function main() {
  switch (command) {
    case 'start':
      await starter.start();
      break;
      
    case 'stop':
      await starter.stop();
      break;
      
    case 'restart':
      await starter.restart();
      break;
      
    case 'status':
      await starter.checkStatus();
      break;
      
    default:
      console.log('工作流系統管理工具');
      console.log('');
      console.log('使用方法:');
      console.log('  node start-workflow.js start    - 啟動工作流系統');
      console.log('  node start-workflow.js stop     - 停止工作流系統');
      console.log('  node start-workflow.js restart  - 重啟工作流系統');
      console.log('  node start-workflow.js status   - 檢查系統狀態');
      console.log('');
      console.log('示例:');
      console.log('  node start-workflow.js start');
      break;
  }
}

// 處理進程信號
process.on('SIGINT', async () => {
  console.log('\n🔄 收到中斷信號，正在停止工作流系統...');
  await starter.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🔄 收到終止信號，正在停止工作流系統...');
  await starter.stop();
  process.exit(0);
});

// 如果直接運行此文件，則執行主函數
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 執行失敗:', error);
    process.exit(1);
  });
}

module.exports = WorkflowStarter; 