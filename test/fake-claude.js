#!/usr/bin/env node
// Testler için sahte `claude` CLI: stream-json olaylarını ve izin (control_request) protokolünü
// gerçek CLI'ye benzer sırayla üretir. Ortam değişkenleri:
//   FAKE_DELAY=ms  FAKE_PERM=1 (Bash için izin ister)  FAKE_ASK=1 (AskUserQuestion)  FAKE_AUTH_FAIL=1  FAKE_LOGGED_OUT=1
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
    else if (m.type === 'control_request' && m.request.subtype === 'interrupt') {
      interrupted = true;
      out({ type: 'control_response', response: { subtype: 'success', request_id: m.request_id } });
      for (const [id, w] of waiters) { out({ type: 'control_cancel_request', request_id: id }); w({ behavior: 'deny', message: 'interrupted' }); }
    }
  }
});
process.stdin.on('end', () => setTimeout(() => process.exit(0), 20));

function ask(tool_name, input) {
  const request_id = crypto.randomUUID();
  out({ type: 'control_request', request_id, request: { subtype: 'can_use_tool', tool_name, input, description: input.description || '', permission_suggestions: [{ type: 'addRules', rules: [{ toolName: tool_name, ruleContent: input.command || '' }], behavior: 'allow', destination: 'localSettings' }] } });
  return new Promise(r => waiters.set(request_id, r));
}
function finish(result, extra = {}) { out({ type: 'result', subtype: 'success', is_error: false, result, total_cost_usd: 0.0123, session_id: sid, args, modelUsage: { 'claude-opus-5-5': { inputTokens: 5, outputTokens: 20, cacheReadInputTokens: 42000, contextWindow: 1000000, maxOutputTokens: 64000 }, 'claude-haiku-4-5-20251001': { inputTokens: 300, outputTokens: 10, contextWindow: 200000 } }, ...extra }); }

async function turn(msg) {
  const content = msg.message.content;
  const text = (content.find(c => c.type === 'text') || {}).text || '';
  const images = content.filter(c => c.type === 'image').length;
  out({ type: 'system', subtype: 'init', session_id: sid, cwd: process.cwd(), model: 'claude-opus-5-5', permissionMode: arg('--permission-mode') || 'default', mcp_servers: [{ name: 'fake-mcp', status: 'connected' }, { name: 'fake-voice', status: 'needs-auth' }], tools: [] });
  if (process.env.FAKE_AUTH_FAIL) {
    out({ type: 'assistant', session_id: sid, message: { model: '<synthetic>', content: [{ type: 'text', text: 'Failed to authenticate: OAuth session expired' }] } });
    out({ type: 'result', subtype: 'success', is_error: true, result: 'Failed to authenticate', terminal_reason: 'api_error', session_id: sid });
    return process.exit(1);
  }
  const reply = `Aldım: "${text.split('\n')[0]}"${images ? ` (+${images} görsel)` : ''}. Panelden yazıyorum.`;
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
