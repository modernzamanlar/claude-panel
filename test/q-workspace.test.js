// workspace.js: atomik kayıt, .bak yedeği, bozuk dosyanın kenara alınması ve geri yükleme sırası.
// Her test kendi geçici CLAUDE_PANEL_HOME klasörünü kullanır; gerçek ~/.claude-panel'e hiç dokunulmaz.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MOD = require.resolve('../src/main/workspace');
const EMPTY = { v: 1, folders: [], meta: {}, items: [], links: [], graphPos: {}, known: null, layout: null };

/** Modülü verilen ev klasörüyle sıfırdan yükler (DIR ve lastBak yükleme anında belirlenir). */
function fresh(t, home = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-qws-'))) {
  const prev = process.env.CLAUDE_PANEL_HOME;
  process.env.CLAUDE_PANEL_HOME = home;
  delete require.cache[MOD];
  const W = require(MOD);
  t.after(() => {
    if (prev === undefined) delete process.env.CLAUDE_PANEL_HOME; else process.env.CLAUDE_PANEL_HOME = prev;
    delete require.cache[MOD];
  });
  const warn = t.mock.method(console, 'warn', () => {});
  return { W, home, warn };
}
const write = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, typeof v === 'string' ? v : JSON.stringify(v)); };
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const good = (name = 'X') => ({ folders: [{ id: 'f1', name }], meta: { 's:a': { folder: 'f1' } } });
const bozuklar = home => fs.readdirSync(home).filter(f => f.startsWith('workspace.json.bozuk-'));

test('workspace yolları: CLAUDE_PANEL_HOME verilince DIR/FILE/BAK onun altında olur', t => {
  const { W, home } = fresh(t);
  assert.strictEqual(W.DIR, home);
  assert.strictEqual(W.FILE, path.join(home, 'workspace.json'));
  assert.strictEqual(W.BAK, path.join(home, 'workspace.json.bak'));
});

test('workspace yolları: CLAUDE_PANEL_HOME yoksa ev klasöründeki .claude-panel kullanılır', t => {
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-qws-home-'));
  const prevHome = process.env.HOME, prevCP = process.env.CLAUDE_PANEL_HOME;
  t.mock.method(os, 'homedir', () => fakeHome);
  process.env.HOME = fakeHome; delete process.env.CLAUDE_PANEL_HOME;
  delete require.cache[MOD];
  try {
    const W = require(MOD); // yalnızca yol okunur; kayıt yapılmaz
    assert.strictEqual(W.DIR, path.join(fakeHome, '.claude-panel'));
    assert.strictEqual(W.FILE, path.join(fakeHome, '.claude-panel', 'workspace.json'));
  } finally {
    process.env.HOME = prevHome;
    if (prevCP === undefined) delete process.env.CLAUDE_PANEL_HOME; else process.env.CLAUDE_PANEL_HOME = prevCP;
    delete require.cache[MOD];
  }
});

test('ilk açılış: hiçbir dosya yoksa boş yapı ve firstRun=true döner, hiçbir şey yazılmaz', t => {
  const { W, home, warn } = fresh(t);
  assert.deepStrictEqual(W.load(), { ...EMPTY, firstRun: true });
  assert.deepStrictEqual(W.load([() => null, () => { throw new Error('x'); }]), { ...EMPTY, firstRun: true });
  assert.deepStrictEqual(fs.readdirSync(home), []);
  assert.strictEqual(warn.mock.callCount(), 0);
});

test('geçerli asıl dosya: varsayılanlarla birleşir, firstRun=false olur, yedeğe ve yedeklere bakılmaz', t => {
  const { W, home, warn } = fresh(t);
  write(W.FILE, { ...good(), firstRun: true, items: [1], extra: 'e' });
  write(W.BAK, good('YEDEK'));
  let called = 0;
  const before = fs.readFileSync(W.FILE, 'utf8');
  const r = W.load([() => { called++; return good('YANSI'); }]);
  assert.deepStrictEqual(r, { ...EMPTY, ...good(), items: [1], extra: 'e', firstRun: false });
  assert.strictEqual('restored' in r, false);
  assert.strictEqual(called, 0);
  assert.strictEqual(fs.readFileSync(W.FILE, 'utf8'), before, 'asıl dosya yeniden yazılmaz');
  assert.deepStrictEqual(bozuklar(home), []);
  assert.strictEqual(warn.mock.callCount(), 0);
});

