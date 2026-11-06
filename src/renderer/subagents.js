// Alt ajan görünümü: Agent/Task araç satırının altında katlanabilir blok. Blok bilgisi (`sa`) araç bloğunda durur:
// {id (araç çağrısı kimliği), ty (ajan türü), d (açıklama), st ('run'|'done'|'err'|'stop'), bg, tools, ms, b (canlı akışta
// alt ajanın metin/araç blokları), cut (sığmadığı için atılan eski blok sayısı)}.
// Geçmiş sohbette alt ajanın içeriği yalnızca blok açılınca ana süreçten (`<oturum>/subagents/agent-*.jsonl`) okunur.
// Tarayıcıda window.subagents, Node'da module.exports.
(function (root) {
  const MAXB = 400, MAXT = 8000;
  const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
  const isAgentTool = n => n === 'Agent' || n === 'Task';
  const info = (id, input) => ({ id, ty: str(input && input.subagent_type, 60) || 'general-purpose', d: str(input && input.description, 160).replace(/\s+/g, ' ').trim(), st: 'run', tools: 0 });
  const num = v => typeof v === 'number' && isFinite(v) ? v : null;

  // Agent aracının sonucu (toolUseResult): arka planda başladı / bitti (araç sayısı, süre) / hata
  function onResult(sa, tur, isErr) {
    const t = tur && typeof tur === 'object' ? tur : {};
    if (typeof t.agentId === 'string') sa.aid = t.agentId;
    if (isErr) { sa.st = 'err'; return sa; }
    if (t.status === 'async_launched') { sa.st = 'run'; sa.bg = true; return sa; }
    sa.st = 'done';
    if (num(t.totalToolUseCount) != null) sa.tools = t.totalToolUseCount;
    if (num(t.totalDurationMs) != null) sa.ms = t.totalDurationMs;
    return sa;
  }
  // Arka plan alt ajanının bildirimi (bgtasks.parseNotif çıktısı) ya da canlı task_notification/task_progress olayı
  const ST_N = { completed: 'done', failed: 'err', stopped: 'stop', killed: 'stop' };
  function onNotif(sa, n) {
    if (!n) return sa;
    if (ST_N[n.status]) sa.st = ST_N[n.status];
    if (num(n.tools) != null) sa.tools = n.tools;
    if (num(n.ms) != null) sa.ms = n.ms;
    return sa;
  }
  function onSys(sa, ev) {
    if (!ev || ev.type !== 'system') return false;
    const u = ev.usage && typeof ev.usage === 'object' ? ev.usage : {};
    if (ev.subtype === 'task_started') { if (ev.subagent_type && sa.ty === 'general-purpose') sa.ty = str(ev.subagent_type, 60); return true; }
    if (ev.subtype === 'task_progress') { if (num(u.tool_uses) != null) sa.tools = Math.max(sa.tools || 0, u.tool_uses); return true; }
    if (ev.subtype === 'task_notification') return !!onNotif(sa, { status: ev.status, tools: u.tool_uses, ms: u.duration_ms });
    return false;
  }
  // Canlı akış: parent_tool_use_id taşıyan asistan mesajı alt ajanın bloklarına eklenir.
  // mk(c) araç bloğunu üretir (app.js; tool_result eşleşmesi için kaydeder). Kısmi akış olayları (stream_event) atlanır.
  function feed(sa, ev, mk) {
    if (!ev || ev.type !== 'assistant' || !ev.message || !Array.isArray(ev.message.content)) return false;
    const b = sa.b || (sa.b = []);
    for (const c of ev.message.content) {
      if (c.type === 'text' && c.text && c.text.trim()) b.push({ t: 'text', v: c.text.slice(0, MAXT) });
      else if (c.type === 'tool_use') { b.push(mk(c)); sa.tools = (sa.tools || 0) + 1; }
    }
    if (b.length > MAXB) { const n = b.length - MAXB; b.splice(0, n); sa.cut = (sa.cut || 0) + n; }
    return true;
  }

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ST_L = { run: 'çalışıyor', done: 'bitti', err: 'hata', stop: 'durduruldu' };
  function dur(ms) { if (ms == null) return ''; const s = Math.round(ms / 1000); return s < 60 ? s + ' sn' : Math.floor(s / 60) + ' dk ' + (s % 60) + ' sn'; }
  // Blok: başlık her zaman; gövde yalnızca açıkken (body() çağrılır). key açık durumunu yeniden çizimlerde korur.
  function blockHTML(sa, key, open, body, chev) {
    const n = sa.tools ? `${sa.tools} araç` : '';
    const meta = [n, dur(sa.ms), sa.bg ? 'arka planda' : ''].filter(Boolean).join(' · ');
    return `<div class="sa-blk ${sa.st} ${open ? 'open' : ''}" data-sa="${esc(key)}" data-said="${esc(sa.id)}"><div class="sa-h">${sa.st === 'run' ? '<span class="spin"></span>' : chev || ''}<b>Alt ajan</b><span class="sa-ty">${esc(sa.ty)}</span><span class="sa-d">${esc(sa.d)}</span><span class="sa-m">${esc(meta)}</span><span class="sa-st">${ST_L[sa.st] || ''}</span></div>${open ? `<div class="sa-b">${body ? body() : ''}</div>` : ''}</div>`;
  }

  const api = { isAgentTool, info, onResult, onNotif, onSys, feed, blockHTML, MAXB, MAXT };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.subagents = api;
})(typeof window !== 'undefined' ? window : this);
