// Güncelleyici: kenar durumları, güvenlik denetimleri, hazır sürümün korunması, kurulum ve zamanlayıcılar.
// Her test kendi geçici klasörlerini kullanır; gerçek kurulum hiç başlatılmaz (spawn sahte).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { createUpdater, cmpVer, sha512, signManifest, verifyManifest, MANIFEST, DEFAULT_SOURCES } = require('../src/main/updater');

const KP = crypto.generateKeyPairSync('ed25519');
const PRIV = KP.privateKey.export({ type: 'pkcs8', format: 'pem' }), PUB = KP.publicKey.export({ type: 'spki', format: 'pem' });
const SIZE = 300000;
const ENV0 = process.env.CLAUDE_PANEL_UPDATES;
delete process.env.CLAUDE_PANEL_UPDATES;
test.after(() => { if (ENV0 !== undefined) process.env.CLAUDE_PANEL_UPDATES = ENV0; });

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cp-qupd-'));
const hashOf = buf => crypto.createHash('sha512').update(buf).digest('base64');
const signed = m => ({ ...m, imza: signManifest(m, PRIV) });
const exeName = v => `Claude Panel Setup ${v}.exe`;

/** Güncelleme klasörüne bir sürüm koyar. over: manifest alanlarını (imzalamadan önce) değiştirir. */
function release(dir, version, { fill = 7, over = {}, sign = true, extra = {} } = {}) {
  const buf = Buffer.alloc(SIZE, fill), file = exeName(version);
  fs.writeFileSync(path.join(dir, file), buf);
  let m = { version, file, size: SIZE, sha512: hashOf(buf), ...over };
  if (sign) m = signed(m);
  fs.writeFileSync(path.join(dir, MANIFEST), JSON.stringify({ ...m, ...extra }));
  return { m, buf };
}

function fakeSpawn() {
  const calls = [];
  const fn = (...args) => { const c = new EventEmitter(); c.unrefs = 0; c.unref = () => { c.unrefs++; }; calls.push({ args, child: c }); return c; };
  fn.calls = calls;
  return fn;
}

function make(opts = {}) {
  const root = tmp(), dir = path.join(root, 'kaynak'), dl = path.join(root, 'indirilen');
  fs.mkdirSync(dir);
  const states = [], snaps = [], quits = [];
  const spawn = fakeSpawn();
  const app = { getVersion: () => '0.2.0', quit: () => quits.push(Date.now()) };
  const settingsFile = path.join(root, 'ayar', 'settings.json');
  const u = createUpdater({ app, settingsFile, enabled: true, publicKey: PUB, downloadDir: dl, spawn,
    onState: s => { states.push(s.phase); snaps.push(s); }, ...opts });
  return { u, root, dir, dl, states, snaps, quits, spawn, settingsFile };
}
async function readyAt(version, opts) {
  const t = make(opts); t.u.setDir(t.dir); const rel = release(t.dir, version);
  const st = await t.u.check({ manual: true });
  assert.strictEqual(st.phase, 'ready');
  return { ...t, rel };
}

// ---------- sürüm karşılaştırma ----------
test('cmpVer: farklı uzunluk, ön sürüm eki, sayısal olmayan parçalar ve işaret değeri', () => {
  assert.strictEqual(cmpVer('1.0.1', '1.0'), 1);
  assert.strictEqual(cmpVer('1.0', '1.0.1'), -1);
  assert.strictEqual(cmpVer('1.0', '1.0.0'), 0);
  assert.strictEqual(cmpVer('1.0.0', '1.0'), 0);
  assert.strictEqual(cmpVer('3.0.0', '1.0.0'), 1);   // fark 2 olsa da sonuç 1
  assert.strictEqual(cmpVer('1.0.0', '3.0.0'), -1);
  assert.strictEqual(cmpVer('0.10.0', '0.9.9'), 1);
  assert.strictEqual(cmpVer('0.2.0', '0.2.1'), -1);
  assert.strictEqual(cmpVer('1.0.0-2', '1.0.0'), 1);
  assert.strictEqual(cmpVer('1.0.0-beta', '1.0.0'), 0); // harf parçası 0 sayılır
  assert.strictEqual(cmpVer('abc', '0'), 0);
  assert.strictEqual(cmpVer(2, 1), 1);
  assert.strictEqual(cmpVer('0.2.1', undefined), 1);
});

