class RedisMock {
  constructor() {
    this.data = new Map();
    this.expiry = new Map();
    console.log('使用 Redis 模擬器 - 僅供開發測試使用');
  }

  async get(key) {
    const value = this.data.get(key);
    if (value && this.expiry.has(key)) {
      const expiryTime = this.expiry.get(key);
      if (Date.now() > expiryTime) {
        this.data.delete(key);
        this.expiry.delete(key);
        return null;
      }
    }
    return value;
  }

  async set(key, value, mode, ttl) {
    this.data.set(key, value);
    if (ttl) {
      this.expiry.set(key, Date.now() + (ttl * 1000));
    }
    return 'OK';
  }

  async del(key) {
    const existed = this.data.has(key);
    this.data.delete(key);
    this.expiry.delete(key);
    return existed ? 1 : 0;
  }

  async exists(key) {
    return this.data.has(key) ? 1 : 0;
  }

  async expire(key, seconds) {
    if (this.data.has(key)) {
      this.expiry.set(key, Date.now() + (seconds * 1000));
      return 1;
    }
    return 0;
  }

  async ttl(key) {
    if (!this.expiry.has(key)) {
      return -1; // 沒有設置過期時間
    }
    const remaining = Math.ceil((this.expiry.get(key) - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2; // -2 表示已過期
  }

  async keys(pattern) {
    const keys = Array.from(this.data.keys());
    if (pattern === '*') {
      return keys;
    }
    // 簡單的模式匹配
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return keys.filter(key => regex.test(key));
  }

  async flushall() {
    this.data.clear();
    this.expiry.clear();
    return 'OK';
  }

  async ping() {
    return 'PONG';
  }

  async quit() {
    this.data.clear();
    this.expiry.clear();
    return 'OK';
  }

  async disconnect() {
    return this.quit();
  }
}

module.exports = RedisMock; 