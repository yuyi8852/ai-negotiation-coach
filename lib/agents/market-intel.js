/**
 * MarketIntel - 市场情报 Agent
 * 职责：市场数据分析、竞品情报、行业趋势研判、价格基准评估
 * 为谈判提供数据驱动的决策支持
 */

const { BaseAgent } = require('./base');
const { MODELS } = require('../mimo-client');

class MarketIntel extends BaseAgent {
  constructor(mimoClient) {
    super('MarketIntel', '市场情报员', mimoClient);
    this.systemPrompt = `你是一位资深的市场情报分析师，拥有丰富的行业研究、竞争情报和商业数据分析经验。

你的分析框架：

## 1. 行业分析 (PESTEL)
- **P**olitical（政治）- 政策环境、贸易关系
- **E**conomic（经济）- 经济周期、通胀率、汇率
- **S**ocial（社会）- 消费趋势、人口结构
- **T**echnological（技术）- 技术创新、替代方案
- **E**nvironmental（环境）- ESG要求、碳排放
- **L**egal（法律）- 法规变化、合规要求

## 2. 竞争格局分析 (Porter's Five Forces)
- 现有竞争者的竞争强度
- 潜在进入者的威胁
- 替代品的威胁
- 供应商的议价能力
- 买方的议价能力

## 3. 价格基准分析
- 市场均价、中位数、价格区间
- 价格趋势（上涨/下跌/平稳）
- 价格影响因素
- 谈判中的合理价格区间

## 4. 谈判筹码评估
- 我方的市场地位
- 替代方案的可用性
- 时间紧迫度
- 信息优势/劣势

## 5. 战略建议
- 市场时机判断
- 议价策略建议
- 风险预警
- 长期合作价值评估

输出格式（JSON）：
{
  "marketIntelligence": {
    "industryOverview": {
      "marketSize": "市场规模",
      "growthRate": "增长率",
      "maturity": "成熟度",
      "keyTrends": ["趋势1", "趋势2"]
    },
    "competitiveLandscape": {
      "numberOfCompetitors": 0,
      "marketConcentration": "高/中/低",
      "topPlayers": [{"name": "名称", "marketShare": "份额", "strength": "优势"}],
      "competitiveIntensity": "高/中/低"
    },
    "pricingIntelligence": {
      "marketPriceRange": {"min": 0, "max": 0, "average": 0, "median": 0},
      "priceTrend": "上涨/下跌/平稳",
      "priceDrivers": ["因素1", "因素2"],
      "negotiationRange": {"anchor": 0, "target": 0, "walkaway": 0}
    },
    "supplierAnalysis": {
      "alternatives": 0,
      "switchingCost": "高/中/低",
      "dependencyLevel": "高/中/低",
      "leverageAssessment": "我方/对方/平衡"
    },
    "timingAnalysis": {
      "marketCycle": "扩张/高峰/衰退/低谷",
      "bestTiming": "建议时机",
      "urgencyLevel": "高/中/低"
    },
    "strategicRecommendations": {
      "negotiationLeverage": "谈判筹码评估",
      "recommendedApproach": "推荐策略",
      "priceTarget": "目标价格",
      "walkAwayPoint": "退出点",
      "longTermValue": "长期合作价值评估"
    },
    "riskAlerts": [{"alert": "预警内容", "severity": "高/中/低", "mitigation": "建议"}]
  }
}

请确保分析基于实际市场逻辑，给出有数据支撑的判断。`;

    // 行业数据库 - 价格基准和市场数据
    this.industryDatabase = {
      tech: {
        averageProjectCost: { small: '10-50万', medium: '50-200万', large: '200-1000万' },
        typicalMargins: { software: '30-60%', hardware: '10-25%', services: '20-40%' },
        paymentTerms: ['预付30%', '里程碑付款', '验收后30天', '质保金10%'],
        commonNegotiationPoints: ['源码交付', '数据所有权', 'SLA标准', '维护期', '培训'],
        marketTrends: ['AI化', '云原生', '低代码', '数据安全'],
      },
      manufacturing: {
        averageProjectCost: { small: '50-200万', medium: '200-1000万', large: '1000万+' },
        typicalMargins: { oem: '5-15%', odm: '15-30%', custom: '20-40%' },
        paymentTerms: ['预付20-30%', '发货前70%', '月结60天', '质保金5-10%'],
        commonNegotiationPoints: ['MOQ', '交期', '质检标准', '退换货', '模具费用'],
        marketTrends: ['智能制造', '绿色制造', '供应链韧性', '国产替代'],
      },
      finance: {
        averageProjectCost: { small: '100-500万', medium: '500-3000万', large: '3000万+' },
        typicalMargins: { consulting: '30-50%', software: '40-70%', outsourcing: '15-30%' },
        paymentTerms: ['合同签订30%', '上线30%', '验收30%', '质保金10%'],
        commonNegotiationPoints: ['数据安全', '合规要求', '系统对接', '运维保障', '升级服务'],
        marketTrends: ['数字人民币', '开放银行', 'ESG投资', '智能风控'],
      },
    };

    // 价格谈判策略模板
    this.pricingStrategies = {
      valueBased: {
        name: '价值定价策略',
        description: '基于交付价值而非成本来定价',
        steps: ['量化ROI', '展示竞品价格', '强调独特价值', '分层定价'],
      },
      competitive: {
        name: '竞争性定价策略',
        description: '基于竞争者价格来定位',
        steps: ['收集竞品报价', '分析差异', '突出性价比', '条件灵活'],
      },
      costPlus: {
        name: '成本加成策略',
        description: '基于成本加合理利润',
        steps: ['透明成本结构', '合理利润空间', '量大优惠', '长期合约折扣'],
      },
      anchoring: {
        name: '锚定策略',
        description: '通过初始价格设定影响谈判',
        steps: ['设定高价锚点', '逐级让步', '强调底线', '交换条件'],
      },
    };
  }

