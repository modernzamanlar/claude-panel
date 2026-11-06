// renderer/annotate.js: görsel üzerine çizim — araç durumu, geri al/yinele, ölçekleme, şekil → tuval komutları.
const { test } = require('node:test');
const assert = require('node:assert');
const MOD = require.resolve('../src/renderer/annotate.js');
const A = require(MOD);

// Tuval bağlamı taklidi: atamaları ve çağrıları sırayla kaydeder
function fakeCtx() {
  const log = [];
  return new Proxy({ log }, {
    get(t, k) { if (k === 'log') return log; return (...a) => log.push([k, ...a]); },
    set(t, k, v) { log.push(['set', k, v]); return true; },
  });
}

test('createState: varsayılanlar (kalem, kırmızı, orta kalınlık, boş yığınlar)', () => {
  const st = A.createState();
  assert.deepStrictEqual(st, { tool: 'pen', shape: 'rect', color: '#e5484d', size: 1, shapes: [], redo: [], draft: null });
  assert.ok(A.COLORS.length >= 6 && A.COLORS.length === A.COLOR_NAMES.length);
  assert.ok(A.SIZES.length >= 3 && A.SIZES.length === A.SIZE_NAMES.length && A.FONT_SIZES.length === A.SIZES.length);
  assert.strictEqual(A.COLORS[0], '#e5484d', 'kırmızı varsayılan');
});

test('setTool / setColor / setSize: geçerli değerler, geçersizler reddedilir', () => {
  const st = A.createState();
  assert.strictEqual(A.setTool(st, 'arrow'), true); assert.strictEqual(st.tool, 'arrow'); assert.strictEqual(st.shape, 'arrow', 'şekil seçimi hatırlanır');
  st.draft = { x: 1 };
  assert.strictEqual(A.setTool(st, 'text'), true); assert.strictEqual(st.shape, 'arrow', 'yazı şekil seçimini değiştirmez'); assert.strictEqual(st.draft, null);
  assert.strictEqual(A.setTool(st, 'silgi'), false); assert.strictEqual(st.tool, 'text');
  assert.strictEqual(A.setColor(st, '#3E8EF7'), true); assert.strictEqual(st.color, '#3e8ef7');
  for (const c of ['red', '#fff', 5, null, '#12345g']) assert.strictEqual(A.setColor(st, c), false);
  assert.strictEqual(st.color, '#3e8ef7');
  assert.strictEqual(A.setSize(st, 2), true); assert.strictEqual(st.size, 2);
  for (const i of [-1, 3, 1.5, '1']) assert.strictEqual(A.setSize(st, i), false);
  assert.strictEqual(st.size, 2);
});

test('fit: büyütmeden sığdırır; geçersiz boyut', () => {
  assert.deepStrictEqual(A.fit(4000, 2000, 1000, 1000), { w: 1000, h: 500, scale: 0.25 });
  assert.deepStrictEqual(A.fit(400, 300, 1000, 1000), { w: 400, h: 300, scale: 1 }, 'küçük görsel büyütülmez');
  assert.deepStrictEqual(A.fit(1000, 4000, 900, 800), { w: 200, h: 800, scale: 0.2 });
  assert.deepStrictEqual(A.fit(10000, 1, 100, 100), { w: 100, h: 1, scale: 0.01 }, 'en az 1 piksel');
  for (const a of [[0, 10, 10, 10], [10, 10, 0, 10], [NaN, 1, 1, 1], [10, -1, 10, 10]]) assert.deepStrictEqual(A.fit(...a), { w: 0, h: 0, scale: 1 });
});

test('toImage: ekran koordinatı gerçek piksele ölçeklenir ve sınırlanır', () => {
  const rect = { left: 100, top: 50, width: 500, height: 250 };
  assert.deepStrictEqual(A.toImage(100, 50, rect, 2000, 1000), [0, 0]);
  assert.deepStrictEqual(A.toImage(350, 175, rect, 2000, 1000), [1000, 500]);
  assert.deepStrictEqual(A.toImage(600, 300, rect, 2000, 1000), [2000, 1000]);
  assert.deepStrictEqual(A.toImage(0, 900, rect, 2000, 1000), [0, 1000], 'dışarı taşan nokta kenara sınırlanır');
  assert.deepStrictEqual(A.toImage(5, 5, { left: 0, top: 0, width: 0, height: 10 }, 10, 10), [0, 0]);
  assert.deepStrictEqual(A.toImage(5, 5, null, 10, 10), [0, 0]);
});

