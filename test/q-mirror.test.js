// mirror.js ayrıntılı testleri: ad temizleme, büyük/küçük harf çakışmaları, başarısız adımlarda veri kaybı olmaması,
// bozuk/kötü niyetli yapı dosyası, sahiplenme kuralları, Windows davranışı ve zamanlayıcı (schedule/setReady/flush).
// Her test kendi geçici kökünü kullanır ve bitince siler.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMirror, clean, defaultRoot, DEFAULT_ROOT, MANIFEST, TRASH, RECOVER, EXT } = require('../src/main/mirror');

const KIND = 'claude-panel-sohbet';
function mk(t) {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cp-qmir-')));
  t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  return d;
}
function setup(t, { sessions = [], folders = [], meta = {}, ...opts } = {}) {
  const base = mk(t), root = path.join(base, 'kok');
  const S = { sessions };
  const m = createMirror({ root, getSessions: () => S.sessions, ...opts });
  const ws = { folders, meta, items: [] };
  const sync = () => m.syncNow(ws);
  const ok = () => { const r = sync(); assert.deepStrictEqual(r.errors, []); return r; };
  const p = (...rel) => path.join(root, ...rel);
  const has = (...rel) => fs.existsSync(p(...rel));
  const ls = (...rel) => fs.readdirSync(p(...rel)).filter(n => n !== MANIFEST).sort();
  const man = () => JSON.parse(fs.readFileSync(p(MANIFEST), 'utf8'));
  const chat = (...rel) => JSON.parse(fs.readFileSync(p(...rel), 'utf8'));
  const put = (rel, v) => { fs.mkdirSync(path.dirname(p(rel)), { recursive: true }); fs.writeFileSync(p(rel), typeof v === 'string' ? v : JSON.stringify(v)); };
  return { base, root, S, m, ws, sync, ok, p, has, ls, man, chat, put };
}
/** fs fonksiyonunu, koşul tutunca hata fırlatacak şekilde sarar (mock.restore() ya da test sonu eski hâline döner). */
function fail(t, name, when, code = 'EBUSY') {
  const orig = fs[name];
  return t.mock.method(fs, name, function (...a) {
    if (when(...a)) { const e = new Error(code); e.code = code; throw e; }
    return orig.apply(fs, a);
  });
}
const sess = (id, title, extra) => ({ id, title, cwd: '/p/' + id, file: '/x/' + id + '.jsonl', ...extra });
const ids = (t, ...rel) => t.ls(...rel).filter(n => n.endsWith(EXT)).map(n => t.chat(...rel, n).id).sort();

// ---------------------------------------------------------------- defaultRoot / clean

test('defaultRoot: ortam değişkeni önce gelir; Windows\'ta C:\\Claude Panel, diğerlerinde kapalı', () => {
  assert.strictEqual(defaultRoot('win32', {}), 'C:\\Claude Panel');
  assert.strictEqual(defaultRoot('darwin', {}), null);
  assert.strictEqual(defaultRoot('linux', {}), null);
  assert.strictEqual(defaultRoot('darwin', { CLAUDE_PANEL_MIRROR: '/x' }), '/x');
  assert.strictEqual(defaultRoot('win32', { CLAUDE_PANEL_MIRROR: 'D:\\y' }), 'D:\\y');
  assert.strictEqual(DEFAULT_ROOT, defaultRoot());
});

test('clean: geçersiz ve kontrol karakterleri boşluğa döner, boşluklar sadeleşir', () => {
  assert.strictEqual(clean('a\u0000b\u001fc\td\ne', 80), 'a b c d e');
  assert.strictEqual(clean('a//\\\\b', 80), 'a b');
  assert.strictEqual(clean('a/b:c*d?"e<f>g|h', 80), 'a b c d e f g h');
  assert.strictEqual(clean('  çok    boşluk  ', 80), 'çok boşluk');
  assert.strictEqual(clean('a\u007fb', 80), 'a\u007fb', 'DEL Windows\'ta geçerli, dokunulmaz');
});

test('clean: sonundaki nokta ve boşluk atılır; boş kalırsa Adsız', () => {
  assert.strictEqual(clean('ad...', 80), 'ad');
  assert.strictEqual(clean('ad. . .', 80), 'ad');
  assert.strictEqual(clean('...', 80), 'Adsız');
  assert.strictEqual(clean('   ', 80), 'Adsız');
  assert.strictEqual(clean('<>|', 80), 'Adsız');
  assert.strictEqual(clean(null, 80), 'Adsız');
  assert.strictEqual(clean(undefined, 80), 'Adsız');
  assert.strictEqual(clean(42, 80), '42');
  assert.strictEqual(clean('.gizli', 80), '.gizli', 'baştaki nokta kalır');
});

test('clean: uzunluk sınırı; kesimden sonra kalan son nokta/boşluk da atılır', () => {
  assert.strictEqual(clean('a'.repeat(100), 70), 'a'.repeat(70));
  assert.strictEqual(clean('abc def', 4), 'abc');
  assert.strictEqual(clean('abc.def', 4), 'abc');
  assert.strictEqual(clean('abcdef', 6), 'abcdef');
});

test('clean: kesim emojiyi ortadan bölmez (yarım vekil karakter kalmaz)', () => {
  const e = '😀'; // 2 UTF-16 birimi
  const r = clean('a'.repeat(69) + e + 'b', 70);
  assert.strictEqual(r, 'a'.repeat(69));
  assert.ok(r.isWellFormed());
  assert.strictEqual(clean('a'.repeat(68) + e + 'b', 70), 'a'.repeat(68) + e);
  assert.strictEqual(clean(e.repeat(3), 5), e + e);
  assert.strictEqual(clean('x\ud800y', 80), 'x\ufffdy', 'girdideki yarım vekil de düzeltilir');
});

test('clean: Windows ayrılmış adları (uzantılı, büyük/küçük harfli) güvenli ada çevrilir', () => {
  for (const n of ['CON', 'con', 'PRN', 'AUX', 'NUL', 'COM1', 'com9', 'COM0', 'LPT1', 'lpt0', 'COM¹', 'LPT³', 'CONIN$', 'conout$'])
    assert.strictEqual(clean(n, 80), n + '_', n);
  assert.strictEqual(clean('aux.v2', 80), 'aux_.v2');
  assert.strictEqual(clean('Con.tar.gz', 80), 'Con_.tar.gz');
  assert.strictEqual(clean('nul .txt', 80), 'nul _.txt', 'nokta öncesi boşluk Windows\'ta yine ayrılmış ad');
  for (const n of ['console', 'COM10', 'comx', 'xcon', 'auxiliary', 'LPT', 'a.con'])
    assert.strictEqual(clean(n, 80), n, n + ' ayrılmış değil');
});

// ---------------------------------------------------------------- temel yansı

