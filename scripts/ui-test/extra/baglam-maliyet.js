(async()=>{
  /* Bilgi panelinde gerçek bağlam (/context, sahte CLI fikstürü) ve kayıttan token/maliyet/sıkıştırma. Hazır test sohbeti
     (uuid 7e5f0000-…, geçici ev klasöründe) varsa onu açar; yoksa (run.sh) kendi taslak sohbetini başlatır. */
  const res = {name: 'bağlam ve maliyet: kayıttan + /context'};
  const U = '7e5f0000-1111-4222-8333-444455556666';
  let s = S.sessions.find(x => x.uuid === U);
  res.hazir = !!s;
  window.__BM = {a0: S.active, i0: S.info, p0: S.panes[0]};
  /* tur bitene kadar bekle; sahte CLI (FAKE_PERM) izin kartı açarsa izin ver */
  window.__bmDone = async (x, n = 200) => { for (let k = 0; k < n && x.run; k++) { document.querySelector('[data-pane="0"] [data-perm="allow"]')?.click(); await W(50); } await W(900); };
  if (s) openIn(s.id, 0);
  else {
    const base = sess(S.panes[0]);
    NC = {dir: base.cwd || base.project, text: '', title: 'Bağlam testi', group: null, model: null, pane: 0}; startChat(); await W(300);
    s = sess(S.panes[0]); const ta = document.querySelector('[data-ta="0"]'); ta.value = 'merhaba'; s.inputDraft = ta.value; send(0);
    await W(300); await __bmDone(s);
  }
  __BM.id = s.id;
  S.active = 0; S.info = true; document.querySelector('#info').classList.remove('off'); renderInfo();
  for (let k = 0; k < 100 && (!s.loaded || !s.ctxReal || s.ctxLoading); k++) await W(100);
  renderInfo(); await W(150);
  const sec = [...document.querySelectorAll('#info .isec')].find(e => /^Bağlam/.test(e.querySelector('h4').textContent));
  const cost = document.querySelector('#info [data-costsec]');
  res.kaynak = sec.querySelector('[data-ctxsrc]').dataset.ctxsrc;
  res.ust = [...sec.querySelector('.ctx-top').children].map(e => e.textContent.trim()).join(' ');
  res.kategoriler = [...sec.querySelectorAll('.leg .n')].map(n => n.textContent.trim());
  res.sikistirDugme = !!sec.querySelector('[data-ctxcompact]');
  res.uydurmaYok = !/513\.3k|16\.5k|dağılım tahmini/.test(document.querySelector('#info').textContent);
  res.token = cost.querySelector('[data-tok]').textContent;
  res.maliyet = cost.querySelector('[data-cost]').textContent;
  res.maliyetKaynak = cost.querySelector('[data-costsrc]').dataset.costsrc;
  res.kayitSikistirma = [...document.querySelectorAll('[data-pane="0"] .cmp-line')].map(e => e.dataset.cmp);
  res.ok = res.kaynak === 'report' && res.ust === '%4 kullanıldı 40.8k / 1M' && res.kategoriler.includes('Mesajlar') && res.kategoriler.includes('Sıkıştırma payı')
    && res.sikistirDugme && res.uydurmaYok && res.maliyet !== 'bilinmiyor' && res.token !== 'bilinmiyor'
    && (!res.hazir || (res.token === '144.6k' && res.maliyet === '$0.43' && res.maliyetKaynak === 'record' && res.kayitSikistirma.join() === 'auto'));
  return res;
})()
//--
(async()=>{
  const res = {name: 'Sıkıştır düğmesi (/compact)'};
  const s = sess(__BM.id), pane = () => document.querySelector('[data-pane="0"]');
  const n0 = pane().querySelectorAll('.cmp-line[data-cmp="manual"]').length;
  document.querySelector('#info [data-ctxcompact]').click();
  let line = null;
  for (let k = 0; k < 150 && !line; k++) {
    await W(30);
    if (!res.suruyor) res.suruyor = /Sohbet sıkıştırılıyor/.test(pane().textContent);
    const ls = pane().querySelectorAll('.cmp-line[data-cmp="manual"]'); if (ls.length > n0) line = ls[ls.length - 1];
  }
  res.gonderilen = s.msgs.filter(m => m.r === 'u').map(m => m.t).slice(-1)[0];
  res.satir = line && line.textContent.trim();
  res.ctx = s.ctx;
  res.ok = res.gonderilen === '/compact' && !!res.suruyor && res.satir === 'Sohbet sıkıştırıldı (elle) · 42k → 9.1k token' && res.ctx === 9.1;
  return res;
})()
//--
(async()=>{
  const res = {name: 'otomatik sıkıştırma: satır + bildirim'};
  const s = sess(__BM.id), pane = () => document.querySelector('[data-pane="0"]');
  await __bmDone(s);
  res.sikistirmaMaliyeti = s.costPanel && s.costPanel.usd;
  const n0 = pane().querySelectorAll('.cmp-line[data-cmp="auto"]').length;
  const ta = document.querySelector('[data-ta="0"]'); ta.value = '[oto-sıkıştır] devam et'; s.inputDraft = ta.value; send(0);
  let line = null;
  for (let k = 0; k < 200 && !(line && res.bildirim); k++) {
    await W(30);
    const ls = pane().querySelectorAll('.cmp-line[data-cmp="auto"]'); if (ls.length > n0) line = ls[ls.length - 1];
    const t = document.querySelector('#toast'); if (t.classList.contains('show') && /otomatik sıkıştırıldı/.test(t.textContent)) res.bildirim = t.textContent;
  }
  res.satir = line && line.textContent.trim();
  res.ctx = s.ctx;
  res.ok = res.sikistirmaMaliyeti === 0.0151 && res.satir === 'Sohbet sıkıştırıldı (otomatik) · 168k → 21k token' && /Bölme 1 · Bağlam doldu/.test(res.bildirim || '') && res.ctx === 21;
  return res;
})()
//--
(async()=>{
  const res = {name: 'model menüsü: tam kimlik + pencere, hızlı mod'};
  const s = sess(__BM.id);
  await __bmDone(s);
  document.querySelector('[data-pane="0"] [data-model]').click(); await W(200);
  res.satirlar = [...document.querySelectorAll('.menu [data-m="model"]')].map(b => b.textContent.replace(/\s+/g, ' ').trim());
  document.querySelector('.menu [data-m="fastmode"]').click(); await W(200);
  res.hizli = s.fast === true;
  res.etiket = document.querySelector('[data-pane="0"] [data-model]').textContent.trim();
  const ta = document.querySelector('[data-ta="0"]'); ta.value = 'hızlı modla dene'; s.inputDraft = ta.value; send(0);
  await W(300); await __bmDone(s);
  res.fastInfo = s.fastInfo;
  buildWS(); res.kayit = WS.meta[s.id] && {fast: WS.meta[s.id].fast, cost: WS.meta[s.id].cost && WS.meta[s.id].cost.usd};
  document.querySelector('[data-pane="0"] [data-model]').click(); await W(250);
  res.not = (document.querySelector('.menu .mm-note') || {}).textContent;
  /* ekran görüntüsü için menü açık kalsın (tur sonu yeniden yüklemesi menüyü kapatabilir) */
  await W(1200); if (!document.querySelector('.menu')) { document.querySelector('[data-pane="0"] [data-model]').click(); await W(250); }
  const has = (alias, id) => res.satirlar.some(r => r.includes(id + ' · 1M'));
  res.ok = res.satirlar.length === 5 && has('opus', 'claude-opus-5-5') && has('sonnet', 'claude-sonnet-5-5') && has('haiku', 'claude-haiku-5-5') && has('fable', 'claude-fable-5-1')
    && res.hizli && /· hızlı$/.test(res.etiket) && res.fastInfo && res.fastInfo.state === 'off'
    && res.kayit && res.kayit.fast === true && res.kayit.cost === 0.0123
    && res.not === 'Son turda kullanılamadı: hesapta ek kullanım (extra usage) kapalı';
  return res;
})()
//--
(async()=>{
  const res = {name: 'bağlam/maliyet testi temizliği'};
  const s = sess(__BM.id);
  closeMenu(); await __bmDone(s); s.fast = false; persist();
  if (__BM.p0 && __BM.p0 !== s.id && sess(__BM.p0)) openIn(__BM.p0, 0);
  S.active = __BM.a0; S.info = __BM.i0; renderPanes(); renderInfo(); await W(200);
  res.ok = !document.querySelector('.menu') && s.fast === false;
  return res;
})()