test('lineWidth / fontSize: ekran pikselinden görsel pikseline', () => {
  const st = A.createState();
  assert.strictEqual(A.lineWidth(st, 4), 16);
  assert.strictEqual(A.lineWidth(st, 0), 4, 'geçersiz katsayı → 1');
  assert.strictEqual(A.fontSize(st, 2), 44);
  assert.strictEqual(A.fontSize(st, undefined), 22);
});

test('kalem: begin/move/end, aynı nokta tekrar eklenmez, tek tık nokta bırakır', () => {
  const st = A.createState();
  const d = A.begin(st, [10, 10], 2);
  assert.deepStrictEqual(d, { type: 'pen', color: '#e5484d', lw: 8, pts: [[10, 10]] });
  assert.strictEqual(A.move(st, [10, 10]), false);
  assert.strictEqual(A.move(st, [20, 15]), true);
  const s = A.end(st);
  assert.deepStrictEqual(s.pts, [[10, 10], [20, 15]]);
  assert.strictEqual(st.draft, null); assert.strictEqual(st.shapes.length, 1);
  A.begin(st, [5, 5], 1); assert.ok(A.end(st), 'tek tık');
  assert.strictEqual(st.shapes.length, 2);
  assert.strictEqual(A.move(st, [1, 1]), false, 'taslak yokken hareket yok sayılır');
  assert.strictEqual(A.end(st), null, 'taslak yokken bitiş');
});

test('şekiller: sürüklenmeden oluşmaz; ok/kutu/elips koordinatları', () => {
  const st = A.createState();
  A.setTool(st, 'rect');
  A.begin(st, [10, 10], 1); A.move(st, [11, 11]);
  assert.strictEqual(A.end(st), null, '2 pikselden kısa sürükleme şekil değildir');
  assert.strictEqual(st.shapes.length, 0);
  A.begin(st, [10, 10], 1); A.move(st, [50, 12]);
  assert.deepStrictEqual(A.end(st), { type: 'rect', color: '#e5484d', lw: 4, x1: 10, y1: 10, x2: 50, y2: 12 });
  A.setTool(st, 'arrow'); A.begin(st, [0, 0], 1); A.move(st, [0, 40]); assert.strictEqual(A.end(st).type, 'arrow');
  A.setTool(st, 'text'); assert.strictEqual(A.begin(st, [0, 0], 1), null, 'yazı aracı sürüklemeyle çizmez');
  assert.strictEqual(st.draft, null);
});

test('addText: Türkçe metin, boşluklar kırpılır, boş metin eklenmez', () => {
  const st = A.createState(); A.setSize(st, 2); A.setColor(st, '#ffffff');
  const s = A.addText(st, [30, 40], '  Şu düğmeyi ığdır çöz  ', 2);
  assert.deepStrictEqual(s, { type: 'text', color: '#ffffff', x: 30, y: 40, text: 'Şu düğmeyi ığdır çöz', fs: 64 });
  for (const t of ['', '   ', null, undefined]) assert.strictEqual(A.addText(st, [0, 0], t, 1), null);
  assert.strictEqual(A.addText(st, [0, 0], 42, 1).text, '42');
  assert.strictEqual(st.shapes.length, 2);
});

test('geri al / yinele yığını; yeni çizim yinelemeyi temizler', () => {
  const st = A.createState();
  assert.strictEqual(A.undo(st), false); assert.strictEqual(A.redo(st), false);
  assert.strictEqual(A.canUndo(st), false); assert.strictEqual(A.canRedo(st), false);
  A.addText(st, [0, 0], 'a', 1); A.addText(st, [0, 0], 'b', 1);
  st.draft = { type: 'pen' };
  assert.strictEqual(A.undo(st), true); assert.strictEqual(st.draft, null);
  assert.deepStrictEqual(st.shapes.map(s => s.text), ['a']); assert.strictEqual(A.canRedo(st), true);
  assert.strictEqual(A.redo(st), true); assert.deepStrictEqual(st.shapes.map(s => s.text), ['a', 'b']);
  A.undo(st); A.undo(st); assert.strictEqual(A.canUndo(st), false);
  A.redo(st); A.addText(st, [0, 0], 'c', 1);
  assert.deepStrictEqual(st.shapes.map(s => s.text), ['a', 'c']); assert.strictEqual(A.canRedo(st), false, 'yeni çizim yinelemeyi siler');
});

