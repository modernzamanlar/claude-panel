// Arama modülü (src/main/search.js) için kapsamlı testler: norm, extractRows, SearchIndex (şema, sync, sorgu, alıntı)
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { SearchIndex, norm, extractRows } = require('../src/main/search');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cp-qsearch-'));
function writeLines(dir, name, lines) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, lines.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join('\n'));
  return file;
}
function session(dir, id, lines, over = {}) {
  const file = writeLines(dir, id + '.jsonl', lines);
  const st = fs.statSync(file);
  return { id, file, mtimeMs: st.mtimeMs, size: st.size, ...over };
}
const user = content => ({ type: 'user', message: { content } });
const asst = (...content) => ({ type: 'assistant', message: { content } });
const say = text => asst({ type: 'text', text });
// console.warn'ı geçici olarak yakala (dizinlenemeyen dosya uyarısı)
async function quiet(fn) {
  const orig = console.warn; const seen = [];
  console.warn = (...a) => seen.push(a);
  try { await fn(); } finally { console.warn = orig; }
  return seen;
}

// ---------- norm ----------
test('norm: Türkçe büyük/küçük harfler (İ, I, ı, i) ve şapkalı harfler sadeleşir', () => {
  assert.equal(norm('İIıi'), 'iiii');
  assert.equal(norm('ÇĞÖŞÜÂÎÛ çğöşüâîû'), 'cgosuaiu cgosuaiu');
  assert.equal(norm('Café ÆØ'), 'café æø'); // TR eşlemesinde olmayanlar yalnızca küçülür
});

test('norm: tüm kod noktalarında uzunluk korunur (alıntı konumu için)', () => {
  let bad = 0;
  for (let cp = 0; cp < 0x110000; cp++) {
    if (cp >= 0xD800 && cp <= 0xDFFF) continue;
    const ch = String.fromCodePoint(cp);
    if (norm(ch).length !== ch.length) bad++;
  }
  assert.equal(bad, 0);
  const t = 'İstanbul 😀 IĞDIR ﬁ ẞ'; assert.equal(norm(t).length, t.length);
});

// ---------- extractRows ----------
test('extractRows: başlık, kullanıcı ve asistan satırları doğru türle çıkar', async () => {
  const dir = tmp();
  const file = writeLines(dir, 'x.jsonl', [
    '',
    { type: 'custom-title', customTitle: 'Teklif Başlığı' },
    { type: 'custom-title' },                                     // başlıksız: satır yok
    { type: 'user', customTitle: 'SAHTE', message: { content: 'merhaba' } }, // başlık yalnızca custom-title türünden
    user([{ type: 'text', text: 'bir' }, { type: 'image', source: {} }, { type: 'text', text: 'iki' }]),
    say('cevap'),
    say(''),                                                       // boş metin atlanır
    { type: 'system', content: 'ilgisiz' },
    '{"type":"user", bozuk json',
  ]);
  assert.deepEqual(await extractRows(file), [
    { kind: 'title', body: 'Teklif Başlığı' },
    { kind: 'u', body: 'merhaba' },
    { kind: 'u', body: 'bir\niki' },
    { kind: 'a', body: 'cevap' },
  ]);
});

test('extractRows: yan zincir, meta, araç sonucu, sistem hatırlatması ve komut kayıtları atlanır', async () => {
  const dir = tmp();
  const file = writeLines(dir, 'x.jsonl', [
    { ...user('yan zincir'), isSidechain: true },
    { ...user('meta kayıt'), isMeta: true },
    { ...say('yan asistan'), isSidechain: true },
    user([{ type: 'text', text: 'görünmez' }, { type: 'tool_result', content: 'çıktı' }]),
    user('<system-reminder>gizli</system-reminder>  '),
    user('<system-reminder>gizli</system-reminder>kalan metin'),
    user('<command-name>/clear</command-name>'),
    user('<local-command-stdout>x</local-command-stdout>'),
    user('<bash-input>ls</bash-input>'),
    user({ garip: 'nesne' }),                                      // dize/dizi olmayan içerik → boş
    { type: 'user' },                                              // mesajsız kullanıcı
    { type: 'assistant' },                                         // mesajsız asistan
    { type: 'assistant', message: { content: 'dize içerik' } },    // dizi olmayan asistan içeriği
    { type: 'custom-title', customTitle: 'B', message: { content: [{ type: 'text', text: 'asistan değil' }] } },
  ]);
  assert.deepEqual(await extractRows(file), [{ kind: 'u', body: 'kalan metin' }, { kind: 'title', body: 'B' }]);
});

