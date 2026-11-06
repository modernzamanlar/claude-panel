// Ekran kontrolü çerçevesi: kullanılan monitörü kaplayan şeffaf, çerçevesiz, her zaman üstte, tıklama geçiren,
// odak almayan, görev çubuğunda görünmeyen pencere. setContentProtection(true) ile Claude'un ekran görüntülerine girmez
// (Windows 10 2004+ WDA_EXCLUDEFROMCAPTURE). CLAUDE_PANEL_OVERLAY_CAPTURE=1 yalnız test içindir: çerçeve görüntüde görünür.
'use strict';
const path = require('path');

function createOverlay({ BrowserWindow, platform = process.platform, visibleInCapture = process.env.CLAUDE_PANEL_OVERLAY_CAPTURE === '1' }) {
  let w = null, loaded = false, queue = [], bounds = null, hideTimer = null;
  const shortcut = platform === 'darwin' ? 'Ctrl+Option+Esc' : 'Ctrl+Alt+Esc';
  function ensure() {
    if (w && !w.isDestroyed()) return w;
    loaded = false; queue = []; bounds = null;
    w = new BrowserWindow({
      show: false, frame: false, transparent: true, resizable: false, movable: false, minimizable: false, maximizable: false,
      focusable: false, skipTaskbar: true, alwaysOnTop: true, hasShadow: false, fullscreenable: false, backgroundColor: '#00000000',
      title: 'Claude Panel ekran kontrolü',
      webPreferences: { preload: path.join(__dirname, '..', 'overlay-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: false, backgroundThrottling: false },
    });
    w.setAlwaysOnTop(true, 'screen-saver');
    w.setIgnoreMouseEvents(true);
    w.setContentProtection(!visibleInCapture);
    if (platform === 'darwin') try { w.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch {}
    w.webContents.on('will-navigate', e => e.preventDefault());
    w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    w.webContents.once('did-finish-load', () => { loaded = true; for (const m of queue) w.webContents.send('ov', m); queue = []; });
    w.loadFile(path.join(__dirname, '..', 'renderer', 'overlay.html'));
    w.on('closed', () => { w = null; });
    return w;
  }
  const post = m => { if (!w || w.isDestroyed()) return; if (loaded) w.webContents.send('ov', m); else queue.push(m); };
  const same = (a, b) => a && b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
  return {
    shortcut,
    /** st: {monitor, labels, bounds(DIP)} — çerçeve o monitöre taşınır. */
    show(st) {
      clearTimeout(hideTimer);
      const win = ensure();
      if (!same(bounds, st.bounds)) { bounds = { ...st.bounds }; win.setBounds(bounds); }
      post({ type: 'show', labels: st.labels, shortcut });
      if (!win.isVisible()) { win.showInactive(); win.setAlwaysOnTop(true, 'screen-saver'); }
    },
    hide() {
      if (!w || w.isDestroyed() || !w.isVisible()) return;
      post({ type: 'hide' });
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => { if (w && !w.isDestroyed()) w.hide(); }, 500); // CSS solma süresi
    },
    ring(_mon, p, kind) { post({ type: 'ring', x: p.x, y: p.y, kind }); },
    trail(_mon, a, b) { post({ type: 'trail', a, b }); },
    // setContentProtection çerçeveyi görüntü dışında tuttuğu için yakalamadan önce gizlemeye gerek yok
    beforeCapture() {},
    afterCapture() {},
    /** Panel koruması için: çerçeve penceresinin HWND'si (dize). */
    hwnds() { return w && !w.isDestroyed() ? [hwndOf(w)] : []; },
    destroy() { clearTimeout(hideTimer); if (w && !w.isDestroyed()) w.destroy(); w = null; },
    get window() { return w; },
  };
}

/** BrowserWindow → HWND (Windows) / NSView işaretçisi (Mac) ondalık dize. */
function hwndOf(win) {
  const b = win.getNativeWindowHandle();
  return b.length >= 8 ? b.readBigUInt64LE(0).toString() : String(b.readUInt32LE(0));
}

module.exports = { createOverlay, hwndOf };
