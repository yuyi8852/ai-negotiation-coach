/**
 * Orchestrator - 编排器
 * 管理 Agent 注册、Pipeline 编排、消息路由
 * 支持 8 个 Agent 的完整谈判分析流水线
 */

const { DocumentAnalyst } = require('./agents/document-analyst');
const { RiskAssessor } = require('./agents/risk-assessor');
const { StrategyAdvisor } = require('./agents/strategy-advisor');
const { CounterParty } = require('./agents/counter-party');
const { Negotiator } = require('./agents/negotiator');
const { LegalAdvisor } = require('./agents/legal-advisor');
const { EmotionAnalyst } = require('./agents/emotion-analyst');
const { MarketIntel } = require('./agents/market-intel');

class Orchestrator {
  constructor(mimoClient) {
    this.mimo = mimoClient;
    this.agents = {
      documentAnalyst: new DocumentAnalyst(mimoClient),
      riskAssessor: new RiskAssessor(mimoClient),
      strategyAdvisor: new StrategyAdvisor(mimoClient),
      counterParty: new CounterParty(mimoClient),
      negotiator: new Negotiator(mimoClient),
      legalAdvisor: new LegalAdvisor(mimoClient),
      emotionAnalyst: new EmotionAnalyst(mimoClient),
      marketIntel: new MarketIntel(mimoClient),
    };
    this.results = {};
    this.timeline = [];
    this.pipelineLog = [];
  }

  /**
   * 执行完整的谈判分析流程
   * Pipeline: 文档分析 → 风险评估 → 策略制定 → 对手模拟 → 法律审查 → 情绪分析 → 市场情报 → 综合报告 → 语音汇报
   */
  async execute(input, options = {}) {
    this.results = {};
    this.timeline = [];
    this.pipelineLog = [];
    const startTime = Date.now();

    const pipelineConfig = {
      steps: [
        { key: 'documentAnalysis', agent: 'documentAnalyst', method: 'process', optional: false },
        { key: 'riskAssessment', agent: 'riskAssessor', method: 'process', optional: false },
        { key: 'strategy', agent: 'strategyAdvisor', method: 'process', optional: false },
        { key: 'counterParty', agent: 'counterParty', method: 'process', optional: false },
        { key: 'legalReview', agent: 'legalAdvisor', method: 'process', optional: true },
        { key: 'emotionAnalysis', agent: 'emotionAnalyst', method: 'process', optional: true },
        { key: 'marketIntel', agent: 'marketIntel', method: 'process', optional: true },
        { key: 'finalReport', agent: 'negotiator', method: 'process', optional: false },
      ],
      skipOptional: options.skipOptional === true,
      parallelPhase: options.parallelAnalysis || false,
    };

    try {
      // Phase 1: 文档分析（必须先执行）
      await this._runStep(pipelineConfig.steps[0], input, options);

      // Phase 2: 核心分析（风险评估 + 策略制定 + 对手模拟）
      for (let i = 1; i <= 3; i++) {
        await this._runStep(pipelineConfig.steps[i], input, options);
      }

      // Phase 3: 扩展分析（法律审查 + 情绪分析 + 市场情报）
      // 可并行执行以提高效率
      if (pipelineConfig.parallelPhase) {
        await this._runStepsParallel(
          pipelineConfig.steps.slice(4, 7),
          input,
          options
        );
      } else {
        for (let i = 4; i <= 6; i++) {
          await this._runStep(pipelineConfig.steps[i], input, options);
        }
      }

      // Phase 4: 综合报告
      await this._runStep(pipelineConfig.steps[7], input, options);

      // Phase 5: 语音汇报（可选）
      if (options.generateAudio !== false) {
        const audioScript = this.results.finalReport?.report?.audioScript;
        if (audioScript) {
          this._log('start', 'Negotiator', '生成语音汇报...');
          this.results.audioReport = await this.agents.negotiator.generateAudio(audioScript);
          this._log('complete', 'Negotiator', '语音汇报生成完成');
        }
      }

      const totalDuration = Date.now() - startTime;
      this._logPipelineComplete(totalDuration);

      return {
        success: true,
        results: this.results,
        timeline: this.timeline,
        pipelineLog: this.pipelineLog,
        duration: totalDuration,
        agentCount: Object.keys(this.agents).length,
      };
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      this._log('error', 'Orchestrator', `Pipeline error: ${error.message}`);

      return {
        success: false,
        error: error.message,
        results: this.results,
        timeline: this.timeline,
        pipelineLog: this.pipelineLog,
        duration: totalDuration,
        partialResults: Object.keys(this.results),
      };
    }
  }

