// renderer/usage.js: kalan kullanım geçmişi, tahmin ve çizgi grafiği.
const { test } = require('node:test');
const assert = require('node:assert');
const MOD = require.resolve('../src/renderer/usage.js');
const { record, points, forecast, spark, winMs } = require(MOD);
const H = 36e5, NOW = Date.UTC(2026, 10, 5, 12);
const U = (w, at = NOW) => ({ w: Object.fromEntries(Object.entries(w).map(([k, u]) => [k, { u, at }])) });

test('winMs: bilinen pencereler, bilinmeyen 7 gün', () => {
  assert.strictEqual(winMs('five_hour'), 5 * H);
  assert.strictEqual(winMs('seven_day_opus'), 168 * H);
  assert.strictEqual(winMs('baska'), 168 * H);
});

test('record: kayıt ekler, 10 dk içinde değişmeyeni atlar, değişeni ekler, 600 ile sınırlar', () => {
  let h = record(null, U({ seven_day: 0.7312 }), NOW);
  assert.deepStrictEqual(h, [{ t: NOW, w: { seven_day: 0.731 } }]);
  assert.strictEqual(record(h, U({ seven_day: 0.733 }), NOW + 60e3).length, 1, '10 dk içinde ve %0,5 altı değişim');
  assert.strictEqual(record(h, U({ seven_day: 0.75 }), NOW + 60e3).length, 2, 'değişim varsa eklenir');
  assert.strictEqual(record(h, U({ five_hour: 0.2 }), NOW + 60e3).length, 2, 'yeni pencere eklenir');
  assert.strictEqual(record(h, U({ seven_day: 0.731 }), NOW + 11 * 60e3).length, 2, '10 dk sonra aynı değer de eklenir');
  assert.strictEqual(record(h, null, NOW).length, 1);
  assert.strictEqual(record(h, {}, NOW).length, 1);
  assert.strictEqual(record(h, { w: { x: null, y: { u: 'a' } } }, NOW).length, 1, 'geçersiz değerler');
  assert.notStrictEqual(record(h, U({ seven_day: 0.9 }), NOW + 1), h, 'girdi dizisi değiştirilmez');
  let big = []; for (let i = 0; i < 650; i++) big = record(big, U({ seven_day: i / 1000 }), NOW + i * 11 * 60e3);
  assert.strictEqual(big.length, 600); assert.strictEqual(big[599].w.seven_day, 0.649);
});

test('points: yalnızca bu pencere (son sıfırlanmadan beri) ve bu anahtar', () => {
  const reset = (NOW + 24 * H) / 1000;
  const h = [{ t: NOW - 200 * H, w: { seven_day: 0.1 } }, { t: NOW - 2 * H, w: { seven_day: 0.5, five_hour: 0.3 } }, { t: NOW, w: { five_hour: 0.4 } }, { t: NOW + H, w: { seven_day: 0.9 } }, null, { t: NOW - H }];
  assert.deepStrictEqual(points(h, 'seven_day', NOW, reset), [[NOW - 2 * H, 0.5]]);
  assert.deepStrictEqual(points(h, 'five_hour', NOW, null), [[NOW - 2 * H, 0.3], [NOW, 0.4]]);
  assert.deepStrictEqual(points(null, 'seven_day', NOW, reset), []);
});

test('forecast: artış hızından doluş zamanı; sıfırlanmadan önce/sonra; veri azsa null', () => {
  const reset = (NOW + 72 * H) / 1000;
  const h = [0, 1, 2, 3, 4].map(i => ({ t: NOW - (4 - i) * H, w: { seven_day: 0.6 + i * 0.01 } })); // saatte %1
  const f = forecast(h, 'seven_day', NOW, reset);
  assert.ok(Math.abs(f.rate - 0.01) < 1e-9); assert.ok(Math.abs(f.uNow - 0.64) < 1e-9);
  assert.ok(Math.abs(f.eta - (NOW + 36 * H)) < 1000); assert.strictEqual(f.beforeReset, true);
  assert.strictEqual(forecast(h, 'seven_day', NOW, (NOW + 10 * H) / 1000).beforeReset, false, 'sıfırlanma daha önce');
  assert.strictEqual(forecast(h, 'seven_day', NOW, null).beforeReset, true, 'sıfırlanma bilinmiyorsa');
  const flat = h.map(e => ({ t: e.t, w: { seven_day: 0.6 } }));
  assert.deepStrictEqual(forecast(flat, 'seven_day', NOW, reset), { rate: 0, eta: null, beforeReset: false, uNow: 0.6 });
  assert.strictEqual(forecast(h.slice(0, 1), 'seven_day', NOW, reset), null, 'tek nokta');
  assert.strictEqual(forecast([{ t: NOW - 60e3, w: { seven_day: 0.1 } }, { t: NOW, w: { seven_day: 0.2 } }], 'seven_day', NOW, reset), null, '20 dk altı aralık');
  const five = [{ t: NOW - 3 * H, w: { five_hour: 0.0 } }, { t: NOW - H, w: { five_hour: 0.2 } }, { t: NOW, w: { five_hour: 0.5 } }];
  const f5 = forecast(five, 'five_hour', NOW, (NOW + 2 * H) / 1000);
  assert.ok(Math.abs(f5.rate - 0.3) < 1e-9, '5 saatlikte yalnızca son 2 saat'); assert.strictEqual(f5.beforeReset, true, '1,7 sa sonra dolar, sıfırlanma 2 sa sonra');
  assert.strictEqual(forecast(five, 'five_hour', NOW, (NOW + H) / 1000).beforeReset, false);
  const over = [{ t: NOW - H, w: { seven_day: 0.99 } }, { t: NOW, w: { seven_day: 1.2 } }];
  assert.strictEqual(forecast(over, 'seven_day', NOW, reset).eta, NOW, 'zaten dolmuşsa şimdi');
});

test('spark: pencere boyunca x, kullanım oranı y (0–1 sınırlı)', () => {
  const reset = (NOW + 84 * H) / 1000; // pencere NOW-84sa .. NOW+84sa
  const h = [{ t: NOW - 84 * H, w: { seven_day: 0 } }, { t: NOW, w: { seven_day: 0.5 } }, { t: NOW - H, w: { seven_day: 1.5 } }];
  assert.strictEqual(spark(h, 'seven_day', NOW, reset, 200, 20), '0.0,20.0 100.0,10.0 98.8,0.0');
  assert.strictEqual(spark([{ t: NOW, w: { seven_day: -1 } }], 'seven_day', NOW, null, 100, 10), '100.0,10.0', 'sıfırlanma bilinmiyorsa pencere şimdi biter');
  assert.strictEqual(spark([], 'seven_day', NOW, reset, 100, 10), '');
});

test('tarayıcıda window.usageMath olarak yüklenir', () => {
  const vm = require('vm'); const ctx = { window: {} }; vm.createContext(ctx);
  vm.runInContext(require('fs').readFileSync(MOD, 'utf8'), ctx, { filename: MOD });
  assert.deepStrictEqual(Object.keys(ctx.window.usageMath).sort(), ['forecast', 'points', 'record', 'spark', 'winMs']);
  const ctx2 = {}; vm.createContext(ctx2); vm.runInContext(require('fs').readFileSync(MOD, 'utf8'), ctx2, { filename: MOD });
  assert.strictEqual(typeof ctx2.usageMath, 'object');
});
