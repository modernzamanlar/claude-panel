// Mac yayını (scripts/release-mac.js) ve geriye uyumluluk: Mac girdisi eklenmiş guncelleme.json'u sahadaki 0.2.8 Windows
// istemcisi (test/fixtures/updater-0.2.8.js = 2fd1c5f:src/main/updater.js, birebir) hâlâ doğru okur ve kurar;
// release-win.js de Mac girdisini silmez.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { execFileSync } = require('child_process');
const { releaseMac, findArtifacts } = require('../scripts/release-mac');
const NEW = require('../src/main/updater');
const OLD = require('./fixtures/updater-0.2.8');
const MU = require('../src/main/macupdate');

const KP = crypto.generateKeyPairSync('ed25519');
const PRIV = KP.privateKey.export({ type: 'pkcs8', format: 'pem' }), PUB = KP.publicKey.export({ type: 'spki', format: 'pem' });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cp-qrel-'));
const hashOf = buf => crypto.createHash('sha512').update(buf).digest('base64');
const ENV0 = process.env.CLAUDE_PANEL_UPDATES;
delete process.env.CLAUDE_PANEL_UPDATES;
test.after(() => { if (ENV0 !== undefined) process.env.CLAUDE_PANEL_UPDATES = ENV0; });

/** dist (dmg + zip), NAS klasörü (isteğe bağlı Windows sürümü ve manifesti) ve imza anahtarı */
function scene({ version = '0.3.0', win = '0.2.9', winManifest = true, extraDist = [] } = {}) {
  const root = tmp(), dist = path.join(root, 'dist'), dest = path.join(root, 'NAS Exe'), keyFile = path.join(root, 'anahtar.pem');
  fs.mkdirSync(dist); fs.mkdirSync(dest); fs.writeFileSync(keyFile, PRIV);
  const zip = Buffer.alloc(200000, 5), dmg = Buffer.alloc(150000, 6);
  fs.writeFileSync(path.join(dist, `Claude Panel-${version}-arm64-mac.zip`), zip);
  fs.writeFileSync(path.join(dist, `Claude Panel-${version}-arm64.dmg`), dmg);
  for (const f of extraDist) fs.writeFileSync(path.join(dist, f), 'x');
  let w = null;
  if (winManifest) {
    const exe = Buffer.alloc(120000, 7), file = `Claude Panel Setup ${win}.exe`;
    fs.writeFileSync(path.join(dest, file), exe);
    w = { version: win, file, size: exe.length, sha512: hashOf(exe), notes: 'Windows notu', date: '2026-11-01T00:00:00.000Z' };
    w.imza = NEW.signManifest(w, PRIV);
    fs.writeFileSync(path.join(dest, NEW.MANIFEST), JSON.stringify(w, null, 2));
  }
  return { root, dist, dest, keyFile, version, zip, dmg, w, logs: [] };
}
const run = (s, o = {}) => releaseMac({ dist: s.dist, dest: s.dest, keyFile: s.keyFile, version: s.version, notes: 'Mac notu', publicKey: PUB, log: l => s.logs.push(l), ...o });
const readMf = s => JSON.parse(fs.readFileSync(path.join(s.dest, NEW.MANIFEST), 'utf8'));
function fakeSpawn() {
  const calls = [];
  const fn = (...args) => { const c = new EventEmitter(); c.unref = () => {}; calls.push(args); return c; };
  fn.calls = calls; return fn;
}

