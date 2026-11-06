// Açılır menünün konumu: tıklanan düğmenin dikdörtgeni + menünün ölçülen boyutu + pencere boyutu → sol/üst.
// Menü düğmeye hizalı açılır (yazma kutusu altta olduğu için varsayılan düğmenin üstü); istenen tarafta yer
// yoksa ve karşı tarafta daha çok yer varsa yön değiştirir; pencere kenarlarından taşmaz (kenara kaydırılır).
// maxHeight: seçilen tarafta kalan yükseklik; menü bundan uzunsa kaydırılabilir yapılıp yeniden ölçülür.
// Tarayıcıda window.menuPos, Node testlerinde module.exports olarak kullanılır.
(function (root) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));

  // a: {left, top, right, bottom} düğme; m: {width, height} menü; v: {width, height} pencere
  // o: side 'above' | 'below' | 'right' | 'left', align 'start' | 'end' | 'center', gap, margin, top (üstte ayrılan şerit),
  //    bounds {left, right}: menü sığıyorsa bu yatay aralıkta (ör. bölme) tutulur, sığmıyorsa yalnız pencereye kısıtlanır
  function place(a, m, v, o = {}) {
    const M = o.margin == null ? 8 : o.margin, G = o.gap == null ? 6 : o.gap;
    const T = Math.max(M, o.top == null ? M : o.top), B = v.height - M, R = v.width - M;
    const align = o.align || 'start';
    let side = o.side || 'above', x, y, maxHeight;
    if (side === 'left' || side === 'right') {
      const spR = R - a.right - G, spL = a.left - G - M;
      if (side === 'right' && m.width > spR && spL > spR) side = 'left';
      else if (side === 'left' && m.width > spL && spR > spL) side = 'right';
      x = side === 'right' ? a.right + G : a.left - G - m.width;
      y = align === 'end' ? a.bottom - m.height : align === 'center' ? (a.top + a.bottom - m.height) / 2 : a.top;
      maxHeight = B - T;
    } else {
      const up = a.top - G - T, down = B - a.bottom - G;
      if (side === 'above' && m.height > up && down > up) side = 'below';
      else if (side === 'below' && m.height > down && up > down) side = 'above';
      maxHeight = Math.max(0, side === 'above' ? up : down);
      const h = Math.min(m.height, maxHeight);
      y = side === 'above' ? a.top - G - h : a.bottom + G;
      x = align === 'end' ? a.right - m.width : align === 'center' ? (a.left + a.right - m.width) / 2 : a.left;
    }
    let lo = M, hi = R;
    if (o.bounds && Math.min(R, o.bounds.right) - Math.max(M, o.bounds.left) >= m.width) { lo = Math.max(M, o.bounds.left); hi = Math.min(R, o.bounds.right); }
    return {
      x: Math.round(Math.max(lo, Math.min(x, hi - m.width))),
      y: Math.round(clamp(y, T, Math.max(T, B - Math.min(m.height, B - T)))),
      side, maxHeight: Math.round(maxHeight),
    };
  }

  const api = { place };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.menuPos = api;
})(typeof window !== 'undefined' ? window : this);
