// main/browser.js: tarayıcı paneli — adres düzeltme/denetim, görünüm konumu, oturum sıkılaştırma, görünüm yönetimi.
// Electron nesneleri sahte nesnelerle verilir; modülün tamamı node'da koşar.
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { PARTITION, normalizeUrl, isAllowedUrl, toBounds, startTestServer, hardenSession, createBrowser } = require('../src/main/browser');

test('normalizeUrl: şemasız yerel adresler http, diğerleri https alır', () => {
  const ok = {
    'localhost:3000': 'http://localhost:3000/',
    '  localhost:5173/app?x=1#y ': 'http://localhost:5173/app?x=1#y',
    'localhost': 'http://localhost/',
    'app.localhost:8080': 'http://app.localhost:8080/',
    '127.0.0.1:8000/a': 'http://127.0.0.1:8000/a',
    '0.0.0.0:3000': 'http://0.0.0.0:3000/',
    '[::1]:4000': 'http://[::1]:4000/',
    '192.168.1.20:5173': 'http://192.168.1.20:5173/',
    '10.0.0.5': 'http://10.0.0.5/',
    '172.20.1.1:81': 'http://172.20.1.1:81/',
    '172.32.1.1': 'https://172.32.1.1/', // özel ağ aralığı dışında
    'example.com': 'https://example.com/',
    'example.com:8443/yol': 'https://example.com:8443/yol',
    '//example.com/x': 'https://example.com/x',
    'http://example.com': 'http://example.com/',
    'HTTPS://Example.COM/A': 'https://example.com/A',
    'http:example.com': 'http://example.com/',
    'https://localhost:3000/': 'https://localhost:3000/',
    'müzik.com.tr': 'https://xn--mzik-0ra.com.tr/', // IDN → punycode
    'https://bücher.de/ä?q=ü': 'https://xn--bcher-kva.de/%C3%A4?q=%C3%BC',
    'localhost:3000?q=a%20b': 'http://localhost:3000/?q=a%20b',
  };
  for (const [i, o] of Object.entries(ok)) assert.strictEqual(normalizeUrl(i), o, i);
});

test('normalizeUrl: http/https dışı şemalar, boşluklar, kimlik bilgisi ve bozuk adresler reddedilir', () => {
  const bad = [undefined, null, 42, {}, '', '   ', 'x'.repeat(4097),
    'javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'data:text/html,<b>x</b>', 'file:///etc/passwd', 'file://C:/Windows',
    'about:blank', 'blob:https://a.com/x', 'vbscript:x', 'mailto:a@b.com', 'cpmedia://local/x.png', 'chrome://settings', 'view-source:https://a.com',
    'ftp://a.com', 'ws://localhost:1', 'localhost:', 'localhost:abc',
    'foo bar.com', 'localhost:3000/a b', 'example.com\tx', 'a\nb.com',
    'kelime', '/yol', '?q=1', '#x', '//', 'http://', 'https://',
    'https://user:pass@example.com', 'user@example.com', 'user:pass@example.com',
    'localhost:99999', '999.1.1.1:80', 'http://[::1', 'https://exa mple.com'];
  for (const b of bad) assert.strictEqual(normalizeUrl(b), null, String(b));
});

test('isAllowedUrl: yalnızca kimlik bilgisi olmayan http/https adresleri', () => {
  assert.ok(isAllowedUrl('http://localhost:3000/'));
  assert.ok(isAllowedUrl('https://example.com/a'));
  assert.ok(isAllowedUrl(new URL('https://example.com')));
  for (const u of ['file:///x', 'javascript:1', 'data:,x', 'about:blank', 'http://u:p@a.com', 'https://u@a.com', 'yok', '', null, undefined, 'mailto:a@b.c'])
    assert.strictEqual(isAllowedUrl(u), false, String(u));
});

