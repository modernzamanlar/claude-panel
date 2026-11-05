// Panelin kendi verisi: ~/.claude-panel/workspace.json
// Claude'un dosyalarına hiç yazılmaz; klasörler, sohbet-klasör eşleşmeleri, bağlantılar, düzen burada durur.
// Veri kaybına karşı üç katman: atomik yazım, dakikada bir yedek (workspace.json.bak) ve
// yansı klasöründeki (C:\Claude Panel) yapı dosyası. Asıl dosya bozulur/silinirse sırayla bunlardan geri yüklenir.
const fs = require('fs');
const path = require('path');
const os = require('os');

const DIR = process.env.CLAUDE_PANEL_HOME || path.join(os.homedir(), '.claude-panel'); // testlerde geçici klasör verilebilir
const FILE = path.join(DIR, 'workspace.json');
const BAK = FILE + '.bak';
const BAK_EVERY = 60 * 1000;

const EMPTY = () => ({ v: 1, folders: [], meta: {}, items: [], links: [], graphPos: {}, known: null, layout: null });

const readJSON = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const valid = d => d && typeof d === 'object' && Array.isArray(d.folders) && d.meta && typeof d.meta === 'object';

/** fallbacks: [() => veri|null] — asıl dosya ve yedek okunamazsa denenir (ör. yansı klasöründeki yapı dosyası) */
function load(fallbacks = []) {
  let primaryErr = null;
  try {
    const data = readJSON(FILE);
    if (!valid(data)) throw new Error('geçersiz yapı');
    return { ...EMPTY(), ...data, firstRun: false };
  } catch (e) {
    primaryErr = e;
    // bozuk dosyayı kenara al, kaybetme
    if (e.code !== 'ENOENT') try { fs.copyFileSync(FILE, FILE + '.bozuk-' + Date.now()); } catch {}
  }
  const tries = [() => readJSON(BAK), ...fallbacks];
  for (const t of tries) {
    try {
      const data = t();
      if (valid(data)) {
        const { firstRun, ...rest } = data;
        console.warn('workspace geri yüklendi (' + (primaryErr.code || primaryErr.message) + ')');
        save(rest); // geri yükleneni hemen asıl dosyaya yaz
        return { ...EMPTY(), ...rest, firstRun: false, restored: true };
      }
    } catch {}
  }
  return { ...EMPTY(), firstRun: true };
}

let lastBak = 0;
// Atomik yazım: önce geçici dosya, sonra yeniden adlandır (yarım yazılmış dosya kalmaz)
function save(data) {
  fs.mkdirSync(DIR, { recursive: true });
  const { firstRun, restored, ...rest } = data || {};
  const out = { ...rest, v: 1, savedAt: new Date().toISOString() };
  const tmp = FILE + '.tmp';
  const fd = fs.openSync(tmp, 'w');
  try { fs.writeSync(fd, JSON.stringify(out, null, 1)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  if (Date.now() - lastBak > BAK_EVERY && fs.existsSync(FILE)) { try { fs.copyFileSync(FILE, BAK); lastBak = Date.now(); } catch {} }
  fs.renameSync(tmp, FILE);
  return out;
}

module.exports = { load, save, DIR, FILE, BAK };
