// Ekteki görselin üzerine çizim düzenleyicisi (tam pencere katman + altta yüzen araç çubuğu).
// Mantık annotate.js'te (window.annotate); burada yalnızca DOM, tuval ve olaylar var.
// Kullanım: annotUI.open(ek, {save: (base64, ad) => Promise<{path,name,size}>, done: yeniEk => …, toast})
(function () {
  const A = window.annotate;
  const MAC = ((window.api && window.api.platform) || '') === 'darwin';
  const MODK = MAC ? '⌘' : 'Ctrl+';
  const IMG_LIMIT = 5 * 1024 * 1024; // Claude'a base64 gönderilebilen en büyük görsel (describeFiles ile aynı)
  const SVG = p => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
  const IC = {
    pen: SVG('<path d="M21.2 6.8a2.8 2.8 0 0 0-4-4L3.8 16.2a2 2 0 0 0-.5.8l-1.3 4.4a.5.5 0 0 0 .6.6l4.4-1.3a2 2 0 0 0 .8-.5Z"/><path d="m15 5 4 4"/>'),
    rect: SVG('<rect x="3" y="3" width="18" height="18" rx="2"/>'),
    arrow: SVG('<path d="M5 19 19 5M9 5h10v10"/>'),
    ellipse: SVG('<circle cx="12" cy="12" r="9"/>'),
    text: SVG('<path d="M4 7V4h16v3M9 20h6M12 4v16"/>'),
    caret: SVG('<path d="m6 9 6 6 6-6"/>'),
    undo: SVG('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
    redo: SVG('<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>'),
    x: SVG('<path d="M18 6 6 18M6 6l12 12"/>'),
  };
  const SHAPE_NAMES = { rect: 'Kutu', arrow: 'Ok', ellipse: 'Elips' };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  let E = null; // açık düzenleyici: {root, cv, ctx, img, w, h, st, item, opts, txt, busy}

  function barHTML() {
    return `<div class="annot-bar" role="toolbar" aria-label="Çizim araçları">
      <button class="annot-b" data-an-tool="pen" title="Kalem">${IC.pen}</button>
      <span class="annot-grp"><button class="annot-b" data-an-tool="shape" title="Kutu"></button><button class="annot-b annot-cr" data-an-dd="shape" title="Şekil seç">${IC.caret}</button></span>
      <button class="annot-b" data-an-tool="text" title="Yazı">${IC.text}</button>
      <i class="annot-sep"></i>
      <span class="annot-grp"><button class="annot-b" data-an-dd="color" title="Renk"><i class="annot-dot"></i></button><button class="annot-b annot-cr" data-an-dd="color" title="Renk seç">${IC.caret}</button></span>
      <span class="annot-grp"><button class="annot-b" data-an-dd="size" title="Kalınlık"><i class="annot-ln"></i></button><button class="annot-b annot-cr" data-an-dd="size" title="Kalınlık seç">${IC.caret}</button></span>
      <i class="annot-sep"></i>
      <button class="annot-b" data-an="undo" title="Geri al (${MODK}Z)">${IC.undo}</button>
      <button class="annot-b" data-an="redo" title="Yinele (${MODK}${MAC ? '⇧Z' : 'Y'})">${IC.redo}</button>
      <button class="annot-save" data-an="save" title="Kaydet (${MODK}S)">Kaydet</button>
      <button class="annot-b" data-an="cancel" title="İptal (Esc)">${IC.x}</button>
    </div>`;
  }

  // Araç çubuğunun görünümünü durumla eşitler (seçili araç, renk, kalınlık, geri al/yinele)
  function paintBar() {
    const st = E.st, r = E.root;
    r.querySelectorAll('[data-an-tool]').forEach(b => {
      const t = b.dataset.anTool;
      b.classList.toggle('on', t === 'shape' ? A.SHAPES.includes(st.tool) : t === st.tool);
    });
    const sb = r.querySelector('[data-an-tool="shape"]'); sb.innerHTML = IC[st.shape]; sb.title = SHAPE_NAMES[st.shape];
    r.querySelector('.annot-dot').style.background = st.color;
    r.querySelector('.annot-ln').style.height = Math.max(2, A.SIZES[st.size]) + 'px';
    r.querySelector('[data-an="undo"]').disabled = !A.canUndo(st);
    r.querySelector('[data-an="redo"]').disabled = !A.canRedo(st);
    E.cv.style.cursor = st.tool === 'text' ? 'text' : 'crosshair';
  }

  function layout() {
    const stage = E.root.querySelector('.annot-stage');
    const f = A.fit(E.w, E.h, Math.max(50, window.innerWidth - 64), Math.max(50, window.innerHeight - 150));
    const dpr = window.devicePixelRatio || 1;
    E.cv.style.width = f.w + 'px'; E.cv.style.height = f.h + 'px';
    // Tuval ekrandaki boyut × dpr: yüksek DPI ekranda keskin; şekiller görsel pikselinde tutulur
    E.cv.width = Math.max(1, Math.round(f.w * dpr)); E.cv.height = Math.max(1, Math.round(f.h * dpr));
    stage.style.width = f.w + 'px'; stage.style.height = f.h + 'px';
    draw();
  }
  function draw() { if (E) A.render(E.ctx, E.st, { scale: E.cv.width / E.w, image: E.img, w: E.w, h: E.h }); }
  let raf = 0;
  const drawSoon = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };
  const kOf = () => E.w / E.cv.getBoundingClientRect().width; // ekran pikseli başına görsel pikseli
  const ptOf = e => A.toImage(e.clientX, e.clientY, E.cv.getBoundingClientRect(), E.w, E.h);

  function closePop() { const p = E && E.root.querySelector('.annot-pop'); if (p) p.remove(); }
  function openPop(kind, btn) {
    const was = E.root.querySelector('.annot-pop'); closePop();
    if (was && was.dataset.kind === kind) return;
    const st = E.st;
    const html = kind === 'color'
      ? A.COLORS.map((c, i) => `<button class="annot-sw ${c === st.color ? 'on' : ''}" data-an-color="${c}" title="${A.COLOR_NAMES[i]}"><i style="background:${c}"></i></button>`).join('')
      : kind === 'size'
        ? A.SIZES.map((s, i) => `<button class="annot-sz ${i === st.size ? 'on' : ''}" data-an-size="${i}" title="${A.SIZE_NAMES[i]}"><i style="height:${Math.max(2, s)}px"></i><span>${A.SIZE_NAMES[i]}</span></button>`).join('')
        : A.SHAPES.map(s => `<button class="annot-sh ${s === st.shape && A.SHAPES.includes(st.tool) ? 'on' : ''}" data-an-shape="${s}">${IC[s]}<span>${SHAPE_NAMES[s]}</span></button>`).join('');
    const p = document.createElement('div');
    p.className = 'annot-pop annot-pop-' + kind; p.dataset.kind = kind; p.innerHTML = html;
    E.root.appendChild(p);
    const br = btn.closest('.annot-grp').getBoundingClientRect(), pr = p.getBoundingClientRect();
    p.style.left = Math.max(8, Math.min(window.innerWidth - pr.width - 8, br.left + br.width / 2 - pr.width / 2)) + 'px';
    p.style.top = Math.max(8, br.top - pr.height - 8) + 'px';
  }

  // Yazı aracı: tıklanan yere metin kutusu; Enter ya da odak kaybı → çizime işlenir, Esc → vazgeç
  function commitText(keep) {
    const t = E && E.txt; if (!t) return;
    E.txt = null;
    if (keep) A.addText(E.st, t.pt, t.el.value, t.k);
    t.el.remove(); draw(); paintBar();
  }
  function openText(e) {
    commitText(true);
    const stage = E.root.querySelector('.annot-stage'), r = E.cv.getBoundingClientRect(), k = kOf();
    const el = document.createElement('input');
    el.className = 'annot-txt'; el.type = 'text'; el.spellcheck = false; el.setAttribute('aria-label', 'Yazı');
    const fs = A.FONT_SIZES[E.st.size];
    Object.assign(el.style, { left: (e.clientX - r.left) + 'px', top: (e.clientY - r.top) + 'px', fontSize: fs + 'px', color: E.st.color,
      height: Math.round(fs * 1.3) + 'px' });
    stage.appendChild(el);
    E.txt = { el, pt: ptOf(e), k };
    el.addEventListener('blur', () => { if (E && E.txt && E.txt.el === el) commitText(true); });
    setTimeout(() => el.focus(), 0);
  }

  function onDown(e) {
    if (e.button !== 0 || E.busy) return;
    closePop();
    if (E.st.tool === 'text') { e.preventDefault(); openText(e); return; }
    commitText(true);
    E.cv.setPointerCapture && E.cv.setPointerCapture(e.pointerId);
    A.begin(E.st, ptOf(e), kOf()); draw();
  }
  function onMove(e) { if (E && E.st.draft && A.move(E.st, ptOf(e))) drawSoon(); }
  function onUp(e) {
    if (!E || !E.st.draft) return;
    A.move(E.st, ptOf(e)); A.end(E.st); draw(); paintBar();
  }

  async function save() {
    if (E.busy) return;
    commitText(true);
    if (!A.canUndo(E.st)) { close(); return; } // çizim yoksa ek değişmez
    E.busy = true; E.root.classList.add('busy');
    const out = document.createElement('canvas'); out.width = E.w; out.height = E.h;
    A.render(out.getContext('2d'), E.st, { scale: 1, image: E.img, w: E.w, h: E.h });
    const data = out.toDataURL('image/png').split(',')[1];
    const { item, opts } = E;
    try {
      const r = await opts.save(data, A.outName(item.name));
      const small = r.size <= IMG_LIMIT;
      const nw = { path: r.path, name: r.name, size: r.size, ...(small ? { isImage: true, media_type: 'image/png', data } : {}) };
      close();
      if (!small && opts.toast) opts.toast('Çizilmiş görsel 5 MB\'tan büyük: dosya yolu olarak eklendi');
      opts.done(nw);
    } catch (err) {
      if (E) { E.busy = false; E.root.classList.remove('busy'); }
      if (opts.toast) opts.toast('Kaydedilemedi: ' + String(err && err.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
    }
  }

  function act(a) {
    if (a === 'undo') { commitText(true); A.undo(E.st); }
    else if (a === 'redo') { commitText(true); A.redo(E.st); }
    else if (a === 'save') { save(); return; }
    else if (a === 'cancel') { close(); return; }
    draw(); paintBar();
  }

  function onClick(e) {
    e.stopPropagation(); // uygulamanın genel tıklama dinleyicileri (menü kapatma vb.) çalışmasın
    const t = e.target;
    const tb = t.closest('[data-an-tool]');
    if (tb) { closePop(); commitText(true); A.setTool(E.st, tb.dataset.anTool === 'shape' ? E.st.shape : tb.dataset.anTool); paintBar(); return; }
    const dd = t.closest('[data-an-dd]'); if (dd) { openPop(dd.dataset.anDd, dd); return; }
    const c = t.closest('[data-an-color]'); if (c) { A.setColor(E.st, c.dataset.anColor); if (E.txt) E.txt.el.style.color = E.st.color; closePop(); paintBar(); return; }
    const z = t.closest('[data-an-size]'); if (z) { A.setSize(E.st, +z.dataset.anSize); closePop(); paintBar(); return; }
    const sh = t.closest('[data-an-shape]'); if (sh) { commitText(true); A.setTool(E.st, sh.dataset.anShape); closePop(); paintBar(); return; }
    const b = t.closest('[data-an]'); if (b) { closePop(); act(b.dataset.an); return; }
    if (!t.closest('.annot-pop')) closePop();
    if (t === E.root && E.downBg) close(); // görselin dışındaki boşluğa tıklamak (basıp bırakmak): iptal, Esc ile aynı
  }

  function onKey(e) {
    if (!E) return;
    e.stopPropagation(); // açıkken uygulama kısayolları çalışmasın
    if (E.txt && document.activeElement === E.txt.el) {
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); commitText(true); }
      else if (e.key === 'Escape') { e.preventDefault(); commitText(false); }
      return;
    }
    if (e.key === 'Escape' && E.root.querySelector('.annot-pop')) { e.preventDefault(); closePop(); return; }
    const a = A.shortcut(e, MAC); if (a) { e.preventDefault(); act(a); }
  }

  function close() {
    if (!E) return;
    const r = E.root; E = null;
    r.remove();
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', layout);
  }

  function open(item, opts) {
    if (!item || !item.isImage || !item.data) return false;
    close();
    const root = document.createElement('div');
    root.id = 'annot'; root.className = 'annot'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Görsel üzerine çiz: ' + item.name);
    root.innerHTML = `<div class="annot-stage"><canvas class="annot-cv"></canvas></div>${barHTML()}<div class="annot-name">${esc(item.name)}</div>`;
    document.body.appendChild(root);
    const cv = root.querySelector('canvas');
    E = { root, cv, ctx: cv.getContext('2d'), img: new Image(), w: 0, h: 0, st: A.createState(), item, opts: opts || {}, txt: null, busy: true };
    const me = E;
    E.img.onload = () => { if (E !== me) return; E.w = E.img.naturalWidth; E.h = E.img.naturalHeight; E.busy = false; layout(); paintBar(); };
    E.img.onerror = () => { if (E !== me) return; close(); if (me.opts.toast) me.opts.toast('Görsel açılamadı'); };
    E.img.src = `data:${item.media_type};base64,${item.data}`;
    root.addEventListener('click', onClick);
    root.addEventListener('pointerdown', e => { if (E) E.downBg = e.target === root; });
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', layout);
    paintBar();
    return true;
  }

  window.annotUI = { open, close, isOpen: () => !!E, get state() { return E && E.st; }, get size() { return E && { w: E.w, h: E.h }; } };
})();
