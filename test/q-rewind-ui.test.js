// src/renderer/rewind.js: düzenle / geri sar hedefi, başlık, dosya listesi, ek klasör listesi, worktree adı (saf mantık).
const { test } = require('node:test');
const assert = require('node:assert');
const R = require('../src/renderer/rewind');

const U = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const MSGS = [
  { r: 'u', t: 'ilk', ts: 't1', at: '', uuid: U(1) },
  { r: 'a', b: [] },
  { r: 'u', t: 'ikinci', ts: 't2', at: U(2), uuid: U(3) },
  { r: 'a', b: [] },
  { r: 'u', t: 'uuidsiz', at: U(4) },
  { r: 'u', t: 'canlı' },
  null,
];

test('canEdit / canCode', () => {
  assert.equal(R.canEdit(MSGS[0]), true); assert.equal(R.canCode(MSGS[0]), true);
  assert.equal(R.canEdit(MSGS[4]), true); assert.equal(R.canCode(MSGS[4]), false);
  for (const m of [MSGS[1], MSGS[5], null, undefined, { r: 'u', t: 'x', at: 'kötü' }, { r: 'u', at: 5 }, { r: 'a', at: '' }]) { assert.equal(R.canEdit(m), false); assert.equal(R.canCode(m), false); }
  assert.equal(R.canCode({ r: 'u', at: '', uuid: 'x' }), false);
});

test('target: kesim noktası, devam kaydı, kod kimliği, kaçıncı kullanıcı mesajı', () => {
  assert.deepEqual(R.target(MSGS, 0), { mi: 0, at: '', uuid: U(1), ts: 't1', text: 'ilk', first: true, n: 1 });
  assert.deepEqual(R.target(MSGS, 2), { mi: 2, at: U(2), uuid: U(3), ts: 't2', text: 'ikinci', first: false, n: 2 });
  assert.deepEqual(R.target(MSGS, 4), { mi: 4, at: U(4), uuid: null, ts: null, text: 'uuidsiz', first: false, n: 3 });
  assert.equal(R.target([{ r: 'u', at: '' }], 0).text, '');
  for (const i of [1, 5, 6, 99]) assert.equal(R.target(MSGS, i), null);
  assert.equal(R.target(null, 0), null);
});

test('forkTitle: ek bir kez', () => {
  assert.equal(R.forkTitle('Site'), 'Site (düzenlendi)');
  assert.equal(R.forkTitle('Site (düzenlendi)'), 'Site (düzenlendi)');
  assert.equal(R.forkTitle(''), 'Sohbet (düzenlendi)');
  assert.equal(R.forkTitle(null), 'Sohbet (düzenlendi)');
});

test('fileRows: çalışma klasörüne göre göreli; dışındaki tam yol; geçersizler atılır', () => {
  assert.deepEqual(R.fileRows(['C:\\p\\src\\a.js', 'C:\\p\\b.txt', 'D:\\x\\c.md', '', 5], 'C:\\p\\'), [
    { path: 'C:\\p\\src\\a.js', name: 'a.js', dir: 'src' }, { path: 'C:\\p\\b.txt', name: 'b.txt', dir: '' }, { path: 'D:\\x\\c.md', name: 'c.md', dir: 'D:/x' }]);
  assert.deepEqual(R.fileRows(['/u/p/a/b.js'], '/u/p'), [{ path: '/u/p/a/b.js', name: 'b.js', dir: 'a' }]);
  assert.deepEqual(R.fileRows(['/u/pp/a.js'], '/u/p'), [{ path: '/u/pp/a.js', name: 'a.js', dir: '/u/pp' }], 'önek değil klasör sınırı');
  assert.deepEqual(R.fileRows(['/a.js'], ''), [{ path: '/a.js', name: 'a.js', dir: '' }]);
  assert.deepEqual(R.fileRows(null, null), []);
});

