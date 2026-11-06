#!/usr/bin/env node
// Testler için sahte `claude` CLI: stream-json olaylarını ve izin (control_request) protokolünü
// gerçek CLI'ye benzer sırayla üretir. Ortam değişkenleri:
//   FAKE_DELAY=ms  FAKE_PERM=1 (Bash için izin ister)  FAKE_ASK=1 (AskUserQuestion)  FAKE_AUTH_FAIL=1  FAKE_LOGGED_OUT=1
// --resume-session-at <uuid>: gerçek CLI gibi --resume ister; panel her zaman --fork-session ile verir (yoksa hata).
//   Yanıt metni devam noktasının ilk 8 karakterini içerir: "(… noktasından)".
// rewind_files kontrol isteği (kod geri sarma): FAKE_REWIND=<json dosyası> {"<kullanıcı mesajı uuid>": {"<mutlak yol>": "eski içerik"}}.
//   Gerçek CLI gibi CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING yoksa "File rewinding is not enabled." döner; dry_run dosya yazmaz.
// --worktree <ad>: gerçek CLI gibi git deposu ister (.git yoksa çıkış 1), <cwd>/.claude/worktrees/<ad> klasörünü açar ve init'te o cwd'yi bildirir.
const crypto = require('crypto');
const args = process.argv.slice(2);
if (args[0] === 'auth' && args[1] === 'status') { console.log(JSON.stringify({ loggedIn: process.env.FAKE_LOGGED_OUT ? false : true, authMethod: 'fake' })); process.exit(0); }
if (args[0] === 'mcp' && args[1] === 'list') { console.log('Checking MCP server health…\n\nfake-docs: https://example.com/mcp - ✔ Connected\nfake-voice: https://voice.example/mcp - Needs authentication'); process.exit(0); }
const arg = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
let sid = arg('--session-id') || arg('--resume') || crypto.randomUUID();
if (args.includes('--fork-session')) sid = crypto.randomUUID();
const at = arg('--resume-session-at');
if (at && (!arg('--resume') || !args.includes('--fork-session'))) { console.error('--resume-session-at için --resume ve --fork-session gerekli'); process.exit(3); }
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
function finish(result, extra = {}) { out({ type: 'result', subtype: 'success', is_error: false, result, total_cost_usd: 0.0123, session_id: sid, args, ...extra }); }

async function turn(msg) {
  const content = msg.message.content;
  const text = (content.find(c => c.type === 'text') || {}).text || '';
  const images = content.filter(c => c.type === 'image').length;
  out({ type: 'system', subtype: 'init', session_id: sid, cwd, model: 'claude-opus-5-5', permissionMode: arg('--permission-mode') || 'default', mcp_servers: [{ name: 'fake-mcp', status: 'connected' }, { name: 'fake-voice', status: 'needs-auth' }], tools: [] });
  if (process.env.FAKE_AUTH_FAIL) {
    out({ type: 'assistant', session_id: sid, message: { model: '<synthetic>', content: [{ type: 'text', text: 'Failed to authenticate: OAuth session expired' }] } });
    out({ type: 'result', subtype: 'success', is_error: true, result: 'Failed to authenticate', terminal_reason: 'api_error', session_id: sid });
    return process.exit(1);
  }
  const reply = `Aldım: "${text.split('\n')[0]}"${images ? ` (+${images} görsel)` : ''}${at ? ` (${at.slice(0, 8)} noktasından)` : ''}. Panelden yazıyorum.`;
  out({ type: 'stream_event', session_id: sid, event: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } } });
  for (const part of reply.match(/.{1,6}/g)) { out({ type: 'stream_event', session_id: sid, event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: part } } }); await wait(delay / 4); }
  out({ type: 'assistant', session_id: sid, message: { model: 'claude-opus-5-5', content: [{ type: 'text', text: reply }], usage: { input_tokens: 5, cache_read_input_tokens: 42000, output_tokens: 20 } } });
  // Gerçek CLI her turda kalan kullanımı bildirir
  out({ type: 'rate_limit_event', session_id: sid, rate_limit_info: { status: 'allowed', resetsAt: Math.floor(Date.now() / 1000) + 3 * 86400, rateLimitType: 'seven_day', unifiedWindows: { seven_day: { utilization: 0.73, resetsAt: Math.floor(Date.now() / 1000) + 3 * 86400 }, five_hour: { utilization: 0.2, resetsAt: Math.floor(Date.now() / 1000) + 7200 } } } });
  await wait(delay);
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
  // Gerçek CLI gibi: stdin kapanana kadar bekle (panel result görünce kapatır)
}
