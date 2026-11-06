// Mac güncelleme yardımcıları (src/main/macupdate.js): imzalı mac girdisi, yol geçişi reddi, paket yeri denetimi,
// betik içeriği (tırnaklama, sıra) ve betiğin sahte ditto/xattr/codesign/open komutlarıyla gerçekten çalıştırılması.
// Mac'e erişim yok: betik Windows'ta Git Bash'in sh'ıyla, Mac/Linux'ta /bin/sh ile koşar (sh yoksa o testler atlanır).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const M = require('../src/main/macupdate');

const KP = crypto.generateKeyPairSync('ed25519');
const PRIV = KP.privateKey.export({ type: 'pkcs8', format: 'pem' }), PUB = KP.publicKey.export({ type: 'spki', format: 'pem' });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cp-qmac-'));
const H = n => crypto.createHash('sha512').update(String(n)).digest('base64');
const entry = (o = {}) => ({ version: '0.3.0', file: 'Claude Panel-0.3.0-arm64-mac.zip', size: 10, sha512: H(1), dmg: 'Claude Panel-0.3.0-arm64.dmg', dmgSize: 20, dmgSha512: H(2), notes: 'n', ...o });
const signed = e => ({ ...e, imza: M.signMacEntry(e, PRIV) });

// ---------- adlar ve imza ----------
test('safeName: yalnız klasördeki düz dosya adı ve doğru uzantı', () => {
  for (const ok of ['a.zip', 'Claude Panel-0.3.0-arm64-mac.zip', 'X.ZIP', 'a b (1).zip']) assert.strictEqual(M.safeName(ok, '.zip'), true, ok);
  for (const bad of [undefined, 5, '', '.zip', 'a.dmg', 'a.zip.sh', '../a.zip', 'a/../b.zip', '..a.zip', 'a..b.zip', 'a/b.zip', 'a\\b.zip', 'C:a.zip',
    '/abs.zip', '.gizli.zip', '-rf.zip', 'a\0.zip', 'a\n.zip', 'a*.zip', 'a?.zip', 'a"b.zip', 'a<b.zip', 'a|b.zip'])
    assert.strictEqual(M.safeName(bad, '.zip'), false, JSON.stringify(bad));
  assert.strictEqual(M.safeName('a.dmg', '.dmg'), true);
});
test('verifyMacEntry: doğru anahtarla imzalı girdi kabul edilir; imza zip ve dmg alanlarının hepsini kapsar', () => {
  assert.strictEqual(M.verifyMacEntry(signed(entry()), PUB), true);
  assert.strictEqual(M.verifyMacEntry(signed(entry({ version: '1.2.3-beta.1' })), PUB), true);
  for (const k of ['version', 'file', 'size', 'sha512', 'dmg', 'dmgSize', 'dmgSha512']) {
    const e = signed(entry());
    e[k] = k.toLowerCase().includes('size') ? e[k] + 1 : k.toLowerCase().includes('sha') ? H(9) : k === 'version' ? '9.9.9' : 'Baska.' + (k === 'dmg' ? 'dmg' : 'zip');
    assert.strictEqual(M.verifyMacEntry(e, PUB), false, k + ' imzadan sonra değişti');
  }
  const other = crypto.generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' });
  assert.strictEqual(M.verifyMacEntry(signed(entry()), other), false);
  assert.strictEqual(M.verifyMacEntry(entry(), PUB), false);                         // imza yok
  assert.strictEqual(M.verifyMacEntry({ ...entry(), imza: 'bozuk' }, PUB), false);
  assert.strictEqual(M.verifyMacEntry(signed(entry()), 'anahtar değil'), false);
  // Windows imzası mac girdisinde geçmez (alan ayrımı: imzalanan metin farklı önekle başlar)
  assert.match(M.macSignedText(entry()), /^claude-panel-guncelleme-mac\n0\.3\.0\n/);
});
test('verifyMacEntry: SHA-512 zorunlu; bozuk biçim ve yol geçişi imza geçerli olsa da reddedilir', () => {
  assert.strictEqual(M.verifyMacEntry(null, PUB), false);
  assert.strictEqual(M.verifyMacEntry('x', PUB), false);
  const bad = [
    { version: '1.2' }, { version: 'v1.2.3' }, { version: undefined },
    { sha512: undefined }, { sha512: '' }, { sha512: 'aGFzaA==' }, { sha512: 5 }, { dmgSha512: undefined }, { dmgSha512: H(1).slice(1) + '!' },
    { size: 0 }, { size: -1 }, { size: 1.5 }, { size: '10' }, { dmgSize: undefined },
    { file: '../../Applications/Claude Panel.app.zip' }, { file: '/etc/x.zip' }, { file: 'a/b.zip' }, { file: 'a\\b.zip' }, { file: 'x.exe' }, { file: 'x.dmg' },
    { dmg: '../x.dmg' }, { dmg: 'x.zip' }, { dmg: '-x.dmg' }, { dmg: undefined },
  ];
  for (const o of bad) assert.strictEqual(M.verifyMacEntry(signed(entry(o)), PUB), false, JSON.stringify(o));
});

