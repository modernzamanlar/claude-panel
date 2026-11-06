// main/files.js (@ ile dosya önerisi: tarama, sınırlar, önbellek, sıralama) ve renderer/mention.js (belirteç, ekleme).
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const files = require('../src/main/files.js');
const { listFiles, rank, norm, resolveDir, clearCache } = files;
const mention = require('../src/renderer/mention.js');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cp-files-'));
const put = (root, rel, body = 'x') => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, body); return p; };
const rels = list => list.map(x => x.rel + (x.dir ? '/' : ''));
const touch = (p, sec) => fs.utimesSync(p, sec, sec);

beforeEach(() => clearCache());

test('resolveDir: yalnızca gerçek, mutlak ya da ~ ile başlayan klasör', () => {
  const d = tmp(), f = put(d, 'a.txt');
  for (const x of [undefined, null, 5, '', 'göreli/klasör', 'x'.repeat(5000), d + '\0x', f, path.join(d, 'yok')]) assert.strictEqual(resolveDir(x), null, String(x).slice(0, 40));
  assert.strictEqual(resolveDir(d + path.sep), path.resolve(d));
  assert.strictEqual(resolveDir('~'), os.homedir());
  assert.strictEqual(resolveDir('~/'), os.homedir());
  assert.strictEqual(resolveDir('~yok'), null, '~kullanıcı biçimi açılmaz');
  fs.rmSync(d, { recursive: true });
});

test('listFiles: geçersiz klasörde boş liste; sorgu metin değilse boş sorgu sayılır', async () => {
  assert.deepStrictEqual(await listFiles('göreli', 'a'), []);
  assert.deepStrictEqual(await listFiles(null), []);
  const d = tmp(); put(d, 'a.txt');
  assert.deepStrictEqual(rels(await listFiles(d, 42)), ['a.txt']);
  assert.deepStrictEqual(rels(await listFiles(d, 'a'.repeat(500))), [], 'uzun sorgu kısaltılır, eşleşme yok');
  fs.rmSync(d, { recursive: true });
});

test('tarama: gizli/derleme/sistem klasörleri ve çöp dosyalar atlanır, gizli dosyalar kalır', async () => {
  const d = tmp();
  for (const r of ['src/app.js', '.env', '.git/config', '.cache/x.js', 'node_modules/p/index.js', 'Node_Modules/q.js', 'dist/out.js', 'build/b.js',
    '__pycache__/m.pyc', 'venv/bin/py', 'coverage/lcov.info', 'Library/Caches/c', 'Foo.app/Contents/x', '$RECYCLE.BIN/y', 'System Volume Information/z',
    'Windows/system32/k.dll', 'Program Files (x86)/p.exe', 'AppData/Local/l', '.DS_Store', 'src/Thumbs.db', 'desktop.ini', 'docs/library/kitap.md']) put(d, r);
  const all = rels(await listFiles(d, '', { limit: 100 }));
  assert.deepStrictEqual(all.slice().sort(), ['.env', 'docs/', 'docs/library/', 'docs/library/kitap.md', 'src/', 'src/app.js']);
  fs.rmSync(d, { recursive: true });
});

