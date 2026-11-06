#!/usr/bin/env node
// Mac sürümünü yayınla (release-win.js'in karşılığı): dist'teki dmg + zip'i güncelleme klasörüne (NAS: Claude App/Exe)
// kopyalar, karşı tarafta SHA-512 ile doğrular ve EN SON guncelleme.json'a imzalı "mac" girdisini yazar.
// Manifestin Windows alanlarına (version, file, size, sha512, imza…) DOKUNMAZ: sahadaki 0.2.8 Windows istemcileri onları okur.
// Kullanım:  node scripts/release-mac.js [--to <klasör>] [--notes "Bu sürümde…"]   (önce npm run dist)
const fs = require('fs');
const path = require('path');
const os = require('os');
const { sha512, verifyManifest, MANIFEST, PUBLIC_KEY } = require('../src/main/updater');
const { signMacEntry, verifyMacEntry, mergeMacEntry } = require('../src/main/macupdate');

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** dist'te bu sürümün tek dmg'si ve tek zip'i (electron-builder adı: "Claude Panel-<sürüm>[-arm64].dmg" / "…[-arm64]-mac.zip") */
function findArtifacts(dist, version) {
  const files = fs.existsSync(dist) ? fs.readdirSync(dist) : [];
  const one = (re, what) => {
    const f = files.filter(x => re.test(x));
    if (f.length !== 1) throw new Error(`${dist} içinde sürüm ${version} için ${f.length ? 'birden fazla' : 'hiç'} ${what} var${f.length ? ': ' + f.join(', ') : ' (önce npm run dist)'}`);
    return f[0];
  };
  const v = esc(version);
  return { dmg: one(new RegExp(`^Claude Panel-${v}(-arm64)?\\.dmg$`), 'dmg'), zip: one(new RegExp(`^Claude Panel-${v}(-arm64)?-mac\\.zip$`), 'zip') };
}
async function copyVerified(src, destDir, log) {
  const name = path.basename(src), size = fs.statSync(src).size, hash = await sha512(src);
  const dst = path.join(destDir, name), part = dst + '.part';
  log(`→ ${name} (${(size / 1048576).toFixed(1)} MB) kopyalanıyor: ${destDir}`);
  fs.copyFileSync(src, part);
  if (fs.statSync(part).size !== size || await sha512(part) !== hash) throw new Error('Kopya doğrulanamadı: ' + name);
  fs.renameSync(part, dst);
  return { name, size, hash };
}

async function releaseMac({ dist, dest, keyFile, version, notes = '', publicKey = PUBLIC_KEY, log = console.log, now = new Date() }) {
  if (!fs.existsSync(keyFile)) throw new Error('İmza anahtarı yok: ' + keyFile + ' — güncellemeler imzasız yayınlanamaz');
  if (!fs.existsSync(dest)) throw new Error('Güncelleme klasörüne ulaşılamıyor: ' + dest);
  const art = findArtifacts(dist, version);
  const key = fs.readFileSync(keyFile, 'utf8');
  const mf = path.join(dest, MANIFEST);
  let existing = null;
  if (fs.existsSync(mf)) existing = JSON.parse(fs.readFileSync(mf, 'utf8')); // bozuksa dur: Windows girdisini ezmeyelim
  if (existing && existing.file && !verifyManifest(existing, publicKey)) log('! Uyarı: manifestteki Windows girdisinin imzası doğrulanamadı (olduğu gibi bırakıldı)');
  const zip = await copyVerified(path.join(dist, art.zip), dest, log);
  const dmg = await copyVerified(path.join(dist, art.dmg), dest, log);
  const mac = { version, file: zip.name, size: zip.size, sha512: zip.hash, dmg: dmg.name, dmgSize: dmg.size, dmgSha512: dmg.hash, notes, date: now.toISOString() };
  mac.imza = signMacEntry(mac, key);
  if (!verifyMacEntry(mac, publicKey)) throw new Error('İmza, uygulamadaki açık anahtarla doğrulanamadı (anahtar değişmiş mi?)');
  const manifest = mergeMacEntry(existing, mac);
  fs.writeFileSync(mf + '.tmp', JSON.stringify(manifest, null, 2));
  fs.renameSync(mf + '.tmp', mf);
  // eski Mac paketlerini temizle (bu ve bir önceki sürüm kalır)
  for (const [re, keep] of [[/^Claude Panel-.+-mac\.zip$/, zip.name], [/^Claude Panel-.+\.dmg$/, dmg.name]]) {
    const olds = fs.readdirSync(dest).filter(f => re.test(f) && f !== keep)
      .map(f => ({ f, t: fs.statSync(path.join(dest, f)).mtimeMs })).sort((a, b) => b.t - a.t);
    olds.slice(1).forEach(o => { fs.unlinkSync(path.join(dest, o.f)); log('  eski sürüm kaldırıldı: ' + o.f); });
  }
  log(`✓ Mac sürümü ${version} yayınlandı (${zip.name}, ${dmg.name}). Windows girdisi: ${existing && existing.version ? existing.version : 'yok'}.`);
  return manifest;
}

module.exports = { releaseMac, findArtifacts };

if (require.main === module) {
  const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
  const ROOT = path.join(__dirname, '..');
  releaseMac({
    dist: path.join(ROOT, 'dist'),
    dest: arg('--to') || process.env.CLAUDE_PANEL_RELEASE_DIR || '/Volumes/192.168.1.249/personel disk/Ajans/00 - Yasin/Claude App/Exe',
    keyFile: process.env.CLAUDE_PANEL_SIGN_KEY || path.join(os.homedir(), '.claude-panel-yayin', 'guncelleme-imza.pem'),
    version: require(path.join(ROOT, 'package.json')).version,
    notes: arg('--notes') || (fs.existsSync(path.join(ROOT, 'SURUM-NOTU.txt')) ? fs.readFileSync(path.join(ROOT, 'SURUM-NOTU.txt'), 'utf8').trim() : ''),
  }).catch(e => { console.error('✗', e.message); process.exit(1); });
}
