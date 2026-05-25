/**
 * Analytics Service - 数据分析和洞察服务
 * 提供谈判数据的统计分析、趋势追踪和智能洞察
 */

const { Formatters } = require('../utils/formatters');
const { Cache } = require('../utils/cache');

class AnalyticsService {
  constructor(db) {
    this.db = db;
    this.cache = new Cache({ maxSize: 100, defaultTTL: 300000 });
  }

  /**
   * 获取仪表盘统计数据
   */
  async getDashboardStats() {
    const cacheKey = 'dashboard:stats';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const sessions = this.db.find('sessions');
    const stats = {
      totalSessions: sessions.length,
      completedSessions: sessions.filter(s => s.status === 'completed').length,
      activeSessions: sessions.filter(s => s.status === 'active').length,
      failedSessions: sessions.filter(s => s.status === 'failed').length,
      avgAnalysisTime: this._calculateAvgTime(sessions),
      tokenUsage: this._calculateTotalTokens(sessions),
      industryBreakdown: this._getIndustryBreakdown(sessions),
      riskDistribution: this._getRiskDistribution(sessions),
      recentActivity: this._getRecentActivity(sessions, 10),
      monthlyTrend: this._getMonthlyTrend(sessions),
      agentPerformance: this._getAgentPerformance(sessions),
      documentTypeDistribution: this._getDocTypeDistribution(sessions),
    };

    this.cache.set(cacheKey, stats, 120000); // 2 minutes
    return stats;
  }

  /**
   * 获取单次会话的详细分析
   */
  async getSessionAnalytics(sessionId) {
    const session = this.db.findById('sessions', sessionId);
    if (!session) return null;

    const results = session.results || {};
    return {
      sessionId,
      overview: {
        status: session.status,
        createdAt: session.createdAt,
        completedAt: session.completedAt,
        duration: session.completedAt
          ? new Date(session.completedAt) - new Date(session.createdAt)
          : null,
      },
      tokenUsage: this._extractSessionTokens(results),
      agentTimeline: this._buildAgentTimeline(results),
      riskSummary: this._summarizeRisk(results.riskAssessment),
      strategyScore: this._scoreStrategy(results.strategy),
      keyMetrics: this._extractKeyMetrics(session),
    };
  }

  /**
   * 比较多次谈判的结果
   */
  compareSessions(sessionIds) {
    const sessions = sessionIds.map(id => this.db.findById('sessions', id)).filter(Boolean);
    if (sessions.length < 2) return { error: 'Need at least 2 sessions to compare' };

    return {
      sessions: sessions.map(s => ({
        id: s.id,
        status: s.status,
        industry: s.industry,
        riskScore: s.results?.riskAssessment?.assessment?.overallScore,
        strategyStyle: s.results?.strategy?.strategy?.strategyStyle,
        createdAt: s.createdAt,
      })),
      comparison: {
        riskTrend: this._compareRiskScores(sessions),
        tokenEfficiency: this._compareTokenUsage(sessions),
        timeEfficiency: this._compareDuration(sessions),
      },
    };
  }

  /**
   * 生成周报
   */
  generateWeeklyReport() {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const sessions = this.db.find('sessions').filter(s =>
      new Date(s.createdAt).getTime() >= oneWeekAgo
    );

    return {
      period: {
        from: new Date(oneWeekAgo).toISOString(),
        to: new Date().toISOString(),
      },
      summary: {
        totalSessions: sessions.length,
        completed: sessions.filter(s => s.status === 'completed').length,
        avgRiskScore: this._calculateAvgRiskScore(sessions),
        totalTokens: sessions.reduce((sum, s) =>
          sum + this._extractSessionTokens(s.results || {}).total, 0),
      },
      highlights: this._getHighlights(sessions),
      recommendations: this._getRecommendations(sessions),
    };
  }

