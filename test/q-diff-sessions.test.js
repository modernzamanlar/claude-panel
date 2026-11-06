// sessions.js: kayıtlı oturumda düzenleme araçlarının fark verisi (tool.d) — Edit, MultiEdit, Write, NotebookEdit.
// Gerçek ~/.claude ve ~/.claude-panel'e hiç dokunulmaz: HOME ve CLAUDE_PANEL_HOME modül yüklenmeden geçici klasöre çevrilir.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cp-qds-')));
const EV = path.join(TMP, 'ev');
fs.mkdirSync(EV, { recursive: true });
process.env.HOME = EV; process.env.USERPROFILE = EV;
process.env.CLAUDE_PANEL_HOME = path.join(TMP, 'panel');
const { loadSession, SessionLoader } = require('../src/main/sessions');
const diffView = require('../src/renderer/diff');
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const asst = content => ({ type: 'assistant', timestamp: 'T2', message: { role: 'assistant', content } });
const use = (id, name, input) => ({ type: 'tool_use', id, name, input });
function file(lines) {
  const f = path.join(TMP, 'aaaaaaaa-0000-0000-0000-000000000001.jsonl');
  fs.writeFileSync(f, lines.map(l => JSON.stringify(l)).join('\n') + '\n');
  return f;
}

test('loadSession: düzenleme araçlarına fark verisi eklenir, diğerlerine eklenmez; büyük içerik kısaltılır', async () => {
  const big = 'satır\n'.repeat(1000);
  const f = file([
    { type: 'user', timestamp: 'T1', message: { role: 'user', content: 'düzenle' } },
    asst([
      use('e1', 'Edit', { file_path: '/a.js', old_string: 'eski()\n', new_string: 'yeni()\n' }),
      use('e2', 'MultiEdit', { file_path: '/b.js', edits: [{ old_string: 'a', new_string: 'b' }, { old_string: 'c', new_string: '' }] }),
      use('e3', 'Write', { file_path: '/c.txt', content: big }),
      use('e4', 'NotebookEdit', { notebook_path: '/n.ipynb', new_source: 'print(1)' }),
      use('e5', 'Read', { file_path: '/a.js' }),
      use('e6', 'Edit', { file_path: '/bos.js' }),
    ]),
    { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'e1', content: 'güncellendi' }] } },
  ]);
  const d = await loadSession(f);
  const b = d.msgs[1].b;
  assert.deepStrictEqual(b[0], { t: 'tool', n: 'Edit', a: '/a.js', o: 'güncellendi', d: { e: [{ o: 'eski()\n', n: 'yeni()\n' }] } });
  assert.deepStrictEqual(b[1].d, { e: [{ o: 'a', n: 'b' }, { o: 'c', n: '' }] });
  assert.strictEqual(b[2].d.cut, true);
  assert.ok(b[2].d.e[0].n.length <= 4000 && b[2].d.e[0].n.split('\n').length <= 200, 'Write içeriği sınırlı');
  assert.deepStrictEqual(b[3].d, { e: [{ o: '', n: 'print(1)' }] });
  assert.ok(!('d' in b[4]) && !('d' in b[5]), 'Read ve girdisiz Edit fark verisi taşımaz');
  // Arayüzün çizeceği fark: +1 −1
  const r = diffView.html(b[0].d);
  assert.deepStrictEqual([r.added, r.removed], [1, 1]);
  // Artımlı yükleyici aynı sonucu verir
  assert.deepStrictEqual(await new SessionLoader().load(f), d);
});
