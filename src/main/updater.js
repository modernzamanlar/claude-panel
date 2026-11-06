// Kendi kendini güncelleme (Windows; Mac: aynı manifestteki imzalı "mac" girdisi, bkz. macupdate.js). Yeni sürümler bir "güncelleme klasörüne" konur (varsayılan: ofis NAS'ındaki
// Claude App\Exe). Klasörde guncelleme.json bulunur: { version, file, sha512, size, notes, date, imza }.
// Akış: açılıştan kısa süre sonra ve 30 dakikada bir denetle → daha yeni sürüm varsa kurulum dosyasını arka planda
// %TEMP%'e kopyala ve SHA-512 ile doğrula → arayüze "hazır" de → kullanıcı onaylayınca kurulumu sessiz (/S) başlat,
// uygulamayı kapat; kurulum bitince uygulama kendiliğinden yeniden açılır (--force-run). Ayarlar ~/.claude-panel/settings.json.
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');
const { spawn, execFile } = require('child_process');
const { promisify } = require('util');
const mac = require('./macupdate');
// Mac: guncelleme.json'da ayrıca imzalı bir "mac" girdisi bulunur (zip + dmg); üst düzey alanlar Windows'undur
// (sahadaki 0.2.8 Windows istemcileri yalnızca onları okur, mac girdisini görmezden gelir).