test('boş yapı her çağrıda yeni nesnedir (bir sonucun değiştirilmesi diğerini etkilemez)', t => {
  const { W } = fresh(t);
  const a = W.load(); a.folders.push('x'); a.meta.k = 1;
  assert.deepStrictEqual(W.load(), { ...EMPTY, firstRun: true });
});

const GECERSIZ = [
  ['null', null], ['sayı', 5], ['metin', 'str'], ['dizi', []], ['folders yok', { meta: {} }],
  ['folders dizi değil', { folders: 'x', meta: {} }], ['meta yok', { folders: [] }],
  ['meta null', { folders: [], meta: null }], ['meta metin', { folders: [], meta: 'x' }], ['meta sayı', { folders: [], meta: 1 }],
];

for (const [ad, val] of GECERSIZ) {
  test(`geçersiz yapı (${ad}): asıl dosya kenara alınır ve yedekten geri yüklenir`, t => {
    const { W, home, warn } = fresh(t);
    const now = 1700000000000 + GECERSIZ.findIndex(g => g[0] === ad);
    t.mock.method(Date, 'now', () => now);
    const raw = JSON.stringify(val);
    write(W.FILE, raw);
    write(W.BAK, good('YEDEK'));
    const r = W.load();
    assert.strictEqual(r.folders[0].name, 'YEDEK');
    assert.strictEqual(r.restored, true); assert.strictEqual(r.firstRun, false);
    assert.deepStrictEqual(bozuklar(home), ['workspace.json.bozuk-' + now]);
    assert.strictEqual(fs.readFileSync(W.FILE + '.bozuk-' + now, 'utf8'), raw, 'bozuk içerik aynen saklanır');
    assert.deepStrictEqual(warn.mock.calls.map(c => c.arguments), [['workspace geri yüklendi (geçersiz yapı)']]);
  });

  test(`geçersiz yapı (${ad}) yedekte ve yansıda da kabul edilmez`, t => {
    const { W, home } = fresh(t);
    write(W.BAK, JSON.stringify(val));
    assert.deepStrictEqual(W.load([() => val]), { ...EMPTY, firstRun: true });
    assert.deepStrictEqual(fs.readdirSync(home), ['workspace.json.bak'], 'geçersiz veri asıl dosyaya yazılmaz');
  });
}

test('bozuk JSON: kenara alınır, uyarıda hata iletisi yazar ve yansıdan geri yüklenir', t => {
  const { W, home, warn } = fresh(t);
  t.mock.method(Date, 'now', () => 42);
  write(W.FILE, '{bozuk');
  const r = W.load([() => good('YANSI')]);
  assert.strictEqual(r.folders[0].name, 'YANSI');
  assert.deepStrictEqual(bozuklar(home), ['workspace.json.bozuk-42']);
  assert.strictEqual(fs.readFileSync(W.FILE + '.bozuk-42', 'utf8'), '{bozuk');
  let msg; try { JSON.parse('{bozuk'); } catch (e) { msg = e.message; }
  assert.deepStrictEqual(warn.mock.calls.map(c => c.arguments), [[`workspace geri yüklendi (${msg})`]]);
});

test('asıl dosya yoksa (ENOENT) kenara alma yapılmaz; uyarıda hata kodu yazar', t => {
  const { W, home, warn } = fresh(t);
  write(W.BAK, good('YEDEK'));
  assert.strictEqual(W.load().folders[0].name, 'YEDEK');
  assert.deepStrictEqual(bozuklar(home), []);
  assert.deepStrictEqual(warn.mock.calls.map(c => c.arguments), [['workspace geri yüklendi (ENOENT)']]);
});

