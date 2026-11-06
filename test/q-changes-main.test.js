// Oturumun toplu farkı ve dosya bazında geri alma (src/main/changes.js). Dosya yazan testler kendi geçici klasöründe.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ch = require('../src/main/changes');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-changes-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));
let nth = 0;
const dir = () => { const d = path.join(TMP, 'd' + (++nth)); fs.mkdirSync(d, { recursive: true }); return d; };

// Kayıt satırı üreticileri (Claude Code jsonl biçimi)
let tsN = 0;
const ts = () => new Date(Date.UTC(2026, 10, 6, 10, 0, tsN++)).toISOString();
const use = (id, name, input) => JSON.stringify({ type: 'assistant', timestamp: ts(), message: { content: [{ type: 'tool_use', id, name, input }] } });
const res = (id, r, extra = {}) => JSON.stringify({ type: 'user', timestamp: extra.ts || ts(), message: { content: [{ type: 'tool_result', tool_use_id: id, content: extra.content ?? 'ok', ...(extra.err ? { is_error: true } : {}) }] }, ...(r ? { toolUseResult: r } : {}) });
const log = (...lines) => lines.join('\n') + '\n';
const patchOf = (a, b) => { // tek parçalı, bağlamsız değil: tüm dosya bağlam
  const A = a.split('\n'), B = b.split('\n');
  if (A[A.length - 1] === '') A.pop(); if (B[B.length - 1] === '') B.pop();
  return [{ oldStart: 1, oldLines: A.length, newStart: 1, newLines: B.length, lines: [...A.map(x => '-' + x), ...B.map(x => '+' + x)] }];
};
// Bir Edit olayı (gerçek kayıttaki gibi toolUseResult ile)
const edit = (id, file, before, o, n, opts = {}) => {
  const after = before.replace(o, n);
  return [use(id, 'Edit', { file_path: file, old_string: o, new_string: n }),
    res(id, { filePath: file, oldString: o, newString: n, ...(opts.noOrig ? {} : { originalFile: before }), structuredPatch: opts.noPatch ? [] : patchOf(before, after), replaceAll: false })];
};
const write = (id, file, content, before) => [use(id, 'Write', { file_path: file, content }),
  res(id, before === undefined ? { type: 'create', filePath: file, content, structuredPatch: [] } : { type: 'update', filePath: file, content, originalFile: before, structuredPatch: patchOf(before, content) })];

test('parseLog: araç çağrısı ve sonucu eşleşir; hata, tekrar, bozuk satır ve kısmi Read atlanır', () => {
  const t = log(
    'bozuk {"tool_use',
    JSON.stringify({ message: { content: [null, 5, { type: 'tool_use', id: 'x0', name: 'Bash', input: {} }] } }),
    use('r1', 'Read', { file_path: '/p/a' }), res('r1', { type: 'text', file: { filePath: '/p/a', content: 'A\n', startLine: 1, numLines: 1, totalLines: 1 } }),
    use('r2', 'Read', { file_path: '/p/a' }), res('r2', { type: 'text', file: { filePath: '/p/a', content: 'A', startLine: 5, numLines: 1, totalLines: 9 } }),
    use('r3', 'Read', { file_path: '/p/a' }), res('r3', null),
    use('r4', 'Read', { file_path: '/p/a' }), res('r4', { type: 'text', file: { filePath: '/p/a', content: 'A', numLines: 1, totalLines: 1 } }),
    use('e1', 'Edit', { file_path: '/p/a', old_string: 'A', new_string: 'B' }), res('e1', null, { err: true }),
    use('e2', 'Edit', { file_path: '/p/a', old_string: 'A', new_string: 'B' }), res('e2', { filePath: '/p/b' }, { content: [{ type: 'text', text: 'tamam' }, { type: 'image' }] }), res('e2', {}),
    use('n1', 'NotebookEdit', { notebook_path: '/p/n.ipynb', new_source: 'x' }), res('n1', null, { content: 5 }),
    use('w0', 'Write', { content: 'x' }), res('w0', null),
    use('u1', 'Write', 'girdi değil'), res('u1', null),
    res('yok', null),
  );
  const ev = ch.parseLog(t, true, 3);
  assert.deepEqual(ev.map(e => [e.tool, e.path]), [['Read', '/p/a'], ['Read', '/p/a'], ['Edit', '/p/b'], ['NotebookEdit', '/p/n.ipynb']]);
  assert.equal(ev[0].content, 'A\n'); assert.equal(ev[2].said, 'tamam'); assert.equal(ev[3].said, '');
  assert.ok(ev.every(e => e.side === true && e.src === 3));
  assert.equal(ch.parseLog(null).length, 0);
});

