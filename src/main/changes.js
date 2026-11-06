// Oturumun toplu farkı: bir sohbette Claude'un değiştirdiği / oluşturduğu dosyalar ve dosya bazında geri alma.
// Kaynak yalnızca oturum kayıtları (~/.claude/projects/<proje>/<oturum>.jsonl ve <oturum>/subagents/*.jsonl, YALNIZ OKUNUR).
//
// Her dosya için olaylar (Write / Edit / MultiEdit / NotebookEdit, tam Read) sırayla dizilir; her değişikliğin öncesi (B) ve
// sonrası (A) kayıttaki tam içeriklerden (toolUseResult.originalFile, Write content, type:create → dosya yoktu, tam Read)
// bilinir ya da komşu durumdan türetilir (Edit dizesini yeniden uygula / geri al; olmazsa structuredPatch). İlk hal = B[0].
// Claude Code büyük dosyalarda (~10 bin karakter üstü) originalFile yazmıyor; o zaman ilk hal yalnızca dosya oturumda
// tamamen okunduysa (Read) ya da sonraki bir kayıttan geri yürünerek kurulabilir. Kurulamazsa geri alma kapalıdır.
// Metinler LF'ye çevrilerek karşılaştırılır (kayıtlar LF tutuyor); yazarken dosyanın şimdiki satır sonu ve BOM'u korunur.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const lib = require('../renderer/changes');
const diffView = require('../renderer/diff');

const ABSENT = null; // dosya yok (oturumda oluşturulmuş); undefined = bilinmiyor
const CHANGE = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const MAX_BYTES = 8 * 1024 * 1024; // daha büyük dosyalar okunmaz / geri alınmaz
// Karşılaştırma biçimi: LF satır sonu, baştaki BOM yok (kayıtta originalFile BOM'u tutuyor, Read tutmuyor)
const N = s => typeof s === 'string' ? s.replace(/^﻿/, '').replace(/\r\n/g, '\n') : undefined;

// ---- Kayıt satırlarından olaylar ----
// side: alt ajan kaydı mı; src: kaynak sırası (birleştirmede eşit zaman damgalarını kararlı tutar)
function parseLog(text, side = false, src = 0) {
  const uses = new Map(), done = new Set(), out = [];
  for (const line of String(text).split('\n')) {
    if (!line.includes('"tool_use') && !line.includes('"tool_result')) continue;
    let e; try { e = JSON.parse(line); } catch { continue; }
    const c = e && e.message && Array.isArray(e.message.content) ? e.message.content : [];
    for (const x of c) {
      if (!x || typeof x !== 'object') continue;
      if (x.type === 'tool_use' && (CHANGE.has(x.name) || x.name === 'Read') && x.input && typeof x.input === 'object') uses.set(x.id, { name: x.name, input: x.input, ts: e.timestamp });
      else if (x.type === 'tool_result' && uses.has(x.tool_use_id) && !done.has(x.tool_use_id)) {
        const u = uses.get(x.tool_use_id); done.add(x.tool_use_id);
        if (x.is_error) continue; // hata / ret: dosya değişmedi
        const r = e.toolUseResult && typeof e.toolUseResult === 'object' ? e.toolUseResult : null;
        if (u.name === 'Read') { // yalnızca dosyanın tamamı okunduysa (metin) bir gözlemdir
          const f = r && r.type === 'text' && r.file;
          if (!f || typeof f.content !== 'string' || typeof f.filePath !== 'string' || (f.startLine || 1) !== 1 || !(f.numLines >= f.totalLines)) continue;
          out.push({ path: f.filePath, tool: 'Read', content: f.content, ts: e.timestamp || u.ts || '', side, src, seq: out.length });
          continue;
        }
        const p = (r && typeof r.filePath === 'string' && r.filePath) || u.input.file_path || u.input.notebook_path;
        if (typeof p !== 'string' || !p) continue;
        const said = typeof x.content === 'string' ? x.content : Array.isArray(x.content) ? x.content.map(b => b && b.type === 'text' ? b.text : '').join('') : '';
        out.push({ path: p, tool: u.name, input: u.input, r, said: String(said).slice(0, 80), ts: e.timestamp || u.ts || '', side, src, seq: out.length });
      }
    }
  }
  return out;
}

