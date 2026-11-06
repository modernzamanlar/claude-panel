// node --test test/q-sessions.test.js → src/main/sessions.js için kenar durumları (tam kapsam + mutasyon dayanıklılığı)
// Gerçek ~/.claude ve ~/.claude-panel'e hiç dokunulmaz: HOME ve CLAUDE_PANEL_HOME modül yüklenmeden geçici klasöre çevrilir.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fsp = fs.promises;
const WIN = process.platform === 'win32';

const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cp-qs-')));
const EV = path.join(TMP, 'ev');
const PANEL = path.join(TMP, 'panel');
fs.mkdirSync(EV, { recursive: true });
process.env.HOME = EV; process.env.USERPROFILE = EV;
process.env.CLAUDE_PANEL_HOME = PANEL;
const S = require('../src/main/sessions');
const { summarize, loadSession, SessionLoader, SessionIndex, tilde, makeTilde, prettyModel, imagesOf, pruneImages } = S;

const HEAD = 256 * 1024, TAIL = 768 * 1024, LIVE = 90 * 1000;
let seq = 0;
const newDir = () => { const d = path.join(TMP, 'd' + (seq++)); fs.mkdirSync(d, { recursive: true }); return d; };
const line = l => typeof l === 'string' ? l : JSON.stringify(l);
function jsonl(lines, { dir = newDir(), id = 'aaaaaaaa-0000-0000-0000-' + String(seq).padStart(12, '0'), end = '\n' } = {}) {
  const f = path.join(dir, id + '.jsonl');
  fs.writeFileSync(f, lines.map(line).join('\n') + end);
  return f;
}
// Tam olarak `bytes` baytlık (satır sonu hariç) dolgu satırı
const pad = bytes => '{"type":"pad","p":"' + 'x'.repeat(bytes - 21) + '"}';
const user = (content, extra = {}) => ({ type: 'user', message: { role: 'user', content }, ...extra });
const asst = (content, extra = {}, msg = {}) => ({ type: 'assistant', message: { role: 'assistant', content, ...msg }, ...extra });
const b64 = s => Buffer.from(s).toString('base64');
const imgBlock = (data, media_type = 'image/png') => ({ type: 'image', source: { type: 'base64', media_type, data: b64(data) } });
const cachedPath = (data, ext = '.png') => path.join(PANEL, 'gorseller', crypto.createHash('sha1').update(b64(data)).digest('hex').slice(0, 24) + ext);

// Büyük dosya: baş satırları + dolgu (HEAD sınırını bir satır ortasından keser) + orta + dolgu + son satırlar.
// Son TAIL baytlık pencere de bir dolgu satırının ortasından başlar.
function bigFile({ head = [], middle = [], tail = [] }) {
  const parts = [...head.map(line)];
  let size = () => parts.reduce((n, p) => n + Buffer.byteLength(p) + 1, 0);
  parts.push(pad(500 + (HEAD - size()) % 997)); // sınırı satırın ortasına denk getirmek için tuhaf bir boy
  while (size() <= HEAD + 2000) parts.push(pad(999));
  parts.push(...middle.map(line));
  const tailTxt = tail.map(line);
  const tailBytes = tailTxt.reduce((n, p) => n + Buffer.byteLength(p) + 1, 0);
  while (size() + tailBytes < HEAD + TAIL + 50000) parts.push(pad(999));
  parts.push(...tailTxt);
  const f = path.join(newDir(), 'bbbbbbbb-0000-0000-0000-000000000001.jsonl');
  const txt = parts.join('\n') + '\n';
  fs.writeFileSync(f, txt);
  const buf = Buffer.from(txt);
  // kesim noktaları gerçekten satır ortasında mı?
  assert.notStrictEqual(buf[HEAD - 1], 10);
  assert.notStrictEqual(buf[buf.length - TAIL - 1], 10);
  return f;
}

test('ortam: veri klasörleri geçici eve yönlenir (gerçek ~/.claude-panel kullanılmaz)', () => {
  assert.strictEqual(S.PROJECTS_DIR, path.join(EV, '.claude', 'projects'));
  assert.strictEqual(S.IMG_DIR, path.join(PANEL, 'gorseller'));
});

test('listFiles: proje klasörü yoksa boş liste', async () => {
  const idx = new SessionIndex(path.join(TMP, 'yok', 'index.json'));
  assert.deepStrictEqual(await idx.listFiles(), []);
  assert.deepStrictEqual(await idx.refresh(), []);
});

// ---------------- prettyModel / tilde ----------------
test('model adı: boş, sentetik, tanınmayan, tarihli ve alt sürümlü kimlikler', () => {
  assert.strictEqual(prettyModel(''), '');
  assert.strictEqual(prettyModel(undefined), '');
  assert.strictEqual(prettyModel('<synthetic>'), '');
  assert.strictEqual(prettyModel('gpt-5'), 'gpt-5');
  assert.strictEqual(prettyModel('claude-opus-4-1'), 'Opus 4.1');
  assert.strictEqual(prettyModel('claude-x-4-10'), 'X 4.10');
  assert.strictEqual(prettyModel('claude-x-4-100'), 'X 4');
  assert.strictEqual(prettyModel('claude-opus-4-20250514'), 'Opus 4');
  assert.strictEqual(prettyModel('claude-haiku-5'), 'Haiku 5');
});

test('tilde (Windows): büyük/küçük harf duyarsız, "\\" ve "/" ayraç, Ali2 kısaltılmaz', () => {
  const t = makeTilde('C:\\Users\\Ali', 'win32');
  assert.strictEqual(t('C:\\Users\\Ali'), '~');
  assert.strictEqual(t('c:\\users\\ali'), '~');
  assert.strictEqual(t('C:\\USERS\\ALI\\Desktop'), '~\\Desktop');
  assert.strictEqual(t('C:\\Users\\Ali/Desktop'), '~/Desktop');
  assert.strictEqual(t('C:\\Users\\Ali2\\x'), 'C:\\Users\\Ali2\\x');
  assert.strictEqual(t('D:\\x'), 'D:\\x');
  assert.strictEqual(t(''), '');
  assert.strictEqual(t(null), null);
  assert.strictEqual(t(undefined), undefined);
});

test('tilde (macOS): harf duyarsız ama "\\" ayraç sayılmaz', () => {
  const t = makeTilde('/Users/ali', 'darwin');
  assert.strictEqual(t('/users/ALI/x'), '~/x');
  assert.strictEqual(t('/Users/ali\\x'), '/Users/ali\\x');
  assert.strictEqual(t('/Users/alix'), '/Users/alix');
});

test('tilde (Linux): harf duyarlı', () => {
  const t = makeTilde('/home/ali', 'linux');
  assert.strictEqual(t('/home/ali/x'), '~/x');
  assert.strictEqual(t('/home/ali'), '~');
  assert.strictEqual(t('/HOME/ali/x'), '/HOME/ali/x');
  assert.strictEqual(t('/home/ali\\x'), '/home/ali\\x');
});

test('tilde: küçük harfe çevirince uzayan "İ" öneki kaydırmaz (hata düzeltmesi)', () => {
  const t = makeTilde('C:\\Users\\İsmail', 'win32');
  assert.strictEqual(t('C:\\Users\\İsmail\\Masaüstü'), '~\\Masaüstü');
  assert.strictEqual(t('c:\\users\\i̇smail\\x'), 'c:\\users\\i̇smail\\x'); // eskiden "~l\x" dönüyordu
});