test('replaceEdit / reverseEdit', () => {
  assert.equal(ch.replaceEdit('a b c', 'b', 'X'), 'a X c');
  assert.equal(ch.replaceEdit('b b', 'b', 'X'), undefined, 'belirsiz');
  assert.equal(ch.replaceEdit('b b', 'b', 'X', true), 'X X');
  assert.equal(ch.replaceEdit('abc', 'z', 'X'), undefined);
  assert.equal(ch.replaceEdit('abc', '', 'X'), undefined);
  assert.equal(ch.replaceEdit(undefined, 'a', 'b'), undefined);
  assert.equal(ch.replaceEdit('a', 'a', 5), undefined);
  assert.equal(ch.reverseEdit('a X c', 'b', 'X'), 'a b c');
  assert.equal(ch.reverseEdit('X X', 'b', 'X'), undefined);
  assert.equal(ch.reverseEdit('abc', 'b', 'Z'), undefined);
  assert.equal(ch.reverseEdit('abc', 'b', ''), undefined, 'silme geri alınamaz (yer belirsiz)');
  assert.equal(ch.reverseEdit('X', 'b', 'X', true), undefined);
  assert.equal(ch.reverseEdit('X', 5, 'X'), undefined);
});

test('applyPatch: ileri/geri, bağlam denetimi, "No newline" işaretleri', () => {
  const a = 'bir\niki\nüç\n', b = 'bir\nİKİ\nüç\ndört\n';
  const h = [{ oldStart: 2, oldLines: 2, newStart: 2, newLines: 3, lines: ['-iki', '+İKİ', ' üç', '+dört'] }];
  assert.equal(ch.applyPatch(a, h), b);
  assert.equal(ch.applyPatch(b, h, true), a);
  assert.equal(ch.applyPatch('bir\nXX\nüç\n', h), undefined, 'silinen satır uymuyor');
  assert.equal(ch.applyPatch('bir\n', h), undefined, 'metin kısa');
  assert.equal(ch.applyPatch('bir', [{ oldStart: 5, lines: [' x'] }]), undefined, 'başlangıç metin dışında');
  assert.equal(ch.applyPatch(a, []), undefined);
  assert.equal(ch.applyPatch(5, h), undefined);
  assert.equal(ch.applyPatch(a, [null]), undefined);
  assert.equal(ch.applyPatch(a, [{ oldStart: 'x', lines: [] }]), undefined);
  assert.equal(ch.applyPatch(a, [{ oldStart: 1, lines: [' bir', 7] }]), undefined);
  assert.equal(ch.applyPatch(a, [{ oldStart: 1, lines: [' bir', '?x'] }]), undefined);
  assert.equal(ch.applyPatch(a, [{ oldStart: 2, lines: [' iki'] }, { oldStart: 1, lines: [' bir'] }]), undefined, 'geriye giden parça');
  // bağlamsız ekleme: yalnız boş metinde
  assert.equal(ch.applyPatch('', [{ oldStart: 0, lines: ['+x', '+y'] }]), 'x\ny\n');
  assert.equal(ch.applyPatch('', [{ oldStart: 0, lines: ['+x', '\\ No newline at end of file'] }]), 'x');
  assert.equal(ch.applyPatch('z', [{ oldStart: 0, lines: ['+x'] }]), undefined);
  // CRLF'li yama satırı
  assert.equal(ch.applyPatch('a\nb', [{ oldStart: 2, lines: ['-b\r', '+c\r'] }]), 'a\nc');
  // sonda satır sonu eklenir / kaldırılır
  const add = [{ oldStart: 1, newStart: 1, lines: ['-a', '\\ No newline at end of file', '+a'] }];
  assert.equal(ch.applyPatch('a', add), 'a\n');
  assert.equal(ch.applyPatch('a\n', add, true), 'a');
  const both = [{ oldStart: 1, lines: [' a', '\\ No newline at end of file'] }];
  assert.equal(ch.applyPatch('a', both), 'a');
});

