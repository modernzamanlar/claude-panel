// main/media.js: sohbet klasöründeki son görsel/videolar, görev çubuğu simgesi denetimi, sesli yazma komutu.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { recentMedia, okBadgeIcon, dictateCommand } = require('../src/main/media');
const WIN = process.platform === 'win32';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'qmedia-'));
function put(dir, rel, ageSec) {
  const p = path.join(dir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, 'x');
  const t = Date.now() / 1000 - ageSec; fs.utimesSync(p, t, t); return p;
}

test('recentMedia: geçersiz girdiler boş liste döner', async () => {
  const d = tmp(); const f = put(d, 'a.png', 1);
  for (const x of [undefined, null, 42, '', 'göreli/klasör', f, path.join(d, 'yok')]) assert.deepStrictEqual(await recentMedia(x), [], String(x));
  fs.rmSync(d, { recursive: true, force: true });
});

test('recentMedia: görsel ve videolar en yeniden eskiye; diğer dosyalar, gizli ve atlanan klasörler alınmaz', async () => {
  const d = tmp();
  put(d, 'eski.jpg', 500); put(d, 'yeni.PNG', 10); put(d, 'video.mp4', 100); put(d, 'not.txt', 1);
  put(d, 'Görseller/sahne1.webp', 50); put(d, 'a/b/derin.gif', 30); put(d, 'a/b/c/cokderin.png', 5);
  put(d, '.gizli/x.png', 1); put(d, '.y.png', 1); put(d, 'node_modules/m.png', 1); put(d, 'dist/d.mov', 1); put(d, 'build/icon.png', 200);
  // sembolik bağ izlenmez; Windows'ta bağ yönetici/geliştirici modu ister (EPERM): o zaman bağsız denenir
  try { fs.symlinkSync(path.join(d, 'yeni.PNG'), path.join(d, 'bag.png')); } catch (e) { if (!WIN || e.code !== 'EPERM') throw e; }
  const r = await recentMedia(d);
  assert.deepStrictEqual(r.map(x => path.relative(d, x.path)), ['yeni.PNG', path.join('a', 'b', 'derin.gif'), path.join('Görseller', 'sahne1.webp'), 'video.mp4', path.join('build', 'icon.png'), 'eski.jpg']);
  assert.deepStrictEqual(r.map(x => x.kind), ['image', 'image', 'image', 'video', 'image', 'image']);
  assert.strictEqual(r[0].name, 'yeni.PNG'); assert.strictEqual(r[0].size, 1); assert.ok(r[0].mtimeMs > r[1].mtimeMs);
  assert.strictEqual((await recentMedia(d, { max: 2 })).length, 2);
  assert.deepStrictEqual((await recentMedia(d, { depth: 0 })).map(x => x.name), ['yeni.PNG', 'video.mp4', 'eski.jpg']);
  fs.rmSync(d, { recursive: true, force: true });
});

test('recentMedia: girdi sınırı aşılınca tarama durur (büyük klasörde donmaz)', async () => {
  const d = tmp();
  for (let i = 0; i < 30; i++) put(d, `k${String(i).padStart(2, '0')}/x.png`, i);
  put(d, 'z.png', 0);
  const r = await recentMedia(d, { limit: 5 });
  assert.ok(r.length <= 5, 'sınırdan fazla dosya okunmaz');
  const all = await recentMedia(d, { limit: 1000, max: 100 });
  assert.strictEqual(all.length, 31);
  fs.rmSync(d, { recursive: true, force: true });
});

test('recentMedia: okunamayan alt klasör ve yarışta silinen dosya atlanır', async () => {
  const d = tmp(); put(d, 'ok.png', 1); put(d, 'kilitli/x.png', 1); put(d, 'gider.png', 2);
  // Windows'ta chmod klasör okumayı engellemez: orada klasörün okunması EACCES ile reddedilir
  const kilitli = path.join(d, 'kilitli'), origDir = fs.promises.readdir;
  if (WIN) fs.promises.readdir = async (p, o) => { if (p === kilitli) throw Object.assign(new Error('EACCES'), { code: 'EACCES' }); return origDir(p, o); };
  else fs.chmodSync(kilitli, 0o000);
  const orig = fs.promises.stat;
  fs.promises.stat = async p => { if (String(p).endsWith('gider.png')) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); return orig(p); };
  try {
    const r = await recentMedia(d);
    assert.deepStrictEqual(r.map(x => x.name), process.getuid && process.getuid() === 0 ? ['ok.png', 'x.png'] : ['ok.png']);
  } finally { fs.promises.stat = orig; fs.promises.readdir = origDir; if (!WIN) fs.chmodSync(kilitli, 0o755); fs.rmSync(d, { recursive: true, force: true }); }
});

test('recentMedia: ~ ev klasörüne genişler', async () => {
  const r = await recentMedia('~', { limit: 30, depth: 0 });
  assert.ok(Array.isArray(r));
  r.forEach(x => assert.ok(x.path.startsWith(os.homedir())));
  const r2 = await recentMedia('~' + path.sep + 'bu-klasor-yok-' + Date.now());
  assert.deepStrictEqual(r2, []);
});

test('okBadgeIcon: yalnızca küçük PNG veri adresi', () => {
  assert.strictEqual(okBadgeIcon('data:image/png;base64,iVBORw0KGgo='), true);
  for (const x of [null, 1, '', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,<script>', 'file:///x.png', 'data:image/png;base64,' + 'A'.repeat(40000)])
    assert.strictEqual(okBadgeIcon(x), false, String(x).slice(0, 40));
});

test('dictateCommand: Windows\'ta Win+H (PowerShell, kodlanmış komut); diğer sistemlerde yok', () => {
  assert.strictEqual(dictateCommand('darwin'), null);
  assert.strictEqual(dictateCommand('linux'), null);
  const c = dictateCommand('win32');
  assert.strictEqual(c.cmd, 'powershell.exe');
  assert.deepStrictEqual(c.args.slice(0, 5), ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand']);
  const decoded = Buffer.from(c.args[5], 'base64').toString('utf16le');
  assert.strictEqual(decoded, c.script);
  assert.match(decoded, /keybd_event\(0x5B,0,0,/); assert.match(decoded, /keybd_event\(0x48,0,0,/);
  assert.match(decoded, /keybd_event\(0x48,0,2,/); assert.match(decoded, /keybd_event\(0x5B,0,2,/);
  assert.ok(decoded.indexOf('0x48,0,2') < decoded.indexOf('0x5B,0,2'), 'önce H, sonra Win bırakılır');
});
