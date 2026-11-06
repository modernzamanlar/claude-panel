// Claude Panel — Electron ana süreç
const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme, Menu, protocol, nativeImage } = require('electron');
app.setName('Claude Panel');
// Sohbetteki video/ses oynatıcıları yerel dosyaları cpmedia://local/<kodlanmış-yol> ile okur (ileri/geri sarma için Range desteği)
protocol.registerSchemesAsPrivileged([{ scheme: 'cpmedia', privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true } }]);
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SessionIndex, SessionLoader, PROJECTS_DIR } = require('./sessions');
const workspace = require('./workspace');
const { createMirror } = require('./mirror');
const { createUpdater } = require('./updater');
const { SearchIndex } = require('./search');
const { recentMedia, okBadgeIcon, dictateCommand } = require('./media');
const { Runner, authStatus, openLoginTerminal, openRemoteTerminal, mcpList, controlStatus, installDesktop, filesRewind, worktreeInfo } = require('./runner');

const SELFTEST = process.argv.includes('--selftest');
const IS_MAC = process.platform === 'darwin';
// Windows/Linux: başlık çubuğu gizli, pencere düğmeleri (— □ ×) üst çubuğun sağına bindirilir
const overlayColors = dark => ({ color: dark ? '#1f1e1d' : '#f3f1ea', symbolColor: dark ? '#f3f2ee' : '#3d3929', height: 44 });
const HOME = os.homedir();
const expand = p => (p && p.startsWith('~') ? path.join(HOME, p.slice(1)) : p);

// Windows bildirimleri uygulama kimliğiyle gösterilir (kurulumdaki kısayolla aynı: package.json build.appId)
if (process.platform === 'win32') app.setAppUserModelId('com.yasincelikbas.claudepanel');
let win = null;
let quitConfirmed = false; // kapanış onaylandı (çalışan tur uyarısı bir kez sorulur)
// ---- IPC güvenliği: yalnızca uygulamanın kendi sayfası (file://…/renderer/index.html, ana pencere) çağırabilir ----
const APP_PAGE = require('url').pathToFileURL(path.join(__dirname, '..', 'renderer', 'index.html')).href;
function trustedSender(e) {
  try {
    const u = e.senderFrame && e.senderFrame.url;
    return !!u && u.split('#')[0].split('?')[0] === APP_PAGE && !!win && !win.isDestroyed() && e.sender === win.webContents;
  } catch { return false; }
}
{
  const handle = ipcMain.handle.bind(ipcMain), on = ipcMain.on.bind(ipcMain);
  ipcMain.handle = (ch, fn) => handle(ch, (e, ...a) => { if (!trustedSender(e)) throw new Error('İzin verilmeyen IPC çağrısı: ' + ch); return fn(e, ...a); });
  ipcMain.on = (ch, fn) => on(ch, (e, ...a) => { if (!trustedSender(e)) { e.returnValue = null; return; } return fn(e, ...a); });
}
const index = new SessionIndex(path.join(workspace.DIR, 'index.json'));
const search = new SearchIndex(workspace.DIR);
// Klasör/sohbet yapısının diskteki kopyası (Windows: C:\Claude Panel)
const mirror = createMirror({
  getSessions: () => index.list(),
  onStatus: st => { if (win && !win.isDestroyed()) win.webContents.send('mirror:status', st); },
});
// Kendi kendini güncelleme (Windows): güncelleme klasöründeki guncelleme.json'a bakar
const updater = createUpdater({
  app, settingsFile: path.join(workspace.DIR, 'settings.json'),
  onState: st => { if (win && !win.isDestroyed()) win.webContents.send('update:state', st); },
});
ipcMain.handle('update:state', () => ({ ...updater.state, sources: updater.sources(), dir: updater.getDir() }));
ipcMain.handle('update:check', () => updater.check({ manual: true }));
ipcMain.handle('update:install', () => updater.install(() => { quitConfirmed = true; mirror.flush(); }));
ipcMain.handle('update:pickDir', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Güncelleme klasörünü seç (guncelleme.json olan klasör)', properties: ['openDirectory'], defaultPath: updater.getDir() || undefined });
  if (r.canceled || !r.filePaths[0]) return null;
  updater.setDir(r.filePaths[0]); return updater.check({ manual: true });
});
function syncSearch() {
  return search.sync(index.list(), (done, total) => { if (win && !win.isDestroyed() && (done % 5 === 0 || done === total)) win.webContents.send('search:progress', { done, total }); })
    .catch(e => console.warn('arama dizini', e.message));
}
const runner = new Runner((ch, payload) => { if (win && !win.isDestroyed()) win.webContents.send(ch, payload); });

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600,
    title: 'Claude Panel',
    titleBarStyle: IS_MAC ? 'hiddenInset' : 'hidden',
    ...(IS_MAC ? { trafficLightPosition: { x: 14, y: 15 } } : { titleBarOverlay: overlayColors(nativeTheme.shouldUseDarkColors), icon: path.join(__dirname, '..', '..', 'build', 'icon.png') }),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1f1f1e' : '#faf9f5',
    show: !SELFTEST,
    webPreferences: {
      devTools: !app.isPackaged, // dağıtım sürümünde geliştirici araçları kapalı
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // arayüz hangi platformda olduğunu buradan okur (CLAUDE_PANEL_UI_PLATFORM yalnızca test için)
      additionalArguments: ['--cp-platform=' + (process.env.CLAUDE_PANEL_UI_PLATFORM || process.platform)],
    },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  // Pencereyi kapatmak (Windows'ta uygulamayı kapatmak) çalışan turu keser: önce sor
  win.on('close', e => {
    if (quitConfirmed || SELFTEST || !runner.active().length) return;
    e.preventDefault();
    const n = runner.active().length;
    dialog.showMessageBox(win, { type: 'warning', buttons: ['Kapat', 'Vazgeç'], defaultId: 1, cancelId: 1, title: 'Claude Panel',
      message: `${n} sohbet şu an çalışıyor.`, detail: 'Kapatırsan bu turlar yarıda kesilir. Yine de kapatılsın mı?' })
      .then(r => { if (r.response === 0) { quitConfirmed = true; win.close(); } });
  });
  // Dış bağlantılar sistem tarayıcısında açılsın
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  win.on('focus', () => { try { win.flashFrame(false); } catch {} });
  if (SELFTEST) runSelftest();
}

