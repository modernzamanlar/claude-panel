# Claude Panel — proje notları

Claude Code sohbetlerini yöneten Electron masaüstü uygulaması. Arayüz Türkçe; kullanıcıyla Türkçe konuşulur.

Özellikler:
- Klasörler ve sohbetler
- 1–4 yan yana bölme
- `~/.claude/projects` ile canlı senkron
- GourceView ağ görünümü
- Tam ekran FTS5 arama
- Başsız `claude` CLI ile mesaj gönderme, araç çalıştırma ve izin istemleri

Asıl hedef **Windows**; ofisteki Windows bilgisayarında kullanılıyor. Geliştirme ve derleme Mac'te yapılıyor.

Ayrıntılı tasarım ve değişiklik geçmişi `PLAN.md` dosyasında; bölüm 1–18 sürüm sürüm ne yapıldığını anlatır.

## Komutlar
```bash
npm start                 # geliştirme modunda aç
npm test                  # scripts/test.js → node --test test/ kendi geçici kökünde (bitince silinir)
node scripts/mutate.js src/main/<modül>.js test/<a>.test.js [test/<b>.test.js] [--only 10-50]   # mutasyon testi
npm run icon              # build/icon-kaynak.png → build/icon.png (sonra iconutil ile icon.icns)
npm run test:ui           # uygulama içi tam test, Mac + Windows taklidi (scripts/ui-test, sahte claude CLI); yayından önce çalıştır
npm run dist              # Mac dmg (dist/Claude Panel-<sürüm>-arm64.dmg)
npm run dist:win          # Windows NSIS exe (Mac'ten, Wine gerekmez)
npm run release:win       # dist:win + NAS'a imzalı yayın (scripts/release-win.js)
```
**Uygulama içi test (selftest):**
- `npx electron . --selftest` komutu `SELFTEST_STEPS` ortam değişkenindeki her satırı renderer'da JS olarak çalıştırır.
- Sonuçlar JSON olarak, ekran görüntüleri `SELFTEST_OUT` klasörüne yazılır.
- Gerçek veriyi kirletmemek için her zaman şunları ver:
  - `CLAUDE_PANEL_HOME=<geçici>`: workspace ve önbellek
  - `CLAUDE_PANEL_MIRROR=<geçici>`: disk yansısı
- `CLAUDE_PANEL_UI_PLATFORM=win32` Mac'te Windows arayüzünü taklit eder (Ctrl etiketleri, pencere düğmeleri, ince kaydırma çubuğu).
- `CLAUDE_PANEL_UPDATES=<klasör>` güncelleyiciyi Mac'te sahte bir güncelleme klasörüyle dener.
- Olayları `document`'e değil `document.body`'ye gönder.

## Mimari (src/)
- `main/main.js`: pencere, menü, tüm IPC, `cpmedia://` protokolü, izleyici, kapanış onayı.
  - IPC yalnızca uygulamanın kendi sayfasından kabul edilir: `ipcMain.handle/on` sarmalanır, `senderFrame.url` ve `sender` denetlenir.
  - `cpmedia://local/<encodeURIComponent(yol)>` yalnızca medya ve görsel uzantılarını Range (206) desteğiyle sunar.
- `main/runner.js`: `claude -p --input-format stream-json --output-format stream-json --verbose --include-partial-messages --permission-prompt-tool stdio [--permission-mode …]`.
  - Windows: `claude.exe`/`claude.cmd` çözümü ve npm cmd-shim ayrıştırma (`launchSpec`); `taskkill /T` ile durdurma.
  - Kabuk yolunda tehlikeli karakter içeren argüman reddedilir.
  - Girdiler doğrulanır: UUID, izin modu listesi, model deseni, `cwd` gerçek klasör olmalı.
  - Giriş ve Uzaktan Kontrol için `.cmd`/`.command` betikleri `mkdtemp` + `wx` ile yazılır.
  - `effort` → `--effort` (izin listesi). `control` → `--chrome` + PATH'te agent-desktop varsa `--mcp-config ~/.claude-panel/bilgisayar-kontrolu.mcp.json` (Windows'ta `.cmd` → `cmd /c`). Testlerde `CLAUDE_PANEL_DESKTOP_BIN` ile değiştirilir.
- `main/sessions.js`: oturum özetleri (dosyanın başı ve sonu okunur, mtime/boyut önbelleği). `refresh()` sıraya alınmıştır.
  - `loadSession` araç sonucu görsellerini `~/.claude-panel/gorseller/` klasörüne yazar.
  - `SessionLoader` (main.js `session:load`): açık oturum büyüdükçe yalnızca yeni satırları ayrıştırır; `loadSession` aynı `feedLine`/`finishParse` kodunu tam okumayla kullanır.
  - `tilde()` büyük/küçük harf duyarsızdır ve ayraç denetler.
