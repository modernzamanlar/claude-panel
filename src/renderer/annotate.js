// Ekteki görselin üzerine çizim: saf mantık (araç durumu, geri al/yinele yığını, koordinat ölçekleme, şekil → çizim komutları).
// Şekiller görselin gerçek piksel koordinatlarında tutulur; ekranda küçültülmüş gösterim yalnızca ölçek katsayısıdır.
// Tarayıcıda window.annotate, Node testlerinde module.exports olarak kullanılır.
(function (root) {
  const COLORS = ['#e5484d', '#f5a524', '#f7d13b', '#30a46c', '#3e8ef7', '#8e4ec6', '#ffffff', '#111111'];
  const COLOR_NAMES = ['Kırmızı', 'Turuncu', 'Sarı', 'Yeşil', 'Mavi', 'Mor', 'Beyaz', 'Siyah'];
  const SIZES = [2, 4, 8];            // çizgi kalınlığı (ekran pikseli): ince / orta / kalın
  const SIZE_NAMES = ['İnce', 'Orta', 'Kalın'];
  const FONT_SIZES = [16, 22, 32];     // yazı boyu (ekran pikseli), kalınlık seçimine bağlı
  const TOOLS = ['pen', 'arrow', 'rect', 'ellipse', 'text'];
  const SHAPES = ['rect', 'arrow', 'ellipse']; // kutu düğmesinin açılır listesindeki şekiller
  const FONT = 'Inter, "Segoe UI", system-ui, sans-serif';

  function createState() {
    return { tool: 'pen', shape: 'rect', color: COLORS[0], size: 1, shapes: [], redo: [], draft: null };
  }
  function setTool(st, t) {
    if (!TOOLS.includes(t)) return false;
    st.tool = t; st.draft = null;
    if (SHAPES.includes(t)) st.shape = t;
    return true;
  }
  function setColor(st, c) {
    if (typeof c !== 'string' || !/^#[0-9a-f]{6}$/i.test(c)) return false;
    st.color = c.toLowerCase(); return true;
  }
  function setSize(st, i) {
    if (!Number.isInteger(i) || i < 0 || i >= SIZES.length) return false;
    st.size = i; return true;
  }

  // Görseli (büyütmeden) kutuya sığdırır: ekrandaki CSS boyutu ve ölçek
  function fit(w, h, maxW, maxH) {
    if (!(w > 0 && h > 0 && maxW > 0 && maxH > 0)) return { w: 0, h: 0, scale: 1 };
    const s = Math.min(1, maxW / w, maxH / h);
    return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)), scale: s };
  }
  // Ekran (istemci) koordinatı → görsel pikseli; rect = tuvalin getBoundingClientRect()'i, w/h = görselin gerçek boyutu
  function toImage(cx, cy, rect, w, h) {
    if (!rect || !(rect.width > 0 && rect.height > 0)) return [0, 0];
    const clamp = (v, m) => Math.min(m, Math.max(0, v));
    return [clamp((cx - rect.left) * w / rect.width, w), clamp((cy - rect.top) * h / rect.height, h)];
  }
  // k = bir ekran pikseline düşen görsel pikseli (gerçek genişlik / ekrandaki genişlik)
  const lineWidth = (st, k) => SIZES[st.size] * (k > 0 ? k : 1);
  const fontSize = (st, k) => Math.round(FONT_SIZES[st.size] * (k > 0 ? k : 1));

  function begin(st, pt, k) {
    if (st.tool === 'text') return null;
    const base = { type: st.tool, color: st.color, lw: lineWidth(st, k) };
    st.draft = st.tool === 'pen' ? { ...base, pts: [[pt[0], pt[1]]] } : { ...base, x1: pt[0], y1: pt[1], x2: pt[0], y2: pt[1] };
    return st.draft;
  }
  function move(st, pt) {
    const d = st.draft; if (!d) return false;
    if (d.type === 'pen') {
      const l = d.pts[d.pts.length - 1];
      if (l[0] === pt[0] && l[1] === pt[1]) return false;
      d.pts.push([pt[0], pt[1]]);
    } else { d.x2 = pt[0]; d.y2 = pt[1]; }
    return true;
  }
  function commit(st, shape) { st.shapes.push(shape); st.redo = []; return shape; }
  function end(st) {
    const d = st.draft; st.draft = null;
    if (!d) return null;
    // Kalem tek tıkta nokta bırakır; şekil ise sürüklenmeden oluşmaz
    if (d.type !== 'pen' && Math.abs(d.x2 - d.x1) < 2 && Math.abs(d.y2 - d.y1) < 2) return null;
    return commit(st, d);
  }
  function addText(st, pt, text, k) {
    const t = String(text == null ? '' : text).replace(/\s+$/, '').replace(/^\s+/, '');
    if (!t) return null;
    return commit(st, { type: 'text', color: st.color, x: pt[0], y: pt[1], text: t, fs: fontSize(st, k) });
  }
  function undo(st) { if (!st.shapes.length) return false; st.draft = null; st.redo.push(st.shapes.pop()); return true; }
  function redo(st) { if (!st.redo.length) return false; st.shapes.push(st.redo.pop()); return true; }
  const canUndo = st => st.shapes.length > 0;
  const canRedo = st => st.redo.length > 0;

  // Açık renkli yazıya koyu, koyu renkli yazıya açık kontur (her zeminde okunsun)
  function contrast(c) {
    const n = parseInt(c.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#000000' : '#ffffff';
  }
  // Ok başı üçgeni: [uç, sol, sağ] ve gövdenin bittiği nokta
  function arrowHead(x1, y1, x2, y2, lw) {
    const a = Math.atan2(y2 - y1, x2 - x1), len = Math.hypot(x2 - x1, y2 - y1);
    const hl = Math.min(lw * 4 + 6, len * 0.6), sp = Math.PI / 7;
    return {
      tip: [x2, y2],
      left: [x2 - hl * Math.cos(a - sp), y2 - hl * Math.sin(a - sp)],
      right: [x2 - hl * Math.cos(a + sp), y2 - hl * Math.sin(a + sp)],
      base: [x2 - hl * 0.8 * Math.cos(a), y2 - hl * 0.8 * Math.sin(a)],
    };
  }

  // Şekil → tuval komutları: ['set', özellik, değer] ya da [yöntem, ...argümanlar]
  function commands(s) {
    const ops = [['set', 'strokeStyle', s.color], ['set', 'fillStyle', s.color], ['set', 'lineCap', 'round'], ['set', 'lineJoin', 'round']];
    if (s.type === 'text') {
      ops.push(['set', 'font', `600 ${s.fs}px ${FONT}`], ['set', 'textBaseline', 'top'],
        ['set', 'lineWidth', Math.max(2, s.fs / 7)], ['set', 'strokeStyle', contrast(s.color)]);
      s.text.split('\n').forEach((line, i) => {
        const y = s.y + i * s.fs * 1.25;
        ops.push(['strokeText', line, s.x, y], ['fillText', line, s.x, y]);
      });
      return ops;
    }
    ops.push(['set', 'lineWidth', s.lw], ['beginPath']);
    if (s.type === 'pen') {
      const p = s.pts;
      if (p.length === 1) { ops.push(['arc', p[0][0], p[0][1], s.lw / 2, 0, Math.PI * 2], ['fill']); return ops; }
      ops.push(['moveTo', p[0][0], p[0][1]]);
      // Noktaların orta noktalarından geçen yumuşak eğri
      for (let i = 1; i < p.length - 1; i++) ops.push(['quadraticCurveTo', p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2]);
      ops.push(['lineTo', p[p.length - 1][0], p[p.length - 1][1]], ['stroke']);
      return ops;
    }
    if (s.type === 'rect') {
      ops.push(['rect', Math.min(s.x1, s.x2), Math.min(s.y1, s.y2), Math.abs(s.x2 - s.x1), Math.abs(s.y2 - s.y1)], ['stroke']);
      return ops;
    }
    if (s.type === 'ellipse') {
      ops.push(['ellipse', (s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2, Math.abs(s.x2 - s.x1) / 2, Math.abs(s.y2 - s.y1) / 2, 0, 0, Math.PI * 2], ['stroke']);
      return ops;
    }
    // ok
    const h = arrowHead(s.x1, s.y1, s.x2, s.y2, s.lw);
    ops.push(['moveTo', s.x1, s.y1], ['lineTo', h.base[0], h.base[1]], ['stroke'],
      ['beginPath'], ['moveTo', h.tip[0], h.tip[1]], ['lineTo', h.left[0], h.left[1]], ['lineTo', h.right[0], h.right[1]], ['closePath'], ['fill']);
    return ops;
  }
  function run(ctx, ops) {
    for (const op of ops) { if (op[0] === 'set') ctx[op[1]] = op[2]; else ctx[op[0]](...op.slice(1)); }
  }
  // Görseli ve şekilleri çizer. o.scale: görsel pikseli → tuval pikseli (ekranda cssBoyut*dpr/gerçekBoyut, kaydederken 1)
  function render(ctx, st, o) {
    o = o || {};
    ctx.save();
    ctx.setTransform(o.scale || 1, 0, 0, o.scale || 1, 0, 0);
    if (o.image) ctx.drawImage(o.image, 0, 0, o.w, o.h);
    for (const s of st.shapes) run(ctx, commands(s));
    if (st.draft) run(ctx, commands(st.draft));
    ctx.restore();
  }

  // Klavye kısayolu → eylem (Mac'te ⌘, diğerlerinde Ctrl)
  function shortcut(e, mac) {
    const k = String(e.key || '').toLowerCase();
    if (k === 'escape') return 'cancel';
    if (!(mac ? e.metaKey : e.ctrlKey)) return null;
    if (k === 'z') return e.shiftKey ? 'redo' : 'undo';
    if (k === 'y') return 'redo';
    if (k === 's' || k === 'enter') return 'save';
    return null;
  }
  // Ekte görünen ad: "ekran.jpg" → "ekran-cizim.png" (tekrar çizilince ek büyümez)
  function outName(name) {
    const b = String(name || '').replace(/\.[a-z0-9]{1,5}$/i, '').replace(/-cizim$/, '') || 'gorsel';
    return b + '-cizim.png';
  }

  const api = {
    COLORS, COLOR_NAMES, SIZES, SIZE_NAMES, FONT_SIZES, TOOLS, SHAPES,
    createState, setTool, setColor, setSize, fit, toImage, lineWidth, fontSize,
    begin, move, end, addText, undo, redo, canUndo, canRedo, contrast, arrowHead, commands, run, render, shortcut, outName,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.annotate = api;
})(typeof window !== 'undefined' ? window : globalThis);
