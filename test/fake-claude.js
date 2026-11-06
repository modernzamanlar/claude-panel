#!/usr/bin/env node
// Testler için sahte `claude` CLI: stream-json olaylarını ve izin (control_request) protokolünü
// gerçek CLI'ye benzer sırayla üretir. Ortam değişkenleri:
//   FAKE_DELAY=ms  FAKE_PERM=1 (Bash için izin ister)  FAKE_ASK=1 (AskUserQuestion)  FAKE_AUTH_FAIL=1  FAKE_LOGGED_OUT=1
//   FAKE_SCENARIO=gorunum (ya da mesajda [gorunum]): düşünme, TodoWrite, alt ajan (parent_tool_use_id) ve arka plan Bash görevleri (stop_task ile durur;
//   FAKE_BG_MS sonra kendiliğinden biter)
//   FAKE_AUTOCOMPACT=1 ya da mesajda "[oto-sıkıştır]" (tur ortasında otomatik sıkıştırma). "/compact" mesajı elle sıkıştırma olaylarını üretir.
// --resume-session-at <uuid>: gerçek CLI gibi --resume ister; panel her zaman --fork-session ile verir (yoksa hata).
//   Yanıt metni devam noktasının ilk 8 karakterini içerir: "(… noktasından)".
// rewind_files kontrol isteği (kod geri sarma): FAKE_REWIND=<json dosyası> {"<kullanıcı mesajı uuid>": {"<mutlak yol>": "eski içerik"}}.
//   Gerçek CLI gibi CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING yoksa "File rewinding is not enabled." döner; dry_run dosya yazmaz.
// --add-dir <klasör> (birden çok olabilir): yanıt metnine "(ek klasör: N)" eklenir.
// --worktree <ad>: gerçek CLI gibi git deposu ister (.git yoksa çıkış 1), <cwd>/.claude/worktrees/<ad> klasörünü açar ve init'te o cwd'yi bildirir.
const crypto = require('crypto');
const args = process.argv.slice(2);
if (args[0] === 'auth' && args[1] === 'status') { console.log(JSON.stringify({ loggedIn: process.env.FAKE_LOGGED_OUT ? false : true, authMethod: 'fake' })); process.exit(0); }
if (args[0] === 'mcp' && args[1] === 'list') { console.log('Checking MCP server health…\n\nfake-docs: https://example.com/mcp - ✔ Connected\nfake-voice: https://voice.example/mcp - Needs authentication'); process.exit(0); }
const arg = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
// `claude -p /context --resume <id> --no-session-persistence --output-format json`: gerçek CLI'den alınmış rapor (model çağrılmaz)
if (args[0] === '-p' && args[1] === '/context') {
  const r = require('./fixtures/context-opus-1m.json');
  console.log(JSON.stringify({ ...r, session_id: arg('--resume'), args }));
  process.exit(0);
}
let sid = arg('--session-id') || arg('--resume') || crypto.randomUUID();
if (args.includes('--fork-session')) sid = crypto.randomUUID();
const at = arg('--resume-session-at');
if (at && (!arg('--resume') || !args.includes('--fork-session'))) { console.error('--resume-session-at için --resume ve --fork-session gerekli'); process.exit(3); }
const addDirs = args.flatMap((a, i) => (a === '--add-dir' && args[i + 1] ? [args[i + 1]] : []));
const wt = arg('--worktree');
let cwd = process.cwd();
if (wt) {
  const fs = require('fs'), path = require('path');
  if (!fs.existsSync(path.join(cwd, '.git'))) { console.error(`Error: Can only use --worktree in a git repository, but ${cwd} is not a git repository.`); process.exit(1); }
  cwd = path.join(cwd, '.claude', 'worktrees', wt); fs.mkdirSync(cwd, { recursive: true });
}
const delay = +(process.env.FAKE_DELAY || 80);
const out = o => process.stdout.write(JSON.stringify(o) + '\n');
const wait = ms => new Promise(r => setTimeout(r, ms));
process.on('SIGINT', () => process.exit(130));

