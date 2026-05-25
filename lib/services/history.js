/**
 * History Service - 谈判历史管理服务
 * 提供会话归档、标签管理、搜索、对比等能力
 */

class HistoryService {
  constructor(db) {
    this.db = db;
  }

  /**
   * 归档已完成的谈判
   */
  archive(sessionId) {
    const session = this.db.findById('sessions', sessionId);
    if (!session) return { success: false, error: 'Session not found' };
    if (session.status !== 'completed') {
      return { success: false, error: 'Only completed sessions can be archived' };
    }

    this.db.update('sessions', sessionId, {
      status: 'archived',
      archivedAt: new Date().toISOString(),
    });

    return { success: true, archivedAt: new Date().toISOString() };
  }

  /**
   * 添加标签
   */
  addTag(sessionId, tag) {
    const session = this.db.findById('sessions', sessionId);
    if (!session) return { success: false, error: 'Session not found' };

    const tags = session.tags || [];
    if (!tags.includes(tag)) {
      tags.push(tag);
    }

    this.db.update('sessions', sessionId, { tags });
    return { success: true, tags };
  }

  /**
   * 移除标签
   */
  removeTag(sessionId, tag) {
    const session = this.db.findById('sessions', sessionId);
    if (!session) return { success: false, error: 'Session not found' };

    const tags = (session.tags || []).filter(t => t !== tag);
    this.db.update('sessions', sessionId, { tags });
    return { success: true, tags };
  }

  /**
   * 获取所有标签
   */
  getAllTags() {
    const sessions = this.db.find('sessions');
    const tagCount = {};
    sessions.forEach(s => {
      (s.tags || []).forEach(tag => {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      });
    });
    return Object.entries(tagCount)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * 添加备注
   */
  addNote(sessionId, note, author = 'system') {
    const session = this.db.findById('sessions', sessionId);
    if (!session) return { success: false, error: 'Session not found' };

    const notes = session.notes || [];
    notes.push({
      id: this._generateId(),
      content: note,
      author,
      createdAt: new Date().toISOString(),
    });

    this.db.update('sessions', sessionId, { notes });
    return { success: true, notes };
  }

  /**
   * 搜索谈判历史
   */
  search(query, options = {}) {
    const allSessions = this.db.find('sessions');
    let results = allSessions;

    // 关键词搜索
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(s => {
        const searchable = JSON.stringify({
          industry: s.industry,
          tags: s.tags,
          documentType: s.results?.documentAnalysis?.analysis?.documentType,
          summary: s.results?.finalReport?.report?.executiveSummary,
        }).toLowerCase();
        return searchable.includes(lowerQuery);
      });
    }

    // 过滤条件
    if (options.status) {
      results = results.filter(s => s.status === options.status);
    }
    if (options.industry) {
      results = results.filter(s => s.industry === options.industry);
    }
    if (options.tag) {
      results = results.filter(s => (s.tags || []).includes(options.tag));
    }
    if (options.dateFrom) {
      results = results.filter(s =>
        new Date(s.createdAt) >= new Date(options.dateFrom)
      );
    }
    if (options.dateTo) {
      results = results.filter(s =>
        new Date(s.createdAt) <= new Date(options.dateTo)
      );
    }
    if (options.minRiskScore !== undefined) {
      results = results.filter(s =>
        (s.results?.riskAssessment?.assessment?.overallScore || 0) >= options.minRiskScore
      );
    }
    if (options.maxRiskScore !== undefined) {
      results = results.filter(s =>
        (s.results?.riskAssessment?.assessment?.overallScore || 0) <= options.maxRiskScore
      );
    }

    // 排序
    const sortBy = options.sortBy || 'createdAt';
    const sortDir = options.sortDir || 'desc';
    results.sort((a, b) => {
      const aVal = sortBy === 'riskScore'
        ? (a.results?.riskAssessment?.assessment?.overallScore || 0)
        : a[sortBy];
      const bVal = sortBy === 'riskScore'
        ? (b.results?.riskAssessment?.assessment?.overallScore || 0)
        : b[sortBy];
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === 'desc' ? -cmp : cmp;
    });

    // 分页
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const total = results.length;
    const paged = results.slice((page - 1) * pageSize, page * pageSize);

    return {
      results: paged.map(s => this._summarizeSession(s)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 获取谈判时间线
   */
  getTimeline(sessionId) {
    const session = this.db.findById('sessions', sessionId);
    if (!session) return null;

    const timeline = [];

    // 创建事件
    timeline.push({
      event: 'created',
      timestamp: session.createdAt,
      description: '谈判分析会话创建',
    });

    // Agent 执行事件
    const results = session.results || {};
    Object.entries(results).forEach(([agent, data]) => {
      if (data?.timestamp) {
        timeline.push({
          event: 'agent_complete',
          agent: data.agent || agent,
          timestamp: data.timestamp,
          description: \`\${data.agent || agent} 完成分析\`,
          tokens: data.usage?.totalTokens,
        });
      }
    });

    // 完成事件
    if (session.completedAt) {
      timeline.push({
        event: 'completed',
        timestamp: session.completedAt,
        description: '谈判分析完成',
      });
    }

    // 归档事件
    if (session.archivedAt) {
      timeline.push({
        event: 'archived',
        timestamp: session.archivedAt,
        description: '会话已归档',
      });
    }

    // 排序
    timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return timeline;
  }

  /**
   * 生成统计摘要
   */
  getStatistics() {
    const sessions = this.db.find('sessions');
    const archived = sessions.filter(s => s.status === 'archived');
    const allTags = this.getAllTags();
    const industries = {};
    sessions.forEach(s => {
      const ind = s.industry || 'unknown';
      industries[ind] = (industries[ind] || 0) + 1;
    });

    return {
      totalSessions: sessions.length,
      archivedSessions: archived.length,
      activeSessions: sessions.filter(s => s.status === 'active').length,
      completedSessions: sessions.filter(s => s.status === 'completed').length,
      totalTags: allTags.length,
      topTags: allTags.slice(0, 10),
      industryBreakdown: industries,
      oldestSession: sessions.length > 0
        ? sessions.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0].createdAt
        : null,
      newestSession: sessions.length > 0
        ? sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0].createdAt
        : null,
    };
  }

  /**
   * 批量操作
   */
  batchArchive(sessionIds) {
    const results = sessionIds.map(id => ({
      id,
      ...this.archive(id),
    }));
    return {
      total: sessionIds.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      details: results,
    };
  }

  /**
   * 批量添加标签
   */
  batchTag(sessionIds, tag) {
    const results = sessionIds.map(id => ({
      id,
      ...this.addTag(id, tag),
    }));
    return {
      total: sessionIds.length,
      success: results.filter(r => r.success).length,
      details: results,
    };
  }

  // ---- 内部方法 ----

  _summarizeSession(session) {
    return {
      id: session.id,
      status: session.status,
      industry: session.industry,
      tags: session.tags || [],
      riskScore: session.results?.riskAssessment?.assessment?.overallScore,
      riskLevel: session.results?.riskAssessment?.assessment?.overallRiskLevel,
      strategyStyle: session.results?.strategy?.strategy?.strategyStyle,
      documentType: session.results?.documentAnalysis?.analysis?.documentType,
      createdAt: session.createdAt,
      completedAt: session.completedAt,
      noteCount: (session.notes || []).length,
    };
  }

  _generateId() {
    return \`note_\${Date.now().toString(36)}_\${Math.random().toString(36).slice(2, 6)}\`;
  }
}

module.exports = { HistoryService };
