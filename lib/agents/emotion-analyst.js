/**
 * EmotionAnalyst - 情绪分析师 Agent
 * 职责：分析谈判中的情绪动态、语义倾向、心理博弈策略
 * 基于心理学和行为经济学理论框架
 */

const { BaseAgent } = require('./base');
const { MODELS } = require('../mimo-client');

class EmotionAnalyst extends BaseAgent {
  constructor(mimoClient) {
    super('EmotionAnalyst', '情绪分析师', mimoClient);
    this.systemPrompt = `你是一位资深的谈判心理学专家和行为分析师，融合了心理学、行为经济学和博弈论的知识体系。

你的分析框架：

## 1. 情绪识别模型 (PAD模型)
- **Pleasure（愉悦度）** - 对方对当前谈判的满意程度
- **Arousal（唤醒度）** - 对方的情绪激活水平（激动/平静）
- **Dominance（主导度）** - 对方感知到的控制力

## 2. 谈判心理博弈分析
- **锚定效应** - 对方的初始报价策略
- **损失厌恶** - 对方对损失的敏感度
- **框架效应** - 对方如何框定问题
- **社会证明** - 对方引用的外部压力
- **互惠原则** - 让步-索取的交换模式
- **承诺一致性** - 对方是否坚守立场

## 3. 语言情绪分析
- **正面信号** - 积极词汇、肯定表达、建设性提议
- **负面信号** - 否定词汇、威胁性表达、消极态度
- **防御信号** - 模糊表达、推诿、回避核心问题
- **进攻信号** - 施压、最后通牒、情绪操控

## 4. 非语言线索（文字中推断）
- 回复速度变化
- 措辞正式度变化
- 信息详细度变化
- 谈判团队人员变化

## 5. 心理策略建议
- 如何化解对方的情绪施压
- 如何识别和应对操纵技巧
- 如何建立信任和共情
- 如何在高压下保持冷静

输出格式（JSON）：
{
  "emotionAnalysis": {
    "overallMood": "积极/中性/消极/对抗",
    "padScore": {
      "pleasure": -1.0到1.0,
      "arousal": -1.0到1.0,
      "dominance": -1.0到1.0
    },
    "emotionalTriggers": ["触发点1", "触发点2"],
    "communicationStyle": {
      "formality": "正式/半正式/非正式",
      "aggressiveness": "攻击性评分0-10",
      "cooperativeness": "合作性评分0-10",
      "urgency": "紧迫度评分0-10"
    },
    "psychologicalTactics": [
      {
        "tactic": "使用策略名称",
        "evidence": "文本证据",
        "intent": "可能意图",
        "counterStrategy": "应对建议"
      }
    ],
    "languageSignals": {
      "positive": ["正面信号列表"],
      "negative": ["负面信号列表"],
      "defensive": ["防御信号列表"],
      "offensive": ["进攻信号列表"]
    },
    "powerDynamics": {
      "whoHasPower": "哪方更有谈判力",
      "powerSource": "权力来源分析",
      "shiftingTrend": "权力转移趋势"
    },
    "riskIndicators": ["情绪风险指标"],
    "recommendedApproach": {
      "tone": "建议语气",
      "pace": "建议节奏",
      "strategy": "心理策略",
      "avoid": "应避免的行为"
    }
  }
}`;

    // 情绪词典 - 用于文本情绪分析
    this.emotionLexicon = {
      positive: {
        strong: ['非常满意', '高度认可', '完全同意', '极其重要', '强烈建议', '非常期待', '深度合作', '共赢'],
        moderate: ['满意', '认可', '同意', '建议', '期望', '合作', '支持', '积极', '感谢', '理解'],
        mild: ['考虑', '研究', '探讨', '了解', '关注', '参考', '适当', '合理'],
      },
      negative: {
        strong: ['严重不满', '强烈反对', '无法接受', '必须终止', '立即停止', '不可容忍', '严重违约'],
        moderate: ['不满', '反对', '拒绝', '担忧', '质疑', '批评', '投诉', '警告', '不满'],
        mild: ['有些担心', '略有异议', '需要再考虑', '有待商榷', '不够理想', '需要改进'],
      },
      pressure: {
        urgency: ['最后期限', '尽快', '立即', '今天之前', '明天之前', '本周内', '紧急', '加急'],
        threat: ['否则', '否则将', '不得不', '被迫', '法律手段', '仲裁', '诉讼', '追究责任'],
        deadline: ['到期', '超时', '逾期', '过期', '最后机会', '最后一次'],
      },
      cooperation: {
        winWin: ['双赢', '共赢', '互利', '合作', '共同', '一起', '携手', '协同'],
        compromise: ['各退一步', '折中', '平衡', '妥协', '让步', '适当调整', '灵活处理'],
        creative: ['创新方案', '新思路', '换个角度', '重新考虑', '优化方案', '改进方案'],
      },
    };

    // 心理博弈模式识别
    this.psychologicalPatterns = [
      {
        name: '锚定效应 (Anchoring)',
        description: '对方设定一个极端初始值，使后续讨论围绕该值展开',
        indicators: ['首次报价远高于/低于预期', '引用行业最高/最低价', '强调某个极端数字'],
        counterStrategy: '提出自己的锚定点，用数据支撑合理范围',
      },
      {
        name: '损失厌恶 (Loss Aversion)',
        description: '强调对方将失去什么，而非得到什么',
        indicators: ['如果不成...会失去', '机会成本', '错过的风险', '竞争者'],
        counterStrategy: '转换框架为收益导向，强调合作能获得什么',
      },
      {
        name: '最后通牒 (Ultimatum)',
        description: '设定不可协商的条件或时间限制',
        indicators: ['这是最后条件', '必须今天决定', '不接受就...', '唯一方案'],
        counterStrategy: '不要被时间压力操控，要求合理考虑时间',
      },
      {
        name: '好人坏人 (Good Cop Bad Cop)',
        description: '谈判团队中一人施压一人缓和',
        indicators: ['团队内部态度不一致', '一人强硬一人温和', '内部需要请示'],
        counterStrategy: '识别策略后，专注于与决策者沟通',
      },
      {
        name: '信息不对称 (Information Asymmetry)',
        description: '故意隐藏或夸大某些信息',
        indicators: ['模糊的回答', '回避具体数字', '声称不能透露', '与其他供应商比较'],
        counterStrategy: '要求具体数据，使用公开信息验证',
      },
      {
        name: '沉没成本 (Sunk Cost)',
        description: '强调已经投入的资源，迫使对方继续',
        indicators: ['已经投入了大量', '前期工作成本', '不能白费', '已经做了很多'],
        counterStrategy: '将讨论聚焦于未来价值而非历史投入',
      },
      {
        name: '稀缺性 (Scarcity)',
        description: '制造紧迫感，暗示机会有限',
        indicators: ['名额有限', '其他买家', '优惠即将结束', '市场变化'],
        counterStrategy: '验证信息真实性，保持冷静评估',
      },
      {
        name: '社会证明 (Social Proof)',
        description: '引用他人的选择来施加压力',
        indicators: ['行业惯例', '其他公司都', '大家都选择', '市场上普遍'],
        counterStrategy: '评估具体案例的适用性，不盲从',
      },
    ];
  }

