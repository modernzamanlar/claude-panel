/* Mesajı düzenle / buraya geri sar (Ö17): kullanıcı mesajının solunda kalem ve geri sar düğmeleri (çalışırken kapalı),
   metin yazma kutusuna gelir, kart "N. mesaj düzenleniyor", Vazgeç eski taslağı geri koyar; geri sar menüsü "Yalnız sohbeti" /
   "Sohbeti ve kodu" (kod kimliği olmayan mesajda not). Gönderince --resume-session-at + --fork-session ile yeni kopya
   ("(düzenlendi)", başlıkta "Düzenlenmiş kopya" çipi asıl sohbeti açar); asıl sohbet değişmez; ilk mesajda aynı klasörde yeni sohbet.
   Kod: rewind_files dry_run sahte CLI'ye gider; FAKE_REWIND yoksa "dosya kaydı yok" hatası, varsa onay penceresi ve geri sarma.
   Diskte olmayan geçici sohbetle çalışır. Bölme, etkin bölme ve oturum listesi geri alınır.
   Not: run.sh satırları birleştirir, bu yüzden burada satır yorumu kullanılmaz. */
(async()=>{
  const res = {name: 'mesajı düzenle / buraya geri sar'};
  const p0 = () => document.querySelector('[data-pane="0"]');
  const ta0 = () => document.querySelector('[data-ta="0"]');
  const keepPane = S.panes[0], keepActive = S.active, made = [];
  const oEL = ensureLoaded, oSend = sendNow, SENT = [];
  ensureLoaded = async () => {};
  sendNow = (ss, text, att, opt) => { SENT.push({text, opt: opt || {}, sid: ss.id}); return oSend(ss, text, att, opt); };
  const finish = async ss => { for (let k = 0; k < 120 && ss.run; k++) { p0().querySelector('[data-perm="allow"]')?.click(); await W(100); } await W(900); };
  const uTexts = ss => ss.msgs.filter(m => m.r === 'u').map(m => m.t);
  const aText = m => (m.b || []).map(b => b.v || '').join(' ');
  const U = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
  try {
    const cwd = decodeURIComponent(location.pathname).replace(/^\/([A-Za-z]:)/, '$1').replace(/[\\/]src[\\/]renderer[\\/]index\.html$/, '').replace(/[\\/]index\.html$/, '');
    const ouuid = crypto.randomUUID(), oid = sid(ouuid); made.push(oid);
    const o = {id: oid, uuid: ouuid, title: 'Geri sarma testi', rawTitle: 'Geri sarma testi', project: cwd, cwd, folder: null, pinned: false, trashed: false, hidden: false,
      lastTs: new Date().toISOString(), ago: 'şimdi', model: 'Opus 5.5', ctx: 0, outputs: [], loaded: true, status: 'idle', fresh: false, remote: false, localUntil: Date.now() + 6e5,
      msgs: [{r: 'u', t: 'ilk soru', ts: '2026-01-01T00:00:00Z', at: '', uuid: U(1)}, {r: 'a', b: [{t: 'text', v: '<p>ilk yanıt</p>'}]},
        {r: 'u', t: 'ikinci soru', ts: '2026-01-01T00:01:00Z', at: U(2), uuid: U(3)}, {r: 'a', b: [{t: 'text', v: '<p>ikinci yanıt</p>'}]},
        {r: 'u', t: 'kimliksiz', ts: '2026-01-01T00:02:00Z', at: U(4)}, {r: 'a', b: [{t: 'text', v: '<p>üçüncü yanıt</p>'}]}, {r: 'u', t: 'canlı mesaj', ts: '2026-01-01T00:03:00Z'}]};
    const orig = JSON.stringify(o.msgs);
    S.sessions.unshift(o); S.items.unshift(oid); S.panes[0] = oid; S.active = 0; o.inputDraft = 'yarım taslak'; render(); await W(250);
    res.dugmeler = [...p0().querySelectorAll('[data-uedit]')].map(b => +b.dataset.uedit).join() + '/' + [...p0().querySelectorAll('[data-urw]')].map(b => +b.dataset.urw).join();
    o.run = {runId: 'yok', live: {r: 'a', b: []}, tools: new Map(), startedAt: Date.now()}; renderPanes(); await W(50);
    res.calisirkenKapali = [...p0().querySelectorAll('[data-uedit],[data-urw]')].every(b => b.disabled);
    p0().querySelector('[data-uedit="2"]').click(); await W(50);
    res.calisirkenAcilmadi = !o.rw && !p0().querySelector('.rw-card');
    o.run = null; renderPanes(); await W(50);
    ta0().value = 'yarım taslak';
    p0().querySelector('[data-uedit="2"]').click(); await W(150);
    res.kutuda = ta0().value === 'ikinci soru'; res.odak = document.activeElement === ta0();
    res.kart = (p0().querySelector('.rw-card .perm-h') || {}).textContent || '';
    res.vurgu = !!p0().querySelector('.u-line.rw-on');
    res.kodDugmesi = !!p0().querySelector('[data-rwcode]');
    p0().querySelector('[data-rwx]').click(); await W(100);
    res.vazgec = !o.rw && !p0().querySelector('.rw-card') && ta0().value === 'yarım taslak';
    p0().querySelector('[data-urw="2"]').click(); await W(100);
    res.menu = [...document.querySelectorAll('.menu [data-rwm]')].map(b => b.dataset.rwm).join();
    closeMenu();
    p0().querySelector('[data-urw="4"]').click(); await W(100);
    res.menuKimliksiz = [...document.querySelectorAll('.menu [data-rwm]')].map(b => b.dataset.rwm).join() + '|' + ((document.querySelector('.menu .rw-mnote') || {}).textContent || '');
    closeMenu();
    p0().querySelector('[data-urw="2"]').click(); await W(100);
    document.querySelector('.menu [data-rwm="code"]').click();
    for (let k = 0; k < 150 && o.rw && o.rw.busy; k++) await W(100);
    await W(200);
    const dlg = document.querySelector('#rwdlg');
    res.kod = dlg ? 'pencere' : ((p0().querySelector('.rw-code.err') || {}).textContent || 'yok');
    if (dlg) {
      res.kodDosyalar = [...dlg.querySelectorAll('.rw-files .lbl')].map(x => x.textContent.trim());
      dlg.querySelector('[data-rwgo]').click();
      for (let k = 0; k < 150 && document.querySelector('#rwdlg'); k++) await W(100);
      res.kodSonuc = (p0().querySelector('.rw-code.ok') || {}).textContent || '';
    }
    res.kodSonrasiKutu = ta0().value === 'ikinci soru' && !!o.rw;
    ta0().value = 'ikinci soru (yeni)';
    await send(0); for (let k = 0; k < 40 && S.panes[0] === oid; k++) await W(100);
    const n = sess(S.panes[0]); if (n && n.id !== oid) made.push(n.id);
    res.gonderim = SENT[0] ? {text: SENT[0].text, fork: SENT[0].opt.fork, resumeAt: SENT[0].opt.resumeAt, cut: SENT[0].opt.cut} : null;
    if (n) await finish(n);
    res.yeniOturum = !!n && n.id !== oid && /\(düzenlendi\)$/.test(n.title) && n.forkOf === oid;
    res.cip = !!p0().querySelector('[data-rworig]');
    res.yeniMesajlar = n ? uTexts(n).join('|') : null;
    res.yeniYanit = n && n.msgs.length ? decodeEnt(aText(n.msgs[n.msgs.length - 1]).replace(/<[^>]+>/g, '')) : '';
    res.asilDegismedi = JSON.stringify(o.msgs) === orig && !o.run && !o.rw;
    p0().querySelector('[data-rworig]')?.click(); await W(200);
    res.cipAsliActi = S.panes[0] === oid;
    S.panes[0] = oid; render(); await W(150);
    p0().querySelector('[data-uedit="0"]').click(); await W(100);
    res.ilkKart = ((p0().querySelector('.rw-card .perm-d') || {}).textContent || '').includes('yeni bir sohbet');
    ta0().value = 'baştan'; await send(0); await W(400);
    const n2 = sess(S.panes[0]); if (n2 && n2.id !== oid) made.push(n2.id);
    res.ilkGonderim = SENT[1] ? {text: SENT[1].text, resumeAt: SENT[1].opt.resumeAt || null, fork: !!SENT[1].opt.fork} : null;
    if (n2) await finish(n2);
    res.ilkYeni = !!n2 && n2.id !== oid && n2.id !== (n && n.id) && !n2.draft && n2.cwd === cwd && uTexts(n2).join('|') === 'baştan' && n2.forkOf === oid;
    res.asilDegismedi2 = JSON.stringify(o.msgs) === orig;
    res.ok = res.dugmeler === '0,2,4/0,2,4' && res.calisirkenKapali && res.calisirkenAcilmadi && res.kutuda && res.kart.includes('2. mesaj düzenleniyor') && res.vurgu && res.kodDugmesi && res.vazgec
      && res.menu === 'chat,code' && res.menuKimliksiz.startsWith('chat|') && res.menuKimliksiz.includes('kod geri sarma yok')
      && (res.kod.includes('dosya kaydı yok') || (res.kod === 'pencere' && res.kodSonuc.includes('Kod bu mesajdan önceki haline döndü'))) && res.kodSonrasiKutu
      && !!res.gonderim && res.gonderim.text === 'ikinci soru (yeni)' && res.gonderim.fork === true && res.gonderim.resumeAt === U(2) && res.gonderim.cut === 2
      && res.yeniOturum && res.cip && res.yeniMesajlar === 'ilk soru|ikinci soru (yeni)' && res.yeniYanit.includes('(00000000 noktasından)') && res.asilDegismedi && res.cipAsliActi
      && res.ilkKart && !!res.ilkGonderim && res.ilkGonderim.text === 'baştan' && res.ilkGonderim.resumeAt === null && !res.ilkGonderim.fork && res.ilkYeni && res.asilDegismedi2;
  } catch (e) { res.ok = false; res.hata = String(e && e.stack || e); }
  sendNow = oSend; ensureLoaded = oEL; closeMenu();
  S.sessions = S.sessions.filter(x => !made.includes(x.id)); S.items = S.items.filter(x => !made.includes(x));
  S.panes[0] = keepPane; S.active = keepActive; render(); persist();
  return res;
})()
//--
/* Ek klasör (--add-dir) ve worktree (Ö10): bilgi panelinde "Ek klasör ekle…" (seçici değiştirilir), satır ve kaldırma, WS'ye kayıt,
   gönderimde sahte CLI'ye --add-dir ulaşır ("(ek klasör: 1)"). Yeni sohbet diyaloğu: git deposunda "Ayrı dalda (worktree)",
   ad önerisi ve yol, geçersiz ad hatası, ek klasör; başlatınca taslak sohbette worktree adı ve ek klasör. Depo olmayan klasörde seçenek yok.
   CLI çalıştırılmadan (ilk mesaj boş) bırakılır: depoda worktree açılmaz. */
