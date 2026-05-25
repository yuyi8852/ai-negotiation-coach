/**
 * Orchestrator - 编排器
 * 管理 Agent 注册、Pipeline 编排、消息路由
 */

const { DocumentAnalyst } = require('./agents/document-analyst');
const { RiskAssessor } = require('./agents/risk-assessor');
const { StrategyAdvisor } = require('./agents/strategy-advisor');
const { CounterParty } = require('./agents/counter-party');
const { Negotiator } = require('./agents/negotiator');

class Orchestrator {
  constructor(mimoClient) {
    this.mimo = mimoClient;
    this.agents = {
      documentAnalyst: new DocumentAnalyst(mimoClient),
      riskAssessor: new RiskAssessor(mimoClient),
      strategyAdvisor: new StrategyAdvisor(mimoClient),
      counterParty: new CounterParty(mimoClient),
      negotiator: new Negotiator(mimoClient),
    };
    this.results = {};
    this.timeline = [];
  }

  /**
   * 执行完整的谈判分析流程
   * Pipeline: 文档分析 → 风险评估 → 策略制定 → 对手模拟 → 综合报告 → 语音汇报
   */
  async execute(input, options = {}) {
    this.results = {};
    this.timeline = [];
    const startTime = Date.now();

    try {
      // Step 1: 文档分析
      this._log('start', 'DocumentAnalyst', '开始文档分析...');
      this.results.documentAnalysis = await this.agents.documentAnalyst.process(
        input.document,
        { additionalInfo: input.additionalInfo }
      );
      this._log('complete', 'DocumentAnalyst', '文档分析完成');
      if (options.onProgress) {
        options.onProgress('document_analysis', this.results.documentAnalysis);
      }

      // Step 2: 风险评估
      this._log('start', 'RiskAssessor', '开始风险评估...');
      this.results.riskAssessment = await this.agents.riskAssessor.process(
        { documentAnalysis: this.results.documentAnalysis.analysis },
        {
          industry: input.industry,
          companyInfo: input.companyInfo,
        }
      );
      this._log('complete', 'RiskAssessor', '风险评估完成');
      if (options.onProgress) {
        options.onProgress('risk_assessment', this.results.riskAssessment);
      }

      // Step 3: 策略制定
      this._log('start', 'StrategyAdvisor', '开始策略制定...');
      this.results.strategy = await this.agents.strategyAdvisor.process(
        {
          documentAnalysis: this.results.documentAnalysis.analysis,
          riskAssessment: this.results.riskAssessment.assessment,
        },
        {
          myPosition: input.myPosition,
          constraints: input.constraints,
          goals: input.goals,
          industry: input.industry,
        }
      );
      this._log('complete', 'StrategyAdvisor', '策略制定完成');
      if (options.onProgress) {
        options.onProgress('strategy', this.results.strategy);
      }

      // Step 4: 对手模拟
      this._log('start', 'CounterParty', '开始对手模拟...');
      this.results.counterParty = await this.agents.counterParty.process(
        {
          documentAnalysis: this.results.documentAnalysis.analysis,
          myStrategy: this.results.strategy.strategy,
        },
        {
          opponentInfo: input.opponentInfo,
          marketContext: input.marketContext,
        }
      );
      this._log('complete', 'CounterParty', '对手模拟完成');
      if (options.onProgress) {
        options.onProgress('counter_party', this.results.counterParty);
      }

      // Step 5: 综合报告
      this._log('start', 'Negotiator', '生成综合报告...');
      this.results.finalReport = await this.agents.negotiator.process(
        {
          documentAnalysis: this.results.documentAnalysis.analysis,
          riskAssessment: this.results.riskAssessment.assessment,
          strategy: this.results.strategy.strategy,
          counterParty: this.results.counterParty.simulation,
        },
        { additionalContext: input.additionalContext }
      );
      this._log('complete', 'Negotiator', '综合报告生成完成');
      if (options.onProgress) {
        options.onProgress('final_report', this.results.finalReport);
      }

      // Step 6: 语音汇报（可选）
      if (options.generateAudio !== false) {
        this._log('start', 'TTS', '生成语音汇报...');
        const audioScript = this.results.finalReport.report?.audioScript || '';
        if (audioScript) {
          this.results.audio = await this.agents.negotiator.generateAudio(audioScript);
          this._log('complete', 'TTS', '语音汇报生成完成');
        } else {
          this._log('skip', 'TTS', '无语音稿，跳过');
        }
      }

      const duration = Date.now() - startTime;
      const stats = this.mimo.getStats();

      return {
        success: true,
        results: this.results,
        timeline: this.timeline,
        stats: {
          duration,
          totalTokens: stats.totalTokens,
          totalCalls: stats.totalCalls,
          byModel: stats.byModel,
        },
      };
    } catch (error) {
      this._log('error', 'Orchestrator', error.message);
      return {
        success: false,
        error: error.message,
        partialResults: this.results,
        timeline: this.timeline,
      };
    }
  }

  _log(status, agent, message) {
    this.timeline.push({
      timestamp: new Date().toISOString(),
      status,
      agent,
      message,
    });
  }

  /**
   * 获取单个 Agent 的分析结果
   */
  getResult(agentName) {
    return this.results[agentName] || null;
  }

  /**
   * 获取所有 Agent 的统计信息
   */
  getStats() {
    const agentStats = {};
    for (const [name, agent] of Object.entries(this.agents)) {
      agentStats[name] = {
        name: agent.name,
        role: agent.role,
      };
    }
    return {
      agents: agentStats,
      mimo: this.mimo.getStats(),
      timeline: this.timeline,
    };
  }
}

module.exports = { Orchestrator };