test('yansı: kök yoksa oluşturulur; sohbet dosyası içeriği beklenen alanları taşır', t => {
  const T = setup(t, {
    sessions: [sess('u1', 'Logo'), { id: 'u2', title: 'Tek', project: '/proj' }, { id: 'u3' }],
    folders: [{ id: 'fA', name: 'A' }], meta: { 's:u1': { folder: 'fA', alias: 'Logo yeni' } },
  });
  assert.ok(!fs.existsSync(T.root));
  T.ok();
  assert.deepStrictEqual(T.chat('A', 'Logo yeni' + EXT), { tur: KIND, v: 1, id: 'u1', baslik: 'Logo yeni', proje: '/p/u1', klasor: 'A', model: null, kayit: '/x/u1.jsonl' });
  assert.deepStrictEqual(T.chat('Tek' + EXT), { tur: KIND, v: 1, id: 'u2', baslik: 'Tek', proje: '/proj', klasor: '.', model: null, kayit: null });
  assert.strictEqual(T.chat('Adsız sohbet' + EXT).baslik, 'Adsız sohbet');
  assert.strictEqual(T.chat('Adsız sohbet' + EXT).proje, null);
  const M = T.man();
  assert.strictEqual(M.tur, 'claude-panel-yapi'); assert.strictEqual(M.v, 1);
  assert.deepStrictEqual(M.folders, { fA: 'A' });
  assert.deepStrictEqual(M.chats, { u1: path.join('A', 'Logo yeni' + EXT), u2: 'Tek' + EXT, u3: 'Adsız sohbet' + EXT });
  assert.deepStrictEqual(M.workspace, T.ws);
  assert.ok(!Number.isNaN(Date.parse(M.savedAt)));
  assert.deepStrictEqual(T.m.readWorkspace(), T.ws);
  assert.ok(!T.has(MANIFEST + '.tmp'));
});

test('yansı: model alanı yazılır; değişmeyen dosya yeniden yazılmaz', t => {
  const T = setup(t, { sessions: [sess('u1', 'X', { model: 'opus' })] });
  T.ok();
  assert.strictEqual(T.chat('X' + EXT).model, 'opus');
  const ino = fs.statSync(T.p('X' + EXT)).ino;
  T.ok();
  assert.strictEqual(fs.statSync(T.p('X' + EXT)).ino, ino);
  T.S.sessions[0].model = 'sonnet'; T.ok();
  assert.strictEqual(T.chat('X' + EXT).model, 'sonnet');
});

test('yansı: gizli klasör/sohbet yansımaz, kimliksiz ya da boş klasör kaydı yok sayılır', t => {
  const T = setup(t, {
    sessions: [sess('u1', 'Gizli'), sess('u2', 'Görünür')],
    folders: [null, { name: 'Kimliksiz' }, { id: 'fH', name: 'Saklı', hidden: true }, { id: 'fV', name: 'Var' }],
    meta: { 's:u1': { hidden: true }, 's:u2': { folder: 'fH' } },
  });
  T.ok();
  assert.deepStrictEqual(T.ls(), ['Görünür' + EXT, 'Var'], 'gizli klasördeki sohbet köke düşer');
  assert.deepStrictEqual(Object.keys(T.man().folders), ['fV']);
});

test('yansı: getSessions verilmezse ya da null dönerse sohbetsiz çalışır', t => {
  const base = mk(t);
  const a = createMirror({ root: path.join(base, 'a') });
  assert.deepStrictEqual(a.syncNow({ folders: [{ id: 'f', name: 'F' }] }).errors, []);
  assert.ok(fs.existsSync(path.join(base, 'a', 'F')));
  const b = createMirror({ root: path.join(base, 'b'), getSessions: () => null });
  assert.deepStrictEqual(b.syncNow({}).errors, []);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(base, 'b', MANIFEST), 'utf8')).chats, {});
});

test('yansı: kök yoksa ya da workspace verilmezse hiçbir şey yapılmaz', t => {
  const m = createMirror({ root: null, getSessions: () => [sess('u', 'x')] });
  assert.strictEqual(m.root, null);
  assert.deepStrictEqual(m.syncNow({ folders: [] }), { errors: [] });
  assert.strictEqual(m.readWorkspace(), null);
  m.schedule({ folders: [] }); m.setReady(); m.flush();
  assert.deepStrictEqual(m.status, { root: null, ok: true });
  const T = setup(t);
  assert.deepStrictEqual(T.m.syncNow(null), { errors: [] });
  assert.ok(!fs.existsSync(T.root));
});

test('yansı: döngüsel üst klasör kaydı sonsuz döngüye girmez', t => {
  const T = setup(t, { folders: [{ id: 'a', name: 'A', parent: 'b' }, { id: 'b', name: 'B', parent: 'a' }, { id: 'c', name: 'C', parent: 'c' }] });
  T.ok();
  const M = T.man().folders;
  assert.deepStrictEqual(Object.keys(M).sort(), ['a', 'b', 'c']);
  for (const r of Object.values(M)) assert.ok(fs.statSync(T.p(r)).isDirectory());
});

test('yansı: klasörler derinlik sırasıyla kurulur (alt klasör önce gelse de üstün içine girer)', t => {
  const T = setup(t, { folders: [{ id: 'c', name: 'Torun', parent: 'b' }, { id: 'b', name: 'Çocuk', parent: 'a' }, { id: 'a', name: 'Ata' }] });
  T.ok();
  assert.ok(T.has('Ata', 'Çocuk', 'Torun'));
  assert.deepStrictEqual(T.ls(), ['Ata']);
});

test('yansı: üst klasörü olmayan ya da var olmayan üste bağlı klasör köke yerleşir', t => {
  const T = setup(t, { folders: [{ id: 'a', name: 'Yetim', parent: 'yok' }] });
  T.ok();
  assert.ok(T.has('Yetim'));
});

// ---------------------------------------------------------------- ad çakışmaları

test('yansı: yalnızca büyük/küçük harfle ayrılan sohbet adları birbirinin üzerine yazmaz', t => {
  const T = setup(t, { sessions: [sess('u1', 'Ali'), sess('u2', 'ALI'), sess('u3', 'ali')] });
  T.ok();
  const names = T.ls();
  assert.strictEqual(names.length, 3);
  assert.strictEqual(new Set(names.map(n => n.toLowerCase())).size, 3, 'diskte farklı adlar');
  assert.deepStrictEqual(ids(T), ['u1', 'u2', 'u3']);
  T.ok(); // ikinci geçiş adları değiştirmez
  assert.deepStrictEqual(T.ls(), names);
});

test('yansı: Türkçe İ/ı/I/i farkı da çakışma sayılır', t => {
  const T = setup(t, { sessions: [sess('u1', 'İzmir'), sess('u2', 'izmir'), sess('u3', 'Işık'), sess('u4', 'ışık'), sess('u5', 'ISIK')] });
  T.ok();
  assert.strictEqual(T.ls().length, 5);
  assert.deepStrictEqual(ids(T), ['u1', 'u2', 'u3', 'u4', 'u5']);
});