// ---------- IPC ----------
const sessionFile = id => { const s = index.get(id); return s && s.file; };

ipcMain.handle('sessions:list', async () => { await index.refresh(); return index.list(); });
ipcMain.handle('sessions:refresh', async () => { const changed = await index.refresh(); return { sessions: index.list(), changed }; });
const loader = new SessionLoader();
ipcMain.handle('session:load', async (_e, id, limit) => {
  let file = sessionFile(id);
  if (!file) { await index.refresh(); file = sessionFile(id); } // panelden yeni başlatılan oturum henüz dizinde olmayabilir
  if (!file) throw new Error('Oturum bulunamadı: ' + id);
  return loader.load(file, limit || 60); // artımlı: açık oturum büyüdükçe yalnızca yeni satırlar okunur
});
ipcMain.handle('workspace:load', () => {
  const ws = workspace.load([() => mirror.readWorkspace()]); // asıl dosya ve yedek yoksa yansıdaki yapıdan dön
  if (!ws.firstRun) mirror.schedule(ws);
  return ws;
});
ipcMain.on('win:theme', (_e, dark) => { if (!IS_MAC && win && !win.isDestroyed() && win.setTitleBarOverlay) try { win.setTitleBarOverlay(overlayColors(!!dark)); } catch {} });
ipcMain.handle('workspace:save', (_e, data) => { mirror.schedule(workspace.save(data)); return true; });
// Pencere kapanırken: bekleyen kaydı eşzamanlı yaz ve diske hemen yansıt (son değişiklik kaybolmasın)
ipcMain.on('workspace:saveSync', (e, data) => {
  try { mirror.schedule(workspace.save(data)); mirror.flush(); e.returnValue = true; }
  catch (err) { console.warn('kapanışta kaydedilemedi', err); e.returnValue = false; }
});
ipcMain.handle('mirror:info', () => ({ root: mirror.root, status: mirror.status }));
ipcMain.handle('mirror:open', () => mirror.root ? shell.openPath(mirror.root).then(r => !r) : false);
ipcMain.handle('dialog:pickFolder', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'], defaultPath: path.join(HOME, 'Desktop') });
  if (r.canceled || !r.filePaths[0]) return null;
  const p = r.filePaths[0];
  return require('./sessions').tilde(p);
});
ipcMain.handle('fs:listDesktop', async () => {
  try {
    const ents = await fs.promises.readdir(path.join(HOME, 'Desktop'), { withFileTypes: true });
    return ents.filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => e.name).sort((a, b) => a.localeCompare(b, 'tr'));
  } catch { return []; }
});
// Klasörler açılır; dosyalar yalnızca belge/görsel/medya türündeyse varsayılan uygulamada açılır.
// Çalıştırılabilir ya da betik olabilecek her şey (exe, cmd, js, lnk, py…) açılmaz, klasöründe gösterilir.
const OPEN_EXT = new Set(('md markdown txt log csv tsv json xml yml yaml html htm css pdf rtf doc docx xls xlsx ppt pptx odt ods odp pages numbers key ' +
  'png jpg jpeg gif webp svg bmp tif tiff heic avif ico psd ai eps indd aep prproj ' +
  'mp4 m4v mov webm mkv avi wmv mp3 wav m4a aac ogg oga opus flac srt vtt ttf otf woff woff2 zip').split(' ').map(x => '.' + x));
