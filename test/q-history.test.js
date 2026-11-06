// renderer/history.js: yazma kutusunda ↑/↓ ile önceki mesajlar
const { test } = require('node:test');
const assert = require('node:assert');
const H = require('../src/renderer/history.js');

test('entries: yalnız kullanıcı mesajları, ek satırı atılır, art arda tekrar bir kez', () => {
  const msgs = [
    { r: 'u', t: 'ilk' }, { r: 'a', t: 'yanıt' }, { r: 'u', t: 'ilk' }, { r: 'u', t: ' ikinci \n📎 a.png, b.txt' },
    { r: 'u', t: '📎 yalnız ek' }, { r: 'u', t: 5 }, null, { r: 'u', t: 'ilk' },
  ];
  assert.deepStrictEqual(H.entries(msgs), ['ilk', 'ikinci', 'ilk']);
  assert.deepStrictEqual(H.entries(), []);
});

test('canUp / canDown: boş kutu ya da ilk satır; ↓ yalnız gezinirken ve son satırda', () => {
  assert.ok(H.canUp('', 0, 0));
  assert.ok(H.canUp('tek satır', 3, 3));
  assert.ok(!H.canUp('a\nb', 3, 3), 'ikinci satırda ↑ imleci yukarı taşır');
  assert.ok(H.canUp('a\nb', 1, 1));
  assert.ok(!H.canUp('abc', 0, 2), 'seçim varken hayır');
  assert.ok(!H.canDown(null, '', 0, 0));
  assert.ok(!H.canDown({ idx: -1 }, '', 0, 0));
  assert.ok(H.canDown({ idx: 0 }, 'a\nb', 3, 3));
  assert.ok(!H.canDown({ idx: 0 }, 'a\nb', 1, 1), 'ilk satırda ↓ imleci aşağı taşır');
  assert.ok(!H.canDown({ idx: 0 }, 'ab', 0, 1));
  assert.ok(H.firstLine('ab\nc', 2) && !H.firstLine('ab\nc', 4));
  assert.ok(H.lastLine('ab\nc', 3) && !H.lastLine('ab\nc', 1));
});

test('step: ↑ eskiye, ↓ yeniye, en sonda taslağa döner; uçta hareket yok', () => {
  const L = ['bir', 'iki', 'üç'];
  let r = H.step(null, L, -1, 'taslak');
  assert.deepStrictEqual(r, { state: { idx: 0, draft: 'taslak' }, text: 'üç' });
  r = H.step(r.state, L, -1, 'üç');
  assert.deepStrictEqual(r, { state: { idx: 1, draft: 'taslak' }, text: 'iki' });
  r = H.step(r.state, L, -1, 'iki');
  assert.deepStrictEqual(r.text, 'bir');
  assert.strictEqual(H.step(r.state, L, -1, 'bir'), null, 'en eskide ↑ yok');
  r = H.step(r.state, L, 1, 'bir');
  assert.deepStrictEqual(r, { state: { idx: 1, draft: 'taslak' }, text: 'iki' });
  r = H.step(H.step(r.state, L, 1).state, L, 1);
  assert.deepStrictEqual(r, { state: { idx: -1, draft: '' }, text: 'taslak' }, 'en yeniden sonra taslak');
  assert.strictEqual(H.step(r.state, L, 1, 'taslak'), null, 'gezinmiyorken ↓ yok');
  assert.strictEqual(H.step({ idx: -1 }, [], -1, ''), null, 'geçmiş boş');
  assert.strictEqual(H.step(null, undefined, -1), null);
  assert.deepStrictEqual(H.step(null, ['x'], -1), { state: { idx: 0, draft: '' }, text: 'x' }, 'metin verilmezse boş taslak');
  assert.strictEqual(globalThis.inputHistory, H);
});
