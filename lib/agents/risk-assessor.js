/**
 * RiskAssessor - 风险评估师
 * 职责：从多个维度评估商务风险，量化风险等级
 */

const { BaseAgent } = require('./base');
const { MODELS } = require('../mimo-client');

class RiskAssessor extends BaseAgent {
  constructor(mimoClient) {
    super('RiskAssessor', '风险评估师', mimoClient);
    this.systemPrompt = `你是一位资深的商务风险评估专家，拥有丰富的合同风险识别和量化经验。

你的评估框架包括6个维度：
1. **法律风险** (Legal) - 条款合法性、管辖权、争议解决机制
2. **财务风险** (Financial) - 付款条件、汇率、税务、成本超支
3. **履约风险** (Performance) - 交付标准、验收条件、延期惩罚
4. **合规风险** (Compliance) - 行业法规、数据保护、反腐败
5. **声誉风险** (Reputation) - 品牌影响、社会责任、舆论
6. **战略风险** (Strategic) - 市场变化、竞争格局、依赖度

输出格式（JSON）：
{
  "overallRiskLevel": "高/中/低",
  "overallScore": 0-100,
  "dimensions": [
    {
      "name": "维度名称",
      "level": "高/中/低",
      "score": 0-100,
      "findings": ["发现1", "发现2"],
      "impact": "潜在影响描述",
      "probability": "高/中/低"
    }
  ],
  "criticalRisks": [{"risk": "风险描述", "impact": "影响", "mitigation": "建议措施"}],
  "hiddenRisks": ["隐蔽风险点"],
  "riskTrend": "风险趋势评估",
  "negotiationPriorities": ["谈判优先级排序"]
}

请确保评估客观、全面，既要识别显性风险也要发现隐性风险。`;
  }

  async assess(documentAnalysis, context = {}) {
    const prompt = `基于以下文档分析结果，请进行全面的商务风险评估：

## 文档分析
${JSON.stringify(documentAnalysis, null, 2)}

${context.industry ? `## 行业背景\n${context.industry}` : ''}
${context.companyInfo ? `## 公司信息\n${context.companyInfo}` : ''}
${context.historicalData ? `## 历史数据\n${context.historicalData}` : ''}

请从6个维度进行全面评估，给出量化评分和具体建议。`;

    const messages = this.buildMessages(prompt);
    const result = await this.mimo.chat(MODELS.PRO, messages, {
      maxTokens: 4096,
      temperature: 0.3,
    });

    let assessment;
    try {
      assessment = JSON.parse(result.content);
    } catch {
      assessment = { rawAssessment: result.content, parseError: true };
    }

    return this.formatResult({
      assessment,
      usage: result.usage,
      demo: result.demo,
    });
  }

  async process(task, context = {}) {
    return this.assess(task.documentAnalysis || task, context);
  }
}

module.exports = { RiskAssessor };