  /**
   * 市场情报分析
   */
  async analyzeMarket(documentAnalysis, context = {}) {
    const industryData = this.industryDatabase[context.industry] || null;
    const industryContext = industryData
      ? this._buildIndustryContext(industryData, context.industry)
      : '';

    const prompt = `请对以下商务谈判场景进行全面的市场情报分析：

## 文档分析
${JSON.stringify(documentAnalysis, null, 2)}

${industryContext}

${context.dealValue ? `## 交易规模\n${context.dealValue}` : ''}
${context.parties ? `## 参与方信息\n${context.parties}` : ''}
${context.deadline ? `## 时间要求\n${context.deadline}` : ''}
${context.alternatives ? `## 替代方案\n${context.alternatives}` : ''}

## 分析要求
1. **行业概览** - 市场规模、增长率、成熟度
2. **竞争格局** - 竞争强度、供应商分析
3. **价格情报** - 市场价格基准、合理区间
4. **谈判筹码** - 评估双方的议价能力
5. **时机分析** - 当前市场周期对谈判的影响
6. **策略建议** - 数据驱动的谈判建议

请以JSON格式返回市场情报分析报告。`;

    const messages = this.buildMessages(prompt);
    const result = await this.mimo.chat(MODELS.PRO, messages, {
      maxTokens: 6144,
      temperature: 0.4,
    });

    let intel;
    try {
      intel = JSON.parse(result.content);
    } catch {
      intel = { rawIntel: result.content, parseError: true };
    }

    return this.formatResult({
      intel,
      usage: result.usage,
      demo: result.demo,
    });
  }

  /**
   * 价格基准评估
   */
  async priceBenchmarking(dealInfo, context = {}) {
    const prompt = `请对以下交易进行价格基准评估：

## 交易信息
${JSON.stringify(dealInfo, null, 2)}

${context.industry ? `## 行业：${context.industry}` : ''}
${context.region ? `## 地区：${context.region}` : ''}
${context.volume ? `## 数量/规模：${context.volume}` : ''}
${context.budget ? `## 预算范围：${context.budget}` : ''}

## 评估要求
1. **市场价格基准** - 同类商品/服务的市场价格
2. **合理价格区间** - 考虑品质、服务、品牌后的合理区间
3. **谈判空间** - 可能的让步幅度
4. **定价策略建议** - 推荐的定价方法
5. **价格风险** - 价格波动风险和对冲建议

请以JSON格式返回价格评估报告。`;

    const messages = this.buildMessages(prompt);
    const result = await this.mimo.chat(MODELS.PRO, messages, {
      maxTokens: 4096,
      temperature: 0.3,
    });

    let benchmark;
    try {
      benchmark = JSON.parse(result.content);
    } catch {
      benchmark = { rawBenchmark: result.content, parseError: true };
    }

    return this.formatResult({
      benchmark,
      usage: result.usage,
      demo: result.demo,
    });
  }

  /**
   * 供应商/竞品对比分析
   */
  async vendorComparison(vendors, context = {}) {
    const prompt = `请对以下供应商/竞品进行对比分析：

## 供应商列表
${JSON.stringify(vendors, null, 2)}

${context.requirements ? `## 需求标准\n${context.requirements}` : ''}
${context.budget ? `## 预算\n${context.budget}` : ''}
${context.priority ? `## 优先考虑因素\n${context.priority}` : ''}

## 分析要求
1. **综合评分** - 从质量、价格、服务、信誉、技术能力等维度评分
2. **SWOT分析** - 每个供应商的优劣势
3. **推荐排序** - 综合推荐排名
4. **谈判策略** - 针对每个供应商的谈判要点
5. **风险提示** - 选择每个供应商的潜在风险

请以JSON格式返回对比分析报告。`;

    const messages = this.buildMessages(prompt);
    const result = await this.mimo.chat(MODELS.PRO, messages, {
      maxTokens: 6144,
      temperature: 0.3,
    });

    let comparison;
    try {
      comparison = JSON.parse(result.content);
    } catch {
      comparison = { rawComparison: result.content, parseError: true };
    }

    return this.formatResult({
      comparison,
      vendorCount: vendors.length,
      usage: result.usage,
      demo: result.demo,
    });
  }

  /**
   * 构建行业上下文
   */
  _buildIndustryContext(industryData, industryId) {
    let ctx = `## 行业数据参考 (${industryId})\n`;
    ctx += `### 典型项目规模\n`;
    Object.entries(industryData.averageProjectCost).forEach(([size, cost]) => {
      ctx += `- ${size}: ${cost}\n`;
    });
    ctx += `### 典型利润率\n`;
    Object.entries(industryData.typicalMargins).forEach(([type, margin]) => {
      ctx += `- ${type}: ${margin}\n`;
    });
    ctx += `### 常见付款条件\n`;
    industryData.paymentTerms.forEach(t => { ctx += `- ${t}\n`; });
    ctx += `### 常见谈判要点\n`;
    industryData.commonNegotiationPoints.forEach(p => { ctx += `- ${p}\n`; });
    ctx += `### 市场趋势\n`;
    industryData.marketTrends.forEach(t => { ctx += `- ${t}\n`; });
    return ctx;
  }

  async process(task, context = {}) {
    if (task.action === 'priceBenchmarking') {
      return this.priceBenchmarking(task.dealInfo, context);
    }
    if (task.action === 'vendorComparison') {
      return this.vendorComparison(task.vendors, context);
    }
    return this.analyzeMarket(task.documentAnalysis || task, context);
  }
}

module.exports = { MarketIntel };
