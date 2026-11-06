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

  // ---- Bilgi paneli görünümü (uydurma sayı yok: bilinmeyen değer null döner, arayüz "bilinmiyor" yazar) ----
  const fin = v => typeof v === 'number' && isFinite(v) && v >= 0;
  /** Token sayısı kısa biçim: 853, 1.2k, 61.5k, 1.2M */
  function fmtTok(n) {
    if (!fin(n)) return '—';
    if (n < 1000) return String(Math.round(n));
    if (n < 1e6) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
    return (n / 1e6).toFixed(n < 1e7 ? 2 : 1).replace(/\.?0+$/, '') + 'M';
  }
  /** Dolar: 1 sentin altı 4 basamak, üstü 2 basamak */
  const fmtUsd = v => (!fin(v) ? '—' : '$' + (v > 0 && v < 0.01 ? v.toFixed(4) : v.toFixed(2)));

  /**
   * Bağlam görünümü. o: {used: son yanıttaki bağlam (token) | null, window: pencere | null, report: parse() sonucu | null,
   * stale: rapor son turdan önce mi}. Rapor güncelse sayılar rapordan, değilse kullanılan son yanıttan gelir;
   * kategoriler yalnızca rapordan (yoksa parts null).
   */
  function view(o) {
    const r = o && o.report, fresh = !!r && !o.stale;
    const used = fresh ? r.total : fin(o && o.used) && o.used > 0 ? o.used : null;
    const window = (r && r.window) || (fin(o && o.window) && o.window > 0 ? o.window : null);
    const out = { used, window, pct: used !== null && window ? Math.round(used / window * 100) : null, src: fresh ? 'report' : used !== null ? 'usage' : null,
      parts: null, deferred: [], free: null, buffer: 0, memory: r ? r.memory : null };
    if (r) {
      out.parts = r.categories.filter(c => !c.deferred).map(c => ({ name: c.name, label: label(c.name), tokens: c.tokens }));
      if (r.buffer) out.parts.push({ name: 'Autocompact buffer', label: label('Autocompact buffer'), tokens: r.buffer });
      out.deferred = r.categories.filter(c => c.deferred).map(c => ({ name: c.name, label: label(c.name), tokens: c.tokens }));
      out.free = r.free; out.buffer = r.buffer;
    } else if (used !== null && window) out.free = Math.max(0, window - used);
    return out;
  }

  /** Canlı turda asistan mesajlarının usage'ı (aynı message.id bir kez sayılır). acc: {ids:[], input, output, cacheRead, cacheCreate} */
  function liveAdd(acc, message) {
    const a = acc || { ids: [], input: 0, output: 0, cacheRead: 0, cacheCreate: 0 };
    const u = message && message.usage;
    if (!u || typeof u !== 'object' || message.model === '<synthetic>') return a;
    if (message.id) { if (a.ids.includes(message.id)) return a; a.ids.push(message.id); }
    const n = v => (fin(v) ? v : 0);
    a.input += n(u.input_tokens); a.output += n(u.output_tokens); a.cacheRead += n(u.cache_read_input_tokens); a.cacheCreate += n(u.cache_creation_input_tokens);
    return a;
  }
  /** Sohbet token toplamı: kayıttaki (stats.tokens) + kayda henüz yansımamış canlı turlar | null (hiç bilgi yoksa) */
  function tokenTotals(stats, live) {
    const t = stats && stats.tokens, keys = ['input', 'output', 'cacheRead', 'cacheCreate'];
    if (!t && !live) return null;
    const o = {};
    for (const k of keys) o[k] = (t && fin(t[k]) ? t[k] : 0) + (live && fin(live[k]) ? live[k] : 0);
    o.total = keys.reduce((s, k) => s + o[k], 0);
    return o;
  }
  /**
   * Oturum maliyeti. Kayıttaki cost-state ve panelin aldığı son result.total_cost_usd aynı birikimli sayaçtır: büyük olan
   * daha yenidir. src: 'record' (Claude Code'un oturum kaydı: panel dışı turlar dahil) | 'panel' (yalnızca panelin
   * gördüğü sayaç; kayıtta maliyet yoksa panel dışı turlar dahil değil) | null (bilinmiyor).
   */
  function costView(stats, panel) {
    const rec = stats && fin(stats.cost) ? stats.cost : null, pan = panel && fin(panel.usd) ? panel.usd : null;
    if (rec === null && pan === null) return { usd: null, src: null, unknownModel: false };
    const src = pan !== null && (rec === null || pan > rec) ? 'panel' : 'record';
    return { usd: src === 'panel' ? pan : rec, src, unknownModel: !!(stats && stats.costUnknown), withOutside: rec !== null };
  }
  /** Akıştaki compact_boundary olayı (compact_metadata; kayıt biçimi compactMetadata da olur) → {trigger, pre, post, ts} */
  function compactOf(ev, now = Date.now()) {
    const m = (ev && (ev.compact_metadata || ev.compactMetadata)) || {}, n = v => (fin(v) ? v : null);
    return { trigger: m.trigger === 'auto' ? 'auto' : 'manual', pre: n(m.pre_tokens ?? m.preTokens), post: n(m.post_tokens ?? m.postTokens), ts: (ev && ev.timestamp) || new Date(now).toISOString() };
  }
  /** Sıkıştırma satırı metni */
  function compactText(c) {
    const how = c && c.trigger === 'auto' ? 'otomatik' : 'elle';
    const size = c && fin(c.pre) && fin(c.post) ? ` · ${fmtTok(c.pre)} → ${fmtTok(c.post)} token` : c && fin(c.pre) ? ` · önce ${fmtTok(c.pre)} token` : '';
    return `Sohbet sıkıştırıldı (${how})${size}`;
  }

  const api = { parse, tokens, windowOf, label, fmtTok, fmtUsd, view, liveAdd, tokenTotals, costView, compactOf, compactText };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ctxUsage = api;
})(typeof window !== 'undefined' ? window : this);
