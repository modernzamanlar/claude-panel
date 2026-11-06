// Oturumun toplu farkı: saf yardımcılar (src/renderer/changes.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const lib = require('../src/renderer/changes');

const apply = (ops, side) => ops.filter(o => o.k === ' ' || o.k === side).map(o => o.t);

test('diffOps: boş, aynı, CRLF ve sonda satır sonu', () => {
  assert.deepEqual(lib.diffOps('', ''), []);
  assert.deepEqual(lib.diffOps(null, undefined), []);
  assert.deepEqual(lib.diffOps('a\nb\n', 'a\r\nb'), [{ k: ' ', t: 'a' }, { k: ' ', t: 'b' }]);
  assert.deepEqual(lib.diffOps('', 'x\n'), [{ k: '+', t: 'x' }]);
  assert.deepEqual(lib.diffOps('x', ''), [{ k: '-', t: 'x' }]);
});

test('diffOps: Myers en kısa farkı bulur ve iki tarafı birebir kurar', () => {
  const a = 'a\nb\nc\nd\ne\nf\n', b = 'a\nx\nc\nd\ny\nf\nz\n';
  const ops = lib.diffOps(a, b);
  assert.deepEqual(apply(ops, '-'), lib.split(a));
  assert.deepEqual(apply(ops, '+'), lib.split(b));
  assert.deepEqual(lib.count(ops), { added: 3, removed: 2 });
  // ortak baş ve son korunur
  assert.equal(ops[0].k, ' '); assert.equal(ops[0].t, 'a');
  // rastgele karşılaştırma: her durumda iki taraf geri kurulur
  let seed = 7; const rnd = n => (seed = (seed * 1103515245 + 12345) >>> 0) % n;
  for (let r = 0; r < 200; r++) {
    const mk = () => Array.from({ length: rnd(12) }, () => 'abcd'[rnd(4)]).join('\n');
    const x = mk(), y = mk(), o = lib.diffOps(x, y);
    assert.deepEqual(apply(o, '-'), lib.split(x)); assert.deepEqual(apply(o, '+'), lib.split(y));
  }
});

test('diffOps: farklar çok büyükse ortası silinmiş + eklenmiş gösterilir', () => {
  const n = lib.MAXD + 5;
  const a = Array.from({ length: n }, (_, i) => 'a' + i).join('\n'), b = Array.from({ length: n }, (_, i) => 'b' + i).join('\n');
  const ops = lib.diffOps('ortak\n' + a + '\nson', 'ortak\n' + b + '\nson');
  assert.deepEqual(lib.count(ops), { added: n, removed: n });
  assert.equal(ops[0].t, 'ortak'); assert.equal(ops[ops.length - 1].t, 'son');
  assert.equal(ops[1].k, '-'); assert.equal(ops[n + 1].k, '+');
  // çok uzun girdi (max > 200000): doğrudan tümü
  const big = Array.from({ length: 100001 }, (_, i) => 'x' + i).join('\n');
  const o2 = lib.diffOps(big, big.replace(/x/g, 'y'));
  assert.deepEqual(lib.count(o2), { added: 100001, removed: 100001 });
});

test('status: etiketler ve geri alma düğmesi', () => {
  const S = f => lib.status(f);
  let r = S({ created: true, side: true, cur: 'same', canRevert: true });
  assert.deepEqual(r.tags.map(t => t.t), ['yeni', 'alt ajan']); assert.equal(r.can, true);
  r = S({ cur: 'missing', canRevert: true });
  assert.deepEqual(r.tags, [{ k: 'warn', t: 'dosya yok' }]); assert.equal(r.can, true);
  r = S({ created: true, cur: 'missing', canRevert: true });
  assert.deepEqual(r.tags.map(t => t.t), ['yeni', 'silinmiş']); assert.equal(r.can, false); assert.match(r.why, /zaten yok/);
  r = S({ cur: 'initial', canRevert: true });
  assert.equal(r.tags[0].t, 'ilk halinde'); assert.equal(r.can, false); assert.match(r.why, /zaten/);
  r = S({ cur: 'outside', canRevert: true });
  assert.equal(r.tags[0].t, 'oturum dışında değişmiş'); assert.equal(r.can, true);
  r = S({ cur: 'unreadable', canRevert: true, curError: 'Okunamadı: EACCES' });
  assert.equal(r.tags[0].t, 'okunamadı'); assert.equal(r.can, false); assert.equal(r.why, 'Okunamadı: EACCES');
  r = S({ cur: 'unreadable', canRevert: true });
  assert.match(r.why, /okunamadı/);
  r = S({ cur: 'unverified', canRevert: false, reason: 'neden' });
  assert.deepEqual(r.tags, []); assert.equal(r.can, false); assert.equal(r.why, 'neden');
  r = S({ cur: 'same' });
  assert.equal(r.can, false); assert.equal(r.why, '');
});

test('confirmText, sum, baseName, dirName', () => {
  assert.match(lib.confirmText({ created: true }), /Geri Dönüşüm Kutusuna/);
  assert.match(lib.confirmText({ cur: 'missing' }), /yeniden oluşturulacak/);
  assert.match(lib.confirmText({ cur: 'same' }), /yedeklenecek/);
  assert.deepEqual(lib.sum([{ added: 2, removed: 1 }, { added: 3 }, {}]), { added: 5, removed: 1 });
  assert.equal(lib.baseName('C:\\a\\b.txt'), 'b.txt'); assert.equal(lib.baseName('/x/y'), 'y'); assert.equal(lib.baseName(null), '');
  assert.equal(lib.dirName('C:\\a\\b.txt'), 'C:\\a'); assert.equal(lib.dirName('/x/y'), '/x'); assert.equal(lib.dirName('b'), ''); assert.equal(lib.dirName('/kok'), ''); assert.equal(lib.dirName(undefined), '');
});

test('tarayıcıda window.changesLib olarak yüklenir, module.exports olmadan', () => {
  const fs = require('fs'), vm = require('vm'), MOD = require.resolve('../src/renderer/changes');
  const src = fs.readFileSync(MOD, 'utf8');
  const ctx = { window: {}, Int32Array }; vm.createContext(ctx); vm.runInContext(src, ctx, { filename: MOD });
  assert.equal(ctx.window.changesLib.count(ctx.window.changesLib.diffOps('a', 'b')).added, 1);
  const ctx2 = { Int32Array }; vm.createContext(ctx2); vm.runInContext(src, ctx2, { filename: MOD });
  assert.equal(typeof ctx2.changesLib, 'object', 'window yoksa genel nesneye yazılır');
});