// ---------- manifest doğrulama ----------
const base = () => ({ version: '1.2.3', file: 'Claude Panel Setup 1.2.3.exe', size: 10, sha512: 'aGFzaA==' });
test('verifyManifest: doğru anahtarla imzalı geçerli manifest kabul edilir', () => {
  assert.strictEqual(verifyManifest(signed(base()), PUB), true);
  assert.strictEqual(verifyManifest(signed({ ...base(), version: '1.2.3-beta.1' }), PUB), true);
  assert.strictEqual(verifyManifest(signed({ ...base(), file: 'KURULUM.EXE' }), PUB), true);
});
test('verifyManifest: boş, imzasız, bozuk imzalı, başka anahtarlı veya sonradan değiştirilmiş manifest reddedilir', () => {
  assert.strictEqual(verifyManifest(null, PUB), false);
  assert.strictEqual(verifyManifest(undefined, PUB), false);
  assert.strictEqual(verifyManifest(base(), PUB), false);                         // imza yok
  assert.strictEqual(verifyManifest({ ...base(), imza: 'bozuk' }, PUB), false);
  assert.strictEqual(verifyManifest({ ...base(), imza: 12 }, PUB), false);
  assert.strictEqual(verifyManifest({ ...signed(base()), size: 11 }, PUB), false); // imzadan sonra değişmiş
  assert.strictEqual(verifyManifest({ ...signed(base()), sha512: 'YmFza2E=' }, PUB), false);
  const other = crypto.generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' });
  assert.strictEqual(verifyManifest(signed(base()), other), false);
  assert.strictEqual(verifyManifest(signed(base())), false);                     // gömülü anahtarla: test anahtarı tutmaz
  assert.strictEqual(verifyManifest(signed(base()), 'anahtar değil'), false);
});
test('verifyManifest: imzası geçerli olsa da biçimi bozuk alanlar reddedilir', () => {
  const bad = [
    { sha512: undefined }, { sha512: 123 },
    { version: undefined }, { version: '1.2' }, { version: '1.2.3.4' }, { version: 'v1.2.3' }, { version: '1.2.3-' }, { version: '1.2.3/..' },
    { size: undefined }, { size: 0 }, { size: -5 }, { size: 1.5 }, { size: '10' },
    { file: undefined }, { file: 'a/b.exe' }, { file: 'a\\b.exe' }, { file: 'C:x.exe' }, { file: '../x.exe' }, { file: '..\\x.exe' },
    { file: 'a..b.exe' }, { file: 'x.msi' }, { file: 'x.exe.bat' }, { file: '.exe' }, { file: 'a*b.exe' }, { file: 'a\0b.exe' },
  ];
  for (const o of bad) assert.strictEqual(verifyManifest(signed({ ...base(), ...o }), PUB), false, JSON.stringify(o));
  assert.strictEqual(verifyManifest(signed({ ...base(), size: 1 }), PUB), true);  // sınır: 1 bayt geçerli
});

test('sha512: dosyanın base64 SHA-512 özetini verir, olmayan dosyada reddeder', async () => {
  const f = path.join(tmp(), 'a.bin'); fs.writeFileSync(f, 'merhaba');
  assert.strictEqual(await sha512(f), hashOf(Buffer.from('merhaba')));
  await assert.rejects(sha512(f + '.yok'), { code: 'ENOENT' });
});

