(async()=>{
  /* Medya tekilleştirme + oynatıcı oranı. Aynı dikey videoyu (720x1280) farklı yazımlarla anan mesajlar eklenir:
     göreli, \ ve / ayırıcılı mutlak, küçük harfli, "." ara klasörlü, sonda noktalamalı, ~ ile. Her mesajda video bir kez
     görünmeli; birkaç yeniden çizimden sonra da kutu başına tek oynatıcı kalmalı; oynatıcının oranı videonun oranı olmalı. */
  const res = {name: 'medya: her video mesaj başına bir kez, oynatıcı videonun oranında'};
  const app = decodeURIComponent(location.pathname).replace(/^\/([A-Za-z]:)/, '$1').replace(/src\/renderer\/index\.html$/, '');
  const win = /^[A-Za-z]:/.test(app), bs = p => win ? p.replace(/\//g, '\\') : p;
  const dir = bs(app + 'test/fixtures/medya'), sep = win ? '\\' : '/';
  const V = dir + sep + 'dikey.mp4', Y = (dir + sep + 'yatay.mp4').replace(/\\/g, '/');
  const home = API.home || '', tilde = home && V.toUpperCase().startsWith(home.toUpperCase() + sep) ? '~' + V.slice(home.length).replace(/\\/g, '/') : V;
  const low = win ? V[0].toLowerCase() + V.slice(1).replace(/dikey\.mp4$/, 'DIKEY.MP4') : V;
  const dot = dir + sep + '.' + sep + 'dikey.mp4';
  const layout = S.layout; document.querySelector('#layouts [data-l="3"]').click(); await W(300);
  if(!sess(S.panes[0]) && S.sessions.length){ openIn(S.sessions[0].id, 0); await W(1500); }
  const s = sess(S.panes[0]); window.__mm = {sid: s.id, msgs: s.msgs, cwd: s.cwd, layout};
  s.cwd = dir;
  s.msgs = [...s.msgs,
    {r: 'u', t: `Şu videoya bak: dikey.mp4\n${V}\n${V.replace(/\\/g, '/')}`},
    {r: 'a', b: [{t: 'text', v: `<p>Hazır: <code>${esc(V)}</code>, yatay: ${esc(Y)}. Ayrıca <code>${esc(low)}</code>, ${esc(dot)}. ve <code>${esc(tilde)}</code>.</p>`},
      {t: 'tool', n: 'Bash', a: `ffprobe "${V.replace(/\\/g, '/')}"`, o: `${dot}\n./dikey.mp4`}]}];
  renderPanes(); await W(2500);
  const p0 = document.querySelector('[data-pane="0"]');
  const count = () => { const mw = [...p0.querySelectorAll('.msgs-in > .mw')].slice(-2);
    return mw.map(w => [...w.querySelectorAll('.media')].map(b => ({ad: b.querySelector('.media-name').textContent, oynatici: b.querySelectorAll('.media-el > video, .media-el > audio').length}))); };
  res.ilk = count();
  for(let k = 0; k < 3; k++){ s.msgs = [...s.msgs]; s.msgs.splice(s.msgs.length - 2, 0, {r: 'a', b: [{t: 'text', v: `<p>ara ${k}</p>`}]}); renderPanes(); await W(300); }
  res.yamadanSonra = count();
  const vids = [...p0.querySelectorAll('.mw .media.mv.ok video')].slice(-3), inW = p0.querySelector('.msgs-in').clientWidth, msH = p0.querySelector('.msgs').clientHeight;
  res.oran = vids.map(v => { const r = v.getBoundingClientRect(), b = v.closest('.media').getBoundingClientRect();
    return {video: v.videoWidth + 'x' + v.videoHeight, kutu: Math.round(r.width) + 'x' + Math.round(r.height), oran: +(r.width / r.height).toFixed(3), hedef: +(v.videoWidth / v.videoHeight).toFixed(3), kenarBosluk: Math.round(b.width - r.width), sigar: b.width <= inW + 1 && r.height <= msH * 0.71 + 1}; });
  const big = vids.find(v => v.videoHeight > v.videoWidth); if(big) big.scrollIntoView({block: 'center'});
  const one = l => l.length === 2 && l.every(m => m.length && m.every(b => b.oynatici === 1)) && l.every(m => new Set(m.map(b => b.ad.toLowerCase())).size === m.length);
  res.ok = one(res.ilk) && one(res.yamadanSonra) && res.yamadanSonra[0].length === 1 && res.yamadanSonra[1].length === 2 &&
    res.oran.length === 3 && res.oran.every(o => Math.abs(o.oran - o.hedef) < 0.02 && o.kenarBosluk <= 2 && o.sigar);
  return res;
})()
//--
(async()=>{
  /* Dar bölme (2x2): dikey video bölmeye sığar, oran korunur; sonra medya mesajları geri alınır */
  const res = {name: 'medya: 2x2 düzende oynatıcı bölmeye sığar'};
  document.querySelector('#layouts [data-l="4"]').click(); await W(600);
  const p0 = document.querySelector('[data-pane="0"]'), msH = p0.querySelector('.msgs').clientHeight, inW = p0.querySelector('.msgs-in').clientWidth;
  res.olcu = [...p0.querySelectorAll('.mw .media.mv.ok video')].slice(-3).map(v => { const r = v.getBoundingClientRect(); return {kutu: Math.round(r.width) + 'x' + Math.round(r.height), oran: +(r.width / r.height).toFixed(3), hedef: +(v.videoWidth / v.videoHeight).toFixed(3), msgsH: msH, icW: inW}; });
  res.ok = res.olcu.length === 3 && res.olcu.every(o => Math.abs(o.oran - o.hedef) < 0.02 && +o.kutu.split('x')[1] <= msH * 0.71 + 1 && +o.kutu.split('x')[0] <= inW + 1);
  const m = window.__mm, s = sess(m.sid); s.msgs = m.msgs; s.cwd = m.cwd; document.querySelector('#layouts [data-l="3"]').click(); renderPanes(); await W(300);
  return res;
})()
//--
(async()=>{
  /* Kullanım menüsü düğmeye hizalı (hemen üstünde), pencere ve bölme içinde; kaydırınca/yeniden boyutlanınca yerinde kalır.
     Model, düşünme seviyesi ve şablon menüleri de düğmelerine hizalı açılır. */
  const res = {name: 'menü: kullanım/model/düşünme/şablon menüleri düğmeye hizalı ve pencere içinde'};
  const NOW = Date.now(); window.__mm.usage = USAGE;
  USAGE = {w: {seven_day: {u: 0.76, resetsAt: Math.floor(NOW / 1000) + 9 * 3600, at: NOW}}, status: 'allowed', at: NOW}; renderPanes(); await W(100);
  const p0 = document.querySelector('[data-pane="0"]'), pr = p0.getBoundingClientRect();
  const check = sel => { const b = p0.querySelector(sel); b.click(); const m = document.querySelector('.menu'); if(!m) return {yok: true};
    const a = b.getBoundingClientRect(), r = m.getBoundingClientRect();
    return {bosluk: Math.round(a.top - r.bottom), solFark: Math.round(r.left - a.left), sagFark: Math.round(a.right - r.right),
      pencereIci: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, bolmeIci: r.left >= pr.left - 1 && r.right <= pr.right + 1, yan: m.dataset.side}; };
  const good = o => o.bosluk >= 0 && o.bosluk <= 10 && (Math.abs(o.solFark) <= 1 || Math.abs(o.sagFark) <= 1) && o.pencereIci && o.bolmeIci;
  for(const [k, sel] of [['model', '[data-model]'], ['dusunme', '[data-effort]'], ['sablon', '[data-tpl]']]){ res[k] = check(sel); closeMenu(); await W(50); }
  res.kullanim = check('[data-usage]');
  const m = document.querySelector('.menu'), y0 = m && m.getBoundingClientRect().top;
  p0.querySelector('.msgs').scrollTop -= 200; p0.querySelector('.msgs').dispatchEvent(new Event('scroll')); dispatchEvent(new Event('resize')); await W(100);
  res.kaydirSonra = !!document.querySelector('.menu') && Math.round(document.querySelector('.menu').getBoundingClientRect().top) === Math.round(y0);
  res.ok = [res.model, res.dusunme, res.sablon, res.kullanim].every(good) && res.kaydirSonra;
  return res;
})()
//--
(async()=>{
  /* Geri alma: menü kapanır, kullanım bilgisi ve düzen eski haline döner */
  closeMenu(); USAGE = window.__mm.usage; document.querySelector(`#layouts [data-l="${window.__mm.layout}"]`).click(); renderPanes(); delete window.__mm;
  return {name: 'medya-menu: geri alma', ok: !document.querySelector('.menu')};
})()
