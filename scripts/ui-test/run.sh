#!/bin/zsh
# Uygulama içi tam test (Electron + sahte claude CLI). Gerçek veriye yazmaz: workspace, yansı ve geçici dosyalar
# kendi klasöründe tutulur, sonunda silinir. ~/.claude/projects yalnızca okunur (açık bölmeler oradaki sohbetleri gösterir).
# Kullanım: scripts/ui-test/run.sh [mac|win]   (win: Mac'te Windows arayüzünü taklit eder)
# Denenenler: tema düğmesi, düzenler, sohbetler panosu ve bölme yuvaları, arama, yardım (Ctrl/⌘), bilgi paneli,
# yeni sohbet, düşünme seviyesi, Kontrol, ek kaldırma, akışta odak korunması, izin kartı, durdurma,
# Yeni/çöp/ok, arama bölme düğmeleri, araç grupları, kartlar, dosya yolları, çatal kartı, sıra, sayaç, Tab tamamlama,
# şablonlar, mikrofon, kullanım grafiği, son medya; kalan kullanım, sohbetteki görseller ve büyütme, boş bölmede sohbet arama,
# sohbetler panosunda kenar çubuğu, ada göre sıralama, boş alanda sürükle-seç ve sağ tık menüsü,
# ikinci açılışta tema/düşünme/Kontrol/sıralama/kenar çubuğu seçimlerinin geri gelmesi.
set -e
M=${1:-mac}; ROOT=${0:A:h:h:h}; HERE=${0:A:h}
D=$(mktemp -d "${TMPDIR:-/tmp}/cp-uitest-XXXXXX"); trap 'rm -rf "$D"' EXIT
mkdir -p $D/home $D/mirror $D/out
cd "$ROOT"
STEPS=$(python3 -c "import sys; s=open(sys.argv[1]).read(); print('\n'.join(' '.join(l.strip() for l in b.strip().splitlines()) for b in s.split('//--')))" $HERE/steps.js)
PLAT=(); [[ $M == win ]] && PLAT=(CLAUDE_PANEL_UI_PLATFORM=win32)
env $PLAT CLAUDE_PANEL_CLAUDE_BIN="$ROOT/test/fake-claude.js" FAKE_PERM=1 FAKE_DELAY=80 CLAUDE_PANEL_HOME=$D/home CLAUDE_PANEL_MIRROR=$D/mirror SELFTEST_OUT=$D/out SELFTEST_STEPS="$STEPS" TMPDIR=$D/ npx electron . --selftest > $D/log.txt 2>&1 || true
env $PLAT CLAUDE_PANEL_HOME=$D/home CLAUDE_PANEL_MIRROR=$D/mirror SELFTEST_OUT=$D/out SELFTEST_STEPS='(async()=>({tema: document.documentElement.dataset.theme || null, prefs: WS.prefs, effort0: sess(S.panes[0]) && sess(S.panes[0]).effort, control0: sess(S.panes[0]) && sess(S.panes[0]).control, sort: FX.sort, side: S.side}))()' TMPDIR=$D/ npx electron . --selftest > $D/log2.txt 2>&1 || true
python3 - $D/log.txt $D/log2.txt $M <<'PY'
import sys, json
def rep(f):
    t = open(f).read(); i = t.find('SELFTEST {')
    return (json.loads(t[i+9:t.rfind('}')+1]) if i >= 0 else None), t