test('toBounds: CSS pikseli yakınlaştırmayla DIP\'e çevirir, geçersizde null', () => {
  assert.deepStrictEqual(toBounds({ x: 10.4, y: 44, width: 400.6, height: 300 }), { x: 10, y: 44, width: 401, height: 300 });
  assert.deepStrictEqual(toBounds({ x: 10, y: 20, width: 100, height: 50 }, 1.5), { x: 15, y: 30, width: 150, height: 75 });
  assert.deepStrictEqual(toBounds({ x: -5, y: -1, width: 10, height: 10 }, 0), { x: 0, y: 0, width: 10, height: 10 }, 'geçersiz yakınlaştırma = 1, eksi konum 0');
  assert.deepStrictEqual(toBounds({ x: 0, y: 0, width: 10, height: 10 }, NaN), { x: 0, y: 0, width: 10, height: 10 });
  for (const r of [null, undefined, 'x', 5, {}, { x: 0, y: 0, width: 0, height: 10 }, { x: 0, y: 0, width: 10, height: -3 }, { x: 0, y: 0, width: '10', height: 10 }, { x: NaN, y: 0, width: 10, height: 10 }, { x: 0, y: Infinity, width: 10, height: 10 }])
    assert.strictEqual(toBounds(r), null, JSON.stringify(r));
});

test('startTestServer: 127.0.0.1 üzerinde iki deneme sayfası sunar', async () => {
  for (const s of [await startTestServer(), await startTestServer(http)]) {
    assert.match(s.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);
    const a = await (await fetch(s.url)).text(), b = await (await fetch(s.url + 'iki')).text();
    assert.match(a, /<title>Önizleme testi<\/title>/); assert.match(b, /<title>İkinci sayfa<\/title>/);
    s.close();
  }
});

// ---- sahte Electron nesneleri ----
class Em { constructor() { this.h = {}; } on(ev, fn) { (this.h[ev] = this.h[ev] || []).push(fn); return this; } fire(ev, ...a) { (this.h[ev] || []).forEach(f => f(...a)); } }
const ev = () => ({ prevented: false, preventDefault() { this.prevented = true; } });
function fakeSession(withDevice = true) {
  const s = new Em(); s.handlers = {};
  s.setPermissionRequestHandler = f => { s.handlers.req = f; };
  s.setPermissionCheckHandler = f => { s.handlers.check = f; };
  if (withDevice) s.setDevicePermissionHandler = f => { s.handlers.device = f; };
  return s;
}
function fakeWC() {
  const c = new Em();
  Object.assign(c, { loaded: [], did: [], back: false, fwd: false, url: '', dead: false, failLoad: false,
    loadURL(u) { c.loaded.push(u); return c.failLoad ? Promise.reject(new Error('yüklenemedi')) : Promise.resolve(); },
    getURL: () => c.url, reload() { c.did.push('reload'); }, stop() { c.did.push('stop'); },
    isDestroyed: () => c.dead, close() { if (c.closeThrows) throw new Error('x'); c.dead = true; },
    setWindowOpenHandler(f) { c.openHandler = f; } });
  c.navigationHistory = { canGoBack: () => c.back, canGoForward: () => c.fwd, goBack() { c.did.push('back'); }, goForward() { c.did.push('fwd'); } };
  return c;
}
class FakeView {
  constructor(opts) { this.opts = opts; this.webContents = fakeWC(); this.visible = null; this.bounds = null; }
  setBackgroundColor(c) { this.bg = c; } setVisible(v) { this.visible = v; } setBounds(b) { this.bounds = b; }
}
function fakeWin() {
  const w = { dead: false, zoom: 1, kids: [], isDestroyed: () => w.dead, webContents: { getZoomFactor: () => w.zoom } };
  w.contentView = { addChildView: v => w.kids.push(v), removeChildView: v => { if (w.removeThrows) throw new Error('x'); w.kids = w.kids.filter(k => k !== v); } };
  return w;
}
function setup(over = {}) {
  const sent = [], opened = [], parts = [];
  let t = 10000;
  const ses = fakeSession();
  const env = { win: fakeWin(), sent, opened, parts, ses, tick: ms => { t += ms; } };
  env.b = createBrowser({ getWin: () => env.win, WebContentsView: FakeView, shell: { openExternal: u => opened.push(u) },
    session: { fromPartition: p => { parts.push(p); return ses; } }, send: (ch, p) => sent.push([ch, p]), now: () => t, ...over });
  env.last = ch => [...sent].reverse().find(x => x[0] === ch)?.[1];
  return env;
}