test('opsOf: Write/Edit/MultiEdit/NotebookEdit dönüşümleri ve sayılar', () => {
  // Write: oluşturma (kayıtta ya da alt ajan metninde)
  let o = ch.opsOf({ tool: 'Write', input: { content: 'a\r\nb' }, r: { type: 'create', content: 'a\nb' } });
  assert.equal(o.before, null); assert.equal(o.after, 'a\nb'); assert.deepEqual(o.count, { added: 2, removed: 0 });
  o = ch.opsOf({ tool: 'Write', input: { content: 'x' }, r: null, said: 'File created successfully at: /p' });
  assert.equal(o.before, null); assert.equal(o.raw, true);
  o = ch.opsOf({ tool: 'Write', input: { content: 'x' }, r: null });
  assert.equal(o.before, undefined); assert.deepEqual(o.count, { added: 1, removed: 0 });
  o = ch.opsOf({ tool: 'Write', input: {}, r: { type: 'update', originalFile: '\uFEFFa\n', structuredPatch: patchOf('a\n', 'b\n') } });
  assert.equal(o.before, 'a\n', 'BOM ve CRLF atılır'); assert.equal(o.after, undefined); assert.equal(o.bwd('b\n'), 'a\n'); assert.deepEqual(o.count, { added: 1, removed: 1 });
  // Edit: yama önce, olmazsa dize
  const e = { tool: 'Edit', input: { old_string: 'iki', new_string: 'İKİ' }, r: { oldString: 'iki', newString: 'İKİ', structuredPatch: patchOf('bir\niki\n', 'bir\nİKİ\n') } };
  o = ch.opsOf(e);
  assert.equal(o.fwd('bir\niki\n'), 'bir\nİKİ\n'); assert.equal(o.bwd('bir\nİKİ\n'), 'bir\niki\n');
  assert.equal(o.fwd('x iki y'), 'x İKİ y', 'yama uymazsa dize'); assert.equal(o.bwd('x İKİ y'), 'x iki y');
  assert.deepEqual(o.count, { added: 2, removed: 2 }, 'sayılar yamadan');
  o = ch.opsOf({ tool: 'Edit', input: { old_string: 'a', new_string: 'b', replace_all: true }, r: null });
  assert.equal(o.fwd('a a'), 'b b'); assert.equal(o.bwd('b b'), undefined); assert.deepEqual(o.count, { added: 1, removed: 1 });
  o = ch.opsOf({ tool: 'Edit', input: {}, r: { oldString: 'a', newString: 'b', replaceAll: false, structuredPatch: [] } });
  assert.equal(o.fwd('a'), 'b');
  // MultiEdit
  const me = { tool: 'MultiEdit', input: { edits: [{ old_string: 'a', new_string: 'b' }, null, { old_string: 'c', new_string: 'd' }] }, r: null };
  o = ch.opsOf(me);
  assert.equal(o.fwd('a c'), 'b d'); assert.equal(o.bwd('b d'), 'a c'); assert.equal(o.fwd('x'), undefined); assert.deepEqual(o.count, { added: 2, removed: 2 });
  o = ch.opsOf({ tool: 'MultiEdit', input: {}, r: { structuredPatch: patchOf('a\n', 'b\n') } });
  assert.equal(o.fwd('a\n'), 'b\n'); assert.equal(o.bwd('b\n'), 'a\n'); assert.equal(o.fwd('q'), undefined, 'boş liste'); assert.deepEqual(o.count, { added: 1, removed: 1 });
  // NotebookEdit
  o = ch.opsOf({ tool: 'NotebookEdit', input: { new_source: 'x\ny' }, r: null });
  assert.equal(o.note, true); assert.deepEqual(o.count, { added: 2, removed: 0 });
  o = ch.opsOf({ tool: 'NotebookEdit', input: {}, r: null });
  assert.deepEqual(o.count, { added: 0, removed: 0 });
});

test('collect: dosya başına ilk hal, son hal, sayılar; büyük/küçük harf duyarsız gruplama', () => {
  const F = 'C:\\p\\a.txt', a0 = 'bir\niki\nüç\n', a1 = a0.replace('iki', 'İKİ');
  const t = log(...edit('e1', F, a0, 'iki', 'İKİ'), ...edit('e2', 'c:\\P\\a.txt', a1, 'üç', 'ÜÇ'), ...write('w1', 'C:\\p\\yeni.md', '# yeni\n'));
  const list = ch.collect([{ text: t }], 'win32');
  assert.equal(list.length, 2);
  const [f, w] = list;
  assert.equal(f.initial, a0); assert.equal(f.last, 'bir\nİKİ\nÜÇ\n'); assert.equal(f.edits, 2);
  assert.deepEqual([f.added, f.removed, f.approx, f.canRevert, f.created, f.between, f.weak], [2, 2, false, true, false, false, false]);
  assert.equal(f.steps.length, 2); assert.equal(f.steps[0].d.e[0].o, 'iki');
  assert.equal(w.created, true); assert.equal(w.initial, null); assert.equal(w.last, '# yeni\n');
  // Linux'ta büyük/küçük harf ayrı dosyalar
  assert.equal(ch.collect([{ text: t }], 'linux').length, 3);
  // Yalnız Read olan dosya listelenmez
  assert.equal(ch.collect([{ text: log(use('r', 'Read', {}), res('r', { type: 'text', file: { filePath: '/q', content: 'x', startLine: 1, numLines: 1, totalLines: 1 } })) }]).length, 0);
});

