// Ekran kontrolü saf mantığı: koordinat dönüşümü, monitör seçimi, girdi doğrulama, tuş ayrıştırma, panel koruması, zamanlama.
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../src/main/screen-logic');

// Sol monitör negatif koordinatlı ve %150 ölçekli; sağdaki birincil 4K %200
const DISPLAYS = [
  { id: 2, name: 'Sağ', primary: true, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, phys: { x: 0, y: 0, width: 3840, height: 2160 }, scale: 2 },
  { id: 1, name: 'Sol', primary: false, bounds: { x: -1280, y: 0, width: 1280, height: 720 }, phys: { x: -1920, y: 100, width: 1920, height: 1080 }, scale: 1.5 },
  null, { id: 9, phys: { x: 0, y: 0, width: 0, height: 10 } },
];

test('orderDisplays: geçersizleri atar, soldan sağa sıralar, görüntü boyutunu ekler', () => {
  const l = L.orderDisplays(DISPLAYS);
  assert.deepEqual(l.map(d => [d.index, d.id]), [[0, 1], [1, 2]]);
  assert.deepEqual(l[0].img, { w: 1280, h: 720, k: 1280 / 1920 });
  assert.deepEqual(l[1].img, { w: 1280, h: 720, k: 1 / 3 });
  assert.deepEqual(L.orderDisplays(undefined), []);
  // aynı x'te yukarıdaki önce
  const v = L.orderDisplays([{ id: 'a', phys: { x: 0, y: 500, width: 10, height: 10 } }, { id: 'b', phys: { x: 0, y: -500, width: 10, height: 10 } }]);
  assert.deepEqual(v.map(d => d.id), ['b', 'a']);
});

test('imageSize: büyütme yapmaz, dikey ekranda uzun kenar yüksekliktir', () => {
  assert.deepEqual(L.imageSize({ width: 800, height: 600 }), { w: 800, h: 600, k: 1 });
  assert.deepEqual(L.imageSize({ width: 1080, height: 1920 }), { w: 720, h: 1280, k: 1280 / 1920 });
  assert.deepEqual(L.imageSize({ width: 5000, height: 1 }, 100), { w: 100, h: 1, k: 0.02 });
});

