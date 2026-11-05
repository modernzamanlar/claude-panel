// node --test test/  → oturum ayrıştırıcısının temel davranışı
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { summarize, loadSession, prettyModel } = require('../src/main/sessions');

function fixture(lines) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-test-'));
  const file = path.join(dir, '11111111-2222-3333-4444-555555555555.jsonl');
  fs.writeFileSync(file, lines.map(l => JSON.stringify(l)).join('\n') + '\n');
  return file;
}
const user = (text, extra = {}) => ({ type: 'user', message: { role: 'user', content: text }, timestamp: '2026-11-04T10:00:00Z', cwd: '/tmp/proje', ...extra });
const asst = (content, extra = {}) => ({ type: 'assistant', message: { role: 'assistant', model: 'claude-opus-5-5', content, usage: { input_tokens: 10, cache_read_input_tokens: 1000, cache_creation_input_tokens: 0, output_tokens: 5 } }, timestamp: '2026-11-04T10:01:00Z', ...extra });

test('özet: başlık, proje, model, bağlam', async () => {
  const f = fixture([
    user('<command-name>/clear</command-name>'),
    user('sitemap hatasını düzelt'),
    asst([{ type: 'text', text: 'Bakıyorum' }]),
    { type: 'custom-title', customTitle: 'Sitemap hatası' },
  ]);
  const s = await summarize(f);
  assert.equal(s.title, 'Sitemap hatası');
  assert.equal(s.cwd, '/tmp/proje');
  assert.equal(s.model, 'Opus 5.5');
  assert.equal(s.ctxTokens, 1015);
});

test('özet: başlık yoksa ilk gerçek kullanıcı mesajı', async () => {
  const f = fixture([user('<local-command-stdout>x</local-command-stdout>'), user('ana sayfayı yenile')]);
  assert.equal((await summarize(f)).title, 'ana sayfayı yenile');
});

test('mesajlar: araç sonuçları eşleşir, yan zincir ve meta atlanır, çıktılar toplanır', async () => {
  const f = fixture([
    user('dosyayı yaz'),
    user('gizli', { isMeta: true }),
    asst([{ type: 'text', text: 'Yazıyorum' }, { type: 'tool_use', id: 't1', name: 'Write', input: { file_path: '/tmp/proje/a.txt', content: 'x' } }]),
    { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }] } },
    asst([{ type: 'text', text: 'alt ajan' }], { isSidechain: true }),
    asst([{ type: 'text', text: 'Bitti' }]),
  ]);
  const d = await loadSession(f);
  assert.equal(d.msgs.length, 2);
  assert.equal(d.msgs[0].t, 'dosyayı yaz');
  const tools = d.msgs[1].b.filter(b => b.t === 'tool');
  assert.equal(tools[0].n, 'Write');
  assert.equal(tools[0].o, 'ok');
  assert.deepEqual(d.msgs[1].b.filter(b => b.t === 'text').map(b => b.v), ['Yazıyorum', 'Bitti']);
  assert.equal(d.outputs[0].path, '/tmp/proje/a.txt');
});

test('mesajlar: uzun oturumda son N tur tutulur', async () => {
  const lines = [];
  for (let i = 0; i < 10; i++) { lines.push(user('soru ' + i)); lines.push(asst([{ type: 'text', text: 'cevap ' + i }])); }
  const d = await loadSession(fixture(lines), 3);
  assert.equal(d.turns, 10);
  assert.equal(d.skipped, 7);
  assert.equal(d.msgs[0].t, 'soru 7');
});

test('model adı', () => {
  assert.equal(prettyModel('claude-sonnet-5-5'), 'Sonnet 5.5');
  assert.equal(prettyModel('claude-opus-5'), 'Opus 5');
});

test('tilde: yalnızca ev klasörünün kendisi ve altı kısaltılır', () => {
  const os = require('os'), path = require('path'); const { tilde } = require('../src/main/sessions');
  const H = os.homedir();
  assert.strictEqual(tilde(H), '~');
  assert.strictEqual(tilde(path.join(H, 'Desktop')), '~' + path.sep + 'Desktop');
  assert.strictEqual(tilde(H + '2' + path.sep + 'x'), H + '2' + path.sep + 'x');
});
