// Tema seçimi: kayıtlı tercihten görünüm çıkarma, eski kayıtların göçü, ayarlar menüsü seçimleri ve tema düğmesi.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const MOD = path.join(__dirname, '..', 'src', 'renderer', 'tema.js');
const T = require(MOD);

test('göç: kaydı olmayan herkes yeni Gece temasını görür (sistem açık olsa da)', () => {
  for (const p of [undefined, null, {}, { fonts: {} }]) {
    assert.deepStrictEqual(T.resolve(p, false), { attr: 'dark', look: 'gece', palette: 'gece' });
    assert.deepStrictEqual(T.resolve(p, true), { attr: 'dark', look: 'gece', palette: 'gece' });
  }
});

test('göç: eski "dark" kaydı yeni koyu takıma, "light" açığa gider; tanınmayan değer varsayılana düşer', () => {
  assert.deepStrictEqual(T.resolve({ theme: 'dark' }, false), { attr: 'dark', look: 'gece', palette: 'gece' });
  assert.deepStrictEqual(T.resolve({ theme: 'light' }, true), { attr: 'light', look: 'light', palette: 'gece' });
  assert.deepStrictEqual(T.resolve({ theme: 'mor', palette: 'pembe' }, false), { attr: 'dark', look: 'gece', palette: 'gece' });
});

test('eski Claude koyu takımı seçilebilir ve açık/koyu geçişinde korunur', () => {
  const p = { theme: 'dark', palette: 'claude' };
  assert.deepStrictEqual(T.resolve(p, false), { attr: 'dark', look: 'claude', palette: 'claude' });
  const l = T.toggle(p, true);
  assert.deepStrictEqual(l, { theme: 'light', palette: 'claude' });
  assert.strictEqual(T.resolve(l, true).look, 'light');
  const d = T.toggle(l, false);
  assert.deepStrictEqual(T.resolve(d, false), { attr: 'dark', look: 'claude', palette: 'claude' });
});

test('sisteme uy: data-theme yok, görünüm sistem temasına ve takıma göre', () => {
  assert.deepStrictEqual(T.resolve({ theme: 'system' }, true), { attr: null, look: 'gece', palette: 'gece' });
  assert.deepStrictEqual(T.resolve({ theme: 'system', palette: 'claude' }, true), { attr: null, look: 'claude', palette: 'claude' });
  assert.deepStrictEqual(T.resolve({ theme: 'system' }, false), { attr: null, look: 'light', palette: 'gece' });
});

test('current: menüde işaretli seçenek', () => {
  assert.strictEqual(T.current(undefined), 'gece');
  assert.strictEqual(T.current({ theme: 'dark' }), 'gece');
  assert.strictEqual(T.current({ theme: 'dark', palette: 'claude' }), 'claude');
  assert.strictEqual(T.current({ theme: 'light', palette: 'claude' }), 'light');
  assert.strictEqual(T.current({ theme: 'system' }), 'system');
});

test('choose: her seçenek kendi kaydını üretir, diğer tercihler korunur', () => {
  const base = { fonts: { ui: 'Inter' }, sort: 'name', theme: 'light', palette: 'claude' };
  assert.deepStrictEqual(T.choose(base, 'gece'), { ...base, theme: 'dark', palette: 'gece' });
  assert.deepStrictEqual(T.choose(base, 'claude'), { ...base, theme: 'dark', palette: 'claude' });
  assert.deepStrictEqual(T.choose({ ...base, theme: 'dark' }, 'light'), { ...base, theme: 'light' });
  assert.deepStrictEqual(T.choose(base, 'system'), { ...base, theme: 'system' });
  assert.deepStrictEqual(T.choose(base, 'yok'), base);
  assert.deepStrictEqual(T.choose(undefined, 'gece'), { theme: 'dark', palette: 'gece' });
  assert.deepStrictEqual(T.toggle(undefined, false), { theme: 'dark' });
  assert.notStrictEqual(T.choose(base, 'yok'), base); // yeni nesne, girdi değişmez
  assert.strictEqual(base.theme, 'light');
});

test('her seçenek için choose → current → resolve tutarlı', () => {
  for (const c of T.CHOICES) {
    const p = T.choose({}, c.id);
    assert.strictEqual(T.current(p), c.id);
    const look = T.resolve(p, true).look;
    assert.strictEqual(look, c.id === 'system' ? 'gece' : c.id);
  }
  assert.deepStrictEqual(T.CHOICES.map(c => c.id), ['gece', 'claude', 'light', 'system']);
  assert.deepStrictEqual(T.PALETTES, ['gece', 'claude']);
  assert.strictEqual(T.palette({ palette: 'claude' }), 'claude');
});

test('tarayıcıda window.Tema olarak yüklenir', () => {
  const vm = require('vm'); const src = fs.readFileSync(MOD, 'utf8');
  const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(src, ctx, { filename: MOD });
  assert.deepStrictEqual(Object.keys(ctx.window.Tema).sort(), ['CHOICES', 'PALETTES', 'choose', 'current', 'palette', 'resolve', 'toggle']);
  const ctx2 = {}; vm.createContext(ctx2); vm.runInContext(src, ctx2, { filename: MOD });
  assert.strictEqual(typeof ctx2.Tema.resolve, 'function');
});
