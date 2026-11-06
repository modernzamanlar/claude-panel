// runner.js: tam kapsama + mutasyon dayanıklılığı testleri.
// Süreç başlatma (spawn/execFile) ve platform `_test.deps` üzerinden değiştirilir; Windows dalları Mac'te de denenir.
const { test, afterEach, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const { execFileSync } = require('child_process');

const FAKE = path.join(__dirname, 'fake-claude.js');
process.env.CLAUDE_PANEL_CLAUDE_BIN = FAKE;
const WIN = process.platform === 'win32';
// Geçici ev klasörü (modül yüklenmeden önce): loginEnv PATH'e ~/.local/bin ekler; gerçek evdeki claude
// (Windows'ta ~/.local/bin/claude.exe) "claude yok" testlerinde bulunup gerçek CLI çalıştırılmasın.
const FAKE_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-ev-'));
process.env.HOME = FAKE_HOME; process.env.USERPROFILE = FAKE_HOME; // os.homedir(): POSIX HOME, Windows USERPROFILE
const R = require('../src/main/runner');
const { Runner, authStatus, openLoginTerminal, openRemoteTerminal, mcpList, contextUsage, claudeBin, loginEnv, launchSpec, controlStatus, installDesktop, desktopMcp, _test } = R;
const { deps } = _test;
const REAL = { ...deps };
const ENV0 = { ...process.env };
const HOME = os.homedir();
const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const UUIDRX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function restoreEnv() {
  for (const k of Object.keys(process.env)) if (!(k in ENV0)) delete process.env[k];
  Object.assign(process.env, ENV0);
}
afterEach(() => { Object.assign(deps, REAL); restoreEnv(); _test.reset(''); });
_test.reset(''); // giriş kabuğu PATH'i: testlerde boş (gerçek kabuk çalıştırılmaz)

const made = [];
const tmp = (name = 'qr-') => { const d = fs.mkdtempSync(path.join(os.tmpdir(), name)); made.push(d); return d; };
after(() => { for (const d of [...made, FAKE_HOME]) fs.rmSync(d, { recursive: true, force: true }); });
// macOS kipi Windows'ta: PATH ':' ile bölünür, sürücü harfli yol ("C:\…") parçalanır; zsh/izin bitleri yok
const POSIX_ONLY = WIN && 'yalnız POSIX: ":" ayraçlı PATH, izin bitleri ya da /bin/zsh gerekir';
// cli.js'in klasörlerini de kurar (Mac'te CLI_REL ters bölülerle tek dosya adıdır, klasör oluşmaz)
const writeCli = dir => { const f = path.join(dir, CLI_REL); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, ''); };
const exe = (f, body = '') => { fs.writeFileSync(f, body); fs.chmodSync(f, 0o755); return f; };
const fakeShell = () => { const opened = []; return { opened, openPath: async p => { opened.push(p); return ''; } }; };
// Windows kipi: giriş kabuğu yok, PATH yalnızca verilen klasörler; ekler (APPDATA…) kapalı
function winMode(pathDirs = []) {
  deps.platform = 'win32';
  delete process.env.APPDATA; delete process.env.LOCALAPPDATA; delete process.env.Path;
  process.env.PATH = pathDirs.join(';');
}
// claude hiç bulunamasın (Windows kipinde .exe/.cmd Mac klasörlerinde yok)
function noClaudeWin() { delete process.env.CLAUDE_PANEL_CLAUDE_BIN; winMode([tmp()]); }

// ---- Sahte süreç ----
function fakeProc(pid = 4242) {
  const p = new EventEmitter();
  p.pid = pid;
  p.raw = []; p.written = []; p.endCount = 0; p.kills = [];
  const stream = () => { const s = new EventEmitter(); s.setEncoding = enc => { s.enc = enc; }; return s; };
  p.stdout = stream(); p.stderr = stream();
  p.stdin = new EventEmitter();
  p.stdin.write = s => { p.raw.push(s); p.written.push(JSON.parse(s)); return true; };
  p.stdin.end = () => { p.endCount++; };
  p.kill = sig => { p.kills.push(sig); return true; };
  p.line = o => p.stdout.emit('data', (typeof o === 'string' ? o : JSON.stringify(o)) + '\n');
  return p;
}
function fakeSpawn() {
  const calls = [], procs = [];
  deps.spawn = (file, args, o) => { const pr = fakeProc(); calls.push({ file, args, o }); procs.push(pr); return pr; };
  return { calls, procs };
}
function collect() { const evs = []; const runner = new Runner((ch, p) => { assert.equal(ch, 'run:event'); evs.push(p); }); return { runner, evs }; }

// ================= Saf yardımcılar =================
test('expand: yalnızca "~" ve "~/" genişletilir, "~ad" ve diğerleri olduğu gibi kalır', () => {
  const { expand } = _test;
  assert.equal(expand('~'), HOME);
  assert.equal(expand('~/a/b'), path.join(HOME, 'a/b'));
  assert.equal(expand('~\\a'), path.join(HOME, '\\a'));
  assert.equal(expand('~yedek'), '~yedek');
  assert.equal(expand('/x/~'), '/x/~');
  assert.equal(expand(undefined), undefined);
  assert.equal(expand(''), '');
});

test('winQuote: güvenli argüman tırnaksız, boşluklu/özel olan tırnaklı, cmd metakarakteri reddedilir', () => {
  const { winQuote } = _test;
  assert.equal(winQuote('C:\\a/b.c:d=e@f-g_h'), 'C:\\a/b.c:d=e@f-g_h');
  assert.equal(winQuote('a b'), '"a b"');
  assert.equal(winQuote('claude-x[1m]'), '"claude-x[1m]"');
  assert.equal(winQuote(''), '""');
  assert.equal(winQuote(5), '5');
  for (const c of ['"', '%', '!', '^', '&', '|', '<', '>', '`', '\r', '\n', '\0']) assert.throws(() => winQuote('a' + c + 'b'), /^Error: Güvenli olmayan argüman reddedildi$/, JSON.stringify(c));
});

test('safeLabel: metakarakterler ve satır sonları boşluğa döner, uzunluk sınırlanır, boşsa varsayılan', () => {
  const { safeLabel } = _test;
  assert.equal(safeLabel(''), 'Claude Panel');
  assert.equal(safeLabel(null), 'Claude Panel');
  assert.equal(safeLabel('$&|'), 'Claude Panel');
  assert.equal(safeLabel('  a\n\tb  '), 'a b');
  assert.equal(safeLabel('$(id)`x`'), '(id) x');
  assert.equal(safeLabel('Çağrı · Ü_1.2-3'), 'Çağrı · Ü_1.2-3');
  assert.equal(safeLabel('x'.repeat(100)), 'x'.repeat(60));
  assert.equal(safeLabel('abcdefgh', 5), 'abcde');
});

// ================= loginEnv / loginPath =================
test('loginEnv: giriş kabuğunun PATH\'i bir kez okunur ve önbellekte tutulur', async () => {
  _test.reset(); deps.platform = 'darwin';
  const calls = [];
  deps.execFile = (file, args, o, cb) => { calls.push({ file, args, o }); cb(null, '/l1:/l2'); };
  process.env.SHELL = '/bin/kabuk-test';
  process.env.PATH = '/p1';
  const env = await loginEnv();
  assert.deepEqual(calls, [{ file: '/bin/kabuk-test', args: ['-l', '-c', 'printf "%s" "$PATH"'], o: { timeout: 5000 } }]);
  assert.equal(env.PATH, ['/l1', '/l2', '/p1', path.join(HOME, '.local/bin'), '/opt/homebrew/bin', '/usr/local/bin'].join(':'));
  await loginEnv();
  assert.equal(calls.length, 1);
});

test('loginEnv: SHELL yoksa /bin/zsh denenir; hata olursa giriş PATH\'i boş sayılır ve yine önbelleğe alınır', async () => {
  _test.reset(); deps.platform = 'darwin';
  const calls = [];
  deps.execFile = (file, args, o, cb) => { calls.push(file); cb(new Error('zaman aşımı'), '/bozuk'); };
  delete process.env.SHELL;
  process.env.PATH = '/p1';
  const env = await loginEnv();
  assert.deepEqual(calls, ['/bin/zsh']);
  assert.equal(env.PATH.split(':')[0], '/p1');
  assert.ok(!env.PATH.includes('/bozuk'));
  await loginEnv();
  assert.equal(calls.length, 1);
});

test('loginEnv: oturum değişkenleri ayıklanır, PATH tekilleşir, sıra korunur', async () => {
  _test.reset('/l1:/dup::'); deps.platform = 'darwin';
  Object.assign(process.env, { CLAUDECODE: '1', CLAUDE_CODE_X: '1', CLAUDE_AGENT_SDK_Y: '1', CLAUDE_PID: '1', CLAUDE_EFFORT: '1', CLAUDE_PREVIEW_Z: '1', ELECTRON_RUN_AS_NODE: '1', CLAUDECODEX: 'kalır', CLAUDE_PIDX: 'kalır', ELECTRON_RUN_AS_NODEX: 'kalır', KALSIN: 'evet' });
  process.env.PATH = '/dup:/p2:/opt/homebrew/bin';
  const env = await loginEnv();
  for (const k of ['CLAUDECODE', 'CLAUDE_CODE_X', 'CLAUDE_AGENT_SDK_Y', 'CLAUDE_PID', 'CLAUDE_EFFORT', 'CLAUDE_PREVIEW_Z', 'ELECTRON_RUN_AS_NODE']) assert.ok(!(k in env), k);
  assert.deepEqual([env.CLAUDECODEX, env.CLAUDE_PIDX, env.ELECTRON_RUN_AS_NODEX, env.KALSIN], ['kalır', 'kalır', 'kalır', 'evet']);
  assert.equal(env.PATH, ['/l1', '/dup', '/p2', '/opt/homebrew/bin', path.join(HOME, '.local/bin'), '/usr/local/bin'].join(':'));
  assert.equal(process.env.CLAUDECODE, '1', 'process.env değişmez');
});

