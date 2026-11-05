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
process.env.CLAUDE_PANEL_CLAUDE_BIN = FAKE;
const { Runner, _test } = require('../src/main/runner');
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
    calls.push({ file, args, o }); return p;
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
const EXPECT = [['ilk', ''], ['ikinci', U(4)], ['uuidsiz', undefined], ['x'.repeat(8000), undefined], ['son', U(8)]];
const users = r => r.msgs.filter(m => m.r === 'u').map(m => [m.t, m.at]);

test('sessions: kullanıcı mesajına önündeki son asistan kaydının uuid\'si yazılır', async () => {
  const f = path.join(dir(), ID + '.jsonl');
  fs.writeFileSync(f, LINES.map(l => JSON.stringify(l)).join('\n') + '\n');
  const r = await loadSession(f);
  assert.deepEqual(users(r), EXPECT);
  assert.ok(!('at' in r.msgs.find(m => m.t === 'uuidsiz')));
  assert.deepEqual(r.msgs.find(m => m.t === 'ilk'), { r: 'u', t: 'ilk', ts: 't1', at: '' });
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