  /**
   * 执行特定 Agent 分析
   */
  async executeAgent(agentName, task, context = {}) {
    const agent = this.agents[agentName];
    if (!agent) {
      throw new Error(`Unknown agent: ${agentName}. Available: ${Object.keys(this.agents).join(', ')}`);
    }

    this._log('start', agentName, `执行 ${task.action || 'default'}...`);
    const startTime = Date.now();

    try {
      const result = await agent.process(task, context);
      const duration = Date.now() - startTime;

      this._log('complete', agentName, `完成 (${duration}ms)`);
      this.results[agentName] = result;

      return { ...result, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      this._log('error', agentName, `失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 注册自定义 Agent
   */
  registerAgent(name, agent) {
    this.agents[name] = agent;
    return { success: true, agents: Object.keys(this.agents) };
  }

  /**
   * 获取所有已注册 Agent
   */
  getRegisteredAgents() {
    return Object.entries(this.agents).map(([name, agent]) => ({
      name,
      role: agent.role,
      hasSystemPrompt: !!agent.systemPrompt,
    }));
  }

  /**
   * 获取分析结果
   */
  getResults() {
    return { ...this.results };
  }

  /**
   * 获取时间线
   */
  getTimeline() {
    return [...this.timeline];
  }

  /**
   * 获取管道日志
   */
  getPipelineLog() {
    return [...this.pipelineLog];
  }

  /**
   * 重置编排器状态
   */
  reset() {
    this.results = {};
    this.timeline = [];
    this.pipelineLog = [];
  }

  // ---- 内部方法 ----

  async _runStep(step, input, options) {
    // 跳过可选步骤
    if (step.optional && options.skipOptional) {
      this._log('skip', step.agent, '跳过可选步骤');
      return;
    }

    this._log('start', step.agent, `开始 ${step.key}...`);
    const startTime = Date.now();

    try {
      let result;
      const agent = this.agents[step.agent];

      switch (step.key) {
        case 'documentAnalysis':
          if (input.documentImage) {
            result = await agent.analyzeImage(input.documentImage, input.mimeType, {
              additionalInfo: input.additionalInfo,
            });
          } else {
            result = await agent.analyzeText(input.document, {
              additionalInfo: input.additionalInfo,
              focusAreas: input.focusAreas,
            });
          }
          break;

        case 'riskAssessment':
          result = await agent.assess(
            { documentAnalysis: this.results.documentAnalysis?.analysis },
            {
              industry: input.industry,
              companyInfo: input.companyInfo,
              historicalData: input.historicalData,
            }
          );
          break;

        case 'strategy':
          result = await agent.developStrategy(
            this.results.documentAnalysis?.analysis,
            this.results.riskAssessment?.assessment,
            {
              myPosition: input.myPosition,
              constraints: input.constraints,
              goals: input.goals,
              industry: input.industry,
            }
          );
          break;

        case 'counterParty':
          result = await agent.simulate(
            this.results.documentAnalysis?.analysis,
            this.results.strategy?.strategy,
            {
              opponentInfo: input.opponentInfo,
              marketContext: input.marketContext,
            }
          );
          break;

        case 'legalReview':
          result = await agent.legalReview(
            this.results.documentAnalysis?.analysis,
            {
              industry: input.industry,
              companyInfo: input.companyInfo,
              applicableJurisdiction: input.jurisdiction,
            }
          );
          break;

        case 'emotionAnalysis':
          result = await agent.analyzeText(
            input.document || '',
            {
              opponentProfile: input.opponentInfo,
              conversationHistory: input.conversationHistory,
            }
          );
          break;

        case 'marketIntel':
          result = await agent.analyzeMarket(
            this.results.documentAnalysis?.analysis,
            {
              industry: input.industry,
              dealValue: input.dealValue,
              parties: input.parties,
              alternatives: input.alternatives,
            }
          );
          break;

        case 'finalReport':
          result = await agent.synthesize({
            documentAnalysis: this.results.documentAnalysis,
            riskAssessment: this.results.riskAssessment,
            strategy: this.results.strategy,
            counterParty: this.results.counterParty,
            legalReview: this.results.legalReview,
            emotionAnalysis: this.results.emotionAnalysis,
            marketIntel: this.results.marketIntel,
          });
          break;

        default:
          result = await agent.process(input, {});
      }

      this.results[step.key] = result;
      const duration = Date.now() - startTime;

      this._log('complete', step.agent, `${step.key} 完成 (${duration}ms)`);
      this._logAgentComplete(step.agent, step.key, duration, result);

      // 通知回调
      if (options.onProgress) {
        options.onProgress(step.key, result);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      this._log('error', step.agent, `${step.key} 失败: ${error.message} (${duration}ms)`);

      if (!step.optional) {
        throw error;
      }

      // 可选步骤失败不影响后续
      this._log('warn', step.agent, `可选步骤失败，继续执行`);
      this.results[step.key] = { error: error.message, optional: true };
    }
  }

  async _runStepsParallel(steps, input, options) {
    const optionalSteps = steps.filter(s => !s.optional || !options.skipOptional);

    this._log('start', 'Parallel', `并行执行 ${optionalSteps.length} 个扩展分析步骤`);

    const results = await Promise.allSettled(
      optionalSteps.map(step => this._runStep(step, input, options))
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    this._log('complete', 'Parallel', `并行完成: ${succeeded} 成功, ${failed} 失败`);
  }

  _log(phase, agent, message) {
    const entry = {
      timestamp: new Date().toISOString(),
      phase,
      agent,
      message,
    };
    this.timeline.push(entry);
    this.pipelineLog.push(entry);
  }

  _logAgentComplete(agent, step, duration, result) {
    this.pipelineLog.push({
      timestamp: new Date().toISOString(),
      phase: 'complete',
      agent,
      step,
      duration,
      hasResult: !!result,
      tokens: result?.usage?.totalTokens || 0,
      demo: result?.demo || false,
    });
  }

  _logPipelineComplete(totalDuration) {
    const completedSteps = this.pipelineLog.filter(l => l.phase === 'complete');
    const totalTokens = completedSteps.reduce((sum, s) => sum + (s.tokens || 0), 0);

    this.pipelineLog.push({
      timestamp: new Date().toISOString(),
      phase: 'pipeline_complete',
      totalDuration,
      completedSteps: completedSteps.length,
      totalTokens,
      resultsCount: Object.keys(this.results).length,
    });
  }
}

module.exports = { Orchestrator };