const waiters = new Map(); // request_id -> resolve
let interrupted = false, started = false, buf = '';
process.stdin.on('data', d => {
  buf += d; let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1); if (!line.trim()) continue;
    const m = JSON.parse(line);
    if (m.type === 'user' && !started) { started = true; turn(m).catch(e => { console.error(e); process.exit(2); }); }
    else if (m.type === 'control_response') { const w = waiters.get(m.response.request_id); if (w) { waiters.delete(m.response.request_id); if (m.response.response && m.response.response.interrupt) interrupted = true; w(m.response.response); } }
    else if (m.type === 'control_request' && m.request.subtype === 'stop_task') {
      out({ type: 'control_response', response: { subtype: 'success', request_id: m.request_id, response: {} } });
      const t = bgTasks.get(m.request.task_id); if (t) t('stopped');
    }
    else if (m.type === 'control_request' && m.request.subtype === 'rewind_files') rewindFiles(m);
    else if (m.type === 'control_request' && m.request.subtype === 'interrupt') {
      interrupted = true;
      out({ type: 'control_response', response: { subtype: 'success', request_id: m.request_id } });
      for (const [id, w] of waiters) { out({ type: 'control_cancel_request', request_id: id }); w({ behavior: 'deny', message: 'interrupted' }); }
    }
  }
});
process.stdin.on('end', () => setTimeout(() => process.exit(0), 20));

function rewindFiles(m) {
  const fs = require('fs'), r = m.request, ok = response => out({ type: 'control_response', response: { subtype: 'success', request_id: m.request_id, response } });
  if (!process.env.CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING) return ok({ canRewind: false, error: 'File rewinding is not enabled.' });
  let map = {}; try { map = JSON.parse(fs.readFileSync(process.env.FAKE_REWIND, 'utf8')); } catch {}
  const files = map[r.user_message_id];
  if (!files) return r.dry_run ? ok({ canRewind: false, error: 'No file checkpoint found for this message.' })
    : out({ type: 'control_response', response: { subtype: 'error', request_id: m.request_id, error: 'No file checkpoint found for this message.' } });
  if (r.dry_run) return ok({ canRewind: true, filesChanged: Object.keys(files), insertions: Object.keys(files).length, deletions: Object.keys(files).length });
  for (const [f, body] of Object.entries(files)) fs.writeFileSync(f, body);
  ok({ canRewind: true, skippedLinks: 0 });
}
function ask(tool_name, input) {
  const request_id = crypto.randomUUID();
  out({ type: 'control_request', request_id, request: { subtype: 'can_use_tool', tool_name, input, description: input.description || '', permission_suggestions: [{ type: 'addRules', rules: [{ toolName: tool_name, ruleContent: input.command || '' }], behavior: 'allow', destination: 'localSettings' }] } });
  return new Promise(r => waiters.set(request_id, r));
}
// Gerçek CLI (2.1.318) gibi: hızlı mod yalnızca --fast-mode on ile istenir; bu hesapta ek kullanım kapalı olduğundan kapalı kalır
const fast = () => (arg('--fast-mode') === 'on' ? { fast_mode_state: 'off', fast_mode_disabled_reason: 'extra_usage_disabled' } : { fast_mode_state: 'off', fast_mode_disabled_reason: 'sdk_opt_in_required' });
// compact_boundary: akışta compact_metadata (snake_case) taşır
const compactBoundary = (trigger, pre, post) => out({ type: 'system', subtype: 'compact_boundary', session_id: sid, uuid: crypto.randomUUID(), compact_metadata: { trigger, pre_tokens: pre, post_tokens: post, duration_ms: 1200 } });
function finish(result, extra = {}) { out({ type: 'result', subtype: 'success', is_error: false, result, total_cost_usd: 0.0123, session_id: sid, args, ...fast(), modelUsage: { 'claude-opus-5-5': { inputTokens: 5, outputTokens: 20, cacheReadInputTokens: 42000, contextWindow: 1000000, maxOutputTokens: 64000 }, 'claude-haiku-4-5-20251001': { inputTokens: 300, outputTokens: 10, contextWindow: 200000 } }, ...extra }); }