test('yansı: aynı başlıklı sohbetlerin numarası kimliğe göre sabittir', t => {
  const T = setup(t, { sessions: [sess('b', 'Aynı'), sess('a', 'Aynı'), sess('c', 'Aynı')] });
  T.ok();
  assert.strictEqual(T.chat('Aynı' + EXT).id, 'a');
  assert.strictEqual(T.chat('Aynı (2)' + EXT).id, 'b');
  assert.strictEqual(T.chat('Aynı (3)' + EXT).id, 'c');
  T.S.sessions.reverse(); T.ok();
  assert.strictEqual(T.chat('Aynı' + EXT).id, 'a', 'liste sırası değişince adlar kaymaz');
});

test('yansı: farklı klasörlerdeki aynı adlı sohbetler numaralanmaz', t => {
  const T = setup(t, { sessions: [sess('u1', 'Not'), sess('u2', 'Not')], folders: [{ id: 'f', name: 'F' }], meta: { 's:u2': { folder: 'f' } } });
  T.ok();
  assert.ok(T.has('Not' + EXT) && T.has('F', 'Not' + EXT));
});

test('yansı: yalnızca büyük/küçük harfle ayrılan klasör adları ayrı dizin olur', t => {
  const T = setup(t, { folders: [{ id: 'f1', name: 'Proje' }, { id: 'f2', name: 'PROJE' }], sessions: [sess('u1', 'a'), sess('u2', 'b')], meta: { 's:u1': { folder: 'f1' }, 's:u2': { folder: 'f2' } } });
  T.ok();
  const M = T.man().folders;
  assert.notStrictEqual(M.f1.toLowerCase(), M.f2.toLowerCase());
  assert.deepStrictEqual(ids(T, M.f1), ['u1']);
  assert.deepStrictEqual(ids(T, M.f2), ['u2']);
});

test('yansı: panelin ayrılmış adları (Çöp Kutusu, Kurtarılan dosyalar, yapı dosyası) klasör/sohbet adı olamaz', t => {
  const T = setup(t, {
    folders: [{ id: 'a', name: TRASH }, { id: 'b', name: RECOVER.toUpperCase() }, { id: 'c', name: MANIFEST }],
    sessions: [sess('u1', 'Yapı')],
  });
  T.ok();
  const M = T.man().folders;
  assert.strictEqual(M.a, TRASH + ' (2)');
  assert.strictEqual(M.b, RECOVER.toUpperCase() + ' (2)');
  assert.strictEqual(M.c, MANIFEST + ' (2)');
});

test('yansı: emoji içeren uzun başlığın dosyası her geçişte yeniden yazılmaz', t => {
  const title = 'x'.repeat(69) + '😀 son kısım';
  const T = setup(t, { sessions: [sess('u1', title)] });
  T.ok();
  assert.deepStrictEqual(T.ls(), ['x'.repeat(69) + EXT]);
  const ino = fs.statSync(T.p('x'.repeat(69) + EXT)).ino;
  T.ok(); T.ok();
  assert.deepStrictEqual(T.ls(), ['x'.repeat(69) + EXT]);
  assert.strictEqual(fs.statSync(T.p('x'.repeat(69) + EXT)).ino, ino);
});

test('yansı: ayrılmış Windows adlı sohbet/klasör güvenli adla yazılır', t => {
  const T = setup(t, { sessions: [sess('u1', 'aux.v2'), sess('u2', 'CON')], folders: [{ id: 'f', name: 'nul' }] });
  T.ok();
  assert.deepStrictEqual(T.ls(), ['CON_' + EXT, 'aux_.v2' + EXT, 'nul_']);
});

// ---------------------------------------------------------------- yeniden adlandırma / taşıma

test('yansı: yalnızca harf büyüklüğü değişen klasör yerinde yeniden adlandırılır', t => {
  const T = setup(t, { folders: [{ id: 'f', name: 'proje' }], sessions: [sess('u', 'a')], meta: { 's:u': { folder: 'f' } } });
  T.ok();
  const ino = fs.statSync(T.p('proje')).ino;
  T.ws.folders[0].name = 'Proje'; T.ok();
  assert.deepStrictEqual(T.ls(), ['Proje']);
  assert.strictEqual(fs.statSync(T.p('Proje')).ino, ino);
  assert.strictEqual(T.man().folders.f, 'Proje');
  assert.ok(T.has('Proje', 'a' + EXT));
});

test('yansı: harf büyüklüğü değişikliği başarısız olursa klasör eski adıyla kalır, sonra düzelir', t => {
  const T = setup(t, { folders: [{ id: 'f', name: 'proje' }] });
  T.ok();
  T.ws.folders[0].name = 'Proje';
  const mock = fail(t, 'renameSync', (a, b) => a === T.p('proje'));
  assert.deepStrictEqual(T.sync().errors, ['ad Proje: EBUSY']);
  assert.deepStrictEqual(T.ls(), ['proje']);
  assert.strictEqual(T.man().folders.f, 'proje');
  mock.mock.restore(); T.ok();
  assert.deepStrictEqual(T.ls(), ['Proje']);
});

test('yansı: yalnızca harf büyüklüğü değişen sohbet adı tek dosya bırakır', t => {
  const T = setup(t, { sessions: [sess('u', 'ali')] });
  T.ok();
  T.ws.meta['s:u'] = { alias: 'Ali' }; T.ok();
  assert.deepStrictEqual(T.ls().map(n => n.toLowerCase()), ['ali' + EXT]);
  assert.strictEqual(T.chat('Ali' + EXT).baslik, 'Ali');
});

test('yansı: üç klasörün adları döngüsel değişince içerikler doğru yerde kalır', t => {
  const T = setup(t, {
    folders: [{ id: 'f1', name: 'A' }, { id: 'f2', name: 'B' }, { id: 'f3', name: 'C' }],
    sessions: [sess('u1', 'bir'), sess('u2', 'iki'), sess('u3', 'üç')],
    meta: { 's:u1': { folder: 'f1' }, 's:u2': { folder: 'f2' }, 's:u3': { folder: 'f3' } },
  });
  T.ok();
  const ino = { f1: fs.statSync(T.p('A')).ino, f2: fs.statSync(T.p('B')).ino, f3: fs.statSync(T.p('C')).ino };
  T.ws.folders[0].name = 'B'; T.ws.folders[1].name = 'C'; T.ws.folders[2].name = 'A';
  T.ok();
  assert.deepStrictEqual(T.ls(), ['A', 'B', 'C']);
  assert.strictEqual(fs.statSync(T.p('B')).ino, ino.f1);
  assert.strictEqual(fs.statSync(T.p('C')).ino, ino.f2);
  assert.strictEqual(fs.statSync(T.p('A')).ino, ino.f3);
  assert.deepStrictEqual(ids(T, 'B'), ['u1']); assert.deepStrictEqual(ids(T, 'C'), ['u2']); assert.deepStrictEqual(ids(T, 'A'), ['u3']);
});

