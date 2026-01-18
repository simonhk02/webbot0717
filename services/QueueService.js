const Queue = require('bull');
const { businessLogger } = require('../utils/logger');
const config = require('../config');
const { getRedisInstance } = require('./redisService');

class QueueService {
  constructor() {
    this.queues = new Map();
    this.queueStats = new Map();
    this.setupQueues();
    businessLogger.info('佇列服務已初始化');
  }

  setupQueues() {
    // 檢查是否使用 Redis Mock
    const redisInstance = getRedisInstance();
    this.isUsingMock = redisInstance.constructor.name === 'RedisMock';
    
    if (this.isUsingMock) {
      businessLogger.warn('使用 Redis Mock，佇列功能將以簡化模式運行');
      // 使用簡化的佇列實現
      this.createMockQueue('image-processing');
    } else {
      // 使用真實的 Bull 佇列
      this.createQueue('image-processing', {
        redis: { 
          host: config.redis.connection.host, 
          port: config.redis.connection.port 
        },
        defaultJobOptions: {
          removeOnComplete: config.queue.imageProcessing.removeOnComplete,
          removeOnFail: config.queue.imageProcessing.removeOnFail
        }
      });
    }

    // 可以在此添加更多佇列
    // this.createQueue('email-sending', { ... });
    // this.createQueue('notification', { ... });
  }

  createQueue(name, options = {}) {
    if (this.queues.has(name)) {
      businessLogger.warn(`佇列 ${name} 已存在，返回現有實例`);
      return this.queues.get(name);
    }

    const queue = new Queue(name, options);
    this.queues.set(name, queue);
    this.queueStats.set(name, {
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      activeJobs: 0,
      waitingJobs: 0,
      lastActivity: Date.now()
    });

    // 設置佇列事件監聽
    this.setupQueueEvents(queue, name);

    businessLogger.info(`佇列 ${name} 已建立`);
    return queue;
  }

  createMockQueue(name) {
    if (this.queues.has(name)) {
      businessLogger.warn(`模擬佇列 ${name} 已存在，返回現有實例`);
      return this.queues.get(name);
    }

    // 創建模擬佇列對象
    const mockQueue = {
      name: name,
      jobs: [],
      processor: null,
      
      add: async (data, options = {}) => {
        const job = {
          id: Date.now() + Math.random(),
          data: data,
          options: options,
          status: 'waiting'
        };
        this.jobs.push(job);
        businessLogger.info(`模擬佇列 ${name} 添加任務：${job.id}`);
        
        // 立即處理任務（模擬）
        if (this.processor) {
          setTimeout(() => this.processJob(job), 100);
        }
        
        return job;
      },
      
      process: (processor) => {
        this.processor = processor;
        businessLogger.info(`模擬佇列 ${name} 設置處理器`);
      },
      
      processJob: async (job) => {
        if (this.processor) {
          try {
            job.status = 'active';
            await this.processor(job);
            job.status = 'completed';
            businessLogger.info(`模擬佇列 ${name} 任務完成：${job.id}`);
          } catch (err) {
            job.status = 'failed';
            job.error = err.message;
            businessLogger.error(`模擬佇列 ${name} 任務失敗：${job.id}，錯誤：${err.message}`);
          }
        }
      },
      
      getJobCounts: async () => ({
        waiting: this.jobs.filter(j => j.status === 'waiting').length,
        active: this.jobs.filter(j => j.status === 'active').length,
        completed: this.jobs.filter(j => j.status === 'completed').length,
        failed: this.jobs.filter(j => j.status === 'failed').length
      }),
      
      pause: async () => {
        businessLogger.info(`模擬佇列 ${name} 已暫停`);
      },
      
      resume: async () => {
        businessLogger.info(`模擬佇列 ${name} 已恢復`);
      },
      
      clean: async () => {
        businessLogger.info(`模擬佇列 ${name} 已清理`);
      }
    };

    this.queues.set(name, mockQueue);
    this.queueStats.set(name, {
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      activeJobs: 0,
      waitingJobs: 0,
      lastActivity: Date.now()
    });

    businessLogger.info(`模擬佇列 ${name} 已建立`);
    return mockQueue;
  }

