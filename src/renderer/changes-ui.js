// "Değişen dosyalar" penceresi: bir sohbette Claude'un değiştirdiği / oluşturduğu dosyalar, oturum başı ↔ şimdi farkı
// ve dosya bazında geri alma (onaylı). Veri ana süreçten (window.api.changes → main/changes.js); hesap changes.js'te.
// Kendi modalinin içindeki tıklamaları kendi dinleyicisi işler (data-cx*); açıkken Esc yalnızca bu pencereyi kapatır.
(function () {
  const lib = window.changesLib, dv = window.diffView, esc = dv.esc;
  const icon = (n, c) => typeof ic === 'function' ? ic(n, c) : '';
  const say = t => typeof toast === 'function' ? toast(t) : null;
  const MAXROWS = 4000; // bundan fazla fark satırı çizilmez
  let X = null; // {sid, title, files, err, sel, detail, loading, confirm, busy, ack, msg}

  // Satır farkı (Myers) → diff.js biçiminde satırlar, 3 satır bağlamlı
  function diffRows(a, b) {
    const ops = dv.hunks(lib.diffOps(a || '', b || ''));
    if (!ops.length) return { html: '<div class="cx-none">Fark yok.</div>', n: 0 };
    const rows = []; let n = 0;
    for (const o of ops) {
      if (n >= MAXROWS) { rows.push('<div class="dv-gap">… fark çok uzun, kısaltıldı</div>'); break; }
      if (!o) { rows.push('<div class="dv-gap">⋯</div>'); continue; }
      n++;
      rows.push(`<div class="dv-l ${o.k === '+' ? 'dv-a' : o.k === '-' ? 'dv-d' : 'dv-c'}"><span class="dv-s">${o.k === '-' ? '−' : o.k}</span><span class="dv-t">${esc(o.t)}</span></div>`);
    }
    return { html: `<div class="dv">${rows.join('')}</div>`, n };
  }
  const badge = (a, r, approx) => `<span class="dv-n">${a ? `<span class="dv-pa">+${a}</span>` : ''}${r ? `<span class="dv-pd">−${r}</span>` : ''}${!a && !r ? '<span class="cx-z">0</span>' : ''}${approx ? '<span class="cx-z" title="Kesin ilk hal kurulamadı; sayılar adım adım toplamdır">~</span>' : ''}</span>`;
  const tagHTML = tags => tags.map(t => `<span class="cx-tag cx-${t.k}">${esc(t.t)}</span>`).join('');

  function listHTML() {
    if (X.err) return `<div class="cx-err">${esc(X.err)}</div>`;
    if (!X.files) return '<div class="cx-none">Yükleniyor…</div>';
    if (!X.files.length) return '<div class="cx-none">Bu sohbette Claude henüz dosya değiştirmedi ya da oluşturmadı.</div>';
    return X.files.map((f, i) => {
      const st = lib.status(f);
      return `<button class="cx-f${X.sel === i ? ' on' : ''}" data-cxsel="${i}" title="${esc(f.path)}">
        <span class="cx-fn">${icon(f.created ? 'plus' : 'edit')}<b>${esc(lib.baseName(f.path))}</b>${badge(f.added, f.removed, f.approx)}</span>
        <span class="cx-fd">${esc(lib.dirName(f.path))}</span>${st.tags.length ? `<span class="cx-tags">${tagHTML(st.tags)}</span>` : ''}</button>`;
    }).join('');
  }

  function detailHTML() {
    const f = X.files && X.files[X.sel];
    if (!f) return '<div class="cx-none">Farkı görmek için soldan bir dosya seç.</div>';
    const d = X.detail && X.detail.path === f.path ? X.detail : null;
    const st = lib.status(f);
    const notes = [];
    if (f.weak) notes.push('İlk hal, oturumdaki tam okumadan (Read) alındı; o okumadan önce dışarıdan değişiklik olduysa farklı olabilir.');
    if (f.between) notes.push('Dosya oturum sırasında, Claude\'un değişiklikleri arasında dışarıdan da değişmiş. Geri alma, oturumdaki ilk değişiklikten önceki hale döner.');
    if (f.anySide) notes.push(f.side ? 'Bu dosyayı alt ajan değiştirdi.' : 'Bu dosyayı ana sohbet ve alt ajan birlikte değiştirdi.');
    let body;
    if (!d) body = '<div class="cx-none">Fark yükleniyor…</div>';
    else if (d.err) body = `<div class="cx-err">${esc(d.err)}</div>`;
    else if (d.initial !== undefined) {
      // Oturum başı → şimdi (diskteki); şimdi okunamıyorsa oturumun son bildiği hal
      const now = typeof d.current === 'string' ? d.current : d.current === null ? '' : d.last;
      const from = d.initial === null ? 'yoktu' : 'oturum başı', to = typeof d.current === 'string' ? 'şimdi (diskte)' : d.current === null ? 'şimdi: dosya yok' : 'oturumun son bildiği hal';
      if (d.initial === false || now === false) body = '<div class="cx-none">Dosya çok büyük (2 milyon karakter üstü); fark gösterilmiyor.</div>';
      else body = `<div class="cx-cap">${esc(from)} → ${esc(to)}</div>${diffRows(d.initial || '', now || '').html}`;
    } else {
      // İlk hal kurulamadı: Claude'un adım adım değişiklikleri
      body = `<div class="cx-cap">Oturum başı kurulamadı; Claude'un yaptığı ${d.steps.length} değişiklik adım adım:</div>` + d.steps.map((s, i) => {
        const h = dv.html(s.d);
        return `<div class="cx-step"><div class="cx-sh">${i + 1}. ${esc(s.tool)}${s.side ? ' · alt ajan' : ''}${h ? h.badge : ''}</div>${h ? h.html : '<div class="cx-none">Bu adımın içeriği kayıtta yok.</div>'}</div>`;
      }).join('');
    }
    const revertBtn = st.can
      ? `<button class="btn" data-cxrev>${icon('sync')}Geri al</button>`
      : `<button class="btn" disabled title="${esc(st.why)}">${icon('sync')}Geri al</button>`;
    return `<div class="cx-dh"><div class="cx-dp"><b>${esc(lib.baseName(f.path))}</b>${badge(f.added, f.removed, f.approx)}${tagHTML(st.tags)}<span class="cx-path mono">${esc(f.path)}</span></div>
        <div class="cx-acts"><button class="btn" data-cxshow title="Klasörde göster">${icon('folder')}</button>${revertBtn}</div></div>
      ${!st.can && st.why ? `<div class="cx-why">${icon('shield')}<span>Geri alma kapalı: ${esc(st.why)}</span></div>` : ''}
      ${X.confirm ? confirmHTML(f, d) : ''}
      ${notes.map(n => `<div class="cx-note">${esc(n)}</div>`).join('')}
      <div class="cx-diff">${body}</div>`;
  }

  // Onay kutusu: yol ve ne olacağı; dışarıda değişmişse uyarı + son bilinen ↔ şimdi farkı + ayrı onay
  function confirmHTML(f, d) {
    const warn = f.ack;
    let ext = '';
    if (warn) {
      const why = f.cur === 'outside' ? 'Dosya, oturumun son bildiği halden sonra oturum dışında değişmiş. Bu değişiklikler de kaybolacak (şimdiki içerik yedeklenir).'
        : f.cur === 'missing' ? 'Dosya oturum sırasında vardı ama şu an diskte yok (oturum dışında silinmiş ya da taşınmış).'
        : 'Oturumun dosyayı son bıraktığı hal kayıtlardan kurulamadı; şimdiki içeriğin yalnız Claude\'un değişikliklerini içerdiği doğrulanamıyor.';
      const show = f.cur === 'outside' && d && typeof d.last === 'string' && typeof d.current === 'string';
      ext = `<div class="cx-warn">${icon('shield')}<span>${esc(why)}</span></div>
        ${show ? `<div class="cx-cap">oturumun son bildiği hal → şimdi (oturum dışındaki değişiklikler)</div><div class="cx-diff cx-ext">${diffRows(d.last, d.current).html}</div>` : ''}
        <label class="cx-ack"><input type="checkbox" data-cxack ${X.ack ? 'checked' : ''}> Oturum dışındaki durumu gördüm, yine de geri al</label>`;
    }
    return `<div class="cx-confirm" role="alertdialog" aria-label="Geri alma onayı">
      <div class="cx-q"><b>Geri alınsın mı?</b><span class="mono">${esc(f.path)}</span><span>${esc(lib.confirmText(f))}</span></div>${ext}
      ${X.msg ? `<div class="cx-err">${esc(X.msg)}</div>` : ''}
      <div class="cx-cb"><button class="btn" data-cxno>Vazgeç</button><button class="btn pri" data-cxyes ${X.busy || (warn && !X.ack) ? 'disabled' : ''}>${X.busy ? 'Geri alınıyor…' : warn ? 'Yine de geri al' : 'Evet, geri al'}</button></div></div>`;
  }

  function paint() {
    let m = document.getElementById('cx');
    if (!X) { if (m) m.remove(); window.removeEventListener('keydown', onKey, true); return; }
    if (!m) { m = document.createElement('div'); m.id = 'cx'; m.className = 'modal-bg'; document.body.appendChild(m); m.addEventListener('click', onClick); m.addEventListener('change', onChange); window.addEventListener('keydown', onKey, true); }
    const tot = X.files ? lib.sum(X.files) : null;
    const keep = m.querySelector('.cx-r'), top = keep ? keep.scrollTop : 0, keepL = m.querySelector('.cx-l'), topL = keepL ? keepL.scrollTop : 0;
    m.innerHTML = `<div class="modal cx-m" role="dialog" aria-label="Değişen dosyalar">
      <div class="mh2"><h3>Değişen dosyalar${tot ? ` <span class="cx-sum">${X.files.length} dosya ${badge(tot.added, tot.removed)}</span>` : ''}<div class="cx-sub">${esc(X.title || '')}</div></h3>
        <button class="ibtn" data-cxref title="Yenile">${icon('sync')}</button><button class="ibtn" data-cxx title="Kapat (Esc)">${icon('x')}</button></div>
      <div class="cx-b"><div class="cx-l">${listHTML()}</div><div class="cx-r">${detailHTML()}</div></div></div>`;
    if (X.keepScroll) { const r = m.querySelector('.cx-r'); if (r) r.scrollTop = top; } X.keepScroll = false;
    const l = m.querySelector('.cx-l'); if (l) l.scrollTop = topL;
  }

  async function load(selPath) {
    const sid = X.sid;
    try {
      const files = await window.api.changes.list(sid);
      if (!X || X.sid !== sid) return;
      X.files = files; X.err = '';
      const i = selPath ? files.findIndex(f => f.path === selPath) : -1;
      X.sel = i >= 0 ? i : files.length ? 0 : -1;
      paint(); if (X.sel >= 0) loadDetail();
    } catch (e) { if (X && X.sid === sid) { X.err = msgOf(e); paint(); } }
  }
  async function loadDetail() {
    const f = X.files[X.sel]; if (!f) return;
    const sid = X.sid, p = f.path;
    try { const d = await window.api.changes.diff(sid, p); if (X && X.sid === sid && X.files[X.sel] && X.files[X.sel].path === p) { X.detail = d; Object.assign(f, pick(d)); paint(); } }
    catch (e) { if (X && X.sid === sid) { X.detail = { path: p, err: msgOf(e) }; paint(); } }
  }
  // Fark isteği şimdiki durumu da yeniler (liste satırı ve onayda kullanılan hash güncel kalır)
  const pick = d => ({ cur: d.cur, curError: d.curError, hash: d.hash, ack: d.ack, canRevert: d.canRevert, reason: d.reason });
  const msgOf = e => String(e && e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

  async function doRevert() {
    const f = X.files[X.sel]; if (!f || X.busy) return;
    X.busy = true; X.msg = ''; paint();
    try {
      const r = await window.api.changes.revert(X.sid, f.path, { hash: f.hash, ack: !!(f.ack && X.ack) });
      X.busy = false; X.confirm = false; X.ack = false;
      say(r.action === 'trash' ? 'Dosya Geri Dönüşüm Kutusuna taşındı' : r.action === 'none' ? 'Dosya zaten ilk halindeydi' : 'Dosya oturum başındaki haline döndürüldü' + (r.backup ? ' (yedek alındı)' : ''));
      X.lastRevert = r; X.detail = null; await load(f.path);
    } catch (e) { X.busy = false; X.msg = msgOf(e); paint(); }
  }

  function onClick(e) {
    const t = e.target;
    if (t === e.currentTarget || t.closest('[data-cxx]')) { close(); return; }
    if (t.closest('[data-cxref]')) { const f = X.files && X.files[X.sel]; X.confirm = false; X.detail = null; load(f && f.path); return; }
    const s = t.closest('[data-cxsel]'); if (s) { const i = +s.dataset.cxsel; if (i !== X.sel) { X.sel = i; X.detail = null; X.confirm = false; X.ack = false; X.msg = ''; paint(); loadDetail(); } return; }
    if (t.closest('[data-cxrev]')) { X.confirm = true; X.ack = false; X.msg = ''; X.keepScroll = false; paint(); const r = document.querySelector('#cx .cx-r'); if (r) r.scrollTop = 0; return; }
    if (t.closest('[data-cxno]')) { X.confirm = false; X.ack = false; X.msg = ''; paint(); return; }
    if (t.closest('[data-cxyes]')) { doRevert(); return; }
    if (t.closest('[data-cxshow]')) { const f = X.files[X.sel]; if (f) window.api.fs.showInFolder(f.path).then(ok => ok || say('Dosya bulunamadı')); return; }
  }
  function onChange(e) { if (e.target.matches('[data-cxack]')) { X.ack = e.target.checked; X.keepScroll = true; paint(); } }
  function onKey(e) {
    if (!X) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (X.confirm && !X.busy) { X.confirm = false; paint(); } else close(); return; }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && X.files && X.files.length && !X.confirm) {
      e.preventDefault(); e.stopPropagation();
      const i = Math.max(0, Math.min(X.files.length - 1, X.sel + (e.key === 'ArrowDown' ? 1 : -1)));
      if (i !== X.sel) { X.sel = i; X.detail = null; paint(); loadDetail(); }
    }
  }
  function open(sid, title) { X = { sid, title: title || '', files: null, sel: -1, detail: null }; paint(); load(); }
  function close() { X = null; paint(); }

  window.changesUI = { open, close, isOpen: () => !!X, state: () => X, diffRows };
})();