test('hardenSession: izinler, aygıtlar ve indirmeler reddedilir', () => {
  for (const withDevice of [true, false]) {
    const s = fakeSession(withDevice), dl = [];
    hardenSession(s, u => dl.push(u));
    let got; s.handlers.req(null, 'media', v => { got = v; }); assert.strictEqual(got, false);
    assert.strictEqual(s.handlers.check(null, 'notifications'), false);
    if (withDevice) assert.strictEqual(s.handlers.device({}), false); else assert.strictEqual(s.handlers.device, undefined);
    const e1 = ev(); s.fire('will-download', e1, { getURL: () => 'https://a.com/f.zip' }); assert.ok(e1.prevented);
    const e2 = ev(); s.fire('will-download', e2, null); assert.ok(e2.prevented);
    const e3 = ev(); s.fire('will-download', e3, {}); assert.deepStrictEqual(dl, ['https://a.com/f.zip', '', '']);
    const calls = [];
    const eh = ev(); s.fire('select-hid-device', eh, {}, (...a) => calls.push(['hid', a])); assert.ok(eh.prevented);
    const es = ev(); s.fire('select-serial-port', es, [], {}, (...a) => calls.push(['serial', a])); assert.ok(es.prevented);
    const eu = ev(); s.fire('select-usb-device', eu, {}, (...a) => calls.push(['usb', a])); assert.ok(eu.prevented);
    assert.deepStrictEqual(calls, [['hid', []], ['serial', []], ['usb', []]], 'seçimsiz kapatılır');
  }
});

test('createBrowser: görünüm güvenli ayarlarla, ayrı oturumda, gizli başlar', () => {
  const E = setup();
  assert.strictEqual(E.b.view, null);
  assert.deepStrictEqual(E.b.navigate('kelime'), { ok: false, error: 'Geçersiz adres: yalnızca http/https sayfaları açılır' });
  assert.strictEqual(E.b.view, null, 'geçersiz adres görünüm oluşturmaz');
  assert.deepStrictEqual(E.b.navigate('localhost:3000'), { ok: true, url: 'http://localhost:3000/' });
  const v = E.b.view;
  assert.deepStrictEqual(E.parts, [PARTITION]); assert.strictEqual(PARTITION, 'persist:onizleme');
  const wp = v.opts.webPreferences;
  assert.strictEqual(wp.session, E.ses);
  assert.deepStrictEqual([wp.nodeIntegration, wp.contextIsolation, wp.sandbox, wp.webviewTag, wp.devTools, wp.preload], [false, true, true, false, false, undefined]);
  assert.strictEqual(v.visible, false); assert.deepStrictEqual(E.win.kids, [v]); assert.strictEqual(v.bg, '#ffffff');
  assert.deepStrictEqual(v.webContents.loaded, ['http://localhost:3000/']);
  assert.strictEqual(E.last('browser:state').url, 'http://localhost:3000/');
  assert.ok(typeof E.ses.handlers.req === 'function', 'oturum sıkılaştırıldı');
  E.b.navigate('example.com'); assert.strictEqual(E.b.view, v, 'aynı pencerede görünüm yeniden kullanılır');
  v.webContents.failLoad = true; assert.ok(E.b.navigate('example.org').ok, 'loadURL hatası yutulur (did-fail-load bildirir)');
});

test('createBrowser: pencere yoksa ya da kapandıysa açılmaz; yeni pencerede görünüm yeniden kurulur', () => {
  const E = setup();
  E.win = null; assert.deepStrictEqual(E.b.navigate('localhost'), { ok: false, error: 'Pencere yok' });
  E.win = fakeWin(); E.win.dead = true; assert.strictEqual(E.b.navigate('localhost').ok, false);
  E.win = fakeWin(); E.b.navigate('localhost'); const v1 = E.b.view, w1 = E.win;
  E.win = fakeWin(); E.b.navigate('localhost'); const v2 = E.b.view;
  assert.notStrictEqual(v1, v2); assert.deepStrictEqual(w1.kids, [], 'eski pencereden çıkarıldı'); assert.ok(v1.webContents.dead, 'eski sayfa kapatıldı');
  assert.deepStrictEqual(E.parts.length, 2); // oturum her seferinde alınır, ama bir kez sıkılaştırılır
  assert.strictEqual((E.ses.h['will-download'] || []).length, 1);
});

