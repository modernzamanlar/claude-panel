# Claude Panel — Plan

Claude Code sohbetlerini **kendi klasörlerinde gruplayan**, **yan yana birden fazla sohbet** açabilen ve Claude Code ile **senkron** çalışan minimal masaüstü uygulaması.

## 1. Çözülen sorunlar

| Sorun (Claude Code arayüzü) | Claude Panel'deki çözüm |
|---|---|
| Sol menüde her çalışma klasörü ayrı proje olarak birikiyor | Projeler otomatik etiket olur; asıl düzen kullanıcının **sanal klasörleri** |
| Klasör yapısı düzenlenemiyor | İç içe klasör, sürükle-bırak, yeniden adlandır, renk, sabitle |
| Tüm sohbetler aynı pencerede açılıyor | **Bölünmüş görünüm**: 1 / 2 / 3 sütun veya 2×2, her bölmede ayrı sohbet |
| Aynı anda iki sohbet çalıştırılamıyor | Her bölme kendi `claude` sürecini çalıştırır; hepsi paralel akar |

## 2. Senkron nasıl çalışacak

Claude Code her oturumu şu dosyaya yazar (bu makinede şu an 66 proje, 111 oturum var):

```
~/.claude/projects/<cwd-kodlanmış>/<sessionId>.jsonl
```

Her satır bir kayıt: `user`, `assistant`, `attachment`, `custom-title` (sohbet başlığı), `last-prompt` vb. Kayıtlarda `cwd` ve `timestamp` bulunur.

**Okuma (Claude → Panel)**
- Açılışta tüm `.jsonl` dosyaları taranır: başlık (`custom-title`, yoksa ilk kullanıcı mesajı), proje yolu, son etkinlik, mesaj sayısı çıkarılır.
- `chokidar` ile klasör izlenir: Claude Code CLI'da veya masaüstü uygulamasında açılan yeni sohbetler anında panelde **"Gruplanmamış"** kutusuna düşer, açık sohbetlere yeni mesajlar canlı eklenir.
- Dosyalar baştan sona değil, kaldığı yerden (byte offset) okunur → büyük oturumlarda hızlı.

**Yazma (Panel → Claude)**
- Panel mesaj gönderirken kurulu `claude` CLI'yı başsız çalıştırır:
  `claude -p --resume <sessionId> --input-format stream-json --output-format stream-json` (cwd = oturumun proje klasörü).
  Alternatif: `@anthropic-ai/claude-agent-sdk` `query({ resume, cwd })`.
- Mesajlar yine aynı `.jsonl` dosyasına yazılır → panelde yazılan sohbet Claude Code'da (`claude --resume`, masaüstü uygulaması) aynen görünür. Çift yönlü senkron budur.
- Kimlik doğrulama: kullanıcının mevcut Claude Code girişi kullanılır, panel ayrı anahtar saklamaz.

**Panel'in kendi verisi** (Claude dosyalarına asla dokunulmaz):

```
~/.claude-panel/workspace.json
{
  "folders":  [{ "id", "name", "parentId", "color", "order", "collapsed" }],
  "sessions": { "<sessionId>": { "folderId", "pinned", "alias" } },
  "layout":   { "mode": "2col", "panes": ["<sessionId>", "<sessionId>"] },
  "links":    [{ "a": "<id>", "b": "<id>", "label": "" }],
  "graphPos": { "<id>": { "x": 0, "y": 0 } }
}
```

**Çakışma:** Aynı oturum o an başka yerde (masaüstü uygulaması) çalışıyorsa — dosya başka süreç tarafından yazılıyorsa — bölme başlığında "başka yerde aktif" uyarısı çıkar; kullanıcı **izle** (salt okuma) veya **çatalla** (`--fork-session`) seçer.

## 3. Teknoloji

| Katman | Seçim | Neden |
|---|---|---|
| Kabuk | **Electron** | Node tarafı dosya izleme + süreç başlatma için doğal; Agent SDK Node'da |
| Arayüz | React + TypeScript + Vite | Hızlı geliştirme |
| Bölmeler | `react-resizable-panels` | Sürüklenebilir bölme genişlikleri |
| Durum | `zustand` | Hafif |
| Markdown / kod | `react-markdown` + `shiki` | Claude benzeri kod blokları |
| Sürükle-bırak | `@dnd-kit` | Klasör ağacı + bölmelere sohbet bırakma |
| Dosya izleme | `chokidar` | Senkron |

Süreçler: **main** (tarama, izleme, `claude` süreçleri, workspace.json) ↔ IPC ↔ **renderer** (arayüz).

## 4. Arayüz

Prototip: [`prototype/index.html`](prototype/index.html) (tarayıcıda açılabilir, etkileşimli).

- **Sol ray (kapalı menü, 56 px):** Yeni sohbet, Sohbetler panosu (`⌘B`), Ara (`⌘K`), açık bölmelerin numaraları (klasör rengi + çalışıyor noktası), altta senkron ve ayarlar.
- **Sohbetler penceresi (açık menü, tam ekran) — macOS Finder / Windows Gezgin gibi:**
  - **Kenar çubuğu:** Favoriler (Tüm Sohbetler, Son Kullanılanlar, Sabitlenenler, Yeni, Çalışanlar, Uzaktan — akıllı klasörler), açılır/kapanır **klasör ağacı** ve Çöp Kutusu.
  - **Araç çubuğu:** Geri / İleri, tıklanabilir **yol çubuğu** (Sohbetler › Müşteri Siteleri › SEO), Simge / Liste görünümü, sıralama (tür, ad, son etkinlik), arama, yeni klasör, yeni sohbet.
  - **İçerik:** klasörler **Claude turuncusu** klasör simgesi (renk etiketi noktası + öğe sayısı); **dolu klasörde** arka ve ön kapak arasından kâğıtlar görünür, boş klasör düz görünür (simgeler, kenar çubuğu, liste, yol çubuğu ve Taşı… penceresinde aynı), sohbetler belge simgesi (çalışıyor / başka yerde aktif / uzaktan / bölme numarası rozetleri). Önce klasörler, sonra sohbetler. Liste görünümünde sütunlar: Ad, Çalışma klasörü, Son etkinlik, Tür.
  - **Davranış:** tek tık seç, **çift tık klasörün içine girer** / sohbeti aktif bölmede açar, `⌘`/`⇧` ile çoklu seçim, `⌘A`, ok tuşları, `↵` aç, `⌫` veya `⌘↑` üst klasör, `⌘[` `⌘]` geri/ileri, `F2` yeniden adlandır, `⇧⌘N` yeni klasör, sağ tık menüsü.
  - **Taşıma / iç içe koyma:** klasörü veya sohbeti bir klasör simgesine, kenar çubuğundaki klasöre ya da yol çubuğundaki üst klasöre sürükle → içine taşınır (klasörler sınırsız iç içe; kendi içine taşınamaz). Boş alana bırak → bulunduğun klasöre gelir. Sohbeti bölme şeridine bırak → orada açılır. Sürükleme işaretçi (pointer) tabanlı: hayalet etiket + seçili öğe sayısı gösterir, `Esc` iptal eder.
  - **Ek özellikler:**
    - *Yaylanan klasörler:* sürüklerken bir klasörün üstünde ~1 sn bekle → klasör açılır, derine bırakabilirsin.
    - *Taşı…* penceresi: klasör ağacından hedef seç (geçersiz hedefler kapalı), oradan yeni klasör de açılabilir.
    - *Kes / yapıştır:* `⌘X` → hedef klasörde `⌘V`.
    - *Seçilenlerle yeni klasör* (`⌃⌘N` veya sağ tık): seçili sohbet ve klasörler yeni klasöre girer.
    - *Önizleme (Quick Look):* `Boşluk` → sohbetin mesajları veya klasörün içeriği; oradan bölmede aç.
    - *Çöp Kutusu:* `⌘⌫` veya sağ tık → panelden gizlenir, geri yüklenebilir; boşaltmak yalnızca panelden kaldırır, Claude'un `.jsonl` dosyaları **silinmez**.
  - Durum çubuğu: öğe sayısı, seçili sayısı, "Bölmeye bırak" şeridi.
