// Mesajdaki medya yollarını mutlak yola çevirip tekilleştirir. Aynı dosya bir mesajda farklı yazımlarla
// anılabilir (göreli "01.mp4", "D:\İşler\x\01.mp4", "D:/işler/x/01.mp4", "~/x/01.mp4", sonda noktalama):
// hepsi tek anahtara iner, böylece her medya mesaj başına bir kez gösterilir.
// Windows yolları büyük/küçük harfe duyarsız ve ayırıcıdan bağımsız, POSIX yolları harfe duyarlı karşılaştırılır.
// Tarayıcıda window.mediaPath, Node testlerinde module.exports olarak kullanılır.
(function (root) {
  const WIN_ABS = /^[A-Za-z]:[\\/]/;
  const UNC = /^\\\\[^\\]/;
  const WEB = /^https?:\/\//i;
  // Yolun sonuna yapışan cümle noktalaması (uzantı her zaman harf/rakamla biter)
  const TAIL = /[.,;:!?)\]}'"”’»>]+$/;

  function clean(c) {
    if (typeof c !== 'string') return '';
    let s = c.trim().replace(/^file:\/\//i, '');
    if (/^\/[A-Za-z]:[\\/]/.test(s)) s = s.slice(1);            // file:///C:/x → C:/x
    return s.replace(TAIL, '');
  }
  const isWin = p => WIN_ABS.test(p) || UNC.test(p) || (!p.startsWith('/') && p.includes('\\'));

  function expandHome(p, home) {
    if (!home || !(p === '~' || /^~[\\/]/.test(p))) return p;
    const sep = isWin(home) ? '\\' : '/';
    const rest = p.slice(2);
    return home.replace(/[\\/]+$/, '') + (rest ? sep + rest : '');
  }

  // Göreli adayı sohbetin çalışma klasörüne göre mutlak yapar; çözülemeyeni (boşluklu göreli metin, klasörsüz) eler.
  function abs(c, cwd, home) {
    const s = clean(c);
    if (!s) return null;
    if (WEB.test(s)) return s;
    if (/^(~|\/|[A-Za-z]:[\\/]|\\\\)/.test(s)) return expandHome(s, home);
    if (/\s/.test(s) || !cwd) return null;                      // boşluklu göreli metin büyük olasılıkla komuttur
    const base = expandHome(cwd, home);
    const win = isWin(base);
    return base.replace(/[\\/]+$/, '') + (win ? '\\' : '/') + s.replace(/^\.[\\/]/, '');
  }

  // Karşılaştırma anahtarı: ayırıcı birleştirilir, "." ve ".." çözülür, Windows'ta büyük harfe çevrilir.
  function key(p, home) {
    if (typeof p !== 'string' || !p) return '';
    if (WEB.test(p)) return p;
    const s = expandHome(p, home).normalize('NFC');
    const win = isWin(s);
    let prefix = '', rest = s;
    if (win) {
      rest = s.replace(/\//g, '\\');
      if (UNC.test(rest)) { prefix = '\\\\'; rest = rest.slice(2); }
    } else if (rest.startsWith('/')) prefix = '/';
    const out = [];
    for (let seg of rest.split(win ? '\\' : '/')) {
      if (win && seg !== '.' && seg !== '..') seg = seg.replace(/[. ]+$/, '');   // Windows sondaki nokta/boşluğu yok sayar
      if (!seg || seg === '.') continue;
      if (seg === '..') {
        const last = out[out.length - 1], drive = last !== undefined && /^[A-Za-z]:$/.test(last);
        if (last !== undefined && last !== '..' && !drive) out.pop();
        else if (!prefix && !drive) out.push(seg);               // göreli yolun başındaki ".." korunur; kökün üstüne çıkılmaz
        continue;
      }
      out.push(seg);
    }
    const k = prefix + out.join(win ? '\\' : '/');
    return win ? k.toUpperCase() : k;
  }

  // Adaylardan sıralı, tekil mutlak yol listesi. skip: gösterilmemesi gereken yollar (ör. metin içinde zaten görünen görseller).
  function uniq(cands, { cwd, home, limit = 6, skip, web = true } = {}) {
    const seen = new Set(), list = [];
    if (skip) for (const p of skip) seen.add(key(abs(p, cwd, home) || clean(p), home));
    for (const c of cands || []) {
      const a = abs(c, cwd, home);
      if (!a || (!web && WEB.test(a))) continue;
      const k = key(a, home);
      if (seen.has(k)) continue;
      seen.add(k); list.push(a);
      if (list.length >= limit) break;
    }
    return list;
  }

  const api = { clean, abs, key, uniq, isWin };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.mediaPath = api;
})(typeof window !== 'undefined' ? window : this);