test('collect: originalFile yoksa geri yürüme, tam Read, nedenler ve "arada değişmiş"', () => {
  const F = '/p/b.txt', b0 = 'x\ny\nz\n', b1 = 'x\nY\nz\n', b2 = 'x\nY\nZ\n';
  // 1) ilk Edit'te originalFile yok, ikincide var → geri yürüyerek ilk hal kurulur
  let f = ch.collect([{ text: log(...edit('a', F, b0, 'y', 'Y', { noOrig: true }), ...edit('b', F, b1, 'z', 'Z')) }])[0];
  assert.equal(f.initial, b0); assert.equal(f.last, b2); assert.equal(f.weak, false);
  // 2) hiçbirinde yok, yama da yok, Read de yok → kurulamaz
  f = ch.collect([{ text: log(...edit('a', F, b0, 'y', 'Y', { noOrig: true, noPatch: true })) }])[0];
  assert.equal(f.canRevert, false); assert.match(f.reason, /büyük dosyalarda/); assert.equal(f.approx, true); assert.deepEqual([f.added, f.removed], [1, 1]);
  // 3) aynısı ama önce tam Read → ilk hal Read'den (zayıf)
  f = ch.collect([{ text: log(use('r', 'Read', { file_path: F }), res('r', { type: 'text', file: { filePath: F, content: b0, startLine: 1, numLines: 3, totalLines: 3 } }), ...edit('a', F, b0, 'y', 'Y', { noOrig: true, noPatch: true })) }])[0];
  assert.equal(f.initial, b0); assert.equal(f.weak, true); assert.equal(f.last, b1);
  // 4) alt ajan kaydı (toolUseResult yok)
  f = ch.collect([{ text: log(use('a', 'Edit', { file_path: F, old_string: 'y', new_string: 'Y' }), res('a', null)), side: true }])[0];
  assert.match(f.reason, /alt ajan/); assert.equal(f.side, true); assert.equal(f.anySide, true);
  // 5) NotebookEdit
  f = ch.collect([{ text: log(use('n', 'NotebookEdit', { notebook_path: '/p/n.ipynb', new_source: 'a' }), res('n', { foo: 1 })) }])[0];
  assert.match(f.reason, /NotebookEdit/);
  // 6) iki değişiklik arasında dosya dışarıda değişmiş
  f = ch.collect([{ text: log(...edit('a', F, b0, 'y', 'Y'), ...edit('b', F, 'başka\n', 'başka', 'BAŞKA')) }])[0];
  assert.equal(f.between, true); assert.equal(f.initial, b0);
  // 7) alt ajan + ana kayıt eşit zaman damgasıyla: kaynak sırası korunur
  tsN = 100; const l1 = log(...edit('a', F, b0, 'y', 'Y')); tsN = 100; const l2 = log(...write('w', '/p/c', 'c\n'));
  const two = ch.collect([{ text: l1 }, { text: l2, side: true }]);
  assert.deepEqual(two.map(x => x.path), [F, '/p/c']); assert.equal(two[1].side, true);
});

test('decode / encode: BOM, UTF-16, CRLF; UTF-8 olmayan reddedilir', () => {
  const rt = (buf) => { const d = ch.decode(buf); return ch.encode(d.text, d.fmt).equals(buf); };
  const crlf = Buffer.from('a\r\nb\r\n'); assert.deepEqual(ch.decode(crlf), { text: 'a\nb\n', fmt: { bom: '', eol: '\r\n' } }); assert.ok(rt(crlf));
  const bom8 = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('ş\n')]); assert.equal(ch.decode(bom8).fmt.bom, 'utf8'); assert.ok(rt(bom8));
  const le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('ğ\r\n', 'utf16le')]); assert.equal(ch.decode(le).text, 'ğ\n'); assert.ok(rt(le));
  const be = Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from('ı\n', 'utf16le').swap16()]); assert.equal(ch.decode(be).text, 'ı\n'); assert.ok(rt(be));
  assert.equal(ch.decode(Buffer.from([0xff, 0xfe, 0x41])), null, 'tek bayt UTF-16');
  assert.equal(ch.decode(Buffer.from([0xc3, 0x28])), null, 'UTF-8 değil');
  assert.deepEqual(ch.encode('a\nb'), Buffer.from('a\nb'));
});

