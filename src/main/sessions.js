// Claude Code oturumlarını ~/.claude/projects/<proje>/<oturum>.jsonl dosyalarından okur.
// Büyük dosyalar (60 MB+) için özet çıkarırken dosyanın yalnızca başı ve sonu okunur;
// sonuçlar mtime/boyut ile önbelleğe alınır, değişmeyen dosyalar yeniden okunmaz.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const readline = require('readline');
// Arayüzle ortak saf modüller (görev listesi, arka plan görevleri, alt ajanlar): ayrıştırma ve canlı akış aynı kodu kullanır
const todos = require('../renderer/todos.js');
const bgtasks = require('../renderer/bgtasks.js');
const subagents = require('../renderer/subagents.js');

const HOME = os.homedir();
const PROJECTS_DIR = path.join(HOME, '.claude', 'projects');
const HEAD_BYTES = 256 * 1024;
const TAIL_BYTES = 768 * 1024;
const LIVE_MS = 90 * 1000; // son 90 sn içinde yazıldıysa "başka yerde aktif"
const isLive = mtimeMs => Date.now() - mtimeMs < LIVE_MS;
// Araç sonuçlarındaki görseller (ekran görüntüleri vb.) oturum dosyasında base64 durur; arayüze taşımak yerine
// bir kez diske yazılır (içerik özetine göre adlandırılır, aynı görsel tekrar yazılmaz) ve yol olarak gönderilir.
const IMG_DIR = path.join(process.env.CLAUDE_PANEL_HOME || path.join(HOME, '.claude-panel'), 'gorseller');
const IMG_EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' };
const IMG_RX = /\.(png|jpe?g|gif|webp)$/i;
const IMG_REF_RX = /\[Image: source: ([^\]\n]+)\]/g;
const MAX_IMGS = 8;
function cacheImage(b) {
  try {
    const src = b.source; if (!src || src.type !== 'base64' || !src.data || !IMG_EXT[src.media_type]) return null;
    const f = path.join(IMG_DIR, crypto.createHash('sha1').update(src.data).digest('hex').slice(0, 24) + IMG_EXT[src.media_type]);
    if (!fs.existsSync(f)) { fs.mkdirSync(IMG_DIR, { recursive: true }); fs.writeFileSync(f + '.tmp', Buffer.from(src.data, 'base64')); fs.renameSync(f + '.tmp', f); }
    return f;
  } catch { return null; }
}
// İçerikteki görseller: base64 bloklar + metindeki "[Image: source: <mutlak yol>]" başvuruları (dosya hâlâ duruyorsa)
function imagesOf(content) {
  const out = [];
  const add = p => { if (p && out.length < MAX_IMGS && !out.includes(p)) out.push(p); };
  const refs = t => { for (const m of t.matchAll(IMG_REF_RX)) { const p = m[1].trim(); if (IMG_RX.test(p) && path.isAbsolute(p) && fs.existsSync(p)) add(p); } };
  if (typeof content === 'string') refs(content);
  else if (Array.isArray(content)) for (const c of content) {
    if (c.type === 'image') add(cacheImage(c));
    else if (c.type === 'text' && c.text) refs(c.text);
  }
  return out;
}
// 30 günden eski önbellek görsellerini temizle (açılışta, arka planda)
function pruneImages(days = 30, dir = IMG_DIR, now = Date.now()) {
  const old = ms => now - ms > days * 864e5;
  return fsp.readdir(dir).then(names => Promise.all(names.map(async n => { const f = path.join(dir, n);
    try { const st = await fsp.stat(f); if (old(st.atimeMs) && old(st.mtimeMs)) await fsp.unlink(f); } catch {} }))).catch(() => {});
}

