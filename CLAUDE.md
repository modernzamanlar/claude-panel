# Claude Panel — proje notları

Claude Code sohbetlerini yöneten Electron masaüstü uygulaması: klasörler, 1–4 yan yana bölme, `~/.claude/projects` ile canlı senkron, GourceView, FTS5 arama, başsız `claude` CLI ile mesaj/araç/izin. Arayüz Türkçe; kullanıcıyla Türkçe konuşulur.

Asıl hedef **Windows** (ofis bilgisayarı); geliştirme ve derleme Mac'te. Sürüm sürüm ayrıntı `PLAN.md`'de (bölüm 1–21); yalnızca gerektiğinde oku.

Kod GitHub'da `modernzamanlar/claude-panel` (dal `main`; depo herkese açık — kullanıcı kararı, 2026-11-06: sır, müşteri adı, iç bilgi koyma). Commit/push yalnızca kullanıcı isteyince.

## Komutlar
```bash
npm start                 # geliştirme modunda aç
npm test                  # scripts/test.js → test/*.test.js kendi geçici kökünde (bitince silinir); Windows'ta da çalışır
npm run test:cov          # media/complete/usage/markdown kapsamı (%100 tutulur)
npm run test:ui           # uygulama içi tam test, Mac + Windows görünümü (scripts/ui-test/run.js + extra/*.js, sahte claude CLI); yayından önce çalıştır
node scripts/mutate.js src/main/<modül>.js test/<a>.test.js [--only 10-50]   # mutasyon testi
npm run icon              # build/icon-kaynak.png → build/icon.png (sonra iconutil ile icon.icns); npx electron build/make-pixel.js → 8-bit köpek
npm run dist              # Mac dmg (dist/Claude Panel-<sürüm>-arm64.dmg)
npm run release:win       # Windows exe + NAS'a imzalı yayın (scripts/release-win.js)
```
**Selftest:** `npx electron . --selftest`, `SELFTEST_STEPS`'teki her satırı renderer'da çalıştırır; sonuç JSON, ekran görüntüleri `SELFTEST_OUT`'a. Gerçek veriyi kirletmemek için her zaman `CLAUDE_PANEL_HOME=<geçici>` ve `CLAUDE_PANEL_MIRROR=<geçici>` ver. `CLAUDE_PANEL_UI_PLATFORM=win32` Windows arayüzünü taklit eder; `CLAUDE_PANEL_UPDATES=<klasör>` güncelleyiciyi dener; sahte CLI `test/fake-claude.js` (`FAKE_PERM`, `FAKE_DELAY`). Olayları `document.body`'ye gönder. Bölmelerde gerçek `~/.claude/projects` sohbetleri açılır: testte "ilk öğe" yerine kendi eklediğin son öğeyi seç.

