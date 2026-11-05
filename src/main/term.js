// Terminal çekmecesi: sohbetin proje klasöründe tek seferlik komut çalıştırma.
// Yerel modül yok (node-pty Mac'ten Windows'a derlenemiyor): her komut ayrı bir süreç, stdin kapalı, stdout/stderr boru.
//   Windows: powershell.exe -NoLogo -NoProfile -NonInteractive -Command <önek + komut>
//   macOS:   $SHELL (yoksa /bin/zsh) -lc <komut>, kendi süreç grubunda (durdurunca tüm grup kapanır)
// Tam ekran / etkileşimli programlar (vim, top, parola soran ssh…) TTY olmadığı için çalışmaz.
// Çıktı parçaları biriktirilip kısa aralıklarla gönderilir: send('term:event', {id, type:'out', chunks:[['out'|'err', metin], …]}),
// bitince send('term:event', {id, type:'exit', code, signal, stopped, error?, ms}).
const childProcess = require('child_process');
const path = require('path');
const { checkDir, loginEnv } = require('./runner');

// Testlerde değiştirilebilir (varsayılanlar gerçek değerler)
const deps = {
  platform: process.platform,
  shell: () => process.env.SHELL,
  spawn: childProcess.spawn,
  execFile: childProcess.execFile,
  kill: (pid, sig) => process.kill(pid, sig),
  env: loginEnv,
};
const ID_RX = /^[A-Za-z0-9-]{1,64}$/;
const MAX_CMD = 10000;
const FLUSH_MS = 40;            // çıktı bu aralıkla toplu gönderilir
const MAX_PENDING = 256 * 1024; // gönderilmeyi bekleyen çıktı bundan büyükse eskisi atılır (ör. `yes`)
const CLOSE_WAIT = 400;         // süreç bittikten sonra boruların kapanması için beklenen süre (arka planda kalan alt süreç boruyu tutabilir)
const CUT = '\n… (çıktının bir kısmı atlandı)\n';

// PowerShell öneki: çıktı UTF-8 (BOM'suz), ilerleme çubukları kapalı. Kullanıcı komutu base64 ile taşınır;
// böylece komuttaki tırnak, ters bölü ve $ karakterleri Windows komut satırı ayrıştırmasından etkilenmez.
const PS_PREFIX = "$ProgressPreference='SilentlyContinue';[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);$OutputEncoding=[Console]::OutputEncoding;";

/** Saf işlev: platforma göre başlatılacak dosya, argümanlar ve süreç grubu ayarı. */
function spawnSpec(cmd, { platform, shell } = {}) {
  if (platform === 'win32') {
    const b64 = Buffer.from(String(cmd), 'utf8').toString('base64');
    const script = PS_PREFIX + `$c=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64}'));& ([scriptblock]::Create($c));$ok=$?;if($LASTEXITCODE){exit $LASTEXITCODE};if(-not $ok){exit 1}`;
    return { file: 'powershell.exe', args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], detached: false };
  }
  const sh = shell && path.isAbsolute(shell) ? shell : '/bin/zsh';
  return { file: sh, args: ['-lc', String(cmd)], detached: true };
}

function checkCmd(cmd) {
  if (typeof cmd !== 'string' || !cmd.trim()) throw new Error('Komut boş');
  if (cmd.length > MAX_CMD) throw new Error('Komut çok uzun');
  if (cmd.includes('\0')) throw new Error('Komut geçersiz');
  return cmd;
}

// macOS: süreç kendi grubunun lideri (detached); eksi pid tüm gruba sinyal gönderir. Grup yoksa (ESRCH) sessizce geçilir.
function group(pid, sig) { try { deps.kill(-pid, sig); } catch {} }

