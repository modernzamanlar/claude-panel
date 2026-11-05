/* ---------- Tarayıcı paneli (önizleme) ----------
   Sağda, bilgi panelinin yerinde açılır (⇧⌘P / üst çubuktaki küre düğmesi). Sayfanın kendisi ana süreçteki
   WebContentsView'dadır ve her şeyin üstünde çizilir; burası yalnızca adres çubuğunu ve yer tutucuyu (#bpView) çizer,
   yer tutucunun konumunu ana sürece bildirir. Sohbetler penceresi, arama, menü ya da diyalog yer tutucunun üstüne
   gelirse görünüm gizlenir (yoksa onları örterdi). Son adres WS.prefs.browserUrl'de saklanır.
   app.js'ten sonra yüklenir: S, WS, persist, render, toast, MOD, $ oradan gelir. */
(() => {
  const B = window.api && window.api.browser;
  if(!B) return;
  const BP = { open:false, st:{url:'', title:'', loading:false, canBack:false, canFwd:false, error:null}, sent:'null', t:0, last:0 };
  // Sohbetteki bu adresler sistem tarayıcısı yerine panelde açılır
  const LOCAL_RX = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0|[a-z0-9-]+\.localhost)(:\d+)?([/?#]|$)/i;
  const SV = p => `<svg class="i" viewBox="0 0 24 24">${p}</svg>`;
  const I = {
    back: SV('<path d="m15 18-6-6 6-6"/>'), fwd: SV('<path d="m9 18 6-6-6-6"/>'),
    reload: SV('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'), stop: SV('<path d="M6 6l12 12M18 6 6 18"/>'),
    ext: SV('<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>'),
    x: SV('<path d="M6 6l12 12M18 6 6 18"/>'),
  };

  const el = document.createElement('aside');
  el.className = 'bp'; el.id = 'bp'; el.hidden = true;
  el.innerHTML = `<div class="bp-bar">
      <button class="ibtn" id="bpBack" title="Geri">${I.back}</button><button class="ibtn" id="bpFwd" title="İleri">${I.fwd}</button>
      <button class="ibtn" id="bpReload" title="Yenile">${I.reload}</button>
      <input class="bp-url" id="bpUrl" spellcheck="false" autocomplete="off" placeholder="localhost:3000 ya da bir adres">
      <button class="ibtn" id="bpExt" title="Tarayıcıda aç">${I.ext}</button><button class="ibtn" id="bpClose" title="Kapat (⇧⌘P)">${I.x}</button>
    </div><div class="bp-load"></div>
    <div class="bp-view" id="bpView"><div class="bp-msg" id="bpMsg"></div></div>`;
  const info = $('#info'); info.parentNode.insertBefore(el, info.nextSibling);
  const url = $('#bpUrl'), view = $('#bpView'), msg = $('#bpMsg');

  function paint(){
    const st = BP.st;
    $('#bpBack').disabled = !st.canBack; $('#bpFwd').disabled = !st.canFwd; $('#bpExt').disabled = !st.url;
    const rl = $('#bpReload'); rl.innerHTML = st.loading ? I.stop : I.reload; rl.title = st.loading ? 'Durdur' : 'Yenile';
    el.classList.toggle('loading', !!st.loading);
    if(document.activeElement !== url) url.value = st.url;
    url.title = st.title || st.url;
    const m = st.error ? `<b>Sayfa açılamadı</b><span>${esc(st.error.desc || 'Bağlantı kurulamadı')}</span><span class="mono">${esc(st.error.url || st.url)}</span>${LOCAL_RX.test(st.error.url || st.url) ? '<span>Yerel sunucu çalışıyor mu?</span>' : ''}`
      : st.url ? '' : '<b>Önizleme</b><span>Bir adres yaz: <span class="mono">localhost:3000</span> gibi yerel bir sunucu ya da bir web sitesi.</span>';
    if(msg._h !== m){ msg.innerHTML = m; msg._h = m; }
    msg.hidden = !m;
    $('#btnBrowser')?.classList.toggle('on', BP.open);
  }

  // ---- görünümün yeri: yer tutucu üstü kapalı değilse dikdörtgeni, kapalıysa null gönder ----
  const hit = (a, b) => a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
  function covered(r){
    if($('#org.open') || $('#srch.open')) return true;
    for(const o of document.querySelectorAll('.menu, .modal-bg, .lb, .drag-ghost')) if(hit(o.getBoundingClientRect(), r)) return true;
    // üstüne binen başka bir şey (başka modüllerin katmanları dahil): köşeler ve orta yer tutucuya düşmeli
    return [[.5,.5],[.01,.01],[.99,.01],[.01,.99],[.99,.99]].some(([fx, fy]) => { const e = document.elementFromPoint(r.left + r.width*fx, r.top + r.height*fy); return !e || !view.contains(e); });
  }
  function sync(){
    BP.t = 0; let r = null;
    if(BP.open && BP.st.url && !BP.st.error){
      const q = view.getBoundingClientRect();
      if(q.width > 0 && q.height > 0 && !covered(q)) r = {x:q.left, y:q.top, width:q.width, height:q.height};
    }
    const k = JSON.stringify(r); if(k !== BP.sent){ BP.sent = k; B.bounds(r); }
    document.body.style.setProperty('--bpw', BP.open ? el.offsetWidth + 'px' : '0px');
  }
  const schedule = () => { if(!BP.t) BP.t = setTimeout(sync, 16); };
  new MutationObserver(schedule).observe(document.body, {childList:true, subtree:true, attributes:true, attributeFilter:['class','hidden','open']});
  new ResizeObserver(schedule).observe(view);
  window.addEventListener('resize', schedule);

  function saveUrl(u){ if(!WS || !u || (WS.prefs && WS.prefs.browserUrl === u)) return; WS.prefs = {...(WS.prefs||{}), browserUrl:u}; persist(); }
  async function go(input){
    const r = await B.navigate(input);
    if(!r || !r.ok){ toast((r && r.error) || 'Adres açılamadı'); paint(); return r; }
    BP.st = {...BP.st, url:r.url, error:null}; paint(); saveUrl(r.url); schedule(); return r;
  }
  function setOpen(v){
    BP.open = v; el.hidden = !v; document.querySelector('.app').classList.toggle('bp-on', v); paint(); schedule();
    if(!v) return;
    const last = WS && WS.prefs && WS.prefs.browserUrl;
    if(!BP.st.url && last) go(last);
    else if(!BP.st.url) setTimeout(() => url.focus(), 30);
  }
  // menü hızlandırıcısı ve sayfadaki tuş aynı anda gelirse bir kez aç/kapa
  function toggle(){ if(Date.now() - BP.last < 250) return; BP.last = Date.now(); setOpen(!BP.open); }
  // Bilgi paneli düğmesi/⌘I panel açıkken: paneli kapatıp bilgi panelini gösterir
  function showInfo(){ setOpen(false); if(!S.info){ S.info = true; render(); } }

  B.onState(st => { BP.st = st; paint(); schedule(); if(st.url && !st.error) saveUrl(st.url); });
  B.onBlocked(x => toast(x.kind === 'download' ? 'İndirme önizlemede engellendi · “Tarayıcıda aç” ile indirebilirsin' : 'Bu bağlantı önizlemede açılamaz'));
  API.onMenu(({cmd}) => { if(cmd === 'browser') toggle(); else if(cmd === 'info' && BP.open) showInfo(); });

  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b || b.disabled) return;
    if(b.id === 'bpClose') setOpen(false);
    else if(b.id === 'bpBack') B.cmd('back');
    else if(b.id === 'bpFwd') B.cmd('forward');
    else if(b.id === 'bpReload') { if(BP.st.loading) B.cmd('stop'); else if(BP.st.url) B.cmd('reload'); }
    else if(b.id === 'bpExt') B.cmd('external');
  });
  url.addEventListener('keydown', e => {
    if(e.key === 'Enter'){ e.preventDefault(); e.stopPropagation(); if(url.value.trim()) go(url.value).then(r => r && r.ok && url.blur()); }
    if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); url.value = BP.st.url; url.blur(); }
  });
  url.addEventListener('focus', () => url.select());
  document.addEventListener('keydown', e => {
    if(MOD(e) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'p'){ e.preventDefault(); e.stopPropagation(); toggle(); return; }
    if(BP.open && MOD(e) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'i'){ e.preventDefault(); e.stopPropagation(); showInfo(); }
  }, true);
  document.addEventListener('click', e => {
    if(e.target.closest('#btnBrowser')){ e.stopPropagation(); closeMenu(); toggle(); return; }
    if(BP.open && e.target.closest('#btnInfo')){ e.stopPropagation(); showInfo(); return; }
    // sohbetteki yerel sunucu bağlantıları panelde açılır
    const a = e.target.closest('a[href]');
    if(a && !a.closest('#bp') && LOCAL_RX.test(a.href)){ e.preventDefault(); if(!BP.open) setOpen(true); go(a.href); }
  }, true);

  B.state().then(st => { if(st) BP.st = st; paint(); }).catch(() => {});
  paint();
  window.__bp = () => ({open:BP.open, st:{...BP.st}, sent:JSON.parse(BP.sent)}); // selftest için
})();
