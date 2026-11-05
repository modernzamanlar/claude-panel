// Yazma kutusunda Tab ile otomatik tamamlama (soluk "hayalet" öneri).
// Sıra: "/ad" → şablon; yazılanla başlayan şablon ya da daha önce yazılmış mesaj; son kelimenin tamamı (sohbette geçen kelimeler).
// Tarayıcıda window.complete, Node testlerinde module.exports olarak kullanılır.
(function (root) {
  // Türkçe harfleri sadeleştirir; uzunluk korunur (öneri, yazılanın uzunluğundan kesilir)
  const MAP = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };
  const norm = s => String(s).toLocaleLowerCase('tr').replace(/[çğıöşüâîû]/g, c => MAP[c]);

  function suggest(text, src) {
    src = src || {};
    if (typeof text !== 'string' || !text.trim()) return null;
    const templates = src.templates || [];
    const sl = /^\/([^\s/]*)$/.exec(text);
    if (sl) {
      const q = norm(sl[1]);
      const t = templates.find(x => x && x.name && x.text && norm(x.name).startsWith(q));
      return t ? { kind: 'template', ghost: t.name.slice(sl[1].length), value: t.text, name: t.name } : null;
    }
    if (/\s$/.test(text)) return null;
    const nt = norm(text);
    if (text.length >= 3) {
      for (const p of src.phrases || []) {
        if (typeof p === 'string' && p.length > text.length && norm(p).startsWith(nt)) return { kind: 'phrase', ghost: p.slice(text.length), value: text + p.slice(text.length) };
      }
    }
    const m = /([\p{L}\p{N}][\p{L}\p{N}_.\-]{2,})$/u.exec(text);
    if (m) {
      const q = norm(m[1]);
      for (const w of src.words || []) {
        if (w.length > q.length && norm(w).startsWith(q)) return { kind: 'word', ghost: w.slice(m[1].length), value: text + w.slice(m[1].length) };
      }
    }
    return null;
  }

  // Metinlerdeki 5+ harfli kelimeler, en sık geçenden en aza
  function vocab(texts, max = 3000) {
    const n = new Map();
    for (const t of texts || []) {
      if (typeof t !== 'string') continue;
      for (const w of t.match(/[\p{L}\p{N}][\p{L}\p{N}_.\-]{4,}/gu) || []) { const k = w.replace(/[.\-]+$/, ''); if (k.length >= 5) n.set(k, (n.get(k) || 0) + 1); }
    }
    return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length).slice(0, max).map(x => x[0]);
  }

  const api = { suggest, vocab, norm };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.complete = api;
})(typeof window !== 'undefined' ? window : this);
