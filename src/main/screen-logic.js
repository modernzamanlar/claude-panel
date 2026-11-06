// Ekran kontrolü — saf mantık (Electron'suz, %100 test kapsamı).
// Koordinat sistemleri:
//  - "görüntü": modelin gördüğü ekran görüntüsü (uzun kenar en çok IMG_MAX px); model tıklarken bunu kullanır
//  - "fiziksel": işletim sisteminin gerçek piksel koordinatları (Windows sanal masaüstü, sol monitörde negatif olabilir)
//  - "dip": Electron'un aygıttan bağımsız pikselleri (kenar penceresi bunu kullanır)
'use strict';

const IMG_MAX = 1280;

/** Ekranları soldan sağa, yukarıdan aşağı sıralar; her birine 0'dan başlayan sıra numarası verir. */
function orderDisplays(displays) {
  const list = (displays || []).filter(d => d && d.phys && d.phys.width > 0 && d.phys.height > 0)
    .slice().sort((a, b) => a.phys.x - b.phys.x || a.phys.y - b.phys.y);
  return list.map((d, index) => ({ ...d, index, img: imageSize(d.phys) }));
}

/** Görüntü boyutu: uzun kenar en çok max px, oran korunur; büyütme yapılmaz. */
function imageSize(phys, max = IMG_MAX) {
  const k = Math.min(1, max / Math.max(phys.width, phys.height));
  return { w: Math.max(1, Math.round(phys.width * k)), h: Math.max(1, Math.round(phys.height * k)), k };
}

const isInt = v => Number.isInteger(v);
const num = v => typeof v === 'number' && Number.isFinite(v);

/** Monitör seçimi: verilen sıra numarası, yoksa son kullanılan, o da yoksa birincil ekran. */
function pickMonitor(list, idx, last) {
  if (!list.length) throw new Error('Ekran bulunamadı');
  if (idx !== undefined && idx !== null) {
    if (!isInt(idx) || idx < 0 || idx >= list.length) throw new Error(`Geçersiz monitör: ${String(idx).slice(0, 20)} (0–${list.length - 1} arası olmalı; ekran_listesi'ne bak)`);
    return list[idx];
  }
  if (isInt(last) && list[last]) return list[last];
  return list.find(d => d.primary) || list[0];
}

/** Görüntü koordinatı → fiziksel piksel. Görüntü dışındaki nokta reddedilir. */
function toPhysical(mon, x, y) {
  if (!num(x) || !num(y)) throw new Error('x ve y sayı olmalı');
  if (x < 0 || y < 0 || x >= mon.img.w || y >= mon.img.h) throw new Error(`Nokta görüntünün dışında: (${x}, ${y}); görüntü ${mon.img.w}×${mon.img.h}`);
  return { x: mon.phys.x + Math.floor(x / mon.img.w * mon.phys.width), y: mon.phys.y + Math.floor(y / mon.img.h * mon.phys.height) };
}

/** Fiziksel piksel → {monitor, x, y} (görüntü koordinatı); hiçbir ekranda değilse null. */
function toImage(list, px, py) {
  const mon = list.find(d => px >= d.phys.x && py >= d.phys.y && px < d.phys.x + d.phys.width && py < d.phys.y + d.phys.height);
  if (!mon) return null;
  return { monitor: mon.index, x: Math.floor((px - mon.phys.x) / mon.phys.width * mon.img.w), y: Math.floor((py - mon.phys.y) / mon.phys.height * mon.img.h) };
}

/** Fiziksel piksel → ekran penceresinin içindeki DIP koordinatı (halka efekti için). */
function toDip(mon, px, py) {
  return { x: Math.round((px - mon.phys.x) / mon.phys.width * mon.bounds.width), y: Math.round((py - mon.phys.y) / mon.phys.height * mon.bounds.height) };
}

/** Yakınlaştırma: görüntü koordinatındaki dikdörtgen → yakalanan tam çözünürlüklü karede kırpma alanı. */
function zoomRect(mon, r, capW, capH) {
  for (const k of ['x', 'y', 'w', 'h']) if (!num(r[k])) throw new Error('x, y, w, h sayı olmalı');
  if (r.w < 4 || r.h < 4) throw new Error('Alan en az 4×4 olmalı');
  const x0 = Math.max(0, r.x), y0 = Math.max(0, r.y), x1 = Math.min(mon.img.w, r.x + r.w), y1 = Math.min(mon.img.h, r.y + r.h);
  if (x1 - x0 < 1 || y1 - y0 < 1) throw new Error('Alan görüntünün dışında');
  const fx = capW / mon.img.w, fy = capH / mon.img.h;
  const x = Math.floor(x0 * fx), y = Math.floor(y0 * fy);
  return { x, y, width: Math.max(1, Math.min(capW - x, Math.round((x1 - x0) * fx))), height: Math.max(1, Math.min(capH - y, Math.round((y1 - y0) * fy))) };
}