// ---- Metin dönüşümleri (bilinmeyende undefined) ----
// Edit: eski dize tek geçiyorsa (replace_all'da hepsi) değiştirilir
function replaceEdit(text, o, n, all) {
  if (typeof text !== 'string' || typeof o !== 'string' || !o || typeof n !== 'string') return undefined;
  const i = text.indexOf(o); if (i < 0) return undefined;
  if (all) return text.split(o).join(n);
  if (text.indexOf(o, i + 1) >= 0) return undefined; // belirsiz
  return text.slice(0, i) + n + text.slice(i + o.length);
}
// Edit'i geri al: yeni dize sonuçta tam bir kez geçiyorsa yerine eski dize konur (replace_all geri alınamaz: belirsiz)
function reverseEdit(text, o, n, all) {
  if (all || typeof text !== 'string' || typeof o !== 'string' || typeof n !== 'string' || !n) return undefined;
  const i = text.indexOf(n); if (i < 0 || text.indexOf(n, i + 1) >= 0) return undefined;
  return text.slice(0, i) + o + text.slice(i + n.length);
}
// structuredPatch (jsdiff biçimi: {oldStart, oldLines, newStart, newLines, lines:[' x','-y','+z','\\ No newline…']}) uygula;
// reverse: geri al. Bağlam ve silinen satırlar metinle birebir uymazsa undefined.
function applyPatch(text, hunks, reverse) {
  if (typeof text !== 'string' || !Array.isArray(hunks) || !hunks.length) return undefined;
  const L = text.split('\n'), real = text.endsWith('\n') ? L.length - 1 : L.length;
  const out = []; let pos = 0, noOld = false, noNew = false;
  for (const h of hunks) {
    if (!h || !Array.isArray(h.lines) || !Number.isInteger(reverse ? h.newStart : h.oldStart)) return undefined;
    const lines = h.lines.map(x => typeof x === 'string' ? x : null);
    if (lines.includes(null)) return undefined;
    const sides = lines.map(x => { const c = x[0]; return reverse ? (c === '+' ? '-' : c === '-' ? '+' : c) : c; });
    const hasOld = sides.some(c => c === ' ' || c === '-');
    if (!hasOld && text !== '') return undefined; // bağlamsız ekleme: yeri doğrulanamaz
    const start = hasOld ? (reverse ? h.newStart : h.oldStart) - 1 : 0;
    if (start < pos) return undefined;
    while (pos < start) { if (pos >= real) return undefined; out.push(L[pos++]); }
    let prev = null;
    for (let k = 0; k < lines.length; k++) {
      const c = sides[k], t = lines[k].slice(1).replace(/\r$/, '');
      if (c === '\\') { if (prev === ' ' || prev === '-') noOld = true; if (prev === ' ' || prev === '+') noNew = true; continue; }
      if (c === ' ' || c === '-') { if (pos >= real || L[pos] !== t) return undefined; pos++; if (c === ' ') out.push(t); }
      else if (c === '+') out.push(t);
      else return undefined;
      prev = c;
    }
  }
  while (pos < L.length) out.push(L[pos++]);
  if (noOld !== noNew) { if (noNew) { if (out[out.length - 1] === '') out.pop(); } else out.push(''); }
  return out.join('\n');
}
const patchCount = hunks => { let added = 0, removed = 0; for (const h of hunks) for (const l of (h && Array.isArray(h.lines) ? h.lines : [])) { if (typeof l !== 'string') continue; if (l[0] === '+') added++; else if (l[0] === '-') removed++; } return { added, removed }; };