// ~ kısaltması: yalnızca tam ev klasörü ya da "ev klasörü + ayraç" ile başlayan yollar (C:\Users\Ali2 → ~2 olmasın);
// Windows/macOS'ta büyük/küçük harf duyarsız karşılaştırılır, Windows'ta "/" da ayraç sayılır.
function makeTilde(home, platform) {
  const win = platform === 'win32', ci = win || platform === 'darwin';
  const norm = s => ci ? s.toLowerCase() : s;
  const h = norm(home);
  return p => {
    if (!p) return p;
    // Önek, özgün uzunlukta kesilip karşılaştırılır (küçük harfe çevirince uzunluğu değişen harfler, ör. "İ", kaydırmasın)
    if (norm(p.slice(0, home.length)) !== h) return p;
    const rest = p.slice(home.length);
    if (!rest) return '~';
    if (rest[0] === '/' || (win && rest[0] === '\\')) return '~' + rest;
    return p;
  };
}
const tilde = makeTilde(HOME, process.platform);

function prettyModel(id) {
  if (!id || id === '<synthetic>') return '';
  const m = /claude-([a-z]+)-(\d+)(?:-(\d+))?/.exec(id);
  if (!m) return id;
  return m[1][0].toUpperCase() + m[1].slice(1) + ' ' + m[2] + (m[3] && m[3].length < 3 ? '.' + m[3] : '');
}

function parseLines(text, dropFirst, dropLast) {
  const lines = text.split('\n');
  if (dropFirst) lines.shift();
  if (dropLast) lines.pop();
  const out = [];
  for (const l of lines) {
    if (!l) continue;
    let v; try { v = JSON.parse(l); } catch { continue; /* yarım satır */ }
    if (v) out.push(v); // "null" satırı e.cwd okurken patlatmasın
  }
  return out;
}

async function readRange(file, start, length) {
  const fh = await fsp.open(file, 'r');
  try {
    const buf = Buffer.alloc(length);
    const { bytesRead } = await fh.read(buf, 0, length, start);
    return buf.subarray(0, bytesRead).toString('utf8');
  } finally { await fh.close(); }
}

// Kullanıcının yazdığı metni çıkar (komut/sistem etiketlerini ayıkla)
function userText(content) {
  let t = '';
  if (typeof content === 'string') t = content;
  else if (Array.isArray(content)) t = content.filter(c => c.type === 'text').map(c => c.text).join('\n');
  t = t.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
  return t;
}
const isNoise = t => !t || /^<(command-|local-command|bash-|user-memory|task-notification)/.test(t) || t.startsWith('[Request interrupted');

async function summarize(file) {
  const st = await fsp.stat(file);
  const size = st.size;
  const big = size > HEAD_BYTES; // büyük dosyada baştaki parçanın son satırı yarım kalabilir
  const head = parseLines(await readRange(file, 0, Math.min(size, HEAD_BYTES)), false, big);
  let tail = head;
  if (big) {
    // Bir bayt fazla okunur: ilk (yarım ya da boş) parça atılınca son TAIL_BYTES içinde başlayan satırların hepsi kalır
    // (tam satır başından kesilince o satır da atılıyordu).
    const start = Math.max(0, size - TAIL_BYTES - 1);
    tail = parseLines(await readRange(file, start, size - start), start > 0, false);
  }
  const id = path.basename(file, '.jsonl');
  let cwd = null, firstPrompt = null, firstTs = null;
  for (const e of head) {
    if (!cwd && e.cwd) cwd = e.cwd;
    if (!firstTs && e.timestamp) firstTs = e.timestamp;
    if (!firstPrompt && e.type === 'user' && !e.isMeta && !e.isSidechain) {
      const t = userText(e.message && e.message.content);
      if (!isNoise(t)) firstPrompt = t;
    }
    if (!cwd) cwd = e.attachment?.snapshot?.workingDirectory || null;
  }
  let title = null, lastTs = null, model = null, usage = null, lastPrompt = null, bridge = false, permissionMode = null;
  for (const e of tail) {
    if (e.type === 'custom-title' && e.customTitle) title = e.customTitle;
    if (e.type === 'last-prompt' && e.lastPrompt) lastPrompt = e.lastPrompt;
    if (e.type === 'bridge-session') bridge = true;
    if (e.type === 'user' && e.permissionMode) permissionMode = e.permissionMode;
    if (e.timestamp) lastTs = e.timestamp;
    if (!cwd && e.cwd) cwd = e.cwd;
    if (e.type === 'assistant' && e.message && !e.isSidechain) {
      if (e.message.model && e.message.model !== '<synthetic>') model = e.message.model;
      if (e.message.usage) usage = e.message.usage;
    }
  }
  // Kuyrukta başlık kaydı yoksa baştakine bak (başlık erken verilip oturum uzadıysa kaybolmasın)
  if (!title) for (const e of head) if (e.type === 'custom-title' && e.customTitle) title = e.customTitle;
  const ctxTokens = usage ? (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.output_tokens || 0) : 0;
  const fallback = (firstPrompt || lastPrompt || '').replace(/\s+/g, ' ').slice(0, 70);
  return {
    id, file, size, mtimeMs: st.mtimeMs,
    title: title || fallback || 'Adsız sohbet',
    cwd, project: tilde(cwd) || '(bilinmiyor)',
    firstTs, lastTs: lastTs || new Date(st.mtimeMs).toISOString(),
    model: prettyModel(model), modelId: model,
    ctxTokens, bridge, permissionMode,
    live: isLive(st.mtimeMs),
  };
}

