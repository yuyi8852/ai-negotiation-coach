/**
 * Notification Service - 通知服务
 * 支持 Webhook、邮件、控制台等多种通知渠道
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

class NotificationService {
  constructor(config = {}) {
    this.channels = config.channels || ['console'];
    this.webhookUrls = config.webhookUrls || [];
    this.emailConfig = config.email || null;
    this.templates = this._initTemplates();
    this.history = [];
    this.maxHistory = config.maxHistory || 100;

    // 通知队列
    this.queue = [];
    this.processing = false;
  }

  /**
   * 发送通知
   */
  async notify(type, data, options = {}) {
    const notification = {
      id: this._generateId(),
      type,
      data,
      timestamp: new Date().toISOString(),
      channels: options.channels || this.channels,
      priority: options.priority || 'normal',
      read: false,
    };

    // 添加到历史
    this._addToHistory(notification);

    // 处理通知
    for (const channel of notification.channels) {
      try {
        await this._sendToChannel(channel, type, data, notification);
      } catch (err) {
        console.error(\`Notification failed on channel \${channel}:\`, err.message);
      }
    }

    return notification;
  }

  /**
   * 分析完成通知
   */
  async notifyAnalysisComplete(session, results) {
    return this.notify('analysis_complete', {
      sessionId: session.id,
      industry: session.industry,
      riskScore: results.riskAssessment?.assessment?.overallScore,
      riskLevel: results.riskAssessment?.assessment?.overallRiskLevel,
      strategyStyle: results.strategy?.strategy?.strategyStyle,
      message: \`谈判分析已完成 - 风险等级: \${results.riskAssessment?.assessment?.overallRiskLevel || '未知'}\`,
    }, { priority: 'normal' });
  }

  /**
   * 高风险预警通知
   */
  async notifyHighRisk(session, riskAssessment) {
    return this.notify('high_risk_alert', {
      sessionId: session.id,
      score: riskAssessment.overallScore,
      level: riskAssessment.overallRiskLevel,
      criticalRisks: riskAssessment.criticalRisks || [],
      message: \`⚠️ 高风险预警: 风险评分 \${riskAssessment.overallScore}/100\`,
    }, { priority: 'high' });
  }

  /**
   * 系统错误通知
   */
  async notifyError(error, context = {}) {
    return this.notify('error', {
      error: error.message || String(error),
      stack: error.stack,
      context,
      message: \`❌ 系统错误: \${error.message}\`,
    }, { priority: 'critical' });
  }

  /**
   * 限流预警通知
   */
  async notifyRateLimit(clientId, limit) {
    return this.notify('rate_limit', {
      clientId,
      limit,
      message: \`🚫 API 限流触发: 客户端 \${clientId} 达到限制\`,
    }, { priority: 'low' });
  }

  /**
   * 获取通知历史
   */
  getHistory(options = {}) {
    let history = [...this.history];
    if (options.type) history = history.filter(n => n.type === options.type);
    if (options.priority) history = history.filter(n => n.priority === options.priority);
    if (options.unreadOnly) history = history.filter(n => !n.read);
    if (options.since) {
      const since = new Date(options.since).getTime();
      history = history.filter(n => new Date(n.timestamp).getTime() >= since);
    }
    const limit = options.limit || 50;
    return history.slice(-limit);
  }

  /**
   * 标记通知已读
   */
  markAsRead(notificationId) {
    const notification = this.history.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      return { success: true };
    }
    return { success: false, error: 'Notification not found' };
  }

  /**
   * 获取未读数量
   */
  getUnreadCount() {
    return this.history.filter(n => !n.read).length;
  }

  /**
   * 添加 Webhook URL
   */
  addWebhook(url, options = {}) {
    this.webhookUrls.push({
      url,
      events: options.events || ['*'],
      secret: options.secret || null,
      active: true,
      createdAt: new Date().toISOString(),
    });
    return { success: true, count: this.webhookUrls.length };
  }

  /**
   * 移除 Webhook
   */
  removeWebhook(url) {
    const idx = this.webhookUrls.findIndex(w => w.url === url);
    if (idx !== -1) {
      this.webhookUrls.splice(idx, 1);
      return { success: true };
    }
    return { success: false };
  }

  /**
   * 测试通知渠道
   */
  async testChannel(channel) {
    return this.notify('test', {
      message: \`测试通知 - \${channel} 渠道\`,
      timestamp: new Date().toISOString(),
    }, { channels: [channel] });
  }

  // ---- 内部方法 ----

  async _sendToChannel(channel, type, data, notification) {
    switch (channel) {
      case 'console':
        return this._sendConsole(type, data);
      case 'webhook':
        return this._sendWebhooks(type, data, notification);
      case 'log':
        return this._sendLog(type, data);
      default:
        console.warn(\`Unknown notification channel: \${channel}\`);
    }
  }

  _sendConsole(type, data) {
    const emoji = {
      analysis_complete: '✅',
      high_risk_alert: '⚠️',
      error: '❌',
      rate_limit: '🚫',
      test: '🔔',
    }[type] || '📢';

    console.log(\`\${emoji} [Notification] \${data.message || type}\`);
    if (data.criticalRisks?.length > 0) {
      console.log(\`   Critical risks: \${data.criticalRisks.length}\`);
    }
  }

  async _sendWebhooks(type, data, notification) {
    const matchingWebhooks = this.webhookUrls.filter(w =>
      w.active && (w.events.includes('*') || w.events.includes(type))
    );

    const payload = JSON.stringify({
      event: type,
      notification,
      data,
    });

    for (const webhook of matchingWebhooks) {
      try {
        await this._httpPost(webhook.url, payload, webhook.secret);
      } catch (err) {
        console.error(\`Webhook delivery failed: \${webhook.url}\`, err.message);
      }
    }
  }

  _sendLog(type, data) {
    // 日志通知由 Logger 中间件处理
    if (data.message) {
      console.log(\`[LOG-NOTIFICATION] \${type}: \${data.message}\`);
    }
  }

  _httpPost(url, body, secret) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      };
      if (secret) {
        headers['X-Webhook-Secret'] = secret;
      }

      const req = client.request({
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname,
        method: 'POST',
        headers,
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });

      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Webhook timeout'));
      });
      req.write(body);
      req.end();
    });
  }

  _addToHistory(notification) {
    this.history.push(notification);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }
  }

  _generateId() {
    return \`notif_\${Date.now().toString(36)}_\${Math.random().toString(36).slice(2, 6)}\`;
  }

  _initTemplates() {
    return {
      analysis_complete: {
        title: '分析完成',
        icon: '✅',
        color: '#88cc00',
      },
      high_risk_alert: {
        title: '高风险预警',
        icon: '⚠️',
        color: '#ff8800',
      },
      error: {
        title: '系统错误',
        icon: '❌',
        color: '#ff4444',
      },
      rate_limit: {
        title: '限流预警',
        icon: '🚫',
        color: '#ffcc00',
      },
    };
  }
}

module.exports = { NotificationService };
