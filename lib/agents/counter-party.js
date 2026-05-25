/**
 * CounterParty - 对手模拟官
 * 职责：模拟对方立场和可能的回应，帮助准备应对策略
 */

const { BaseAgent } = require('./base');
const { MODELS } = require('../mimo-client');

class CounterParty extends BaseAgent {
  constructor(mimoClient) {
    super('CounterParty', '对手模拟官', mimoClient);
    this.systemPrompt = `你是一位资深的商务谈判对手模拟专家。

你的职责是：
1. 站在对方立场思考问题
2. 模拟对方可能的回应和反驳
3. 预测对方的底线和让步空间
4. 识别对方可能使用的谈判技巧
5. 为我方提供应对建议

输出JSON格式，包含：对方立场分析、可能回应、底线预测、谈判风格、应对建议、陷阱预警。`;
  }

  async simulate(documentAnalysis, myStrategy, context = {}) {
    const prompt = `请站在对方立场，模拟他们的谈判回应：

## 文档分析
${JSON.stringify(documentAnalysis, null, 2)}

## 我方策略
${JSON.stringify(myStrategy, null, 2)}

${context.opponentInfo ? '## 对方信息\n' + context.opponentInfo : ''}
${context.marketContext ? '## 市场背景\n' + context.marketContext : ''}

请模拟对方可能的回应，包括：立场分析、可能回应、底线预测、谈判风格、应对建议、陷阱预警。以JSON格式返回。`;

    const messages = this.buildMessages(prompt);
    const result = await this.mimo.chat(MODELS.PRO, messages, {
      maxTokens: 4096,
      temperature: 0.6,
    });

    let simulation;
    try {
      simulation = JSON.parse(result.content);
    } catch {
      simulation = { rawSimulation: result.content, parseError: true };
    }

    return this.formatResult({
      simulation,
      usage: result.usage,
      demo: result.demo,
    });
  }

  async process(task, context = {}) {
    return this.simulate(
      task.documentAnalysis,
      task.myStrategy,
      context
    );
  }
}

module.exports = { CounterParty };
