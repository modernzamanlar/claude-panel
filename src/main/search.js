// Faz 4: Tüm sohbet içeriklerinde arama — SQLite FTS5 (Electron'un yerleşik node:sqlite'ı, ek kütüphane yok).
// Her oturumdan yalnızca okunabilir metin çıkarılır (başlık, kullanıcı/asistan mesajları, araç adı + komut/yol)
// ve mesaj başına bir satır olarak ~/.claude-panel/search.db'ye yazılır. Metin belleğe yüklenmez.
// Değişmeyen oturumlar yeniden işlenmez (mtime/boyut). Arama Türkçe karakterlere duyarsızdır (ş=s, ı=i…):
// dizinlenen sütun norm() ile sadeleştirilir; norm uzunluğu koruduğu için alıntı asıl metinden aynı konumdan kesilir.
// Arayüzle sözleşme (değişmedi): query(q) → [{id, hits, snippet}], isabet sayısına göre; tüm kelimeler oturumda geçmeli (VE).
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const readline = require('readline');
const { DatabaseSync } = require('node:sqlite');

const TR = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };
// Karakter karakter eşleme: normalleştirilmiş metindeki konum = asıl metindeki konum (alıntı için).
// 'tr' yerelinde küçültme hiçbir kod noktasının uzunluğunu değiştirmez (İ→i; testte tüm kod noktaları denetlenir).
function norm(s) {
  let out = '';
  for (const ch of s) { const c = ch.toLocaleLowerCase('tr'); out += TR[c] || c; }
  return out;
}

const userText = c => typeof c === 'string' ? c : Array.isArray(c) ? c.filter(x => x.type === 'text').map(x => x.text).join('\n') : '';
const MAX_ROW = 20000;

// Oturumdan aranabilir satırlar: {kind: 'title'|'u'|'a'|'t', body}
async function extractRows(file) {
  const rows = [];
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    // hızlı ön eleme: base64 görsel/araç çıktısı gibi dev satırları ve ilgisiz kayıt türlerini ayrıştırma
    if (line.length > 2_000_000 && !line.includes('"text"')) continue;
    if (!line.includes('"type":"user"') && !line.includes('"type":"assistant"') && !line.includes('"custom-title"')) continue;
    let e; try { e = JSON.parse(line); } catch { continue; }
    if (e.isSidechain || e.isMeta) continue;
    if (e.type === 'custom-title' && e.customTitle) rows.push({ kind: 'title', body: e.customTitle });
    if (e.type === 'user' && e.message) {
      const c = e.message.content;
      if (Array.isArray(c) && c.some(x => x.type === 'tool_result')) continue; // araç çıktıları aranmaz
      const t = userText(c).replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
      if (t && !/^<(command-|local-command|bash-)/.test(t)) rows.push({ kind: 'u', body: t.slice(0, MAX_ROW) });
    } else if (e.type === 'assistant' && e.message && Array.isArray(e.message.content)) {
      for (const c of e.message.content) {
        if (c.type === 'text' && c.text) rows.push({ kind: 'a', body: c.text.slice(0, MAX_ROW) });
        else if (c.type === 'tool_use' && c.input) {
          const v = c.input.command || c.input.file_path || c.input.path || c.input.url || c.input.pattern || c.input.query || '';
          rows.push({ kind: 't', body: `[${c.name}] ${String(v).slice(0, 400)}` });
        }
      }
    }
  }
  return rows;
}
// Geriye dönük: oturumun tüm aranabilir metni tek parça
async function extractText(file) { return (await extractRows(file)).map(r => r.body).join('\n\n'); }

const SCHEMA = '2';