test('yansı: üst klasör yeniden adlandırılınca alt klasörün kayıtlı yolu da güncellenir', t => {
  const T = setup(t, {
    folders: [{ id: 'p', name: 'Üst' }, { id: 'c', name: 'Alt', parent: 'p' }],
    sessions: [sess('u', 's')], meta: { 's:u': { folder: 'c' } },
  });
  T.ok();
  const ino = fs.statSync(T.p('Üst', 'Alt')).ino;
  T.ws.folders[0].name = 'Yeni üst'; T.ws.folders[1].name = 'Yeni alt'; T.ok();
  assert.deepStrictEqual(T.ls(), ['Yeni üst']);
  assert.deepStrictEqual(T.ls('Yeni üst'), ['Yeni alt']);
  assert.strictEqual(fs.statSync(T.p('Yeni üst', 'Yeni alt')).ino, ino);
  assert.deepStrictEqual(T.man().folders, { p: 'Yeni üst', c: path.join('Yeni üst', 'Yeni alt') });
});

// ---------------------------------------------------------------- başarısız adımlar: veri kaybı yok

test('yansı: taşıma başarısız olursa klasör eski yerinde kalır, Kurtarılan dosyalar\'a gitmez; sonra taşınır', t => {
  const T = setup(t, {
    folders: [{ id: 'fA', name: 'A' }, { id: 'fB', name: 'B', parent: 'fA' }],
    sessions: [sess('u1', 'sohbet')], meta: { 's:u1': { folder: 'fB' } },
  });
  T.ok();
  T.put('A/B/not.txt', 'kullanıcı');
  T.ws.folders[1].parent = null;
  const mock = fail(t, 'renameSync', a => a === T.p('A', 'B'));
  const r = T.sync();
  assert.deepStrictEqual(r.errors, [`taşı ${path.join('A', 'B')} → B: EBUSY`]);
  assert.ok(T.has('A', 'B', 'not.txt')); assert.ok(T.has('A', 'B', 'sohbet' + EXT));
  assert.ok(!T.has(RECOVER)); assert.ok(!T.has('B'));
  assert.strictEqual(T.man().folders.fB, path.join('A', 'B'));
  assert.strictEqual(T.man().chats.u1, path.join('A', 'B', 'sohbet' + EXT));
  mock.mock.restore(); T.ok();
  assert.ok(T.has('B', 'not.txt')); assert.ok(T.has('B', 'sohbet' + EXT)); assert.ok(!T.has('A', 'B'));
});

test('yansı: üst dizin oluşturulamazsa klasör eski yerinde kalır (kaldırılmış sayılmaz)', t => {
  const T = setup(t, {
    folders: [{ id: 'fA', name: 'A' }, { id: 'fB', name: 'B', parent: 'fA' }],
    sessions: [sess('u1', 'bir'), sess('u2', 'iki')], meta: { 's:u1': { folder: 'fB' } },
  });
  T.ok();
  T.put('A/B/çekim.mp4', 'x');
  T.ws.folders[0].trashed = true; T.ws.meta['s:u2'] = { trashed: true };
  const mock = fail(t, 'mkdirSync', d => d === T.p(TRASH));
  const r = T.sync();
  assert.deepStrictEqual(r.errors, [`dizin ${TRASH}: EBUSY`, `dizin ${TRASH}: EBUSY`]);
  assert.ok(T.has('A', 'B', 'çekim.mp4')); assert.ok(T.has('A', 'B', 'bir' + EXT));
  assert.ok(T.has('iki' + EXT), 'çöpe taşınamayan sohbet dosyası silinmez');
  assert.ok(!T.has(RECOVER));
  assert.deepStrictEqual(T.man().folders, { fA: 'A', fB: path.join('A', 'B') });
  assert.strictEqual(T.man().chats.u2, 'iki' + EXT);
  mock.mock.restore(); T.ok();
  assert.ok(T.has(TRASH, 'A', 'B', 'çekim.mp4')); assert.ok(T.has(TRASH, 'iki' + EXT)); assert.ok(!T.has('A')); assert.ok(!T.has('iki' + EXT));
});

test('yansı: yeni klasör oluşturulamazsa başka adla denenmez; sohbet köke düşer, sonra yerine geçer', t => {
  const T = setup(t, { folders: [{ id: 'f', name: 'Yeni' }], sessions: [sess('u', 's')], meta: { 's:u': { folder: 'f' } } });
  const mock = fail(t, 'mkdirSync', d => d === T.p('Yeni'), 'EPERM');
  assert.deepStrictEqual(T.sync().errors, ['oluştur Yeni: EPERM']);
  assert.deepStrictEqual(T.ls(), ['s' + EXT]);
  assert.deepStrictEqual(T.man().folders, {});
  mock.mock.restore(); T.ok();
  assert.deepStrictEqual(T.ls(), ['Yeni']);
  assert.ok(T.has('Yeni', 's' + EXT));
});

test('yansı: sohbet dosyası yazılamazsa eski dosya yerinde kalır ve yapı dosyası onu gösterir', t => {
  const T = setup(t, { sessions: [sess('u', 'Eski')] });
  T.ok();
  T.ws.meta['s:u'] = { alias: 'Yeni' };
  const mock = fail(t, 'writeFileSync', f => String(f).endsWith('Yeni' + EXT + '.tmp'));
  assert.deepStrictEqual(T.sync().errors, ['yaz Yeni' + EXT + ': EBUSY']);
  assert.deepStrictEqual(T.ls(), ['Eski' + EXT]);
  assert.strictEqual(T.man().chats.u, 'Eski' + EXT);
  mock.mock.restore(); T.ok();
  assert.deepStrictEqual(T.ls(), ['Yeni' + EXT]);
});

test('yansı: yazılamayıp eski yerinde kalan sohbet dosyasının adını aynı başlıklı yeni sohbet almaz', t => {
  const T = setup(t, { sessions: [sess('u', 'Zeki')] });
  T.ok();
  T.ws.meta['s:u'] = { alias: 'Ali' };            // u yeniden adlandırıldı ama yeni dosyası yazılamıyor
  T.S.sessions = [sess('u', 'Zeki'), sess('v', 'Zeki')]; // eski adı taşıyan yeni bir sohbet geldi (sırada u'dan sonra)
  const mock = fail(t, 'writeFileSync', f => String(f).endsWith('Ali' + EXT + '.tmp'));
  assert.deepStrictEqual(T.sync().errors, ['yaz Ali' + EXT + ': EBUSY']);
  assert.strictEqual(T.chat('Zeki' + EXT).id, 'u');  // u'nun dosyasının üzerine yazılmadı
  assert.strictEqual(T.chat('Zeki (2)' + EXT).id, 'v');
  assert.deepStrictEqual(T.man().chats, { u: 'Zeki' + EXT, v: 'Zeki (2)' + EXT });
  mock.mock.restore(); T.ok();
  assert.deepStrictEqual(T.ls(), ['Ali' + EXT, 'Zeki' + EXT]);
  assert.strictEqual(T.chat('Zeki' + EXT).id, 'v');
});