test('tilde: varsayılan, modülün gördüğü ev klasörünü kullanır', () => {
  assert.strictEqual(tilde(EV), '~');
  assert.strictEqual(tilde(path.join(EV, 'a', 'b')), path.join('~', 'a', 'b')); // ayraç platformun kendi ayracı kalır
  assert.strictEqual(tilde('/baska/yer'), '/baska/yer');
});

// ---------------- summarize ----------------
test('özet: küçük dosyada alan seçim kuralları (ilk/son, meta, yan zincir, sentetik model)', async () => {
  const f = jsonl([
    'null', '42', '{yarım', '',
    { type: 'system' },
    { type: 'attachment', attachment: { snapshot: { workingDirectory: '/ek/klasor' } }, timestamp: '2026-02-01T00:00:00Z' },
    user('meta mesaj', { isMeta: true, cwd: '/baska', timestamp: '2026-02-02T00:00:00Z' }),
    user('yan zincir', { isSidechain: true }),
    asst('asistan metni', {}, { model: 'claude-opus-5-5', usage: { input_tokens: 9 } }),
    { type: 'assistant' },
    user('<command-name>/clear</command-name>'),
    user('gerçek ilk soru', { permissionMode: 'plan' }),
    user('ikinci soru', { permissionMode: 'acceptEdits' }),
    asst([], { isSidechain: true }, { model: 'claude-haiku-5', usage: { input_tokens: 99999 } }),
    asst([], {}, { model: '<synthetic>', usage: { input_tokens: 1, cache_read_input_tokens: 10, cache_creation_input_tokens: 100, output_tokens: 1000 } }),
    asst([], {}, {}),
    { type: 'assistant', permissionMode: 'bypassPermissions', message: {} },
    { type: 'custom-title', customTitle: 'Eski başlık' },
    { type: 'custom-title', customTitle: 'Başlık' },
    { type: 'custom-title', customTitle: '' },
    { type: 'last-prompt', lastPrompt: 'son' },
    { type: 'bridge-session' },
    { type: 'x', timestamp: '2026-03-03T00:00:00Z' },
    { type: 'y' },
  ]);
  const s = await summarize(f);
  assert.strictEqual(s.id, path.basename(f, '.jsonl'));
  assert.strictEqual(s.file, f);
  assert.strictEqual(s.size, fs.statSync(f).size);
  assert.strictEqual(s.mtimeMs, fs.statSync(f).mtimeMs);
  assert.strictEqual(s.cwd, '/ek/klasor');
  assert.strictEqual(s.project, '/ek/klasor');
  assert.strictEqual(s.firstTs, '2026-02-01T00:00:00Z');
  assert.strictEqual(s.lastTs, '2026-03-03T00:00:00Z');
  assert.strictEqual(s.title, 'Başlık');
  assert.strictEqual(s.model, 'Opus 5.5');
  assert.strictEqual(s.modelId, 'claude-opus-5-5');
  assert.strictEqual(s.ctxTokens, 1111);
  assert.strictEqual(s.bridge, true);
  assert.strictEqual(s.permissionMode, 'acceptEdits');
});

test('özet: başlık yoksa ilk gerçek istem (boşluklar sadeleşir, 70 karakter)', async () => {
  const long = 'gerçek   ilk\nsoru ' + 'ç'.repeat(100);
  const f = jsonl([
    { type: 'user', cwd: '/p' }, // mesajsız kullanıcı kaydı
    user('meta', { isMeta: true }),
    user('yan', { isSidechain: true }),
    asst('asistan istem gibi'),
    user('<system-reminder>gizli</system-reminder>'),
    user([{ type: 'text', text: '[Request interrupted by user]' }]),
    user('<bash-input>ls</bash-input>'),
    user('<local-command-stdout>x</local-command-stdout>'),
    user('<user-memory-input>x</user-memory-input>'),
    user('<task-notification>x</task-notification>'),
    user([{ type: 'text', text: '<system-reminder>r</system-reminder>' + long }, { type: 'image' }]),
    user('ikinci soru'),
    { type: 'last-prompt', lastPrompt: 'son istem' },
  ]);
  const s = await summarize(f);
  assert.strictEqual(s.title, ('gerçek ilk soru ' + 'ç'.repeat(100)).slice(0, 70));
  assert.strictEqual(s.title.length, 70);
  assert.strictEqual(s.bridge, false);
  assert.strictEqual(s.permissionMode, null);
});

test('özet: istem yoksa son istem kaydı, o da yoksa "Adsız sohbet"', async () => {
  const f = jsonl([{ type: 'last-prompt', lastPrompt: 'son  istem' }, { type: 'last-prompt', lastPrompt: '' }, { type: 'last-prompt' }]);
  assert.strictEqual((await summarize(f)).title, 'son istem');
  const g = jsonl(['null', '{bozuk'], { end: '' });
  const s = await summarize(g);
  assert.strictEqual(s.title, 'Adsız sohbet');
  assert.strictEqual(s.cwd, null);
  assert.strictEqual(s.project, '(bilinmiyor)');
  assert.strictEqual(s.firstTs, null);
  assert.strictEqual(s.lastTs, new Date(fs.statSync(g).mtimeMs).toISOString());
  assert.strictEqual(s.model, '');
  assert.strictEqual(s.modelId, null);
  assert.strictEqual(s.ctxTokens, 0);
});

test('özet: eksik kullanım alanları 0 sayılır, ev altındaki proje ~ ile gösterilir', async () => {
  const f = jsonl([user('x', { cwd: path.join(EV, 'proje') }), asst([], {}, { usage: { output_tokens: 7 } })]);
  const s = await summarize(f);
  assert.strictEqual(s.ctxTokens, 7);
  assert.strictEqual(s.project, path.join('~', 'proje'));
  assert.strictEqual(s.cwd, path.join(EV, 'proje'));
  const g = jsonl([asst([], {}, { usage: { input_tokens: 3 } })]);
  assert.strictEqual((await summarize(g)).ctxTokens, 3);
});

test('özet: "canlı" işareti son 90 saniyeye göre (sınır dahil değil)', async t => {
  const f = jsonl([user('x')]);
  const T = 1_800_000_000;
  fs.utimesSync(f, T, T);
  t.mock.timers.enable({ apis: ['Date'], now: T * 1000 + LIVE - 1 });
  assert.strictEqual((await summarize(f)).live, true);
  t.mock.timers.setTime(T * 1000 + LIVE);
  assert.strictEqual((await summarize(f)).live, false);
  t.mock.timers.setTime(T * 1000 - 5);
  assert.strictEqual((await summarize(f)).live, true);
});