// ---------- manifest birleştirme (yayın) ----------
test('mergeMacEntry: Windows alanları aynen kalır, mac girdisi eklenir ya da değişir', () => {
  const win = { version: '0.2.8', file: 'Claude Panel Setup 0.2.8.exe', size: 3, sha512: 'x', imza: 'i', notes: 'w' };
  assert.deepStrictEqual(M.mergeMacEntry(win, { v: 1 }), { ...win, mac: { v: 1 } });
  assert.deepStrictEqual(M.mergeMacEntry({ ...win, mac: { v: 0 } }, { v: 2 }), { ...win, mac: { v: 2 } });
  for (const none of [null, undefined, [], 'x']) assert.deepStrictEqual(M.mergeMacEntry(none, { v: 1 }), { mac: { v: 1 } });
});
test('keepMacEntry: Windows yayını eski manifestteki mac girdisini taşır', () => {
  const m = { version: '0.2.9', file: 'a.exe' };
  assert.deepStrictEqual(M.keepMacEntry({ mac: { v: 1 } }, m), { ...m, mac: { v: 1 } });
  assert.strictEqual(M.keepMacEntry(null, m), m);
  assert.strictEqual(M.keepMacEntry({}, m), m);
  assert.strictEqual(M.keepMacEntry({ mac: 'bozuk' }, m), m);
});

// ---------- paket yeri ----------
test('bundleRoot: yürütülebilir yoldan .app kökü', () => {
  assert.strictEqual(M.bundleRoot('/Applications/Claude Panel.app/Contents/MacOS/Claude Panel'), '/Applications/Claude Panel.app');
  assert.strictEqual(M.bundleRoot('/Users/y/Applications/Claude Panel.app/Contents/MacOS/Claude Panel'), '/Users/y/Applications/Claude Panel.app');
  for (const bad of [undefined, '', '/usr/bin/node', 'Claude Panel.app/Contents/MacOS/x', '/A.app/Contents/MacOS/', '/A.app/Contents/Resources/x', 'C:\\x.exe'])
    assert.strictEqual(M.bundleRoot(bad), null, String(bad));
});
test('preflight: yalnız /Applications veya ~/Applications içinde, yazılabilir, karantinasız paket kendi yerinde değiştirilir', () => {
  const calls = [], ok = (p, m) => calls.push([p, m]);
  assert.strictEqual(M.preflight('/Applications/Claude Panel.app', { home: '/Users/y', access: ok }), null);
  assert.deepStrictEqual(calls, [['/Applications', fs.constants.W_OK], ['/Applications/Claude Panel.app', fs.constants.W_OK]]);
  assert.strictEqual(M.preflight('/Users/y/Applications/Claude Panel.app', { home: '/Users/y', access: ok }), null);
  assert.match(M.preflight(null), /yeri bulunamadı/);
  assert.match(M.preflight('/private/var/folders/x/T/AppTranslocation/ABC/d/Claude Panel.app', { access: ok }), /App Translocation/);
  assert.match(M.preflight('/Users/y/Downloads/Claude Panel.app', { home: '/Users/y', access: ok }), /Applications klasöründe değil: \/Users\/y\/Downloads\/Claude Panel.app/);
  assert.match(M.preflight('/Volumes/Claude Panel/Claude Panel.app', { home: '/Users/y', access: ok }), /Applications klasöründe değil/); // DMG'den çalışıyor
  assert.match(M.preflight('/Applications/Alt/Claude Panel.app', { home: '/Users/y', access: ok }), /Applications klasöründe değil/);
  const deny = () => { throw Object.assign(new Error('EACCES'), { code: 'EACCES' }); };
  assert.strictEqual(M.preflight('/Applications/Claude Panel.app', { home: '/Users/y', access: deny }), '/Applications klasörüne yazma izni yok');
  let n = 0; const denyApp = () => { if (n++) deny(); };
  assert.match(M.preflight('/Applications/Claude Panel.app', { home: '/Users/y', access: denyApp }), /yazma izni yok/);
  assert.match(M.preflight('/Users/y/Downloads/X.app'), /Applications klasöründe değil/); // varsayılan home/access
});