test('yansı: ilk yazım başarısız olursa olmayan dosya yapıya girmez', t => {
  const T = setup(t, { sessions: [sess('u', 'X')] });
  fail(t, 'renameSync', a => String(a).endsWith(EXT + '.tmp'));
  assert.deepStrictEqual(T.sync().errors, ['yaz X' + EXT + ': EBUSY']);
  assert.deepStrictEqual(T.man().chats, {});
});

test('yansı: eski kayıt başka sohbetin dosyasını gösteriyorsa sahiplenilmez', t => {
  const T = setup(t, { sessions: [sess('u1', 'Bir'), sess('u2', 'İki')] });
  T.ok();
  // u1'in kaydını elle u2'nin dosyasına çevir
  const M = T.man(); M.chats.u1 = 'İki' + EXT; fs.writeFileSync(T.p(MANIFEST), JSON.stringify(M));
  T.ws.meta['s:u1'] = { alias: 'Üç' };
  fail(t, 'writeFileSync', f => String(f).endsWith('Üç' + EXT + '.tmp'));
  T.sync();
  assert.ok(!('u1' in T.man().chats));
  assert.strictEqual(T.man().chats.u2, 'İki' + EXT);
});

test('yansı: geçici ada çekme başarısız olursa iki klasör de korunur', t => {
  const T = setup(t, {
    folders: [{ id: 'f1', name: 'A' }, { id: 'f2', name: 'B' }],
    sessions: [sess('u1', 'bir'), sess('u2', 'iki')], meta: { 's:u1': { folder: 'f1' }, 's:u2': { folder: 'f2' } },
  });
  T.ok();
  T.ws.folders[0].name = 'B'; T.ws.folders[1].name = 'A';
  const mock = fail(t, 'renameSync', (a, b) => String(b).includes(' ~'));
  const r = T.sync();
  assert.ok(r.errors.some(e => e.startsWith('geçici ')), r.errors.join());
  const M = T.man().folders;
  assert.deepStrictEqual(ids(T, M.f1), ['u1']); assert.deepStrictEqual(ids(T, M.f2), ['u2']);
  mock.mock.restore(); T.ok(); T.ok();
  assert.deepStrictEqual(T.man().folders, { f1: 'B', f2: 'A' });
  assert.deepStrictEqual(ids(T, 'B'), ['u1']); assert.deepStrictEqual(ids(T, 'A'), ['u2']);
  assert.deepStrictEqual(T.ls(), ['A', 'B']);
});

test('yansı: kurtarma taşıması başarısız olursa klasör yapıda kalır ve sonra yeniden denenir', t => {
  const T = setup(t, { folders: [{ id: 'f', name: 'A' }] });
  T.ok();
  T.put('A/fatura.pdf', 'x');
  T.ws.folders = [];
  const mock = fail(t, 'renameSync', (a, b) => String(b).startsWith(T.p(RECOVER)));
  assert.deepStrictEqual(T.sync().errors, ['kurtar A: EBUSY']);
  assert.ok(T.has('A', 'fatura.pdf'));
  assert.deepStrictEqual(T.man().folders, { f: 'A' });
  mock.mock.restore(); T.ok();
  assert.ok(T.has(RECOVER, 'A', 'fatura.pdf')); assert.ok(!T.has('A'));
  assert.deepStrictEqual(T.man().folders, {});
});

test('yansı: içinde taşınamamış canlı klasör olan silinmiş klasöre dokunulmaz, sonra temizlenir', t => {
  const T = setup(t, { folders: [{ id: 'fA', name: 'A' }, { id: 'fB', name: 'B', parent: 'fA' }] });
  T.ok();
  T.ws.folders = [{ id: 'fB', name: 'B' }];
  const mock = fail(t, 'renameSync', a => a === T.p('A', 'B'));
  assert.deepStrictEqual(T.sync().errors, [`taşı ${path.join('A', 'B')} → B: EBUSY`]);
  assert.ok(T.has('A', 'B'));
  assert.deepStrictEqual(T.man().folders, { fA: 'A', fB: path.join('A', 'B') });
  mock.mock.restore(); T.ok();
  assert.deepStrictEqual(T.ls(), ['B']);
  assert.deepStrictEqual(T.man().folders, { fB: 'B' });
});

test('yansı: yapı dosyası yazılamazsa hata bildirilir', t => {
  const T = setup(t, { sessions: [sess('u', 'X')] });
  fail(t, 'writeFileSync', f => String(f).endsWith(MANIFEST + '.tmp'));
  assert.deepStrictEqual(T.sync().errors, ['yapı dosyası: EBUSY']);
  assert.ok(T.has('X' + EXT));
});

// ---------------------------------------------------------------- kaldırma ve kurtarma

test('yansı: kaldırılan klasör boşsa (sistem dosyaları ve boş alt dizinler dahil) silinir', t => {
  const T = setup(t, { folders: [{ id: 'f', name: 'A' }], sessions: [sess('u', 's')], meta: { 's:u': { folder: 'f' } } });
  T.ok();
  T.put('A/desktop.ini', 'x'); T.put('A/alt/Thumbs.db', 'x'); T.put('A/alt/.DS_Store', 'x'); fs.mkdirSync(T.p('A', 'boş'));
  T.ws.folders = []; T.ok();
  assert.deepStrictEqual(T.ls(), ['s' + EXT]);
  assert.ok(!T.has(RECOVER));
});

test('yansı: silinemeyen sistem dosyası ya da dizin olan klasör kurtarılır (veri silinmez)', t => {
  const T = setup(t, { folders: [{ id: 'f', name: 'A' }, { id: 'g', name: 'B' }] });
  T.ok();
  T.put('A/desktop.ini', 'x'); T.put('B/alt/x.txt', 'y');
  T.ws.folders = [];
  fail(t, 'unlinkSync', f => String(f).endsWith('desktop.ini'));
  T.sync();
  assert.ok(T.has(RECOVER, 'A', 'desktop.ini'));
  assert.ok(T.has(RECOVER, 'B', 'alt', 'x.txt'));
});

test('yansı: rmdir başarısız olursa klasör kurtarılır', t => {
  const T = setup(t, { folders: [{ id: 'f', name: 'A' }] });
  T.ok();
  T.ws.folders = [];
  fail(t, 'rmdirSync', d => d === T.p('A'));
  T.sync();
  assert.ok(T.has(RECOVER, 'A'));
});