test('özet: büyük dosyada baş ve son ayrı okunur; ortadaki ve yarım satırlar yok sayılır; başlık yalnızca baştaysa bulunur', async () => {
  const f = bigFile({
    head: [
      { type: 'x' },
      user('ilk soru', { cwd: '/proje/bas', timestamp: '2026-01-01T00:00:00Z' }),
      { type: 'custom-title', customTitle: 'Eski baş başlığı' },
      { type: 'custom-title', customTitle: 'Baştaki başlık' },
      { type: 'custom-title', customTitle: '' },
    ],
    middle: [{ type: 'custom-title', customTitle: 'Ortadaki' }, { type: 'bridge-session' }, asst([], {}, { model: 'claude-haiku-5' }), { type: 'user', permissionMode: 'plan' }],
    tail: [
      { type: 'z', cwd: '/proje/son' },
      asst([], { timestamp: '2026-01-02T00:00:00Z' }, { model: 'claude-sonnet-5-5', usage: { input_tokens: 2 } }),
      { type: 'last-prompt', lastPrompt: 'son istem' },
    ],
  });
  const s = await summarize(f);
  assert.strictEqual(s.title, 'Baştaki başlık');
  assert.strictEqual(s.cwd, '/proje/bas');
  assert.strictEqual(s.firstTs, '2026-01-01T00:00:00Z');
  assert.strictEqual(s.lastTs, '2026-01-02T00:00:00Z');
  assert.strictEqual(s.model, 'Sonnet 5.5');
  assert.strictEqual(s.ctxTokens, 2);
  assert.strictEqual(s.bridge, false);
  assert.strictEqual(s.permissionMode, null);
});

test('özet: büyük dosyada sondaki başlık baştakini ezer; baş cwd vermezse sondaki ilk cwd kullanılır', async () => {
  const f = bigFile({
    head: [{ type: 'custom-title', customTitle: 'Baş' }, { type: 'last-prompt', lastPrompt: 'baştaki son istem' }],
    tail: [{ type: 'q', cwd: '/son/a' }, { type: 'q', cwd: '/son/b' }, { type: 'custom-title', customTitle: 'Son' }],
  });
  const s = await summarize(f);
  assert.strictEqual(s.title, 'Son');
  assert.strictEqual(s.cwd, '/son/a');
  const g = bigFile({ head: [{ type: 'last-prompt', lastPrompt: 'baştaki' }], tail: [] });
  assert.strictEqual((await summarize(g)).title, 'Adsız sohbet'); // last-prompt yalnızca sondan okunur
});

test('özet: son penceresi tam satır başına denk gelince o satır kaybolmaz (hata düzeltmesi)', async () => {
  const first = pad(4999); // + satır sonu = 5000 bayt
  const bridge = '{"type":"bridge-session"}';
  const rest = pad(TAIL - Buffer.byteLength(bridge) - 1 - 1);
  const txt = first + '\n' + bridge + '\n' + rest + '\n';
  const f = path.join(newDir(), 'cccccccc-0000-0000-0000-000000000001.jsonl');
  fs.writeFileSync(f, txt);
  assert.strictEqual(Buffer.byteLength(txt) - TAIL, 5000); // bridge satırı tam pencere başında
  assert.strictEqual((await summarize(f)).bridge, true);
});

test('özet: HEAD ile TAIL arasındaki dosyada son okuma baştan başlar ve ilk satır atılmaz', async () => {
  const f = jsonl([{ type: 'bridge-session' }, user('soru'), pad(300 * 1024)]);
  const s = await summarize(f);
  assert.strictEqual(s.bridge, true);
  assert.strictEqual(s.title, 'soru');
});

test('özet: tam HEAD boyundaki dosyada son satır (satır sonu olmadan) atılmaz', async () => {
  const last = line(user('sınırdaki soru'));
  const first = pad(HEAD - Buffer.byteLength(last) - 1);
  const f = path.join(newDir(), 'dddddddd-0000-0000-0000-000000000001.jsonl');
  fs.writeFileSync(f, first + '\n' + last);
  assert.strictEqual(fs.statSync(f).size, HEAD);
  assert.strictEqual((await summarize(f)).title, 'sınırdaki soru');
});

test('özet: büyük dosyada sondaki boş başlık kaydı son geçerli başlığı silmez (baştakine dönülmez)', async () => {
  const f = bigFile({
    head: [{ type: 'custom-title', customTitle: 'Baş' }],
    tail: [{ type: 'custom-title', customTitle: 'Son' }, { type: 'custom-title', customTitle: '' }],
  });
  assert.strictEqual((await summarize(f)).title, 'Son');
});

test('özet: büyük dosyanın satır sonu olmayan son satırı da okunur', async () => {
  const f = bigFile({ tail: [{ type: 'custom-title', customTitle: 'Sonuncu' }] });
  fs.truncateSync(f, fs.statSync(f).size - 1); // sondaki \n atıldı
  assert.strictEqual((await summarize(f)).title, 'Sonuncu');
});

test('dizin: önbellek dosyası iç içe olmayan klasörlerde de yazılır, var olan klasörde yeniden yazılır', async t => {
  const p = projDir('onbellek'), cache = path.join(newDir(), 'a', 'b', 'index.json');
  t.after(() => fs.rmSync(p, { recursive: true })); // ortak proje klasörü sonraki testlere karışmasın
  jsonl([user('bir')], { dir: p, id: idOf(1) });
  const idx = new SessionIndex(cache);
  await idx.refresh();
  assert.strictEqual(JSON.parse(fs.readFileSync(cache, 'utf8')).sessions.length, 1);
  jsonl([user('iki')], { dir: p, id: idOf(2) });
  await idx.refresh();
  assert.strictEqual(JSON.parse(fs.readFileSync(cache, 'utf8')).sessions.length, 2);
});

test('özet: tek satırı HEAD’den uzun dosya çökmez', async () => {
  const f = jsonl([pad(HEAD + 1000), { type: 'custom-title', customTitle: 'Uzun' }, user('x', { cwd: '/kuyruk' })]);
  const s = await summarize(f);
  assert.strictEqual(s.title, 'Uzun');
  assert.strictEqual(s.cwd, '/kuyruk');
});

// ---------------- görseller ----------------
test('görsel: base64 blok içerik özetiyle bir kez önbelleğe yazılır', () => {
  const p = cachedPath('PNGVERI');
  assert.deepStrictEqual(imagesOf([imgBlock('PNGVERI')]), [p]);
  assert.strictEqual(fs.readFileSync(p, 'utf8'), 'PNGVERI');
  assert.ok(!fs.existsSync(p + '.tmp'));
  fs.writeFileSync(p, 'degistirildi');
  assert.deepStrictEqual(imagesOf([imgBlock('PNGVERI'), imgBlock('PNGVERI')]), [p]); // tekrar yazılmaz, tekrar eklenmez
  assert.strictEqual(fs.readFileSync(p, 'utf8'), 'degistirildi');
  assert.deepStrictEqual(imagesOf([imgBlock('J', 'image/jpeg'), imgBlock('G', 'image/gif'), imgBlock('W', 'image/webp')]),
    [cachedPath('J', '.jpg'), cachedPath('G', '.gif'), cachedPath('W', '.webp')]);
});

test('görsel: geçersiz bloklar atlanır', () => {
  assert.deepStrictEqual(imagesOf([
    { type: 'image' },
    { type: 'image', source: { type: 'url', media_type: 'image/png', data: b64('a') } },
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: '' } },
    { type: 'image', source: { type: 'base64', media_type: 'image/bmp', data: b64('a') } },
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 123 } }, // özet hesaplanamaz → null
  ]), []);
  assert.deepStrictEqual(imagesOf(undefined), []);
  assert.deepStrictEqual(imagesOf(42), []);
});

