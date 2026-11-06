// Ekran kontrolü MCP sunucusu: anahtar/Host/Origin reddi, JSON-RPC, araçlar (girdi yardımcısı ve görüntü taklit), panel koruması,
// acil durdurma, çerçeve zamanlaması, günlük.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createScreenControl, TOOLS } = require('../src/main/screenctl');

const DISPLAYS = [
  { id: 2, primary: true, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, phys: { x: 0, y: 0, width: 3840, height: 2160 }, scale: 2 },
  { id: 1, name: 'Sol', bounds: { x: -1280, y: 0, width: 1280, height: 720 }, phys: { x: -1920, y: 0, width: 1920, height: 1080 } },
];
function fakeImg(w, h, log) {
  return {
    w, h, getSize: () => ({ width: w, height: h }),
    resize: o => { log.push(['resize', o.width, o.height]); return fakeImg(o.width, o.height, log); },
    crop: r => { log.push(['crop', r]); return fakeImg(r.width, r.height, log); },
    toJPEG: q => Buffer.from(`jpeg${q}:${w}x${h}`),
  };
}
function setup(over = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-ekran-'));
  const calls = [], ov = [], active = [], emerg = [], imgLog = [];
  const st = { hit: ['500', '42'], fg: ['600', '43'], pos: ['-960', '540'], fail: null };
  const input = {
    async send(cmd, ...a) { calls.push([cmd, ...a]); if (st.fail === cmd) throw new Error('Girdi hatası: x'); return st[cmd] || []; },
    cancel() { calls.push(['cancel']); }, close() { calls.push(['close']); },
  };
  const deps = {
    displays: () => DISPLAYS,
    capture: async (id, w, h) => { imgLog.push(['capture', id, w, h]); return st.noImage ? null : fakeImg(st.capW || w, st.capH || h, imgLog); },
    input,
    panel: () => ({ hwnds: ['111'], overlay: ['999'], pid: 42 * (st.samePid ? 1 : 0) || 7, rect: st.rect || null, focused: !!st.focused }),
    overlay: { show: s => ov.push(['show', s]), hide: () => ov.push(['hide']), ring: (m, p, k) => ov.push(['ring', m.index, p, k]), trail: (m, a, b) => ov.push(['trail', m.index, a, b]), beforeCapture: () => ov.push(['before']), afterCapture: () => ov.push(['after']) },
    onActive: on => active.push(on), onEmergency: ids => emerg.push(ids),
    logFile: path.join(dir, 'ekran-gunlugu.log'), actionDelay: 0, hideMs: 80, ...over,
  };
  const sc = createScreenControl(deps);
  return { sc, deps, calls, ov, active, emerg, imgLog, st, dir, done() { sc.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
}
function req(port, p, { method = 'POST', body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, path: p, method, headers: { 'Content-Type': 'application/json', ...headers } }, res => {
      let d = ''; res.setEncoding('utf8'); res.on('data', c => { d += c; });
      res.on('end', () => { let json = null; try { json = JSON.parse(d); } catch {} resolve({ status: res.statusCode, body: d, json, headers: res.headers }); });
    });
    r.on('error', reject);
    if (body !== undefined) r.write(typeof body === 'string' ? body : JSON.stringify(body));
    r.end();
  });
}
async function client(t, label = 'Premiere') {
  await t.sc.start();
  const e = t.sc.register('run-1', label);
  const u = new URL(e.url);
  const H = { Authorization: e.headers.Authorization };
  let id = 0;
  const call = async (name, args) => (await req(u.port, u.pathname, { headers: H, body: { jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name, arguments: args } } })).json.result;
  return { e, u, H, call, rpc: (method, params, extra = {}) => req(u.port, u.pathname, { headers: H, body: { jsonrpc: '2.0', id: ++id, method, params, ...extra } }) };
}
const txt = r => r.content.filter(c => c.type === 'text').map(c => c.text).join('\n');