test('asıl yol bir klasörse kopyalanamaz; hata yutulur ve boş yapıya düşülür', t => {
  const { W, home, warn } = fresh(t);
  fs.mkdirSync(W.FILE);
  assert.deepStrictEqual(W.load(), { ...EMPTY, firstRun: true });
  assert.deepStrictEqual(bozuklar(home), []);
  assert.strictEqual(warn.mock.callCount(), 0);
});

test('geri yükleme sırası: önce .bak, sonra yedek kaynaklar verildiği sırayla; ilk geçerli olan kazanır', t => {
  const { W } = fresh(t);
  const calls = [];
  const fb = (n, v) => () => { calls.push(n); if (v instanceof Error) throw v; return v; };
  write(W.BAK, good('YEDEK'));
  assert.strictEqual(W.load([fb('a', good('A'))]).folders[0].name, 'YEDEK');
  assert.deepStrictEqual(calls, [], '.bak geçerliyse yedek kaynaklar çağrılmaz');

  fs.unlinkSync(W.FILE); fs.unlinkSync(W.BAK); // geri yükleme asıl dosyayı yazmıştı; ikinci senaryo için ikisini de kaldır
  const r = W.load([fb('hata', new Error('yok')), fb('geçersiz', { folders: 1 }), fb('null', null), fb('iyi', good('İYİ')), fb('sonraki', good('SONRAKİ'))]);
  assert.strictEqual(r.folders[0].name, 'İYİ');
  assert.deepStrictEqual(calls, ['hata', 'geçersiz', 'null', 'iyi']);
});

test('geri yüklenen veri: firstRun atılır, restored=true olur ve hemen asıl dosyaya yazılır', t => {
  const { W } = fresh(t);
  const r = W.load([() => ({ ...good('Y'), firstRun: true, restored: 'eski', items: [7] })]);
  assert.strictEqual(r.firstRun, false); assert.strictEqual(r.restored, true);
  assert.deepStrictEqual(r.items, [7]); assert.deepStrictEqual(r.links, []);
  const disk = read(W.FILE);
  assert.strictEqual('firstRun' in disk, false); assert.strictEqual('restored' in disk, false);
  assert.deepStrictEqual(disk.folders, good('Y').folders); assert.deepStrictEqual(disk.items, [7]);
  // yeniden açılışta artık asıl dosyadan, geri yükleme olmadan okunur
  const again = W.load();
  assert.strictEqual(again.restored, undefined); assert.strictEqual(again.folders[0].name, 'Y');
});

test('kaydet: v=1 ve savedAt eklenir, firstRun/restored atılır, dönen değer diske yazılanla aynıdır', t => {
  const { W, home } = fresh(t);
  t.mock.method(Date, 'now', () => 5);
  const out = W.save({ ...good(), v: 9, firstRun: true, restored: true });
  assert.deepStrictEqual(Object.keys(out).sort(), ['folders', 'meta', 'savedAt', 'v']);
  assert.strictEqual(out.v, 1);
  assert.ok(!isNaN(Date.parse(out.savedAt)) && out.savedAt === new Date(Date.parse(out.savedAt)).toISOString());
  assert.strictEqual(fs.readFileSync(W.FILE, 'utf8'), JSON.stringify(out, null, 1));
  assert.deepStrictEqual(fs.readdirSync(home), ['workspace.json'], 'geçici dosya kalmaz, ilk kayıtta yedek yoktur');
});

test('kaydet: boş/eksik veriyle (undefined, null) de çalışır', t => {
  const { W } = fresh(t);
  for (const d of [undefined, null]) {
    const out = W.save(d);
    assert.deepStrictEqual(Object.keys(out).sort(), ['savedAt', 'v']);
    assert.deepStrictEqual(read(W.FILE), out);
  }
});

