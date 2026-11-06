// Runner ↔ ekran kontrolü: Kontrol açıkken panelin ekran sunucusu agent-desktop ile aynı --mcp-config dosyasına girer,
// araç sırası yönergesi eklenir, tur bitince kayıt ve anahtarlı dosya silinir.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const { Runner, _test } = require('../src/main/runner');
const { deps } = _test;

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const ENV0 = { ...process.env };
const REAL = { ...deps };
test.afterEach(() => { Object.assign(deps, REAL); for (const k of Object.keys(process.env)) if (!(k in ENV0)) delete process.env[k]; Object.assign(process.env, ENV0); });

function fakeProc() {
  const p = new EventEmitter(); p.pid = 1;
  const s = () => { const e = new EventEmitter(); e.setEncoding = () => {}; return e; };
  p.stdout = s(); p.stderr = s(); p.stdin = new EventEmitter(); p.stdin.write = () => true; p.stdin.end = () => {}; p.kill = () => true;
  return p;
}
function setup(desktop) {
  const calls = [];
  process.env.CLAUDE_PANEL_CLAUDE_BIN = path.join(os.tmpdir(), 'claude-sahte');
  process.env.CLAUDE_PANEL_DESKTOP_BIN = desktop;
  deps.spawn = (file, args) => { const pr = fakeProc(); calls.push({ args, pr }); return pr; };
  const runner = new Runner(() => {});
  const reg = [];
  runner.screen = {
    register: async (runId, info) => { reg.push(['register', runId, info]); return { type: 'http', url: 'http://127.0.0.1:1/mcp/k', headers: { Authorization: 'Bearer t' } }; },
    release: id => { reg.push(['release', id]); },
  };
  return { runner, calls, reg, cwd: fs.mkdtempSync(path.join(os.tmpdir(), 'qrs-')) };
}
const argAfter = (a, k) => a[a.indexOf(k) + 1];

test('Kontrol açık: ekran + agent-desktop tek tura özel yapılandırmada; yönerge eklenir; tur bitince silinir', async () => {
  const t = setup('/opt/ad/agent-desktop');
  const { runId } = await t.runner.start({ sessionId: ID, control: true, ephemeral: true, cwd: t.cwd, text: 'x' });
  const a = t.calls[0].args;
  assert.ok(a.includes('--chrome'));
  const f = argAfter(a, '--mcp-config');
  assert.equal(path.basename(f), 'kontrol.mcp.json');
  assert.deepEqual(JSON.parse(fs.readFileSync(f, 'utf8')), { mcpServers: {
    'agent-desktop': { command: '/opt/ad/agent-desktop', args: ['mcp'] },
    ekran: { type: 'http', url: 'http://127.0.0.1:1/mcp/k', headers: { Authorization: 'Bearer t' } } } });
  assert.equal(argAfter(a, '--append-system-prompt'), _test.CONTROL_PROMPT);
  assert.ok(a.indexOf('--append-system-prompt') > a.indexOf('--permission-prompt-tool'));
  assert.deepEqual(t.reg, [['register', runId, { sessionId: ID, cwd: t.cwd }]]);
  t.calls[0].pr.emit('close', 0);
  assert.deepEqual(t.reg.at(-1), ['release', runId]);
  await new Promise(r => setTimeout(r, 50));
  assert.ok(!fs.existsSync(path.dirname(f)), 'anahtarlı yapılandırma silindi');
  fs.rmSync(t.cwd, { recursive: true, force: true });
});

test('Kontrol açık, agent-desktop yok: yalnız ekran sunucusu; Kontrol kapalı: hiçbiri; yönerge kabukta güvenli', async () => {
  const t = setup('');
  await t.runner.start({ sessionId: ID, control: true, ephemeral: true, cwd: t.cwd, text: 'x' });
  assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(argAfter(t.calls[0].args, '--mcp-config'), 'utf8')).mcpServers), ['ekran']);
  await t.runner.start({ sessionId: ID, control: false, ephemeral: true, cwd: t.cwd, text: 'x' });
  const b = t.calls[1].args;
  assert.ok(!b.includes('--mcp-config') && !b.includes('--append-system-prompt') && !b.includes('--chrome'));
  assert.equal(t.reg.filter(r => r[0] === 'register').length, 1);
  // cmd.exe kabuk yolunda (winQuote) reddedilmemeli: tek satır, özel karakter yok
  assert.doesNotThrow(() => _test.winQuote(_test.CONTROL_PROMPT));
  assert.match(_test.CONTROL_PROMPT, /premiere-kopru.*agent-desktop.*mcp__ekran__/);
  for (const c of t.calls) c.pr.emit('close', 0);
  fs.rmSync(t.cwd, { recursive: true, force: true });
});

test('süreç başlatılamazsa ekran kaydı bırakılır ve hata iletilir; release hatası turu bozmaz', async () => {
  const t = setup('');
  deps.spawn = () => { throw new Error('spawn EACCES'); };
  await assert.rejects(t.runner.start({ sessionId: ID, control: true, ephemeral: true, cwd: t.cwd, text: 'x' }), /EACCES/);
  assert.equal(t.reg.at(-1)[0], 'release');
  t.runner.screen.release = () => { throw new Error('x'); };
  deps.spawn = (file, args) => { const pr = fakeProc(); t.calls.push({ args, pr }); return pr; };
  await t.runner.start({ sessionId: ID, control: true, ephemeral: true, cwd: t.cwd, text: 'x' });
  assert.doesNotThrow(() => t.calls[0].pr.emit('close', 0));
  // ekran sağlayıcısı olmayan çalıştırıcı (testler, eski kurulum): eski davranış
  const r2 = new Runner(() => {});
  await r2.start({ sessionId: ID, control: true, ephemeral: true, cwd: t.cwd, text: 'x' });
  assert.ok(!t.calls[1].args.includes('--mcp-config'));
  t.calls[1].pr.emit('close', 0);
  fs.rmSync(t.cwd, { recursive: true, force: true });
});