test('görsel: "[Image: source: …]" başvuruları — yalnızca var olan, mutlak, görsel uzantılı yollar', t => {
  const d = newDir();
  const png = path.join(d, 'a.png'), up = path.join(d, 'B.PNG'), txt = path.join(d, 'c.txt');
  for (const f of [png, up, txt]) fs.writeFileSync(f, 'x');
  fs.writeFileSync(path.join(d, 'rel.png'), 'x');
  const cwd = process.cwd(); process.chdir(d); t.after(() => process.chdir(cwd));
  const text = `[Image: source:  ${png} ] [Image: source: ${up}] [Image: source: ${txt}] [Image: source: ${path.join(d, 'yok.png')}] [Image: source: rel.png] [Image: source: ${png}]`;
  assert.deepStrictEqual(imagesOf(text), [png, up]);
  assert.deepStrictEqual(imagesOf([{ type: 'text', text }, { type: 'text' }, { type: 'tool_reference', text: `[Image: source: ${png}]` }]), [png, up]);
  assert.deepStrictEqual(imagesOf([{ type: 'tool_reference', text: `[Image: source: ${png}]` }]), []);
});

test('görsel: en fazla 8 görsel', () => {
  const d = newDir();
  const files = Array.from({ length: 10 }, (_, i) => { const f = path.join(d, i + '.png'); fs.writeFileSync(f, 'x'); return f; });
  assert.deepStrictEqual(imagesOf(files.map(f => `[Image: source: ${f}]`).join('\n')), files.slice(0, 8));
});

test('görsel temizliği: hem erişim hem değişiklik zamanı eskiyse silinir (sınır dahil değil)', async () => {
  const d = newDir(), T = 1_700_000_000, DAY = 86400;
  const mk = (n, at, mt) => { const f = path.join(d, n); fs.writeFileSync(f, 'x'); fs.utimesSync(f, at, mt); return f; };
  const now = (T + 30 * DAY) * 1000;
  const eski = mk('eski.png', T - 1, T - 1);
  const sinir = mk('sinir.png', T, T);
  const yeniErisim = mk('erisim.png', T + 10, T - 1);
  const yeniDegisim = mk('degisim.png', T - 1, T + 10);
  // kırık bağ: stat hatası yutulur. Windows'ta sembolik bağ yönetici/geliştirici modu ister (EPERM): o zaman bu kısım atlanır
  let kirik = ['kirik'];
  try { fs.symlinkSync(path.join(d, 'hedef-yok'), path.join(d, 'kirik')); } catch (e) { if (!WIN || e.code !== 'EPERM') throw e; kirik = []; }
  await pruneImages(30, d, now);
  assert.deepStrictEqual(fs.readdirSync(d).sort(), ['degisim.png', 'erisim.png', ...kirik, 'sinir.png']);
  assert.ok(!fs.existsSync(eski) && fs.existsSync(sinir) && fs.existsSync(yeniErisim) && fs.existsSync(yeniDegisim));
  await pruneImages(1, d, now); // gün sayısı dikkate alınır
  assert.deepStrictEqual(fs.readdirSync(d), kirik);
  assert.strictEqual(await pruneImages(30, path.join(d, 'yok')), undefined); // klasör yoksa sessizce biter
});

test('görsel temizliği: varsayılanlar önbellek klasörü ve şimdiki zaman', async () => {
  fs.mkdirSync(S.IMG_DIR, { recursive: true });
  const eski = path.join(S.IMG_DIR, 'eski.png'), yeni = path.join(S.IMG_DIR, 'yeni.png');
  fs.writeFileSync(eski, 'x'); fs.writeFileSync(yeni, 'x');
  const old = Date.now() / 1000 - 31 * 86400, mid = Date.now() / 1000 - 29 * 86400;
  fs.utimesSync(eski, old, old); fs.utimesSync(yeni, mid, mid);
  await pruneImages();
  assert.ok(!fs.existsSync(eski));
  assert.ok(fs.existsSync(yeni));
});

// ---------------- loadSession ----------------
test('mesajlar: araçlar, sonuçlar, hatalar, görseller ve çıktılar', async () => {
  const shot = path.join(newDir(), 'ekran.png'); fs.writeFileSync(shot, 'x');
  const f = jsonl([
    'null', '{bozuk', '7', '',
    user('ilk soru', { timestamp: 'T1' }),
    user('meta', { isMeta: true }),
    user('<command-name>/x</command-name>'),
    { type: 'user' },
    { type: 'assistant', timestamp: 'mesajsız' },
    asst('düz metin', { timestamp: 'dize-içerik' }),
    asst([
      { type: 'text', text: 'Merhaba' }, { type: 'text', text: '   ' }, { type: 'text', text: '' }, { type: 'thinking', thinking: 'düşünce' },
      { type: 'tool_use', id: 't1', name: 'Write', input: { file_path: path.join(EV, 'proje', 'a.txt'), content: 'x' } },
      { type: 'tool_use', id: 't2', name: 'Read', input: { file_path: '/oku.txt' } },
      { type: 'tool_use', id: 't3', name: 'Bash' },
      { type: 'tool_use', id: 't4', name: 'NotebookEdit', input: { notebook_path: '/n.ipynb' } },
    ], { timestamp: 'T2' }),
    asst([
      { type: 'text', text: 'devam' },
      { type: 'tool_use', id: 't5', name: 'Edit', input: { file_path: path.join(EV, 'proje', 'a.txt') } },
      { type: 'tool_use', id: 't6', name: 'MultiEdit', input: { file_path: '/m.txt' } },
      { type: 'tool_use', id: 't7', name: 'Glob', input: { pattern: '**/*.js' } },
    ], { timestamp: 'T3' }),
    { type: 'user', message: { content: [
      { type: 'tool_result', tool_use_id: 't1', content: 'ok' },
      { type: 'tool_result', tool_use_id: 't2', is_error: true, content: [{ type: 'text', text: 'hata' }, imgBlock('SONUC'), { type: 'tool_reference' }, { type: 'text', text: `[Image: source: ${shot}]` }] },
      { type: 'tool_result', tool_use_id: 't3' },
      { type: 'tool_result', tool_use_id: 'yok', content: 'sahipsiz' },
      { type: 'tool_result', tool_use_id: 't7', is_error: false, content: 'z'.repeat(2000) },
      { type: 'text', text: 'yan metin' },
    ] } },
    asst([{ type: 'text', text: 'alt ajan' }], { isSidechain: true }),
    user('alt ajan sorusu', { isSidechain: true }),
    user([{ type: 'text', text: 'ikinci ' + 'u'.repeat(9000) }, imgBlock('KULLANICI')], { timestamp: 'T4' }),
    asst([{ type: 'text', text: 'son' }], { timestamp: 'T5' }),
  ]);
  const d = await loadSession(f);
  assert.strictEqual(d.turns, 2);
  assert.strictEqual(d.skipped, 0);
  assert.deepStrictEqual(d.msgs[0], { r: 'u', t: 'ilk soru', ts: 'T1' });
  assert.deepStrictEqual(d.msgs[1], { r: 'a', ts: 'T2', b: [
    { t: 'text', v: 'Merhaba' },
    { t: 'tool', n: 'Write', a: path.join('~', 'proje', 'a.txt'), o: 'ok', d: { e: [{ o: '', n: 'x' }] } },
    { t: 'tool', n: 'Read', a: '/oku.txt', o: 'hata\n[görsel]\n\n[Image: source: ' + shot + ']', err: true, imgs: [cachedPath('SONUC'), shot] },
    { t: 'tool', n: 'Bash', a: '', o: '' },
    { t: 'tool', n: 'NotebookEdit', a: '', o: '' },
    { t: 'text', v: 'devam' },
    { t: 'tool', n: 'Edit', a: path.join('~', 'proje', 'a.txt'), o: '' },
    { t: 'tool', n: 'MultiEdit', a: '/m.txt', o: '' },
    { t: 'tool', n: 'Glob', a: '**/*.js', o: 'z'.repeat(1500) },
  ] });
  assert.deepStrictEqual(d.msgs[2], { r: 'u', t: ('ikinci ' + 'u'.repeat(9000)).slice(0, 8000), ts: 'T4', imgs: [cachedPath('KULLANICI')] });
  assert.deepStrictEqual(d.msgs[3], { r: 'a', ts: 'T5', b: [{ t: 'text', v: 'son' }] });
  assert.strictEqual(d.msgs.length, 4);
  assert.deepStrictEqual(d.outputs, [
    { path: '/m.txt', tool: 'MultiEdit', ts: 'T3' },
    { path: '/n.ipynb', tool: 'NotebookEdit', ts: 'T2' },
    { path: path.join('~', 'proje', 'a.txt'), tool: 'Edit', ts: 'T3' },
  ]);
});

