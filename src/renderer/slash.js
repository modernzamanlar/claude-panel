// Yazma kutusunda "/" menüsü: şablonlar + komutlar + skill'ler tek listede, bölümler halinde.
// Kaynaklar: (1) CLI'nin stream-json "system/init" (slash_commands, skills, terminal_slash_commands) ve
// "system/commands_changed" (ad + açıklama + argumentHint + builtin + aliases) olayları; (2) bunlar gelmeden önce
// ana süreçteki dosya sistemi taraması (main/commands.js); (3) panelin bildiği yerleşik komutlar (BUILTIN).
// Tarayıcıda window.slash, Node testlerinde module.exports olarak kullanılır.
(function () {
  const MAP = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };
  const norm = s => String(s).toLocaleLowerCase('tr').replace(/[çğıöşüâîû]/g, c => MAP[c]);

  // Panelde gerçekten çalışan yerleşik komutlar (claude -p stream-json ile tek tek denendi).
  // action: panelde karşılığı olanlar CLI'ye gönderilmez, panel işlevi çalışır.
  // Listede olmayan yerleşikler (/doctor, /agents, /fast, /color, /focus, /insights …) -p modunda çalışmıyor ya da anlamsız.
  const BUILTIN = [
    { name: 'clear', aliases: ['new', 'reset'], desc: 'Yeni sohbet aç (aynı klasörde)', action: 'new' },
    { name: 'model', desc: 'Model menüsünü aç', action: 'model' },
    { name: 'effort', desc: 'Düşünme seviyesi menüsünü aç', action: 'effort' },
    { name: 'compact', desc: 'Sohbeti özetleyip bağlamı boşalt', hint: '[özet talimatı]' },
    { name: 'context', desc: 'Bağlam kullanımını göster' },
    { name: 'usage', aliases: ['cost', 'stats'], desc: 'Kullanım ve limit durumu' },
    { name: 'init', desc: 'Bu klasör için CLAUDE.md oluştur' },
    { name: 'recap', desc: 'Şu ana kadarki işin kısa özeti' },
    { name: 'rename', desc: 'Oturumu yeniden adlandır', hint: '<ad>' },
    { name: 'mcp', desc: 'MCP sunucularının durumu' },
    { name: 'reload-skills', desc: "Skill'leri yeniden yükle" },
    { name: 'output-style', desc: 'Çıktı stilini göster ya da değiştir', hint: '[stil]' },
    { name: 'autocompact', desc: 'Otomatik sıkıştırma penceresi' },
    { name: 'config', desc: 'Bir ayarı değiştir', hint: 'anahtar=değer' },
  ];
  const BY_NAME = new Map();
  BUILTIN.forEach(b => [b.name, ...(b.aliases || [])].forEach(n => BY_NAME.set(n, b)));

  const SECTIONS = [['tpl', 'Şablonlar'], ['cmd', 'Komutlar'], ['skill', "Skill'ler"]];
  const SRC_LABEL = { template: 'şablon', builtin: 'yerleşik', user: 'kullanıcı', project: 'proje', plugin: 'plugin', 'claude.ai': 'claude.ai' };

  // İmleç mesajın ilk sözcüğündeyse ve mesaj "/" ile başlıyorsa {start, end, q}; değilse null
  function token(text, caret) {
    if (typeof text !== 'string') return null;
    if (!Number.isInteger(caret) || caret < 0 || caret > text.length) caret = text.length;
    const m = /^\/(\S*)$/.exec(text.slice(0, caret));
    if (!m) return null;
    return { start: 0, end: caret + /^\S*/.exec(text.slice(caret))[0].length, q: m[1] };
  }

  // CLI olaylarını oturumun komut bilgisine katar (önceki bilgiyle birleşir); ilgisiz olayda aynı nesne döner
  function fromEvent(prev, ev) {
    if (!ev || ev.type !== 'system') return prev || null;
    const p = prev || {};
    const arr = a => Array.isArray(a) ? a.filter(x => typeof x === 'string') : null;
    if (ev.subtype === 'init') return { ...p, names: arr(ev.slash_commands) || [], skills: arr(ev.skills) || [], terminal: arr(ev.terminal_slash_commands) || [] };
    if (ev.subtype === 'commands_changed' && Array.isArray(ev.commands)) return { ...p, list: ev.commands.filter(c => c && typeof c.name === 'string') };
    return prev || null;
  }

  // Açıklamanın sonundaki "(user)", "(project)", "(claude.ai sync)", "(<plugin>)" kaynak etiketi ayrılır
  function parseSource(desc) {
    const d = typeof desc === 'string' ? desc : '';
    const m = /\s*\(([^()]+)\)\s*$/.exec(d);
    if (!m) return { desc: d.trim(), src: null };
    const t = m[1].trim(), rest = d.slice(0, m.index).trim();
    if (t === 'user') return { desc: rest, src: 'user' };
    if (t === 'project') return { desc: rest, src: 'project' };
    if (/^claude\.ai/.test(t)) return { desc: rest, src: 'claude.ai' };
    if (/^[\w.:@-]+$/.test(t)) return { desc: rest, src: 'plugin', plugin: t };
    return { desc: d.trim(), src: null };
  }

  const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const okName = n => typeof n === 'string' && /^[\w.:-]+$/.test(n) && !n.startsWith('__'); // boşluklu (MCP istemi) ve gizli adlar menüye girmez

  // Tüm öğeler: [{sec, name, desc, src, hint?, aliases?, action?, text?}] — bölüm sırası şablon, komut, skill
  function build(opt) {
    opt = opt || {};
    const cli = opt.cli || null, files = Array.isArray(opt.files) ? opt.files : [];
    const out = [], seen = new Set();
    const add = it => { if (!seen.has(it.name)) { seen.add(it.name); (it.aliases || []).forEach(a => seen.add(a)); out.push(it); } };
    for (const t of opt.templates || []) if (t && t.name && t.text) out.push({ sec: 'tpl', name: t.name, desc: clip(t.text, 90), src: 'template', text: t.text });
    const term = new Set((cli && cli.terminal) || []), skills = new Set((cli && cli.skills) || []);
    // CLI'nin bildirdiği adlar: init (slash_commands) ve commands_changed listesi; ikisi de yoksa null (henüz bilgi yok)
    const cliNames = cli && (cli.names || cli.list) ? new Set([...(cli.names || []), ...(cli.list || []).map(c => c.name)]) : null;
    const fsBy = new Map(files.filter(f => f && okName(f.name)).map(f => [f.name, f]));
    // Yerleşikler: panel işlevi olanlar her zaman; CLI'ye gidenler CLI bunları bildiriyorsa (ya da henüz bilgi yoksa)
    for (const b of BUILTIN) {
      const listed = !cliNames || b.action || [b.name, ...(b.aliases || [])].some(n => cliNames.has(n));
      if (listed) add({ sec: 'cmd', name: b.name, desc: b.desc, src: 'builtin', ...(b.hint ? { hint: b.hint } : {}), ...(b.aliases ? { aliases: b.aliases } : {}), ...(b.action ? { action: b.action } : {}) });
    }
    if (cli && cli.list) {
      for (const c of cli.list) {
        if (!okName(c.name) || term.has(c.name) || BY_NAME.has(c.name)) continue;
        const isSkill = skills.has(c.name) || (c.aliases || []).some(a => skills.has(a));
        if (c.builtin && !isSkill) continue; // denenmemiş yerleşik komut (ör. /doctor, /agents): -p modunda çalışmayabilir
        const ps = c.builtin ? { desc: String(c.description || '').trim(), src: 'builtin' } : parseSource(c.description);
        const f = fsBy.get(c.name);
        add({ sec: isSkill || (f && f.kind === 'skill') ? 'skill' : 'cmd', name: c.name, desc: clip(ps.desc || (f && f.desc), 160), src: ps.src || (f && f.src) || 'user',
          ...(c.argumentHint ? { hint: clip(c.argumentHint, 60) } : {}), ...(Array.isArray(c.aliases) && c.aliases.length ? { aliases: c.aliases.filter(okName) } : {}), ...(ps.plugin ? { plugin: ps.plugin } : {}) });
      }
    } else if (cli && cli.names) {
      // Yalnızca init geldiyse açıklamalar dosya taramasından; skill olmayan ve taramada bulunmayan adlar (yerleşik olabilir) alınmaz
      for (const n of cli.names) {
        if (!okName(n) || term.has(n) || BY_NAME.has(n)) continue;
        const f = fsBy.get(n);
        if (!skills.has(n) && !f) continue;
        add({ sec: skills.has(n) || (f && f.kind === 'skill') ? 'skill' : 'cmd', name: n, desc: clip(f ? f.desc : '', 160), src: f ? f.src : 'builtin', ...(f && f.hint ? { hint: f.hint } : {}) });
      }
    }
    // CLI bilgisi yoksa (ilk turdan önce) ya da CLI'nin listesinde olmayan yeni dosyalar: dosya taraması
    if (!cli || !cli.list) for (const f of fsBy.values()) {
      if (BY_NAME.has(f.name) || (cliNames && !cliNames.has(f.name))) continue;
      add({ sec: f.kind === 'skill' ? 'skill' : 'cmd', name: f.name, desc: clip(f.desc, 160), src: f.src || 'user', ...(f.hint ? { hint: f.hint } : {}), ...(f.plugin ? { plugin: f.plugin } : {}) });
    }
    const order = { tpl: 0, cmd: 1, skill: 2 };
    return out.map((it, k) => ({ it, k })).sort((a, b) => order[a.it.sec] - order[b.it.sec] || a.k - b.k).map(x => x.it);
  }

  // Eşleşme derecesi (küçük olan önde): ad başı, ":"/"-" sonrası parça başı, takma ad başı, adın içinde; yoksa -1
  function rankOf(it, q) {
    if (!q) return 0;
    const n = norm(it.name);
    if (n.startsWith(q)) return 0;
    if (n.split(/[:\-\s]/).some(p => p.startsWith(q))) return 1;
    if ((it.aliases || []).some(a => norm(a).startsWith(q))) return 2;
    if (n.includes(q)) return 3;
    return -1;
  }

  // Yazılana göre süzer; bölüm sırası korunur, bölüm içinde derece sonra özgün sıra
  function filter(items, q) {
    const nq = norm(typeof q === 'string' ? q : '');
    const order = { tpl: 0, cmd: 1, skill: 2 };
    return (items || []).map((it, k) => ({ it, k, r: rankOf(it, nq) })).filter(x => x.r >= 0)
      .sort((a, b) => order[a.it.sec] - order[b.it.sec] || a.r - b.r || a.k - b.k).map(x => x.it);
  }

  // Bölüm başlıklarıyla gruplar → [{sec, title, items:[{it, k}]}] (k: düz listedeki sıra, klavye seçimi için)
  function sections(list) {
    const out = [];
    (list || []).forEach((it, k) => {
      let g = out[out.length - 1];
      if (!g || g.sec !== it.sec) { const t = SECTIONS.find(s => s[0] === it.sec); g = { sec: it.sec, title: t ? t[1] : it.sec, items: [] }; out.push(g); }
      g.items.push({ it, k });
    });
    return out;
  }

  // Seçileni belirtecin yerine koyar → {text, caret, action?}
  function apply(text, tok, item) {
    const rest = text.slice(tok.end);
    if (item.sec === 'tpl') return { text: item.text + rest, caret: item.text.length };
    if (item.action) { const r = rest.replace(/^\s+/, ''); return { text: r, caret: 0, action: item.action }; }
    const ins = '/' + item.name + ' ', r = rest.replace(/^\s+/, '');
    return { text: ins + r, caret: ins.length };
  }

  // Enter ile gönderilen tek satırlık "/clear", "/model …" gibi metin panel işlevine yönlendirilir → {action, arg} ya da null
  function intercept(text) {
    const m = /^\/([\w-]+)(?:[ \t]+([^\n]*))?$/.exec(String(text || '').trim());
    const b = m && BY_NAME.get(m[1]);
    return b && b.action ? { action: b.action, arg: (m[2] || '').trim() } : null;
  }

  const srcLabel = it => (it.src === 'plugin' && it.plugin ? 'plugin · ' + it.plugin : SRC_LABEL[it.src] || it.src || '');
  const move = (sel, n, d) => (n ? ((sel + d) % n + n) % n : 0);

  const api = { token, fromEvent, parseSource, build, filter, sections, apply, intercept, srcLabel, move, norm, BUILTIN };
  globalThis.slash = api;
  if (typeof module === 'object') module.exports = api;
})();