test('pickMonitor: sıra numarası, son kullanılan, birincil, ilk', () => {
  const l = L.orderDisplays(DISPLAYS);
  assert.equal(L.pickMonitor(l, 0).id, 1);
  assert.equal(L.pickMonitor(l, null, 0).id, 1);
  assert.equal(L.pickMonitor(l, undefined).id, 2); // birincil
  assert.equal(L.pickMonitor(l, undefined, 7).id, 2); // son kullanılan artık yok
  assert.equal(L.pickMonitor(l.map(d => ({ ...d, primary: false })), undefined).id, 1);
  assert.throws(() => L.pickMonitor(l, 2), /Geçersiz monitör: 2 \(0–1/);
  assert.throws(() => L.pickMonitor(l, 1.5), /Geçersiz monitör/);
  assert.throws(() => L.pickMonitor(l, -1), /Geçersiz monitör/);
  assert.throws(() => L.pickMonitor([], 0), /Ekran bulunamadı/);
});

test('toPhysical / toImage / toDip: negatif koordinatlı sol monitör ve farklı DPI', () => {
  const [sol, sag] = L.orderDisplays(DISPLAYS);
  assert.deepEqual(L.toPhysical(sol, 0, 0), { x: -1920, y: 100 });
  assert.deepEqual(L.toPhysical(sol, 640, 360), { x: -960, y: 640 });
  assert.deepEqual(L.toPhysical(sag, 1279, 719), { x: 3837, y: 2157 });
  assert.throws(() => L.toPhysical(sag, 1280, 0), /görüntünün dışında: \(1280, 0\); görüntü 1280×720/);
  assert.throws(() => L.toPhysical(sag, 0, -1), /dışında/);
  assert.throws(() => L.toPhysical(sag, 'a', 1), /sayı olmalı/);
  assert.throws(() => L.toPhysical(sag, 1, NaN), /sayı olmalı/);
  const l = [sol, sag];
  assert.deepEqual(L.toImage(l, -960, 640), { monitor: 0, x: 640, y: 360 });
  assert.deepEqual(L.toImage(l, 3837, 2157), { monitor: 1, x: 1279, y: 719 });
  assert.equal(L.toImage(l, -1921, 500), null);
  assert.equal(L.toImage(l, 0, 2160), null);
  assert.deepEqual(L.toDip(sol, -960, 640), { x: 640, y: 360 });
  assert.deepEqual(L.toDip(sag, 1920, 1080), { x: 960, y: 540 });
  // gidiş-dönüş
  for (const [x, y] of [[0, 0], [100, 50], [1279, 719], [777, 333]]) {
    const p = L.toPhysical(sag, x, y); assert.deepEqual(L.toImage(l, p.x, p.y), { monitor: 1, x, y });
  }
});

test('zoomRect: görüntü alanı → tam çözünürlükte kırpma, kenarlarda kırpılır', () => {
  const [, sag] = L.orderDisplays(DISPLAYS);
  assert.deepEqual(L.zoomRect(sag, { x: 100, y: 100, w: 200, h: 100 }, 3840, 2160), { x: 300, y: 300, width: 600, height: 300 });
  assert.deepEqual(L.zoomRect(sag, { x: -50, y: 700, w: 100, h: 100 }, 3840, 2160), { x: 0, y: 2100, width: 150, height: 60 });
  assert.throws(() => L.zoomRect(sag, { x: 0, y: 0, w: 3, h: 50 }, 10, 10), /en az 4×4/);
  assert.throws(() => L.zoomRect(sag, { x: 0, y: 0, w: 50 }, 10, 10), /sayı olmalı/);
  assert.throws(() => L.zoomRect(sag, { x: 2000, y: 0, w: 50, h: 50 }, 10, 10), /dışında/);
  assert.throws(() => L.zoomRect(sag, { x: 0, y: 900, w: 50, h: 50 }, 10, 10), /dışında/);
});

test('parseKeys: değiştirici + tuş, Türkçe yön adları, F tuşları, hatalar', () => {
  assert.deepEqual(L.parseKeys('ctrl+s'), [0x11, 0x53]);
  assert.deepEqual(L.parseKeys(' Ctrl + Shift + Left '), [0x11, 0x10, 0x25]);
  assert.deepEqual(L.parseKeys('alt+f4'), [0x12, 0x73]);
  assert.deepEqual(L.parseKeys('enter'), [0x0d]);
  assert.deepEqual(L.parseKeys('f24'), [0x87]);
  assert.deepEqual(L.parseKeys('win+d'), [0x5b, 0x44]);
  assert.deepEqual(L.parseKeys('ctrl+ctrl+0'), [0x11, 0x30]);
  assert.deepEqual(L.parseKeys('asagi'), [0x28]);
  assert.deepEqual(L.parseKeys('shift'), [0x10]); // tek başına değiştirici
  assert.throws(() => L.parseKeys(''), /boş/);
  assert.throws(() => L.parseKeys(5), /boş/);
  assert.throws(() => L.parseKeys('x'.repeat(61)), /uzun/);
  assert.throws(() => L.parseKeys('a+b+c+d+e+f'), /Geçersiz tuş/);
  assert.throws(() => L.parseKeys('ctrl++'), /Geçersiz tuş/);
  assert.throws(() => L.parseKeys('ctrl+ş'), /Bilinmeyen tuş: ş/);
  assert.throws(() => L.parseKeys('a+s'), /Yalnız son tuş/);
  assert.throws(() => L.parseKeys('ctrl+alt+esc'), /engellendi/);
  assert.throws(() => L.parseKeys('alt+ctrl+delete'), /engellendi/);
  assert.deepEqual(L.parseKeys('ctrl+esc'), [0x11, 0x1b]); // başlat menüsü: izinli
});

test('encodeText: Türkçe karakter ve vekil çift (emoji) UTF-16 kod birimleri', () => {
  assert.deepEqual(L.encodeText('aŞ'), ['61', '15e']);
  assert.deepEqual(L.encodeText('ğ\n😀'), ['11f', 'a', 'd83d', 'de00']);
  assert.deepEqual(L.encodeText(''), []);
});

test('validateMouse / validateKeyboard / validateWait', () => {
  assert.deepEqual(L.validateMouse({ islem: 'tikla', x: 1, y: 2, monitor: 0 }), { islem: 'tikla', x: 1, y: 2, monitor: 0 });
  assert.deepEqual(L.validateMouse({ islem: 'surukle', x: 1, y: 2, x2: 3, y2: 4 }), { islem: 'surukle', x: 1, y: 2, monitor: undefined, x2: 3, y2: 4 });
  assert.deepEqual(L.validateMouse({ islem: 'kaydir', x: 1, y: 2 }), { islem: 'kaydir', x: 1, y: 2, monitor: undefined, miktar: 3, yatay: false });
  assert.deepEqual(L.validateMouse({ islem: 'kaydir', x: 1, y: 2, miktar: -5, yatay: 1 }).yatay, true);
  assert.throws(() => L.validateMouse(), /islem şunlardan/);
  assert.throws(() => L.validateMouse({ islem: 'sil' }), /islem şunlardan/);
  assert.throws(() => L.validateMouse({ islem: 'surukle', x: 1, y: 1, x2: 1 }), /x2 ve y2/);
  for (const m of [0, 31, 1.5, '3']) assert.throws(() => L.validateMouse({ islem: 'kaydir', x: 1, y: 1, miktar: m }), /miktar/);
  assert.deepEqual(L.validateKeyboard({ yazi: 'Şişe' }), { yazi: 'Şişe' });
  assert.deepEqual(L.validateKeyboard({ tus: 'ctrl+s' }), { tus: 'ctrl+s', codes: [0x11, 0x53] });
  assert.throws(() => L.validateKeyboard(), /yalnız biri/);
  assert.throws(() => L.validateKeyboard({ yazi: 'a', tus: 'b' }), /yalnız biri/);
  assert.throws(() => L.validateKeyboard({ yazi: '' }), /boş/);
  assert.throws(() => L.validateKeyboard({ yazi: 3 }), /boş/);
  assert.throws(() => L.validateKeyboard({ yazi: 'a'.repeat(4001) }), /4000/);
  assert.equal(L.validateWait({ ms: 0 }), 0);
  assert.equal(L.validateWait({ ms: 10000 }), 10000);
  for (const a of [undefined, {}, { ms: -1 }, { ms: 10001 }, { ms: 1.2 }]) assert.throws(() => L.validateWait(a), /ms 0–10000/);
});

test('guardPoint / guardFocus / inRect: panel penceresi reddi', () => {
  const panel = ['111'];
  assert.match(L.guardPoint({ hit: '111', panel }), /Claude Panel penceresinin üstünde/);
  assert.match(L.guardPoint({ hit: 222, hitPid: 7, panel, pid: 7 }), /üstünde/); // panelin iletişim kutusu (aynı süreç)
  assert.equal(L.guardPoint({ hit: '222', hitPid: 8, panel, pid: 7 }), null);
  assert.equal(L.guardPoint({ hit: '222' }), null);
  assert.match(L.guardPoint({ hit: null, inPanelRect: true }), /üstünde/);
  assert.equal(L.guardPoint({ hit: undefined, inPanelRect: false }), null);
  assert.match(L.guardFocus({ panelFocused: true }), /Odak Claude Panel/);
  assert.match(L.guardFocus({ fg: 111, panel }), /Odak/);
  assert.match(L.guardFocus({ fg: '5', fgPid: '7', panel, pid: 7 }), /Odak/);
  assert.equal(L.guardFocus({ fg: '5', fgPid: '8', panel, pid: 7 }), null);
  assert.equal(L.guardFocus({ fg: '5', panel: null }), null);
  assert.equal(L.guardFocus({ fg: null, fgPid: null, pid: 7 }), null);
  const r = { x: -10, y: 0, width: 20, height: 10 };
  assert.equal(L.inRect(r, -10, 0), true);
  assert.equal(L.inRect(r, 10, 5), false);
  assert.equal(L.inRect(null, 0, 0), false);
});

test('Presence: son eylemden 4 sn sonra söner; birden çok sohbet tek çerçevede', () => {
  const p = new L.Presence();
  assert.equal(p.state(0), null);
  p.touch('a', 'Premiere işi', 1, 1000);
  assert.deepEqual(p.state(1000), { monitor: 1, labels: ['Premiere işi'], until: 5000 });
  p.touch('b', '', 0, 2000);
  assert.deepEqual(p.state(2500), { monitor: 0, labels: ['Premiere işi', 'Sohbet'], until: 6000 });
  assert.deepEqual(p.state(5500), { monitor: 0, labels: ['Sohbet'], until: 6000 });
  assert.equal(p.state(6000), null);
  p.touch('a', 'Premiere işi', 1, 7000); p.touch('c', 'Premiere işi', 1, 7000);
  assert.deepEqual(p.state(7000).labels, ['Premiere işi']);
  assert.equal(p.end('a'), true); assert.equal(p.end('a'), false);
  p.touch('d', 'Eski', 0, 6500); // daha eski eylem sonra eklenmiş: son eylemin ekranı yine 1
  assert.equal(p.state(7000).monitor, 1);
  p.clear(); assert.equal(p.runs.size, 0);
  assert.equal(new L.Presence(100).hideMs, 100);
});

test('logEntry: yazılan metnin yalnız uzunluğu', () => {
  const e = JSON.parse(L.logEntry('klavye', { yazi: 'gizli parola', tus: undefined }, 0, { runId: 'r' }));
  assert.deepEqual(e, { t: '1970-01-01T00:00:00.000Z', arac: 'klavye', yaziUzunlugu: 12, runId: 'r' });
  assert.ok(!JSON.stringify(e).includes('gizli'));
  assert.deepEqual(JSON.parse(L.logEntry('fare', { islem: 'tikla', x: 1, y: 2, monitor: 0, extra: 'x' }, 0)), { t: '1970-01-01T00:00:00.000Z', arac: 'fare', islem: 'tikla', monitor: 0, x: 1, y: 2 });
  assert.deepEqual(JSON.parse(L.logEntry('bekle', null, 0)), { t: '1970-01-01T00:00:00.000Z', arac: 'bekle' });
  assert.equal(L.VK.f1, 0x70);
});