test('contrast: açık renge koyu, koyu renge açık kontur', () => {
  assert.strictEqual(A.contrast('#ffffff'), '#000000');
  assert.strictEqual(A.contrast('#f7d13b'), '#000000');
  assert.strictEqual(A.contrast('#e5484d'), '#ffffff');
  assert.strictEqual(A.contrast('#111111'), '#ffffff');
});

test('arrowHead: uç noktada, kısa okta baş boyu sınırlı', () => {
  const h = A.arrowHead(0, 0, 100, 0, 4);
  assert.deepStrictEqual(h.tip, [100, 0]);
  assert.ok(Math.abs(h.base[0] - (100 - 22 * 0.8)) < 1e-9 && Math.abs(h.base[1]) < 1e-9);
  assert.ok(h.left[0] < 100 && h.right[0] < 100 && Math.sign(h.left[1]) === -Math.sign(h.right[1]));
  const k = A.arrowHead(0, 0, 10, 0, 4);
  assert.ok(Math.abs(k.tip[0] - k.base[0] - 6 * 0.8) < 1e-9, 'baş, ok boyunun %60ını geçmez');
});

test('commands: kalem (nokta ve eğri)', () => {
  const dot = A.commands({ type: 'pen', color: '#111111', lw: 6, pts: [[5, 6]] });
  assert.deepStrictEqual(dot.slice(0, 4), [['set', 'strokeStyle', '#111111'], ['set', 'fillStyle', '#111111'], ['set', 'lineCap', 'round'], ['set', 'lineJoin', 'round']]);
  assert.deepStrictEqual(dot.slice(4), [['set', 'lineWidth', 6], ['beginPath'], ['arc', 5, 6, 3, 0, Math.PI * 2], ['fill']]);
  const two = A.commands({ type: 'pen', color: '#111111', lw: 2, pts: [[0, 0], [10, 10]] });
  assert.deepStrictEqual(two.slice(5), [['beginPath'], ['moveTo', 0, 0], ['lineTo', 10, 10], ['stroke']]);
  const three = A.commands({ type: 'pen', color: '#111111', lw: 2, pts: [[0, 0], [10, 10], [20, 0]] });
  assert.deepStrictEqual(three.slice(6), [['moveTo', 0, 0], ['quadraticCurveTo', 10, 10, 15, 5], ['lineTo', 20, 0], ['stroke']]);
});

test('commands: kutu, elips (ters sürüklemede de pozitif), ok', () => {
  const r = A.commands({ type: 'rect', color: '#e5484d', lw: 3, x1: 50, y1: 40, x2: 10, y2: 20 });
  assert.deepStrictEqual(r.slice(4), [['set', 'lineWidth', 3], ['beginPath'], ['rect', 10, 20, 40, 20], ['stroke']]);
  const e = A.commands({ type: 'ellipse', color: '#e5484d', lw: 3, x1: 50, y1: 40, x2: 10, y2: 20 });
  assert.deepStrictEqual(e.slice(6), [['ellipse', 30, 30, 20, 10, 0, 0, Math.PI * 2], ['stroke']]);
  const a = A.commands({ type: 'arrow', color: '#e5484d', lw: 2, x1: 0, y1: 0, x2: 100, y2: 0 });
  const names = a.slice(6).map(o => o[0]);
  assert.deepStrictEqual(names, ['moveTo', 'lineTo', 'stroke', 'beginPath', 'moveTo', 'lineTo', 'lineTo', 'closePath', 'fill']);
  assert.deepStrictEqual(a[10], ['moveTo', 100, 0], 'baş ucu son noktada');
});

test('commands: yazı (kontur + dolgu, çok satır)', () => {
  const t = A.commands({ type: 'text', color: '#e5484d', x: 10, y: 20, text: 'Çizgi\nİki', fs: 20 });
  assert.deepStrictEqual(t.slice(4), [
    ['set', 'font', '600 20px Inter, "Segoe UI", system-ui, sans-serif'], ['set', 'textBaseline', 'top'],
    ['set', 'lineWidth', 20 / 7], ['set', 'strokeStyle', '#ffffff'],
    ['strokeText', 'Çizgi', 10, 20], ['fillText', 'Çizgi', 10, 20], ['strokeText', 'İki', 10, 45], ['fillText', 'İki', 10, 45]]);
  const small = A.commands({ type: 'text', color: '#ffffff', x: 0, y: 0, text: 'a', fs: 7 });
  assert.deepStrictEqual(small[6], ['set', 'lineWidth', 2], 'kontur en az 2 piksel');
});

