// main/term.js: terminal çekmecesinin komut çalıştırıcısı — tam kapsama.
// Gerçek süreçlerle (macOS/Linux kabuğu) akış, çıkış kodu, durdurma ve süreç grubu; sahte süreçle Windows dalı ve kenar durumları.
const { test, afterEach, after, mock } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');

const { Term, spawnSpec, _test } = require('../src/main/term');
const { deps, checkCmd, PS_PREFIX, MAX_PENDING, CLOSE_WAIT } = _test;
const REAL = { ...deps };
deps.env = async () => ({ ...process.env });
const ENVFN = deps.env;
afterEach(() => { Object.assign(deps, REAL, { env: ENVFN }); mock.timers.reset(); });

const made = [];
const tmp = () => { const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'qt-'))); made.push(d); return d; };
after(() => { for (const d of made) fs.rmSync(d, { recursive: true, force: true }); });

// Olayları toplayan Term; done(id) çıkış olayını bekler
function rec() {
  const evs = [];
  let wake = null;
  const t = new Term((ch, p) => { evs.push([ch, p]); if (wake) wake(); });
  t.evs = evs;
  t.done = id => new Promise(res => { const chk = () => { const e = evs.find(([, p]) => p.id === id && p.type === 'exit'); if (e) { wake = null; res(e[1]); } }; wake = chk; chk(); });
  t.text = (id, s) => evs.filter(([, p]) => p.id === id && p.type === 'out').flatMap(([, p]) => p.chunks).filter(c => !s || c[0] === s).map(c => c[1]).join('');
  return t;
}
// Sahte süreç: spawn çağrısını kaydeder
function fakeSpawn(pid = 4242) {
  const calls = [];
  deps.spawn = (file, args, opts) => {
    const p = new EventEmitter();
    const stream = () => Object.assign(new EventEmitter(), { setEncoding() {}, destroyed: false, destroy() { this.destroyed = true; } });
    p.stdout = stream(); p.stderr = stream(); p.pid = pid;
    calls.push({ file, args, opts, p });
    return p;
  };
  return calls;
}
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const W = ms => new Promise(r => setTimeout(r, ms));

test('spawnSpec: macOS kabuğu -lc ile, kendi süreç grubunda', () => {
  assert.deepStrictEqual(spawnSpec('echo a', { platform: 'darwin', shell: '/bin/bash' }), { file: '/bin/bash', args: ['-lc', 'echo a'], detached: true });
  assert.strictEqual(spawnSpec('x', { platform: 'darwin', shell: 'bash' }).file, '/bin/zsh', 'göreli kabuk yolu kullanılmaz');
  assert.strictEqual(spawnSpec('x', { platform: 'linux' }).file, '/bin/zsh');
  assert.deepStrictEqual(spawnSpec('x').args, ['-lc', 'x'], 'seçenek verilmezse de çalışır');
});

