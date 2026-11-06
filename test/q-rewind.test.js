// Mesajı düzenle ve oradan devam et: runner'ın --resume-session-at argümanı ve sessions.js'in devam noktası (`at`) yakalaması.
// Gerçek ~/.claude ve ~/.claude-panel'e dokunulmaz: HOME ve CLAUDE_PANEL_HOME modüller yüklenmeden geçici klasöre çevrilir.
const { test, after, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');

const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cp-qrw-')));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
process.env.HOME = path.join(TMP, 'ev'); fs.mkdirSync(process.env.HOME);
process.env.CLAUDE_PANEL_HOME = path.join(TMP, 'panel');
const FAKE = path.join(__dirname, 'fake-claude.js');
// Windows'ta .js doğrudan başlatılamaz (EFTYPE): npm cmd-shim biçiminde bir .cmd sarmalayıcı (launchSpec onu node + betik olarak açar)
function fakeBin() {
  if (process.platform !== 'win32') return FAKE;
  const d = path.join(TMP, 'bin'); fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'fake.js'), `require(${JSON.stringify(FAKE)});\n`);
  fs.writeFileSync(path.join(d, 'claude.cmd'), '@"%~dp0\\node.exe" "%~dp0\\fake.js" %*\r\n');
  return path.join(d, 'claude.cmd');
}
process.env.CLAUDE_PANEL_CLAUDE_BIN = fakeBin();
const { Runner, filesRewind, worktreeInfo, _test } = require('../src/main/runner');
const { loadSession, SessionLoader } = require('../src/main/sessions');
const { deps } = _test;
const REAL = { ...deps };
afterEach(() => { Object.assign(deps, REAL); _test.reset(''); });
_test.reset('');

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const AT = 'c4253d8a-6198-4209-ac32-f20e757f4221';
const BASE = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages'];
let seq = 0;
const dir = () => { const d = path.join(TMP, 'd' + seq++); fs.mkdirSync(d); return d; };

function fakeSpawn() {
  const calls = [];
  deps.spawn = (file, args, o) => {
    const p = new EventEmitter(); const st = () => { const s = new EventEmitter(); s.setEncoding = () => {}; return s; };
    p.stdout = st(); p.stderr = st(); p.stdin = new EventEmitter(); p.stdin.write = () => true; p.stdin.end = () => {}; p.kill = () => true;
    calls.push({ file, args: args.slice(args.indexOf('-p')), o }); return p; // Windows sarmalayıcısının betik yolu atlanır
  };
  return calls;
}
const collect = () => { const evs = []; return { evs, runner: new Runner((_ch, p) => evs.push(p)) }; };

// ================= runner =================
test('resumeAt: --resume, --fork-session ve --resume-session-at sırayla eklenir; fork verilmese de çatallanır', async () => {
  const calls = fakeSpawn(); const { runner, evs } = collect();
  const cwd = dir();
  await runner.start({ runId: 'R1', sessionId: ID, resumeAt: AT, model: 'haiku', cwd, text: 'düzenlendi' });
  assert.deepEqual(calls[0].args, [...BASE, '--resume', ID, '--fork-session', '--resume-session-at', AT, '--model', 'haiku', '--permission-prompt-tool', 'stdio']);
  assert.deepEqual(evs[0], { runId: 'R1', type: 'started', sessionId: ID, fork: true, newSession: false });
  await runner.start({ runId: 'R2', sessionId: ID, fork: true, resumeAt: AT.toUpperCase(), cwd, text: 'x' });
  assert.deepEqual(calls[1].args.slice(7), ['--resume', ID, '--fork-session', '--resume-session-at', AT.toUpperCase(), '--permission-prompt-tool', 'stdio'], '--fork-session bir kez');
});