// ---------- ayarlar ve kaynaklar ----------
test('ayarlar: getDir/setDir ayar dosyasını yazar, diğer anahtarları korur, boş değer siler', () => {
  const { u, settingsFile } = make();
  assert.strictEqual(u.getDir(), null);
  assert.deepStrictEqual(u.sources(), []);
  assert.deepStrictEqual(u.setDir('/x/y'), ['/x/y']);                       // ayar dosyasının klasörü yoksa oluşturulur
  assert.strictEqual(u.getDir(), '/x/y');
  const s = JSON.parse(fs.readFileSync(settingsFile, 'utf8')); s.baska = 1; fs.writeFileSync(settingsFile, JSON.stringify(s));
  u.setDir('/z');
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(settingsFile, 'utf8')), { baska: 1, updateDir: '/z' });
  assert.deepStrictEqual(u.setDir(''), []);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(settingsFile, 'utf8')), { baska: 1 });
  u.setDir('/z'); u.setDir(null);
  assert.strictEqual(u.getDir(), null);
  fs.writeFileSync(settingsFile, '{bozuk');
  assert.strictEqual(u.getDir(), null);
  assert.deepStrictEqual(u.setDir('/k'), ['/k']);                           // bozuk ayar dosyası baştan yazılır
});
test('kaynaklar: ortam değişkeni önce gelir, tekrarlar atılır, Windows varsayılanları yalnızca win32de eklenir', () => {
  const { u } = make();
  u.setDir('/ayar');
  process.env.CLAUDE_PANEL_UPDATES = '/ortam';
  try {
    assert.deepStrictEqual(u.sources(), ['/ortam', '/ayar']);
    process.env.CLAUDE_PANEL_UPDATES = '/ayar';
    assert.deepStrictEqual(u.sources(), ['/ayar']);
  } finally { delete process.env.CLAUDE_PANEL_UPDATES; }
  const w = make({ platform: 'win32' });
  w.u.setDir('/ayar');
  assert.deepStrictEqual(w.u.sources(), ['/ayar', ...DEFAULT_SOURCES]);
  assert.strictEqual(DEFAULT_SOURCES.length, 3);
});
test('etkinlik: Windows dışında ortam değişkeni yoksa kapalı; win32de veya değişken varsa açık', async () => {
  const off = make({ enabled: undefined, platform: 'darwin' });
  assert.strictEqual((await off.u.check({ manual: true })).phase, 'disabled');
  const win = make({ enabled: undefined, platform: 'win32' });
  win.u.setDir(win.dir); release(win.dir, '0.2.0');
  assert.strictEqual((await win.u.check()).phase, 'none');
  process.env.CLAUDE_PANEL_UPDATES = '/olmayan-ortam-klasoru';
  try {
    const env = make({ enabled: undefined, platform: 'darwin' });
    const st = await env.u.check({ manual: true });
    assert.strictEqual(st.phase, 'error');
    assert.deepStrictEqual(st.tried, ['/olmayan-ortam-klasoru (ENOENT)']);
  } finally { delete process.env.CLAUDE_PANEL_UPDATES; }
});
test('setDir: hazır değilken durumu "idle" yapar, hazır sürümü bozmaz', async () => {
  const t = make();
  t.u.setDir(t.dir);
  assert.strictEqual(t.u.state.phase, 'idle');
  const r = await readyAt('0.2.1');
  r.u.setDir('/baska');
  assert.strictEqual(r.u.state.phase, 'ready');
});

// ---------- manifest okuma ----------
test('manifest okuma: geçersiz veya okunamayan kaynaklar atlanır, denenenler ayrıntılı listelenir', async () => {
  const t = make();
  const a = path.join(t.root, 'a'), b = path.join(t.root, 'b'), c = path.join(t.root, 'c'), d = path.join(t.root, 'd'), e = path.join(t.root, 'e');
  for (const x of [a, b, c, d]) fs.mkdirSync(x);
  fs.writeFileSync(path.join(a, MANIFEST), 'null');
  fs.writeFileSync(path.join(b, MANIFEST), JSON.stringify({ version: '9.9.9' }));
  fs.writeFileSync(path.join(c, MANIFEST), JSON.stringify({ file: 'x.exe' }));
  fs.writeFileSync(path.join(d, MANIFEST), '{bozuk json');
  let msg; try { JSON.parse('{bozuk json'); } catch (err) { msg = err.message; }
  process.env.CLAUDE_PANEL_UPDATES = a;
  try {
    // kaynak sırası: ortam (a) → ayar; diğerlerini sırayla ayar olarak dene
    const res = [];
    for (const x of [b, c, d, e]) { t.u.setDir(x); res.push((await t.u.check({ manual: true })).tried); }
    assert.deepStrictEqual(res[0], [`${a} (geçersiz)`, `${b} (geçersiz)`]);
    assert.deepStrictEqual(res[1], [`${a} (geçersiz)`, `${c} (geçersiz)`]);
    assert.deepStrictEqual(res[2], [`${a} (geçersiz)`, `${d} (${msg})`]);
    assert.deepStrictEqual(res[3], [`${a} (geçersiz)`, `${e} (ENOENT)`]);
    assert.strictEqual(t.u.state.error, 'Güncelleme klasörüne ulaşılamadı');
    // ilk kaynak geçersizse sıradaki geçerli kaynak kullanılır
    t.u.setDir(t.dir); release(t.dir, '0.2.1');
    const st = await t.u.check({ manual: true });
    assert.strictEqual(st.phase, 'ready'); assert.strictEqual(st.source, t.dir);
  } finally { delete process.env.CLAUDE_PANEL_UPDATES; }
});