class SessionIndex {
  constructor(cacheFile) {
    this.cacheFile = cacheFile;
    this.map = new Map(); // id -> summary
    this.queue = Promise.resolve();
    try {
      const raw = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (raw.v === 2) for (const s of raw.sessions || []) this.map.set(s.id, s); // eski biçimli önbellek yeniden üretilir
    } catch { /* ilk çalıştırma */ }
  }
  async listFiles() {
    let dirs = [];
    try { dirs = await fsp.readdir(PROJECTS_DIR, { withFileTypes: true }); } catch { return []; }
    const files = [];
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const dir = path.join(PROJECTS_DIR, d.name);
      let ents = [];
      try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch { continue; }
      for (const f of ents) if (f.isFile() && f.name.endsWith('.jsonl')) files.push(path.join(dir, f.name));
    }
    return files;
  }
  // Aynı anda birden çok yerden (izleyici, zamanlayıcı, arayüz) çağrılabilir: sıraya alınır, paylaşılan harita yarışmaz
  refresh(onlyFiles) {
    const run = () => this._refresh(onlyFiles);
    this.queue = this.queue.then(run, run);
    return this.queue;
  }
  async _refresh(onlyFiles) {
    const files = onlyFiles || await this.listFiles();
    const seen = new Set();
    const changed = [];
    await Promise.all(files.map(async file => {
      const id = path.basename(file, '.jsonl');
      seen.add(id);
      let st;
      try { st = await fsp.stat(file); } catch { if (this.map.delete(id)) changed.push(id); return; } // silinmiş
      const prev = this.map.get(id);
      if (prev && prev.mtimeMs === st.mtimeMs && prev.size === st.size) {
        prev.live = isLive(st.mtimeMs);
        return;
      }
      try { this.map.set(id, await summarize(file)); changed.push(id); } catch (e) { console.warn('özet okunamadı', file, e.message); }
    }));
    if (!onlyFiles) for (const id of [...this.map.keys()]) if (!seen.has(id)) { this.map.delete(id); changed.push(id); }
    this.save();
    return changed;
  }
  list() { return [...this.map.values()].sort((a, b) => (b.lastTs || '').localeCompare(a.lastTs || '')); }
  get(id) { return this.map.get(id); }
  save() {
    try {
      fs.mkdirSync(path.dirname(this.cacheFile), { recursive: true });
      fs.writeFileSync(this.cacheFile, JSON.stringify({ v: 2, sessions: [...this.map.values()] }));
    } catch (e) { console.warn('index yazılamadı', e.message); }
  }
}

