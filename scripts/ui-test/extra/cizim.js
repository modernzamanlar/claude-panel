(async()=>{
  /* Çizim 1: yapıştırılan test görselinin ek çipinde "Çiz" düğmesi; düzenleyici açılır, görsel gerçek çözünürlükte, tuval dpr ile keskin */
  const Z = window.__cz = {res: {}}; const res = Z.res;
  Z.prevPane = S.panes[0];
  if (!sess(S.panes[0])) { const info = await API.info(); newChat({pane: 0}); NC.dir = info.workspaceFile.replace(/[\\/][^\\/]+$/, ''); startChat(); await W(400); Z.created = S.panes[0]; }
  const s0 = sess(S.panes[0]); Z.sid = s0.id; Z.prevAttach = s0.attach; s0.attach = []; renderPanes(); await W(100);
  const c = document.createElement('canvas'); c.width = 1600; c.height = 1000; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 1600, 1000); gr.addColorStop(0, '#2b4c7e'); gr.addColorStop(1, '#9ec5e8'); g.fillStyle = gr; g.fillRect(0, 0, 1600, 1000);
  g.fillStyle = '#ffffff'; g.font = '600 64px sans-serif'; g.fillText('Test görseli 1600×1000', 80, 140);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const ta = document.querySelector('[data-pane="0"] [data-ta]');
  try { const dt = new DataTransfer(); dt.items.add(new File([blob], 'x.png', {type: 'image/png'})); ta.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true})); res.yapistirma = true; } catch (e) { res.yapistirma = String(e); }
  await W(500);
  if (!(s0.attach || []).length) { addAttachments(s0, [{name: 'test-gorsel.png', isImage: true, media_type: 'image/png', data: c.toDataURL('image/png').split(',')[1]}]); res.yapistirma = 'addAttachments'; await W(200); }
  Z.orig = s0.attach[0]; res.ekAdi = Z.orig.name;
  const chip = document.querySelector('[data-pane="0"] .att-c');
  res.cizDugmesi = !!chip.querySelector('button[data-annot][title="Çiz"]'); res.kaldirDugmesi = !!chip.querySelector('button[data-unattach]');
  chip.querySelector('button[data-annot]').click(); await W(500);
  const cv = document.querySelector('#annot canvas'); const r = cv.getBoundingClientRect();
  res.acik = annotUI.isOpen(); res.gercekBoyut = annotUI.size; res.ekranBoyut = [Math.round(r.width), Math.round(r.height)];
  res.tuval = [cv.width, cv.height]; res.dpr = devicePixelRatio;
  res.araclar = [...document.querySelectorAll('#annot [data-an-tool], #annot [data-an]')].map(b => b.dataset.anTool || b.dataset.an);
  res.kaydetYazi = document.querySelector('#annot [data-an="save"]').textContent.trim();
  return {name: 'çizim: Çiz düğmesi + düzenleyici açılır', ok: res.cizDugmesi && res.kaldirDugmesi && res.acik && res.gercekBoyut.w === 1600 && res.gercekBoyut.h === 1000 && Math.abs(cv.width - r.width * devicePixelRatio) <= 1 && res.araclar.join() === 'pen,shape,text,undo,redo,save,cancel' && res.kaydetYazi === 'Kaydet', ...res};
})()
//--
(async()=>{
  /* Çizim 2: programla kalem, ok, kutu, yazı (Türkçe) çiz; renk ve kalınlık seç; renk listesi açık kalır (ekran görüntüsü) */
  const res = {}; const cv = document.querySelector('#annot canvas');
  const P = (type, fx, fy) => { const r = cv.getBoundingClientRect(); cv.dispatchEvent(new PointerEvent(type, {bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: r.left + r.width * fx, clientY: r.top + r.height * fy})); };
  const drag = async (pts) => { P('pointerdown', ...pts[0]); for (const p of pts.slice(1)) { P('pointermove', ...p); await W(20); } P('pointerup', ...pts[pts.length - 1]); await W(50); };
  const Q = sel => document.querySelector('#annot ' + sel);
  const pick = async (dd, sel) => { Q(`[data-an-dd="${dd}"].annot-cr`).click(); await W(100); document.querySelector('.annot-pop ' + sel).click(); await W(100); };
  await drag([[0.08, 0.3], [0.15, 0.36], [0.22, 0.32], [0.3, 0.4], [0.38, 0.35]]);
  await pick('size', '[data-an-size="2"]');
  await pick('shape', '[data-an-shape="arrow"]'); res.okSecili = annotUI.state.tool;
  await drag([[0.75, 0.85], [0.62, 0.7], [0.52, 0.58]]);
  await pick('shape', '[data-an-shape="rect"]'); res.kutuSecili = annotUI.state.tool;
  await drag([[0.3, 0.45], [0.4, 0.5], [0.5, 0.56]]);
  await pick('color', '[data-an-color="#3e8ef7"]'); res.renk = annotUI.state.color;
  Q('[data-an-tool="text"]').click(); await W(80);
  P('pointerdown', 0.55, 0.15); await W(120);
  const inp = Q('.annot-txt'); res.yaziKutusu = !!inp; res.odak = document.activeElement === inp;
  inp.value = 'Burayı düzelt: ığüşöç İĞÜŞÖÇ'; inp.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true})); await W(100);
  const st = annotUI.state;
  res.sekiller = st.shapes.map(s => s.type); res.yazi = (st.shapes.find(s => s.type === 'text') || {}).text;
  const pen = st.shapes[0]; res.kalemIlkNokta = pen.pts[0].map(Math.round);
  res.okKalinlik = Math.round(st.shapes[1].lw); res.olcek = +(1600 / cv.getBoundingClientRect().width).toFixed(3);
  res.geriAlEtkin = !Q('[data-an="undo"]').disabled; res.yineleEtkin = !Q('[data-an="redo"]').disabled;
  await pick('color', '[data-an-color="#e5484d"]');
  Q('[data-an-dd="color"].annot-cr').click(); await W(150); res.renkListesi = document.querySelectorAll('.annot-pop [data-an-color]').length;
  return {name: 'çizim: kalem/ok/kutu/yazı', ok: res.sekiller.join() === 'pen,arrow,rect,text' && res.yazi === 'Burayı düzelt: ığüşöç İĞÜŞÖÇ' && res.okSecili === 'arrow' && res.kutuSecili === 'rect' && res.renk === '#3e8ef7' && Math.abs(res.kalemIlkNokta[0] - 128) <= 2 && Math.abs(res.kalemIlkNokta[1] - 300) <= 2 && Math.abs(res.okKalinlik - 8 * res.olcek) <= 1 && res.geriAlEtkin && !res.yineleEtkin && res.renkListesi >= 6, ...res};
})()
//--
(async()=>{
  /* Çizim 3: Ctrl+Z / Ctrl+Y (Mac'te ⌘), Kaydet → ek yeni PNG'yi gösterir, pikseller değişti, orijinal ek verisi aynı */
  const res = {}; const Z = window.__cz; const mac = API.platform === 'darwin';
  document.querySelector('.annot-pop')?.remove();
  const key = (k, o = {}) => { document.body.dispatchEvent(new KeyboardEvent('keydown', {key: k, bubbles: true, cancelable: true, ctrlKey: !mac && !!o.mod, metaKey: mac && !!o.mod, shiftKey: !!o.shift})); };
  const n = () => annotUI.state.shapes.length;
  res.once = n(); key('z', {mod: 1}); res.geriAl1 = n(); key('z', {mod: 1}); res.geriAl2 = n();
  key(mac ? 'z' : 'y', {mod: 1, shift: mac}); res.yinele1 = n(); key('y', {mod: 1}); res.yinele2 = n(); key('y', {mod: 1}); res.yinele3 = n();
  document.querySelector('#annot [data-an="save"]').click(); await W(800);
  const s0 = sess(Z.sid); const nw = s0.attach[0];
  res.kapandi = !annotUI.isOpen(); res.ekSayisi = s0.attach.length; res.yeniAd = nw.name; res.yeniYol = nw.path; res.tur = nw.media_type; res.boyut = nw.size;
  res.orijinalVeriAyni = Z.orig.data.length > 0 && Z.orig !== nw && !Z.orig.path;
  const load = d => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = 'data:image/png;base64,' + d; });
  const [a, b] = await Promise.all([load(Z.orig.data), load(nw.data)]);
  res.yeniBoyut = [b.naturalWidth, b.naturalHeight];
  const px = im => { const c = document.createElement('canvas'); c.width = 400; c.height = 250; const g = c.getContext('2d'); g.drawImage(im, 0, 0, 400, 250); return g.getImageData(0, 0, 400, 250).data; };
  const pa = px(a), pb = px(b); let diff = 0; for (let i = 0; i < pa.length; i += 4) if (Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]) > 60) diff++;
  res.degisenPiksel = diff;
  const full = document.createElement('canvas'); full.width = 1600; full.height = 1000; const fg = full.getContext('2d'); fg.drawImage(b, 0, 0);
  const at = fg.getImageData(480, 500, 1, 1).data; res.kutuKenariPiksel = [...at.slice(0, 3)];
  res.cipAdi = document.querySelector('[data-pane="0"] .att-c span').textContent; res.cipTitle = document.querySelector('[data-pane="0"] .att-c').title;
  return {name: 'çizim: geri al/yinele + kaydet', ok: res.once === 4 && res.geriAl1 === 3 && res.geriAl2 === 2 && res.yinele1 === 3 && res.yinele2 === 4 && res.yinele3 === 4 && res.kapandi && res.ekSayisi === 1 && /-cizim\.png$/.test(res.yeniAd) && /[\\/]gorseller[\\/]cizim-\d+-[0-9a-f]{8}\.png$/.test(res.yeniYol) && res.tur === 'image/png' && res.yeniBoyut.join() === '1600,1000' && res.degisenPiksel > 500 && res.kutuKenariPiksel[0] > 180 && res.kutuKenariPiksel[2] < 120 && res.cipTitle === res.yeniYol && res.orijinalVeriAyni, ...res};
})()
//--
(async()=>{
  /* Çizim 4: küçük resme tıklayınca da açılır; çizip Esc → ek değişmez; durumu geri al */
  const res = {}; const Z = window.__cz; const s0 = sess(Z.sid); const before = s0.attach[0];
  document.querySelector('[data-pane="0"] .att-c img[data-annot]').click(); await W(500);
  res.resimTiklamaActi = annotUI.isOpen();
  const cv = document.querySelector('#annot canvas'); const r = cv.getBoundingClientRect();
  const P = (type, fx, fy) => cv.dispatchEvent(new PointerEvent(type, {bubbles: true, pointerId: 1, button: 0, clientX: r.left + r.width * fx, clientY: r.top + r.height * fy}));
  P('pointerdown', 0.2, 0.2); P('pointermove', 0.6, 0.6); P('pointerup', 0.6, 0.6); res.cizildi = annotUI.state.shapes.length;
  document.body.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true})); await W(200);
  res.escKapandi = !annotUI.isOpen() && !document.querySelector('#annot'); res.ekAyni = s0.attach[0] === before && s0.attach.length === 1;
  s0.attach = Z.prevAttach || []; if (Z.created) { S.sessions = S.sessions.filter(x => x.id !== Z.created); S.items = S.items.filter(x => x !== Z.created); } S.panes[0] = Z.prevPane; render(); delete window.__cz;
  return {name: 'çizim: küçük resim tıklama + Esc iptal', ok: res.resimTiklamaActi && res.cizildi === 1 && res.escKapandi && res.ekAyni, ...res};
})()
