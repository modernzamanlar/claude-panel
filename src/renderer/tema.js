// Tema seçimi (saf mantık): tarayıcıda window.Tema, Node'da module.exports.
// Kayıt WS.prefs içinde iki alanla tutulur:
//   theme   : 'dark' | 'light' | 'system' | yok  — açık/koyu (üst çubuktaki düğme yalnız bunu değiştirir)
//   palette : 'gece' | 'claude' | yok            — koyu temanın renk takımı
// Görünüm (html[data-look]) bunlardan çıkar: 'gece' (Antigravity benzeri, varsayılan koyu), 'claude' (eski Claude Code
// tonlu koyu) ya da 'light'.
// Göç: eski sürümler yalnız theme ('dark'/'light') ya da hiçbir şey yazmıştı; palette hiç yoktu.
//   - kayıt yok      → gece (yeni varsayılan; eskiden sistem temasını izliyordu, artık "Sisteme uy" ile seçilir)
//   - theme 'dark'   → gece (eski "koyu" seçimi bir renk takımı değil açık/koyu tercihiydi; koyu kalır, yeni takıma geçer)
//   - theme 'light'  → açık (değişmez)
// Eski koyu görünüm Ayarlar → Tema → "Claude koyu" ile seçilir (palette 'claude'). Kayıt dosyası yeniden yazılmaz.
(function (root) {
  const PALETTES = ['gece', 'claude'];
  const CHOICES = [
    { id: 'gece', label: 'Gece', note: 'varsayılan' },
    { id: 'claude', label: 'Claude koyu', note: 'eski tema' },
    { id: 'light', label: 'Açık' },
    { id: 'system', label: 'Sisteme uy' },
  ];
  const palette = prefs => (prefs && PALETTES.includes(prefs.palette) ? prefs.palette : 'gece');

  /** prefs + sistem koyu mu → { attr: data-theme değeri ('dark'|'light'|null = sistemi izle), look, palette } */
  function resolve(prefs, systemDark) {
    const pal = palette(prefs), t = prefs && prefs.theme;
    if (t === 'light') return { attr: 'light', look: 'light', palette: pal };
    if (t === 'system') return { attr: null, look: systemDark ? pal : 'light', palette: pal };
    return { attr: 'dark', look: pal, palette: pal }; // 'dark', kayıt yok ya da tanınmayan değer
  }

  /** Ayarlar menüsünde işaretli seçenek */
  function current(prefs) {
    const t = prefs && prefs.theme;
    return t === 'light' || t === 'system' ? t : palette(prefs);
  }

  /** Seçeneği uygula: yeni prefs nesnesi döner (diğer alanlar korunur). Tanınmayan seçim prefs'i değiştirmez. */
  function choose(prefs, id) {
    const p = { ...(prefs || {}) };
    if (PALETTES.includes(id)) return { ...p, theme: 'dark', palette: id };
    if (id === 'light' || id === 'system') return { ...p, theme: id };
    return p;
  }

  /** Üst çubuktaki tema düğmesi: koyu ↔ açık; renk takımı korunur */
  const toggle = (prefs, isDark) => ({ ...(prefs || {}), theme: isDark ? 'light' : 'dark' });

  const api = { CHOICES, PALETTES, palette, resolve, current, choose, toggle };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Tema = api;
})(typeof window !== 'undefined' ? window : this);
