// Disk yansısı (C:\Claude Panel) testleri: geçici bir kökte panel işlemlerini taklit eder.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMirror, MANIFEST, TRASH, RECOVER, EXT, clean } = require('../src/main/mirror');

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-mirror-'));
  const S = { sessions: [
    { id: 'u1', title: 'Logo revizyonu', cwd: '/p/a', file: '/x/u1.jsonl' },
    { id: 'u2', title: 'Site metinleri', cwd: '/p/b', file: '/x/u2.jsonl' },
    { id: 'u3', title: 'Reels kurgusu', cwd: '/p/c', file: '/x/u3.jsonl' },
  ] };
  const m = createMirror({ root, getSessions: () => S.sessions });
  const ws = { folders: [
    { id: 'fA', name: 'Gerikoğlu', parent: null },
    { id: 'fB', name: 'Sosyal medya', parent: 'fA' },
  ], meta: { 's:u1': { folder: 'fA' }, 's:u3': { folder: 'fB' } }, items: [] };
  const sync = () => { const r = m.syncNow(ws); assert.deepStrictEqual(r.errors, []); };
  const has = rel => fs.existsSync(path.join(root, rel));
  const ino = rel => fs.statSync(path.join(root, rel)).ino;
  const tree = () => { const out = []; const walk = (d, pre) => { for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name === MANIFEST) continue; const r = pre ? pre + '/' + e.name : e.name; out.push(r + (e.isDirectory() ? '/' : '')); if (e.isDirectory()) walk(path.join(d, e.name), r); } }; walk(root, ''); return out; };
  return { root, S, m, ws, sync, has, ino, tree };
}

test('yansı: klasör hiyerarşisi ve sohbet dosyaları oluşur', () => {
  const t = setup(); t.sync();
  assert.deepStrictEqual(t.tree(), ['Gerikoğlu/', 'Gerikoğlu/Logo revizyonu' + EXT, 'Gerikoğlu/Sosyal medya/', 'Gerikoğlu/Sosyal medya/Reels kurgusu' + EXT, 'Site metinleri' + EXT]);
  const c = JSON.parse(fs.readFileSync(path.join(t.root, 'Gerikoğlu', 'Logo revizyonu' + EXT), 'utf8'));
  assert.strictEqual(c.id, 'u1'); assert.strictEqual(c.proje, '/p/a');
  t.sync(); // ikinci geçiş hiçbir şeyi değiştirmez
  assert.strictEqual(t.tree().length, 5);
});

test('yansı: yeniden adlandırma ve taşıma dizini yerinde değiştirir (yeniden oluşturmaz)', () => {
  const t = setup(); t.sync();
  const before = t.ino('Gerikoğlu/Sosyal medya');
  fs.writeFileSync(path.join(t.root, 'Gerikoğlu', 'Sosyal medya', 'kullanıcı notu.txt'), 'önemli');
  t.ws.folders[0].name = 'Gerikoğlu Halı'; t.sync();
  assert.ok(t.has('Gerikoğlu Halı/Sosyal medya/Reels kurgusu' + EXT)); assert.ok(!t.has('Gerikoğlu'));
  t.ws.folders[1].parent = null; t.sync(); // alt klasörü üst düzeye taşı
  assert.ok(t.has('Sosyal medya/Reels kurgusu' + EXT));
  assert.ok(t.has('Sosyal medya/kullanıcı notu.txt'), 'kullanıcı dosyası klasörle birlikte taşınır');
  assert.strictEqual(t.ino('Sosyal medya'), before);
});

test('yansı: iki klasörün adları takas edilince karışmaz', () => {
  const t = setup(); t.ws.folders[1].parent = null; t.ws.folders[1].name = 'B'; t.ws.folders[0].name = 'A'; t.sync();
  const ia = t.ino('A'), ib = t.ino('B');
  t.ws.folders[0].name = 'B'; t.ws.folders[1].name = 'A'; t.sync();
  assert.strictEqual(t.ino('B'), ia); assert.strictEqual(t.ino('A'), ib);
  assert.ok(t.has('B/Logo revizyonu' + EXT)); assert.ok(t.has('A/Reels kurgusu' + EXT));
  assert.deepStrictEqual(t.tree().filter(x => x.includes('~')), []);
});

test('yansı: sohbet adı/klasörü değişince eski dosya kalmaz; aynı adlar numaralanır', () => {
  const t = setup(); t.sync();
  t.ws.meta['s:u1'] = { folder: 'fB', alias: 'Yeni logo' }; t.sync();
  assert.ok(t.has('Gerikoğlu/Sosyal medya/Yeni logo' + EXT)); assert.ok(!t.has('Gerikoğlu/Logo revizyonu' + EXT));
  t.S.sessions.push({ id: 'u4', title: 'Site metinleri' }); t.sync();
  assert.ok(t.has('Site metinleri' + EXT) && t.has('Site metinleri (2)' + EXT));
});