test('register: sunucu başlamadan hata; MCP girdisi http + taşıyıcı anahtar; start iki kez aynı port', async () => {
  const t = setup();
  try {
    assert.throws(() => t.sc.register('r', 'x'), /başlamadı/);
    const port = await t.sc.start();
    assert.equal(await t.sc.start(), port);
    assert.equal(t.sc.port, port);
    const e = t.sc.register('r', '');
    assert.equal(e.type, 'http');
    assert.match(e.url, new RegExp(`^http://127\\.0\\.0\\.1:${port}/mcp/[A-Za-z0-9_-]{24}$`));
    assert.equal(e.headers.Authorization, 'Bearer ' + t.sc.token);
    assert.ok(Buffer.from(t.sc.token, 'base64url').length >= 32);
    assert.equal([...t.sc._test.runs.values()][0].label, 'Sohbet');
  } finally { t.done(); }
});

test('HTTP güvenliği: anahtarsız/yanlış anahtar 401, bilinmeyen yol 404, yanlış Host ve Origin 403, GET 405, bozuk JSON 400, büyük gövde 413', async () => {
  const t = setup();
  try {
    const { u, H } = await client(t);
    const init = { jsonrpc: '2.0', id: 1, method: 'ping' };
    assert.equal((await req(u.port, u.pathname, { body: init })).status, 401);
    assert.equal((await req(u.port, u.pathname, { body: init, headers: { Authorization: 'Bearer yanlis' } })).status, 401);
    assert.equal((await req(u.port, u.pathname, { body: init, headers: { Authorization: 'Basic ' + t.sc.token } })).status, 401);
    assert.equal((await req(u.port, '/mcp/' + 'a'.repeat(24), { body: init, headers: H })).status, 404);
    assert.equal((await req(u.port, '/baska', { body: init, headers: H })).status, 404);
    assert.equal((await req(u.port, u.pathname, { body: init, headers: { ...H, Host: 'evil.example:' + u.port } })).status, 403);
    assert.equal((await req(u.port, u.pathname, { body: init, headers: { ...H, Origin: 'https://evil.example' } })).status, 403);
    const g = await req(u.port, u.pathname, { method: 'GET', headers: H });
    assert.equal(g.status, 405); assert.equal(g.headers.allow, 'POST');
    const bad = await req(u.port, u.pathname, { body: '{bozuk', headers: H });
    assert.equal(bad.status, 400); assert.equal(bad.json.error.code, -32700);
    const big = await req(u.port, u.pathname, { body: 'x'.repeat((1 << 20) + 10), headers: H });
    assert.equal(big.status, 413);
    assert.equal((await req(u.port, u.pathname, { body: init, headers: H })).status, 200); // sunucu hâlâ çalışıyor
  } finally { t.done(); }
});

