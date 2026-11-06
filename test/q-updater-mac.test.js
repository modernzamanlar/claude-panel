// Güncelleyici, Mac akışı (platform 'darwin' taklidi): guncelleme.json'da üst düzey Windows girdisi + imzalı "mac" girdisi (zip + dmg).
// Gerçek ditto/sh çalıştırılmaz (execFile/spawn sahte); betiğin kendisi test/q-macupdate.test.js'de gerçek sh ile denenir.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { createUpdater, signManifest, MANIFEST, DEFAULT_SOURCES_MAC } = require('../src/main/updater');
const MU = require('../src/main/macupdate');

const KP = crypto.generateKeyPairSync('ed25519');
const PRIV = KP.privateKey.export({ type: 'pkcs8', format: 'pem' }), PUB = KP.publicKey.export({ type: 'spki', format: 'pem' });
const SIZE = 300000;
const ENV0 = process.env.CLAUDE_PANEL_UPDATES;
delete process.env.CLAUDE_PANEL_UPDATES;
test.after(() => { if (ENV0 !== undefined) process.env.CLAUDE_PANEL_UPDATES = ENV0; });

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cp-qupdm-'));
const hashOf = buf => crypto.createHash('sha512').update(buf).digest('base64');
const exeName = v => `Claude Panel Setup ${v}.exe`;
const zipName = v => `Claude Panel-${v}-arm64-mac.zip`, dmgName = v => `Claude Panel-${v}-arm64.dmg`;

function macRelease(dir, version, { over = {}, sign = true, win = '0.9.0', mac: withMac = true } = {}) {
  const zip = Buffer.alloc(SIZE, 3), dmg = Buffer.alloc(SIZE / 2, 4);
  fs.writeFileSync(path.join(dir, zipName(version)), zip);
  fs.writeFileSync(path.join(dir, dmgName(version)), dmg);
  let mac = { version, file: zipName(version), size: zip.length, sha512: hashOf(zip), dmg: dmgName(version), dmgSize: dmg.length, dmgSha512: hashOf(dmg), notes: 'mac notu', ...over };
  if (sign) mac = { ...mac, imza: MU.signMacEntry(mac, PRIV) };
  const winBuf = Buffer.alloc(100, 1); fs.writeFileSync(path.join(dir, exeName(win)), winBuf);
  const w = { version: win, file: exeName(win), size: 100, sha512: hashOf(winBuf) }; w.imza = signManifest(w, PRIV);
  fs.writeFileSync(path.join(dir, MANIFEST), JSON.stringify(withMac ? { ...w, mac } : w));
  return { mac, zip, dmg, w };
}
function fakeSpawn() {
  const calls = [];
  const fn = (...args) => { const c = new EventEmitter(); c.unrefs = 0; c.unref = () => { c.unrefs++; }; calls.push({ args, child: c }); return c; };
  fn.calls = calls; return fn;
}
function fakeExec() {
  const calls = [];
  const fn = async (cmd, args) => {
    calls.push([cmd, args]); if (fn.fail) throw new Error(fn.fail);
    const a = path.join(args[3], MU.APP_NAME, 'Contents'); fs.mkdirSync(path.join(a, 'MacOS'), { recursive: true }); fs.writeFileSync(path.join(a, 'Info.plist'), 'p');
  };
  fn.calls = calls; return fn;
}
function makeMac(opts = {}) {
  const root = tmp(), dir = path.join(root, 'kaynak'), dl = path.join(root, 'indirilen'), work = path.join(root, 'is');
  fs.mkdirSync(dir); fs.mkdirSync(work);
  const snaps = [], quits = [], notes = [], spawn = fakeSpawn(), exec = fakeExec();
  const settingsFile = path.join(root, 'ayar', 'settings.json');
  const u = createUpdater({
    app: { getVersion: () => '0.2.0', quit: () => quits.push(Date.now()) }, settingsFile, enabled: true, publicKey: PUB, downloadDir: dl, spawn,
    platform: 'darwin', execFile: exec, exePath: () => '/Applications/Claude Panel.app/Contents/MacOS/Claude Panel',
    home: '/Users/y', access: () => {}, workRoot: work, notify: m => notes.push(m), pid: 4242, onState: s => snaps.push(s),
    defaultSources: [],   // gerçek NAS (/Volumes/…) bağlı bir Mac'te de test klasörü dışına bakılmasın
    ...opts,
  });
  u.setDir(dir);
  return { u, root, dir, dl, work, snaps, quits, notes, spawn, exec, settingsFile, logDir: path.dirname(settingsFile) };
}
async function macReady(opts = {}, rel = {}) {
  const t = makeMac(opts); const r = macRelease(t.dir, '0.2.1', rel);
  const st = await t.u.check({ manual: true });
  assert.strictEqual(st.phase, 'ready', st.error);
  return { ...t, rel: r };
}

