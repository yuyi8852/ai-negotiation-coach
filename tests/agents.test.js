/**
 * Agent 单元测试
 * 使用 Node.js 内置 assert 模块，零依赖
 */

const assert = require('assert');

// Mock MiMo Client
class MockMiMoClient {
  constructor() {
    this.calls = [];
    this.demoMode = true;
  }

  async chat(model, messages, options = {}) {
    this.calls.push({ model, messages, options });
    return {
      content: JSON.stringify(this._getMockResponse(model)),
      usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      model,
      demo: true,
    };
  }

  async recognizeFile(base64, mimeType, prompt, options = {}) {
    this.calls.push({ type: 'recognizeFile', mimeType, prompt, options });
    return {
      content: JSON.stringify(this._getMockResponse('omni')),
      usage: { promptTokens: 50, completionTokens: 150, totalTokens: 200 },
      demo: true,
    };
  }

  async synthesize(text, options = {}) {
    this.calls.push({ type: 'synthesize', text, options });
    return { audio: Buffer.from('mock-audio'), format: 'mp3', demo: true };
  }

  _getMockResponse(model) {
    return {
      documentType: '采购合同',
      parties: [{ name: '甲方', role: '买方' }],
      keyTerms: { amount: '100万', period: '1年' },
      overallRiskLevel: '中等',
      overallScore: 45,
      dimensions: [],
      strategyStyle: '合作型',
      phases: [],
      executiveSummary: '测试摘要',
      keyFindings: ['发现1'],
    };
  }
}

