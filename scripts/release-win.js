#!/usr/bin/env node
// Windows sürümünü yayınla: dist'teki kurulum dosyasını güncelleme klasörüne (NAS: Claude App\Exe) kopyalar,
// karşı tarafta SHA-512 ile doğrular ve EN SON guncelleme.json'u yazar. Böylece kurulu uygulamalar yarım kopyalanmış
// bir dosyayı asla görmez. Kullanım:  node scripts/release-win.js [--to <klasör>] [--notes "Bu sürümde…"]
const fs = require('fs');
const path = require('path');
const os = require('os');
const { sha512, signManifest, verifyManifest } = require('../src/main/updater');
const KEY = process.env.CLAUDE_PANEL_SIGN_KEY || path.join(os.homedir(), '.claude-panel-yayin', 'guncelleme-imza.pem');

const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const ROOT = path.join(__dirname, '..');
const { version } = require(path.join(ROOT, 'package.json'));
const DEST = arg('--to') || process.env.CLAUDE_PANEL_RELEASE_DIR || '/Volumes/192.168.1.249/personel disk/Ajans/00 - Yasin/Claude App/Exe';
const notes = arg('--notes') || (fs.existsSync(path.join(ROOT, 'SURUM-NOTU.txt')) ? fs.readFileSync(path.join(ROOT, 'SURUM-NOTU.txt'), 'utf8').trim() : '');
const name = `Claude Panel Setup ${version}.exe`;
const src = path.join(ROOT, 'dist', name);

(async () => {
  if (!fs.existsSync(src)) throw new Error('Kurulum dosyası yok: ' + src + ' (önce npm run dist:win)');
  if (!fs.existsSync(KEY)) throw new Error('İmza anahtarı yok: ' + KEY + ' — güncellemeler imzasız yayınlanamaz');
  if (!fs.existsSync(DEST)) throw new Error('Güncelleme klasörüne ulaşılamıyor: ' + DEST);
  const size = fs.statSync(src).size, hash = await sha512(src);
  const dst = path.join(DEST, name), part = dst + '.part';
  console.log(`→ ${name} (${(size / 1048576).toFixed(1)} MB) kopyalanıyor: ${DEST}`);
  fs.copyFileSync(src, part);
  if (fs.statSync(part).size !== size || await sha512(part) !== hash) throw new Error('Kopya doğrulanamadı');
  fs.renameSync(part, dst);
  const manifest = { version, file: name, size, sha512: hash, notes, date: new Date().toISOString() };
  manifest.imza = signManifest(manifest, fs.readFileSync(KEY, 'utf8'));
  if (!verifyManifest(manifest)) throw new Error('İmza, uygulamadaki açık anahtarla doğrulanamadı (anahtar değişmiş mi?)');
  const mf = path.join(DEST, 'guncelleme.json');
  fs.writeFileSync(mf + '.tmp', JSON.stringify(manifest, null, 2));
  fs.renameSync(mf + '.tmp', mf);
  // eski kurulum dosyalarını temizle (bu ve bir önceki sürüm kalır)
  const olds = fs.readdirSync(DEST).filter(f => /^Claude Panel Setup .+\.exe$/.test(f) && f !== name)
    .map(f => ({ f, t: fs.statSync(path.join(DEST, f)).mtimeMs })).sort((a, b) => b.t - a.t);
  olds.slice(1).forEach(o => { fs.unlinkSync(path.join(DEST, o.f)); console.log('  eski sürüm kaldırıldı:', o.f); });
  console.log(`✓ Sürüm ${version} yayınlandı. Kurulu uygulamalar 30 dk içinde (veya Ayarlar → Güncellemeleri denetle) alır.`);
})().catch(e => { console.error('✗', e.message); process.exit(1); });
