// Ekran kontrolünü Electron'a bağlar: ekran listesi (DIP + fiziksel), desktopCapturer ile görüntü, kenar çerçevesi,
// acil durdurma kısayolu (yalnız ekran kontrolü sırasında kayıtlı) ve Runner kancası.
'use strict';
const path = require('path');
const { createScreenControl } = require('./screenctl');
const { createInput } = require('./screenctl-input');
const { createOverlay, hwndOf } = require('./overlay');

const ACCEL = 'Control+Alt+Escape'; // Mac'te Ctrl+Option+Esc

function setupScreen({ BrowserWindow, screen, desktopCapturer, globalShortcut, getWin, runner, logDir, notify, titleFor }) {
  const isWin = process.platform === 'win32';
  const overlay = createOverlay({ BrowserWindow });
  const phys = r => (isWin ? screen.dipToScreenRect(null, r) : r);
  const sc = createScreenControl({
    displays: () => {
      const primary = screen.getPrimaryDisplay().id;
      return screen.getAllDisplays().map(d => ({ id: d.id, name: d.label || '', primary: d.id === primary, bounds: d.bounds, scale: d.scaleFactor, phys: phys(d.bounds) }));
    },
    async capture(id, w, h) {
      const src = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: w, height: h } });
      const s = src.find(x => String(x.display_id) === String(id)) || (src.length === 1 ? src[0] : null);
      return s && !s.thumbnail.isEmpty() ? s.thumbnail : null;
    },
    input: createInput(),
    panel() {
      const win = getWin();
      const ok = win && !win.isDestroyed();
      return {
        hwnds: ok ? [hwndOf(win)] : [], overlay: overlay.hwnds(), pid: process.pid,
        rect: ok && win.isVisible() && !win.isMinimized() ? phys(win.getBounds()) : null, focused: ok && win.isFocused(),
      };
    },
    overlay,
    onActive(on) {
      if (on) { if (!globalShortcut.isRegistered(ACCEL) && !globalShortcut.register(ACCEL, () => sc.emergencyStop())) console.warn('acil durdurma kısayolu kaydedilemedi: ' + ACCEL); }
      else globalShortcut.unregister(ACCEL);
    },
    onEmergency(ids) {
      for (const id of ids) runner.stop(id);
      notify({ runIds: ids, shortcut: overlay.shortcut });
    },
    logFile: path.join(logDir, 'ekran-gunlugu.log'),
  });
  runner.screen = {
    async register(runId, info) {
      await sc.start();
      return sc.register(runId, (info.sessionId && titleFor(info.sessionId)) || path.basename(info.cwd || '') || 'Sohbet');
    },
    release: id => sc.release(id),
  };
  return { sc, overlay, close() { globalShortcut.unregister(ACCEL); sc.close(); overlay.destroy(); } };
}

module.exports = { setupScreen, ACCEL };
