/**
 * Negotiator - 谈判官/主持人
 * 职责：综合各方分析，生成最终谈判报告和语音简报
 */

const { BaseAgent } = require('./base');
const { MODELS } = require('../mimo-client');

class Negotiator extends BaseAgent {
  constructor(mimoClient) {
    super('Negotiator', '谈判官', mimoClient);
    this.systemPrompt = `你是一位资深的谈判主持人，负责综合各方分析结果，生成最终的谈判报告。

你的职责：
1. 综合文档分析、风险评估、策略建议、对手模拟的结果
2. 识别关键发现和共识
3. 生成可执行的谈判清单
4. 准备语音汇报稿（简洁、有力、可直接用于汇报）

输出JSON格式，包含：executiveSummary, keyFindings, negotiationChecklist, openingStatement, closingArguments, audioScript。`;
  }

  async synthesize(analysisResults, context = {}) {
    const prompt = `请综合以下所有分析结果，生成最终谈判报告：

## 文档分析
${JSON.stringify(analysisResults.documentAnalysis || {}, null, 2)}

## 风险评估
${JSON.stringify(analysisResults.riskAssessment || {}, null, 2)}

## 策略建议
${JSON.stringify(analysisResults.strategy || {}, null, 2)}

## 对手模拟
${JSON.stringify(analysisResults.counterParty || {}, null, 2)}

${context.additionalContext ? '## 补充信息\n' + context.additionalContext : ''}

请生成：
1. 执行摘要（200字内）
2. 关键发现清单
3. 谈判清单（必须谈/可以谈/绝对不谈）
4. 开场陈述
5. 终场论据
6. 语音汇报稿（600字内，适合2分钟语音）`;

    const messages = this.buildMessages(prompt);
    const result = await this.mimo.chat(MODELS.PRO, messages, {
      maxTokens: 4096,
      temperature: 0.4,
    });

    let report;
    try {
      report = JSON.parse(result.content);
    } catch {
      report = { rawReport: result.content, parseError: true };
    }

    return this.formatResult({
      report,
      usage: result.usage,
      demo: result.demo,
    });
  }

  /**
   * 生成语音汇报
   */
  async generateAudio(script) {
    if (!script) return null;

    const result = await this.mimo.synthesize(script, {
      voice: 'alloy',
      speed: 0.9,
    });

    return {
      ...result,
      agent: this.name,
      timestamp: new Date().toISOString(),
    };
  }

  async process(task, context = {}) {
    return this.synthesize(task.analysisResults || task, context);
  }
}

module.exports = { Negotiator };