// Windows'ta sembolik bağlantı yönetici/geliştirici modu ister, chmod 0 da okumayı engellemez
test('tarama: bağlantıların içine girilmez; kırık bağlantı ve okunamayan klasör sorun çıkarmaz', { skip: process.platform === 'win32' && 'Windows: symlink/chmod POSIX varsayımı' }, async () => {
  const d = tmp(), out = tmp();
  put(out, 'icerde.txt'); put(d, 'gercek.txt'); put(d, 'kilitli/gizli.txt');
  fs.symlinkSync(out, path.join(d, 'disari'));
  fs.symlinkSync(path.join(d, 'gercek.txt'), path.join(d, 'kisayol.txt'));
  fs.symlinkSync(path.join(d, 'yok.txt'), path.join(d, 'kirik.txt'));
  fs.chmodSync(path.join(d, 'kilitli'), 0);
  try {
    const r = await listFiles(d, '', { limit: 100 });
    const by = Object.fromEntries(r.map(x => [x.rel, x.dir]));
    assert.deepStrictEqual(by, { 'gercek.txt': false, 'kilitli': true, 'disari': true, 'kisayol.txt': false, 'kirik.txt': false });
  } finally { fs.chmodSync(path.join(d, 'kilitli'), 0o755); }
  // kök klasör okunamıyorsa da boş liste döner
  const k = tmp(); put(k, 'a.txt'); fs.chmodSync(k, 0o300);
  try { assert.deepStrictEqual(await listFiles(k, ''), []); } finally { fs.chmodSync(k, 0o755); }
  for (const x of [d, out, k]) fs.rmSync(x, { recursive: true });
});

test('sınırlar: kayıt sayısı, derinlik, süre ve sonuç sayısı', async () => {
  const d = tmp();
  for (let i = 0; i < 5; i++) put(d, `k${i}/d${i}.txt`);
  put(d, 'a/b/c/d/derin.txt');
  // en çok 3 kayıt: genişlik öncelikli olduğundan üst düzey klasörler alınır
  assert.deepStrictEqual(rels(await listFiles(d, '', { maxEntries: 3, limit: 100 })).sort(), ['a/', 'k0/', 'k1/']);
  // 6 kayıt: üst düzeyin tamamı (6), alt klasörlere geçilmez
  assert.strictEqual((await listFiles(d, '', { maxEntries: 6, limit: 100 })).length, 6);
  // derinlik 2: a/b görünür, a/b/c görünmez
  const two = rels(await listFiles(d, '', { maxDepth: 2, limit: 100 }));
  assert.ok(two.includes('a/b/') && !two.includes('a/b/c/'), two.join());
  // süre dolduysa yalnızca kök okunur
  assert.deepStrictEqual(rels(await listFiles(d, '', { maxMs: -1, limit: 100 })).length, 6);
  assert.strictEqual((await listFiles(d, '', { limit: 2 })).length, 2);
  assert.deepStrictEqual(rels(await listFiles(d, 'derin')), ['a/b/c/d/derin.txt']);
  fs.rmSync(d, { recursive: true });
});

test('önbellek: 30 sn içinde yeniden taranmaz, süre ya da sınır değişince taranır, en çok 8 klasör tutulur', async () => {
  const d = tmp(); put(d, 'ilk.txt');
  const p1 = listFiles(d, ''), p2 = listFiles(d, 'ilk');
  assert.deepStrictEqual([rels(await p1), rels(await p2)], [['ilk.txt'], ['ilk.txt']], 'eşzamanlı çağrılar aynı taramayı bekler');
  put(d, 'yeni.txt');
  assert.deepStrictEqual(rels(await listFiles(d, '')), ['ilk.txt'], 'önbellekten');
  assert.deepStrictEqual(rels(await listFiles(d, '', { ttl: 0 })).sort(), ['ilk.txt', 'yeni.txt'], 'süre dolmuş');
  put(d, 'ucuncu.txt');
  assert.strictEqual((await listFiles(d, '', { maxEntries: 50 })).length, 3, 'farklı sınır ayrı önbellek');
  // 8'den fazla klasör: en eskisi düşer
  const many = Array.from({ length: 9 }, () => { const x = tmp(); put(x, 'a.txt'); return x; });
  await listFiles(d, '');
  for (const x of many) await listFiles(x, '');
  put(d, 'dorduncu.txt');
  assert.strictEqual((await listFiles(d, '')).length, 4, 'ilk klasör önbellekten düşmüş, yeniden tarandı');
  for (const x of [d, ...many]) fs.rmSync(x, { recursive: true });
});