async function turn(msg) {
  const content = msg.message.content;
  const text = (content.find(c => c.type === 'text') || {}).text || '';
  const images = content.filter(c => c.type === 'image').length;
  out({ type: 'system', subtype: 'init', session_id: sid, cwd, model: 'claude-opus-5-5', permissionMode: arg('--permission-mode') || 'default', mcp_servers: [{ name: 'fake-mcp', status: 'connected' }, { name: 'fake-voice', status: 'needs-auth' }], tools: [],
    slash_commands: ['compact', 'context', 'usage', 'clear', 'doctor', 'sahte-skill', 'sahte-komut'], skills: ['sahte-skill'], terminal_slash_commands: ['doctor'] });
  // Gerçek CLI (2.1.318) init'ten hemen sonra açıklamalı komut listesini de gönderir
  out({ type: 'system', subtype: 'commands_changed', session_id: sid, commands: [
    { name: 'compact', description: 'Free up context', argumentHint: '<optional>', builtin: true },
    { name: 'context', description: 'Show context usage', builtin: true },
    { name: 'clear', description: 'Start a new session', aliases: ['reset', 'new'], builtin: true },
    { name: 'sahte-skill', description: 'Sahte CLI skill açıklaması (user)' },
    { name: 'sahte-komut', description: 'Sahte proje komutu (project)', argumentHint: '<ad>' },
  ] });
  // Yerel komut (/compact, /context): model çağrılmaz, çıktı <local-command-stdout> ile gelir
  const lc = /^\/(compact|context)\b/.exec(text);
  if (lc) {
    out({ type: 'user', session_id: sid, message: { role: 'user', content: '<local-command-stdout>' + (lc[1] === 'compact' ? 'Compacted' : '## Context Usage') + '</local-command-stdout>' } });
    finish(''); return;
  }
  if (process.env.FAKE_AUTH_FAIL) {
    out({ type: 'assistant', session_id: sid, message: { model: '<synthetic>', content: [{ type: 'text', text: 'Failed to authenticate: OAuth session expired' }] } });
    out({ type: 'result', subtype: 'success', is_error: true, result: 'Failed to authenticate', terminal_reason: 'api_error', session_id: sid });
    return process.exit(1);
  }
  if (text.trim() === '/compact') { // elle sıkıştırma: model yanıtı yok, num_turns 0, maliyet sayacı birikimli
    out({ type: 'system', subtype: 'status', status: 'compacting', session_id: sid });
    await wait(delay * 15); // gerçek CLI'de sıkıştırma birkaç saniye sürer (2.1.318: duration_ms 6326)
    out({ type: 'system', subtype: 'status', status: null, compact_result: 'success', session_id: sid });
    compactBoundary('manual', 42025, 9100);
    out({ type: 'user', session_id: sid, isReplay: true, message: { role: 'user', content: '<local-command-stdout>Compacted </local-command-stdout>' } });
    finish('', { num_turns: 0, total_cost_usd: 0.0151, usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } });
    return;
  }
  const reply = `Aldım: "${text.split('\n')[0]}"${images ? ` (+${images} görsel)` : ''}${at ? ` (${at.slice(0, 8)} noktasından)` : ''}${addDirs.length ? ` (ek klasör: ${addDirs.length})` : ''}. Panelden yazıyorum.`;
  out({ type: 'stream_event', session_id: sid, event: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } } });
  for (const part of reply.match(/.{1,6}/g)) { out({ type: 'stream_event', session_id: sid, event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: part } } }); await wait(delay / 4); }
  // Gerçek CLI gibi aynı mesaj kimliği her içerik bloğunda tekrarlanır (usage da): toplamda bir kez sayılmalı
  const mid = 'msg_' + crypto.randomUUID().slice(0, 8);
  out({ type: 'assistant', session_id: sid, message: { id: mid, model: 'claude-opus-5-5', content: [{ type: 'text', text: reply }], usage: { input_tokens: 5, cache_read_input_tokens: 42000, output_tokens: 20 } } });
  if (process.env.FAKE_AUTOCOMPACT || text.includes('[oto-sıkıştır]')) { out({ type: 'system', subtype: 'status', status: 'compacting', session_id: sid }); await wait(delay * 15); compactBoundary('auto', 168000, 21000); }
  // Gerçek CLI her turda kalan kullanımı bildirir
  out({ type: 'rate_limit_event', session_id: sid, rate_limit_info: { status: 'allowed', resetsAt: Math.floor(Date.now() / 1000) + 3 * 86400, rateLimitType: 'seven_day', unifiedWindows: { seven_day: { utilization: 0.73, resetsAt: Math.floor(Date.now() / 1000) + 3 * 86400 }, five_hour: { utilization: 0.2, resetsAt: Math.floor(Date.now() / 1000) + 7200 } } } });
  await wait(delay);
  if (process.env.FAKE_SCENARIO === 'gorunum' || text.includes('[gorunum]')) await scenario();
  if (process.env.FAKE_ASK) {
    const input = { questions: [{ question: 'Hangi rengi kullanalım?', header: 'Renk', multiSelect: false, options: [{ label: 'Turuncu', description: 'Claude rengi' }, { label: 'Mavi', description: 'klasik' }] }] };
    out({ type: 'assistant', session_id: sid, message: { content: [{ type: 'tool_use', id: 'ask1', name: 'AskUserQuestion', input }] } });
    const r = await ask('AskUserQuestion', input);
    out({ type: 'user', session_id: sid, message: { content: [{ type: 'tool_result', tool_use_id: 'ask1', content: r.behavior === 'allow' ? 'Cevaplar: ' + JSON.stringify(r.updatedInput.answers) : 'Reddedildi', is_error: r.behavior !== 'allow' } ] } });
  }
  const input = { command: 'echo ok', description: 'Test komutu' };
  out({ type: 'assistant', session_id: sid, message: { model: 'claude-opus-5-5', content: [{ type: 'tool_use', id: 'tu1', name: 'Bash', input }] } });
  let allowed = true, why = '';
  if (process.env.FAKE_PERM) { const r = await ask('Bash', input); allowed = r.behavior === 'allow'; why = r.message || ''; if (r.updatedPermissions) out({ type: 'system', subtype: 'perm_rules', rules: r.updatedPermissions }); }
  if (interrupted) { out({ type: 'user', session_id: sid, message: { content: [{ type: 'text', text: '[Request interrupted by user]' }] } }); finish('', { subtype: 'error_during_execution', is_error: false }); return process.exit(0); }
  await wait(delay * 3);
  out({ type: 'user', session_id: sid, message: { content: [{ type: 'tool_result', tool_use_id: 'tu1', content: allowed ? 'ok' : 'İzin verilmedi: ' + why, is_error: !allowed }] } });
  out({ type: 'assistant', session_id: sid, message: { model: 'claude-opus-5-5', content: [{ type: 'text', text: allowed ? '**Bitti.** `echo ok` çalıştı.' : 'Komut reddedildi, başka yol deneyeceğim.' }] } });
  finish(allowed ? 'Bitti.' : 'Reddedildi.');
  if (bgTasks.size) out({ type: 'system', subtype: 'background_tasks_changed', session_id: sid, tasks: [...bgTasks.keys()].map(task_id => ({ task_id, task_type: 'local_bash' })) });
  // Gerçek CLI gibi: stdin kapanana kadar bekle (panel result görünce kapatır)
}

