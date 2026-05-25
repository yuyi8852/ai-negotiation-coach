/**
 * RateLimiter - 请求限流中间件
 * 支持滑动窗口、令牌桶、漏桶三种限流算法
 */

class RateLimiter {
  constructor(config = {}) {
    this.algorithm = config.algorithm || 'sliding-window'; // sliding-window | token-bucket | leaky-bucket
    this.maxRequests = config.maxRequests || 60;
    this.windowMs = config.windowMs || 60000; // 1 minute
    this.burstSize = config.burstSize || 10; // 令牌桶突发容量
    this.refillRate = config.refillRate || 1; // 令牌/秒
    this.leakRate = config.leakRate || 1; // 漏桶泄漏速率

    // 存储各客户端的请求记录
    this.clients = {};
    // 白名单IP
    this.whitelist = new Set(config.whitelist || []);
    // 自定义规则
    this.customRules = config.customRules || [];

    // 统计
    this.stats = {
      totalRequests: 0,
      totalDenied: 0,
      byClient: {},
    };

    // 定期清理过期记录
    this._cleanupInterval = setInterval(() => this._cleanup(), 60000);
  }

  /**
   * HTTP 中间件
   */
  middleware() {
    return (req, res, next) => {
      const clientId = this._getClientId(req);

      // 白名单检查
      if (this.whitelist.has(clientId)) {
        return next();
      }

      // 自定义规则检查
      const customRule = this._matchCustomRule(req);
      if (customRule) {
        const result = this._checkLimit(clientId, customRule);
        this._setHeaders(res, result);
        if (!result.allowed) {
          this.stats.totalDenied++;
          return this._deny(res, result);
        }
      }

      // 默认限流检查
      const result = this._checkLimit(clientId, {
        maxRequests: this.maxRequests,
        windowMs: this.windowMs,
      });

      this._setHeaders(res, result);
      this.stats.totalRequests++;

      if (!result.allowed) {
        this.stats.totalDenied++;
        return this._deny(res, result);
      }

      next();
    };
  }

  /**
   * 检查限流
   */
  _checkLimit(clientId, rule) {
    switch (this.algorithm) {
      case 'token-bucket':
        return this._checkTokenBucket(clientId, rule);
      case 'leaky-bucket':
        return this._checkLeakyBucket(clientId, rule);
      default:
        return this._checkSlidingWindow(clientId, rule);
    }
  }

  /**
   * 滑动窗口算法
   */
  _checkSlidingWindow(clientId, rule) {
    const now = Date.now();
    if (!this.clients[clientId]) {
      this.clients[clientId] = { requests: [], windowStart: now };
    }

    const client = this.clients[clientId];
    const windowMs = rule.windowMs || this.windowMs;
    const maxRequests = rule.maxRequests || this.maxRequests;

    // 清理窗口外的请求
    client.requests = client.requests.filter(t => t > now - windowMs);

    const currentCount = client.requests.length;
    const allowed = currentCount < maxRequests;

    if (allowed) {
      client.requests.push(now);
    }

    return {
      allowed,
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - currentCount - (allowed ? 1 : 0)),
      resetAt: client.requests.length > 0
        ? client.requests[0] + windowMs
        : now + windowMs,
      retryAfter: allowed ? 0 : Math.ceil((client.requests[0] + windowMs - now) / 1000),
    };
  }

  /**
   * 令牌桶算法
   */
  _checkTokenBucket(clientId, rule) {
    const now = Date.now();
    const burstSize = rule.burstSize || this.burstSize;
    const refillRate = rule.refillRate || this.refillRate;

    if (!this.clients[clientId]) {
      this.clients[clientId] = { tokens: burstSize, lastRefill: now };
    }

    const client = this.clients[clientId];

    // 补充令牌
    const elapsed = (now - client.lastRefill) / 1000;
    client.tokens = Math.min(burstSize, client.tokens + elapsed * refillRate);
    client.lastRefill = now;

    const allowed = client.tokens >= 1;
    if (allowed) {
      client.tokens -= 1;
    }

    return {
      allowed,
      limit: burstSize,
      remaining: Math.floor(client.tokens),
      resetAt: now + ((burstSize - client.tokens) / refillRate) * 1000,
      retryAfter: allowed ? 0 : Math.ceil((1 - client.tokens) / refillRate),
    };
  }

  /**
   * 漏桶算法
   */
  _checkLeakyBucket(clientId, rule) {
    const now = Date.now();
    const leakRate = rule.leakRate || this.leakRate;

    if (!this.clients[clientId]) {
      this.clients[clientId] = { queue: [], lastLeak: now };
    }

    const client = this.clients[clientId];

    // 漏桶泄漏
    const elapsed = (now - client.lastLeak) / 1000;
    const leaked = Math.floor(elapsed * leakRate);
    if (leaked > 0) {
      client.queue.splice(0, leaked);
      client.lastLeak = now;
    }

    const maxQueue = rule.maxRequests || this.maxRequests;
    const allowed = client.queue.length < maxQueue;

    if (allowed) {
      client.queue.push(now);
    }

    return {
      allowed,
      limit: maxQueue,
      remaining: Math.max(0, maxQueue - client.queue.length),
      resetAt: client.queue.length > 0
        ? client.queue[0] + (maxQueue / leakRate) * 1000
        : now,
      retryAfter: allowed ? 0 : Math.ceil(1 / leakRate),
    };
  }

  /**
   * 获取客户端标识
   */
  _getClientId(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.socket?.remoteAddress
      || 'unknown';
  }

  /**
   * 匹配自定义规则
   */
  _matchCustomRule(req) {
    return this.customRules.find(rule => {
      if (rule.method && rule.method !== req.method) return false;
      if (rule.path && !req.url.startsWith(rule.path)) return false;
      return true;
    }) || null;
  }

  /**
   * 设置限流响应头
   */
  _setHeaders(res, result) {
    res.setHeader('X-RateLimit-Limit', result.limit);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));
    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter);
    }
  }

  /**
   * 拒绝请求
   */
  _deny(res, result) {
    res.writeHead(429, {
      'Content-Type': 'application/json',
      'Retry-After': result.retryAfter,
    });
    res.end(JSON.stringify({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
      retryAfter: result.retryAfter,
      limit: result.limit,
      remaining: result.remaining,
    }));
  }

  /**
   * 清理过期记录
   */
  _cleanup() {
    const now = Date.now();
    Object.keys(this.clients).forEach(clientId => {
      const client = this.clients[clientId];
      if (client.requests) {
        client.requests = client.requests.filter(t => t > now - this.windowMs);
        if (client.requests.length === 0) {
          delete this.clients[clientId];
        }
      }
      if (client.queue && client.queue.length === 0) {
        delete this.clients[clientId];
      }
    });
  }

  /**
   * 获取限流统计
   */
  getStats() {
    return {
      ...this.stats,
      activeClients: Object.keys(this.clients).length,
      algorithm: this.algorithm,
    };
  }

  /**
   * 动态调整限流参数
   */
  configure(updates) {
    if (updates.maxRequests) this.maxRequests = updates.maxRequests;
    if (updates.windowMs) this.windowMs = updates.windowMs;
    if (updates.burstSize) this.burstSize = updates.burstSize;
    if (updates.refillRate) this.refillRate = updates.refillRate;
    if (updates.algorithm) this.algorithm = updates.algorithm;
    return { success: true, config: this.getStats() };
  }

  /**
   * 释放资源
   */
  destroy() {
    clearInterval(this._cleanupInterval);
  }
}

module.exports = { RateLimiter };
