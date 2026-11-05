/* Tarayıcı paneli: düğmeyle açılır, bilgi panelinin yerini alır; javascript:/file: reddedilir; selftest'in yerel sayfası
   (127.0.0.1, şemasız yazılır → http) açılır, başlık/adres gelir, görünüm konumlanır, adres kaydedilir; arama ve menü
   görünümü gizler; geri düğmesi; ⇧⌘P kapatır; sohbetteki localhost bağlantısı panelde açılır; bilgi düğmesi paneli kapatır. */
(async () => {
  const W = ms => new Promise(r => setTimeout(r, ms));
  const until = async (f, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (f()) return true; await W(100); } return false; };
  const r = { name: 'tarayıcı paneli' }, info0 = S.info, B = api.browser, u = $('#bpUrl');
  const enter = v => { u.value = v; u.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); };
  const vis = () => { const s = __bp().sent; return !!(s && s.width > 0 && s.height > 0); };
  $('#btnBrowser').click(); await W(300);
  r.acik = __bp().open && !$('#bp').hidden && getComputedStyle($('#info')).display === 'none' && $('#btnBrowser').classList.contains('on');
  r.bos = $('#bpMsg').textContent.includes('localhost:3000') && !vis();
  enter('javascript:alert(1)'); await W(300);
  r.jsRed = __bp().st.url === '' && $('#toast').textContent.includes('Geçersiz adres') && !vis();
  r.digerRed = [(await B.navigate('file:///etc/passwd')).ok, (await B.navigate('data:text/html,x')).ok, (await B.navigate('kelime')).ok].every(x => x === false);
  const t = await B.testUrl();
  enter(t.replace('http://', ''));
  r.yuklendi = await until(() => __bp().st.title === 'Önizleme testi' && !__bp().st.loading); r.st0 = __bp().st;
  await W(300);
  r.adres = __bp().st.url === t && u.value === t && WS.prefs.browserUrl === t;
  const s = __bp().sent, q = $('#bpView').getBoundingClientRect();
  r.konum = vis() && Math.abs(s.x - q.left) < 1 && Math.abs(s.width - q.width) < 1 && !$('#bpMsg').textContent;
  r.shot = await B.testShot();
  setSearch(true); await W(150); r.aramaGizler = !vis(); setSearch(false); await W(150); r.aramaSonra = vis();
  menu(innerWidth - 60, 120, '<button>deneme</button>'); await W(150); r.menuGizler = !vis(); closeMenu(); await W(150); r.menuSonra = vis();
  await B.navigate(t + 'iki'); await until(() => __bp().st.title === 'İkinci sayfa' && !__bp().st.loading);
  r.geriEtkin = !$('#bpBack').disabled;
  $('#bpBack').click(); r.geri = await until(() => __bp().st.title === 'Önizleme testi' && __bp().st.url === t && !__bp().st.loading);
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', shiftKey: true, metaKey: IS_MAC, ctrlKey: !IS_MAC, bubbles: true, cancelable: true })); await W(300);
  r.kisayolKapatti = !__bp().open && $('#bp').hidden && !vis() && !document.querySelector('.app').classList.contains('bp-on');
  const a = document.createElement('a'); a.href = t + 'iki'; a.textContent = 'yerel'; $('.main').appendChild(a);
  a.click(); a.remove();
  r.baglanti = __bp().open && await until(() => __bp().st.title === 'İkinci sayfa' && vis());
  $('#btnInfo').click(); await W(300);
  r.bilgiDugmesi = !__bp().open && !vis() && S.info === true && getComputedStyle($('#info')).display !== 'none';
  if (S.info !== info0) { S.info = info0; render(); }
  r.ok = ['acik', 'bos', 'jsRed', 'digerRed', 'yuklendi', 'adres', 'konum', 'aramaGizler', 'aramaSonra', 'menuGizler', 'menuSonra', 'geriEtkin', 'geri', 'kisayolKapatti', 'baglanti', 'bilgiDugmesi'].every(k => r[k] === true) && !!r.shot;
  return r;
})()
