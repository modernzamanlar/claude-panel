// renderer/menupos.js: açılır menünün düğmeye hizalı, pencere/bölme içinde kalan konumu.
const { test } = require('node:test');
const assert = require('node:assert');
const MOD = require.resolve('../src/renderer/menupos.js');
const { place } = require(MOD);

const V = { width: 1920, height: 1080 };
const btn = (left, top, w = 36, h = 24) => ({ left, top, right: left + w, bottom: top + h });

test('5. ekteki durum: yazma kutusundaki kullanım düğmesi → menü düğmenin hemen üstünde, sola hizalı', () => {
  const a = btn(435, 975), m = { width: 330, height: 190 };
  const p = place(a, m, V, { top: 52 });
  assert.deepStrictEqual(p, { x: 435, y: 975 - 6 - 190, side: 'above', maxHeight: 975 - 6 - 52 });
  assert.strictEqual(p.y + m.height + 6, a.top);                 // alt kenarı düğmeye 6 px
});

test('hizalama: end sağ kenara, center ortaya; varsayılanlar (gap 6, margin 8, top 8)', () => {
  const a = btn(1000, 900, 40, 20), m = { width: 200, height: 100 };
  assert.strictEqual(place(a, m, V, { align: 'end' }).x, 1040 - 200);
  assert.strictEqual(place(a, m, V, { align: 'center' }).x, 1020 - 100);
  assert.deepStrictEqual(place(a, m, V), { x: 1000, y: 794, side: 'above', maxHeight: 900 - 6 - 8 });
});

test('kenarlar: sağa/sola taşan menü pencere içine kaydırılır; pencereden geniş menü sol kenara', () => {
  assert.strictEqual(place(btn(1890, 900), { width: 300, height: 100 }, V).x, 1920 - 8 - 300);
  assert.strictEqual(place(btn(2, 900), { width: 300, height: 100 }, V, { align: 'end' }).x, 8);
  assert.strictEqual(place(btn(100, 900), { width: 3000, height: 100 }, V).x, 8);
});

test('bölme sınırı: menü sığıyorsa bölmenin içinde kalır, sığmıyorsa yalnız pencereye kısıtlanır', () => {
  const b = { left: 64, right: 676 };
  assert.strictEqual(place(btn(600, 975), { width: 330, height: 190 }, V, { bounds: b }).x, 636 - 330);   // sağdan taşan 'start' → düğmenin sağ kenarına hizalı
  assert.strictEqual(place(btn(70, 975), { width: 330, height: 190 }, V, { bounds: b, align: 'end' }).x, 70);   // soldan taşan 'end' → düğmenin sol kenarına hizalı
  assert.strictEqual(place(btn(600, 975), { width: 700, height: 190 }, V, { bounds: b }).x, 600);   // bölmeden geniş
  assert.strictEqual(place(btn(1900, 975), { width: 330, height: 190 }, V, { bounds: { left: 0, right: 5000 } }).x, 1920 - 8 - 330);
});

test('yön değiştirme: üstte yer yoksa ve altta daha çoksa aşağı; altta yoksa yukarı', () => {
  const p = place(btn(100, 60), { width: 200, height: 300 }, V, { top: 52 });
  assert.strictEqual(p.side, 'below'); assert.strictEqual(p.y, 84 + 6); assert.strictEqual(p.maxHeight, 1080 - 8 - 84 - 6);
  const q = place(btn(100, 1000), { width: 200, height: 300 }, V, { side: 'below' });
  assert.strictEqual(q.side, 'above'); assert.strictEqual(q.y, 1000 - 6 - 300);
  assert.strictEqual(place(btn(100, 100), { width: 200, height: 50 }, V, { side: 'below' }).side, 'below');
});

