// Sohbet görünümü kancaları (app.js'ten çağrılır): görev listesi kartı (TodoWrite / TaskCreate·TaskUpdate), alt ajan blokları,
// arka plan görevleri (bilgi paneli) ve düşünme blokları. Saf mantık todos.js / subagents.js / bgtasks.js'te; burada yalnızca
// app.js durumuna (s, s.run) bağlama ve çizim var. app.js'in genel adlarını (esc, md, ic, toolHTML, toolGroupHTML, paintLive,
// renderInfo, S, sess, API, toast) çağrı anında kullanır.
window.SV = (() => {
  const THOPEN = new Set(), SAOPEN = new Set();
  const SACACHE = new Map(), SALOAD = new Set(); // geçmiş sohbette açılan alt ajanların kaydı (ana süreçten)
  const keyOf = (s, x) => (s.uuid || s.id) + '|' + x;
  const paneSid = el => { const p = el.closest('.pane'); return p ? S.panes[+p.dataset.pane] : (typeof QL !== 'undefined' ? QL : null); };
  const repaint = sid => { if(sid) paintLive(sid); };
  const isActive = s => S.panes[S.active] === s.id;
  let infoT = 0;
  const infoSoon = s => { if(!isActive(s) || infoT) return; infoT = setTimeout(() => { infoT = 0; renderInfo(); }, 250); };

  // ---------- Düşünme ----------
  // Varsayılan kapalı; kapalıyken metin çizilmez. live: akmakta olan blok (Claude henüz yazıyor)
  function thinkHTML(s, k, text, live){
    const key = keyOf(s, k), open = THOPEN.has(key);
    return `<div class="think ${open ? 'open' : ''}${live ? ' th-live' : ''}" data-think="${esc(key)}"><button class="th-btn">${live ? '<span class="spin"></span>' : ic('chev', 'chev')}${open ? 'Düşünmeyi gizle' : live ? 'Düşünüyor… göster' : 'Düşünmeyi göster'}</button>${open ? `<div class="th-b">${esc(text)}</div>` : ''}</div>`;
  }
  function thinkBlock(s, c){
    const L = s.run.live, v = typeof c.thinking === 'string' && c.thinking.trim() ? c.thinking : L.think || '';
    if(v) L.b.push({t:'think', v:v.slice(0, 20000)}); // kaydedilmemiş (yalnız signature) blok gösterilmez
    L.think = '';
  }

  // ---------- Görev listesi ----------
  const lastTodo = bs => { for(let i = bs.length - 1; i >= 0; i--) if(bs[i].todo) return bs[i]; return null; };
  const todoHTML = (items, full) => full ? todos.cardHTML(items, ic('note')) : todos.lineHTML(items);

  // ---------- Alt ajan ----------
  function agentBody(s, sa, key){
    let blocks = sa.b, cut = sa.cut || 0;
    if(!blocks){
      const c = SACACHE.get(key);
      if(!c){
        if(!SALOAD.has(key)){ SALOAD.add(key);
          API.sessions.subagent(s.uuid, sa.id, sa.aid || null).then(r => SACACHE.set(key, r || {b:[], none:true}), () => SACACHE.set(key, {b:[], none:true}))
            .finally(() => { SALOAD.delete(key); repaint(s.id); }); }
        return '<div class="sa-note"><span class="spin"></span>Alt ajanın kaydı okunuyor…</div>';
      }
      if(c.none) return '<div class="sa-note">Bu alt ajanın kaydı bulunamadı.</div>';
      blocks = c.b; cut = c.cut || 0;
    }
    if(!blocks.length) return `<div class="sa-note">${sa.st === 'run' ? 'Henüz çıktı yok.' : 'Alt ajan metin ya da araç kaydı bırakmadı.'}</div>`;
    const out = cut ? [`<div class="sa-note">Daha eski ${cut} adım gösterilmiyor.</div>`] : [];
    let grp = [], gi = 0;
    const flush = () => { if(grp.length){ out.push(toolGroupHTML(grp, key + '|' + gi++)); grp = []; } };
    for(const b of blocks){
      if(b.t === 'text'){ flush(); out.push(`<div class="sa-t">${md(b.v)}</div>`); }
      else if(b.t === 'think') continue;
      else grp.push(b.n ? {...b, n:b.n.startsWith('mcp__') ? b.n.split('__').slice(1).join(' · ') : b.n} : b);
    }
    flush();
    return out.join('');
  }
  function agentHTML(s, sa){
    const key = keyOf(s, sa.id), open = SAOPEN.has(key);
    // Geçmiş sohbette bitmemiş görünen ön plan alt ajanı (süreç kapanmış) dönen simgeyle gösterilmez
    const v = !s.run && sa.st === 'run' && !sa.bg ? {...sa, st:'stop'} : sa;
    return subagents.blockHTML(v, key, open, () => agentBody(s, sa, key), ic('chev', 'chev'));
  }

  // ---------- Arka plan görevleri ----------
  function bgSection(s){
    const list = (s.bgSt && s.bgSt.list) || [];
    if(!list.length) return '';
    const n = bgtasks.running(list);
    return `<div class="isec bgt-sec"><h4>Arka plan görevleri <span class="sum">${n ? n + ' çalışıyor' : list.length + ' görev'}</span></h4>
      ${bgtasks.listHTML(list, {now:Date.now(), canStop:!!s.run, sid:s.id})}</div>`;
  }
  // Çalışan görevin süresi bilgi panelinde akar
  setInterval(() => { const s = sess(S.panes[S.active]); if(S.info && s && s.bgSt && bgtasks.running(s.bgSt.list)) renderInfo(); }, 5000);

  // ---------- app.js kancaları ----------
  function loaded(s, d){
    s.todoItems = d.todo || [];
    s.bgSt = {list:d.bg || [], pend:new Map()};
    SACACHE.forEach((v, k) => { if(k.startsWith(keyOf(s, ''))) SACACHE.delete(k); }); // yeniden yüklemede alt ajan kayıtları tazelenir
  }
  function runStart(s){
    const R = s.run;
    R.todo = {items:(s.todoItems || []).map(i => ({...i}))};
    R.agents = new Map();
    if(!s.bgSt) s.bgSt = bgtasks.newState();
  }
  function runEnd(s, p){
    const R = s.run;
    s.todoItems = R.todo.items;
    R.agents.forEach(sa => { if(sa.st === 'run' && !sa.bg) sa.st = p.stopped ? 'stop' : p.error || p.code ? 'err' : 'done'; });
    s.bgSt.list.forEach(t => { if(t.st === 'run') { t.st = 'stop'; t.t1 = Date.now(); } }); // süreç kapandı: görevleri de bitti
    infoSoon(s);
  }
  function toolUse(s, c, tool){
    const R = s.run;
    const td = todos.apply(R.todo, c.name, c.input, c.id); if(td) tool.todo = td;
    if(subagents.isAgentTool(c.name)){ tool.sa = subagents.info(c.id, c.input); R.agents.set(c.id, tool.sa); }
    bgtasks.use(s.bgSt, c.id, c.name, c.input, Date.now());
  }
  function toolResult(s, c, tool, tur){
    const R = s.run, text = resText(c.content);
    todos.result(R.todo, c.tool_use_id, text, tur, c.is_error);
    if(tool && tool.sa) subagents.onResult(tool.sa, tur, c.is_error);
    if(bgtasks.result(s.bgSt, c.tool_use_id, text, tur, c.is_error, Date.now())) infoSoon(s);
  }
  // true: olay burada tüketildi (app.js geri kalanını işlemez)
  function onEvent(s, ev){
    const R = s.run, L = R.live;
    if(ev.type === 'system' && /^task_/.test(ev.subtype || '')){
      const sa = ev.tool_use_id && R.agents.get(ev.tool_use_id);
      if(sa) subagents.onSys(sa, ev);
      if(bgtasks.sysEvent(s.bgSt, ev, Date.now())) infoSoon(s);
      scheduleLive(s); return true;
    }
    if(ev.parent_tool_use_id){
      if(ev.type === 'user') return false; // araç sonucu: app.js R.tools üzerinden eşler
      const sa = R.agents.get(ev.parent_tool_use_id);
      if(sa && subagents.feed(sa, ev, c => { const t = {t:'tool', n:c.name, a:toolSum(c.input), o:'', running:true}; R.tools.set(c.id, t); return t; })) scheduleLive(s);
      return true;
    }
    if(ev.type === 'stream_event' && ev.event){
      const e = ev.event;
      if(e.type === 'content_block_start' && e.content_block && e.content_block.type === 'thinking'){ L.think = ''; return true; }
      if(e.type === 'content_block_delta' && e.delta && e.delta.type === 'thinking_delta'){ L.think = (L.think || '') + (e.delta.thinking || ''); scheduleLive(s); return true; }
    }
    return false;
  }
  // Tıklamalar (app.js'in tek click dinleyicisinden)
  function click(t){
    const th = t.closest('.th-btn');
    if(th){ const k = th.parentNode.dataset.think; THOPEN.has(k) ? THOPEN.delete(k) : THOPEN.add(k); repaint(paneSid(th)); return true; }
    const sh = t.closest('.sa-h');
    if(sh){ const blk = sh.parentNode, k = blk.dataset.sa;
      if(SAOPEN.has(k)){ SAOPEN.delete(k); if(blk.classList.contains('run')) SACACHE.delete(k); } else SAOPEN.add(k);
      repaint(paneSid(sh)); return true; }
    const st = t.closest('[data-bgstop]');
    if(st){ const s = sess(st.dataset.sid);
      if(!s || !s.run){ toast('Claude süreci kapalı: görev durdurulamaz'); return true; }
      st.disabled = true;
      API.run.stopTask(s.run.runId, st.dataset.bgstop).then(ok => toast(ok ? 'Durdurma isteği gönderildi' : 'Görev durdurulamadı: Claude süreci artık komut kabul etmiyor'), e => toast('Durdurulamadı: ' + (e && e.message || e)));
      return true; }
    return false;
  }
  return {thinkHTML, thinkBlock, lastTodo, todoHTML, agentHTML, bgSection, loaded, runStart, runEnd, toolUse, toolResult, onEvent, click};
})();
