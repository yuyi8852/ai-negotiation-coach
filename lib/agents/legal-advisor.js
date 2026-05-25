/**
 * LegalAdvisor - 法律顾问 Agent
 * 职责：深度法律条款审查、合规性分析、争议解决机制评估
 * 专注于中国商法、合同法、知识产权法等领域
 */

const { BaseAgent } = require('./base');
const { MODELS } = require('../mimo-client');

class LegalAdvisor extends BaseAgent {
  constructor(mimoClient) {
    super('LegalAdvisor', '法律顾问', mimoClient);
    this.systemPrompt = `你是一位资深的中国商务法律顾问，拥有20年合同法、商法、知识产权法执业经验，持有中国律师执业证书。

你的专业领域：
1. **合同条款合法性审查** - 识别违反《民法典》合同编的条款
2. **知识产权保护** - 专利、商标、著作权、商业秘密保护
3. **劳动法合规** - 竞业限制、保密协议、劳动关系
4. **数据合规** - 《个人信息保护法》、《数据安全法》、GDPR
5. **反垄断审查** - 市场支配地位、垄断协议、经营者集中
6. **争议解决机制** - 仲裁条款、管辖权约定、执行可行性
7. **税务合规** - 增值税、企业所得税、转让定价
8. **公司治理** - 股东权益、董事会权限、关联交易

审查框架：
- 条款合法性（是否违反强制性法律规定）
- 条款合理性（是否显失公平）
- 条款可执行性（约定是否可落地）
- 条款完备性（是否有遗漏）
- 潜在诉讼风险（争议解决可行性）

输出格式（JSON）：
{
  "legalReview": {
    "overallLegality": "合法/存在风险/违法",
    "complianceScore": 0-100,
    "articles": [
      {
        "clause": "条款原文摘要",
        "analysis": "法律分析",
        "risk": "合法/灰色/违法",
        "applicableLaw": "适用法律条文",
        "recommendation": "修改建议",
        "urgency": "高/中/低"
      }
    ],
    "missingClauses": ["应补充的条款"],
    "disputeResolution": {
      "currentMechanism": "当前争议解决机制",
      "enforceability": "可执行性评估",
      "recommendation": "建议"
    },
    "complianceCheck": {
      "dataProtection": "数据合规状态",
      "antiMonopoly": "反垄断状态",
      "tax": "税务合规状态",
      "labor": "劳动法合规状态"
    },
    "overallRecommendation": "总体法律建议"
  }
}

请确保每个分析点都有具体的法律依据（引用《民法典》、《合同法》等具体条文）。`;

    // 法律知识库 - 常用法律条文
    this.legalKnowledgeBase = {
      contractLaw: {
        '民法典-469': '当事人订立合同，可以采用书面形式、口头形式或者其他形式。书面形式是合同书、信件和数据电文（包括电报、电传、传真、电子数据交换和电子邮件）等可以有形地表现所载内容的形式。',
        '民法典-496': '格式条款是当事人为了重复使用而预先拟定，并在订立合同时未与对方协商的条款。',
        '民法典-497': '有下列情形之一的，该格式条款无效：（一）具有本法第一编第六章第三节和本法第五百零六条规定的无效情形；（二）提供格式条款一方不合理地免除或者减轻其责任、加重对方责任、限制对方主要权利；（三）提供格式条款一方排除对方主要权利。',
        '民法典-500': '当事人在订立合同过程中有下列情形之一，造成对方损失的，应当承担赔偿责任：（一）假借订立合同，恶意进行磋商；（二）故意隐瞒与订立合同有关的重要事实或者提供虚假情况；（三）有其他违背诚信原则的行为。',
        '民法典-577': '当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。',
        '民法典-585': '当事人可以约定一方违约时应当根据违约情况向对方支付一定数额的违约金，也可以约定因违约产生的损失赔偿额的计算方法。',
        '民法典-590': '当事人一方因不可抗力不能履行合同的，根据不可抗力的影响，部分或者全部免除责任，但是法律另有规定的除外。',
      },
      intellectualProperty: {
        '专利法-6': '执行本单位的任务或者主要是利用本单位的物质技术条件所完成的发明创造为职务发明创造。职务发明创造申请专利的权利属于该单位。',
        '著作权法-17': '职务作品著作权的归属：一般职务作品著作权由作者享有，但法人或者非法人组织有权在其业务范围内优先使用。',
        '反不正当竞争法-9': '经营者不得实施下列侵犯商业秘密的行为：（一）以盗窃、贿赂、欺诈、胁迫、电子侵入或者其他不正当手段获取权利人的商业秘密。',
      },
      dataProtection: {
        '个保法-13': '个人信息处理者取得个人的同意后，方可处理个人信息。',
        '个保法-25': '个人信息处理者不得公开其处理的个人信息，不得非法向他人提供其处理的个人信息。',
        '数安法-27': '开展数据处理活动应当依照法律、法规的规定，建立健全全流程数据安全管理制度。',
      },
    };

    // 行业特定法律风险
    this.industryLegalRisks = {
      tech: [
        { risk: '开源许可证合规', desc: '使用GPL/MIT/Apache等开源组件需遵守许可证义务', law: '《著作权法》《计算机软件保护条例》' },
        { risk: '算法备案', desc: '具有舆论属性或社会动员能力的算法需向网信办备案', law: '《互联网信息服务算法推荐管理规定》' },
        { risk: '跨境数据传输', desc: '向境外提供个人信息需通过安全评估或认证', law: '《个人信息保护法》第38-40条' },
        { risk: 'AI生成内容标识', desc: '深度合成服务提供者需对AI生成内容添加标识', law: '《互联网信息服务深度合成管理规定》' },
      ],
      healthcare: [
        { risk: '临床试验合规', desc: '药物临床试验需经伦理委员会审查批准', law: '《药物临床试验质量管理规范》' },
        { risk: '医疗数据保护', desc: '健康医疗数据属于敏感个人信息，需单独同意', law: '《个人信息保护法》第28-32条' },
        { risk: '药品不良反应报告', desc: '发现不良反应需在规定时限内报告', law: '《药品不良反应报告和监测管理办法》' },
      ],
      finance: [
        { risk: '反洗钱义务', desc: '需建立客户身份识别和可疑交易报告制度', law: '《反洗钱法》' },
        { risk: '金融消费者保护', desc: '需充分披露产品风险，保障消费者知情权', law: '《银行保险机构消费者权益保护管理办法》' },
        { risk: '数据本地化', desc: '关键信息基础设施运营者的重要数据需境内存储', law: '《数据安全法》第31条' },
      ],
      manufacturing: [
        { risk: '产品责任', desc: '产品存在缺陷造成损害的，生产者应承担赔偿责任', law: '《产品质量法》《民法典》第1202-1207条' },
        { risk: '环保合规', desc: '需取得排污许可证，遵守排放标准', law: '《环境保护法》《大气污染防治法》' },
        { risk: '安全生产', desc: '需建立安全生产责任制，定期安全检查', law: '《安全生产法》' },
      ],
    };
  }