test('yansı: çöp kutusu, kalıcı silme ve kullanıcı dosyalarının korunması', () => {
  const t = setup(); t.sync();
  t.ws.folders[1].trashed = true; t.sync();
  assert.ok(t.has(TRASH + '/Sosyal medya/Reels kurgusu' + EXT));
  t.ws.folders[1].trashed = false; t.sync(); // geri yükle
  assert.ok(t.has('Gerikoğlu/Sosyal medya/Reels kurgusu' + EXT)); assert.ok(!t.has(TRASH), 'boş Çöp Kutusu dizini kalmaz');
  fs.writeFileSync(path.join(t.root, 'Gerikoğlu', 'Sosyal medya', 'çekim.mp4'), 'x');
  t.ws.folders = t.ws.folders.filter(f => f.id !== 'fB'); delete t.ws.meta['s:u3']; t.sync(); // klasörü sil
  assert.ok(!t.has('Gerikoğlu/Sosyal medya')); assert.ok(t.has('Reels kurgusu' + EXT));
  assert.ok(t.has(RECOVER + '/Sosyal medya/çekim.mp4'), 'içinde kullanıcı dosyası olan dizin silinmez, kurtarılır');
  assert.ok(!t.has(RECOVER + '/Sosyal medya/Reels kurgusu' + EXT));
});

test('yansı: oturum listesi boş gelirse hiçbir sohbet dosyası silinmez', () => {
  const t = setup(); t.sync();
  const n = t.tree().length; t.S.sessions = []; t.sync();
  assert.strictEqual(t.tree().length, n);
});

test('yansı: yapı dosyası kaybolsa da kopya üretmez; workspace geri okunur', () => {
  const t = setup(); t.sync();
  fs.unlinkSync(path.join(t.root, MANIFEST)); t.sync();
  assert.strictEqual(t.tree().length, 5);
  assert.deepStrictEqual(t.m.readWorkspace().folders.map(f => f.name), ['Gerikoğlu', 'Sosyal medya']);
});

test('yansı: Windows için geçersiz adlar temizlenir', () => {
  assert.strictEqual(clean('a/b:c*d?"e<f>g|h', 80), 'a b c d e f g h');
  assert.strictEqual(clean('CON', 80), 'CON_');
  assert.strictEqual(clean('  nokta. ', 80), 'nokta');
  assert.strictEqual(clean('', 80), 'Adsız');
});

test('workspace: asıl dosya silinirse yedekten / yansıdan geri yüklenir', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-ws-'));
  const prev = process.env.CLAUDE_PANEL_HOME; process.env.CLAUDE_PANEL_HOME = home;
  delete require.cache[require.resolve('../src/main/workspace')];
  const W = require('../src/main/workspace');
  try {
    const data = { folders: [{ id: 'f1', name: 'X' }], meta: { 's:a': { folder: 'f1' } }, items: [] };
    W.save(data);
    fs.unlinkSync(W.FILE);
    const r = W.load([() => data]);
    assert.strictEqual(r.firstRun, false); assert.strictEqual(r.restored, true);
    assert.strictEqual(r.folders[0].name, 'X'); assert.ok(fs.existsSync(W.FILE), 'geri yüklenen hemen yazılır');
    fs.writeFileSync(W.FILE, '{bozuk');
    assert.strictEqual(W.load([() => data]).folders[0].name, 'X');
    assert.ok(fs.readdirSync(home).some(f => f.includes('.bozuk-')), 'bozuk dosya kenara alınır');
  } finally { if (prev === undefined) delete process.env.CLAUDE_PANEL_HOME; else process.env.CLAUDE_PANEL_HOME = prev; }
});

test('yansı: kullanıcının aynı adlı dolu dizini sahiplenilmez', () => {
  const t = setup();
  fs.mkdirSync(path.join(t.root, 'Gerikoğlu')); fs.writeFileSync(path.join(t.root, 'Gerikoğlu', 'fatura.pdf'), 'x');
  t.sync();
  assert.ok(t.has('Gerikoğlu/fatura.pdf') && !t.has('Gerikoğlu/Logo revizyonu' + EXT), 'kullanıcı dizinine dokunulmaz');
  assert.ok(t.has('Gerikoğlu (2)/Logo revizyonu' + EXT));
  t.ws.folders = t.ws.folders.filter(f => f.id !== 'fA'); t.sync(); // panel klasörü silinince kullanıcı dizini yerinde kalır
  assert.ok(t.has('Gerikoğlu/fatura.pdf')); assert.ok(!t.has(RECOVER + '/Gerikoğlu'));
});
