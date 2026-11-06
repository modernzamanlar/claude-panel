// Gerçek bağlam kullanımı: `claude -p /context --resume <id> --no-session-persistence --output-format json`
// çıktısını (result alanındaki Markdown rapor) ayrıştırır; tur sonundaki result.modelUsage'dan bağlam penceresini okur.
// Ana süreçte (runner.js) ve testlerde module.exports, tarayıcıda window.ctxUsage olarak kullanılır.
(function (root) {
  // "31.9k", "200k", "1m", "1.2M", "853", "~360", "< 20" → token sayısı (biçim tanınmazsa null)
  function tokens(v) {
    const m = /([\d.,]+)\s*([km])?/i.exec(String(v || ''));
    if (!m) return null;
    const n = parseFloat(m[1].replace(/,/g, ''));
    if (!isFinite(n)) return null;
    const mul = { k: 1e3, m: 1e6 }[String(m[2] || '').toLowerCase()] || 1;
    return Math.round(n * mul);
  }

  // Markdown'daki "### Başlık" bölümünün tablo satırları (başlık ve ayırıcı satırı atlanır)
  function rows(md, title) {
    const i = md.indexOf('### ' + title);
    if (i < 0) return [];
    const out = [];
    for (const line of md.slice(i).split('\n').slice(1)) {
      if (line.startsWith('### ')) break;
      if (!line.startsWith('|') || /^\|\s*-/.test(line)) continue;
      out.push(line.split('|').slice(1, -1).map(c => c.trim()));
    }
    return out.slice(1);
  }

  /** /context çıktısı (JSON ya da doğrudan Markdown) → {model, total, window, free, buffer, categories, memory} | null */
  function parse(out) {
    let md = String(out || ''), obj = null;
    if (md.trim().startsWith('{')) {
      try { obj = JSON.parse(md); } catch { return null; }
      if (!obj || obj.is_error || typeof obj.result !== 'string') return null;
      md = obj.result;
    }
    const tm = /\*\*Tokens:\*\*\s*([\d.,]+\s*[km]?)\s*\/\s*([\d.,]+\s*[km]?)/i.exec(md);
    if (!tm) return null;
    const mm = /\*\*Model:\*\*\s*(\S+)/.exec(md);
    const r = { model: mm ? mm[1] : null, total: tokens(tm[1]), window: tokens(tm[2]) || windowOf(obj && obj.modelUsage), free: null, buffer: 0, categories: [], memory: [] };
    for (const [name, v] of rows(md, 'Estimated usage by category')) {
      const t = tokens(v) || 0;
      if (name === 'Free space') r.free = t;
      else if (/compact buffer$/i.test(name)) r.buffer = t;
      else r.categories.push({ name, tokens: t, deferred: /\(deferred\)/i.test(name) });
    }
    if (!r.categories.length) return null;
    for (const [type, p, v] of rows(md, 'Memory Files')) r.memory.push({ type, path: p, tokens: tokens(v) || 0 });
    if (r.free === null && r.window) r.free = Math.max(0, r.window - r.total - r.buffer);
    return r;
  }

  /** result.modelUsage → en büyük contextWindow (alt ajanlar ve yan sorgular küçük modelle çalışabilir) | null */
  function windowOf(modelUsage) {
    let w = 0;
    for (const u of Object.values(modelUsage && typeof modelUsage === 'object' ? modelUsage : {})) if (u && u.contextWindow > w) w = u.contextWindow;
    return w || null;
  }

  // Kategori adlarının Türkçesi (bilinmeyen ad olduğu gibi gösterilir)
  const TR = {
    'System prompt': 'Sistem istemi', 'System tools': 'Sistem araçları', 'MCP tools': 'MCP araçları',
    'MCP server instructions': 'MCP talimatları', 'Custom agents': 'Özel ajanlar', 'Memory files': 'Hafıza dosyaları',
    'Skills': "Skill'ler", 'Messages': 'Mesajlar', 'Free space': 'Boş alan', 'Autocompact buffer': 'Sıkıştırma payı',
    'MCP tools (deferred)': 'Ertelenmiş MCP araçları', 'System tools (deferred)': 'Ertelenmiş sistem araçları',
  };
  const label = name => TR[name] || name;

  const api = { parse, tokens, windowOf, label };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ctxUsage = api;
})(typeof window !== 'undefined' ? window : this);