test('mesajlar: araç özeti alan önceliği, boşluk sadeleştirme, ~ ve 300 karakter sınırı', async () => {
  const fields = ['command', 'file_path', 'path', 'pattern', 'url', 'query', 'description', 'prompt', 'skill'];
  const tools = fields.map((k, i) => ({ type: 'tool_use', id: 'k' + i, name: 'T', input: { [k]: 'değer-' + k } }));
  tools.push({ type: 'tool_use', id: 'a', name: 'T', input: { command: 'ls  -la\n' + path.join(EV, 'x'), file_path: '/ikinci' } });
  tools.push({ type: 'tool_use', id: 'b', name: 'T', input: { query: 'q'.repeat(400) } });
  tools.push({ type: 'tool_use', id: 'c', name: 'T', input: { foo: 1 } });
  tools.push({ type: 'tool_use', id: 'd', name: 'T', input: { pattern: 5 } });
  tools.push({ type: 'tool_use', id: 'e', name: 'T', input: { file_path: path.join(EV, 'y') } });
  const d = await loadSession(jsonl([user('s'), asst(tools)]));
  assert.deepStrictEqual(d.msgs[1].b.map(b => b.a), [...fields.map(k => 'değer-' + k), 'ls -la ' + path.join(EV, 'x'), 'q'.repeat(300), '', '5', path.join('~', 'y')]);
});

test('mesajlar: tur sınırı — tam sınırda kesilmez, aşınca son N tur kalır', async () => {
  const lines = [asst([{ type: 'text', text: 'önsöz' }])];
  for (let i = 1; i <= 3; i++) { lines.push(user('soru ' + i)); lines.push(asst([{ type: 'text', text: 'cevap ' + i }])); }
  const f = jsonl(lines);
  const all = await loadSession(f, 3);
  assert.strictEqual(all.skipped, 0);
  assert.strictEqual(all.turns, 3);
  assert.deepStrictEqual(all.msgs[0].b, [{ t: 'text', v: 'önsöz' }]);
  assert.strictEqual(all.msgs.length, 7);
  const two = await loadSession(f, 2);
  assert.strictEqual(two.skipped, 1);
  assert.strictEqual(two.turns, 3);
  assert.deepStrictEqual(two.msgs.map(m => m.t || m.b[0].v), ['soru 2', 'cevap 2', 'soru 3', 'cevap 3']);
  const one = await loadSession(f, 1);
  assert.deepStrictEqual(one.msgs.map(m => m.t || m.b[0].v), ['soru 3', 'cevap 3']);
  assert.strictEqual(one.skipped, 2);
});

// ---------------- SessionIndex ----------------
const projDir = name => { const d = path.join(S.PROJECTS_DIR, name); fs.mkdirSync(d, { recursive: true }); return d; };
const idOf = n => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');

test('dizin: önbellek dosyası yüklenir; eski biçim, bozuk dosya ve eksik liste yok sayılır', () => {
  const d = newDir(), c = path.join(d, 'index.json');
  assert.strictEqual(new SessionIndex(c).list().length, 0);
  fs.writeFileSync(c, '{bozuk');
  assert.strictEqual(new SessionIndex(c).list().length, 0);
  fs.writeFileSync(c, JSON.stringify({ v: 1, sessions: [{ id: 'a' }] }));
  assert.strictEqual(new SessionIndex(c).list().length, 0);
  fs.writeFileSync(c, JSON.stringify({ v: 2 }));
  assert.strictEqual(new SessionIndex(c).list().length, 0);
  fs.writeFileSync(c, JSON.stringify({ v: 2, sessions: [{ id: 'x' }, { id: 'y', lastTs: '2026-01-01' }, { id: 'z', lastTs: '2026-05-01' }, { id: 'w' }] }));
  const idx = new SessionIndex(c);
  assert.deepStrictEqual(idx.list().map(s => s.id), ['z', 'y', 'x', 'w']);
  assert.deepStrictEqual(idx.get('y'), { id: 'y', lastTs: '2026-01-01' });
  assert.strictEqual(idx.get('yok'), undefined);
});

test('dizin: yalnızca proje klasörlerindeki .jsonl dosyaları listelenir', async t => {
  const a = projDir('liste-a'), b = projDir('liste-b'), kilit = projDir('liste-kilitli');
  fs.writeFileSync(path.join(a, '1.jsonl'), ''); fs.writeFileSync(path.join(a, 'not.txt'), '');
  fs.mkdirSync(path.join(a, 'klasor.jsonl'));
  fs.writeFileSync(path.join(b, '2.jsonl'), '');
  fs.writeFileSync(path.join(kilit, '3.jsonl'), '');
  fs.writeFileSync(path.join(S.PROJECTS_DIR, 'kok.jsonl'), '');
  // okunamayan klasör: Windows'ta chmod okumayı engellemez; orada kilitli klasör hiç kurulmaz (yalnız POSIX denetimi)
  if (WIN) fs.rmSync(kilit, { recursive: true });
  else { fs.chmodSync(kilit, 0o000); t.after(() => { try { fs.chmodSync(kilit, 0o755); } catch {} }); }
  const files = await new SessionIndex(path.join(newDir(), 'i.json')).listFiles();
  const mine = files.filter(f => f.includes(path.sep + 'liste-')).sort();
  assert.deepStrictEqual(mine, [path.join(a, '1.jsonl'), path.join(b, '2.jsonl')]);
  assert.ok(!files.includes(path.join(S.PROJECTS_DIR, 'kok.jsonl')));
  if (!WIN) fs.chmodSync(kilit, 0o755);
  fs.rmSync(path.join(S.PROJECTS_DIR, 'kok.jsonl'));
  for (const d of [a, b, kilit]) fs.rmSync(d, { recursive: true, force: true });
});