// ---- Klavye ----
// Windows sanal tuş kodları
const VK = {
  ctrl: 0x11, control: 0x11, shift: 0x10, alt: 0x12, win: 0x5b, meta: 0x5b, cmd: 0x5b, super: 0x5b,
  enter: 0x0d, return: 0x0d, tab: 0x09, esc: 0x1b, escape: 0x1b, space: 0x20, backspace: 0x08, delete: 0x2e, del: 0x2e, insert: 0x2d, ins: 0x2d,
  home: 0x24, end: 0x23, pageup: 0x21, pgup: 0x21, pagedown: 0x22, pgdn: 0x22,
  left: 0x25, up: 0x26, right: 0x27, down: 0x28, sol: 0x25, yukari: 0x26, sag: 0x27, asagi: 0x28,
  capslock: 0x14, printscreen: 0x2c, menu: 0x5d, apps: 0x5d,
  plus: 0xbb, minus: 0xbd, comma: 0xbc, period: 0xbe,
};
for (let i = 1; i <= 24; i++) VK['f' + i] = 0x6f + i;
const MODS = new Set([0x11, 0x10, 0x12, 0x5b]);
// Panelin acil durdurma kısayolu modele yasak (Ctrl+Alt+Esc); Windows'un güvenlik tuşları zaten SendInput ile gönderilemez
const FORBIDDEN = [[0x11, 0x12, 0x1b], [0x11, 0x12, 0x2e]];

/** "ctrl+shift+s", "alt+f4", "enter" → Windows sanal tuş kodları (önce değiştiriciler, en sonda asıl tuş). */
function parseKeys(s) {
  if (typeof s !== 'string' || !s.trim() || s.length > 60) throw new Error('tus metni boş ya da çok uzun');
  const parts = s.toLowerCase().replace(/\s+/g, '').split('+');
  if (parts.length > 5 || parts.some(p => !p)) throw new Error('Geçersiz tuş birleşimi: ' + s);
  const codes = parts.map(p => {
    if (VK[p] !== undefined) return VK[p];
    if (/^[a-z0-9]$/.test(p)) return p.toUpperCase().charCodeAt(0); // A–Z ve 0–9'un kodu ASCII ile aynı
    throw new Error('Bilinmeyen tuş: ' + p);
  });
  const key = codes[codes.length - 1];
  const mods = codes.slice(0, -1);
  if (mods.some(c => !MODS.has(c))) throw new Error('Yalnız son tuş değiştirici olmayabilir: ' + s);
  const uniq = [...new Set(mods)];
  const all = [...uniq, key];
  if (FORBIDDEN.some(f => f.length === all.length && f.every(c => all.includes(c)))) throw new Error('Bu tuş birleşimi engellendi (panelin acil durdurma / sistem kısayolu)');
  return all;
}

/** Metni yardımcı sürece göndermek için UTF-16 kod birimlerine (onaltılık) çevirir. */
function encodeText(s) {
  return [...String(s)].flatMap(ch => { const c = ch.charCodeAt(0), out = [c]; if (ch.length > 1) out.push(ch.charCodeAt(1)); return out; }).map(c => c.toString(16));
}