test('norm: Türkçe harfler ve ters bölü', () => {
  assert.strictEqual(norm('İŞÇĞÜÖIı âîû'), 'iscguoii aiu');
  assert.strictEqual(norm('src\\Main\\A.js'), 'src/main/a.js');
});

const it = (rel, mtime = 0, dir = false) => ({ rel, name: rel.split('/').pop(), dir, mtime, depth: rel.split('/').length - 1 });

test('rank: ad eşleşmesi yoldan, baş eşleşmesi içerikten önce gelir', () => {
  const L = [it('src/renderer/app.js'), it('test/app.test.js'), it('src/mapper.js'), it('docs/happy.md'), it('src/app', 0, true),
    it('apps/readme.md'), it('src/renderer/x.js'), it('a/p/p.txt'), it('zzz.md')];
  assert.deepStrictEqual(rels(rank(L, 'app')), ['src/app/', 'src/renderer/app.js', 'test/app.test.js', 'docs/happy.md', 'src/mapper.js', 'apps/readme.md', 'a/p/p.txt']);
  // klasör adının başı (segment) > yolun içi > adın alt dizisi > yolun alt dizisi
  assert.deepStrictEqual(rels(rank(L, 'rend')), ['src/renderer/x.js', 'src/renderer/app.js']);
  assert.deepStrictEqual(rels(rank(L, 'ender')), ['src/renderer/x.js', 'src/renderer/app.js']);
  assert.deepStrictEqual(rels(rank([it('src/main/runner.js'), it('src/renderer/x.js'), it('rapor-son-notlar.txt')], 'rnr')), ['src/main/runner.js', 'rapor-son-notlar.txt', 'src/renderer/x.js']);
  assert.deepStrictEqual(rank(L, 'qqq'), []);
});

test('rank: tam ad ve uzantısız ad en önde; eşitlikte en son değişen, sonra kısa ve alfabetik', () => {
  const L = [it('a/readme.md', 5), it('b/readme.md', 9), it('readme', 1), it('readme.md.bak', 1), it('c/readme.txt', 9), it('d/readme.txt', 9), it('cc/readme.txt', 9)];
  assert.deepStrictEqual(rels(rank(L, 'readme')), ['b/readme.md', 'c/readme.txt', 'd/readme.txt', 'cc/readme.txt', 'a/readme.md', 'readme', 'readme.md.bak']);
});

test('rank: boş sorguda sığ olan, sonra yeni olan önde; ./ öneki ve sınır', () => {
  const L = [it('derin/a.txt', 99), it('kok.txt', 1), it('yeni.txt', 50), it('derin', 2, true)];
  assert.deepStrictEqual(rels(rank(L, '')), ['yeni.txt', 'derin/', 'kok.txt', 'derin/a.txt']);
  assert.deepStrictEqual(rels(rank(L, undefined, 2)), ['yeni.txt', 'derin/']);
  assert.deepStrictEqual(rels(rank(L, './kok')), ['kok.txt']);
  assert.deepStrictEqual(rels(rank(L, '  ')), rels(rank(L, '')));
});

test('rank: "/" içeren sorgu yolda aranır, yolun kendisi öne gelir; alt dizi de eşleşir', () => {
  const L = [it('src/main/files.js', 9), it('src/main', 1, true), it('src/main/x/y.js', 9), it('src/renderer/main.css'), it('test/q.js')];
  assert.deepStrictEqual(rels(rank(L, 'src/main')), ['src/main/', 'src/main/x/y.js', 'src/main/files.js', 'src/renderer/main.css'], 'eşitlikte kısa yol önde');
  assert.deepStrictEqual(rels(rank(L, 'src/main/')), ['src/main/x/y.js', 'src/main/files.js']);
  assert.deepStrictEqual(rels(rank(L, 'src\\main\\x')), ['src/main/x/y.js'], 'Windows ayracı');
  assert.deepStrictEqual(rels(rank(L, 'sr/fil')), ['src/main/files.js']);
  assert.deepStrictEqual(rank(L, 'zz/q'), []);
});