test('dizin: yenileme — yeni, değişmeyen, değişen, silinen dosyalar ve önbellek kaydı', async () => {
  const p = projDir('yenile'), cache = path.join(newDir(), 'alt', 'index.json');
  const f1 = jsonl([user('bir'), { type: 'x', timestamp: '2026-01-01T00:00:00Z' }], { dir: p, id: idOf(1) });
  const f2 = jsonl([user('iki'), { type: 'x', timestamp: '2026-02-01T00:00:00Z' }], { dir: p, id: idOf(2) });
  const idx = new SessionIndex(cache);
  assert.deepStrictEqual((await idx.refresh()).sort(), [idOf(1), idOf(2)]);
  assert.deepStrictEqual(idx.list().map(s => s.title), ['iki', 'bir']);
  assert.deepStrictEqual(await idx.refresh(), []);
  // önbellek dosyası yazıldı ve yeniden yüklenebiliyor
  const saved = JSON.parse(fs.readFileSync(cache, 'utf8'));
  assert.strictEqual(saved.v, 2);
  assert.deepStrictEqual(new SessionIndex(cache).list().map(s => s.id), [idOf(2), idOf(1)]);
  // değişen dosya
  fs.writeFileSync(f1, line(user('bir yeni')) + '\n');
  assert.deepStrictEqual(await idx.refresh([f1]), [idOf(1)]);
  assert.strictEqual(idx.get(idOf(1)).title, 'bir yeni');
  // yalnızca belirli dosyalar yenilenirken listede olmayanlar silinmez
  fs.rmSync(f2);
  assert.deepStrictEqual(await idx.refresh([f1]), []);
  assert.ok(idx.get(idOf(2)));
  // silinmiş dosya doğrudan verilince çıkarılır; dizinde olmayan silinmiş dosya "değişti" sayılmaz (hata düzeltmesi)
  assert.deepStrictEqual(await idx.refresh([f2]), [idOf(2)]);
  assert.strictEqual(idx.get(idOf(2)), undefined);
  assert.deepStrictEqual(await idx.refresh([f2]), []);
  // tam yenilemede diskte olmayan kayıt silinir
  fs.rmSync(f1);
  idx.map.set('hayalet', { id: 'hayalet' });
  assert.deepStrictEqual((await idx.refresh()).sort(), [idOf(1), 'hayalet'].sort());
  assert.strictEqual(idx.list().length, 0);
  fs.rmSync(p, { recursive: true });
});

test('dizin: mtime ve boyut aynıysa özet yeniden okunmaz, biri değişince okunur; canlı işareti yine güncellenir', async t => {
  const p = projDir('onbellek');
  const f = jsonl([user('aaaa')], { dir: p, id: idOf(10) });
  const T = 1_750_000_000;
  fs.utimesSync(f, T, T);
  t.mock.timers.enable({ apis: ['Date'], now: T * 1000 + 1000 });
  const idx = new SessionIndex(path.join(newDir(), 'i.json'));
  await idx.refresh([f]);
  assert.strictEqual(idx.get(idOf(10)).live, true);
  // aynı boy, aynı mtime → eski özet kalır
  fs.writeFileSync(f, line(user('bbbb')) + '\n'); fs.utimesSync(f, T, T);
  t.mock.timers.setTime(T * 1000 + LIVE);
  assert.deepStrictEqual(await idx.refresh([f]), []);
  assert.strictEqual(idx.get(idOf(10)).title, 'aaaa');
  assert.strictEqual(idx.get(idOf(10)).live, false);
  t.mock.timers.setTime(T * 1000 + LIVE - 1);
  await idx.refresh([f]);
  assert.strictEqual(idx.get(idOf(10)).live, true);
  // yalnızca mtime değişti
  fs.utimesSync(f, T + 5, T + 5);
  assert.deepStrictEqual(await idx.refresh([f]), [idOf(10)]);
  assert.strictEqual(idx.get(idOf(10)).title, 'bbbb');
  // yalnızca boyut değişti
  fs.writeFileSync(f, line(user('ccccc')) + '\n'); fs.utimesSync(f, T + 5, T + 5);
  assert.deepStrictEqual(await idx.refresh([f]), [idOf(10)]);
  assert.strictEqual(idx.get(idOf(10)).title, 'ccccc');
  fs.rmSync(p, { recursive: true });
});

test('dizin: eşzamanlı yenilemeler sıraya girer; başarısız yenileme kuyruğu kilitlemez', async () => {
  const p = projDir('esz');
  for (let i = 20; i < 25; i++) jsonl([user('s' + i)], { dir: p, id: idOf(i) });
  const idx = new SessionIndex(path.join(newDir(), 'i.json'));
  const [a, b] = await Promise.all([idx.refresh(), idx.refresh()]);
  assert.strictEqual(a.length, 5);
  assert.deepStrictEqual(b, []);
  await assert.rejects(idx.refresh(42));
  assert.deepStrictEqual(await idx.refresh(), []);
  fs.rmSync(p, { recursive: true });
});

test('dizin: okunamayan oturum ve yazılamayan önbellek uyarı verir, çökmez', async t => {
  const warn = t.mock.method(console, 'warn', () => {});
  const p = projDir('hata');
  const f = jsonl([user('gizli')], { dir: p, id: idOf(30) });
  // Windows'ta chmod okumayı engellemez: orada bu dosyanın açılışı EACCES ile reddedilir (izinsiz dosyanın davranışı)
  if (WIN) { const open = fsp.open; t.mock.method(fsp, 'open', (p, ...a) => p === f ? Promise.reject(Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })) : open.call(fsp, p, ...a)); }
  else { fs.chmodSync(f, 0o000); t.after(() => { try { fs.chmodSync(f, 0o644); } catch {} }); }
  const blocker = path.join(newDir(), 'dosya'); fs.writeFileSync(blocker, '');
  const idx = new SessionIndex(path.join(blocker, 'index.json'));
  assert.deepStrictEqual(await idx.refresh([f]), []);
  assert.strictEqual(idx.get(idOf(30)), undefined);
  const msgs = warn.mock.calls.map(c => c.arguments[0]);
  assert.deepStrictEqual(msgs, ['özet okunamadı', 'index yazılamadı']);
  assert.strictEqual(warn.mock.calls[0].arguments[1], f);
  if (!WIN) fs.chmodSync(f, 0o644);
  fs.rmSync(p, { recursive: true });
});

// ---------------- artımlı yükleyici (SessionLoader) ----------------
const tUse = (id, cmd) => asst([{ type: 'tool_use', id, name: 'Bash', input: { command: cmd } }]);
const tRes = (id, out, extra = {}) => user([{ type: 'tool_result', tool_use_id: id, content: out, ...extra }]);
const LINES = [
  user('ilk soru ğüşıöç'), asst([{ type: 'text', text: 'yanıt 🙂 çok baytlı' }]), tUse('t1', 'ls'), tRes('t1', 'a.txt'),
  user('ikinci'), tUse('t2', 'cat x'), asst([{ type: 'text', text: 'ara metin' }]), tRes('t2', 'hata', { is_error: true }),
  asst([{ type: 'tool_use', id: 't3', name: 'Write', input: { file_path: '/p/yaz.txt', content: 'x' } }]),
  { type: 'x', isSidechain: true }, 'bozuk {', 'null', user('üçüncü 🎬'), asst([{ type: 'text', text: 'son' }]),
];

