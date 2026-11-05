// Terminal çekmecesi için çıktı ekranı: ANSI SGR renkleri → HTML, satır sınırı, \r ile satır başına dönme.
// Tüm metin HTML kaçışlıdır; öznitelikte yalnızca sabit sınıf adları ve sayılardan üretilen #rrggbb renkler bulunur.
// Diğer kaçış dizileri (imleç hareketi, OSC başlık/bağlantı, DCS…) ve kontrol karakterleri atılır.
// Akış parçalara bölünse de çalışır: yarım kalan kaçış dizisi ve sondaki \r bir sonraki parçayı bekler.
// Tarayıcıda window.ansi, Node testlerinde module.exports olarak kullanılır.
(function (root) {
  const ESC_HTML = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const escape = s => String(s).replace(/[&<>"']/g, c => ESC_HTML[c]);
  // Sıra önemli: önce kaçış dizileri, sonra satır sonları, sonra tek kontrol karakteri, en son düz metin
  const TOK = /\x1b\[([0-9;:?<=>]*)([ -/]*)([@-~])|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[P^_X][^\x1b]*\x1b\\|\x1b[ -/]*[0-~]|\r\n|\n|\r|[\x00-\x08\x0b-\x1f\x7f-\x9f]|[^\x00-\x08\x0a-\x1f\x7f-\x9f]+/g;
  const COMPLETE = /^\x1b(?:\[[0-9;:?<=>]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[P^_X][^\x1b]*\x1b\\|[ -/]*[0-~])/;
  const CTRL = /^[\x00-\x08\x0b-\x1f\x7f-\x9f]/;
  const HOLD_MAX = 256;   // bundan uzun "yarım" dizi beklenmez (kapanmayan OSC)
  const LINE_MAX = 20000; // tek satırın HTML uzunluğu sınırı (ör. küçültülmüş JSON)
  const ELL = '<span class="trm-meta">…</span>';

  const hex2 = n => n.toString(16).padStart(2, '0');
  const rgb = (r, g, b) => '#' + hex2(r) + hex2(g) + hex2(b);
  const LV = [0, 95, 135, 175, 215, 255];
  // 256 renk: 0–15 sınıf (temaya uyar), 16–231 küp, 232–255 gri
  function color256(n) {
    if (n < 16) return n;
    if (n < 232) { n -= 16; return rgb(LV[Math.floor(n / 36)], LV[Math.floor(n / 6) % 6], LV[n % 6]); }
    const v = 8 + (n - 232) * 10; return rgb(v, v, v);
  }
  const byte = v => Number.isInteger(v) && v >= 0 && v <= 255;

  const fresh = () => ({ fg: null, bg: null, b: false, d: false, i: false, u: false, rest: '' });
  function reset(st) { st.fg = st.bg = null; st.b = st.d = st.i = st.u = false; }

  // ESC[…m parametreleri
  function sgr(st, params) {
    const p = params.split(/[;:]/).map(x => (x === '' ? 0 : +x));
    for (let k = 0; k < p.length; k++) {
      const c = p[k];
      if (c === 0) reset(st);
      else if (c === 1) st.b = true;
      else if (c === 2) st.d = true;
      else if (c === 3) st.i = true;
      else if (c === 4) st.u = true;
      else if (c === 22) st.b = st.d = false;
      else if (c === 23) st.i = false;
      else if (c === 24) st.u = false;
      else if (c >= 30 && c <= 37) st.fg = c - 30;
      else if (c === 39) st.fg = null;
      else if (c >= 40 && c <= 47) st.bg = c - 40;
      else if (c === 49) st.bg = null;
      else if (c >= 90 && c <= 97) st.fg = c - 90 + 8;
      else if (c >= 100 && c <= 107) st.bg = c - 100 + 8;
      else if (c === 38 || c === 48) {
        const key = c === 38 ? 'fg' : 'bg';
        if (p[k + 1] === 5 && byte(p[k + 2])) { st[key] = color256(p[k + 2]); k += 2; }
        else if (p[k + 1] === 2 && byte(p[k + 2]) && byte(p[k + 3]) && byte(p[k + 4])) { st[key] = rgb(p[k + 2], p[k + 3], p[k + 4]); k += 4; }
        else return; // bozuk renk: kalanı yok say
      }
    }
  }

  // Metni o anki biçimle sarar (stderr: trm-err)
  function span(st, text, err) {
    const cls = [], sty = [];
    if (err) cls.push('trm-err');
    if (st.b) cls.push('ax-b');
    if (st.d) cls.push('ax-d');
    if (st.i) cls.push('ax-i');
    if (st.u) cls.push('ax-u');
    if (typeof st.fg === 'number') cls.push('ax-f' + st.fg); else if (st.fg) sty.push('color:' + st.fg);
    if (typeof st.bg === 'number') cls.push('ax-g' + st.bg); else if (st.bg) sty.push('background:' + st.bg);
    const t = escape(text);
    if (!cls.length && !sty.length) return t;
    return '<span' + (cls.length ? ' class="' + cls.join(' ') + '"' : '') + (sty.length ? ' style="' + sty.join(';') + '"' : '') + '>' + t + '</span>';
  }

  class Screen {
    constructor(max) {
      this.max = max || 5000;
      this.st = { out: fresh(), err: fresh() };
      this.clear();
    }
    clear() { this.lines = []; this.open = false; this.dirty = Infinity; this.dropped = 0; }
    // Yeni komut: akışların biçim durumu ve bekleyen yarım diziler sıfırlanır
    resetStreams() { this.st = { out: fresh(), err: fresh() }; }
    mark(i) { if (i < this.dirty) this.dirty = i; }
    cur() { if (!this.open) { this.lines.push(''); this.open = true; this.mark(this.lines.length - 1); } return this.lines.length - 1; }
    add(html) {
      const i = this.cur(), l = this.lines[i];
      if (l.length >= LINE_MAX) { if (!l.endsWith(ELL)) { this.lines[i] = l + ELL; this.mark(i); } return; }
      this.lines[i] = l + html; this.mark(i);
    }
    nl() { this.cur(); this.open = false; }
    cr() { if (this.open) { const i = this.lines.length - 1; this.lines[i] = ''; this.mark(i); } }
    trim() {
      const n = this.lines.length - this.max;
      if (n <= 0) return;
      this.lines.splice(0, n); this.dropped += n; this.dirty = Math.max(0, this.dirty - n);
    }
    /** Akıştan gelen ham metni ekler. stream: 'out' | 'err' */
    write(text, stream) {
      const err = stream === 'err', st = this.st[err ? 'err' : 'out'];
      text = st.rest + String(text); st.rest = '';
      const k = text.lastIndexOf('\x1b');
      if (k >= 0 && text.length - k <= HOLD_MAX && !COMPLETE.test(text.slice(k))) { st.rest = text.slice(k); text = text.slice(0, k); }
      else if (text.endsWith('\r')) { st.rest = '\r'; text = text.slice(0, -1); }
      TOK.lastIndex = 0;
      let m;
      while ((m = TOK.exec(text))) {
        const t = m[0];
        if (m[3] !== undefined) { if (m[3] === 'm' && !m[2] && !/[?<=>]/.test(m[1])) sgr(st, m[1]); }
        else if (t === '\n' || t === '\r\n') this.nl();
        else if (t === '\r') this.cr();
        else if (!CTRL.test(t)) this.add(span(st, t, err));
      }
      this.trim();
    }
    /** Panelin kendi satırı (komut, çıkış kodu…): açık satırı kapatır, kaçışlı metni sınıfla ekler */
    meta(text, cls) {
      this.open = false;
      this.lines.push('<span class="' + escape(cls) + '">' + escape(text) + '</span>');
      this.mark(this.lines.length - 1);
      this.trim();
    }
    /**
     * Son take()'ten beri değişenler: önce baştan `drop` satır silinir, sonra `from` ve sonrası atılıp `lines` eklenir.
     * Böylece arayüz yalnızca değişen satırları yeniden çizer.
     */
    take() {
      const from = Math.min(this.dirty, this.lines.length);
      const r = { drop: this.dropped, from, lines: this.lines.slice(from) };
      this.dirty = Infinity; this.dropped = 0;
      return r;
    }
  }

  const api = { Screen, escape, color256 };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ansi = api;
})(typeof window !== 'undefined' ? window : this);