// ---------- denetim ve indirme ----------
test('denetim: durum sırası, ilerleme olayları, notlar, kaynak ve indirilen dosya', async () => {
  const t = make(); t.u.setDir(t.dir);
  const { buf, m } = release(t.dir, '0.2.1');
  const st = await t.u.check();
  assert.deepStrictEqual([...new Set(t.states)], ['idle', 'checking', 'downloading', 'ready']);
  assert.strictEqual(st.latest, '0.2.1'); assert.strictEqual(st.source, t.dir); assert.strictEqual(st.notes, '');
  assert.strictEqual(st.current, '0.2.0'); assert.strictEqual(st.error, null);
  assert.strictEqual(st.file, path.join(t.dl, exeName('0.2.1'))); assert.strictEqual(st.sha512, m.sha512);
  assert.ok(fs.readFileSync(st.file).equals(buf));
  assert.strictEqual(fs.existsSync(st.file + '.part'), false);
  const prog = t.snaps.filter(s => s.phase === 'downloading').map(s => s.progress);
  assert.strictEqual(prog[0], 0);
  const steps = prog.slice(1);
  assert.ok(steps.length >= 2, 'birden fazla ilerleme olayı');
  for (let i = 1; i < steps.length; i++) assert.ok(steps[i] > steps[i - 1], 'ilerleme artan ve tekrarsız');
  assert.strictEqual(steps.at(-1), 100);
  assert.ok(steps[0] > 0);
  assert.strictEqual(st.progress, 100);
});
test('denetim: notlar arayüze aktarılır', async () => {
  const t = make(); t.u.setDir(t.dir);
  release(t.dir, '0.2.1', { extra: { notes: 'Yenilikler' } });
  assert.strictEqual((await t.u.check()).notes, 'Yenilikler');
});
test('denetim: aynı veya eski sürümde "none" olur, indirme yapılmaz', async () => {
  for (const v of ['0.2.0', '0.1.9']) {
    const t = make(); t.u.setDir(t.dir); release(t.dir, v);
    const st = await t.u.check();
    assert.strictEqual(st.phase, 'none'); assert.strictEqual(st.latest, v); assert.strictEqual(st.source, t.dir);
    assert.strictEqual(typeof st.checkedAt, 'number');
    assert.ok(!t.states.includes('downloading'));
    assert.strictEqual(fs.existsSync(t.dl), false);
  }
});
test('denetim: kapalıyken "disabled" döner', async () => {
  const t = make({ enabled: false });
  assert.strictEqual((await t.u.check()).phase, 'disabled');
});
test('denetim: eşzamanlı çağrılar aynı işi paylaşır, iş bitince yenisi başlar', async () => {
  const t = make(); t.u.setDir(t.dir); release(t.dir, '0.2.0');
  const [s1, s2] = await Promise.all([t.u.check(), t.u.check()]);
  assert.strictEqual(s1, s2);
  assert.strictEqual(t.states.filter(p => p === 'checking').length, 1);
  assert.strictEqual((await t.u.check()).phase, 'none');
  assert.strictEqual(t.states.filter(p => p === 'checking').length, 2);
});
test('denetim: imza tutmazsa otomatik denetimde sessiz ("none"), elle denetimde hata; denenenler boş', async () => {
  for (const [manual, phase] of [[false, 'none'], [true, 'error']]) {
    const t = make(); t.u.setDir(t.dir); release(t.dir, '0.3.0', { sign: false });
    const st = await t.u.check({ manual });
    assert.strictEqual(st.phase, phase); assert.match(st.error, /Sürüm 0\.3\.0 imzası doğrulanamadı/);
    assert.strictEqual(st.tried, null);
    assert.ok(!t.states.includes('downloading'));
  }
});
test('denetim: indirme sırasında bozulma otomatik denetimde de hata gösterir (SHA-512)', async () => {
  const t = make(); t.u.setDir(t.dir); release(t.dir, '0.3.0', { over: { sha512: hashOf(Buffer.from('baska')) } });
  const st = await t.u.check();
  assert.strictEqual(st.phase, 'error'); assert.strictEqual(st.error, 'İndirilen dosya doğrulanamadı (SHA-512)');
  assert.strictEqual(fs.existsSync(path.join(t.dl, exeName('0.3.0'))), false);
});
test('denetim: boyut tutmazsa hata', async () => {
  const t = make(); t.u.setDir(t.dir); release(t.dir, '0.3.0', { over: { size: SIZE + 1 } });
  const st = await t.u.check();
  assert.strictEqual(st.phase, 'error'); assert.strictEqual(st.error, 'İndirilen dosyanın boyutu tutmuyor');
});
test('denetim: kurulum dosyası klasörde yoksa hata', async () => {
  const t = make(); t.u.setDir(t.dir); release(t.dir, '0.3.0');
  fs.unlinkSync(path.join(t.dir, exeName('0.3.0')));
  const st = await t.u.check();
  assert.strictEqual(st.phase, 'error'); assert.match(st.error, /ENOENT/);
});
test('denetim: hatadan sonra aynı sürüm düzeltilince indirilir ve hata temizlenir', async () => {
  const t = make(); t.u.setDir(t.dir); release(t.dir, '0.3.0', { over: { sha512: hashOf(Buffer.from('baska')) } });
  assert.strictEqual((await t.u.check()).phase, 'error');
  release(t.dir, '0.3.0');
  const st = await t.u.check();
  assert.strictEqual(st.phase, 'ready'); assert.strictEqual(st.error, null);
});