test('readCurrent / classify / needsAck', () => {
  const d = dir(), f = path.join(d, 'a.txt');
  assert.deepEqual(ch.readCurrent(f), { exists: false, hash: 'yok' });
  assert.deepEqual(ch.readCurrent(path.join(f, 'alt')), { exists: false, hash: 'yok' });
  assert.match(ch.readCurrent('\0').error || '', /Okunamadı/);
  assert.match(ch.readCurrent(d).error, /dosya değil/);
  fs.writeFileSync(f, Buffer.from([0xc3, 0x28])); assert.match(ch.readCurrent(f).error, /metin değil/);
  const big = path.join(d, 'big'); const fd = fs.openSync(big, 'w'); fs.ftruncateSync(fd, 8 * 1024 * 1024 + 1); fs.closeSync(fd);
  assert.match(ch.readCurrent(big).error, /çok büyük/);
  fs.writeFileSync(f, 'x\r\n'); const cur = ch.readCurrent(f);
  assert.equal(cur.exists, true); assert.equal(cur.text, 'x\n'); assert.equal(cur.fmt.eol, '\r\n'); assert.equal(cur.hash.length, 64);
  // sembolik bağ / junction
  const link = path.join(d, 'bag');
  try { fs.symlinkSync(d, link, 'junction'); assert.match(ch.readCurrent(link).error, /sembolik/); } catch (e) { if (e.code !== 'EPERM') throw e; }
  const C = (f, c) => ch.classify(f, c);
  assert.equal(C({}, { error: 'x' }), 'unreadable');
  assert.equal(C({}, { exists: false }), 'missing');
  assert.equal(C({ initial: 'a' }, { exists: true, text: 'a' }), 'initial');
  assert.equal(C({ initial: 'a' }, { exists: true, text: 'b' }), 'unverified');
  assert.equal(C({ initial: null, last: 'b' }, { exists: true, text: 'b' }), 'same');
  assert.equal(C({ last: 'b' }, { exists: true, text: 'c' }), 'outside');
  assert.equal(ch.needsAck({}, 'outside'), true); assert.equal(ch.needsAck({}, 'unverified'), true);
  assert.equal(ch.needsAck({ created: false }, 'missing'), true); assert.equal(ch.needsAck({ created: true }, 'missing'), false);
  assert.equal(ch.needsAck({}, 'same'), false);
});

test('checkPath: geçersiz, göreli, aygıt, yol geçişi, kayıt dosyası, junction', () => {
  const d = dir(), plat = process.platform;
  for (const bad of [null, '', 'a\0b', 'x'.repeat(5000)]) assert.throws(() => ch.checkPath(bad), /Geçersiz/);
  assert.throws(() => ch.checkPath('goreli/a.txt'), /mutlak/);
  assert.throws(() => ch.checkPath('\\\\?\\C:\\a'), /mutlak/);
  assert.throws(() => ch.checkPath('//./x/a'), /mutlak/);
  assert.throws(() => ch.checkPath(path.join(d, 'x') + path.sep + '..' + path.sep + 'a'), /geçişi/);
  const proj = path.join(d, 'projects');
  assert.throws(() => ch.checkPath(path.join(proj, 'p', 's.jsonl'), { projectsDir: proj }), /kayıtlarına/);
  assert.equal(ch.checkPath(path.join(proj, 'p', 's.txt'), { projectsDir: proj, platform: 'linux' }), path.join(proj, 'p', 's.txt'));
  assert.equal(ch.checkPath(path.join(d, 'yok', 'derin', 'a.txt'), { platform: plat }), path.join(d, 'yok', 'derin', 'a.txt'));
  const hedef = path.join(d, 'hedef'), link = path.join(d, 'bag'), sarkan = path.join(d, 'sarkan');
  fs.mkdirSync(hedef); fs.symlinkSync(hedef, link, 'junction');
  assert.throws(() => ch.checkPath(path.join(link, 'a.txt'), { platform: plat }), /sembolik/);
  assert.throws(() => ch.checkPath(path.join(link, 'alt', 'a.txt'), { platform: plat }), /sembolik/, 'olmayan alt klasör de bağ üzerinden');
  // hedefi olmayan (sarkan) bağ: çözülemez → reddedilir
  fs.mkdirSync(path.join(d, 'gecici')); fs.symlinkSync(path.join(d, 'gecici'), sarkan, 'junction'); fs.rmdirSync(path.join(d, 'gecici'));
  assert.throws(() => ch.checkPath(path.join(sarkan, 'a.txt'), { platform: plat }), /çözümlenemedi|sembolik/);
  // kök klasöre kadar hiçbir şey yok (taklit): kök çözülür
  const ls = fs.lstatSync; fs.lstatSync = () => { throw new Error('yok'); };
  const rp = fs.realpathSync; fs.realpathSync = q => q;
  try { assert.equal(ch.checkPath(path.join(d, 'a'), { platform: 'linux' }), path.join(d, 'a')); } finally { fs.lstatSync = ls; fs.realpathSync = rp; }
});