test('createBrowser: destroy her durumda güvenli', () => {
  const E = setup();
  E.b.destroy(); // görünüm yokken
  E.b.navigate('localhost'); E.win.removeThrows = true; E.b.view.webContents.closeThrows = true;
  E.b.destroy(); assert.strictEqual(E.b.view, null, 'hata atan kaldırma/kapatma da temizler');
  E.b.navigate('localhost'); E.win.dead = true; const v = E.b.view; E.b.destroy(); assert.ok(v.webContents.dead);
  E.win = fakeWin(); E.b.navigate('localhost'); const v2 = E.b.view; v2.webContents.dead = true;
  E.b.destroy(); assert.deepStrictEqual(E.win.kids, []);
  assert.strictEqual(E.b.state().loading, false);
});

test('createBrowser: sayfa olayları durumu günceller', () => {
  const E = setup(); E.b.navigate('localhost:3000'); const c = E.b.view.webContents;
  c.fire('did-start-loading'); assert.strictEqual(E.last('browser:state').loading, true);
  c.back = true; c.fire('did-navigate', {}, 'http://localhost:3000/a');
  assert.deepStrictEqual([E.last('browser:state').url, E.last('browser:state').canBack, E.last('browser:state').canFwd], ['http://localhost:3000/a', true, false]);
  c.fire('did-navigate-in-page', {}, 'http://localhost:3000/a#x', false); assert.strictEqual(E.b.state().url, 'http://localhost:3000/a', 'alt çerçeve yok sayılır');
  c.fire('did-navigate-in-page', {}, 'http://localhost:3000/a#y', true); assert.strictEqual(E.b.state().url, 'http://localhost:3000/a#y');
  c.fire('page-title-updated', {}, 'Başlık'); assert.strictEqual(E.b.state().title, 'Başlık');
  c.fire('page-title-updated', {}, undefined); assert.strictEqual(E.b.state().title, '');
  c.fwd = true; c.fire('did-stop-loading'); assert.deepStrictEqual([E.b.state().loading, E.b.state().canFwd], [false, true]);
  c.fire('did-fail-load', {}, -105, 'ERR_NAME_NOT_RESOLVED', 'http://x/', false); assert.strictEqual(E.b.state().error, null, 'alt çerçeve hatası yok sayılır');
  c.fire('did-fail-load', {}, -3, 'ERR_ABORTED', 'http://x/', true); assert.strictEqual(E.b.state().error, null, 'iptal hata değil');
  c.fire('did-start-loading');
  c.fire('did-fail-load', {}, -102, 'ERR_CONNECTION_REFUSED', 'http://localhost:3000/', true);
  assert.deepStrictEqual(E.b.state().error, { code: -102, desc: 'ERR_CONNECTION_REFUSED', url: 'http://localhost:3000/' }); assert.strictEqual(E.b.state().loading, false);
  c.fire('did-start-loading'); assert.strictEqual(E.b.state().error, null, 'yeni yükleme hatayı temizler');
  c.fire('did-fail-load', {}, -2, undefined, undefined, true); assert.deepStrictEqual(E.b.state().error, { code: -2, desc: '', url: '' });
  c.fire('render-process-gone', {}, { reason: 'crashed' }); assert.match(E.b.state().error.desc, /çöktü \(crashed\)/);
  c.fire('render-process-gone', {}, undefined); assert.match(E.b.state().error.desc, /çöktü \(undefined\)/);
  const s = E.b.state(); s.url = 'değişti'; assert.notStrictEqual(E.b.state().url, 'değişti', 'durumun kopyası döner');
});

test('createBrowser: gezinme koruması, yeni pencereler, webview ve bluetooth', () => {
  const E = setup(); E.b.navigate('localhost'); const c = E.b.view.webContents;
  for (const name of ['will-navigate', 'will-redirect']) {
    const ok = ev(); c.fire(name, ok, 'https://example.com/'); assert.strictEqual(ok.prevented, false, name);
    for (const u of ['file:///etc/passwd', 'javascript:alert(1)', 'cpmedia://local/x.png', 'mailto:a@b.c']) {
      const e = ev(); c.fire(name, e, u); assert.ok(e.prevented, name + ' ' + u);
    }
  }
  assert.deepStrictEqual(E.last('browser:blocked'), { kind: 'scheme', url: '' });
  const wv = ev(); c.fire('will-attach-webview', wv); assert.ok(wv.prevented);
  let picked; const bt = ev(); c.fire('select-bluetooth-device', bt, [{ deviceId: 'a' }], id => { picked = id; }); assert.ok(bt.prevented); assert.strictEqual(picked, '');
  // window.open → sistem tarayıcısı (yalnızca http/https, art arda değil), pencere hiçbir zaman açılmaz
  assert.deepStrictEqual(c.openHandler({ url: 'https://a.com/' }), { action: 'deny' });
  assert.deepStrictEqual(c.openHandler({ url: 'https://b.com/' }), { action: 'deny' });
  E.tick(2000); c.openHandler({ url: 'file:///x' }); c.openHandler({ url: 'https://c.com/' });
  assert.deepStrictEqual(E.opened, ['https://a.com/', 'https://c.com/']);
  // indirme: oturum düzeyinde iptal, arayüze bildirilir
  const d = ev(); E.ses.fire('will-download', d, { getURL: () => 'https://a.com/f.zip' }); assert.ok(d.prevented);
  assert.deepStrictEqual(E.last('browser:blocked'), { kind: 'download', url: 'https://a.com/f.zip' });
  E.ses.fire('will-download', ev(), { getURL: () => 'blob:https://a.com/1' });
  assert.deepStrictEqual(E.last('browser:blocked'), { kind: 'download', url: '' });
});

