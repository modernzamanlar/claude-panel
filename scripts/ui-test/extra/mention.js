(async()=>{
  /* @ ile dosya önerisi: bu deponun klasörü sohbetin klasörü gibi kullanılır; sonunda sohbet ve yazma kutusu eski haline döner */
  const res = {name: '@ dosya önerisi'};
  const root = decodeURIComponent(new URL('../..', location.href).pathname).replace(/\/$/, '').replace(/^\/([A-Za-z]:)/, '$1');
  const ta = [...document.querySelectorAll('[data-ta]')].find(t => !t.disabled && sess(S.panes[+t.dataset.ta]));
  if (!ta) return {...res, ok: false, hata: 'yazma kutusu yok'};
  const s = sess(S.panes[+ta.dataset.ta]), old = {cwd: s.cwd, draft: s.inputDraft, val: ta.value};
  s.cwd = root;
  const pop = () => document.querySelector('.mention-pop');
  const open = () => !!pop() && !pop().hidden;
  const items = () => [...document.querySelectorAll('.mention-pop .mp-it')].map(x => x.title);
  const sel = () => [...document.querySelectorAll('.mention-pop .mp-it')].findIndex(x => x.classList.contains('on'));
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
    const it = document.querySelector('.mention-pop .mp-it');
    if (it) it.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true}));
    await W(150); res.tikSonra = ta.value; res.tikOdak = document.activeElement === ta;
    await typ('@"');
    res.tirnakAcik = open();
    /* gizli selftest penceresinde blur() focusout olayı üretmez; olay elle gönderilir */
    await typ('@'); ta.blur(); ta.dispatchEvent(new FocusEvent('focusout', {bubbles: true})); await W(100); res.odakKapandi = !pop();
    ta.focus(); await typ('@qqqzzzyok'); res.eslesmeYokGizli = !open();
  } finally {
    s.cwd = old.cwd; ta.value = old.val; s.inputDraft = old.draft; autosize(ta); ta.blur();
  }
  res.ok = res.bosAcik && res.bosSayi > 0 && /Dosyalar/.test(res.baslik || '') && /(^|\/)mention\.js$/.test(res.ilk || '') && res.hayaletYok
    && res.asagi === 1 && res.yukari === 0 && res.basaDon && res.tabAlindi && res.tabSonra === res.tabBeklenen && res.tabKapandi
    && res.klasorIlk === 'src/renderer' && res.enterAlindi && res.enterSonra === '@src/renderer/' && res.klasorAcikKaldi && res.altlar
    && res.escAlindi && res.escKapandi && res.escSonraKapali && res.epostaKapali && res.tikSonra === '@src/renderer/styles.css ' && res.tikOdak
    && res.tirnakAcik && res.odakKapandi && res.eslesmeYokGizli;
  return res;
})()