  setupQueueEvents(queue, name) {
    queue.on('completed', (job) => {
      const stats = this.queueStats.get(name);
      stats.completedJobs++;
      stats.totalJobs++;
      stats.lastActivity = Date.now();
      businessLogger.info(`佇列 ${name} 任務完成：${job.id}`);
    });

    queue.on('failed', (job, err) => {
      const stats = this.queueStats.get(name);
      stats.failedJobs++;
      stats.totalJobs++;
      stats.lastActivity = Date.now();
      businessLogger.error(`佇列 ${name} 任務失敗：${job.id}，錯誤：${err.message}`);
    });

    queue.on('active', (job) => {
      const stats = this.queueStats.get(name);
      stats.activeJobs++;
      stats.lastActivity = Date.now();
      businessLogger.info(`佇列 ${name} 任務開始執行：${job.id}`);
    });

    queue.on('waiting', (job) => {
      const stats = this.queueStats.get(name);
      stats.waitingJobs++;
      stats.lastActivity = Date.now();
      businessLogger.info(`佇列 ${name} 任務等待中：${job.id}`);
    });

    queue.on('stalled', (job) => {
      businessLogger.warn(`佇列 ${name} 任務停滯：${job.id}`);
    });

    queue.on('error', (err) => {
      businessLogger.error(`佇列 ${name} 發生錯誤：${err.message}`);
    });
  }

  getQueue(name) {
    return this.queues.get(name);
  }

  async addJob(queueName, data, options = {}) {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`佇列 ${queueName} 不存在`);
    }

    try {
      const job = await queue.add(data, options);
      businessLogger.info(`已添加任務到佇列 ${queueName}：${job.id}`);
      return job;
    } catch (err) {
      businessLogger.error(`添加任務到佇列 ${queueName} 失敗：${err.message}`);
      throw err;
    }
  }

  async processJob(queueName, processor) {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`佇列 ${queueName} 不存在`);
    }

    queue.process(processor);
    businessLogger.info(`已設置佇列 ${queueName} 的處理器`);
  }

  async getQueueStats(queueName) {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`佇列 ${queueName} 不存在`);
    }

    const stats = this.queueStats.get(queueName);
    const jobCounts = await queue.getJobCounts();
    
    return {
      ...stats,
      ...jobCounts,
      name: queueName,
      lastActivity: new Date(stats.lastActivity).toISOString()
    };
  }

  async getAllQueueStats() {
    const allStats = {};
    for (const [name, queue] of this.queues.entries()) {
      try {
        allStats[name] = await this.getQueueStats(name);
      } catch (err) {
        businessLogger.error(`獲取佇列 ${name} 統計失敗：${err.message}`);
        allStats[name] = { error: err.message };
      }
    }
    return allStats;
  }

  async pauseQueue(queueName) {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`佇列 ${queueName} 不存在`);
    }

    await queue.pause();
    businessLogger.info(`佇列 ${queueName} 已暫停`);
  }

  async resumeQueue(queueName) {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`佇列 ${queueName} 不存在`);
    }

    await queue.resume();
    businessLogger.info(`佇列 ${queueName} 已恢復`);
  }

  async cleanQueue(queueName, grace = 1000 * 60 * 60 * 24) {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`佇列 ${queueName} 不存在`);
    }

    await queue.clean(grace, 'completed');
    await queue.clean(grace, 'failed');
    businessLogger.info(`佇列 ${queueName} 已清理`);
  }

  async removeJob(queueName, jobId) {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`佇列 ${queueName} 不存在`);
    }

    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
      businessLogger.info(`佇列 ${queueName} 任務 ${jobId} 已移除`);
    } else {
      businessLogger.warn(`佇列 ${queueName} 任務 ${jobId} 不存在`);
    }
  }

  async retryJob(queueName, jobId) {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`佇列 ${queueName} 不存在`);
    }

    const job = await queue.getJob(jobId);
    if (job) {
      await job.retry();
      businessLogger.info(`佇列 ${queueName} 任務 ${jobId} 已重試`);
    } else {
      businessLogger.warn(`佇列 ${queueName} 任務 ${jobId} 不存在`);
    }
  }

  async cleanup() {
    businessLogger.info('開始清理佇列服務...');
    
    for (const [name, queue] of this.queues.entries()) {
      try {
        await queue.close();
        businessLogger.info(`佇列 ${name} 已關閉`);
      } catch (err) {
        businessLogger.error(`關閉佇列 ${name} 失敗：${err.message}`);
      }
    }

    this.queues.clear();
    this.queueStats.clear();
    businessLogger.info('佇列服務已清理');
  }

  // 健康檢查
  async healthCheck() {
    const health = {
      status: 'healthy',
      queues: {},
      timestamp: new Date().toISOString()
    };

    for (const [name, queue] of this.queues.entries()) {
      try {
        const stats = await this.getQueueStats(name);
        health.queues[name] = {
          status: 'healthy',
          stats
        };
      } catch (err) {
        health.queues[name] = {
          status: 'unhealthy',
          error: err.message
        };
        health.status = 'unhealthy';
      }
    }

    return health;
  }
}

// 建立單例實例
const queueService = new QueueService();

module.exports = queueService; 