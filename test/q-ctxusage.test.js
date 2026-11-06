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

// ---- Bilgi paneli görünümü, token/maliyet toplamları, sıkıştırma satırı ----
const CU = require(MOD);

test('fmtTok: kısa biçim; geçersiz değer tire', () => {
  assert.strictEqual(CU.fmtTok(853), '853');
  assert.strictEqual(CU.fmtTok(1000), '1k');
  assert.strictEqual(CU.fmtTok(61500), '61.5k');
  assert.strictEqual(CU.fmtTok(1e6), '1M');
  assert.strictEqual(CU.fmtTok(1234567), '1.23M');
  assert.strictEqual(CU.fmtTok(12.5e6), '12.5M');
  assert.strictEqual(CU.fmtTok(20e6), '20M');
  for (const bad of [null, undefined, -1, NaN, Infinity, '5']) assert.strictEqual(CU.fmtTok(bad), '—');
});

test('fmtUsd: 1 sentin altı 4 basamak, sıfır ve üstü 2 basamak; geçersiz tire', () => {
  assert.strictEqual(CU.fmtUsd(0.0034), '$0.0034');
  assert.strictEqual(CU.fmtUsd(0), '$0.00');
  assert.strictEqual(CU.fmtUsd(1.236), '$1.24');
  assert.strictEqual(CU.fmtUsd(null), '—');
  assert.strictEqual(CU.fmtUsd(-2), '—');
});

test('view: güncel rapor varsa sayılar ve kategoriler rapordan; sıkıştırma payı dilim olarak eklenir', () => {
  const r = parse(fx('context-opus-1m.json'));
  const v = CU.view({ used: 5000, window: 200000, report: r, stale: false });
  assert.strictEqual(v.src, 'report');
  assert.strictEqual(v.used, r.total);
  assert.strictEqual(v.window, 1000000);
  assert.strictEqual(v.pct, Math.round(r.total / 1e6 * 100));
  assert.strictEqual(v.free, r.free);
  assert.strictEqual(v.buffer, r.buffer);
  assert.ok(r.buffer > 0);
  assert.deepStrictEqual(v.parts[v.parts.length - 1], { name: 'Autocompact buffer', label: 'Sıkıştırma payı', tokens: r.buffer });
  assert.ok(v.parts.every(p => !/deferred/i.test(p.name)));
  assert.ok(v.deferred.length > 0 && v.deferred.every(p => /deferred/i.test(p.name) && p.label.startsWith('Ertelenmiş')));
  assert.strictEqual(v.memory, r.memory);
});

test('view: rapor eskiyse kullanılan son yanıttan, kategoriler eski rapordan; payı olmayan rapor', () => {
  const r = { ...parse(fx('context-opus-1m.json')), buffer: 0 };
  const v = CU.view({ used: 90000, window: null, report: r, stale: true });
  assert.strictEqual(v.src, 'usage');
  assert.strictEqual(v.used, 90000);
  assert.strictEqual(v.window, 1000000);
  assert.strictEqual(v.pct, 9);
  assert.ok(v.parts.every(p => p.name !== 'Autocompact buffer'));
  const v2 = CU.view({ used: 0, report: r, stale: true });
  assert.strictEqual(v2.used, null); assert.strictEqual(v2.pct, null); assert.strictEqual(v2.src, null);
  const v3 = CU.view({ used: 10, report: { ...r, window: null }, stale: true, window: 100 });
  assert.strictEqual(v3.window, 100); assert.strictEqual(v3.pct, 10);
});

test('view: rapor yoksa kullanılan + pencereden boş alan; pencere yoksa yüzde ve boş alan bilinmiyor; hiç veri yoksa null', () => {
  const v = CU.view({ used: 50000, window: 200000, report: null });
  assert.deepStrictEqual(v, { used: 50000, window: 200000, pct: 25, src: 'usage', parts: null, deferred: [], free: 150000, buffer: 0, memory: null });
  const v2 = CU.view({ used: 50000, window: 0 });
  assert.strictEqual(v2.window, null); assert.strictEqual(v2.pct, null); assert.strictEqual(v2.free, null);
  const v3 = CU.view({ used: 300000, window: 200000 });
  assert.strictEqual(v3.free, 0);
  for (const o of [null, undefined, {}, { used: -1, window: 'x' }]) {
    const e = CU.view(o);
    assert.deepStrictEqual([e.used, e.window, e.pct, e.src, e.parts, e.free], [null, null, null, null, null, null]);
  }
});

