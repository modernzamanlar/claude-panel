// Ekran kontrolü — panelin kendi MCP sunucusu (Streamable HTTP, yalnız 127.0.0.1).
// Claude Code CLI 2.1.x'in yerleşik computer-use aracı yalnız macOS'ta ("@ant/computer-use-swift is only available on macOS"),
// bu yüzden Windows'ta ekranı görmek ve fare/klavye kullanmak için panel bu sunucuyu "Kontrol" açık çalıştırmalara
// --mcp-config ile ekler ({type:'http', url, headers:{Authorization:'Bearer …'}}).
// Güvenlik: yalnız loopback soket + Host denetimi (DNS yeniden bağlama), tarayıcı Origin'i ret, her açılışta rastgele
// 32 baytlık taşıyıcı anahtar, çalıştırma başına rastgele yol anahtarı (yalnız o tur sürerken geçerli).
// Panelin kendi penceresine tıklama/yazma reddedilir; her eylem ~/.claude-panel/ekran-gunlugu.log'a yazılır.
'use strict';
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const L = require('./screen-logic');

const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const MAX_BODY = 1 << 20;

const monitorProp = { type: 'integer', minimum: 0, description: 'Monitör sıra numarası (ekran_listesi). Verilmezse son kullanılan, o da yoksa birincil ekran.' };
const TOOLS = [
  { name: 'ekran_listesi', description: 'Bağlı monitörleri listeler (sıra numarası, birincil mi, görüntü ve fiziksel boyut, ölçek).', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'ekran_goruntusu', description: `Bir monitörün ekran görüntüsünü alır (uzun kenar en çok ${L.IMG_MAX} px). fare aracındaki x/y bu görüntünün piksel koordinatlarıdır.`, inputSchema: { type: 'object', properties: { monitor: monitorProp }, additionalProperties: false } },
  { name: 'yakinlastir', description: 'Ekran görüntüsündeki bir alanı tam çözünürlükte gösterir (küçük düğme/yazı için). x,y,w,h ekran_goruntusu koordinatlarıdır; tıklarken yine ekran_goruntusu koordinatlarını kullan.', inputSchema: { type: 'object', properties: { monitor: monitorProp, x: { type: 'number' }, y: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' } }, required: ['x', 'y', 'w', 'h'], additionalProperties: false } },
  { name: 'fare', description: 'Fareyi kullanır: tasi, tikla, cift_tikla, sag_tikla, orta_tikla, surukle (x,y → x2,y2), kaydir (miktar: pozitif aşağı; yatay:true ile sağa). Koordinatlar ekran_goruntusu görüntüsündedir. Claude Panel penceresine tıklanamaz.', inputSchema: { type: 'object', properties: { islem: { type: 'string', enum: ['tasi', 'tikla', 'cift_tikla', 'sag_tikla', 'orta_tikla', 'surukle', 'kaydir'] }, x: { type: 'number' }, y: { type: 'number' }, x2: { type: 'number' }, y2: { type: 'number' }, miktar: { type: 'integer' }, yatay: { type: 'boolean' }, monitor: monitorProp, sonra_goruntu: { type: 'boolean', description: 'Eylemden sonra küçük bir ekran görüntüsü döndür' } }, required: ['islem', 'x', 'y'], additionalProperties: false } },
  { name: 'klavye', description: 'Odaktaki pencereye yazar (yazi: Türkçe karakterler dahil metin) ya da tuş/kısayol basar (tus: "enter", "ctrl+s", "alt+f4", "ctrl+shift+left"). İkisinden yalnız biri. Odak Claude Panel\'deyse reddedilir.', inputSchema: { type: 'object', properties: { yazi: { type: 'string' }, tus: { type: 'string' }, sonra_goruntu: { type: 'boolean' } }, additionalProperties: false } },
  { name: 'imlec_konumu', description: 'Fare imlecinin konumu (monitör ve ekran_goruntusu koordinatı).', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'bekle', description: 'Belirtilen süre bekler (ms, en çok 10000) — arayüzün yüklenmesini beklemek için.', inputSchema: { type: 'object', properties: { ms: { type: 'integer', minimum: 0, maximum: 10000 } }, required: ['ms'], additionalProperties: false } },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const text = t => ({ content: [{ type: 'text', text: t }] });

/**
 * deps:
 *  displays(): [{id, name, primary, bounds(DIP), phys(fiziksel)}]
 *  capture(displayId, w, h): Promise<NativeImage benzeri {getSize, resize, crop, toJPEG}>
 *  input: screenctl-input createInput() sonucu
 *  panel(): {hwnds:[dize], overlay:[dize], pid, rect(fiziksel)|null, focused}
 *  overlay: {show({monitor, labels}), ring(mon, dip, kind), trail(mon, dipA, dipB), hide()}
 *  onActive(bool): acil durdurma kısayolunu kaydet/kaldır
 *  onEmergency(runIds): çalıştırmaları durdur
 *  logFile, now, hideMs, actionDelay
 */
function createScreenControl(deps) {
  const now = deps.now || Date.now;
  const presence = new L.Presence(deps.hideMs || 4000);
  const token = crypto.randomBytes(32).toString('base64url');
  const runs = new Map();   // yol anahtarı -> {runId, label, last}
  const byRun = new Map();  // runId -> yol anahtarı
  const stopped = new Set();
  let server = null, port = 0, hideTimer = null, active = false;

  function log(tool, args, extra) {
    if (!deps.logFile) return;
    try {
      fs.mkdirSync(path.dirname(deps.logFile), { recursive: true });
      try { if (fs.statSync(deps.logFile).size > 512 * 1024) fs.renameSync(deps.logFile, deps.logFile + '.1'); } catch {}
      fs.appendFileSync(deps.logFile, L.logEntry(tool, args, now(), extra) + '\n', { mode: 0o600 });
    } catch {}
  }
  const monitors = () => L.orderDisplays(deps.displays());

  function setActive(on) { if (on !== active) { active = on; try { deps.onActive(on); } catch {} } }
  function refreshOverlay() {
    clearTimeout(hideTimer);
    const st = presence.state(now());
    const mon = st && monitors()[st.monitor];
    if (!mon) { deps.overlay.hide(); return; } // süre doldu ya da monitör çıkarıldı
    deps.overlay.show({ ...st, bounds: mon.bounds });
    hideTimer = setTimeout(refreshOverlay, Math.max(50, st.until - now() + 20));
    if (hideTimer.unref) hideTimer.unref();
  }
  function touch(r, mon) {
    r.last = mon.index;
    presence.touch(r.runId, r.label, mon.index, now());
    setActive(true);
    refreshOverlay();
  }

  async function shot(mon, max) {
    const size = max ? L.imageSize(mon.phys, max) : mon.img;
    await deps.overlay.beforeCapture();
    let img;
    try { img = await deps.capture(mon.id, size.w, size.h); }
    finally { deps.overlay.afterCapture(); }
    if (!img) throw new Error('Ekran görüntüsü alınamadı (monitör ' + mon.index + ')');
    const s = img.getSize();
    if (s.width !== size.w || s.height !== size.h) img = img.resize({ width: size.w, height: size.h, quality: 'good' });
    return img;
  }
  const imgContent = img => ({ type: 'image', data: img.toJPEG(80).toString('base64'), mimeType: 'image/jpeg' });

  async function guardAt(p) {
    const pw = deps.panel();
    const [hit, hitPid] = await deps.input.send('hit', p.x, p.y);
    const known = hit && hit !== '0' && !(pw.overlay || []).includes(hit) ? hit : null;
    const err = L.guardPoint({ hit: known, hitPid, panel: pw.hwnds, pid: pw.pid, inPanelRect: L.inRect(pw.rect, p.x, p.y) });
    if (err) throw new Error(err);
  }

  async function after(r, mon, want) {
    if (!want) return [];
    await sleep(deps.actionDelay ?? 350);
    return [imgContent(await shot(mon, 800))];
  }

  const handlers = {
    async ekran_listesi() {
      const list = monitors();
      return text(JSON.stringify(list.map(m => ({ monitor: m.index, ad: m.name || null, birincil: !!m.primary, goruntu: `${m.img.w}x${m.img.h}`, fiziksel: `${m.phys.width}x${m.phys.height}`, konum: `${m.phys.x},${m.phys.y}`, olcek: m.scale || 1 })), null, 1));
    },
    async ekran_goruntusu(r, a) {
      const mon = L.pickMonitor(monitors(), a.monitor, r.last);
      touch(r, mon);
      const img = await shot(mon);
      let cur = '';
      try { const p = await deps.input.send('pos'); const c = L.toImage(monitors(), +p[0], +p[1]); if (c && c.monitor === mon.index) cur = ` İmleç: (${c.x}, ${c.y}).`; } catch {}
      return { content: [imgContent(img), { type: 'text', text: `Monitör ${mon.index}: görüntü ${mon.img.w}×${mon.img.h} (fiziksel ${mon.phys.width}×${mon.phys.height}). fare için bu görüntünün koordinatlarını kullan.${cur}` }] };
    },
    async yakinlastir(r, a) {
      const mon = L.pickMonitor(monitors(), a.monitor, r.last);
      L.zoomRect(mon, a, mon.phys.width, mon.phys.height); // önce doğrula
      touch(r, mon);
      const full = await shot(mon, Math.max(mon.phys.width, mon.phys.height));
      const s = full.getSize();
      const crop = full.crop(L.zoomRect(mon, a, s.width, s.height));
      return { content: [imgContent(crop), { type: 'text', text: `Monitör ${mon.index}, alan (${a.x}, ${a.y}) ${a.w}×${a.h} tam çözünürlükte. Tıklarken ekran_goruntusu koordinatlarını kullan.` }] };
    },
    async fare(r, a) {
      const v = L.validateMouse(a);
      const mon = L.pickMonitor(monitors(), v.monitor, r.last);
      const p = L.toPhysical(mon, v.x, v.y);
      const p2 = v.islem === 'surukle' ? L.toPhysical(mon, v.x2, v.y2) : null;
      if (v.islem !== 'tasi') { await guardAt(p); if (p2) await guardAt(p2); }
      touch(r, mon);
      const dip = L.toDip(mon, p.x, p.y);
      { if (p2) deps.overlay.trail(mon, dip, L.toDip(mon, p2.x, p2.y)); else deps.overlay.ring(mon, dip, v.islem); }
      const I = deps.input;
      if (v.islem === 'tasi') await I.send('move', p.x, p.y);
      else if (v.islem === 'tikla') await I.send('click', p.x, p.y, 1, 1);
      else if (v.islem === 'cift_tikla') await I.send('click', p.x, p.y, 1, 2);
      else if (v.islem === 'sag_tikla') await I.send('click', p.x, p.y, 2, 1);
      else if (v.islem === 'orta_tikla') await I.send('click', p.x, p.y, 3, 1);
      else if (p2) await I.send('drag', p.x, p.y, p2.x, p2.y, 20);
      else await I.send('wheel', p.x, p.y, v.miktar, v.yatay ? 1 : 0);
      return { content: [{ type: 'text', text: `Tamam: ${v.islem} (${v.x}, ${v.y})${p2 ? ` → (${v.x2}, ${v.y2})` : ''}, monitör ${mon.index}.` }, ...await after(r, mon, a.sonra_goruntu)] };
    },
    async klavye(r, a) {
      const v = L.validateKeyboard(a);
      const pw = deps.panel();
      const [fg, fgPid] = await deps.input.send('fg');
      const err = L.guardFocus({ fg, fgPid, panel: pw.hwnds, pid: pw.pid, panelFocused: pw.focused });
      if (err) throw new Error(err);
      const list = monitors();
      const mon = L.pickMonitor(list, undefined, r.last);
      touch(r, mon);
      if (v.codes) await deps.input.send('keys', ...v.codes);
      else for (let i = 0; i < v.yazi.length; i += 200) await deps.input.send('text', ...L.encodeText(v.yazi.slice(i, i + 200)));
      return { content: [{ type: 'text', text: v.codes ? `Tamam: ${v.tus}` : `Tamam: ${v.yazi.length} karakter yazıldı.` }, ...await after(r, mon, a.sonra_goruntu)] };
    },
    async imlec_konumu() {
      const p = await deps.input.send('pos');
      const c = L.toImage(monitors(), +p[0], +p[1]);
      return text(c ? JSON.stringify({ monitor: c.monitor, x: c.x, y: c.y }) : 'İmleç hiçbir monitörde değil');
    },
    async bekle(r, a) { await sleep(L.validateWait(a)); return text('Beklendi'); },
  };

  async function callTool(r, name, args) {
    if (!Object.prototype.hasOwnProperty.call(handlers, name)) return { isError: true, content: [{ type: 'text', text: 'Bilinmeyen araç: ' + String(name).slice(0, 40) }] };
    if (stopped.has(r.runId)) return { isError: true, content: [{ type: 'text', text: 'Ekran kontrolü kullanıcı tarafından durduruldu (Ctrl+Alt+Esc). Ekranı kullanmaya devam etme.' }] };
    const a = args && typeof args === 'object' && !Array.isArray(args) ? args : {};
    try {
      const res = await handlers[name](r, a);
      log(name, a, { runId: r.runId });
      return res;
    } catch (e) {
      log(name, a, { runId: r.runId, hata: String(e.message).slice(0, 160) });
      return { isError: true, content: [{ type: 'text', text: String(e.message || e) }] };
    }
  }

  async function rpc(r, msg) {
    if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return { jsonrpc: '2.0', id: msg && msg.id !== undefined ? msg.id : null, error: { code: -32600, message: 'Geçersiz istek' } };
    const isNote = msg.id === undefined || msg.id === null;
    const ok = result => (isNote ? null : { jsonrpc: '2.0', id: msg.id, result });
    const p = msg.params || {};
    switch (msg.method) {
      case 'initialize': return ok({ protocolVersion: PROTOCOLS.includes(p.protocolVersion) ? p.protocolVersion : PROTOCOLS[0], capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'claude-panel-ekran', version: '1.0.0' },
        instructions: 'Claude Panel ekran kontrolü: önce ekran_goruntusu al, eylemden sonra doğrula, küçük öğelerde yakinlastir kullan. Kullanıcı Ctrl+Alt+Esc ile durdurabilir.' });
      case 'ping': return ok({});
      case 'tools/list': return ok({ tools: TOOLS });
      case 'tools/call': return ok(await callTool(r, p.name, p.arguments));
      default:
        if (isNote) return null;
        return { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Yöntem yok: ' + msg.method.slice(0, 60) } };
    }
  }

  const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
  const LOOP = new Set(['127.0.0.1', '::ffff:127.0.0.1', '::1']);
  function handle(req, res) {
    const end = (code, body, type) => { res.writeHead(code, { 'Content-Type': type || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(body || ''); };
    if (!LOOP.has(req.socket.remoteAddress)) return end(403, 'yalnız yerel');
    if (req.headers.host !== `127.0.0.1:${port}`) return end(403, 'host');
    if (req.headers.origin) return end(403, 'origin');
    const m = /^\/mcp\/([A-Za-z0-9_-]{16,64})$/.exec(req.url || '');
    const r = m && runs.get(m[1]);
    if (!r) return end(404, 'yok');
    const auth = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    if (!auth || !safeEq(auth[1], token)) return end(401, 'anahtar');
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return end(405, 'yalnız POST'); }
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { end(413, 'büyük'); req.destroy(); } else chunks.push(c); });
    req.on('end', async () => {
      if (size > MAX_BODY) return;
      let body; try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return end(400, JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON bozuk' } }), 'application/json'); }
      const batch = Array.isArray(body);
      const out = (await Promise.all((batch ? body : [body]).map(x => rpc(r, x)))).filter(Boolean);
      if (!out.length) return end(202);
      end(200, JSON.stringify(batch ? out : out[0]), 'application/json');
    });
  }

  return {
    get port() { return port; },
    get token() { return token; },
    start() {
      if (server) return Promise.resolve(port);
      server = http.createServer(handle);
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => { port = server.address().port; resolve(port); });
      });
    },
    /** Kontrol açık bir çalıştırma için MCP girdisi (yalnız o tur sürerken geçerli). */
    register(runId, label) {
      if (!port) throw new Error('Ekran sunucusu başlamadı');
      const key = crypto.randomBytes(18).toString('base64url');
      runs.set(key, { runId, label: label || 'Sohbet', last: null });
      byRun.set(runId, key);
      return { type: 'http', url: `http://127.0.0.1:${port}/mcp/${key}`, headers: { Authorization: 'Bearer ' + token } };
    },
    /** Tur bitti: yol anahtarı geçersiz olur, çerçeve söner. */
    release(runId) {
      const key = byRun.get(runId); if (key) runs.delete(key);
      byRun.delete(runId); stopped.delete(runId); presence.end(runId);
      if (!presence.runs.size) setActive(false);
      refreshOverlay();
    },
    /** Acil durdurma: bekleyen girdiler iptal, ekranı kullanan turlar durdurulur, çerçeve kalkar. */
    emergencyStop() {
      const ids = [...presence.runs.keys()];
      for (const id of ids) stopped.add(id);
      deps.input.cancel();
      presence.clear(); setActive(false); refreshOverlay();
      log('acil_durdurma', {}, { runlar: ids.length });
      try { deps.onEmergency(ids); } catch {}
      return ids;
    },
    close() { clearTimeout(hideTimer); if (server) server.close(); server = null; port = 0; deps.input.close(); },
    _test: { presence, runs, handlers, rpc },
  };
}

module.exports = { createScreenControl, TOOLS };
