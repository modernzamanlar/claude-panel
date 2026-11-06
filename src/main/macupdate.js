// Mac için kendi kendini güncelleme yardımcıları (updater.js kullanır). Mac paketi ad-hoc imzalıdır (Apple sertifikası yok),
// bu yüzden Squirrel/electron-updater çalışmaz. Akış: guncelleme.json'daki imzalı "mac" girdisi → .zip (içinde .app) ve .dmg
// geçici klasöre kopyalanıp SHA-512 ile doğrulanır → "Yeniden başlat"a basınca .app `ditto -x -k` ile çıkarılır, sabit bir
// kabuk betiği yazılır (mkdtemp + wx, yalnızca kullanıcı) ve uygulama kapanır. Betik süreç bitince eski .app'i yedekler,
// yenisini koyar, karantinayı kaldırır, ad-hoc imzalar, açar; hata olursa eskisini geri koyup DMG'yi açar.
// Betiğe hiçbir dış dize gömülmez: tüm yollar konum argümanı olarak ("$1"…) verilir.
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const APP_NAME = 'Claude Panel.app';          // zip'in içindeki paket (package.json productName)
const RESULT_FILE = 'mac-guncelleme-sonuc.txt'; // betik başarısız olursa nedeni buraya yazar; uygulama açılışta okur
const LOG_FILE = 'mac-guncelleme.log';
const GUIDE = "Güncelleme otomatik kurulamadı. Açılan pencerede Claude Panel'i Applications klasörüne sürükleyin (var olanın yerine koyun), sonra uygulamayı yeniden açın.";
// Mac'te NAS "Claude App\Exe" klasörü (CLAUDE.md yayın akışı: /Volumes/192.168.1.249; Finder ile bağlanınca paylaşım adıyla /Volumes/D)
const DEFAULT_SOURCES_MAC = [
  '/Volumes/192.168.1.249/personel disk/Ajans/00 - Yasin/Claude App/Exe',
  '/Volumes/D/personel disk/Ajans/00 - Yasin/Claude App/Exe',
];

// Klasördeki bir dosya adı: yol ayırıcı, sürücü, joker, denetim karakteri, "..", baştaki "." ya da "-" yok
const safeName = (name, ext) => typeof name === 'string' && new RegExp(`^[^\\\\/:*?"<>|\\x00-\\x1f.-][^\\\\/:*?"<>|\\x00-\\x1f]*\\${ext}$`, 'i').test(name) && !name.includes('..');
const macSignedText = e => `claude-panel-guncelleme-mac\n${e.version}\n${e.file}\n${e.size}\n${e.sha512}\n${e.dmg}\n${e.dmgSize}\n${e.dmgSha512}`;
function verifyMacEntry(e, publicKey) {
  if (!e || typeof e !== 'object') return false;
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(String(e.version))) return false;
  for (const [n, s, h, ext] of [[e.file, e.size, e.sha512, '.zip'], [e.dmg, e.dmgSize, e.dmgSha512, '.dmg']]) {
    if (!safeName(n, ext) || !Number.isInteger(s) || s <= 0 || typeof h !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(h)) return false; // SHA-512 zorunlu
  }
  try { return crypto.verify(null, Buffer.from(macSignedText(e)), publicKey, Buffer.from(e.imza, 'base64')); } catch { return false; }
}
const signMacEntry = (e, privateKeyPem) => crypto.sign(null, Buffer.from(macSignedText(e)), privateKeyPem).toString('base64');

/** Yayın: var olan manifestin Windows alanlarını (0.2.8 istemcileri bunları okur) olduğu gibi bırakıp mac girdisini koyar */
function mergeMacEntry(existing, mac) {
  const base = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {};
  return { ...base, mac };
}
/** Yayın (Windows): yeni Windows manifestine eskisindeki mac girdisini taşı */
const keepMacEntry = (existing, manifest) => (existing && existing.mac && typeof existing.mac === 'object' ? { ...manifest, mac: existing.mac } : manifest);

/** app.getPath('exe') → …/X.app/Contents/MacOS/X → …/X.app */
function bundleRoot(exe) {
  const m = /^(\/.+?\.app)\/Contents\/MacOS\/[^/]+$/.exec(String(exe || ''));
  return m ? m[1] : null;
}
/** Kendi yerinde değiştirilebilir mi? Değilse nedeni (Türkçe) döner. */
function preflight(bundle, { home = os.homedir(), access = fs.accessSync } = {}) {
  if (!bundle) return 'Uygulama paketinin (.app) yeri bulunamadı';
  if (bundle.includes('/AppTranslocation/')) return 'Uygulama karantinadan (App Translocation) çalışıyor; Applications klasörüne taşınmamış';
  const dir = path.posix.dirname(bundle);
  if (dir !== '/Applications' && dir !== path.posix.join(home, 'Applications')) return `Uygulama Applications klasöründe değil: ${bundle}`;
  try { access(dir, fs.constants.W_OK); access(bundle, fs.constants.W_OK); } catch { return `${dir} klasörüne yazma izni yok`; }
  return null;
}

