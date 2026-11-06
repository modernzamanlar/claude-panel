// Faz 2: Panelden Claude Code çalıştırma.
// Her gönderim için kurulu `claude` CLI'si başsız (print) modda başlatılır:
//   claude -p --input-format stream-json --output-format stream-json --verbose --include-partial-messages
//          [--resume <id> | --session-id <yeni-uuid>] [--fork-session] [--model m] [--permission-mode p]
// Mesajlar Claude Code'un kendi .jsonl dosyasına yazıldığı için Claude uygulaması/CLI ile senkron kalır.
// Her bölme kendi sürecini çalıştırır; süreçler birbirini beklemez.
// Faz 3: `--permission-prompt-tool stdio` ile izin gerektiren araçlar için CLI stdout'a
//   {type:'control_request', request:{subtype:'can_use_tool', tool_name, input, permission_suggestions}}
// yazar; panel kullanıcıya sorar ve stdin'e {type:'control_response', response:{subtype:'success', request_id, response:{behavior:'allow'|'deny', ...}}} döner.
// Bu yüzden stdin tur bitene (result) kadar açık tutulur.
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const ctxUsage = require('../renderer/ctxusage');

const HOME = os.homedir();
// Yalnızca "~" ve "~/…" (Windows'ta "~\\…") genişletilir; "~kullanici" ya da "~yedek" gibi adlar olduğu gibi kalır
const expand = p => (p && /^~(?=$|[\\/])/.test(p) ? path.join(HOME, p.slice(1)) : p);

// Panel Claude uygulamasının içinden başlatılmışsa miras kalan oturum değişkenleri
// yeni `claude` sürecini "alt oturum" sanmasına yol açar — bunları temizle.
const STRIP = /^(CLAUDECODE$|CLAUDE_CODE_|CLAUDE_AGENT_SDK|CLAUDE_PID$|CLAUDE_EFFORT$|CLAUDE_PREVIEW|ELECTRON_RUN_AS_NODE$)/;

// Platform ve süreç başlatıcıları testlerde değiştirilebilsin diye tek nesnede (varsayılanlar gerçek değerler)
const deps = { platform: process.platform, spawn: childProcess.spawn, execFile: childProcess.execFile };
const isWin = () => deps.platform === 'win32';
const sep = () => (isWin() ? ';' : ':'); // path.delimiter ile aynı: ':' (macOS) / ';' (Windows)

let loginPathCache = null;
// Finder'dan açılan uygulamalarda PATH kısa olur; kullanıcının giriş kabuğundan PATH'i al.
// Windows'ta giriş kabuğu yok: PATH zaten tam gelir.
// Yalnızca PATH önbelleğe alınır; ortamın geri kalanı her süreçte güncel process.env'den kurulur.
function loginPath() {
  if (isWin()) return Promise.resolve('');
  if (loginPathCache !== null) return Promise.resolve(loginPathCache);
  return new Promise(resolve => {
    const shell = process.env.SHELL || '/bin/zsh';
    deps.execFile(shell, ['-l', '-c', 'printf "%s" "$PATH"'], { timeout: 5000 }, (err, out) => {
      loginPathCache = err ? '' : String(out); resolve(loginPathCache);
    });
  });
}
async function loginEnv() {
  const lp = await loginPath();
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (STRIP.test(k)) delete env[k];
  // Windows'ta değişken adı "Path" olabilir; tek anahtarda topla
  const pk = Object.keys(env).find(k => k.toUpperCase() === 'PATH') || 'PATH';
  const cur = String(env[pk] || '');
  if (pk !== 'PATH') delete env[pk];
  const SEP = sep();
  const extra = isWin()
    ? [path.join(HOME, '.local', 'bin'), process.env.APPDATA && path.join(process.env.APPDATA, 'npm'), process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'claude')]
    : [path.join(HOME, '.local/bin'), '/opt/homebrew/bin', '/usr/local/bin'];
  env.PATH = [...new Set([...lp.split(SEP), ...cur.split(SEP), ...extra].filter(Boolean))].join(SEP);
  return env;
}