test('extractRows: araç çağrısı ilk dolu alanla (command, file_path, path, url, pattern, query) yazılır', async () => {
  const dir = tmp();
  const tool = (name, input) => ({ type: 'tool_use', name, input });
  const file = writeLines(dir, 'x.jsonl', [asst(
    tool('Bash', { command: 'ls -la' }),
    tool('Read', { file_path: '/a/b.txt' }),
    tool('Glob', { path: '/kok' }),
    tool('WebFetch', { url: 'https://ornek.com' }),
    tool('Grep', { pattern: 'ara.*' }),
    tool('WebSearch', { query: 'hava durumu' }),
    tool('Bos', {}),
    tool('Sayi', { command: 42 }),
    tool('Uzun', { command: 'y'.repeat(500) }),
    { type: 'tool_use', name: 'Girdisiz' },                        // input yok → atlanır
    { type: 'thinking', thinking: 'düşünce' },
  )]);
  assert.deepEqual((await extractRows(file)).map(r => r.kind + ' ' + r.body), [
    't [Bash] ls -la', 't [Read] /a/b.txt', 't [Glob] /kok', 't [WebFetch] https://ornek.com',
    't [Grep] ara.*', 't [WebSearch] hava durumu', 't [Bos] ', 't [Sayi] 42', 't [Uzun] ' + 'y'.repeat(400),
  ]);
});

test('extractRows: 2 MB üstü "text" içermeyen dev satır ön elemede atlanır, sınırdaki satır ayrıştırılır', async () => {
  const dir = tmp();
  const pad = n => { const head = '{"type":"user","message":{"content":"'; const tail = '"}}'; return head + 'a'.repeat(n - head.length - tail.length) + tail; };
  const exact = pad(2_000_000), over = pad(2_000_001);
  assert.equal(exact.length, 2_000_000); assert.equal(over.length, 2_000_001);
  const bigText = JSON.stringify(say('b'.repeat(2_000_100)));
  assert.ok(bigText.length > 2_000_000);
  const file = writeLines(dir, 'x.jsonl', [over, exact, bigText]);
  const rows = await extractRows(file);
  assert.deepEqual(rows.map(r => [r.kind, r.body[0], r.body.length]), [['u', 'a', 20000], ['a', 'b', 20000]]); // MAX_ROW ile kesilir
});

// ---------- SearchIndex: şema, temizlik, işlem ----------
test('şema sürümü farklıysa dizin sıfırlanır, aynıysa korunur', async () => {
  const dir = tmp();
  const a = session(dir, 'a', [user('kalıcı kelime')]);
  let si = new SearchIndex(dir); await si.sync([a]); si.close();
  si = new SearchIndex(dir);
  assert.equal(si.docs.size, 1); si.close();
  const raw = new DatabaseSync(path.join(dir, 'search.db'));
  raw.prepare("UPDATE meta SET v = '1' WHERE k = 'schema'").run(); raw.close();
  si = new SearchIndex(dir);
  assert.equal(si.docs.size, 0);
  assert.deepEqual(si.query('kalici'), []);
  si.close();
  const raw2 = new DatabaseSync(path.join(dir, 'search.db'));
  assert.equal(raw2.prepare("SELECT v FROM meta WHERE k = 'schema'").get().v, '2'); raw2.close();
});

test('eski metin önbelleği klasörü (text/) açılışta silinir', async () => {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, 'text', 'alt'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'text', 'alt', 'f.txt'), 'x');
  const si = new SearchIndex(dir);
  for (let i = 0; i < 200 && fs.existsSync(path.join(dir, 'text')); i++) await new Promise(r => setTimeout(r, 5));
  assert.equal(fs.existsSync(path.join(dir, 'text')), false);
  si.close();
});

