(async()=>{
  const res = {name: 'tema: Gece varsayılan, 1 bölme, izin kartı ve köpek'};
  window.TM = {p0: JSON.parse(JSON.stringify(WS.prefs || {})), l0: S.layout, rects: {}, con: {}};
  TM.rect = () => { const o = {}; const sel = ['.topbar', '.rail', '#grid', '#btnOrg', '#layouts', '#btnTheme', '#btnInfo', '#btnSettings', '.rail .new', '[data-pane="0"]', '[data-pane="0"] .ph', '[data-pane="0"] .comp', '[data-pane="0"] .send', '[data-pane="0"] [data-effort]', '[data-pane="0"] [data-control]', '[data-pane="0"] [data-mic]', '[data-pane="0"] [data-tpl]', '[data-pane="0"] .perm', '[data-pane="0"] [data-perm="allow"]', '#info']; for (const s of sel) { const e = document.querySelector(s); if (e) { const r = e.getBoundingClientRect(); o[s] = [r.x, r.y, r.width, r.height].map(v => Math.round(v * 10) / 10).join(','); } } return o; };
  TM.rgb = c => { const d = document.createElement('i'); d.style.color = c; document.body.appendChild(d); const m = getComputedStyle(d).color.match(/[\d.]+/g).map(Number); d.remove(); return m; };
  TM.L = c => { const [r, g, b] = TM.rgb(c).slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  TM.cr = (a, b) => { const x = TM.L(a), y = TM.L(b); return Math.round((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) * 100) / 100; };
  TM.v = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  TM.contrast = () => { const o = {}; for (const f of ['--text', '--muted', '--faint', '--accent-text']) for (const b of ['--bg', '--side', '--panel', '--comp', '--user', '--code', '--hover']) o[f.slice(2) + '/' + b.slice(2)] = TM.cr(TM.v(f), TM.v(b)); return o; };
  TM.min = (o, k) => Math.min(...Object.entries(o).filter(([n]) => n.startsWith(k + '/')).map(([, v]) => v));
  res.kayitsizGece = Tema.resolve({}, false).look === 'gece' && Tema.resolve({theme: 'dark'}, true).look === 'gece';
  WS.prefs = Tema.choose(WS.prefs, 'gece'); applyTheme(WS.prefs); S.layout = 1; render(); await W(200);
  const s = sess(S.panes[0]); TM.sid = s.id; TM.keep = s.msgs;
  s.msgs = [...s.msgs, {r: 'u', t: 'Tema denemesi: kod, tablo, araçlar'}, {r: 'a', b: [{t: 'text', v: md('**Kalın**, `satır içi kod` ve bir yol `D:/İşler/Proje/a.mp4`.\n\n```js\nconst tema = Tema.resolve(WS.prefs, true);\nconsole.log(tema.look);\n```\n\n| Tema | Zemin |\n|---|---|\n| Gece | #070709 |\n| Claude | #1f1e1d |\n\n1. Birinci madde\n2. İkinci madde')}, {t: 'tool', n: 'Bash', a: 'npm test', o: 'ok'}, {t: 'tool', n: 'Read', a: 'src/renderer/tema.css', o: ''}, {t: 'tool', n: 'Bash', a: 'exit 1', o: 'hata', err: true}]}];
  s.status = 'idle'; renderPanes(); await W(100);
  document.querySelector('[data-ta="0"]').value = 'tema izin kartı';
  send(0, {force: true});
  for (let k = 0; k < 80 && !document.querySelector('[data-pane="0"] .perm'); k++) await W(100);
  await W(300);
  res.izinKarti = !!document.querySelector('[data-pane="0"] .perm'); res.kopek = !!document.querySelector('[data-pane="0"] .send.busy img.dog8');
  res.look = document.documentElement.dataset.look; res.bg = TM.v('--bg');
  TM.rects.gece = TM.rect(); TM.con.gece = TM.contrast();
  res.minMetin = TM.min(TM.con.gece, 'text'); res.minIkincil = TM.min(TM.con.gece, 'muted'); res.minSoluk = TM.min(TM.con.gece, 'faint'); res.minVurguMetni = TM.min(TM.con.gece, 'accent-text');
  const dz = document.createElement('div'); dz.innerHTML = '<span style="color:#c0392b">x</span>'; document.body.appendChild(dz);
  res.tehlike = TM.cr(getComputedStyle(dz.firstChild).color, TM.v('--panel')); dz.remove();
  res.ok = res.kayitsizGece && res.look === 'gece' && res.bg === '#070709' && res.izinKarti && res.kopek && res.minMetin >= 4.5 && res.minIkincil >= 4.5 && res.minSoluk >= 4.5 && res.minVurguMetni >= 4.5 && res.tehlike >= 4.5;
  return res;
})()
//--
(async()=>{
  const res = {name: 'tema: eski Claude koyu, düğmeler aynı yerde'};
  WS.prefs = Tema.choose(WS.prefs, 'claude'); applyTheme(WS.prefs); await W(300);
  res.look = document.documentElement.dataset.look; res.bg = TM.v('--bg');
  TM.rects.claude = TM.rect(); TM.con.claude = TM.contrast();
  const diff = Object.keys(TM.rects.gece).filter(k => TM.rects.gece[k] !== TM.rects.claude[k]);
  res.olculen = Object.keys(TM.rects.gece).length; res.farkli = diff.map(k => k + ' ' + TM.rects.gece[k] + ' → ' + TM.rects.claude[k]);
  res.ok = res.look === 'claude' && res.bg === '#1f1e1d' && res.olculen >= 15 && diff.length === 0;
  return res;
})()
//--
(async()=>{
  const res = {name: 'tema: açık, düğmeler aynı yerde'};
  WS.prefs = Tema.choose(WS.prefs, 'light'); applyTheme(WS.prefs); await W(300);
  res.look = document.documentElement.dataset.look; res.bg = TM.v('--bg'); res.koyu = isDarkTheme();
  TM.rects.light = TM.rect();
  const diff = Object.keys(TM.rects.gece).filter(k => TM.rects.gece[k] !== TM.rects.light[k]);
  res.farkli = diff.map(k => k + ' ' + TM.rects.gece[k] + ' → ' + TM.rects.light[k]);
  res.ok = res.look === 'light' && res.bg === '#faf9f5' && !res.koyu && diff.length === 0;
  return res;
})()
//--
(async()=>{
  const res = {name: 'tema: Gece, 3 bölme'};
  document.querySelector('[data-pane="0"] [data-perm="allow"]')?.click();
  const s = sess(TM.sid); for (let k = 0; k < 80 && s.run; k++) await W(100);
  res.bitti = !s.run;
  WS.prefs = Tema.choose(WS.prefs, 'gece'); applyTheme(WS.prefs); S.layout = 3; render(); await W(300);
  const r3 = TM.rect(); WS.prefs = Tema.choose(WS.prefs, 'claude'); applyTheme(WS.prefs); await W(200);
  const r3c = TM.rect(); WS.prefs = Tema.choose(WS.prefs, 'gece'); applyTheme(WS.prefs); await W(300);
  res.ucBolmeFarkli = Object.keys(r3).filter(k => r3[k] !== r3c[k]);
  res.bolme = document.querySelectorAll('#grid > .pane').length; res.look = document.documentElement.dataset.look;
  res.ok = res.bitti && res.bolme === 3 && res.look === 'gece' && res.ucBolmeFarkli.length === 0;
  return res;
})()
//--
(async()=>{
  const res = {name: 'tema: ayarlar menüsünde tema seçimi ve varsayılan güncelleme klasörü'};
  document.querySelector('#btnSettings').click(); await W(200);
  const m = document.querySelector('.menu');
  res.secenekler = [...m.querySelectorAll('[data-m="tema"]')].map(b => b.dataset.v + (b.hasAttribute('data-cur') ? '*' : ''));
  const ud = m.querySelector('.upd-dir'); res.klasor = ud ? ud.textContent.trim() : null;
  res.varsayilanaDon = !!m.querySelector('[data-m="upddef"]'); res.platform = API.platform;
  const winBekle = API.platform === 'win32';
  res.ok = res.secenekler.join(',') === 'gece*,claude,light,system' && (winBekle ? !!res.klasor && res.klasor.includes('(varsayılan)') && !res.varsayilanaDon : !res.klasor);
  return res;
})()
//--
(async()=>{
  const res = {name: 'tema: menüden Claude koyu seçimi, tema düğmesi takımı korur; seçilmiş güncelleme klasörü'};
  document.querySelector('.menu [data-m="tema"][data-v="claude"]').click(); await W(200);
  res.secildi = document.documentElement.dataset.look; res.kayit = {theme: WS.prefs.theme, palette: WS.prefs.palette}; res.menuKapandi = !document.querySelector('.menu');
  document.querySelector('#btnTheme').click(); await W(150); res.dugme1 = document.documentElement.dataset.look;
  document.querySelector('#btnTheme').click(); await W(150); res.dugme2 = document.documentElement.dataset.look;
  WS.prefs = Tema.choose(WS.prefs, 'gece'); applyTheme(WS.prefs); await W(150);
  TM.ud0 = UPDDIR;
  if (UPDDIR && UPDDIR.defaultDir) { UPDDIR = {...UPDDIR, dir: 'E:\\Baska Klasor\\Exe', isDefault: false}; }
  document.querySelector('#btnSettings').click(); await W(200);
  const ud = document.querySelector('.menu .upd-dir'); res.secilmisKlasor = ud ? ud.textContent.trim() : null;
  res.varsayilanaDon = !!document.querySelector('.menu [data-m="upddef"]');
  res.ok = res.secildi === 'claude' && res.kayit.palette === 'claude' && res.kayit.theme === 'dark' && res.menuKapandi && res.dugme1 === 'light' && res.dugme2 === 'claude' && (API.platform === 'win32' ? res.varsayilanaDon && /Baska Klasor/.test(res.secilmisKlasor) && !/varsayılan/.test(res.secilmisKlasor) : !res.secilmisKlasor);
  return res;
})()
//--
(async()=>{
  const res = {name: 'tema: Varsayılana dön ve durumu geri al'};
  const b = document.querySelector('.menu [data-m="upddef"]');
  if (b) { b.click(); for (let k = 0; k < 100 && !(UPDDIR && UPDDIR.isDefault); k++) await W(100); res.donuldu = !!(UPDDIR && UPDDIR.isDefault); res.klasor = UPDDIR && UPDDIR.dir; } else { closeMenu(); res.donuldu = null; }
  closeMenu(); document.querySelector('.toast')?.classList.remove('show');
  const s = sess(TM.sid); if (s) { s.msgs = TM.keep; s.status = 'idle'; }
  WS.prefs = TM.p0; applyTheme(WS.prefs); S.layout = TM.l0; render(); persist(); await W(300);
  res.geriAlindi = JSON.stringify(WS.prefs) === JSON.stringify(TM.p0) && S.layout === TM.l0;
  res.ok = res.geriAlindi && (API.platform === 'win32' ? res.donuldu === true : true);
  return res;
})()