test('JSON-RPC: initialize sürüm anlaşması, bildirim 202, toplu istek, bilinmeyen yöntem, geçersiz istek, tools/list', async () => {
  const t = setup();
  try {
    const { u, H, rpc } = await client(t);
    const i1 = (await rpc('initialize', { protocolVersion: '2025-03-26' })).json.result;
    assert.equal(i1.protocolVersion, '2025-03-26');
    assert.deepEqual(i1.serverInfo, { name: 'claude-panel-ekran', version: '1.0.0' });
    assert.ok(i1.capabilities.tools);
    assert.equal((await rpc('initialize', { protocolVersion: '1999-01-01' })).json.result.protocolVersion, '2025-06-18');
    assert.equal((await rpc('initialize')).json.result.protocolVersion, '2025-06-18');
    const note = await req(u.port, u.pathname, { headers: H, body: { jsonrpc: '2.0', method: 'notifications/initialized' } });
    assert.equal(note.status, 202); assert.equal(note.body, '');
    assert.equal((await req(u.port, u.pathname, { headers: H, body: { jsonrpc: '2.0', id: null, method: 'ping' } })).status, 202);
    const batch = await req(u.port, u.pathname, { headers: H, body: [{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/x' }, { jsonrpc: '2.0', id: 2, method: 'yok' }] });
    assert.deepEqual(batch.json, [{ jsonrpc: '2.0', id: 1, result: {} }, { jsonrpc: '2.0', id: 2, error: { code: -32601, message: 'Yöntem yok: yok' } }]);
    assert.deepEqual((await req(u.port, u.pathname, { headers: H, body: { id: 5, method: 'ping' } })).json, { jsonrpc: '2.0', id: 5, error: { code: -32600, message: 'Geçersiz istek' } });
    assert.equal((await req(u.port, u.pathname, { headers: H, body: null })).json.id, null);
    assert.equal((await req(u.port, u.pathname, { headers: H, body: { jsonrpc: '2.0', id: 3, method: 7 } })).json.error.code, -32600);
    const list = (await rpc('tools/list')).json.result.tools;
    assert.deepEqual(list.map(x => x.name), ['ekran_listesi', 'ekran_goruntusu', 'yakinlastir', 'fare', 'klavye', 'imlec_konumu', 'bekle']);
    assert.deepEqual(list, TOOLS);
    for (const tool of list) { assert.equal(tool.inputSchema.type, 'object'); assert.ok(tool.description.length > 20); }
  } finally { t.done(); }
});

test('ekran_listesi ve ekran_goruntusu: görüntü boyutu, ölçek, imleç, çerçeve o monitörde', async () => {
  const t = setup();
  try {
    const { call } = await client(t);
    const l = JSON.parse(txt(await call('ekran_listesi', {})));
    assert.deepEqual(l, [
      { monitor: 0, ad: 'Sol', birincil: false, goruntu: '1280x720', fiziksel: '1920x1080', konum: '-1920,0', olcek: 1 },
      { monitor: 1, ad: null, birincil: true, goruntu: '1280x720', fiziksel: '3840x2160', konum: '0,0', olcek: 2 },
    ]);
    const r = await call('ekran_goruntusu', {});
    assert.equal(r.content[0].type, 'image'); assert.equal(r.content[0].mimeType, 'image/jpeg');
    assert.equal(Buffer.from(r.content[0].data, 'base64').toString(), 'jpeg80:1280x720');
    assert.match(txt(r), /Monitör 1: görüntü 1280×720 \(fiziksel 3840×2160\)/);
    assert.ok(!/İmleç/.test(txt(r))); // imleç sol monitörde
    assert.deepEqual(t.imgLog[0], ['capture', 2, 1280, 720]);
    assert.deepEqual(t.ov.slice(0, 3).map(x => x[0]), ['show', 'before', 'after']);
    assert.deepEqual(t.ov[0][1], { monitor: 1, labels: ['Premiere'], until: t.ov[0][1].until, bounds: DISPLAYS[0].bounds });
    assert.deepEqual(t.active, [true]);
    const r2 = await call('ekran_goruntusu', { monitor: 0 });
    assert.match(txt(r2), /Monitör 0.*İmleç: \(640, 360\)/s);
    // yakalanan kare farklı boyutta gelirse beklenen boyuta getirilir
    t.st.capW = 1000; t.st.capH = 500;
    await call('ekran_goruntusu', { monitor: 0 });
    assert.deepEqual(t.imgLog.at(-1), ['resize', 1280, 720]);
    t.st.noImage = true;
    const e = await call('ekran_goruntusu', { monitor: 0 });
    assert.equal(e.isError, true); assert.match(txt(e), /alınamadı \(monitör 0\)/);
    assert.equal(t.ov.at(-1)[0], 'after'); // hata olsa da çerçeve geri gelir
    t.st.noImage = false; t.st.fail = 'pos';
    assert.ok(!(await call('ekran_goruntusu', { monitor: 0 })).isError); // imleç okunamazsa görüntü yine döner
    assert.match(txt(await call('ekran_goruntusu', { monitor: 5 })), /Geçersiz monitör/);
  } finally { t.done(); }
});

test('yakinlastir: tam çözünürlükte kırpma, hatalı alan', async () => {
  const t = setup();
  try {
    const { call } = await client(t);
    const r = await call('yakinlastir', { monitor: 1, x: 100, y: 100, w: 200, h: 100 });
    assert.deepEqual(t.imgLog[0], ['capture', 2, 3840, 2160]);
    assert.deepEqual(t.imgLog.at(-1), ['crop', { x: 300, y: 300, width: 600, height: 300 }]);
    assert.equal(Buffer.from(r.content[0].data, 'base64').toString(), 'jpeg80:600x300');
    assert.match(txt(r), /tam çözünürlükte/);
    assert.match(txt(await call('yakinlastir', { x: 0, y: 0, w: 2, h: 2 })), /en az 4×4/);
  } finally { t.done(); }
});

test('fare: dönüşüm, işlemler, halka/iz efekti, panel koruması, sonra_goruntu', async () => {
  const t = setup();
  try {
    const { call } = await client(t);
    assert.match(txt(await call('fare', { islem: 'tikla', x: 640, y: 360, monitor: 0 })), /Tamam: tikla \(640, 360\), monitör 0/);
    assert.deepEqual(t.calls.slice(0, 2), [['hit', -960, 540], ['click', -960, 540, 1, 1]]);
    assert.deepEqual(t.ov.find(x => x[0] === 'ring'), ['ring', 0, { x: 640, y: 360 }, 'tikla']);
    t.calls.length = 0;
    await call('fare', { islem: 'tasi', x: 10, y: 10 }); // son kullanılan monitör (0); taşımada koruma yok
    await call('fare', { islem: 'cift_tikla', x: 0, y: 0 });
    await call('fare', { islem: 'sag_tikla', x: 0, y: 0 });
    await call('fare', { islem: 'orta_tikla', x: 0, y: 0 });
    await call('fare', { islem: 'kaydir', x: 0, y: 0, miktar: -2, yatay: true });
    await call('fare', { islem: 'kaydir', x: 0, y: 0 });
    assert.match(txt(await call('fare', { islem: 'surukle', x: 0, y: 0, x2: 100, y2: 50 })), /→ \(100, 50\)/);
    assert.deepEqual(t.calls.filter(c => c[0] !== 'hit'), [['move', -1905, 15], ['click', -1920, 0, 1, 2], ['click', -1920, 0, 2, 1], ['click', -1920, 0, 3, 1],
      ['wheel', -1920, 0, -2, 1], ['wheel', -1920, 0, 3, 0], ['drag', -1920, 0, -1770, 75, 20]]);
    assert.deepEqual(t.calls.filter(c => c[0] === 'hit').length, 7); // sürüklemede iki uç
    assert.deepEqual(t.ov.find(x => x[0] === 'trail'), ['trail', 0, { x: 0, y: 0 }, { x: 100, y: 50 }]);
    // panel koruması: HWND, aynı süreç, dikdörtgen (nokta çerçeve penceresine denk gelirse)
    t.st.hit = ['111', '1'];
    assert.match(txt(await call('fare', { islem: 'tikla', x: 1, y: 1 })), /Claude Panel penceresinin üstünde/);
    t.st.hit = ['5', '7'];
    assert.match(txt(await call('fare', { islem: 'tikla', x: 1, y: 1 })), /üstünde/);
    t.st.hit = ['999', '7']; t.st.rect = { x: -1920, y: 0, width: 100, height: 100 };
    assert.match(txt(await call('fare', { islem: 'tikla', x: 1, y: 1 })), /üstünde/);
    t.st.hit = ['0', '0'];
    assert.match(txt(await call('fare', { islem: 'surukle', x: 500, y: 500, x2: 1, y2: 1 })), /üstünde/); // bırakma noktası panelde
    t.st.rect = null; t.calls.length = 0;
    const r = await call('fare', { islem: 'tikla', x: 1, y: 1, sonra_goruntu: true });
    assert.equal(r.content[1].type, 'image');
    assert.equal(Buffer.from(r.content[1].data, 'base64').toString(), 'jpeg80:800x450');
    assert.match(txt(await call('fare', { islem: 'yok', x: 1, y: 1 })), /islem şunlardan/);
    assert.match(txt(await call('fare', { islem: 'tikla', x: 5000, y: 1 })), /dışında/);
    t.st.fail = 'click';
    const f = await call('fare', { islem: 'tikla', x: 1, y: 1 });
    assert.equal(f.isError, true); assert.match(txt(f), /Girdi hatası/);
  } finally { t.done(); }
});

test('klavye: tuş ve Türkçe metin, uzun metin parçalanır, odak panelde ise ret', async () => {
  const t = setup();
  try {
    const { call } = await client(t);
    assert.equal(txt(await call('klavye', { tus: 'ctrl+s' })), 'Tamam: ctrl+s');
    assert.deepEqual(t.calls.slice(0, 2), [['fg'], ['keys', 0x11, 0x53]]);
    assert.equal(txt(await call('klavye', { yazi: 'Çığ' })), 'Tamam: 3 karakter yazıldı.');
    assert.deepEqual(t.calls.at(-1), ['text', 'c7', '131', '11f']);
    t.calls.length = 0;
    await call('klavye', { yazi: 'a'.repeat(450) });
    assert.deepEqual(t.calls.filter(c => c[0] === 'text').map(c => c.length - 1), [200, 200, 50]);
    const r = await call('klavye', { tus: 'enter', sonra_goruntu: true });
    assert.equal(r.content[1].type, 'image');
    t.st.fg = ['111', '1'];
    assert.match(txt(await call('klavye', { yazi: 'x' })), /Odak Claude Panel/);
    t.st.fg = ['5', '6']; t.st.focused = true;
    assert.match(txt(await call('klavye', { tus: 'a' })), /Odak/);
    t.st.focused = false;
    assert.match(txt(await call('klavye', { tus: 'ctrl+alt+esc' })), /engellendi/);
    assert.match(txt(await call('klavye', {})), /yalnız biri/);
  } finally { t.done(); }
});

test('imlec_konumu, bekle, bilinmeyen araç, dizi argüman', async () => {
  const t = setup();
  try {
    const { call } = await client(t);
    assert.deepEqual(JSON.parse(txt(await call('imlec_konumu', {}))), { monitor: 0, x: 640, y: 360 });
    t.st.pos = ['99999', '0'];
    assert.equal(txt(await call('imlec_konumu')), 'İmleç hiçbir monitörde değil');
    assert.equal(txt(await call('bekle', { ms: 5 })), 'Beklendi');
    assert.match(txt(await call('bekle', [1])), /ms 0–10000/); // dizi → {}
    const u = await call('toString', {});
    assert.equal(u.isError, true); assert.match(txt(u), /Bilinmeyen araç: toString/);
  } finally { t.done(); }
});

test('günlük: araç, koordinat, yazının yalnız uzunluğu; 512 KB üstünde döner', async () => {
  const t = setup();
  try {
    const { call } = await client(t);
    await call('klavye', { yazi: 'gizli metin' });
    await call('fare', { islem: 'yok', x: 1, y: 1 });
    const lines = fs.readFileSync(t.deps.logFile, 'utf8').trim().split('\n').map(JSON.parse);
    assert.deepEqual(lines.map(l => [l.arac, l.yaziUzunlugu, l.runId]), [['klavye', 11, 'run-1'], ['fare', undefined, 'run-1']]);
    assert.match(lines[1].hata, /islem/);
    assert.ok(!fs.readFileSync(t.deps.logFile, 'utf8').includes('gizli'));
    fs.writeFileSync(t.deps.logFile, 'x'.repeat(600 * 1024));
    await call('bekle', { ms: 0 });
    assert.ok(fs.existsSync(t.deps.logFile + '.1'));
    assert.equal(fs.readFileSync(t.deps.logFile, 'utf8').trim().split('\n').length, 1);
    // günlük yazılamazsa araç yine çalışır; günlük dosyası verilmezse hiç yazılmaz
    const t2 = setup({ logFile: path.join(t.deps.logFile, 'alt', 'x.log') });
    try { assert.equal(txt(await (await client(t2)).call('bekle', { ms: 0 })), 'Beklendi'); } finally { t2.done(); }
    const t3 = setup({ logFile: null });
    try { assert.equal(txt(await (await client(t3)).call('bekle', { ms: 0 })), 'Beklendi'); assert.ok(!fs.existsSync(path.join(t3.dir, 'ekran-gunlugu.log'))); } finally { t3.done(); }
  } finally { t.done(); }
});

test('çerçeve: son eylemden sonra söner; monitör çıkarılınca gizlenir; release yolu kapatır ve kısayolu bırakır', async () => {
  const t = setup();
  try {
    const { call, u, H } = await client(t);
    await call('fare', { islem: 'tasi', x: 1, y: 1, monitor: 1 });
    assert.equal(t.ov[0][0], 'show');
    await new Promise(r => setTimeout(r, 200));
    assert.equal(t.ov.at(-1)[0], 'hide');
    assert.deepEqual(t.active, [true]); // kısayol tur bitene kadar kayıtlı
    t.sc.release('run-1');
    assert.deepEqual(t.active, [true, false]);
    assert.equal((await req(u.port, u.pathname, { headers: H, body: { jsonrpc: '2.0', id: 1, method: 'ping' } })).status, 404);
    t.sc.release('yok'); // bilinmeyen tur: sorun yok
    // monitör listesi boşalırsa (ekran çıkarıldı) çerçeve gizlenir
    const t2 = setup({ hideMs: 10000 });
    try {
      const c2 = await client(t2);
      await c2.call('fare', { islem: 'tasi', x: 1, y: 1, monitor: 0 });
      t2.deps.displays = () => [];
      t2.sc.release('baska'); // yeniden değerlendirme
      assert.equal(t2.ov.at(-1)[0], 'hide');
      assert.deepEqual(t2.active, [true]); // run-1 hâlâ kayıtlı
    } finally { t2.done(); }
  } finally { t.done(); }
});

test('acil durdurma: girdiler iptal, turlar bildirilir, sonraki araç çağrıları reddedilir; onActive hatası yutulur', async () => {
  const t = setup({ onActive: () => { throw new Error('kısayol'); } });
  try {
    const { call } = await client(t);
    t.sc.register('run-2', 'İkinci'); // ekranı hiç kullanmadı: durdurulmaz
    await call('ekran_goruntusu', {});
    const ids = t.sc.emergencyStop();
    assert.deepEqual(ids, ['run-1']);
    assert.deepEqual(t.emerg, [['run-1']]);
    assert.ok(t.calls.some(c => c[0] === 'cancel'));
    assert.equal(t.ov.at(-1)[0], 'hide');
    const r = await call('ekran_goruntusu', {});
    assert.equal(r.isError, true); assert.match(txt(r), /durduruldu \(Ctrl\+Alt\+Esc\)/);
    assert.match(fs.readFileSync(t.deps.logFile, 'utf8'), /"arac":"acil_durdurma","runlar":1/);
    t.sc.release('run-1'); // durdurma işareti temizlenir
    const t2 = setup({ onEmergency: () => { throw new Error('x'); } });
    try { await client(t2); assert.deepEqual(t2.sc.emergencyStop(), []); } finally { t2.done(); }
  } finally { t.done(); }
});

test('close: sunucu kapanır, girdi yardımcısı kapatılır; ikinci close sorunsuz', async () => {
  const t = setup();
  await t.sc.start();
  t.sc.close();
  assert.equal(t.sc.port, 0);
  assert.deepEqual(t.calls.at(-1), ['close']);
  t.done();
});

test('varsayılanlar: 4 sn çerçeve, 350 ms eylem sonrası bekleme, çerçeve listesi olmayan panel, Error olmayan hata', async () => {
  const t = setup({ hideMs: undefined, actionDelay: undefined });
  try {
    const base = t.deps.panel;
    t.deps.panel = () => ({ ...base(), overlay: undefined });
    t.deps.input.send = async cmd => { if (cmd === 'keys') throw 'düz metin hata'; return cmd === 'hit' ? ['5', '1'] : []; }; // eslint-disable-line no-throw-literal
    const { call } = await client(t);
    const t0 = Date.now();
    await call('fare', { islem: 'tasi', x: 1, y: 1, sonra_goruntu: true });
    assert.ok(Date.now() - t0 >= 300);
    assert.ok(t.ov[0][1].until - Date.now() > 3000);
    assert.equal(txt(await call('klavye', { tus: 'a' })), 'düz metin hata');
  } finally { t.done(); }
});