test('artımlı yükleyici: rastgele bayt sınırlarında büyüyen dosyada sonuç her adımda tam okumayla aynıdır', async () => {
  const full = Buffer.from(LINES.map(line).join('\n') + '\n');
  for (const chunk of [3, 7, 1 << 20]) for (const seed of [1, 2, 3]) {
    const f = jsonl([]); fs.writeFileSync(f, '');
    const L = new SessionLoader(8, chunk);
    let pos = 0, r = seed;
    while (pos < full.length) {
      r = (r * 1103515245 + 12345) >>> 0;
      const n = 1 + (r % 61);
      fs.appendFileSync(f, full.subarray(pos, pos + n)); pos += n;
      const got = await L.load(f, 2);
      // yalnızca tamamlanmış satırlar sayılır: dosyayı son satır sonuna kadar kesen tam okumayla karşılaştır
      const done = full.subarray(0, pos);
      const cut = done.lastIndexOf(10);
      const g = jsonl([]); fs.writeFileSync(g, done.subarray(0, cut + 1));
      const want = await loadSession(g, 2);
      // satır sonu olmayan tam JSON son satırı da işlenir (tam okuma da onu okur)
      const rest = done.subarray(cut + 1).toString('utf8');
      let restOk = false; try { JSON.parse(rest); restOk = rest.length > 0; } catch {}
      if (!restOk) assert.deepStrictEqual(got, want, `parça ${chunk}, konum ${pos}`);
    }
    assert.deepStrictEqual(await L.load(f, 2), await loadSession(f, 2));
    assert.deepStrictEqual(await L.load(f, 60), await loadSession(f, 60));
  }
});

test('artımlı yükleyici: sonradan gelen araç sonucu önceki aracı günceller; değişmeyen dosya yeniden okunmaz', async t => {
  const f = jsonl([user('soru'), tUse('a', 'uzun komut')]);
  const L = new SessionLoader();
  assert.strictEqual((await L.load(f)).msgs[1].b[0].o, '');
  fs.appendFileSync(f, line(tRes('a', 'bitti')) + '\n');
  const r = await L.load(f);
  assert.strictEqual(r.msgs[1].b[0].o, 'bitti');
  assert.ok(!('id' in r.msgs[1].b[0]));
  const open = t.mock.method(fsp, 'open');
  await L.load(f);
  assert.strictEqual(open.mock.callCount(), 0, 'boyut değişmedi: dosya açılmadı');
});

test('artımlı yükleyici: döndürülen sonuç değiştirilse de önbellekteki durum bozulmaz', async () => {
  const f = jsonl([user('a'), tUse('x', 'ls'), tRes('x', 'çıktı')]);
  const L = new SessionLoader();
  const r1 = await L.load(f);
  r1.msgs[1].b[0].o = 'BOZULDU'; r1.msgs.length = 0;
  const r2 = await L.load(f);
  assert.strictEqual(r2.msgs.length, 2); assert.strictEqual(r2.msgs[1].b[0].o, 'çıktı');
});

test('artımlı yükleyici: yarım son satır tamamlanınca okunur; kısalan ya da değiştirilen dosya baştan okunur', async () => {
  const f = jsonl([user('bir')]);
  const L = new SessionLoader();
  const half = line(user('iki'));
  fs.appendFileSync(f, half.slice(0, 10));
  assert.deepStrictEqual((await L.load(f)).msgs.map(m => m.t), ['bir']);
  fs.appendFileSync(f, half.slice(10));                   // satır sonu yok ama tam JSON
  assert.deepStrictEqual((await L.load(f)).msgs.map(m => m.t), ['bir', 'iki']);
  fs.appendFileSync(f, '\n' + line(user('üç')) + '\n');
  assert.deepStrictEqual((await L.load(f)).msgs.map(m => m.t), ['bir', 'iki', 'üç']);
  fs.writeFileSync(f, line(user('yeni')) + '\n');        // kısaldı
  assert.deepStrictEqual((await L.load(f)).msgs.map(m => m.t), ['yeni']);
  const g = f + '.yeni'; fs.writeFileSync(g, line(user('başka')) + '\n' + line(user('dosya')) + '\n' + line(user('uzun')) + '\n');
  fs.renameSync(g, f);                                     // aynı ad, farklı dosya (inode)
  assert.deepStrictEqual((await L.load(f)).msgs.map(m => m.t), ['başka', 'dosya', 'uzun']);
});

test('artımlı yükleyici: en çok `max` dosyanın durumu tutulur (en az kullanılan atılır)', async () => {
  const L = new SessionLoader(2);
  const [a, b, c] = ['a', 'b', 'c'].map(x => jsonl([user(x)]));
  await L.load(a); await L.load(b); await L.load(a); await L.load(c);
  assert.deepStrictEqual([...L.cache.keys()], [a, c]);
  assert.deepStrictEqual((await L.load(b)).msgs.map(m => m.t), ['b']);
});

test('artımlı yükleyici: olmayan dosya hata verir', async () => {
  await assert.rejects(new SessionLoader().load(path.join(newDir(), 'yok.jsonl')), /ENOENT/);
});

// --- Claude uygulamasının tur araçları kart olarak (0.2.8) ---
test('turnCard: wrap_up → sonraki adım kartı, update_plan → görev listesi; diğerleri null', () => {
  const { turnCard } = require('../src/main/sessions');
  assert.deepStrictEqual(turnCard('mcp__ccd_turn__wrap_up', { recap: 'Bitti.', ask: 'Yayınlayayım mı?', actions: [{ label: 'Evet' }, { label: '' }, null, { label: 'Hayır' }, { label: 'X' }, { label: 'Y' }] }),
    { card: { recap: 'Bitti.', ask: 'Yayınlayayım mı?', actions: ['Evet', 'Hayır', 'X'] } });
  assert.deepStrictEqual(turnCard('wrap_up', { recap: 5 }), { card: { recap: '', ask: '', actions: [] } });
  assert.strictEqual(turnCard('wrap_up', { recap: 'x'.repeat(2000) }).card.recap.length, 1200);
  assert.deepStrictEqual(turnCard('mcp__ccd_turn__update_plan', { items: [{ content: 'A', status: 'completed' }, { content: 'B', status: 'in_progress' }, { content: 'C', status: 'garip' }, null] }),
    { plan: [{ c: 'A', s: 'completed' }, { c: 'B', s: 'in_progress' }, { c: 'C', s: 'pending' }, { c: '', s: 'pending' }] });
  assert.deepStrictEqual(turnCard('update_plan', { advance: true }), { plan: null });
  assert.strictEqual(turnCard('update_plan', { items: Array(20).fill({ content: 'x' }) }).plan.length, 12);
  assert.strictEqual(turnCard('Bash', { command: 'ls' }), null);
  assert.strictEqual(turnCard('wrap_up', null), null);
  assert.strictEqual(turnCard(null, {}), null);
  assert.strictEqual(turnCard('not_wrap_up_x', {}), null);
});

