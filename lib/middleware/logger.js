/**
 * Logger Middleware - 结构化日志记录
 * 支持多种日志级别、格式化输出、日志轮转
 */

const fs = require('fs');
const path = require('path');

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4,
};

const LOG_COLORS = {
  DEBUG: '\x1b[36m',  // cyan
  INFO: '\x1b[32m',   // green
  WARN: '\x1b[33m',   // yellow
  ERROR: '\x1b[31m',  // red
  FATAL: '\x1b[35m',  // magenta
  RESET: '\x1b[0m',
};

class Logger {
  constructor(config = {}) {
    this.level = config.level || 'INFO';
    this.format = config.format || 'json'; // json | text | pretty
    this.logDir = config.logDir || path.join(process.cwd(), 'logs');
    this.maxFileSize = config.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = config.maxFiles || 5;
    this.enableConsole = config.enableConsole !== false;
    this.enableFile = config.enableFile || false;
    this.enableColors = config.enableColors !== false;

    // 请求追踪
    this.requestCount = 0;
    this.errorCount = 0;
    this.startTime = Date.now();

    // 日志缓冲（批量写入）
    this.buffer = [];
    this.bufferSize = config.bufferSize || 50;
    this.flushInterval = config.flushInterval || 5000;

    if (this.enableFile) {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
      this._startFlushTimer();
    }
  }

  /**
   * HTTP 请求日志中间件
   */
  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      const requestId = this._generateRequestId();
      req.requestId = requestId;

      // 拦截响应完成事件
      const originalEnd = res.end;
      res.end = (...args) => {
        const duration = Date.now() - startTime;
        this.requestCount++;

        const logEntry = {
          timestamp: new Date().toISOString(),
          level: res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO',
          type: 'request',
          requestId,
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
          userAgent: req.headers['user-agent'],
          contentLength: res.getHeader('content-length'),
        };

        if (res.statusCode >= 500) {
          this.errorCount++;
        }

        this._log(logEntry);
        originalEnd.apply(res, args);
      };

      next();
    };
  }

  /**
   * 日志记录方法
   */
  debug(message, meta = {}) {
    this._write('DEBUG', message, meta);
  }

  info(message, meta = {}) {
    this._write('INFO', message, meta);
  }

  warn(message, meta = {}) {
    this._write('WARN', message, meta);
  }

  error(message, meta = {}) {
    this._write('ERROR', message, meta);
    this.errorCount++;
  }

  fatal(message, meta = {}) {
    this._write('FATAL', message, meta);
    this.errorCount++;
  }

  /**
   * 记录 AI 调用
   */
  logAICall(model, operation, duration, usage, success = true) {
    this._write('INFO', `AI call: ${operation}`, {
      type: 'ai_call',
      model,
      operation,
      duration,
      tokens: usage?.totalTokens || 0,
      success,
    });
  }

  /**
   * 记录 Agent 执行
   */
  logAgentExecution(agentName, action, duration, result) {
    this._write('INFO', `Agent: ${agentName}.${action}`, {
      type: 'agent_execution',
      agent: agentName,
      action,
      duration,
      success: result !== null,
    });
  }

  /**
   * 记录管道执行
   */
  logPipeline(sessionId, steps, totalDuration, success) {
    this._write('INFO', `Pipeline completed: ${steps.length} steps`, {
      type: 'pipeline',
      sessionId,
      steps: steps.map(s => s.name),
      totalDuration,
      success,
    });
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const uptime = Date.now() - this.startTime;
    return {
      uptime,
      totalRequests: this.requestCount,
      errorCount: this.errorCount,
      errorRate: this.requestCount > 0
        ? ((this.errorCount / this.requestCount) * 100).toFixed(2) + '%'
        : '0%',
      requestsPerMinute: this.requestCount > 0
        ? Math.round(this.requestCount / (uptime / 60000))
        : 0,
      bufferSize: this.buffer.length,
    };
  }

  /**
   * 搜索日志
   */
  searchLogs(query, options = {}) {
    if (!this.enableFile) return [];

    const logFile = this._getCurrentLogFile();
    if (!fs.existsSync(logFile)) return [];

    const content = fs.readFileSync(logFile, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    let results = lines
      .map(line => {
        try { return JSON.parse(line); }
        catch { return null; }
      })
      .filter(entry => entry !== null);

    // 过滤
    if (query) {
      results = results.filter(entry =>
        JSON.stringify(entry).toLowerCase().includes(query.toLowerCase())
      );
    }
    if (options.level) {
      results = results.filter(entry => entry.level === options.level);
    }
    if (options.since) {
      results = results.filter(entry =>
        new Date(entry.timestamp).getTime() >= options.since
      );
    }
    if (options.type) {
      results = results.filter(entry => entry.type === options.type);
    }

    const limit = options.limit || 100;
    return results.slice(-limit);
  }

  // ---- 内部方法 ----

  _write(level, message, meta = {}) {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.level]) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      pid: process.pid,
      ...meta,
    };

    this._log(entry);
  }

  _log(entry) {
    if (this.enableConsole) {
      this._consoleOutput(entry);
    }

    if (this.enableFile) {
      this.buffer.push(entry);
      if (this.buffer.length >= this.bufferSize) {
        this._flush();
      }
    }
  }

  _consoleOutput(entry) {
    const color = this.enableColors ? (LOG_COLORS[entry.level] || '') : '';
    const reset = this.enableColors ? LOG_COLORS.RESET : '';

    if (this.format === 'json') {
      console.log(`${color}${JSON.stringify(entry)}${reset}`);
    } else if (this.format === 'pretty') {
      const time = entry.timestamp.split('T')[1]?.slice(0, 12) || '';
      console.log(`${color}[${time}] ${entry.level.padEnd(5)}${reset} ${entry.message}`);
    } else {
      console.log(`${color}${entry.level}: ${entry.message}${reset}`);
    }
  }

  _flush() {
    if (this.buffer.length === 0) return;

    const logFile = this._getCurrentLogFile();
    const content = this.buffer.map(e => JSON.stringify(e)).join('\n') + '\n';
    this.buffer = [];

    try {
      fs.appendFileSync(logFile, content);
      this._rotateIfNeeded(logFile);
    } catch (err) {
      console.error('Failed to write log file:', err.message);
    }
  }

  _getCurrentLogFile() {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, \`app-\${date}.log\`);
  }

  _rotateIfNeeded(logFile) {
    if (!fs.existsSync(logFile)) return;
    const stat = fs.statSync(logFile);
    if (stat.size <= this.maxFileSize) return;

    const timestamp = Date.now();
    const rotatedFile = logFile.replace('.log', \`.\${timestamp}.log\`);
    fs.renameSync(logFile, rotatedFile);

    // 清理旧日志文件
    const files = fs.readdirSync(this.logDir)
      .filter(f => f.endsWith('.log'))
      .sort()
      .reverse();

    while (files.length > this.maxFiles) {
      const oldFile = files.pop();
      fs.unlinkSync(path.join(this.logDir, oldFile));
    }
  }

  _startFlushTimer() {
    this._flushTimer = setInterval(() => this._flush(), this.flushInterval);
  }

  _generateRequestId() {
    return \`req_\${Date.now().toString(36)}_\${Math.random().toString(36).slice(2, 8)}\`;
  }

  destroy() {
    if (this._flushTimer) {
      clearInterval(this._flushTimer);
    }
    this._flush();
  }
}

module.exports = { Logger, LOG_LEVELS };