test('resumeAt: boş/null/verilmemiş ise bayrak eklenmez ve çatal yalnızca fork ile olur', async () => {
  const calls = fakeSpawn(); const { runner, evs } = collect();
  const cwd = dir();
  for (const resumeAt of ['', null, undefined, 0, false]) await runner.start({ sessionId: ID, resumeAt, cwd, text: 'x' });
  for (const c of calls) assert.deepEqual(c.args.slice(7), ['--resume', ID, '--permission-prompt-tool', 'stdio']);
  assert.ok(evs.every(e => e.fork === false));
  await runner.start({ sessionId: ID, fork: true, resumeAt: null, cwd, text: 'x' });
  assert.deepEqual(calls[5].args.slice(7, 10), ['--resume', ID, '--fork-session']);
});

test('resumeAt: UUID olmayan değer ve yeni sohbet reddedilir, süreç başlamaz', async () => {
  const calls = fakeSpawn(); const { runner } = collect();
  const cwd = dir();
  for (const bad of ['abc', AT + '\n', ' ' + AT, AT + 'x', AT.replace(/-/g, ''), '--model', 5, true, { id: AT }, [AT]])
    await assert.rejects(runner.start({ sessionId: ID, resumeAt: bad, cwd, text: 'x' }), /^Error: Geçersiz devam noktası$/, String(bad));
  await assert.rejects(runner.start({ newSession: true, resumeAt: AT, cwd, text: 'x' }), /^Error: Yeni sohbette devam noktası olamaz$/);
  assert.equal(calls.length, 0);
});

test('resumeAt: sahte CLI bayrağı alır, yeni kimlikle (çatal) yanıt verir', async () => {
  const { runner, evs } = collect();
  const done = new Promise(r => { runner.send = (_c, p) => { evs.push(p); if (p.type === 'exit') r(); }; });
  process.env.FAKE_DELAY = '4';
  await runner.start({ runId: 'R9', sessionId: ID, resumeAt: AT, cwd: dir(), text: 'yeni metin', ephemeral: true });
  await done; delete process.env.FAKE_DELAY;
  const init = evs.find(e => e.type === 'event' && e.ev.type === 'system').ev;
  assert.notEqual(init.session_id, ID);
  const res = evs.find(e => e.type === 'event' && e.ev.type === 'result').ev;
  assert.ok(res.args.includes('--resume-session-at') && res.args[res.args.indexOf('--resume-session-at') + 1] === AT);
  const txt = evs.filter(e => e.type === 'event' && e.ev.type === 'assistant').map(e => e.ev.message.content[0].text || '').join(' ');
  assert.match(txt, /Aldım: "yeni metin" \(c4253d8a noktasından\)/);
  assert.equal(evs[evs.length - 1].code, 0);
});

test('sahte CLI: --resume-session-at --fork-session olmadan hata verir', async () => {
  const { execFileSync } = require('child_process');
  assert.throws(() => execFileSync(process.execPath, [FAKE, '-p', '--resume', ID, '--resume-session-at', AT], { stdio: 'pipe' }), e => e.status === 3);
});

// ================= sessions: devam noktası =================
const U = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const user = (content, extra = {}) => ({ type: 'user', message: { role: 'user', content }, ...extra });
const asst = (content, extra = {}) => ({ type: 'assistant', message: { role: 'assistant', content }, ...extra });
const LINES = [
  { type: 'queue-operation' },
  user('ilk', { uuid: U(1), timestamp: 't1' }),                                   // başı: önünde asistan yok → ''
  { type: 'attachment', uuid: U(2), parentUuid: U(1) },
  asst([{ type: 'thinking', thinking: '' }], { uuid: U(3) }),
  asst([{ type: 'text', text: 'A' }], { uuid: U(4) }),
  asst([{ type: 'text', text: 'yan' }], { uuid: U(5), isSidechain: true }),       // alt ajan: sayılmaz
  user([{ type: 'text', text: '<system-reminder>x</system-reminder>' }], { uuid: U(6), isMeta: true }),
  user('ikinci', { uuid: U(7), timestamp: 't2' }),                                // → U(4)
  asst([{ type: 'tool_use', id: 'tu', name: 'Bash', input: { command: 'ls' } }], { uuid: U(8) }),
  user([{ type: 'tool_result', tool_use_id: 'tu', content: 'ok' }], { uuid: U(9) }),
  asst([{ type: 'text', text: 'B' }]),                                            // uuid'siz: devam noktası değişmez
  asst([{ type: 'text', text: 'C' }], { uuid: '' }),
  user('[Request interrupted by user]', { uuid: U(10) }),                         // gürültü: mesaj değil
  user('uuidsiz'),                                                                // uuid'siz kayıt: `at` yok
  user('x'.repeat(8001), { uuid: U(11) }),                                        // kısaltılmış metin: düzenlenemez
  user('son', { uuid: U(12), timestamp: 't3' }),                                  // → U(8)
];
const EXPECT = [['ilk', '', U(1)], ['ikinci', U(4), U(7)], ['uuidsiz', undefined, undefined], ['x'.repeat(8000), undefined, undefined], ['son', U(8), U(12)]];
const users = r => r.msgs.filter(m => m.r === 'u').map(m => [m.t, m.at, m.uuid]);