// Bir değişiklik olayının bilinen öncesi/sonrası, ileri/geri dönüşümleri ve adım sayıları
function opsOf(ev) {
  const { tool, input, r } = ev;
  const o = { before: undefined, after: undefined, fwd: null, bwd: null, count: { added: 0, removed: 0 }, raw: !r };
  const patch = r && Array.isArray(r.structuredPatch) && r.structuredPatch.length ? r.structuredPatch : null;
  if (r && typeof r.originalFile === 'string') o.before = N(r.originalFile);
  if (tool === 'Write') {
    // Alt ajan kayıtlarında toolUseResult yok; araç sonucu metni dosyanın yeni oluşturulduğunu söyler
    if ((r && r.type === 'create') || (!r && /^File created successfully/.test(ev.said || ''))) o.before = ABSENT;
    const content = N(r && typeof r.content === 'string' ? r.content : input.content);
    o.after = content;
    if (patch) o.bwd = a => applyPatch(a, patch, true);
    o.count = patch ? patchCount(patch) : lib.count(lib.diffOps(typeof o.before === 'string' ? o.before : '', content || ''));
  } else if (tool === 'Edit') {
    const old = N(r && typeof r.oldString === 'string' ? r.oldString : input.old_string);
    const neu = N(r && typeof r.newString === 'string' ? r.newString : input.new_string);
    const all = !!(r && 'replaceAll' in r ? r.replaceAll : input.replace_all);
    // Önce kayıttaki yama (CLI'nin gerçekten yazdığı; ör. hafıza dosyalarına eklenen "modified:" damgası), olmazsa dize
    o.fwd = b => { const v = patch ? applyPatch(b, patch, false) : undefined; return v !== undefined ? v : replaceEdit(b, old, neu, all); };
    o.bwd = a => { const v = patch ? applyPatch(a, patch, true) : undefined; return v !== undefined ? v : reverseEdit(a, old, neu, all); };
    o.count = patch ? patchCount(patch) : lib.count(lib.diffOps(old, neu));
  } else if (tool === 'MultiEdit') {
    const edits = (Array.isArray(input.edits) ? input.edits : []).filter(x => x && typeof x === 'object')
      .map(x => ({ o: N(x.old_string), n: N(x.new_string), all: !!x.replace_all }));
    const seq = (t, list, f) => { if (!list.length) return undefined; for (const x of list) { t = f(t, x.o, x.n, x.all); if (t === undefined) return undefined; } return t; };
    o.fwd = b => { const v = patch ? applyPatch(b, patch, false) : undefined; return v !== undefined ? v : seq(b, edits, replaceEdit); };
    o.bwd = a => { const v = patch ? applyPatch(a, patch, true) : undefined; return v !== undefined ? v : seq(a, edits.slice().reverse(), reverseEdit); };
    o.count = patch ? patchCount(patch) : edits.reduce((s, x) => { const c = lib.count(lib.diffOps(x.o, x.n)); return { added: s.added + c.added, removed: s.removed + c.removed }; }, { added: 0, removed: 0 });
  } else { // NotebookEdit: hücre düzenlemesi; kayıttan dönüşüm kurulamaz (yalnızca originalFile varsa öncesi bilinir)
    o.note = true;
    o.count = lib.count(lib.diffOps('', N(input.new_source) || ''));
  }
  return o;
}

const keyOf = (p, platform) => { const k = path.normalize(p); return platform === 'win32' || platform === 'darwin' ? k.toLowerCase() : k; };

