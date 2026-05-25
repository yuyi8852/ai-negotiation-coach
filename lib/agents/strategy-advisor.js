/**
 * StrategyAdvisor - 策略顾问
 * 职责：制定谈判策略，生成多套备选方案
 */

const { BaseAgent } = require('./base');
const { MODELS } = require('../mimo-client');

class StrategyAdvisor extends BaseAgent {
  constructor(mimoClient) {
    super('StrategyAdvisor', '策略顾问', mimoClient);
    this.systemPrompt = `你是一位顶级的商务谈判策略顾问，擅长制定双赢和多赢的谈判方案。

你的策略框架：
1. BATNA分析 - 最佳替代方案评估
2. ZOPA分析 - 可能协议区间
3. 利益相关者分析 - 各方核心利益和底线
4. 谈判风格评估 - 竞争型/合作型/妥协型
5. 多轮策略规划 - 开局/中场/终局策略
6. 让步策略 - 让步顺序、幅度、交换条件

输出JSON格式，包含：batna, zopa, stakeholderAnalysis, strategyStyle, phases, keyArguments, riskMitigation, winWinOpportunities, contingencyPlans。`;
  }

  async developStrategy(documentAnalysis, riskAssessment, context = {}) {
    const prompt = `基于文档分析和风险评估，请制定全面的谈判策略：

## 文档分析
${JSON.stringify(documentAnalysis, null, 2)}

## 风险评估
${JSON.stringify(riskAssessment, null, 2)}

${context.myPosition ? '## 我方立场\n' + context.myPosition : ''}
${context.constraints ? '## 约束条件\n' + context.constraints : ''}
${context.goals ? '## 谈判目标\n' + context.goals : ''}
${context.industry ? '## 行业背景\n' + context.industry : ''}

请制定详细的谈判策略，包括BATNA/ZOPA分析、多阶段策略和具体战术。以JSON格式返回。`;

    const messages = this.buildMessages(prompt);
    const result = await this.mimo.chat(MODELS.PRO, messages, {
      maxTokens: 4096,
      temperature: 0.5,
    });

    let strategy;
    try {
      strategy = JSON.parse(result.content);
    } catch {
      strategy = { rawStrategy: result.content, parseError: true };
    }

    return this.formatResult({
      strategy,
      usage: result.usage,
      demo: result.demo,
    });
  }

  async process(task, context = {}) {
    return this.developStrategy(
      task.documentAnalysis,
      task.riskAssessment,
      context
    );
  }
}

module.exports = { StrategyAdvisor };
