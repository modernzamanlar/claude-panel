// Panel yapısının diske yansısı: Windows'ta C:\Claude Panel (CLAUDE_PANEL_MIRROR ile değiştirilebilir).
// Paneldeki her klasör gerçek bir dizin, her sohbet o dizinde küçük bir "<başlık>.sohbet.json" dosyasıdır;
// Çöp Kutusundakiler "Çöp Kutusu" dizinine gider. Klasör oluşturma, yeniden adlandırma, taşıma ve silme
// her kayıttan ~0,4 sn sonra diske yansır.
//
// Yön tek yönlüdür: panel → disk. Asıl veri ~/.claude-panel/workspace.json'dadır; burası onun okunabilir kopyası
// ve son çare yedeğidir (kökteki .claude-panel-yapi.json tüm yapıyı içerir, asıl dosya kaybolursa buradan dönülür).
//
// Veri kaybına karşı kurallar:
//  - Yalnızca panelin oluşturduğu şeylere dokunulur: kimliği yapı dosyasında kayıtlı dizinler ve içi
//    "claude-panel-sohbet" olan .sohbet.json dosyaları. Kullanıcının bu dizinlere koyduğu başka dosyalar silinmez;
//    klasör panelden kaldırılırsa içinde başka dosya kalan dizin "Kurtarılan dosyalar" altına taşınır.
//  - Dizinler yeniden oluşturulmaz, yerinde yeniden adlandırılır/taşınır (açık Gezgin pencereleri bozulmaz).
//  - Bir işlem başarısız olursa (ör. dizin başka programda açık) o öğe eski yerinde bırakılır, yapı dosyası
//    gerçek durumu yazar ve birkaç saniye sonra yeniden denenir. Yarım kalmış bir geçiş sonraki geçişi bozmaz.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const defaultRoot = (platform = process.platform, env = process.env) => env.CLAUDE_PANEL_MIRROR || (platform === 'win32' ? 'C:\\Claude Panel' : null);
const DEFAULT_ROOT = defaultRoot();
const MANIFEST = '.claude-panel-yapi.json';
const TRASH = 'Çöp Kutusu';
const RECOVER = 'Kurtarılan dosyalar';
const EXT = '.sohbet.json';
const KIND = 'claude-panel-sohbet';
const RESERVED = /^(con|prn|aux|nul|conin\$|conout\$|com[0-9¹²³]|lpt[0-9¹²³])$/i;

// Windows ve macOS dosya adlarında büyük/küçük harfe duyarsızdır. Dosya sistemi Türkçe kuralı uygulamaz (I ↔ i),
// bu yüzden I, ı, İ, i hepsi aynı sayılır: fazladan numaralandırma zararsız, çakışma ise dosyanın üzerine yazar.
const lc = s => s.normalize('NFC').toLowerCase().replace(/i\u0307|ı/g, 'i');
const same = (a, b) => lc(a) === lc(b);
const under = (p, dir) => lc(p).startsWith(lc(dir) + lc(path.sep)) || same(p, dir);