test('index: hata olursa işlem geri alınır, eski satırlar korunur', () => {
  const si = new SearchIndex(tmp());
  si.index('x', [{ kind: 'u', body: 'eskimetin' }], 1, 1);
  assert.throws(() => si.index('x', [{ kind: 'u', body: 'yenimetin' }, { kind: 'u', body: null }], 2, 2));
  assert.equal(si.query('eskimetin')[0].id, 'x');
  assert.deepEqual(si.query('yenimetin'), []);
  assert.equal(si.docs.size, 1);
  si.close();
  assert.doesNotThrow(() => si.close()); // ikinci kapatma sessiz
});

// ---------- sync ----------
test('sync: değişmeyen oturum atlanır; mtime ya da boyut değişince yeniden dizinlenir', async () => {
  const dir = tmp();
  const s = session(dir, 'a', [user('birinciicerik')], { mtimeMs: 1, size: 1 });
  const si = new SearchIndex(dir);
  await si.sync([s]);
  writeLines(dir, 'a.jsonl', [user('ikinciicerik')]);
  await si.sync([{ ...s }]);                                       // aynı mtime+boyut → atlanır
  assert.equal(si.query('birinciicerik').length, 1);
  assert.equal(si.query('ikinciicerik').length, 0);
  await si.sync([{ ...s, size: 2 }]);                              // yalnızca boyut değişti
  assert.equal(si.query('ikinciicerik').length, 1);
  writeLines(dir, 'a.jsonl', [user('ucuncuicerik')]);
  await si.sync([{ ...s, mtimeMs: 2, size: 2 }]);                  // yalnızca mtime değişti
  assert.equal(si.query('ucuncuicerik').length, 1);
  assert.equal(si.query('ikinciicerik').length, 0);
  si.close();
});

test('sync: listede olmayan oturumlar dizinden silinir', async () => {
  const dir = tmp();
  const a = session(dir, 'a', [user('ortak elma')]), b = session(dir, 'b', [user('ortak armut')]);
  const si = new SearchIndex(dir);
  await si.sync([a, b]);
  assert.equal(si.query('ortak').length, 2);
  await si.sync([b]);
  assert.deepEqual(si.query('ortak').map(r => r.id), ['b']);
  assert.deepEqual(si.query('elma'), []);
  assert.equal(si.docs.size, 1);
  si.close();
});

test('sync: ilerleme bildirimi her dosyada ve hiç iş yoksa (0,0) olarak gelir', async () => {
  const dir = tmp();
  const a = session(dir, 'a', [user('bir')]), b = session(dir, 'b', [user('iki')]);
  const si = new SearchIndex(dir);
  const calls = [];
  await si.sync([a, b], (d, t) => calls.push([d, t]));
  assert.deepEqual(calls, [[1, 2], [2, 2]]);
  assert.deepEqual(si.progress, { done: 2, total: 2 });
  calls.length = 0;
  await si.sync([a, b], (d, t) => calls.push([d, t]));
  assert.deepEqual(calls, [[0, 0]]);
  await si.sync([a, b]);                                           // geri çağırmasız da çalışır
  await si.sync([a, { ...b, size: 99 }]);
  assert.equal(si.progress.done, 1);
  si.close();
});

test('sync: okunamayan dosya uyarıyla atlanır, diğerleri dizinlenir ve sonra yeniden denenir', async () => {
  const dir = tmp();
  const ok = session(dir, 'ok', [user('saglamdosya')]);
  const gone = { id: 'yok', file: path.join(dir, 'yok.jsonl'), mtimeMs: 1, size: 1 };
  const si = new SearchIndex(dir);
  const calls = [];
  const warns = await quiet(() => si.sync([gone, ok], (d, t) => calls.push([d, t])));
  assert.equal(warns.length, 1);
  assert.equal(warns[0][1], gone.file);
  assert.deepEqual(calls, [[1, 2], [2, 2]]);
  assert.equal(si.query('saglamdosya')[0].id, 'ok');
  assert.equal(si.docs.size, 1);
  fs.writeFileSync(gone.file, JSON.stringify(user('sonradangeldi')));
  await si.sync([gone, ok]);
  assert.equal(si.query('sonradangeldi')[0].id, 'yok');
  si.close();
});

