/* Geri sarma / düzenleme, ek klasör ve worktree için arayüzün saf mantığı.
   Tarayıcıda window.rewind, Node'da module.exports (test/q-rewind-ui.test.js). DOM'a dokunmaz. */
(function(root){
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  // Kullanıcı mesajı düzenlenebilir mi: diskten okunmuş (sessions.js `at` yazar), devam noktası '' (başı) ya da bir uuid
  const canEdit = m => !!m && m.r === 'u' && typeof m.at === 'string' && (m.at === '' || UUID.test(m.at));
  // Kod geri sarılabilir mi: CLI rewind_files bu kullanıcı mesajının kendi uuid'sini ister
  const canCode = m => canEdit(m) && typeof m.uuid === 'string' && UUID.test(m.uuid);
  // Düzenlenen hedef: kaçıncı mesajdan kesilir, hangi asistan kaydından devam edilir
  function target(msgs, mi){
    const m = Array.isArray(msgs) ? msgs[mi] : null;
    if(!canEdit(m)) return null;
    return {mi, at: m.at, uuid: canCode(m) ? m.uuid : null, ts: m.ts || null, text: m.t || '', first: m.at === '', n: msgs.slice(0, mi + 1).filter(x => x && x.r === 'u').length};
  }
  const SUFFIX = ' (düzenlendi)';
  const forkTitle = t => { t = String(t || 'Sohbet'); return t.endsWith(SUFFIX) ? t : t + SUFFIX; };
  // Dosya listesi: çalışma klasörünün içindeyse göreli gösterilir
  function fileRows(files, cwd){
    const base = String(cwd || '').replace(/[\\/]+$/, '');
    return (files || []).filter(f => typeof f === 'string' && f).map(f => {
      const inCwd = base && (f.startsWith(base + '\\') || f.startsWith(base + '/'));
      const rel = inCwd ? f.slice(base.length + 1) : f;
      const parts = rel.split(/[\\/]/);
      return {path: f, name: parts.pop(), dir: parts.join('/')};
    });
  }
  function changeSummary(r){
    if(!r) return '';
    const n = (r.files || []).length;
    return `${n} dosya` + (r.insertions || r.deletions ? ` · +${r.insertions || 0} −${r.deletions || 0} satır` : '');
  }
  // Ek klasör listesi: boş/tekrar/çalışma klasörü eklenmez; en çok 20
  const same = (a, b) => String(a).replace(/[\\/]+$/, '').toLowerCase() === String(b).replace(/[\\/]+$/, '').toLowerCase();
  function dirsAdd(list, p, cwd){
    const cur = Array.isArray(list) ? list.slice() : [];
    if(typeof p !== 'string' || !p.trim()) return cur;
    p = p.trim();
    if((cwd && same(p, cwd)) || cur.some(x => same(x, p)) || cur.length >= 20) return cur;
    cur.push(p); return cur;
  }
  const dirsRemove = (list, p) => (Array.isArray(list) ? list : []).filter(x => x !== p);
  // Worktree adı (runner/rewind.js ile aynı kural) ve sohbet adından öneri
  const validWt = n => typeof n === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(n) && !/^[.-]/.test(n) && !n.includes('..') && !/\.lock$/i.test(n);
  const TR = {ç:'c', ğ:'g', ı:'i', ö:'o', ş:'s', ü:'u', Ç:'c', Ğ:'g', İ:'i', I:'i', Ö:'o', Ş:'s', Ü:'u'};
  function wtName(text, now){
    const s = String(text || '').replace(/[çğıöşüÇĞİIÖŞÜ]/g, c => TR[c]).toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
    if(s) return s;
    const d = new Date(now || Date.now()), p = v => String(v).padStart(2, '0');
    return `calisma-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  }
  const api = {canEdit, canCode, target, forkTitle, fileRows, changeSummary, dirsAdd, dirsRemove, validWt, wtName};
  if(typeof module === 'object' && module.exports) module.exports = api; else root.rewind = api;
})(typeof window !== 'undefined' ? window : this);
