// Runner: sahte claude ile süreç başlatma, olay akışı, yeni oturum, çatallama ve durdurma
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
process.env.CLAUDE_PANEL_CLAUDE_BIN = path.join(__dirname, 'fake-claude.js');
const { Runner, authStatus } = require('../src/main/runner');

function collect() {
  const evs = []; let done;
  const finished = new Promise(r => (done = r));
  const runner = new Runner((ch, p) => { evs.push(p); if (p.type === 'exit') done(p); });
  return { runner, evs, finished };
}

test('giriş durumu okunur', async () => {
  const a = await authStatus();
  assert.equal(a.installed, true); assert.equal(a.loggedIn, true);
});

test('var olan oturumu --resume ile sürdürür ve olayları sırayla iletir', async () => {
  const { runner, evs, finished } = collect();
  const id = '11111111-2222-3333-4444-555555555555';
  await runner.start({ sessionId: id, cwd: os.tmpdir(), text: 'merhaba', permissionMode: 'acceptEdits', model: 'sonnet' });
  const exit = await finished;
  assert.equal(exit.code, 0);
  const types = evs.filter(e => e.type === 'event').map(e => e.ev.type);
  assert.equal(types[0], 'system'); assert.equal(types.at(-1), 'result');
  assert.ok(types.includes('stream_event') && types.includes('assistant') && types.includes('user'));
  const result = evs.find(e => e.ev && e.ev.type === 'result').ev;
  assert.deepEqual(result.args.slice(result.args.indexOf('--resume'), result.args.indexOf('--resume') + 2), ['--resume', id]);
  assert.ok(result.args.includes('--permission-mode') && result.args.includes('sonnet'));
  assert.equal(evs.find(e => e.ev && e.ev.type === 'system').sessionId, id);
});

test('yeni sohbet --session-id ile önceden bilinen kimlikle başlar', async () => {
  const { runner, evs, finished } = collect();
  const r = await runner.start({ newSession: true, cwd: os.tmpdir(), text: 'ilk' });
  await finished;
  assert.match(r.sessionId, /^[0-9a-f-]{36}$/);
  assert.equal(evs.find(e => e.ev && e.ev.type === 'system').ev.session_id, r.sessionId);
});

test('çatallamada yeni oturum kimliği gelir', async () => {
  const { runner, evs, finished } = collect();
  const id = 'aaaaaaaa-2222-3333-4444-555555555555';
  await runner.start({ sessionId: id, fork: true, cwd: os.tmpdir(), text: 'çatal' });
  const exit = await finished;
  assert.notEqual(exit.sessionId, id);
});

test('durdurma süreci sonlandırır', async () => {
  process.env.FAKE_DELAY = '2000';
  const { runner, finished } = collect();
  const r = await runner.start({ sessionId: 'bbbbbbbb-2222-3333-4444-555555555555', cwd: os.tmpdir(), text: 'uzun iş' });
  setTimeout(() => runner.stop(r.runId), 300);
  const exit = await finished;
  delete process.env.FAKE_DELAY;
  assert.equal(exit.stopped, true);
});

test('olmayan klasörde açık hata verir', async () => {
  const { runner } = collect();
  await assert.rejects(runner.start({ sessionId: 'x', cwd: '/yok/boyle/bir/klasor', text: 'a' }), /bulunamadı/);
});

// ---------- Faz 3: izin protokolü ----------
function collectPerm(answer) {
  const evs = []; let done;
  const finished = new Promise(r => (done = r));
  const runner = new Runner((ch, p) => {
    evs.push(p);
    if (p.type === 'permission') setTimeout(() => answer(runner, p), 50);
    if (p.type === 'exit') done(p);
  });
  return { runner, evs, finished };
}
const resultOf = evs => evs.find(e => e.ev && e.ev.type === 'result').ev;
const toolResult = evs => evs.filter(e => e.ev && e.ev.type === 'user').map(e => e.ev.message.content[0]).find(c => c.tool_use_id === 'tu1');

test('izin isteği panelden onaylanınca araç çalışır', async () => {
  process.env.FAKE_PERM = '1';
  const { runner, evs, finished } = collectPerm((r, p) => r.respond(p.runId, p.requestId, { behavior: 'allow', updatedInput: p.request.input }));
  await runner.start({ sessionId: 'cccccccc-2222-3333-4444-555555555555', cwd: os.tmpdir(), text: 'izin' });
  const exit = await finished; delete process.env.FAKE_PERM;
  assert.equal(exit.code, 0);
  const perm = evs.find(e => e.type === 'permission');
  assert.equal(perm.request.tool_name, 'Bash');
  assert.equal(toolResult(evs).is_error, false);
  assert.ok(evs.findIndex(e => e.type === 'permission') < evs.findIndex(e => e.ev && e.ev.type === 'result'));
});

test('reddedilince araç çalışmaz ve neden Claude\'a iletilir', async () => {
  process.env.FAKE_PERM = '1';
  const { runner, evs, finished } = collectPerm((r, p) => r.respond(p.runId, p.requestId, { behavior: 'deny', message: 'bunu yapma' }));
  await runner.start({ sessionId: 'dddddddd-2222-3333-4444-555555555555', cwd: os.tmpdir(), text: 'izin' });
  await finished; delete process.env.FAKE_PERM;
  const tr = toolResult(evs);
  assert.equal(tr.is_error, true); assert.match(tr.content, /bunu yapma/);
});

test('"hep izin ver" kuralları oturum hedefiyle iletilir', async () => {
  process.env.FAKE_PERM = '1';
  const { runner, evs, finished } = collectPerm((r, p) => r.respond(p.runId, p.requestId, { behavior: 'allow', updatedInput: p.request.input, updatedPermissions: p.request.permission_suggestions.map(s => ({ ...s, destination: 'session' })) }));
  await runner.start({ sessionId: 'eeeeeeee-2222-3333-4444-555555555555', cwd: os.tmpdir(), text: 'izin' });
  await finished; delete process.env.FAKE_PERM;
  const rules = evs.find(e => e.ev && e.ev.subtype === 'perm_rules').ev.rules;
  assert.equal(rules[0].destination, 'session');
});

test('onay beklerken durdurma: kesme isteği gider, tur kapanır', async () => {
  process.env.FAKE_PERM = '1';
  const { runner, evs, finished } = collectPerm((r, p) => r.stop(p.runId));
  await runner.start({ sessionId: 'ffffffff-2222-3333-4444-555555555555', cwd: os.tmpdir(), text: 'izin' });
  const exit = await finished; delete process.env.FAKE_PERM;
  assert.equal(exit.stopped, true);
  assert.equal(resultOf(evs).subtype, 'error_during_execution');
});

test('görsel ve dosya ekleri mesaja eklenir', async () => {
  const { runner, evs, finished } = collect();
  await runner.start({ sessionId: '12121212-2222-3333-4444-555555555555', cwd: os.tmpdir(), text: 'bak', images: [{ media_type: 'image/png', data: 'iVBORw0KGgo=' }], files: ['~/x.txt'] });
  await finished;
  const reply = evs.filter(e => e.ev && e.ev.type === 'assistant').map(e => e.ev.message.content[0].text).find(Boolean);
  assert.match(reply, /\+1 görsel/);
  assert.match(reply, /^Aldım: "bak"/);
});

test('mcp list durumları ayrıştırılır', async () => {
  const { mcpList } = require('../src/main/runner');
  const r = await mcpList(os.tmpdir());
  assert.deepEqual(r.servers.map(s => s.status), ['connected', 'needs-auth']);
});