// ---------- Tam oturum: arayüzde gösterilecek mesajlar ----------
function toolSummary(name, input) {
  if (!input) return '';
  const pick = input.command || input.file_path || input.path || input.pattern || input.url || input.query || input.description || input.prompt || input.skill || '';
  return tilde(String(pick)).replace(/\s+/g, ' ').slice(0, 300);
}
// Claude uygulamasının tur araçları: "sonraki adım" kutusu (wrap_up) ve görev listesi (update_plan) kart olarak gösterilir
function turnCard(name, input) {
  if (!input || typeof name !== 'string') return null;
  const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
  if (/(^|__)wrap_up$/.test(name)) {
    const actions = Array.isArray(input.actions) ? input.actions.map(a => str(a && a.label, 40)).filter(Boolean).slice(0, 3) : [];
    return { card: { recap: str(input.recap, 1200), ask: str(input.ask, 300), actions } };
  }
  if (/(^|__)update_plan$/.test(name)) {
    if (!Array.isArray(input.items)) return { plan: null };
    return { plan: input.items.slice(0, 12).map(i => ({ c: str(i && i.content, 120), s: ['completed', 'in_progress'].includes(i && i.status) ? i.status : 'pending' })) };
  }
  return null;
}
function resultText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(c => c.type === 'text' ? c.text : c.type === 'image' ? '[görsel]' : '').join('\n');
  return '';
}

/**
 * Oturumu akış halinde okur ve görüntülenecek mesajlara çevirir.
 * Uzun oturumlarda yalnızca son `limit` tur tutulur (eski turlar `skipped` sayısında).
 * Ayrıca Write/Edit/NotebookEdit ile değiştirilen dosyaları "çıktılar" olarak toplar.
 */