// PATH'te çalıştırılabilir dosya ara (ilk bulunan)
function findInPath(names, env) {
  for (const name of names) for (const dir of String(env.PATH || '').split(sep())) {
    const p = path.join(dir, name);
    try { fs.accessSync(p, fs.constants.X_OK); if (fs.statSync(p).isFile()) return p; } catch {}
  }
  return null;
}

// ---------- Bilgisayar kontrolü ----------
// Açıkken Claude iki yetenekle başlatılır:
//  - Tarayıcı: Claude Code'un kendi Claude in Chrome bağlantısı (--chrome). Kullanıcının gerçek Chrome'u ve açık
//    oturumları kullanılır; Chrome'da Claude eklentisi kurulu olmalı.
//  - Masaüstü: agent-desktop (vercel-labs, `npm install -g agent-desktop`). Windows'ta UI Automation, macOS'ta
//    erişilebilirlik (AX) ağacı üzerinden uygulamaları okur ve kullanır; ikisinde de aynı araçlar. MCP olarak eklenir
//    (--mcp-config); kullanıcının kendi MCP sunucuları (ör. premiere-kopru) olduğu gibi kalır.
const PANEL_HOME = () => process.env.CLAUDE_PANEL_HOME || path.join(HOME, '.claude-panel');
async function desktopTool(env) {
  if (process.env.CLAUDE_PANEL_DESKTOP_BIN !== undefined) return process.env.CLAUDE_PANEL_DESKTOP_BIN || null; // testler için
  return findInPath(isWin() ? ['agent-desktop.exe', 'agent-desktop.cmd'] : ['agent-desktop'], env || await loginEnv());
}
/** agent-desktop için MCP yapılandırması (Windows'ta npm betiği .cmd ise cmd /c ile başlatılır). */
function desktopMcp(bin) {
  const server = isWin() && /\.(cmd|bat)$/i.test(bin) ? { command: 'cmd', args: ['/c', bin, 'mcp'] } : { command: bin, args: ['mcp'] };
  return { mcpServers: { 'agent-desktop': server } };
}
/** Yapılandırmayı panel klasörüne yazar (komut satırında JSON tırnak sorunu olmasın diye dosya yolu verilir). */
function writeDesktopMcp(bin) {
  const f = path.join(PANEL_HOME(), 'bilgisayar-kontrolu.mcp.json');
  const body = JSON.stringify(desktopMcp(bin), null, 1);
  let cur = null; try { cur = fs.readFileSync(f, 'utf8'); } catch {}
  if (cur !== body) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', body); fs.renameSync(f + '.tmp', f); }
  return f;
}
// macOS'ta agent-desktop'ın Erişilebilirlik izni (izin, aracı başlatan uygulamaya — Claude Panel'e — verilir)
function desktopAccess(bin, env) {
  if (isWin()) return Promise.resolve(null);
  return new Promise(res => deps.execFile(bin, ['status'], { env, timeout: 8000, windowsHide: true }, (err, out) => {
    try { res(JSON.parse(String(out)).data.permissions.accessibility.state || null); } catch { res(null); }
  }));
}
async function controlStatus() {
  const env = await loginEnv();
  const bin = await desktopTool(env);
  return { desktop: bin, platform: deps.platform, access: bin ? await desktopAccess(bin, env) : null };
}
/** agent-desktop'ı npm ile kullanıcı kapsamında kurar (Windows: %APPDATA%\npm, Mac: npm global önek). Argümanlar sabittir. */
async function installDesktop() {
  const env = await loginEnv();
  const extra = isWin() ? [process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'nodejs')].filter(Boolean) : [];
  const npm = findInPath(isWin() ? ['npm.cmd', 'npm.exe'] : ['npm'], { PATH: [env.PATH, ...extra].join(sep()) });
  if (!npm) throw new Error('npm bulunamadı — önce Node.js kurulmalı (nodejs.org, LTS)');
  await new Promise((resolve, reject) => {
    const args = ['install', '-g', 'agent-desktop'];
    const done = (err, _out, errOut) => err ? reject(new Error('agent-desktop kurulamadı: ' + String(errOut || err.message).trim().slice(-400))) : resolve();
    // Windows'ta npm bir .cmd betiğidir, kabuk gerekir (argümanlar sabit, yol tırnaklanır)
    if (isWin()) deps.execFile(winQuote(npm), args, { env, timeout: 300000, windowsHide: true, shell: true }, done);
    else deps.execFile(npm, args, { env, timeout: 300000 }, done);
  });
  return controlStatus();
}