test('run / render: görsel, şekiller ve taslak ölçekle çizilir', () => {
  const ctx = fakeCtx();
  A.run(ctx, [['set', 'lineWidth', 3], ['moveTo', 1, 2]]);
  assert.deepStrictEqual(ctx.log, [['set', 'lineWidth', 3], ['moveTo', 1, 2]]);
  const st = A.createState(); A.addText(st, [0, 0], 'x', 1); A.begin(st, [1, 1], 1);
  const c2 = fakeCtx(), img = { id: 'img' };
  A.render(c2, st, { scale: 0.5, image: img, w: 200, h: 100 });
  assert.deepStrictEqual(c2.log.slice(0, 3), [['save'], ['setTransform', 0.5, 0, 0, 0.5, 0, 0], ['drawImage', img, 0, 0, 200, 100]]);
  assert.ok(c2.log.some(o => o[0] === 'fillText') && c2.log.some(o => o[0] === 'arc'), 'şekil ve taslak');
  assert.deepStrictEqual(c2.log[c2.log.length - 1], ['restore']);
  const c3 = fakeCtx(); A.render(c3, A.createState());
  assert.deepStrictEqual(c3.log, [['save'], ['setTransform', 1, 0, 0, 1, 0, 0], ['restore']], 'görselsiz, varsayılan ölçek');
});

test('shortcut: Ctrl (Windows) / ⌘ (Mac) kısayolları', () => {
  const k = (key, o = {}) => ({ key, ctrlKey: false, metaKey: false, shiftKey: false, ...o });
  assert.strictEqual(A.shortcut(k('Escape'), false), 'cancel');
  assert.strictEqual(A.shortcut(k('z', { ctrlKey: true }), false), 'undo');
  assert.strictEqual(A.shortcut(k('Z', { ctrlKey: true, shiftKey: true }), false), 'redo');
  assert.strictEqual(A.shortcut(k('y', { ctrlKey: true }), false), 'redo');
  assert.strictEqual(A.shortcut(k('s', { ctrlKey: true }), false), 'save');
  assert.strictEqual(A.shortcut(k('Enter', { ctrlKey: true }), false), 'save');
  assert.strictEqual(A.shortcut(k('q', { ctrlKey: true }), false), null);
  assert.strictEqual(A.shortcut(k('z'), false), null, 'değiştirici tuşsuz');
  assert.strictEqual(A.shortcut(k('z', { ctrlKey: true }), true), null, 'Mac\'te Ctrl değil ⌘');
  assert.strictEqual(A.shortcut(k('z', { metaKey: true }), true), 'undo');
  assert.strictEqual(A.shortcut({}, false), null);
});

test('outName: ek adı "-cizim.png" olur, tekrar çizimde birikmez', () => {
  assert.strictEqual(A.outName('ekran.jpg'), 'ekran-cizim.png');
  assert.strictEqual(A.outName('ekran-cizim.png'), 'ekran-cizim.png');
  assert.strictEqual(A.outName('yapıştırılan-123-1.webp'), 'yapıştırılan-123-1-cizim.png');
  assert.strictEqual(A.outName(''), 'gorsel-cizim.png');
  assert.strictEqual(A.outName(undefined), 'gorsel-cizim.png');
  assert.strictEqual(A.outName('.png'), 'gorsel-cizim.png');
});

test('tarayıcıda window.annotate olarak yüklenir, module.exports olmadan', () => {
  const vm = require('vm'); const src = require('fs').readFileSync(MOD, 'utf8');
  const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(src, ctx, { filename: MOD });
  assert.strictEqual(typeof ctx.window.annotate.render, 'function');
  const ctx2 = {}; vm.createContext(ctx2); vm.runInContext(src, ctx2, { filename: MOD });
  assert.strictEqual(typeof ctx2.annotate, 'object', 'window yoksa genel nesneye yazılır');
});
