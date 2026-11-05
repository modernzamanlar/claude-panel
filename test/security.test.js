// Güvenlik denetimi (SEC-01…06) düzeltmelerinin testleri.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
process.env.CLAUDE_PANEL_CLAUDE_BIN = path.join(__dirname, 'fake-claude.js');
const { Runner, openRemoteTerminal, openLoginTerminal } = require('../src/main/runner');

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const fakeShell = () => { const opened = []; return { opened, openPath: async p => { opened.push(p); return ''; } }; };

test('SEC-02: Uzaktan Kontrol — başlıktaki satır sonu komut satırı oluşturamaz', async () => {
  const sh = fakeShell();
  await openRemoteTerminal(sh, { sessionId: ID, cwd: os.tmpdir(), name: 'Masum başlık\nrm -rf ~ & calc.exe "$(whoami)" `id`' });
  const body = fs.readFileSync(sh.opened[0], 'utf8');
  const lines = body.split(/\r?\n/);
  assert.ok(!lines.some(l => /^(rm|calc|whoami|id)\b/.test(l.trim())), 'başlıktan yeni komut satırı doğmaz:\n' + body);
  const labelLine = lines.find(l => l.includes('Uzaktan Kontrol:'));
  assert.ok(!/[$`"&|<>\\]/.test(labelLine.replace(/^echo '|'$/g, '')), 'kabuk metakarakterleri ayıklanır: ' + labelLine);
  assert.ok(body.includes('Masum başlık rm -rf'), 'başlık tek satırda, zararsız karakterlerle');
});

test('SEC-02: Uzaktan Kontrol — geçersiz oturum kimliği ve klasör reddedilir', async () => {
  const sh = fakeShell();
  await assert.rejects(openRemoteTerminal(sh, { sessionId: '..\\..\\x', cwd: os.tmpdir(), name: 'a' }), /oturum kimliği/);
  await assert.rejects(openRemoteTerminal(sh, { sessionId: ID, cwd: path.join(os.tmpdir(), 'yok-' + Date.now()), name: 'a' }), /bulunamadı/);
  const f = path.join(os.tmpdir(), 'dosya-' + Date.now()); fs.writeFileSync(f, 'x');
  await assert.rejects(openRemoteTerminal(sh, { sessionId: ID, cwd: f, name: 'a' }), /bulunamadı/, 'dosya klasör yerine geçemez');
  assert.strictEqual(sh.opened.length, 0);
});

test('SEC-06: geçici betikler rastgele, özel klasörde ve her seferinde yeni', async () => {
  const sh = fakeShell();
  await openLoginTerminal(sh); await openLoginTerminal(sh);
  const [a, b] = sh.opened;
  assert.notStrictEqual(path.dirname(a), path.dirname(b));
  assert.ok(path.dirname(a).startsWith(path.join(os.tmpdir(), 'claude-panel-')));
  if (process.platform !== 'win32') assert.strictEqual(fs.statSync(a).mode & 0o077, 0, 'yalnızca kullanıcı okuyabilir');
});

test('SEC-01/03/04: run:start argümanları ana süreçte doğrulanır', async () => {
  const r = new Runner(() => {});
  const base = { newSession: true, cwd: os.tmpdir(), text: 'x', ephemeral: true };
  await assert.rejects(r.start({ ...base, permissionMode: 'bypassPermissions --dangerously' }), /izin modu/);
  await assert.rejects(r.start({ ...base, model: 'opus & calc' }), /model/);
  await assert.rejects(r.start({ ...base, newSession: false, sessionId: '../../etc' }), /oturum kimliği/);
  await assert.rejects(r.start({ ...base, cwd: '/olmayan/klasor' }), /bulunamadı/);
});