test('sourcesOf: ana kayıt + alt ajan kayıtları', async () => {
  const d = dir(), main = path.join(d, 's1.jsonl'); fs.writeFileSync(main, '');
  let s = await ch.sourcesOf(main); assert.equal(s.files.length, 1);
  const sub = path.join(d, 's1', 'subagents'); fs.mkdirSync(sub, { recursive: true });
  fs.writeFileSync(path.join(sub, 'b.jsonl'), ''); fs.writeFileSync(path.join(sub, 'a.jsonl'), ''); fs.writeFileSync(path.join(sub, 'not.txt'), '');
  s = await ch.sourcesOf(main);
  assert.deepEqual(s.files.map(f => [path.basename(f.file), f.side]), [['s1.jsonl', false], ['a.jsonl', true], ['b.jsonl', true]]);
  s = await ch.sourcesOf(path.join(d, 'yok.jsonl')); assert.match(s.key, /\|-$/);
});

// Gerçek bir oturum: geçici proje klasöründe dosyalar ve bunları değiştiren kayıt
function scenario() {
  const d = dir(), proj = path.join(d, 'proje'), logs = path.join(d, 'projects', 'p'); fs.mkdirSync(proj); fs.mkdirSync(logs, { recursive: true });
  const A = path.join(proj, 'a.txt'), N = path.join(proj, 'yeni.md'), M = path.join(proj, 'silinen.txt');
  const a0 = 'bir\niki\nüç\n', a1 = 'bir\nİKİ\nüç\n', m0 = 'eski\n';
  fs.writeFileSync(A, a1.replace(/\n/g, '\r\n')); // CRLF diskte; kayıt LF
  fs.writeFileSync(N, '# yeni\n');
  const t = log(...edit('e1', A, a0, 'iki', 'İKİ'), ...write('w1', N, '# yeni\n'), ...edit('e2', M, m0, 'eski', 'yeni'),
    ...edit('e3', path.join(proj, 'buyuk.txt'), 'q\n', 'q', 'Q', { noOrig: true, noPatch: true }));
  const sessionFile = path.join(logs, 's.jsonl'); fs.writeFileSync(sessionFile, t);
  const trashed = [];
  const api = ch.createChanges({ platform: process.platform, projectsDir: path.join(d, 'projects'), backupDir: path.join(d, 'geri-alinanlar'), trash: async p => { trashed.push(p); fs.renameSync(p, p + '.cop'); } });
  return { d, A, N, M, a0, a1, sessionFile, api, trashed };
}

test('createChanges: liste ve fark', async () => {
  const { A, N, M, sessionFile, api, a0, a1 } = scenario();
  const list = await api.list(sessionFile);
  assert.deepEqual(list.map(f => [path.basename(f.path), f.cur, f.ack, f.canRevert]),
    [['a.txt', 'same', false, true], ['yeni.md', 'same', false, true], ['silinen.txt', 'missing', true, true], ['buyuk.txt', 'missing', true, false]]);
  assert.equal(await api.list(sessionFile) .then(l => l.length), 4, 'önbellekten');
  const df = await api.diff(sessionFile, A);
  assert.equal(df.initial, a0); assert.equal(df.last, a1); assert.equal(df.current, a1); assert.equal(df.steps.length, 1);
  const dn = await api.diff(sessionFile, M); assert.equal(dn.current, null);
  fs.mkdirSync(path.join(path.dirname(A), 'buyuk.txt'));
  const db = await api.diff(sessionFile, path.join(path.dirname(A), 'buyuk.txt')); assert.equal(db.current, undefined); assert.equal(db.cur, 'unreadable');
  await assert.rejects(api.diff(sessionFile, '/baska'), /kayıtlarında yok/);
  // 2 MB üstü metin farka konmaz
  fs.writeFileSync(N, 'x'.repeat(2e6 + 1)); assert.equal((await api.diff(sessionFile, N)).current, false);
});

