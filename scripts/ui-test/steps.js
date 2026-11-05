(async()=>{
  window.W = ms => new Promise(r=>setTimeout(r,ms));
  window.R = {}; window.ok = (k, v) => { R[k] = v; return v; };
  await W(5500);
  const bg = () => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  const t0 = isDarkTheme(), b0 = bg();
  document.querySelector('#btnTheme').click(); await W(150);
  const t1 = isDarkTheme(), b1 = bg();
  document.querySelector('#btnTheme').click(); await W(150);
  const t2 = isDarkTheme(), b2 = bg();
  document.querySelector('#btnTheme').click(); await W(150);
  return {platWin: document.documentElement.classList.contains('plat-win'), tema: [t0,t1,t2], renk: [b0,b1,b2], degisti: t0!==t1 && t1!==t2 && b0!==b1 && b1!==b2, kayit: WS.prefs.theme, sonTema: document.documentElement.dataset.theme};
})()
//--
(async()=>{
  const res = {};
  for (const l of [1,2,3,4]) { document.querySelector(`#layouts [data-l="${l}"]`).click(); await W(120); res['l'+l] = document.querySelectorAll('#grid > .pane').length; }
  document.querySelector('#layouts [data-l="2"]').click(); await W(100);
  document.querySelector('#btnOrg').click(); await W(400); res.pano = document.querySelector('#org').classList.contains('open');
  const sl = document.querySelector('.slots .slot'); res.panoYuvaGorunumu = sl ? getComputedStyle(sl).display : 'yok';
  if (sl) { document.querySelectorAll('.slots .slot')[1]?.click(); await W(200); res.yuvaTiklamaEtkin = S.active; S.active = 0; setOrg(true); await W(200); }
  document.querySelector('#btnOrg').click(); await W(200); res.panoKapandi = !document.querySelector('#org').classList.contains('open');
  setSearch(true); await W(300); const sq = document.querySelector('#sq'); sq.value = 'panel'; sq.dispatchEvent(new Event('input',{bubbles:true})); await W(1500);
  res.aramaAcik = document.querySelector('#srch').classList.contains('open'); res.aramaSonuc = document.querySelectorAll('#srch [data-sres], #srch .rc, #srch .r-card').length;
  setSearch(false); await W(200);
  showHelp(); await W(200); const h = document.querySelector('.help-grid'); res.yardim = !!h; res.yardimCtrl = h ? /Ctrl\+/.test(h.textContent) : null; res.yardimCmd = h ? /⌘/.test(h.textContent) : null; document.querySelector('[data-helpx]')?.click();
  document.querySelector('#btnInfo').click(); await W(200); res.bilgiKapali = document.querySelector('#info').classList.contains('off');
  document.querySelector('#btnInfo').click(); await W(200); res.bilgiAcik = !document.querySelector('#info').classList.contains('off');
  return res;
})()
//--
(async()=>{
  const res = {};
  newChat(); await W(400); res.yeniSohbetDiyalog = !!document.querySelector('#ncTitle'); document.querySelector('.modal-bg, .ovl')?.click(); NC = null; renderNC(); await W(200);
  const eff = document.querySelector('[data-pane="0"] [data-effort]'); eff.click(); await W(200);
  document.querySelector('[data-m="effort"][data-v="xhigh"]').click(); await W(200);
  res.dusunme = document.querySelector('[data-pane="0"] [data-effort]').textContent.trim(); res.dusunmeOdak = document.activeElement.dataset.ta;
  const C = () => document.querySelector('[data-pane="0"] [data-control]'); res.kontrolVarsayilan = C().classList.contains('on'); C().click(); await W(300); res.kontrolKapandi = !C().classList.contains('on'); C().click(); await W(600); res.kontrol = C().classList.contains('on');
  const s0 = sess(S.panes[0]); addAttachments(s0, [{name:'a.txt', path:'/tmp/a.txt', isImage:false}, {name:'b.txt', path:'/tmp/b.txt', isImage:false}]); await W(150);
  document.querySelector('[data-pane="0"] [data-unattach="0"]').click(); await W(150);
  res.ekKaldir = (s0.attach||[]).map(a => a.name); s0.attach = []; renderPanes();
  return res;
})()
//--
(async()=>{
  const res = {};
  const t1 = document.querySelector('[data-ta="1"]'); t1.focus(); t1.value = 'öbür bölme'; t1.dispatchEvent(new Event('input',{bubbles:true}));
  document.querySelector('[data-ta="0"]').value = 'merhaba sahte';
  let lost = 0; const iv = setInterval(() => { if (document.activeElement !== document.querySelector('[data-ta="1"]')) lost++; }, 50);
  send(0, {force:true}); await W(120); document.querySelector('[data-ta="1"]').focus();
  for (let k = 0; k < 60 && !document.querySelector('[data-pane="0"] .perm'); k++) await W(100);
  clearInterval(iv);
  res.odakKaybi = lost; res.izinKarti = !!document.querySelector('[data-pane="0"] .perm');
  res.izinMetni = document.querySelector('[data-pane="0"] .perm .perm-h')?.textContent.trim().slice(0, 60);
  res.izinKisayol = document.querySelector('[data-pane="0"] .perm [data-perm="allow"]')?.textContent.trim();
  document.querySelector('[data-pane="0"] [data-perm="allow"]').click();
  for (let k = 0; k < 80 && sess(S.panes[0]).run; k++) await W(100);
  const s0 = sess(S.panes[0]);
  res.bitti = !s0.run; res.argEffort = null;
  res.sonMesaj = s0.msgs.slice(-1)[0].b.map(b => b.t === 'tool' ? 'araç:' + b.n : 'metin').join(',');
  res.t1 = document.querySelector('[data-ta="1"]').value;
  return res;
})()
//--
(async()=>{
  const res = {};
  document.querySelector('[data-ta="0"]').value = 'uzun iş';
  send(0, {force:true}); await W(400);
  res.calisiyor = !!sess(S.panes[0]).run;
  document.querySelector('[data-pane="0"] [data-stop]')?.click();
  for (let k = 0; k < 120 && sess(S.panes[0]).run; k++) await W(100);
  res.durdu = !sess(S.panes[0]).run;
  res.notu = sess(S.panes[0]).msgs.slice(-1)[0].b.some(b => /Durduruldu/.test(b.v || ''));
  await W(800); res.workspacePrefs = WS.prefs;
  return res;
})()
//--
(async()=>{
  const res = {};
  setOrg(true); go(null); FX.view = 'grid'; renderBoard(); await W(300);
  res.kenarAcik = !document.querySelector('#org').classList.contains('noside') && getComputedStyle(document.querySelector('#fxSide')).display !== 'none';
  res.yazi = {...FONT}; res.uzaktan = S.sessions.filter(x => !gone(x.id) && SMART[':remote'].test(x)).length;
  res.sira = FX.sort; const ids = listing(); const nm = ids.filter(i => i[0]==='s').map(nameOf);
  res.adaGore = nm.every((x, i) => !i || nm[i-1].localeCompare(x, 'tr') <= 0);
  const body = document.querySelector('#fxBody'), br = body.getBoundingClientRect(), its = [...body.querySelectorAll('[data-item]')];
  res.ogeSayisi = its.length;
  const P = (type, el, x, y, extra={}) => el.dispatchEvent(new PointerEvent(type, {bubbles:true, cancelable:true, clientX:x, clientY:y, button:0, buttons:type==='pointerup'?0:1, pointerId:1, isPrimary:true, ...extra}));
  const x0 = br.left + 6, y0 = br.top + 6, start = document.elementFromPoint(x0, y0);
  res.baslangicBos = !!start && !start.closest('[data-item]');
  const tgt = its[Math.min(2, its.length-1)].getBoundingClientRect();
  P('pointerdown', start, x0, y0); P('pointermove', document.body, x0+20, y0+20);
  P('pointermove', document.body, tgt.left + tgt.width/2, tgt.top + tgt.height/2); await W(50);
  res.kutu = !!document.querySelector('#fxBody .fx-lasso');
  P('pointerup', document.body, tgt.left + tgt.width/2, tgt.top + tgt.height/2);
  start.dispatchEvent(new MouseEvent('click', {bubbles:true, clientX:x0, clientY:y0, detail:1}));
  res.secilen = FX.sel.size; res.ilkSecili = FX.sel.has(its[0].dataset.item); res.kutuKalkti = !document.querySelector('.fx-lasso');
  res.seciliSinif = body.querySelectorAll('[data-item].sel').length;
  P('pointerdown', start, x0, y0); P('pointermove', document.body, tgt.left+5, tgt.top+5);
  document.body.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true})); P('pointerup', document.body, tgt.left+5, tgt.top+5);
  res.escGeriAldi = FX.sel.size === res.secilen; res.escKutu = !document.querySelector('.fx-lasso');
  start.dispatchEvent(new MouseEvent('contextmenu', {bubbles:true, cancelable:true, clientX:x0, clientY:y0}));
  await W(50); const m = document.querySelector('.menu');
  res.sagTikMenu = m ? [...m.querySelectorAll('[data-m]')].map(b => b.dataset.m) : null; res.sagTikSecimTemiz = FX.sel.size === 0;
  m?.querySelector('[data-m="bgview"][data-v="list"]')?.click(); await W(100);
  res.listeGorunum = FX.view === 'list' && !!document.querySelector('#fxBody .fx-list');
  document.querySelector('#fxBody').dispatchEvent(new MouseEvent('contextmenu', {bubbles:true, cancelable:true, clientX:x0, clientY:br.bottom-10}));
  await W(50); document.querySelector('.menu [data-m="sort"][data-k="date"]')?.click(); await W(100);
  res.siraKayit = WS.prefs.sort;
  document.querySelector('.menu')?.remove();
  document.querySelector('#fxSide').dispatchEvent(new MouseEvent('contextmenu', {bubbles:true, cancelable:true, clientX:br.left-40, clientY:br.bottom-10}));
  await W(50); res.kenarMenu = [...document.querySelectorAll('.menu [data-m]')].map(b => b.dataset.m); closeMenu();
  document.querySelector('#fxSideBtn').click(); await W(100); res.kenarKapandi = document.querySelector('#org').classList.contains('noside') && WS.prefs.side === false;
  FX.view = 'grid'; setOrg(false); await W(600);
  return res;
})()
//--
(async()=>{
  const res = {};
  setOrg(false); S.layout = 2; render(); await W(200);
  res.kullanim = document.querySelector('[data-pane="0"] [data-usage]')?.textContent.trim();
  document.querySelector('[data-pane="0"] [data-usage]')?.click(); await W(100);
  res.kullanimMenu = [...document.querySelectorAll('.menu .use-row b')].map(b => b.textContent); closeMenu();
  const h = md('Sahneler: ![Sahne 1](/yok/pano.png) ve `/yok/b.jpg`');
  res.mdGorsel = /<img class="md-img"[^>]*data-mdimg="\/yok\/pano.png"/.test(h);
  const px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  lightbox([px], 0); await W(150); const lb = document.querySelector('#lb'), img = lb.querySelector('.lb-img');
  const ir = img.getBoundingClientRect(), lr = lb.getBoundingClientRect(); res.lbGorselKucuk = ir.width < lr.width / 2;
  img.dispatchEvent(new MouseEvent('click', {bubbles:true, clientX:ir.left + 1, clientY:ir.top + 1})); await W(50);
  res.lbZoom = img.classList.contains('zoom') && /scale/.test(img.style.transform);
  img.dispatchEvent(new MouseEvent('click', {bubbles:true, clientX:ir.left + 1, clientY:ir.top + 1})); await W(50);
  res.lbZoomGeri = !img.classList.contains('zoom') && !document.querySelector('#lb') === false;
  lb.dispatchEvent(new MouseEvent('click', {bubbles:true, clientX:lr.left + 5, clientY:lr.bottom - 5})); await W(50);
  res.lbBosTikKapandi = !document.querySelector('#lb');
  S.panes[1] = null; render(); await W(200);
  const q = document.querySelector('[data-pane="1"] [data-pq]'); res.bosAramaVar = !!q;
  if(q){ const t = sess(S.panes[0]) ? null : null; const first = document.querySelector('[data-pane="1"] .recent [data-open]');
    const word = first ? nameOf(first.dataset.open).split(/\s+/)[0] : 'x';
    q.focus(); q.value = word; q.dispatchEvent(new Event('input', {bubbles:true}));
    res.bosAramaSonuc = [...document.querySelectorAll('[data-pane="1"] .recent [data-open]')].filter(b => b.style.display !== 'none').length;
    renderPanes(); res.bosAramaOdak = document.activeElement && document.activeElement.matches('[data-pq]') && document.activeElement.value === word;
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true})); await W(300);
    res.bosAramaAcildi = !!S.panes[1]; }
  return res;
})()