test('loginEnv (Windows): giriş kabuğu çalışmaz, "Path" anahtarı PATH\'e taşınır, APPDATA/LOCALAPPDATA eklenir', async () => {
  _test.reset();
  deps.platform = 'win32';
  deps.execFile = () => { throw new Error('Windows\'ta kabuk çağrılmamalı'); };
  delete process.env.PATH;
  Object.assign(process.env, { Path: 'C:\\w1;C:\\w2', APPDATA: 'C:\\AD', LOCALAPPDATA: 'C:\\LAD' });
  const env = await loginEnv();
  assert.ok(!('Path' in env));
  assert.equal(env.PATH, ['C:\\w1', 'C:\\w2', path.join(HOME, '.local', 'bin'), path.join('C:\\AD', 'npm'), path.join('C:\\LAD', 'Programs', 'claude')].join(';'));
});

test('loginEnv (Windows): APPDATA/LOCALAPPDATA ve PATH yoksa yalnızca ~/.local/bin kalır', async () => {
  winMode();
  delete process.env.PATH;
  process.env.undefined = 'C:\\tuzak'; // PATH anahtarı yokken yanlış anahtardan okunmadığını gösterir
  const env = await loginEnv();
  assert.equal(env.PATH, path.join(HOME, '.local', 'bin'));
  assert.equal(env.undefined, 'C:\\tuzak');
});

// ================= claudeBin =================
test('claudeBin: ortam değişkeni verilmişse aranmadan o döner', async () => {
  process.env.CLAUDE_PANEL_CLAUDE_BIN = '/olmayan/yer/claude';
  assert.equal(await claudeBin(), '/olmayan/yer/claude');
});

test('claudeBin: PATH\'teki ilk çalıştırılabilir dosya bulunur; klasör ve izinsiz dosya atlanır', async () => {
  delete process.env.CLAUDE_PANEL_CLAUDE_BIN;
  const a = tmp(), b = tmp(), c = tmp(), d = tmp();
  const name = WIN ? 'claude.exe' : 'claude';
  fs.mkdirSync(path.join(a, name));
  // izinsiz dosya yalnız POSIX'te anlamlı (Windows'ta X_OK yalnızca varlığı denetler)
  if (!WIN) { fs.writeFileSync(path.join(b, 'claude'), ''); fs.chmodSync(path.join(b, 'claude'), 0o644); }
  exe(path.join(c, name)); exe(path.join(d, name));
  if (WIN) winMode([a, b, c, d]); else _test.reset([a, b, c, d].join(':'));
  assert.equal(await claudeBin(), path.join(c, name));
});

test('claudeBin (Windows): claude.exe claude.cmd\'den önce gelir; ikisi de yoksa null', async () => {
  delete process.env.CLAUDE_PANEL_CLAUDE_BIN;
  const d1 = tmp(), d2 = tmp();
  exe(path.join(d1, 'claude.cmd')); exe(path.join(d2, 'claude.exe'));
  winMode([d1, d2]);
  assert.equal(await claudeBin(), path.join(d2, 'claude.exe'));
  fs.rmSync(path.join(d2, 'claude.exe'));
  assert.equal(await claudeBin(), path.join(d1, 'claude.cmd'));
  fs.rmSync(path.join(d1, 'claude.cmd'));
  assert.equal(await claudeBin(), null);
});

// ================= launchSpec (Windows cmd-shim) =================
const NPM_SHIM = '@ECHO off\r\nGOTO start\r\n:find_dp0\r\nSET dp0=%~dp0\r\nEXIT /b\r\n:start\r\nSETLOCAL\r\nCALL :find_dp0\r\n\r\nIF EXIST "%dp0%\\node.exe" (\r\n  SET "_prog=%dp0%\\node.exe"\r\n) ELSE (\r\n  SET "_prog=node"\r\n  SET PATHEXT=%PATHEXT:;.JS;=;%\r\n)\r\n\r\nendLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\node_modules\\@anthropic-ai\\claude-code\\cli.js" %*\r\n';
const CLI_REL = 'node_modules\\@anthropic-ai\\claude-code\\cli.js'; // Mac'te tek dosya adı olarak oluşturulur

test('launchSpec: Windows dışında ya da .cmd/.bat olmayan dosya doğrudan başlatılır', () => {
  deps.platform = 'darwin';
  assert.deepEqual(launchSpec('/x/claude.cmd', {}), { file: '/x/claude.cmd', pre: [], shell: false });
  deps.platform = 'win32';
  assert.deepEqual(launchSpec('C:\\x\\claude.exe', {}), { file: 'C:\\x\\claude.exe', pre: [], shell: false });
  assert.deepEqual(launchSpec('/olmayan/claude.BAT', {}), { file: '/olmayan/claude.BAT', pre: [], shell: true }, 'okunamayan betik: kabuk');
});

test('launchSpec: npm cmd-shim çözülür — yerel node.exe + cli.js, sonuç önbelleğe alınır', () => {
  deps.platform = 'win32';
  const dir = tmp(), other = tmp();
  const bin = path.join(dir, 'claude.cmd');
  fs.writeFileSync(bin, NPM_SHIM);
  fs.writeFileSync(path.join(dir, 'node.exe'), ''); writeCli(dir);
  fs.writeFileSync(path.join(other, 'node.exe'), '');
  const spec = launchSpec(bin, { PATH: other });
  assert.deepEqual(spec, { file: path.join(dir, 'node.exe'), pre: [path.join(dir, CLI_REL)], shell: false });
  fs.rmSync(bin);
  assert.strictEqual(launchSpec(bin, { PATH: other }), spec, 'ikinci çağrıda dosya okunmaz');
});

test('launchSpec: yerel node.exe yoksa PATH\'teki ilk node.exe kullanılır', () => {
  deps.platform = 'win32';
  const dir = tmp(), n0 = tmp(), n1 = tmp(), n2 = tmp();
  const bin = path.join(dir, 'claude.cmd');
  fs.writeFileSync(bin, NPM_SHIM); writeCli(dir);
  fs.writeFileSync(path.join(n1, 'node.exe'), ''); fs.writeFileSync(path.join(n2, 'node.exe'), '');
  assert.deepEqual(launchSpec(bin, { PATH: [n0, n1, n2].join(';') }), { file: path.join(n1, 'node.exe'), pre: [path.join(dir, CLI_REL)], shell: false });
});

test('launchSpec: node.exe hiç bulunamazsa (PATH yoksa da) kabuğa düşülür', () => {
  deps.platform = 'win32';
  const dir = tmp();
  const bin = path.join(dir, 'claude.cmd');
  fs.writeFileSync(bin, NPM_SHIM); writeCli(dir);
  assert.deepEqual(launchSpec(bin, {}), { file: bin, pre: [], shell: true });
});

test('launchSpec: betik bir .exe çağırıyorsa o .exe doğrudan başlatılır', () => {
  deps.platform = 'win32';
  const dir = tmp();
  const bin = path.join(dir, 'claude.cmd');
  fs.writeFileSync(bin, '@echo off\r\n"%~dp0\\node.exe" x\r\n"%~dp0\\claude.EXE" %*\r\n');
  fs.writeFileSync(path.join(dir, 'node.exe'), ''); fs.writeFileSync(path.join(dir, 'claude.EXE'), '');
  assert.deepEqual(launchSpec(bin, { PATH: dir }), { file: path.join(dir, 'claude.EXE'), pre: [], shell: false });
});

test('launchSpec: hedef dosya yoksa ya da yalnızca node.exe geçiyorsa kabuğa düşülür', () => {
  deps.platform = 'win32';
  const dir = tmp();
  const missing = path.join(dir, 'a.cmd'), onlyNode = path.join(dir, 'b.cmd');
  fs.writeFileSync(missing, NPM_SHIM); // cli.js yok
  fs.writeFileSync(onlyNode, '"%dp0%\\node.exe" %*');
  fs.writeFileSync(path.join(dir, 'node.exe'), '');
  assert.deepEqual(launchSpec(missing, { PATH: dir }), { file: missing, pre: [], shell: true });
  assert.deepEqual(launchSpec(onlyNode, { PATH: dir }), { file: onlyNode, pre: [], shell: true });
});

