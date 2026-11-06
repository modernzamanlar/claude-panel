// Yazma kutusunda "@" ile dosya önerisi penceresi. app.js'ten sonra yüklenir, onun genel adlarını kullanır
// (S, sess, API, ic, esc, autosize, updateGhost). Açıkken ↑↓/Tab/Enter/Esc buraya gider ve Tab hayaleti gizlenir
// (updateGhost, ta._mention doluyken öneri göstermez). Dosyalar sohbetin proje klasöründen gelir (api.fs.listFiles).
(function () {
  let MP = null; // {ta, el, tok, q, dir, items, sel, seq, timer}

  const dirOf = ta => { const s = sess(S.panes[+ta.dataset.ta]); const d = s && (s.cwd || s.project); return d && d !== '(bilinmiyor)' ? d : null; };

  function close() {
    if (!MP) return;
    const ta = MP.ta; clearTimeout(MP.timer); MP.el.remove(); MP = null;
    ta._mention = false; if (document.activeElement === ta) updateGhost(ta);
  }

  // Pencere, yazma kutusunun üstünde ve @ işaretinin hizasında durur
  function place() {
    const ta = MP.ta, comp = ta.closest('.comp') || ta;
    const cs = getComputedStyle(ta), m = document.createElement('div');
    m.style.cssText = `position:absolute;visibility:hidden;white-space:pre-wrap;word-wrap:break-word;box-sizing:border-box;width:${ta.clientWidth}px;font:${cs.font};letter-spacing:${cs.letterSpacing};padding:${cs.padding}`;
    m.textContent = ta.value.slice(0, MP.tok.start); const mk = document.createElement('span'); mk.textContent = '@'; m.appendChild(mk);
    document.body.appendChild(m); const x = mk.offsetLeft; m.remove();
    const r = ta.getBoundingClientRect(), c = comp.getBoundingClientRect(), w = MP.el.offsetWidth;
    MP.el.style.left = Math.max(c.left, Math.min(r.left + x - ta.scrollLeft - 10, c.right - w, innerWidth - w - 8)) + 'px';
    MP.el.style.bottom = (innerHeight - c.top + 6) + 'px';
  }

  function paint() {
    const el = MP.el;
    el.hidden = !MP.items.length;
    el.innerHTML = `<div class="mp-h">Dosyalar · Tab/↵ ekle · Esc kapat</div>` + MP.items.map((it, k) => {
      const i = it.rel.lastIndexOf('/'), par = i >= 0 ? it.rel.slice(0, i + 1) : '';
      return `<div class="mp-it${k === MP.sel ? ' on' : ''}" title="${esc(it.rel)}">${ic(it.dir ? 'folder' : 'file')}<b>${esc(it.name)}${it.dir ? '/' : ''}</b><span>${esc(par)}</span></div>`;
    }).join('');
    if (!el.hidden) { place(); el.querySelector('.mp-it.on').scrollIntoView({ block: 'nearest' }); }
  }

  // Yazılana bakar: imleç bir @ belirtecindeyse pencereyi açar/günceller, değilse kapatır
  function check(ta) {
    const dir = dirOf(ta);
    let tok = dir && document.activeElement === ta && !ta.disabled && ta.selectionStart === ta.selectionEnd ? mention.token(ta.value, ta.selectionStart) : null;
    if (!tok) delete ta._mentionOff;
    else if (ta._mentionOff === tok.start) tok = null; // Esc ile kapatılan belirteç, silinene kadar yeniden açılmaz
    if (!tok) { if (MP && MP.ta === ta) close(); return; }
    if (MP && MP.ta !== ta) close();
    if (!MP) {
      const el = document.createElement('div'); el.className = 'mention-pop'; el.hidden = true; document.body.appendChild(el);
      el.addEventListener('mousedown', e => { e.preventDefault(); const it = e.target.closest('.mp-it'); if (it) pick([...el.children].indexOf(it) - 1); });
      el.addEventListener('mousemove', e => { const it = e.target.closest('.mp-it'), k = it ? [...el.children].indexOf(it) - 1 : -1; if (k >= 0 && k !== MP.sel) { MP.sel = k; paint(); } });
      MP = { ta, el, items: [], sel: 0, seq: 0 };
    }
    MP.tok = tok; ta._mention = true; updateGhost(ta);
    if (MP.q === tok.q && MP.dir === dir) { if (!MP.el.hidden) place(); return; }
    MP.q = tok.q; MP.dir = dir;
    clearTimeout(MP.timer); const seq = ++MP.seq;
    MP.timer = setTimeout(async () => {
      const items = await API.fs.listFiles(dir, tok.q).catch(() => []);
      if (!MP || MP.seq !== seq) return;
      MP.items = Array.isArray(items) ? items : []; MP.sel = 0; paint();
    }, 50);
  }

  function pick(k) {
    const it = MP && MP.items[k]; if (!it) return;
    const ta = MP.ta, r = mention.apply(ta.value, MP.tok, it);
    ta.value = r.text; ta.setSelectionRange(r.caret, r.caret); autosize(ta);
    const s = sess(S.panes[+ta.dataset.ta]); if (s) s.inputDraft = ta.value;
    check(ta); // klasörse içindekiler önerilir, dosyada belirteç biter ve pencere kapanır
  }

  // Tuşlar composer.js'teki tek yönlendiriciden gelir (Tab hayaleti ve Enter göndermeden önce). İşlendiyse true.
  function key(e) {
    if (!MP || e.target !== MP.ta || e.isComposing || MP.el.hidden || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return false;
    if (e.key === 'Escape') { MP.ta._mentionOff = MP.tok.start; close(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { const n = MP.items.length; MP.sel = (MP.sel + (e.key === 'ArrowDown' ? 1 : n - 1)) % n; paint(); }
    else if (e.key === 'Enter' || e.key === 'Tab') pick(MP.sel);
    else return false;
    return true;
  }
  window.mentionUI = { key, close };
  const isTa = t => t && t.matches && t.matches('[data-ta]');
  document.addEventListener('input', e => { if (isTa(e.target)) check(e.target); });
  document.addEventListener('keyup', e => { if (isTa(e.target) && /^(Arrow(Left|Right)|Home|End)$/.test(e.key)) check(e.target); });
  document.addEventListener('mouseup', e => { if (isTa(e.target)) setTimeout(() => check(e.target)); });
  document.addEventListener('focusin', e => { if (isTa(e.target)) check(e.target); });
  document.addEventListener('focusout', e => { if (MP && e.target === MP.ta) close(); });
  addEventListener('resize', () => { if (MP && !MP.el.hidden) place(); });
})();
