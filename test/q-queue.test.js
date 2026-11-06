// renderer/queue.js: sıradaki mesajlar (taşı, sil, düzenle, yazma kutusuna geri al); ekler korunur
const { test } = require('node:test');
const assert = require('node:assert');
const Q = require('../src/renderer/queue.js');

const A = { name: 'a.png', path: '/x/a.png' };
const mk = () => [{ text: 'bir', att: [] }, { text: 'iki', att: [A] }, { text: 'üç' }];
const texts = q => q.map(x => x.text);

test('move: yukarı/aşağı; sınırda ve geçersizde false', () => {
  const q = mk();
  assert.ok(Q.move(q, 1, -1)); assert.deepStrictEqual(texts(q), ['iki', 'bir', 'üç']);
  assert.ok(Q.move(q, 1, 1)); assert.deepStrictEqual(texts(q), ['iki', 'üç', 'bir']);
  assert.strictEqual(q[0].att[0], A, 'ek öğeyle birlikte taşınır');
  assert.ok(!Q.move(q, 0, -1)); assert.ok(!Q.move(q, 2, 1)); assert.ok(!Q.move(q, 9, -1)); assert.ok(!Q.move(q, 1.5, 1)); assert.ok(!Q.move(null, 0, 1));
  assert.deepStrictEqual(texts(q), ['iki', 'üç', 'bir']);
});

test('remove ve edit', () => {
  const q = mk();
  assert.strictEqual(Q.remove(q, 5), null);
  assert.strictEqual(Q.remove(q, 0).text, 'bir'); assert.deepStrictEqual(texts(q), ['iki', 'üç']);
  assert.strictEqual(Q.edit(q, 0, '  yeni  '), 'edited'); assert.deepStrictEqual(q[0], { text: 'yeni', att: [A] });
  assert.strictEqual(Q.edit(q, 0, ''), 'edited', 'eki olan öğe metinsiz kalabilir'); assert.strictEqual(q[0].text, '');
  assert.strictEqual(Q.edit(q, 1, null), 'removed', 'metin ve ek yoksa silinir'); assert.strictEqual(q.length, 1);
  assert.strictEqual(Q.edit(q, 3, 'x'), null);
});

test('takeBack: sıradan çıkarır; kutudaki yazı altına eklenir; ekler kopyalanır', () => {
  const q = mk();
  const r = Q.takeBack(q, 1, '');
  assert.deepStrictEqual(r, { text: 'iki', att: [A] }); assert.deepStrictEqual(texts(q), ['bir', 'üç']);
  assert.deepStrictEqual(Q.takeBack(q, 1, ' yazılan '), { text: 'üç\nyazılan', att: [] });
  assert.deepStrictEqual(Q.takeBack([{ att: [A] }], 0, 'kutu'), { text: 'kutu', att: [A] }, 'metinsiz öğe');
  assert.deepStrictEqual(Q.takeBack([{ text: '' }], 0), { text: '', att: [] });
  assert.strictEqual(Q.takeBack(q, 4, ''), null);
});

test('label: metin (200) ya da ek adları', () => {
  assert.strictEqual(Q.label({ text: 'x'.repeat(300) }).length, 200);
  assert.strictEqual(Q.label({ text: '', att: [A, { name: 'b.txt' }] }), 'a.png, b.txt');
  assert.strictEqual(Q.label(null), '');
  assert.strictEqual(Q.label({}), '');
  assert.strictEqual(globalThis.msgQueue, Q);
});