// ---------- önbellekteki indirme ----------
test('önbellek: daha önce indirilmiş geçerli dosya yeniden kopyalanmaz', async () => {
  const t = make(); t.u.setDir(t.dir);
  const { buf } = release(t.dir, '0.2.1');
  fs.mkdirSync(t.dl); fs.writeFileSync(path.join(t.dl, exeName('0.2.1')), buf);
  fs.unlinkSync(path.join(t.dir, exeName('0.2.1')));   // kaynakta olmasa da önbellekten hazır olur
  const st = await t.u.check();
  assert.strictEqual(st.phase, 'ready');
  assert.deepStrictEqual(t.snaps.filter(s => s.phase === 'downloading').map(s => s.progress), [0]);
});
test('önbellek: aynı boyutlu ama farklı içerikli veya farklı boyutlu dosya yeniden indirilir', async () => {
  for (const stale of [Buffer.alloc(SIZE, 1), Buffer.alloc(10, 7)]) {
    const t = make(); t.u.setDir(t.dir);
    const { buf } = release(t.dir, '0.2.1');
    fs.mkdirSync(t.dl); fs.writeFileSync(path.join(t.dl, exeName('0.2.1')), stale);
    const st = await t.u.check();
    assert.strictEqual(st.phase, 'ready');
    assert.ok(fs.readFileSync(st.file).equals(buf));
  }
});

