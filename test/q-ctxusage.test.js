// renderer/ctxusage.js: Claude Code /context çıktısının ayrıştırılması ve result.modelUsage'dan bağlam penceresi.
// Fikstürler gerçek CLI çıktısıdır (claude 2.1.287, `claude -p /context --resume <id> --no-session-persistence --output-format json`);
// yollar anonimleştirildi, uzun MCP/skill tabloları kısaltıldı.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const MOD = require.resolve('../src/renderer/ctxusage.js');
const { parse, tokens, windowOf, label } = require(MOD);
const fx = n => fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8');

test('tokens: k/m ekleri, ~ ve < önekleri, binlik virgül; tanınmayan biçim null', () => {
  assert.strictEqual(tokens('31.9k'), 31900);
  assert.strictEqual(tokens('200k'), 200000);
  assert.strictEqual(tokens('1m'), 1000000);
  assert.strictEqual(tokens('1.2M'), 1200000);
  assert.strictEqual(tokens('853'), 853);
  assert.strictEqual(tokens('~360'), 360);
  assert.strictEqual(tokens('< 20'), 20);
  assert.strictEqual(tokens('1,234'), 1234);
  assert.strictEqual(tokens(''), null);
  assert.strictEqual(tokens(undefined), null);
  assert.strictEqual(tokens('yok'), null);
  assert.strictEqual(tokens('.'), null);
});

test('parse: haiku oturumu (200k pencere, sıkıştırma payı yok)', () => {
  const r = parse(fx('context-haiku.json'));
  assert.strictEqual(r.model, 'claude-haiku-4-5-20251001');
  assert.strictEqual(r.total, 31900);
  assert.strictEqual(r.window, 200000);
  assert.strictEqual(r.free, 168100);
  assert.strictEqual(r.buffer, 0);
  assert.deepStrictEqual(r.categories.map(c => [c.name, c.tokens, c.deferred]), [
    ['System prompt', 6600, false], ['System tools', 18000, false], ['System tools (deferred)', 20900, true],
    ['Memory files', 853, false], ['Skills', 2300, false], ['Messages', 4100, false]]);
  assert.deepStrictEqual(r.memory, [{ type: 'User', path: '/Users/kullanici/.claude/CLAUDE.md', tokens: 853 }]);
  // ertelenmiş olanlar dışındaki kategorilerin toplamı rapordaki toplamla örtüşür (yuvarlama payıyla)
  const sum = r.categories.filter(c => !c.deferred).reduce((a, c) => a + c.tokens, 0);
  assert.ok(Math.abs(sum - r.total) < 200, sum);
});

test('parse: MCP sunucusu ve özel ajan olan oturum; ertelenmiş MCP araçları ayrı işaretlenir', () => {
  const r = parse(fx('context-mcp.json'));
  assert.strictEqual(r.total, 32800);
  const by = Object.fromEntries(r.categories.map(c => [c.name, c]));
  assert.strictEqual(by['MCP tools'].tokens, 437);
  assert.strictEqual(by['MCP server instructions'].tokens, 1600);
  assert.strictEqual(by['MCP tools (deferred)'].tokens, 303500);
  assert.strictEqual(by['MCP tools (deferred)'].deferred, true);
  assert.strictEqual(by['Custom agents'].tokens, 20);
  assert.strictEqual(r.categories.length, 10);
  assert.strictEqual(r.free, 167200);
});

test('parse: 1M pencereli model ("1m" küçük harf) ve sıkıştırma payı', () => {
  const r = parse(fx('context-opus-1m.json'));
  assert.strictEqual(r.model, 'claude-opus-5-5[1m]');
  assert.strictEqual(r.window, 1000000);
  assert.strictEqual(r.total, 40800);
  assert.strictEqual(r.buffer, 33000);
  assert.strictEqual(r.free, 926200);
  assert.ok(!r.categories.some(c => /buffer|Free/i.test(c.name)));
  assert.strictEqual(r.total + r.free + r.buffer, r.window);
});