test('Mac: varsayılan kaynaklar /Volumes altındaki NAS yolları; etkinlik yalnızca paketlenmiş uygulamada', async () => {
  const t = makeMac({ defaultSources: undefined }); t.u.setDir('/ayar');
  assert.deepStrictEqual(t.u.sources(), ['/ayar', ...DEFAULT_SOURCES_MAC]);
  assert.ok(DEFAULT_SOURCES_MAC.includes('/Volumes/192.168.1.249/personel disk/Ajans/00 - Yasin/Claude App/Exe'));
  const app = isPackaged => ({ getVersion: () => '0.2.0', quit() {}, isPackaged, getPath: () => '/x' });
  const sf = path.join(tmp(), 's.json');
  assert.strictEqual((await createUpdater({ app: app(false), settingsFile: sf, platform: 'darwin' }).check()).phase, 'disabled');
  const on = createUpdater({ app: app(true), settingsFile: sf, platform: 'darwin', publicKey: PUB, defaultSources: [] });
  on.setDir(path.join(tmp(), 'yok'));
  assert.strictEqual((await on.check()).phase, 'none');           // etkin: denedi, ulaşamadı (otomatik denetimde sessiz)
});
test('Mac: mac girdisi seçilir (Windows sürümü daha yüksek olsa da); zip + dmg indirilip doğrulanır', async () => {
  const t = makeMac(); const { mac, zip, dmg } = macRelease(t.dir, '0.2.1', { win: '0.9.0' });
  const st = await t.u.check();
  assert.strictEqual(st.phase, 'ready'); assert.strictEqual(st.latest, '0.2.1'); assert.strictEqual(st.notes, 'mac notu');
  assert.strictEqual(st.file, path.join(t.dl, zipName('0.2.1'))); assert.strictEqual(st.dmg, path.join(t.dl, dmgName('0.2.1')));
  assert.strictEqual(st.sha512, mac.sha512); assert.strictEqual(st.dmgSha512, mac.dmgSha512); assert.strictEqual(st.guide, null);
  assert.ok(fs.readFileSync(st.file).equals(zip)); assert.ok(fs.readFileSync(st.dmg).equals(dmg));
  assert.deepStrictEqual(fs.readdirSync(t.dl).sort(), [dmgName('0.2.1'), zipName('0.2.1')].sort());   // Windows exe Mac'te indirilmez
  const prog = t.snaps.filter(s => s.phase === 'downloading').map(s => s.progress);
  for (let i = 1; i < prog.length; i++) assert.ok(prog[i] > prog[i - 1], 'ilerleme artan');
  assert.strictEqual(prog.at(-1), 100); assert.ok(prog.some(p => p > 50 && p < 100), 'dmg de ilerlemeye katılır');
  // yeniden denetim: hazır kalır, yeniden kopyalanmaz
  assert.strictEqual((await t.u.check()).phase, 'ready');
  const same = makeMac({ app: { getVersion: () => '0.2.1', quit() {} } }); macRelease(same.dir, '0.2.1');
  assert.strictEqual((await same.u.check()).phase, 'none');
});
test('Mac: mac girdisi olmayan (yalnız Windows) manifest geçersiz sayılır; exe indirilmez', async () => {
  const t = makeMac(); macRelease(t.dir, '0.2.1', { mac: false });
  const st = await t.u.check({ manual: true });
  assert.strictEqual(st.phase, 'error'); assert.deepStrictEqual(st.tried, [`${t.dir} (geçersiz)`]);
  assert.strictEqual(fs.existsSync(t.dl), false);
});
test('Mac: SHA-512 zorunlu — girdide yoksa ya da dosya tutmazsa güncelleme reddedilir', async () => {
  for (const over of [{ sha512: undefined }, { dmgSha512: undefined }, { sha512: '' }]) {
    const t = makeMac(); macRelease(t.dir, '0.2.1', { over });
    const st = await t.u.check({ manual: true });
    assert.strictEqual(st.phase, 'error', JSON.stringify(over)); assert.match(st.error, /imzası doğrulanamadı/);
    assert.strictEqual(fs.existsSync(t.dl), false);
  }
  for (const which of ['file', 'dmg']) {
    const t = makeMac(); const { mac } = macRelease(t.dir, '0.2.1');
    const f = path.join(t.dir, mac[which]); fs.writeFileSync(f, Buffer.alloc(fs.statSync(f).size, 99)); // aynı boyut, farklı içerik
    const st = await t.u.check();
    assert.strictEqual(st.phase, 'error'); assert.match(st.error, /SHA-512/);
  }
  const u = makeMac(); macRelease(u.dir, '0.2.1', { sign: false });
  assert.match((await u.u.check({ manual: true })).error, /imzası doğrulanamadı/);
});
test('Mac: dosya adında yol geçişi imzalı olsa da reddedilir, hiçbir şey kopyalanmaz', async () => {
  for (const over of [{ file: '../../evil.zip' }, { dmg: '../evil.dmg' }, { file: '/tmp/evil.zip' }, { file: 'a/b.zip' }, { file: 'x.exe' }, { dmg: '.hidden.dmg' }]) {
    const t = makeMac(); macRelease(t.dir, '0.2.1', { over });
    const st = await t.u.check({ manual: true });
    assert.strictEqual(st.phase, 'error', JSON.stringify(over)); assert.match(st.error, /reddedildi/);
    assert.strictEqual(fs.existsSync(t.dl), false);
  }
});
test('Mac kurulum: doğrula → ditto ile çıkar → sabit betik → /bin/sh argümanlarla → beforeQuit → 300 ms sonra kapan', async t0 => {
  const t = await macReady();
  const order = [];
  assert.strictEqual(await t.u.install(() => order.push('kaydet')), true);
  assert.strictEqual(t.exec.calls.length, 1);
  const [cmd, dargs] = t.exec.calls[0];
  assert.strictEqual(cmd, 'ditto'); assert.deepStrictEqual(dargs.slice(0, 3), ['-x', '-k', t.u.state.file]);
  const work = path.dirname(dargs[3]);
  assert.strictEqual(path.dirname(work), t.work);
  assert.strictEqual(t.spawn.calls.length, 1);
  const [bin, args, o] = t.spawn.calls[0].args;
  assert.strictEqual(bin, '/bin/sh');
  assert.deepStrictEqual(o, { detached: true, stdio: 'ignore' });
  assert.deepStrictEqual(args, [path.join(work, 'guncelle.sh'), '4242', '/Applications/Claude Panel.app', path.join(work, 'yeni', MU.APP_NAME),
    t.u.state.dmg, path.join(t.logDir, MU.RESULT_FILE), path.join(t.logDir, MU.LOG_FILE)]);
  assert.strictEqual(fs.readFileSync(args[0], 'utf8'), MU.SCRIPT);          // betik sabit: hiçbir yol gömülmez
  assert.match(fs.readFileSync(path.join(t.logDir, MU.LOG_FILE), 'utf8'), /güncelleme 0\.2\.0 → 0\.2\.1: \/Applications\/Claude Panel\.app/);
  assert.strictEqual(t.spawn.calls[0].child.unrefs, 1);
  t0.mock.timers.enable({ apis: ['setTimeout'] });
  assert.deepStrictEqual(order, []); assert.strictEqual(t.quits.length, 0);  // betik başlamadan kapanmaz
  t.spawn.calls[0].child.emit('spawn');
  assert.deepStrictEqual(order, ['kaydet']);
  t0.mock.timers.tick(299); assert.strictEqual(t.quits.length, 0);
  t0.mock.timers.tick(1); assert.strictEqual(t.quits.length, 1);
  assert.deepStrictEqual(t.notes, []);
});
test('Mac kurulum: hazır değilken hiçbir şey yapılmaz; aynı anda ikinci basış yok sayılır; beforeQuit hatası kapanışı engellemez', async () => {
  const n = makeMac();
  assert.strictEqual(await n.u.install(), false); assert.strictEqual(n.spawn.calls.length, 0);
  const t = await macReady();
  const [a, b] = await Promise.all([t.u.install(() => { throw new Error('x'); }), t.u.install()]);
  assert.deepStrictEqual([a, b], [true, false]);
  assert.strictEqual(t.spawn.calls.length, 1);
  t.spawn.calls[0].child.emit('spawn');
  await new Promise(r => setTimeout(r, 350));
  assert.strictEqual(t.quits.length, 1);
});
test('Mac kurulum: indirmeden sonra değişen ya da silinen zip kurulmaz', async () => {
  for (const spoil of [f => fs.writeFileSync(f, Buffer.alloc(SIZE, 50)), f => fs.unlinkSync(f)]) {
    const t = await macReady();
    const f = t.u.state.file; spoil(f);
    assert.strictEqual(await t.u.install(), false);
    assert.strictEqual(t.u.state.phase, 'error'); assert.match(t.u.state.error, /değişmiş ya da silinmiş/);
    assert.strictEqual(fs.existsSync(f), false); assert.strictEqual(t.exec.calls.length, 0); assert.strictEqual(t.spawn.calls.length, 0);
  }
});