test('rank: Türkçe ve büyük/küçük harf duyarsız', () => {
  const L = [it('Belgeler/Sürüm-Notu.txt'), it('IŞIK.md'), it('Istanbul/plan.md'), it('çizim/ağaç.svg')];
  assert.deepStrictEqual(rels(rank(L, 'surum')), ['Belgeler/Sürüm-Notu.txt']);
  assert.deepStrictEqual(rels(rank(L, 'SÜRÜM')), ['Belgeler/Sürüm-Notu.txt']);
  assert.deepStrictEqual(rels(rank(L, 'isik')), ['IŞIK.md']);
  assert.deepStrictEqual(rels(rank(L, 'ışık')), ['IŞIK.md']);
  assert.deepStrictEqual(rels(rank(L, 'istanbul')), ['Istanbul/plan.md']);
  assert.deepStrictEqual(rels(rank(L, 'agac')), ['çizim/ağaç.svg']);
  assert.deepStrictEqual(rels(rank(L, 'CIZIM/')), ['çizim/ağaç.svg']);
});

test('listFiles: gerçek klasörde sıralama ve değişme zamanı', async () => {
  const d = tmp();
  touch(put(d, 'eski/not.md'), 1000); touch(put(d, 'yeni/not.md'), 2000); put(d, 'Notlar Klasörü/özet.txt');
  assert.deepStrictEqual(rels(await listFiles(d, 'not.md')), ['yeni/not.md', 'eski/not.md']);
  assert.deepStrictEqual(rels(await listFiles(d, 'ozet')), ['Notlar Klasörü/özet.txt']);
  assert.deepStrictEqual((await listFiles(d, 'notlar'))[0], { rel: 'Notlar Klasörü', name: 'Notlar Klasörü', dir: true });
  fs.rmSync(d, { recursive: true });
});

test('mention.token: @ satır başında ya da boşluktan sonra; imleç ve tırnak', () => {
  assert.strictEqual(mention.token(5), null);
  assert.strictEqual(mention.token('merhaba'), null);
  assert.strictEqual(mention.token('a@b.com'), null, 'e-posta');
  assert.strictEqual(mention.token('@src x'), null, 'boşluk belirteci bitirir');
  assert.deepStrictEqual(mention.token('@'), { start: 0, end: 1, q: '', quoted: false });
  assert.deepStrictEqual(mention.token('bak @src/ma'), { start: 4, end: 11, q: 'src/ma', quoted: false });
  assert.deepStrictEqual(mention.token('bak\n@x', 99), { start: 4, end: 6, q: 'x', quoted: false }, 'geçersiz imleç → sona');
  assert.deepStrictEqual(mention.token('bak @src/main.js sonra', 8), { start: 4, end: 16, q: 'src', quoted: false }, 'imleç ortada');
  assert.deepStrictEqual(mention.token('@"alt klasör/a b', 16), { start: 0, end: 16, q: 'alt klasör/a b', quoted: true });
  assert.deepStrictEqual(mention.token('@"alt kl/a b.txt" sonra', 5), { start: 0, end: 17, q: 'alt', quoted: true });
  assert.strictEqual(mention.token('@"a" b'), null, 'kapanmış tırnaktan sonra');
  assert.strictEqual(mention.token('@x', -1).q, 'x');
  assert.strictEqual(mention.token('@x', 1.5).q, 'x');
});

