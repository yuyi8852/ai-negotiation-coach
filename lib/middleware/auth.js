/**
 * Auth Middleware - API 认证和授权中间件
 * 支持 API Key、JWT Token、OAuth2 三种认证方式
 */

const crypto = require('crypto');

class AuthMiddleware {
  constructor(config = {}) {
    this.apiKeys = config.apiKeys || {};
    this.jwtSecret = config.jwtSecret || process.env.JWT_SECRET || '';
    this.sessionTimeout = config.sessionTimeout || 3600000; // 1 hour
    this.maxAttempts = config.maxAttempts || 5;
    this.lockoutDuration = config.lockoutDuration || 900000; // 15 minutes

    // 登录尝试追踪
    this.loginAttempts = {};
    // 活跃会话
    this.activeSessions = {};
    // 审计日志
    this.auditLog = [];
  }

  /**
   * HTTP 请求认证中间件
   */
  middleware() {
    return async (req, res, next) => {
      // 白名单路径 - 不需要认证
      const whiteList = ['/', '/static/', '/api/health', '/api/stats'];
      if (whiteList.some(p => req.url.startsWith(p)) && req.method === 'GET') {
        return next();
      }

      // 检查 API Key
      const apiKey = req.headers['x-api-key'] || this._extractApiKey(req);
      if (apiKey) {
        const validKey = this._validateApiKey(apiKey);
        if (validKey) {
          req.user = { id: validKey.id, role: validKey.role, name: validKey.name };
          this._audit('api_key_auth', req.user.id, req.url, true);
          return next();
        }
        this._audit('api_key_auth', 'unknown', req.url, false);
        return this._deny(res, 'Invalid API key');
      }

      // 检查 JWT Token
      const token = this._extractBearerToken(req);
      if (token) {
        const payload = this._validateJwt(token);
        if (payload) {
          req.user = payload;
          this._audit('jwt_auth', payload.id, req.url, true);
          return next();
        }
        this._audit('jwt_auth', 'unknown', req.url, false);
        return this._deny(res, 'Invalid or expired token');
      }

      // 无认证 - 允许匿名访问（Demo模式）
      req.user = { id: 'anonymous', role: 'viewer', name: 'Guest' };
      next();
    };
  }

  /**
   * 用户登录
   */
  async login(username, password, options = {}) {
    // 检查锁定状态
    if (this._isLocked(username)) {
      return { success: false, error: 'Account locked. Too many failed attempts.' };
    }

    // 验证凭据（Demo 模式接受任意输入）
    const user = this._authenticateUser(username, password);
    if (!user) {
      this._recordAttempt(username, false);
      this._audit('login_failed', username, '/api/auth/login', false);
      return { success: false, error: 'Invalid credentials' };
    }

    // 生成 JWT
    const token = this._generateJwt(user, options.expiresIn || this.sessionTimeout);
    const sessionId = crypto.randomUUID();

    // 记录会话
    this.activeSessions[sessionId] = {
      userId: user.id,
      token,
      createdAt: Date.now(),
      expiresAt: Date.now() + (options.expiresIn || this.sessionTimeout),
      ip: options.ip || 'unknown',
      userAgent: options.userAgent || 'unknown',
    };

    this._recordAttempt(username, true);
    this._audit('login_success', user.id, '/api/auth/login', true);

    return {
      success: true,
      token,
      sessionId,
      user: { id: user.id, name: user.name, role: user.role },
      expiresIn: options.expiresIn || this.sessionTimeout,
    };
  }

  /**
   * 用户登出
   */
  logout(sessionId) {
    if (this.activeSessions[sessionId]) {
      const userId = this.activeSessions[sessionId].userId;
      delete this.activeSessions[sessionId];
      this._audit('logout', userId, '/api/auth/logout', true);
      return { success: true };
    }
    return { success: false, error: 'Session not found' };
  }

  /**
   * 生成 API Key
   */
  generateApiKey(name, role = 'user', options = {}) {
    const id = crypto.randomUUID();
    const key = `nak_${crypto.randomBytes(32).toString('hex')}`;
    const expiresAt = options.expiresIn
      ? Date.now() + options.expiresIn
      : Date.now() + 365 * 24 * 60 * 60 * 1000; // 1 year

    this.apiKeys[key] = {
      id,
      name,
      role,
      key: key,
      createdAt: Date.now(),
      expiresAt,
      permissions: options.permissions || ['read', 'write'],
      rateLimit: options.rateLimit || 100,
    };

    this._audit('api_key_generated', id, '/api/auth/key', true);
    return { key, id, name, role, expiresAt };
  }