- **GourceView (kenar çubuğunda, Favoriler altında):** tüm proje yapısını canlı bir ağ olarak gösteren görünüm (Gource tarzı, koyu zemin).
  - **Düğümler:** merkezde *Sohbetler*, çevresinde klasörler (turuncu, büyüklüğü içerik sayısına göre, kenarı etiket rengi), uçlarda sohbetler (klasör rengi). Ağaç kenarları klasör yapısıdır; kuvvet tabanlı düzen kendiliğinden yerleşir.
  - **Canlılık:** çalışan sohbet turuncu parlar ve nabız halkası atar, merkezden ona klasör yolu boyunca **ışık parçacıkları** akar, üst klasörleri de hafifçe parlar. Başka yerde aktif olanlar kehribar, Uzaktan Kontrol açık olanlar mor halkalı. Kenar çubuğunda "N canlı" sayacı.
  - **Bağlantılar:** klasör ↔ klasör, sohbet ↔ sohbet veya karışık serbest bağlantı (kesikli, akan turuncu çizgi + isteğe bağlı etiket). Kurma: *Bağlantı kur* düğmesi (`L`) → iki düğüme tıkla, ya da `⇧` basılı sürükle. Çizgiye tıkla → etiketi düzenle / kaldır (`⌫`).
  - **Etkileşim:** düğümü sürükle → yerinde sabitlenir; bir klasör düğümüne (veya merkeze) bırak → içine taşınır. Tıkla → bilgi kartı (bölmede aç, önizle, klasörü aç, yeni sohbet, bağla, bağlantı listesi). Çift tık → aç. Tekerlek yakınlaştırır, boş alanı sürüklemek kaydırır. Araçlar: Etiketler, Yalnızca canlı, Sığdır (`F`), Yeniden düzenle.
  - **Veri:** bağlantılar ve sabitlenen düğüm konumları `workspace.json` içinde (`links`, `graphPos`); canlılık, paneldeki `claude` süreçleri + `.jsonl` dosyalarının yazılma anlarından (başka yerde aktif) gelir.
- **Yeni klasör penceresi:** ad + renk, **çalışma klasörü seçici** (~/Desktop listesi, filtre, "Finder'da seç…" → Electron `dialog.showOpenDialog`), içine taşınacak sohbetlerin işaretlenmesi. Çalışma klasörü seçildiyse o klasörde açılan yeni sohbetler orada başlar (`cwd`).
- **Yeni sohbet penceresi (`⌘N`, rayda `+`, boş bölmede düğme, klasör menüsünde "Bu klasörde yeni sohbet"):** çalışma klasörü seçmek **zorunlu**; seçilmeden "Sohbeti başlat" çalışmaz ve uyarı çıkar. Liste: son kullanılan projeler + Masaüstü klasörleri, arama / yol yazma, "Klasör aç…" (Finder) ve "Yeni klasör oluştur" (diskte `mkdir`). İsteğe bağlı: panel klasörü (aktif bölmenin klasörü veya o dizine bağlı klasör önceden seçilir), model, ilk mesaj. Başlatınca `claude` süreci seçilen `cwd` ile hedef bölmede açılır.
- **Tam ekran arama (`⌘K`):** büyük arama kutusu, kapsam (Tümü / Başlıklar / Mesajlar / Dosyalar) ve klasör filtresi; sonuçlar ekranda liste: başlık, eşleşen mesaj parçası (vurgulu), klasör, proje, zaman, açık olduğu bölme. `↑↓` gez, `↵` aktif bölmede aç, `⌘1–4` / satırdaki numara o bölmede aç. Faz 1'de tüm `.jsonl` içerikleri için yerel bir arama dizini (SQLite FTS5) kurulur.
- **Üst çubuk:** pano aç/kapa, düzen seçici (1 / 2 / 3 / 2×2), açık/çalışan sohbet sayısı, tema, bilgi paneli aç/kapa (`⌘I`).
- **Bölme:** başlık (sohbet adı, klasör, proje yolu, durum: çalışıyor/boşta/başka yerde aktif), mesaj akışı (kullanıcı balonu, asistan metni, katlanır araç çağrıları), yazma kutusu (ek, izin modu, model, gönder/durdur).
- **Sağ bilgi paneli (aktif bölmenin oturumu):**

