#!/usr/bin/env node
// Sohbet görünümü için kısaltılmış, anonim oturum kaydı (gerçek Claude Code .jsonl biçimiyle aynı alanlar):
// düşünme (metinli + yalnız signature), TodoWrite ×2, arka planda alt ajan (subagents/agent-*.jsonl + meta.json),
// arka plan Bash komutu ve ikisinin <task-notification> bildirimleri (queued_command eki).
// Kullanım: node test/fixtures/sohbet-gorunumu.js <projects klasörü> [cwd]  → oturum dosyasının yolu
const fs = require('fs'), path = require('path');
const UUID = 'c0ffee00-1111-4222-8333-444455556666';
function lines(cwd) {
  let n = 0; const ts = () => new Date(Date.UTC(2026, 10, 6, 9, 0, n++)).toISOString();
  const base = o => ({ cwd, sessionId: UUID, timestamp: ts(), ...o });
  const A = content => base({ type: 'assistant', message: { role: 'assistant', model: 'claude-opus-5-5', content } });
  const R = (id, content, toolUseResult) => base({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content }] }, toolUseResult });
  const N = s => base({ type: 'attachment', attachment: { type: 'queued_command', prompt: s } });
  const todos = st => ({ todos: [
    { content: 'Kayıtları oku', activeForm: 'Kayıtlar okunuyor', status: st[0] },
    { content: 'Alt ajanı başlat', activeForm: 'Alt ajan başlatılıyor', status: st[1] },
    { content: 'Sonucu yaz', activeForm: 'Sonuç yazılıyor', status: st[2] }] });
  return [
    base({ type: 'user', message: { role: 'user', content: 'Görünüm geçmiş testi' } }),
    A([{ type: 'thinking', thinking: 'Geçmiş kaydı için önce görev listesini yazmalıyım.', signature: 'c2ln' }]),
    A([{ type: 'thinking', thinking: '', signature: 'c2ln' }]),
    A([{ type: 'tool_use', id: 'toolu_fx_td1', name: 'TodoWrite', input: todos(['in_progress', 'pending', 'pending']) }]),
    R('toolu_fx_td1', 'Todos have been modified successfully.'),
    A([{ type: 'tool_use', id: 'toolu_fx_ag1', name: 'Agent', input: { description: 'Kayıtları tara', subagent_type: 'Explore', prompt: 'Kayıtlara bak', run_in_background: true } }]),
    R('toolu_fx_ag1', 'Async agent launched successfully.', { status: 'async_launched', agentId: 'afix1', description: 'Kayıtları tara' }),
    A([{ type: 'tool_use', id: 'toolu_fx_bg1', name: 'Bash', input: { command: 'npm run build', description: 'Derleme', run_in_background: true } }]),
    R('toolu_fx_bg1', 'Command running in background with ID: bfix1. Output is being written to: /tmp/bfix1.output', { stdout: '', stderr: '', backgroundTaskId: 'bfix1' }),
    A([{ type: 'tool_use', id: 'toolu_fx_td2', name: 'TodoWrite', input: todos(['completed', 'in_progress', 'pending']) }]),
    R('toolu_fx_td2', 'Todos have been modified successfully.'),
    A([{ type: 'text', text: 'İkisi de arka planda çalışıyor.' }]),
    N('<task-notification>\n<task-id>bfix1</task-id>\n<tool-use-id>toolu_fx_bg1</tool-use-id>\n<status>completed</status>\n<summary>Background command "Derleme" completed (exit code 0)</summary>\n</task-notification>'),
    N('<task-notification>\n<task-id>afix1</task-id>\n<tool-use-id>toolu_fx_ag1</tool-use-id>\n<status>completed</status>\n<summary>Agent "Kayıtları tara" completed</summary>\n<result>Üç kayıt buldum.</result>\n<usage><total_tokens>900</total_tokens><tool_uses>3</tool_uses><duration_ms>4100</duration_ms></usage>\n</task-notification>'),
    A([{ type: 'text', text: 'Derleme ve alt ajan bitti.' }]),
  ];
}
function subLines(cwd) {
  let n = 0; const ts = () => new Date(Date.UTC(2026, 10, 6, 9, 1, n++)).toISOString();
  const base = o => ({ isSidechain: true, agentId: 'afix1', cwd, sessionId: UUID, timestamp: ts(), ...o });
  return [
    base({ type: 'user', message: { role: 'user', content: 'Kayıtlara bak' } }),
    base({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Kayıtlara **bakıyorum**.' }] } }),
    base({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_fx_s1', name: 'Grep', input: { pattern: 'kayıt', path: 'src' } }] } }),
    base({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_fx_s1', content: 'src/a.js:1: kayıt' }] } }),
    base({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Üç kayıt buldum.' }] } }),
  ];
}
const jl = a => a.map(o => JSON.stringify(o)).join('\n') + '\n';
// projectsDir/<proje>/<UUID>.jsonl ve projectsDir/<proje>/<UUID>/subagents/agent-afix1.{jsonl,meta.json}
function write(projectsDir, cwd = process.cwd()) {
  const dir = path.join(projectsDir, 'sohbet-gorunumu-fixture');
  const sub = path.join(dir, UUID, 'subagents');
  fs.mkdirSync(sub, { recursive: true });
  const file = path.join(dir, UUID + '.jsonl');
  fs.writeFileSync(file, jl(lines(cwd)));
  fs.writeFileSync(path.join(sub, 'agent-afix1.jsonl'), jl(subLines(cwd)));
  fs.writeFileSync(path.join(sub, 'agent-afix1.meta.json'), JSON.stringify({ agentType: 'Explore', description: 'Kayıtları tara', toolUseId: 'toolu_fx_ag1' }));
  return file;
}
module.exports = { UUID, write, lines, subLines };
if (require.main === module && process.argv[2]) console.log(write(process.argv[2], process.argv[3])); // test çalıştırıcısı dosyayı argümansız açarsa bir şey yazmaz