(async()=>{
  const res = {name: 'ek klasör ve worktree'};
  const p0 = () => document.querySelector('[data-pane="0"]');
  const keepPane = S.panes[0], keepActive = S.active, keepInfo = S.info, made = [];
  const oEL = ensureLoaded, oPick = rwPickFolder;
  ensureLoaded = async () => {};
  const finish = async ss => { for (let k = 0; k < 120 && ss.run; k++) { p0().querySelector('[data-perm="allow"]')?.click(); await W(100); } await W(900); };
  try {
    const cwd = decodeURIComponent(location.pathname).replace(/^\/([A-Za-z]:)/, '$1').replace(/[\\/]src[\\/]renderer[\\/]index\.html$/, '').replace(/[\\/]index\.html$/, '');
    const sepc = cwd.includes('\\') ? '\\' : '/', extra = cwd + sepc + 'test';
    rwPickFolder = async () => extra;
    const ouuid = crypto.randomUUID(), oid = sid(ouuid); made.push(oid);
    const o = {id: oid, uuid: ouuid, title: 'Ek klasör testi', rawTitle: 'Ek klasör testi', project: cwd, cwd, folder: null, pinned: false, trashed: false, hidden: false,
      lastTs: new Date().toISOString(), ago: 'şimdi', model: 'Opus 5.5', ctx: 0, outputs: [], loaded: true, status: 'idle', fresh: false, remote: false, localUntil: Date.now() + 6e5, draft: true, msgs: []};
    S.sessions.unshift(o); S.items.unshift(oid); S.panes[0] = oid; S.active = 0; S.info = true; render(); await W(250);
    document.querySelector('#info [data-adadd]').click(); await W(200);
    res.eklendi = (o.dirs || []).join() === extra && !!document.querySelector('#info .rw-dir');
    document.querySelector('#info [data-adadd]').click(); await W(200);
    res.tekrarEklenmedi = (o.dirs || []).length === 1;
    buildWS(); res.kayit = JSON.stringify((WS.meta[oid] || {}).dirs || null);
    const ta = document.querySelector('[data-ta="0"]'); ta.value = 'ek klasörlü mesaj'; await send(0); await W(300);
    await finish(o);
    const last = o.msgs[o.msgs.length - 1];
    res.yanit = last ? decodeEnt((last.b || []).map(b => b.v || '').join(' ').replace(/<[^>]+>/g, '')) : '';
    document.querySelector('#info [data-adx]').click(); await W(150);
    res.kaldirildi = (o.dirs || []).length === 0 && !document.querySelector('#info .rw-dir');
    newChat({pane: 0}); await W(100);
    NC.title = 'Deneme Dalı'; NC.dir = cwd; renderNC();
    for (let k = 0; k < 60 && !document.querySelector('#ncWt'); k++) await W(100);
    res.wtSecenek = !!document.querySelector('#ncWt');
    const cb = document.querySelector('#ncWt'); cb.checked = true; cb.dispatchEvent(new Event('change', {bubbles: true})); await W(150);
    const nm = () => document.querySelector('#ncWtName');
    res.adOnerisi = nm() ? nm().value : null;
    res.yol = ((document.querySelector('.nc-wtb .sub') || {}).textContent || '');
    nm().value = 'a..b'; nm().dispatchEvent(new Event('input', {bubbles: true})); await W(150);
    res.gecersiz = ((document.querySelector('.nc-err') || {}).textContent || '');
    const uniq = 'uitest-' + Date.now();
    nm().value = uniq; nm().dispatchEvent(new Event('input', {bubbles: true})); await W(900);
    res.gecerli = !document.querySelector('.nc-err');
    document.querySelector('[data-ncadd]').click(); await W(150);
    res.diyalogEk = [...document.querySelectorAll('.nc-dirs .nc-sel')].map(x => x.textContent.trim()).join();
    document.querySelector('[data-nc="start"]').click(); await W(300);
    const d = sess(S.panes[0]); if (d && d.id !== oid) made.push(d.id);
    res.taslak = !!d && d.id !== oid && d.draft && d.worktree === uniq && (d.dirs || []).join() === extra && !document.querySelector('#nc');
    newChat({pane: 0}); await W(100);
    NC.dir = cwd.split(/[\\/]/)[0] + sepc; renderNC(); await W(1500);
    res.depoDegilSecenekYok = !document.querySelector('#ncWt');
    NC = null; renderNC();
    res.ok = res.eklendi && res.tekrarEklenmedi && res.kayit === JSON.stringify([extra]) && res.yanit.includes('(ek klasör: 1)') && res.kaldirildi
      && res.wtSecenek && res.adOnerisi === 'deneme-dali' && /[\\/]\.claude[\\/]worktrees[\\/]deneme-dali /.test(res.yol) && res.yol.includes('worktree-deneme-dali')
      && res.gecersiz.includes('Geçersiz') && res.gecerli && res.diyalogEk === extra && res.taslak && res.depoDegilSecenekYok;
  } catch (e) { res.ok = false; res.hata = String(e && e.stack || e); }
  rwPickFolder = oPick; ensureLoaded = oEL; if (NC) { NC = null; renderNC(); }
  S.sessions = S.sessions.filter(x => !made.includes(x.id)); S.items = S.items.filter(x => !made.includes(x));
  S.panes[0] = keepPane; S.active = keepActive; S.info = keepInfo; render(); persist();
  return res;
})()