async function claudeBin() {
  if (process.env.CLAUDE_PANEL_CLAUDE_BIN) return process.env.CLAUDE_PANEL_CLAUDE_BIN; // testler için
  const env = await loginEnv();
  return findInPath(isWin() ? ['claude.exe', 'claude.cmd'] : ['claude'], env);
}

// Windows: npm ile kurulan `claude.cmd` doğrudan başlatılamaz (Node .cmd/.bat için kabuk ister).
// Kabuk (cmd.exe) araya girerse durdururken asıl süreç ölmez; bu yüzden betiğin çağırdığı
// .exe'yi ya da node + cli.js'i bulup onu doğrudan başlatırız. Bulunamazsa son çare kabuk.
const launchCache = new Map();
function launchSpec(bin, env) {
  if (!isWin() || !/\.(cmd|bat)$/i.test(bin)) return { file: bin, pre: [], shell: false };
  if (launchCache.has(bin)) return launchCache.get(bin);
  let spec = { file: bin, pre: [], shell: true };
  try {
    const txt = fs.readFileSync(bin, 'utf8');
    const dir = path.dirname(bin);
    // npm cmd-shim: ... "%dp0%\node.exe" ... "%dp0%\node_modules\@anthropic-ai\claude-code\cli.js" %*
    const m = [...txt.matchAll(/"%~?dp0%?\\?([^"%]+?\.(?:exe|js|mjs|cjs))"/gi)].find(x => !/(^|\\)node\.exe$/i.test(x[1]));
    if (m) {
      const target = path.join(dir, m[1]);
      if (fs.existsSync(target)) {
        if (/\.exe$/i.test(target)) spec = { file: target, pre: [], shell: false };
        else {
          const localNode = path.join(dir, 'node.exe');
          let node = fs.existsSync(localNode) ? localNode : null;
          if (!node) for (const d of String(env.PATH || '').split(sep())) { const p = path.join(d, 'node.exe'); if (fs.existsSync(p)) { node = p; break; } }
          if (node) spec = { file: node, pre: [target], shell: false };
        }
      }
    }
  } catch {}
  launchCache.set(bin, spec);
  return spec;
}
// cmd.exe ters bölü kaçışını tanımaz ve tırnak içinde bile % ! gibi karakterleri yorumlar: kabuk yoluna yalnızca
// bu karakterleri içermeyen argümanlar girebilir (yoksa hata), tırnaklama yalnızca boşluk için yapılır.
const CMD_UNSAFE = /["%!^&|<>`\r\n\0]/;
const winQuote = a => { a = String(a); if (CMD_UNSAFE.test(a)) throw new Error('Güvenli olmayan argüman reddedildi'); return /^[\w.:\\\/=@-]+$/.test(a) ? a : '"' + a + '"'; };

// ---- Girdi doğrulama (renderer'dan gelen değerler ana süreçte yeniden denetlenir) ----
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PERMISSION_MODES = new Set(['default', 'acceptEdits', 'bypassPermissions', 'plan', 'auto', 'dontAsk', 'manual']);
const MODEL_RX = /^((opus|sonnet|haiku|fable)(\[1m\])?|default|claude-[a-z0-9.-]+(\[1m\])?)$/i;
const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max']); // claude --effort
function checkUuid(id) { if (!UUID.test(String(id))) throw new Error('Geçersiz oturum kimliği'); return String(id); }
function checkDir(p) {
  const d = expand(p);
  let ok = false; try { ok = !!d && fs.statSync(d).isDirectory(); } catch {}
  if (!ok) throw new Error('Çalışma klasörü bulunamadı: ' + p);
  if (/[\r\n]/.test(d)) throw new Error('Çalışma klasörü geçersiz'); // \0 içeren yol statSync'te zaten reddedilir
  return d;
}
// Betiğe gömülecek görünen metin: kontrol karakterleri ve kabuk metakarakterleri atılır (yalnızca harf, rakam, boşluk, . _ - ( ) ·)
const safeLabel = (v, max = 60) => String(v || '').replace(/[^\p{L}\p{N} ._()·-]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max) || 'Claude Panel';
// Geçici betik: her seferinde rastgele adlı özel klasör + yalnızca-yeni-dosya (wx) — tahmin edilebilir ad / araya girme yok
function writeTempScript(name, body, mode) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-panel-'));
  const f = path.join(dir, name);
  fs.writeFileSync(f, body, { flag: 'wx', mode: mode || 0o600 });
  setTimeout(() => fs.rm(dir, { recursive: true, force: true }, () => {}), 10 * 60 * 1000).unref?.();
  return f;
}
// opts.env her çağıranda loginEnv() sonucudur
function spawnClaude(bin, args, opts) {
  const sp = launchSpec(bin, opts.env);
  if (sp.shell) return deps.spawn(winQuote(sp.file), args.map(winQuote), { ...opts, shell: true, windowsHide: true });
  return deps.spawn(sp.file, [...sp.pre, ...args], { ...opts, windowsHide: true });
}
function execClaude(bin, args, opts, cb) {
  const sp = launchSpec(bin, opts.env);
  if (sp.shell) return deps.execFile(winQuote(sp.file), args.map(winQuote), { ...opts, shell: true, windowsHide: true }, cb);
  return deps.execFile(sp.file, [...sp.pre, ...args], { ...opts, windowsHide: true }, cb);
}
// Windows'ta sinyal yok: süreç ağacını taskkill ile kapat
function killTree(proc, signal) {
  if (!isWin()) { try { proc.kill(signal); } catch {} return; }
  if (!proc.pid) return;
  deps.execFile('taskkill', ['/pid', String(proc.pid), '/T', ...(signal === 'SIGINT' ? [] : ['/F'])], { windowsHide: true }, () => {});
}