// ================= Sohbet görünümü: düşünme, görev listesi, alt ajan, arka plan görevleri =================
const FX = require('./fixtures/sohbet-gorunumu');
test('loadSession: örnek kayıtta düşünme, görev listesi, alt ajan ve arka plan görevleri', async () => {
  const f = FX.write(newDir(), '/proje');
  const d = await S.loadSession(f);
  const a = d.msgs[1].b;
  assert.deepEqual(a.filter(b => b.t === 'think'), [{ t: 'think', v: 'Geçmiş kaydı için önce görev listesini yazmalıyım.' }], 'yalnız signature olan blok atlanır');
  const todo = a.filter(b => b.todo).map(b => b.todo.map(i => i.s).join(','));
  assert.deepEqual(todo, ['in_progress,pending,pending', 'completed,in_progress,pending']);
  assert.deepEqual(a.find(b => b.todo).todo[0], { c: 'Kayıtları oku', s: 'in_progress', af: 'Kayıtlar okunuyor' });
  const ag = a.find(b => b.sa);
  assert.equal(ag.id, undefined, 'araç kimliği atılır');
  assert.deepEqual(ag.sa, { id: 'toolu_fx_ag1', ty: 'Explore', d: 'Kayıtları tara', st: 'done', tools: 3, aid: 'afix1', bg: true, ms: 4100 });
  assert.deepEqual(d.bg.map(t => [t.id, t.k, t.st, t.code]), [['afix1', 'agent', 'done', null], ['bfix1', 'bash', 'done', 0]]);
  assert.equal(d.bg[1].cmd, 'npm run build'); assert.equal(d.bg[0].cmd, '');
  assert.deepEqual(d.todo.map(i => i.id), ['w0', 'w1', 'w2']);
  assert.equal(d.msgs.length, 2, 'bildirimler kullanıcı mesajı olarak görünmez');
});
test('finishParse: alt ajan bilgisi kopyalanır (artımlı okumada sonradan gelen bildirim eski sonucu değiştirmez)', async () => {
  const dir = newDir(), f = path.join(dir, FX.UUID + '.jsonl'), L = FX.lines('/p').map(o => JSON.stringify(o));
  fs.writeFileSync(f, L.slice(0, 12).join('\n') + '\n');
  const ld = new SessionLoader();
  const d1 = await ld.load(f);
  assert.equal(d1.msgs[1].b.find(b => b.sa).sa.st, 'run');
  fs.appendFileSync(f, L.slice(12).join('\n') + '\n');
  const d2 = await ld.load(f);
  assert.equal(d2.msgs[1].b.find(b => b.sa).sa.st, 'done');
  assert.equal(d1.msgs[1].b.find(b => b.sa).sa.st, 'run');
  assert.equal(d1.bg[0].st, 'run');
});
test('bildirim: kullanıcı mesajı olarak gelen CLI bildirimi (önekli/öneksiz) işlenir; metnin ortasındaki etiket kullanıcı mesajı kalır', async () => {
  const notif = (id, tu = 'tb') => `<task-notification>\n<task-id>${id}</task-id>\n<tool-use-id>${tu}</tool-use-id>\n<status>failed</status>\n<summary>Background command "x" failed with exit code 2</summary>\n</task-notification>`;
  const f = jsonl([
    { type: 'user', message: { content: 'başla' } },
    { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'tb', name: 'Bash', input: { command: 'make', run_in_background: true } }] } },
    { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'tb', content: 'Command running in background with ID: bq1. Output…' }] } },
    { type: 'user', message: { content: '[SYSTEM NOTIFICATION - NOT USER INPUT]\nBu otomatik.\n\n' + notif('bq1') } },
    { type: 'user', message: { content: notif('bq2', 'tz') } },
    { type: 'user', message: { content: 'şunu yapıştırdım: <task-notification>' } },
    { type: 'attachment', attachment: { type: 'queued_command', prompt: 'düz komut' } },
    { type: 'attachment', attachment: { type: 'queued_command', prompt: 5 } },
    { type: 'attachment', attachment: { type: 'other' } },
    { type: 'attachment' },
  ]);
  const d = await S.loadSession(f);
  assert.deepEqual(d.msgs.filter(m => m.r === 'u').map(m => m.t), ['başla', 'şunu yapıştırdım: <task-notification>']);
  assert.deepEqual(d.bg.map(t => [t.id, t.st, t.code]), [['bq1', 'err', 2], ['bq2', 'err', 2]]);
});
test('bildirim: araca bağlı bildirim alt ajan bloğunu bitirir; boş düşünme blokları atlanır', async () => {
  const f = jsonl([
    { type: 'user', message: { content: 'başla' } },
    { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'ta', name: 'Task', input: { description: 'd' } }, { type: 'thinking', thinking: '   ' }, { type: 'thinking' }] } },
    { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'ta', content: 'patladı', is_error: true }] } },
    { type: 'attachment', attachment: { type: 'queued_command', prompt: '<task-notification><task-id>zz</task-id><tool-use-id>ta</tool-use-id><status>completed</status><summary>Agent "d" completed</summary></task-notification>' } },
    { type: 'attachment', attachment: { type: 'queued_command', prompt: '<task-notification><task-id>yy</task-id><tool-use-id>yok</tool-use-id><status>completed</status><summary>s</summary></task-notification>' } },
  ]);
  const d = await S.loadSession(f);
  const b = d.msgs[1].b;
  assert.equal(b.length, 1);
  assert.equal(b[0].sa.ty, 'general-purpose');
  assert.equal(b[0].sa.st, 'done');
  assert.equal(b[0].err, true);
});
test('loadSubagent: agentId ile, meta.json (toolUseId) ile bulur; kimlik doğrulanır; dosya yoksa null', async () => {
  const f = FX.write(newDir(), '/p');
  const r = await S.loadSubagent(f, 'toolu_fx_ag1', 'afix1');
  assert.equal(r.cut, 0);
  assert.deepEqual(r.b.map(b => b.t === 'text' ? b.v : b.n), ['Kayıtlara **bakıyorum**.', 'Grep', 'Üç kayıt buldum.']);
  assert.equal(r.b[1].o, 'src/a.js:1: kayıt');
  assert.deepEqual(await S.loadSubagent(f, 'toolu_fx_ag1', null), r, 'meta.json üzerinden');
  assert.deepEqual(await S.loadSubagent(f, 'toolu_fx_ag1', 'yok1'), r, 'agentId dosyası yoksa meta.json');
  assert.deepEqual(await S.loadSubagent(f, 'toolu_fx_ag1', '../x'), r, 'geçersiz agentId yok sayılır');
  assert.equal(await S.loadSubagent(f, '../../x', '../afix1'), null);
  assert.equal(await S.loadSubagent(f, 'baska', null), null);
  assert.equal(await S.loadSubagent(f, null, null), null);
  const cut = await S.loadSubagent(f, null, 'afix1', 2);
  assert.deepEqual([cut.cut, cut.b.length, cut.b[1].v], [1, 2, 'Üç kayıt buldum.']);
  // Bozuk/başka meta dosyaları atlanır; meta var ama .jsonl yoksa null
  const sub = path.join(f.replace(/\.jsonl$/, ''), 'subagents');
  fs.writeFileSync(path.join(sub, 'agent-bozuk.meta.json'), '{');
  fs.writeFileSync(path.join(sub, 'agent-bos.meta.json'), 'null');
  fs.writeFileSync(path.join(sub, 'agent-kayip.meta.json'), JSON.stringify({ toolUseId: 'tk' }));
  fs.writeFileSync(path.join(sub, 'notlar.txt'), 'x');
  assert.equal(await S.loadSubagent(f, 'tk', null), null);
  assert.equal((await S.loadSubagent(f, 'toolu_fx_ag1', null)).b.length, 3);
  // Alt ajan klasörü olmayan oturum
  assert.equal(await S.loadSubagent(jsonl([{ type: 'user', message: { content: 'x' } }]), 'toolu_x', null), null);
});
