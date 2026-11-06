// renderer/mediapath.js: medya yollarını mutlak yapma ve farklı yazımları tekilleştirme (Windows + POSIX).
const { test } = require('node:test');
const assert = require('node:assert');
const MOD = require.resolve('../src/renderer/mediapath.js');
const { clean, abs, key, uniq, isWin } = require(MOD);

const WCWD = 'D:\\İşler\\Müşteri Ağaç\\3', WHOME = 'C:\\Users\\User';
const PCWD = '/Users/yasin/İşler/Müşteri Ağaç/3', PHOME = '/Users/yasin';

test('clean: file://, file:///C:, sondaki noktalama, boşluk; dize olmayan', () => {
  assert.strictEqual(clean('  file:///Users/a/b.mp4  '), '/Users/a/b.mp4');
  assert.strictEqual(clean('file:///C:/x/b.mp4'), 'C:/x/b.mp4');
  assert.strictEqual(clean('D:\\x\\01.mp4).'), 'D:\\x\\01.mp4');
  assert.strictEqual(clean('"/a/b.mov”,'), '"/a/b.mov');
  assert.strictEqual(clean('a (1).mp4'), 'a (1).mp4');
  assert.strictEqual(clean(null), '');
  assert.strictEqual(clean(42), '');
});

test('isWin: sürücü, UNC, ters bölü; POSIX değil', () => {
  assert.ok(isWin('D:\\a')); assert.ok(isWin('d:/a')); assert.ok(isWin('\\\\nas\\d\\a.mp4')); assert.ok(isWin('a\\b.mp4'));
  assert.ok(!isWin('/a/b')); assert.ok(!isWin('/a\\b')); assert.ok(!isWin('a/b.mp4'));
});

test('abs: adres, mutlak, ~, göreli (Windows/POSIX), çözülemeyenler', () => {
  assert.strictEqual(abs('https://x.com/a.mp4', WCWD), 'https://x.com/a.mp4');
  assert.strictEqual(abs('D:/İşler/a.mp4', WCWD), 'D:/İşler/a.mp4');
  assert.strictEqual(abs('\\\\nas\\d\\a.mp4', WCWD), '\\\\nas\\d\\a.mp4');
  assert.strictEqual(abs('/tmp/a.mp4', PCWD), '/tmp/a.mp4');
  assert.strictEqual(abs('01-isyeri.mp4', WCWD), WCWD + '\\01-isyeri.mp4');
  assert.strictEqual(abs('./01-isyeri.mp4', WCWD + '\\'), WCWD + '\\01-isyeri.mp4');
  assert.strictEqual(abs('Videolar/01.mp4', PCWD + '/'), PCWD + '/Videolar/01.mp4');
  assert.strictEqual(abs('~/a.mp4', PCWD, PHOME), '/Users/yasin/a.mp4');
  assert.strictEqual(abs('~\\Desktop\\a.mp4', WCWD, WHOME), 'C:\\Users\\User\\Desktop\\a.mp4');
  assert.strictEqual(abs('~', PCWD, PHOME + '/'), '/Users/yasin');
  assert.strictEqual(abs('~/a.mp4', PCWD), '~/a.mp4');                       // ev bilinmiyor: olduğu gibi
  assert.strictEqual(abs('a.mp4', '~/proje', PHOME), '/Users/yasin/proje/a.mp4');
  assert.strictEqual(abs('ffmpeg -i a.mp4', WCWD), null);                    // boşluklu göreli metin
  assert.strictEqual(abs('a.mp4', ''), null);                                // klasörsüz
  assert.strictEqual(abs('', WCWD), null);
  assert.strictEqual(abs('.', WCWD), null);
});

