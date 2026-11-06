(async()=>{
  /* @ ile dosya önerisi: bu deponun klasörü sohbetin klasörü gibi kullanılır; sonunda sohbet ve yazma kutusu eski haline döner */
  const res = {name: '@ dosya önerisi'};
  const root = decodeURIComponent(new URL('../..', location.href).pathname).replace(/\/$/, '').replace(/^\/([A-Za-z]:)/, '$1');
  const ta = [...document.querySelectorAll('[data-ta]')].find(t => !t.disabled && sess(S.panes[+t.dataset.ta]));
  if (!ta) return {...res, ok: false, hata: 'yazma kutusu yok'};
  const s = sess(S.panes[+ta.dataset.ta]), old = {cwd: s.cwd, draft: s.inputDraft, val: ta.value};
  s.cwd = root;
  const pop = () => document.querySelector('.mention-pop:not(.slash-pop)');
  const open = () => !!pop() && !pop().hidden;
  const items = () => [...document.querySelectorAll('.mention-pop:not(.slash-pop) .mp-it')].map(x => x.title);
  const sel = () => [...document.querySelectorAll('.mention-pop:not(.slash-pop) .mp-it')].findIndex(x => x.classList.contains('on'));
  const typ = async (v, ms = 450) => { ta.value = v; ta.setSelectionRange(v.length, v.length); ta.dispatchEvent(new Event('input', {bubbles: true})); await W(ms); };
  const key = async (k, ms = 120) => { const e = new KeyboardEvent('keydown', {key: k, bubbles: true, cancelable: true}); ta.dispatchEvent(e); await W(ms); return e.defaultPrevented; };
  try {
    ta.focus(); await W(100);
    await typ('bak @');
    res.bosAcik = open(); res.bosSayi = items().length; res.baslik = pop() && pop().querySelector('.mp-h').textContent;
    await typ('bak @mention');
    res.liste = items().slice(0, 4); res.ilk = res.liste[0];
    res.hayaletYok = !ta._sug && !ta.parentElement.querySelector('.ghost').innerHTML;
    await key('ArrowDown'); res.asagi = sel(); await key('ArrowUp'); res.yukari = sel(); await key('ArrowUp'); res.basaDon = sel() === items().length - 1; await key('ArrowDown');
    const ilk = items()[0];
    res.tabAlindi = await key('Tab');
    res.tabSonra = ta.value; res.tabBeklenen = 'bak @' + ilk + ' '; res.tabKapandi = !open();
    await typ('@src/renderer');
    res.klasorIlk = items()[0];
    res.enterAlindi = await key('Enter', 450);
    res.enterSonra = ta.value; res.klasorAcikKaldi = open(); res.altlar = items().length > 0 && items().every(x => x.startsWith('src/renderer/'));
    res.escAlindi = await key('Escape'); res.escKapandi = !open() && ta.value === '@src/renderer/';
    await typ('@src/renderer/a'); res.escSonraKapali = !open();
    await typ('mail a@b'); res.epostaKapali = !open();
    await typ('@styles');
    const it = document.querySelector('.mention-pop:not(.slash-pop) .mp-it');
    if (it) it.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true}));
    await W(150); res.tikSonra = ta.value; res.tikOdak = document.activeElement === ta;
    await typ('@"');
    res.tirnakAcik = open();
    /* gizli selftest penceresinde blur() focusout olayı üretmez; olay elle gönderilir */
    await typ('@'); ta.blur(); ta.dispatchEvent(new FocusEvent('focusout', {bubbles: true})); await W(100); res.odakKapandi = !pop();
    ta.focus(); await typ('@qqqzzzyok'); res.eslesmeYokGizli = !open();
  } finally {
    s.cwd = old.cwd; ta.value = old.val; s.inputDraft = old.draft; autosize(ta); ta.blur(); ta.dispatchEvent(new FocusEvent('focusout', {bubbles: true}));
  }
  res.ok = res.bosAcik && res.bosSayi > 0 && /Dosyalar/.test(res.baslik || '') && /(^|\/)mention\.js$/.test(res.ilk || '') && res.hayaletYok
    && res.asagi === 1 && res.yukari === 0 && res.basaDon && res.tabAlindi && res.tabSonra === res.tabBeklenen && res.tabKapandi
    && res.klasorIlk === 'src/renderer' && res.enterAlindi && res.enterSonra === '@src/renderer/' && res.klasorAcikKaldi && res.altlar
    && res.escAlindi && res.escKapandi && res.escSonraKapali && res.epostaKapali && res.tikSonra === '@src/renderer/styles.css ' && res.tikOdak
    && res.tirnakAcik && res.odakKapandi && res.eslesmeYokGizli;
  return res;
})()
//--
(async()=>{
  /* "/" menüsü: şablonlar + komutlar + skill'ler; süzme, ↑↓, Enter/Tab, Esc, fare; şablonun hayalet önerisi ve Tab davranışı aynı */
  const res = {name: '/ menüsü (şablon, komut, skill)'};
  const ta = [...document.querySelectorAll('[data-ta]')].find(t => !t.disabled && sess(S.panes[+t.dataset.ta]));
  if (!ta) return {...res, ok: false, hata: 'yazma kutusu yok'};
  const s = sess(S.panes[+ta.dataset.ta]), old = {draft: s.inputDraft, val: ta.value};
  const pop = () => document.querySelector('.slash-pop');
  const open = () => !!pop() && !pop().hidden;
  const items = () => [...document.querySelectorAll('.slash-pop .sl-it b')].map(x => x.textContent);
  const secs = () => [...document.querySelectorAll('.slash-pop .mp-sec')].map(x => x.textContent);
  const sel = () => [...document.querySelectorAll('.slash-pop .sl-it')].findIndex(x => x.classList.contains('on'));
  const ghost = () => ta.parentElement.querySelector('.ghost').textContent;
  const typ = async (v, ms = 250) => { ta.value = v; ta.setSelectionRange(v.length, v.length); ta.dispatchEvent(new Event('input', {bubbles: true})); await W(ms); };
  const key = async (k, ms = 120) => { const e = new KeyboardEvent('keydown', {key: k, bubbles: true, cancelable: true}); ta.dispatchEvent(e); await W(ms); return e.defaultPrevented; };
  try {
    ta.focus(); await W(100);
    await typ('/', 600);
    res.acik = open(); res.bolumler = secs(); res.sayi = items().length; res.baslik = pop() && pop().querySelector('.mp-h').textContent;
    res.skiller = [...document.querySelectorAll('.slash-pop .sl-it')].filter(x => x.querySelector('.sl-src') && !/şablon|yerleşik/.test(x.querySelector('.sl-src').textContent)).length;
    res.cliSkill = items().includes('/sahte-skill'); res.cliKomut = items().includes('/sahte-komut'); res.terminalYok = !items().includes('/doctor');
    await typ('/comp');
    res.comp = items(); res.compHayaletYok = !ta._sug;
    await key('ArrowDown'); res.asagi = sel(); await key('ArrowUp'); res.yukari = sel();
    const first = items()[0];
    res.enterAlindi = await key('Enter'); res.enterSonra = ta.value; res.enterBeklenen = first + ' '; res.enterKapandi = !open();
    const T = templates()[0];
    await typ('/' + T.name.slice(0, 3));
    res.tplIlk = items()[0] === T.name; res.tplHayalet = ghost();
    res.tabAlindi = await key('Tab'); res.tabSablon = ta.value === T.text; res.tabKapandi = !open();
    await typ('/co'); res.escAlindi = await key('Escape'); res.escKapandi = !open();
    await typ('/c'); res.escSonraKapali = !open();
    await typ(''); await typ('/cont');
    const it = document.querySelector('.slash-pop .sl-it');
    if (it) it.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true}));
    await W(150); res.tikSonra = ta.value; res.tikOdak = document.activeElement === ta;
    await typ('/qqzzx'); res.eslesmeYokGizli = !open();
    await typ('merhaba /co'); res.ortadaKapali = !open();
    await typ('/clea'); await key('Enter', 300); res.yeniSohbet = !!NC; res.clearMetni = ta.value; NC = null; renderNC(); await W(100);
    ta.focus(); await typ('/model'); await key('Enter', 200); res.modelMenu = !!document.querySelector('.menu'); closeMenu();
  } finally {
    ta.value = old.val; s.inputDraft = old.draft; autosize(ta); ta.blur(); ta.dispatchEvent(new FocusEvent('focusout', {bubbles: true}));
  }
  res.ok = res.acik && res.bolumler[0] === 'Şablonlar' && res.bolumler.includes('Komutlar') && /\/ menüsü/.test(res.baslik || '')
    && res.comp.includes('/compact') && res.compHayaletYok && res.asagi === (res.comp.length > 1 ? 1 : 0) && res.yukari === 0
    && res.enterAlindi && res.enterSonra === res.enterBeklenen && res.enterKapandi
    && res.tplIlk && res.tplHayalet.length > 3 && res.tabAlindi && res.tabSablon && res.tabKapandi
    && res.escAlindi && res.escKapandi && res.escSonraKapali && res.tikSonra === '/context ' && res.tikOdak
    && res.eslesmeYokGizli && res.ortadaKapali && res.yeniSohbet && res.clearMetni === '' && res.modelMenu && res.terminalYok;
  return res;
})()
//--
(async()=>{
  /* Mesaj sırası: çalışırken 3 mesaj sıraya girer; taşı, yerinde düzenle, sil, yazma kutusuna geri al; tur bitince sırayla gider */
  const res = {name: 'mesaj sırası: düzenle, sil, taşı, geri al'};
  const i = S.panes.findIndex(id => { const x = sess(id); return x && !x.draft && !x.run; });
  if (i < 0) return {...res, ok: false, hata: 'sohbetli bölme yok'};
  const s = sess(S.panes[i]), keep = s.msgs, st = s.status, p = () => document.querySelector(`[data-pane="${i}"]`);
  const ta = () => p().querySelector('[data-ta]');
  const rows = () => [...p().querySelectorAll('.queue .q-row')].map(r => (r.querySelector('.q-txt') || r.querySelector('.q-ta')).textContent || r.querySelector('.q-ta').value);
  const enter = async (v, ms = 150) => { const t = ta(); t.focus(); t.value = v; t.dispatchEvent(new Event('input', {bubbles: true})); t.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true})); await W(ms); };
  const act = async (a, k) => { p().querySelector(`[data-qact="${a}"][data-k="${k}"]`).click(); await W(120); };
  const SENT = [], orig = sendNow; sendNow = (ss, text, ...r) => { SENT.push(text); return orig(ss, text, ...r); };
  try {
    s.status = 'idle';
    await enter('kuyruk ilk', 200);
    for (let k = 0; k < 60 && !(s.run && s.run.pendings && s.run.pendings.length); k++) await W(100);
    res.calisiyor = !!s.run;
    await enter('A'); await enter('B'); await enter('C');
    res.uc = rows();
    await act('down', 0); res.tasindi = rows();
    await act('edit', 2); const ed = p().querySelector('[data-qedtext]'); res.duzenKutusu = !!ed;
    ed.value = 'C düzenlendi'; ed.dispatchEvent(new Event('input', {bubbles: true}));
    ed.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true})); await W(150);
    res.duzenlendi = rows(); res.calismaSurdu = !!s.run;
    p().querySelector('[data-qdel="1"]').click(); await W(120); res.silindi = rows();
    await enter('D'); await act('back', 2); res.geriAlindi = ta().value; res.geriSonra = rows();
    ta().value = ''; ta().dispatchEvent(new Event('input', {bubbles: true})); s.inputDraft = '';
    for (let round = 0; round < 4 && (s.run || (s.queue || []).length); round++) {
      for (let k = 0; k < 60 && !(s.run && s.run.pendings && s.run.pendings.length); k++) await W(100);
      p().querySelector('[data-perm="allow"]')?.click();
      for (let k = 0; k < 60 && s.run; k++) await W(100);
      await W(900);
    }
    res.gonderilen = SENT;
  } finally {
    sendNow = orig; s.queue = []; s.qEdit = null; s.msgs = keep; s.status = st; renderPanes();
  }
  res.ok = res.calisiyor && res.uc.join('|') === 'A|B|C' && res.tasindi.join('|') === 'B|A|C' && res.duzenKutusu
    && res.duzenlendi.join('|') === 'B|A|C düzenlendi' && res.calismaSurdu && res.silindi.join('|') === 'B|C düzenlendi'
    && res.geriAlindi === 'D' && res.geriSonra.join('|') === 'B|C düzenlendi' && SENT.join('|') === 'kuyruk ilk|B|C düzenlendi';
  return res;
})()
//--
(async()=>{
  /* ↑/↓ geçmiş: boş kutuda ↑ son gönderilen, ilk satırda tekrar ↑ daha eski; ↓ yeniye ve taslağa döner; menü açıkken ↑↓ menüde */
  const res = {name: '↑/↓ önceki mesajlar'};
  const ta = [...document.querySelectorAll('[data-ta]')].find(t => !t.disabled && sess(S.panes[+t.dataset.ta]));
  if (!ta) return {...res, ok: false, hata: 'yazma kutusu yok'};
  const s = sess(S.panes[+ta.dataset.ta]), keep = s.msgs, old = {draft: s.inputDraft, val: ta.value};
  const typ = async v => { ta.value = v; ta.setSelectionRange(v.length, v.length); ta.dispatchEvent(new Event('input', {bubbles: true})); await W(150); };
  const key = async (k, ms = 80) => { const e = new KeyboardEvent('keydown', {key: k, bubbles: true, cancelable: true}); ta.dispatchEvent(e); await W(ms); return e.defaultPrevented; };
  try {
    s.msgs = [...(keep || []), {r: 'u', t: 'geçmiş bir'}, {r: 'a', b: []}, {r: 'u', t: 'geçmiş iki\nikinci satır'}];
    ta.focus(); await typ('');
    res.yukari1 = await key('ArrowUp'); res.v1 = ta.value;
    res.ikinciSatirdaGecmez = !(await key('ArrowUp')) && ta.value === res.v1;
    ta.setSelectionRange(0, 0); await key('ArrowUp'); res.v2 = ta.value;
    ta.setSelectionRange(ta.value.length, ta.value.length); await key('ArrowDown'); res.v3 = ta.value;
    await key('ArrowDown'); res.v4 = ta.value;
    await typ('taslak'); await key('ArrowUp'); ta.setSelectionRange(ta.value.length, ta.value.length); await key('ArrowDown'); res.taslak = ta.value;
    res.taslakteAsagiYok = !(await key('ArrowDown'));
    await typ('/'); const v = ta.value; await key('ArrowUp'); res.menudeKaldi = ta.value === v && !!document.querySelector('.slash-pop') && !document.querySelector('.slash-pop').hidden;
  } finally {
    s.msgs = keep; ta.value = old.val; s.inputDraft = old.draft; s._hist = null; autosize(ta); ta.blur(); ta.dispatchEvent(new FocusEvent('focusout', {bubbles: true}));
  }
  res.ok = res.yukari1 && res.v1 === 'geçmiş iki\nikinci satır' && res.ikinciSatirdaGecmez && res.v2 === 'geçmiş bir' && res.v3 === res.v1
    && res.v4 === '' && res.taslak === 'taslak' && res.taslakteAsagiYok && res.menudeKaldi;
  return res;
})()
