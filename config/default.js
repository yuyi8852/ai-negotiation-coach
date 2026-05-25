/**
 * Default Configuration - 应用默认配置
 * 所有配置项均可通过环境变量覆盖
 */

const path = require('path');

const config = {
  // 服务器配置
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    },
    timeout: parseInt(process.env.REQUEST_TIMEOUT || '300000', 10), // 5 minutes
    maxBodySize: process.env.MAX_BODY_SIZE || '20mb',
  },

  // API 配置
  api: {
    prefix: process.env.API_PREFIX || '/api',
    version: process.env.API_VERSION || 'v1',
    docs: process.env.API_DOCS === 'true',
  },

  // MiMo 模型配置
  mimo: {
    apiKey: process.env.MIMO_API_KEY || '',
    baseUrl: process.env.MIMO_API_BASE || 'https://token-plan-cn.xiaomimimo.com/v1',
    models: {
      omni: process.env.MIMO_MODEL_OMNI || 'MiMo-V2-Omni',
      pro: process.env.MIMO_MODEL_PRO || 'MiMo-V2-Pro',
      tts: process.env.MIMO_MODEL_TTS || 'MiMo-V2.5-TTS',
      flash: process.env.MIMO_MODEL_FLASH || 'MiMo-V2-Flash',
    },
    defaults: {
      maxTokens: parseInt(process.env.MIMO_MAX_TOKENS || '4096', 10),
      temperature: parseFloat(process.env.MIMO_TEMPERATURE || '0.7'),
      timeout: parseInt(process.env.MIMO_TIMEOUT || '120000', 10),
      retries: parseInt(process.env.MIMO_RETRIES || '3', 10),
      retryDelay: parseInt(process.env.MIMO_RETRY_DELAY || '1000', 10),
    },
  },

  // 数据库配置
  database: {
    dataDir: process.env.DATA_DIR || path.join(__dirname, '..', 'data'),
    cacheEnabled: process.env.DB_CACHE !== 'false',
    cacheTTL: parseInt(process.env.DB_CACHE_TTL || '300000', 10),
  },

  // 认证配置
  auth: {
    enabled: process.env.AUTH_ENABLED === 'true',
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '3600000', 10),
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || '900000', 10),
  },

  // 限流配置
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    algorithm: process.env.RATE_LIMIT_ALGORITHM || 'sliding-window',
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '60', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10),
    burstSize: parseInt(process.env.RATE_LIMIT_BURST || '10', 10),
    whitelist: (process.env.RATE_LIMIT_WHITELIST || '').split(',').filter(Boolean),
  },

  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'INFO',
    format: process.env.LOG_FORMAT || 'pretty',
    enableConsole: process.env.LOG_CONSOLE !== 'false',
    enableFile: process.env.LOG_FILE === 'true',
    logDir: process.env.LOG_DIR || path.join(__dirname, '..', 'logs'),
    maxFileSize: parseInt(process.env.LOG_MAX_SIZE || '10485760', 10),
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '5', 10),
  },

  // 通知配置
  notifications: {
    channels: (process.env.NOTIFY_CHANNELS || 'console').split(','),
    webhookUrls: (process.env.NOTIFY_WEBHOOKS || '').split(',').filter(Boolean),
    enabled: process.env.NOTIFY_ENABLED !== 'false',
  },

  // 导出配置
  export: {
    outputDir: process.env.EXPORT_DIR || path.join(__dirname, '..', 'data', 'exports'),
    formats: ['markdown', 'json', 'html', 'csv'],
    maxFileSize: parseInt(process.env.EXPORT_MAX_SIZE || '10485760', 10),
  },

  // Agent 配置
  agents: {
    maxConcurrent: parseInt(process.env.AGENT_MAX_CONCURRENT || '3', 10),
    defaultTimeout: parseInt(process.env.AGENT_TIMEOUT || '120000', 10),
    pipeline: {
      steps: [
        'documentAnalyst',
        'riskAssessor',
        'strategyAdvisor',
        'counterParty',
        'legalAdvisor',
        'emotionAnalyst',
        'marketIntel',
        'negotiator',
      ],
      optionalSteps: ['legalAdvisor', 'emotionAnalyst', 'marketIntel'],
    },
  },

  // 行业配置
  industries: {
    supported: ['tech', 'manufacturing', 'finance', 'retail', 'construction', 'healthcare', 'education', 'energy', 'automotive', 'real-estate'],
    defaultLanguage: 'zh-CN',
  },

  // 安全配置
  security: {
    maxUploadSize: parseInt(process.env.MAX_UPLOAD_SIZE || '20971520', 10), // 20MB
    allowedMimeTypes: [
      'image/jpeg', 'image/png', 'image/webp',
      'application/pdf', 'text/plain', 'text/csv',
    ],
    sanitizeInput: process.env.SANITIZE_INPUT !== 'false',
    corsOrigins: (process.env.CORS_ORIGINS || '*').split(','),
  },

  // 缓存配置
  cache: {
    enabled: process.env.CACHE_ENABLED !== 'false',
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000', 10),
    defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '300000', 10),
    strategy: process.env.CACHE_STRATEGY || 'lru', // lru | random | fifo
  },

  // Demo 模式配置
  demo: {
    enabled: process.env.DEMO_MODE === 'true' || !process.env.MIMO_API_KEY,
    responses: {
      delay: parseInt(process.env.DEMO_DELAY || '500', 10),
      realisticTokenUsage: true,
    },
  },
};

/**
 * 深度合并配置
 */
function mergeConfig(override) {
  const result = JSON.parse(JSON.stringify(config));
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && result[key]) {
      result[key] = mergeConfig(result[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * 验证配置
 */
function validateConfig(cfg) {
  const issues = [];

  if (!cfg.mimo.apiKey && !cfg.demo.enabled) {
    issues.push('MIMO_API_KEY is required when DEMO_MODE is not enabled');
  }

  if (cfg.auth.enabled && cfg.auth.jwtSecret === 'dev-secret-change-in-production') {
    issues.push('JWT_SECRET should be changed in production');
  }

  if (cfg.server.port < 1 || cfg.server.port > 65535) {
    issues.push('PORT must be between 1 and 65535');
  }

  if (cfg.rateLimit.maxRequests < 1) {
    issues.push('RATE_LIMIT_MAX must be at least 1');
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings: cfg.demo.enabled ? ['Running in Demo mode - no real AI calls'] : [],
  };
}

module.exports = { config, mergeConfig, validateConfig };
