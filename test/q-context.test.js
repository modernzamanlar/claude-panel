// runner.contextUsage: oturumun gerçek bağlam kullanımı (`claude -p /context`), girdi denetimi ve hata yolları.
const { test, afterEach } = require('node:test');
const assert = require('node:assert');
const os = require('os');
const path = require('path');
const fs = require('fs');

const FAKE = path.join(__dirname, 'fake-claude.js');
process.env.CLAUDE_PANEL_CLAUDE_BIN = FAKE;
const { contextUsage, _test } = require('../src/main/runner');
const { deps } = _test;
const REAL = { ...deps };
const ENV0 = { ...process.env };
const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
afterEach(() => { Object.assign(deps, REAL); Object.assign(process.env, ENV0); _test.reset(''); });
_test.reset('');

test('contextUsage: sahte CLI ile rapor ayrıştırılır; oturumu değiştirmeyen sabit argümanlar kullanılır', async () => {
  const calls = [];
  deps.execFile = (file, args, o, cb) => { calls.push({ file, args, o }); return REAL.execFile(file, args, o, cb); };
  const r = await contextUsage(ID, os.tmpdir());
  assert.strictEqual(r.window, 1000000);
  assert.strictEqual(r.total, 40800);
  assert.ok(r.categories.some(c => c.name === 'Messages'));
  assert.ok(Math.abs(r.at - Date.now()) < 5000);
  assert.deepStrictEqual(calls[0].args, ['-p', '/context', '--resume', ID, '--no-session-persistence', '--output-format', 'json']);
  assert.strictEqual(calls[0].o.cwd, os.tmpdir());
  assert.ok(calls[0].o.timeout > 0 && calls[0].o.maxBuffer >= 1024 * 1024);
});

test('contextUsage: seçili model --model ile geçer; stdin hemen kapatılır', async () => {
  let ended = 0, args;
  deps.execFile = (file, a, o, cb) => { args = a; setImmediate(() => cb(null, fs.readFileSync(path.join(__dirname, 'fixtures', 'context-haiku.json'), 'utf8'), '')); return { stdin: { end: () => ended++ } }; };
  const r = await contextUsage(ID, os.tmpdir(), { model: 'claude-opus-5-5[1m]' });
  assert.deepStrictEqual(args.slice(-2), ['--model', 'claude-opus-5-5[1m]']);
  assert.strictEqual(ended, 1);
  assert.strictEqual(r.window, 200000);
});

test('contextUsage: geçersiz kimlik, klasör ve model süreç başlatmadan reddedilir', async () => {
  let n = 0; deps.execFile = () => { n++; };
  await assert.rejects(contextUsage('../x', os.tmpdir()), /Geçersiz oturum kimliği/);
  await assert.rejects(contextUsage(ID, path.join(os.tmpdir(), 'yok-' + Date.now())), /Çalışma klasörü bulunamadı/);
  await assert.rejects(contextUsage(ID, os.tmpdir(), { model: 'x; rm -rf' }), /Geçersiz model/);
  assert.strictEqual(n, 0);
});

test('contextUsage: claude bulunamazsa açık hata', async () => {
  delete process.env.CLAUDE_PANEL_CLAUDE_BIN;
  deps.platform = 'win32'; process.env.PATH = fs.mkdtempSync(path.join(os.tmpdir(), 'qc-'));
  try { await assert.rejects(contextUsage(ID, os.tmpdir()), /claude komutu bulunamadı/); }
  finally { fs.rmSync(process.env.PATH, { recursive: true, force: true }); }
});

test('contextUsage: CLI hatası stderr ile, stderr yoksa hata iletisiyle, hiçbiri yoksa genel iletiyle döner', async () => {
  const run = (err, out, errOut) => { deps.execFile = (f, a, o, cb) => { setImmediate(() => cb(err, out, errOut)); }; return contextUsage(ID, os.tmpdir()); };
  await assert.rejects(run(new Error('exit 1'), '', 'No conversation found with session ID: x\n'), /^Error: No conversation found with session ID: x$/);
  await assert.rejects(run(new Error('zaman aşımı'), undefined, ''), /zaman aşımı/);
  await assert.rejects(run(null, '{"result":"Unknown command"}', ''), /Bağlam bilgisi okunamadı/);
});
