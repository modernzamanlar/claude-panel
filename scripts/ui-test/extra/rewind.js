/* Mesajı düzenle ve oradan devam et: kalem düğmesi (çalışırken kapalı), satır içi düzenleyici (Esc / Shift+Enter / Enter),
   --resume-session-at ile yeni oturuma çatal (asıl sohbet olduğu gibi kalır), ilk mesajda aynı klasörde yeni sohbet.
   Diskte olmayan geçici bir sohbetle çalışır; sahte CLI dosya yazmaz. Bölme, etkin bölme ve oturum listesi geri alınır.
   Not: run.sh satırları birleştirir, bu yüzden burada satır yorumu kullanılmaz. */
(async()=>{
  const res = {name: 'mesajı düzenle ve oradan devam et'};
  const p0 = () => document.querySelector('[data-pane="0"]');
  const keepPane = S.panes[0], keepActive = S.active, made = [];
  const oEL = ensureLoaded, oSend = sendNow, SENT = [];
  ensureLoaded = async () => {};
  sendNow = (ss, text, att, opt) => { SENT.push({text, opt: opt || {}}); return oSend(ss, text, att, opt); };
  const finish = async ss => { for (let k = 0; k < 120 && ss.run; k++) { p0().querySelector('[data-perm="allow"]')?.click(); await W(100); } await W(900); };
  const key = (el, k, o = {}) => el.dispatchEvent(new KeyboardEvent('keydown', {key: k, bubbles: true, cancelable: true, ...o}));
  const uTexts = ss => ss.msgs.filter(m => m.r === 'u').map(m => m.t);
  const aText = m => (m.b || []).map(b => b.v || '').join(' ');
  try {
    const cwd = decodeURIComponent(location.pathname).replace(/[\\/]index\.html$/, '');
    const AT = '00000000-0000-4000-8000-000000000004';
    const ouuid = crypto.randomUUID(), oid = sid(ouuid); made.push(oid);
    const o = {id: oid, uuid: ouuid, title: 'Düzenleme testi', rawTitle: 'Düzenleme testi', project: cwd, cwd, folder: null, pinned: false, trashed: false, hidden: false,
      lastTs: new Date().toISOString(), ago: 'şimdi', model: 'Opus 5.5', ctx: 0, outputs: [], loaded: true, status: 'idle', fresh: false, remote: false, localUntil: Date.now() + 6e5,
      msgs: [{r: 'u', t: 'ilk soru', ts: '2026-01-01T00:00:00Z', at: ''}, {r: 'a', b: [{t: 'text', v: '<p>ilk yanıt</p>'}]},
        {r: 'u', t: 'ikinci soru', ts: '2026-01-01T00:01:00Z', at: AT}, {r: 'a', b: [{t: 'text', v: '<p>ikinci yanıt</p>'}]}, {r: 'u', t: 'canlı mesaj', ts: '2026-01-01T00:02:00Z'}]};
    const orig = JSON.stringify(o.msgs);
    S.sessions.unshift(o); S.items.unshift(oid); S.panes[0] = oid; S.active = 0; render(); await W(200);
    const btns = () => [...p0().querySelectorAll('[data-uedit]')];
    res.dugmeler = btns().map(b => +b.dataset.uedit);
    res.gizli = btns().length === 2 && getComputedStyle(btns()[1]).opacity === '0';
    res.ipucu = (btns()[1] || {}).title || '';
    o.run = {runId: 'yok', live: {r: 'a', b: []}, tools: new Map(), startedAt: Date.now()}; renderPanes(); await W(50);
    res.calisirkenKapali = btns().length === 2 && btns().every(b => b.disabled); btns()[1].click(); await W(50);
    res.calisirkenAcilmadi = !p0().querySelector('[data-uedta]');
    o.run = null; renderPanes(); await W(50);
    btns()[1].click(); await W(100);
    let ta = p0().querySelector('[data-uedta]');
    res.duzenleyici = !!ta && ta.value === 'ikinci soru' && document.activeElement === ta && !!p0().querySelector('[data-uesend]') && !!p0().querySelector('[data-uex]');
    key(ta, 'Escape'); await W(50);
    res.escKapatti = !p0().querySelector('[data-uedta]') && uTexts(o).join('|') === 'ilk soru|ikinci soru|canlı mesaj';
    btns()[1].click(); await W(100);
    ta = p0().querySelector('[data-uedta]'); ta.value = 'ikinci soru (yeni)'; ta.dispatchEvent(new Event('input', {bubbles: true}));
    key(ta, 'Enter', {shiftKey: true}); await W(50);
    res.shiftEnterGondermedi = SENT.length === 0 && !!p0().querySelector('[data-uedta]');
    key(ta, 'Enter'); for (let k = 0; k < 40 && S.panes[0] === oid; k++) await W(100);
    const n = sess(S.panes[0]); if (n && n.id !== oid) made.push(n.id);
    res.gonderim = SENT[0] ? {text: SENT[0].text, fork: SENT[0].opt.fork, resumeAt: SENT[0].opt.resumeAt, cut: SENT[0].opt.cut} : null;
    if (n) await finish(n);
    res.yeniOturum = !!n && n.id !== oid && /\(düzenlendi\)$/.test(n.title);
    res.yeniMesajlar = n ? uTexts(n) : null;
    res.yeniYanit = n && n.msgs.length ? decodeEnt(aText(n.msgs[n.msgs.length - 1]).replace(/<[^>]+>/g, '')) : '';
    res.ilkYanitKaldi = !!n && aText(n.msgs[1]).includes('ilk yanıt') && !n.msgs.some(m => aText(m).includes('ikinci yanıt'));
    res.asilDegismedi = JSON.stringify(o.msgs) === orig && !o.run && !o.uedit;
    S.panes[0] = oid; render(); await W(150);
    btns()[0].click(); await W(100);
    ta = p0().querySelector('[data-uedta]'); ta.value = 'baştan'; p0().querySelector('[data-uesend]').click(); await W(400);
    const n2 = sess(S.panes[0]); if (n2 && n2.id !== oid) made.push(n2.id);
    res.ilkGonderim = SENT[1] ? {text: SENT[1].text, resumeAt: SENT[1].opt.resumeAt || null, fork: !!SENT[1].opt.fork} : null;
    if (n2) await finish(n2);
    res.ilkYeni = !!n2 && n2.id !== oid && n2.id !== (n && n.id) && !n2.draft && n2.cwd === cwd && uTexts(n2).join('|') === 'baştan';
    res.ilkYanit = n2 && n2.msgs.length ? decodeEnt(aText(n2.msgs[n2.msgs.length - 1]).replace(/<[^>]+>/g, '')) : '';
    res.asilDegismedi2 = JSON.stringify(o.msgs) === orig;
    res.ok = res.dugmeler.join() === '0,2' && res.gizli && res.ipucu.includes('asıl sohbet olduğu gibi kalır') && res.calisirkenKapali && res.calisirkenAcilmadi
      && res.duzenleyici && res.escKapatti && res.shiftEnterGondermedi
      && !!res.gonderim && res.gonderim.text === 'ikinci soru (yeni)' && res.gonderim.fork === true && res.gonderim.resumeAt === AT && res.gonderim.cut === 2
      && res.yeniOturum && (res.yeniMesajlar || []).join('|') === 'ilk soru|ikinci soru (yeni)' && res.yeniYanit.includes('Aldım: "ikinci soru (yeni)" (00000000 noktasından)')
      && res.ilkYanitKaldi && res.asilDegismedi
      && !!res.ilkGonderim && res.ilkGonderim.text === 'baştan' && res.ilkGonderim.resumeAt === null && !res.ilkGonderim.fork
      && res.ilkYeni && res.ilkYanit.includes('Aldım: "baştan"') && !res.ilkYanit.includes('noktasından') && res.asilDegismedi2;
  } catch (e) { res.ok = false; res.hata = String(e && e.stack || e); }
  sendNow = oSend; ensureLoaded = oEL;
  S.sessions = S.sessions.filter(x => !made.includes(x.id)); S.items = S.items.filter(x => !made.includes(x));
  S.panes[0] = keepPane; S.active = keepActive; render(); persist();
  return res;
})()
