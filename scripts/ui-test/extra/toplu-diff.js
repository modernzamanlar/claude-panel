(async()=>{
  /* Değişen dosyalar penceresi (changes-ui.js): sahte API ile liste, fark, onay, dışarıda değişmiş uyarısı + ayrı onay, kaçış */
  const res = {name: 'değişen dosyalar ve geri alma'};
  const W = ms => new Promise(r => setTimeout(r, ms));
  const calls = [];
  const F = [
    {path: 'C:\\p\\a.txt', created: false, added: 1, removed: 1, cur: 'same', canRevert: true, hash: 'h1', ack: false, initial: 'bir\niki\n', last: 'bir\nİKİ\n'},
    {path: 'C:\\p\\<b>x.md', created: true, added: 2, removed: 0, cur: 'same', canRevert: true, hash: 'h2', ack: false, initial: null, last: 'y\n<script>window.__cxXss=1</script>\n'},
    {path: 'C:\\p\\d.txt', created: false, added: 1, removed: 1, cur: 'outside', canRevert: true, hash: 'h3', ack: true, initial: 'q\n', last: 'Q\n', current: 'Q\nelle\n'},
    {path: 'C:\\p\\big.txt', created: false, added: 1, removed: 1, approx: true, cur: 'unverified', canRevert: false, reason: 'Kayıtta dosyanın tam içeriği yok.', hash: 'h4', ack: true, steps: [{tool: 'Edit', d: {e: [{o: 'eski', n: 'yeni'}]}}]},
  ];
  const brief = f => { const {initial, last, current, steps, ...b} = f; return b; };
  const api = {
    list: async sid => { calls.push(['list', sid]); return F.map(brief); },
    diff: async (sid, p) => { const f = F.find(x => x.path === p); return {...brief(f), initial: f.initial, last: f.last, current: 'current' in f ? f.current : f.last, steps: f.steps || []}; },
    revert: async (sid, p, o) => { calls.push(['revert', p, o.hash, o.ack]); const f = F.find(x => x.path === p); if(f.ack && !o.ack) throw new Error('onay gerekiyor'); f.cur = f.created ? 'missing' : 'initial'; return {ok: true, action: f.created ? 'trash' : 'write', backup: 'C:\\yedek'}; },
  };
  const q = s => document.querySelector('#cx ' + s);
  try {
    changesUI.open('11111111-2222-4333-8444-555555555555', 'UI testi', api); await W(150);
    res.liste = [...document.querySelectorAll('#cx .cx-f b')].map(b => b.textContent);
    res.kacis = !window.__cxXss && !q('.cx-f b b') && res.liste[1] === '<b>x.md';
    res.fark = q('.cx-r .dv-a') && q('.cx-r .dv-a').textContent.includes('İKİ') && q('.cx-r .dv-d').textContent.includes('iki');
    q('[data-cxrev]').click(); await W(30);
    res.onay = !!q('.cx-confirm') && !q('[data-cxyes]').disabled && !q('.cx-ack');
    q('[data-cxno]').click(); await W(30); res.vazgec = !q('.cx-confirm') && !calls.some(c => c[0] === 'revert');
    q('[data-cxrev]').click(); await W(30); q('[data-cxyes]').click(); await W(80);
    res.geriAl = JSON.stringify(calls.find(c => c[0] === 'revert')) === JSON.stringify(['revert', 'C:\\p\\a.txt', 'h1', false]);
    q('[data-cxsel="1"]').click(); await W(80);
    res.xss2 = !window.__cxXss && !q('.cx-r script');
    q('[data-cxsel="2"]').click(); await W(80); q('[data-cxrev]').click(); await W(30);
    res.disari = !!q('.cx-warn') && q('[data-cxyes]').disabled && q('.cx-ext .dv-a').textContent.includes('elle');
    q('[data-cxack]').click(); await W(30); res.ackSonra = !q('[data-cxyes]').disabled;
    q('[data-cxyes]').click(); await W(80);
    res.ackGitti = calls.some(c => c[0] === 'revert' && c[1] === 'C:\\p\\d.txt' && c[3] === true);
    q('[data-cxsel="3"]').click(); await W(80);
    res.kapali = q('.cx-acts .btn:last-child').disabled && !!q('.cx-why') && !!q('.cx-step .dv-a');
    document.body.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})); await W(30);
    res.esc = !document.getElementById('cx');
    res.ok = res.liste.length === 4 && res.kacis && res.fark && res.onay && res.vazgec && res.geriAl && res.xss2 && res.disari && res.ackSonra && res.ackGitti && res.kapali && res.esc;
  } catch(e) { res.ok = false; res.hata = String(e && e.stack || e); }
  changesUI.close();
  return res;
})()
