/**
 * Utility 模块单元测试
 */

const assert = require('assert');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(\`  ✅ \${name}\`);
  } catch (err) {
    failed++;
    console.log(\`  ❌ \${name}: \${err.message}\`);
  }
}

// ============================================
// Validators Tests
// ============================================
console.log('\n📋 Validators Tests');

const { Validators } = require('../lib/utils/validators');

test('validateAnalysisRequest - valid', () => {
  const result = Validators.validateAnalysisRequest({ document: '这是一份合同内容...' });
  assert.strictEqual(result.valid, true);
});

test('validateAnalysisRequest - missing document', () => {
  const result = Validators.validateAnalysisRequest({});
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.length > 0);
});

test('validateAnalysisRequest - short document', () => {
  const result = Validators.validateAnalysisRequest({ document: 'short' });
  assert.strictEqual(result.valid, false);
});

test('validateFileUpload - valid', () => {
  const result = Validators.validateFileUpload({
    originalname: 'contract.jpg',
    mimetype: 'image/jpeg',
    size: 1024000,
  });
  assert.strictEqual(result.valid, true);
});

test('validateFileUpload - dangerous filename', () => {
  const result = Validators.validateFileUpload({
    originalname: '../../etc/passwd',
    size: 1024,
  });
  assert.strictEqual(result.valid, false);
});

test('validateFileUpload - oversized file', () => {
  const result = Validators.validateFileUpload({
    originalname: 'big.pdf',
    mimetype: 'application/pdf',
    size: 50 * 1024 * 1024,
  });
  assert.strictEqual(result.valid, false);
});

test('validateParams - required fields', () => {
  const result = Validators.validateParams(
    { name: 'test' },
    { name: { required: true, type: 'string' }, age: { required: true, type: 'number' } }
  );
  assert.strictEqual(result.valid, false);
});

test('validateParams - valid', () => {
  const result = Validators.validateParams(
    { name: 'test', age: 25 },
    { name: { required: true, type: 'string' }, age: { required: true, type: 'number' } }
  );
  assert.strictEqual(result.valid, true);
});

test('sanitizeText removes script tags', () => {
  const result = Validators.sanitizeText('hello <script>alert("xss")</script> world');
  assert.ok(!result.includes('<script>'));
  assert.ok(result.includes('hello'));
});

test('truncate text', () => {
  assert.strictEqual(Validators.truncate('hello world', 8), 'hello...');
  assert.strictEqual(Validators.truncate('hi', 10), 'hi');
});

test('detectLanguage Chinese', () => {
  assert.strictEqual(Validators.detectLanguage('这是一段中文文本'), 'zh');
});

test('detectLanguage English', () => {
  assert.strictEqual(Validators.detectLanguage('This is English text'), 'en');
});

test('validateJSON valid', () => {
  const result = Validators.validateJSON('{"key": "value"}');
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.data.key, 'value');
});

test('validateJSON invalid', () => {
  const result = Validators.validateJSON('not json');
  assert.strictEqual(result.valid, false);
});

// ============================================
// Formatters Tests
// ============================================
console.log('\n📋 Formatters Tests');

const { Formatters } = require('../lib/utils/formatters');

test('riskLevel high', () => {
  const r = Formatters.riskLevel(85);
  assert.strictEqual(r.level, '极高风险');
  assert.strictEqual(r.emoji, '🔴');
});

test('riskLevel low', () => {
  const r = Formatters.riskLevel(10);
  assert.strictEqual(r.level, '极低风险');
  assert.strictEqual(r.emoji, '✅');
});

test('currency CNY', () => {
  assert.strictEqual(Formatters.currency(150000000), '¥1.50亿');
  assert.strictEqual(Formatters.currency(50000), '¥5.00万');
});

test('duration formatting', () => {
  assert.strictEqual(Formatters.duration(500), '500毫秒');
  assert.strictEqual(Formatters.duration(5000), '5.0秒');
  assert.strictEqual(Formatters.duration(125000), '2分5秒');
});

test('tokens formatting', () => {
  const result = Formatters.tokens({ promptTokens: 100, completionTokens: 200, totalTokens: 300 });
  assert.ok(result.includes('300'));
  assert.ok(result.includes('100'));
});

test('datetime formatting', () => {
  const d = new Date('2024-01-15T10:30:00');
  assert.strictEqual(Formatters.datetime(d, 'date'), '2024-01-15');
  assert.strictEqual(Formatters.datetime(d, 'time'), '10:30:00');
});

test('toMarkdown generates sections', () => {
  const md = Formatters.toMarkdown({
    title: '测试报告',
    summary: '这是摘要',
    risks: [{ name: '风险1', score: 70, description: '描述', mitigation: '措施' }],
  });
  assert.ok(md.includes('# 测试报告'));
  assert.ok(md.includes('执行摘要'));
  assert.ok(md.includes('风险评估'));
});

test('toCSVRow handles special chars', () => {
  const row = Formatters.toCSVRow(['hello', 'world,\"test"', 'normal']);
  assert.ok(row.startsWith('hello,'));
  assert.ok(row.includes('"world,\"test\""'));
});

test('radarChartData format', () => {
  const data = Formatters.radarChartData([
    { name: '法律', score: 80 },
    { name: '财务', score: 60 },
  ]);
  assert.strictEqual(data.labels.length, 2);
  assert.strictEqual(data.datasets[0].data.length, 2);
});

// ============================================
// Cache Tests
// ============================================
console.log('\n📋 Cache Tests');

const { Cache } = require('../lib/utils/cache');

test('Cache set and get', () => {
  const cache = new Cache({ defaultTTL: 60000 });
  cache.set('key1', 'value1');
  assert.strictEqual(cache.get('key1'), 'value1');
  cache.destroy();
});

test('Cache miss returns null', () => {
  const cache = new Cache();
  assert.strictEqual(cache.get('nonexistent'), null);
  cache.destroy();
});

test('Cache TTL expiration', () => {
  const cache = new Cache({ defaultTTL: 1 }); // 1ms
  cache.set('key1', 'value1');
  // Simulate time passing
  const entry = cache.store.get('key1');
  entry.expiresAt = Date.now() - 1000; // Expire
  assert.strictEqual(cache.get('key1'), null);
  cache.destroy();
});

test('Cache LRU eviction', () => {
  const cache = new Cache({ maxSize: 3, defaultTTL: 60000 });
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);
  cache.set('d', 4); // Should evict 'a'
  assert.strictEqual(cache.get('a'), null);
  assert.strictEqual(cache.get('d'), 4);
  cache.destroy();
});

test('Cache has', () => {
  const cache = new Cache({ defaultTTL: 60000 });
  cache.set('key1', 'value1');
  assert.strictEqual(cache.has('key1'), true);
  assert.strictEqual(cache.has('key2'), false);
  cache.destroy();
});

test('Cache getOrSet', async () => {
  const cache = new Cache({ defaultTTL: 60000 });
  const val = await cache.getOrSet('computed', () => 42);
  assert.strictEqual(val, 42);
  assert.strictEqual(cache.get('computed'), 42);
  cache.destroy();
});

test('Cache clearByPrefix', () => {
  const cache = new Cache({ defaultTTL: 60000 });
  cache.set('user:1', 'a');
  cache.set('user:2', 'b');
  cache.set('session:1', 'c');
  const count = cache.clearByPrefix('user:');
  assert.strictEqual(count, 2);
  assert.strictEqual(cache.get('session:1'), 'c');
  cache.destroy();
});

test('Cache stats', () => {
  const cache = new Cache({ defaultTTL: 60000 });
  cache.set('k', 'v');
  cache.get('k');
  cache.get('miss');
  const stats = cache.getStats();
  assert.strictEqual(stats.hits, 1);
  assert.strictEqual(stats.misses, 1);
  cache.destroy();
});

test('Cache memory usage', () => {
  const cache = new Cache({ defaultTTL: 60000 });
  cache.set('key', 'value');
  const usage = cache.getMemoryUsage();
  assert.ok(usage.bytes > 0);
  assert.ok(usage.humanReadable);
  cache.destroy();
});

// ============================================
// Results
// ============================================
console.log('\n' + '='.repeat(50));
console.log(\`\n📊 Test Results: \${passed} passed, \${failed} failed\`);
process.exit(failed > 0 ? 1 : 0);