// ---------- hazır sürümün yeniden denetimi ----------
test('hazır: aynı sürüm yeniden denetlenince hazır kalır, yeniden indirilmez, "checking" görünmez', async () => {
  const t = await readyAt('0.2.1');
  const file = t.u.state.file, n = t.states.length;
  const st = await t.u.check({ manual: true });
  assert.strictEqual(st.phase, 'ready'); assert.strictEqual(st.file, file); assert.strictEqual(st.latest, '0.2.1');
  assert.deepStrictEqual(t.states.slice(n), ['ready']);
  assert.strictEqual(typeof st.checkedAt, 'number');
});
test('hazır: klasörde daha eski (ama kuruludan yeni) sürüm görünürse hazır olan korunur', async () => {
  const t = await readyAt('0.2.2');
  release(t.dir, '0.2.1');
  const st = await t.u.check();
  assert.strictEqual(st.phase, 'ready'); assert.strictEqual(st.latest, '0.2.2');
});
test('hazır: daha yeni sürüm çıkınca o indirilir ve hazır sürümün yerini alır', async () => {
  const t = await readyAt('0.2.1');
  release(t.dir, '0.2.5', { fill: 9 });
  const st = await t.u.check();
  assert.strictEqual(st.phase, 'ready'); assert.strictEqual(st.latest, '0.2.5');
  assert.strictEqual(st.file, path.join(t.dl, exeName('0.2.5')));
  assert.ok(t.states.includes('downloading'));
});
test('hazır: kaynağa ulaşılamazsa hazır sürüm korunur (otomatik ve elle)', async () => {
  const t = await readyAt('0.2.1');
  const before = t.u.state;
  t.u.setDir(path.join(t.root, 'yok'));
  for (const manual of [false, true]) {
    const st = await t.u.check({ manual });
    assert.strictEqual(st.phase, 'ready'); assert.strictEqual(st.file, before.file); assert.strictEqual(st.sha512, before.sha512);
  }
  assert.strictEqual(t.u.install(), true);
});
test('hazır: daha yeni sürümün imzası tutmazsa veya indirmesi bozulursa önceki hazır sürüm geri gelir', async () => {
  for (const opt of [{ sign: false }, { over: { sha512: hashOf(Buffer.from('baska')) } }]) {
    const t = await readyAt('0.2.1');
    const before = t.u.state;
    release(t.dir, '0.2.9', opt);
    const st = await t.u.check({ manual: true });
    assert.strictEqual(st.phase, 'ready'); assert.strictEqual(st.latest, '0.2.1');
    assert.strictEqual(st.file, before.file); assert.strictEqual(st.sha512, before.sha512);
    assert.strictEqual(t.u.install(), true);
    assert.strictEqual(t.spawn.calls[0].args[0], before.file);
  }
});
test('hazır: hazır dosya silinmişse aynı sürüm yeniden indirilir', async () => {
  const t = await readyAt('0.2.1');
  fs.unlinkSync(t.u.state.file);
  const st = await t.u.check();
  assert.strictEqual(st.phase, 'ready'); assert.ok(fs.existsSync(st.file));
  assert.ok(t.states.includes('downloading'));
});
test('hazır: hazır dosya silinmiş ve kaynağa da ulaşılamıyorsa hazır durumdan çıkılır', async () => {
  for (const [manual, phase] of [[false, 'none'], [true, 'error']]) {
    const t = await readyAt('0.2.1');
    fs.unlinkSync(t.u.state.file);
    t.u.setDir(path.join(t.root, 'yok'));
    const st = await t.u.check({ manual });
    assert.strictEqual(st.phase, phase); assert.strictEqual(st.error, 'Güncelleme klasörüne ulaşılamadı');
  }
});
test('hazır: klasördeki sürüm kuruluya eşit ya da eskiyse "none" olur', async () => {
  const t = await readyAt('0.2.1');
  release(t.dir, '0.2.0');
  assert.strictEqual((await t.u.check()).phase, 'none');
});

