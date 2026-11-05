(async()=>{
  const res = {name: 'gerçek bağlam kullanımı'};
  const a0 = S.active, i0 = S.info;
  S.active = 0; S.info = true; renderInfo(); await W(200);
  const s = sess(S.panes[0]);
  const sec = () => [...document.querySelectorAll('#info .isec')].find(e => /^Bağlam/.test((e.querySelector('h4') || {}).textContent || ''));
  const src = () => ((sec() || document.body).querySelector('[data-ctxsrc]') || {dataset:{}}).dataset.ctxsrc;
  /* önceki adımlarda bilgi paneli açıkken biten tur ölçümü kendiliğinden yapmış olmalı; modelUsage'dan pencere */
  res.turSonu = !!s.ctxReal; res.pencere = s.ctxWindow;
  s.ctxReal = null; s.ctxStale = false; renderInfo(); await W(100);
  res.tahmin = src() === 'est' && /tahmin/.test(sec().querySelector('h4').textContent);
  sec().querySelector('[data-ctxrefresh]').click(); await W(50);
  res.olculuyor = /Ölçülüyor/.test(sec().querySelector('h4').textContent);
  for (let k = 0; k < 100 && (!s.ctxReal || s.ctxLoading); k++) await W(100);
  const el = sec();
  const names = [...el.querySelectorAll('.leg .n')].map(n => n.textContent.trim());
  res.gercek = src() === 'real' && /gerçek/.test(el.querySelector('h4').textContent);
  res.ust = [...el.querySelector('.ctx-top').children].map(e => e.textContent.trim()).join(' ');
  res.kategoriler = names;
  res.dilimler = el.querySelectorAll('.bar i').length;
  res.ertelenmis = [...el.querySelectorAll('.leg .n.dim')].map(n => n.textContent.trim());
  res.hafiza = (el.querySelectorAll('.exp-b')[1] || {}).textContent;
  res.ok = res.turSonu && res.pencere === 1000000 && res.tahmin && res.olculuyor && res.gercek
    && res.ust === '%4 kullanıldı 40.8k / 1M'
    && ['Sistem istemi', 'Sistem araçları', 'MCP araçları', 'Mesajlar', "Skill'ler", 'Sıkıştırma payı', 'Boş alan'].every(n => names.includes(n))
    && res.dilimler === 9 && res.ertelenmis.join('|') === 'Ertelenmiş MCP araçları|Ertelenmiş sistem araçları'
    && /CLAUDE\.md · 1\.1k/.test(res.hafiza || '');
  S.active = a0; S.info = i0; renderInfo();
  return res;
})()
