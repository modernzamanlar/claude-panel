// Geliştirici aracı: gerçek `claude` CLI ile izin onayı (control protocol) akışını dener.
// Kullanım: node test/probe-permissions.js [allow|deny]   (haiku ile küçük bir istek, oturum kaydedilmez)
const { spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

const decision = process.argv[2] || 'allow';
const env = { ...process.env };
for (const k of Object.keys(env)) if (/^(CLAUDECODE$|CLAUDE_CODE_|CLAUDE_AGENT_SDK|CLAUDE_PID$|CLAUDE_EFFORT$|CLAUDE_PREVIEW)/.test(k)) delete env[k];
const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-probe-'));
const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose',
  '--model', 'haiku', '--permission-mode', 'manual', '--permission-prompts', 'host', '--no-session-persistence'];
const p = spawn('claude', args, { env, cwd });
const t0 = Date.now();
let buf = '';
p.stdout.on('data', d => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    const e = JSON.parse(line);
    const s = JSON.stringify(e);
    if (e.type === 'control_request') {
      console.log('CONTROL_REQUEST', s.slice(0, 900));
      const response = decision === 'allow'
        ? { behavior: 'allow', updatedInput: e.request.input }
        : { behavior: 'deny', message: 'Kullanıcı panelden reddetti' };
      p.stdin.write(JSON.stringify({ type: 'control_response', response: { subtype: 'success', request_id: e.request_id, response } }) + '\n');
    } else if (e.type === 'result') {
      console.log('RESULT', s.slice(0, 600));
      p.stdin.end();
    } else if (e.type !== 'stream_event') {
      console.log(e.type, e.subtype || '', s.slice(0, 220));
    }
  }
});
p.stderr.on('data', d => console.log('STDERR', String(d).slice(0, 300)));
p.on('close', c => console.log('exit', c, Date.now() - t0, 'ms'));
const text = 'Run this exact shell command with the Bash tool: echo panel-izin-testi . Then reply only with its output.';
p.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text }] } }) + '\n');
setTimeout(() => { console.log('TIMEOUT'); p.kill(); }, 120000);