test('sessions: kullanıcı mesajına önündeki son asistan kaydının uuid\'si yazılır', async () => {
  const f = path.join(dir(), ID + '.jsonl');
  fs.writeFileSync(f, LINES.map(l => JSON.stringify(l)).join('\n') + '\n');
  const r = await loadSession(f);
  assert.deepEqual(users(r), EXPECT);
  assert.ok(!('at' in r.msgs.find(m => m.t === 'uuidsiz')) && !('uuid' in r.msgs.find(m => m.t === 'uuidsiz')));
  assert.ok(!('uuid' in r.msgs.find(m => m.r === 'u' && m.t.length === 8000)), 'kısaltılmış mesajda kod geri sarma da yok');
  assert.deepEqual(r.msgs.find(m => m.t === 'ilk'), { r: 'u', t: 'ilk', ts: 't1', at: '', uuid: U(1) });
});

test('sessions: artımlı yükleyici aynı devam noktalarını verir (satır ortasından bölünse de)', async () => {
  const f = path.join(dir(), ID + '.jsonl');
  const all = LINES.map(l => JSON.stringify(l)).join('\n') + '\n';
  const full = await loadSession((fs.writeFileSync(f, all), f));
  for (const cut of [1, all.indexOf('ikinci') + 2, all.indexOf('"son"'), all.length - 3]) {
    fs.writeFileSync(f, all.slice(0, cut));
    const L = new SessionLoader(8, 64);
    await L.load(f);
    fs.appendFileSync(f, all.slice(cut));
    const r = await L.load(f);
    assert.deepEqual(users(r), EXPECT, 'kesim ' + cut);
    assert.deepEqual(r, full);
  }
});

// ================= runner: dosya kaydı, ek klasör, worktree =================
// Yazılan satırları kaydeden sahte süreç (stdin) + git için sahte execFile
function richSpawn() {
  const calls = [];
  deps.spawn = (file, args, o) => {
    const p = new EventEmitter(); const st = () => { const s = new EventEmitter(); s.setEncoding = () => {}; return s; };
    p.stdout = st(); p.stderr = st(); p.stdin = new EventEmitter(); p.written = []; p.ended = 0;
    p.stdin.write = s => { p.written.push(JSON.parse(s)); return true; }; p.stdin.end = () => { p.ended++; }; p.kill = () => true; p.pid = 77;
    p.line = o => p.stdout.emit('data', (typeof o === 'string' ? o : JSON.stringify(o)) + '\n');
    calls.push({ file, args: args.slice(args.indexOf('-p')), o, p }); return p;
  };
  return calls;
}
function fakeGit(answer) { // answer(args) → {err?, out}
  const seen = [];
  deps.execFile = (file, args, o, cb) => { seen.push({ file, args, o }); const r = answer(args.slice(2)) || {}; setImmediate(() => cb(r.err || null, r.out || '', '')); return {}; };
  return seen;
}
const tick = () => new Promise(r => setImmediate(r));

test('start: her süreç dosya kaydı (checkpoint) ortam değişkeniyle başlar', async () => {
  const calls = richSpawn(); const { runner } = collect();
  await runner.start({ sessionId: ID, cwd: dir(), text: 'x' });
  assert.equal(calls[0].o.env.CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING, 'true');
});