test('yansı: kurtarılan dizin adı doluysa numaralanır', t => {
  const T = setup(t, { folders: [{ id: 'f', name: 'A' }] });
  T.ok();
  T.put('A/x.txt', '1'); T.put(RECOVER + '/A/eski.txt', '0'); T.put(RECOVER + '/A (2)/eski.txt', '0');
  T.ws.folders = []; T.ok();
  assert.ok(T.has(RECOVER, 'A (3)', 'x.txt'));
  assert.ok(T.has(RECOVER, 'A', 'eski.txt'));
});

test('yansı: Kurtarılan dosyalar içindeki sohbet dosyalarına dokunulmaz; iç içe aynı adlı dizin taranır', t => {
  const T = setup(t, { folders: [{ id: 'f', name: 'F' }] });
  const body = { tur: KIND, id: 'eski' };
  T.put(RECOVER + '/K/eski' + EXT, body);
  T.put('F/' + RECOVER + '/eski' + EXT, body);
  T.ok();
  assert.ok(T.has(RECOVER, 'K', 'eski' + EXT));
  assert.ok(!T.has('F', RECOVER, 'eski' + EXT), 'kökte değilse taranır ve artık panel dosyası silinir');
});

test('yansı: kayıtsız ama panelin yazdığı artık sohbet dosyaları (alt dizinlerde de) silinir', t => {
  const T = setup(t, { folders: [{ id: 'f', name: 'F' }] });
  T.ok();
  T.put('artık' + EXT, { tur: KIND, id: 'z' });
  T.put('F/artık' + EXT, { tur: KIND, id: 'z' });
  T.put('F/kullanıcı' + EXT, { baska: 1 });
  T.put('F/bozuk' + EXT, '{');
  T.ok();
  assert.deepStrictEqual(T.ls(), ['F']);
  assert.deepStrictEqual(T.ls('F'), ['bozuk' + EXT, 'kullanıcı' + EXT]);
});

test('yansı: oturum listesi boş ve hiç kayıt yoksa artık dosyalar yine temizlenir', t => {
  const T = setup(t);
  T.put('artık' + EXT, { tur: KIND, id: 'z' });
  T.ok();
  assert.deepStrictEqual(T.ls(), []);
});

test('yansı: oturum listesi boş gelir ama kayıt varsa hiçbir sohbet dosyası silinmez', t => {
  const T = setup(t, { sessions: [sess('u', 'X')] });
  T.ok();
  T.S.sessions = []; T.ok();
  assert.deepStrictEqual(T.ls(), ['X' + EXT]);
});

test('yansı: kullanıcının .sohbet.json uzantılı dosyasının üzerine yazılmaz', t => {
  const T = setup(t, { sessions: [sess('u', 'Not')] });
  T.put('Not' + EXT, 'kullanıcı metni');
  T.ok();
  assert.strictEqual(fs.readFileSync(T.p('Not' + EXT), 'utf8'), 'kullanıcı metni');
  assert.strictEqual(T.chat('Not (2)' + EXT).id, 'u');
});

test('yansı: Çöp Kutusu boşalınca dizini kaldırılır; dolu Çöp Kutusu kalır', t => {
  const T = setup(t, { sessions: [sess('u', 'X')], meta: { 's:u': { trashed: true } } });
  T.ok();
  assert.deepStrictEqual(T.ls(TRASH), ['X' + EXT]);
  T.ws.meta['s:u'] = {}; T.ok();
  assert.deepStrictEqual(T.ls(), ['X' + EXT]);
});

// ---------------------------------------------------------------- sahiplenme

test('yansı: yalnızca panel dosyaları/sistem dosyaları/boş alt dizinler içeren aynı adlı dizin sahiplenilir', t => {
  const T = setup(t, { folders: [{ id: 'f', name: 'A' }] });
  T.put('A/desktop.ini', 'x'); T.put('A/alt/eski' + EXT, { tur: KIND, id: 'q' }); T.put('A/alt/Thumbs.db', 'x');
  T.ok();
  assert.deepStrictEqual(T.ls(), ['A']);
  assert.strictEqual(T.man().folders.f, 'A');
});

test('yansı: içinde başka JSON ya da kullanıcı dosyası olan dizin sahiplenilmez', t => {
  const T = setup(t, { folders: [{ id: 'f', name: 'A' }, { id: 'g', name: 'B' }] });
  T.put('A/alt/x' + EXT, { tur: 'baska' });
  T.put('B/x.txt', '1');
  T.ok();
  assert.deepStrictEqual(T.ls(), ['A', 'A (2)', 'B', 'B (2)']);
  assert.deepStrictEqual(T.man().folders, { f: 'A (2)', g: 'B (2)' });
});

test('yansı: çok derin iç içe dizin sahiplenilmez', t => {
  const T = setup(t, { folders: [{ id: 'f', name: 'A' }, { id: 'g', name: 'B' }] });
  fs.mkdirSync(T.p('A', ...Array(32).fill('d')), { recursive: true }); // sınır: 31 kat sahiplenilir, 32 kat sahiplenilmez
  fs.mkdirSync(T.p('B', ...Array(31).fill('d')), { recursive: true });
  T.ok();
  assert.deepStrictEqual(T.man().folders, { f: 'A (2)', g: 'B' });
});

test('yansı: aynı adlı bir dosya varsa klasör başka ad alır', t => {
  const T = setup(t, { folders: [{ id: 'f', name: 'A' }] });
  T.put('A', 'dosya');
  T.ok();
  assert.strictEqual(T.man().folders.f, 'A (2)');
  assert.strictEqual(fs.readFileSync(T.p('A'), 'utf8'), 'dosya');
});

test('yansı: kayıtlı klasör elle silinmişse yeniden oluşturulur', t => {
  const T = setup(t, { folders: [{ id: 'f', name: 'A' }] });
  T.ok();
  fs.rmdirSync(T.p('A'));
  T.ok();
  assert.ok(fs.statSync(T.p('A')).isDirectory());
});

// ---------------------------------------------------------------- yapı dosyası güvenliği

test('yansı: yapı dosyasındaki kök dışı ya da bozuk yollar hiçbir şeyi taşıtmaz/sildirmez', t => {
  const T = setup(t, { folders: [{ id: 'f1', name: 'Yeni' }], sessions: [sess('u', 'X')] });
  fs.mkdirSync(T.root);
  const disari = path.join(T.base, 'disari');
  fs.mkdirSync(disari); fs.writeFileSync(path.join(disari, 'önemli.txt'), '1');
  fs.writeFileSync(path.join(disari, 'z' + EXT), JSON.stringify({ tur: KIND, id: 'u' }));
  fs.writeFileSync(T.p(MANIFEST), JSON.stringify({ tur: 'claude-panel-yapi', folders: {
    f1: '../disari', f2: '../disari', f3: 5, f4: '.', f5: '', f6: path.join('..', 'kok', '..', 'disari'),
  }, chats: { u: '../disari/z' + EXT, v: '../disari/z' + EXT, w: null } }));
  T.ok();
  assert.deepStrictEqual(fs.readdirSync(disari).sort(), ['z' + EXT, 'önemli.txt']);
  assert.ok(fs.existsSync(T.root));
  assert.deepStrictEqual(T.man().folders, { f1: 'Yeni' });
  assert.deepStrictEqual(T.man().chats, { u: 'X' + EXT });
});