test('liveAdd: aynı message.id bir kez sayılır; kimliksiz mesaj her seferinde; usage yoksa ve <synthetic> atlanır', () => {
  const m = { id: 'msg_1', model: 'claude-opus-5-5', usage: { input_tokens: 5, output_tokens: 20, cache_read_input_tokens: 42000, cache_creation_input_tokens: 100 } };
  let a = CU.liveAdd(null, m);
  a = CU.liveAdd(a, m);
  assert.deepStrictEqual(a, { ids: ['msg_1'], input: 5, output: 20, cacheRead: 42000, cacheCreate: 100 });
  a = CU.liveAdd(a, { usage: { input_tokens: 1, output_tokens: 'x' } });
  a = CU.liveAdd(a, { usage: { input_tokens: 1 } });
  assert.strictEqual(a.input, 7); assert.strictEqual(a.output, 20);
  const b = CU.liveAdd(a, { id: 'msg_s', model: '<synthetic>', usage: { input_tokens: 99 } });
  assert.strictEqual(b, a); assert.strictEqual(b.input, 7);
  assert.strictEqual(CU.liveAdd(a, { usage: 'bozuk' }), a);
  assert.strictEqual(CU.liveAdd(a, null), a);
  assert.deepStrictEqual(CU.liveAdd(undefined, {}), { ids: [], input: 0, output: 0, cacheRead: 0, cacheCreate: 0 });
});

test('tokenTotals: kayıt + canlı tur; biri yoksa diğeri; ikisi de yoksa null; bozuk alanlar 0', () => {
  const st = { tokens: { input: 10, output: 20, cacheRead: 30, cacheCreate: 40 } };
  assert.deepStrictEqual(CU.tokenTotals(st, { input: 1, output: 2, cacheRead: 3, cacheCreate: 4 }), { input: 11, output: 22, cacheRead: 33, cacheCreate: 44, total: 110 });
  assert.deepStrictEqual(CU.tokenTotals(st, null), { input: 10, output: 20, cacheRead: 30, cacheCreate: 40, total: 100 });
  assert.deepStrictEqual(CU.tokenTotals(null, { input: 1, output: 'x' }), { input: 1, output: 0, cacheRead: 0, cacheCreate: 0, total: 1 });
  assert.deepStrictEqual(CU.tokenTotals({ tokens: { input: 'x' } }, null), { input: 0, output: 0, cacheRead: 0, cacheCreate: 0, total: 0 });
  assert.strictEqual(CU.tokenTotals({}, null), null);
  assert.strictEqual(CU.tokenTotals(null, null), null);
});

test('costView: kayıt ve panel sayacından büyük olan (daha yeni) seçilir; kaynak ve bilinmeyen model bayrağı', () => {
  assert.deepStrictEqual(CU.costView(null, null), { usd: null, src: null, unknownModel: false });
  assert.deepStrictEqual(CU.costView({ cost: 'x' }, { usd: NaN }), { usd: null, src: null, unknownModel: false });
  assert.deepStrictEqual(CU.costView({ cost: 0.5, costUnknown: true }, null), { usd: 0.5, src: 'record', unknownModel: true, withOutside: true });
  assert.deepStrictEqual(CU.costView({ cost: 0.5 }, { usd: 0.7 }), { usd: 0.7, src: 'panel', unknownModel: false, withOutside: true });
  assert.deepStrictEqual(CU.costView({ cost: 0.5 }, { usd: 0.5 }), { usd: 0.5, src: 'record', unknownModel: false, withOutside: true });
  assert.deepStrictEqual(CU.costView(null, { usd: 0.01 }), { usd: 0.01, src: 'panel', unknownModel: false, withOutside: false });
});

test('compactOf: akış (snake_case) ve kayıt (camelCase) biçimi; eksik alanlar null, tetikleyici varsayılanı elle', () => {
  assert.deepStrictEqual(CU.compactOf({ timestamp: 'T', compact_metadata: { trigger: 'auto', pre_tokens: 168000, post_tokens: 21000 } }), { trigger: 'auto', pre: 168000, post: 21000, ts: 'T' });
  assert.deepStrictEqual(CU.compactOf({ timestamp: 'T', compactMetadata: { trigger: 'manual', preTokens: 49224, postTokens: 16017 } }), { trigger: 'manual', pre: 49224, post: 16017, ts: 'T' });
  assert.deepStrictEqual(CU.compactOf({ compact_metadata: { trigger: 'x', pre_tokens: 'a' } }, 0), { trigger: 'manual', pre: null, post: null, ts: new Date(0).toISOString() });
  assert.deepStrictEqual(CU.compactOf(null, 0), { trigger: 'manual', pre: null, post: null, ts: new Date(0).toISOString() });
  assert.strictEqual(typeof CU.compactOf({}).ts, 'string');
});

test('compactText: tetikleyici ve boyut; yalnızca önce boyutu; boyut yok', () => {
  assert.strictEqual(CU.compactText({ trigger: 'auto', pre: 168000, post: 21000 }), 'Sohbet sıkıştırıldı (otomatik) · 168k → 21k token');
  assert.strictEqual(CU.compactText({ trigger: 'manual', pre: 49224, post: null }), 'Sohbet sıkıştırıldı (elle) · önce 49.2k token');
  assert.strictEqual(CU.compactText({ trigger: 'manual', pre: null, post: 5 }), 'Sohbet sıkıştırıldı (elle)');
  assert.strictEqual(CU.compactText(null), 'Sohbet sıkıştırıldı (elle)');
});