test('mention.format + apply: boşluklu yol tırnaklanır, klasörde öneri sürer', () => {
  assert.strictEqual(mention.format({ rel: 'src/app.js' }), '@src/app.js');
  assert.strictEqual(mention.format({ rel: 'src', dir: true }), '@src/');
  assert.strictEqual(mention.format({ rel: 'alt klasör/a b.txt' }), '@"alt klasör/a b.txt"');
  const t1 = 'bak @ap';
  assert.deepStrictEqual(mention.apply(t1, mention.token(t1), { rel: 'src/app.js' }), { text: 'bak @src/app.js ', caret: 16 });
  const t2 = 'bak @ap sonra';
  assert.deepStrictEqual(mention.apply(t2, mention.token(t2, 7), { rel: 'src/app.js' }), { text: 'bak @src/app.js sonra', caret: 16 }, 'var olan boşluk kullanılır');
  assert.deepStrictEqual(mention.apply('@s', mention.token('@s'), { rel: 'src', dir: true }), { text: '@src/', caret: 5 });
  assert.deepStrictEqual(mention.apply('@al', mention.token('@al'), { rel: 'alt klasör', dir: true }), { text: '@"alt klasör/', caret: 13 });
  const t3 = '@"alt klasör/b';
  const r3 = mention.apply(t3, mention.token(t3), { rel: 'alt klasör/bos luk.txt' });
  assert.deepStrictEqual(r3, { text: '@"alt klasör/bos luk.txt" ', caret: 26 });
  assert.strictEqual(mention.token(r3.text, r3.caret), null, 'dosyadan sonra öneri kapanır');
  assert.strictEqual(globalThis.mention, mention);
});

test('tarama (Windows): bağlantı noktalarının (junction) içine girilmez; kırık bağlantı sorun çıkarmaz', { skip: process.platform !== 'win32' }, async () => {
  const d = tmp(), out = tmp(), gone = tmp();
  put(out, 'icerde.txt'); put(d, 'gercek.txt');
  fs.symlinkSync(out, path.join(d, 'disari'), 'junction');
  fs.symlinkSync(gone, path.join(d, 'kirik'), 'junction'); fs.rmSync(gone, { recursive: true });
  const by = Object.fromEntries((await listFiles(d, '', { limit: 100 })).map(x => [x.rel, x.dir]));
  assert.deepStrictEqual(by, { 'gercek.txt': false, 'disari': true, 'kirik': false });
  fs.rmSync(d, { recursive: true }); fs.rmSync(out, { recursive: true });
});

test('gitignore: kökteki .gitignore kalıpları taramada atlanır', async () => {
  const ig = files.gitignore('# yorum\n\n!geri-alma\n*.log\nbuild-out/\n/kokte.txt\ndocs/taslak\n**/gecici\n/\na/**/b\n');
  assert.strictEqual(ig('x.log', false), true);
  assert.strictEqual(ig('src/derin/y.log', false), true, 'eğik çizgisiz kalıp her düzeyde ad eşler');
  assert.strictEqual(ig('build-out', true), true);
  assert.strictEqual(ig('build-out', false), false, '"/" ile biten kalıp yalnız klasör');
  assert.strictEqual(ig('kokte.txt', false), true);
  assert.strictEqual(ig('src/kokte.txt', false), false, '"/" ile başlayan kalıp köke bağlı');
  assert.strictEqual(ig('docs/taslak', true), true);
  assert.strictEqual(ig('x/docs/taslak', true), false);
  assert.strictEqual(ig('src/gecici', true), true, '"**/" öneki atılır');
  assert.strictEqual(ig('geri-alma', false), false);
  assert.strictEqual(ig('a/c/b', false), false, '"**" ortada desteklenmez, yoksayılır');
  assert.strictEqual(files.gitignore(null)('a', false), false);
  const d = tmp();
  put(d, '.gitignore', 'gizli-klasor/\n*.tmp\n');
  for (const r of ['src/a.js', 'src/b.tmp', 'gizli-klasor/c.js', 'kalan.txt']) put(d, r);
  assert.deepStrictEqual(rels(await listFiles(d, '', { limit: 100 })).sort(), ['.gitignore', 'kalan.txt', 'src/', 'src/a.js']);
  fs.rmSync(d, { recursive: true });
});
