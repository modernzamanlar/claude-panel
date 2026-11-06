// Ekran kontrolü çerçevesinin sayfası: ana süreçten yalnız görsel durum alır (window.ov.on), hiçbir şey göndermez.
(() => {
  const ov = document.getElementById('ov'), fx = document.getElementById('fx');
  const who = ov.querySelector('.who'), key = ov.querySelector('.key');
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const later = (e, ms) => setTimeout(() => e.remove(), ms);
  const n = v => (Number.isFinite(v) ? v : 0);
  function ring(x, y, kind) {
    const cls = 'ring' + (kind === 'sag_tikla' ? ' sag' : '');
    const add = (c, r) => { const e = el('circle', { cx: n(x), cy: n(y), r, class: c }); fx.appendChild(e); later(e, 1100); };
    add(cls, 22);
    if (kind === 'cift_tikla') add(cls + ' r2', 22);
    if (kind !== 'tasi') add('dot', 4);
  }
  function trail(a, b) {
    const e = el('line', { x1: n(a.x), y1: n(a.y), x2: n(b.x), y2: n(b.y), class: 'trail' }); fx.appendChild(e); later(e, 1500);
    ring(a.x, a.y, 'tikla'); setTimeout(() => ring(b.x, b.y, 'tikla'), 500);
  }
  window.ov.on(m => {
    if (!m || typeof m !== 'object') return;
    if (m.type === 'show') {
      // textContent: sohbet adları kullanıcı verisidir, HTML olarak yorumlanmaz
      who.textContent = Array.isArray(m.labels) && m.labels.length ? '· ' + m.labels.map(String).join(', ') : '';
      key.textContent = '· Durdurmak için ' + String(m.shortcut || 'Ctrl+Alt+Esc');
      ov.classList.add('on');
    } else if (m.type === 'hide') ov.classList.remove('on');
    else if (m.type === 'ring') ring(m.x, m.y, m.kind);
    else if (m.type === 'trail') trail(m.a || {}, m.b || {});
  });
})();