ipcMain.handle('shell:reveal', async (_e, p) => {
  const full = expand(typeof p === 'string' ? p : '');
  let st; try { st = full && fs.statSync(full); } catch { return false; }
  if (!st) return false;
  if (st.isDirectory()) { await shell.openPath(full); return true; }
  if (st.isFile() && OPEN_EXT.has(path.extname(full).toLowerCase())) { await shell.openPath(full); return true; }
  shell.showItemInFolder(full); return true;
});
ipcMain.handle('shell:showItem', async (_e, p) => {
  const full = expand(p);
  if (full && fs.existsSync(full)) { shell.showItemInFolder(full); return true; }
  return false;
});
// ---------- cpmedia:// — yalnızca video/ses dosyaları, Range (206) destekli ----------
const MEDIA_TYPES = { '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/mp4', '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.ogv': 'video/ogg',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg', '.flac': 'audio/flac' };
async function serveMedia(req) {
  const { Readable } = require('stream');
  let file;
  try { file = expand(decodeURIComponent(new URL(req.url).pathname.slice(1))); } catch { return new Response('bad url', { status: 400 }); }
  const type = MEDIA_TYPES[path.extname(file || '').toLowerCase()];
  if (!type) return new Response('not media', { status: 403 });
  let st; try { st = await fs.promises.stat(file); if (!st.isFile()) throw 0; } catch { return new Response('not found', { status: 404 }); }
  const size = st.size;
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
  if (range && size > 0) {
    let start, end;
    if (range[1] === '') { start = Math.max(0, size - (+range[2] || 0)); end = size - 1; }
    else { start = +range[1]; end = range[2] === '' ? size - 1 : Math.min(+range[2], size - 1); }
    if (start >= size || start > end) return new Response('', { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    return new Response(Readable.toWeb(fs.createReadStream(file, { start, end })), { status: 206, headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) } });
  }
  return new Response(Readable.toWeb(fs.createReadStream(file)), { status: 200, headers: { ...headers, 'Content-Length': String(size) } });
}
ipcMain.handle('claude:connectors', async () => {
  // Yapılandırılmış MCP sunucuları (durumları Faz 3'te çalışan süreçten okunacak)
  const out = new Map();
  const add = (name, source) => { if (!out.has(name)) out.set(name, { name, source }); };
  try {
    const j = JSON.parse(fs.readFileSync(path.join(HOME, '.claude.json'), 'utf8'));
    Object.keys(j.mcpServers || {}).forEach(n => add(n, 'Claude Code'));
    Object.values(j.projects || {}).forEach(p => Object.keys(p.mcpServers || {}).forEach(n => add(n, 'proje')));
  } catch {}
  try {
    const d = JSON.parse(fs.readFileSync(path.join(HOME, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'), 'utf8'));
    Object.keys(d.mcpServers || {}).forEach(n => add(n, 'Claude uygulaması'));
  } catch {}
  return [...out.values()];
});
ipcMain.handle('run:start', (_e, opts) => runner.start(opts));
ipcMain.handle('run:stop', (_e, runId) => runner.stop(runId));
ipcMain.handle('run:respond', (_e, runId, requestId, response) => runner.respond(runId, requestId, response));
ipcMain.handle('claude:remote', (_e, opts) => openRemoteTerminal(shell, opts));
ipcMain.handle('claude:mcpList', (_e, cwd) => mcpList(cwd));
ipcMain.handle('claude:control', () => controlStatus());
ipcMain.handle('claude:installDesktop', () => installDesktop());
// Geri sarma (kod) ve worktree denetimi: girdiler runner/rewind.js'te doğrulanır (UUID, gerçek klasör, ad kuralı)
ipcMain.handle('rewind:files', (_e, opts) => filesRewind({ sessionId: opts && opts.sessionId, cwd: opts && opts.cwd, userMessageId: opts && opts.userMessageId, dryRun: !!(opts && opts.dryRun) }));
ipcMain.handle('git:worktreeInfo', (_e, dir, name) => worktreeInfo(dir, typeof name === 'string' ? name : null));
// Ek: dosya seç / dosya yollarını tanımla (görseller base64 olarak okunur, en fazla 5 MB)
const IMG = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };
async function describeFiles(paths) {
  const out = [];
  for (const p of paths || []) {
    try {
      const st = await fs.promises.stat(p); if (!st.isFile()) continue;
      const mt = IMG[path.extname(p).toLowerCase()];
      const item = { path: p, name: path.basename(p), size: st.size };
      if (mt && st.size <= 5 * 1024 * 1024) Object.assign(item, { isImage: true, media_type: mt, data: (await fs.promises.readFile(p)).toString('base64') });
      out.push(item);
    } catch {}
  }
  return out;
}
ipcMain.handle('fs:describeFiles', (_e, paths) => describeFiles(paths));
ipcMain.handle('dialog:pickFiles', async (_e, cwd) => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], defaultPath: expand(cwd) || HOME });
  return r.canceled ? [] : describeFiles(r.filePaths);
});
ipcMain.handle('run:active', () => runner.active());
ipcMain.handle('claude:auth', () => authStatus());
ipcMain.handle('claude:login', () => openLoginTerminal(shell));
ipcMain.handle('search:query', (_e, q) => ({ results: search.query(q), building: !!search.building, progress: search.progress, docs: search.docs.size }));
// Dikkat isteyen sohbet sayısı: macOS'ta Dock rozeti, Windows'ta görev çubuğu simgesinin üstünde sayı; yeni bir şey olursa pencere yanıp söner
ipcMain.on('app:badge', (_e, n, icon, flash) => {
  if (!win || win.isDestroyed()) return;
  n = Math.max(0, Math.min(999, n | 0));
  try {
    if (IS_MAC) app.setBadgeCount(n);
    else if (win.setOverlayIcon) win.setOverlayIcon(n && okBadgeIcon(icon) ? nativeImage.createFromDataURL(icon) : null, n ? `${n} sohbet dikkat bekliyor` : '');
    if (flash && n && !win.isFocused()) win.flashFrame(true);
  } catch {}
});
ipcMain.on('app:focus', () => { if (!win || win.isDestroyed()) return; if (win.isMinimized()) win.restore(); win.show(); win.focus(); win.flashFrame(false); });
ipcMain.handle('fs:recentMedia', (_e, dir) => recentMedia(dir));
ipcMain.handle('app:dictate', () => new Promise(resolve => {
  const c = dictateCommand(process.platform); if (!c) return resolve({ ok: false, platform: process.platform });
  require('child_process').execFile(c.cmd, c.args, { windowsHide: true, timeout: 15000 }, err => resolve({ ok: !err, error: err ? String(err.message).slice(0, 200) : null }));
}));
ipcMain.handle('app:info', () => ({ projectsDir: PROJECTS_DIR, workspaceFile: workspace.FILE, version: app.getVersion(), selftest: SELFTEST }));

