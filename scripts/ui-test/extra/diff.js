(async()=>{
  const res = {name: 'dosya farkı görünümü'};
  const s = sess(S.panes[0]); if(!s) return {...res, ok: false, neden: 'bölme 0 boş'};
  const keep = s.msgs, keepSt = s.status, p0 = () => document.querySelector('[data-pane="0"]');
  try {
    const d = diffView.data('Edit', {file_path: '/x/a.js', old_string: 'bir\niki\nüç\n', new_string: 'bir\nİKİ <script>window.__dvXss=1</script>\n"tırnak" \'tek\'\nüç\n'});
    const w = diffView.data('Write', {file_path: '/x/b.txt', content: 'yeni dosya\nikinci satır\n'});
    s.msgs = [...keep, {r: 'a', b: [{t: 'text', v: '<p>fark testi</p>'}, {t: 'tool', n: 'Edit', a: '/x/a.js', o: 'güncellendi', d}]}, {r: 'u', t: 'devam'}, {r: 'a', b: [{t: 'tool', n: 'Write', a: '/x/b.txt', o: '', d: w}, {t: 'tool', n: 'Bash', a: 'ls', o: 'çıktı'}]}];
    s.status = 'idle'; renderPanes(); await W(150);
    const tools = [...p0().querySelectorAll('.tool')].filter(t => t.querySelector('.dv-n'));
    const t = tools.find(x => x.textContent.includes('/x/a.js'));
    res.baslik = t ? t.querySelector('.dv-n').textContent : null;
    res.kapali = t ? getComputedStyle(t.querySelector('.tool-b')).display : null;
    t.querySelector('.tool-h').click(); await W(50);
    res.acik = t.classList.contains('open') && getComputedStyle(t.querySelector('.tool-b')).display === 'block';
    res.eklenen = t.querySelectorAll('.dv-l.dv-a').length; res.silinen = t.querySelectorAll('.dv-l.dv-d').length; res.baglam = t.querySelectorAll('.dv-l.dv-c').length;
    res.kacis = !t.querySelector('.tool-b script') && !window.__dvXss && t.querySelector('.dv-a .dv-t').textContent.includes('<script>') && t.querySelector('.tool-b').innerHTML.includes('&lt;script&gt;');
    res.renk = getComputedStyle(t.querySelector('.dv-a')).backgroundColor !== getComputedStyle(t.querySelector('.dv-d')).backgroundColor && !/^rgba\(0, 0, 0, 0\)$/.test(getComputedStyle(t.querySelector('.dv-a')).backgroundColor);
    res.mono = /mono|Menlo|Consolas|JetBrains/i.test(getComputedStyle(t.querySelector('.dv')).fontFamily);
    const g = [...p0().querySelectorAll('.tgroup')].pop(); g.querySelector('.tg-h').click(); await W(30);
    const wt = [...g.querySelectorAll('.tool')].find(x => x.textContent.includes('/x/b.txt'));
    res.grupYazma = wt ? wt.querySelector('.dv-n').textContent : null;
    res.bashFarksiz = [...g.querySelectorAll('.tool')].filter(x => x.querySelector('.dv-n')).length === 1;
    g.querySelector('.tg-h').click();
    res.ok = res.baslik === '+2−1' && res.kapali === 'none' && res.acik && res.eklenen === 2 && res.silinen === 1 && res.baglam === 2 && res.kacis && res.renk && res.mono && res.grupYazma === '+2' && res.bashFarksiz;
  } catch(e) { res.ok = false; res.hata = String(e && e.stack || e); }
  s.msgs = keep; s.status = keepSt; renderPanes(); await W(50);
  return res;
})()