test('sync: sürerken gelen istekler tek bir ikinci turda en son listeyle işlenir ve o turu bekler', async () => {
  const dir = tmp();
  const a = session(dir, 'a', [user('alfa')]), b = session(dir, 'b', [user('beta')]), c = session(dir, 'c', [user('gama')]);
  const si = new SearchIndex(dir);
  const last = [];
  const p1 = si.sync([a]);
  const p2 = si.sync([a, b], () => assert.fail('eski geri çağırma kullanılmamalı'));
  const p3 = si.sync([a, c], (d, t) => last.push([d, t]));
  assert.ok(p2 instanceof Promise);
  assert.strictEqual(p2, p3);
  assert.notStrictEqual(p1, p2);
  await p2;                                                        // ikinci tur da bitmiş olmalı
  assert.equal(si.building, null);
  assert.equal(si.query('gama')[0].id, 'c');
  assert.deepEqual(si.query('beta'), []);                          // ara liste atlandı
  assert.deepEqual(last, [[1, 1]]);
  await p1;                                                        // ilk tur da sorunsuz bitti
  // bir sonraki eşzamanlı istek yeni bir tur açar (önceki söz yeniden kullanılmaz)
  const q1 = si.sync([a, b]); const q2 = si.sync([a, b]);
  assert.notStrictEqual(q2, p2);
  await q2;
  assert.equal(si.query('beta')[0].id, 'b');
  await q1;
  si.close();
});

test('sync: ilk tur hata verse de bekleyen ikinci tur koşar', async () => {
  const dir = tmp();
  const a = session(dir, 'a', [user('kurtarildi')]);
  const si = new SearchIndex(dir);
  const p1 = si.sync(null);
  const p2 = si.sync([a]);
  await assert.rejects(p1, TypeError);
  await p2;
  assert.equal(si.query('kurtarildi')[0].id, 'a');
  si.close();
});

// ---------- query ----------
async function indexed(lines, id = 's') {
  const dir = tmp();
  const s = session(dir, id, lines);
  const si = new SearchIndex(dir); await si.sync([s]);
  return si;
}

test('query: boş, tanımsız, tek harfli ve yalnızca noktalama girdiler boş döner; iki harf yeter', async () => {
  const si = await indexed([user('ab robots c++ derleyici')]);
  for (const q of ['', '   ', undefined, null, 'a', 'a b', '""', '-> ...', '"'])
    assert.deepEqual(si.query(q), [], String(q));
  assert.equal(si.query('ab')[0].id, 's');
  assert.equal(si.query('c++')[0].id, 's');
  si.close();
});

test('query: noktalama kelimesi aramayı boşaltmaz (VE yalnızca anlamlı kelimelerle)', async () => {
  const si = await indexed([user('robots dosyası hazır')]);
  assert.equal(si.query('robots ->').length, 1);
  assert.equal(si.query('... robots -- dosya').length, 1);
  si.close();
});

test('query: tırnak ve FTS operatörleri kaçamaz, düz kelime olarak aranır', async () => {
  const si = await indexed([user('robots near and canonical')]);
  assert.equal(si.query('ro"bots')[0].id, 's');                   // tırnak kelimeden atılır
  assert.equal(si.query('robots" OR "yokyok').length, 0);         // OR operatör değil: üç kelime VE
  assert.equal(si.query('robots NOT canonical').length, 0);       // NOT de kelime
  assert.equal(si.query('NEAR AND').length, 1);                   // metinde gerçekten geçiyor
  assert.equal(si.query('robots*').length, 1);                    // yıldız token ayırıcı
  assert.deepEqual(si.query('robots) OR (1=1'), []);
  assert.deepEqual(si.query("'; DROP TABLE docs; --"), []);
  assert.equal(si.docs.size, 1);
  si.close();
});

test('query: kapalı dizinde hata yerine boş sonuç', async () => {
  const si = await indexed([user('kapanis')]);
  si.close();
  assert.deepEqual(si.query('kapanis'), []);
});

test('query: Türkçe büyük harf ve önek eşleşmesi', async () => {
  const si = await indexed([user('İstanbul IĞDIR ılık')]);
  assert.equal(si.query('istanbul')[0].id, 's');
  assert.equal(si.query('ISTAN')[0].id, 's');
  assert.equal(si.query('ığdır ILIK')[0].id, 's');
  si.close();
});