  /**
   * 智能洞察生成
   */
  async generateInsights(sessions) {
    if (!sessions || sessions.length === 0) {
      return { insights: [], confidence: 0 };
    }

    const patterns = this._detectPatterns(sessions);
    const anomalies = this._detectAnomalies(sessions);
    const trends = this._detectTrends(sessions);

    return {
      patterns,
      anomalies,
      trends,
      insights: [
        ...patterns.map(p => ({ type: 'pattern', ...p })),
        ...anomalies.map(a => ({ type: 'anomaly', ...a })),
        ...trends.map(t => ({ type: 'trend', ...t })),
      ],
      confidence: this._calculateConfidence(sessions.length),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * 导出数据为分析友好的格式
   */
  exportForAnalysis(format = 'json') {
    const sessions = this.db.find('sessions');
    const data = sessions.map(s => ({
      id: s.id,
      status: s.status,
      industry: s.industry || 'unknown',
      riskScore: s.results?.riskAssessment?.assessment?.overallScore || 0,
      strategyStyle: s.results?.strategy?.strategy?.strategyStyle || 'unknown',
      tokenUsage: this._extractSessionTokens(s.results || {}).total,
      duration: s.completedAt
        ? new Date(s.completedAt) - new Date(s.createdAt)
        : 0,
      createdAt: s.createdAt,
      documentType: s.results?.documentAnalysis?.analysis?.documentType || 'unknown',
    }));

    if (format === 'csv') {
      const headers = ['id', 'status', 'industry', 'riskScore', 'strategyStyle', 'tokenUsage', 'duration', 'createdAt', 'documentType'];
      const rows = data.map(d => headers.map(h => d[h]));
      return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    return data;
  }

  // ---- 内部分析方法 ----

  _calculateAvgTime(sessions) {
    const completed = sessions.filter(s => s.completedAt && s.createdAt);
    if (completed.length === 0) return 0;
    const total = completed.reduce((sum, s) =>
      sum + (new Date(s.completedAt) - new Date(s.createdAt)), 0);
    return Math.round(total / completed.length);
  }

  _calculateTotalTokens(sessions) {
    return sessions.reduce((sum, s) => {
      const tokens = this._extractSessionTokens(s.results || {});
      return sum + tokens.total;
    }, 0);
  }

  _extractSessionTokens(results) {
    let total = 0;
    let byAgent = {};

    Object.values(results).forEach(step => {
      if (step?.usage) {
        const t = step.usage.totalTokens || 0;
        total += t;
        const agent = step.agent || 'unknown';
        byAgent[agent] = (byAgent[agent] || 0) + t;
      }
    });

    return { total, byAgent };
  }

  _getIndustryBreakdown(sessions) {
    const breakdown = {};
    sessions.forEach(s => {
      const industry = s.industry || 'unknown';
      breakdown[industry] = (breakdown[industry] || 0) + 1;
    });
    return breakdown;
  }

  _getRiskDistribution(sessions) {
    const dist = { low: 0, medium: 0, high: 0, critical: 0, unknown: 0 };
    sessions.forEach(s => {
      const score = s.results?.riskAssessment?.assessment?.overallScore;
      if (score === undefined || score === null) { dist.unknown++; return; }
      if (score >= 80) dist.critical++;
      else if (score >= 60) dist.high++;
      else if (score >= 40) dist.medium++;
      else dist.low++;
    });
    return dist;
  }

  _getRecentActivity(sessions, limit) {
    return sessions
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit)
      .map(s => ({
        id: s.id,
        status: s.status,
        industry: s.industry,
        createdAt: s.createdAt,
        riskScore: s.results?.riskAssessment?.assessment?.overallScore,
      }));
  }

  _getMonthlyTrend(sessions) {
    const monthly = {};
    sessions.forEach(s => {
      const month = s.createdAt?.slice(0, 7) || 'unknown';
      if (!monthly[month]) monthly[month] = { count: 0, totalRisk: 0 };
      monthly[month].count++;
      const score = s.results?.riskAssessment?.assessment?.overallScore;
      if (score) monthly[month].totalRisk += score;
    });
    return Object.entries(monthly).map(([month, data]) => ({
      month,
      sessions: data.count,
      avgRisk: data.count > 0 ? Math.round(data.totalRisk / data.count) : 0,
    }));
  }

  _getAgentPerformance(sessions) {
    const perf = {};
    sessions.forEach(s => {
      Object.entries(s.results || {}).forEach(([key, value]) => {
        if (value?.usage) {
          if (!perf[key]) perf[key] = { calls: 0, totalTokens: 0, avgTokens: 0 };
          perf[key].calls++;
          perf[key].totalTokens += value.usage.totalTokens || 0;
        }
      });
    });
    Object.keys(perf).forEach(k => {
      perf[k].avgTokens = Math.round(perf[k].totalTokens / perf[k].calls);
    });
    return perf;
  }

  _getDocTypeDistribution(sessions) {
    const dist = {};
    sessions.forEach(s => {
      const type = s.results?.documentAnalysis?.analysis?.documentType || 'unknown';
      dist[type] = (dist[type] || 0) + 1;
    });
    return dist;
  }

  _calculateAvgRiskScore(sessions) {
    const scores = sessions
      .map(s => s.results?.riskAssessment?.assessment?.overallScore)
      .filter(s => s !== undefined && s !== null);
    return scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
  }

  _buildAgentTimeline(results) {
    return Object.entries(results)
      .filter(([, v]) => v?.timestamp)
      .map(([agent, data]) => ({
        agent,
        timestamp: data.timestamp,
        duration: data.duration,
        tokens: data.usage?.totalTokens || 0,
      }))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  _summarizeRisk(riskData) {
    if (!riskData?.assessment) return null;
    const a = riskData.assessment;
    return {
      overallScore: a.overallScore,
      overallLevel: a.overallRiskLevel,
      dimensions: (a.dimensions || []).map(d => ({
        name: d.name,
        score: d.score,
        level: d.level,
      })),
      criticalRisks: (a.criticalRisks || []).length,
    };
  }

  _scoreStrategy(strategyData) {
    if (!strategyData?.strategy) return null;
    const s = strategyData.strategy;
    return {
      style: s.strategyStyle,
      phasesCount: (s.phases || []).length,
      hasBATNA: !!s.batna,
      hasZOPA: !!s.zopa,
      winWinOpportunities: (s.winWinOpportunities || []).length,
    };
  }

  _extractKeyMetrics(session) {
    return {
      industry: session.industry,
      documentType: session.results?.documentAnalysis?.analysis?.documentType,
      riskLevel: session.results?.riskAssessment?.assessment?.overallRiskLevel,
      riskScore: session.results?.riskAssessment?.assessment?.overallScore,
      strategyStyle: session.results?.strategy?.strategy?.strategyStyle,
      hasAudioReport: !!session.results?.audioReport,
    };
  }

  _compareRiskScores(sessions) {
    return sessions.map(s => ({
      id: s.id,
      score: s.results?.riskAssessment?.assessment?.overallScore || 0,
    }));
  }

  _compareTokenUsage(sessions) {
    return sessions.map(s => ({
      id: s.id,
      tokens: this._extractSessionTokens(s.results || {}).total,
    }));
  }

  _compareDuration(sessions) {
    return sessions.map(s => ({
      id: s.id,
      duration: s.completedAt && s.createdAt
        ? new Date(s.completedAt) - new Date(s.createdAt)
        : 0,
    }));
  }

  _getHighlights(sessions) {
    const highlights = [];
    if (sessions.length > 0) {
      highlights.push(\`本周完成 \${sessions.length} 次谈判分析\`);
    }
    const highRisk = sessions.filter(s =>
      (s.results?.riskAssessment?.assessment?.overallScore || 0) >= 60);
    if (highRisk.length > 0) {
      highlights.push(\`发现 \${highRisk.length} 个高风险合同\`);
    }
    return highlights;
  }

  _getRecommendations(sessions) {
    const recs = [];
    const avgRisk = this._calculateAvgRiskScore(sessions);
    if (avgRisk > 50) {
      recs.push('近期合同整体风险偏高，建议加强法律审查');
    }
    if (sessions.length === 0) {
      recs.push('本周暂无谈判分析记录');
    }
    return recs;
  }

  _detectPatterns(sessions) {
    const patterns = [];
    const industryGroups = this._getIndustryBreakdown(sessions);
    const topIndustry = Object.entries(industryGroups).sort((a, b) => b[1] - a[1])[0];
    if (topIndustry && topIndustry[1] > 2) {
      patterns.push({
        description: \`最常分析的行业: \${topIndustry[0]}（\${topIndustry[1]} 次）\`,
        significance: 'medium',
      });
    }
    return patterns;
  }

  _detectAnomalies(sessions) {
    const anomalies = [];
    sessions.forEach(s => {
      const score = s.results?.riskAssessment?.assessment?.overallScore;
      if (score >= 90) {
        anomalies.push({
          description: \`会话 \${s.id} 风险评分异常高: \${score}\`,
          severity: 'high',
        });
      }
    });
    return anomalies;
  }

  _detectTrends(sessions) {
    const monthly = this._getMonthlyTrend(sessions);
    if (monthly.length < 2) return [];
    const trends = [];
    const latest = monthly[monthly.length - 1];
    const previous = monthly[monthly.length - 2];
    if (latest.avgRisk > previous.avgRisk + 10) {
      trends.push({
        description: '风险评分呈上升趋势',
        direction: 'up',
        magnitude: latest.avgRisk - previous.avgRisk,
      });
    }
    return trends;
  }

  _calculateConfidence(sampleSize) {
    if (sampleSize >= 100) return 0.95;
    if (sampleSize >= 30) return 0.85;
    if (sampleSize >= 10) return 0.7;
    if (sampleSize >= 5) return 0.5;
    return 0.3;
  }
}

module.exports = { AnalyticsService };