test('createChanges: geri alma — yedek, CRLF korunur, oluşturulan dosya Çöp Kutusuna', async () => {
  const { d, A, N, M, sessionFile, api, a0, trashed } = scenario();
  let [fa, fn, fm, fb] = await api.list(sessionFile);
  await assert.rejects(api.revert(sessionFile, '/yok'), /kayıtlarında yok/);
  await assert.rejects(api.revert(sessionFile, A, { hash: 'eski' }), /önizlemeden sonra/);
  await assert.rejects(api.revert(sessionFile, fb.path, { hash: fb.hash }), /büyük dosyalarda/);
  // değiştirilmiş dosya → ilk hal, CRLF korunur, yedek alınır
  let r = await api.revert(sessionFile, A, { hash: fa.hash });
  assert.equal(r.action, 'write'); assert.equal(fs.readFileSync(A, 'utf8'), a0.replace(/\n/g, '\r\n'));
  assert.equal(fs.readFileSync(r.backup, 'utf8'), 'bir\r\nİKİ\r\nüç\r\n');
  assert.equal(JSON.parse(fs.readFileSync(path.join(path.dirname(r.backup), 'bilgi.json'), 'utf8')).islem, 'ilk-hal');
  assert.ok(r.backup.startsWith(path.join(d, 'geri-alinanlar')));
  // ikinci kez: zaten ilk halinde
  fa = (await api.list(sessionFile))[0]; assert.equal(fa.cur, 'initial');
  r = await api.revert(sessionFile, A, { hash: fa.hash }); assert.equal(r.action, 'none');
  // oluşturulan dosya → çöp kutusu (önce yedek)
  r = await api.revert(sessionFile, N, { hash: fn.hash });
  assert.equal(r.action, 'trash'); assert.deepEqual(trashed, [N]); assert.ok(fs.existsSync(r.backup)); assert.ok(!fs.existsSync(N));
  fn = (await api.list(sessionFile))[1]; r = await api.revert(sessionFile, N, { hash: fn.hash }); assert.equal(r.action, 'none', 'zaten yok');
  // diskte olmayan, oturumda oluşturulmamış dosya → onay gerekir, sonra yeniden oluşturulur
  await assert.rejects(api.revert(sessionFile, M, { hash: fm.hash }), /ayrıca onay/);
  r = await api.revert(sessionFile, M, { hash: fm.hash, ack: true });
  assert.equal(r.action, 'create'); assert.equal(r.backup, null); assert.equal(fs.readFileSync(M, 'utf8'), 'eski\n');
});

test('createChanges: dışarıda değişmiş dosya onay ister; okunamayan ve yazılamayan dosya hata verir', async () => {
  const { A, sessionFile, api, a0 } = scenario();
  fs.writeFileSync(A, 'elle değişti\n');
  let fa = (await api.list(sessionFile))[0]; assert.equal(fa.cur, 'outside'); assert.equal(fa.ack, true);
  await assert.rejects(api.revert(sessionFile, A, { hash: fa.hash }), /ayrıca onay/);
  // yazma hatası: geçici dosya adı çakışırsa (wx) temizlenir ve hata metni döner
  const orig = fs.renameSync; fs.renameSync = () => { throw new Error('kilitli'); };
  try { await assert.rejects(api.revert(sessionFile, A, { hash: fa.hash, ack: true }), /Yazılamadı: kilitli/); } finally { fs.renameSync = orig; }
  assert.deepEqual(fs.readdirSync(path.dirname(A)).filter(n => n.endsWith('.tmp')), []);
  const r = await api.revert(sessionFile, A, { hash: fa.hash, ack: true });
  assert.equal(r.action, 'write'); assert.equal(fs.readFileSync(A, 'utf8'), a0);
  // okunamayan (UTF-8 değil)
  fs.writeFileSync(A, Buffer.from([0xc3, 0x28])); fa = (await api.list(sessionFile))[0];
  await assert.rejects(api.revert(sessionFile, A, { hash: fa.hash }), /metin değil/);
});