  /**
   * 深度法律审查
   */
  async legalReview(documentAnalysis, context = {}) {
    const industryContext = context.industry
      ? this._getIndustryContext(context.industry)
      : '';

    const legalContext = this._buildLegalContext(context);

    const prompt = `请对以下商务合同/文件进行深度法律审查：

## 文档分析结果
${JSON.stringify(documentAnalysis, null, 2)}

${industryContext}

## 审查要求
1. **逐条审查** - 对每个条款进行合法性、合理性、可执行性分析
2. **引用法律条文** - 必须引用具体的法律条文（如《民法典》第XXX条）
3. **识别格式条款** - 检查是否存在不公平的格式条款
4. **争议解决评估** - 评估仲裁/诉讼条款的有效性和可执行性
5. **合规性检查** - 涉及数据保护、反垄断、税务等方面的合规性

${legalContext}

${context.companyInfo ? `## 我方信息\n${context.companyInfo}` : ''}
${context.contractHistory ? `## 历史合同审查记录\n${context.contractHistory}` : ''}

请以JSON格式返回详细的法律审查报告。`;

    const messages = this.buildMessages(prompt);
    const result = await this.mimo.chat(MODELS.PRO, messages, {
      maxTokens: 8192,
      temperature: 0.2,
    });

    let review;
    try {
      review = JSON.parse(result.content);
    } catch {
      review = { rawReview: result.content, parseError: true };
    }

    // 补充知识库中的相关法条
    if (review.legalReview) {
      review.legalReview.knowledgeBaseReferences = this._findRelevantLawArticles(
        documentAnalysis,
        context.industry
      );
    }

    return this.formatResult({
      review,
      usage: result.usage,
      demo: result.demo,
    });
  }

  /**
   * 条款修改建议生成
   */
  async generateClauseRevisions(reviewResult, context = {}) {
    const prompt = `基于以下法律审查结果，请为每个风险条款生成具体的修改建议：

## 法律审查结果
${JSON.stringify(reviewResult, null, 2)}

## 要求
为每个有问题的条款提供：
1. **原文摘要** - 问题条款的原文
2. **问题分析** - 为什么有问题
3. **修改方案** - 具体的修改文字（可直接使用）
4. **替代方案** - 备选修改方案
5. **法律依据** - 修改的法律依据

${context.preferredDisputeResolution ? `## 偏好争议解决方式：${context.preferredDisputeResolution}` : ''}
${context.riskTolerance ? `## 风险承受度：${context.riskTolerance}` : ''}

请以JSON格式返回。`;

    const messages = this.buildMessages(prompt);
    const result = await this.mimo.chat(MODELS.PRO, messages, {
      maxTokens: 8192,
      temperature: 0.3,
    });

    let revisions;
    try {
      revisions = JSON.parse(result.content);
    } catch {
      revisions = { rawRevisions: result.content, parseError: true };
    }

    return this.formatResult({
      revisions,
      usage: result.usage,
      demo: result.demo,
    });
  }

  /**
   * 构建法律上下文
   */
  _buildLegalContext(context) {
    const parts = [];

    if (context.applicableJurisdiction) {
      parts.push(`## 适用法律管辖区\n${context.applicableJurisdiction}`);
    }