// ---------- kurulum ----------
test('kurulum: hazır değilken hiçbir şey başlatılmaz', () => {
  const t = make();
  let called = false;
  assert.strictEqual(t.u.install(() => { called = true; }), false);
  assert.strictEqual(called, false); assert.strictEqual(t.spawn.calls.length, 0);
});
test('kurulum: doğrulanmış dosya sessiz kurulumla başlatılır, başladıktan 300 ms sonra uygulama kapanır', async t0 => {
  const t = await readyAt('0.2.1');
  t0.mock.timers.enable({ apis: ['setTimeout'] });
  const order = [];
  assert.strictEqual(t.u.install(() => order.push('kaydet')), true);
  assert.deepStrictEqual(order, []);                // kayıt, kurulum gerçekten başlayınca yapılır
  assert.strictEqual(t.spawn.calls.length, 1);
  const { args, child } = t.spawn.calls[0];
  assert.deepStrictEqual(args, [t.u.state.file, ['/S', '--updated', '--force-run'], { detached: true, stdio: 'ignore', windowsHide: false }]);
  assert.strictEqual(child.unrefs, 1);
  t0.mock.timers.tick(1000);
  assert.strictEqual(t.quits.length, 0);           // süreç başlamadan kapanmaz
  child.emit('spawn');
  assert.deepStrictEqual(order, ['kaydet']);
  t0.mock.timers.tick(299);
  assert.strictEqual(t.quits.length, 0);
  t0.mock.timers.tick(1);
  assert.strictEqual(t.quits.length, 1);
});
test('kurulum: beforeQuit yoksa veya hata atarsa kurulum yine başlar', async () => {
  for (const bq of [undefined, () => { throw new Error('kayıt hatası'); }]) {
    const t = await readyAt('0.2.1');
    assert.strictEqual(t.u.install(bq), true);
    assert.strictEqual(t.spawn.calls.length, 1);
    t.spawn.calls[0].child.emit('spawn');
    await new Promise(r => setTimeout(r, 350));
    assert.strictEqual(t.quits.length, 1);
  }
});
test('kurulum: kurulum süreci başlatılamazsa hata gösterilir, uygulama kapanmaz', async () => {
  const t = await readyAt('0.2.1');
  let saved = 0;                                    // kayıt/kapanış onayı devre dışı bırakılmaz (main.js quitConfirmed)
  assert.strictEqual(t.u.install(() => saved++), true);
  t.spawn.calls[0].child.emit('error', new Error('EACCES'));
  assert.strictEqual(saved, 0);
  assert.strictEqual(t.u.state.phase, 'error'); assert.strictEqual(t.u.state.error, 'Kurulum başlatılamadı: EACCES');
  await new Promise(r => setTimeout(r, 350));
  assert.strictEqual(t.quits.length, 0);
});
test('kurulum: indirmeden sonra değiştirilen dosya kurulmaz, silinir ve sonraki denetimde yeniden indirilir', async () => {
  const t = await readyAt('0.2.1');
  const file = t.u.state.file;
  fs.writeFileSync(file, Buffer.alloc(SIZE, 66));     // aynı boyut, farklı içerik
  let called = false;
  assert.strictEqual(t.u.install(() => { called = true; }), false);
  assert.strictEqual(called, false); assert.strictEqual(t.spawn.calls.length, 0);
  assert.strictEqual(t.u.state.phase, 'error'); assert.match(t.u.state.error, /değişmiş/);
  assert.strictEqual(fs.existsSync(file), false);
  const st = await t.u.check();
  assert.strictEqual(st.phase, 'ready'); assert.ok(fs.readFileSync(st.file).equals(t.rel.buf));
  assert.strictEqual(t.u.install(), true);
});
test('kurulum: hazır dosya silinmişse kurulmaz ve hata gösterilir', async () => {
  const t = await readyAt('0.2.1');
  fs.unlinkSync(t.u.state.file);
  assert.strictEqual(t.u.install(), false);
  assert.strictEqual(t.u.state.phase, 'error'); assert.strictEqual(t.spawn.calls.length, 0);
});

// ---------- zamanlayıcılar ----------
test('start: kapalıyken "disabled" olur ve zamanlayıcı kurmaz', t0 => {
  t0.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const t = make({ enabled: false });
  t.u.start();
  assert.strictEqual(t.u.state.phase, 'disabled');
  t0.mock.timers.tick(2 * 60 * 60 * 1000);
  assert.deepStrictEqual(t.states, ['disabled']);
});
test('start/stop: 15 sn sonra ve 30 dakikada bir denetler, stop sonrası durur', async t0 => {
  t0.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const t = make(); t.u.setDir(path.join(t.root, 'yok'));
  const checks = () => t.states.filter(p => p === 'checking').length;
  t.u.start();
  t0.mock.timers.tick(14999);
  assert.strictEqual(checks(), 0);
  t0.mock.timers.tick(1);
  assert.strictEqual(checks(), 1);
  await t.u.check();                                   // çalışan denetimin bitmesini bekle
  t0.mock.timers.tick(30 * 60 * 1000 - 15000 - 1);
  assert.strictEqual(checks(), 1);
  t0.mock.timers.tick(1);
  assert.strictEqual(checks(), 2);
  await t.u.check();
  t.u.stop();
  t0.mock.timers.tick(2 * 60 * 60 * 1000);
  assert.strictEqual(checks(), 2);
  assert.strictEqual(t.u.state.phase, 'none');
});
