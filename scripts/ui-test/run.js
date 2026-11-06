#!/usr/bin/env node
// Uygulama içi tam test (Electron + sahte claude CLI). Gerçek veriye yazmaz: workspace, yansı ve geçici dosyalar
// kendi klasöründe tutulur, sonunda silinir. ~/.claude/projects yalnızca okunur (açık bölmeler oradaki sohbetleri gösterir).
// Kullanım: node scripts/ui-test/run.js [mac|win]   (mac: Mac arayüzü, win: Windows arayüzü; ikisi de her sistemde taklit edilir)
// Denenenler: tema düğmesi, düzenler, sohbetler panosu ve bölme yuvaları, arama, yardım (Ctrl/⌘), bilgi paneli,
// yeni sohbet, düşünme seviyesi, Kontrol, ek kaldırma, akışta odak korunması, izin kartı, durdurma,
// Yeni/çöp/ok, arama bölme düğmeleri, araç grupları, kartlar, dosya yolları, çatal kartı, sıra, sayaç, Tab tamamlama,
// şablonlar, mikrofon, kullanım grafiği, son medya; kalan kullanım, sohbetteki görseller ve büyütme, boş bölmede sohbet arama,
// sohbetler panosunda kenar çubuğu, ada göre sıralama, boş alanda sürükle-seç ve sağ tık menüsü,
// ikinci açılışta tema/düşünme/Kontrol/sıralama/kenar çubuğu seçimlerinin geri gelmesi.
// Ek adımlar: scripts/ui-test/extra/*.js (her dosya bir ya da daha fazla adım, //-- ile ayrılır).
// Her ek adım {name: 'kontrol adı', ok: true/false, ...ayrıntı} döndürür; bunlar ayrı kontroller olarak sayılır.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { isDeepStrictEqual: same } = require('util');

const M = process.argv[2] || 'mac';
if (M !== 'mac' && M !== 'win') { console.error('Kullanım: node scripts/ui-test/run.js [mac|win]'); process.exit(2); }
const win = M === 'win';
const HERE = __dirname, ROOT = path.join(HERE, '..', '..');
// Windows .js dosyasını doğrudan başlatamaz: npm cmd-shim biçimli sarmalayıcı (runner.js launchSpec onu node + .js olarak çözer)
const FAKE = path.join(ROOT, 'test', process.platform === 'win32' ? 'fake-claude.cmd' : 'fake-claude.js');
const ELECTRON = require(path.join(ROOT, 'node_modules', 'electron')); // Node'dan require edilince ikilinin yolunu verir

const D = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-uitest-'));
// UITEST_SHOTS=<klasör> verilirse ekran görüntüleri silinmeden önce oraya kopyalanır
const clean = () => {
  if (process.env.UITEST_SHOTS) try { fs.cpSync(path.join(D, 'out'), path.join(process.env.UITEST_SHOTS, M), { recursive: true }); } catch {}
  try { fs.rmSync(D, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch {} // Windows: kapanan süreç dosyayı kısa süre tutabilir
};
for (const d of ['home', 'mirror', 'out', 'ud']) fs.mkdirSync(path.join(D, d));
// Her çalıştırmanın kendi Electron kullanıcı veri klasörü: aynı anda koşan testler (mac + win, başka dallar) kilitlenmesin
const UD = path.join(D, 'ud');
const TIMEOUT = +process.env.UITEST_TIMEOUT_MS || 5 * 60 * 1000; // asılı kalan açılış sonsuza dek beklenmez
let child = null;
// Electron yardımcı süreçleriyle birlikte kapanır (Windows'ta sinyal yok: taskkill /T)
const kill = p => {
  if (!p || p.exitCode !== null) return;
  if (process.platform === 'win32') { try { require('child_process').spawnSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { windowsHide: true }); } catch {} }
  else try { p.kill('SIGKILL'); } catch {}
};
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { kill(child); clean(); process.exit(1); });

// Adımlar: her blok tek satıra indirilir (SELFTEST_STEPS satır başına bir adım)
const blocks = f => fs.readFileSync(f, 'utf8').split('//--').filter(b => b.trim());
const extra = fs.existsSync(path.join(HERE, 'extra')) ? fs.readdirSync(path.join(HERE, 'extra')).filter(f => f.endsWith('.js')).sort().map(f => path.join(HERE, 'extra', f)) : [];
const STEPS = [path.join(HERE, 'steps.js'), ...extra].flatMap(blocks).map(b => b.trim().split(/\r?\n/).map(l => l.trim()).join(' ')).join('\n');
const NBASE = blocks(path.join(HERE, 'steps.js')).length;