test('yansı: tür alanı tutmayan ya da bozuk yapı dosyası yok sayılır', t => {
  const T = setup(t, { folders: [{ id: 'f', name: 'A' }] });
  fs.mkdirSync(T.root);
  fs.writeFileSync(T.p(MANIFEST), JSON.stringify({ tur: 'baska', workspace: { x: 1 }, folders: { f: 'B' } }));
  assert.strictEqual(T.m.readWorkspace(), null);
  fs.mkdirSync(T.p('B'));
  T.ok();
  assert.deepStrictEqual(T.ls(), ['A', 'B']);
  fs.writeFileSync(T.p(MANIFEST), '{bozuk');
  assert.strictEqual(T.m.readWorkspace(), null);
  fs.writeFileSync(T.p(MANIFEST), 'null');
  assert.strictEqual(T.m.readWorkspace(), null);
  T.ok();
});

test('yansı: yapı dosyası kaybolunca var olan panel dizinleri sahiplenilir (kopya oluşmaz)', t => {
  const T = setup(t, { folders: [{ id: 'f', name: 'A' }], sessions: [sess('u', 's')], meta: { 's:u': { folder: 'f' } } });
  T.ok();
  fs.unlinkSync(T.p(MANIFEST));
  T.ok();
  assert.deepStrictEqual(T.ls(), ['A']);
  assert.deepStrictEqual(T.ls('A'), ['s' + EXT]);
});

// ---------------------------------------------------------------- Windows

test('yansı (Windows): yapı dosyası önce silinip yeniden yazılır ve gizlenir', t => {
  const calls = [];
  const T = setup(t, { platform: 'win32', execFile: (...a) => { calls.push(a.slice(0, 3)); a[3](); } });
  const unl = t.mock.method(fs, 'unlinkSync');
  T.ok();
  assert.deepStrictEqual(calls, [['attrib', ['+h', T.p(MANIFEST)], { windowsHide: true }]]);
  assert.ok(unl.mock.calls.some(c => c.arguments[0] === T.p(MANIFEST)));
  T.ok();
  assert.strictEqual(calls.length, 2);
  assert.strictEqual(T.man().tur, 'claude-panel-yapi');
});

test('yansı (Mac): yapı dosyası gizlenmez, attrib çağrılmaz', t => {
  const calls = [];
  const T = setup(t, { platform: 'darwin', execFile: (...a) => calls.push(a) });
  const unl = t.mock.method(fs, 'unlinkSync');
  T.ok(); T.ok();
  assert.deepStrictEqual(calls, []);
  assert.ok(!unl.mock.calls.some(c => c.arguments[0] === T.p(MANIFEST)));
});

// ---------------------------------------------------------------- zamanlayıcı

test('zamanlayıcı: setReady gelmeden yansıtılmaz; sonra gecikmeyle bir kez yansıtılır', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const T = setup(t, { delay: 400, sessions: [sess('u', 'X')] });
  T.m.schedule(T.ws);
  t.mock.timers.tick(1000);
  assert.ok(!fs.existsSync(T.root));
  T.m.setReady();
  t.mock.timers.tick(399);
  assert.ok(!fs.existsSync(T.root));
  t.mock.timers.tick(1);
  assert.ok(T.has('X' + EXT));
});

test('zamanlayıcı: art arda schedule tek geçişe iner; ws verilmezse sonuncusu kullanılır', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let n = 0;
  const base = mk(t), root = path.join(base, 'k');
  const m = createMirror({ root, delay: 100, getSessions: () => { n++; return []; } });
  m.setReady(); // henüz ws yok: hiçbir şey yapmaz
  t.mock.timers.tick(100);
  assert.strictEqual(n, 0);
  m.schedule({ folders: [{ id: 'a', name: 'A' }] });
  t.mock.timers.tick(50);
  m.schedule({ folders: [{ id: 'b', name: 'B' }] });
  t.mock.timers.tick(50);
  assert.strictEqual(n, 0, 'yeni schedule bekleyeni erteler');
  t.mock.timers.tick(50);
  assert.strictEqual(n, 1);
  assert.ok(fs.existsSync(path.join(root, 'B')) && !fs.existsSync(path.join(root, 'A')));
  m.schedule();
  t.mock.timers.tick(100);
  assert.strictEqual(n, 2);
  assert.ok(fs.existsSync(path.join(root, 'B')));
});

test('zamanlayıcı: flush bekleyen geçişi hemen yapar ve zamanlayıcıyı iptal eder', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let n = 0;
  const base = mk(t), root = path.join(base, 'k');
  const m = createMirror({ root, delay: 100, getSessions: () => { n++; return []; } });
  m.setReady();
  m.schedule({ folders: [] });
  m.flush();
  assert.strictEqual(n, 1);
  t.mock.timers.tick(1000);
  assert.strictEqual(n, 1);
});

test('zamanlayıcı: hata olunca durum bildirilir ve artan aralıklarla (en çok 12 sn) yeniden denenir', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  t.mock.method(console, 'warn', () => {});
  const sts = []; let n = 0, broken = true;
  const base = mk(t), root = path.join(base, 'k');
  const m = createMirror({ root, delay: 10, onStatus: s => sts.push(s), getSessions: () => { n++; if (broken) throw new Error('okunamadı'); return []; } });
  assert.deepStrictEqual(m.status, { root, ok: true });
  m.setReady(); m.schedule({ folders: [] });
  t.mock.timers.tick(10);
  assert.strictEqual(n, 1);
  assert.strictEqual(sts.length, 1);
  assert.deepStrictEqual({ ...sts[0], at: 0 }, { root, ok: false, errors: ['okunamadı'], at: 0 });
  assert.strictEqual(typeof sts[0].at, 'number');
  assert.strictEqual(m.status, sts[0]);
  const waits = [2000, 4000, 6000, 8000, 10000, 12000, 12000];
  for (const w of waits) {
    const before = n;
    t.mock.timers.tick(w - 1); assert.strictEqual(n, before, 'erken denenmez: ' + w);
    t.mock.timers.tick(1); assert.strictEqual(n, before + 1, 'zamanında denenir: ' + w);
  }
  assert.strictEqual(sts.length, 1 + waits.length, 'her hatada bildirilir');
  broken = false;
  t.mock.timers.tick(12000);
  assert.strictEqual(sts.length, 1 + waits.length + 1);
  assert.strictEqual(sts.at(-1).ok, true);
  assert.deepStrictEqual(sts.at(-1).errors, []);
  assert.strictEqual(m.status.ok, true);
  t.mock.timers.tick(60000);
  const after = n;
  m.schedule(); t.mock.timers.tick(10);
  assert.strictEqual(n, after + 1);
  assert.strictEqual(sts.length, 1 + waits.length + 1, 'başarılı durum değişmeyince bildirilmez');
  // düzeldikten sonra yeni hata: bekleme yeniden 2 sn'den başlar
  broken = true; m.schedule(); t.mock.timers.tick(10);
  const k = n; t.mock.timers.tick(1999); assert.strictEqual(n, k); t.mock.timers.tick(1); assert.strictEqual(n, k + 1);
});