// Ayrıştırma durumu satır satır beslenir; tam okuma (loadSession) ve artımlı okuma (SessionLoader) aynı kodu kullanır.
const newParse = () => ({ msgs: [], toolById: new Map(), outputs: new Map(), turns: 0, todo: todos.newState(), bg: bgtasks.newState() });
const MAXTH = 20000; // tek düşünme bloğunda tutulan en çok karakter
const NOTIF_RX = /^(\[SYSTEM NOTIFICATION[^\n]*\n[\s\S]*?)?<task-notification>/;
// Arka plan görevi bildirimi (<task-notification>): görev listesini günceller; ilgili alt ajan bloğu da biter
function feedNotif(st, text, ts) {
  const n = bgtasks.notif(st.bg, text, ts); if (!n) return false;
  const tool = n.tu && st.toolById.get(n.tu);
  if (tool && tool.sa) subagents.onNotif(tool.sa, n);
  return true;
}
function feedLine(st, line, side) {
  if (!line) return;
  let e; try { e = JSON.parse(line); } catch { return; }
  if (!e || (e.isSidechain && !side)) return; // "null" satırı da atlanır; alt ajan dosyası okunurken (side) yan zincir satırları alınır
  // Arka plan görevi bildirimleri kayıtta sıraya alınmış komut eki olarak durur
  if (e.type === 'attachment' && e.attachment && e.attachment.type === 'queued_command' && typeof e.attachment.prompt === 'string') { feedNotif(st, e.attachment.prompt, e.timestamp); return; }
  if (e.type === 'user' && e.message) {
    const c = e.message.content;
    if (Array.isArray(c) && c.some(x => x.type === 'tool_result')) {
      for (const x of c) if (x.type === 'tool_result') {
        const tool = st.toolById.get(x.tool_use_id);
        const txt = resultText(x.content);
        if (tool) { tool.o = txt.slice(0, 1500); if (x.is_error) tool.err = true; const im = imagesOf(x.content); if (im.length) tool.imgs = im;
          if (tool.sa) subagents.onResult(tool.sa, e.toolUseResult, x.is_error); }
        todos.result(st.todo, x.tool_use_id, txt, e.toolUseResult, x.is_error);
        bgtasks.result(st.bg, x.tool_use_id, txt, e.toolUseResult, x.is_error, e.timestamp);
      }
      return;
    }
    if (e.isMeta) return;
    const t = userText(c);
    // Yalnız CLI'nin kendi bildirimi (metin bildirimle başlar): kullanıcının yapıştırdığı metin görev sanılmaz
    if (NOTIF_RX.test(t) && feedNotif(st, t, e.timestamp)) return;
    if (isNoise(t)) return;
    const um = { r: 'u', t: t.slice(0, 8000), ts: e.timestamp }; const uim = imagesOf(c); if (uim.length) um.imgs = uim;
    st.msgs.push(um);
    st.turns++;
    return;
  }
  if (e.type === 'assistant' && e.message && Array.isArray(e.message.content)) {
    let last = st.msgs[st.msgs.length - 1];
    if (!last || last.r !== 'a') { last = { r: 'a', b: [], ts: e.timestamp }; st.msgs.push(last); }
    for (const c of e.message.content) {
      if (c.type === 'text' && c.text && c.text.trim()) last.b.push({ t: 'text', v: c.text });
      // Düşünme: yalnızca metni kaydedilmişse (boş + signature olan bloklar gösterilmez)
      else if (c.type === 'thinking' && typeof c.thinking === 'string' && c.thinking.trim()) last.b.push({ t: 'think', v: c.thinking.slice(0, MAXTH) });
      else if (c.type === 'tool_use') {
        const tool = { t: 'tool', n: c.name, a: toolSummary(c.name, c.input), o: '', id: c.id };
        const card = turnCard(c.name, c.input); if (card) Object.assign(tool, card);
        const td = todos.apply(st.todo, c.name, c.input, c.id); if (td) tool.todo = td;
        if (subagents.isAgentTool(c.name)) tool.sa = subagents.info(c.id, c.input);
        bgtasks.use(st.bg, c.id, c.name, c.input, e.timestamp);
        last.b.push(tool); st.toolById.set(c.id, tool);
        const fp = c.input && (c.input.file_path || c.input.notebook_path);
        if (fp && /^(Write|Edit|MultiEdit|NotebookEdit)$/.test(c.name)) st.outputs.set(fp, { path: tilde(fp), tool: c.name, ts: e.timestamp });
      }
    }
  }
}
// Sonuç durumdan kopya olarak üretilir (durum artımlı okumada sonra da kullanılır, değiştirilmez):
// son `limit` kullanıcı turu tutulur, araç kimlikleri atılır, boş asistan mesajları çıkarılır.
function finishParse(st, limit) {
  let list = st.msgs, skipped = 0;
  if (st.turns > limit) {
    const userAt = [];
    list.forEach((m, i) => { if (m.r === 'u') userAt.push(i); });
    skipped = st.turns - limit;
    list = list.slice(userAt[skipped]);
  }
  const msgs = list.filter(m => m.r === 'u' || m.b.length)
    .map(m => m.r === 'a' ? { ...m, b: m.b.map(b => { if (b.t !== 'tool') return b; const { id, ...rest } = b; if (rest.sa) rest.sa = { ...rest.sa }; return rest; }) } : m);
  // Alt ajan bilgisi (sa) ve görev listeleri kopyalanır: artımlı okumada durum sonradan değişse de gönderilen sonuç değişmez
  return { msgs, skipped, turns: st.turns, outputs: [...st.outputs.values()].reverse(),
    todo: st.todo.items.map(i => ({ ...i })), bg: st.bg.list.map(t => ({ ...t })) };
}

/**
 * Oturumu akış halinde okur ve görüntülenecek mesajlara çevirir.
 * Uzun oturumlarda yalnızca son `limit` tur tutulur (eski turlar `skipped` sayısında).
 * Ayrıca Write/Edit/NotebookEdit ile değiştirilen dosyaları "çıktılar" olarak toplar.
 */
async function loadSession(file, limit = 60) {
  const st = newParse();
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) feedLine(st, line);
  return finishParse(st, limit);
}

/**
 * Alt ajanın kaydı: `<oturum>/subagents/agent-<agentId>.jsonl` (agentId Agent aracının sonucunda yazar). Kimlik
 * bilinmiyorsa `agent-*.meta.json` içindeki toolUseId ile bulunur. Dönen: {b: alt ajanın metin/araç blokları, cut}
 * ya da dosya yoksa null. Kimlikler yalnızca [\w-] karakterlerinden oluşabilir (yol geçişi olmasın).
 */
