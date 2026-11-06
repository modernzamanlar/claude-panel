// Üzerine çizilmiş ek görselini diske yazar (renderer'dan gelen base64 PNG).
// Yalnızca verilen sabit klasöre, üretilmiş adla ("cizim-<zaman>-<rastgele>.png") ve "wx" ile yazılır:
// orijinal dosyanın üzerine asla yazılmaz, yol renderer'dan gelmez. Veri gerçekten PNG mi diye bakılır.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_SIDE = 16384;
const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// base64 → PNG tamponu; PNG değilse ya da sınır aşılırsa hata fırlatır
function decodePng(data) {
  if (typeof data !== 'string' || !data) throw new Error('Geçersiz görsel verisi');
  if (data.length > Math.ceil(MAX_BYTES / 3) * 4) throw new Error('Görsel çok büyük (en fazla 25 MB)');
  if (data.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new Error('Geçersiz görsel verisi');
  const buf = Buffer.from(data, 'base64');
  // İmza + IHDR (ilk parça) + IEND (son parça)
  if (buf.length < 57 || !buf.subarray(0, 8).equals(SIG) || buf.toString('latin1', 12, 16) !== 'IHDR' ||
      buf.toString('latin1', buf.length - 8, buf.length - 4) !== 'IEND') throw new Error('Veri PNG değil');
  const width = buf.readUInt32BE(16), height = buf.readUInt32BE(20);
  if (!width || !height || width > MAX_SIDE || height > MAX_SIDE) throw new Error('Geçersiz görsel boyutu');
  return { buf, width, height };
}

// Ekte görünecek ad (yalnızca gösterim; dosya adı her zaman üretilir)
function displayName(n) {
  const s = String(n == null ? '' : n).replace(/[\\/:*?"<>|\x00-\x1f]/g, '').trim().slice(0, 80);
  return !s ? 'cizim.png' : /\.png$/i.test(s) ? s : s + '.png';
}

async function saveAnnotated(dir, data, opts = {}) {
  if (typeof dir !== 'string' || !path.isAbsolute(dir)) throw new Error('Geçersiz görsel klasörü');
  const { buf, width, height } = decodePng(data);
  await fs.promises.mkdir(dir, { recursive: true });
  const file = path.join(dir, `cizim-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.png`);
  await fs.promises.writeFile(file, buf, { flag: 'wx' });
  return { path: file, name: displayName(opts.name), size: buf.length, width, height };
}

module.exports = { saveAnnotated, decodePng, displayName, MAX_BYTES, MAX_SIDE };