  /**
   * 分析谈判文本中的情绪
   */
  async analyzeText(text, context = {}) {
    // 先用词典做初步分析
    const lexiconAnalysis = this._lexiconAnalysis(text);

    const prompt = `请对以下谈判文本进行深度情绪和心理分析：

## 待分析文本
${text}

${lexionAnalysisSummary(lexiconAnalysis)}

${context.myMessages ? `## 我方之前的消息\n${context.myMessages}` : ''}
${context.conversationHistory ? `## 完整对话历史\n${context.conversationHistory}` : ''}
${context.opponentProfile ? `## 对方谈判代表背景\n${context.opponentProfile}` : ''}

## 分析要求
1. **情绪状态** - 当前情绪基调和变化趋势
2. **心理博弈** - 识别对方使用了哪些心理策略
3. **语言信号** - 正面/负面/防御/进攻信号
4. **权力动态** - 谈判力的分布和变化趋势
5. **应对建议** - 心理层面的应对策略

请以JSON格式返回完整的心理分析报告。`;

    const messages = this.buildMessages(prompt);
    const result = await this.mimo.chat(MODELS.PRO, messages, {
      maxTokens: 6144,
      temperature: 0.4,
    });

    let analysis;
    try {
      analysis = JSON.parse(result.content);
    } catch {
      analysis = { rawAnalysis: result.content, parseError: true };
    }

    // 合并词典分析结果
    if (analysis.emotionAnalysis) {
      analysis.emotionAnalysis.lexiconSignals = lexiconAnalysis;
    }

    return this.formatResult({
      analysis,
      usage: result.usage,
      demo: result.demo,
    });
  }

  /**
   * 分析多轮对话的情绪趋势
   */
  async analyzeTrend(conversationTurns, context = {}) {
    const formattedTurns = conversationTurns
      .map((turn, i) => `### 第${i + 1}轮 (${turn.speaker || '未知'})\n${turn.text}`)
      .join('\n\n');

    const prompt = `请分析以下多轮谈判对话的情绪变化趋势：

## 对话历史
${formattedTurns}

${context.timeframe ? `## 时间跨度：${context.timeframe}` : ''}

## 分析要求
1. **情绪轨迹** - 每一轮的情绪变化，绘制趋势
2. **转折点** - 识别导致情绪变化的关键时刻
3. **潜在升级** - 是否有冲突升级的风险
4. **降温机会** - 哪些时刻可以缓和气氛
5. **预测** - 基于趋势预测下一步可能的情绪走向

请以JSON格式返回情绪趋势分析。`;

    const messages = this.buildMessages(prompt);
    const result = await this.mimo.chat(MODELS.PRO, messages, {
      maxTokens: 6144,
      temperature: 0.4,
    });

    let trendAnalysis;
    try {
      trendAnalysis = JSON.parse(result.content);
    } catch {
      trendAnalysis = { rawAnalysis: result.content, parseError: true };
    }

    return this.formatResult({
      trendAnalysis,
      totalTurns: conversationTurns.length,
      usage: result.usage,
      demo: result.demo,
    });
  }

  /**
   * 生成心理博弈应对策略
   */
  async generateCounterTactics(identifiedTactics, context = {}) {
    const prompt = `对方使用了以下心理博弈策略，请生成针对性的应对方案：

## 识别到的策略
${JSON.stringify(identifiedTactics, null, 2)}

${context.myPosition ? `## 我方立场\n${context.myPosition}` : ''}
${context.goals ? `## 我方目标\n${context.goals}` : ''}
${context.constraints ? `## 约束条件\n${context.constraints}` : ''}

## 要求
为每个策略生成：
1. **识别确认** - 确认这是什么策略
2. **应对话术** - 具体的回应措辞（可直接使用）
3. **反转策略** - 如何将该策略转化为对我方有利
4. **底线守卫** - 如何在应对时不暴露我方底线

请以JSON格式返回。`;

    const messages = this.buildMessages(prompt);
    const result = await this.mimo.chat(MODELS.PRO, messages, {
      maxTokens: 4096,
      temperature: 0.5,
    });

    let tactics;
    try {
      tactics = JSON.parse(result.content);
    } catch {
      tactics = { rawTactics: result.content, parseError: true };
    }

    return this.formatResult({
      counterTactics: tactics,
      usage: result.usage,
      demo: result.demo,
    });
  }

  /**
   * 词典情绪分析
   */
  _lexiconAnalysis(text) {
    const result = {
      positiveSignals: [],
      negativeSignals: [],
      pressureSignals: [],
      cooperationSignals: [],
      sentimentScore: 0,
      pressureLevel: 0,
    };

    // 正面情绪
    Object.values(this.emotionLexicon.positive).flat().forEach(word => {
      if (text.includes(word)) {
        result.positiveSignals.push(word);
        result.sentimentScore += 1;
      }
    });

    // 负面情绪
    Object.values(this.emotionLexicon.negative).flat().forEach(word => {
      if (text.includes(word)) {
        result.negativeSignals.push(word);
        result.sentimentScore -= 1;
      }
    });

    // 压力信号
    Object.values(this.emotionLexicon.pressure).flat().forEach(word => {
      if (text.includes(word)) {
        result.pressureSignals.push(word);
        result.pressureLevel += 1;
      }
    });

    // 合作信号
    Object.values(this.emotionLexicon.cooperation).flat().forEach(word => {
      if (text.includes(word)) {
        result.cooperationSignals.push(word);
        result.sentimentScore += 0.5;
      }
    });

    // 归一化分数
    const total = result.positiveSignals.length + result.negativeSignals.length || 1;
    result.normalizedSentiment = result.sentimentScore / total;
    result.dominantMood = result.sentimentScore > 0 ? 'positive' :
      result.sentimentScore < 0 ? 'negative' : 'neutral';

    return result;
  }

  async process(task, context = {}) {
    if (task.action === 'trend') {
      return this.analyzeTrend(task.conversationTurns, context);
    }
    if (task.action === 'counterTactics') {
      return this.generateCounterTactics(task.identifiedTactics, context);
    }
    return this.analyzeText(task.text || task, context);
  }
}

/**
 * 格式化词典分析摘要（供 prompt 使用）
 */
function lexionAnalysisSummary(analysis) {
  if (!analysis) return '';
  const parts = [];
  if (analysis.positiveSignals.length) {
    parts.push(`词典初步分析 - 正面信号: ${analysis.positiveSignals.join(', ')}`);
  }
  if (analysis.negativeSignals.length) {
    parts.push(`词典初步分析 - 负面信号: ${analysis.negativeSignals.join(', ')}`);
  }
  if (analysis.pressureSignals.length) {
    parts.push(`词典初步分析 - 压力信号: ${analysis.pressureSignals.join(', ')}`);
  }
  if (analysis.cooperationSignals.length) {
    parts.push(`词典初步分析 - 合作信号: ${analysis.cooperationSignals.join(', ')}`);
  }
  parts.push(`词典初步分析 - 情感倾向: ${analysis.normalizedSentiment?.toFixed(2) || '0'} (${analysis.dominantMood || 'neutral'})`);
  parts.push(`词典初步分析 - 压力水平: ${analysis.pressureLevel || 0}`);
  return parts.join('\n');
}

module.exports = { EmotionAnalyst };
