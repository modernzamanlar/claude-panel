// Oturum kaydından (.jsonl) kullanım özeti: token toplamları, son bağlam doluluğu, Claude Code'un kendi maliyet kaydı
// (cost-state) ve sıkıştırmalar (compact_boundary). sessions.js feedLine her satırı (ayrıştırılmış nesne) buraya verir.
//
// Gerçek CLI'de (2.1.318) doğrulananlar:
// - Akışta bir asistan mesajı birden çok satıra bölünür (her içerik bloğu ayrı satır), hepsi aynı message.id ve aynı usage'ı
//   taşır: toplam için mesaj kimliğine göre tekilleştirilir.
// - "cost-state" satırı her CLI süreci kapanırken yazılır; totalCostUSD oturumun birikimli maliyetidir (devam ettirilen
//   oturumda sayaç bu kayıttan geri yüklenir; result.total_cost_usd da aynı birikimli değeri verir). Son kayıt geçerlidir.
// - compact_boundary: kayıtta compactMetadata {trigger, preTokens, postTokens}, akışta compact_metadata {trigger, pre_tokens, post_tokens}.
const num = v => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : 0);
const ctxOf = u => num(u.input_tokens) + num(u.cache_read_input_tokens) + num(u.cache_creation_input_tokens) + num(u.output_tokens);

function newTally() {
  return { ids: new Set(), input: 0, output: 0, cacheRead: 0, cacheCreate: 0, messages: 0, ctx: null, cost: null, costUnknown: false, compacts: [] };
}

// Sıkıştırma olayı (kayıt ya da akış biçimi) → {trigger:'auto'|'manual', pre, post, ts}: arayüzle aynı kod
const { compactOf } = require('../renderer/ctxusage');

/** Bir kayıt satırını işler; sıkıştırma satırıysa sıkıştırma bilgisini döndürür (sohbette satır olarak gösterilir). */
function feed(t, e) {
  if (!e || typeof e !== 'object') return null;
  if (e.type === 'assistant' && e.message && e.message.usage && typeof e.message.usage === 'object' && e.message.model !== '<synthetic>') {
    const u = e.message.usage, id = e.message.id;
    t.ctx = ctxOf(u);
    if (id && t.ids.has(id)) return null;
    if (id) t.ids.add(id);
    t.input += num(u.input_tokens); t.output += num(u.output_tokens);
    t.cacheRead += num(u.cache_read_input_tokens); t.cacheCreate += num(u.cache_creation_input_tokens);
    t.messages++;
    return null;
  }
  if (e.type === 'system' && e.subtype === 'compact_boundary') {
    const c = compactOf(e);
    t.compacts.push(c);
    if (c.post !== null) t.ctx = c.post; // sonraki yanıta kadar bağlam sıkıştırma sonrası boyuttadır
    return c;
  }
  if (e.type === 'cost-state' && typeof e.totalCostUSD === 'number' && isFinite(e.totalCostUSD)) {
    t.cost = e.totalCostUSD; t.costUnknown = !!e.hasUnknownModelCost;
  }
  return null;
}

/** Arayüze giden özet (Set gibi kopyalanamayan alanlar olmadan) */
function summary(t) {
  return {
    tokens: { input: t.input, output: t.output, cacheRead: t.cacheRead, cacheCreate: t.cacheCreate, total: t.input + t.output + t.cacheRead + t.cacheCreate },
    messages: t.messages, ctx: t.ctx, cost: t.cost, costUnknown: t.costUnknown,
    compacts: t.compacts.length, lastCompact: t.compacts.length ? t.compacts[t.compacts.length - 1] : null,
  };
}

module.exports = { newTally, feed, summary, compactOf, ctxOf };