    if (context.previousDisputes) {
      parts.push(`## 历史争议记录\n${context.previousDisputes}`);
    }

    if (context.industryRegulations) {
      parts.push(`## 行业特殊法规\n${context.industryRegulations}`);
    }

    return parts.join('\n\n');
  }

  /**
   * 获取行业特定法律上下文
   */
  _getIndustryContext(industryId) {
    const risks = this.industryLegalRisks[industryId];
    if (!risks) return '';

    let context = `## ${industryId} 行业法律风险提示\n`;
    risks.forEach((r, i) => {
      context += `${i + 1}. **${r.risk}** - ${r.desc}（依据：${r.law}）\n`;
    });
    return context;
  }

  /**
   * 从知识库中查找相关法条
   */
  _findRelevantLawArticles(documentAnalysis, industryId) {
    const articles = [];

    // 合同法相关
    Object.entries(this.legalKnowledgeBase.contractLaw).forEach(([key, value]) => {
      articles.push({ articleId: key, content: value, category: '合同法' });
    });

    // 知识产权相关
    Object.entries(this.legalKnowledgeBase.intellectualProperty).forEach(([key, value]) => {
      articles.push({ articleId: key, content: value, category: '知识产权' });
    });

    // 数据保护相关
    if (documentAnalysis?.keyTerms?.['数据'] || industryId === 'tech' || industryId === 'healthcare') {
      Object.entries(this.legalKnowledgeBase.dataProtection).forEach(([key, value]) => {
        articles.push({ articleId: key, content: value, category: '数据保护' });
      });
    }

    return articles;
  }

  async process(task, context = {}) {
    if (task.action === 'review') {
      return this.legalReview(task.documentAnalysis || task, context);
    }
    if (task.action === 'revisions') {
      return this.generateClauseRevisions(task.reviewResult, context);
    }
    return this.legalReview(task.documentAnalysis || task, context);
  }
}

module.exports = { LegalAdvisor };
