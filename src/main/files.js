// Yazma kutusunda "@" ile dosya önerisi: sohbetin proje klasörünü tarar, yazılana göre sıralar.
// listFiles(dir, query, opts) → [{rel, name, dir}] (rel her zaman "/" ayraçlı, klasörde sonda "/" yok).
// Tarama klasör başına kısa süre önbellekte tutulur; sıralama (rank) saf bir işlevdir.
const fs = require('fs');
const path = require('path');
const os = require('os');

// Hiç girilmeyen klasörler (küçük harfle karşılaştırılır). Gizli klasörler (".git" dahil) ayrıca atlanır.
const SKIP_DIRS = new Set([
  'node_modules', 'bower_components', 'dist', 'build', 'out', 'target', 'coverage', '__pycache__', 'venv',
  // Windows sistem klasörleri
  'system volume information', 'windows', 'program files', 'program files (x86)', 'programdata', 'appdata', 'recovery', 'perflogs',
]);
const SKIP_FILES = new Set(['.ds_store', 'thumbs.db', 'desktop.ini']);
// maxMs: tarama süresi sınırı (ev klasörü gibi büyük köklerde o ana kadar bulunanlar kullanılır)
const DEFAULTS = { limit: 30, maxEntries: 20000, maxDepth: 12, maxMs: 2000, ttl: 30000 };
const CACHE_MAX = 8;
const cache = new Map(); // klasör + sınırlar → {at, promise}

// "Library": macOS kullanıcı kitaplığı ve Unity önbelleği; ".app": macOS uygulama paketleri
const skipDir = name => name[0] === '.' || name[0] === '$' || name === 'Library' || name.endsWith('.app') || SKIP_DIRS.has(name.toLowerCase());

// Türkçe harfleri sadeleştirir, ayraçları "/" yapar (renderer/complete.js'teki norm ile aynı eşleme)
const MAP = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };
const norm = s => String(s).toLocaleLowerCase('tr').replace(/[çğıöşüâîû]/g, c => MAP[c]).replace(/\\/g, '/');

function resolveDir(dir) {
  if (typeof dir !== 'string' || !dir || dir.length > 4096 || dir.includes('\0')) return null;
  if (dir === '~' || /^~[\\/]/.test(dir)) dir = path.join(os.homedir(), dir.slice(1));
  if (!path.isAbsolute(dir)) return null;
  try { return fs.statSync(dir).isDirectory() ? path.resolve(dir) : null; } catch { return null; }
}

// Genişlik öncelikli tarama: üst düzeydekiler sınırlara takılmadan önce toplanır
async function walk(root, opt) {
  const items = [], queue = [['', 0]], end = Date.now() + opt.maxMs;
  for (let k = 0; k < queue.length && items.length < opt.maxEntries && (k === 0 || Date.now() < end); k++) {
    const [rel, depth] = queue[k];
    let ents;
    try { ents = await fs.promises.readdir(path.join(root, rel), { withFileTypes: true }); } catch { continue; }
    ents.sort((a, b) => (a.name > b.name) - (a.name < b.name)); // sınıra takılınca hep aynı kayıtlar alınsın
    const pick = [];
    for (const e of ents) {
      if (items.length + pick.length >= opt.maxEntries) break;
      const dir = e.isDirectory();
      if (dir ? skipDir(e.name) : SKIP_FILES.has(e.name.toLowerCase())) continue;
      pick.push({ e, dir, r: rel ? rel + '/' + e.name : e.name });
    }
    await Promise.all(pick.map(async p => {
      let st = null;
      try { st = await fs.promises.stat(path.join(root, p.r)); } catch {}
      // Bağlantıların (symlink) içine girilmez; hedefi klasörse klasör olarak gösterilir
      const dir = p.dir || (!!st && p.e.isSymbolicLink() && st.isDirectory());
      items.push({ rel: p.r, name: p.e.name, dir, mtime: st ? st.mtimeMs : 0, depth });
      if (p.dir && depth + 1 < opt.maxDepth) queue.push([p.r, depth + 1]);
    }));
  }
  return items;
}

// Alt dizi eşleşmesi: ardışık harfler ve kelime/klasör başları ödüllendirilir; eşleşmezse -1
function fuzzy(t, q) {
  let score = 0, prev = -2, from = 0;
  for (const c of q) {
    const j = t.indexOf(c, from);
    if (j < 0) return -1;
    if (j === prev + 1) score += 5;
    else score += (j === 0 || /[/\-_. ]/.test(t[j - 1])) ? 4 : 1;
    prev = j; from = j + 1;
  }
  return score * 10 - Math.min(t.length, 99) / 10;
}

// Öğe puanı (büyük olan önde); eşleşmezse -1
function score(it, q) {
  if (!q) return 0;
  const k = it._k || (it._k = [norm(it.rel), norm(it.name)]); // önbellekteki öğelerde bir kez hesaplanır
  const p = k[0], n = k[1], base = n.replace(/\.[^.]*$/, '');
  if (q.includes('/')) {
    const i = p.indexOf(q);
    if (i >= 0) return 3000 - i + (i + q.length === p.length ? 100 : 0); // yazılan yolun kendisi öne
    const f = fuzzy(p, q);
    return f < 0 ? -1 : 1000 + f;
  }
  if (n === q || base === q) return 6000;
  if (n.startsWith(q)) return 5000 - Math.min(n.length - q.length, 99);
  if (n.includes(q)) return 4500 - n.indexOf(q);
  if (p.split('/').some(s => s.startsWith(q))) return 4000;
  if (p.includes(q)) return 3000 - p.indexOf(q);
  const fn = fuzzy(n, q);
  if (fn >= 0) return 2000 + fn;
  const fp = fuzzy(p, q);
  return fp < 0 ? -1 : 1000 + fp;
}

// Saf sıralama: eşleşenler puana, eşitlikte sığa (boş sorguda), sonra en son değişene, sonra kısa ada göre
function rank(items, query, limit = DEFAULTS.limit) {
  const q = norm(typeof query === 'string' ? query : '').trim().replace(/^\.\//, '');
  const out = [];
  for (const it of items) { const s = score(it, q); if (s >= 0) out.push({ it, s }); }
  out.sort((a, b) => b.s - a.s || (q ? 0 : a.it.depth - b.it.depth) || b.it.mtime - a.it.mtime || a.it.rel.length - b.it.rel.length || (a.it.rel < b.it.rel ? -1 : 1));
  return out.slice(0, limit).map(({ it }) => ({ rel: it.rel, name: it.name, dir: it.dir }));
}

async function scan(root, opt) {
  const key = [root, opt.maxEntries, opt.maxDepth, opt.maxMs].join('\0'), now = Date.now(), c = cache.get(key);
  if (c && now - c.at < opt.ttl) return c.promise;
  const e = { at: now, promise: walk(root, opt) };
  cache.delete(key); cache.set(key, e);
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return e.promise;
}

async function listFiles(dir, query, opts) {
  const opt = { ...DEFAULTS, ...(opts || {}) };
  const root = resolveDir(dir);
  if (!root) return [];
  const q = typeof query === 'string' ? query.slice(0, 200) : '';
  return rank(await scan(root, opt), q, opt.limit);
}

const clearCache = () => cache.clear();

module.exports = { listFiles, rank, norm, resolveDir, clearCache, SKIP_DIRS };