// Sabit betik. Sıra: bekle → kopyala → yedekle → değiştir → xattr → codesign → open; hata olursa eskisini geri koy, DMG'yi aç.
const SCRIPT = `#!/bin/sh
# Claude Panel Mac güncellemesi (uygulama yazdı; elle çalıştırma)
PID="$1"; APP="$2"; NEW="$3"; DMG="$4"; RESULT="$5"; LOG="$6"
WORK=$(dirname "$0")
DIR=$(dirname "$APP"); BASE=$(basename "$APP")
STAGE="$DIR/.$BASE.yeni"; BACKUP="$DIR/.$BASE.yedek"; BACKED=0
exec >>"$LOG" 2>&1
log() { printf '%s %s\\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
fail() {
  log "HATA: $1"
  if [ "$BACKED" = 1 ]; then
    rm -rf "$APP"
    if mv "$BACKUP" "$APP"; then log "geri al: eski sürüm yerine kondu"; else log "geri al: BAŞARISIZ, yedek: $BACKUP"; fi
  fi
  rm -rf "$STAGE"
  printf '%s\\n' "$1" > "$RESULT"
  if [ -n "$DMG" ] && [ -f "$DMG" ]; then open "$DMG"; fi
  open "$APP"
  exit 1
}
log "başla: $APP"
i=0
while kill -0 "$PID" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -gt 120 ]; then fail "uygulama 60 sn içinde kapanmadı"; fi
  sleep 0.5
done
log "bekle: uygulama kapandı"
rm -rf "$STAGE"
ditto "$NEW" "$STAGE" || fail "yeni sürüm $DIR klasörüne kopyalanamadı"
rm -rf "$BACKUP"
if [ -e "$BACKUP" ]; then fail "eski yedek silinemedi: $BACKUP"; fi
mv "$APP" "$BACKUP" || fail "eski sürüm yedeklenemedi"
BACKED=1
log "yedekle: $BACKUP"
mv "$STAGE" "$APP" || fail "yeni sürüm yerine konamadı"
log "değiştir: $APP"
xattr -dr com.apple.quarantine "$APP" || log "uyarı: karantina özniteliği kaldırılamadı"
log "xattr"
codesign --force --deep --sign - "$APP" || fail "ad-hoc imza atılamadı (codesign)"
log "codesign"
rm -rf "$BACKUP"; BACKED=0
open "$APP" || log "uyarı: uygulama açılamadı"
log "bitti"
rm -rf "$WORK"
exit 0
`;

/** Çalışma klasörü (mkdtemp: POSIX'te 0700) ve içinde betik (wx: var olan dosyanın üstüne yazmaz, 0700). { work, script } */
function writeScript(tmpRoot = os.tmpdir()) {
  const work = fs.mkdtempSync(path.join(tmpRoot, 'claude-panel-mac-'));
  const script = path.join(work, 'guncelle.sh');
  fs.writeFileSync(script, SCRIPT, { flag: 'wx', mode: 0o700 });
  return { work, script };
}
/** Betiğin argümanları (sırası SCRIPT'teki $1…$6 ile aynı) */
const scriptArgs = ({ pid, bundle, newApp, dmg, resultFile, logFile }) => [String(pid), bundle, newApp, dmg || '', resultFile, logFile];

/** zip'i work/yeni içine ditto ile aç ve içinden beklenen .app'i döndür (yalnız gerçek klasör, sembolik bağ değil) */
async function extractApp(zip, work, execFile) {
  const out = path.join(work, 'yeni');
  fs.mkdirSync(out);
  await execFile('ditto', ['-x', '-k', zip, out]);
  const app = path.join(out, APP_NAME);
  const st = (() => { try { return fs.lstatSync(app); } catch { return null; } })();
  if (!st || !st.isDirectory() || !fs.existsSync(path.join(app, 'Contents', 'Info.plist')) || !fs.existsSync(path.join(app, 'Contents', 'MacOS')))
    throw new Error(`paketin içinde ${APP_NAME} yok`);
  return app;
}

/** Betiğin bıraktığı hata nedenini oku ve dosyayı sil (yoksa null) */
function takeResult(dir) {
  const f = path.join(dir, RESULT_FILE);
  let t = null;
  try { t = fs.readFileSync(f, 'utf8').trim(); fs.unlinkSync(f); } catch {}
  return t || null;
}
function appendLog(dir, line) {
  try { fs.mkdirSync(dir, { recursive: true }); fs.appendFileSync(path.join(dir, LOG_FILE), `${new Date().toISOString()} ${line}\n`); } catch {}
}

module.exports = {
  APP_NAME, RESULT_FILE, LOG_FILE, GUIDE, DEFAULT_SOURCES_MAC, SCRIPT,
  safeName, macSignedText, verifyMacEntry, signMacEntry, mergeMacEntry, keepMacEntry,
  bundleRoot, preflight, writeScript, scriptArgs, extractApp, takeResult, appendLog,
};