// Seçimlerin geri geldiğini denetleyen ikinci açılış adımı
const STEPS2 = '(async()=>({tema: document.documentElement.dataset.theme || null, prefs: WS.prefs, effort0: sess(S.panes[0]) && sess(S.panes[0]).effort, control0: sess(S.panes[0]) && sess(S.panes[0]).control, sort: FX.sort, side: S.side}))()';

function electron(steps, log) {
  const env = {
    ...process.env,
    CLAUDE_PANEL_UI_PLATFORM: win ? 'win32' : 'darwin',
    CLAUDE_PANEL_CLAUDE_BIN: FAKE, FAKE_PERM: '1', FAKE_DELAY: '80', // ikinci açılışta da: gerçek claude hiç çağrılmaz
    CLAUDE_PANEL_HOME: path.join(D, 'home'), CLAUDE_PANEL_MIRROR: path.join(D, 'mirror'), SELFTEST_OUT: path.join(D, 'out'),
    SELFTEST_STEPS: steps,
    TMPDIR: D + path.sep, TEMP: D, TMP: D, // uygulamanın geçici dosyaları da bu klasöre (POSIX TMPDIR, Windows TEMP/TMP)
  };
  const fd = fs.openSync(log, 'w');
  return new Promise(resolve => {
    child = spawn(ELECTRON, ['.', '--selftest', '--user-data-dir=' + UD], { cwd: ROOT, env, stdio: ['ignore', fd, fd], windowsHide: true });
    const p = child, t = setTimeout(() => { fs.writeSync(fd, `\nZAMAN AŞIMI: ${TIMEOUT} ms içinde bitmedi, süreç kapatıldı\n`); kill(p); }, TIMEOUT);
    p.on('error', e => { fs.writeSync(fd, 'başlatılamadı: ' + e.message + '\n'); });
    p.on('close', () => { clearTimeout(t); child = null; fs.closeSync(fd); resolve(); }); // çıkış kodu önemsiz: sonuç günlükteki SELFTEST satırından okunur
  });
}

function report(f) {
  const t = fs.readFileSync(f, 'utf8'), i = t.indexOf('SELFTEST {');
  let r = null;
  if (i >= 0) try { r = JSON.parse(t.slice(i + 9, t.lastIndexOf('}') + 1)); } catch {}
  return { r, t };
}
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const str = v => (typeof v === 'string' ? v : '');
const arr = v => (Array.isArray(v) ? v : []);