test('createChanges: önbellek 8 oturumla sınırlı, kayıt büyüyünce yeniden okunur, okunamayan kayıt boş sayılır', async () => {
  const d = dir(), api = ch.createChanges({ backupDir: path.join(d, 'b'), trash: async () => {} });
  const files = [];
  for (let i = 0; i < 10; i++) { const f = path.join(d, `s${i}.jsonl`); fs.writeFileSync(f, log(...write('w' + i, path.join(d, `f${i}.txt`), 'x\n'))); files.push(f); }
  for (const f of files) assert.equal((await api.list(f)).length, 1);
  fs.appendFileSync(files[9], log(...write('w99', path.join(d, 'ek.txt'), 'y\n')));
  assert.equal((await api.list(files[9])).length, 2);
  // okunamayan kayıt (klasör)
  const bad = path.join(d, 'kl.jsonl'); fs.mkdirSync(bad);
  assert.deepEqual(await api.list(bad), []);
});

test('kenar durumlar: zaman damgasız satırlar, boş Write, sıra dışı kaynaklar, yama sayımı, geçici dosya yazılamaması', async () => {
  // zaman damgası olmayan kullanım/sonuç; mesajı olmayan satır
  const raw = [JSON.stringify({ x: 'tool_use' }),
    JSON.stringify({ message: { content: [{ type: 'tool_use', id: 'q', name: 'Write', input: { file_path: '/p/bos', content: '' } }] } }),
    JSON.stringify({ message: { content: [{ type: 'tool_result', tool_use_id: 'q', content: 'ok' }] }, toolUseResult: { type: 'create', filePath: '/p/bos', content: '' } }),
    JSON.stringify({ message: { content: [{ type: 'tool_use', id: 'r', name: 'Read', input: {} }] } }),
    JSON.stringify({ message: { content: [{ type: 'tool_result', tool_use_id: 'r' }] }, toolUseResult: { type: 'text', file: { filePath: '/p/bos', content: '', startLine: 1, numLines: 0, totalLines: 0 } } })].join('\n');
  const ev = ch.parseLog(raw);
  assert.deepEqual(ev.map(e => [e.tool, e.ts]), [['Write', ''], ['Read', '']]);
  const f = ch.collect([{ text: raw }])[0];
  assert.equal(f.created, true); assert.equal(f.last, ''); assert.deepEqual([f.added, f.removed], [0, 0]);
  // içeriği olmayan Write (bozuk kayıt) ve null / sayı içeren yama
  let o = ch.opsOf({ tool: 'Write', input: {}, r: { type: 'update', structuredPatch: [null, { lines: ['+a', 3, '-b', ' c'] }] } });
  assert.deepEqual(o.count, { added: 1, removed: 1 });
  o = ch.opsOf({ tool: 'Write', input: {}, r: null }); assert.deepEqual(o.count, { added: 0, removed: 0 });
  o = ch.opsOf({ tool: 'Write', input: {}, r: { type: 'update', originalFile: 'a\nb\n', content: 'a\nc\n' } }); assert.deepEqual(o.count, { added: 1, removed: 1 }, 'yamasız güncelleme');
  // kaynaklar ters zaman sırasıyla verilir; aynı kaynakta aynı zaman
  tsN = 300; const later = log(...edit('l', '/p/s', 'b\n', 'b', 'c'));
  tsN = 200; const early = log(...write('e', '/p/s', 'b\n', 'a\n'));
  const s = ch.collect([{ text: later }, { text: early }])[0];
  assert.equal(s.initial, 'a\n'); assert.equal(s.last, 'c\n'); assert.equal(s.steps[0].tool, 'Write');
  const same = JSON.stringify({ timestamp: 'T', message: { content: [{ type: 'tool_use', id: 'a', name: 'Write', input: { file_path: '/p/t', content: '1' } }, { type: 'tool_use', id: 'b', name: 'Write', input: { file_path: '/p/t', content: '2' } }] } })
    + '\n' + JSON.stringify({ timestamp: 'T', message: { content: [{ type: 'tool_result', tool_use_id: 'a' }, { type: 'tool_result', tool_use_id: 'b' }] } });
  assert.equal(ch.collect([{ text: same }])[0].last, '2');
  // geçici dosya yazılamazsa (wx) silme denemesi de başarısız olur; hata metni döner
  const { A, sessionFile, api } = scenario();
  const fa = (await api.list(sessionFile))[0];
  const w = fs.writeFileSync; fs.writeFileSync = (p, ...a) => { if (String(p).endsWith('.tmp')) throw new Error('disk dolu'); return w(p, ...a); };
  try { await assert.rejects(api.revert(sessionFile, A, { hash: fa.hash }), /Yazılamadı: disk dolu/); } finally { fs.writeFileSync = w; }
});