test('parse: hata, bozuk JSON, metinsiz result ve rapor olmayan çıktı null döner', () => {
  assert.strictEqual(parse(JSON.stringify({ is_error: true, result: '## Context Usage' })), null);
  assert.strictEqual(parse('{bozuk'), null);
  assert.strictEqual(parse('null'), null);
  assert.strictEqual(parse(JSON.stringify({ result: 42 })), null);
  assert.strictEqual(parse(''), null);
  assert.strictEqual(parse(undefined), null);
  assert.strictEqual(parse('No conversation found with session ID: x'), null);
  assert.strictEqual(parse(JSON.stringify({ result: 'Unknown command: /context' })), null);
  // toplam satırı var ama kategori tablosu yok
  assert.strictEqual(parse('**Tokens:** 1k / 200k (0%)\n\n### Memory Files\n\n| Type | Path | Tokens |\n|---|---|---|\n| User | a | 5 |'), null);
});

test('parse: doğrudan Markdown; model satırı yoksa null, boş alan satırı yoksa pencereden hesaplanır', () => {
  const md = [
    '**Tokens:** 1.5k / 10k (15%)', '', '### Estimated usage by category', '',
    '| Category | Tokens | Percentage |', '|----------|--------|------------|',
    '| Messages | 1.5k | 15% |', '| Garip | ? | 0% |', '| Compact buffer | 2k | 20% |',
    '', '### Memory Files', '', '| Type | Path | Tokens |', '|---|---|---|', '| Project | /p/CLAUDE.md | — |',
  ].join('\n');
  const r = parse(md);
  assert.strictEqual(r.model, null);
  assert.deepStrictEqual(r.categories, [{ name: 'Messages', tokens: 1500, deferred: false }, { name: 'Garip', tokens: 0, deferred: false }]);
  assert.strictEqual(r.buffer, 2000);
  assert.strictEqual(r.free, 6500);
  assert.deepStrictEqual(r.memory, [{ type: 'Project', path: '/p/CLAUDE.md', tokens: 0 }]);
});

test('parse: rapordaki pencere okunamazsa modelUsage kullanılır; o da yoksa pencere ve boş alan bilinmez', () => {
  const md = '**Model:** x\n**Tokens:** 2k / 0k (0%)\n\n### Estimated usage by category\n\n| Category | Tokens | Percentage |\n|---|---|---|\n| Messages | 2k | 1% |\n';
  const r = parse(JSON.stringify({ result: md, modelUsage: { a: { contextWindow: 200000 } } }));
  assert.strictEqual(r.window, 200000);
  assert.strictEqual(r.free, 198000);
  const r2 = parse(md);
  assert.strictEqual(r2.window, null);
  assert.strictEqual(r2.free, null);
});

test('windowOf: en büyük contextWindow; boş, nesne olmayan ve bozuk girdiler null', () => {
  assert.strictEqual(windowOf({ 'claude-opus-5-5': { contextWindow: 1000000 }, 'claude-haiku-4-5': { contextWindow: 200000 } }), 1000000);
  assert.strictEqual(windowOf({ a: { contextWindow: 200000 }, b: null, c: {} }), 200000);
  assert.strictEqual(windowOf({}), null);
  assert.strictEqual(windowOf(null), null);
  assert.strictEqual(windowOf('200000'), null);
  assert.strictEqual(windowOf(JSON.parse(fx('context-haiku.json')).modelUsage), 200000);
});

test('label: bilinen kategoriler Türkçe, ertelenmişler ayrı, bilinmeyen ad olduğu gibi', () => {
  assert.strictEqual(label('System prompt'), 'Sistem istemi');
  assert.strictEqual(label('MCP tools (deferred)'), 'Ertelenmiş MCP araçları');
  assert.strictEqual(label('System tools (deferred)'), 'Ertelenmiş sistem araçları');
  assert.strictEqual(label('Autocompact buffer'), 'Sıkıştırma payı');
  assert.strictEqual(label('Yeni kategori'), 'Yeni kategori');
});

test('tarayıcıda window.ctxUsage olarak yüklenir', () => {
  const window = {};
  vm.runInNewContext(fs.readFileSync(MOD, 'utf8'), { window }, { filename: MOD });
  assert.strictEqual(typeof window.ctxUsage.parse, 'function');
  assert.strictEqual(window.ctxUsage.parse(fx('context-haiku.json')).total, 31900);
});