test('zamanlayıcı: string hata ve en çok 5 hata durumda tutulur', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(console, 'warn', () => {});
  const sts = [];
  const base = mk(t), root = path.join(base, 'k');
  const m1 = createMirror({ root, delay: 1, onStatus: s => sts.push(s), getSessions: () => { throw 'düz metin'; } });
  m1.setReady(); m1.schedule({ folders: [] }); t.mock.timers.tick(1);
  assert.deepStrictEqual(sts[0].errors, ['düz metin']);
  const m2 = createMirror({ root: path.join(base, 'k2'), delay: 1, onStatus: s => sts.push(s), getSessions: () => [] });
  fail(t, 'mkdirSync', d => String(d).startsWith(path.join(base, 'k2') + path.sep));
  m2.setReady(); m2.schedule({ folders: Array.from({ length: 7 }, (_, i) => ({ id: 'f' + i, name: 'K' + i })) });
  t.mock.timers.tick(1);
  assert.strictEqual(sts[1].errors.length, 5);
  assert.strictEqual(sts[1].ok, false);
});

// ---------------------------------------------------------------- kalan kenar durumları

test('yansı: aynı adlı ve aynı derinlikteki klasörlerin sırası kimliğe göre sabittir', t => {
  const T = setup(t, { folders: [{ id: 'z', name: 'A' }, { id: 'a', name: 'A' }] });
  T.ok();
  assert.deepStrictEqual(T.man().folders, { a: 'A', z: 'A (2)' });
  T.ws.folders.reverse(); T.ok();
  assert.deepStrictEqual(T.man().folders, { a: 'A', z: 'A (2)' });
});

test('yansı: okunamayan dizinler — sahiplenilmez, taramada atlanır, kaldırılırken silinmez', t => {
  const T = setup(t, { folders: [{ id: 'f', name: 'A' }, { id: 'g', name: 'G' }] });
  T.put('A/x' + EXT, { tur: KIND, id: 'q' });
  T.ok();
  T.put('G/artık' + EXT, { tur: KIND, id: 'z' });
  const mock = fail(t, 'readdirSync', d => d === T.p('A') || d === T.p('G'), 'EACCES');
  T.ws.folders = [{ id: 'f', name: 'A' }, { id: 'h', name: 'A' }]; // g kaldırıldı, h aynı adlı yeni klasör
  T.sync();
  assert.ok(T.has(RECOVER, 'G', 'artık' + EXT), 'okunamayan kaldırılmış dizin silinmez, kurtarılır');
  mock.mock.restore();
  const T2 = setup(t, { folders: [{ id: 'f', name: 'B' }] });
  T2.put('B/x' + EXT, { tur: KIND, id: 'q' });
  fail(t, 'readdirSync', d => d === T2.p('B'), 'EACCES');
  T2.ok();
  assert.strictEqual(T2.man().folders.f, 'B (2)', 'okunamayan dizin sahiplenilmez');
  assert.ok(T2.has('B', 'x' + EXT), 'okunamayan dizindeki dosya taranmaz, silinmez');
});

test('zamanlayıcı: onStatus verilmezse hata yine sessizce işlenir', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(console, 'warn', () => {});
  const base = mk(t);
  const m = createMirror({ root: path.join(base, 'k'), delay: 1, getSessions: () => { throw new Error('x'); } });
  m.setReady(); m.schedule({ folders: [] });
  t.mock.timers.tick(1);
  assert.strictEqual(m.status.ok, false);
  m.flush();
});

// ---------------------------------------------------------------- sınırlar ve hata iletileri

test('yansı: yapı dosyasının geçici adı da ayrılmıştır (aynı adlı klasör yapı dosyası yazımını bozmaz)', t => {
  const T = setup(t, { folders: [{ id: 'f', name: MANIFEST + '.tmp' }] });
  T.ok();
  assert.strictEqual(T.man().folders.f, MANIFEST + '.tmp (2)');
});

test('yansı: bir ad için en çok 50 aday denenir; hepsi kullanıcı dosyasıysa klasör/sohbet yazılmaz (sonsuz döngü yok)', t => {
  const names = n => Array.from({ length: n }, (_, i) => i ? `X (${i + 1})` : 'X');
  for (const [n, folder, chat] of [[49, 'X (50)', 'X (50)' + EXT], [50, undefined, undefined]]) {
    const T = setup(t, { folders: [{ id: 'f', name: 'X' }] });
    for (const a of names(n)) T.put(a, 'kullanıcı');
    T.ok();
    assert.strictEqual(T.man().folders.f, folder);
    const T2 = setup(t, { folders: [{ id: 'y', name: 'Y' }] });
    T2.ok();                                       // önce panel Y dizinini kurar, sonra kullanıcı dosyaları gelir
    for (const a of names(n)) T2.put('Y/' + a + EXT, 'kullanıcı');
    T2.S.sessions = [sess('u', 'X')]; T2.ws.meta['s:u'] = { folder: 'y' };
    T2.ok();
    assert.strictEqual(T2.man().chats.u, chat && path.join('Y', chat));
  }
});

test('yansı: geçici ada çekilen klasör "<ad> ~<kimliğin son 6 harfi>" adını alır', t => {
  const T = setup(t, { folders: [{ id: 'klasor-123456', name: 'A' }, { id: 'g', name: 'B' }] });
  T.ok();
  T.ws.folders = [{ id: 'klasor-123456', name: 'B' }, { id: 'g', name: 'A' }];
  // geçici addan son yerine taşıma başarısız olursa klasör geçici adında kalır ve yapı dosyası onu gösterir
  fail(t, 'renameSync', a => String(a).endsWith(' ~123456'));
  T.sync();
  assert.strictEqual(T.man().folders['klasor-123456'], 'A ~123456');
  assert.strictEqual(T.man().folders.g, 'A');
  assert.ok(T.has('A ~123456'));
});

test('yansı: artık sohbet dosyası silinemezse hata dosya adıyla bildirilir', t => {
  const T = setup(t, { sessions: [sess('u', 'Eski')] });
  T.ok();
  T.S.sessions = [sess('v', 'Yeni')];
  fail(t, 'unlinkSync', f => String(f).endsWith('Eski' + EXT));
  assert.deepStrictEqual(T.sync().errors, ['sil Eski' + EXT + ': EBUSY']);
  assert.ok(T.has('Eski' + EXT));
});