async function authStatus() {
  const bin = await claudeBin();
  if (!bin) return { installed: false, loggedIn: false };
  const env = await loginEnv();
  return new Promise(resolve => {
    execClaude(bin, ['auth', 'status'], { env, timeout: 15000 }, (err, out) => {
      try { const j = JSON.parse(out); resolve({ installed: true, bin, loggedIn: !!j.loggedIn, authMethod: j.authMethod }); }
      catch { resolve({ installed: true, bin, loggedIn: !err, unknown: true }); }
    });
  });
}

// Giriş için Terminal'de `claude auth login` açar (giriş tarayıcıda kullanıcı tarafından yapılır)
async function openLoginTerminal(shell) {
  const bin = (await claudeBin()) || 'claude';
  if (isWin()) {
    if (CMD_UNSAFE.test(bin)) throw new Error('claude yolu güvenli değil: ' + bin);
    const f = writeTempScript('claude-panel-login.cmd', `@echo off\r\nchcp 65001 >nul\r\ntitle Claude Panel - giris\r\necho Claude Panel: Claude Code girisi\r\ncall "${bin}" auth login\r\necho.\r\necho Bitti - bu pencereyi kapatip Claude Panel'e donebilirsin.\r\npause\r\n`);
    return opened(await shell.openPath(f));
  }
  const qb = "'" + String(bin).replace(/'/g, "'\\''") + "'";
  const f = writeTempScript('claude-panel-login.command', `#!/bin/zsh\necho "Claude Panel: Claude Code girişi"\n${qb} auth login\necho\necho "Bitti — bu pencereyi kapatıp Claude Panel'e dönebilirsin."\n`, 0o700);
  return opened(await shell.openPath(f));
}

// Kullanıcı mesajı: metin + (varsa) ekli dosya yolları + görseller. Girdi renderer'dan gelir; biçimi bozuksa açık hata verilir.
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const BASE64_RX = /^[A-Za-z0-9+/]+={0,2}$/;
function buildContent(opts) {
  const text = opts.text ?? '', files = opts.files ?? [], images = opts.images ?? [];
  if (typeof text !== 'string') throw new Error('Geçersiz mesaj metni');
  if (!Array.isArray(files) || !files.every(f => typeof f === 'string' && f)) throw new Error('Geçersiz dosya eki');
  if (!Array.isArray(images)) throw new Error('Geçersiz görsel eki');
  const content = [];
  let t = text;
  if (files.length) t += (t ? '\n\n' : '') + 'Ekli dosyalar:\n' + files.map(f => '- ' + expand(f)).join('\n');
  if (t) content.push({ type: 'text', text: t });
  for (const im of images) {
    if (!im || typeof im !== 'object') throw new Error('Geçersiz görsel eki');
    if (!IMAGE_TYPES.has(im.media_type)) throw new Error('Desteklenmeyen görsel türü: ' + String(im.media_type).slice(0, 40) + ' (png, jpeg, gif veya webp olmalı)');
    if (typeof im.data !== 'string' || !BASE64_RX.test(im.data)) throw new Error('Görsel verisi bozuk');
    content.push({ type: 'image', source: { type: 'base64', media_type: im.media_type, data: im.data } });
  }
  return content;
}

class Runner {
  constructor(send) {
    this.send = send;           // (channel, payload) => void
    this.runs = new Map();      // runId -> {proc, sessionId, ...}
  }
  /**
   * opts: {runId, sessionId?, newSession?, fork?, cwd, text, model?, permissionMode?, effort?, control?, fast?}
   * Dönüş: {runId, sessionId} — yeni sohbette sessionId önceden üretilir (--session-id).
   */
  async start(opts) {
    const bin = await claudeBin();
    if (!bin) throw new Error('claude komutu bulunamadı. Claude Code CLI kurulu olmalı (ör. ~/.local/bin/claude' + (isWin() ? '.exe' : '') + ').');
    const env = await loginEnv();
    const cwd = checkDir(opts.cwd);
    if (opts.sessionId) checkUuid(opts.sessionId);
    if (opts.model && !MODEL_RX.test(String(opts.model))) throw new Error('Geçersiz model: ' + opts.model);
    if (opts.permissionMode && !PERMISSION_MODES.has(opts.permissionMode)) throw new Error('Geçersiz izin modu: ' + opts.permissionMode);
    if (opts.effort && !EFFORTS.has(opts.effort)) throw new Error('Geçersiz düşünme seviyesi: ' + String(opts.effort).slice(0, 20));
    if (opts.fast !== undefined && opts.fast !== null && typeof opts.fast !== 'boolean') throw new Error('Geçersiz hızlı mod değeri');
    const runId = opts.runId || crypto.randomUUID();
    const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages'];
    let sessionId = opts.sessionId;
    if (opts.newSession) { sessionId = sessionId || crypto.randomUUID(); args.push('--session-id', sessionId); }
    else { if (!sessionId) throw new Error('Oturum kimliği yok'); args.push('--resume', sessionId); if (opts.fork) args.push('--fork-session'); }
    if (opts.model) args.push('--model', opts.model);
    if (opts.permissionMode) args.push('--permission-mode', opts.permissionMode);
    if (opts.effort) args.push('--effort', opts.effort);
    // Hızlı mod: `--fast-mode on` CLI'nin bayrak ayarlarına fastMode:true yazar; başsız modda bu açık istek olmadan
    // hızlı mod "sdk_opt_in_required" nedeniyle kapalı kalır (CLI 2.1.318'de denendi). Kullanılabilirliği hesap belirler;
    // sonuç result.fast_mode_state / fast_mode_disabled_reason ile döner. Kapalıyken bayrak verilmez (CLI varsayılanı).
    if (opts.fast === true) args.push('--fast-mode', 'on');
    if (opts.control) { // bilgisayar kontrolü: tarayıcı (Claude in Chrome) + varsa masaüstü (agent-desktop)
      args.push('--chrome');
      const ad = await desktopTool(env);
      if (ad) args.push('--mcp-config', writeDesktopMcp(ad));
    }
    args.push('--permission-prompt-tool', 'stdio');
    if (opts.ephemeral) args.push('--no-session-persistence'); // yalnızca testler: oturum dosyası yazılmaz

    // Mesaj süreç başlamadan kurulur ve doğrulanır: bozuk bir ek, başlamış ama hiç mesaj almamış (asılı kalan) bir süreç bırakmasın.
    const message = JSON.stringify({ type: 'user', message: { role: 'user', content: buildContent(opts) } }) + '\n';

    const proc = spawnClaude(bin, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    const run = { runId, proc, sessionId, startedAt: Date.now(), stderr: '', done: false, pending: new Set(), timers: [] };
    this.runs.set(runId, run);
    this.send('run:event', { runId, type: 'started', sessionId, fork: !!opts.fork, newSession: !!opts.newSession });

    let buf = '';
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', chunk => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        if (!line.trim()) continue;
        let ev; try { ev = JSON.parse(line); } catch { continue; }
        if (!ev || typeof ev !== 'object') continue; // "null" satırı aşağıda TypeError ile ana süreci düşürürdü
        if (ev.session_id && ev.session_id !== run.sessionId) run.sessionId = ev.session_id; // çatallamada yeni kimlik
        if (ev.type === 'control_request') { this.onControl(run, ev); continue; }
        if (ev.type === 'control_cancel_request') { run.pending.delete(ev.request_id); this.send('run:event', { runId, type: 'permission-cancel', requestId: ev.request_id }); continue; }
        if (ev.type === 'control_response') continue; // panelin gönderdiği kesme isteğinin yanıtı
        this.send('run:event', { runId, type: 'event', sessionId: run.sessionId, ev });
        if (ev.type === 'result') this.endInput(run);
      }
    });
    proc.stderr.setEncoding('utf8');
    proc.stderr.on('data', d => { run.stderr = (run.stderr + d).slice(-4000); });
    proc.on('error', err => this.finish(run, { error: err.message }));
    proc.on('close', (code, signal) => this.finish(run, { code, signal }));

    // Giriş, tur bitene kadar açık kalır.
    proc.stdin.on('error', () => {});
    proc.stdin.write(message);
    return { runId, sessionId };
  }
  onControl(run, ev) {
    const req = ev.request || {};
    if (req.subtype === 'can_use_tool') {
      run.pending.add(ev.request_id);
      this.send('run:event', { runId: run.runId, type: 'permission', sessionId: run.sessionId, requestId: ev.request_id, request: req });
      return;
    }
    // Panelin desteklemediği istekler (hook, mcp köprüsü…) asılı kalmasın
    this.write(run, { type: 'control_response', response: { subtype: 'error', request_id: ev.request_id, error: 'Claude Panel bu isteği desteklemiyor: ' + req.subtype } });
  }
  write(run, obj) { try { if (!run.inputEnded) run.proc.stdin.write(JSON.stringify(obj) + '\n'); } catch {} }
  endInput(run) { if (run.inputEnded) return; run.inputEnded = true; try { run.proc.stdin.end(); } catch {} }
  /** İzin isteğine yanıt: response = {behavior:'allow', updatedInput, updatedPermissions?} | {behavior:'deny', message, interrupt?} */
  respond(runId, requestId, response) {
    const run = this.runs.get(runId);
    if (!run || !run.pending.has(requestId)) return false;
    run.pending.delete(requestId);
    this.write(run, { type: 'control_response', response: { subtype: 'success', request_id: requestId, response } });
    return true;
  }
  finish(run, info) {
    if (run.done) return; run.done = true;
    for (const t of run.timers) clearTimeout(t); // durdurma zamanlayıcıları süreç bitince beklemesin
    this.runs.delete(run.runId);
    const stopped = !!run.stopRequested;
    this.send('run:event', { runId: run.runId, type: 'exit', sessionId: run.sessionId, stopped, ...info, stderr: info.code ? run.stderr : '' });
  }
  stop(runId) {
    const run = this.runs.get(runId);
    if (!run) return false;
    run.stopRequested = true;
    // Önce nazikçe: CLI'ye kesme isteği (tur "[Request interrupted]" ile kapanır), sonra sinyaller
    for (const id of run.pending) this.write(run, { type: 'control_response', response: { subtype: 'success', request_id: id, response: { behavior: 'deny', message: 'Kullanıcı durdurdu', interrupt: true } } });
    run.pending.clear();
    this.write(run, { type: 'control_request', request_id: crypto.randomUUID(), request: { subtype: 'interrupt' } });
    // finish() bu zamanlayıcıları temizler: çalıştıklarında süreç henüz bitmemiştir
    run.timers.push(
      setTimeout(() => { this.endInput(run); killTree(run.proc, 'SIGINT'); }, 2500),
      setTimeout(() => killTree(run.proc, 'SIGTERM'), 5500),
      setTimeout(() => killTree(run.proc, 'SIGKILL'), 9000));
    return true;
  }
  stopAll() { for (const id of [...this.runs.keys()]) this.stop(id); }
  active() { return [...this.runs.values()].map(r => ({ runId: r.runId, sessionId: r.sessionId, startedAt: r.startedAt })); }
}