// Bir dosyanın olaylarından ilk hal, son bilinen hal ve sayılar
function buildFile(evs) {
  const ch = evs.filter(e => e.tool !== 'Read');
  const n = ch.length, ops = ch.map(opsOf);
  const B = ops.map(o => o.before), A = ops.map(o => o.after);
  // Tam Read: sonraki değişiklikten hemen önceki hal (Claude Code okumadan sonra dosya değiştiyse düzenlemeyi reddeder)
  const reads = new Array(n).fill(undefined); let k = 0;
  for (const e of evs) { if (e.tool === 'Read') { if (k < n) reads[k] = N(e.content); } else k++; }
  // İleri ve geri taramalar; bir dönüşüm aynı girdiyle bir kez denenir (girdi bir kez belirlenir, sonra değişmez)
  const triedF = new Array(n).fill(false), triedB = new Array(n).fill(false);
  const step = i => {
    let c = false;
    if (B[i] !== undefined && A[i] === undefined && ops[i].fwd && !triedF[i]) { triedF[i] = true; const v = ops[i].fwd(B[i]); if (v !== undefined) { A[i] = v; c = true; } }
    if (A[i] !== undefined && B[i] === undefined && ops[i].bwd && !triedB[i]) { triedB[i] = true; const v = ops[i].bwd(A[i]); if (v !== undefined) { B[i] = v; c = true; } }
    return c;
  };
  const propagate = () => {
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < n; i++) {
        if (step(i)) changed = true;
        if (i + 1 < n && A[i] !== undefined && B[i + 1] === undefined) { B[i + 1] = A[i]; changed = true; }
      }
      for (let i = n - 1; i >= 0; i--) {
        if (step(i)) changed = true;
        if (i > 0 && B[i] !== undefined && A[i - 1] === undefined) { A[i - 1] = B[i]; changed = true; }
      }
    }
  };
  propagate();
  const strong = B[0] !== undefined;
  for (let i = 0; i < n; i++) if (B[i] === undefined && reads[i] !== undefined) B[i] = reads[i];
  propagate();
  const initial = B[0], last = A[n - 1];
  let between = false; for (let i = 0; i + 1 < n; i++) if (A[i] !== undefined && B[i + 1] !== undefined && A[i] !== B[i + 1]) between = true;
  const stepSum = ops.reduce((s, o) => ({ added: s.added + o.count.added, removed: s.removed + o.count.removed }), { added: 0, removed: 0 });
  const exact = initial !== undefined && last !== undefined;
  const cnt = exact ? lib.count(lib.diffOps(initial || '', last || '')) : stepSum;
  let reason = '';
  if (initial === undefined) reason = ops.some(o => o.note) ? 'NotebookEdit kaydından defterin önceki hali kurulamıyor.'
    : ops.some(o => o.raw) ? 'Kayıtta araç sonucu (toolUseResult) yok (alt ajan ya da eski kayıt); dosyanın önceki hali kurulamıyor.'
    : 'Kayıtta dosyanın tam içeriği yok: Claude Code büyük dosyalarda önceki içeriği (originalFile) yazmıyor ve dosya oturumda baştan sona okunmamış.';
  return {
    path: ch[0].path, created: initial === ABSENT, initial, last, added: cnt.added, removed: cnt.removed, approx: !exact,
    canRevert: initial !== undefined, reason, weak: initial !== undefined && !strong, between,
    side: ch.every(e => e.side), anySide: ch.some(e => e.side), edits: n, firstTs: ch[0].ts, lastTs: ch[n - 1].ts,
    steps: ch.map((e, i) => ({ tool: e.tool, ts: e.ts, side: e.side, added: ops[i].count.added, removed: ops[i].count.removed, d: diffView.data(e.tool, e.input) })),
  };
}

// Kaynaklar ([{text, side}]) → dosya listesi (ilk değişiklik sırasıyla)
function collect(sources, platform = process.platform) {
  const evs = [];
  sources.forEach((s, i) => { for (const e of parseLog(s.text, !!s.side, i)) evs.push(e); });
  evs.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.src - b.src || a.seq - b.seq));
  const by = new Map();
  for (const e of evs) { const k = keyOf(e.path, platform); if (!by.has(k)) by.set(k, []); by.get(k).push(e); }
  const out = [];
  for (const list of by.values()) if (list.some(e => e.tool !== 'Read')) out.push(buildFile(list));
  return out;
}