const MANIFEST = 'guncelleme.json';
// Güncellemeler Ed25519 ile imzalanır. Özel anahtar yalnızca yayın yapan Mac'te (~/.claude-panel-yayin) durur;
// NAS'a yazabilen biri sahte exe + guncelleme.json koysa bile imza tutmayacağı için kurulmaz.
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEANdVnfdS/ImToRK5zGcbmWZlimMW4mbam4hPomCUHXhk=
-----END PUBLIC KEY-----`;
const signedText = m => `claude-panel-guncelleme\n${m.version}\n${m.file}\n${m.size}\n${m.sha512}`;
function verifyManifest(m, publicKey = PUBLIC_KEY) {
  if (!m || typeof m.sha512 !== 'string') return false;
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(String(m.version))) return false;           // sürüm: 1.2.3
  if (!Number.isInteger(m.size) || m.size <= 0) return false;
  if (!/^[^\\/:*?"<>|\0]+\.exe$/i.test(String(m.file)) || m.file.includes('..')) return false; // yalnızca klasördeki bir .exe adı
  try { return crypto.verify(null, Buffer.from(signedText(m)), publicKey, Buffer.from(m.imza, 'base64')); } catch { return false; }
}
function signManifest(m, privateKeyPem) { return crypto.sign(null, Buffer.from(signedText(m)), privateKeyPem).toString('base64'); }
// NAS'a erişim yolu bilgisayara göre değişebildiği için birkaç aday denenir; ayarlardan elle de seçilebilir
const DEFAULT_SOURCES = [
  'V:\\00 - Yasin\\Claude App\\Exe', // ofis Windows bilgisayarında NAS'taki "Ajans" klasörü V: olarak bağlı
  '\\\\192.168.1.249\\D\\personel disk\\Ajans\\00 - Yasin\\Claude App\\Exe',
  'D:\\personel disk\\Ajans\\00 - Yasin\\Claude App\\Exe',
];

function cmpVer(a, b) {
  const parts = v => String(v).split(/[.-]/).map(x => parseInt(x, 10) || 0);
  const pa = parts(a), pb = parts(b);
  const diffs = Array.from({ length: Math.max(pa.length, pb.length) }, (_, i) => (pa[i] || 0) - (pb[i] || 0));
  return Math.sign(diffs.find(Boolean) || 0);
}
function sha512(file) {
  return new Promise((res, rej) => { const h = crypto.createHash('sha512'); fs.createReadStream(file).on('error', rej).on('data', d => h.update(d)).on('end', () => res(h.digest('base64'))); });
}

function createUpdater({
  app, settingsFile, onState = () => {}, platform = process.platform,
  enabled = platform === 'win32' || (platform === 'darwin' && !!app.isPackaged) || !!process.env.CLAUDE_PANEL_UPDATES, publicKey = PUBLIC_KEY,
  downloadDir = path.join(os.tmpdir(), 'claude-panel-guncelleme'), spawn: spawnFn = spawn,
  // Mac'e özel: execFile (ditto), uygulamanın yürütülebilir yolu, ev klasörü, çalışma kökü, erişim denetimi, kullanıcıya bildirim
  execFile: execFileFn = promisify(execFile), exePath = () => app.getPath('exe'), home = os.homedir(), workRoot = os.tmpdir(),
  access = fs.accessSync, notify = () => {}, pid = process.pid,
  defaultSources = platform === 'win32' ? DEFAULT_SOURCES : platform === 'darwin' ? mac.DEFAULT_SOURCES_MAC : [],
}) {
  const IS_MAC = platform === 'darwin';
  const defaults = defaultSources;
  const entryOf = m => (IS_MAC ? m && m.mac : m);           // bu platformun girdisi
  const logDir = path.dirname(settingsFile);
  let state = { phase: 'idle', current: app.getVersion() }; // idle|checking|none|downloading|ready|error|disabled
  let busy = null, timer = null;
  const set = s => { state = { ...state, ...s, current: app.getVersion() }; onState(state); };

  const readSettings = () => { try { return JSON.parse(fs.readFileSync(settingsFile, 'utf8')); } catch { return {}; } };
  const writeSettings = s => { fs.mkdirSync(path.dirname(settingsFile), { recursive: true }); fs.writeFileSync(settingsFile, JSON.stringify(s, null, 1)); };
  const sources = () => { const s = readSettings(); return [...new Set([process.env.CLAUDE_PANEL_UPDATES, s.updateDir, ...defaults].filter(Boolean))]; };

  async function readManifest() {
    const tried = [];
    for (const dir of sources()) {
      try {
        const m = entryOf(JSON.parse(await fs.promises.readFile(path.join(dir, MANIFEST), 'utf8')));
        if (m && m.version && m.file) return { dir, m };
        tried.push(dir + ' (geçersiz)');
      } catch (e) { tried.push(dir + ' (' + (e.code || e.message) + ')'); }
    }
    const err = new Error('Güncelleme klasörüne ulaşılamadı'); err.tried = tried; throw err;
  }

  // Kaynaktaki dosyayı downloadDir/<name>'e kopyala ve doğrula. İlerleme: (önceki + bu) / toplam
  async function fetch(dir, file, name, size, hash, before = 0, total = size) {
    const dst = path.join(downloadDir, name);
    fs.mkdirSync(downloadDir, { recursive: true });
    let ok = false;
    try { ok = fs.statSync(dst).size === size && await sha512(dst) === hash; } catch {} // önceki indirme geçerliyse yeniden kopyalama
    if (!ok) {
      const tmp = dst + '.part', r = fs.createReadStream(path.join(dir, file));
      let got = 0, last = Math.floor(before / total * 100);
      r.on('data', d => { got += d.length; const p = Math.floor((before + got) / total * 100); if (p !== last) { last = p; set({ progress: p }); } });
      await pipeline(r, fs.createWriteStream(tmp));
      if (fs.statSync(tmp).size !== size) throw new Error('İndirilen dosyanın boyutu tutmuyor');
      if (await sha512(tmp) !== hash) throw new Error('İndirilen dosya doğrulanamadı (SHA-512)');
      fs.renameSync(tmp, dst);
    }
    return dst;
  }
  const download = (dir, m) => fetch(dir, m.file, `Claude Panel Setup ${m.version}.exe`, m.size, m.sha512);
  // Mac: zip (güncelleme) + dmg (yedek yol: elle sürükleme). Adlar imzalı girdiden gelir ve verifyMacEntry'de denetlenir.
  async function downloadMac(dir, m) {
    const total = m.size + m.dmgSize;
    const file = await fetch(dir, m.file, m.file, m.size, m.sha512, 0, total);
    const dmg = await fetch(dir, m.dmg, m.dmg, m.dmgSize, m.dmgSha512, m.size, total);
    return { file, sha512: m.sha512, dmg, dmgSha512: m.dmgSha512 };
  }

  async function check({ manual = false } = {}) {
    if (!enabled) { set({ phase: 'disabled' }); return state; }
    if (busy) return busy;
    busy = (async () => {
      // İndirilip kurulmayı bekleyen sürüm denetim boyunca "hazır" kalır; yalnızca daha yenisi başarıyla inerse değişir
      const prev = state.phase === 'ready' ? state : null;
      const keepReady = () => prev && fs.existsSync(prev.file);
      if (!prev) set({ phase: 'checking', error: null });
      try {
        const { dir, m } = await readManifest();
        if (cmpVer(m.version, app.getVersion()) <= 0) set({ phase: 'none', latest: m.version, source: dir, checkedAt: Date.now() });
        else if (keepReady() && cmpVer(m.version, prev.latest) <= 0) set({ checkedAt: Date.now() });
        else {
          if (!(IS_MAC ? mac.verifyMacEntry(m, publicKey) : verifyManifest(m, publicKey))) throw new Error(`Sürüm ${m.version} imzası doğrulanamadı — güncelleme reddedildi`);
          set({ phase: 'downloading', latest: m.version, notes: m.notes || '', source: dir, progress: 0 });
          if (IS_MAC) set({ phase: 'ready', ...await downloadMac(dir, m), guide: null, progress: 100 });
          else set({ phase: 'ready', file: await download(dir, m), sha512: m.sha512, progress: 100 });
        }
      } catch (e) {
        if (keepReady()) set({ ...prev, checkedAt: Date.now() }); // hazır olan geçerli kalır
        else set({ phase: manual || state.phase === 'downloading' ? 'error' : 'none', error: e.message, tried: e.tried || null });
      }
      return state;
    })().finally(() => { busy = null; });
    return busy;
  }

  /** Kurulumu sessiz başlat ve uygulamayı kapat. beforeQuit: kayıtları diske yazmak için (eşzamanlı) */
  function install(beforeQuit) {
    if (IS_MAC) return installMac(beforeQuit);
    if (state.phase !== 'ready') return false;
    // kurmadan hemen önce dosyayı yeniden doğrula (indirme ile kurma arasında değiştirilmiş ya da silinmiş olmasın)
    let h = null;
    try { h = crypto.createHash('sha512').update(fs.readFileSync(state.file)).digest('base64'); } catch {}
    if (h !== state.sha512) {
      set({ phase: 'error', error: 'Kurulum dosyası değişmiş ya da silinmiş — yeniden indirilecek' });
      try { fs.unlinkSync(state.file); } catch {}
      return false;
    }
    const child = spawnFn(state.file, ['/S', '--updated', '--force-run'], { detached: true, stdio: 'ignore', windowsHide: false });
    // Başlatılamazsa (izin, virüs koruması…) 'error' olayı işlenmezse ana süreç çöker; uygulama da kapatılmaz.
    // beforeQuit yalnızca kurulum gerçekten başlayınca çağrılır: başarısız denemede kapanış onayı (çalışan tur uyarısı) devre dışı kalmasın.
    child.once('error', e => set({ phase: 'error', error: 'Kurulum başlatılamadı: ' + e.message }));
    child.once('spawn', () => { try { if (beforeQuit) beforeQuit(); } catch {} setTimeout(() => app.quit(), 300); });
    child.unref();
    return true;
  }

  // Mac yedek yolu: nedeni günlüğe ve kullanıcıya yaz, doğrulanmış DMG'yi aç (sürükleyip bırakma)
  function manualFallback(reason, dmg) {
    const where = dmg ? '' : ` DMG doğrulanamadı; güncelleme klasöründen (${state.source || 'NAS Claude App/Exe'}) elle açın.`;
    mac.appendLog(logDir, 'HATA: ' + reason);
    console.warn('mac güncelleme:', reason);
    if (dmg) { try { const c = spawnFn('open', [dmg], { detached: true, stdio: 'ignore' }); c.once('error', () => {}); c.unref(); } catch {} }
    const guide = mac.GUIDE + where;
    set({ phase: 'error', error: 'Güncelleme otomatik kurulamadı: ' + reason, guide });
    notify(`${guide}\n\nNeden: ${reason}`);
    return false;
  }
  let installing = false;
  async function installMac(beforeQuit) {
    if (state.phase !== 'ready' || installing) return false;
    installing = true;
    try { return await installMacNow(beforeQuit); } finally { installing = false; }
  }
  async function installMacNow(beforeQuit) {
    const st = state;
    // kurmadan hemen önce paketleri yeniden doğrula (SHA-512 zorunlu: değişmiş ya da silinmiş paket kurulmaz)
    if (await sha512(st.file).catch(() => null) !== st.sha512) {
      set({ phase: 'error', error: 'Güncelleme paketi değişmiş ya da silinmiş — yeniden indirilecek' });
      try { fs.unlinkSync(st.file); } catch {}
      return false;
    }
    const dmg = await sha512(st.dmg).catch(() => null) === st.dmgSha512 ? st.dmg : null;
    const bundle = mac.bundleRoot(exePath());
    const why = mac.preflight(bundle, { home, access });
    if (why) return manualFallback(why, dmg);
    let job = null;
    try {
      job = mac.writeScript(workRoot);
      job.newApp = await mac.extractApp(st.file, job.work, execFileFn);
    } catch (e) {
      if (job) try { fs.rmSync(job.work, { recursive: true, force: true }); } catch {}
      return manualFallback('Paket açılamadı: ' + e.message, dmg);
    }
    fs.mkdirSync(logDir, { recursive: true });          // betik günlüğü buraya ekler (exec >>"$LOG")
    mac.appendLog(logDir, `güncelleme ${st.current} → ${st.latest}: ${bundle}`);
    const args = mac.scriptArgs({ pid, bundle, newApp: job.newApp, dmg, resultFile: path.join(logDir, mac.RESULT_FILE), logFile: path.join(logDir, mac.LOG_FILE) });
    const child = spawnFn('/bin/sh', [job.script, ...args], { detached: true, stdio: 'ignore' });
    child.once('error', e => manualFallback('Güncelleme betiği başlatılamadı: ' + e.message, dmg));
    child.once('spawn', () => { try { if (beforeQuit) beforeQuit(); } catch {} setTimeout(() => app.quit(), 300); });
    child.unref();
    return true;
  }

  function start() {
    if (!enabled) { set({ phase: 'disabled' }); return; }
    // Mac: önceki güncelleme betiği başarısız olduysa nedenini göster (betik eski sürümü geri koyup DMG'yi açmıştır)
    const failed = IS_MAC ? mac.takeResult(logDir) : null;
    if (failed) { mac.appendLog(logDir, 'açılışta bildirildi: ' + failed); set({ phase: 'error', error: 'Güncelleme otomatik kurulamadı: ' + failed, guide: mac.GUIDE }); notify(`${mac.GUIDE}\n\nNeden: ${failed}`); }
    setTimeout(() => check(), 15 * 1000);
    timer = setInterval(() => check(), 30 * 60 * 1000);
  }

  return {
    get state() { return state; }, check, install, start, sources,
    getDir: () => readSettings().updateDir || null,
    setDir: dir => { const s = readSettings(); if (dir) s.updateDir = dir; else delete s.updateDir; writeSettings(s); if (state.phase !== 'ready') set({ phase: 'idle' }); return sources(); },
    stop: () => clearInterval(timer),
  };
}

module.exports = { createUpdater, cmpVer, sha512, verifyManifest, signManifest, MANIFEST, DEFAULT_SOURCES, PUBLIC_KEY, DEFAULT_SOURCES_MAC: mac.DEFAULT_SOURCES_MAC };
