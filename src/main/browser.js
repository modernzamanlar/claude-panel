// Tarayıcı paneli (önizleme): yerel geliştirme sunucularını ve web sayfalarını uygulamanın içinde gösterir.
// Sayfa ana pencereye eklenen bir WebContentsView'da açılır; arayüz yalnızca yer tutucunun konumunu bildirir.
// Güvenlik: ayrı kalıcı oturum (persist:onizleme), preload yok, nodeIntegration kapalı, contextIsolation + sandbox açık.
// Yalnızca http/https adresleri açılır; yeni pencereler sistem tarayıcısına gider; izin istekleri ve indirmeler reddedilir.
// Electron nesneleri dışarıdan verilir (createBrowser), böylece modülün tamamı node'da sahte nesnelerle test edilebilir.

const PARTITION = 'persist:onizleme';
// Şema yazılmadan girilen yerel adresler http ile açılır (geliştirme sunucularında https genelde yoktur)
const LOCAL_HOST_RX = /^(localhost|.+\.localhost|127(\.\d{1,3}){3}|0\.0\.0\.0|\[::1\]|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2})$/i;

// Kullanıcının yazdığı adresi açılabilir tam adrese çevirir; açılamayacaksa null döner.
// "localhost:3000" → http://localhost:3000/, "example.com" → https://example.com/, javascript:/file:/data: → null
function normalizeUrl(input) {
  if (typeof input !== 'string') return null;
  let s = input.trim();
  if (!s || s.length > 4096 || /\s/.test(s)) return null;
  const sch = /^([a-z][a-z0-9+.-]*):(.*)$/i.exec(s);
  // "localhost:3000/x" bir şema değil, ana makine + bağlantı noktasıdır
  const hasScheme = sch && !/^\d+([/?#]|$)/.test(sch[2]);
  if (hasScheme) {
    if (!/^https?$/i.test(sch[1])) return null;
  } else {
    if (s.startsWith('//')) s = s.slice(2);
    const host = s.split(/[/?#]/)[0].replace(/:\d*$/, '');
    if (!host || (!LOCAL_HOST_RX.test(host) && !host.includes('.'))) return null; // tek kelime: adres değil
    s = (LOCAL_HOST_RX.test(host) ? 'http://' : 'https://') + s;
  }
  return isAllowedUrl(s) ? new URL(s).href : null;
}

// Görünümde açılmasına izin verilen adres mi: yalnızca http/https, ana makine adı dolu, kullanıcı adı/parola yok
function isAllowedUrl(u) {
  let x; try { x = new URL(String(u)); } catch { return false; }
  return (x.protocol === 'http:' || x.protocol === 'https:') && !!x.hostname && !x.username && !x.password;
}

// Görünümün konumu: arayüzün bildirdiği CSS piksel dikdörtgeni → pencere içi DIP (yakınlaştırma çarpanıyla)
function toBounds(r, zoom = 1) {
  if (!r || typeof r !== 'object') return null;
  const n = k => (Number.isFinite(r[k]) ? r[k] : NaN);
  const [x, y, w, h] = ['x', 'y', 'width', 'height'].map(n);
  if ([x, y, w, h].some(Number.isNaN)) return null;
  const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const b = { x: Math.max(0, Math.round(x * z)), y: Math.max(0, Math.round(y * z)), width: Math.max(0, Math.round(w * z)), height: Math.max(0, Math.round(h * z)) };
  return b.width && b.height ? b : null;
}

// Yalnızca selftest: önizlemede açılacak küçük bir yerel sayfa (127.0.0.1, rastgele bağlantı noktası)
function startTestServer(http = require('http')) {
  const page = '<!doctype html><meta charset="utf-8"><title>Önizleme testi</title>' +
    '<body style="font:16px system-ui;margin:40px;background:#fff;color:#222"><h1>Önizleme testi</h1><p>Bu sayfa 127.0.0.1 üzerinden geldi.</p>' +
    '<p><a href="/iki">İkinci sayfa</a></p></body>';
  const srv = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(req.url === '/iki' ? page.replace(/Önizleme testi/g, 'İkinci sayfa') : page);
  });
  return new Promise(resolve => srv.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${srv.address().port}/`, close: () => srv.close() })));
}

// Oturumun izinlerini kapatır, indirmeleri iptal eder (bir kez yapılır)
function hardenSession(ses, onDownload) {
  ses.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  ses.setPermissionCheckHandler(() => false);
  if (ses.setDevicePermissionHandler) ses.setDevicePermissionHandler(() => false);
  ses.on('will-download', (e, item) => { e.preventDefault(); onDownload(item && item.getURL ? item.getURL() : ''); });
  // Aygıt seçicileri (izin kapalıyken zaten gelmez): gelirse seçimsiz kapat
  for (const ev of ['select-hid-device', 'select-serial-port', 'select-usb-device']) ses.on(ev, (e, ...a) => { e.preventDefault(); a[a.length - 1](); });
}

// deps: { getWin, WebContentsView, session, shell, send, now }
function createBrowser(deps) {
  const now = deps.now || Date.now;
  const st = { url: '', title: '', loading: false, canBack: false, canFwd: false, error: null };
  let view = null, owner = null, hardened = false, lastExternal = 0;
  const emit = () => deps.send('browser:state', { ...st });
  const wc = () => view && view.webContents;
  // Sayfanın açtığı pencereler sistem tarayıcısına gider; sayfa bunu art arda tetikleyip tarayıcıyı boğamasın
  const external = u => {
    if (!isAllowedUrl(u) || now() - lastExternal < 1500) return false;
    lastExternal = now(); deps.shell.openExternal(u); return true;
  };
  const nav = () => {
    const h = wc().navigationHistory;
    st.canBack = h.canGoBack(); st.canFwd = h.canGoForward();
  };

  function destroy() {
    if (!view) return;
    const v = view; view = null;
    try { if (owner && !owner.isDestroyed()) owner.contentView.removeChildView(v); } catch {}
    try { if (!v.webContents.isDestroyed()) v.webContents.close(); } catch {}
    owner = null; st.loading = false;
  }

  function ensure() {
    const win = deps.getWin();
    if (!win || win.isDestroyed()) return null;
    if (view && owner === win) return view;
    destroy();
    const ses = deps.session.fromPartition(PARTITION);
    if (!hardened) { hardened = true; hardenSession(ses, u => deps.send('browser:blocked', { kind: 'download', url: isAllowedUrl(u) ? u : '' })); }
    view = new deps.WebContentsView({ webPreferences: {
      session: ses, nodeIntegration: false, contextIsolation: true, sandbox: true, webviewTag: false,
      devTools: false, spellcheck: false, safeDialogs: true, navigateOnDragDrop: false,
    } });
    owner = win;
    view.setBackgroundColor('#ffffff');
    view.setVisible(false);
    win.contentView.addChildView(view);
    const c = view.webContents;
    c.setWindowOpenHandler(({ url }) => { external(url); return { action: 'deny' }; });
    const guard = (e, url) => { if (!isAllowedUrl(url)) { e.preventDefault(); deps.send('browser:blocked', { kind: 'scheme', url: '' }); } };
    c.on('will-navigate', guard);
    c.on('will-redirect', guard);
    c.on('will-attach-webview', e => e.preventDefault());
    c.on('select-bluetooth-device', (e, _list, cb) => { e.preventDefault(); cb(''); });
    c.on('did-start-loading', () => { st.loading = true; st.error = null; emit(); });
    c.on('did-stop-loading', () => { st.loading = false; nav(); emit(); });
    const moved = (_e, url) => { st.url = url; nav(); emit(); };
    c.on('did-navigate', moved);
    c.on('did-navigate-in-page', (e, url, isMain) => { if (isMain) moved(e, url); });
    c.on('page-title-updated', (_e, title) => { st.title = String(title || ''); emit(); });
    // -3: yerine başka bir gezinme geldi (hata değil)
    c.on('did-fail-load', (_e, code, desc, url, isMain) => {
      if (!isMain || code === -3) return;
      st.error = { code, desc: String(desc || ''), url: String(url || '') }; st.loading = false; emit();
    });
    c.on('render-process-gone', (_e, d) => { st.error = { code: 0, desc: 'Sayfa çöktü (' + (d && d.reason) + ')', url: st.url }; st.loading = false; emit(); });
    return view;
  }

  function navigate(input) {
    const u = normalizeUrl(input);
    if (!u) return { ok: false, error: 'Geçersiz adres: yalnızca http/https sayfaları açılır' };
    if (!ensure()) return { ok: false, error: 'Pencere yok' };
    st.url = u; st.title = ''; st.error = null; emit();
    wc().loadURL(u).catch(() => {}); // hata did-fail-load ile bildirilir
    return { ok: true, url: u };
  }

  function command(name) {
    if (name === 'external') return external(st.url);
    const c = wc();
    if (!c) return false;
    const h = c.navigationHistory;
    if (name === 'back' && h.canGoBack()) { h.goBack(); return true; }
    if (name === 'forward' && h.canGoForward()) { h.goForward(); return true; }
    if (name === 'reload') { st.error = null; if (c.getURL()) c.reload(); else if (st.url) c.loadURL(st.url).catch(() => {}); return true; }
    if (name === 'stop') { c.stop(); return true; }
    return false;
  }

  // r: { x, y, width, height } (CSS piksel) ya da null (gizle)
  function setBounds(r) {
    if (!view) return false;
    const win = deps.getWin();
    const b = win && !win.isDestroyed() && owner === win ? toBounds(r, win.webContents.getZoomFactor()) : null;
    if (b) view.setBounds(b);
    view.setVisible(!!b);
    return !!b;
  }

  function hide() { if (view) view.setVisible(false); }

  return { navigate, command, setBounds, hide, destroy, state: () => ({ ...st }), get view() { return view; } };
}

module.exports = { PARTITION, normalizeUrl, isAllowedUrl, toBounds, startTestServer, hardenSession, createBrowser };