// shell.openPath hata olursa reddetmez, hata metnini döndürür: sessizce "açıldı" denmesin
const opened = err => { if (err) throw new Error('Terminal açılamadı: ' + err); return true; };

// Uzaktan Kontrol: CLI bunu yalnızca etkileşimli oturumda destekliyor (`--remote-control`),
// bu yüzden oturum Terminal'de `claude --resume <id> --remote-control "<ad>"` ile açılır.
async function openRemoteTerminal(shell, { sessionId, cwd, name }) {
  const bin = (await claudeBin()) || 'claude';
  const id = checkUuid(sessionId);
  const dir = checkDir(cwd);
  const label = safeLabel(name);
  const q = s => "'" + String(s).replace(/'/g, "'\\''") + "'";
  if (isWin()) {
    // .cmd içinde % ve " tırnak içinde bile yorumlanır: bu karakterleri içeren yol reddedilir (ayıklanıp başka bir yola gidilmez)
    for (const v of [dir, bin]) if (CMD_UNSAFE.test(v)) throw new Error('Bu klasör adı Uzaktan Kontrol betiğinde güvenle kullanılamaz: ' + v);
    const wq = v => '"' + v + '"';
    const f = writeTempScript(`claude-panel-remote-${id.slice(0, 8)}.cmd`, `@echo off\r\nchcp 65001 >nul\r\ntitle Claude Panel - Uzaktan Kontrol\r\ncd /d ${wq(dir)} || exit /b 1\r\necho Claude Panel - Uzaktan Kontrol: ${label}\r\ncall ${wq(bin)} --resume ${id} --remote-control ${wq(label)}\r\npause\r\n`);
    return opened(await shell.openPath(f));
  }
  const f = writeTempScript(`claude-panel-remote-${id.slice(0, 8)}.command`, `#!/bin/zsh\ncd ${q(dir)} || exit 1\necho ${q('Claude Panel → Uzaktan Kontrol: ' + label)}\n${q(bin)} --resume ${id} --remote-control ${q(label)}\n`, 0o700);
  return opened(await shell.openPath(f));
}

// `claude mcp list` → bağlayıcıların gerçek durumu (proje klasöründe çalıştırılır)
async function mcpList(cwd) {
  const bin = await claudeBin();
  if (!bin) return { ok: false, error: 'claude bulunamadı', servers: [] };
  const env = await loginEnv();
  const dir = expand(cwd);
  return new Promise(resolve => {
    execClaude(bin, ['mcp', 'list'], { env, cwd: dir && fs.existsSync(dir) ? dir : HOME, timeout: 45000 }, (err, out, errOut) => {
      const servers = [];
      for (const line of String(out).split('\n')) {
        const m = /^(.+?):\s+(.*?)\s+-\s+(.*)$/.exec(line.trim());
        if (!m) continue;
        const st = m[3];
        const status = /✓|✔|connected/i.test(st) ? 'connected' : /auth/i.test(st) ? 'needs-auth' : /✗|fail/i.test(st) ? 'failed' : 'unknown';
        servers.push({ name: m[1], target: m[2], statusText: st.replace(/^[✓✔✗✘⚠!]\s*/, ''), status });
      }
      resolve({ ok: !err || servers.length > 0, error: err && !servers.length ? (errOut || err.message).slice(0, 300) : null, servers });
    });
  });
}

// Gerçek bağlam kullanımı: Claude Code'un /context komutu başsız modda yerel olarak çalışır (model çağrılmaz, num_turns 0).
// --no-session-persistence ile oturumun .jsonl dosyasına hiçbir şey eklenmez (bu bayrak olmadan /context kayda yazılır).
// Dönüş: {model, total, window, free, buffer, categories:[{name, tokens, deferred}], memory, at}
async function contextUsage(sessionId, cwd, opts = {}) {
  const id = checkUuid(sessionId);
  const dir = checkDir(cwd);
  if (opts.model && !MODEL_RX.test(String(opts.model))) throw new Error('Geçersiz model: ' + opts.model);
  const bin = await claudeBin();
  if (!bin) throw new Error('claude komutu bulunamadı');
  const env = await loginEnv();
  const args = ['-p', '/context', '--resume', id, '--no-session-persistence', '--output-format', 'json', ...(opts.model ? ['--model', opts.model] : [])];
  return new Promise((resolve, reject) => {
    const p = execClaude(bin, args, { env, cwd: dir, timeout: 60000, maxBuffer: 16 * 1024 * 1024 }, (err, out, errOut) => {
      const r = ctxUsage.parse(String(out || ''));
      if (r) resolve({ ...r, at: Date.now() });
      else reject(new Error(String(errOut || (err && err.message) || '').trim().slice(-300) || 'Bağlam bilgisi okunamadı'));
    });
    try { p.stdin.end(); } catch {} // -p istemi argümanda; açık kalan stdin CLI'yi bekletmesin
  });
}

// Testler için: bağımlılıklar ve önbellek sıfırlama
const _test = { deps, winQuote, safeLabel, expand, reset(lp = null) { loginPathCache = lp; launchCache.clear(); } };
module.exports = { Runner, authStatus, openLoginTerminal, openRemoteTerminal, mcpList, contextUsage, claudeBin, loginEnv, launchSpec, controlStatus, installDesktop, desktopMcp, _test };
