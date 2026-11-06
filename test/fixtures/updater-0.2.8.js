// Kendi kendini güncelleme (Windows). Yeni sürümler bir "güncelleme klasörüne" konur (varsayılan: ofis NAS'ındaki
// Claude App\Exe). Klasörde guncelleme.json bulunur: { version, file, sha512, size, notes, date, imza }.
// Akış: açılıştan kısa süre sonra ve 30 dakikada bir denetle → daha yeni sürüm varsa kurulum dosyasını arka planda
// %TEMP%'e kopyala ve SHA-512 ile doğrula → arayüze "hazır" de → kullanıcı onaylayınca kurulumu sessiz (/S) başlat,
// uygulamayı kapat; kurulum bitince uygulama kendiliğinden yeniden açılır (--force-run). Ayarlar ~/.claude-panel/settings.json.
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');
const { spawn } = require('child_process');

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
  enabled = platform === 'win32' || !!process.env.CLAUDE_PANEL_UPDATES, publicKey = PUBLIC_KEY,
  downloadDir = path.join(os.tmpdir(), 'claude-panel-guncelleme'), spawn: spawnFn = spawn,
}) {
  const defaults = platform === 'win32' ? DEFAULT_SOURCES : [];
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
        const m = JSON.parse(await fs.promises.readFile(path.join(dir, MANIFEST), 'utf8'));
        if (m && m.version && m.file) return { dir, m };
        tried.push(dir + ' (geçersiz)');
      } catch (e) { tried.push(dir + ' (' + (e.code || e.message) + ')'); }
    }
    const err = new Error('Güncelleme klasörüne ulaşılamadı'); err.tried = tried; throw err;
  }

  async function download(dir, m) {
    const dst = path.join(downloadDir, `Claude Panel Setup ${m.version}.exe`);
    fs.mkdirSync(downloadDir, { recursive: true });
    let ok = false;
    try { ok = fs.statSync(dst).size === m.size && await sha512(dst) === m.sha512; } catch {} // önceki indirme geçerliyse yeniden kopyalama
    if (!ok) {
      const tmp = dst + '.part', r = fs.createReadStream(path.join(dir, m.file));
      let got = 0, last = 0;
      r.on('data', d => { got += d.length; const p = Math.floor(got / m.size * 100); if (p !== last) { last = p; set({ progress: p }); } });
      await pipeline(r, fs.createWriteStream(tmp));
      if (fs.statSync(tmp).size !== m.size) throw new Error('İndirilen dosyanın boyutu tutmuyor');
      if (await sha512(tmp) !== m.sha512) throw new Error('İndirilen dosya doğrulanamadı (SHA-512)');
      fs.renameSync(tmp, dst);
    }
    return dst;
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
          if (!verifyManifest(m, publicKey)) throw new Error(`Sürüm ${m.version} imzası doğrulanamadı — güncelleme reddedildi`);
          set({ phase: 'downloading', latest: m.version, notes: m.notes || '', source: dir, progress: 0 });
          const file = await download(dir, m);
          set({ phase: 'ready', file, sha512: m.sha512, progress: 100 });
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

  function start() {
    if (!enabled) { set({ phase: 'disabled' }); return; }
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

module.exports = { createUpdater, cmpVer, sha512, verifyManifest, signManifest, MANIFEST, DEFAULT_SOURCES };
