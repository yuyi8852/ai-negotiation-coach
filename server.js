/**
 * AI Negotiation Coach - 主服务器
 * 零依赖 Web 服务（使用 Node.js 内置模块）
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { MiMoClient } = require('./lib/mimo-client');
const { Orchestrator } = require('./lib/orchestrator');
const { JsonDB } = require('./lib/db');
const { Exporter } = require('./lib/export');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const STATIC_DIR = path.join(__dirname, 'static');

// 初始化
const mimo = new MiMoClient();
const orchestrator = new Orchestrator(mimo);
const db = new JsonDB(DATA_DIR);
const exporter = new Exporter(path.join(DATA_DIR, 'exports'));

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
};

// 主服务器
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const method = req.method;
  const pathname = url.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  try {
    // 静态文件
    if (pathname.startsWith('/static/')) {
      return serveStatic(res, pathname);
    }

    // API 路由
    const routeKey = `${method} ${pathname}`;
    if (routes[routeKey]) {
      const params = {};
      const match = pathname.match(/:(\w+)/g);
      if (match) {
        match.forEach(m => {
          const key = m.slice(1);
          params[key] = pathname.split('/').find((s, i) =>
            pathname.split('/').slice(0, i + 1).join('/') === pathname.replace(/:[^/]+/, s)
          );
        });
      }
      return await routes[routeKey](req, res, url, params);
    }

    // 动态路由匹配
    for (const [route, handler] of Object.entries(routes)) {
      const [routeMethod, routePath] = route.split(' ');
      if (routeMethod !== method) continue;

      const routeParts = routePath.split('/');
      const urlParts = pathname.split('/');
      if (routeParts.length !== urlParts.length) continue;

      const params = {};
      let match = true;
      for (let i = 0; i < routeParts.length; i++) {
        if (routeParts[i].startsWith(':')) {
          params[routeParts[i].slice(1)] = urlParts[i];
        } else if (routeParts[i] !== urlParts[i]) {
          match = false;
          break;
        }
      }

      if (match) {
        return await handler(req, res, url, params);
      }
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (err) {
    console.error('Server error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

// === 路由处理器 ===

async function serveIndex(req, res) {
  const filePath = path.join(STATIC_DIR, 'index.html');
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    return res.end('Dashboard not found');
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(fs.readFileSync(filePath));
}

function serveStatic(res, pathname) {
  const filePath = path.join(__dirname, pathname);
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    return res.end('Not found');
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
  res.end(fs.readFileSync(filePath));
}

async function getStats(req, res) {
  const stats = mimo.getStats();
  const sessionCount = db.count('sessions');
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    ...stats,
    sessions: sessionCount,
    demoMode: mimo.demoMode,
    uptime: process.uptime(),
  }));
}

async function listSessions(req, res) {
  const sessions = db.recent('sessions', 20);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(sessions));
}

async function getSession(req, res, url, params) {
  const session = db.findById('sessions', params.id);
  if (!session) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Session not found' }));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(session));
}

async function startAnalysis(req, res) {
  const body = await readBody(req);
  const input = JSON.parse(body);

  // 保存会话
  const session = db.insert('sessions', {
    status: 'running',
    input,
    results: null,
    stats: null,
  });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ sessionId: session.id, status: 'started' }));

  // 异步执行分析
  try {
    const result = await orchestrator.execute(input, {
      generateAudio: true,
    });

    // 导出报告
    const exports = exporter.exportAll({ id: session.id, results: result.results });

    // 更新会话
    db.update('sessions', session.id, {
      status: 'completed',
      results: result.results,
      stats: result.stats,
      timeline: result.timeline,
      exports,
    });
  } catch (err) {
    db.update('sessions', session.id, {
      status: 'failed',
      error: err.message,
    });
  }
}

async function handleUpload(req, res) {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Expected multipart/form-data' }));
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);

  // 简单解析 multipart
  const boundary = contentType.split('boundary=')[1];
  const parts = parseMultipart(buffer, boundary);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true, parts: parts.length }));
}

async function getIndustries(req, res) {
  const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'industries.json'), 'utf-8'));
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function getRiskPatterns(req, res) {
  const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'risk-patterns.json'), 'utf-8'));
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function getReport(req, res, url, params) {
  const filePath = path.join(DATA_DIR, 'exports', `report-${params.id}.md`);
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Report not found');
  }
  res.writeHead(200, { 'Content-Type': 'text/markdown' });
  res.end(fs.readFileSync(filePath));
}

async function getAudio(req, res, url, params) {
  const session = db.findById('sessions', params.id);
  if (!session?.results?.audio?.audio) {
    res.writeHead(404);
    return res.end('Audio not found');
  }
  res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
  res.end(session.results.audio.audio);
}

// === 工具函数 ===

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

function parseMultipart(buffer, boundary) {
  const parts = [];
  const split = buffer.split(Buffer.from(`--${boundary}`));
  for (let i = 1; i < split.length - 1; i++) {
    const part = split[i];
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const headers = part.slice(0, headerEnd).toString();
    const body = part.slice(headerEnd + 4, part.length - 2);
    const nameMatch = headers.match(/name="([^"]+)"/);
    const filenameMatch = headers.match(/filename="([^"]+)"/);
    parts.push({
      name: nameMatch?.[1] || '',
      filename: filenameMatch?.[1] || '',
      data: body,
    });
  }
  return parts;
}

// 启动服务器
server.listen(PORT, () => {
  console.log(`\n🎯 AI Negotiation Coach running at http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/`);
  console.log(`🔌 API: http://localhost:${PORT}/api/stats`);
  console.log(`📦 Demo Mode: ${mimo.demoMode ? 'YES (no API key)' : 'NO (using real API)'}\n`);
});