function evaluate(r, r2) {
  const s = {}; for (let n = 1; n <= 8; n++) s['step' + n] = obj(r['step' + n]);
  const [s1, s2, s3, s4, s5] = [s.step1, s.step2, s.step3, s.step4, s.step5];
  const g = s.step6, h = s.step7, j = s.step8;
  const bm = arr(g.sagTikMenu), sm = arr(g.kenarMenu);
  const r2s = obj(r2 && r2.step1);
  const checks = [
    ['platform', s1.platWin === win],
    ['tema düğmesi', s1.degisti === true],
    ['düzenler 1-4', same([1, 2, 3, 4].map(i => s2['l' + i]), [1, 2, 3, 4])],
    ['pano + bölme yuvaları', s2.pano && s2.panoYuvaGorunumu === 'flex' && s2.yuvaTiklamaEtkin === 1],
    ['arama', (s2.aramaSonuc || 0) > 0],
    ['kısayol etiketleri', s2.yardimCtrl === win && s2.yardimCmd === !win],
    ['bilgi paneli', s2.bilgiKapali && s2.bilgiAcik],
    ['yeni sohbet', s3.yeniSohbetDiyalog === true],
    ['düşünme + odak', s3.dusunme === 'Çok yüksek' && s3.dusunmeOdak === '0'],
    ['Kontrol (varsayılan açık)', s3.kontrolVarsayilan === true && s3.kontrolKapandi === true && s3.kontrol === true],
    ['varsayılan yazı tipi', same(g.yazi, { ui: 'Inter', read: '@ui', mono: 'JetBrains Mono' })],
    ['Uzaktan (claude.ai oturumları)', (g.uzaktan || 0) > 0],
    ['ek kaldırma', same(s3.ekKaldir, ['b.txt'])],
    ['akışta odak', s4.odakKaybi === 0 && s4.t1 === 'öbür bölme'],
    ['izin kartı + izin', s4.izinKarti && s4.bitti],
    ['durdurma', s5.durdu && s5.notu],
    ['kenar çubuğu açık + ada göre', g.kenarAcik === true && g.sira === 'name' && g.adaGore === true],
    ['sürükle-seç', g.baslangicBos && g.kutu && g.kutuKalkti && (g.secilen || 0) >= 2 && g.ilkSecili && g.seciliSinif === g.secilen],
    ['sürükle-seç Esc', g.escGeriAldi && g.escKutu],
    ['boş alan sağ tık', g.sagTikSecimTemiz && ['bgchat', 'bgfolder', 'bgview', 'sort', 'bgall', 'bgsync'].every(k => bm.includes(k)) && g.listeGorunum && g.siraKayit === 'date'],
    ['kenar çubuğu sağ tık + kapatma', sm.includes('bgchat') && sm.includes('bgfolder') && !sm.includes('bgview') && g.kenarKapandi],
    ['kalan kullanım', str(h.kullanim).includes('%') && str(h.kullanim).includes('kaldı') && same(h.kullanimMenu, ['5 saatlik', 'Haftalık'])],
    ['sohbette görsel', h.mdGorsel === true],
    ['büyütme: zoom + boş yere tık kapatır', h.lbGorselKucuk && h.lbZoom && h.lbBosTikKapandi],
    ['boş bölmede sohbet arama', h.bosAramaVar && (h.bosAramaSonuc || 0) > 0 && h.bosAramaOdak && h.bosAramaAcildi],
    ['Yeni adı + çöp sağ tık boşalt', j.yeniAd === 'Yeni' && j.copMenu && j.copBos],
    ['klasör oku yalnızca görünür alt klasörde', j.okYok && j.okVar],
    ['arama bölme düğmeleri + bölmede ara', j.aramaDugme && j.swap],
    ['araç satırları tek satırda, açık kalır', str(j.grup).startsWith('3 araç') && str(j.grup).includes('browser_batch ×2') && str(j.grup).includes('1 hata') && j.grupAcik && j.grupAcikKaldi],
    ['görev listesi + sonraki adım kartı', j.plan === 'Görevler1/2✓AB' && j.kart],
    ['dosya yolu tıklanır + sağ tık menüsü', j.fpath === 'Görseller/a.png' && same(j.yolMenu, ['fpprev', 'fpopen', 'fpshow', 'fpcopy']) && j.yolOnizleme],
    ['sakin "Claude\'da da açık" + çatal kartı', j.baskaYer === "Claude'da da açık" && str(j.banner).includes('canlı izleniyor') && j.catalKart && j.cevapGitti],
    ['çalışırken köpek + mesaj sırası', j.kopek && j.sirada === 1 && j.siraKart && j.siraGitti],
    ['dikkat sayacı', j.dikkat === true],
    ['Tab tamamlama + şablonlar', str(j.hayalet).startsWith('/dur') && j.tabSonra === 'Şu ana kadar ne yaptın, ne kaldı? Kısa bir özet ver.' && j.sablonMenu === 5 && j.sablonEklendi],
    ['mikrofon', j.mic === true],
    ['kullanım grafiği + tahmin', j.grafik && arr(j.tahmin).some(x => String(x).includes('biter'))],
    ['son medya', j.medya === true],
    ['ikinci açılış', !!r2 && r2s.tema === 'light' && r2s.effort0 === 'xhigh' && r2s.control0 === true && r2s.sort === 'date' && r2s.side === false],
  ];
  const extraKeys = Object.keys(r).filter(k => /^step\d+$/.test(k) && +k.slice(4) > NBASE).sort((a, b) => a.slice(4) - b.slice(4));
  return { checks, extraKeys };
}

(async () => {
  let code = 1;
  try {
    const log = path.join(D, 'log.txt'), log2 = path.join(D, 'log2.txt');
    await electron(STEPS, log);
    await electron(STEPS2, log2);
    const { r, t } = report(log), { r: r2 } = report(log2);
    if (!r) { console.log('SELFTEST çıktısı yok\n' + t.slice(-1500)); return; }
    const { checks, extraKeys } = evaluate(r, r2);
    checks.push(['renderer hatası yok', !t.split(/\r?\n/).some(l => l.startsWith('[renderer]')) && !('error' in r)]);
    for (const k of extraKeys) { const x = obj(r[k]); checks.push(['+ ' + String(x.name || k), x.ok === true]); }
    for (const [n, ok] of checks) console.log((ok ? '✔ ' : '✖ ') + n);
    const bad = checks.filter(([, ok]) => !ok);
    if (bad.length) {
      const dump = Object.fromEntries(Object.entries(r).filter(([k]) => k.startsWith('step') || k === 'error'));
      console.log(JSON.stringify(dump).slice(-6000));
      return;
    }
    console.log(`${checks.length}/${checks.length} geçti (${win ? 'Windows taklidi' : 'Mac'})`);
    code = 0;
  } finally { clean(); process.exitCode = code; }
})();
