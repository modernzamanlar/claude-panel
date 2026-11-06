(async()=>{
  const w = ms => new Promise(r=>setTimeout(r,ms)); const name = 'Claude ayarları: dört sekme + Hafıza';
  const L = await window.api.ccfg.list(null); const home = L.roots.home.replace(/\\/g,'/');
  if (!/\/claude-home$/.test(home)) return {name, ok:false, atlandi:'CLAUDE_PANEL_CLAUDE_HOME=<geçici>/claude-home verilmedi; gerçek ~/.claude korunuyor', home};
  window.CCT = {P: L.roots.home + (home.includes(':') ? '\\proj' : '/proj'), panes: S.panes.slice(), layout: S.layout};
  const r = {};
  document.querySelector('#btnSettings').click(); await w(250);
  r.menuOge = !!document.querySelector('.menu [data-m="ccOpen"]'); document.querySelector('.menu [data-m="ccOpen"]').click(); await w(600);
  r.acildi = !!document.querySelector('#ccfg .cc-modal');
  await CCUI.open({cwd: CCT.P, tab: 'mem'}); await w(300);
  r.sekmeler = [...document.querySelectorAll('#ccfg .cc-tabs button')].map(b => b.textContent);
  r.dosyalar = [...document.querySelectorAll('#ccfg .cc-file b')].map(b => b.textContent);
  r.icerik = document.querySelector('#ccfg [data-cc-ta]').value;
  document.querySelector('#ccfg [data-cc="mem"][data-k="proj-local-md"]').click(); await w(200);
  const ta = document.querySelector('#ccfg [data-cc-ta="proj-local-md"]'); ta.value = '# Yerel notlar\n- yalnız bu makine\n'; ta.dispatchEvent(new Event('input', {bubbles:true}));
  document.querySelector('#ccfg [data-cc="savetext"]').click(); await w(500);
  const f = await window.api.ccfg.read('proj-local-md', CCT.P); r.olusturuldu = f.exists && f.text.includes('yalnız bu makine');
  document.querySelector('#ccfg [data-cc="mem"][data-k="user-md"]').click(); await w(200);
  r.ok = r.menuOge && r.acildi && r.sekmeler.join('|') === 'Hafıza|İzinler|Ayarlar|Eklentiler ve ajanlar' && r.dosyalar.length === 4 && r.icerik.includes('Arayüz dili Türkçe') && r.olusturuldu;
  return {name, ...r};
})()
//--
(async()=>{
  const w = ms => new Promise(r=>setTimeout(r,ms)); const name = 'Claude ayarları: izin kuralı ekleme + sözdizimi denetimi';
  if (!window.CCT) return {name, ok:false, atlandi:'ilk adım çalışmadı'};
  const r = {};
  document.querySelector('#ccfg [data-cc="tab"][data-k="perm"]').click(); await w(300);
  r.satirOnce = document.querySelectorAll('#ccfg .cc-tbl tbody tr').length;
  r.defaultMode = document.querySelector('#ccfg .cc-kv').textContent.includes('acceptEdits');
  const inp = document.querySelector('#ccRule'); inp.value = 'Bash(ls'; inp.dispatchEvent(new Event('input', {bubbles:true})); await w(100);
  r.hataMesaji = document.querySelector('#ccRuleMsg').textContent;
  document.querySelector('#ccfg [data-cc="ruleadd"]').click(); await w(300);
  r.hataliYazilmadi = !JSON.stringify((await window.api.ccfg.read('proj-settings', CCT.P)).parsed).includes('Bash(ls');
  const inp2 = document.querySelector('#ccRule'); inp2.value = 'Bash(npm run test:*)'; inp2.dispatchEvent(new Event('input', {bubbles:true}));
  document.querySelector('#ccKind').value = 'allow'; document.querySelector('#ccSrc').value = 'proj-settings';
  document.querySelector('#ccfg [data-cc="ruleadd"]').click(); await w(500);
  const p = (await window.api.ccfg.read('proj-settings', CCT.P)).parsed;
  r.dosyada = p.permissions.allow; r.eskiKorundu = p.permissions.ask;
  r.satirSonra = document.querySelectorAll('#ccfg .cc-tbl tbody tr').length;
  r.ok = /kapanmamış/.test(r.hataMesaji) && r.hataliYazilmadi && JSON.stringify(r.dosyada) === '["Bash(npm run test:*)"]' && JSON.stringify(r.eskiKorundu) === '["WebFetch(domain:example.com)"]' && r.satirSonra === r.satirOnce + 1;
  return {name, ...r};
})()
//--
(async()=>{
  const w = ms => new Promise(r=>setTimeout(r,ms)); const name = 'Claude ayarları: izin kuralı düzenleme + silme';
  if (!window.CCT) return {name, ok:false, atlandi:'ilk adım çalışmadı'};
  const r = {};
  const row = () => [...document.querySelectorAll('#ccfg .cc-tbl tbody tr')].find(tr => tr.textContent.includes('npm run'));
  row().querySelector('[data-cc="ruleedit"]').click(); await w(200);
  const ed = document.querySelector('#ccRuleEd'); ed.value = 'Bash(npm run lint:*)'; ed.dispatchEvent(new Event('input', {bubbles:true}));
  document.querySelector('#ccfg [data-cc="ruleok"]').click(); await w(500);
  r.duzenlendi = (await window.api.ccfg.read('proj-settings', CCT.P)).parsed.permissions.allow;
  row().querySelector('[data-cc="ruledel"]').click(); await w(500);
  const p = (await window.api.ccfg.read('proj-settings', CCT.P));
  r.silindi = p.parsed.permissions.allow; r.yedek = p.path + '.bak';
  r.kullaniciKorundu = (await window.api.ccfg.read('user-settings', null)).parsed.bilinmeyenAnahtar;
  r.ok = JSON.stringify(r.duzenlendi) === '["Bash(npm run lint:*)"]' && Array.isArray(r.silindi) && r.silindi.length === 0 && !row() && r.kullaniciKorundu && r.kullaniciKorundu.korunmali === true;
  return {name, ...r};
})()
//--
(async()=>{
  const w = ms => new Promise(r=>setTimeout(r,ms)); const name = 'Claude ayarları: bozuk JSON reddedilir';
  if (!window.CCT) return {name, ok:false, atlandi:'ilk adım çalışmadı'};
  const r = {};
  document.querySelector('#ccfg [data-cc="tab"][data-k="set"]').click(); await w(300);
  document.querySelector('#ccfg [data-cc="set"][data-k="user-settings"]').click(); await w(200);
  document.querySelector('#ccfg [data-cc="sub"][data-k="raw"]').click(); await w(200);
  const before = (await window.api.ccfg.read('user-settings', null)).text;
  const ta = document.querySelector('#ccfg .cc-raw'); ta.value = '{\n  "theme": "dark",\n  "model": opus\n}\n'; ta.dispatchEvent(new Event('input', {bubbles:true})); await w(150);
  r.mesaj = document.querySelector('#ccRawMsg').textContent; r.kaydetKapali = document.querySelector('#ccfg [data-cc="saveraw"]').disabled;
  const yaz = await window.api.ccfg.write('user-settings', null, ta.value, {force:true});
  r.anaSurecReddi = yaz; r.degismedi = (await window.api.ccfg.read('user-settings', null)).text === before;
  r.ok = /Satır 3, sütun 12/.test(r.mesaj) && r.kaydetKapali === true && yaz.invalid === true && yaz.line === 3 && r.degismedi;
  return {name, ...r};
})()
//--
(async()=>{
  const w = ms => new Promise(r=>setTimeout(r,ms)); const name = "Claude ayarları: hook'lar + output style + statusline";
  if (!window.CCT) return {name, ok:false, atlandi:'ilk adım çalışmadı'};
  const r = {};
  document.querySelector('#ccfg [data-cc="revert"]').click(); await w(300);
  document.querySelector('#ccfg [data-cc="sub"][data-k="style"]').click(); await w(200);
  r.stiller = [...document.querySelectorAll('#ccStyle option')].map(o => o.value).filter(Boolean);
  document.querySelector('#ccStyle').value = 'Kısa ve öz'; document.querySelector('#ccfg [data-cc="stylesave"]').click(); await w(500);
  document.querySelector('#ccfg [data-cc="sub"][data-k="status"]').click(); await w(200);
  document.querySelector('#ccSlCmd').value = 'node ~/.claude/durum.js'; document.querySelector('#ccSlPad').value = '1'; document.querySelector('#ccfg [data-cc="slsave"]').click(); await w(500);
  document.querySelector('#ccfg [data-cc="sub"][data-k="hooks"]').click(); await w(200);
  r.hookSatir = document.querySelectorAll('#ccfg .cc-tbl tbody tr').length;
  document.querySelector('#ccHEv').value = 'PostToolUse'; document.querySelector('#ccHMt').value = 'Write'; document.querySelector('#ccHCmd').value = 'npx eslint --fix'; document.querySelector('#ccHTo').value = '20';
  document.querySelector('#ccfg [data-cc="hookadd"]').click(); await w(500);
  const p = (await window.api.ccfg.read('user-settings', null)).parsed;
  r.outputStyle = p.outputStyle; r.statusLine = p.statusLine; r.yeniHook = p.hooks.PostToolUse; r.argsKorundu = p.hooks.Stop[0].hooks[0].args;
  r.hookSatirSonra = document.querySelectorAll('#ccfg .cc-tbl tbody tr').length;
  r.ok = r.stiller.includes('Explanatory') && r.stiller.includes('Kısa ve öz') && r.outputStyle === 'Kısa ve öz' && r.statusLine.command === 'node ~/.claude/durum.js' && r.statusLine.padding === 1 && r.yeniHook[0].matcher === 'Write' && r.yeniHook[0].hooks[0].timeout === 20 && JSON.stringify(r.argsKorundu) === '["kontrol.py"]' && r.hookSatirSonra === r.hookSatir + 1;
  return {name, ...r};
})()
//--
(async()=>{
  const w = ms => new Promise(r=>setTimeout(r,ms)); const name = 'Claude ayarları: eklentiler ve ajanlar';
  if (!window.CCT) return {name, ok:false, atlandi:'ilk adım çalışmadı'};
  const r = {};
  document.querySelector('#ccfg [data-cc="tab"][data-k="ext"]').click(); await w(300);
  r.eklentiler = [...document.querySelectorAll('#ccfg [data-cc-plug]')].map(x => [x.dataset.ccPlug, x.checked]);
  r.ajanlar = [...document.querySelectorAll('#ccfg [data-cc="agentopen"]')].map(b => b.dataset.scope + ':' + b.dataset.file);
  const cb = document.querySelector('#ccfg [data-cc-plug="notlar@resmi"]'); cb.checked = true; cb.dispatchEvent(new Event('change', {bubbles:true})); await w(600);
  r.enabledPlugins = (await window.api.ccfg.read('user-settings', null)).parsed.enabledPlugins;
  r.ok = JSON.stringify(r.eklentiler) === '[["bicimci@resmi",true],["notlar@resmi",false]]' && r.ajanlar.join(',') === 'user:kod-inceleme.md,proj:belge-yazari.md' && r.enabledPlugins['notlar@resmi'] === true && r.enabledPlugins['bicimci@resmi'] === true && !!document.querySelector('#ccfg [data-cc-plug="notlar@resmi"]:checked');
  return {name, ...r};
})()
//--
(async()=>{
  const w = ms => new Promise(r=>setTimeout(r,ms)); const name = 'Claude ayarları: dışarıda değişen dosya uyarısı';
  if (!window.CCT) return {name, ok:false, atlandi:'ilk adım çalışmadı'};
  const r = {};
  document.querySelector('#ccfg [data-cc="tab"][data-k="perm"]').click(); await w(300);
  const cur = await window.api.ccfg.read('proj-settings', CCT.P);
  await window.api.ccfg.write('proj-settings', CCT.P, cur.text.replace('"ask"', '"deny"'), {expectHash: cur.hash});
  const inp = document.querySelector('#ccRule'); inp.value = 'Grep'; inp.dispatchEvent(new Event('input', {bubbles:true}));
  document.querySelector('#ccSrc').value = 'proj-settings'; document.querySelector('#ccfg [data-cc="ruleadd"]').click(); await w(500);
  r.uyari = (document.querySelector('#ccfg .cc-warn') || {}).textContent || '';
  r.yazilmadi = !(await window.api.ccfg.read('proj-settings', CCT.P)).text.includes('Grep');
  r.ok = /dışında değişti/.test(r.uyari) && r.yazilmadi;
  return {name, ...r};
})()
//--
(async()=>{
  const w = ms => new Promise(r=>setTimeout(r,ms)); const name = 'Claude ayarları: uyarıdan yeniden yükle, Esc ile kapanır';
  if (!window.CCT) return {name, ok:false, atlandi:'ilk adım çalışmadı'};
  const r = {};
  document.querySelector('#ccfg [data-cc="reloadw"]').click(); await w(400);
  r.uyariGitti = !document.querySelector('#ccfg .cc-warn');
  r.disDegisiklikGorundu = [...document.querySelectorAll('#ccfg .cc-tbl tbody tr')].some(tr => tr.textContent.includes('example.com') && tr.textContent.includes('Reddet'));
  document.body.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true})); await w(200);
  r.kapandi = !document.querySelector('#ccfg');
  r.ok = r.uyariGitti && r.disDegisiklikGorundu && r.kapandi;
  return {name, ...r};
})()
//--
(async()=>{
  const w = ms => new Promise(r=>setTimeout(r,ms)); const name = '# notu: kapsam seçimi gösterilir, mesaj gönderilmez';
  if (!window.CCT) return {name, ok:false, atlandi:'ilk adım çalışmadı'};
  const r = {};
  newChat(); await w(400); document.querySelector('#ncTitle').value = 'Claude ayarları testi'; NC.dir = CCT.P; startChat(); await w(500);
  const i = S.panes.findIndex(id => id && sess(id).title === 'Claude ayarları testi'); CCT.i = i; CCT.sid = S.panes[i];
  const ta = document.querySelector(`[data-ta="${i}"]`); ta.value = '# panel testleri geçici klasörde çalışır'; ta.dispatchEvent(new Event('input', {bubbles:true}));
  const n0 = sess(CCT.sid).msgs.length;
  await send(i); await w(300);
  r.secenekler = [...document.querySelectorAll('.menu [data-m="ccNote"]')].map(b => b.dataset.scope);
  r.gonderilmedi = sess(CCT.sid).msgs.length === n0 && !sess(CCT.sid).run;
  r.metinDuruyor = ta.value.startsWith('#');
  r.ok = r.secenekler.join(',') === 'user,proj' && r.gonderilmedi && r.metinDuruyor;
  return {name, ...r};
})()
//--
(async()=>{
  const w = ms => new Promise(r=>setTimeout(r,ms)); const name = '# notu: seçilen CLAUDE.md sonuna madde olarak eklenir';
  if (!window.CCT || CCT.i == null) return {name, ok:false, atlandi:'önceki adım çalışmadı'};
  const r = {};
  document.querySelector('.menu [data-m="ccNote"][data-scope="proj"]').click(); await w(500);
  r.bildirim = document.querySelector('#toast').textContent;
  r.dosya = (await window.api.ccfg.read('proj-md', CCT.P)).text;
  r.kutuBos = document.querySelector(`[data-ta="${CCT.i}"]`).value === '';
  const ta = document.querySelector(`[data-ta="${CCT.i}"]`); ta.value = '#kullanıcı notu'; ta.dispatchEvent(new Event('input', {bubbles:true}));
  await send(CCT.i); await w(300); document.querySelector('.menu [data-m="ccNote"][data-scope="user"]').click(); await w(500);
  r.kullanici = (await window.api.ccfg.read('user-md', null)).text;
  r.ok = /Hafızaya eklendi/.test(r.bildirim) && r.dosya.endsWith('Testler geçici klasörde çalışır.\n- panel testleri geçici klasörde çalışır\n') && r.kutuBos && r.kullanici.endsWith('- Arayüz dili Türkçe\n- kullanıcı notu\n');
  return {name, ...r};
})()
//--
(async()=>{
  const w = ms => new Promise(r=>setTimeout(r,ms)); const name = 'Bölme menüsü: Claude ayarları + Dışa aktar (Markdown)';
  if (!window.CCT || CCT.i == null) return {name, ok:false, atlandi:'önceki adım çalışmadı'};
  const r = {}; const s = sess(CCT.sid);
  s.msgs.push({r:'u', t:'Merhaba, ayarları dışa aktar', ts:new Date().toISOString()}, {r:'a', ts:new Date().toISOString(), b:[{t:'text', v:'Tamam, **dışa aktarıyorum**.'}, {t:'tool', n:'Bash', a:'ls -la'}]});
  document.querySelector(`[data-pane="${CCT.i}"] [data-more]`).click(); await w(250);
  r.menu = [...document.querySelectorAll('.menu [data-m^="cc"]')].map(b => b.dataset.m);
  document.querySelector('.menu [data-m="ccExport"]').click(); await w(800);
  r.bildirim = document.querySelector('#toast').textContent;
  r.md = ccfgCore.toMarkdown({title:s.title, project:s.project, msgs:s.msgs});
  r.ok = r.menu.join(',') === 'ccOpen,ccExport' && /Dışa aktarıldı · .*Claude ayarları testi \d{4}-\d\d-\d\d\.md$/.test(r.bildirim) && r.md.includes('### Kullanıcı') && r.md.includes('> Araç: `Bash` — ls -la');
  S.sessions = S.sessions.filter(x => x.id !== CCT.sid); S.items = S.items.filter(x => x !== CCT.sid); S.panes = CCT.panes; S.layout = CCT.layout; render();
  return {name, ...r};
})()