const SAFE_ID = /^[\w-]{1,80}$/;
async function loadSubagent(sessionFile, toolId, agentId, max = subagents.MAXB) {
  const dir = path.join(sessionFile.replace(/\.jsonl$/, ''), 'subagents');
  let file = null;
  if (agentId && SAFE_ID.test(agentId)) { const f = path.join(dir, 'agent-' + agentId + '.jsonl'); if (fs.existsSync(f)) file = f; }
  if (!file && toolId && SAFE_ID.test(toolId)) {
    let names = []; try { names = await fsp.readdir(dir); } catch { return null; }
    for (const n of names) {
      if (!/^agent-[\w-]+\.meta\.json$/.test(n)) continue;
      let j; try { j = JSON.parse(await fsp.readFile(path.join(dir, n), 'utf8')); } catch { continue; }
      if (j && j.toolUseId === toolId) { file = path.join(dir, n.replace(/\.meta\.json$/, '.jsonl')); break; }
    }
  }
  if (!file || !fs.existsSync(file)) return null;
  const st = newParse();
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) feedLine(st, line, true);
  const b = [];
  for (const m of finishParse(st, Infinity).msgs) if (m.r === 'a') b.push(...m.b);
  const cut = Math.max(0, b.length - max);
  return { b: cut ? b.slice(cut) : b, cut };
}

/**
 * Açık oturumlar için artımlı yükleyici: dosya büyüdükçe yalnızca yeni eklenen satırlar ayrıştırılır.
 * Başka yerde sürekli yazılan uzun bir oturum (onlarca MB) her değişiklikte baştan okunmaz.
 * Dosya kısalır ya da değiştirilirse (farklı inode) baştan okunur. Son `max` dosyanın durumu bellekte tutulur.
 */
class SessionLoader {
  constructor(max = 8, chunk = 8 * 1024 * 1024) { this.max = max; this.chunk = chunk; this.cache = new Map(); }
  async load(file, limit = 60) {
    const stat = await fsp.stat(file);
    let c = this.cache.get(file);
    if (!c || stat.size < c.offset || stat.ino !== c.ino) c = { st: newParse(), offset: 0, ino: stat.ino };
    this.cache.delete(file); this.cache.set(file, c);
    while (this.cache.size > this.max) this.cache.delete(this.cache.keys().next().value);
    if (stat.size > c.offset) {
      const fh = await fsp.open(file, 'r');
      try {
        let carry = Buffer.alloc(0), pos = c.offset;
        while (pos < stat.size) {
          const buf = Buffer.alloc(Math.min(this.chunk, stat.size - pos));
          const { bytesRead } = await fh.read(buf, 0, buf.length, pos);
          if (!bytesRead) break;
          pos += bytesRead;
          const b = carry.length ? Buffer.concat([carry, buf.subarray(0, bytesRead)]) : buf.subarray(0, bytesRead);
          const end = b.lastIndexOf(10);
          if (end < 0) { carry = b; continue; }
          for (const line of b.subarray(0, end).toString('utf8').split('\n')) feedLine(c.st, line.replace(/\r$/, ''));
          c.offset += end + 1;
          carry = b.subarray(end + 1);
        }
        // Satır sonu olmayan son satır: tam bir JSON ise işlenir; yarımsa bir sonraki okumada baştan denenir
        if (carry.length) { const r = carry.toString('utf8').replace(/\r$/, ''); let ok = false; try { JSON.parse(r); ok = true; } catch {}
          if (ok) { feedLine(c.st, r); c.offset += carry.length; } }
      } finally { await fh.close(); }
    }
    return finishParse(c.st, limit);
  }
}

module.exports = { turnCard, SessionIndex, loadSession, loadSubagent, SessionLoader, summarize, PROJECTS_DIR, tilde, makeTilde, prettyModel, imagesOf, pruneImages, IMG_DIR };