test('query: isabetler kelimeler arasında toplanır, çoktan aza sıralanır, sınır uygulanır', async () => {
  const dir = tmp();
  // kimlik sırası (a, b, c) isabet sırasının tersi: sıralama gerçekten yapılmalı
  const a = session(dir, 'a', [user('elma')]);                                  // armut yok
  const b = session(dir, 'b', [user('elma armut')]);                            // 1 + 1
  const c = session(dir, 'c', [user('elma'), user('elma'), user('elma armut')]); // elma 3 + armut 1
  const si = new SearchIndex(dir); await si.sync([a, b, c]);
  assert.deepEqual(si.query('armut elma').map(r => [r.id, r.hits]), [['c', 4], ['b', 2]]);
  assert.deepEqual(si.query('elma').map(r => [r.id, r.hits]), [['c', 3], ['a', 1], ['b', 1]]);
  assert.deepEqual(si.query('elma', 1).map(r => r.id), ['c']);
  assert.deepEqual(si.query('elma yokkelime'), []);
  si.close();
});

test('alıntı: kısa metinde üç nokta yok, boşluklar sadeleşir', async () => {
  const si = await indexed([user('kısa   metin\nburada')]);
  assert.equal(si.query('metin')[0].snippet, 'kısa metin burada');
  si.close();
});

test('alıntı sınırları: başta/sonda üç nokta yalnızca kesilince', async () => {
  const pre = 'p'.repeat(100), post = 'q'.repeat(300);
  const body = pre + ' hedef ' + post;                            // hedef 101. konumda
  let si = await indexed([user(body)]);
  const i = body.indexOf('hedef');
  assert.equal(si.query('hedef')[0].snippet, '…' + body.slice(i - 70, i + 170) + '…');
  si.close();
  const b2 = 'r'.repeat(69) + ' son' + 's'.repeat(167);            // i=70 → a=0 ve i+170 = uzunluk: tam sınırlar
  si = await indexed([user(b2)]);
  assert.equal(b2.indexOf('son'), 70); assert.equal(b2.length, 70 + 170);
  assert.equal(si.query('son')[0].snippet, b2);
  si.close();
  const longer = b2 + 't';
  si = await indexed([user(longer)]);
  assert.equal(si.query('son')[0].snippet, b2 + '…');
  si.close();
  const shifted = 'u' + b2;                                        // i=71 → a=1
  si = await indexed([user(shifted)]);
  assert.equal(si.query('son')[0].snippet, '…' + b2);
  si.close();
});

test('alıntı konumu: ilk kelime başta bulunursa sonraki kelimeye kaymaz', async () => {
  const body = 'ab ' + 'x'.repeat(200) + ' cd';
  const si = await indexed([user(body)]);
  assert.equal(si.query('ab cd')[0].snippet, body.slice(0, 170) + '…');
  si.close();
});

test('alıntı konumu: kelime tam bulunmazsa ilk token, o da yoksa metnin başı kullanılır', async () => {
  const body = 'k'.repeat(100) + ' robots txt ' + 'z'.repeat(300);
  let si = await indexed([user(body)]);
  const i = body.indexOf('robots');
  assert.equal(si.query('robots.txt')[0].snippet, '…' + body.slice(i - 70, i + 170) + '…');
  si.close();
  const cafe = 'm'.repeat(100) + ' café ' + 'n'.repeat(300);       // FTS aksanı siler, norm silmez → konum bulunamaz
  si = await indexed([user(cafe)]);
  assert.equal(si.query('cafe')[0].snippet, cafe.slice(0, 170) + '…');
  si.close();
});

test('alıntı Türkçe metinde asıl yazımı aynı konumdan gösterir', async () => {
  const body = 'Ş'.repeat(90) + ' GETİRİLEMEDİ hatası ' + 'İ'.repeat(200);
  const si = await indexed([user(body)]);
  const i = body.indexOf('GETİRİLEMEDİ');
  assert.equal(si.query('getirilemedi')[0].snippet, '…' + body.slice(i - 70, i + 170) + '…');
  si.close();
});