// ---------- Canlı izleme ----------
// ~/.claude/projects altındaki .jsonl değişikliklerini izler; değişen oturumların özetini yeniler
// ve arayüze bildirir. (macOS'ta fs.watch recursive FSEvents kullanır.)
let pending = new Set(), timer = null;
function flush() {
  timer = null;
  const files = [...pending]; pending = new Set();
  index.refresh(files).then(changed => {
    if (changed.length) mirror.schedule(); // başlıklar değişmiş olabilir
    if (changed.length && win && !win.isDestroyed()) win.webContents.send('sessions:changed', { sessions: index.list(), changed });
    if (changed.length) syncSearch();
  }).catch(e => console.warn('yenileme hatası', e.message));
}
function startWatcher() {
  try {
    fs.watch(PROJECTS_DIR, { recursive: true }, (_ev, rel) => {
      if (!rel || !rel.endsWith('.jsonl') || rel.split(path.sep).length !== 2) return; // yalnızca <proje>/<oturum>.jsonl
      pending.add(path.join(PROJECTS_DIR, rel));
      if (!timer) timer = setTimeout(flush, 400);
    });
  } catch (e) { console.warn('izleyici başlatılamadı:', e.message); }
  // "başka yerde aktif" işaretinin sönmesi ve yeni projeler için hafif periyodik tarama
  setInterval(async () => {
    const before = new Map(index.list().map(s => [s.id, s.live]));
    const changed = await index.refresh();
    const liveChanged = index.list().filter(s => before.get(s.id) !== s.live).map(s => s.id);
    const all = [...new Set([...changed, ...liveChanged])];
    if (all.length && win && !win.isDestroyed()) win.webContents.send('sessions:changed', { sessions: index.list(), changed: all });
  }, 20000);
}