// ---------- betik dosyası ----------
test('writeScript: mkdtemp klasöründe sabit betik, wx ile (var olanın üstüne yazmaz)', () => {
  const root = tmp();
  const a = M.writeScript(root), b = M.writeScript(root);
  assert.notStrictEqual(a.work, b.work);
  assert.strictEqual(path.dirname(a.work), root);
  assert.match(path.basename(a.work), /^claude-panel-mac-/);
  assert.strictEqual(fs.readFileSync(a.script, 'utf8'), M.SCRIPT);
  if (process.platform !== 'win32') {
    assert.strictEqual(fs.statSync(a.work).mode & 0o777, 0o700);
    assert.strictEqual(fs.statSync(a.script).mode & 0o077, 0);
  }
  assert.throws(() => fs.writeFileSync(a.script, 'x', { flag: 'wx' }), { code: 'EEXIST' });
  const d = M.writeScript(); assert.strictEqual(path.dirname(d.work), os.tmpdir()); fs.rmSync(d.work, { recursive: true });
});
test('scriptArgs: sıra $1…$6; dmg yoksa boş dize', () => {
  const o = { pid: 42, bundle: '/Applications/Claude Panel.app', newApp: '/t/yeni/Claude Panel.app', dmg: '/t/x.dmg', resultFile: '/r', logFile: '/l' };
  assert.deepStrictEqual(M.scriptArgs(o), ['42', o.bundle, o.newApp, '/t/x.dmg', '/r', '/l']);
  assert.deepStrictEqual(M.scriptArgs({ ...o, dmg: null })[3], '');
});