r, t = rep(sys.argv[1]); r2, _ = rep(sys.argv[2]); win = sys.argv[3] == 'win'
if not r: print('SELFTEST çıktısı yok\n' + t[-1500:]); sys.exit(1)
s = {k: r.get(k) or {} for k in ['step1','step2','step3','step4','step5','step6','step7','step8']}
j = s['step8']
h = s['step7']
g = s['step6']; bm = g.get('sagTikMenu') or []; sm = g.get('kenarMenu') or []
checks = [
  ('platform', s['step1'].get('platWin') == win),
  ('tema düğmesi', s['step1'].get('degisti') is True),
  ('düzenler 1-4', [s['step2'].get('l%d' % i) for i in (1,2,3,4)] == [1,2,3,4]),
  ('pano + bölme yuvaları', s['step2'].get('pano') and s['step2'].get('panoYuvaGorunumu') == 'flex' and s['step2'].get('yuvaTiklamaEtkin') == 1),
  ('arama', (s['step2'].get('aramaSonuc') or 0) > 0),
  ('kısayol etiketleri', s['step2'].get('yardimCtrl') == win and s['step2'].get('yardimCmd') == (not win)),
  ('bilgi paneli', s['step2'].get('bilgiKapali') and s['step2'].get('bilgiAcik')),
  ('yeni sohbet', s['step3'].get('yeniSohbetDiyalog') is True),
  ('düşünme + odak', s['step3'].get('dusunme') == 'Çok yüksek' and s['step3'].get('dusunmeOdak') == '0'),
  ('Kontrol (varsayılan açık)', s['step3'].get('kontrolVarsayilan') is True and s['step3'].get('kontrolKapandi') is True and s['step3'].get('kontrol') is True),
  ('varsayılan yazı tipi', g.get('yazi') == {'ui':'Inter','read':'@ui','mono':'JetBrains Mono'}),
  ('Uzaktan (claude.ai oturumları)', (g.get('uzaktan') or 0) > 0),
  ('ek kaldırma', s['step3'].get('ekKaldir') == ['b.txt']),
  ('akışta odak', s['step4'].get('odakKaybi') == 0 and s['step4'].get('t1') == 'öbür bölme'),
  ('izin kartı + izin', s['step4'].get('izinKarti') and s['step4'].get('bitti')),
  ('durdurma', s['step5'].get('durdu') and s['step5'].get('notu')),
  ('kenar çubuğu açık + ada göre', g.get('kenarAcik') is True and g.get('sira') == 'name' and g.get('adaGore') is True),
  ('sürükle-seç', g.get('baslangicBos') and g.get('kutu') and g.get('kutuKalkti') and (g.get('secilen') or 0) >= 2 and g.get('ilkSecili') and g.get('seciliSinif') == g.get('secilen')),
  ('sürükle-seç Esc', g.get('escGeriAldi') and g.get('escKutu')),
  ('boş alan sağ tık', g.get('sagTikSecimTemiz') and all(k in bm for k in ('bgchat','bgfolder','bgview','sort','bgall','bgsync')) and g.get('listeGorunum') and g.get('siraKayit') == 'date'),
  ('kenar çubuğu sağ tık + kapatma', 'bgchat' in sm and 'bgfolder' in sm and 'bgview' not in sm and g.get('kenarKapandi')),
  ('kalan kullanım', '%' in (h.get('kullanim') or '') and 'kaldı' in (h.get('kullanim') or '') and h.get('kullanimMenu') == ['5 saatlik','Haftalık']),
  ('sohbette görsel', h.get('mdGorsel') is True),
  ('büyütme: zoom + boş yere tık kapatır', h.get('lbGorselKucuk') and h.get('lbZoom') and h.get('lbBosTikKapandi')),
  ('boş bölmede sohbet arama', h.get('bosAramaVar') and (h.get('bosAramaSonuc') or 0) > 0 and h.get('bosAramaOdak') and h.get('bosAramaAcildi')),
  ('Yeni adı + çöp sağ tık boşalt', j.get('yeniAd') == 'Yeni' and j.get('copMenu') and j.get('copBos')),
  ('klasör oku yalnızca görünür alt klasörde', j.get('okYok') and j.get('okVar')),
  ('arama bölme düğmeleri + bölmede ara', j.get('aramaDugme') and j.get('swap')),
  ('araç satırları tek satırda, açık kalır', (j.get('grup') or '').startswith('3 araç') and 'browser_batch ×2' in (j.get('grup') or '') and '1 hata' in (j.get('grup') or '') and j.get('grupAcik') and j.get('grupAcikKaldi')),
  ('görev listesi + sonraki adım kartı', j.get('plan') == 'Görevler1/2✓AB' and j.get('kart')),
  ('dosya yolu tıklanır + sağ tık menüsü', j.get('fpath') == 'Görseller/a.png' and j.get('yolMenu') == ['fpprev','fpopen','fpshow','fpcopy'] and j.get('yolOnizleme')),
  ('sakin "Claude\'da da açık" + çatal kartı', j.get('baskaYer') == "Claude'da da açık" and 'canlı izleniyor' in (j.get('banner') or '') and j.get('catalKart') and j.get('cevapGitti')),
  ('çalışırken köpek + mesaj sırası', j.get('kopek') and j.get('sirada') == 1 and j.get('siraKart') and j.get('siraGitti')),
  ('dikkat sayacı', j.get('dikkat') is True),
  ('Tab tamamlama + şablonlar', (j.get('hayalet') or '').startswith('/durDurum özeti'[0:4]) and j.get('tabSonra') == 'Şu ana kadar ne yaptın, ne kaldı? Kısa bir özet ver.' and j.get('sablonMenu') == 5 and j.get('sablonEklendi')),
  ('mikrofon', j.get('mic') is True),
  ('kullanım grafiği + tahmin', j.get('grafik') and any('biter' in x for x in (j.get('tahmin') or []))),
  ('son medya', j.get('medya') is True),
  ('ikinci açılış', bool(r2) and (r2.get('step1') or {}).get('tema') == 'light' and (r2.get('step1') or {}).get('effort0') == 'xhigh' and (r2.get('step1') or {}).get('control0') is True and (r2.get('step1') or {}).get('sort') == 'date' and (r2.get('step1') or {}).get('side') is False),
  ('renderer hatası yok', not [l for l in t.splitlines() if l.startswith('[renderer]')] and 'error' not in r),
]
for n, ok in checks: print(('✔ ' if ok else '✖ ') + n)
bad = [n for n, ok in checks if not ok]
if bad: print(json.dumps({k: v for k, v in r.items() if k.startswith('step') or k == 'error'}, ensure_ascii=False)[-6000:]); sys.exit(1)
print(f'{len(checks)}/{len(checks)} geçti ({"Windows taklidi" if win else "Mac"})')
PY