class SearchIndex {
  constructor(dir) {
    fs.mkdirSync(dir, { recursive: true });
    this.db = new DatabaseSync(path.join(dir, 'search.db'));
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);
      CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY, mtime REAL, size INTEGER, rows INTEGER);
      CREATE VIRTUAL TABLE IF NOT EXISTS docs USING fts5(sid UNINDEXED, kind UNINDEXED, body UNINDEXED, n, tokenize = 'unicode61 remove_diacritics 2');
    `);
    const cur = this.db.prepare('SELECT v FROM meta WHERE k = ?').get('schema');
    if (!cur || cur.v !== SCHEMA) {
      this.db.exec('DELETE FROM docs; DELETE FROM files;');
      this.db.prepare('INSERT OR REPLACE INTO meta VALUES (?, ?)').run('schema', SCHEMA);
    }
    // Önceki bellek-içi dizinin önbelleği (~/.claude-panel/text) artık kullanılmıyor; yeniden üretilebilir, kaldır.
    fsp.rm(path.join(dir, 'text'), { recursive: true }).catch(() => {}); // yoksa hata yutulur
    this.q = {
      file: this.db.prepare('SELECT mtime, size FROM files WHERE id = ?'),
      allFiles: this.db.prepare('SELECT id FROM files'),
      delDocs: this.db.prepare('DELETE FROM docs WHERE sid = ?'),
      delFile: this.db.prepare('DELETE FROM files WHERE id = ?'),
      ins: this.db.prepare('INSERT INTO docs (sid, kind, body, n) VALUES (?, ?, ?, ?)'),
      upFile: this.db.prepare('INSERT OR REPLACE INTO files (id, mtime, size, rows) VALUES (?, ?, ?, ?)'),
      countFiles: this.db.prepare('SELECT count(*) AS n FROM files'),
      perWord: this.db.prepare('SELECT sid, count(*) AS c FROM docs WHERE n MATCH ? GROUP BY sid'),
      bestRow: this.db.prepare('SELECT body, n FROM docs WHERE n MATCH ? AND sid = ? ORDER BY rank LIMIT 1'),
    };
    this.building = null;
    this.progress = { done: 0, total: 0 };
  }
  // Ana süreç `search.docs.size` ile dizindeki oturum sayısını okur
  get docs() { return { size: this.q.countFiles.get().n }; }

  index(id, rows, mtimeMs, size) {
    this.db.exec('BEGIN');
    try {
      this.q.delDocs.run(id);
      for (const r of rows) this.q.ins.run(id, r.kind, r.body, norm(r.body));
      this.q.upFile.run(id, mtimeMs, size, rows.length);
      this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }

  /** sessions: [{id, file, mtimeMs, size}] — değişenleri işler, silinenleri çıkarır; onProgress(done,total) */
  sync(sessions, onProgress) {
    // Sürerken gelen istek: tur bitince en son listeyle bir kez daha; çağıranlar o ikinci turun sonunu bekler
    // (önceden ilk turun sözü dönüyordu ve ikinci turun hatası yakalanmıyordu).
    if (this.building) {
      this.again = { sessions, onProgress };
      const rerun = () => { const a = this.again; this.again = this.next = null; return this.sync(a.sessions, a.onProgress); };
      return this.next || (this.next = this.building.then(rerun, rerun)); // ilk tur hata verse de ikinci tur koşar
    }
    this.building = (async () => {
      const alive = new Set(sessions.map(s => s.id));
      for (const { id } of this.q.allFiles.all()) if (!alive.has(id)) { this.q.delDocs.run(id); this.q.delFile.run(id); }
      const todo = sessions.filter(s => { const m = this.q.file.get(s.id); return !m || m.mtime !== s.mtimeMs || m.size !== s.size; });
      this.progress = { done: 0, total: todo.length };
      for (const s of todo) {
        try { this.index(s.id, await extractRows(s.file), s.mtimeMs, s.size); }
        catch (e) { console.warn('dizinlenemedi', s.file, e.message); }
        this.progress.done++;
        if (onProgress) onProgress(this.progress.done, this.progress.total);
        await new Promise(r => setImmediate(r)); // ana süreci kilitleme
      }
      if (!todo.length && onProgress) onProgress(0, 0);
    })().finally(() => { this.building = null; });
    return this.building;
  }

  /** Tüm kelimeler oturumda geçmeli (VE), her kelime önek olarak. Dönüş: [{id, hits, snippet}] isabet sayısına göre */
  query(q, limit = 200) {
    // Tırnaklar atılır: kelime FTS5'e "…"* içinde gider, dışarı taşamaz. Harf/rakam içermeyen kelime ("->", "...")
    // hiçbir şeyle eşleşmez ve VE yüzünden tüm aramayı boşaltırdı; atlanır.
    const words = norm(q || '').split(/\s+/).map(w => w.replace(/"/g, '')).filter(w => w.length >= 2 && /[\p{L}\p{N}]/u.test(w));
    if (!words.length) return [];
    let acc = null; // sid -> isabet
    for (const w of words) {
      let rows;
      try { rows = this.q.perWord.all(`"${w}"*`); } catch { return []; }
      const m = new Map(rows.map(r => [r.sid, r.c]));
      if (!acc) acc = m;
      else { for (const sid of [...acc.keys()]) { if (!m.has(sid)) acc.delete(sid); else acc.set(sid, acc.get(sid) + m.get(sid)); } }
      if (!acc.size) return [];
    }
    const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
    const first = `"${words[0]}"*`;
    // FTS önek eşleşmesi kelimenin token parçasını bulur; alıntı için normalleştirilmiş satırda kelimenin konumunu ara
    const tokens = words.map(w => w.split(/[^\p{L}\p{N}_]+/u).filter(Boolean)[0]);
    return top.map(([id, hits]) => {
      const row = this.q.bestRow.get(first, id); // acc'deki her oturum ilk kelimeyle eşleşti → satır her zaman var
      let i = 0;
      for (const t of [words[0], ...tokens]) { const k = row.n.indexOf(t); if (k >= 0) { i = k; break; } }
      const a = Math.max(0, i - 70), b = Math.min(row.body.length, i + 170);
      const snippet = (a ? '…' : '') + row.body.slice(a, b).replace(/\s+/g, ' ') + (b < row.body.length ? '…' : '');
      return { id, hits, snippet };
    });
  }
  close() { try { this.db.close(); } catch {} }
}

module.exports = { SearchIndex, norm, extractText, extractRows };