- `main/search.js`: SQLite FTS5 (`node:sqlite`), Türkçe karaktere duyarsız (`norm`).
- `main/workspace.js`: `~/.claude-panel/workspace.json`.
  - Atomik + fsync yazım, dakikada bir `.bak` yedeği.
  - Asıl dosya yoksa ya da bozuksa sırayla `.bak` → yansı yapı dosyası kullanılır.
- `main/mirror.js`: panel yapısının diskteki kopyası; Windows'ta `C:\Claude Panel`, Mac'te kapalı.
  - Klasör = dizin; sohbet = `<başlık>.sohbet.json`; çöp = `Çöp Kutusu\`; kurtarılan kullanıcı dosyaları = `Kurtarılan dosyalar\`.
  - Gizli yapı dosyası `.claude-panel-yapi.json` tüm workspace'i içerir. Yön tek: panel → disk.
  - Kullanıcının kendi dosyalarına hiç dokunulmaz.
- `main/updater.js`: Windows otomatik güncelleme.
  - Güncelleme klasöründeki `guncelleme.json` okunur (aday sırası: `V:\00 - Yasin\Claude App\Exe`, UNC `\\192.168.1.249\D\personel disk\Ajans\00 - Yasin\Claude App\Exe`, `D:\…`; Ayarlar'dan değiştirilebilir).
  - Manifest Ed25519 ile doğrulanır, dosya SHA-512 ile denetlenir.
  - Kurulum `/S --updated --force-run` ile sessiz yapılır.
- `preload.js`: `window.api` köprüsü; `--cp-platform=` argümanından platformu okur.
- `renderer/app.js`: düz JS, framework yok.
  - Durum `S`, kaydedilen workspace `WS`; `buildWS()`/`persist()` 400 ms gecikmeyle kaydeder, kapanışta `saveSync` çağrılır.
  - Bölmeler yamalanır (`paneParts`, `setSlot`, `patchMsgs`): aynı oturumdaki yazma kutusu yeniden oluşturulmaz (odak korunur). `sessions:changed` tam `render()` çağırmaz. Bölmeyi baştan kuran kod yazma.
  - Oturum başına `effort`, `control` (workspace `meta`'da); son seçimler `WS.prefs.effort/control` yalnızca yeni sohbetlere varsayılan.
  - Kalan kullanım: CLI her turda `rate_limit_event` gönderir (`unifiedWindows`: pencere → `utilization`, `resetsAt`); `onRateLimit` → `USAGE` (`WS.prefs.usage`), yazma satırındaki `data-usage` göstergesi. Başka kaynak yok (kimlik bilgisine dokunulmaz).
  - Görseller: `markdown.js` `![](yerel yol)` → `img.md-img` (cpmedia); asistan metninde adı geçen görsel dosyaları `imgsHTML`. Büyütme `lightbox`: boş yere tık kapatır, resme tık yakınlaştırır.
  - Sohbetler panosu: boş alanda sürükle-seç (`LS`, `.fx-lasso`), boş alana sağ tık `bgMenu`. Boş bölmede sohbet arama (`data-pq`).
  - "Uzaktan" akıllı klasörü: `s.remote` (panelden açılan) veya `s.bridge` (jsonl'de `bridge-session` = claude.ai'ye bağlı oturum).
  - Tema: `isDarkTheme()`/`applyTheme()`, seçim `WS.prefs.theme` (yoksa sistem). Rengi karşılaştırarak tema anlamaya çalışma.
  - Yeni `data-*` / sınıf adı eklerken mevcut adlarla çakışmadığını `grep` ile kontrol et (tıklama işleyicisi `closest('[data-…]')` sırasıyla çalışır).
  - Diyaloglar `rebuild()` ile odak ve kaydırma konumunu korur.
  - `menu()` Windows başlık çubuğunun (44 px) altında kalır.
- `renderer/markdown.js`: önce kaçışlama yapar; yalnızca `https?` bağlantılara izin verir.
- `renderer/styles.css`: tema değişkenleri `:root`'ta tanımlıdır; koyu tema Claude tonlarında. `.plat-win` için ince kaydırma çubuğu kuralları vardır.
- `renderer/fonts.css` ve `renderer/fonts/`: gömülü OFL yazı tipleri (yalnızca latin ve latin-ext). Ayarlar → Yazı tipi; seçim `WS.prefs.fonts`'ta saklanır.

Veri yerleri:
- `~/.claude/projects`: yalnızca okunur, panel buraya hiç yazmaz.
- `~/.claude-panel/`: `workspace.json(.bak)`, `index.json`, `search.db`, `settings.json` (güncelleme klasörü), `gorseller/`.

## Yayın akışı (Windows)
1. `package.json` içinde `version` değerini artır; güncelleyici yalnızca daha yüksek sürümü önerir.
2. `SURUM-NOTU.txt` dosyasını güncelle ve `PLAN.md`'ye bir bölüm ekle.
3. `npm test` çalıştır ve gerekirse selftest ile dene.
4. `npm run release:win` çalıştır. Betik exe'yi NAS'taki `Exe` klasörüne kopyalar, karşıda doğrular, imzalı `guncelleme.json`'u en son yazar ve bir önceki sürüm dışındaki exe'leri siler.
5. Kodu NAS'a aktar:
   ```bash
   N="/Volumes/192.168.1.249/personel disk/Ajans/00 - Yasin/Claude App"
   rsync -rt --delete --exclude=.DS_Store --exclude=node_modules --exclude=dist src test build scripts "$N/Kod/"
   rsync -t package.json package-lock.json PLAN.md SURUM-NOTU.txt CLAUDE.md .gitignore "$N/Kod/"
   ```
- **İmza anahtarı:** `~/.claude-panel-yayin/guncelleme-imza.pem`, yalnızca bu Mac'te. Depoya ya da NAS'a asla koyma; kaybetme ya da yeniden üretme. Açık anahtar `updater.js` içine gömülü; anahtar değişirse kurulu uygulamalar güncelleme alamaz.
- NAS'ın Mac'te bağlı olduğunu kontrol et (`/Volumes/192.168.1.249`). NAS'taki `BENİOKU.md` Windows kurulum ve güncelleme notlarını içerir.
- Kalıcı bir **dosyayı silmek** (`rm`) güvenlik kontrolüne takılabilir. Bu kontrolü atlatmaya çalışma.

## Kullanıcı kararları ve tercihleri
- **Tam yetki varsayılanı (`DEFAULT_PMODE = 'bypassPermissions'`) bilinçli bir karar.** Güvenlik raporu SEC-01 önerse de değiştirme ve bir daha sorma.
- Yeni sohbette Panel klasörü varsayılan olarak "Klasörsüz"dür.
- Varsayılanlar (kullanıcı değiştirirse `WS.prefs`'te kalır): Sohbetler kenar çubuğu açık (`side`), sıralama Ad (`sort`), yazı tipi Inter / okuma arayüzle aynı / JetBrains Mono (`fonts`, `fontsV:2`), bilgisayar+tarayıcı Kontrolü açık (`control`).
- Kullanıcı bazen bu sohbete panelin içinden de yazıyor. Bu durumda aynı klasörde ikinci bir ajan (`sdk-cli`) çalışabilir; büyük bir işten önce son `.jsonl` kayıtlarını kontrol et.
- Kimlik bilgisi ya da parola girilmez; Claude girişini kullanıcı yapar.

## Bekleyenler
- **Exe kod imzası (Authenticode):** sertifika gerekiyor. Windows SmartScreen uyarısı bu yüzden çıkıyor.
- **Bilgisayar kontrolü Windows'ta:** ofis bilgisayarına `npm install -g agent-desktop` kurulmalı (Node gerekli); Premiere'de UI Automation ağacı az gelebilir, Premiere işleri `premiere-kopru` ile.
- **Uzaktan Kontrol:** yalnızca etkileşimli CLI destekliyor; Terminal/cmd'de `claude --resume <id> --remote-control` açılır (yazma satırındaki "Uzaktan" düğmesi ve bilgi paneli). Klasör daha önce etkileşimli açılmadıysa önce "bu klasöre güveniyor musun" sorusu çıkar. claude.ai'den bağlanma uçtan uca denenmedi.
- **Gerçek Windows testi yapılmadı.** Henüz denenmeyenler:
  - güncelleyicinin NAS'ı bulması
  - `C:\Claude Panel` yansısı
  - kapanış onayı
  - Uzaktan Kontrol
- **Mac dmg:** 0.2.7 arm64 (`npm run dist`, imzasız). Mac'te güncelleme otomatik değil.
- **Raporlardan kalan gözlemler:**
  - Oturum dizini yalnızca uuid ile anahtarlanıyor; aynı kimlik iki projede olursa biri görünmez.
  - Yansı kökü ve NAS IP'si koda gömülü; ayarlara taşınabilir.
  - BUG-03 (gizli klasör) tasarım gereği: "gizli" panelden kalıcı silinmiş demek.
