/**
 * AI Negotiation Coach - 主服务器
 * 零依赖 Web 服务（使用 Node.js 内置模块）
 * 集成中间件：认证、限流、日志
 * 集成服务层：数据分析、通知、历史管理
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { MiMoClient } = require('./lib/mimo-client');
const { Orchestrator } = require('./lib/orchestrator');
const { JsonDB } = require('./lib/db');
const { Exporter } = require('./lib/export');
const { AuthMiddleware } = require('./lib/middleware/auth');
const { RateLimiter } = require('./lib/middleware/rate-limiter');
const { Logger } = require('./lib/middleware/logger');
const { AnalyticsService } = require('./lib/services/analytics');
const { NotificationService } = require('./lib/services/notification');
const { HistoryService } = require('./lib/services/history');
const { Validators } = require('./lib/utils/validators');
const { Formatters } = require('./lib/utils/formatters');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const STATIC_DIR = path.join(__dirname, 'static');

// 初始化核心组件
const mimo = new MiMoClient();
const orchestrator = new Orchestrator(mimo);
const db = new JsonDB(DATA_DIR);
const exporter = new Exporter(path.join(DATA_DIR, 'exports'));

// 初始化中间件
const auth = new AuthMiddleware({
  sessionTimeout: 3600000,
  maxAttempts: 5,
  lockoutDuration: 900000,
});

const rateLimiter = new RateLimiter({
  algorithm: 'sliding-window',
  maxRequests: 60,
  windowMs: 60000,
  customRules: [
    { method: 'POST', path: '/api/analyze', maxRequests: 10, windowMs: 60000 },
    { method: 'POST', path: '/api/upload', maxRequests: 20, windowMs: 60000 },
  ],
});

const logger = new Logger({
  level: process.env.LOG_LEVEL || 'INFO',
  format: 'pretty',
  enableConsole: true,
  enableFile: process.env.LOG_FILE === 'true',
  enableColors: true,
});

// 初始化服务层
const analytics = new AnalyticsService(db);
const notifications = new NotificationService({
  channels: ['console'],
});
const history = new HistoryService(db);

// MIME 类型
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

// 路由表
const routes = {
  'GET /': serveIndex,
  'GET /api/stats': getStats,
  'GET /api/sessions': listSessions,
  'GET /api/session/:id': getSession,
  'POST /api/analyze': startAnalysis,
  'POST /api/upload': handleUpload,
  'GET /api/industries': getIndustries,
  'GET /api/risk-patterns': getRiskPatterns,
  'GET /report/:id': getReport,
  'GET /audio/:id': getAudio,
  // 新增路由 - 认证
  'POST /api/auth/login': authLogin,
  'POST /api/auth/logout': authLogout,
  'POST /api/auth/key': generateApiKey,
  // 新增路由 - 分析
  'GET /api/analytics/dashboard': getDashboard,
  'GET /api/analytics/session/:id': getSessionAnalytics,
  'GET /api/analytics/insights': getInsights,
  // 新增路由 - 历史
  'GET /api/history': searchHistory,
  'GET /api/history/tags': getAllTags,
  'GET /api/history/timeline/:id': getTimeline,
  'GET /api/history/stats': getHistoryStats,
  'POST /api/history/archive/:id': archiveSession,
  // 新增路由 - 通知
  'GET /api/notifications': getNotifications,
  'POST /api/notifications/test': testNotification,
  // 新增路由 - 中间件管理
  'GET /api/health': healthCheck,
  'GET /api/rate-limit/stats': getRateLimitStats,
  // 新增路由 - 条款模板
  'GET /api/clause-templates': getClauseTemplates,
  'GET /api/negotiation-scripts': getNegotiationScripts,
  // 新增路由 - Agent 管理
  'GET /api/agents': getAgents,
  'POST /api/agents/:name/execute': executeAgent,
};

// 主服务器
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const method = req.method;
  const pathname = url.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  if (method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // 应用中间件
  const startTime = Date.now();

  try {
    // 静态文件（跳过中间件）
    if (pathname.startsWith('/static/')) {
      return serveStatic(res, pathname);
    }

    // API 路由匹配
    const routeKey = `${method} ${pathname}`;
    if (routes[routeKey]) {
      const params = {};
      const match = routes[routeKey];

      // 解析 URL 参数
      url.searchParams.forEach((value, key) => {
        params[key] = value;
      });

      // 路径参数解析
      if (pathname.includes(':id')) {
        const routeParts = pathname.split('/');
        const urlParts = pathname.split('/');
        // 简单的参数匹配
        for (let i = 0; i < routeParts.length; i++) {
          if (routeParts[i] === ':id') {
            params.id = urlParts[i];
          }
        }
      }

      // 解析请求体
      let body = null;
      if (method === 'POST' || method === 'PUT') {
        body = await parseBody(req);
      }

      // 构建请求上下文
      const context = {
        method,
        url: pathname,
        params,
        query: Object.fromEntries(url.searchParams),
        body,
        headers: req.headers,
        user: req.user,
        requestId: req.requestId,
      };

      // 执行路由处理
      await match(res, context);

      // 记录请求日志
      const duration = Date.now() - startTime;
      logger.info(`${method} ${pathname} ${res.statusCode} ${duration}ms`);

    } else {
      // 404
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found', path: pathname }));
    }

  } catch (error) {
    logger.error(`Request error: ${error.message}`, { stack: error.stack });
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    }));
  }
});

// 请求体解析
function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const maxSize = 20 * 1024 * 1024; // 20MB

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxSize) {
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      const body = Buffer.concat(chunks).toString();
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve(body);
      }
    });

    req.on('error', reject);
  });
}

// ---- 路由处理函数 ----

// 静态文件服务
function serveStatic(res, pathname) {
  const filePath = path.join(STATIC_DIR, pathname.replace('/static/', ''));
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
}

// 首页
function serveIndex(res) {
  const filePath = path.join(STATIC_DIR, 'index.html');
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(content);
  } catch {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>AI Negotiation Coach</h1><p>Service starting...</p>');
  }
}

// 健康检查
async function healthCheck(res) {
  const stats = {
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: require('./package.json').version,
    demoMode: mimo.demoMode,
    agents: orchestrator.getRegisteredAgents().length,
    services: {
      database: 'connected',
      analytics: 'ready',
      notifications: 'ready',
      history: 'ready',
    },
  };
  sendJSON(res, 200, stats);
}

// 统计数据
async function getStats(res) {
  try {
    const stats = await analytics.getDashboardStats();
    sendJSON(res, 200, stats);
  } catch (error) {
    sendJSON(res, 500, { error: error.message });
  }
}

// 会话列表
async function listSessions(res) {
  const sessions = db.find('sessions');
  sendJSON(res, 200, {
    sessions: sessions.map(s => ({
      id: s.id,
      status: s.status,
      industry: s.industry,
      createdAt: s.createdAt,
      riskScore: s.results?.riskAssessment?.assessment?.overallScore,
    })),
    total: sessions.length,
  });
}

// 获取单个会话
async function getSession(res, context) {
  const session = db.findById('sessions', context.params.id);
  if (!session) {
    sendJSON(res, 404, { error: 'Session not found' });
    return;
  }
  sendJSON(res, 200, session);
}

// 开始分析
async function startAnalysis(res, context) {
  const body = context.body || {};

  // 输入验证
  const validation = Validators.validateAnalysisRequest(body);
  if (!validation.valid) {
    sendJSON(res, 400, { error: 'Validation failed', details: validation.errors });
    return;
  }

  const sanitizedBody = validation.sanitized;

  // 创建会话
  const session = db.insert('sessions', {
    status: 'processing',
    industry: sanitizedBody.industry,
    documentType: typeof sanitizedBody.document === 'string' ? 'text' : 'image',
  });

  logger.info(`New analysis session: ${session.id}`, { industry: sanitizedBody.industry });

  try {
    // 执行分析管道
    const result = await orchestrator.execute(sanitizedBody, {
      generateAudio: sanitizedBody.generateAudio !== false,
      skipOptional: sanitizedBody.skipOptional === true,
      parallelAnalysis: sanitizedBody.parallelAnalysis === true,
      onProgress: (step, data) => {
        logger.info(`Pipeline step: ${step}`);
      },
    });

    // 更新会话
    db.update('sessions', session.id, {
      status: result.success ? 'completed' : 'failed',
      results: result.results,
      completedAt: new Date().toISOString(),
      duration: result.duration,
      timeline: result.timeline,
    });

    // 发送通知
    if (result.success) {
      await notifications.notifyAnalysisComplete(
        { id: session.id, industry: sanitizedBody.industry },
        result.results
      );

      // 高风险预警
      const riskScore = result.results.riskAssessment?.assessment?.overallScore;
      if (riskScore >= 60) {
        await notifications.notifyHighRisk(
          { id: session.id },
          result.results.riskAssessment.assessment
        );
      }
    } else {
      await notifications.notifyError(new Error(result.error), { sessionId: session.id });
    }

    sendJSON(res, 200, {
      sessionId: session.id,
      status: result.success ? 'completed' : 'failed',
      results: result.results,
      duration: result.duration,
      agentCount: result.agentCount,
      error: result.error,
    });

  } catch (error) {
    db.update('sessions', session.id, {
      status: 'failed',
      error: error.message,
    });

    await notifications.notifyError(error, { sessionId: session.id });
    sendJSON(res, 500, { error: error.message, sessionId: session.id });
  }
}

// 文件上传
async function handleUpload(res, context) {
  sendJSON(res, 200, {
    message: 'Upload endpoint ready',
    maxSize: '20MB',
    supportedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain'],
  });
}

// 获取行业列表
async function getIndustries(res) {
  try {
    const industries = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'industries.json'), 'utf-8'));
    sendJSON(res, 200, industries);
  } catch {
    sendJSON(res, 200, []);
  }
}

// 获取风险模式
async function getRiskPatterns(res) {
  try {
    const patterns = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'risk-patterns.json'), 'utf-8'));
    sendJSON(res, 200, patterns);
  } catch {
    sendJSON(res, 200, []);
  }
}

// 获取报告
async function getReport(res, context) {
  const session = db.findById('sessions', context.params.id);
  if (!session) {
    sendJSON(res, 404, { error: 'Session not found' });
    return;
  }

  const format = context.query?.format || 'markdown';
  let content;

  if (format === 'html') {
    content = exporter.toHTML(session);
    res.writeHead(200, { 'Content-Type': 'text/html' });
  } else {
    const filePath = exporter.toMarkdown(session);
    content = fs.readFileSync(filePath, 'utf-8');
    res.writeHead(200, { 'Content-Type': 'text/markdown' });
  }

  res.end(content);
}

// 获取音频
async function getAudio(res, context) {
  const session = db.findById('sessions', context.params.id);
  if (!session?.results?.audioReport?.audio) {
    sendJSON(res, 404, { error: 'Audio not found' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'audio/mpeg',
    'Content-Disposition': `attachment; filename="report-${context.params.id}.mp3"`,
  });
  res.end(session.results.audioReport.audio);
}

// ---- 新增路由处理 ----

// 认证 - 登录
async function authLogin(res, context) {
  const { username, password } = context.body || {};
  if (!username) {
    sendJSON(res, 400, { error: 'Username is required' });
    return;
  }

  const result = await auth.login(username, password, {
    ip: context.headers['x-forwarded-for'],
    userAgent: context.headers['user-agent'],
  });

  sendJSON(res, result.success ? 200 : 401, result);
}

// 认证 - 登出
async function authLogout(res, context) {
  const sessionId = context.body?.sessionId;
  if (!sessionId) {
    sendJSON(res, 400, { error: 'Session ID is required' });
    return;
  }

  const result = auth.logout(sessionId);
  sendJSON(res, result.success ? 200 : 404, result);
}

// 认证 - 生成 API Key
async function generateApiKey(res, context) {
  const { name, role, expiresIn, permissions } = context.body || {};
  if (!name) {
    sendJSON(res, 400, { error: 'Name is required' });
    return;
  }

  const result = auth.generateApiKey(name, role, { expiresIn, permissions });
  sendJSON(res, 201, result);
}

// 分析 - 仪表盘
async function getDashboard(res) {
  try {
    const stats = await analytics.getDashboardStats();
    sendJSON(res, 200, stats);
  } catch (error) {
    sendJSON(res, 500, { error: error.message });
  }
}

// 分析 - 单会话分析
async function getSessionAnalytics(res, context) {
  try {
    const result = await analytics.getSessionAnalytics(context.params.id);
    if (!result) {
      sendJSON(res, 404, { error: 'Session not found' });
      return;
    }
    sendJSON(res, 200, result);
  } catch (error) {
    sendJSON(res, 500, { error: error.message });
  }
}

// 分析 - 智能洞察
async function getInsights(res) {
  try {
    const sessions = db.find('sessions');
    const insights = await analytics.generateInsights(sessions);
    sendJSON(res, 200, insights);
  } catch (error) {
    sendJSON(res, 500, { error: error.message });
  }
}

// 历史 - 搜索
async function searchHistory(res, context) {
  const query = context.query?.q || '';
  const options = {
    status: context.query?.status,
    industry: context.query?.industry,
    tag: context.query?.tag,
    sortBy: context.query?.sortBy,
    sortDir: context.query?.sortDir,
    page: parseInt(context.query?.page || '1'),
    pageSize: parseInt(context.query?.pageSize || '20'),
  };

  const result = history.search(query, options);
  sendJSON(res, 200, result);
}

// 历史 - 标签
async function getAllTags(res) {
  const tags = history.getAllTags();
  sendJSON(res, 200, tags);
}

// 历史 - 时间线
async function getTimeline(res, context) {
  const timeline = history.getTimeline(context.params.id);
  if (!timeline) {
    sendJSON(res, 404, { error: 'Session not found' });
    return;
  }
  sendJSON(res, 200, timeline);
}

// 历史 - 统计
async function getHistoryStats(res) {
  const stats = history.getStatistics();
  sendJSON(res, 200, stats);
}

// 历史 - 归档
async function archiveSession(res, context) {
  const result = history.archive(context.params.id);
  sendJSON(res, result.success ? 200 : 400, result);
}

// 通知 - 获取通知
async function getNotifications(res, context) {
  const notifications = notifications.getHistory({
    type: context.query?.type,
    unreadOnly: context.query?.unreadOnly === 'true',
    limit: parseInt(context.query?.limit || '50'),
  });
  sendJSON(res, 200, {
    notifications,
    unreadCount: notifications.filter(n => !n.read).length,
  });
}

// 通知 - 测试
async function testNotification(res, context) {
  const channel = context.body?.channel || 'console';
  const result = await notifications.testChannel(channel);
  sendJSON(res, 200, result);
}

// 限流统计
async function getRateLimitStats(res) {
  const stats = rateLimiter.getStats();
  sendJSON(res, 200, stats);
}

// 条款模板
async function getClauseTemplates(res) {
  try {
    const templates = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'clause-templates.json'), 'utf-8'));
    sendJSON(res, 200, templates);
  } catch {
    sendJSON(res, 200, []);
  }
}

// 谈判话术
async function getNegotiationScripts(res) {
  try {
    const scripts = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'negotiation-scripts.json'), 'utf-8'));
    sendJSON(res, 200, scripts);
  } catch {
    sendJSON(res, 200, {});
  }
}

// Agent 列表
async function getAgents(res) {
  const agents = orchestrator.getRegisteredAgents();
  sendJSON(res, 200, agents);
}

// 执行特定 Agent
async function executeAgent(res, context) {
  const agentName = context.params.name;
  const task = context.body || {};

  try {
    const result = await orchestrator.executeAgent(agentName, task, context.query);
    sendJSON(res, 200, result);
  } catch (error) {
    sendJSON(res, 400, { error: error.message });
  }
}

// JSON 响应工具
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

// 启动服务器
server.listen(PORT, () => {
  logger.info(`🚀 AI Negotiation Coach running on http://localhost:${PORT}`);
  logger.info(`📊 ${orchestrator.getRegisteredAgents().length} agents registered`);
  logger.info(`🛡️ Auth: ${auth.getActiveSessions().length} active sessions`);
  logger.info(`🚫 Rate limit: ${rateLimiter.getStats().algorithm}`);
  logger.info(`📝 Logging: ${logger.getStats().uptime >= 0 ? 'active' : 'inactive'}`);

  if (mimo.demoMode) {
    logger.info('🎭 Running in Demo mode (no API key configured)');
  }
});

// 优雅关闭
process.on('SIGINT', () => {
  logger.info('Shutting down...');
  rateLimiter.destroy();
  logger.destroy();
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down...');
  rateLimiter.destroy();
  logger.destroy();
  server.close(() => process.exit(0));
});

module.exports = { server };