## Mimari (src/)
- `main/main.js`: pencere, menü, tüm IPC (yalnızca kendi sayfadan: `senderFrame.url`/`sender` denetlenir), `cpmedia://local/<kodlanmış yol>` (yalnızca medya/görsel uzantıları, Range 206), izleyici, kapanış onayı, rozet/sayaç (`app:badge`), sesli yazma (`app:dictate`).
- `main/runner.js`: `claude -p --input-format stream-json --output-format stream-json --verbose --include-partial-messages --permission-prompt-tool stdio`. Windows `launchSpec`/`taskkill /T`; girdiler doğrulanır (UUID, izin modu, model, gerçek `cwd`); `effort` → `--effort`; `control` → `--chrome` + agent-desktop varsa `--mcp-config`. Giriş/Uzaktan Kontrol betikleri `mkdtemp`+`wx`; `shell.openPath` hata metni döndürür → `opened()` hata fırlatır.
- `main/sessions.js`: özetler (baş+son okunur, önbellek); `feedLine`/`finishParse` (tam okuma `loadSession` ve artımlı `SessionLoader`); araç görselleri `~/.claude-panel/gorseller/`; `turnCard` (wrap_up → kart, update_plan → görev listesi).
- `main/media.js`: `recentMedia` (bilgi paneli "Son medya"), `okBadgeIcon`, `dictateCommand` (Windows Win+H, PowerShell `-EncodedCommand`).
- `main/search.js` FTS5 (Türkçe duyarsız); `main/workspace.js` atomik yazım + `.bak` + yansıdan kurtarma; `main/mirror.js` panel → `C:\Claude Panel` (Mac'te kapalı; kullanıcı dosyalarına dokunmaz); `main/updater.js` NAS'tan Ed25519 imzalı güncelleme, SHA-512, sessiz kurulum.
- `preload.js`: `window.api` köprüsü.
- `renderer/app.js` (düz JS): durum `S`, kaydedilen `WS` (`persist()` 400 ms, kapanışta `saveSync`).
  - Bölmeler yamalanır (`paneParts`, `setSlot`, `patchMsgs`); aynı oturumda yazma kutusu yeniden oluşturulmaz. `sessions:changed` tam `render()` çağırmaz. Bölmeyi baştan kuran kod yazma.
  - Gönderme: `send(i)` → `sendNow(s, text, att)`; çalışırken mesaj `s.queue`'ya girer (`runQueue`); başka yerde açık sohbette `forkCard`.
  - Tıklama tek `click` dinleyicisinde `closest()` sırasıyla çalışır; `data-m` yalnızca `.menu` içinde dinlenir (menü dışı kartlarda kendi `data-*` adını kullan). Yeni `data-*`/sınıf adı eklemeden önce `grep` ile çakışma kontrol et.
  - Tema `isDarkTheme()`/`applyTheme()` (`WS.prefs.theme`); rengi karşılaştırarak tema anlama.
  - `WS.prefs`: `theme`, `fonts`(+`fontsV`), `side`, `sort`, `effort`, `control`, `templates`, `usage`, `usageHist`.
- `renderer/markdown.js`: önce kaçışlar; dış bağlantı yalnızca `https?`; yerel yol `data-fp`, yerel görsel `img.md-img` (güvenlik denetleyicisi `test/q-markdown.test.js`).
- `renderer/complete.js` (Tab tamamlama), `renderer/usage.js` (kullanım geçmişi/tahmin): tarayıcıda `window.*`, Node'da `module.exports`.
- `renderer/styles.css` tema değişkenleri `:root`'ta (koyu: Claude Code tonları); `renderer/fonts/` gömülü OFL yazı tipleri; `renderer/img/dog8.png`.

Veri: `~/.claude/projects` yalnızca okunur. `~/.claude-panel/`: `workspace.json(.bak)`, `index.json`, `search.db`, `settings.json`, `gorseller/`, `bilgisayar-kontrolu.mcp.json`.

## Yayın akışı (Windows)
1. `package.json` `version` artır (güncelleyici yalnızca yüksek sürümü önerir).
2. `SURUM-NOTU.txt` güncelle (Windows'ta güncelleme notu olarak görünür), `PLAN.md`'ye bölüm ekle.
3. `npm test`, `npm run test:cov`, `npm run test:ui`.
4. `npm run release:win`: exe'yi NAS `Exe`'ye kopyalar, doğrular, imzalı `guncelleme.json`'u en son yazar, eski exe'leri temizler.
5. Kodu NAS'a aktar:
   ```bash
   N="/Volumes/192.168.1.249/personel disk/Ajans/00 - Yasin/Claude App"
   rsync -rt --delete --exclude=.DS_Store --exclude=node_modules --exclude=dist src test build scripts "$N/Kod/"
   rsync -t package.json package-lock.json PLAN.md SURUM-NOTU.txt CLAUDE.md .gitignore "$N/Kod/"
   ```
- NAS bağlı mı: `/Volumes/192.168.1.249`; değilse `osascript -e 'mount volume "smb://uzak@192.168.1.249/D"'` (anahtar zincirinden). NAS'taki `BENİOKU.md` Windows kurulum notları.
- **İmza anahtarı** `~/.claude-panel-yayin/guncelleme-imza.pem` yalnızca bu Mac'te: depoya, GitHub'a ya da NAS'a asla koyma; kaybetme, yeniden üretme (açık anahtar `updater.js`'e gömülü).
- Kalıcı dosya silme (`rm`) güvenlik kontrolüne takılabilir; atlatmaya çalışma.

## Kullanıcı kararları
- **`DEFAULT_PMODE = 'bypassPermissions'` bilinçli karar.** Değiştirme, bir daha sorma.
- Yeni sohbet varsayılan "Klasörsüz". Varsayılanlar: kenar çubuğu açık, sıralama Ad, Inter / arayüzle aynı / JetBrains Mono, Kontrol açık.
- Kullanıcı bu sohbete panelden de yazabilir (aynı klasörde ikinci ajan `sdk-cli`); büyük işten önce son `.jsonl` kayıtlarına bak.
- Kimlik bilgisi/parola girilmez; Claude girişini kullanıcı yapar.

## Durum (0.3.0, 2026-11-06)
0.3.0 özellikleri `PLAN.md` bölüm 22'de. Eski yarım dallar (`ozellik/at-dosya`, `baglam`, `dosya-farki`, `mesaj-duzenle`) bu sürüme birleşti; `ozellik/terminal` ve `ozellik/tarayici` kapsam dışı kaldı (birleştirilmedi).
- Selftest'i Windows'ta `--disable-gpu` ve ayrı `--user-data-dir` ile çalıştır (run.js bunu yapar); gerçek `~/.claude/projects` büyükse `USERPROFILE`'ı geçici eve yönlendir.
- Renderer betikleri aynı global kapsamı paylaşır: yeni modül `window.X`/`module.exports` sarmalıyla yazılır, üst düzey `const` ekleme.
- Windows'ta Python ile dosya yazarken `newline=''` kullan (yoksa CRLF olur, birleştirmede bütün dosya çakışır).
- Uzaktan Kontrol penceresi işi (eski madde 3) hâlâ yapılmadı.

## Bekleyenler
- **Gerçek Windows'ta denenmedi:** NAS güncellemesi, `C:\Claude Panel` yansısı, kapanış onayı, Uzaktan Kontrol (claude.ai'den bağlanma), Win+H sesli yazma, görev çubuğu sayacı ve bildirimler, agent-desktop (`npm install -g agent-desktop`).
- **Exe kod imzası (Authenticode):** sertifika yok → SmartScreen uyarısı.
- Mac: ad-hoc imzalı; güncelleme `macupdate.js` ile (gerçek Mac'te denenmedi). Ekran kontrolünde fare/klavye yalnız Windows.
- Gözlemler: oturum dizini yalnızca uuid ile anahtarlı; yansı kökü ve NAS IP'si koda gömülü; "gizli" = panelden kalıcı kaldırılmış (tasarım gereği).