test('changeSummary', () => {
  assert.equal(R.changeSummary({ files: ['a', 'b'], insertions: 3, deletions: 1 }), '2 dosya · +3 −1 satır');
  assert.equal(R.changeSummary({ files: ['a'], insertions: 0, deletions: 2 }), '1 dosya · +0 −2 satır');
  assert.equal(R.changeSummary({ files: ['a'], insertions: 4 }), '1 dosya · +4 −0 satır');
  assert.equal(R.changeSummary({ files: ['a'] }), '1 dosya');
  assert.equal(R.changeSummary({}), '0 dosya');
  assert.equal(R.changeSummary(null), '');
});

test('dirsAdd / dirsRemove', () => {
  assert.deepEqual(R.dirsAdd([], ' ~/a ', '~/p'), ['~/a']);
  assert.deepEqual(R.dirsAdd(['~/a'], '~/A/', '~/p'), ['~/a'], 'büyük/küçük harf ve sondaki ayraç');
  assert.deepEqual(R.dirsAdd(['~/a'], '~/p', '~/p/'), ['~/a'], 'çalışma klasörü');
  assert.deepEqual(R.dirsAdd(['~/a'], '~/b', null), ['~/a', '~/b']);
  assert.deepEqual(R.dirsAdd(null, '', ''), []);
  assert.deepEqual(R.dirsAdd(undefined, 5), []);
  const full = Array.from({ length: 20 }, (_, i) => '/d' + i);
  assert.equal(R.dirsAdd(full, '/yeni').length, 20);
  const src = ['/a']; R.dirsAdd(src, '/b'); assert.deepEqual(src, ['/a'], 'girdi değişmez');
  assert.deepEqual(R.dirsRemove(['/a', '/b'], '/a'), ['/b']);
  assert.deepEqual(R.dirsRemove(null, '/a'), []);
});

test('validWt / wtName', () => {
  assert.equal(R.validWt('deneme-1'), true);
  for (const b of ['', '-a', '.a', 'a..b', 'a.lock', 'a/b', 'ş', null]) assert.equal(R.validWt(b), false, String(b));
  assert.equal(R.wtName('Gerikoğlu Web Sitesi — Revizyon!'), 'gerikoglu-web-sitesi-revizyon');
  assert.equal(R.wtName('İŞÇİ ĞÜÖ ı'), 'isci-guo-i');
  assert.equal(R.wtName('a'.repeat(39) + ' b'), 'a'.repeat(39), '40 karaktere kesilir, sondaki tire atılır');
  assert.equal(R.wtName('!!!', new Date(2026, 10, 6, 9, 5)), 'calisma-20261106-0905');
  assert.match(R.wtName(null), /^calisma-\d{8}-\d{4}$/);
  assert.equal(R.validWt(R.wtName('Çok güzel bir ad')), true);
});

test('wtPath: deponun ayracıyla, sondaki ayraç atılır', () => {
  assert.equal(R.wtPath('C:\\p\\repo\\', 'ad'), 'C:\\p\\repo\\.claude\\worktrees\\ad');
  assert.equal(R.wtPath('/u/repo', 'ad'), '/u/repo/.claude/worktrees/ad');
  assert.equal(R.wtPath(null, 'ad'), '/.claude/worktrees/ad');
});

test('tarayıcıda window.rewind olarak yüklenir, module.exports olmadan', () => {
  const vm = require('vm'), MOD = require.resolve('../src/renderer/rewind.js'), src = require('fs').readFileSync(MOD, 'utf8');
  const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(src, ctx, { filename: MOD });
  assert.deepEqual(Object.keys(ctx.window.rewind).sort(), ['canCode', 'canEdit', 'changeSummary', 'dirsAdd', 'dirsRemove', 'fileRows', 'forkTitle', 'target', 'validWt', 'wtName', 'wtPath']);
  const ctx2 = { module: {} }; vm.createContext(ctx2); vm.runInContext(src, ctx2, { filename: MOD });
  assert.equal(typeof ctx2.rewind, 'object', 'window yoksa (ve module.exports boşsa) genel nesneye yazılır');
});