// ---- Dosyanın şimdiki hali ----
function decode(buf) {
  let enc = 'utf8', bom = '', body = buf;
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) { bom = 'utf8'; body = buf.subarray(3); }
  else if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) { enc = bom = 'utf16le'; body = buf.subarray(2); }
  else if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) { enc = bom = 'utf16be'; body = Buffer.from(buf.subarray(2)).swap16(); }
  if (enc !== 'utf8' && body.length % 2) return null;
  const text = body.toString(enc === 'utf8' ? 'utf8' : 'utf16le');
  if (enc === 'utf8' && !Buffer.from(text, 'utf8').equals(body)) return null; // UTF-8 değil: dokunma
  return { text: N(text), fmt: { bom, eol: /\r\n/.test(text) ? '\r\n' : '\n' } };
}
function encode(text, fmt = { bom: '', eol: '\n' }) {
  const t = fmt.eol === '\r\n' ? text.replace(/\r?\n/g, '\r\n') : text;
  if (fmt.bom === 'utf16le') return Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(t, 'utf16le')]);
  if (fmt.bom === 'utf16be') return Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(t, 'utf16le').swap16()]);
  const b = Buffer.from(t, 'utf8');
  return fmt.bom === 'utf8' ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), b]) : b;
}
const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');
function readCurrent(p) {
  let st;
  try { st = fs.lstatSync(p); } catch (e) { return e.code === 'ENOENT' || e.code === 'ENOTDIR' ? { exists: false, hash: 'yok' } : { error: 'Okunamadı: ' + e.code, hash: 'hata' }; }
  if (st.isSymbolicLink()) return { error: 'Yol sembolik bir bağ; güvenlik için dokunulmaz.', hash: 'bag' };
  if (!st.isFile()) return { error: 'Bu yol bir dosya değil.', hash: 'dosya-degil' };
  if (st.size > MAX_BYTES) return { error: 'Dosya çok büyük (8 MB üstü).', hash: 'buyuk:' + st.size + ':' + st.mtimeMs };
  const buf = fs.readFileSync(p), dec = decode(buf);
  if (!dec) return { error: 'Dosya UTF-8 / UTF-16 metin değil.', hash: sha(buf) };
  return { exists: true, hash: sha(buf), text: dec.text, fmt: dec.fmt, mode: st.mode };
}
// Şimdiki hal ↔ kayıt: initial | same | outside | unverified | missing | unreadable
function classify(f, cur) {
  if (cur.error) return 'unreadable';
  if (!cur.exists) return 'missing';
  if (typeof f.initial === 'string' && cur.text === f.initial) return 'initial';
  if (typeof f.last !== 'string') return 'unverified';
  return cur.text === f.last ? 'same' : 'outside';
}
const needsAck = (f, c) => c === 'outside' || c === 'unverified' || (c === 'missing' && !f.created);

// ---- Yol güvenliği ----
function checkPath(p, { platform = process.platform, projectsDir } = {}) {
  if (typeof p !== 'string' || !p || p.length > 4096 || p.includes('\0')) throw new Error('Geçersiz yol.');
  if (!path.isAbsolute(p) || /^[\\/]{2}[?.][\\/]/.test(p)) throw new Error('Yol mutlak değil ya da aygıt yolu.');
  if (p.split(/[\\/]/).includes('..') || path.resolve(p) !== path.normalize(p)) throw new Error('Yol geçişi (..) içeren yol reddedildi.');
  const ci = platform === 'win32' || platform === 'darwin', cmp = s => ci ? s.toLowerCase() : s;
  if (projectsDir) { const rel = path.relative(projectsDir, p); if (!rel.startsWith('..') && !path.isAbsolute(rel) && /\.jsonl$/i.test(p)) throw new Error('Oturum kayıtlarına dokunulmaz.'); }
  // Sembolik bağ / junction hilesi: var olan en yakın üst klasörün gerçek yolu yazılı yolla aynı olmalı
  let probe = path.resolve(p);
  while (!fs.existsSync(probe)) { const up = path.dirname(probe); if (up === probe) break; probe = up; }
  let real; try { real = fs.realpathSync(probe); } catch { throw new Error('Yol çözümlenemedi.'); }
  if (cmp(real) !== cmp(probe)) throw new Error('Yol sembolik bağ / junction üzerinden geçiyor; güvenlik için geri alınmaz.');
  return path.resolve(p);
}

