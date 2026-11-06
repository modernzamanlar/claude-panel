// main/tally.js: oturum kaydından token toplamları, son bağlam, Claude Code maliyet kaydı (cost-state) ve sıkıştırmalar.
// Satır biçimleri gerçek CLI 2.1.318 kayıtlarından (aynı message.id'li bölünmüş asistan satırları, compactMetadata, cost-state).
const { test } = require('node:test');
const assert = require('node:assert');
const T = require('../src/main/tally');

const asst = (id, u, model = 'claude-opus-5-5') => ({ type: 'assistant', message: { id, model, usage: u, content: [] } });

test('feed: aynı message.id bir kez toplanır ama son bağlam her satırda güncellenir; kimliksiz mesaj ayrı sayılır', () => {
  const t = T.newTally();
  const u = { input_tokens: 2, cache_creation_input_tokens: 14979, cache_read_input_tokens: 34221, output_tokens: 4 };
  assert.strictEqual(T.feed(t, asst('msg_1', u)), null);
  assert.strictEqual(T.feed(t, asst('msg_1', { ...u, output_tokens: 8 })), null);
  assert.strictEqual(t.ctx, 2 + 14979 + 34221 + 8);
  T.feed(t, asst(undefined, { input_tokens: 1, output_tokens: 1 }));
  T.feed(t, asst(undefined, { input_tokens: 1, output_tokens: 1 }));
  const s = T.summary(t);
  assert.deepStrictEqual(s.tokens, { input: 4, output: 6, cacheRead: 34221, cacheCreate: 14979, total: 4 + 6 + 34221 + 14979 });
  assert.strictEqual(s.messages, 3);
  assert.strictEqual(s.ctx, 2);
});

test('feed: <synthetic>, usage yok/bozuk, negatif ve sayı olmayan alanlar; geçersiz satırlar yok sayılır', () => {
  const t = T.newTally();
  T.feed(t, asst('s', { input_tokens: 99 }, '<synthetic>'));
  T.feed(t, { type: 'assistant', message: { id: 'x' } });
  T.feed(t, { type: 'assistant', message: { id: 'y', usage: 'bozuk' } });
  T.feed(t, { type: 'assistant' });
  T.feed(t, asst('z', { input_tokens: -5, output_tokens: 'a', cache_read_input_tokens: Infinity, cache_creation_input_tokens: 3 }));
  for (const bad of [null, undefined, 'x', 5, { type: 'user' }]) assert.strictEqual(T.feed(t, bad), null);
  const s = T.summary(t);
  assert.deepStrictEqual(s.tokens, { input: 0, output: 0, cacheRead: 0, cacheCreate: 3, total: 3 });
  assert.strictEqual(s.messages, 1);
  assert.strictEqual(s.ctx, 3);
});

test('feed: compact_boundary sıkıştırma bilgisini döndürür, bağlamı sıkıştırma sonrası boyuta indirir; boyutsuz olay bağlamı değiştirmez', () => {
  const t = T.newTally();
  T.feed(t, asst('m', { input_tokens: 49000 }));
  const c = T.feed(t, { type: 'system', subtype: 'compact_boundary', timestamp: 'T1', compactMetadata: { trigger: 'manual', preTokens: 49224, postTokens: 16017 } });
  assert.deepStrictEqual(c, { trigger: 'manual', pre: 49224, post: 16017, ts: 'T1' });
  assert.strictEqual(t.ctx, 16017);
  const c2 = T.feed(t, { type: 'system', subtype: 'compact_boundary', timestamp: 'T2', compactMetadata: { trigger: 'auto' } });
  assert.strictEqual(c2.trigger, 'auto');
  assert.strictEqual(t.ctx, 16017);
  const s = T.summary(t);
  assert.strictEqual(s.compacts, 2);
  assert.deepStrictEqual(s.lastCompact, c2);
  assert.strictEqual(T.feed(t, { type: 'system', subtype: 'status' }), null);
});

test('feed: cost-state birikimli maliyet (son kayıt geçerli), bilinmeyen model bayrağı; bozuk değer yok sayılır', () => {
  const t = T.newTally();
  assert.deepStrictEqual([T.summary(t).cost, T.summary(t).costUnknown, T.summary(t).lastCompact], [null, false, null]);
  T.feed(t, { type: 'cost-state', totalCostUSD: 0.0033, hasUnknownModelCost: true });
  T.feed(t, { type: 'cost-state', totalCostUSD: 0.0066 });
  T.feed(t, { type: 'cost-state', totalCostUSD: 'x' });
  T.feed(t, { type: 'cost-state', totalCostUSD: NaN });
  const s = T.summary(t);
  assert.strictEqual(s.cost, 0.0066);
  assert.strictEqual(s.costUnknown, false);
});

test('ctxOf ve compactOf dışa açık; summary kopyalanabilir (Set yok)', () => {
  assert.strictEqual(T.ctxOf({ input_tokens: 1, cache_read_input_tokens: 2, cache_creation_input_tokens: 3, output_tokens: 4 }), 10);
  assert.strictEqual(typeof T.compactOf, 'function');
  const t = T.newTally(); T.feed(t, asst('a', { input_tokens: 1 }));
  assert.doesNotThrow(() => structuredClone(T.summary(t)));
  assert.ok(!Object.values(T.summary(t)).some(v => v instanceof Set));
});
