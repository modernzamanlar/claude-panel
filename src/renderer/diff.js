// Dosya düzenleme araçlarının (Edit, MultiEdit, Write, NotebookEdit) farkı: Claude Code'daki gibi kırmızı/yeşil satırlar.
// data(): araç girdisinden kısa fark verisi ({e:[{o,n}], cut}) çıkarır; hem kayıtlı oturumlarda (main/sessions.js)
// hem canlı çalıştırmada (app.js) kullanılır. html(): satır farkını (LCS) 3 satır bağlamlı parçalar halinde çizer.
// Tüm metin kaçışlanır. Tarayıcıda window.diffView, Node'da module.exports olarak kullanılır.
(function (root) {
  const MAXC = 4000, MAXL = 200, CTX = 3;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const str = v => typeof v === 'string' ? v : '';
  const split = s => { if (!s) return []; const l = s.replace(/\r\n?/g, '\n').split('\n'); if (l[l.length - 1] === '') l.pop(); return l; };

  // Araç girdisinden fark verisi; büyük dosyalar şişirmesin diye her taraf toplamda MAXC karakter / MAXL satırla sınırlı
  function data(name, input) {
    if (!input || typeof input !== 'object') return null;
    let pairs;
    if (name === 'Edit') pairs = [{ o: input.old_string, n: input.new_string }];
    else if (name === 'MultiEdit') pairs = Array.isArray(input.edits) ? input.edits.map(x => ({ o: x && x.old_string, n: x && x.new_string })) : [];
    else if (name === 'Write') pairs = [{ o: '', n: input.content }];
    else if (name === 'NotebookEdit') pairs = [{ o: '', n: input.new_source }];
    else return null;
    const left = { o: [MAXC, MAXL], n: [MAXC, MAXL] }; let cut = false;
    const full = k => left[k][0] <= 0 || left[k][1] <= 0;
    const clip = (s, k) => {
      if (!s) return '';
      const b = left[k]; let t = s.slice(0, b[0]); const l = t.split('\n');
      if (l.length > b[1]) t = l.slice(0, b[1]).join('\n');
      if (t.length < s.length) cut = true;
      b[0] -= t.length; b[1] -= t.split('\n').length; return t;
    };
    const e = [];
    for (const p of pairs) {
      const o = str(p.o), n = str(p.n);
      if (!o && !n) continue;
      if ((o && full('o')) || (n && full('n'))) { cut = true; break; }
      e.push({ o: clip(o, 'o'), n: clip(n, 'n') });
    }
    if (!e.length) return null;
    return cut ? { e, cut: true } : { e };
  }

  // Satır farkı: ortak baş/son atılır, kalan kısım için LCS. Sonuç [{k:' '|'-'|'+', t}]
  function lines(a, b) {
    const A = split(a), B = split(b);
    let s = 0; while (s < A.length && s < B.length && A[s] === B[s]) s++;
    let ea = A.length, eb = B.length; while (ea > s && eb > s && A[ea - 1] === B[eb - 1]) { ea--; eb--; }
    const n = ea - s, m = eb - s, W = m + 1, L = new Uint32Array((n + 1) * W);
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
      L[i * W + j] = A[s + i] === B[s + j] ? L[(i + 1) * W + j + 1] + 1 : Math.max(L[(i + 1) * W + j], L[i * W + j + 1]);
    const out = A.slice(0, s).map(t => ({ k: ' ', t }));
    let i = 0, j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && A[s + i] === B[s + j]) { out.push({ k: ' ', t: A[s + i] }); i++; j++; }
      else if (i < n && (j >= m || L[(i + 1) * W + j] >= L[i * W + j + 1])) out.push({ k: '-', t: A[s + i++] });
      else out.push({ k: '+', t: B[s + j++] });
    }
    for (let k = ea; k < A.length; k++) out.push({ k: ' ', t: A[k] });
    return out;
  }

  // Değişen satırların çevresinde CTX satır bağlam bırakır; aradaki atlanan kısımlar null (ayraç) olur
  function hunks(ops) {
    const keep = ops.map(() => false);
    ops.forEach((o, i) => { if (o.k !== ' ') for (let k = Math.max(0, i - CTX); k <= Math.min(ops.length - 1, i + CTX); k++) keep[k] = true; });
    const out = [];
    ops.forEach((o, i) => { if (keep[i]) out.push(o); else if (out.length && out[out.length - 1] !== null) out.push(null); });
    if (out[out.length - 1] === null) out.pop();
    return out;
  }

  const CLS = { ' ': 'dv-c', '-': 'dv-d', '+': 'dv-a' }, SIGN = { ' ': ' ', '-': '−', '+': '+' };
  const memo = new WeakMap();
  // Fark HTML'i ve sayılar; aynı veri nesnesi için bir kez hesaplanır (yeniden çizimlerde tekrar LCS yapılmaz)
  function html(d) {
    if (!d || !Array.isArray(d.e)) return null;
    if (memo.has(d)) return memo.get(d);
    let added = 0, removed = 0; const rows = [];
    d.e.forEach((p, i) => {
      if (i) rows.push('<div class="dv-gap">⋯</div>');
      for (const o of hunks(lines(str(p && p.o), str(p && p.n)))) {
        if (!o) { rows.push('<div class="dv-gap">⋯</div>'); continue; }
        if (o.k === '+') added++; else if (o.k === '-') removed++;
        rows.push(`<div class="dv-l ${CLS[o.k]}"><span class="dv-s">${SIGN[o.k]}</span><span class="dv-t">${esc(o.t)}</span></div>`);
      }
    });
    if (d.cut) rows.push('<div class="dv-gap">… kısaltıldı</div>');
    const badge = `<span class="dv-n">${added ? `<span class="dv-pa">+${added}</span>` : ''}${removed ? `<span class="dv-pd">−${removed}</span>` : ''}${d.cut ? '…' : ''}</span>`;
    const r = { html: `<div class="dv">${rows.join('')}</div>`, added, removed, badge };
    memo.set(d, r);
    return r;
  }

  const api = { data, lines, hunks, html, esc };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.diffView = api;
})(typeof window !== 'undefined' ? window : this);