// ---- Girdi doğrulama ----
const MOUSE_OPS = new Set(['tasi', 'tikla', 'cift_tikla', 'sag_tikla', 'orta_tikla', 'surukle', 'kaydir']);
function validateMouse(a) {
  a = a || {};
  if (!MOUSE_OPS.has(a.islem)) throw new Error('islem şunlardan biri olmalı: ' + [...MOUSE_OPS].join(', '));
  const out = { islem: a.islem, x: a.x, y: a.y, monitor: a.monitor };
  if (a.islem === 'surukle') {
    if (!num(a.x2) || !num(a.y2)) throw new Error('surukle için x2 ve y2 gerekli');
    out.x2 = a.x2; out.y2 = a.y2;
  }
  if (a.islem === 'kaydir') {
    const m = a.miktar === undefined ? 3 : a.miktar;
    if (!isInt(m) || m === 0 || Math.abs(m) > 30) throw new Error('miktar -30…30 arası sıfır olmayan tam sayı olmalı (pozitif: aşağı/sağa)');
    out.miktar = m; out.yatay = !!a.yatay;
  }
  return out;
}
function validateKeyboard(a) {
  a = a || {};
  const hasText = a.yazi !== undefined, hasKey = a.tus !== undefined;
  if (hasText === hasKey) throw new Error('yazi ya da tus alanlarından yalnız biri verilmeli');
  if (hasText) {
    if (typeof a.yazi !== 'string' || !a.yazi.length) throw new Error('yazi boş olamaz');
    if (a.yazi.length > 4000) throw new Error('yazi en çok 4000 karakter');
    return { yazi: a.yazi };
  }
  return { tus: a.tus, codes: parseKeys(a.tus) };
}
function validateWait(a) {
  const ms = (a || {}).ms;
  if (!isInt(ms) || ms < 0 || ms > 10000) throw new Error('ms 0–10000 arası tam sayı olmalı');
  return ms;
}

// ---- Panel penceresi koruması ----
/**
 * Panelin kendi penceresine tıklama/yazma reddedilir (Claude kendi "Durdur" ya da izin düğmesine basmasın).
 * hit/hitPid: noktadaki en üst pencerenin kökü (Windows HWND, dize) ve süreci; panel: panel HWND'leri; pid: panelin ana süreci
 * (panelin açtığı iletişim kutuları da aynı süreçtedir). inPanelRect: pencere bilinmiyorsa (ör. Mac) panel dikdörtgeni içinde mi.
 */
const ON_PANEL = 'Bu nokta Claude Panel penceresinin üstünde; panelin kendisine tıklanamaz';
function guardPoint({ hit, hitPid, panel, pid, inPanelRect }) {
  if (hit != null) return (panel || []).includes(String(hit)) || (pid != null && String(hitPid) === String(pid)) ? ON_PANEL : null;
  return inPanelRect ? ON_PANEL : null;
}
function guardFocus({ fg, fgPid, panel, pid, panelFocused }) {
  if (panelFocused || (fg != null && (panel || []).includes(String(fg))) || (pid != null && fgPid != null && String(fgPid) === String(pid))) return 'Odak Claude Panel penceresinde; panele yazılamaz. Önce hedef pencereye tıkla.';
  return null;
}
const inRect = (r, x, y) => !!r && x >= r.x && y >= r.y && x < r.x + r.width && y < r.y + r.height;

// ---- Kenar çerçevesi zamanlaması ----
/** Ekranı kullanan çalıştırmalar: son eylemden HIDE_MS sonra ya da tur bitince çerçeve söner. */
class Presence {
  constructor(hideMs = 4000) { this.hideMs = hideMs; this.runs = new Map(); }
  touch(runId, label, monitor, now) { this.runs.set(runId, { label: label || 'Sohbet', monitor, at: now }); }
  end(runId) { return this.runs.delete(runId); }
  clear() { this.runs.clear(); }
  /** Görünür durum: {monitor, labels, until} ya da null (son eylemin ekranı; birden çok sohbet varsa hepsinin adı). */
  state(now) {
    const live = [...this.runs.values()].filter(r => now - r.at < this.hideMs);
    if (!live.length) return null;
    const last = live.reduce((a, b) => (b.at >= a.at ? b : a));
    return { monitor: last.monitor, labels: [...new Set(live.map(r => r.label))], until: Math.max(...live.map(r => r.at)) + this.hideMs };
  }
}

// ---- Günlük ----
/** Günlük satırı: yazılan metnin kendisi değil yalnız uzunluğu yazılır. */
function logEntry(tool, args, now, extra) {
  const a = args || {};
  const e = { t: new Date(now).toISOString(), arac: tool };
  for (const k of ['islem', 'monitor', 'x', 'y', 'x2', 'y2', 'w', 'h', 'miktar', 'tus', 'ms']) if (a[k] !== undefined) e[k] = a[k];
  if (typeof a.yazi === 'string') e.yaziUzunlugu = a.yazi.length;
  return JSON.stringify(Object.assign(e, extra || {}));
}

module.exports = { IMG_MAX, orderDisplays, imageSize, pickMonitor, toPhysical, toImage, toDip, zoomRect, parseKeys, encodeText,
  validateMouse, validateKeyboard, validateWait, guardPoint, guardFocus, inRect, Presence, logEntry, VK };