test('spawnSpec: Windows PowerShell, komut base64 ile taşınır (tırnak/ters bölü/Türkçe bozulmaz)', () => {
  const cmd = 'Write-Output "çalış \\"ğ\\" $env:PATH" \'x\'; dir C:\\Temp\r\nexit 3';
  const sp = spawnSpec(cmd, { platform: 'win32', shell: '/bin/zsh' });
  assert.strictEqual(sp.file, 'powershell.exe');
  assert.strictEqual(sp.detached, false);
  assert.deepStrictEqual(sp.args.slice(0, 4), ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command']);
  assert.strictEqual(sp.args.length, 5);
  const script = sp.args[4];
  assert.ok(script.startsWith(PS_PREFIX));
  assert.match(PS_PREFIX, /OutputEncoding=\[Text\.UTF8Encoding\]::new\(\$false\)/, 'BOM\'suz UTF-8');
  assert.ok(!/["\\\r\n]/.test(script), 'komut satırında çift tırnak, ters bölü ya da satır sonu yok');
  const b64 = /FromBase64String\('([A-Za-z0-9+/=]+)'\)/.exec(script)[1];
  assert.strictEqual(Buffer.from(b64, 'base64').toString('utf8'), cmd);
  assert.match(script, /if\(\$LASTEXITCODE\)\{exit \$LASTEXITCODE\};if\(-not \$ok\)\{exit 1\}$/);
});

test('checkCmd: boş, metin olmayan, çok uzun, NUL içeren komut reddedilir', () => {
  for (const c of [undefined, null, 5, '', '   \n']) assert.throws(() => checkCmd(c), /Komut boş/);
  assert.throws(() => checkCmd('a'.repeat(10001)), /çok uzun/);
  assert.doesNotThrow(() => checkCmd('a'.repeat(10000)));
  assert.throws(() => checkCmd('echo a\0b'), /geçersiz/);
  assert.strictEqual(checkCmd(' ls '), ' ls ');
});

test('run: kimlik, komut ve klasör doğrulanır', async () => {
  const calls = fakeSpawn();
  const t = rec(), d = tmp();
  await assert.rejects(t.run(), /Geçersiz komut kimliği/);
  await assert.rejects(t.run({ id: 'a b', cwd: d, cmd: 'ls' }), /Geçersiz komut kimliği/);
  await assert.rejects(t.run({ id: 'x'.repeat(65), cwd: d, cmd: 'ls' }), /Geçersiz komut kimliği/);
  await assert.rejects(t.run({ id: 'k1', cwd: d, cmd: '' }), /Komut boş/);
  await assert.rejects(t.run({ id: 'k1', cwd: path.join(d, 'yok'), cmd: 'ls' }), /Çalışma klasörü bulunamadı/);
  fs.writeFileSync(path.join(d, 'f.txt'), '');
  await assert.rejects(t.run({ id: 'k1', cwd: path.join(d, 'f.txt'), cmd: 'ls' }), /Çalışma klasörü bulunamadı/);
  await assert.rejects(t.run({ id: 'k1', cwd: d + '\nx', cmd: 'ls' }), /bulunamadı|geçersiz/);
  assert.strictEqual(calls.length, 0, 'geçersiz istekte süreç başlatılmaz');
  assert.deepStrictEqual(await t.run({ id: 'k1', cwd: d, cmd: 'ls' }), { id: 'k1', cwd: d });
  await assert.rejects(t.run({ id: 'k1', cwd: d, cmd: 'ls' }), /çalışan bir komut var/);
  assert.strictEqual(calls.length, 1);
  calls[0].p.emit('close', 0, null);
});

test('gerçek kabuk: stdout/stderr ayrı akar, klasör ve çıkış kodu doğru, TERM=dumb', async () => {
  const t = rec(), d = tmp();
  const r = await t.run({ id: 'r1', cwd: d, cmd: 'echo merhaba; pwd; echo "T=$TERM"; echo hata 1>&2; exit 3' });
  assert.strictEqual(r.cwd, d);
  const ex = await t.done('r1');
  assert.strictEqual(ex.code, 3);
  assert.strictEqual(ex.signal, null);
  assert.strictEqual(ex.stopped, false);
  assert.ok(typeof ex.ms === 'number' && ex.ms >= 0);
  const o = t.text('r1', 'out');
  assert.ok(o.includes('merhaba\n'), o);
  assert.ok(o.includes(d + '\n'), 'komut sohbetin klasöründe çalışır');
  assert.ok(o.includes('T=dumb\n'));
  assert.strictEqual(t.text('r1', 'err'), 'hata\n');
  assert.strictEqual(t.runs.size, 0);
  const i = t.evs.findIndex(([, p]) => p.type === 'exit');
  assert.strictEqual(i, t.evs.length - 1, 'çıkış olayı en son gelir (bekleyen çıktı önce gönderilir)');
  assert.ok(t.evs.every(([ch]) => ch === 'term:event'));
});

test('gerçek kabuk: UTF-8 Türkçe çıktı bozulmaz; çıkış 0', async () => {
  const t = rec(), d = tmp();
  await t.run({ id: 'r2', cwd: d, cmd: 'printf "çğışöü İ\\n"' });
  const ex = await t.done('r2');
  assert.strictEqual(ex.code, 0);
  assert.strictEqual(t.text('r2'), 'çğışöü İ\n');
});

test('durdurma: uzun komut ve arka plandaki alt süreç kapanır', async () => {
  const t = rec(), d = tmp();
  // Arka plan işi SIGINT'i yok sayar (etkileşimsiz kabuk); kabuk bitince grupta kalan da kapatılmalı
  await t.run({ id: 's1', cwd: d, cmd: 'sleep 30 & echo $!; sleep 30; wait' });
  let pid = 0;
  for (let k = 0; k < 100 && !pid; k++) { await W(30); pid = +t.text('s1').trim(); }
  assert.ok(pid > 0 && alive(pid), 'arka plan süreci çalışıyor');
  const t0 = Date.now();
  assert.strictEqual(t.stop('s1'), true);
  const ex = await t.done('s1');
  assert.strictEqual(ex.stopped, true);
  assert.ok(Date.now() - t0 < 2500, 'hemen durur');
  await W(100);
  assert.strictEqual(alive(pid), false, 'alt süreç de kapandı');
  assert.strictEqual(t.stop('s1'), false, 'bitmiş komut tekrar durdurulamaz');
  assert.strictEqual(t.stop('yok'), false);
});

test('stopAll: tüm çalışanları hemen SIGKILL ile kapatır', async () => {
  const t = rec(), d = tmp();
  await t.run({ id: 'a1', cwd: d, cmd: 'trap "" INT TERM; sleep 30' });
  await t.run({ id: 'a2', cwd: d, cmd: 'sleep 30' });
  await W(150);
  t.stopAll();
  const [e1, e2] = await Promise.all([t.done('a1'), t.done('a2')]);
  assert.strictEqual(e1.stopped, true); assert.strictEqual(e2.stopped, true);
  assert.strictEqual(e2.signal, 'SIGKILL');
});

test('arka planda boruyu tutan süreç: çıkıştan kısa süre sonra biter', async () => {
  const t = rec(), d = tmp();
  const t0 = Date.now();
  await t.run({ id: 'b1', cwd: d, cmd: 'sleep 3 & echo $!' });
  const ex = await t.done('b1');
  assert.strictEqual(ex.code, 0);
  assert.ok(Date.now() - t0 < 2000, 'boru kapanmasını 3 sn beklemez');
  const pid = +t.text('b1').trim();
  try { process.kill(pid, 'SIGKILL'); } catch {}
});

test('başlatılamayan kabuk: hata çıkış olayıyla bildirilir', async () => {
  deps.shell = () => '/yok/boyle-bir-kabuk';
  const t = rec(), d = tmp();
  await t.run({ id: 'e1', cwd: d, cmd: 'echo a' });
  const ex = await t.done('e1');
  assert.match(ex.error, /ENOENT/);
  assert.strictEqual(t.runs.size, 0);
});

test('sahte süreç: BOM yalnızca ilk parçadan atılır, aynı akışın parçaları birleşir, sıra korunur', async () => {
  const calls = fakeSpawn();
  const t = rec(), d = tmp();
  await t.run({ id: 'f1', cwd: d, cmd: 'x' });
  const { p, opts } = calls[0];
  assert.deepStrictEqual(opts.stdio, ['ignore', 'pipe', 'pipe']);
  assert.strictEqual(opts.cwd, d);
  assert.strictEqual(opts.detached, true);
  assert.strictEqual(opts.windowsHide, true);
  p.stdout.emit('data', '\uFEFFa'); p.stdout.emit('data', '\uFEFFb'); p.stderr.emit('data', '\uFEFFE'); p.stdout.emit('data', 'c');
  p.stdout.emit('error', new Error('boru')); // akış hatası yok sayılır
  await W(80);
  const out = t.evs.filter(([, e]) => e.type === 'out');
  assert.strictEqual(out.length, 1, 'kısa aralıktaki parçalar tek olayda');
  assert.deepStrictEqual(out[0][1].chunks, [['out', 'a\uFEFFb'], ['err', 'E'], ['out', 'c']]);
  p.emit('close', 7, null); // 'exit' gelmeden 'close'
  const ex = await t.done('f1');
  assert.strictEqual(ex.code, 7);
  p.emit('exit', 0, null); p.emit('close', 0, null); // ikinci kez bitmez
  assert.strictEqual(t.evs.filter(([, e]) => e.type === 'exit').length, 1);
});

test('sahte süreç: çok büyük çıktıda eskisi atılır ve işaretlenir', async () => {
  const calls = fakeSpawn();
  const t = rec(), d = tmp();
  await t.run({ id: 'f2', cwd: d, cmd: 'yes' });
  const { p } = calls[0];
  p.stdout.emit('data', 'A'.repeat(100));
  p.stderr.emit('data', 'B'.repeat(MAX_PENDING)); // A'lar tamamen atılır, B'ler sığar
  p.stdout.emit('data', 'C'.repeat(10));          // B'nin başından 10 karakter kesilir
  await W(80);
  const ch = t.evs.find(([, e]) => e.type === 'out')[1].chunks;
  assert.strictEqual(ch[0][0], 'err'); assert.match(ch[0][1], /atlandı/);
  assert.deepStrictEqual(ch.slice(1).map(c => [c[0], c[1].length]), [['err', MAX_PENDING - 10], ['out', 10]]);
  p.stdout.emit('data', 'D');
  p.emit('exit', 0, null);
  p.emit('close', 0, null);
  await t.done('f2');
  const last = t.evs.filter(([, e]) => e.type === 'out').pop()[1].chunks;
  assert.deepStrictEqual(last, [['out', 'D']], 'işaret yalnızca kesilen gönderimde');
});

test('sahte süreç: çıkıştan sonra borular kapanmazsa CLOSE_WAIT sonunda kapatılır', async () => {
  const calls = fakeSpawn();
  const t = rec(), d = tmp();
  await t.run({ id: 'f3', cwd: d, cmd: 'x' });
  const { p } = calls[0];
  p.emit('exit', 2, null);
  await W(CLOSE_WAIT / 2);
  assert.strictEqual(t.evs.length, 0);
  const ex = await t.done('f3');
  assert.strictEqual(ex.code, 2);
  assert.ok(p.stdout.destroyed && p.stderr.destroyed);
});

test('sahte süreç: durdurma sırası SIGINT → SIGTERM → SIGKILL (gruba), bitince kalanlar SIGKILL', async () => {
  const calls = fakeSpawn(777);
  const kills = [];
  deps.kill = (pid, sig) => { kills.push([pid, sig]); if (sig === 'SIGTERM') throw new Error('ESRCH'); };
  const t = rec(), d = tmp();
  await t.run({ id: 'k1', cwd: d, cmd: 'x' });
  mock.timers.enable({ apis: ['setTimeout'] });
  assert.strictEqual(t.stop('k1'), true);
  assert.deepStrictEqual(kills, [[-777, 'SIGINT']]);
  mock.timers.tick(1000);
  assert.deepStrictEqual(kills.at(-1), [-777, 'SIGTERM'], 'hata yutulur');
  mock.timers.tick(2000);
  assert.deepStrictEqual(kills.at(-1), [-777, 'SIGKILL']);
  mock.timers.reset();
  calls[0].p.emit('close', null, 'SIGKILL');
  const ex = await t.done('k1');
  assert.strictEqual(ex.stopped, true);
  assert.strictEqual(ex.signal, 'SIGKILL');
  assert.deepStrictEqual(kills.at(-1), [-777, 'SIGKILL'], 'bitişte grup temizliği');
  assert.strictEqual(kills.length, 4);
});

test('sahte süreç: durdurulmadan biten komutta gruba sinyal gönderilmez; pid yoksa durdurma sinyalsiz', async () => {
  let calls = fakeSpawn(778);
  const kills = [];
  deps.kill = (pid, sig) => kills.push([pid, sig]);
  const t = rec(), d = tmp();
  await t.run({ id: 'n1', cwd: d, cmd: 'x' });
  calls[0].p.emit('close', 0, null);
  await t.done('n1');
  assert.strictEqual(kills.length, 0);
  calls = fakeSpawn(undefined);
  await t.run({ id: 'n2', cwd: d, cmd: 'x' });
  assert.strictEqual(t.stop('n2'), true);
  calls[0].p.emit('error', new Error('spawn EACCES'));
  const ex = await t.done('n2');
  assert.strictEqual(ex.error, 'spawn EACCES');
  assert.strictEqual(ex.stopped, true);
  assert.strictEqual(kills.length, 0);
});

test('Windows: powershell.exe, süreç grubu yok, TERM değişmez, durdurma taskkill /T /F', async () => {
  deps.platform = 'win32';
  deps.env = async () => ({ PATH: 'C:\\x', TERM: 'xterm' });
  const calls = fakeSpawn(9001);
  const ex = [];
  deps.execFile = (f, a, o, cb) => { ex.push([f, a, o]); cb(null); };
  const kills = [];
  deps.kill = (pid, sig) => kills.push([pid, sig]);
  const t = rec(), d = tmp();
  await t.run({ id: 'w1', cwd: d, cmd: 'Get-ChildItem' });
  const c = calls[0];
  assert.strictEqual(c.file, 'powershell.exe');
  assert.strictEqual(c.opts.detached, false);
  assert.strictEqual(c.opts.env.TERM, 'xterm');
  assert.strictEqual(c.opts.env.PATH, 'C:\\x');
  assert.strictEqual(t.stop('w1'), true);
  assert.deepStrictEqual(ex, [['taskkill', ['/pid', '9001', '/T', '/F'], { windowsHide: true }]]);
  t.stopAll(); // hard da taskkill
  assert.strictEqual(ex.length, 2);
  c.p.emit('exit', 1, null); c.p.emit('close', 1, null);
  const e = await t.done('w1');
  assert.strictEqual(e.stopped, true);
  assert.strictEqual(kills.length, 0, 'Windows\'ta sinyal gönderilmez');
});
