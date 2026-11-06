// Görev listesi kartı: Claude Code'un TodoWrite aracı (tüm liste her çağrıda yeniden yazılır) ve yeni sürümlerin
// TaskCreate/TaskUpdate araçları (liste oturum boyunca birikir, görevler kimlikle güncellenir).
// Durum ayrıştırmada (sessions.js) ve canlı akışta (app.js) aynı kodla tutulur; her araç bloğu listenin o anki
// kopyasını taşır (`todo`). Tarayıcıda window.todos, Node'da module.exports.
(function (root) {
  const MAXI = 50, MAXC = 200;
  const STATUS = ['pending', 'in_progress', 'completed'];
  const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
  const stOf = v => STATUS.includes(v) ? v : 'pending';
  const isTodoTool = n => n === 'TodoWrite' || n === 'TaskCreate' || n === 'TaskUpdate';
  const newState = () => ({ items: [] });
  const snap = st => st.items.map(i => i.af ? { c: i.c, s: i.s, af: i.af } : { c: i.c, s: i.s });

  // Araç çağrısını duruma uygular; görev aracı değilse null, değilse listenin yeni kopyası
  function apply(st, name, input, toolId) {
    if (!isTodoTool(name) || !input || typeof input !== 'object') return null;
    if (name === 'TodoWrite') {
      if (!Array.isArray(input.todos)) return null;
      st.items = input.todos.filter(t => t && typeof t === 'object').slice(0, MAXI)
        .map((t, k) => ({ id: 'w' + k, c: str(t.content, MAXC), s: stOf(t.status), af: str(t.activeForm, MAXC) }));
    } else if (name === 'TaskCreate') {
      if (st.items.length < MAXI) st.items.push({ id: '?' + toolId, c: str(input.subject, MAXC) || str(input.description, MAXC), s: 'pending', af: str(input.activeForm, MAXC) });
    } else {
      const it = st.items.find(i => i.id === String(input.taskId));
      if (it && input.status === 'deleted') st.items = st.items.filter(i => i !== it);
      else if (it) {
        if (STATUS.includes(input.status)) it.s = input.status;
        if (typeof input.subject === 'string') it.c = str(input.subject, MAXC);
        if (typeof input.activeForm === 'string') it.af = str(input.activeForm, MAXC);
      }
    }
    return snap(st);
  }
  // TaskCreate sonucu: CLI'nin verdiği kimlik ("Task #3 created successfully" / toolUseResult.task.id) göreve yazılır.
  // Hata dönen oluşturma listeden çıkar. Eşleşen bekleyen görev yoksa false.
  function result(st, toolId, text, tur, isErr) {
    const it = st.items.find(i => i.id === '?' + toolId);
    if (!it) return false;
    if (isErr) { st.items = st.items.filter(i => i !== it); return true; }
    const id = tur && tur.task && tur.task.id != null ? String(tur.task.id) : (/Task #(\S+) created successfully/.exec(String(text || '')) || [])[1];
    if (!id) return false;
    it.id = id; return true;
  }

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const done = items => items.filter(i => i.s === 'completed').length;
  const label = i => i.s === 'in_progress' && i.af ? i.af : i.c;
  // Tam kart (turdaki son güncelleme): planCard ile aynı görünüm; çalışan adım activeForm metniyle vurgulu
  function cardHTML(items, icon) {
    const rows = items.length ? items.map(i => `<div class="pc-i ${i.s}"><span class="pc-b">${i.s === 'completed' ? '✓' : i.s === 'in_progress' ? '<span class="spin"></span>' : '<span class="td-o"></span>'}</span><span>${esc(label(i))}</span></div>`).join('')
      : '<div class="pc-i">Liste boş</div>';
    return `<div class="plan-card todo-card"><div class="pc-h">${icon || ''}<b>Görevler</b><span>${done(items)}/${items.length}</span></div>${rows}</div>`;
  }
  // Aynı turdaki önceki güncellemeler tek satır
  function lineHTML(items) {
    const cur = items.find(i => i.s === 'in_progress');
    return `<div class="todo-line"><span class="pc-b">✓</span>Görevler güncellendi · ${done(items)}/${items.length}${cur ? ' · ' + esc(label(cur)) : ''}</div>`;
  }

  const api = { isTodoTool, newState, apply, result, cardHTML, lineHTML, MAXI, MAXC };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.todos = api;
})(typeof window !== 'undefined' ? window : this);