test('kaydet: olmayan iç içe klasörü oluşturur ve klasör varken de tekrar kaydedebilir', t => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-qws-'));
  const { W } = fresh(t, path.join(base, 'a', 'b'));
  W.save(good('1')); W.save(good('2'));
  assert.strictEqual(read(W.FILE).folders[0].name, '2');
});

test('atomik yazım: geçici dosyaya yazılır, fsync edilir, kapatılır, sonra yeniden adlandırılır', t => {
  const { W } = fresh(t);
  const order = [];
  const realOpen = fs.openSync, realFsync = fs.fsyncSync, realClose = fs.closeSync, realRename = fs.renameSync;
  let fd;
  t.mock.method(fs, 'openSync', (p, m) => { fd = realOpen(p, m); order.push(['open', p, m]); return fd; });
  t.mock.method(fs, 'fsyncSync', f => { order.push(['fsync', f === fd]); return realFsync(f); });
  t.mock.method(fs, 'closeSync', f => { order.push(['close', f === fd]); return realClose(f); });
  t.mock.method(fs, 'renameSync', (a, b) => { order.push(['rename', a, b]); return realRename(a, b); });
  W.save(good());
  assert.deepStrictEqual(order, [
    ['open', W.FILE + '.tmp', 'w'], ['fsync', true], ['close', true], ['rename', W.FILE + '.tmp', W.FILE],
  ]);
  assert.strictEqual(read(W.FILE).folders[0].name, 'X');
});

test('atomik yazım: yazma hatasında dosya kapatılır, asıl dosya bozulmaz ve hata yükseltilir', t => {
  const { W } = fresh(t);
  W.save(good('ESKİ'));
  const before = fs.readFileSync(W.FILE, 'utf8');
  const close = t.mock.method(fs, 'closeSync');
  const rename = t.mock.method(fs, 'renameSync');
  t.mock.method(fs, 'writeSync', () => { throw new Error('disk dolu'); });
  assert.throws(() => W.save(good('YENİ')), /disk dolu/);
  assert.strictEqual(close.mock.callCount(), 1);
  assert.strictEqual(rename.mock.callCount(), 0);
  assert.strictEqual(fs.readFileSync(W.FILE, 'utf8'), before);
});

test('.bak yedeği: en çok dakikada bir alınır ve kayıttan önceki içeriği tutar', t => {
  const { W } = fresh(t);
  let now = 1e12;
  t.mock.method(Date, 'now', () => now);
  const bak = () => fs.existsSync(W.BAK) ? read(W.BAK).folders[0].name : null;
  W.save(good('A'));
  assert.strictEqual(bak(), null, 'asıl dosya yokken yedek alınmaz');
  W.save(good('B'));
  assert.strictEqual(bak(), 'A', 'ilk fırsatta önceki içerik yedeklenir');
  now += 60 * 1000; W.save(good('C'));
  assert.strictEqual(bak(), 'A', 'tam 60 sn sonra henüz yedek alınmaz');
  now += 1; W.save(good('D'));
  assert.strictEqual(bak(), 'C', '60 sn geçince yeniden yedeklenir');
  now += 1; W.save(good('E'));
  assert.strictEqual(bak(), 'C', 'süre yedekleme anından itibaren yeniden sayılır');
  now += 60 * 1000 + 1; W.save(good('F'));
  assert.strictEqual(bak(), 'E');
});

test('.bak yedeği alınamazsa kayıt yine başarılı olur ve sonraki kayıtta yeniden denenir', t => {
  const { W } = fresh(t);
  t.mock.method(Date, 'now', () => 1e12);
  W.save(good('A'));
  fs.mkdirSync(W.BAK); // kopyalama EISDIR ile başarısız olur
  W.save(good('B'));
  assert.strictEqual(read(W.FILE).folders[0].name, 'B');
  assert.ok(fs.statSync(W.BAK).isDirectory());
  fs.rmdirSync(W.BAK);
  W.save(good('C'));
  assert.strictEqual(read(W.BAK).folders[0].name, 'B', 'başarısız deneme zamanlayıcıyı başlatmaz');
});