test('start: ek klasörler --add-dir olarak gerçek yollarıyla, tekrarsız ve çalışma klasörü hariç eklenir', async () => {
  const calls = richSpawn(); const { runner } = collect();
  const cwd = dir(), a = dir(), b = dir();
  await runner.start({ sessionId: ID, cwd, text: 'x', addDirs: [a, b, a + path.sep, cwd] });
  assert.deepEqual(calls[0].args.slice(-6), ['--add-dir', fs.realpathSync(a), '--add-dir', fs.realpathSync(b), '--permission-prompt-tool', 'stdio']);
  await runner.start({ sessionId: ID, cwd, text: 'x', addDirs: [] });
  assert.ok(!calls[1].args.includes('--add-dir'));
});

test('start: geçersiz ek klasör süreç başlamadan reddedilir', async () => {
  const calls = richSpawn(); const { runner } = collect();
  const cwd = dir(), f = path.join(cwd, 'dosya.txt'); fs.writeFileSync(f, 'x');
  for (const [bad, rx] of [[['göreli/yol'], /mutlak yol/], [[path.join(cwd, 'yok')], /bulunamadı/], [[f], /klasör değil/], [[cwd + '\nx'], /Geçersiz ek klasör$/],
    [[''], /Geçersiz ek klasör$/], [[5], /Geçersiz ek klasör$/], ['tek', /listesi/], [Array(21).fill(cwd), /listesi/]])
    await assert.rejects(runner.start({ sessionId: ID, cwd, text: 'x', addDirs: bad }), rx, JSON.stringify(bad).slice(0, 40));
  assert.equal(calls.length, 0);
});

test('start: worktree yalnız yeni sohbette, git denetiminden sonra --worktree <ad> olarak eklenir', async () => {
  const calls = richSpawn(); const { runner } = collect();
  const repo = dir();
  const seen = fakeGit(a => a[0] === 'rev-parse' ? { out: repo + '\n' } : { err: Object.assign(new Error('yok'), { code: 1 }) });
  const r = await runner.start({ newSession: true, cwd: repo, text: 'x', worktree: 'deneme-1' });
  assert.deepEqual(calls[0].args.slice(7, 11), ['--session-id', r.sessionId, '--worktree', 'deneme-1']);
  assert.deepEqual(seen.map(x => x.args.slice(2)), [['rev-parse', '--show-toplevel'], ['show-ref', '--verify', '--quiet', 'refs/heads/worktree-deneme-1']]);
  assert.ok(seen.every(x => x.file === 'git' && x.args[0] === '-C' && x.o.windowsHide));
  await assert.rejects(runner.start({ sessionId: ID, cwd: repo, text: 'x', worktree: 'a' }), /yalnız yeni sohbette/);
  await assert.rejects(runner.start({ newSession: true, cwd: repo, text: 'x', worktree: '../x' }), /Geçersiz worktree adı/);
  fakeGit(() => ({ err: Object.assign(new Error('değil'), { code: 128 }) }));
  await assert.rejects(runner.start({ newSession: true, cwd: repo, text: 'x', worktree: 'b' }), /git deposu değil/);
  assert.equal(calls.length, 1);
});

test('worktreeInfo: git yok / depo değil / ad ya da dal dolu / uygun', async () => {
  const repo = dir();
  fakeGit(() => ({ err: Object.assign(new Error('spawn git ENOENT'), { code: 'ENOENT' }) }));
  assert.match((await worktreeInfo(repo)).error, /Git bulunamadı/);
  fakeGit(a => a[0] === 'rev-parse' ? { out: repo } : {});
  assert.deepEqual(await worktreeInfo(repo), { ok: true, repo: true, root: path.normalize(repo) });
  assert.match((await worktreeInfo(repo, 'x')).error, /dalı zaten var/);
  fs.mkdirSync(path.join(repo, '.claude', 'worktrees', 'var'), { recursive: true });
  assert.match((await worktreeInfo(repo, 'var')).error, /zaten var/);
  await assert.rejects(worktreeInfo(path.join(repo, 'yok'), 'x'), /bulunamadı/);
});