test('key: Windows yazımları aynı anahtara iner (ayırıcı, harf, ~, ., .., sondaki nokta, UNC)', () => {
  const k = key('D:\\İşler\\Müşteri Ağaç\\3\\01-isyeri.mp4');
  for(const p of ['D:/İşler/Müşteri Ağaç/3/01-isyeri.mp4', 'd:\\İŞLER\\MÜŞTERI AĞAÇ\\3\\01-ISYERI.MP4', 'D:\\İşler\\\\Müşteri Ağaç\\.\\3\\x\\..\\01-isyeri.mp4',
    'D:\\İşler\\Müşteri Ağaç.\\3\\01-isyeri.mp4', 'D:\\İşler\\Müşteri Ağaç\\3\\01-isyeri.mp4'.normalize('NFD')]) assert.strictEqual(key(p), k, p);
  assert.strictEqual(key('~\\Desktop\\a.mp4', WHOME), key('c:/users/user/desktop/A.MP4'));
  assert.strictEqual(key('\\\\nas\\d\\a.mp4'), key('//nas/d/A.mp4'.replace(/\//g, '\\')));
  assert.strictEqual(key('\\\\nas\\d\\a.mp4'), '\\\\NAS\\D\\A.MP4');
  assert.strictEqual(key('D:\\..\\a.mp4'), 'D:\\A.MP4');                     // sürücünün üstüne çıkılmaz
  assert.strictEqual(key('..\\..\\a.mp4'), '..\\..\\A.MP4');                 // göreli baştaki .. korunur
  assert.strictEqual(key('a\\..\\..\\b.mp4'), '..\\B.MP4');
  assert.notStrictEqual(key('D:\\a.mp4'), key('E:\\a.mp4'));
  // NTFS büyük harf tablosu gibi: i→I, İ ayrı harf (D:\işler ile D:\İşler farklı klasör)
  assert.notStrictEqual(key('D:\\işler\\a.mp4'), key('D:\\İşler\\a.mp4'));
});

test('key: POSIX harfe duyarlı; ayırıcı ve . / .. çözülür; adres olduğu gibi; boş', () => {
  assert.strictEqual(key('/Users/yasin//a/./b/../c.mp4'), '/Users/yasin/a/c.mp4');
  assert.notStrictEqual(key('/a/B.mp4'), key('/a/b.mp4'));
  assert.strictEqual(key('~/a.mp4', PHOME), '/Users/yasin/a.mp4');
  assert.strictEqual(key('~/a/../b.mp4'), '~/b.mp4');
  assert.strictEqual(key('/../a.mp4'), '/a.mp4');
  assert.strictEqual(key('https://X.com/a.mp4'), 'https://X.com/a.mp4');
  assert.strictEqual(key(''), ''); assert.strictEqual(key(null), '');
});

test('uniq: Windows — aynı videonun 5 yazımı tek öğe, ilk yazım korunur, sıra korunur', () => {
  const cands = ['01-isyeri.mp4', 'D:\\İşler\\Müşteri Ağaç\\3\\01-isyeri.mp4', 'D:/İşler/Müşteri Ağaç/3/01-isyeri.mp4', 'd:\\İşLER\\müşteri ağaç\\3\\01-ISYERI.mp4.',
    './01-isyeri.mp4', '02.mp4', 'https://x.com/v.mp4', 'https://x.com/v.mp4', 'ffmpeg -i x.mp4'];
  assert.deepStrictEqual(uniq(cands, { cwd: WCWD, home: WHOME }), [WCWD + '\\01-isyeri.mp4', WCWD + '\\02.mp4', 'https://x.com/v.mp4']);
  assert.deepStrictEqual(uniq(new Set(cands), { cwd: WCWD, web: false }), [WCWD + '\\01-isyeri.mp4', WCWD + '\\02.mp4']);
});

test('uniq: POSIX — ~ ve mutlak aynı, harf farkı ayrı; sınır; skip; boş girdi', () => {
  const cands = ['~/İşler/Müşteri Ağaç/3/a.mp4', PCWD + '/a.mp4', 'a.mp4', 'A.mp4'];
  assert.deepStrictEqual(uniq(cands, { cwd: PCWD, home: PHOME }), ['/Users/yasin/İşler/Müşteri Ağaç/3/a.mp4', PCWD + '/A.mp4']);
  assert.deepStrictEqual(uniq(['1.png', '2.png', '3.png'], { cwd: PCWD, limit: 2 }), [PCWD + '/1.png', PCWD + '/2.png']);
  assert.deepStrictEqual(uniq(['1.png', PCWD + '/2.png'], { cwd: PCWD, skip: new Set(['2.png', 'ffmpeg x']) }), [PCWD + '/1.png']);
  assert.deepStrictEqual(uniq(null), []);
  assert.deepStrictEqual(uniq(['/a.mp4']), ['/a.mp4']);
});

test('tarayıcıda window.mediaPath olarak yüklenir', () => {
  const vm = require('vm'), src = require('fs').readFileSync(MOD, 'utf8');
  const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(src, ctx, { filename: MOD });
  assert.deepStrictEqual(Object.keys(ctx.window.mediaPath).sort(), ['abs', 'clean', 'isWin', 'key', 'uniq']);
  const ctx2 = {}; vm.createContext(ctx2); vm.runInContext(src, ctx2, { filename: MOD });
  assert.strictEqual(typeof ctx2.mediaPath, 'object');
});
