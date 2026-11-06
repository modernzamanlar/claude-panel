// Arka plan görevleri: Bash/PowerShell `run_in_background`, zaman aşımında arka plana alınan komutlar, Monitor ve
// arka planda çalışan alt ajanlar. Kayıtlardan (sessions.js: araç sonucu + <task-notification> mesajı + TaskStop/TaskOutput)
// ve canlı akıştan (app.js: system task_started / task_updated / task_notification olayları) aynı listeye işlenir.
// Görev: {id, tu (araç çağrısı kimliği), k ('bash'|'monitor'|'agent'|'mcp'), cmd, d, st ('run'|'done'|'stop'|'err'), t0, t1, out, code}
// Tarayıcıda window.bgtasks, Node'da module.exports.
(function (root) {
  const MAXL = 60, MAXO = 600, MAXC = 300;
  const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
  const one = s => String(s).replace(/\s+/g, ' ').trim();
  const ms = ts => { const t = typeof ts === 'number' ? ts : Date.parse(ts); return isFinite(t) ? t : null; };
  const SHELL = /^(Bash|PowerShell)$/;
  const CTL = { TaskStop: 'stop', KillShell: 'stop', TaskOutput: 'out', BashOutput: 'out' };
  const newState = () => ({ list: [], pend: new Map() });
  const find = (st, id, tu) => st.list.find(t => (id && t.id === id) || (tu && t.tu === tu));
  function add(st, t) { st.list.push(t); if (st.list.length > MAXL) st.list.splice(0, st.list.length - MAXL); return t; }

  // Araç çağrısı: arka plana gidebilecek araçlar sonuç gelene kadar bekletilir (komut ve açıklama)
  function use(st, id, name, input, ts) {
    if (!id || !input || typeof input !== 'object') return false;
    if (CTL[name]) { const v = input.task_id || input.shell_id || input.bash_id; if (typeof v !== 'string') return false; st.pend.set(id, { ctl: CTL[name], tid: v }); return true; }
    let k = null;
    if (SHELL.test(name)) k = 'bash'; else if (name === 'Monitor') k = 'monitor'; else if (name === 'Agent' || name === 'Task') k = 'agent';
    if (!k) return false;
    st.pend.set(id, { k, cmd: k === 'agent' ? '' : one(str(input.command, MAXC)), d: one(str(input.description, 160)), t0: ms(ts) });
    return true;
  }
  // Sonuçtaki görev kimliği: toolUseResult alanları ya da CLI'nin sonuç metninin başı (komut çıktısındaki
  // rastgele "task id" yazıları görev sanılmasın diye metin yalnızca CLI'nin kendi cümlesiyle başlıyorsa okunur)
  function idFrom(text, tur, k) {
    const t = tur && typeof tur === 'object' ? tur : {};
    if (k === 'agent') return t.status === 'async_launched' && typeof t.agentId === 'string' ? t.agentId : null;
    if (typeof t.backgroundTaskId === 'string') return t.backgroundTaskId;
    if (k === 'monitor' && typeof t.taskId === 'string') return t.taskId;
    const s = String(text || '');
    const m = /^Command running in background with ID: ([\w-]+)/.exec(s) || /^Command did not complete within .*? moved to the background \(ID: ([\w-]+)\)/.exec(s)
      || (k === 'monitor' ? /\btask[ _]?id[:=]?\s*"?([\w-]{4,})/i.exec(s) : null);
    return m ? m[1] : null;
  }
  // Araç sonucu: arka planda başladıysa görev listeye girer
  function result(st, tu, text, tur, isErr, ts) {
    const p = st.pend.get(tu); if (!p) return null;
    st.pend.delete(tu);
    if (isErr) return null;
    if (p.ctl === 'stop') return stopped(st, { task_id: p.tid }, false, ts) ? find(st, p.tid) : null;
    if (p.ctl === 'out') return output(st, { task_id: p.tid }, text) ? find(st, p.tid) : null;
    const id = idFrom(text, tur, p.k); if (!id) return null;
    const t = find(st, id, tu);
    if (t) { if (!t.cmd) t.cmd = p.cmd; if (!t.d) t.d = p.d; return t; } // canlı akışta task_started önce gelmiş olabilir
    return add(st, { id, tu, k: p.k, cmd: p.cmd, d: p.d, st: 'run', t0: p.t0, t1: null, out: '', code: null });
  }

  const ST_N = { completed: 'done', failed: 'err', stopped: 'stop', killed: 'stop', running: 'run', pending: 'run' };
  const tag = (s, n) => { const m = new RegExp('<' + n + '>([\\s\\S]*?)</' + n + '>').exec(s); return m ? m[1].trim() : ''; };
  // <task-notification> metni → {ids, tu, status, summary, result, code, tools, ms}; bildirim değilse null
  function parseNotif(text) {
    const s = String(text || '');
    if (!s.includes('<task-notification>')) return null;
    const ids = [...s.matchAll(/<task-id>([^<]+)<\/task-id>/g)].map(m => m[1].trim()).filter(x => !x.startsWith('__'));
    const summary = tag(s, 'summary'), usage = tag(s, 'usage');
    const num = n => { const m = new RegExp('<' + n + '>(\\d+)<').exec(usage); return m ? +m[1] : null; };
    const code = /exit code (-?\d+)/.exec(summary);
    // Birden çok görevli özet bildiriminde kimlikler metinde de yazar ("Task ids: a, b.")
    const more = /Task ids: ([\w, -]+)/.exec(summary);
    if (more) for (const x of more[1].split(',').map(v => v.trim()).filter(Boolean)) if (!ids.includes(x)) ids.push(x);
    return { ids, tu: tag(s, 'tool-use-id') || null, status: tag(s, 'status'), summary, result: tag(s, 'result'), code: code ? +code[1] : null, tools: num('tool_uses'), ms: num('duration_ms') };
  }
  // Bildirim görevi bitirir (ya da listede yoksa — ör. MCP görevi — yeni satır olarak ekler)
  function notif(st, text, ts) {
    const n = parseNotif(text); if (!n) return null;
    const stt = ST_N[n.status] || 'done', t1 = ms(ts);
    const out = str(one(n.result || n.summary), MAXO);
    (n.ids.length ? n.ids : [null]).forEach((id, k) => {
      let t = find(st, id, k ? null : n.tu);
      if (!t) t = add(st, { id: id || n.tu || '?', tu: k ? null : n.tu, k: /^MCP task/.test(n.summary) ? 'mcp' : /^Agent /.test(n.summary) ? 'agent' : 'bash', cmd: '', d: str(n.summary, 160), st: stt, t0: null, t1: null, out: '', code: null });
      t.st = stt; t.t1 = t1; if (out) t.out = out; if (n.code != null) t.code = n.code;
    });
    return n;
  }
  // TaskStop / KillShell sonucu: görev durduruldu; TaskOutput / BashOutput sonucu: son çıktı
  function stopped(st, input, isErr, ts) {
    const id = input && (input.task_id || input.shell_id); const t = id && find(st, String(id));
    if (!t || isErr) return false;
    t.st = 'stop'; t.t1 = ms(ts); return true;
  }
  function output(st, input, text) {
    const id = input && (input.task_id || input.bash_id || input.shell_id); const t = id && find(st, String(id));
    if (!t) return false;
    const s = String(text || '').trim(); if (s) t.out = s.slice(-MAXO); return true;
  }
  // Canlı akıştaki system olayları
  const KIND = { local_bash: 'bash', local_agent: 'agent', mcp_task: 'mcp', monitor: 'monitor' };
  function sysEvent(st, ev, now) {
    if (!ev || ev.type !== 'system' || typeof ev.task_id !== 'string') return null;
    let t = find(st, ev.task_id, ev.tool_use_id);
    if (ev.subtype === 'task_started') {
      // Ön planda başlayan alt ajan/komut arka plan görevi değildir (sonradan arka plana alınırsa task_updated gelir)
      if (!t && ev.is_backgrounded === false) { st.pend.set('fg:' + ev.task_id, { k: KIND[ev.task_type] || 'bash', d: str(ev.description, 160), tu: ev.tool_use_id || null }); return null; }
      if (!t) t = add(st, { id: ev.task_id, tu: ev.tool_use_id || null, k: KIND[ev.task_type] || 'bash', cmd: '', d: one(str(ev.description, 160)), st: 'run', t0: now, t1: null, out: '', code: null });
      else { t.id = ev.task_id; if (!t.d) t.d = one(str(ev.description, 160)); }
      return t;
    }
    if (ev.subtype === 'task_updated' && ev.patch && typeof ev.patch === 'object') {
      if (!t && ev.patch.is_backgrounded) { const f = st.pend.get('fg:' + ev.task_id); if (!f) return null; st.pend.delete('fg:' + ev.task_id);
        t = add(st, { id: ev.task_id, tu: f.tu, k: f.k, cmd: '', d: f.d, st: 'run', t0: now, t1: null, out: '', code: null }); }
      if (!t) return null;
      if (ST_N[ev.patch.status]) t.st = ST_N[ev.patch.status];
      if (typeof ev.patch.end_time === 'number') t.t1 = ev.patch.end_time;
      if (typeof ev.patch.error === 'string' && ev.patch.error) t.out = str(ev.patch.error, MAXO);
      return t;
    }
    if (ev.subtype === 'task_notification') {
      if (!t) { st.pend.delete('fg:' + ev.task_id); return null; }
      t.st = ST_N[ev.status] || 'done'; if (t.t1 == null) t.t1 = now;
      if (typeof ev.summary === 'string' && ev.summary) t.out = str(one(ev.summary), MAXO);
      const c = /exit code (-?\d+)/.exec(ev.summary || ''); if (c) t.code = +c[1];
      return t;
    }
    return null;
  }
  const running = list => (list || []).filter(t => t.st === 'run').length;

  function fmtDur(d) {
    if (d == null || !(d >= 0)) return '';
    const s = Math.round(d / 1000);
    if (s < 60) return s + ' sn';
    const m = Math.floor(s / 60);
    if (m < 60) return m + ' dk ' + (s % 60) + ' sn';
    return Math.floor(m / 60) + ' sa ' + (m % 60) + ' dk';
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ST_L = { run: 'çalışıyor', done: 'bitti', stop: 'durduruldu', err: 'hata' };
  const K_L = { bash: 'Komut', monitor: 'İzleme', agent: 'Alt ajan', mcp: 'MCP' };
  // Bilgi paneli bölümü. opts: {now, canStop, sid}. Çalışanlar üstte, sonra en yeniler; en fazla `max` satır.
  function listHTML(list, opts) {
    const o = opts || {}, now = o.now || Date.now(), max = o.max || 12;
    const all = (list || []).slice().reverse().sort((a, b) => (b.st === 'run') - (a.st === 'run'));
    if (!all.length) return '<div class="bgt-none">Bu sohbette arka plan görevi yok.</div>';
    const rows = all.slice(0, max).map(t => {
      const dur = t.t0 != null ? fmtDur((t.t1 != null ? t.t1 : t.st === 'run' ? now : t.t0) - t.t0) : '';
      const title = t.d || t.cmd || t.id;
      const stop = o.canStop && t.st === 'run' && !String(t.id).startsWith('?') ? `<button class="act bgt-stop" data-bgstop="${esc(t.id)}" data-sid="${esc(o.sid || '')}" title="Görevi durdur (Claude Code stop_task)">Durdur</button>` : '';
      return `<div class="bgt ${t.st}"><div class="bgt-h"><span class="bgt-d">${t.st === 'run' ? '<span class="spin"></span>' : ''}</span><span class="bgt-t" title="${esc(title)}">${esc(title)}</span>${stop}</div>
        <div class="bgt-s"><span>${K_L[t.k] || 'Görev'}</span><span>${ST_L[t.st]}${t.code != null && t.st !== 'run' ? ' · çıkış ' + t.code : ''}</span>${dur ? `<span>${dur}</span>` : ''}<span class="mono">${esc(t.id)}</span></div>
        ${t.cmd && t.cmd !== title ? `<div class="bgt-c mono" title="${esc(t.cmd)}">${esc(t.cmd)}</div>` : ''}${t.out ? `<div class="bgt-o">${esc(t.out)}</div>` : ''}</div>`;
    }).join('');
    return rows + (all.length > max ? `<div class="bgt-none">+${all.length - max} eski görev</div>` : '');
  }

  const api = { newState, use, idFrom, result, parseNotif, notif, stopped, output, sysEvent, running, fmtDur, listHTML, MAXL, MAXO };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.bgtasks = api;
})(typeof window !== 'undefined' ? window : this);