test('worktreeInfo: gerçek git deposunda (git kuruluysa)', async t => {
  const { execFileSync } = require('child_process');
  try { execFileSync('git', ['--version'], { stdio: 'pipe' }); } catch { return t.skip('git yok'); }
  const repo = dir(), plain = dir();
  execFileSync('git', ['init', '-q', repo]);
  const r = await worktreeInfo(repo, 'yeni');
  assert.equal(r.ok, true); assert.equal(r.branch, 'worktree-yeni');
  assert.equal(fs.realpathSync(r.root), fs.realpathSync(repo));
  assert.equal((await worktreeInfo(plain)).repo, false);
});

const MID = 'a1b2c3d4-0000-4000-8000-000000000001';
test('filesRewind: --resume süreci, kullanıcı mesajı olmadan yalnız rewind_files isteği; yanıt gelince stdin kapanır', async () => {
  const calls = richSpawn();
  const cwd = dir();
  const pr = filesRewind({ sessionId: ID, cwd, userMessageId: MID, dryRun: true });
  await tick();
  const c = calls[0];
  assert.deepEqual(c.args, ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--resume', ID]);
  assert.equal(c.o.env.CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING, 'true'); assert.equal(c.o.cwd, cwd);
  assert.equal(c.p.written.length, 1);
  const req = c.p.written[0];
  assert.deepEqual(req.request, { subtype: 'rewind_files', user_message_id: MID, dry_run: true });
  c.p.line('bozuk satır'); c.p.line('null'); c.p.line({ type: 'system' }); c.p.line({ type: 'control_response' }); c.p.line({ type: 'control_response', response: { request_id: 'başka' } });
  const full = JSON.stringify({ type: 'control_response', response: { subtype: 'success', request_id: req.request_id, response: { canRewind: true, filesChanged: ['/a.txt'], insertions: 2, deletions: 1 } } });
  c.p.stdout.emit('data', full.slice(0, 20)); c.p.stdout.emit('data', full.slice(20) + '\n');
  assert.deepEqual(await pr, { canRewind: true, files: ['/a.txt'], insertions: 2, deletions: 1, error: null });
  assert.equal(c.p.ended, 1);
  c.p.emit('close', 0); // yanıttan sonra kapanış sonucu değiştirmez
  c.p.stdin.emit('error', new Error('EPIPE')); // stdin hatası yutulur
});

test('filesRewind: gerçek geri sarmada dry_run yok; hata yanıtı, kapanış, süreç hatası ve zaman aşımı', async () => {
  const calls = richSpawn(); const cwd = dir();
  const p1 = filesRewind({ sessionId: ID, cwd, userMessageId: MID });
  await tick();
  const q = calls[0].p.written[0];
  assert.ok(!('dry_run' in q.request));
  calls[0].p.line({ type: 'control_response', response: { subtype: 'error', request_id: q.request_id, error: 'No file checkpoint found for this message.' } });
  assert.match((await p1).error, /dosya kaydı yok/);
  const p2 = filesRewind({ sessionId: ID, cwd, userMessageId: MID }); await tick();
  calls[1].p.stderr.emit('data', 'bir hata'); calls[1].p.emit('close', 2);
  await assert.rejects(p2, /yanıt vermeden kapandı \(çıkış 2\): bir hata/);
  const p3 = filesRewind({ sessionId: ID, cwd, userMessageId: MID }); await tick();
  calls[2].p.emit('close', 0);
  await assert.rejects(p3, /^Error: Claude süreci yanıt vermeden kapandı \(çıkış 0\)$/);
  const p4 = filesRewind({ sessionId: ID, cwd, userMessageId: MID }); await tick();
  calls[3].p.emit('error', new Error('spawn olmadı'));
  await assert.rejects(p4, /spawn olmadı/);
  await assert.rejects(filesRewind({ sessionId: ID, cwd, userMessageId: MID, timeoutMs: 30 }), /zaman aşımı/);
});

test('filesRewind: girdiler süreç başlamadan doğrulanır; claude yoksa hata', async () => {
  const calls = richSpawn(); const cwd = dir();
  await assert.rejects(filesRewind({ sessionId: 'x', cwd, userMessageId: MID }), /oturum kimliği/);
  await assert.rejects(filesRewind({ sessionId: ID, cwd, userMessageId: 'x' }), /mesaj kimliği/);
  await assert.rejects(filesRewind({ sessionId: ID, cwd: path.join(cwd, 'yok'), userMessageId: MID }), /bulunamadı/);
  assert.equal(calls.length, 0);
  const keep = process.env.CLAUDE_PANEL_CLAUDE_BIN; process.env.CLAUDE_PANEL_CLAUDE_BIN = '';
  deps.platform = 'yok'; const keepPath = process.env.PATH; process.env.PATH = cwd;
  try { await assert.rejects(filesRewind({ sessionId: ID, cwd, userMessageId: MID }), /claude komutu bulunamadı/); }
  finally { process.env.CLAUDE_PANEL_CLAUDE_BIN = keep; process.env.PATH = keepPath; }
});

test('filesRewind + sahte CLI: önce dosya listesi (dry_run), sonra dosya eski haline döner', async () => {
  const cwd = dir(), f = path.join(cwd, 'not.txt'), map = path.join(cwd, 'harita.json');
  fs.writeFileSync(f, 'YENİ\n'); fs.writeFileSync(map, JSON.stringify({ [MID]: { [f]: 'ESKİ\n' } }));
  process.env.FAKE_REWIND = map;
  try {
    const dry = await filesRewind({ sessionId: ID, cwd, userMessageId: MID, dryRun: true });
    assert.deepEqual(dry, { canRewind: true, files: [f], insertions: 1, deletions: 1, error: null });
    assert.equal(fs.readFileSync(f, 'utf8'), 'YENİ\n', 'dry_run dosyaya dokunmaz');
    const real = await filesRewind({ sessionId: ID, cwd, userMessageId: MID });
    assert.equal(real.canRewind, true);
    assert.equal(fs.readFileSync(f, 'utf8'), 'ESKİ\n');
    const none = await filesRewind({ sessionId: ID, cwd, userMessageId: U(99), dryRun: true });
    assert.equal(none.canRewind, false); assert.match(none.error, /dosya kaydı yok/);
  } finally { delete process.env.FAKE_REWIND; }
});

test('sahte CLI: checkpoint değişkeni yoksa gerçek CLI gibi "not enabled"; --worktree depo dışında hata verir', async () => {
  const { spawnSync } = require('child_process');
  const env = { ...process.env }; delete env.CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING;
  const r = spawnSync(process.execPath, [FAKE, '-p', '--resume', ID], { input: JSON.stringify({ type: 'control_request', request_id: 'r', request: { subtype: 'rewind_files', user_message_id: MID } }) + '\n', env, encoding: 'utf8' });
  assert.deepEqual(JSON.parse(r.stdout.trim()).response.response, { canRewind: false, error: 'File rewinding is not enabled.' });
  const w = spawnSync(process.execPath, [FAKE, '-p', '--worktree', 'a'], { cwd: dir(), input: '', encoding: 'utf8' });
  assert.equal(w.status, 1); assert.match(w.stderr, /Can only use --worktree in a git repository/);
});

test('start + sahte CLI: --worktree ile init olayı worktree klasörünü bildirir', async () => {
  const repo = dir(); fs.mkdirSync(path.join(repo, '.git'));
  fakeGit(a => a[0] === 'rev-parse' ? { out: repo } : { err: Object.assign(new Error('yok'), { code: 1 }) });
  const { runner, evs } = collect();
  const done = new Promise(r => { runner.send = (_c, p) => { evs.push(p); if (p.type === 'exit') r(); }; });
  process.env.FAKE_DELAY = '4';
  try { await runner.start({ newSession: true, cwd: repo, text: 'merhaba', worktree: 'wt1', ephemeral: true }); await done; }
  finally { delete process.env.FAKE_DELAY; }
  const init = evs.find(e => e.type === 'event' && e.ev.type === 'system').ev;
  assert.equal(init.cwd, path.join(repo, '.claude', 'worktrees', 'wt1'));
  assert.ok(fs.statSync(init.cwd).isDirectory());
});