class Term {
  constructor(send) {
    this.send = send;        // (channel, payload) => void
    this.runs = new Map();   // id -> run
  }
  /** opts: {id, cwd, cmd} → {id, cwd} (cwd: doğrulanmış gerçek klasör) */
  async run(opts) {
    const o = opts || {};
    const id = String(o.id || '');
    if (!ID_RX.test(id)) throw new Error('Geçersiz komut kimliği');
    if (this.runs.has(id)) throw new Error('Bu kimlikle çalışan bir komut var');
    const cmd = checkCmd(o.cmd);
    const cwd = checkDir(o.cwd);
    const env = { ...(await deps.env()) };
    const win = deps.platform === 'win32';
    if (!win) env.TERM = 'dumb'; // TTY yok: renk/imleç oyunları yapılmasın
    const sp = spawnSpec(cmd, { platform: deps.platform, shell: deps.shell() });
    const proc = deps.spawn(sp.file, sp.args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], detached: sp.detached, windowsHide: true });
    const run = { id, proc, t0: Date.now(), chunks: [], size: 0, cut: false, timer: null, timers: [], done: false, stopped: false, exit: null };
    this.runs.set(id, run);
    for (const name of ['out', 'err']) {
      const st = name === 'out' ? proc.stdout : proc.stderr;
      st.setEncoding('utf8');
      let first = true;
      st.on('data', d => { if (first) { first = false; d = d.replace(/^﻿/, ''); } this.push(run, name, d); });
      st.on('error', () => {});
    }
    proc.on('error', err => this.finish(run, { error: err.message }));
    proc.on('exit', (code, signal) => {
      run.exit = { code, signal };
      run.timers.push(setTimeout(() => { proc.stdout.destroy(); proc.stderr.destroy(); this.finish(run, run.exit); }, CLOSE_WAIT));
    });
    proc.on('close', (code, signal) => this.finish(run, run.exit || { code, signal }));
    return { id, cwd };
  }
  push(run, name, text) {
    const last = run.chunks[run.chunks.length - 1];
    if (last && last[0] === name) last[1] += text; else run.chunks.push([name, text]);
    run.size += text.length;
    while (run.size > MAX_PENDING && run.chunks.length) { // en eski parçalardan at
      const c = run.chunks[0], over = run.size - MAX_PENDING;
      if (c[1].length <= over) { run.chunks.shift(); run.size -= c[1].length; }
      else { c[1] = c[1].slice(over); run.size -= over; }
      run.cut = true;
    }
    if (!run.timer) run.timer = setTimeout(() => this.flush(run), FLUSH_MS);
  }
  flush(run) {
    clearTimeout(run.timer); run.timer = null;
    if (!run.chunks.length) return;
    const chunks = run.chunks; run.chunks = []; run.size = 0;
    if (run.cut) { run.cut = false; chunks.unshift(['err', CUT]); }
    this.send('term:event', { id: run.id, type: 'out', chunks });
  }
  finish(run, info) {
    if (run.done) return; run.done = true;
    for (const t of run.timers) clearTimeout(t);
    // Durdurulan komutun kabuğu bittiyse grupta kalan alt süreçler (ör. SIGINT'i yok sayan arka plan işleri) de kapatılır
    if (run.stopped && deps.platform !== 'win32' && run.proc.pid) group(run.proc.pid, 'SIGKILL');
    this.flush(run);
    this.runs.delete(run.id);
    this.send('term:event', { id: run.id, type: 'exit', stopped: run.stopped, ms: Date.now() - run.t0, ...info });
  }
  /**
   * Süreç ağacını kapatır. macOS: grup önce SIGINT, 1 sn sonra SIGTERM, 3 sn sonra SIGKILL (hard: hemen SIGKILL — uygulama kapanırken).
   * Windows: taskkill /T /F.
   */
  stop(id, hard) {
    const run = this.runs.get(String(id));
    if (!run) return false;
    run.stopped = true;
    const pid = run.proc.pid;
    if (!pid) return true;
    if (deps.platform === 'win32') {
      deps.execFile('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true }, () => {});
      return true;
    }
    if (hard) { group(pid, 'SIGKILL'); return true; }
    group(pid, 'SIGINT');
    run.timers.push(setTimeout(() => group(pid, 'SIGTERM'), 1000), setTimeout(() => group(pid, 'SIGKILL'), 3000));
    return true;
  }
  stopAll() { for (const id of [...this.runs.keys()]) this.stop(id, true); }
}

module.exports = { Term, spawnSpec, _test: { deps, checkCmd, PS_PREFIX, MAX_PENDING, CLOSE_WAIT } };