/** Kabuk değişkenlerinin ($X, $1, $*) hepsi çift tırnak içinde mi? (yorum satırları ve $(…)/$((…)) açılışları hariç) */
function unquotedVars(script) {
  const bad = [];
  script.split('\n').forEach((line, n) => {
    if (/^\s*#/.test(line)) return;
    let dq = false, sq = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '\\' && !sq) { i++; continue; }
      if (c === '"' && !sq) dq = !dq;
      else if (c === "'" && !dq) sq = !sq;
      else if (c === '$' && !sq && !dq && /[A-Za-z0-9_{@*#?!]/.test(line[i + 1] || '')) bad.push(`${n + 1}: ${line.trim()}`);
    }
  });
  return bad;
}
test('SCRIPT: dış dize gömülmez; tüm değişkenler tırnaklı; yollar yalnız argümandan', () => {
  assert.deepStrictEqual(unquotedVars(M.SCRIPT), []);
  assert.deepStrictEqual(unquotedVars('echo $APP\nx="$A" $B\n# $YORUM\ny=\'$C\'\n'), ['1: echo $APP', '2: x="$A" $B']);
  assert.match(M.SCRIPT, /^#!\/bin\/sh\n/);
  assert.match(M.SCRIPT, /^PID="\$1"; APP="\$2"; NEW="\$3"; DMG="\$4"; RESULT="\$5"; LOG="\$6"$/m);
  assert.doesNotMatch(M.SCRIPT, /\$[7-9]|eval |\bsource\b|`/);      // başka argüman, eval ya da ters tırnak yok
  assert.doesNotMatch(M.SCRIPT, /Applications|Claude Panel\.app/);  // yol gömülmez
});
test('SCRIPT: sıra bekle → kopyala → yedekle → değiştir → xattr → codesign → open; hata olursa geri al + DMG', () => {
  const s = M.SCRIPT, main = s.slice(s.indexOf('log "başla'));
  const steps = ['kill -0 "$PID"', 'ditto "$NEW" "$STAGE"', 'mv "$APP" "$BACKUP"', 'BACKED=1', 'mv "$STAGE" "$APP"',
    'xattr -dr com.apple.quarantine "$APP"', 'codesign --force --deep --sign - "$APP"', 'rm -rf "$BACKUP"; BACKED=0', 'open "$APP" ||', 'rm -rf "$WORK"'];
  const at = steps.map(x => main.indexOf(x));
  assert.ok(at.every(i => i >= 0), JSON.stringify(steps.filter((_, i) => at[i] < 0)));
  assert.deepStrictEqual([...at].sort((a, b) => a - b), at, 'adımların sırası');
  const fail = s.slice(s.indexOf('fail() {'), s.indexOf('log "başla'));
  const fsteps = ['if [ "$BACKED" = 1 ]', 'rm -rf "$APP"', 'mv "$BACKUP" "$APP"', 'rm -rf "$STAGE"', '> "$RESULT"', 'open "$DMG"', 'open "$APP"', 'exit 1'];
  const fat = fsteps.map(x => fail.indexOf(x));
  assert.ok(fat.every(i => i >= 0)); assert.deepStrictEqual([...fat].sort((a, b) => a - b), fat);
  for (const step of ['ditto "$NEW" "$STAGE" || fail', 'mv "$APP" "$BACKUP" || fail', 'mv "$STAGE" "$APP" || fail', 'codesign --force --deep --sign - "$APP" || fail'])
    assert.ok(s.includes(step), step);
});

// ---------- paket çıkarma ----------
function fakeDitto(make) {
  const calls = [];
  const fn = async (cmd, args) => { calls.push([cmd, args]); make(args[3]); };
  fn.calls = calls; return fn;
}
const mkApp = (out, { plist = true, macos = true } = {}) => {
  const a = path.join(out, M.APP_NAME, 'Contents'); fs.mkdirSync(a, { recursive: true });
  if (plist) fs.writeFileSync(path.join(a, 'Info.plist'), '<plist/>');
  if (macos) fs.mkdirSync(path.join(a, 'MacOS'));
};
test('extractApp: ditto -x -k ile work/yeni içine açar, Claude Panel.app döner', async () => {
  const w = tmp(), ex = fakeDitto(o => mkApp(o));
  assert.strictEqual(await M.extractApp('/z/a.zip', w, ex), path.join(w, 'yeni', M.APP_NAME));
  assert.deepStrictEqual(ex.calls, [['ditto', ['-x', '-k', '/z/a.zip', path.join(w, 'yeni')]]]);
});
test('extractApp: paket yoksa, dosyaysa, sembolik bağsa ya da eksikse hata; ditto hatası yukarı geçer', async () => {
  const cases = [
    () => {},
    o => fs.writeFileSync(path.join(o, M.APP_NAME), 'x'),
    o => mkApp(o, { plist: false }),
    o => mkApp(o, { macos: false }),
    o => { const real = path.join(path.dirname(o), 'gercek'); mkApp(real); fs.symlinkSync(path.join(real, M.APP_NAME), path.join(o, M.APP_NAME), 'junction'); },
  ];
  for (const c of cases) await assert.rejects(M.extractApp('/z.zip', tmp(), fakeDitto(c)), /paketin içinde Claude Panel\.app yok/);
  await assert.rejects(M.extractApp('/z.zip', tmp(), async () => { throw new Error('ditto: bozuk arşiv'); }), /bozuk arşiv/);
  const w = tmp(); fs.mkdirSync(path.join(w, 'yeni'));
  await assert.rejects(M.extractApp('/z.zip', w, fakeDitto(() => {})), { code: 'EEXIST' }); // eski çıkarma klasörünü kullanmaz
});

// ---------- sonuç ve günlük ----------
test('takeResult/appendLog: betiğin hata nedeni bir kez okunur; günlük eklenir; hatalar yutulur', () => {
  const d = tmp();
  assert.strictEqual(M.takeResult(d), null);
  fs.writeFileSync(path.join(d, M.RESULT_FILE), '  ad-hoc imza atılamadı (codesign)\n');
  assert.strictEqual(M.takeResult(d), 'ad-hoc imza atılamadı (codesign)');
  assert.strictEqual(fs.existsSync(path.join(d, M.RESULT_FILE)), false);
  assert.strictEqual(M.takeResult(d), null);
  fs.writeFileSync(path.join(d, M.RESULT_FILE), '\n');
  assert.strictEqual(M.takeResult(d), null);
  const ld = path.join(d, 'yeni', 'alt');
  M.appendLog(ld, 'bir'); M.appendLog(ld, 'iki');
  const lines = fs.readFileSync(path.join(ld, M.LOG_FILE), 'utf8').trim().split('\n');
  assert.strictEqual(lines.length, 2); assert.match(lines[0], /^\d{4}-\d\d-\d\dT.* bir$/); assert.match(lines[1], / iki$/);
  const file = path.join(d, 'dosya'); fs.writeFileSync(file, 'x');
  assert.doesNotThrow(() => M.appendLog(path.join(file, 'alt'), 'x'));         // klasör açılamazsa sessiz
  assert.ok(M.DEFAULT_SOURCES_MAC.every(p => p.startsWith('/Volumes/') && p.endsWith('/Claude App/Exe')));
  assert.match(M.GUIDE, /Applications klasörüne sürükleyin/);
});

// ---------- betiği gerçekten çalıştır (sahte ditto/xattr/codesign/open) ----------
const SH = process.platform === 'win32'
  ? ['C:\\Program Files\\Git\\bin\\sh.exe', 'C:\\Program Files (x86)\\Git\\bin\\sh.exe'].find(p => fs.existsSync(p))
  : ['/bin/sh'].find(p => fs.existsSync(p));
function fakeBin(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const w = (n, body) => fs.writeFileSync(path.join(dir, n), `#!/bin/sh\necho "CMD ${n} $*"\n${body}\n`, { mode: 0o755 });
  w('ditto', '[ -n "$FAKE_FAIL_DITTO" ] && exit 1\ncp -R "$1" "$2"');
  w('xattr', 'exit 0');
  w('codesign', '[ -n "$FAKE_FAIL_CODESIGN" ] && exit 1\necho imzali > "$5/Contents/imza"');   // codesign --force --deep --sign - <paket>
  w('open', 'exit 0');
}
const sl = p => p.replace(/\\/g, '/');   // Git Bash: C:/… biçimi (POSIX'te değişmez)
/** Sahte "uygulama süreci" (sleep) çalışırken betiği başlat; betik sürecin bitmesini beklemeli */
function runScript(t, env = {}) {
  return new Promise((res, rej) => {
    const started = Date.now();
    const p = spawn(SH, ['-c', 'sleep 1 & p=$!; s="$1"; shift; sh "$s" "$p" "$@"', 'sh', ...[t.script, t.app, t.newApp, t.dmg, t.result, t.log].map(sl)],
      { env: { ...process.env, PATH: t.bin + path.delimiter + process.env.PATH, ...env }, stdio: 'ignore' });
    p.on('error', rej);
    p.on('exit', code => res({ code, ms: Date.now() - started, log: fs.readFileSync(t.log, 'utf8') }));
  });
}
function scene() {
  const root = tmp();
  const apps = path.join(root, "Uygulamalar $HOME 'tek' `ters` ve boşluk");   // tırnaklama denemesi: $, ', `, boşluk, Türkçe harf
  const app = path.join(apps, M.APP_NAME);
  fs.mkdirSync(path.join(app, 'Contents', 'MacOS'), { recursive: true });
  fs.writeFileSync(path.join(app, 'Contents', 'surum'), 'eski');
  const { work, script } = M.writeScript(root);
  const newApp = path.join(work, 'yeni', M.APP_NAME);
  fs.mkdirSync(path.join(newApp, 'Contents', 'MacOS'), { recursive: true });
  fs.writeFileSync(path.join(newApp, 'Contents', 'surum'), 'yeni');
  const dmg = path.join(root, "Claude Panel-0.3.0 'x' $y.dmg"); fs.writeFileSync(dmg, 'dmg');
  const bin = path.join(root, 'sahte bin'); fakeBin(bin);
  return { root, apps, app, work, script, newApp, dmg, bin, result: path.join(root, 'sonuc.txt'), log: path.join(root, 'gunluk.log') };
}
const cmds = log => log.split('\n').filter(l => l.startsWith('CMD ')).map(l => l.split(' ')[1]);
const steps = log => log.split('\n').map(l => (/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d (\S+?):? /.exec(l + ' ') || /^CMD (\S+)/.exec(l) || [])[1]).filter(Boolean);
const leftovers = t => fs.readdirSync(t.apps).filter(f => f !== M.APP_NAME);

test('betik (gerçek sh): bekler, yedekler, değiştirir, xattr + codesign + open; yedeği ve çalışma klasörünü siler', { skip: !SH && 'sh yok' }, async () => {
  const t = scene();
  const r = await runScript(t);
  assert.strictEqual(r.code, 0, r.log);
  assert.ok(r.ms >= 900, 'uygulama süreci bitmeden başlamamalı: ' + r.ms);
  assert.deepStrictEqual(steps(r.log), ['başla', 'bekle', 'ditto', 'yedekle', 'değiştir', 'xattr', 'xattr', 'codesign', 'codesign', 'open', 'bitti']);
  assert.ok(r.log.includes(`CMD ditto ${sl(t.newApp)} ${sl(path.join(t.apps, '.' + M.APP_NAME + '.yeni'))}`), r.log);
  assert.ok(r.log.includes(`CMD codesign --force --deep --sign - `));
  assert.ok(r.log.includes(`CMD xattr -dr com.apple.quarantine `));
  assert.strictEqual(fs.readFileSync(path.join(t.app, 'Contents', 'surum'), 'utf8'), 'yeni');
  assert.strictEqual(fs.readFileSync(path.join(t.app, 'Contents', 'imza'), 'utf8').trim(), 'imzali');   // imzalanan yeni paket
  assert.deepStrictEqual(leftovers(t), []);                       // .yedek ve .yeni kalmadı
  assert.strictEqual(fs.existsSync(t.work), false);               // geçici klasör (betik dahil) silindi
  assert.strictEqual(fs.existsSync(t.result), false);             // hata yok
  assert.deepStrictEqual(cmds(r.log).filter(c => c === 'open').length, 1);
});
test('betik (gerçek sh): codesign başarısızsa eskisi geri konur, neden yazılır, DMG ve eski uygulama açılır', { skip: !SH && 'sh yok' }, async () => {
  const t = scene();
  const r = await runScript(t, { FAKE_FAIL_CODESIGN: '1' });
  assert.strictEqual(r.code, 1, r.log);
  assert.deepStrictEqual(steps(r.log), ['başla', 'bekle', 'ditto', 'yedekle', 'değiştir', 'xattr', 'xattr', 'codesign', 'HATA', 'geri', 'open', 'open']);
  assert.strictEqual(fs.readFileSync(path.join(t.app, 'Contents', 'surum'), 'utf8'), 'eski');
  assert.deepStrictEqual(leftovers(t), []);
  assert.strictEqual(fs.readFileSync(t.result, 'utf8').trim(), 'ad-hoc imza atılamadı (codesign)');
  const opens = r.log.split('\n').filter(l => l.startsWith('CMD open '));
  assert.strictEqual(opens.length, 2);
  assert.ok(opens[0].endsWith(".dmg") && opens[0].includes("'x' $y"), opens[0]);            // DMG adı olduğu gibi (genişletilmeden)
  assert.ok(opens[1].endsWith(M.APP_NAME) && opens[1].includes("$HOME 'tek' `ters`"), opens[1]);
});
test('betik (gerçek sh): kopyalama başarısızsa hiçbir şey değişmez, yedek alınmaz, DMG açılır', { skip: !SH && 'sh yok' }, async () => {
  const t = scene();
  const r = await runScript(t, { FAKE_FAIL_DITTO: '1' });
  assert.strictEqual(r.code, 1, r.log);
  assert.deepStrictEqual(steps(r.log), ['başla', 'bekle', 'ditto', 'HATA', 'open', 'open']);
  assert.strictEqual(fs.readFileSync(path.join(t.app, 'Contents', 'surum'), 'utf8'), 'eski');
  assert.deepStrictEqual(leftovers(t), []);
  assert.match(fs.readFileSync(t.result, 'utf8'), /yeni sürüm .* klasörüne kopyalanamadı/);
});
test('betik (gerçek sh): DMG verilmemişse yalnız eski uygulama açılır', { skip: !SH && 'sh yok' }, async () => {
  const t = scene(); t.dmg = '';
  const r = await runScript(t, { FAKE_FAIL_CODESIGN: '1' });
  assert.strictEqual(r.code, 1);
  assert.deepStrictEqual(r.log.split('\n').filter(l => l.startsWith('CMD open ')).length, 1);
});