test('release-mac: dmg + zip NAS\'a kopyalanır, imzalı mac girdisi eklenir, Windows alanları bayt bayt aynı kalır', async () => {
  const s = scene();
  const m = await run(s, { now: new Date('2026-11-06T10:00:00Z') });
  const disk = readMf(s);
  assert.deepStrictEqual(disk, m);
  const { mac, ...win } = disk;
  assert.deepStrictEqual(win, s.w);                                        // Windows girdisi değişmedi (imzası dahil)
  assert.strictEqual(NEW.verifyManifest(win, PUB), true);
  assert.deepStrictEqual(mac, { version: '0.3.0', file: 'Claude Panel-0.3.0-arm64-mac.zip', size: s.zip.length, sha512: hashOf(s.zip),
    dmg: 'Claude Panel-0.3.0-arm64.dmg', dmgSize: s.dmg.length, dmgSha512: hashOf(s.dmg), notes: 'Mac notu', date: '2026-11-06T10:00:00.000Z', imza: mac.imza });
  assert.strictEqual(MU.verifyMacEntry(mac, PUB), true);
  assert.ok(fs.readFileSync(path.join(s.dest, mac.file)).equals(s.zip)); assert.ok(fs.readFileSync(path.join(s.dest, mac.dmg)).equals(s.dmg));
  assert.deepStrictEqual(fs.readdirSync(s.dest).filter(f => /\.(part|tmp)$/.test(f)), []);
  assert.ok(s.logs.at(-1).includes('Windows girdisi: 0.2.9'));
});
test('geriye uyumluluk: 0.2.8 Windows istemcisi Mac girdili manifesti okur, Windows exe\'sini indirir ve kurar', async () => {
  const s = scene(); await run(s);
  for (const [name, mod, extra] of [['0.2.8', OLD, {}], ['yeni', NEW, { defaultSources: [] }]]) {
    const spawn = fakeSpawn(), dl = path.join(s.root, 'indir-' + name);
    const u = mod.createUpdater({ app: { getVersion: () => '0.2.8', quit() {} }, settingsFile: path.join(s.root, name + '.json'), platform: 'linux', // Windows akışı; 'win32' gerçek NAS (V:) varsayılanlarını da okurdu
      enabled: true, publicKey: PUB, downloadDir: dl, spawn, ...extra });
    u.setDir(s.dest);
    const st = await u.check({ manual: true });
    assert.strictEqual(st.phase, 'ready', name + ': ' + st.error);
    assert.strictEqual(st.latest, '0.2.9'); assert.strictEqual(st.file, path.join(dl, 'Claude Panel Setup 0.2.9.exe'));
    assert.deepStrictEqual(fs.readdirSync(dl), ['Claude Panel Setup 0.2.9.exe']);            // zip/dmg'ye dokunmaz
    assert.strictEqual(u.install(), true);
    assert.deepStrictEqual(spawn.calls[0].slice(0, 2), [st.file, ['/S', '--updated', '--force-run']]);
  }
  // Mac istemcisi aynı manifestten zip'i alır
  const mac = NEW.createUpdater({ app: { getVersion: () => '0.2.8', quit() {} }, settingsFile: path.join(s.root, 'mac.json'), platform: 'darwin',
    enabled: true, publicKey: PUB, downloadDir: path.join(s.root, 'indir-mac'), defaultSources: [] });
  mac.setDir(s.dest);
  const st = await mac.check({ manual: true });
  assert.strictEqual(st.phase, 'ready'); assert.strictEqual(st.latest, '0.3.0'); assert.match(st.file, /-mac\.zip$/);
});
test('geriye uyumluluk: Windows girdisi yokken (yalnız Mac yayını) 0.2.8 istemcisi hiçbir şey indirmez', async () => {
  const s = scene({ winManifest: false }); await run(s);
  assert.deepStrictEqual(Object.keys(readMf(s)), ['mac']);
  const dl = path.join(s.root, 'indir');
  const u = OLD.createUpdater({ app: { getVersion: () => '0.2.8', quit() {} }, settingsFile: path.join(s.root, 'a.json'), platform: 'linux', enabled: true, publicKey: PUB, downloadDir: dl });
  u.setDir(s.dest);
  assert.strictEqual((await u.check()).phase, 'none');
  const st = await u.check({ manual: true });
  assert.strictEqual(st.phase, 'error'); assert.ok(st.tried[0].endsWith('(geçersiz)'));
  assert.strictEqual(fs.existsSync(dl), false);
  assert.ok(s.logs.at(-1).includes('Windows girdisi: yok'));
});
test('release-mac: ikinci yayın mac girdisini değiştirir, eski Mac paketlerinden yalnız bir öncekini bırakır; Windows exe\'lerine dokunmaz', async () => {
  // değişiklik zamanları elle sıralanır (copyFile Windows'ta kaynağın zamanını korur; aynı milisaniyeye düşmesin)
  const age = (v, t) => { for (const f of [`Claude Panel-${v}-arm64-mac.zip`, `Claude Panel-${v}-arm64.dmg`]) fs.utimesSync(path.join(s.dest, f), new Date(t), new Date(t)); };
  const s = scene({ version: '0.3.0' }); await run(s); age('0.3.0', 2e12);
  fs.writeFileSync(path.join(s.dest, 'Claude Panel-0.2.0-arm64-mac.zip'), 'eski'); fs.writeFileSync(path.join(s.dest, 'Claude Panel-0.2.0-arm64.dmg'), 'eski');
  age('0.2.0', 1e12);
  for (const [i, v] of ['0.3.1', '0.3.2'].entries()) {
    fs.writeFileSync(path.join(s.dist, `Claude Panel-${v}-arm64-mac.zip`), 'z' + v);
    fs.writeFileSync(path.join(s.dist, `Claude Panel-${v}-arm64.dmg`), 'd' + v);
    await run({ ...s, version: v }); age(v, 3e12 + i * 1e9);
  }
  const files = fs.readdirSync(s.dest).sort();
  assert.deepStrictEqual(files, ['Claude Panel Setup 0.2.9.exe', 'Claude Panel-0.3.1-arm64-mac.zip', 'Claude Panel-0.3.1-arm64.dmg',
    'Claude Panel-0.3.2-arm64-mac.zip', 'Claude Panel-0.3.2-arm64.dmg', NEW.MANIFEST].sort());
  const mf = readMf(s);
  assert.strictEqual(mf.mac.version, '0.3.2'); assert.strictEqual(NEW.verifyManifest(mf, PUB), true);
  assert.ok(s.logs.some(l => l.includes('eski sürüm kaldırıldı: Claude Panel-0.2.0-arm64-mac.zip')));
});
test('release-mac: eksik anahtar / klasör / paket, birden fazla paket, bozuk manifest, yanlış anahtar → yayın yapılmaz', async () => {
  const s = scene();
  await assert.rejects(run(s, { keyFile: path.join(s.root, 'yok.pem') }), /İmza anahtarı yok/);
  await assert.rejects(run(s, { dest: path.join(s.root, 'yok') }), /ulaşılamıyor/);
  await assert.rejects(run(s, { version: '9.9.9' }), /hiç dmg var \(önce npm run dist\)/);
  await assert.rejects(run(s, { dist: path.join(s.root, 'olmayan-dist') }), /hiç dmg/);
  const other = crypto.generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' });
  await assert.rejects(run(s, { publicKey: other }), /açık anahtarla doğrulanamadı/);
  assert.deepStrictEqual(readMf(s), s.w);                                  // manifest değişmedi
  fs.writeFileSync(path.join(s.dest, NEW.MANIFEST), '{bozuk');
  await assert.rejects(run(s), SyntaxError);
  assert.strictEqual(fs.readFileSync(path.join(s.dest, NEW.MANIFEST), 'utf8'), '{bozuk');
  const two = scene({ extraDist: ['Claude Panel-0.3.0-mac.zip'] });
  await assert.rejects(run(two), /birden fazla zip var: .*Claude Panel-0\.3\.0-mac\.zip/);
  // Windows girdisinin imzası tutmuyorsa uyarılır ama olduğu gibi bırakılır
  const bad = scene(); fs.writeFileSync(path.join(bad.dest, NEW.MANIFEST), JSON.stringify({ ...bad.w, size: 1 }));
  await run(bad);
  assert.ok(bad.logs.some(l => l.includes('Windows girdisinin imzası doğrulanamadı')));
  assert.strictEqual(readMf(bad).size, 1);
});
test('findArtifacts: "-arm64" olsun olmasın tek dmg/zip; başka sürüm ve benzer adlar karışmaz', () => {
  const d = tmp();
  for (const f of ['Claude Panel-0.3.0.dmg', 'Claude Panel-0.3.0-mac.zip', 'Claude Panel-0.3.01-arm64.dmg', 'Claude Panel-0.3.0-arm64.dmg.blockmap', 'Claude Panel-0x3x0-mac.zip'])
    fs.writeFileSync(path.join(d, f), 'x');
  assert.deepStrictEqual(findArtifacts(d, '0.3.0'), { dmg: 'Claude Panel-0.3.0.dmg', zip: 'Claude Panel-0.3.0-mac.zip' });
});
test('release-win.js: Windows yayını manifestteki mac girdisini korur (gerçek betik, geçici kök ve test anahtarıyla)', () => {
  const s = scene();
  const root = path.join(s.root, 'depo');
  for (const d of ['scripts', 'src/main', 'dist']) fs.mkdirSync(path.join(root, d), { recursive: true });
  fs.copyFileSync(path.join(__dirname, '..', 'scripts', 'release-win.js'), path.join(root, 'scripts', 'release-win.js'));
  fs.copyFileSync(path.join(__dirname, '..', 'src', 'main', 'macupdate.js'), path.join(root, 'src', 'main', 'macupdate.js'));
  // gömülü açık anahtarı test anahtarıyla değiştir (betik yayından önce imzayı gömülü anahtarla doğrular)
  const upd = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'updater.js'), 'utf8');
  const fixed = upd.replace(/const PUBLIC_KEY = `[^`]+`;/, 'const PUBLIC_KEY = ' + JSON.stringify(PUB) + ';');
  assert.notStrictEqual(fixed, upd);
  fs.writeFileSync(path.join(root, 'src', 'main', 'updater.js'), fixed);
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '0.2.10' }));
  fs.writeFileSync(path.join(root, 'dist', 'Claude Panel Setup 0.2.10.exe'), Buffer.alloc(5000, 9));
  return run(s).then(() => {
    const macBefore = readMf(s).mac;
    execFileSync(process.execPath, [path.join(root, 'scripts', 'release-win.js'), '--to', s.dest, '--notes', 'w'], { env: { ...process.env, CLAUDE_PANEL_SIGN_KEY: s.keyFile }, stdio: 'pipe' });
    const mf = readMf(s);
    assert.strictEqual(mf.version, '0.2.10'); assert.strictEqual(NEW.verifyManifest(mf, PUB), true);
    assert.deepStrictEqual(mf.mac, macBefore);
    assert.strictEqual(MU.verifyMacEntry(mf.mac, PUB), true);
    // bozuk eski manifest Windows yayınını durdurmaz (mac girdisi o durumda taşınamaz)
    fs.writeFileSync(path.join(s.dest, NEW.MANIFEST), '{bozuk');
    execFileSync(process.execPath, [path.join(root, 'scripts', 'release-win.js'), '--to', s.dest], { env: { ...process.env, CLAUDE_PANEL_SIGN_KEY: s.keyFile }, stdio: 'pipe' });
    assert.strictEqual(readMf(s).mac, undefined);
  });
});
