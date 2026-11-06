// renderer/mention.js: "@" belirteci, biçim ve yerine koyma
const { test } = require('node:test');
const assert = require('node:assert');
const M = require('../src/renderer/mention.js');

test('token: satır başı ya da boşluktan sonraki @; e-posta açmaz; tırnaklı yol', () => {
  assert.deepStrictEqual(M.token('@src'), { start: 0, end: 4, q: 'src', quoted: false });
  assert.deepStrictEqual(M.token('bak @'), { start: 4, end: 5, q: '', quoted: false });
  assert.deepStrictEqual(M.token('a\n@x/y'), { start: 2, end: 6, q: 'x/y', quoted: false });
  assert.strictEqual(M.token('ali@site.com'), null);
  assert.strictEqual(M.token('@a b'), null, 'boşluktan sonra belirteç biter');
  assert.deepStrictEqual(M.token('@"alt kl'), { start: 0, end: 8, q: 'alt kl', quoted: true });
  assert.deepStrictEqual(M.token('@"alt kl" son', 4), { start: 0, end: 9, q: 'al', quoted: true }, 'imleç tırnak içinde: kapanan tırnak dahil');
  assert.deepStrictEqual(M.token('@abc def', 2), { start: 0, end: 4, q: 'a', quoted: false }, 'imleç ortada: sözcük sonuna kadar');
  assert.strictEqual(M.token(7), null);
  assert.deepStrictEqual(M.token('@q', 99), { start: 0, end: 2, q: 'q', quoted: false }, 'geçersiz imleç → metnin sonu');
  assert.deepStrictEqual(M.token('@q', -3), { start: 0, end: 2, q: 'q', quoted: false });
});

test('format: klasörde "/", boşluk ya da tırnakta tırnaklama', () => {
  assert.strictEqual(M.format({ rel: 'src/a.js' }), '@src/a.js');
  assert.strictEqual(M.format({ rel: 'src', dir: true }), '@src/');
  assert.strictEqual(M.format({ rel: 'alt klasör/a b.txt' }), '@"alt klasör/a b.txt"');
  assert.strictEqual(M.format({ rel: 'x"y' }), '@"x"y"');
});

test('apply: dosyadan sonra boşluk; klasörde tırnak açık kalır ve öneri sürer', () => {
  const f = { rel: 'src/a.js', name: 'a.js' };
  assert.deepStrictEqual(M.apply('bak @sr', M.token('bak @sr'), f), { text: 'bak @src/a.js ', caret: 14 });
  assert.deepStrictEqual(M.apply('@sr sonra', M.token('@sr sonra', 3), f), { text: '@src/a.js sonra', caret: 10 }, 'arkada boşluk varsa yenisi eklenmez, imleç boşluğun ardında');
  const d = { rel: 'src', name: 'src', dir: true };
  const r = M.apply('@s', M.token('@s'), d);
  assert.deepStrictEqual(r, { text: '@src/', caret: 5 });
  assert.deepStrictEqual(M.token(r.text, r.caret).q, 'src/', 'klasör seçilince içi önerilir');
  const qd = { rel: 'alt klasör', name: 'alt klasör', dir: true };
  const r2 = M.apply('@al', M.token('@al'), qd);
  assert.deepStrictEqual(r2, { text: '@"alt klasör/', caret: 13 });
  assert.deepStrictEqual(M.token(r2.text, r2.caret), { start: 0, end: 13, q: 'alt klasör/', quoted: true });
  assert.deepStrictEqual(M.apply('@"alt klasör/a', M.token('@"alt klasör/a'), { rel: 'alt klasör/a b.txt' }), { text: '@"alt klasör/a b.txt" ', caret: 22 });
  assert.strictEqual(globalThis.mention, M);
});