function clean(s, max) {
  let n = String(s || '').replace(/[\u0000-\u001f<>:"/\\|?*]+/g, ' ').replace(/\s+/g, ' ').trim();
  // kesim bir emojiyi ortadan bölmesin; yarım vekil karakter diske U+FFFD olarak yazılır ve ad tutmaz
  n = n.slice(0, max).replace(/[\ud800-\udbff]$/, '').toWellFormed().trim().replace(/[. ]+$/, '');
  if (!n) n = 'Adsız';
  if (RESERVED.test(n.split('.')[0].trimEnd())) n = n.replace(/^[^.]*/, m => m + '_'); // "aux.v2" de ayrılmış ad
  return n;
}
const isDir = p => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const exists = p => { try { fs.lstatSync(p); return true; } catch { return false; } };
const JUNK = new Set(['desktop.ini', 'thumbs.db', '.ds_store']);
// Var olan bir dizin yalnızca panele ait olabilecek şeyler içeriyorsa sahiplenilir: boş, panelin .sohbet.json dosyaları,
// sistem dosyaları ya da aynı koşulu sağlayan alt dizinler. Kullanıcının dosyası olan dizine dokunulmaz (başka ad seçilir).
function adoptable(d, depth = 0) {
  let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return false; }
  return depth < 32 && ents.every(e => e.isDirectory() ? adoptable(path.join(d, e.name), depth + 1)
    : JUNK.has(e.name.toLowerCase()) || (e.name.toLowerCase().endsWith(EXT) && !!readChat(path.join(d, e.name))));
}
function readChat(p) { try { const d = JSON.parse(fs.readFileSync(p, 'utf8')); return d?.tur === KIND ? d : null; } catch { return null; } }

// platform ve execFile testlerde Windows davranışını Mac'te denemek için verilebilir
function createMirror({ root = DEFAULT_ROOT, getSessions, onStatus = () => {}, delay = 400, platform = process.platform, execFile: exec = execFile } = {}) {
  const isWin = platform === 'win32';
  let lastWS = null, timer = null, retry = 0, ready = false, status = { root, ok: true };

  function readManifest() {
    if (!root) return null;
    try { const d = JSON.parse(fs.readFileSync(path.join(root, MANIFEST), 'utf8')); return d?.tur === 'claude-panel-yapi' ? d : null; } catch { return null; }
  }
  function writeManifest(data) {
    const f = path.join(root, MANIFEST), tmp = f + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
    if (isWin) try { fs.unlinkSync(f); } catch {} // Windows gizli dosyanın üzerine yazmaya izin vermez
    fs.renameSync(tmp, f);
    if (isWin) exec('attrib', ['+h', f], { windowsHide: true }, () => {});
  }

  /** Tek geçiş: istenen ağacı hesapla, diskteki durumu ona getir. Dönüş: {errors:[...]} */
  function syncNow(ws) {
    if (!root || !ws) return { errors: [] };
    fs.mkdirSync(root, { recursive: true });
    const prev = readManifest() || {};
    const pf = prev.folders || {}, pc = prev.chats || {};
    const errors = [];
    const moves = []; // [eski, yeni] mutlak yol — önceki kayıtlı yolları güncel konuma çevirmek için
    // Yapı dosyasındaki göreli yol → güncel mutlak yol. Kökün dışına çıkan ("..") ya da bozuk kayıt '' döner:
    // elle bozulmuş bir yapı dosyası kullanıcının başka dizinlerini taşıtamaz/sildiremez.
    const resolve = rel => {
      if (typeof rel !== 'string') return '';
      let p = path.join(root, rel);
      for (const [a, b] of moves) if (under(p, a)) p = b + p.slice(a.length);
      return under(p, root) && !same(p, root) ? p : '';
    };
    const rel = p => path.relative(root, p);
    const claimed = new Map(); // dizin → kullanılan adlar
    const claim = (dir, base, ext = '') => {
      const k = lc(dir); if (!claimed.has(k)) claimed.set(k, new Set());
      const set = claimed.get(k); let n = base, i = 2;
      while (set.has(lc(n + ext))) n = `${base} (${i++})`;
      set.add(lc(n + ext)); return n + ext;
    };
    [TRASH, RECOVER, MANIFEST, MANIFEST + '.tmp'].forEach(n => claim(root, n));
    const trashDir = path.join(root, TRASH);
    const tryOp = (what, fn) => { try { fn(); return true; } catch (e) { errors.push(`${what}: ${e.code || e.message}`); return false; } };

    // ---- Klasörler: üstten alta ----
    const F = new Map((ws.folders || []).filter(f => f && f.id && !f.hidden).map(f => [f.id, f]));
    const depth = f => { let d = 0, p = f.parent, seen = new Set([f.id]); while (p && F.has(p) && !seen.has(p)) { seen.add(p); p = F.get(p).parent; d++; } return d; };
    const order = [...F.values()].sort((a, b) => depth(a) - depth(b) || String(a.name).localeCompare(String(b.name), 'tr') || a.id.localeCompare(b.id));
    const actual = new Map(), done = new Set();
    const ownerOf = p => { for (const [id, r] of Object.entries(pf)) if (!done.has(id) && F.has(id) && same(resolve(r), p)) return id; return null; };

    for (const f of order) {
      const parentAbs = f.trashed ? trashDir : (f.parent && actual.has(f.parent) ? actual.get(f.parent) : root);
      let cur = resolve(pf[f.id]);
      if (!isDir(cur)) cur = '';
      const base = clean(f.name, 80);
      let target = '';
      // üst dizin oluşturulamazsa ya da işlem başarısız olursa klasör eski yerinde kalır (kaldırılmış sayılmaz)
      if (tryOp('dizin ' + rel(parentAbs), () => fs.mkdirSync(parentAbs, { recursive: true }))) for (let guard = 0; guard < 50 && !target; guard++) {
        const t = path.join(parentAbs, claim(parentAbs, base));
        if (same(cur, t)) {
          if (cur === t || tryOp('ad ' + rel(t), () => fs.renameSync(cur, t))) target = t; // yalnızca harf büyüklüğü değişti
          break;
        }
        if (exists(t)) {
          const owner = ownerOf(t);
          if (owner && owner !== f.id) { // başka bir panel klasörü yer değiştiriyor: geçici ada çek
            const tmp = t + ' ~' + owner.slice(-6);
            if (tryOp('geçici ' + rel(t), () => fs.renameSync(t, tmp))) moves.push([t, tmp]); else continue;
          } else if (!cur && isDir(t) && adoptable(t)) { target = t; break; } // aynı adlı dizin panelinkine benziyor: sahiplen
          else continue; // kullanıcıya ait bir şey var: başka ad
        }
        if (cur) { if (tryOp('taşı ' + rel(cur) + ' → ' + rel(t), () => fs.renameSync(cur, t))) { moves.push([cur, t]); target = t; } break; }
        if (tryOp('oluştur ' + rel(t), () => fs.mkdirSync(t))) target = t;
        break; // oluşturulamadıysa başka adla denenmez; birkaç saniye sonra aynı adla yeniden denenir
      }
      done.add(f.id);
      if (!target && cur) claim(path.dirname(cur), path.basename(cur)); // eski yerinde kaldı: o adı başkası almasın
      if (target || cur) actual.set(f.id, target || cur);
    }

    // ---- Sohbetler ----
    const sessions = getSessions ? getSessions() || [] : [];
    const meta = ws.meta || {};
    const targets = new Set(), chats = {};
    const sorted = [...sessions].sort((a, b) => String(a.title).localeCompare(String(b.title), 'tr') || String(a.id).localeCompare(String(b.id)));
    for (const s of sorted) {
      const m = meta['s:' + s.id] || {};
      if (m.hidden) continue;
      const dir = m.trashed ? trashDir : (m.folder && actual.has(m.folder) ? actual.get(m.folder) : root);
      const title = m.alias || s.title || 'Adsız sohbet';
      const body = JSON.stringify({ tur: KIND, v: 1, id: s.id, baslik: title, proje: s.cwd || s.project || null,
        klasor: rel(dir) || '.', model: s.model || null, kayit: s.file || null }, null, 2) + '\n';
      let t = '';
      if (tryOp('dizin ' + rel(dir), () => fs.mkdirSync(dir, { recursive: true }))) for (let guard = 0; guard < 50 && !t; guard++) {
        const c = path.join(dir, claim(dir, clean(title, 70), EXT));
        if (exists(c) && !readChat(c)) continue; // kullanıcının dosyası: dokunma, başka ad
        let old = null; try { old = fs.readFileSync(c, 'utf8'); } catch {}
        if (old === body || tryOp('yaz ' + rel(c), () => { fs.writeFileSync(c + '.tmp', body); fs.renameSync(c + '.tmp', c); })) t = c;
        else break;
      }
      // yazılamadıysa eski dosya yerinde kalır (silinmez), yapı dosyası onu gösterir
      // eski yerinde kalan dosyanın adı ayrılır: aynı başlıklı başka bir sohbet o dosyanın üzerine yazmasın
      if (!t) { const was = resolve(pc[s.id]); if (readChat(was)?.id === s.id) { t = was; claim(path.dirname(was), path.basename(was)); } }
      if (t) { targets.add(lc(t)); chats[s.id] = rel(t); }
    }

    // ---- Artık hedef olmayan sohbet dosyalarını kaldır (yalnızca panelinkiler) ----
    const suspicious = !sessions.length && Object.keys(pc).length > 0; // oturum listesi boş geldiyse silme
    if (!suspicious) {
      const cands = new Set(Object.values(pc).map(resolve));
      const scan = d => { let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
        for (const e of ents) { const p = path.join(d, e.name);
          if (e.isDirectory()) { if (!(d === root && same(e.name, RECOVER))) scan(p); }
          else if (e.name.toLowerCase().endsWith(EXT)) cands.add(p); } };
      scan(root);
      for (const p of cands) if (!targets.has(lc(p)) && readChat(p)) tryOp('sil ' + rel(p), () => fs.unlinkSync(p));
    }

    // ---- Panelden kaldırılan klasörler: boşsa sil, içinde kullanıcı dosyası varsa kurtar ----
    const rmEmpty = d => { let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return false; }
      let empty = true;
      for (const e of ents) { const p = path.join(d, e.name);
        if (e.isDirectory() ? !rmEmpty(p) : !JUNK.has(e.name.toLowerCase())) empty = false;
        else if (!e.isDirectory()) try { fs.unlinkSync(p); } catch { empty = false; } }
      if (empty) try { fs.rmdirSync(d); } catch { empty = false; }
      return empty; };
    const live = [...actual.values()];
    for (const [id, r] of Object.entries(pf)) {
      if (actual.has(id)) continue;
      const p = resolve(r);
      if (!isDir(p)) continue;
      if (live.some(a => under(a, p))) { actual.set(id, p); continue; } // içinde taşınamamış canlı klasör var: dokunma, sonra yeniden dene
      if (!rmEmpty(p)) {
        const rd = path.join(root, RECOVER); let t = path.join(rd, path.basename(p)), i = 2;
        while (exists(t)) t = path.join(rd, `${path.basename(p)} (${i++})`);
        // taşınamadıysa (ör. dizin Gezgin'de açık) yapı dosyasında kalsın ki sonraki geçişte yeniden denensin
        if (!tryOp('kurtar ' + rel(p), () => { fs.mkdirSync(rd, { recursive: true }); fs.renameSync(p, t); })) actual.set(id, p);
      }
    }
    try { fs.rmdirSync(trashDir); } catch {} // boş Çöp Kutusu dizini kalmasın (rmdir dolu dizini silmez)

    const folders = {}; actual.forEach((p, id) => folders[id] = rel(p));
    tryOp('yapı dosyası', () => writeManifest({ tur: 'claude-panel-yapi', v: 1, savedAt: new Date().toISOString(), folders, chats, workspace: ws }));
    return { errors };
  }

  function run() {
    timer = null;
    if (!root || !lastWS || !ready) return;
    let r;
    try { r = syncNow(lastWS); } catch (e) { r = { errors: [String(e && e.message || e)] }; }
    const ok = !r.errors.length;
    if (!ok) { console.warn('yansı hataları', r.errors); retry = Math.min(retry + 1, 6); timer = setTimeout(run, 2000 * retry); }
    else retry = 0;
    const st = { root, ok, errors: r.errors.slice(0, 5), at: Date.now() };
    if (st.ok !== status.ok || !ok) onStatus(st);
    status = st;
  }

  return {
    root,
    get status() { return status; },
    /** workspace kaydedildi/değişti: kısa gecikmeyle yansıt (ws verilmezse son yapı kullanılır, ör. başlık değişti) */
    schedule(ws) { if (ws) lastWS = ws; if (!root) return; clearTimeout(timer); timer = setTimeout(run, delay); },
    /** oturum dizini ilk kez okundu: artık sohbet listesi güvenilir */
    setReady() { ready = true; this.schedule(); },
    /** hemen yansıt (kapanırken) */
    flush() { clearTimeout(timer); run(); },
    /** asıl workspace kaybolursa geri yükleme için */
    readWorkspace() { const m = readManifest(); return m && m.workspace; },
    syncNow,
  };
}

module.exports = { createMirror, clean, defaultRoot, DEFAULT_ROOT, MANIFEST, TRASH, RECOVER, EXT };