test('uzun menü: iki yanda da sığmazsa daha geniş tarafta kalır, maxHeight o tarafın yüksekliği, pencere içinde', () => {
  const v = { width: 800, height: 600 };
  const p = place(btn(100, 400), { width: 200, height: 900 }, v, { top: 52 });
  assert.strictEqual(p.side, 'above'); assert.strictEqual(p.maxHeight, 400 - 6 - 52); assert.strictEqual(p.y, 52);
  const q = place(btn(100, 20), { width: 200, height: 900 }, v, { side: 'above', top: 52 });   // düğme şeridin içinde: yukarıda yer eksi
  assert.strictEqual(q.side, 'below'); assert.ok(q.y >= 52 && q.y <= 600 - 8);
  const r = place(btn(100, 30), { width: 200, height: 900 }, { width: 800, height: 40 }, { side: 'above', top: 52 });
  assert.strictEqual(r.maxHeight, 0); assert.strictEqual(r.y, 52);
});

test('yan açılım: sağa (alta hizalı), sağda yer yoksa sola; sola istenip yer yoksa sağa; üst/orta hizalama', () => {
  const s = btn(10, 1000, 36, 36);
  assert.deepStrictEqual(place(s, { width: 260, height: 300 }, V, { side: 'right', align: 'end', top: 52 }), { x: 52, y: 1036 - 300, side: 'right', maxHeight: 1072 - 52 });
  assert.strictEqual(place(s, { width: 260, height: 300 }, V, { side: 'right', align: 'end' }).y, 736);
  const r = btn(1880, 500, 30, 30);
  const p = place(r, { width: 260, height: 100 }, V, { side: 'right' });
  assert.strictEqual(p.side, 'left'); assert.strictEqual(p.x, 1880 - 6 - 260); assert.strictEqual(p.y, 500);
  const q = place(btn(20, 500, 30, 30), { width: 260, height: 100 }, V, { side: 'left', align: 'center' });
  assert.strictEqual(q.side, 'right'); assert.strictEqual(q.x, 56); assert.strictEqual(q.y, 465);
  assert.strictEqual(place(btn(1000, 500), { width: 260, height: 100 }, V, { side: 'left' }).side, 'left');
  assert.strictEqual(place(s, { width: 260, height: 300 }, V, { side: 'right', align: 'start' }).y, 1080 - 8 - 300);   // alttan taşmaz
});

test('kenar boşluğu ve aralık parametreleri', () => {
  const p = place(btn(0, 500), { width: 100, height: 100 }, V, { margin: 0, gap: 0 });
  assert.deepStrictEqual(p, { x: 0, y: 400, side: 'above', maxHeight: 500 });
});

test('tarayıcıda window.menuPos olarak yüklenir', () => {
  const vm = require('vm'), src = require('fs').readFileSync(MOD, 'utf8');
  const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(src, ctx, { filename: MOD });
  assert.deepStrictEqual(Object.keys(ctx.window.menuPos), ['place']);
  const ctx2 = {}; vm.createContext(ctx2); vm.runInContext(src, ctx2, { filename: MOD });
  assert.strictEqual(typeof ctx2.menuPos, 'object');
});

test('karşı hizaya geçiş: istenen hizada taşan menü karşı hizada sığıyorsa oraya, ikisinde de sığmıyorsa kenara kaydırılır', () => {
  const m = { width: 300, height: 100 }, b = { left: 400, right: 1000 };
  // sağ yarıdaki düğme 'end' istedi ama bölmenin solundan taşıyor → 'start' (düğmenin sol kenarı)
  assert.strictEqual(place(btn(420, 900), m, V, { align: 'end', bounds: b }).x, 420);
  // 'start' istendi, sağdan taşıyor → 'end' (düğmenin sağ kenarı)
  assert.strictEqual(place(btn(900, 900), m, V, { align: 'start', bounds: b }).x, 936 - 300);
  // dar bölme: iki hizada da taşıyor → bölme kenarına kaydırılır, düğmeyi örter
  const nb = { left: 400, right: 720 };
  assert.strictEqual(place(btn(600, 900), m, V, { align: 'end', bounds: nb }).x, 400);
  assert.strictEqual(place(btn(600, 900), m, V, { align: 'start', bounds: nb }).x, 420);
  // orta hiza ve yan açılım bu kurala girmez
  assert.strictEqual(place(btn(420, 900), m, V, { align: 'center', bounds: b }).x, 400);
  assert.strictEqual(place(btn(1000, 500), m, V, { side: 'right' }).x, 1042);
});
