(async()=>{
  const W = ms => new Promise(r => setTimeout(r, ms));
  const res = {name:'sohbet görünümü: canlı akış (düşünme, görevler, alt ajan, arka plan)'};
  window.__svPrev = {layout:S.layout, panes:[...S.panes], active:S.active, info:S.info};
  S.layout = 1; S.active = 0; S.info = true;
  const cwds = [...new Set(S.sessions.map(x => x.cwd).filter(Boolean))];
  const uuid = crypto.randomUUID(), id = sid(uuid);
  const s = {id, uuid, draft:true, title:'Görünüm testi', rawTitle:'Görünüm testi', project:cwds[0] || '.', cwd:cwds[0] || '.', folder:null, pinned:false, trashed:false, hidden:false, lastTs:new Date().toISOString(), ago:'şimdi', model:'Opus', ctx:0, msgs:[], outputs:[], loaded:true, status:'idle', fresh:false, remote:false, localUntil:Date.now() + 6e5};
  S.sessions.unshift(s); S.items.unshift(id); window.__svLive = id;
  S.panes[0] = id; render(); await W(300);
  let sent = false;
  for (const c of cwds.slice(0, 6)) { s.cwd = s.project = c; s.msgs = []; s.draft = true; if (await sendNow(s, '[gorunum] görünüm testi', [], {force:true})) { sent = true; break; } }
  res.gonderildi = sent; res.cwd = s.cwd;
  const P = () => document.querySelector('[data-pane="0"]');
  let liveHTML = '';
  for (let k = 0; k < 300 && !liveHTML; k++) { liveHTML = (msgParts(s).find(x => x.includes('th-live')) || ''); if (!liveHTML) await W(10); }
  res.dusunmeAkiyor = /Düşünüyor/.test(liveHTML) && !liveHTML.includes('class="th-b"');
  for (let k = 0; k < 150 && !P().querySelector('.perm [data-perm="allow"]'); k++) await W(100);
  res.ajanCanli = !!(s.run && [...s.run.agents.values()][0] && [...s.run.agents.values()][0].b && [...s.run.agents.values()][0].b.length);
  P().querySelector('.perm [data-perm="allow"]')?.click();
  for (let k = 0; k < 100 && !(s.run && s.run.result); k++) await W(100);
  await W(400);
  res.turBitti = !!(s.run && s.run.result); res.surecAcik = !!s.run;
  const pane = P();
  res.gorevKarti = pane.querySelectorAll('.todo-card').length; res.gorevSatiri = pane.querySelectorAll('.todo-line').length;
  res.gorevCalisan = pane.querySelector('.todo-card .pc-i.in_progress')?.textContent.trim();
  res.gorevSayac = pane.querySelector('.todo-card .pc-h span')?.textContent;
  res.ajanBaslik = pane.querySelector('.sa-blk .sa-h')?.textContent.replace(/\s+/g, ' ').trim();
  res.ajanKapaliGovdeYok = !pane.querySelector('.sa-blk .sa-b');
  pane.querySelector('.sa-blk .sa-h')?.click(); await W(200);
  res.ajanAcik = P().querySelector('.sa-blk.open .sa-b')?.textContent.replace(/\s+/g, ' ').slice(0, 120);
  P().querySelector('.think .th-btn')?.click(); await W(200);
  res.dusunmeAcik = P().querySelector('.think.open .th-b')?.textContent.slice(0, 40);
  const info = document.querySelector('#info');
  res.bgBolum = info.querySelector('.bgt-sec h4')?.textContent.replace(/\s+/g, ' ').trim();
  res.bgCalisan = [...info.querySelectorAll('.bgt.run .bgt-t')].map(e => e.textContent);
  res.bgBiten = [...info.querySelectorAll('.bgt.done .bgt-t')].map(e => e.textContent);
  res.durdurDugmesi = !!info.querySelector('.bgt.run [data-bgstop="bfake1"]');
  res.ok = sent && res.dusunmeAkiyor && res.ajanCanli && res.turBitti && res.surecAcik && res.gorevKarti === 1 && res.gorevSatiri === 2
    && res.gorevCalisan === 'İzleyici başlatılıyor' && res.gorevSayac === '2/3' && /Explore/.test(res.ajanBaslik || '') && /2 araç/.test(res.ajanBaslik || '') && /bitti/.test(res.ajanBaslik || '')
    && res.ajanKapaliGovdeYok && /TODO/.test(res.ajanAcik || '') && /Grep/.test(res.ajanAcik || '') && /Kullanıcı görünümü/.test(res.dusunmeAcik || '')
    && /1 çalışıyor/.test(res.bgBolum || '') && res.bgCalisan.includes('İzleyiciyi başlat') && res.bgBiten.includes('Hazırlık') && res.durdurDugmesi;
  return res;
})()
//--
(async()=>{
  const W = ms => new Promise(r => setTimeout(r, ms));
  const res = {name:'sohbet görünümü: arka plan görevini durdur (stop_task)'};
  const s = sess(window.__svLive); const info = document.querySelector('#info');
  info.querySelector('[data-bgstop="bfake1"]')?.click();
  for (let k = 0; k < 80 && s.run; k++) await W(100);
  res.surecKapandi = !s.run;
  const t = (s.bgSt && s.bgSt.list || []).find(x => x.id === 'bfake1');
  res.durum = t && t.st;
  await W(300);
  res.bgDurduruldu = [...document.querySelectorAll('#info .bgt.stop .bgt-t')].map(e => e.textContent);
  res.durdurYok = !document.querySelector('#info [data-bgstop]');
  const P0 = document.querySelector('[data-pane="0"]');
  P0.querySelector('.think.open .th-btn')?.click(); await W(200);
  res.dusunmeKapandi = !document.querySelector('[data-pane="0"] .think .th-b');
  res.ok = res.surecKapandi && res.durum === 'stop' && res.bgDurduruldu.includes('İzleyiciyi başlat') && res.durdurYok && res.dusunmeKapandi;
  return res;
})()
//--
(async()=>{
  const W = ms => new Promise(r => setTimeout(r, ms));
  const res = {name:'sohbet görünümü: geçmiş sohbet (kayıttan)'};
  const fx = sess(sid('c0ffee00-1111-4222-8333-444455556666'));
  if (!fx) { res.atlandi = 'örnek kayıt (test/fixtures/sohbet-gorunumu.js) bu ev klasöründe yok'; res.ok = true; return res; }
  S.panes[0] = fx.id; render(); await ensureLoaded(fx.id); await W(400);
  const P = () => document.querySelector('[data-pane="0"]');
  res.dusunmeDugmesi = P().querySelectorAll('.think').length;
  res.gorevKarti = P().querySelectorAll('.todo-card').length; res.gorevSatiri = P().querySelectorAll('.todo-line').length;
  res.ajanBaslik = P().querySelector('.sa-blk .sa-h')?.textContent.replace(/\s+/g, ' ').trim();
  P().querySelector('.sa-blk .sa-h')?.click();
  for (let k = 0; k < 40 && !/kayıt buldum/.test(P().querySelector('.sa-blk .sa-b')?.textContent || ''); k++) await W(100);
  res.ajanGovde = P().querySelector('.sa-blk .sa-b')?.textContent.replace(/\s+/g, ' ').slice(0, 120);
  P().querySelector('.think .th-btn')?.click(); await W(200);
  res.dusunme = P().querySelector('.think .th-b')?.textContent;
  res.bg = [...document.querySelectorAll('#info .bgt')].map(e => e.className + ':' + e.querySelector('.bgt-t').textContent);
  res.ok = res.dusunmeDugmesi === 1 && res.gorevKarti === 1 && res.gorevSatiri === 1 && /Explore/.test(res.ajanBaslik || '') && /3 araç/.test(res.ajanBaslik || '') && /bitti/.test(res.ajanBaslik || '')
    && /Grep/.test(res.ajanGovde || '') && /kayıt buldum/.test(res.ajanGovde || '') && /görev listesini/.test(res.dusunme || '')
    && res.bg.some(x => /done/.test(x) && /Derleme/.test(x)) && res.bg.some(x => /done/.test(x) && /Kayıtları tara/.test(x));
  return res;
})()
//--
(async()=>{
  const p = window.__svPrev || {};
  S.sessions = S.sessions.filter(x => x.id !== window.__svLive); S.items = S.items.filter(x => x !== window.__svLive);
  S.layout = p.layout || S.layout; S.panes = p.panes || S.panes; S.active = p.active || 0; S.info = p.info !== undefined ? p.info : S.info;
  render();
  return {name:'sohbet görünümü: geri al', ok:true};
})()
