// Oturumun toplu farkı için saf yardımcılar (DOM yok): satır farkı (Myers), sayılar ve liste/durum metinleri.
// Ana süreç (main/changes.js) sayıları, arayüz (changes-ui.js) çizimi için kullanır.
// Tarayıcıda window.changesLib, Node'da module.exports.
(function (root) {
  const MAXD = 2000; // bundan büyük farkta en kısa fark aranmaz: ortadaki kısım tümüyle silinmiş + eklenmiş gösterilir
  const split = s => { if (!s) return []; const l = String(s).replace(/\r\n/g, '\n').split('\n'); if (l[l.length - 1] === '') l.pop(); return l; };

  // Satır farkı: ortak baş/son atılır, kalan kısım Myers O(ND) ile. Sonuç diff.js biçiminde: [{k:' '|'-'|'+', t}]
  function diffOps(a, b) {
    const A = split(a), B = split(b);
    let s = 0; while (s < A.length && s < B.length && A[s] === B[s]) s++;
    let ea = A.length, eb = B.length; while (ea > s && eb > s && A[ea - 1] === B[eb - 1]) { ea--; eb--; }
    const out = A.slice(0, s).map(t => ({ k: ' ', t }));
    const mid = middle(A.slice(s, ea), B.slice(s, eb));
    for (const o of mid) out.push(o);
    for (let k = ea; k < A.length; k++) out.push({ k: ' ', t: A[k] });
    return out;
  }
  function middle(A, B) {
    const n = A.length, m = B.length, max = n + m;
    if (!n || !m || max > 200000) return A.map(t => ({ k: '-', t })).concat(B.map(t => ({ k: '+', t })));
    const off = max + 1, V = new Int32Array(2 * max + 3), trace = [];
    let found = -1;
    for (let d = 0; d <= Math.min(max, MAXD) && found < 0; d++) {
      trace.push(V.slice(off - d - 1, off + d + 2));
      for (let k = -d; k <= d; k += 2) {
        let x = (k === -d || (k !== d && V[off + k - 1] < V[off + k + 1])) ? V[off + k + 1] : V[off + k - 1] + 1;
        let y = x - k;
        while (x < n && y < m && A[x] === B[y]) { x++; y++; }
        V[off + k] = x;
        if (x >= n && y >= m) { found = d; break; }
      }
    }
    if (found < 0) return A.map(t => ({ k: '-', t })).concat(B.map(t => ({ k: '+', t })));
    // Geri izleme: her d adımındaki V kopyasından yolu kur
    const ops = []; let x = n, y = m;
    for (let d = found; d > 0; d--) {
      const v = trace[d], at = k => v[k + d + 1]; // trace[d] = V[-d-1 .. d+1]
      const k = x - y;
      const down = k === -d || (k !== d && at(k - 1) < at(k + 1));
      const pk = down ? k + 1 : k - 1, px = at(pk), py = px - pk;
      while (x > px + (down ? 0 : 1) && y > py + (down ? 1 : 0)) { ops.push({ k: ' ', t: A[--x] }); y--; }
      if (down) ops.push({ k: '+', t: B[--y] }); else ops.push({ k: '-', t: A[--x] });
    }
    while (x > 0 && y > 0) { ops.push({ k: ' ', t: A[--x] }); y--; }
    return ops.reverse();
  }
  // Eklenen / silinen satır sayısı
  function count(ops) { let added = 0, removed = 0; for (const o of ops) { if (o.k === '+') added++; else if (o.k === '-') removed++; } return { added, removed }; }

  // Liste satırının etiketleri ve geri alma düğmesinin durumu (ana süreçten gelen girdiye göre)
  function status(f) {
    const tags = [];
    if (f.created) tags.push({ k: 'new', t: 'yeni' });
    if (f.side) tags.push({ k: 'side', t: 'alt ajan' });
    if (f.cur === 'missing' && !f.created) tags.push({ k: 'warn', t: 'dosya yok' });
    else if (f.cur === 'missing') tags.push({ k: 'dim', t: 'silinmiş' });
    else if (f.cur === 'initial') tags.push({ k: 'dim', t: 'ilk halinde' });
    else if (f.cur === 'outside') tags.push({ k: 'warn', t: 'oturum dışında değişmiş' });
    else if (f.cur === 'unreadable') tags.push({ k: 'warn', t: 'okunamadı' });
    let can = !!f.canRevert, why = f.reason || '';
    if (can && f.cur === 'initial') { can = false; why = 'Dosya zaten oturum başındaki halinde.'; }
    if (can && f.created && f.cur === 'missing') { can = false; why = 'Dosya zaten yok.'; }
    if (can && f.cur === 'unreadable') { can = false; why = f.curError || 'Dosyanın şimdiki hali okunamadı.'; }
    return { tags, can, why };
  }
  // Onay metni: ne olacağı açıkça
  function confirmText(f) {
    if (f.created) return 'Bu dosya bu oturumda oluşturuldu. Geri alınca Geri Dönüşüm Kutusuna (Çöp Kutusu) taşınacak; kalıcı olarak silinmez.';
    if (f.cur === 'missing') return 'Dosya şu an diskte yok. Oturumdaki ilk değişiklikten önceki içeriğiyle yeniden oluşturulacak.';
    return 'Dosya, bu oturumdaki ilk değişiklikten önceki haline döndürülecek. Şimdiki içerik önce yedeklenecek.';
  }
  const sum = files => files.reduce((a, f) => ({ added: a.added + (f.added || 0), removed: a.removed + (f.removed || 0) }), { added: 0, removed: 0 });
  const baseName = p => String(p || '').split(/[\\/]/).pop();
  const dirName = p => { const s = String(p || ''); const i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\')); return i > 0 ? s.slice(0, i) : ''; };

  const api = { diffOps, count, status, confirmText, sum, baseName, dirName, split, MAXD };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.changesLib = api;
})(typeof window !== 'undefined' ? window : this);
