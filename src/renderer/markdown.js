// Asistan mesajları için küçük, güvenli Markdown → HTML dönüştürücü.
// Önce her şey kaçışlanır; sadece bilinen kalıplar etikete çevrilir (betik/HTML enjekte edilemez).
(function () {
  const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function inline(t) {
    // \u0000 ve \u0001 yer tutucu olarak kullanılır; metnin kendisindekiler silinir (yoksa sahte yer tutucu çöker / kod kopyalar)
    const codes = [], urls = [];
    t = t.replace(/[\u0000\u0001]/g, '').replace(/`([^`\n]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
    // Bağlantılar tek geçişte ve vurgudan önce: adres yer tutucuya alınır, böylece sonraki kalıplar href içine giremez
    t = esc(t)
      // Görsel: ![açıklama](yerel yol) → resim (cpmedia:// ile okunur, tıklayınca büyür). Uzak adres kendiliğinden yüklenmez, bağlantı olur.
      .replace(/!\[([^\]\n]*)\]\((?:&lt;)?([^)\n]+?)(?:&gt;)?\)/g, (all, alt, raw) => {
        let p = unesc(raw).trim();
        if (/^file:\/\//i.test(p)) { p = p.replace(/^file:\/\/\/?/i, ''); if (!/^[A-Za-z]:/.test(p)) p = '/' + p; }
        if (/%[0-9a-f]{2}/i.test(p)) { try { p = decodeURI(p); } catch {} }
        if (/^https?:\/\//i.test(p)) { urls.push(p); return `<a href="\u0001${urls.length - 1}\u0001" target="_blank" rel="noopener">${alt || 'görsel'}</a>`; }
        if (!/^(~|\/|[A-Za-z]:[\\/])/.test(p) || !/\.(png|jpe?g|gif|webp)$/i.test(p)) return `<span class="flink">${alt || esc(p)}</span>`;
        urls.push(`<img class="md-img" src="cpmedia://local/${encodeURIComponent(p)}" data-mdimg="${esc(p)}" alt="${alt}" loading="lazy">`);
        return `\u0001${urls.length - 1}\u0001`;
      })
      // Boşluk içeren mutlak yerel yol bağlantısı ([Görseller](D:\İşler\Gürler Piliç\Görseller))
      .replace(/\[([^\]\n]+)\]\((?:&lt;)?((?:[A-Za-z]:[\\/]|~[\\/]|\/)[^)\n]*?\s[^)\n]*?)(?:&gt;)?\)/g, (_, txt, url) => `<span class="flink" data-fp="${esc(unesc(url).trim())}">${txt}</span>`)
      .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_, txt, url) => {
        if (!/^https?:\/\/[^\u0000]+$/.test(url)) {
          // Yerel dosya / klasör bağlantısı: panel tıklayınca önizler ya da açar (yol yalnızca veri olarak taşınır)
          let fp = unesc(url).replace(/^file:\/\/\/?(?=[A-Za-z]:|\/)/i, '');
          if (/%[0-9a-f]{2}/i.test(fp)) { try { fp = decodeURI(fp); } catch {} }
          const local = !/[\u0000\u0001]/.test(fp) && (!/^[a-z][a-z0-9+.-]*:/i.test(fp) || /^[A-Za-z]:[\\/]/.test(fp));
          return local ? `<span class="flink" data-fp="${esc(fp)}">${txt}</span>` : `<span class="flink">${txt}</span>`;
        }
        urls.push(url); return `<a href="\u0001${urls.length - 1}\u0001" target="_blank" rel="noopener">${txt}</a>`;
      })
      .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
    return t.replace(/\u0001(\d+)\u0001/g, (_, i) => urls[+i]).replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[+i])}</code>`);
  }
  function table(rows) {
    const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    const head = cells(rows[0]);
    const body = rows.slice(2).map(cells);
    return `<div class="tbl"><table><thead><tr>${head.map(h => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${body.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function md(src) {
    const lines = String(src || '').replace(/\r/g, '').split('\n');
    const out = []; let i = 0;
    while (i < lines.length) {
      const l = lines[i];
      if (/^\s*```/.test(l)) {
        const buf = []; i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]);
        i++; out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`); continue;
      }
      if (/^\s*\|.*\|\s*$/.test(l) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        const rows = []; while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++].trim());
        out.push(table(rows)); continue;
      }
      const h = /^(#{1,4})\s+(.*)/.exec(l);
      if (h) { out.push(`<h${h[1].length + 2}>${inline(h[2])}</h${h[1].length + 2}>`); i++; continue; }
      if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
        const ordered = /^\s*\d+\./.test(l); const items = [];
        while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
          let item = lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, '');
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) item += ' ' + lines[i++].trim();
          items.push(`<li>${inline(item)}</li>`);
        }
        out.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`); continue;
      }
      if (/^\s*>\s?/.test(l)) { const q = []; while (i < lines.length && /^\s*>\s?/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, '')); out.push(`<blockquote>${inline(q.join(' '))}</blockquote>`); continue; }
      if (!l.trim()) { i++; continue; }
      const para = []; while (i < lines.length && lines[i].trim() && !/^\s*(```|#{1,4}\s|[-*]\s|\d+\.\s|>|\|)/.test(lines[i])) para.push(lines[i++]);
      if (!para.length) para.push(lines[i++]);
      out.push(`<p>${inline(para.join('\n')).replace(/\n/g, '<br>')}</p>`);
    }
    return out.join('');
  }
  window.md = md;
})();