// ================= start: başlatma biçimi =================
test('start (Windows kabuk yolu): yol ve argümanlar tırnaklanır, shell:true ve windowsHide verilir', async () => {
  const dir = tmp('qr dir ');
  const bin = path.join(dir, 'claude.cmd'); fs.writeFileSync(bin, '@echo off\r\nclaude-gercek %*\r\n');
  winMode(['C:\\w']); process.env.CLAUDE_PANEL_CLAUDE_BIN = bin;
  const { calls } = fakeSpawn(); const { runner } = collect();
  const cwd = tmp();
  await runner.start({ newSession: true, sessionId: ID, cwd, model: 'claude-opus-4-5[1m]', permissionMode: 'plan', text: 'x' });
  assert.equal(calls.length, 1);
  const c = calls[0];
  assert.equal(c.file, '"' + bin + '"');
  assert.deepEqual(c.args, ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--session-id', ID, '--model', '"claude-opus-4-5[1m]"', '--permission-mode', 'plan', '--permission-prompt-tool', 'stdio']);
  assert.equal(c.o.shell, true); assert.equal(c.o.windowsHide, true); assert.equal(c.o.cwd, cwd);
  assert.deepEqual(c.o.stdio, ['pipe', 'pipe', 'pipe']);
  assert.equal(c.o.env.PATH, 'C:\\w;' + path.join(HOME, '.local', 'bin'), 'Windows ayıracı');
});

test('start (Windows kabuk yolu): güvenli olmayan claude yolu reddedilir, süreç başlamaz', async () => {
  winMode(); process.env.CLAUDE_PANEL_CLAUDE_BIN = '/olmayan/100%/claude.cmd';
  const { calls } = fakeSpawn(); const { runner, evs } = collect();
  await assert.rejects(runner.start({ newSession: true, cwd: tmp(), text: 'x' }), /^Error: Güvenli olmayan argüman reddedildi$/);
  assert.equal(calls.length, 0); assert.equal(evs.length, 0); assert.deepEqual(runner.active(), []);
});

test('start (Windows cmd-shim): node.exe + cli.js kabuksuz başlatılır', async () => {
  const dir = tmp();
  const bin = path.join(dir, 'claude.cmd');
  fs.writeFileSync(bin, NPM_SHIM); fs.writeFileSync(path.join(dir, 'node.exe'), ''); writeCli(dir);
  winMode(); process.env.CLAUDE_PANEL_CLAUDE_BIN = bin;
  const { calls } = fakeSpawn(); const { runner } = collect();
  await runner.start({ sessionId: ID, cwd: tmp(), text: 'x' });
  assert.equal(calls[0].file, path.join(dir, 'node.exe'));
  assert.deepEqual(calls[0].args.slice(0, 2), [path.join(dir, CLI_REL), '-p']);
  assert.equal(calls[0].o.shell, undefined); assert.equal(calls[0].o.windowsHide, true);
});

test('start: düşünme seviyesi --effort olarak izin modundan sonra eklenir; liste dışı değer süreç başlatmadan reddedilir', async () => {
  const { calls } = fakeSpawn(); const { runner } = collect();
  const cwd = tmp();
  for (const e of ['low', 'medium', 'high', 'xhigh', 'max']) {
    await runner.start({ sessionId: ID, permissionMode: 'plan', effort: e, ephemeral: true, cwd, text: 't' });
    const a = calls[calls.length - 1].args;
    assert.deepEqual(a.slice(a.indexOf('--permission-mode'), a.indexOf('--permission-prompt-tool')), ['--permission-mode', 'plan', '--effort', e]);
  }
  await runner.start({ sessionId: ID, effort: null, ephemeral: true, cwd, text: 't' });
  assert.ok(!calls[calls.length - 1].args.includes('--effort'));
  const n = calls.length;
  for (const bad of ['ultra', 'high --model x', 'LOW', ['high']])
    await assert.rejects(runner.start({ sessionId: ID, effort: bad, cwd, text: 't' }), /^Error: Geçersiz düşünme seviyesi: /);
  await assert.rejects(runner.start({ sessionId: ID, effort: 'x'.repeat(50), cwd, text: 't' }), { message: 'Geçersiz düşünme seviyesi: ' + 'x'.repeat(20) });
  assert.equal(calls.length, n, 'reddedilen istekte süreç başlamadı');
});

test('bilgisayar kontrolü: açıkken --chrome ve agent-desktop MCP yapılandırması eklenir; kapalıyken hiçbiri', async () => {
  const { calls } = fakeSpawn(); const { runner } = collect();
  const cwd = tmp(), home = tmp();
  process.env.CLAUDE_PANEL_HOME = home;
  process.env.CLAUDE_PANEL_DESKTOP_BIN = '/opt/ad/agent-desktop';
  await runner.start({ sessionId: ID, effort: 'low', control: true, ephemeral: true, cwd, text: 't' });
  const a = calls[0].args, f = path.join(home, 'bilgisayar-kontrolu.mcp.json');
  assert.deepEqual(a.slice(a.indexOf('--effort'), a.indexOf('--permission-prompt-tool')), ['--effort', 'low', '--chrome', '--mcp-config', f]);
  assert.deepEqual(JSON.parse(fs.readFileSync(f, 'utf8')), { mcpServers: { 'agent-desktop': { command: '/opt/ad/agent-desktop', args: ['mcp'] } } });
  const mt = fs.statSync(f).mtimeMs;
  await new Promise(r => setTimeout(r, 20));
  await runner.start({ sessionId: ID, control: true, ephemeral: true, cwd, text: 't' });
  assert.strictEqual(fs.statSync(f).mtimeMs, mt, 'aynı içerik yeniden yazılmaz');
  await runner.start({ sessionId: ID, control: false, ephemeral: true, cwd, text: 't' });
  assert.ok(!calls[2].args.includes('--chrome') && !calls[2].args.includes('--mcp-config'));
  process.env.CLAUDE_PANEL_DESKTOP_BIN = '';                 // masaüstü aracı yok: yalnızca tarayıcı
  await runner.start({ sessionId: ID, control: true, ephemeral: true, cwd, text: 't' });
  assert.ok(calls[3].args.includes('--chrome')); assert.ok(!calls[3].args.includes('--mcp-config'));
  assert.deepEqual(await controlStatus(), { desktop: null, platform: process.platform, access: null });
});

test('bilgisayar kontrolü (macOS): agent-desktop PATH\'te aranır, erişilebilirlik izni okunur', { skip: POSIX_ONLY }, async () => {
  delete process.env.CLAUDE_PANEL_DESKTOP_BIN;
  const d = tmp();
  exe(path.join(d, 'agent-desktop'));
  process.env.PATH = d; _test.reset(d);
  deps.platform = 'darwin';
  const seen = [];
  deps.execFile = (f, a, o, cb) => { seen.push([f, a, o.timeout]); cb(null, JSON.stringify({ ok: true, data: { permissions: { accessibility: { state: 'denied' } } } })); };
  assert.deepEqual(await controlStatus(), { desktop: path.join(d, 'agent-desktop'), platform: 'darwin', access: 'denied' });
  assert.deepEqual(seen, [[path.join(d, 'agent-desktop'), ['status'], 8000]]);
  deps.execFile = (f, a, o, cb) => cb(new Error('çöktü'), 'bozuk');
  assert.strictEqual((await controlStatus()).access, null, 'okunamayan durum: bilinmiyor');
  deps.execFile = (f, a, o, cb) => cb(null, '{"data":{"permissions":{"accessibility":{}}}}');
  assert.strictEqual((await controlStatus()).access, null);
});

test('bilgisayar kontrolü (Windows): agent-desktop .cmd ise cmd /c ile, .exe doğrudan başlatılır; izin denetimi yok', async () => {
  delete process.env.CLAUDE_PANEL_DESKTOP_BIN;
  const w = tmp(); exe(path.join(w, 'agent-desktop.cmd'));
  winMode([w]); _test.reset('');
  deps.execFile = () => assert.fail('Windows\'ta izin denetimi yok');
  const st = await controlStatus();
  assert.deepEqual(st, { desktop: path.join(w, 'agent-desktop.cmd'), platform: 'win32', access: null });
  assert.deepEqual(desktopMcp(st.desktop), { mcpServers: { 'agent-desktop': { command: 'cmd', args: ['/c', st.desktop, 'mcp'] } } });
  assert.deepEqual(desktopMcp('C:\\a\\agent-desktop.EXE'), { mcpServers: { 'agent-desktop': { command: 'C:\\a\\agent-desktop.EXE', args: ['mcp'] } } });
  deps.platform = 'darwin';
  assert.deepEqual(desktopMcp('/x/agent-desktop.cmd'), { mcpServers: { 'agent-desktop': { command: '/x/agent-desktop.cmd', args: ['mcp'] } } });
  winMode([tmp()]); _test.reset('');
  assert.strictEqual((await controlStatus()).desktop, null);
});

test('agent-desktop kurulumu (macOS): npm sabit argümanlarla kabuksuz çalışır; sonra durum döner', { skip: POSIX_ONLY }, async () => {
  const d = tmp(); const npm = exe(path.join(d, 'npm'));
  process.env.PATH = d; _test.reset(d); deps.platform = 'darwin';
  process.env.CLAUDE_PANEL_DESKTOP_BIN = '/kuruldu/agent-desktop';
  const calls = [];
  deps.execFile = (f, a, o, cb) => { calls.push({ f, a, o }); cb(null, a[0] === 'status' ? '{"data":{"permissions":{"accessibility":{"state":"granted"}}}}' : ''); };
  assert.deepEqual(await installDesktop(), { desktop: '/kuruldu/agent-desktop', platform: 'darwin', access: 'granted' });
  assert.equal(calls[0].f, npm); assert.deepEqual(calls[0].a, ['install', '-g', 'agent-desktop']);
  assert.equal(calls[0].o.timeout, 300000); assert.equal(calls[0].o.shell, undefined);
});

test('agent-desktop kurulumu (Windows): npm.cmd tırnaklı yol + kabukla çalışır; hata ve npm yok durumları', async () => {
  process.env.CLAUDE_PANEL_DESKTOP_BIN = '/kuruldu/agent-desktop';
  const calls = [];
  deps.execFile = (f, a, o, cb) => { calls.push({ f, a, o }); cb(null, ''); };
  // Windows: npm Program Files\nodejs içinde (boşluklu yol)
  const pf = path.join(tmp(), 'Program Files'); fs.mkdirSync(path.join(pf, 'nodejs'), { recursive: true });
  const wnpm = exe(path.join(pf, 'nodejs', 'npm.cmd'));
  winMode([tmp()]); _test.reset(''); process.env.ProgramFiles = pf;
  calls.length = 0;
  await installDesktop();
  assert.equal(calls[0].f, '"' + wnpm + '"');               // boşluklu yol tırnaklanır
  assert.deepEqual(calls[0].a, ['install', '-g', 'agent-desktop']);
  assert.equal(calls[0].o.shell, true); assert.equal(calls[0].o.windowsHide, true); assert.equal(calls[0].o.timeout, 300000);
  // hata: npm çıktısının sonu iletilir
  deps.execFile = (f, a, o, cb) => cb(new Error('EACCES'), '', 'x'.repeat(500) + ' izin yok');
  await assert.rejects(installDesktop(), e => e.message.startsWith('agent-desktop kurulamadı: ') && e.message.endsWith(' izin yok') && e.message.length === 'agent-desktop kurulamadı: '.length + 400);
  deps.execFile = (f, a, o, cb) => cb(new Error('zaman aşımı'));
  await assert.rejects(installDesktop(), { message: 'agent-desktop kurulamadı: zaman aşımı' });
  // npm yok
  winMode([tmp()]); _test.reset(''); delete process.env.ProgramFiles;
  await assert.rejects(installDesktop(), { message: 'npm bulunamadı — önce Node.js kurulmalı (nodejs.org, LTS)' });
});

test('start: argümanlar doğru sırayla kurulur (sürdürme, çatal, model, izin modu, geçici)', async () => {
  const { calls } = fakeSpawn(); const { runner, evs } = collect();
  const cwd = tmp();
  const r = await runner.start({ runId: 'R1', sessionId: ID, fork: true, model: 'sonnet', permissionMode: 'acceptEdits', ephemeral: true, cwd, text: 't' });
  assert.deepEqual(r, { runId: 'R1', sessionId: ID });
  assert.equal(calls[0].file, FAKE);
  assert.deepEqual(calls[0].args, ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--resume', ID, '--fork-session', '--model', 'sonnet', '--permission-mode', 'acceptEdits', '--permission-prompt-tool', 'stdio', '--no-session-persistence']);
  assert.equal(calls[0].o.shell, undefined); assert.equal(calls[0].o.windowsHide, true); assert.equal(calls[0].o.cwd, cwd);
  assert.deepEqual(evs[0], { runId: 'R1', type: 'started', sessionId: ID, fork: true, newSession: false });
});

test('start: yeni sohbette kimlik verilmezse üretilir, verilirse o kullanılır; runId yoksa üretilir', async () => {
  const { calls } = fakeSpawn(); const { runner, evs } = collect();
  const a = await runner.start({ newSession: true, fork: true, cwd: tmp(), text: 'x' });
  assert.match(a.sessionId, UUIDRX); assert.match(a.runId, UUIDRX);
  assert.deepEqual(calls[0].args.slice(7), ['--session-id', a.sessionId, '--permission-prompt-tool', 'stdio'], 'yeni sohbette --fork-session yok');
  assert.deepEqual(evs[0], { runId: a.runId, type: 'started', sessionId: a.sessionId, fork: true, newSession: true });
  const b = await runner.start({ newSession: true, sessionId: ID, cwd: tmp(), text: 'x' });
  assert.equal(b.sessionId, ID); assert.deepEqual(calls[1].args.slice(7, 9), ['--session-id', ID]);
  assert.deepEqual(evs[1], { runId: b.runId, type: 'started', sessionId: ID, fork: false, newSession: true });
  assert.notEqual(a.runId, b.runId);
});

test('start: kullanıcı mesajı metin, görsel ve ekli dosya yollarıyla stdin\'e yazılır', async () => {
  const { procs } = fakeSpawn(); const { runner } = collect();
  const img = { media_type: 'image/png', data: 'AAA=' };
  await runner.start({ sessionId: ID, cwd: tmp(), text: 'bak', images: [img], files: ['~/x.txt', '/abs/y'] });
  assert.equal(procs[0].raw.length, 1); assert.ok(procs[0].raw[0].endsWith('}\n'));
  assert.deepEqual(procs[0].written[0], { type: 'user', message: { role: 'user', content: [
    { type: 'text', text: 'bak\n\nEkli dosyalar:\n- ' + path.join(HOME, 'x.txt') + '\n- /abs/y' },
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAA=' } }] } });
  assert.equal(procs[0].stdout.enc, 'utf8'); assert.equal(procs[0].stderr.enc, 'utf8');
  await runner.start({ sessionId: ID, cwd: tmp(), files: ['/abs/y'] });
  assert.deepEqual(procs[1].written[0].message.content, [{ type: 'text', text: 'Ekli dosyalar:\n- /abs/y' }]);
  await runner.start({ sessionId: ID, cwd: tmp(), text: 'yalnız' });
  assert.deepEqual(procs[2].written[0].message.content, [{ type: 'text', text: 'yalnız' }]);
  await runner.start({ sessionId: ID, cwd: tmp() });
  assert.deepEqual(procs[3].written[0].message.content, []);
  procs[3].stdin.emit('error', new Error('EPIPE')); // dinleyici var: çökmez
});

test('start: çalışma klasörü "~" ile verilebilir; "~ad" ev klasörüne dönüşmez', async () => {
  const { calls } = fakeSpawn(); const { runner } = collect();
  await runner.start({ sessionId: ID, cwd: '~', text: 'x' });
  assert.equal(calls[0].o.cwd, HOME);
  await assert.rejects(runner.start({ sessionId: ID, cwd: '~olmayan-klasor-xyz', text: 'x' }), /^Error: Çalışma klasörü bulunamadı: ~olmayan-klasor-xyz$/);
});

test('start: geçersiz girdiler açık hatayla reddedilir ve süreç başlamaz', async () => {
  const { calls } = fakeSpawn(); const { runner } = collect();
  const cwd = tmp();
  await assert.rejects(runner.start({ sessionId: ID, text: 'x' }), /^Error: Çalışma klasörü bulunamadı: undefined$/);
  const f = path.join(cwd, 'dosya'); fs.writeFileSync(f, '');
  await assert.rejects(runner.start({ sessionId: ID, cwd: f }), new RegExp('^Error: Çalışma klasörü bulunamadı: '));
  const nl = path.join(cwd, 'satır\nsonu');
  // Windows'ta adında satır sonu olan klasör oluşturulamaz: yol yine reddedilir (bulunamadı)
  if (WIN) await assert.rejects(runner.start({ sessionId: ID, cwd: nl }), /^Error: Çalışma klasörü bulunamadı: /);
  else { fs.mkdirSync(nl); await assert.rejects(runner.start({ sessionId: ID, cwd: nl }), /^Error: Çalışma klasörü geçersiz$/); }
  await assert.rejects(runner.start({ sessionId: ID, cwd: cwd + '\0' }), /^Error: Çalışma klasörü bulunamadı: /);
  await assert.rejects(openRemoteTerminal(fakeShell(), { cwd }), /^Error: Geçersiz oturum kimliği$/);
  await assert.rejects(runner.start({ sessionId: 'abc', cwd }), /^Error: Geçersiz oturum kimliği$/);
  await assert.rejects(runner.start({ cwd }), /^Error: Oturum kimliği yok$/);
  await assert.rejects(runner.start({ sessionId: ID, cwd, model: 'opus;x' }), /^Error: Geçersiz model: opus;x$/);
  await assert.rejects(runner.start({ sessionId: ID, cwd, permissionMode: 'hepsi' }), /^Error: Geçersiz izin modu: hepsi$/);
  assert.equal(calls.length, 0);
  for (const model of ['opus', 'HAIKU', 'default', 'claude-sonnet-4.5', 'claude-opus-4-6[1m]']) await runner.start({ sessionId: ID, cwd, model });
  for (const pm of ['default', 'acceptEdits', 'bypassPermissions', 'plan', 'auto', 'dontAsk', 'manual']) await runner.start({ sessionId: ID, cwd, permissionMode: pm });
  assert.equal(calls.length, 12);
});

test('start: bozuk ek ya da metin süreç başlatmadan reddedilir (asılı claude süreci kalmaz)', async () => {
  const { calls } = fakeSpawn(); const { runner, evs } = collect();
  const cwd = tmp();
  const bad = [
    [{ images: [null] }, /^Error: Geçersiz görsel eki$/],
    [{ images: ['AAA='] }, /^Error: Geçersiz görsel eki$/],
    [{ images: { media_type: 'image/png', data: 'AAA=' } }, /^Error: Geçersiz görsel eki$/],
    [{ images: [{ media_type: 'image/bmp', data: 'AAA=' }] }, /^Error: Desteklenmeyen görsel türü: image\/bmp \(png, jpeg, gif veya webp olmalı\)$/],
    [{ images: [{ data: 'AAA=' }] }, /^Error: Desteklenmeyen görsel türü: undefined/],
    [{ images: [{ media_type: 'image/svg+xml'.repeat(10), data: 'AAA=' }] }, /^Error: Desteklenmeyen görsel türü: (image\/svg\+xml){3}i \(/],
    [{ images: [{ media_type: 'image/png' }] }, /^Error: Görsel verisi bozuk$/],
    [{ images: [{ media_type: 'image/png', data: '' }] }, /^Error: Görsel verisi bozuk$/],
    [{ images: [{ media_type: 'image/png', data: 'AA A=' }] }, /^Error: Görsel verisi bozuk$/],
    [{ images: [{ media_type: 'image/png', data: 'AAA===' }] }, /^Error: Görsel verisi bozuk$/],
    [{ images: [{ media_type: 'image/png', data: 'x\nAAA=' }] }, /^Error: Görsel verisi bozuk$/],
    [{ images: [{ media_type: 'image/png', data: 12n }] }, /^Error: Görsel verisi bozuk$/],
    [{ images: [{ media_type: 'image/png', data: 'AAA=' }, 5] }, /^Error: Geçersiz görsel eki$/],
    [{ files: '/a' }, /^Error: Geçersiz dosya eki$/],
    [{ files: [null] }, /^Error: Geçersiz dosya eki$/],
    [{ files: [''] }, /^Error: Geçersiz dosya eki$/],
    [{ files: ['/a', 3] }, /^Error: Geçersiz dosya eki$/],
    [{ text: 5 }, /^Error: Geçersiz mesaj metni$/],
    [{ text: { a: 1 } }, /^Error: Geçersiz mesaj metni$/],
    // yalnızca null/undefined "boş" sayılır; 0, false, '' gibi yanlış türler sessizce boşa çevrilmez
    [{ text: 0 }, /^Error: Geçersiz mesaj metni$/],
    [{ files: '' }, /^Error: Geçersiz dosya eki$/],
    [{ images: false }, /^Error: Geçersiz görsel eki$/],
  ];
  for (const [o, rx] of bad) await assert.rejects(runner.start({ sessionId: ID, cwd, ...o }), rx, JSON.stringify(o, (k, v) => typeof v === 'bigint' ? 'big' : v));
  assert.equal(calls.length, 0, 'hiç süreç başlamadı');
  assert.deepEqual(runner.active(), []);
  assert.deepEqual(evs, []);
  // null ekler boş sayılır; tüm desteklenen türler ve base64 dolgu biçimleri geçer
  await runner.start({ sessionId: ID, cwd, text: null, files: null, images: null });
  for (const mt of ['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
    for (const data of ['AAAA', 'AAA=', 'AA==', 'a+/9']) await runner.start({ sessionId: ID, cwd, images: [{ media_type: mt, data }] });
  assert.equal(calls.length, 17);
});

test('start: claude bulunamazsa platforma göre yol örneği veren hata', async () => {
  noClaudeWin();
  const { runner } = collect();
  await assert.rejects(runner.start({ sessionId: ID, cwd: tmp() }), { message: 'claude komutu bulunamadı. Claude Code CLI kurulu olmalı (ör. ~/.local/bin/claude.exe).' });
  deps.platform = 'darwin';
  const acc = fs.accessSync; fs.accessSync = () => { throw new Error('EACCES'); };
  try { await assert.rejects(runner.start({ sessionId: ID, cwd: tmp() }), { message: 'claude komutu bulunamadı. Claude Code CLI kurulu olmalı (ör. ~/.local/bin/claude).' }); }
  finally { fs.accessSync = acc; }
});

// ================= çıktı akışı =================
async function started(opts = {}) {
  const { procs } = fakeSpawn(); const { runner, evs } = collect();
  const r = await runner.start({ runId: 'R', sessionId: ID, cwd: os.tmpdir(), text: 'x', ...opts });
  evs.length = 0;
  return { runner, evs, proc: procs[0], r, procs };
}

test('çıktı: parçalı satırlar birleşir, boş/bozuk/nesne olmayan satırlar atlanır, oturum kimliği güncellenir', async () => {
  const { evs, proc } = await started();
  proc.stdout.emit('data', '\n{"type":"sys');
  assert.equal(evs.length, 0);
  proc.stdout.emit('data', 'tem","session_id":"' + ID + '"}\n   \nbozuk json\nnull\n"metin"\n7\n{"type":"assistant","session_id":"S2"}\n{"type":"x"}\n');
  assert.deepEqual(evs, [
    { runId: 'R', type: 'event', sessionId: ID, ev: { type: 'system', session_id: ID } },
    { runId: 'R', type: 'event', sessionId: 'S2', ev: { type: 'assistant', session_id: 'S2' } },
    { runId: 'R', type: 'event', sessionId: 'S2', ev: { type: 'x' } }]);
});

test('çıktı: izin isteği iletilir, iptal edilince beklemeden düşer; kontrol yanıtı yutulur', async () => {
  const { runner, evs, proc } = await started();
  const req = { subtype: 'can_use_tool', tool_name: 'Bash', input: { command: 'ls' } };
  proc.line({ type: 'control_request', request_id: 'r1', request: req });
  assert.deepEqual(evs, [{ runId: 'R', type: 'permission', sessionId: ID, requestId: 'r1', request: req }]);
  proc.line({ type: 'control_cancel_request', request_id: 'r1' });
  assert.deepEqual(evs[1], { runId: 'R', type: 'permission-cancel', requestId: 'r1' });
  assert.equal(runner.respond('R', 'r1', { behavior: 'allow' }), false);
  proc.line({ type: 'control_response', response: { subtype: 'success', request_id: 'z' } });
  assert.equal(evs.length, 2);
  assert.equal(proc.written.length, 1, 'yalnızca ilk kullanıcı mesajı');
});

test('çıktı: desteklenmeyen kontrol isteğine hata yanıtı döner (request alanı olmasa da)', async () => {
  const { evs, proc } = await started();
  proc.line({ type: 'control_request', request_id: 'h1', request: { subtype: 'hook_callback' } });
  proc.line({ type: 'control_request', request_id: 'h2' });
  assert.equal(evs.length, 0);
  assert.deepEqual(proc.written.slice(1), [
    { type: 'control_response', response: { subtype: 'error', request_id: 'h1', error: 'Claude Panel bu isteği desteklemiyor: hook_callback' } },
    { type: 'control_response', response: { subtype: 'error', request_id: 'h2', error: 'Claude Panel bu isteği desteklemiyor: undefined' } }]);
});

test('çıktı: result gelince giriş bir kez kapanır, sonra stdin\'e yazılmaz', async () => {
  const { runner, evs, proc } = await started();
  proc.line({ type: 'control_request', request_id: 'p1', request: { subtype: 'can_use_tool' } });
  proc.line({ type: 'result', subtype: 'success' });
  assert.equal(proc.endCount, 1);
  assert.deepEqual(evs.at(-1), { runId: 'R', type: 'event', sessionId: ID, ev: { type: 'result', subtype: 'success' } });
  proc.line({ type: 'result' });
  assert.equal(proc.endCount, 1);
  assert.equal(runner.respond('R', 'p1', { behavior: 'allow' }), true);
  assert.equal(proc.written.length, 1, 'kapalı girişe yazılmadı');
});

test('respond: bilinmeyen çalıştırma/istek false; geçerli yanıt bir kez iletilir', async () => {
  const { runner, proc } = await started();
  proc.line({ type: 'control_request', request_id: 'r1', request: { subtype: 'can_use_tool' } });
  assert.equal(runner.respond('yok', 'r1', {}), false);
  assert.equal(runner.respond('R', 'r2', {}), false);
  assert.equal(runner.respond('R', 'r1', { behavior: 'allow', updatedInput: { a: 1 } }), true);
  assert.deepEqual(proc.written.at(-1), { type: 'control_response', response: { subtype: 'success', request_id: 'r1', response: { behavior: 'allow', updatedInput: { a: 1 } } } });
  assert.ok(proc.raw.at(-1).endsWith('}\n'));
  assert.equal(runner.respond('R', 'r1', {}), false);
  assert.equal(proc.written.length, 2);
});

test('write: JSON\'a çevrilemeyen yanıt (BigInt) ve stdin.end hatası süreci çökertmez', async () => {
  const { runner, proc } = await started();
  proc.line({ type: 'control_request', request_id: 'r1', request: { subtype: 'can_use_tool' } });
  assert.equal(runner.respond('R', 'r1', { n: 1n }), true);
  assert.equal(proc.written.length, 1);
  proc.stdin.end = () => { proc.endCount++; throw new Error('kapalı'); };
  proc.line({ type: 'result' });
  proc.line({ type: 'control_request', request_id: 'h', request: { subtype: 'x' } });
  assert.equal(proc.endCount, 1); assert.equal(proc.written.length, 1);
});

test('stderr: son 4000 karakter tutulur ve yalnızca sıfırdan farklı çıkış kodunda iletilir', async () => {
  const { evs, proc, runner } = await started();
  proc.stderr.emit('data', 'a'.repeat(3000)); proc.stderr.emit('data', 'b'.repeat(3000));
  assert.deepEqual(runner.active().map(r => r.runId), ['R']);
  proc.emit('close', 1, null);
  assert.deepEqual(evs, [{ runId: 'R', type: 'exit', sessionId: ID, stopped: false, code: 1, signal: null, stderr: 'a'.repeat(1000) + 'b'.repeat(3000) }]);
  assert.deepEqual(runner.active(), []);
  const s2 = await started();
  s2.proc.stderr.emit('data', 'uyarı');
  s2.proc.emit('close', 0, null);
  assert.deepEqual(s2.evs, [{ runId: 'R', type: 'exit', sessionId: ID, stopped: false, code: 0, signal: null, stderr: '' }]);
});

test('süreç hatası exit olayına dönüşür; ardından gelen close ikinci exit üretmez', async () => {
  const { evs, proc, runner } = await started();
  proc.stderr.emit('data', 'x');
  proc.emit('error', new Error('spawn ENOENT'));
  proc.emit('close', null, null);
  assert.deepEqual(evs, [{ runId: 'R', type: 'exit', sessionId: ID, stopped: false, error: 'spawn ENOENT', stderr: '' }]);
  assert.equal(runner.stop('R'), false, 'bitmiş çalıştırma durdurulamaz');
});

// ================= durdurma =================
test('stop: bekleyen izinler reddedilir, kesme isteği gider; zamanlayıcılar SIGINT → SIGTERM → SIGKILL gönderir', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  deps.platform = 'darwin'; // proc.kill yolu; Windows'ta taskkill gerçek bir pid'e gitmesin
  const { runner, evs, proc } = await started();
  assert.equal(runner.stop('yok'), false);
  for (const id of ['r1', 'r2']) proc.line({ type: 'control_request', request_id: id, request: { subtype: 'can_use_tool' } });
  evs.length = 0;
  assert.equal(runner.stop('R'), true);
  const deny = id => ({ type: 'control_response', response: { subtype: 'success', request_id: id, response: { behavior: 'deny', message: 'Kullanıcı durdurdu', interrupt: true } } });
  assert.deepEqual(proc.written.slice(1, 3), [deny('r1'), deny('r2')]);
  const intr = proc.written[3];
  assert.equal(intr.type, 'control_request'); assert.match(intr.request_id, UUIDRX); assert.deepEqual(intr.request, { subtype: 'interrupt' });
  assert.equal(proc.written.length, 4);
  assert.equal(runner.respond('R', 'r1', {}), false, 'bekleyenler temizlendi');
  t.mock.timers.tick(2499); assert.deepEqual(proc.kills, []); assert.equal(proc.endCount, 0);
  t.mock.timers.tick(1); assert.deepEqual(proc.kills, ['SIGINT']); assert.equal(proc.endCount, 1);
  t.mock.timers.tick(2999); assert.deepEqual(proc.kills, ['SIGINT']);
  t.mock.timers.tick(1); assert.deepEqual(proc.kills, ['SIGINT', 'SIGTERM']);
  t.mock.timers.tick(3499); assert.deepEqual(proc.kills, ['SIGINT', 'SIGTERM']);
  t.mock.timers.tick(1); assert.deepEqual(proc.kills, ['SIGINT', 'SIGTERM', 'SIGKILL']);
  proc.emit('close', null, 'SIGKILL');
  assert.deepEqual(evs, [{ runId: 'R', type: 'exit', sessionId: ID, stopped: true, code: null, signal: 'SIGKILL', stderr: '' }]);
});

test('stop: süreç zamanında biterse bekleyen sinyal zamanlayıcıları iptal edilir', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { runner, evs, proc } = await started();
  runner.stop('R');
  proc.emit('close', 0, null);
  assert.equal(evs.at(-1).stopped, true);
  t.mock.timers.tick(20000);
  assert.deepEqual(proc.kills, []); assert.equal(proc.endCount, 0);
});

test('stop: kill hata fırlatsa da zamanlayıcı çökmez ve sıradaki sinyal denenir', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  deps.platform = 'darwin';
  const { runner, proc } = await started();
  const tried = [];
  proc.kill = sig => { tried.push(sig); throw new Error('ESRCH'); };
  runner.stop('R');
  t.mock.timers.tick(9000);
  assert.deepEqual(tried, ['SIGINT', 'SIGTERM', 'SIGKILL']);
});

test('stop (Windows): taskkill /T ile ağaç kapatılır; SIGINT dışında /F; pid yoksa çağrılmaz', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  deps.platform = 'win32';
  const calls = [];
  deps.execFile = (file, args, o, cb) => { calls.push({ file, args, o }); cb(null); };
  const { runner, proc, procs } = await started();
  runner.stop('R');
  t.mock.timers.tick(9000);
  assert.deepEqual(calls, [
    { file: 'taskkill', args: ['/pid', '4242', '/T'], o: { windowsHide: true } },
    { file: 'taskkill', args: ['/pid', '4242', '/T', '/F'], o: { windowsHide: true } },
    { file: 'taskkill', args: ['/pid', '4242', '/T', '/F'], o: { windowsHide: true } }]);
  assert.deepEqual(proc.kills, []);
  assert.equal(procs.length, 1);
  const s2 = await started({ runId: 'R2' });
  s2.proc.pid = undefined;
  s2.runner.stop('R2');
  t.mock.timers.tick(9000);
  assert.equal(calls.length, 3);
});

test('stopAll tüm çalıştırmaları durdurur; active özet listesi döner', async () => {
  const { procs } = fakeSpawn(); const { runner } = collect();
  const t0 = Date.now();
  await runner.start({ runId: 'A', sessionId: ID, cwd: os.tmpdir() });
  await runner.start({ runId: 'B', newSession: true, cwd: os.tmpdir() });
  const act = runner.active();
  assert.deepEqual(act.map(a => Object.keys(a)), [['runId', 'sessionId', 'startedAt'], ['runId', 'sessionId', 'startedAt']]);
  assert.deepEqual(act.map(a => a.runId), ['A', 'B']);
  assert.equal(act[0].sessionId, ID); assert.match(act[1].sessionId, UUIDRX);
  assert.ok(act.every(a => a.startedAt >= t0 && a.startedAt <= Date.now()));
  runner.stopAll();
  for (const p of procs) assert.deepEqual(p.written.at(-1).request, { subtype: 'interrupt' });
  for (const p of procs) p.emit('close', 0, null);
  assert.deepEqual(runner.active(), []);
});

// ================= authStatus =================
test('authStatus: claude yoksa kurulu değil', async () => {
  noClaudeWin();
  assert.deepEqual(await authStatus(), { installed: false, loggedIn: false });
});

test('authStatus: JSON çıktısı, eksik alan, bozuk çıktı ve hata ayrımı', async () => {
  let reply; const calls = [];
  deps.execFile = (file, args, o, cb) => { calls.push({ file, args, o }); cb(...reply); };
  reply = [null, '{"loggedIn":true,"authMethod":"oauth"}'];
  assert.deepEqual(await authStatus(), { installed: true, bin: FAKE, loggedIn: true, authMethod: 'oauth' });
  assert.equal(calls[0].file, FAKE); assert.deepEqual(calls[0].args, ['auth', 'status']);
  assert.equal(calls[0].o.timeout, 15000); assert.equal(calls[0].o.windowsHide, true); assert.equal(calls[0].o.shell, undefined);
  assert.equal(typeof calls[0].o.env.PATH, 'string');
  reply = [null, '{}'];
  assert.deepEqual(await authStatus(), { installed: true, bin: FAKE, loggedIn: false, authMethod: undefined });
  reply = [null, 'Logged in'];
  assert.deepEqual(await authStatus(), { installed: true, bin: FAKE, loggedIn: true, unknown: true });
  reply = [new Error('çıkış 1'), ''];
  assert.deepEqual(await authStatus(), { installed: true, bin: FAKE, loggedIn: false, unknown: true });
});

test('authStatus (Windows kabuk yolu): execFile shell:true ve tırnaklı yol ile çağrılır', async () => {
  const dir = tmp('qr a ');
  const bin = path.join(dir, 'claude.cmd'); fs.writeFileSync(bin, 'x');
  winMode(); process.env.CLAUDE_PANEL_CLAUDE_BIN = bin;
  const calls = [];
  deps.execFile = (file, args, o, cb) => { calls.push({ file, args, o }); cb(null, '{"loggedIn":true}'); };
  assert.equal((await authStatus()).loggedIn, true);
  assert.equal(calls[0].file, '"' + bin + '"'); assert.deepEqual(calls[0].args, ['auth', 'status']);
  assert.equal(calls[0].o.shell, true); assert.equal(calls[0].o.windowsHide, true);
});

// ================= Giriş betiği =================
// Argümanlarını ve çalışma klasörünü $OUT dosyasına yazan sahte claude
function recorderBin(dir) { return exe(path.join(dir, 'claude'), '#!/bin/sh\n{ pwd; for a in "$@"; do printf "[%s]\\n" "$a"; done; } > "$OUT"\n'); }

test('giriş betiği (macOS): tırnaklı yol kaçışlanır, betik gerçekten çalışır ve yalnızca kullanıcı erişebilir', { skip: POSIX_ONLY }, async () => {
  const bdir = tmp("qr it's \"x\" "); const bin = recorderBin(bdir);
  process.env.CLAUDE_PANEL_CLAUDE_BIN = bin;
  const sh = fakeShell();
  assert.equal(await openLoginTerminal(sh), true);
  const f = sh.opened[0];
  assert.equal(path.basename(f), 'claude-panel-login.command');
  assert.equal(fs.statSync(f).mode & 0o777, 0o700);
  const body = fs.readFileSync(f, 'utf8');
  assert.equal(body, `#!/bin/zsh\necho "Claude Panel: Claude Code girişi"\n'${bin.replace(/'/g, "'\\''")}' auth login\necho\necho "Bitti — bu pencereyi kapatıp Claude Panel'e dönebilirsin."\n`);
  const out = path.join(tmp(), 'out');
  const stdout = execFileSync('/bin/zsh', [f], { env: { ...process.env, OUT: out }, encoding: 'utf8' });
  assert.match(stdout, /^Claude Panel: Claude Code girişi\n/);
  assert.deepEqual(fs.readFileSync(out, 'utf8').split('\n').slice(1), ['[auth]', '[login]', '']);
});

test('giriş betiği (macOS): claude bulunamazsa "claude" adıyla yazılır', async () => {
  delete process.env.CLAUDE_PANEL_CLAUDE_BIN; deps.platform = 'darwin';
  const acc = fs.accessSync; fs.accessSync = () => { throw new Error('EACCES'); };
  const sh = fakeShell();
  try { await openLoginTerminal(sh); } finally { fs.accessSync = acc; }
  assert.ok(fs.readFileSync(sh.opened[0], 'utf8').includes("\n'claude' auth login\n"));
});

test('giriş betiği (Windows): .cmd içeriği, izinler; güvenli olmayan yol reddedilir', async () => {
  winMode(); process.env.CLAUDE_PANEL_CLAUDE_BIN = 'C:\\Program Files\\claude.exe';
  const sh = fakeShell();
  await openLoginTerminal(sh);
  const f = sh.opened[0];
  assert.equal(path.basename(f), 'claude-panel-login.cmd');
  if (!WIN) assert.equal(fs.statSync(f).mode & 0o777, 0o600); // Windows'ta POSIX izin biti yok
  assert.equal(fs.readFileSync(f, 'utf8'), '@echo off\r\nchcp 65001 >nul\r\ntitle Claude Panel - giris\r\necho Claude Panel: Claude Code girisi\r\ncall "C:\\Program Files\\claude.exe" auth login\r\necho.\r\necho Bitti - bu pencereyi kapatip Claude Panel\'e donebilirsin.\r\npause\r\n');
  process.env.CLAUDE_PANEL_CLAUDE_BIN = 'C:\\100%\\claude.exe';
  await assert.rejects(openLoginTerminal(sh), { message: 'claude yolu güvenli değil: C:\\100%\\claude.exe' });
  assert.equal(sh.opened.length, 1);
  noClaudeWin();
  await openLoginTerminal(sh);
  assert.ok(fs.readFileSync(sh.opened[1], 'utf8').includes('\r\ncall "claude" auth login\r\n'));
});

test('geçici betik klasörü 10 dakika sonra silinir', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const rmCalls = [];
  t.mock.method(fs, 'rm', (p, o, cb) => { rmCalls.push([p, o]); cb(null); });
  const sh = fakeShell();
  await openLoginTerminal(sh);
  const dir = path.dirname(sh.opened[0]);
  t.mock.timers.tick(10 * 60 * 1000 - 1);
  assert.equal(rmCalls.length, 0);
  t.mock.timers.tick(1);
  assert.deepEqual(rmCalls, [[dir, { recursive: true, force: true }]]);
});

// ================= Uzaktan Kontrol =================
test('Uzaktan Kontrol (macOS): betik doğru klasörde, doğru argümanlarla gerçekten çalışır', { skip: POSIX_ONLY }, async () => {
  const bin = recorderBin(tmp("qr b'in "));
  process.env.CLAUDE_PANEL_CLAUDE_BIN = bin;
  const dir = fs.realpathSync(tmp("qr it's $HOME "));
  const sh = fakeShell();
  assert.equal(await openRemoteTerminal(sh, { sessionId: ID, cwd: dir, name: "Proje 'x' $HOME" }), true);
  const f = sh.opened[0];
  assert.equal(path.basename(f), 'claude-panel-remote-0f8fad5b.command');
  assert.equal(fs.statSync(f).mode & 0o777, 0o700);
  const out = path.join(tmp(), 'out');
  const stdout = execFileSync('/bin/zsh', [f], { env: { ...process.env, OUT: out }, encoding: 'utf8' });
  assert.equal(stdout, 'Claude Panel → Uzaktan Kontrol: Proje x HOME\n');
  assert.deepEqual(fs.readFileSync(out, 'utf8').split('\n'), [dir, '[--resume]', '[' + ID + ']', '[--remote-control]', '[Proje x HOME]', '']);
});

test('Uzaktan Kontrol (macOS): ad boşsa "Claude Panel", claude bulunamazsa "claude"', async () => {
  delete process.env.CLAUDE_PANEL_CLAUDE_BIN; deps.platform = 'darwin';
  const acc = fs.accessSync; fs.accessSync = () => { throw new Error('EACCES'); };
  const sh = fakeShell();
  try { await openRemoteTerminal(sh, { sessionId: ID, cwd: os.tmpdir() }); } finally { fs.accessSync = acc; }
  const body = fs.readFileSync(sh.opened[0], 'utf8');
  assert.ok(body.endsWith("\n'claude' --resume " + ID + " --remote-control 'Claude Panel'\n"), body);
});

test('Uzaktan Kontrol (Windows): .cmd içeriği tam beklendiği gibi; güvenli olmayan klasör ve yol reddedilir', async () => {
  winMode(); process.env.CLAUDE_PANEL_CLAUDE_BIN = 'C:\\Program Files\\claude.exe';
  const dir = tmp('qr w ');
  const sh = fakeShell();
  await openRemoteTerminal(sh, { sessionId: ID, cwd: dir, name: 'Proje & "x"' });
  const f = sh.opened[0];
  assert.equal(path.basename(f), 'claude-panel-remote-0f8fad5b.cmd');
  if (!WIN) assert.equal(fs.statSync(f).mode & 0o777, 0o600); // Windows'ta POSIX izin biti yok
  assert.equal(fs.readFileSync(f, 'utf8'), `@echo off\r\nchcp 65001 >nul\r\ntitle Claude Panel - Uzaktan Kontrol\r\ncd /d "${dir}" || exit /b 1\r\necho Claude Panel - Uzaktan Kontrol: Proje x\r\ncall "C:\\Program Files\\claude.exe" --resume ${ID} --remote-control "Proje x"\r\npause\r\n`);
  const bad = tmp('qr 100% ');
  await assert.rejects(openRemoteTerminal(sh, { sessionId: ID, cwd: bad, name: 'a' }), { message: 'Bu klasör adı Uzaktan Kontrol betiğinde güvenle kullanılamaz: ' + bad });
  process.env.CLAUDE_PANEL_CLAUDE_BIN = 'C:\\a&b\\claude.exe';
  await assert.rejects(openRemoteTerminal(sh, { sessionId: ID, cwd: dir, name: 'a' }), { message: 'Bu klasör adı Uzaktan Kontrol betiğinde güvenle kullanılamaz: C:\\a&b\\claude.exe' });
  assert.equal(sh.opened.length, 1);
  noClaudeWin();
  await openRemoteTerminal(sh, { sessionId: ID, cwd: dir, name: 'a' });
  assert.ok(fs.readFileSync(sh.opened[1], 'utf8').includes('\r\ncall "claude" --resume '));
});

// ================= mcpList =================
test('mcpList: claude yoksa hata döner', async () => {
  noClaudeWin();
  assert.deepEqual(await mcpList(os.tmpdir()), { ok: false, error: 'claude bulunamadı', servers: [] });
});

test('mcpList: satırlar ve durumlar ayrıştırılır; klasör yoksa ev klasöründe çalışır', async () => {
  const calls = [];
  const out = ['Checking MCP server health…', '', '  a: npx a-srv - ✓ Connected  ', 'b: https://b/mcp - ✔ connected', 'c: https://c - ! Needs authentication', 'd: cmd --x - ✗ Failed to connect', 'e: u - fail', 'f: v - ⚠ pending', 'g: w - ✘ error', 'eksik satır'].join('\n');
  deps.execFile = (file, args, o, cb) => { calls.push({ file, args, o }); cb(null, out, ''); };
  const dir = tmp();
  const r = await mcpList(dir);
  assert.equal(calls[0].file, FAKE); assert.deepEqual(calls[0].args, ['mcp', 'list']);
  assert.equal(calls[0].o.cwd, dir); assert.equal(calls[0].o.timeout, 45000); assert.equal(calls[0].o.windowsHide, true);
  assert.deepEqual(r, { ok: true, error: null, servers: [
    { name: 'a', target: 'npx a-srv', statusText: 'Connected', status: 'connected' },
    { name: 'b', target: 'https://b/mcp', statusText: 'connected', status: 'connected' },
    { name: 'c', target: 'https://c', statusText: 'Needs authentication', status: 'needs-auth' },
    { name: 'd', target: 'cmd --x', statusText: 'Failed to connect', status: 'failed' },
    { name: 'e', target: 'u', statusText: 'fail', status: 'failed' },
    { name: 'f', target: 'v', statusText: 'pending', status: 'unknown' },
    { name: 'g', target: 'w', statusText: 'error', status: 'unknown' }] });
  await mcpList(path.join(dir, 'yok'));
  await mcpList(undefined);
  await mcpList('~');
  assert.deepEqual(calls.slice(1).map(c => c.o.cwd), [HOME, HOME, HOME]);
});

test('mcpList: hata ve sunucu yoksa önce stderr (300 karaktere kadar), o da yoksa hata mesajı', async () => {
  let reply;
  deps.execFile = (file, args, o, cb) => cb(...reply);
  reply = [new Error('çıkış 1'), '', 'E'.repeat(400)];
  assert.deepEqual(await mcpList(os.tmpdir()), { ok: false, error: 'E'.repeat(300), servers: [] });
  reply = [new Error('çıkış 2'), '', ''];
  assert.deepEqual(await mcpList(os.tmpdir()), { ok: false, error: 'çıkış 2', servers: [] });
  reply = [new Error('çıkış 3'), 'a: b - ✓ ok', 'uyarı'];
  assert.deepEqual(await mcpList(os.tmpdir()), { ok: true, error: null, servers: [{ name: 'a', target: 'b', statusText: 'ok', status: 'connected' }] });
  reply = [null, '', ''];
  assert.deepEqual(await mcpList(os.tmpdir()), { ok: true, error: null, servers: [] });
});

test('Uzaktan Kontrol / giriş: Terminal açılamazsa hata verir (sessizce "açıldı" denmez)', async () => {
  process.env.CLAUDE_PANEL_CLAUDE_BIN = recorderBin(tmp('qr fail '));
  const sh = { opened: [], openPath: async f => { sh.opened.push(f); return 'No application knows how to open'; } };
  await assert.rejects(openRemoteTerminal(sh, { sessionId: ID, cwd: fs.realpathSync(tmp('qr fd ')), name: 'x' }), /Terminal açılamadı: No application/);
  await assert.rejects(openLoginTerminal(sh), /Terminal açılamadı/);
});

// ================= Arka plan görevleri: giriş açık kalır, stop_task =================
test('arka plan görevi sürerken result girişi kapatmaz; liste boşalınca kapanır', async () => {
  const { evs, proc } = await started();
  proc.line({ type: 'system', subtype: 'background_tasks_changed', tasks: [{ task_id: 'b1' }] });
  proc.line({ type: 'result' });
  assert.equal(proc.endCount, 0, 'görev sürüyor: giriş açık');
  proc.line({ type: 'system', subtype: 'background_tasks_changed', tasks: [{ task_id: 'b1' }] });
  assert.equal(proc.endCount, 0);
  proc.line({ type: 'system', subtype: 'background_tasks_changed', tasks: [] });
  assert.equal(proc.endCount, 1);
  assert.equal(evs.filter(e => e.ev && e.ev.subtype === 'background_tasks_changed').length, 3, 'olaylar arayüze de gider');
});
test('arka plan listesi result öncesinde boşalırsa giriş result ile kapanır; tasks dizi değilse yok sayılır', async () => {
  const { proc } = await started();
  proc.line({ type: 'system', subtype: 'background_tasks_changed', tasks: [{ task_id: 'b1' }] });
  proc.line({ type: 'system', subtype: 'background_tasks_changed', tasks: [] });
  assert.equal(proc.endCount, 0, 'tur sürüyor: giriş açık');
  proc.line({ type: 'system', subtype: 'background_tasks_changed', tasks: null });
  proc.line({ type: 'system', subtype: 'other', tasks: [{ task_id: 'x' }] });
  proc.line({ type: 'result' });
  assert.equal(proc.endCount, 1);
});
test('stopTask: giriş açıkken stop_task denetim isteği yazar; geçersiz kimlik, bilinmeyen çalıştırma ve kapalı giriş false', async () => {
  const { runner, proc } = await started();
  assert.equal(runner.stopTask('yok', 'b1'), false);
  assert.equal(runner.stopTask('R', 'b 1'), false);
  assert.equal(runner.stopTask('R', '../x'), false);
  assert.equal(runner.stopTask('R', 'x'.repeat(81)), false);
  assert.equal(runner.stopTask('R', 'b1x-Z_9'), true);
  const w = proc.written.at(-1);
  assert.equal(w.type, 'control_request');
  assert.match(w.request_id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(w.request, { subtype: 'stop_task', task_id: 'b1x-Z_9' });
  proc.line({ type: 'result' });
  assert.equal(runner.stopTask('R', 'b1'), false, 'giriş kapandı');
});

// ================= Hızlı mod ve model adları =================
test('start: hızlı mod yalnızca true iken --fast-mode on ekler; boolean olmayan değer süreç başlatmadan reddedilir', async () => {
  const { calls } = fakeSpawn(); const { runner } = collect();
  const cwd = tmp();
  await runner.start({ sessionId: ID, effort: 'low', fast: true, ephemeral: true, cwd, text: 't' });
  const a = calls[0].args;
  assert.deepEqual(a.slice(a.indexOf('--effort'), a.indexOf('--permission-prompt-tool')), ['--effort', 'low', '--fast-mode', 'on']);
  for (const fast of [false, null, undefined]) await runner.start({ sessionId: ID, fast, ephemeral: true, cwd, text: 't' });
  assert.ok(calls.slice(1).every(c => !c.args.includes('--fast-mode')));
  for (const bad of ['on', 1, 'true --model x', {}]) await assert.rejects(runner.start({ sessionId: ID, fast: bad, cwd, text: 't' }), /^Error: Geçersiz hızlı mod değeri$/);
  assert.equal(calls.length, 4);
});

test('start: model takma adları (fable dahil) ve [1m] soneki kabul edilir; benzer görünen adlar reddedilir', async () => {
  const { calls } = fakeSpawn(); const { runner } = collect();
  const cwd = tmp();
  for (const model of ['fable', 'FABLE', 'opus[1m]', 'sonnet[1m]', 'claude-fable-5-1', 'claude-haiku-5-5[1m]']) await runner.start({ sessionId: ID, cwd, model, text: 't' });
  assert.deepEqual(calls.map(c => c.args[c.args.indexOf('--model') + 1]), ['fable', 'FABLE', 'opus[1m]', 'sonnet[1m]', 'claude-fable-5-1', 'claude-haiku-5-5[1m]']);
  for (const bad of ['fables', 'opus[2m]', 'default[1m]', 'fable opus', '[1m]']) await assert.rejects(runner.start({ sessionId: ID, cwd, model: bad, text: 't' }), /^Error: Geçersiz model: /);
  assert.equal(calls.length, 6);
});

// ================= contextUsage (/context) =================
// Gerçek CLI 2.1.318: `claude -p /context --resume <id> --no-session-persistence --output-format json` model çağırmaz
// (num_turns 0, usage sıfır, total_cost_usd değişmez), ~4 sn sürer, kayda hiçbir satır eklemez.
const ctxFx = n => fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8');
test('contextUsage: rapor ayrıştırılır; oturumu değiştirmeyen sabit argümanlar, zaman aşımı ve stdin kapatma', async () => {
  const calls = []; let ended = 0;
  deps.execFile = (file, args, o, cb) => { calls.push({ file, args, o }); setImmediate(() => cb(null, ctxFx('context-opus-1m.json'), '')); return { stdin: { end: () => ended++ } }; };
  const dir = tmp();
  const r = await contextUsage(ID, dir);
  assert.equal(r.window, 1000000); assert.equal(r.total, 40800);
  assert.ok(r.categories.some(c => c.name === 'Messages'));
  assert.ok(Math.abs(r.at - Date.now()) < 5000);
  assert.equal(calls[0].file, FAKE);
  assert.deepEqual(calls[0].args, ['-p', '/context', '--resume', ID, '--no-session-persistence', '--output-format', 'json']);
  assert.equal(calls[0].o.cwd, dir); assert.equal(calls[0].o.timeout, 60000); assert.equal(calls[0].o.maxBuffer, 16 * 1024 * 1024); assert.equal(calls[0].o.windowsHide, true);
  assert.equal(ended, 1);
  const r2 = await contextUsage(ID, dir, { model: 'claude-opus-5-5[1m]' });
  assert.deepEqual(calls[1].args.slice(-2), ['--model', 'claude-opus-5-5[1m]']);
  assert.equal(r2.total, 40800);
});

test('contextUsage: stdin.end hata fırlatsa da sonuç döner', async () => {
  deps.execFile = (file, args, o, cb) => { setImmediate(() => cb(null, ctxFx('context-haiku.json'), '')); return { stdin: { end: () => { throw new Error('EPIPE'); } } }; };
  assert.equal((await contextUsage(ID, tmp())).window, 200000);
});

test('contextUsage: geçersiz kimlik, klasör ve model süreç başlatmadan reddedilir', async () => {
  let n = 0; deps.execFile = () => { n++; };
  await assert.rejects(contextUsage('../x', tmp()), /^Error: Geçersiz oturum kimliği$/);
  await assert.rejects(contextUsage(ID, path.join(tmp(), 'yok')), /^Error: Çalışma klasörü bulunamadı: /);
  await assert.rejects(contextUsage(ID, tmp(), { model: 'x; rm -rf' }), /^Error: Geçersiz model: x; rm -rf$/);
  assert.equal(n, 0);
});

test('contextUsage: claude bulunamazsa açık hata', async () => {
  // Ev klasöründeki ~/.local/bin her iki kipte de aranır: gerçek CLI'nin bulunmadığı kip seçilir
  // (Windows makinesinde claude.exe vardır → Mac kipi; Mac'te claude vardır → Windows kipi)
  if (process.platform === 'win32') { delete process.env.CLAUDE_PANEL_CLAUDE_BIN; deps.platform = 'darwin'; process.env.PATH = tmp(); }
  else noClaudeWin();
  await assert.rejects(contextUsage(ID, tmp()), /^Error: claude komutu bulunamadı$/);
});

test('contextUsage: CLI hatası stderr ile (son 300 karakter), stderr yoksa hata iletisiyle, hiçbiri yoksa genel iletiyle döner', async () => {
  const run = (err, out, errOut) => { deps.execFile = (f, a, o, cb) => { setImmediate(() => cb(err, out, errOut)); }; return contextUsage(ID, tmp()); };
  await assert.rejects(run(new Error('exit 1'), '', 'No conversation found with session ID: x\n'), /^Error: No conversation found with session ID: x$/);
  await assert.rejects(run(new Error('exit 1'), '', 'E'.repeat(400)), { message: 'E'.repeat(300) });
  await assert.rejects(run(new Error('zaman aşımı'), undefined, ''), /^Error: zaman aşımı$/);
  await assert.rejects(run(null, '{"result":"Unknown command"}', undefined), /^Error: Bağlam bilgisi okunamadı$/);
});
