// main/annotate.js: çizilmiş ek görselini kaydetme (yalnızca PNG, sabit klasör, üretilmiş ad, orijinal değişmez).
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { saveAnnotated, decodePng, displayName, MAX_BYTES, MAX_SIDE } = require('../src/main/annotate');

// Gerçek, çözülebilir bir PNG üretir (RGB, filtresiz)
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h, 0x80); for (let y = 0; y < h; y++) raw[y * (w * 3 + 1)] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cp-annot-'));

test('decodePng: geçerli PNG çözülür, boyutlar okunur', () => {
  const b = png(3, 2);
  const r = decodePng(b.toString('base64'));
  assert.ok(r.buf.equals(b)); assert.strictEqual(r.width, 3); assert.strictEqual(r.height, 2);
});

test('decodePng: PNG olmayan / bozuk / sınır dışı veri reddedilir', () => {
  const bad = (d, re) => assert.throws(() => decodePng(d), re);
  for (const d of [undefined, null, 42, '', {}]) bad(d, /Geçersiz görsel verisi/);
  bad('a'.repeat(Math.ceil(MAX_BYTES / 3) * 4 + 4), /çok büyük/);
  bad('abc', /Geçersiz görsel verisi/, 'uzunluk 4\'ün katı değil');
  bad('ab!d', /Geçersiz görsel verisi/);
  bad('data:image/png;base64,AAAA', /Geçersiz görsel verisi/);
  bad(Buffer.from('GIF89a' + 'x'.repeat(80)).toString('base64'), /PNG değil/);
  const b = png(2, 2);
  bad(b.subarray(0, 40).toString('base64'), /PNG değil/, 'kısa');
  const noIhdr = Buffer.from(b); noIhdr.write('IHDX', 12, 'latin1'); bad(noIhdr.toString('base64'), /PNG değil/);
  bad(Buffer.concat([b, Buffer.from('ekveri')]).toString('base64'), /PNG değil/, 'IEND sonda değil');
  bad(png(0, 2).toString('base64'), /boyutu/);
  bad(png(2, 0).toString('base64'), /boyutu/);
  const huge = Buffer.from(b); huge.writeUInt32BE(MAX_SIDE + 1, 16); bad(huge.toString('base64'), /boyutu/);
  const tall = Buffer.from(b); tall.writeUInt32BE(MAX_SIDE + 1, 20); bad(tall.toString('base64'), /boyutu/);
});

test('displayName: yol ayırıcıları ve denetim karakterleri temizlenir, .png eklenir', () => {
  assert.strictEqual(displayName('ekran-cizim.png'), 'ekran-cizim.png');
  assert.strictEqual(displayName('../../etc/passwd'), '....etcpasswd.png');
  assert.strictEqual(displayName('a:b*c?"<>|\x01.PNG'), 'abc.PNG');
  assert.strictEqual(displayName('Görsel ığüşöç'), 'Görsel ığüşöç.png');
  assert.strictEqual(displayName(''), 'cizim.png');
  assert.strictEqual(displayName(null), 'cizim.png');
  assert.strictEqual(displayName('   '), 'cizim.png');
  assert.strictEqual(displayName('x'.repeat(200)).length, 84);
});

test('saveAnnotated: sabit klasöre üretilmiş adla yazar; klasörü oluşturur; orijinale dokunmaz', async () => {
  const root = tmp();
  try {
    const dir = path.join(root, 'gorseller', 'alt');
    const orig = path.join(root, 'orijinal.png'); const ob = png(4, 4); fs.writeFileSync(orig, ob);
    const b = png(5, 3);
    const r = await saveAnnotated(dir, b.toString('base64'), { name: '../orijinal.png' });
    assert.strictEqual(path.dirname(r.path), dir, 'yalnızca verilen klasöre');
    assert.match(path.basename(r.path), /^cizim-\d+-[0-9a-f]{8}\.png$/);
    assert.ok(fs.readFileSync(r.path).equals(b));
    assert.deepStrictEqual({ name: r.name, size: r.size, width: r.width, height: r.height }, { name: '..orijinal.png', size: b.length, width: 5, height: 3 });
    assert.ok(fs.readFileSync(orig).equals(ob), 'orijinal dosya değişmedi');
    const r2 = await saveAnnotated(dir, b.toString('base64'));
    assert.notStrictEqual(r2.path, r.path, 'her kayıt yeni dosya'); assert.strictEqual(r2.name, 'cizim.png');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('saveAnnotated: göreli/geçersiz klasör ve PNG olmayan veri yazılmaz', async () => {
  const root = tmp();
  try {
    await assert.rejects(saveAnnotated('gorseller', png(1, 1).toString('base64')), /klasörü/);
    await assert.rejects(saveAnnotated(null, png(1, 1).toString('base64')), /klasörü/);
    await assert.rejects(saveAnnotated(root, Buffer.from('<svg/>'.repeat(20)).toString('base64')), /PNG değil/);
    assert.deepStrictEqual(fs.readdirSync(root), [], 'hiçbir dosya yazılmadı');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