test('createBrowser: komutlar', () => {
  const E = setup();
  assert.strictEqual(E.b.command('back'), false, 'görünüm yokken');
  assert.strictEqual(E.b.command('external'), false, 'adres yokken');
  E.b.navigate('localhost:3000'); const c = E.b.view.webContents;
  assert.strictEqual(E.b.command('back'), false); assert.strictEqual(E.b.command('forward'), false);
  c.back = c.fwd = true;
  assert.strictEqual(E.b.command('back'), true); assert.strictEqual(E.b.command('forward'), true);
  c.url = 'http://localhost:3000/'; assert.strictEqual(E.b.command('reload'), true);
  c.url = ''; assert.strictEqual(E.b.command('reload'), true); // sayfa hiç yüklenemediyse adres yeniden açılır
  c.failLoad = true; assert.strictEqual(E.b.command('reload'), true);
  assert.strictEqual(E.b.command('stop'), true);
  assert.deepStrictEqual(c.did, ['back', 'fwd', 'reload', 'stop']);
  assert.deepStrictEqual(c.loaded, ['http://localhost:3000/', 'http://localhost:3000/', 'http://localhost:3000/']);
  assert.strictEqual(E.b.command('yok'), false);
  assert.strictEqual(E.b.command('external'), true); assert.deepStrictEqual(E.opened, ['http://localhost:3000/']);
  const G = setup({ now: undefined }); G.b.navigate('localhost'); assert.strictEqual(G.b.command('external'), true, 'gerçek saat');
});

test('createBrowser: reload, adres boşsa bir şey yüklemez', () => {
  const E = setup(); E.b.navigate('localhost'); const c = E.b.view.webContents;
  // durumu boş adrese çeken bir gezinme olayı
  c.fire('did-navigate', {}, '');
  assert.strictEqual(E.b.command('reload'), true); assert.deepStrictEqual(c.loaded, ['http://localhost/']);
});

test('createBrowser: setBounds ve hide', () => {
  const E = setup();
  assert.strictEqual(E.b.setBounds({ x: 0, y: 0, width: 10, height: 10 }), false, 'görünüm yokken');
  E.b.hide();
  E.b.navigate('localhost'); const v = E.b.view;
  E.win.zoom = 1.25;
  assert.strictEqual(E.b.setBounds({ x: 100, y: 44, width: 400, height: 600 }), true);
  assert.deepStrictEqual([v.bounds, v.visible], [{ x: 125, y: 55, width: 500, height: 750 }, true]);
  assert.strictEqual(E.b.setBounds(null), false); assert.strictEqual(v.visible, false);
  E.b.setBounds({ x: 1, y: 1, width: 1, height: 1 }); E.b.hide(); assert.strictEqual(v.visible, false);
  E.b.setBounds({ x: 1, y: 1, width: 1, height: 1 }); E.win.dead = true;
  assert.strictEqual(E.b.setBounds({ x: 1, y: 1, width: 1, height: 1 }), false); assert.strictEqual(v.visible, false);
  const w = E.win; E.win = null; assert.strictEqual(E.b.setBounds({ x: 1, y: 1, width: 1, height: 1 }), false);
  E.win = fakeWin(); assert.strictEqual(E.b.setBounds({ x: 1, y: 1, width: 1, height: 1 }), false, 'başka pencereye ait görünüm gösterilmez');
  assert.ok(w);
});