// ---------- Kendi kendini test (npm run selftest) ----------
function runSelftest() {
  const outDir = process.env.SELFTEST_OUT || os.tmpdir();
  win.webContents.on('console-message', (e, ...a) => { const lvl = e.level ?? a[0], msg = e.message ?? a[1]; if (lvl === 'warning' || lvl === 'error' || lvl >= 2) console.log('[renderer]', msg); });
  win.webContents.once('did-finish-load', async () => {
    await new Promise(r => setTimeout(r, 3500));
    const steps = (process.env.SELFTEST_STEPS || '').split('\n').filter(Boolean);
    const report = {};
    try {
      report.state = await win.webContents.executeJavaScript('window.__selftest ? window.__selftest() : null');
      let i = 0;
      const shot = async name => { const img = await win.webContents.capturePage(); const f = path.join(outDir, `selftest-${name}.png`); fs.writeFileSync(f, img.toPNG()); return f; };
      report.shots = [await shot('0-baslangic')];
      for (const js of steps) {
        i++;
        report['step' + i] = await win.webContents.executeJavaScript(js);
        await new Promise(r => setTimeout(r, 1200));
        report.shots.push(await shot(String(i)));
      }
    } catch (e) { report.error = String(e && e.stack || e); }
    console.log('SELFTEST ' + JSON.stringify(report, null, 1));
    app.exit(0);
  });
}