// Test runner
let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(\`  ✅ \${name}\`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(\`  ❌ \${name}: \${err.message}\`);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log(\`  ✅ \${name}\`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(\`  ❌ \${name}: \${err.message}\`);
  }
}

// ============================================
// BaseAgent Tests
// ============================================
console.log('\n📋 BaseAgent Tests');

const { BaseAgent } = require('../lib/agents/base');

test('BaseAgent instantiation', () => {
  const mimo = new MockMiMoClient();
  const agent = new BaseAgent('TestAgent', '测试员', mimo);
  assert.strictEqual(agent.name, 'TestAgent');
  assert.strictEqual(agent.role, '测试员');
});

test('BaseAgent.buildMessages', () => {
  const mimo = new MockMiMoClient();
  const agent = new BaseAgent('TestAgent', '测试员', mimo);
  agent.systemPrompt = '你是测试员';

  const messages = agent.buildMessages('测试内容', '额外上下文');
  assert.strictEqual(messages.length, 3);
  assert.strictEqual(messages[0].role, 'system');
  assert.strictEqual(messages[1].role, 'system');
  assert.strictEqual(messages[2].role, 'user');
});

test('BaseAgent.formatResult', () => {
  const mimo = new MockMiMoClient();
  const agent = new BaseAgent('TestAgent', '测试员', mimo);

  const result = agent.formatResult({ data: 'test' });
  assert.strictEqual(result.agent, 'TestAgent');
  assert.strictEqual(result.role, '测试员');
  assert.ok(result.timestamp);
  assert.strictEqual(result.data, 'test');
});

test('BaseAgent.process throws not implemented', async () => {
  const mimo = new MockMiMoClient();
  const agent = new BaseAgent('TestAgent', '测试员', mimo);
  try {
    await agent.process({});
    assert.fail('Should have thrown');
  } catch (err) {
    assert.ok(err.message.includes('must be implemented'));
  }
});

// ============================================
// DocumentAnalyst Tests
// ============================================
console.log('\n📋 DocumentAnalyst Tests');

const { DocumentAnalyst } = require('../lib/agents/document-analyst');

test('DocumentAnalyst instantiation', () => {
  const mimo = new MockMiMoClient();
  const analyst = new DocumentAnalyst(mimo);
  assert.strictEqual(analyst.name, 'DocumentAnalyst');
  assert.strictEqual(analyst.role, '文档分析师');
  assert.ok(analyst.systemPrompt.length > 0);
});

testAsync('DocumentAnalyst.analyzeText', async () => {
  const mimo = new MockMiMoClient();
  const analyst = new DocumentAnalyst(mimo);
  const result = await analyst.analyzeText('这是一份采购合同...');
  assert.ok(result.agent === 'DocumentAnalyst');
  assert.ok(result.timestamp);
  assert.strictEqual(mimo.calls.length, 1);
});

testAsync('DocumentAnalyst.analyzeImage', async () => {
  const mimo = new MockMiMoClient();
  const analyst = new DocumentAnalyst(mimo);
  const result = await analyst.analyzeImage('base64data', 'image/jpeg');
  assert.ok(result.type === 'image');
  assert.ok(result.analysis);
});

// ============================================
// RiskAssessor Tests
// ============================================
console.log('\n📋 RiskAssessor Tests');

const { RiskAssessor } = require('../lib/agents/risk-assessor');

test('RiskAssessor instantiation', () => {
  const mimo = new MockMiMoClient();
  const assessor = new RiskAssessor(mimo);
  assert.strictEqual(assessor.name, 'RiskAssessor');
  assert.strictEqual(assessor.role, '风险评估师');
});

testAsync('RiskAssessor.assess', async () => {
  const mimo = new MockMiMoClient();
  const assessor = new RiskAssessor(mimo);
  const result = await assessor.assess({ documentType: '合同' });
  assert.ok(result.assessment);
  assert.ok(result.usage);
});

// ============================================
// StrategyAdvisor Tests
// ============================================
console.log('\n📋 StrategyAdvisor Tests');

const { StrategyAdvisor } = require('../lib/agents/strategy-advisor');

test('StrategyAdvisor instantiation', () => {
  const mimo = new MockMiMoClient();
  const advisor = new StrategyAdvisor(mimo);
  assert.strictEqual(advisor.name, 'StrategyAdvisor');
});

testAsync('StrategyAdvisor.developStrategy', async () => {
  const mimo = new MockMiMoClient();
  const advisor = new StrategyAdvisor(mimo);
  const result = await advisor.developStrategy({}, {});
  assert.ok(result.strategy);
});

// ============================================
// CounterParty Tests
// ============================================
console.log('\n📋 CounterParty Tests');

const { CounterParty } = require('../lib/agents/counter-party');

test('CounterParty instantiation', () => {
  const mimo = new MockMiMoClient();
  const agent = new CounterParty(mimo);
  assert.strictEqual(agent.name, 'CounterParty');
});

testAsync('CounterParty.simulate', async () => {
  const mimo = new MockMiMoClient();
  const agent = new CounterParty(mimo);
  const result = await agent.simulate({}, {});
  assert.ok(result.simulation);
});

// ============================================
// Negotiator Tests
// ============================================
console.log('\n📋 Negotiator Tests');

const { Negotiator } = require('../lib/agents/negotiator');

test('Negotiator instantiation', () => {
  const mimo = new MockMiMoClient();
  const agent = new Negotiator(mimo);
  assert.strictEqual(agent.name, 'Negotiator');
});

testAsync('Negotiator.synthesize', async () => {
  const mimo = new MockMiMoClient();
  const agent = new Negotiator(mimo);
  const result = await agent.synthesize({});
  assert.ok(result.report);
});

testAsync('Negotiator.generateAudio', async () => {
  const mimo = new MockMiMoClient();
  const agent = new Negotiator(mimo);
  const result = await agent.generateAudio('测试语音文本');
  assert.ok(result.audio);
  assert.ok(result.demo);
});

// ============================================
// LegalAdvisor Tests
// ============================================
console.log('\n📋 LegalAdvisor Tests');

const { LegalAdvisor } = require('../lib/agents/legal-advisor');

test('LegalAdvisor instantiation', () => {
  const mimo = new MockMiMoClient();
  const advisor = new LegalAdvisor(mimo);
  assert.strictEqual(advisor.name, 'LegalAdvisor');
  assert.ok(Object.keys(advisor.legalKnowledgeBase).length > 0);
});

test('LegalAdvisor has industry legal risks', () => {
  const mimo = new MockMiMoClient();
  const advisor = new LegalAdvisor(mimo);
  assert.ok(advisor.industryLegalRisks.tech.length > 0);
  assert.ok(advisor.industryLegalRisks.healthcare.length > 0);
  assert.ok(advisor.industryLegalRisks.finance.length > 0);
});

testAsync('LegalAdvisor.legalReview', async () => {
  const mimo = new MockMiMoClient();
  const advisor = new LegalAdvisor(mimo);
  const result = await advisor.legalReview({ documentType: '合同' });
  assert.ok(result.review);
  assert.ok(result.usage);
});

testAsync('LegalAdvisor._findRelevantLawArticles', () => {
  const mimo = new MockMiMoClient();
  const advisor = new LegalAdvisor(mimo);
  const articles = advisor._findRelevantLawArticles({}, 'tech');
  assert.ok(articles.length > 0);
  assert.ok(articles.some(a => a.category === '合同法'));
  assert.ok(articles.some(a => a.category === '数据保护'));
});

// ============================================
// EmotionAnalyst Tests
// ============================================
console.log('\n📋 EmotionAnalyst Tests');

const { EmotionAnalyst } = require('../lib/agents/emotion-analyst');

test('EmotionAnalyst instantiation', () => {
  const mimo = new MockMiMoClient();
  const analyst = new EmotionAnalyst(mimo);
  assert.strictEqual(analyst.name, 'EmotionAnalyst');
  assert.ok(analyst.emotionLexicon);
  assert.ok(analyst.psychologicalPatterns.length > 0);
});

test('EmotionAnalyst._lexiconAnalysis positive text', () => {
  const mimo = new MockMiMoClient();
  const analyst = new EmotionAnalyst(mimo);
  const result = analyst._lexiconAnalysis('我们非常满意这个方案，期望深度合作');
  assert.ok(result.positiveSignals.length > 0);
  assert.ok(result.cooperationSignals.length > 0);
  assert.ok(result.normalizedSentiment > 0);
});

test('EmotionAnalyst._lexiconAnalysis negative text', () => {
  const mimo = new MockMiMoClient();
  const analyst = new EmotionAnalyst(mimo);
  const result = analyst._lexiconAnalysis('我们严重不满，必须终止合同，否则采取法律手段');
  assert.ok(result.negativeSignals.length > 0);
  assert.ok(result.pressureSignals.length > 0);
  assert.ok(result.normalizedSentiment < 0);
});

testAsync('EmotionAnalyst.analyzeText', async () => {
  const mimo = new MockMiMoClient();
  const analyst = new EmotionAnalyst(mimo);
  const result = await analyst.analyzeText('我们对这个报价非常不满');
  assert.ok(result.analysis);
});

testAsync('EmotionAnalyst.analyzeTrend', async () => {
  const mimo = new MockMiMoClient();
  const analyst = new EmotionAnalyst(mimo);
  const turns = [
    { text: '我们对合作很感兴趣', speaker: 'A' },
    { text: '价格需要再谈谈', speaker: 'B' },
    { text: '这个价格已经很合理了', speaker: 'A' },
  ];
  const result = await analyst.analyzeTrend(turns);
  assert.ok(result.trendAnalysis);
  assert.strictEqual(result.totalTurns, 3);
});

// ============================================
// MarketIntel Tests
// ============================================
console.log('\n📋 MarketIntel Tests');

const { MarketIntel } = require('../lib/agents/market-intel');

test('MarketIntel instantiation', () => {
  const mimo = new MockMiMoClient();
  const intel = new MarketIntel(mimo);
  assert.strictEqual(intel.name, 'MarketIntel');
  assert.ok(intel.industryDatabase);
  assert.ok(intel.pricingStrategies);
});

test('MarketIntel._buildIndustryContext', () => {
  const mimo = new MockMiMoClient();
  const intel = new MarketIntel(mimo);
  const ctx = intel._buildIndustryContext(intel.industryDatabase.tech, 'tech');
  assert.ok(ctx.includes('行业数据参考'));
  assert.ok(ctx.includes('典型项目规模'));
  assert.ok(ctx.includes('市场趋势'));
});

testAsync('MarketIntel.analyzeMarket', async () => {
  const mimo = new MockMiMoClient();
  const intel = new MarketIntel(mimo);
  const result = await intel.analyzeMarket({ documentType: '采购合同' }, { industry: 'tech' });
  assert.ok(result.intel);
});

testAsync('MarketIntel.priceBenchmarking', async () => {
  const mimo = new MockMiMoClient();
  const intel = new MarketIntel(mimo);
  const result = await intel.priceBenchmarking({ product: '软件开发' }, { industry: 'tech' });
  assert.ok(result.benchmark);
});

testAsync('MarketIntel.vendorComparison', async () => {
  const mimo = new MockMiMoClient();
  const intel = new MarketIntel(mimo);
  const vendors = [
    { name: '供应商A', price: 100 },
    { name: '供应商B', price: 120 },
  ];
  const result = await intel.vendorComparison(vendors);
  assert.ok(result.comparison);
  assert.strictEqual(result.vendorCount, 2);
});

// ============================================
// Results
// ============================================
console.log('\n' + '='.repeat(50));
console.log(\`\n📊 Test Results: \${passed} passed, \${failed} failed\`);
if (failures.length > 0) {
  console.log('\nFailed tests:');
  failures.forEach(f => console.log(\`  - \${f.name}: \${f.error}\`));
}
console.log('');

// Exit with error code if any failures
process.exit(failed > 0 ? 1 : 0);
