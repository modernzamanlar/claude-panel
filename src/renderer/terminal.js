// Terminal çekmecesi: bölmelerin altında açılır (üst çubuk düğmesi ya da ⌃`), etkin bölmedeki sohbetin klasöründe komut çalıştırır.
// Komutlar ana süreçte tek tek başlatılır (main/term.js); çıktı ansi.js ekranında tutulur ve yalnızca değişen satırlar çizilir.
// Bölmelere dokunmaz: çekmece #grid'in kardeşidir, açılıp kapanınca bölmeler yalnızca yeniden boyutlanır; çıktı geldiğinde odak alınmaz.
// app.js'den S ve sess kullanılır (aynı genel kapsam); app.js yalnızca renderRail sonunda TERM.sync() çağırır.
(function () {
  const API = window.api;
  const el = document.getElementById('trm');
  const btn = document.getElementById('btnTerm');
  if (!el || !API || !API.term) return;
  const IS_MAC = !API.platform || API.platform === 'darwin';
  const svg = d => `<svg class="i" viewBox="0 0 24 24">${d}</svg>`;
  el.innerHTML = `<div class="trm-grip" title="Yüksekliği değiştir"></div>
    <div class="trm-h">${svg('<path d="m4 17 6-6-6-6M12 19h8"/>')}<b>Terminal</b><span class="trm-cwd mono"></span><span class="grow"></span>
      <span class="trm-st"></span>
      <button class="btn trm-stop" disabled title="Çalışan komutu durdur (⌃C)">${svg('<rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none"/>')}Durdur</button>
      <button class="btn trm-clear" title="Çıktıyı temizle">Temizle</button>
      <button class="ibtn trm-x" title="Kapat (⌃\`)">${svg('<path d="M18 6 6 18M6 6l12 12"/>')}</button></div>
    <div class="trm-out mono" tabindex="-1"></div>
    <div class="trm-in"><span class="trm-ps">❯</span><input class="mono" spellcheck="false" autocomplete="off"
      placeholder="Komut yaz · ↵ çalıştır · ↑↓ geçmiş · ⌃C durdur — etkileşimli / tam ekran programlar (vim, top, parola soran komutlar) çalışmaz"></div>`;
  const q = s => el.querySelector(s);
  const out = q('.trm-out'), inp = q('.trm-in input'), cwdEl = q('.trm-cwd'), stEl = q('.trm-st'), stopBtn = q('.trm-stop');
  const screen = new window.ansi.Screen(5000);
  const hist = []; let hi = 0, draft = '';
  let cur = null;       // çalışan komut: {id, cmd, t0}
  let raf = 0;

  const folder = () => { const s = typeof sess === 'function' ? sess(S.panes[S.active]) : null; return s ? (s.cwd || s.project || null) : null; };
  const base = p => String(p).replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p;
  function sync() {
    if (el.hidden) return;
    const f = folder();
    cwdEl.textContent = f || 'Etkin bölmede sohbet yok';
    cwdEl.title = f || '';
  }
  function paint() {
    raf = 0;
    const { drop, from, lines } = screen.take();
    const atEnd = out.scrollHeight - out.scrollTop - out.clientHeight < 24;
    for (let n = Math.min(drop, out.childElementCount); n > 0; n--) out.firstElementChild.remove();
    while (out.childElementCount > from) out.lastElementChild.remove();
    if (lines.length) out.insertAdjacentHTML('beforeend', lines.map(h => '<div>' + h + '</div>').join(''));
    if (atEnd) out.scrollTop = out.scrollHeight;
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(paint); };
  function status() {
    stopBtn.disabled = !cur;
    stEl.innerHTML = cur ? '<span class="spin"></span>çalışıyor' : '';
  }
  const secs = ms => (ms / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' sn';

  async function run() {
    const cmd = inp.value;
    if (!cmd.trim()) return;
    if (cur) { window.toast && toast('Önce çalışan komutu durdur (⌃C)'); return; }
    if (hist[hist.length - 1] !== cmd) hist.push(cmd);
    if (hist.length > 100) hist.shift();
    hi = hist.length; draft = ''; inp.value = '';
    const f = folder();
    screen.resetStreams();
    screen.meta((f ? base(f) + ' ' : '') + '❯ ' + cmd, 'trm-cmd');
    if (!f) { screen.meta('Etkin bölmede sohbet yok: komut bir sohbetin klasöründe çalışır.', 'trm-bad'); schedule(); return; }
    const id = crypto.randomUUID();
    cur = { id, cmd, t0: Date.now() }; status(); schedule();
    try { await API.term.run({ id, cwd: f, cmd }); }
    catch (e) {
      if (cur && cur.id === id) cur = null;
      screen.meta(String(e && e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), 'trm-bad');
      status(); schedule();
    }
  }
  function stop() { if (cur) API.term.stop(cur.id); }
  function clear() { screen.clear(); out.textContent = ''; }

  API.term.onEvent(ev => {
    if (!ev || !cur || ev.id !== cur.id) return;
    if (ev.type === 'out') { for (const [s, t] of ev.chunks || []) screen.write(t, s); }
    else if (ev.type === 'exit') {
      const t = secs(ev.ms || 0);
      if (ev.error) screen.meta('Başlatılamadı: ' + ev.error, 'trm-bad');
      else if (ev.stopped) screen.meta('■ Durduruldu · ' + t, 'trm-bad');
      else if (ev.code === 0) screen.meta('✓ çıkış kodu 0 · ' + t, 'trm-ok');
      else screen.meta('✗ çıkış kodu ' + (ev.code ?? ev.signal) + ' · ' + t, 'trm-bad');
      cur = null; status();
    }
    schedule();
  });

  function toggle(v) {
    const open = v ?? el.hidden;
    el.hidden = !open;
    if (btn) btn.classList.toggle('on', open);
    if (open) { sync(); schedule(); inp.focus(); }
  }

  inp.addEventListener('keydown', e => {
    // Bölmelerin kısayolları (Esc = turu durdur, ↵ = gönder…) terminal satırında çalışmasın; ⌘/Ctrl kısayolları geçer
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); run(); return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault(); e.stopPropagation();
      if (!hist.length) return;
      if (hi === hist.length) draft = inp.value;
      hi = Math.max(0, Math.min(hist.length, hi + (e.key === 'ArrowUp' ? -1 : 1)));
      inp.value = hi === hist.length ? draft : hist[hi];
      inp.setSelectionRange(inp.value.length, inp.value.length);
      return;
    }
    // Ctrl+C: seçili metin varsa kopyalar (Windows), yoksa çalışan komutu durdurur
    if (e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'c' && inp.selectionStart === inp.selectionEnd) { e.preventDefault(); e.stopPropagation(); stop(); return; }
    if (e.key === 'Escape') e.stopPropagation();
  });
  el.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('.trm-stop')) stop();
    else if (t.closest('.trm-clear')) { clear(); inp.focus(); }
    else if (t.closest('.trm-x')) toggle(false);
    else if (t.closest('.trm-in')) inp.focus();
  });
  if (btn) btn.addEventListener('click', () => toggle());
  // ⌃` (Mac'te de Control): üst çubuk düğmesiyle aynı
  window.addEventListener('keydown', e => {
    if (e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && (e.code === 'Backquote' || e.key === '`')) { e.preventDefault(); e.stopPropagation(); toggle(); }
  }, true);
  // Yükseklik: üst kenardan sürükle
  q('.trm-grip').addEventListener('pointerdown', e => {
    e.preventDefault();
    const g = e.currentTarget, y0 = e.clientY, h0 = el.offsetHeight, max = Math.max(160, el.parentElement.clientHeight * 0.75);
    g.setPointerCapture(e.pointerId);
    const mv = ev => { el.style.height = Math.round(Math.min(max, Math.max(110, h0 + y0 - ev.clientY))) + 'px'; };
    const up = () => { g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up); };
    g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
  });
  if (!IS_MAC) q('.trm-in input').placeholder = q('.trm-in input').placeholder.replace(/⌃/g, 'Ctrl+');

  window.TERM = { sync, toggle, get open() { return !el.hidden; }, get running() { return !!cur; } };
})();