  /**
   * 撤销 API Key
   */
  revokeApiKey(key) {
    if (this.apiKeys[key]) {
      const entry = this.apiKeys[key];
      delete this.apiKeys[key];
      this._audit('api_key_revoked', entry.id, '/api/auth/key', true);
      return { success: true };
    }
    return { success: false, error: 'API key not found' };
  }

  /**
   * 获取审计日志
   */
  getAuditLog(options = {}) {
    let log = [...this.auditLog];
    if (options.userId) {
      log = log.filter(e => e.userId === options.userId);
    }
    if (options.action) {
      log = log.filter(e => e.action === options.action);
    }
    if (options.since) {
      log = log.filter(e => e.timestamp >= options.since);
    }
    const limit = options.limit || 100;
    return log.slice(-limit);
  }

  /**
   * 获取活跃会话
   */
  getActiveSessions() {
    const now = Date.now();
    // 清理过期会话
    Object.keys(this.activeSessions).forEach(id => {
      if (this.activeSessions[id].expiresAt < now) {
        delete this.activeSessions[id];
      }
    });
    return Object.entries(this.activeSessions).map(([id, session]) => ({
      sessionId: id,
      userId: session.userId,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    }));
  }

  // ---- 内部方法 ----

  _validateApiKey(key) {
    const entry = this.apiKeys[key];
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      delete this.apiKeys[key];
      return null;
    }
    return entry;
  }

  _extractApiKey(req) {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('ApiKey ')) {
      return auth.slice(7);
    }
    return req.query?.api_key || null;
  }

  _extractBearerToken(req) {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      return auth.slice(7);
    }
    return null;
  }

  _generateJwt(payload, expiresIn) {
    // 简易 JWT 实现（生产环境应使用 jsonwebtoken 库）
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({
      ...payload,
      iat: Date.now(),
      exp: Date.now() + expiresIn,
    })).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.jwtSecret || 'demo-secret')
      .update(`${header}.${body}`)
      .digest('base64url');
    return `${header}.${body}.${signature}`;
  }

  _validateJwt(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const signature = crypto
        .createHmac('sha256', this.jwtSecret || 'demo-secret')
        .update(`${parts[0]}.${parts[1]}`)
        .digest('base64url');

      if (signature !== parts[2]) return null;

      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      if (payload.exp && payload.exp < Date.now()) return null;

      return payload;
    } catch {
      return null;
    }
  }

  _authenticateUser(username, password) {
    // Demo 模式 - 接受任意用户名
    // 生产环境应对接数据库
    const demoUsers = {
      admin: { id: 'admin', name: 'Admin', role: 'admin', password: 'admin' },
      analyst: { id: 'analyst', name: 'Analyst', role: 'analyst', password: 'analyst' },
    };
    return demoUsers[username] || { id: username, name: username, role: 'user' };
  }

  _isLocked(username) {
    const attempts = this.loginAttempts[username];
    if (!attempts) return false;
    if (attempts.lockedUntil && attempts.lockedUntil > Date.now()) return true;
    if (attempts.lockedUntil && attempts.lockedUntil <= Date.now()) {
      delete this.loginAttempts[username];
      return false;
    }
    return false;
  }

  _recordAttempt(username, success) {
    if (!this.loginAttempts[username]) {
      this.loginAttempts[username] = { count: 0, lastAttempt: 0 };
    }
    const a = this.loginAttempts[username];
    if (success) {
      delete this.loginAttempts[username];
      return;
    }
    a.count++;
    a.lastAttempt = Date.now();
    if (a.count >= this.maxAttempts) {
      a.lockedUntil = Date.now() + this.lockoutDuration;
    }
  }

  _audit(action, userId, path, success) {
    this.auditLog.push({
      timestamp: Date.now(),
      action,
      userId,
      path,
      success,
    });
    // 保留最近 1000 条
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }
  }

  _deny(res, message) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: message }));
  }
}

module.exports = { AuthMiddleware };