// ---------- Menü çubuğu (Türkçe) — öğeler arayüzdeki komutları tetikler ----------
function buildMenu() {
  const cmd = (c, arg) => () => { if (win && !win.isDestroyed()) win.webContents.send('menu', { cmd: c, arg }); };
  const item = (label, accelerator, c, arg) => ({ label, accelerator, click: cmd(c, arg) });
  const tpl = [
    ...(IS_MAC ? [{ label: 'Claude Panel', submenu: [{ role: 'about', label: 'Claude Panel Hakkında' }, { type: 'separator' }, { role: 'hide', label: 'Gizle' }, { role: 'hideOthers', label: 'Diğerlerini Gizle' }, { role: 'unhide', label: 'Tümünü Göster' }, { type: 'separator' }, { role: 'quit', label: 'Çık' }] }] : []),
    { label: 'Dosya', submenu: [item('Yeni Sohbet', 'CmdOrCtrl+N', 'newChat'), item('Yeni Klasör', 'Shift+CmdOrCtrl+N', 'newFolder'), { type: 'separator' }, item('Ara', 'CmdOrCtrl+K', 'search'), item('Şimdi Senkronla', 'CmdOrCtrl+R', 'sync'), { type: 'separator' }, item('Proje Klasörünü Aç', 'Shift+CmdOrCtrl+O', 'reveal')]
      .concat(IS_MAC ? [] : [{ type: 'separator' }, { role: 'quit', label: 'Çık', accelerator: 'Alt+F4' }]) },
    { label: 'Düzen', submenu: [{ role: 'undo', label: 'Geri Al' }, { role: 'redo', label: 'Yinele' }, { type: 'separator' }, { role: 'cut', label: 'Kes' }, { role: 'copy', label: 'Kopyala' }, { role: 'paste', label: 'Yapıştır' }, item('Tümünü Seç', 'CmdOrCtrl+A', 'selectAll')] },
    { label: 'Görünüm', submenu: [item('Sohbetler Penceresi', 'CmdOrCtrl+B', 'org'), item('GourceView', 'CmdOrCtrl+G', 'graph'), item('Bilgi Paneli', 'CmdOrCtrl+I', 'info'), { type: 'separator' },
      item('Tek Bölme', 'Alt+CmdOrCtrl+1', 'layout', 1), item('İki Sütun', 'Alt+CmdOrCtrl+2', 'layout', 2), item('Üç Sütun', 'Alt+CmdOrCtrl+3', 'layout', 3), item('2×2', 'Alt+CmdOrCtrl+4', 'layout', 4), { type: 'separator' },
      item('Açık / Koyu Tema', 'Shift+CmdOrCtrl+L', 'theme'), { role: 'togglefullscreen', label: 'Tam Ekran' }, { type: 'separator' }, { role: 'reload', label: 'Arayüzü Yeniden Yükle', accelerator: 'Shift+CmdOrCtrl+R' }, ...(app.isPackaged ? [] : [{ role: 'toggleDevTools', label: 'Geliştirici Araçları' }])] },
    { label: 'Bölme', submenu: [1, 2, 3, 4].map(n => item(`Bölme ${n}`, `CmdOrCtrl+${n}`, 'pane', n - 1)).concat([{ type: 'separator' },
      item('Önceki Bölme', 'Shift+CmdOrCtrl+[', 'panePrev'), item('Sonraki Bölme', 'Shift+CmdOrCtrl+]', 'paneNext'), item('Bölmeyi Kapat', 'Alt+CmdOrCtrl+W', 'paneClose'), { type: 'separator' },
      item('Geri (Sohbetler)', 'CmdOrCtrl+[', 'back'), item('İleri (Sohbetler)', 'CmdOrCtrl+]', 'fwd')]) },
    ...(IS_MAC ? [{ role: 'windowMenu', label: 'Pencere' }] : []),
    { role: 'help', label: 'Yardım', submenu: [item('Klavye Kısayolları', 'CmdOrCtrl+/', 'help')] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

app.whenReady().then(() => {
  protocol.handle('cpmedia', serveMedia);
  buildMenu();
  createWindow();
  startWatcher();
  index.refresh().then(r => { mirror.setReady(); return syncSearch(r); });
  require('./sessions').pruneImages();
  if (!SELFTEST) updater.start();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
// Çalışan bir Claude turu varken kapatmak turu yarıda keser: önce sor (güncelleme kurulumu zaten arayüzde sordu)
app.on('before-quit', e => {
  if (!quitConfirmed && !SELFTEST && runner.active().length && win && !win.isDestroyed()) {
    e.preventDefault();
    const n = runner.active().length;
    dialog.showMessageBox(win, { type: 'warning', buttons: ['Kapat', 'Vazgeç'], defaultId: 1, cancelId: 1, title: 'Claude Panel',
      message: `${n} sohbet şu an çalışıyor.`, detail: 'Kapatırsan bu turlar yarıda kesilir. Yine de kapatılsın mı?' })
      .then(r => { if (r.response === 0) { quitConfirmed = true; app.quit(); } });
    return;
  }
  runner.stopAll(); mirror.flush();
});