| Bölüm | İçerik | Veri kaynağı |
|---|---|---|
| Ortam | Bu bilgisayar, proje klasörü, panel klasörü | `.jsonl` içindeki `cwd` + workspace.json |
| Uzaktan Kontrol | Oturum başına anahtar; açılınca QR kod + `claude.ai/code` bağlantısı, bağlı cihaz durumu; bölme başlığında "Uzaktan" rozeti | Claude Code'un Remote Control özelliği (oturum içinde `/remote-control`); bağlantı adresi ve cihaz durumu sürecin çıktısından okunur. Tam CLI arayüzü Faz 3'te doğrulanacak |
| Bağlam | Kullanım çubuğu ve kalem kalem dağılım (mesajlar, MCP araçları, sistem istemi, skill'ler, hafıza, sıkıştırma payı, boş alan) | Toplam: son asistan kaydındaki `usage` (input + cache_read + cache_creation). Dağılım: oturumda `/context` komutunun çıktısı |
| Bağlayıcılar | Katlanır; kapalıyken özet ("1 yeniden bağlanmalı"), açıkken MCP sunucuları ve durumları | `stream-json` başlangıç (`system/init`) mesajındaki `mcp_servers` + `~/.claude.json` |
| Çıktılar | Oturumda oluşturulan/değiştirilen dosyalar | `.jsonl` içindeki `Write` / `Edit` araç çağrıları |

## 5. Yol haritası

1. **Faz 0 — Tasarım** *(şimdi)*: plan + etkileşimli prototip.
2. **Faz 1 — Salt okuma senkron** ✅ *(tamamlandı)*: Electron iskeleti, `.jsonl` tarayıcı, klasör yönetimi + workspace.json, sohbetleri bölmelerde görüntüleme, canlı izleme, GourceView'de otomatik proje düğümleri.
3. **Faz 2 — Sohbet etme** ✅ *(tamamlandı)*: `claude` sürecini başlatma, stream-json akışı, birden fazla bölmede paralel çalışma, durdurma, yeni sohbet, çatallama, model/izin modu seçimi.
4. **Faz 3 — Claude Code özellikleri** ✅ *(tamamlandı)*: araç izin onayları, soru ve plan onayı, izin modu / model seçimi, yeni sohbeti seçilen klasörde başlatma, dosya/görsel ekleme, çakışma algılama, Uzaktan Kontrol, gerçek bağlayıcı durumu.
5. **Faz 4 — Cila** ✅ *(tamamlandı)*: genel arama (tüm sohbet içerikleri), Türkçe menü çubuğu ve kısayollar, bölme bitince bildirim, koyu tema, uygulama simgesi, `.dmg` paketleme.

## 6. Açık sorular

- Bir sohbet birden fazla klasörde olabilsin mi (etiket gibi), yoksa tek klasör mü? *(Varsayılan: tek klasör + proje etiketi.)*
- Claude masaüstü uygulamasındaki kendi oturum listesi (`claude-code-sessions`) de okunsun mu, yoksa yalnızca `~/.claude/projects` yeterli mi?

## 7. Durum ve çalıştırma (Faz 1)

```
npm install      # ilk kez
npm start        # uygulamayı aç
npm test         # ayrıştırıcı testleri
```

**Dosyalar**
- `src/main/main.js` — Electron penceresi, IPC, `~/.claude/projects` canlı izleme (fs.watch + 20 sn'de bir hafif tarama)
- `src/main/sessions.js` — oturum özeti (dosyanın yalnızca başı + sonu okunur, önbellek `~/.claude-panel/index.json`), mesaj ayrıştırıcı (son 60 tur)
- `src/main/workspace.js` — `~/.claude-panel/workspace.json` (atomik yazım; bozuksa yedeklenir)
- `src/preload.js` — arayüzün tek kapısı (`window.api`)
- `src/renderer/` — arayüz (prototipten taşındı: `index.html`, `styles.css`, `app.js`, `markdown.js`)
- `prototype/index.html` — örnek verili tasarım prototipi (referans)

**Ölçümler (bu makinede):** 111 oturum / 897 MB ilk tarama ~0,6 sn, önbellekle ~10 ms; 64 MB'lık oturum ~0,3 sn'de açılıyor.

**Faz 1'de bilinçli olarak olmayanlar**
- Mesaj gönderme, yeni sohbet başlatma, çatallama → Faz 2 (yazma kutusu şimdilik salt okuma).
- Uzaktan Kontrol anahtarı ve MCP bağlayıcı durumları → Faz 3 (bağlayıcılar şimdilik yalnızca yapılandırma dosyalarından listeleniyor).
- Arama yalnızca başlık/proje ve açılmış sohbetlerin içeriğinde → tüm içerik araması (SQLite FTS5) Faz 4.
- Bağlam dağılımı tahmini: toplam gerçek (son asistan kaydındaki `usage`), kalem dağılımı yaklaşık.
- Arayüz şimdilik React yerine prototipteki düz JS ile; büyüdükçe React'e geçiş değerlendirilecek.

## 8. Durum (Faz 2)

**Nasıl çalışıyor:** Her gönderimde `src/main/runner.js` kurulu `claude` komutunu başsız başlatır:
`claude -p --input-format stream-json --output-format stream-json --verbose --include-partial-messages --resume <id> [--fork-session] [--model] [--permission-mode]`
(yeni sohbette `--resume` yerine önceden üretilen `--session-id <uuid>`, çalışma klasörü `cwd`). Mesaj stdin'den verilir, süreç tur bitince çıkar. Claude kendi `.jsonl` dosyasına yazdığı için Claude uygulaması/CLI ile senkron kalır; tur bitince bölme bu dosyadan yeniden yüklenir.

- **Paralel:** her bölme kendi sürecini çalıştırır; biri diğerini beklemez. Üst çubukta "N çalışıyor", rayda turuncu nokta, GourceView'de parlama.
- **Canlı yazım:** `stream_event` metin parçaları anında görünür; araç çağrıları çalışırken dönen simgeyle, sonuçlarıyla birlikte gelir.
- **Durdurma:** kare düğme veya `Esc` → SIGINT (3 sn sonra SIGTERM).
- **Model / izin modu:** yazma kutusundaki düğmelerden; izin modu varsayılan olarak oturumun son kullandığı mod.
- **Başka yerde aktif oturum:** gönderirken "Çatallayarak gönder" (`--fork-session`, yeni oturum açılır, bölme ona geçer) veya "Yine de aynı oturuma gönder" sorulur.
- **Yeni sohbet:** çalışma klasörü seçilir → bölmede taslak açılır → ilk mesajla Claude o klasörde başlar.
- **Bitti bildirimi:** süre ve maliyetle bildirim; pencere arka plandaysa macOS bildirimi.
- **Giriş kontrolü:** `claude auth status`; giriş yoksa bölmelerde uyarı + **Giriş yap** (Terminal'de `claude auth login` açar, giriş tarayıcıda yapılır; panel 3 sn'de bir kontrol eder).
- **Ortam:** Finder'dan açılınca PATH giriş kabuğundan alınır; Claude uygulamasından miras kalan `CLAUDE_CODE_*` değişkenleri alt sürece geçirilmez.

**Testler:** `npm test` → ayrıştırıcı + çalıştırıcı (sahte `claude` ile: sürdürme, yeni oturum, çatallama, durdurma, hatalı klasör). Electron uçtan uca senaryo da sahte `claude` ile denendi (iki bölme paralel, yeni sohbet, çatal).

**Bilinen sınırlar / sonraki faz**
- Bu makinede bağımsız `claude` komutunun girişi sona ermiş durumda (`loggedIn: false`); panelden gerçek mesaj göndermek için bir kez **Giriş yap** gerekiyor. Gerçek hesapla uçtan uca deneme bu yüzden yapılamadı.
- Araç izin onayları (izin isteyen komutları panelden onaylama) Faz 3'te `--permission-prompts host` ile gelecek; şimdilik izin modu ne izin veriyorsa o çalışır, gerisi reddedilir.
- Dosya/görsel ekleme (ataç düğmesi) Faz 3.

## 9. Durum (Faz 3)

**İzin onayları:** `claude` artık `--permission-prompt-tool stdio` ile başlatılır. İzin gerektiren bir araçta CLI `control_request {subtype:'can_use_tool'}` gönderir; bölmede yazma kutusunun üstünde **onay kartı** çıkar:
- *Komut / dosya:* Bash komutu, Edit için kırmızı-yeşil fark, Write için dosya başı, WebFetch için adres.
- Düğmeler: **İzin ver** (`⌘↵`), **Bu oturumda hep izin ver** (CLI'nin önerdiği kural `destination:'session'` ile), **Reddet** (isteğe bağlı not Claude'a iletilir).
- *Soru (AskUserQuestion):* seçenek düğmeleri / serbest cevap → `updatedInput.answers`.
- *Plan (ExitPlanMode):* plan Markdown olarak gösterilir → onayla / reddet.
- Birden fazla istek sıraya girer ("+N istek"); bölme başlığında, rayda ve GourceView'de "Onay bekliyor" (sarı); pencere arka plandaysa macOS bildirimi.
- Durdurma: bekleyen istekler `interrupt:true` ile reddedilir, ardından CLI'ye `interrupt` isteği; yanıt yoksa sinyaller.
- Gerçek CLI (2.1.287) ile doğrulandı: istek → onay → komut çalıştı → akış → sonuç.

**Ekler:** ataç düğmesi (dosya seçici), yazma kutusuna sürükle-bırak, panodan görsel yapıştırma. Görseller (≤5 MB png/jpg/gif/webp) mesaja görsel bloğu olarak, diğer dosyalar yol olarak ("Ekli dosyalar:") eklenir; küçük önizlemeli etiketler, tek tek kaldırılabilir.

**Uzaktan Kontrol:** CLI bu özelliği yalnızca etkileşimli oturumda sunuyor (`--remote-control`), bu yüzden anahtar oturumu Terminal'de `claude --resume <id> --remote-control "<ad>"` ile açar; bağlantı adresi/QR Terminal'de görünür. *(Komut satırı yardımına göre kuruldu; telefondan bağlanma uçtan uca denenmedi.)*

**Bağlayıcılar:** çalışma sırasında `init` olayındaki `mcp_servers` durumları; ayrıca "Durumu şimdi kontrol et" → `claude mcp list` (proje klasöründe) → bağlı / kimlik doğrula / hata. Kapalıyken özet: "N yeniden bağlanmalı".

**Testler:** `npm test` → 17 test (ayrıştırıcı, çalıştırıcı, izin ver / reddet / hep izin ver / onay beklerken durdurma, ekler, mcp list). Electron içinde sahte `claude` ile soru kartı → cevap → izin kartı → onay → bitiş, ekler ve bağlayıcı kontrolü denendi.

## 10. Durum (Faz 4)

**Tüm içerikte arama (`⌘K`):** `src/main/search.js` her oturumdan okunabilir metni (kullanıcı/asistan mesajları, başlık, araç komut/yolları; araç çıktıları ve görseller hariç) mesaj başına bir satır olarak **SQLite FTS5** dizinine (`~/.claude-panel/search.db`, Electron'un yerleşik `node:sqlite`'ı, ek kütüphane yok) yazar; metin belleğe yüklenmez. Bu makinede 113 oturum → 28 bin satır, 20 MB veritabanı; ilk dizinleme arka planda ~7 sn, sonraki açılışlarda değişiklik kontrolü ~1 ms (yalnızca değişen oturumlar yeniden işlenir). Sorgu 0,1–9 ms. Türkçe karakter duyarsız (dizinlenen sütun `norm()` ile sadeleştirilir: ş=s, ı=i, İ=i…), her kelime önek olarak aranır, çok kelimede hepsi oturumda geçmeli (sıra/mesaj fark etmez), sonuçlar başlık eşleşmesi + isabet sayısına göre sıralanır, alıntıda tüm kelimeler vurgulanır, "N eşleşme" rozeti. Dizin hazırlanırken başlıkta ilerleme görünür. *(İlk sürüm metni `~/.claude-panel/text/` altında tutup bellekte arıyordu; FTS5'e geçişte bu önbellek otomatik kaldırılır.)*

**Menü çubuğu (Türkçe):** Claude Panel · Dosya · Düzen · Görünüm · Bölme · Pencere · Yardım. Tüm komutların kısayolu var; **⌘/** kısayol listesini açar. Öne çıkanlar: ⌘N yeni sohbet, ⇧⌘N yeni klasör, ⌘K ara, ⌘B sohbetler, ⌘G GourceView, ⌘I bilgi paneli, ⌘R senkronla, ⌘1–4 bölme, ⇧⌘[ / ⇧⌘] önceki/sonraki bölme, ⌥⌘1–4 düzen, ⌥⌘W bölmeyi kapat, ⇧⌘L tema. ⌘A metin alanında metni, Sohbetler penceresinde öğeleri seçer.

**Paket:** `npm run dist` → `dist/Claude Panel-0.1.0-arm64.dmg` (Apple Silicon). Simge `build/make-icon.js` ile üretilir (`npm run icon`, sonra iconutil). Uygulama imzasız: ilk açılışta macOS uyarı verir → Finder'da uygulamaya **sağ tık → Aç** (bir kez).

**Testler:** `npm test` → 21 test (ayrıştırıcı, çalıştırıcı/izinler, arama + FTS kalıcılık/artan güncelleme/Türkçe). Paketlenmiş `.app` kendi kendini test etti: 113 oturum, içerik araması ("getirilemedi" → 8 sohbet, vurgulu), kısayol penceresi, düzen/bölme komutları, hata yok.

## 11. Windows sürümü

- **Kurulum dosyası:** `npm run dist:win` → `dist/Claude Panel Setup 0.1.0.exe` (x64, NSIS, Türkçe kurulum, klasör seçilebilir, masaüstü + Başlat menüsü kısayolu). İmzasız; ilk açılışta SmartScreen "Ek bilgi → Yine de çalıştır" ister. Mac'ten derlenir (Wine gerekmez). `npm run dist:all` ikisini birden üretir.
- **`claude` bulma:** PATH + `%USERPROFILE%\.local\bin`, `%APPDATA%\npm` içinde `claude.exe`, yoksa `claude.cmd`. npm betiği (`claude.cmd`) doğrudan başlatılamadığı için betiğin işaret ettiği `cli.js` `node.exe` ile (veya paketteki `.exe`) doğrudan çalıştırılır; bulunamazsa son çare `cmd` kabuğu.
- **Durdurma:** Windows'ta sinyal olmadığından önce CLI'ye kesme isteği, sonra `taskkill /T` (süreç ağacı), en son `taskkill /T /F`.
- **Giriş / Uzaktan Kontrol:** Terminal `.command` yerine `%TEMP%` içinde `.cmd` dosyası bir komut penceresinde açılır (`chcp 65001`, sonda `pause`).
- **Pencere:** başlık çubuğu gizli, pencere düğmeleri (— □ ×) üst çubuğun sağına bindirilir ve temaya göre renklenir; trafik ışığı boşluğu gizlenir; menü çubuğu görünmez ama kısayolları çalışır (Çık: Alt+F4).
- **Kısayollar:** arayüzde ⌘ yerine Ctrl (⌃⌘N → Ctrl+Alt+N); ekrandaki tüm ⌘/⇧/⌥ etiketleri otomatik Ctrl/Shift/Alt'a çevrilir. Yollar hem `/` hem `\` ile ayrıştırılır.
- **Test:** `CLAUDE_PANEL_UI_PLATFORM=win32` ile arayüz Mac'te Windows kipinde açılabilir (kısayol ve etiketler bu şekilde doğrulandı). Gerçek bir Windows makinesinde henüz denenmedi.

## 12. Sohbette video, tam yetki, klasör kolaylıkları

- **Video / ses oynatıcı:** Mesajlarda, araç komut/çıktılarında ve ekli dosya listesinde geçen video (`mp4 mov m4v webm mkv ogv`) ve ses (`mp3 wav m4a aac ogg flac opus`) yolları ile `https://…mp4` adresleri bulunur; mesajın altında oynatıcı çıkar (süre · çözünürlük, "oynatıcıda aç", "klasörde göster"). Göreli yollar oturumun klasörüne göre çözülür. Yerel dosyalar `cpmedia://` protokolüyle Range (206) destekli sunulur → ileri/geri sarma çalışır; protokol yalnızca medya uzantılarını verir. Olmayan/oynatılamayan dosyalar hiç görünmez. Oynatıcı öğeleri önbellekte tutulup her yeniden çizimde taşındığı için akış sırasında oynatma kesilmez. Mesaj başına en fazla 6 oynatıcı.
- **Tam yetki varsayılan:** her oturum `--permission-mode bypassPermissions` ile çalışır (gerçek CLI ile doğrulandı: izin sorulmadan Bash çalıştı). Bölmedeki kalkan menüsünden oturum bazında değiştirilebilir.
- **Sohbetler penceresi:** sol kenar çubuğu (Favoriler/Klasörler) kapalı açılır; üst çubuktaki kenar çubuğu düğmesiyle açılıp kapanır.
- **Sürükle → Yeni klasör:** bir sohbet/klasör sürüklenirken sağ altta "Yeni klasöre taşı" alanı çıkar; bırakınca bulunulan yerde "Yeni klasör" oluşur, öğeler içine taşınır ve ad kutusu açılır (Enter ile kaydet).
- **Yeni klasör penceresi:** "İçine taşınacak sohbetler" listesinde arama (Türkçe karakter duyarsız, birden fazla kelime).

## 13. Windows görünümü, yeni sohbet adı, odak düzeltmeleri

- **Kaydırma çubukları (Windows/Linux):** sistemin oklu, kalın çubuğu yerine temaya uygun ince, yuvarlak, oksuz çubuk (`.plat-win ::-webkit-scrollbar`). Renkler `--sb / --sb-h / --sb-a` (açık/koyu tema), üzerine gelince kalınlaşır, sürüklerken vurgu rengini alır. macOS'un kendi kaybolan çubuklarına dokunulmaz.
- **Sohbet menüsünde çok klasör:** "Klasöre taşı" listesi kendi içinde kayar (en çok ~264 px), 8'den fazla klasörde "Klasör ara…" kutusu çıkar (Enter → ilk eşleşen); geçerli klasör görünür kaydırılır. Menü pencereden taşamaz (`max-height`), Sil ve diğer düğmeler hep erişilebilir.
- **Yeni sohbet:** "Sohbet adı" alanı (boşsa ilk mesajdan/klasörden otomatik ad); ad, panel takma adı olarak saklanır, Claude'un ürettiği başlık onu ezmez. "Proje klasörü" seçimi (son kullanılanlar, Masaüstü, yol yazma, Gözat…); panel klasörü seçilince o klasörün proje klasörü yoksa otomatik dolar, farklıysa "Bunu kullan" önerisi çıkar. Açılışta odak ad alanında; Enter sonraki alana geçer, Ctrl/⌘+Enter başlatır.
- **Adlandırma odağı:** Sohbet dosyaları değiştikçe (canlı sohbet yazarken saniyede birkaç kez) pano yeniden çiziliyordu; satır içi ad kutusu baştan oluşturulduğu için yazılan metin sıfırlanıyor ve odak kayıyordu. Artık yeniden çizimde metin, imleç ve odak korunur; yeniden çizimden doğan `focusout` adlandırmayı bitirmez. Yeni klasör / yeni sohbet diyaloglarında renk, klasör veya sohbet seçince odak ad alanına döner, liste kaydırmaları korunur; Enter diyalogun her yerinden "Oluştur" yapar (arama kutuları hariç).

## 14. Diskte yapı kopyası (C:\Claude Panel) ve otomatik güncelleme

- **Yapı kopyası** (`src/main/mirror.js`): Windows'ta paneldeki klasörler `C:\Claude Panel` altında aynı hiyerarşiyle gerçek dizinler, sohbetler `<başlık>.sohbet.json` (oturum kimliği, proje klasörü, kayıt dosyası) olarak tutulur; Çöp Kutusundakiler `Çöp Kutusu\` altındadır. Her kayıttan ~0,4 sn sonra yansır; dizinler yerinde yeniden adlandırılır/taşınır (yeniden oluşturulmaz), ad takasları geçici adla çözülür, Windows'ta geçersiz adlar temizlenir, aynı adlar "(2)" alır. Yalnızca panelin oluşturduğu öğelere dokunulur: kullanıcının bu dizinlere koyduğu dosyalar silinmez, klasör kaldırılırsa `Kurtarılan dosyalar\` altına taşınır. Oturum listesi boş gelirse hiçbir sohbet dosyası silinmez. Başarısız işlem (dizin açık vb.) öğeyi yerinde bırakır, yapı dosyası gerçek durumu yazar, birkaç saniye sonra yeniden denenir. Yön panel → disk (diskteki elle değişiklikler bir sonraki eşitlemede panele göre düzeltilir).
- **Veri güvenliği** (`workspace.js`): atomik + fsync'li yazım, dakikada bir `workspace.json.bak`, kökteki gizli `.claude-panel-yapi.json` tüm yapının kopyası. Açılışta asıl dosya yoksa/bozuksa sırayla yedek → yapı kopyasından geri yüklenir (bozuk dosya kenara alınır). Pencere kapanırken bekleyen kayıt eşzamanlı yazılır; listede o an olmayan oturumların klasör/ad bilgisi silinmez.
- **Otomatik güncelleme** (`src/main/updater.js`, yalnızca Windows): güncelleme klasöründeki `guncelleme.json` (sürüm, dosya, boyut, SHA-512, not) açılıştan 15 sn sonra ve 30 dakikada bir denetlenir; yeni sürüm arka planda `%TEMP%`'e kopyalanıp doğrulanır, üst çubukta "Sürüm X hazır · Yeniden başlat" çıkar; tıklanınca kayıtlar yazılır, kurulum sessiz (`/S --updated --force-run`) başlar ve uygulama yeniden açılır. Varsayılan klasörler: `\\192.168.1.249\D\personel disk\Ajans\00 - Yasin\Claude App\Exe`, `D:\personel disk\…\Exe`; Ayarlar (sol alt) → "Güncelleme klasörü…" ile değiştirilebilir.
- **Yayınlama:** `npm run release:win` → exe üretir, NAS'taki `Exe` klasörüne kopyalar, karşıda doğrular ve en son `guncelleme.json`'u yazar (yarım dosya hiç yayınlanmaz); bir önceki sürüm dışındaki eski exe'leri siler. Sürüm notu: `--notes "…"` veya `SURUM-NOTU.txt`.
- **Ayarlar menüsü** (sol alttaki kaydırıcı simgesi): sürüm, güncelleme durumu, denetle, güncelleme klasörü, diskteki kopyayı aç, kısayollar.

## 15. Güvenlik denetimi düzeltmeleri (0.2.1)

- **SEC-01 (tam yetki varsayılanı):** Kabul edilen risk — kullanıcı 2026-11-05'te `bypassPermissions` varsayılanının kalmasını açıkça onayladı; değiştirilmeyecek. Ana süreçte izin modu (`default acceptEdits bypassPermissions plan auto dontAsk manual`), model (`opus|sonnet|haiku|claude-…`) ve oturum kimliği (UUID) izin listesiyle doğrulanır; `cwd` gerçek bir klasör olmalıdır.
- **SEC-02/06:** Uzaktan Kontrol ve giriş betikleri her seferinde `mkdtemp` ile rastgele, yalnızca kullanıcıya açık bir klasörde ve `wx` bayrağıyla yazılır; 10 dk sonra silinir. Başlık yalnızca harf, rakam ve `. _ - ( ) ·` içerebilir; satır sonu ve kabuk karakterleri atılır. Oturum kimliği UUID olmalıdır. Windows'ta `%`, `"` vb. içeren klasör ya da yol, değiştirilmeden betiğe gömülmek yerine reddedilir.
- **SEC-03:** Tüm `ipcMain.handle/on` çağrıları yalnızca uygulamanın kendi sayfasından ve ana pencereden kabul edilir (`senderFrame.url` + `sender` denetimi). `shell:reveal` klasörleri açar. Dosyalarda yalnızca belge/görsel/medya türleri varsayılan uygulamada açılır; exe, cmd, js, lnk, py vb. çalıştırılmaz, klasöründe gösterilir.
- **SEC-04:** `cmd.exe` yedek yolunda `" % ! ^ & | < >` ve satır sonu içeren argümanlar reddedilir; ters bölüyle kaçışlama kaldırıldı.
- **SEC-05:** Mesajlardaki `https://` medya adresleri kendiliğinden yüklenmez. "Uzak medya · alan adı — yüklemek için tıkla" kartı çıkar; tıklanana kadar o adrese istek gitmez.
- **Geliştirici araçları:** Paketlenmiş sürümde kapalıdır (menü öğesi ve `devTools: false`).
- **Güncelleme imzası (denetimden sonra eklenen güncelleyici için):** `guncelleme.json` Ed25519 ile imzalanır. Özel anahtar yalnızca yayın yapan Mac'tedir (`~/.claude-panel-yayin`, depoda ve NAS'ta yok); açık anahtar uygulamaya gömülüdür. İmzasız, başka anahtarla imzalanmış ya da dosya adında yol içeren güncelleme reddedilir. Kurulumdan hemen önce SHA-512 yeniden doğrulanır.
- **Bekleyenler:** Electron 45.2.3 dün yayınlandı; yeni sürümlere karşı temkin gereği birkaç gün sonra alınacak. Exe kod imzası (Authenticode) için sertifika gerekiyor.

## 16. Arayüz/mantık taraması düzeltmeleri (0.2.2)

- **BUG-01:** Panelin kendi turu bittiğinde `ownAt` kaydedilir; dosyanın son yazımı bundan en fazla 15 sn sonraysa oturum "başka yerde yazılıyor" sayılmaz.
- **BUG-02:** Oturum yüklenirken gönderilen mesaj ve canlı yanıt (`local`) korunur; yükleme bitince diskten gelenlerin sonuna eklenir.
- **BUG-05:** Gönderim başlatılamazsa metin ve ekler yazma kutusuna geri konur, gönderilmemiş mesaj listeden çıkarılır.
- **BUG-09:** Çatal sohbette "(çatal)" eki takma ad olarak saklanır, senkronda kaybolmaz.
- **BUG-10/11/12:** Yapıştırmada yalnızca PNG, JPEG, GIF ve WebP kabul edilir, diğerlerinde uyarı çıkar. 10 ek sınırı aşılınca kaç dosyanın düştüğü bildirilir. İzin önizlemesi önce kesilir, sonra kaçışlanır.
- **BUG-03:** Tasarım gereği. Panelde "gizli", Çöp Kutusu boşaltılarak ya da "Panelden kaldır" ile kalıcı olarak kaldırılmış demektir; geri getirme yolu yoktur. Diskte kaldırma gibi işlenir (boşsa silinir, kullanıcı dosyası varsa kurtarılır).
- **BUG-04:** Diskte aynı adlı bir dizin varsa yalnızca boşsa ya da yalnızca panelin dosyalarını içeriyorsa sahiplenilir; kullanıcı dosyası olan dizine dokunulmaz, "(2)" adı seçilir.
- **BUG-06:** `custom-title` kuyrukta yoksa dosyanın başında da aranır.
- **BUG-07/08:** Bir güncelleme "hazır" olsa da denetim sürer; daha yeni bir sürüm çıkarsa o indirilir. Manifestte sürüm biçimi (x.y.z), pozitif tam sayı boyut ve yalnızca `.exe` dosya adı zorunludur (imza ve SHA-512 zaten zorunlu).
- **BUG-13:** `tilde()` büyük/küçük harfe duyarsız çalışır ve ayraç denetler (`C:\Users\Ali2` artık `~2` olmaz).
- **Gözlemler:** `SessionIndex.refresh` sıraya alındı (yarış yok). Çalışan bir tur varken pencereyi ya da uygulamayı kapatmadan önce onay sorulur.
- **Açılır liste kontrastı:** `color-scheme` temaya bağlandı ve seçenekler tema renklerini kullanıyor; Windows'ta koyu temada açılan liste artık koyu zemine açık yazıyla çiziliyor.

## 17. Yazı tipi seçimi (0.2.3)

- **Ayarlar (sol alt) → Yazı tipi…** üç ayrı seçim sunar:
  - **Arayüz** (`--sans`): Sistem, Inter, IBM Plex Sans, Manrope, Nunito Sans.
  - **Okuma** (`--serif`, Claude'un yanıtları ve başlıklar): Sistem serif, Source Serif 4, Literata, Lora, Arayüzle aynı.
  - **Kod** (`--mono`): Sistem, JetBrains Mono, IBM Plex Mono, Fira Code.
- Her seçenek kendi yazı tipiyle örnek gösterir. Seçim hemen uygulanır ve workspace'te `prefs.fonts` olarak saklanır; "Varsayılana dön" ile sıfırlanır.
- Yazı tipleri `src/renderer/fonts/` altına gömülüdür (yalnızca latin ve latin-ext woff2 dosyaları, ~900 KB, `@fontsource` 5.3.x'ten alındı). `fonts.css` dosyasında `@font-face` tanımları, `fonts/LICENSES.txt` dosyasında lisanslar (SIL OFL 1.1) bulunur. İnternet gerekmez ve CSP `default-src 'self'` ile uyumludur.

## 18. Claude renkleri, görseller, klasörsüz varsayılan (0.2.4–0.2.5)

- **Koyu tema:** Claude uygulamasının nötr koyu tonlarına geçildi (`--bg #1f1f1e`, `--side #1a1a19`, `--panel #262625`, metin `#f3f2ee`, vurgu `#d97757` aynı). Pencere düğmesi bindirmesi ve açılış zemini de bu renklere eşlendi. Claude gibi düz (sans) yanıt yazısı istenirse: Ayarlar → Yazı tipi → Okuma → "Arayüzle aynı".
- **Görseller:** Araç sonuçlarındaki ve kullanıcı mesajlarındaki görseller (base64 bloklar ve `[Image: source: <yol>]` başvuruları) gösterilir. Kayıtlı oturumlarda ana süreç bunları `~/.claude-panel/gorseller/` klasörüne içerik özetine göre adlandırarak bir kez yazar ve 30 gün kullanılmayanları açılışta siler. Arayüz görselleri `cpmedia://` ile okur (png, jpg, gif, webp eklendi; CSP `img-src` buna izin verir). Canlı turda görseller akıştan base64 olarak gelir. Araç satırının sağında küçük resim çıkar; tıklayınca tam ekran büyük görünüm açılır (oklarla geçiş, Esc ile kapatma).
- **Yeni sohbet:** Panel klasörü varsayılan olarak "Klasörsüz"dür; yalnızca "Bu klasörde yeni sohbet" komutuyla açılınca o klasör seçili gelir.
- **Güncelleme yolu:** `V:\00 - Yasin\Claude App\Exe` ilk aday yapıldı (ofis Windows bilgisayarında NAS'taki Ajans klasörü V: sürücüsüne bağlı).

## 19. Modül modül kalite taraması, yeni simge (0.2.6)

Her ana süreç modülü ayrı ayrı ele alındı: tam satır/dal kapsamı, mutasyon testi (`scripts/mutate.js`) ve güvenlik incelemesi. Testler 42'den 320'nin üzerine çıktı.

- **Simge:** Uygulama simgesi köpek görseli oldu. Kaynak `build/icon-kaynak.png`; `npm run icon` kareyi bulur, kenarı kırpar, 1024 içinde 824'lük yuvarlak kareye yerleştirir (`build/icon.png`). `icon.icns` bu dosyadan `iconutil` ile üretilir.
- **Güncelleyici (`updater.js`):**
  - İndirilmiş güncelleme "hazır" kalmıyordu: her 30 dakikalık denetim indirmeyi yeniden yapıyor, klasöre ulaşılamazsa hazır durum düşüyordu. Artık hazır sürüm korunur; daha yenisi bozuk çıkarsa önceki hazır sürüme dönülür.
  - Kurulum programı başlatılamazsa (izin, virüs koruması) ana süreç çökebiliyordu. Artık hata gösterilir; uygulama yalnızca kurulum gerçekten başlayınca kapanır. Kapanış hazırlığı (kayıt, kapanış onayını atlama) da ancak o zaman yapılır, başarısız denemeden sonra çalışan tur uyarısı devrede kalır.
  - Hazır dosya silinmişse sessizce başarısız oluyordu; artık hata gösterilir ve sonraki denetimde yeniden indirilir.
- **Arama (`search.js`):** Üst üste gelen `sync()` çağrılarında ikinci çağıran, kendi oturumları dizinlenmeden yanıt alıyordu; artık ortak bir ardıl koşu bekleniyor. Yalnızca noktalama içeren sözcük (`->`, `...`) tüm sonuçları siliyordu; artık atlanır.
- **Markdown (`markdown.js`):** Bağlantı adresi vurgudan önce yer tutucuya alınır (`*`/`**` artık `href` içine giremez); `'` de kaçışlanır; metindeki `\0`/`\1` karakterleri sahte yer tutucu üretemez.
- **Runner (`runner.js`):** Mesaj süreç başlamadan kurulur ve doğrulanır; bozuk görsel eki artık arkada asılı kalan bir claude süreci bırakmaz (tür png/jpeg/gif/webp, veri geçerli base64 olmalı). `~kullanici` gibi yollar artık ev klasörüne genişletilmez. Akıştaki `null` satırı ana süreci düşürmez. Durdurma zamanlayıcıları süreç bitince temizlenir.
- **Oturumlar (`sessions.js`):** Büyük dosyada kuyruk tam satır başından kesilince o satır atılıyordu. `null` satırları atlanır. `[Image: source:]` başvuruları yalnızca mutlak yollar için kabul edilir. `tilde()` küçük harfe çevirince uzunluğu değişen harflerde (ör. "İ") kaymaz. Silinmiş oturum değişiklik listesine iki kez girmez.
- **Yansı (`mirror.js`, `C:\Claude Panel`):**
  - Yalnızca büyük/küçük harfle (Türkçe I/ı/İ/i dahil) ayrılan sohbet ya da klasör adları Windows'ta birbirinin üzerine yazıyordu.
  - Emoji içeren uzun başlığın dosyası her geçişte silinip yeniden yazılıyordu (kesim emojiyi ortadan bölüyordu).
  - `aux.v2` gibi uzantılı ayrılmış Windows adları güvenli ada çevrilir.
  - Bir adım başarısız olunca (dizin Gezgin'de açık vb.) klasör yanlışlıkla "Kurtarılan dosyalar"a taşınabiliyordu; artık eski yerinde kalır ve sonra yeniden denenir.
  - Yapı dosyasındaki kök dışı (`..`) ya da bozuk yollar yok sayılır.
  - Yazılamayıp eski yerinde kalan sohbet dosyasının adı ayrılır; aynı başlıklı başka sohbet onun üzerine yazmaz.
- **Testler:** `npm test` artık `scripts/test.js` ile koşar: testler kendi geçici kökünde çalışır ve bitince o kök silinir (testlerin bıraktığı geçici klasörler bir mutasyon koşusunda diski doldurmuştu). `scripts/mutate.js` de her koşunun geçici klasörünü siler.

## 20. Akıcı sohbet, düşünme seviyesi, bilgisayar kontrolü, tema düğmesi (0.2.7)

- **Odak kayması düzeldi:** `~/.claude/projects` altında herhangi bir oturum yazıldıkça (saniyede birkaç kez) arayüz bütün bölmeleri yazma kutusuyla birlikte yeniden kuruyordu; odak, imleç ve kaydırma konumu kayboluyordu. Artık bölmeler yamalanır (`renderPanes` → `paneParts` + `setSlot`): aynı oturumu gösteren bölmede yazma kutusu hiç yeniden oluşturulmaz, yalnızca değişen başlık / izin kartı / ekler / düğme satırı / mesajlar güncellenir. Odaklı bir alan (izin notu, soru cevabı) yeniden çizilirse odak, imleç ve yazılan metin geri konur (`keepFocus`). Yazılan taslak oturumda saklanır (`inputDraft`). Menüden (izin modu, model, düşünme) seçim yapınca odak yazma kutusuna döner.
- **Uzun sohbet:** Mesajlar tek tek sarmalanır (`.mw`); `patchMsgs` yalnızca yeni ya da değişen mesajı DOM'a yazar, aynı içerikli düğümleri yeniden kullanır. Ekran dışındaki mesajlar `content-visibility:auto` ile çizilmez. Markdown çevirisi önbelleklenir; görsel küçük resim kimlikleri içerikten türetilir. Ölçüm (40 MB'lık oturum açıkken, senkron başına): 144 ms → 9 ms.
- **Artımlı yükleme:** Ana süreçte `SessionLoader` açık oturum dosyası büyüdükçe yalnızca yeni satırları ayrıştırır (yarım son satır, kısalan ya da değiştirilen dosya, en çok 8 dosya önbelleği). 40 MB'lık oturumda değişiklik sonrası yükleme 193 ms → 1 ms. Başka yerde yazılan açık oturumun yeniden yüklemeleri birleştirilir (en erken 1 sn arayla).
- **Düşünme seviyesi:** Bölmedeki "Düşünme" düğmesi: Varsayılan, Düşük, Orta, Yüksek, Çok yüksek, En yüksek (`claude --effort low|medium|high|xhigh|max`). Seçim oturumda saklanır; son seçim yeni sohbetlere varsayılan olur. Ana süreç değeri izin listesiyle doğrular.
- **Bilgisayar kontrolü ("Kontrol" düğmesi, oturum bazında):** Açıkken Claude şu ikisiyle başlatılır:
  - Tarayıcı: Claude Code'un kendi Claude in Chrome bağlantısı (`--chrome`). Kullanıcının gerçek Chrome'u ve açık oturumları kullanılır (Flow vb.); Chrome'da Claude eklentisi kurulu olmalı.
  - Masaüstü: [agent-desktop](https://github.com/vercel-labs/agent-desktop) (vercel-labs). Windows'ta UI Automation, macOS'ta erişilebilirlik ağacıyla uygulamaları okur ve kullanır; iki sistemde aynı araçlar, ekran görüntüsü gerekmez. Kurulum: `npm install -g agent-desktop` (Mac'te Gizlilik → Erişilebilirlik izni). Panel aracı PATH'te bulursa `~/.claude-panel/bilgisayar-kontrolu.mcp.json` yazar ve `--mcp-config` ile ekler; Windows'ta npm betiği `cmd /c` ile başlatılır. Kurulu değilse yalnızca tarayıcı açılır.
  - Seçim gerekçesi: Windows-MCP (CursorTouch) yalnızca Windows'ta çalışıyor ve Python/uv istiyor; agent-desktop tek npm paketiyle iki sistemde aynı. Playwright MCP'nin eklenti modu yerine CLI'ın yerleşik Chrome bağlantısı kullanıldı (ek kurulum yok).
  - Kullanıcının kendi MCP sunucuları (ör. `premiere-kopru`) olduğu gibi kalır; Premiere işleri onunla yapılmaya devam eder.
  - Mac'te uçtan uca denendi: oturumda `agent-desktop` ve `claude-in-chrome` bağlı, açık uygulamalar 17 sn'de doğru listelendi. Windows'ta henüz denenmedi.
  - Kontrol açılırken agent-desktop yoksa panel sorar: "agent-desktop'ı kur ve aç" (`npm install -g agent-desktop`, sabit argümanlar; Windows'ta `npm.cmd` PATH'te ya da `Program Files\nodejs` içinde aranır, kabukla ve tırnaklı yolla çalıştırılır) ya da "Yalnızca tarayıcıyla aç". Mac'te Erişilebilirlik izni yoksa uyarı çıkar.
- **Tema düğmesi (açık/koyu) çalışmıyordu:** Koyu olup olmadığı `--bg` rengi `#262624` mı diye anlaşılıyordu; 0.2.4'te koyu temanın rengi `#1f1f1e` olunca düğme hep "koyu"ya basıyordu. Artık `data-theme` ve sistem tercihine bakılır (`isDarkTheme`), seçim `WS.prefs.theme`'de saklanır ve açılışta uygulanır; seçim yokken sistem teması izlenir (Windows pencere düğmeleri de).
- **Electron 45.2.3:** yalnızca Chromium/V8 güvenlik yamaları; testler ve uygulama içi deneme yeni sürümle geçti.
- **Mac dmg yenilendi** (`dist/Claude Panel-0.2.7-arm64.dmg`, imzasız).
- **Uygulama içi test seti:** `npm run test:ui` (`scripts/ui-test/run.sh mac|win`): Electron'u sahte claude CLI ile açar, 16 denetim yapar (tema, düzenler, pano yuvaları, arama, Ctrl/⌘ etiketleri, bilgi paneli, yeni sohbet, düşünme, Kontrol, ek kaldırma, akışta odak, izin kartı, durdurma, ikinci açılışta kalıcılık). `win` kipi Windows arayüzünü Mac'te taklit eder; gerçek Windows'un yerini tutmaz. Bu set, yeni bölme yuvalarının mevcut `data-slot`/`.slot` adlarıyla çakıştığını (izin düğmesi çalışmıyordu) yayından önce yakaladı; yuvalar `data-ps`/`.pslot` oldu.