// ---- Oturum kaynakları (ana kayıt + alt ajanlar), önbellekli ----
async function sourcesOf(sessionFile) {
  const files = [{ file: sessionFile, side: false }];
  const sub = path.join(path.dirname(sessionFile), path.basename(sessionFile, '.jsonl'), 'subagents');
  try { for (const n of (await fsp.readdir(sub)).sort()) if (n.endsWith('.jsonl')) files.push({ file: path.join(sub, n), side: true }); } catch {}
  const stats = await Promise.all(files.map(f => fsp.stat(f.file).then(s => s.size + ':' + s.mtimeMs, () => '-')));
  return { files, key: files.map((f, i) => f.file + '|' + stats[i]).join(';') };
}
function createChanges({ platform = process.platform, projectsDir, backupDir, trash } = {}) {
  const cache = new Map(); // oturum dosyası → {key, list}
  async function load(sessionFile) {
    const { files, key } = await sourcesOf(sessionFile);
    const c = cache.get(sessionFile); if (c && c.key === key) return c.list;
    const texts = await Promise.all(files.map(f => fsp.readFile(f.file, 'utf8').then(text => ({ text, side: f.side }), () => ({ text: '', side: f.side }))));
    const list = collect(texts, platform);
    cache.set(sessionFile, { key, list }); if (cache.size > 8) cache.delete(cache.keys().next().value);
    return list;
  }
  const brief = (f, cur) => {
    const c = classify(f, cur);
    return { path: f.path, created: f.created, added: f.added, removed: f.removed, approx: f.approx, canRevert: f.canRevert, reason: f.reason,
      weak: f.weak, between: f.between, side: f.side, anySide: f.anySide, edits: f.edits, firstTs: f.firstTs, lastTs: f.lastTs,
      cur: c, curError: cur.error || '', hash: cur.hash, ack: needsAck(f, c) };
  };
  return {
    async list(sessionFile) { return (await load(sessionFile)).map(f => brief(f, readCurrent(f.path))); },
    async diff(sessionFile, p) {
      const f = (await load(sessionFile)).find(x => x.path === p); if (!f) throw new Error('Bu dosya bu oturumun kayıtlarında yok.');
      const cur = readCurrent(f.path), cap = s => typeof s === 'string' && s.length > 2e6 ? false : s;
      return { ...brief(f, cur), initial: cap(f.initial), last: cap(f.last), current: cur.exists ? cap(cur.text) : cur.error ? undefined : null, steps: f.steps };
    },
    async revert(sessionFile, p, opts = {}) {
      const f = (await load(sessionFile)).find(x => x.path === p);
      if (!f) throw new Error('Bu dosya bu oturumun kayıtlarında yok.');
      const target = checkPath(f.path, { platform, projectsDir });
      if (!f.canRevert) throw new Error(f.reason);
      const cur = readCurrent(target), c = classify(f, cur);
      if (cur.hash !== opts.hash) throw new Error('Dosya, önizlemeden sonra değişti. Listeyi yenileyip yeniden dene.');
      if (c === 'unreadable') throw new Error(cur.error);
      if (needsAck(f, c) && !opts.ack) throw new Error('Dosya oturum dışında değişmiş; geri almak için ayrıca onay gerekiyor.');
      if (c === 'initial' || (f.created && !cur.exists)) return { ok: true, action: 'none' };
      let backup = null;
      if (cur.exists) { // şimdiki içeriği yedekle
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const dir = path.join(backupDir, stamp + '-' + crypto.randomBytes(3).toString('hex'));
        fs.mkdirSync(dir, { recursive: true });
        backup = path.join(dir, path.basename(target));
        fs.copyFileSync(target, backup, fs.constants.COPYFILE_EXCL);
        fs.writeFileSync(path.join(dir, 'bilgi.json'), JSON.stringify({ yol: target, oturum: path.basename(sessionFile, '.jsonl'), zaman: new Date().toISOString(), islem: f.created ? 'cop-kutusu' : 'ilk-hal' }, null, 1));
      }
      if (f.created) { await trash(target); return { ok: true, action: 'trash', backup }; }
      const buf = encode(f.initial, cur.exists ? cur.fmt : undefined);
      const tmp = path.join(path.dirname(target), '.' + path.basename(target) + '.cp-geri-' + crypto.randomBytes(4).toString('hex') + '.tmp');
      try {
        fs.writeFileSync(tmp, buf, { flag: 'wx', mode: cur.exists ? cur.mode & 0o777 : 0o666 });
        fs.renameSync(tmp, target);
      } catch (e) { try { fs.unlinkSync(tmp); } catch {} throw new Error('Yazılamadı: ' + e.message); }
      return { ok: true, action: cur.exists ? 'write' : 'create', backup };
    },
  };
}

module.exports = { parseLog, replaceEdit, reverseEdit, applyPatch, opsOf, buildFile, collect, decode, encode, readCurrent, classify, needsAck, checkPath, sourcesOf, createChanges, ABSENT };
