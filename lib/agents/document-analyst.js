/**
 * DocumentAnalyst - 文档分析师
 * 职责：识别合同/邮件/招标文件，提取关键条款和实体
 */

const { BaseAgent } = require('./base');
const { MODELS } = require('../mimo-client');

class DocumentAnalyst extends BaseAgent {
  constructor(mimoClient) {
    super('DocumentAnalyst', '文档分析师', mimoClient);
    this.systemPrompt = `你是一位资深的商务文档分析师，拥有15年合同审查经验。

你的职责是：
1. 识别文档类型（合同、邮件、招标文件、报价单等）
2. 提取所有 parties（甲乙方/各方主体）
3. 识别关键条款（金额、期限、付款条件、违约责任等）
4. 提取特殊条款和附加条件
5. 识别潜在的风险条款

输出格式（JSON）：
{
  "documentType": "文档类型",
  "parties": [{"name": "名称", "role": "角色", "obligations": ["义务"]}],
  "keyTerms": {"金额": "", "期限": "", "付款条件": "", "违约责任": ""},
  "specialClauses": ["特殊条款"],
  "riskClauses": ["风险条款"],
  "summary": "文档概要（100字内）",
  "missingInfo": ["缺失的关键信息"]
}

请确保分析全面，不遗漏任何重要条款。`;
  }

  /**
   * 分析图片形式的文档
   */
  async analyzeImage(base64Data, mimeType, context = {}) {
    const prompt = `请分析这份商务文档，提取所有关键信息。

${context.additionalInfo ? `补充信息：${context.additionalInfo}` : ''}

请以 JSON 格式返回分析结果。`;

    const result = await this.mimo.recognizeFile(base64Data, mimeType, prompt, {
      maxTokens: 4096,
      temperature: 0.3,
    });

    let analysis;
    try {
      analysis = JSON.parse(result.content);
    } catch {
      analysis = { rawAnalysis: result.content, parseError: true };
    }

    return this.formatResult({
      type: 'image',
      analysis,
      usage: result.usage,
      demo: result.demo,
    });
  }

  /**
   * 分析文本形式的文档
   */
  async analyzeText(documentText, context = {}) {
    const prompt = `请分析以下商务文档，提取所有关键信息：

---
${documentText}
---

${context.additionalInfo ? `补充信息：${context.additionalInfo}` : ''}
${context.focusAreas ? `重点关注：${context.focusAreas.join('、')}` : ''}

请以 JSON 格式返回分析结果。`;

    const messages = this.buildMessages(prompt);
    const result = await this.mimo.chat(MODELS.PRO, messages, {
      maxTokens: 4096,
      temperature: 0.3,
    });

    let analysis;
    try {
      analysis = JSON.parse(result.content);
    } catch {
      analysis = { rawAnalysis: result.content, parseError: true };
    }

    return this.formatResult({
      type: 'text',
      analysis,
      usage: result.usage,
      demo: result.demo,
    });
  }

  async process(task, context = {}) {
    if (task.imageBase64) {
      return this.analyzeImage(task.imageBase64, task.mimeType || 'image/jpeg', context);
    }
    return this.analyzeText(task.text || task.documentText, context);
  }
}

module.exports = { DocumentAnalyst };
