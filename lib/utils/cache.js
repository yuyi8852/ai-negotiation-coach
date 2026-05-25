/**
 * Cache - 内存缓存模块
 * 支持 TTL、LRU 淘汰、命中率统计
 */

class Cache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.defaultTTL || 300000; // 5 minutes
    this.store = new Map();
    this.accessOrder = []; // LRU 追踪

    // 统计
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      sets: 0,
      deletes: 0,
    };

    // 定期清理过期项
    this._cleanupInterval = setInterval(() => this._cleanup(), 60000);
  }

  /**
   * 获取缓存值
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // 检查是否过期
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      this._removeFromAccessOrder(key);
      this.stats.misses++;
      return null;
    }

    // 更新访问顺序（LRU）
    this._touchAccessOrder(key);
    this.stats.hits++;

    return entry.value;
  }

  /**
   * 设置缓存值
   */
  set(key, value, ttl) {
    // LRU 淘汰
    if (!this.store.has(key) && this.store.size >= this.maxSize) {
      this._evict();
    }

    const expiresAt = ttl !== undefined
      ? Date.now() + ttl
      : (this.defaultTTL ? Date.now() + this.defaultTTL : null);

    this.store.set(key, {
      value,
      expiresAt,
      createdAt: Date.now(),
      accessCount: 0,
    });

    this._touchAccessOrder(key);
    this.stats.sets++;
  }

  /**
   * 删除缓存值
   */
  delete(key) {
    if (this.store.has(key)) {
      this.store.delete(key);
      this._removeFromAccessOrder(key);
      this.stats.deletes++;
      return true;
    }
    return false;
  }

  /**
   * 批量获取
   */
  mget(keys) {
    return keys.map(key => ({ key, value: this.get(key) }));
  }

  /**
   * 批量设置
   */
  mset(entries, ttl) {
    entries.forEach(({ key, value }) => this.set(key, value, ttl));
  }

  /**
   * 检查 key 是否存在且未过期
   */
  has(key) {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      this._removeFromAccessOrder(key);
      return false;
    }
    return true;
  }

  /**
   * 获取或设置（缓存穿透保护）
   */
  async getOrSet(key, factory, ttl) {
    const cached = this.get(key);
    if (cached !== null) return cached;

    const value = typeof factory === 'function' ? await factory() : factory;
    this.set(key, value, ttl);
    return value;
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.store.size,
      maxSize: this.maxSize,
      hitRate: total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) + '%' : '0%',
      totalRequests: total,
    };
  }

  /**
   * 按前缀清理
   */
  clearByPrefix(prefix) {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        this._removeFromAccessOrder(key);
        count++;
      }
    }
    return count;
  }

  /**
   * 清空所有缓存
   */
  clear() {
    this.store.clear();
    this.accessOrder = [];
  }

  /**
   * 获取所有 key
   */
  keys(pattern) {
    if (!pattern) return [...this.store.keys()];
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return [...this.store.keys()].filter(k => regex.test(k));
  }

  /**
   * 获取缓存大小估算（字节）
   */
  getMemoryUsage() {
    let bytes = 0;
    for (const [key, entry] of this.store) {
      bytes += key.length * 2;
      bytes += JSON.stringify(entry.value).length * 2;
      bytes += 64; // overhead per entry
    }
    return {
      bytes,
      humanReadable: bytes > 1024 * 1024
        ? (bytes / 1024 / 1024).toFixed(2) + ' MB'
        : (bytes / 1024).toFixed(2) + ' KB',
    };
  }

  // ---- 内部方法 ----

  _touchAccessOrder(key) {
    this._removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  _removeFromAccessOrder(key) {
    const idx = this.accessOrder.indexOf(key);
    if (idx !== -1) {
      this.accessOrder.splice(idx, 1);
    }
  }

  _evict() {
    // LRU 淘汰 - 删除最久未访问的
    while (this.accessOrder.length > 0 && this.store.size >= this.maxSize) {
      const oldest = this.accessOrder.shift();
      this.store.delete(oldest);
      this.stats.evictions++;
    }
  }

  _cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.store.delete(key);
        this._removeFromAccessOrder(key);
      }
    }
  }

  destroy() {
    clearInterval(this._cleanupInterval);
    this.clear();
  }
}

module.exports = { Cache };