// ---------- FAKE_SCENARIO=gorunum ----------
const bgTasks = new Map(); // task_id -> bitir(durum)
const A = (content, parent) => out({ type: 'assistant', session_id: sid, parent_tool_use_id: parent || null, message: { model: 'claude-opus-5-5', content } });
const U = (tool_use_id, content, tur, parent) => out({ type: 'user', session_id: sid, parent_tool_use_id: parent || null, message: { content: [{ type: 'tool_result', tool_use_id, content }] }, tool_use_result: tur });
const S = o => out({ type: 'system', session_id: sid, ...o });
const bgList = () => S({ subtype: 'background_tasks_changed', tasks: [...bgTasks.keys()].map(task_id => ({ task_id, task_type: 'local_bash' })) });
function bgTask(id, tu, desc, autoMs) {
  let done = false;
  const end = st => { if (done) return; done = true; bgTasks.delete(id);
    S({ subtype: 'task_updated', task_id: id, patch: { status: st === 'stopped' ? 'killed' : st, end_time: Date.now() } });
    S({ subtype: 'task_notification', task_id: id, tool_use_id: tu, status: st, summary: st === 'completed' ? `Background command "${desc}" completed (exit code 0)` : desc });
    bgList();
  };
  bgTasks.set(id, end); bgList();
  S({ subtype: 'task_started', task_id: id, tool_use_id: tu, description: desc, is_backgrounded: true, task_type: 'local_bash' });
  U(tu, `Command running in background with ID: ${id}. Output is being written to: /tmp/${id}.output`, { stdout: '', stderr: '', backgroundTaskId: id });
  setTimeout(() => end('completed'), autoMs);
}
async function scenario() {
  const think = 'Kullanıcı görünümü denetlemek istiyor. Önce görev listesini yazayım, sonra bir alt ajanla dosyalara bakıp arka planda izleyiciyi başlatayım.';
  out({ type: 'stream_event', session_id: sid, event: { type: 'content_block_start', index: 1, content_block: { type: 'thinking', thinking: '' } } });
  for (const part of think.match(/.{1,12}/g)) { out({ type: 'stream_event', session_id: sid, event: { type: 'content_block_delta', index: 1, delta: { type: 'thinking_delta', thinking: part } } }); await wait(delay / 4); }
  A([{ type: 'thinking', thinking: think, signature: 'sig' }]);
  const todos = st => ({ todos: [
    { content: 'Görev listesini çiz', activeForm: 'Görev listesi çiziliyor', status: st[0] },
    { content: 'Alt ajanla dosyaları tara', activeForm: 'Dosyalar taranıyor', status: st[1] },
    { content: 'İzleyiciyi arka planda başlat', activeForm: 'İzleyici başlatılıyor', status: st[2] }] });
  A([{ type: 'tool_use', id: 'td1', name: 'TodoWrite', input: todos(['in_progress', 'pending', 'pending']) }]); await wait(delay);
  U('td1', 'Todos have been modified successfully.');
  A([{ type: 'tool_use', id: 'td2', name: 'TodoWrite', input: todos(['completed', 'in_progress', 'pending']) }]); await wait(delay);
  U('td2', 'Todos have been modified successfully.');
  // Ön planda alt ajan: mesajları parent_tool_use_id ile gelir
  A([{ type: 'tool_use', id: 'ag1', name: 'Agent', input: { description: 'Kaynak dosyaları tara', subagent_type: 'Explore', prompt: 'src/ altında TODO ara' } }]);
  S({ subtype: 'task_started', task_id: 'afake1', tool_use_id: 'ag1', description: 'Kaynak dosyaları tara', is_backgrounded: false, task_type: 'local_agent' });
  await wait(delay);
  A([{ type: 'text', text: 'src/ klasöründe **TODO** arıyorum.' }], 'ag1');
  A([{ type: 'tool_use', id: 'sub1', name: 'Grep', input: { pattern: 'TODO', path: 'src' } }], 'ag1'); await wait(delay * 2);
  U('sub1', 'src/app.js:12: // TODO', null, 'ag1');
  A([{ type: 'tool_use', id: 'sub2', name: 'Read', input: { file_path: 'src/app.js' } }], 'ag1'); await wait(delay * 2);
  U('sub2', '1\tconst x = 1;', null, 'ag1');
  A([{ type: 'text', text: 'Bir TODO buldum: `src/app.js` 12. satır.' }], 'ag1');
  S({ subtype: 'task_progress', task_id: 'afake1', tool_use_id: 'ag1', usage: { tool_uses: 2 } });
  S({ subtype: 'task_notification', task_id: 'afake1', tool_use_id: 'ag1', status: 'completed', summary: 'Kaynak dosyaları tara', usage: { tool_uses: 2, duration_ms: 2300 } });
  U('ag1', 'Bir TODO buldum: src/app.js 12. satır.', { status: 'completed', agentId: 'afake1', totalToolUseCount: 2, totalDurationMs: 2300 });
  // Arka plan komutları: biri kısa sürede biter, diğeri stop_task ya da FAKE_BG_MS ile
  A([{ type: 'tool_use', id: 'bg1', name: 'Bash', input: { command: 'npm run watch', description: 'İzleyiciyi başlat', run_in_background: true } }]); await wait(delay);
  bgTask('bfake1', 'bg1', 'İzleyiciyi başlat', +(process.env.FAKE_BG_MS || 60000));
  A([{ type: 'tool_use', id: 'bg2', name: 'Bash', input: { command: 'echo hazır', description: 'Hazırlık', run_in_background: true } }]); await wait(delay);
  bgTask('bfake2', 'bg2', 'Hazırlık', delay * 4);
  A([{ type: 'tool_use', id: 'td3', name: 'TodoWrite', input: todos(['completed', 'completed', 'in_progress']) }]); await wait(delay);
  U('td3', 'Todos have been modified successfully.');
}