function assertFallback(t, reason, { dmg = t.u.state.dmg } = {}) {
  assert.strictEqual(t.u.state.phase, 'error');
  assert.ok(t.u.state.error.includes(reason), t.u.state.error);
  assert.match(t.u.state.guide, /Applications klasörüne sürükleyin/);
  const opens = t.spawn.calls.filter(c => c.args[0] === 'open');
  assert.deepStrictEqual(opens.map(c => c.args[1]), dmg ? [[dmg]] : []);
  assert.strictEqual(t.notes.length, 1); assert.match(t.notes[0], /sürükleyin[\s\S]*\n\nNeden: /); assert.ok(t.notes[0].includes(reason), t.notes[0]);
  const log = fs.readFileSync(path.join(t.logDir, MU.LOG_FILE), 'utf8').split('\n').find(l => l.includes(' HATA: '));
  assert.ok(log && log.includes(reason), log);
  assert.strictEqual(t.quits.length, 0);
}
test('Mac yedek yol: Applications dışında / translocation / yazma izni yok / paket yeri yok → DMG açılır, yönerge, kapanmaz', async () => {
  const cases = [
    [{ exePath: () => '/Users/y/Downloads/Claude Panel.app/Contents/MacOS/Claude Panel' }, 'Applications klasöründe değil'],
    [{ exePath: () => '/private/var/folders/a/T/AppTranslocation/X/d/Claude Panel.app/Contents/MacOS/Claude Panel' }, 'App Translocation'],
    [{ access: () => { throw new Error('EACCES'); } }, '/Applications klasörüne yazma izni yok'],
    [{ exePath: () => '/usr/local/bin/electron' }, 'yeri bulunamadı'],
  ];
  for (const [opts, reason] of cases) {
    const t = await macReady(opts);
    assert.strictEqual(await t.u.install(() => assert.fail('kapanmamalı')), false);
    assertFallback(t, reason);
    assert.strictEqual(t.exec.calls.length, 0);
    assert.strictEqual(t.spawn.calls.filter(c => c.args[0] === '/bin/sh').length, 0);
    t.spawn.calls[0].child.emit('error', new Error('open yok'));             // open'ın hatası çökertmez
  }
  // spawn('open') atarsa da yedek yol tamamlanır
  let n = 0;
  const t2 = makeMac({ exePath: () => '/x/Claude Panel.app/Contents/MacOS/Claude Panel', spawn: () => { n++; throw new Error('EPERM'); } });
  macRelease(t2.dir, '0.2.1'); await t2.u.check();
  assert.strictEqual(await t2.u.install(), false);
  assert.strictEqual(n, 1); assert.strictEqual(t2.u.state.phase, 'error'); assert.strictEqual(t2.notes.length, 1);
});
test('Mac yedek yol: DMG değişmişse açılmaz; yönerge güncelleme klasörünü gösterir', async () => {
  const t = await macReady({ exePath: () => '/tmp/x/Claude Panel.app/Contents/MacOS/Claude Panel' });
  fs.writeFileSync(t.u.state.dmg, 'bozuk');
  assert.strictEqual(await t.u.install(), false);
  assertFallback(t, 'Applications klasöründe değil', { dmg: null });
  assert.ok(t.u.state.guide.includes(`elle açın`) && t.u.state.guide.includes(t.dir), t.u.state.guide);
});
test('Mac yedek yol: paket açılamazsa (yarım klasör silinir) ya da betik başlatılamazsa', async () => {
  const t = await macReady(); t.exec.fail = 'ditto: bozuk arşiv';
  assert.strictEqual(await t.u.install(), false);
  assertFallback(t, 'Paket açılamadı: ditto: bozuk arşiv');
  assert.deepStrictEqual(fs.readdirSync(t.work), []);
  const w = await macReady({ workRoot: path.join(tmp(), 'olmayan', 'kok') });  // çalışma klasörü açılamazsa
  assert.strictEqual(await w.u.install(), false);
  assertFallback(w, 'Paket açılamadı: ENOENT');
  const e = await macReady();
  assert.strictEqual(await e.u.install(() => assert.fail('kapanmamalı')), true);
  e.spawn.calls[0].child.emit('error', new Error('ENOENT /bin/sh'));
  assertFallback(e, 'Güncelleme betiği başlatılamadı: ENOENT /bin/sh');
});
test('Mac açılış: betik başarısız olduysa neden bir kez gösterilir ve günlüğe yazılır; Windows bu dosyaya bakmaz', t0 => {
  t0.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const t = makeMac();
  fs.mkdirSync(t.logDir, { recursive: true });
  fs.writeFileSync(path.join(t.logDir, MU.RESULT_FILE), 'ad-hoc imza atılamadı (codesign)\n');
  t.u.start();
  assert.strictEqual(t.u.state.phase, 'error'); assert.match(t.u.state.error, /codesign/); assert.strictEqual(t.u.state.guide, MU.GUIDE);
  assert.strictEqual(t.notes.length, 1); assert.match(t.notes[0], /sürükleyin[\s\S]*Neden: ad-hoc imza/);
  assert.strictEqual(fs.existsSync(path.join(t.logDir, MU.RESULT_FILE)), false);
  assert.match(fs.readFileSync(path.join(t.logDir, MU.LOG_FILE), 'utf8'), /açılışta bildirildi: ad-hoc/);
  t.u.stop();
  const q = makeMac(); q.u.start(); q.u.stop();
  assert.deepStrictEqual(q.notes, []); assert.strictEqual(q.u.state.phase, 'idle');
  const w = makeMac({ platform: 'win32' }); fs.mkdirSync(w.logDir, { recursive: true });
  fs.writeFileSync(path.join(w.logDir, MU.RESULT_FILE), 'x');
  w.u.start(); w.u.stop();
  assert.ok(fs.existsSync(path.join(w.logDir, MU.RESULT_FILE)));
  assert.deepStrictEqual(w.notes, []);
});
