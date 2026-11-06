// Yazma kutusu: tuş yönlendirici (tek yer), "/" menüsü (şablon + komut + skill), ↑/↓ geçmiş, sıradaki mesajlar.
// app.js ve mention-ui.js'ten sonra yüklenir; onların genel adlarını kullanır (S, sess, API, ic, esc, autosize, updateGhost,
// acceptGhost, send, templates, newChat, renderNC, renderPanes, runQueue, toast). Saf mantık: slash.js, history.js, queue.js.
//
// Tuş sırası (yakalama aşamasında, yazma kutusunda): @ dosya önerisi → / menüsü → ↑/↓ geçmiş → Tab/Esc hayalet öneri →
// Enter (panel komutu ya da gönder). İşlenen tuşun varsayılanı ve yayılımı durdurulur (Ctrl+Enter izin onayına düşmez).
(function () {
  const isTa = t => !!(t && t.matches && t.matches('[data-ta]'));
  const sessOf = ta => sess(S.panes[+ta.dataset.ta]);
  const dirOf = s => { const d = s && (s.cwd || s.project); return d && d !== '(bilinmiyor)' ? d : null; };

  /* ---------- Komut kaynakları ---------- */
  const CLI_DIR = new Map(); // klasör → CLI'nin bildirdiği komut bilgisi (aynı klasördeki başka sohbetler de kullanır)
  const FSC = new Map();     // klasör → {at, list|null, p} dosya taraması (ana süreç)
  const cliFor = s => (s && s._cli) || CLI_DIR.get(dirOf(s)) || null;

  function filesFor(s, onReady) {
    const d = dirOf(s) || '', c = FSC.get(d), now = Date.now();
    if (c && (c.p || now - c.at < 60000)) return c.list;
    const e = { at: now, list: c ? c.list : null };
    e.p = API.cmd.list(d || null).then(l => { e.list = Array.isArray(l) ? l : []; }).catch(() => { e.list = e.list || []; })
      .finally(() => { e.p = null; e.at = Date.now(); onReady && onReady(); });
    FSC.set(d, e);
    return e.list;
  }

  // runner olayları (onRun'dan çağrılır). true dönerse olay burada işlendi.
  function onEvent(s, ev) {
    if (!s || !ev) return false;
    if (ev.type === 'system' && (ev.subtype === 'init' || ev.subtype === 'commands_changed')) {
      s._cli = slash.fromEvent(s._cli, ev); const d = dirOf(s); if (d) CLI_DIR.set(d, s._cli);
      return ev.subtype === 'commands_changed'; // init'i app.js de işler
    }
    // Yerel komut çıktısı (/compact → "Compacted"): yanıt balonunda not olarak gösterilir
    if (ev.type === 'user' && ev.message && typeof ev.message.content === 'string' && s.run && !ev.parent_tool_use_id) {
      const m = /<local-command-(stdout|stderr)>([\s\S]*?)<\/local-command-\1>/.exec(ev.message.content);
      if (m && m[2].trim()) s.run.live.b.push({ t: 'text', v: `<p class="run-note">${m[1] === 'stderr' ? '⚠ ' : '✓ '}${esc(m[2].trim())}</p>` });
      return true;
    }
    if (ev.type === 'system' && ev.subtype === 'compact_boundary' && s.run) { s.run.live.b.push({ t: 'text', v: '<p class="run-note">Bağlam sıkıştırıldı</p>' }); return true; }
    return false;
  }

  /* ---------- "/" menüsü ---------- */
  let SP = null; // {ta, el, tok, list, sel}

  function closeSlash() {
    if (!SP) return;
    const ta = SP.ta; SP.el.remove(); SP = null;
    ta._slash = false; if (document.activeElement === ta) updateGhost(ta);
  }

  function placeSlash() {
    const ta = SP.ta, comp = ta.closest('.comp') || ta, c = comp.getBoundingClientRect(), w = SP.el.offsetWidth;
    SP.el.style.left = Math.max(8, Math.min(c.left, innerWidth - w - 8)) + 'px';
    SP.el.style.bottom = (innerHeight - c.top + 6) + 'px';
  }

  // Seçili öğe şablonsa eski "/ad" hayalet önerisi (Tab ile aynı şablon) görünmeye devam eder; komut/skill seçiliyken gizlenir
  function syncGhost() {
    const ta = SP.ta, it = !SP.el.hidden && SP.list[SP.sel];
    ta._slash = !!it && it.sec !== 'tpl';
    updateGhost(ta);
    if (it && ta._sug && (ta._sug.kind !== 'template' || ta._sug.name !== it.name)) { ta._sug = null; ta.parentElement.querySelector('.ghost').innerHTML = ''; }
  }

  function paintSlash() {
    const el = SP.el;
    el.hidden = !SP.list.length;
    syncGhost();
    if (el.hidden) return;
    el.innerHTML = `<div class="mp-h">/ menüsü · ↑↓ seç · Tab/↵ ekle · Esc kapat</div>` + slash.sections(SP.list).map(g =>
      `<div class="mp-sec">${esc(g.title)}</div>` + g.items.map(({ it, k }) =>
        `<div class="mp-it sl-it${k === SP.sel ? ' on' : ''}" data-slk="${k}" title="${esc(it.sec === 'tpl' ? it.text : it.desc || it.name)}">${ic(it.sec === 'tpl' ? 'bolt' : it.sec === 'skill' ? 'note' : 'term')}`
        + `<b>${it.sec === 'tpl' ? '' : '/'}${esc(it.name)}</b>${it.hint ? `<i class="sl-hint">${esc(it.hint)}</i>` : ''}<span>${esc(it.desc || '')}</span><em class="sl-src">${esc(slash.srcLabel(it))}</em></div>`).join('')).join('');
    placeSlash();
    const on = el.querySelector('.sl-it.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  }

  function refreshSlash() {
    if (!SP) return;
    const s = sessOf(SP.ta);
    const all = slash.build({ cli: cliFor(s), files: filesFor(s, refreshSlash), templates: templates() });
    const cur = SP.list[SP.sel];
    SP.list = slash.filter(all, SP.tok.q);
    const k = cur ? SP.list.findIndex(x => x.name === cur.name && x.sec === cur.sec) : -1;
    SP.sel = SP.q === SP.tok.q && k >= 0 ? k : 0; SP.q = SP.tok.q;
    paintSlash();
  }

  function checkSlash(ta) {
    const s = sessOf(ta);
    let tok = s && document.activeElement === ta && !ta.disabled && ta.selectionStart === ta.selectionEnd ? slash.token(ta.value, ta.selectionStart) : null;
    if (!tok) delete ta._slashOff;
    else if (ta._slashOff) tok = null; // Esc ile kapatıldı: "/" silinene kadar yeniden açılmaz (hayalet şablon önerisi geri gelir)
    if (!tok) { if (SP && SP.ta === ta) closeSlash(); return; }
    if (SP && SP.ta !== ta) closeSlash();
    if (!SP) {
      const el = document.createElement('div'); el.className = 'mention-pop slash-pop'; el.hidden = true; document.body.appendChild(el);
      el.addEventListener('mousedown', e => { e.preventDefault(); const it = e.target.closest('[data-slk]'); if (it) pickSlash(+it.dataset.slk); });
      el.addEventListener('mousemove', e => { const it = e.target.closest('[data-slk]'); if (it && +it.dataset.slk !== SP.sel) { SP.sel = +it.dataset.slk; paintSlash(); } });
      SP = { ta, el, list: [], sel: 0, q: null };
    }
    SP.tok = tok; ta._slash = true; updateGhost(ta);
    refreshSlash();
  }

  function runAction(ta, action) {
    const i = +ta.dataset.ta, s = sessOf(ta); if (!s) return;
    if (action === 'new') { newChat({ pane: i, group: s.folder || null }); if (typeof NC !== 'undefined' && NC && dirOf(s)) { NC.dir = s.project; renderNC(); } return; }
    const b = document.querySelector(`[data-${action === 'model' ? 'model' : 'effort'}="${CSS.escape(s.id)}"]`);
    if (b) b.click();
  }

  function setText(ta, text, caret) {
    ta.value = text; ta.setSelectionRange(caret, caret); autosize(ta);
    const s = sessOf(ta); if (s) s.inputDraft = ta.value;
  }

  function pickSlash(k) {
    const it = SP && SP.list[k]; if (!it) return;
    const ta = SP.ta, r = slash.apply(ta.value, SP.tok, it);
    setText(ta, r.text, r.caret);
    closeSlash(); checkSlash(ta); updateGhost(ta);
    if (r.action) runAction(ta, r.action);
  }

  function slashKey(e) {
    if (!SP || e.target !== SP.ta || SP.el.hidden || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return false;
    if (e.key === 'Escape') { SP.ta._slashOff = true; closeSlash(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { SP.sel = slash.move(SP.sel, SP.list.length, e.key === 'ArrowDown' ? 1 : -1); paintSlash(); }
    else if (e.key === 'Enter' || e.key === 'Tab') pickSlash(SP.sel);
    else return false;
    return true;
  }

  /* ---------- ↑/↓ geçmiş ---------- */
  function histKey(ta, dir) {
    const s = sessOf(ta); if (!s) return false;
    const a = ta.selectionStart, b = ta.selectionEnd;
    if (dir < 0 ? !inputHistory.canUp(ta.value, a, b) : !inputHistory.canDown(s._hist, ta.value, a, b)) return false;
    const r = inputHistory.step(s._hist, inputHistory.entries(s.msgs), dir, ta.value);
    if (!r) return false;
    s._hist = r.state; setText(ta, r.text, r.text.length); updateGhost(ta);
    return true;
  }

  /* ---------- Tuş yönlendirici ---------- */
  function route(ta, e) {
    if (window.mentionUI && mentionUI.key(e)) return true;
    if (slashKey(e)) return true;
    const plain = !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey;
    if (plain && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && histKey(ta, e.key === 'ArrowUp' ? -1 : 1)) return true;
    if (e.key === 'Tab' && !e.shiftKey && ta._sug) { acceptGhost(ta); return true; }
    if (e.key === 'Escape' && ta._sug) { ta._sug = null; ta.parentElement.querySelector('.ghost').innerHTML = ''; ta.dataset.noghost = ta.value; return true; }
    if (e.key === 'Enter' && !e.shiftKey) {
      const s = sessOf(ta); if (s) s._hist = null;
      const x = slash.intercept(ta.value);
      if (x && !(s && s.attach && s.attach.length)) { setText(ta, '', 0); updateGhost(ta); runAction(ta, x.action); return true; }
      send(+ta.dataset.ta); return true;
    }
    return false;
  }
  document.addEventListener('keydown', e => {
    if (e.isComposing) return;
    if (isTa(e.target)) { if (route(e.target, e)) { e.preventDefault(); e.stopPropagation(); } return; }
    if (e.target.matches && e.target.matches('[data-qedtext]')) { // sıradaki mesajı yerinde düzenleme
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); queueAct({ dataset: { qact: 'save', sid: e.target.dataset.sid, k: e.target.dataset.qedtext } }); }
      else if (e.key === 'Escape') { e.preventDefault(); queueAct({ dataset: { qact: 'cancel', sid: e.target.dataset.sid } }); }
      e.stopPropagation(); // Esc çalışan turu durdurmasın
    }
  }, true);
  document.addEventListener('input', e => {
    if (isTa(e.target)) { const s = sessOf(e.target); if (s) s._hist = null; checkSlash(e.target); }
    else if (e.target.matches && e.target.matches('[data-qedtext]')) { const s = sess(e.target.dataset.sid); if (s && s.qEdit) s.qEdit.text = e.target.value; }
  });
  document.addEventListener('keyup', e => { if (isTa(e.target) && /^(Arrow(Left|Right)|Home|End)$/.test(e.key)) checkSlash(e.target); });
  document.addEventListener('mouseup', e => { if (isTa(e.target)) setTimeout(() => checkSlash(e.target)); });
  document.addEventListener('focusin', e => { if (isTa(e.target)) checkSlash(e.target); });
  document.addEventListener('focusout', e => { if (SP && e.target === SP.ta) closeSlash(); });
  addEventListener('resize', () => { if (SP && !SP.el.hidden) placeSlash(); });

  /* ---------- Sıradaki mesajlar: taşı, düzenle, yazma kutusuna geri al ---------- */
  function queueRows(s) {
    const ed = s.qEdit;
    return s.queue.map((q, k) => {
      const att = (q.att || []).length ? `<span class="q-att" title="${esc(q.att.map(a => a.name).join(', '))}">${ic('clip')}${q.att.length}</span>` : '';
      if (ed && ed.k === k) return `<div class="q-row q-edit"><span class="q-k">${k + 1}</span><textarea class="inp q-ta" rows="2" data-qedtext="${k}" data-sid="${esc(s.id)}">${esc(ed.text)}</textarea>${att}
        <button class="btn pri" data-qact="save" data-k="${k}" data-sid="${esc(s.id)}">Kaydet</button><button class="btn" data-qact="cancel" data-sid="${esc(s.id)}">Vazgeç</button></div>`;
      const btn = (a, icon, tip, dis) => `<button class="ibtn" data-qact="${a}" data-k="${k}" data-sid="${esc(s.id)}" title="${tip}"${dis ? ' disabled' : ''}>${icon}</button>`;
      return `<div class="q-row"><span class="q-k">${k + 1}</span><span class="q-txt" data-qact="edit" data-k="${k}" data-sid="${esc(s.id)}" title="Düzenlemek için tıkla">${esc(msgQueue.label(q))}</span>${att}${ed ? '' : `<span class="q-acts">`
        + btn('up', ic('up'), 'Yukarı taşı', k === 0) + btn('down', ic('up', 'flip'), 'Aşağı taşı', k === s.queue.length - 1)
        + btn('edit', ic('edit'), 'Düzenle') + btn('back', ic('msg'), 'Yazma kutusuna geri al')
        + `<button class="ibtn" data-qdel="${k}" data-sid="${esc(s.id)}" title="Sıradan çıkar">${ic('x')}</button></span>`}</div>`;
    }).join('');
  }

  function queueAct(el) {
    const d = el.dataset, s = sess(d.sid); if (!s || !s.queue) return;
    const k = +d.k, a = d.qact;
    if (a === 'up' || a === 'down') msgQueue.move(s.queue, k, a === 'up' ? -1 : 1);
    else if (a === 'edit') { if (!s.qEdit && s.queue[k]) s.qEdit = { k, text: s.queue[k].text || '' }; }
    else if (a === 'save') { if (s.qEdit) { msgQueue.edit(s.queue, s.qEdit.k, s.qEdit.text); s.qEdit = null; } }
    else if (a === 'cancel') s.qEdit = null;
    else if (a === 'back') {
      const i = S.panes.indexOf(s.id), ta = i >= 0 && document.querySelector(`[data-ta="${i}"]`);
      if (!ta) { toast('Önce sohbeti bir bölmede aç'); return; }
      const r = msgQueue.takeBack(s.queue, k, ta.value); if (!r) return;
      setText(ta, r.text, r.text.length); s.attach = [...r.att, ...(s.attach || [])];
      renderPanes(); ta.focus(); updateGhost(ta); return;
    }
    renderPanes();
    if (a === 'edit') { const t = document.querySelector(`[data-qedtext][data-sid="${CSS.escape(s.id)}"]`); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }
    if ((a === 'save' || a === 'cancel') && !s.run) runQueue(s); // düzenleme sürerken tur bittiyse bekleyen gönderim şimdi yapılır
  }

  window.composerUI = { onEvent, queueRows, queueAct, close: closeSlash };
})();
