// Platform: macOS'ta ⌘, Windows/Linux'ta Ctrl
const IS_MAC = !window.api || !window.api.platform || window.api.platform === 'darwin';
const MOD = e => IS_MAC ? e.metaKey : e.ctrlKey;
const ICON = {
  chev:'<path d="m9 18 6-6-6-6"/>',
  msg:'<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  pin:'<path d="M12 17v5M9 10.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2v.8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.8a2 2 0 0 0-1.1-1.8l-1.8-.9a2 2 0 0 1-1.1-1.8V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  inbox:'<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
  folderPlus:'<path d="M12 10v6M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  folder:'<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  term:'<path d="m4 17 6-6-6-6M12 19h8"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  up:'<path d="m5 12 7-7 7 7M12 19V5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  clip:'<path d="m21.4 11-9.2 9.2a6 6 0 0 1-8.5-8.5l8.6-8.6A4 4 0 1 1 18 8.8l-8.6 8.6a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
  file:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
  edit:'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  video:'<rect x="2" y="5" width="14" height="14" rx="2"/><path d="m16 10 6-3v10l-6-3"/>',
  music:'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  ext:'<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  cols:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>',
  shield:'<path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/>',
  stop:'<rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  laptop:'<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>',
  mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  bolt:'<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>',
  gauge:'<path d="M4.5 17a8.5 8.5 0 1 1 15 0"/><path d="M12 14l4-5"/><circle cx="12" cy="14" r="1.2"/>',
  cursor:'<path d="m4 4 7 17 2.5-7.5L21 11Z"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  note:'<path d="M15 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10Z"/><path d="M15 21v-4a2 2 0 0 1 2-2h3"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  sync:'<path d="M21 12a9 9 0 0 0-15.5-6.2L3 8M3 3v5h5M3 12a9 9 0 0 0 15.5 6.2L21 16M16 16h5v5"/>',
  sliders:'<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  caret:'<path d="m6 9 6 6 6-6"/>',
  grip:'<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>'
};
const ic = (n, cls='') => `<svg class="i ${cls}" viewBox="0 0 24 24">${ICON[n]}</svg>`;

/* ---------- Uygulama durumu (veriler boot() ile ana süreçten gelir) ---------- */
const S = {
  filter:'all', layout:2, active:0, q:'', org:false, info:true, side:true, connOpen:false, items:[],
  panes:[null,null,null,null], folders:[], connectors:[], sessions:[],
};
const $ = s => document.querySelector(s);
const sess = id => S.sessions.find(s => s.id === id);
const fold = id => S.folders.find(f => f.id === id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nPanes = () => S.layout===4 ? 4 : S.layout;
const paneOf = id => { const i = S.panes.slice(0,nPanes()).indexOf(id); return i<0 ? null : i+1; };
const matches = s => !S.q || (s.title+' '+s.project).toLowerCase().includes(S.q.toLowerCase());
const isDesc = (id, anc) => { let f = fold(id); while(f){ if(f.parent===anc) return true; f = fold(f.parent); } return false; };
const inside = (fid, dragged) => fid===dragged || isDesc(fid, dragged); // fid, dragged klasörünün kendisi veya içinde mi
let renaming = null, drag = null; // drag = {kind:'sess'|'folder', id}

function toast(t){ const el=$('#toast'); el.textContent=t; el.classList.add('show'); clearTimeout(toast.h); toast.h=setTimeout(()=>el.classList.remove('show'),1800); }

/* ---------- Rail ---------- */
function renderRail(){
  let h = `<button class="ibtn new" data-newchat>${ic('plus')}<span class="tip">Yeni sohbet</span></button>
    <button class="ibtn ${S.org?'on':''}" id="railOrg">${ic('folder')}<span class="tip">Sohbetler ve klasörler · ⌘B</span></button>
    <button class="ibtn ${SR.open?'on':''}" id="railSearch">${ic('search')}<span class="tip">Ara · ⌘K</span></button><hr>`;
  for(let i=0;i<nPanes();i++){
    const s = sess(S.panes[i]); const f = s && fold(s.folder);
    h += `<button class="pchip ${i===S.active?'act':''}" data-railpane="${i}">${f?`<i style="background:${f.color}"></i>`:''}${i+1}${s && s.run && s.run.pendings && s.run.pendings.length ? '<span class="rs wait"></span>' : s&&s.status==='running'?'<span class="rs"></span>':s&&s.unseen?'<span class="rs done"></span>':''}<span class="tip">${s?esc(s.title):'Boş bölme'}</span></button>`;
  }
  h += `<span class="grow"></span><span class="live" title="Senkron"></span>
    <button class="ibtn" id="btnSync">${ic('sync')}<span class="tip">Şimdi senkronla</span></button>
    <button class="ibtn" id="btnSettings">${ic('sliders')}${UPD.phase==='ready'?'<span class="rs"></span>':''}<span class="tip">Ayarlar</span></button>`;
  $('#rail').innerHTML = h;
}

/* ---------- Organizer: Finder / Gezgin tarzı klasör penceresi ---------- */
const parentOf = id => id[0]==='f' ? fold(id)?.parent ?? null : sess(id)?.folder ?? null;
const objOf = id => id[0]==='f' ? fold(id) : sess(id);
const gone = id => { let o = objOf(id); if(!o || o.hidden) return true; if(o.trashed) return true; let p = parentOf(id); while(p){ const f = fold(p); if(!f || f.trashed) return true; p = f.parent; } return false; };
const children = pid => S.items.filter(id => parentOf(id) === pid && !(objOf(id)||{}).trashed && !(objOf(id)||{}).hidden);
function countAll(fid){ return children(fid).reduce((a,id)=> a + (id[0]==='f' ? countAll(id) : 1), 0); }
const FX = {cwd:null, back:[], fwd:[], view:'grid', sort:'name', sel:new Set(), anchor:null};
const SMART = {
  ':recent': {name:'Son Kullanılanlar', icon:'clock', test:s=>agoMin(s.ago) < 60*24*3},
  ':pinned': {name:'Sabitlenenler', icon:'pin', test:s=>s.pinned},
  ':fresh':  {name:'Yeni', icon:'inbox', test:s=>s.fresh},
  ':running':{name:'Çalışanlar', icon:'term', test:s=>s.status==='running'},
  ':remote': {name:'Uzaktan', icon:'cursor', test:s=>s.remote || s.bridge}, // panelden açılan + claude.ai'ye bağlı (Remote Control) oturumlar
};
const TRASH = ':trash';
ICON.clock = '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>';
ICON.home = '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>';
function agoMin(a){ if(a==='şimdi') return 0; if(a==='dün') return 1440; const m = a.match(/(\d+)\s*(dk|sa|gün|hf)/); if(!m) return 99999;
  return +m[1] * ({dk:1, sa:60, 'gün':1440, hf:10080}[m[2]]); }
function lastActivity(id){ if(id[0]==='s') return agoMin(sess(id).ago); const k = children(id); return k.length ? Math.min(...k.map(lastActivity)) : 99999; }
/* Klasör simgesi. full=true → içinde bir şey var: arka kapakla ön kapak arasından kâğıtlar görünür (macOS'taki dolu klasör gibi) */
const fsvg = (cls='fsvg', full=false) => `<svg class="${cls}${full?' full':''}" viewBox="0 0 64 52"><path class="fb" d="M3 9a4 4 0 0 1 4-4h15.2a3 3 0 0 1 2.1.9L29 10.5h28a4 4 0 0 1 4 4V44a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/>${full?`
  <g class="papers"><rect class="pp2" x="11" y="7.5" width="40" height="30" rx="1.6" transform="rotate(-5 31 22)"/><rect class="pp1" x="14" y="5.5" width="39" height="30" rx="1.6" transform="rotate(3.5 33 20)"/><path class="pl" d="M19 10.6h22M19 14h28" transform="rotate(3.5 33 20)"/><path class="pa" d="M19 7.6h9" transform="rotate(3.5 33 20)"/></g>`:''}<path class="ff" d="M3 ${full?20:19}a4 4 0 0 1 4-4h50a4 4 0 0 1 4 4v${full?24:25}a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/><path class="fl2" d="M7 ${full?17:16}h50"/></svg>`;
const fullF = id => countAll(id) > 0;
const dsvg = (cls='dsvg') => `<svg class="${cls}" viewBox="0 0 48 60"><path class="db" d="M6 1.5h25L44.5 15v41.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-53a2 2 0 0 1 2-2z"/><path class="dc" d="M31 1.5V13a2 2 0 0 0 2 2h11.5"/><path class="dl" d="M11 22h22M11 28h26M11 34h18"/><path class="dbub" d="M14 41h20a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4H22l-5 4v-4h-3a4 4 0 0 1-4-4v-4a4 4 0 0 1 4-4z"/></svg>`;
function nameOf(id){ return id[0]==='f' ? fold(id).name : sess(id).title; }
function listing(){
  let ids;
  if(FX.cwd===GRAPH) return [];
  if(FX.cwd===TRASH) ids = S.items.filter(id => { const o = objOf(id); return o && o.trashed && !o.hidden; });
  else if(FX.cwd && FX.cwd[0]===':') ids = S.items.filter(id=>id[0]==='s' && !gone(id) && SMART[FX.cwd].test(sess(id)));
  else ids = children(FX.cwd);
  const key = FX.sort;
  return ids.sort((a,b) => {
    if(key!=='date' || true){ const fa = a[0]==='f', fb = b[0]==='f'; if(fa!==fb) return fa ? -1 : 1; }
    if(key==='date') return lastActivity(a) - lastActivity(b);
    return nameOf(a).localeCompare(nameOf(b), 'tr');
  });
}
function go(cwd, push=true){ if(cwd===FX.cwd) return; if(push){ FX.back.push(FX.cwd); FX.fwd=[]; } FX.cwd = cwd; FX.sel.clear(); renaming=null; if(cwd && cwd[0]==='f'){ let f=fold(cwd); while(f){ f.open=true; f=fold(f.parent);} } renderBoard(); }
function goBack(){ if(!FX.back.length) return; FX.fwd.push(FX.cwd); go(FX.back.pop(), false); }
function goFwd(){ if(!FX.fwd.length) return; FX.back.push(FX.cwd); go(FX.fwd.pop(), false); }
function goUp(){ if(FX.cwd && FX.cwd[0]==='f') go(fold(FX.cwd).parent); else if(FX.cwd) go(null); }
function curFolder(){ return FX.cwd && FX.cwd[0]==='f' ? FX.cwd : null; }
function openItem(id){ if(id[0]==='f') go(id); else { setOrg(false); openIn(id); } }

function sideTree(pid, depth){
  return S.folders.filter(f=>f.parent===pid && !f.trashed && !f.hidden).sort((a,b)=>S.items.indexOf(a.id)-S.items.indexOf(b.id)).map(f => {
    const kids = S.folders.some(x=>x.parent===f.id && !x.trashed && !x.hidden);
    return `<button class="fx-si ${FX.cwd===f.id?'on':''}" data-nav="${f.id}" data-fdrop="${f.id}" style="padding-left:${6+depth*14}px">
      <span class="tw ${f.open?'open':''}" ${kids?`data-tw="${f.id}"`:''}>${kids?ic('chev'):''}</span>${fsvg('fsm', fullF(f.id))}<span class="l">${esc(f.name)}</span><span class="tagdot" style="width:8px;height:8px;border-radius:50%;background:${f.color};flex:none"></span></button>`
      + (kids && f.open ? sideTree(f.id, depth+1) : '');
  }).join('');
}
function renderSide(){
  const n = k => S.sessions.filter(x => !gone(x.id) && SMART[k].test(x)).length;
  const nTrash = S.items.filter(id => { const o = objOf(id); return o && o.trashed && !o.hidden; }).length;
  $('#fxSide').innerHTML = `<div class="fx-sh">Favoriler</div>
    <button class="fx-si ${FX.cwd===null?'on':''}" data-nav="" data-fdrop="">${ic('home')}<span class="l">Tüm Sohbetler</span><em>${S.sessions.filter(x=>!gone(x.id)).length}</em></button>
    <button class="fx-si gv-si ${FX.cwd===GRAPH?'on':''}" data-nav="${GRAPH}">${ic('graph')}<span class="l">GourceView</span>${(n=>n?`<em class="live-em">${n} canlı</em>`:'')(S.sessions.filter(x=>!gone(x.id) && x.status==='running').length)}</button>
    ${Object.entries(SMART).map(([k,v])=>`<button class="fx-si ${FX.cwd===k?'on':''}" data-nav="${k}">${ic(v.icon)}<span class="l">${v.name}</span><em>${n(k)||''}</em></button>`).join('')}
    <div class="fx-sh">Klasörler</div>${sideTree(null,0)}
    <button class="fx-si" id="btnFolder2" style="color:var(--muted)">${ic('plus')}<span class="l">Yeni klasör</span></button>
    <button class="fx-si trash ${FX.cwd===TRASH?'on':''}" data-nav="${TRASH}">${ic('trash')}<span class="l">Çöp Kutusu</span><em>${nTrash||''}</em></button>
    <div class="fx-sh">Senkron</div><div style="padding:2px 8px;font-size:12px;color:var(--muted)">● ${syncLine()}<br><span style="color:var(--faint)">~/.claude/projects izleniyor</span></div>`;
}
function renderCrumbs(){
  const path = [];
  if(FX.cwd===GRAPH) path.push({id:GRAPH, name:'GourceView'});
  else if(FX.cwd===TRASH) path.push({id:TRASH, name:'Çöp Kutusu'});
  else if(FX.cwd && FX.cwd[0]===':') path.push({id:FX.cwd, name:SMART[FX.cwd].name});
  else { let f = fold(FX.cwd); while(f){ path.unshift({id:f.id, name:f.name}); f = fold(f.parent); } }
  $('#crumbs').innerHTML = `<button data-nav="" data-fdrop="" class="${!FX.cwd?'cur':''}">${ic('home')}Sohbetler</button>` +
    path.map((p,i)=>`<span class="sp">›</span><button data-nav="${p.id}" ${p.id[0]==='f'?`data-fdrop="${p.id}"`:''} class="${i===path.length-1?'cur':''}">${p.id[0]==='f'?fsvg('fsm', fullF(p.id)):''}${esc(p.name)}</button>`).join('');
  $('#fxBack').disabled = !FX.back.length; $('#fxFwd').disabled = !FX.fwd.length;
  document.querySelectorAll('#fxView button').forEach(b=>b.classList.toggle('on', b.dataset.fv===FX.view));
}
function itemBadges(s){
  const p = paneOf(s.id);
  return (p?`<span class="badge-pn">${p}</span>`:'') + ((s.fresh||s.unseen)&&!p?'<span class="badge-new"></span>':'')
    + (s.status==='running'?'<span class="badge-st"><span class="spin"></span></span>':s.status==='elsewhere'?'<span class="badge-st"><span class="edot"></span></span>':s.remote?`<span class="badge-st rc-badge" style="padding:1px 3px">${ic('cursor')}</span>`:'');
}
function nameHTML(id){ return renaming===id ? `<input class="rename" value="${esc(nameOf(id))}" data-ren="${id}">` : esc(nameOf(id)); }
function gridItem(id){
  const sel = (FX.sel.has(id) ? 'sel' : '') + (FX.clip && FX.clip.includes(id) ? ' cut' : '');
  if(id[0]==='f'){ const f = fold(id), n = countAll(id);
    return `<div class="fx-it ${sel}" data-item="${id}" data-fdrop="${id}"><div class="ic">${fsvg('fsvg', n>0)}${n?`<span class="badge-cnt">${n}</span>`:''}</div>
      <div class="nm"><span class="tagdot" style="background:${f.color}"></span>${nameHTML(id)}</div><div class="sb">${n} öğe${f.dir?' · '+esc(f.dir.split(/[\\/]/).pop()):''}</div></div>`; }
  const s = sess(id); const inSmart = FX.cwd && FX.cwd[0]===':'; const pf = fold(s.folder);
  return `<div class="fx-it ${sel}" data-item="${id}"><div class="ic">${dsvg()}${itemBadges(s)}</div>
    <div class="nm">${nameHTML(id)}</div><div class="sb">${inSmart&&pf?`<span class="tagdot" style="background:${pf.color}"></span>${esc(pf.name)}`:esc(s.project.split(/[\\/]/).pop())+' · '+s.ago}</div></div>`;
}
function listRow(id){
  const sel = FX.sel.has(id) ? 'sel' : '';
  if(id[0]==='f'){ const f = fold(id);
    return `<tr class="fx-row ${sel}" data-item="${id}" data-fdrop="${id}"><td><div class="nmc">${fsvg('fsm', fullF(id))}${nameHTML(id)}<span class="tagdot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${f.color}"></span></div></td><td>${esc(f.dir||'—')}</td><td>${(m=>m>=99999?'—':m===0?'şimdi':m<60?m+' dk':m<1440?Math.round(m/60)+' sa':Math.round(m/1440)+' gün')(lastActivity(id))}</td><td>Klasör · ${countAll(id)} öğe</td></tr>`; }
  const s = sess(id); const p = paneOf(id);
  return `<tr class="fx-row ${sel}" data-item="${id}"><td><div class="nmc"><svg class="dsm" viewBox="0 0 48 60">${dsvg().replace(/^<svg[^>]*>|<\/svg>$/g,'')}</svg>${nameHTML(id)}${p?`<span class="badge-pn" style="position:static">${p}</span>`:''}${s.status==='running'?'<span class="spin"></span>':''}</div></td><td class="mono">${esc(s.project.replace('~/Desktop/',''))}</td><td>${s.ago}</td><td>Sohbet · ${s.model}</td></tr>`;
}
// Arka planda oturumlar değiştikçe (canlı sohbet yazarken saniyede birkaç kez) pano yeniden çizilir.
// Adlandırma kutusu bu sırada baştan oluşturulduğu için yazılan metin, imleç ve odak korunur.
let REBUILDING = false;
function renderBoard(){
  const pr = document.querySelector('#fxBody [data-ren]');
  const keep = pr ? {id: pr.dataset.ren, v: pr.value, s: pr.selectionStart, e: pr.selectionEnd} : null;
  REBUILDING = true; try { renderBoardInner(); } finally { REBUILDING = false; }
  const r = document.querySelector('#fxBody [data-ren]'); if(!r) return;
  if(keep && keep.id === r.dataset.ren){ r.value = keep.v; r.focus({preventScroll:true}); try{ r.setSelectionRange(keep.s, keep.e); }catch{} }
  else { r.focus(); r.select(); }
}
function renderBoardInner(){
  renderSide(); renderCrumbs();
  const ids = listing(); FX.sel.forEach(id => { if(!ids.includes(id)) FX.sel.delete(id); });
  const body = $('#fxBody');
  if(FX.cwd===GRAPH) gMount(body);
  else if(!ids.length && FX.cwd===TRASH) body.innerHTML = `<div class="fx-empty"><div>${ic('trash').replace('class="i','style="width:56px;height:56px;color:var(--faint)" class="i')}<div style="font:500 17px var(--serif);color:var(--text);margin-top:8px">Çöp Kutusu boş</div><div style="font-size:12.5px">Buraya taşınanlar yalnızca panelden gizlenir; Claude'un .jsonl dosyaları silinmez.</div></div></div>`;
  else if(!ids.length) body.innerHTML = `<div class="fx-empty"><div>${fsvg()}<div style="font:500 17px var(--serif);color:var(--text);margin-top:8px">Bu klasör boş</div><div style="font-size:12.5px">Sohbetleri buraya sürükle veya <button class="act" style="text-decoration:underline" data-newchat>yeni sohbet başlat</button>.</div></div></div>`;
  else if(FX.view==='grid') body.innerHTML = `<div class="fx-grid">${ids.map(gridItem).join('')}</div>`;
  else body.innerHTML = `<table class="fx-list"><thead><tr><th data-sort="name" style="width:44%">Ad${FX.sort!=='date'?' ▾':''}</th><th>Çalışma klasörü</th><th data-sort="date">Son etkinlik${FX.sort==='date'?' ▾':''}</th><th>Tür</th></tr></thead><tbody>${ids.map(listRow).join('')}</tbody></table>`;
  const nf = ids.filter(i=>i[0]==='f').length;
  if(FX.cwd===TRASH && ids.length) body.insertAdjacentHTML('afterbegin', `<div style="display:flex;align-items:center;gap:10px;padding:10px 20px;border-bottom:1px solid var(--line);font-size:12.5px;color:var(--muted)">Buradakiler yalnızca panelden gizlendi, Claude dosyaları silinmedi.<span class="grow"></span><button class="btn" data-emptytrash>Çöp Kutusunu Boşalt</button></div>`);
  $('#fxCount').textContent = `${ids.length} öğe${nf?` (${nf} klasör)`:''}${FX.sel.size?` · ${FX.sel.size} seçili`:''}`;
  if(FX.cwd===GRAPH) $('#fxCount').textContent = gStats();
  $('#fxBody').classList.toggle('graph', FX.cwd===GRAPH);
  $('#slots').innerHTML = Array.from({length:nPanes()}, (_,i) => { const s = sess(S.panes[i]);
    return `<div class="slot ${s?'full':''} ${i===S.active?'act':''}" data-slot="${i}"><b>${i+1}</b><span>${s?esc(s.title):'Boş'}</span></div>`; }).join('');
}
function paintSel(){
  document.querySelectorAll('#fxBody [data-item]').forEach(el => el.classList.toggle('sel', FX.sel.has(el.dataset.item)));
  const ids = listing(); const nf = ids.filter(i=>i[0]==='f').length;
  $('#fxCount').textContent = `${ids.length} öğe${nf?` (${nf} klasör)`:''}${FX.sel.size?` · ${FX.sel.size} seçili`:''}`;
}
function selectClick(id, e){
  const ids = listing();
  if(e.metaKey || e.ctrlKey){ FX.sel.has(id) ? FX.sel.delete(id) : FX.sel.add(id); FX.anchor = id; }
  else if(e.shiftKey && FX.anchor){ const a = ids.indexOf(FX.anchor), b = ids.indexOf(id); ids.slice(Math.min(a,b), Math.max(a,b)+1).forEach(x=>FX.sel.add(x)); }
  else { FX.sel = new Set([id]); FX.anchor = id; }
  paintSel();
}
/* Taşı… penceresi: klasör ağacından hedef seç */
let MV = null;
function openMove(ids){ MV = {ids, target: parentOf(ids[0]), open: new Set(S.folders.map(f=>f.id))}; renderMove(); }
function moveTree(pid, depth){
  return S.folders.filter(f=>f.parent===pid && !f.trashed && !f.hidden).map(f => {
    const bad = MV.ids.some(id => id[0]==='f' && inside(f.id, id));
    const kids = S.folders.some(x=>x.parent===f.id && !x.trashed && !x.hidden);
    return `<button class="pk-i ${MV.target===f.id?'on':''}" ${bad?'disabled style="opacity:.35;cursor:not-allowed"':`data-mv="${f.id}"`} style="padding-left:${8+depth*18}px">${fsvg('fsm', fullF(f.id))}<span>${esc(f.name)}</span><span class="tagdot" style="width:8px;height:8px;border-radius:50%;background:${f.color};flex:none"></span></button>`
      + (kids ? moveTree(f.id, depth+1) : '');
  }).join('');
}
function renderMove(){
  let m = $('#mv'); if(!MV){ m?.remove(); return; }
  if(!m){ m = document.createElement('div'); m.id='mv'; m.className='modal-bg'; document.body.appendChild(m); }
  const label = MV.ids.length===1 ? `“${esc(nameOf(MV.ids[0]))}”` : `${MV.ids.length} öğe`;
  m.innerHTML = `<div class="modal" style="width:min(440px,100%)"><div class="mh2"><h3>${label} taşı</h3><button class="ibtn" data-mvx>${ic('x')}</button></div>
    <div class="mb"><div class="picks pk-l" style="max-height:320px">
      <button class="pk-i ${MV.target===null?'on':''}" data-mv="">${ic('home')}<span>Sohbetler (en üst)</span></button>${moveTree(null,1)}</div></div>
    <div class="mf"><button class="btn" data-mvnew>${ic('folderPlus')}Yeni klasör</button><span class="grow"></span><button class="btn" data-mvx>Vazgeç</button><button class="btn pri" data-mvgo>Taşı</button></div></div>`;
}
/* Önizleme (Quick Look) — boşluk tuşu */
let QL = null;
function quickLook(id){
  QL = id; let m = $('#ql'); if(!id){ m?.remove(); return; }
  if(!m){ m = document.createElement('div'); m.id='ql'; m.className='modal-bg'; document.body.appendChild(m); }
  let body, title;
  if(id[0]==='f'){ const f = fold(id); title = f.name;
    body = `<div style="display:flex;flex-direction:column;gap:4px">${children(id).map(c=>`<div style="display:flex;gap:8px;align-items:center">${c[0]==='f'?fsvg('fsm', fullF(c)):ic('msg')}<span>${esc(nameOf(c))}</span><span style="margin-left:auto;color:var(--faint);font-size:12px">${c[0]==='s'?sess(c).ago:countAll(c)+' öğe'}</span></div>`).join('') || '<span style="color:var(--faint)">Boş klasör</span>'}</div>`; }
  else { const s = sess(id); title = s.title; body = `<div class="msgs-in" style="padding:0;gap:10px">${renderMsgs(s)}</div>`; if(!s.loaded) ensureLoaded(id).then(() => { if(QL===id) quickLook(id); }); }
  const meta = id[0]==='s' ? `${esc(sess(id).project)} · ${sess(id).model} · ${sess(id).ago}` : `${countAll(id)} öğe${fold(id).dir?' · '+esc(fold(id).dir):''}`;
  m.innerHTML = `<div class="modal" style="width:min(680px,100%)"><div class="mh2"><h3>${esc(title)}<div style="font:12px var(--sans);color:var(--muted);margin-top:2px">${meta}</div></h3><button class="ibtn" data-qlx>${ic('x')}</button></div>
    <div class="mb" style="max-height:60vh">${body}</div>
    <div class="mf"><span style="font-size:12px;color:var(--faint);align-self:center">Boşluk / Esc kapatır</span><span class="grow"></span>${id[0]==='s'?Array.from({length:nPanes()},(_,k)=>`<button class="btn" data-qlopen="${k}">Bölme ${k+1}'de aç</button>`).join(''):`<button class="btn pri" data-qlopen="f">Klasörü aç</button>`}</div></div>`;
  hydrateMedia(m, 'ql|');
}
function trashItems(ids){ ids.forEach(id => objOf(id).trashed = true); S.panes = S.panes.map(p => p && gone(p) ? null : p); FX.sel.clear(); render(); toast(`${ids.length} öğe Çöp Kutusuna taşındı`); }
function restoreItems(ids){ ids.forEach(id => { const o = objOf(id); o.trashed = false; if(id[0]==='f' && o.parent && gone(o.parent)) o.parent = null; if(id[0]==='s' && o.folder && gone(o.folder)) o.folder = null; }); FX.sel.clear(); render(); toast('Geri yüklendi'); }
const trashIds = () => S.items.filter(id => { const o = objOf(id); return o && o.trashed && !o.hidden; });
function emptyTrash(){ const ids = trashIds(); if(!ids.length){ toast('Çöp Kutusu zaten boş'); return; } const hide = id => { objOf(id).hidden = true; if(id[0]==='f') S.items.filter(c=>parentOf(c)===id).forEach(hide); }; ids.forEach(hide); render(); toast('Çöp Kutusu boşaltıldı (Claude dosyaları duruyor)'); }
function selMenu(x, y){
  const ids = [...FX.sel];
  if(FX.cwd===TRASH){ menu(x,y,`<button data-m="restore">${ic('sync')}Geri yükle</button><button data-m="hide" style="color:#c0392b">${ic('trash')}Panelden kaldır</button>`); return; }
  menu(x,y,`<div class="mh">${ids.length} öğe seçili</div>
    <button data-m="movedlg">${ic('folder')}Taşı…</button>
    <button data-m="withsel">${ic('folderPlus')}Seçilenlerle yeni klasör</button>
    <button data-m="cut">${ic('clip')}Kes (⌘X)</button>
    <hr><button data-m="trash" style="color:#c0392b">${ic('trash')}Çöp Kutusuna taşı</button>`);
}
const SORTS = [['kind','Tür (önce klasörler)'],['name','Ad'],['date','Son etkinlik']];
const chk = on => on ? '✓ ' : '&nbsp;&nbsp;&nbsp;';
const sortItems = () => SORTS.map(([k,l])=>`<button data-m="sort" data-k="${k}">${chk(FX.sort===k)}${l}</button>`).join('');
function sortMenu(x,y){ menu(x,y, `<div class="mh">Sırala</div>${sortItems()}`); }
// Boş alana sağ tık (Windows masaüstü / Finder gibi): yeni öğe, yapıştır, görünüm, sıralama, tümünü seç, yenile.
// side: kenar çubuğunun boş yeri — yalnızca yeni sohbet / üst düzey klasör.
function bgMenu(x, y, side){
  const cf = side ? null : curFolder(), f = cf && fold(cf), smart = !side && !!FX.cwd && FX.cwd[0]===':', n = side ? 0 : listing().length;
  if(!side && FX.cwd===TRASH){ menu(x, y, n ? `<button data-m="bgall">${ic('target')}Tümünü seç (⌘A)</button><hr><button data-m="bgempty" style="color:#c0392b">${ic('trash')}Çöp Kutusunu Boşalt</button>` : '<div class="mh">Çöp Kutusu boş</div>'); return; }
  menu(x, y, `${f ? `<div class="mh">${esc(f.name)}</div>` : ''}
    <button data-m="bgchat" data-f="${cf||''}">${ic('plus')}Yeni sohbet${cf?' (bu klasörde)':''}</button>
    ${smart ? '' : `<button data-m="bgfolder" data-f="${cf||''}">${ic('folderPlus')}Yeni klasör</button>`}
    ${!side && !smart && FX.clip && FX.clip.length ? `<button data-m="bgpaste">${ic('clip')}Yapıştır (⌘V) · ${FX.clip.length} öğe</button>` : ''}
    ${side ? '' : `<hr><div class="mh">Görünüm</div>
      <button data-m="bgview" data-v="grid">${chk(FX.view==='grid')}Simgeler</button>
      <button data-m="bgview" data-v="list">${chk(FX.view==='list')}Liste</button>
      <div class="mh">Sırala</div>${sortItems()}<hr>
      ${n ? `<button data-m="bgall">${ic('target')}Tümünü seç (⌘A)</button>` : ''}
      ${f && f.dir ? `<button data-m="bgreveal" data-f="${cf}">${ic('ext')}Proje klasörünü aç</button>` : ''}
      <button data-m="bgsync">${ic('sync')}Yenile</button>`}`);
}
// Sıralama varsayılan olarak ada göre; seçilen sıralama hatırlanır
function setSort(k){ FX.sort = k; WS.prefs = {...(WS.prefs||{}), sort:k}; persist(); renderBoard(); }
function syncNow(){ toast('Taranıyor…'); API.sessions.refresh().then(r => { onChanged(r); toast(r.changed.length ? `${r.changed.length} oturum güncellendi` : 'Senkron tamam · değişiklik yok'); }); }

/* ---------- GourceView: canlı ağ görünümü (Gource tarzı) ----------
   Düğümler: merkez (Sohbetler) → klasörler → alt klasörler → sohbetler. Ağaç kenarları klasör yapısıdır.
   Kesikli turuncu çizgiler: kullanıcının kurduğu bağlantılar (S.links). Çalışan sohbetler parlar, merkezden
   onlara ışık parçacıkları akar; başka yerde aktif olanlar kehribar renkte parlar. */
const GRAPH = ':graph';
ICON.graph = '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="9" cy="18" r="2.5"/><path d="M8.4 6.4l7.2 1.2M6.6 8.4l1.7 7.2M16.4 10l-5.8 6.2"/>';
ICON.link = '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>';
ICON.target = '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>';
S.links = [];
const G = { projects:true, pos:{}, cam:{x:0, y:0, k:1}, alpha:1, hover:null, sel:null, selLink:null, linkMode:false, linkFrom:null,
  labels:true, onlyLive:false, act:null, raf:0, t:0, parts:[], flash:{}, mouse:{x:0,y:0, wx:0, wy:0}, w:0, h:0, dpr:1, nodes:[], byId:{} };

// Klasöre konmamış sohbetler, çalışma klasörlerine (proje) göre otomatik "proje düğümleri" altında toplanır.
function gNodes(){
  const ns = [{id:'root', kind:'root', name:'Sohbetler', parent:null}];
  S.folders.forEach(f => { if(!gone(f.id)) ns.push({id:f.id, kind:'f', name:f.name, parent:f.parent||'root'}); });
  const projects = new Map();
  S.sessions.forEach(s => { if(gone(s.id)) return;
    let parent = s.folder || 'root';
    if(!s.folder && G.projects){ const pid = 'p:' + s.project; parent = pid;
      if(!projects.has(pid)) projects.set(pid, {id:pid, kind:'p', name:s.project.split(/[\\/]/).pop() || s.project, path:s.project, parent:'root', count:0});
      projects.get(pid).count++; }
    ns.push({id:s.id, kind:'s', name:s.title, parent}); });
  projects.forEach(p => ns.push(p));
  if(!G.onlyLive) return ns;
  const byId = new Map(ns.map(n => [n.id, n])); const keep = new Set(['root']);
  ns.filter(n => n.kind==='s' && isLive(n.id)).forEach(n => { let c = n; while(c && c.id!=='root'){ keep.add(c.id); c = byId.get(c.parent); } });
  return ns.filter(n => keep.has(n.id));
}
const isLive = id => { const s = sess(id); return s && (s.status==='running' || s.status==='elsewhere' || s.remote); };
const gEdgeLen = n => n.kind==='s' ? 52 : n.kind==='p' ? 135 : n.parent==='root' ? 150 : 100;
function gSync(){
  const ns = gNodes(); const before = Object.keys(G.byId).join(',');
  G.nodes = ns; G.byId = {}; ns.forEach(n => G.byId[n.id] = n);
  ns.forEach(n => {
    if(G.pos[n.id]) return;
    const pp = n.parent && G.pos[n.parent];
    const a = Math.random()*Math.PI*2, L = gEdgeLen(n);
    G.pos[n.id] = n.id==='root' ? {x:0, y:0, vx:0, vy:0} : {x:(pp?pp.x:0)+Math.cos(a)*L, y:(pp?pp.y:0)+Math.sin(a)*L, vx:0, vy:0};
  });
  if(ns.map(n=>n.id).join(',') !== before) G.alpha = Math.max(G.alpha, .6);
  if(G.sel && !G.byId[G.sel]) G.sel = null;
  S.links = S.links.filter(l => objOf(l.a) && objOf(l.b));
  gHud();
}
function gStep(){
  if(G.alpha < .003) return;
  const ns = G.nodes, P = G.pos, al = G.alpha;
  const w = n => n.kind==='root' ? 2.2 : n.kind==='f' ? 1.5 : n.kind==='p' ? 1.1 : .65;
  for(let i=0;i<ns.length;i++) for(let j=i+1;j<ns.length;j++){
    const a = P[ns[i].id], b = P[ns[j].id];
    let dx = b.x-a.x, dy = b.y-a.y, d2 = dx*dx+dy*dy; if(d2 < 1){ dx = Math.random()-.5; dy = Math.random()-.5; d2 = 1; }
    const d = Math.sqrt(d2), f = al * 2600 * w(ns[i]) * w(ns[j]) / Math.max(d2, 400);
    a.vx -= dx/d*f; a.vy -= dy/d*f; b.vx += dx/d*f; b.vy += dy/d*f;
  }
  const spring = (a, b, L, k) => { const dx = b.x-a.x, dy = b.y-a.y, d = Math.hypot(dx,dy)||1, f = (d-L)/d*k*al; a.vx += dx*f; a.vy += dy*f; b.vx -= dx*f; b.vy -= dy*f; };
  ns.forEach(n => { if(n.parent && P[n.parent]) spring(P[n.parent], P[n.id], gEdgeLen(n), .09); });
  S.links.forEach(l => { if(P[l.a] && P[l.b] && G.byId[l.a] && G.byId[l.b]) spring(P[l.a], P[l.b], 170, .015); });
  ns.forEach(n => {
    const p = P[n.id];
    if(n.id==='root' || (G.act && G.act.type==='node' && G.act.id===n.id && G.act.moved) || p.fixed){ p.vx = p.vy = 0; if(n.id==='root'){ p.x = p.y = 0; } return; }
    p.vx -= p.x*.0016*al; p.vy -= p.y*.0016*al;
    p.vx *= .78; p.vy *= .78; p.x += p.vx; p.y += p.vy;
  });
  G.alpha *= .992;
}
function gChain(id){ const out = []; let n = G.byId[id]; while(n){ out.unshift(n.id); n = n.parent ? G.byId[n.parent] : null; } return out; }
function gSpawn(){
  G.nodes.forEach(n => {
    if(n.kind!=='s') return; const s = sess(n.id);
    const rate = s.status==='running' ? 18 : s.status==='elsewhere' ? 40 : 0;
    if(rate && G.t % rate === 0) G.parts.push({ids:gChain(n.id), seg:0, u:0, col: s.status==='running' ? 'acc' : 'warn', sp: .045 + Math.random()*.02});
  });
  G.parts = G.parts.filter(p => {
    p.u += p.sp; if(p.u >= 1){ p.u = 0; p.seg++; }
    if(p.seg >= p.ids.length-1){ G.flash[p.ids.at(-1)] = 1; return false; }
    return G.pos[p.ids[p.seg]] && G.pos[p.ids[p.seg+1]];
  });
}
const gW2S = (x, y) => [G.w/2 + G.cam.x + x*G.cam.k, G.h/2 + G.cam.y + y*G.cam.k];
const gS2W = (sx, sy) => [(sx - G.w/2 - G.cam.x)/G.cam.k, (sy - G.h/2 - G.cam.y)/G.cam.k];
function gRadius(n){ return n.kind==='root' ? 17 : n.kind==='f' ? 9 + Math.sqrt(countAll(n.id))*2.4 : n.kind==='p' ? 6 + Math.sqrt(n.count)*1.8 : 5; }
function gHit(wx, wy){
  let best = null, bd = 1e9;
  G.nodes.forEach(n => { const p = G.pos[n.id]; const d = Math.hypot(p.x-wx, p.y-wy); const r = gRadius(n) + 5/G.cam.k; if(d < r && d < bd){ bd = d; best = n; } });
  return best;
}
function gHitLink(wx, wy){
  const P = G.pos; let best = -1, bd = 7/G.cam.k;
  S.links.forEach((l,i) => { const a = P[l.a], b = P[l.b]; if(!a || !b || !G.byId[l.a] || !G.byId[l.b]) return;
    const dx = b.x-a.x, dy = b.y-a.y, L2 = dx*dx+dy*dy || 1; const u = Math.max(0, Math.min(1, ((wx-a.x)*dx + (wy-a.y)*dy)/L2));
    const d = Math.hypot(a.x+u*dx-wx, a.y+u*dy-wy); if(d < bd){ bd = d; best = i; } });
  return best;
}
function gDraw(){
  const cv = $('#gvCanvas'); if(!cv) return; const c = cv.getContext('2d'); const {w, h, dpr} = G; const k = G.cam.k; const P = G.pos;
  const ACC = '#d97757', WARN = '#e0a43a', TXT = 'rgba(236,233,225,.88)';
  c.setTransform(dpr,0,0,dpr,0,0);
  const bg = c.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w,h)*.7); bg.addColorStop(0,'#211f1c'); bg.addColorStop(1,'#121110');
  c.fillStyle = bg; c.fillRect(0,0,w,h);
  c.save(); c.translate(w/2 + G.cam.x, h/2 + G.cam.y); c.scale(k,k);
  const focus = G.hover || (G.sel ? G.byId[G.sel] : null);
  const hiSet = new Set(focus ? gChain(focus.id) : []);
  if(focus) G.nodes.forEach(n => { if(n.parent===focus.id) hiSet.add(n.id); });
  // ağaç kenarları
  G.nodes.forEach(n => {
    if(!n.parent || !P[n.parent]) return; const a = P[n.parent], b = P[n.id];
    const mx = (a.x+b.x)/2, my = (a.y+b.y)/2, nx = -(b.y-a.y)*.12, ny = (b.x-a.x)*.12;
    const hi = hiSet.has(n.id) && hiSet.has(n.parent);
    c.beginPath(); c.moveTo(a.x, a.y); c.quadraticCurveTo(mx+nx, my+ny, b.x, b.y);
    c.strokeStyle = hi ? 'rgba(217,119,87,.75)' : n.kind==='s' ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.18)';
    c.lineWidth = (hi ? 2 : n.kind==='s' ? 1 : 1.6) / Math.sqrt(k); c.stroke();
  });
  // kullanıcı bağlantıları
  c.setLineDash([6/k, 5/k]);
  S.links.forEach((l,i) => {
    const a = P[l.a], b = P[l.b]; if(!a || !b || !G.byId[l.a] || !G.byId[l.b]) return;
    const on = G.selLink===i || (focus && (l.a===focus.id || l.b===focus.id));
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y);
    c.strokeStyle = on ? 'rgba(240,160,120,.95)' : 'rgba(217,119,87,.5)'; c.lineWidth = (on ? 2.4 : 1.5)/Math.sqrt(k);
    c.lineDashOffset = -G.t*.4/k; c.stroke();
    if(l.label && (k > .6 || on)){ c.setLineDash([]); c.font = `${10.5/Math.sqrt(k)}px -apple-system, sans-serif`; c.textAlign='center';
      const tx = (a.x+b.x)/2, ty = (a.y+b.y)/2 - 4/k; c.fillStyle = 'rgba(18,17,16,.75)'; const tw = c.measureText(l.label).width + 8/k;
      c.fillRect(tx-tw/2, ty-10/Math.sqrt(k), tw, 13/Math.sqrt(k)); c.fillStyle = 'rgba(240,170,135,.95)'; c.fillText(l.label, tx, ty); c.setLineDash([6/k, 5/k]); }
  });
  c.setLineDash([]);
  // bağlantı kurulurken geçici çizgi
  if(G.act && G.act.type==='link'){ const a = P[G.act.from]; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(G.mouse.wx, G.mouse.wy); c.strokeStyle='rgba(240,160,120,.9)'; c.setLineDash([4/k,4/k]); c.lineWidth = 2/k; c.stroke(); c.setLineDash([]); }
  // parçacıklar (ışınlar)
  G.parts.forEach(p => { const a = P[p.ids[p.seg]], b = P[p.ids[p.seg+1]]; const x = a.x+(b.x-a.x)*p.u, y = a.y+(b.y-a.y)*p.u;
    c.beginPath(); c.arc(x, y, 2.2/Math.sqrt(k), 0, 7); c.fillStyle = p.col==='acc' ? '#ffb38f' : '#ffd27a'; c.shadowColor = p.col==='acc' ? ACC : WARN; c.shadowBlur = 12; c.fill(); c.shadowBlur = 0; });
  // düğümler
  const drawOrder = [...G.nodes].sort((a,b) => (a.kind==='s') - (b.kind==='s')).reverse();
  drawOrder.forEach(n => {
    const p = P[n.id], r = gRadius(n);
    let glow = null, ring = null;
    if(n.kind==='s'){ const s = sess(n.id);
      if(s.status==='running') glow = ACC; else if(s.status==='elsewhere') glow = WARN;
      if(s.remote) ring = '#a78bfa'; }
    if((n.kind==='f' || n.kind==='p') && G.nodes.some(m => m.kind==='s' && sess(m.id).status!=='idle' && gChain(m.id).includes(n.id))) glow = glow || 'rgba(217,119,87,.55)';
    if(glow){ const ph = (G.t % 70)/70; c.beginPath(); c.arc(p.x, p.y, r + 3 + ph*16, 0, 7); c.strokeStyle = glow; c.globalAlpha = (1-ph)*.7; c.lineWidth = 1.5; c.stroke(); c.globalAlpha = 1; }
    const fl = G.flash[n.id] || 0; if(fl > .02){ G.flash[n.id] = fl*.9; }
    c.beginPath(); c.arc(p.x, p.y, r + fl*3, 0, 7);
    if(n.kind==='root'){ c.fillStyle = ACC; c.shadowColor = ACC; c.shadowBlur = 25; }
    else if(n.kind==='f'){ c.fillStyle = '#e0825f'; c.shadowColor = glow || 'rgba(0,0,0,0)'; c.shadowBlur = glow ? 18 : 0; }
    else if(n.kind==='p'){ c.fillStyle = '#4a4843'; c.shadowColor = glow || 'rgba(0,0,0,0)'; c.shadowBlur = glow ? 16 : 0; }
    else { const f = fold(sess(n.id).folder); c.fillStyle = glow ? (glow===ACC ? '#ffb08a' : '#ffd27a') : (f ? f.color : '#a19f96'); c.shadowColor = glow || 'rgba(0,0,0,0)'; c.shadowBlur = glow ? 22 : 0; }
    c.fill(); c.shadowBlur = 0;
    if(n.kind==='f'){ c.lineWidth = 2.2; c.strokeStyle = fold(n.id).color; c.stroke();
      // küçük klasör sekmesi
      c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(p.x - r*.38, p.y - r*.22, r*.76, r*.48); c.fillStyle = '#c45f3c'; c.fillRect(p.x - r*.38, p.y - r*.3, r*.32, r*.12); }
    if(n.kind==='root'){ c.fillStyle = '#fff'; c.font = '600 12px -apple-system, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('✳', p.x, p.y+.5); c.textBaseline = 'alphabetic'; }
    if(n.kind==='p'){ c.lineWidth = 1.5; c.strokeStyle = '#8a877f'; c.stroke(); c.fillStyle = '#cfcabf'; c.font = `600 ${Math.max(8, r*.9)}px ui-monospace, monospace`; c.textAlign='center'; c.textBaseline='middle'; c.fillText('>_', p.x, p.y+.5); c.textBaseline='alphabetic'; }
    if(ring){ c.beginPath(); c.arc(p.x, p.y, r+3, 0, 7); c.strokeStyle = ring; c.lineWidth = 1.4; c.stroke(); }
    if(G.sel===n.id || (G.act && G.act.type==='link' && G.act.from===n.id)){ c.beginPath(); c.arc(p.x, p.y, r+5, 0, 7); c.strokeStyle = '#fff'; c.lineWidth = 1.6/Math.sqrt(k); c.stroke(); }
    if(G.act && G.act.drop===n.id){ c.beginPath(); c.arc(p.x, p.y, r+8, 0, 7); c.setLineDash([4,3]); c.strokeStyle = ACC; c.lineWidth = 2; c.stroke(); c.setLineDash([]); }
    // etiket
    const showLbl = n.kind!=='s' || hiSet.has(n.id) || glow || (G.labels && k > .85);
    if(showLbl && n.kind!=='root'){
      const fs = (n.kind==='f' ? 12 : n.kind==='p' ? 11 : 10.5) / Math.sqrt(k);
      c.font = n.kind==='p' ? `500 ${fs}px ui-monospace, monospace` : `${n.kind==='f'?600:400} ${fs}px -apple-system, sans-serif`; c.textAlign = 'center';
      const txt = n.name.length > 26 ? n.name.slice(0,25)+'…' : n.name;
      c.fillStyle = 'rgba(18,17,16,.6)'; const tw = c.measureText(txt).width; c.fillRect(p.x - tw/2 - 3, p.y + r + 3, tw + 6, fs + 4);
      c.fillStyle = glow && n.kind==='s' ? '#ffd2bd' : TXT; c.fillText(txt, p.x, p.y + r + fs + 3);
    }
  });
  c.restore();
}
function gFrame(){
  if(!(S.org && FX.cwd===GRAPH && $('#gvCanvas'))){ G.raf = 0; return; }
  G.t++; gStep(); gSpawn(); gDraw();
  G.raf = requestAnimationFrame(gFrame);
}
function gStats(){ const np = G.nodes.filter(n=>n.kind==='p').length; const nf = G.nodes.filter(n=>n.kind==='f').length, ns = G.nodes.filter(n=>n.kind==='s').length;
  const live = G.nodes.filter(n=>n.kind==='s' && sess(n.id).status!=='idle').length;
  return `${nf} klasör · ${np} proje · ${ns} sohbet · ${live} canlı · ${S.links.length} bağlantı`; }
function gCard(){
  if(G.selLink != null && S.links[G.selLink]){ const l = S.links[G.selLink];
    return `<div class="gv-card"><div class="gv-k">Bağlantı</div><div class="gv-t">${esc(nameOf(l.a))} <span style="color:var(--accent)">↔</span> ${esc(nameOf(l.b))}</div>
      <input class="inp" id="gvLabel" placeholder="Etiket (isteğe bağlı)" value="${esc(l.label||'')}" style="margin-top:8px;width:100%">
      <div class="gv-acts"><button class="btn" data-g="unlink" data-i="${G.selLink}" style="color:#c0392b">${ic('trash')}Bağlantıyı kaldır</button></div></div>`; }
  const n = G.sel && G.byId[G.sel]; if(!n || n.kind==='root') return '';
  if(n.kind==='p') return `<div class="gv-card"><div class="gv-k">Proje (çalışma klasörü)</div><div class="gv-t">${esc(n.name)}</div><div class="gv-m"><span class="mono">${esc(n.path)}</span> · ${n.count} klasörsüz sohbet</div>
    <div class="gv-acts"><button class="btn" data-g="reveal">${ic('ext')}Finder'da aç</button><button class="btn" data-g="mkfolder">${ic('folderPlus')}Bunlardan klasör yap</button></div></div>`;
  const links = S.links.map((l,i)=>({l,i})).filter(x => x.l.a===n.id || x.l.b===n.id);
  const linkList = links.length ? `<div class="gv-k" style="margin-top:10px">Bağlantılar</div>${links.map(x=>{ const o = x.l.a===n.id ? x.l.b : x.l.a;
    return `<div class="gv-li"><span>↔ ${esc(nameOf(o))}${x.l.label?` <em>· ${esc(x.l.label)}</em>`:''}</span><button class="ibtn" data-g="unlink" data-i="${x.i}" title="Kaldır">${ic('x')}</button></div>`; }).join('')}` : '';
  if(n.kind==='f'){ const f = fold(n.id);
    return `<div class="gv-card"><div class="gv-k">Klasör</div><div class="gv-t"><span class="tagdot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${f.color};margin-right:6px"></span>${esc(f.name)}</div>
      <div class="gv-m">${countAll(n.id)} öğe${f.dir?` · <span class="mono">${esc(f.dir)}</span>`:''}</div>
      <div class="gv-acts"><button class="btn" data-g="goto">${ic('folder')}Klasörü aç</button><button class="btn" data-g="newin">${ic('plus')}Yeni sohbet</button><button class="btn ${G.linkMode?'pri':''}" data-g="linkfrom">${ic('link')}Bağla…</button></div>${linkList}</div>`; }
  const s = sess(n.id); const f = fold(s.folder);
  const st = s.status==='running' ? '<span style="color:var(--accent)">● Çalışıyor</span>' : s.status==='elsewhere' ? '<span style="color:var(--live)">● Claude\'da da açık</span>' : '○ Boşta';
  return `<div class="gv-card"><div class="gv-k">Sohbet</div><div class="gv-t">${esc(s.title)}</div>
    <div class="gv-m">${st} · ${s.model} · ${s.ago}</div><div class="gv-m"><span class="mono">${esc(s.project)}</span>${f?` · ${esc(f.name)}`:''}</div>
    <div class="gv-acts">${Array.from({length:nPanes()},(_,k)=>`<button class="btn" data-g="open" data-i="${k}">Bölme ${k+1}</button>`).join('')}<button class="btn" data-g="ql">${ic('search')}Önizle</button><button class="btn" data-g="linkfrom">${ic('link')}Bağla…</button></div>${linkList}</div>`;
}
function gHud(){
  const hud = $('#gvHud'); if(!hud) return;
  $('#gvStats').textContent = gStats();
  $('#gvCardWrap').innerHTML = gCard();
  document.querySelectorAll('[data-g="linkmode"]').forEach(b => b.classList.toggle('on', G.linkMode));
  document.querySelectorAll('[data-g="labels"]').forEach(b => b.classList.toggle('on', G.labels));
  document.querySelectorAll('[data-g="live"]').forEach(b => b.classList.toggle('on', G.onlyLive));
  document.querySelectorAll('[data-g="projects"]').forEach(b => b.classList.toggle('on', G.projects));
  $('#gvHint').textContent = G.linkMode || (G.act && G.act.type==='link') ? (G.linkFrom ? `“${nameOf(G.linkFrom)}” → bağlanacak düğüme tıkla · Esc iptal` : 'Bağlantı modu: ilk düğüme tıkla (veya ⇧ basılı sürükle)') :
    'Sürükle: düğümü taşı · Klasöre bırak: içine taşı · ⇧ + sürükle: bağla · Çift tık: aç · Tekerlek: yakınlaştır';
}
function gFit(){
  if(!G.nodes.length || !G.w) return; let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  G.nodes.forEach(n => { const p = G.pos[n.id]; x0 = Math.min(x0,p.x); y0 = Math.min(y0,p.y); x1 = Math.max(x1,p.x); y1 = Math.max(y1,p.y); });
  const k = Math.min(2, Math.max(.3, Math.min(G.w/(x1-x0+160), G.h/(y1-y0+160))));
  G.cam.k = k; G.cam.x = -(x0+x1)/2*k; G.cam.y = -(y0+y1)/2*k;
}
function gMount(body){
  if(!$('#gv')){
    body.innerHTML = `<div class="gv" id="gv"><canvas id="gvCanvas"></canvas>
      <div class="gv-hud" id="gvHud">
        <div class="gv-top"><span class="gv-stats"><span class="gv-live"></span><span id="gvStats"></span></span><span class="grow"></span>
          <button class="gv-b" data-g="linkmode">${ic('link')}Bağlantı kur</button><button class="gv-b on" data-g="labels">Etiketler</button><button class="gv-b on" data-g="projects">Proje düğümleri</button><button class="gv-b" data-g="live">Yalnızca canlı</button><button class="gv-b" data-g="fit">${ic('target')}Sığdır</button><button class="gv-b" data-g="shake">Yeniden düzenle</button></div>
        <div id="gvCardWrap"></div>
        <div class="gv-legend"><span><i style="background:#e0825f;border:2px solid #c96442"></i>Klasör</span><span><i style="background:#4a4843;border:1.5px solid #8a877f"></i>Proje</span><span><i style="background:#a19f96"></i>Sohbet</span><span><i class="glow"></i>Çalışıyor</span><span><i style="background:#ffd27a;box-shadow:0 0 8px #e0a43a"></i>Başka yerde</span><span><i style="background:none;border:1.5px solid #a78bfa"></i>Uzaktan</span><span><b class="dash"></b>Bağlantı</span></div>
        <div class="gv-hint" id="gvHint"></div>
      </div></div>`;
    const wrap = $('#gv'), cv = $('#gvCanvas');
    const size = () => { const r = wrap.getBoundingClientRect(); G.dpr = devicePixelRatio || 1; G.w = r.width; G.h = r.height; cv.width = r.width*G.dpr; cv.height = r.height*G.dpr; cv.style.width = r.width+'px'; cv.style.height = r.height+'px'; };
    new ResizeObserver(size).observe(wrap); size();
    gSync();
    if(!G.fitted){ for(let i=0;i<260;i++) gStep(); gFit(); G.fitted = true; }
    cv.addEventListener('pointerdown', gDown); cv.addEventListener('pointermove', gMove); cv.addEventListener('pointerup', gUp);
    cv.addEventListener('pointerleave', () => { G.hover = null; cv.style.cursor = 'default'; });
    cv.addEventListener('dblclick', e => { const n = gHit(...gS2W(...gLocal(e))); if(!n) return; if(n.kind==='s'){ setOrg(false); openIn(n.id); } else if(n.kind==='f') go(n.id); else if(n.kind==='p') API.fs.reveal(n.path); });
    cv.addEventListener('wheel', e => { e.preventDefault(); const [sx, sy] = gLocal(e); const [wx, wy] = gS2W(sx, sy);
      G.cam.k = Math.min(3, Math.max(.25, G.cam.k * Math.exp(-e.deltaY*.0015))); G.cam.x = sx - G.w/2 - wx*G.cam.k; G.cam.y = sy - G.h/2 - wy*G.cam.k; }, {passive:false});
    wrap.addEventListener('input', e => { if(e.target.id==='gvLabel' && S.links[G.selLink]) S.links[G.selLink].label = e.target.value; });
  } else gSync();
  if(!G.raf) G.raf = requestAnimationFrame(gFrame);
}
function gLocal(e){ const r = $('#gvCanvas').getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
function gDown(e){
  const [sx, sy] = gLocal(e), [wx, wy] = gS2W(sx, sy); const n = gHit(wx, wy);
  e.target.setPointerCapture(e.pointerId);
  if(n && (e.shiftKey || G.linkMode) && (n.kind==='f' || n.kind==='s')){
    if(G.linkFrom && G.linkFrom !== n.id){ gAddLink(G.linkFrom, n.id); G.linkFrom = null; G.linkMode = false; gHud(); return; }
    G.act = {type:'link', from:n.id, sx, sy}; G.linkFrom = n.id; gHud(); return; }
  if(n){ G.act = {type:'node', id:n.id, sx, sy, moved:false, ox: G.pos[n.id].x - wx, oy: G.pos[n.id].y - wy}; return; }
  const li = gHitLink(wx, wy);
  if(li >= 0){ G.selLink = li; G.sel = null; gHud(); return; }
  G.act = {type:'pan', sx, sy, cx: G.cam.x, cy: G.cam.y, moved:false};
}
function gMove(e){
  const [sx, sy] = gLocal(e), [wx, wy] = gS2W(sx, sy); G.mouse = {x:sx, y:sy, wx, wy};
  const a = G.act; const cv = $('#gvCanvas');
  if(!a){ const n = gHit(wx, wy); G.hover = n; cv.style.cursor = n ? (G.linkMode||e.shiftKey ? 'crosshair' : 'grab') : gHitLink(wx,wy)>=0 ? 'pointer' : 'default'; return; }
  if(a.type==='pan'){ G.cam.x = a.cx + sx - a.sx; G.cam.y = a.cy + sy - a.sy; if(Math.hypot(sx-a.sx, sy-a.sy) > 3) a.moved = true; cv.style.cursor = 'grabbing'; return; }
  if(a.type==='node'){ if(!a.moved && Math.hypot(sx-a.sx, sy-a.sy) < 4) return; a.moved = true; cv.style.cursor = 'grabbing';
    const p = G.pos[a.id]; p.x = wx + a.ox; p.y = wy + a.oy; G.alpha = Math.max(G.alpha, .25);
    const t = gHit(wx, wy, a.id); const tn = G.nodes.find(m => m.id!==a.id && (m.kind==='f' || m.kind==='root') && Math.hypot(G.pos[m.id].x-wx, G.pos[m.id].y-wy) < gRadius(m)+8);
    a.drop = tn && tn.id !== G.byId[a.id].parent && !(a.id[0]==='f' && tn.id!=='root' && inside(tn.id, a.id)) ? tn.id : null; return; }
  if(a.type==='link'){ G.hover = gHit(wx, wy); }
}
function gUp(e){
  const a = G.act; G.act = null; if(!a) return;
  const [sx, sy] = gLocal(e), [wx, wy] = gS2W(sx, sy);
  if(a.type==='pan' && !a.moved){ G.sel = null; G.selLink = null; if(!G.linkMode) G.linkFrom = null; gHud(); return; }
  if(a.type==='node'){
    if(!a.moved){ G.sel = a.id; G.selLink = null; gHud(); return; }
    if(a.drop){ const tg = a.drop==='root' ? null : a.drop; G.pos[a.id].fixed = false; moveInto([a.id], tg); return; }
    G.pos[a.id].fixed = true; // elle yerleştirilen düğüm yerinde kalır
    return; }
  if(a.type==='link'){ const n = gHit(wx, wy);
    if(n && n.id !== a.from && (n.kind==='f' || n.kind==='s')){ gAddLink(a.from, n.id); G.linkFrom = null; G.linkMode = false; }
    else if(!n || n.id===a.from){ G.sel = a.from; /* bağlantı modunda: ikinci tıklamayı bekle */ if(!G.linkMode && !e.shiftKey) G.linkFrom = null; }
    gHud(); }
}
function gAddLink(a, b){
  if(S.links.some(l => (l.a===a && l.b===b) || (l.a===b && l.b===a))){ toast('Bu bağlantı zaten var'); return; }
  S.links.push({a, b, label:''}); G.selLink = S.links.length-1; G.sel = null; G.alpha = Math.max(G.alpha, .4);
  gHud(); toast(`Bağlandı: ${nameOf(a)} ↔ ${nameOf(b)}`); setTimeout(()=>$('#gvLabel')?.focus(), 30);
}
function gAction(k, d){
  const n = G.sel && G.byId[G.sel];
  if(k==='linkmode'){ G.linkMode = !G.linkMode; G.linkFrom = null; }
  if(k==='labels') G.labels = !G.labels;
  if(k==='live'){ G.onlyLive = !G.onlyLive; gSync(); }
  if(k==='fit') gFit();
  if(k==='shake'){ Object.values(G.pos).forEach(p => { p.fixed = false; p.x += (Math.random()-.5)*60; p.y += (Math.random()-.5)*60; }); G.alpha = 1; }
  if(k==='open' && n){ setOrg(false); openIn(n.id, +d.i); return; }
  if(k==='ql' && n){ quickLook(n.id); return; }
  if(k==='goto' && n){ go(n.id); return; }
  if(k==='newin' && n){ newChat({group:n.id}); return; }
  if(k==='reveal' && n){ API.fs.reveal(n.path); return; }
  if(k==='mkfolder' && n){ const ids = G.nodes.filter(m => m.parent===n.id).map(m => m.id); openNewFolder(null, ids); NF.name = n.name; NF.dir = n.path; renderNF(); return; }
  if(k==='projects'){ G.projects = !G.projects; gSync(); }
  if(k==='linkfrom' && n){ G.linkMode = true; G.linkFrom = n.id; }
  if(k==='unlink'){ S.links.splice(+d.i, 1); G.selLink = null; toast('Bağlantı kaldırıldı'); }
  gHud(); if(k==='live') gHud();
}
function gKey(e){
  if(e.key==='Escape' && (G.linkMode || G.linkFrom || G.sel || G.selLink!=null)){ e.preventDefault(); G.linkMode = false; G.linkFrom = null; G.sel = null; G.selLink = null; gHud(); return true; }
  if((e.key==='Backspace' || e.key==='Delete') && G.selLink!=null){ e.preventDefault(); gAction('unlink', {i:G.selLink}); return true; }
  if(e.key==='Backspace'){ e.preventDefault(); return true; }
  if(e.key.toLowerCase()==='l' && !MOD(e)){ gAction('linkmode', {}); return true; }
  if(e.key.toLowerCase()==='f' && !MOD(e)){ gFit(); return true; }
  if(e.key===' ' && G.sel){ e.preventDefault(); quickLook(G.sel); return true; }
  if(e.key==='Enter' && G.sel){ e.preventDefault(); const n = G.byId[G.sel]; if(n.kind==='s'){ setOrg(false); openIn(n.id); } else go(n.id); return true; }
  return ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key) || (MOD(e) && e.key.toLowerCase()==='a');
}

/* ---------- Full-screen search ---------- */
const PROMPTS = {};
const SR = {open:false, q:'', scope:'all', folder:null, sel:0, res:[], back:null, backQ:'', idx:null};
// İçerik araması ana süreçteki dizinde yapılır (tüm sohbetler, Türkçe karakter duyarsız)
let srT = null;
function backendSearch(){
  clearTimeout(srT);
  const q = SR.q.trim();
  if(q.length < 2){ SR.back = null; SR.backQ = ''; return; }
  srT = setTimeout(async () => {
    const r = await API.search.query(q);
    if(SR.q.trim() !== q) return;
    SR.back = new Map(r.results.map(x => ['s:' + x.id, x])); SR.backQ = q; SR.idx = r;
    if(SR.open) renderSearch();
  }, 140);
}
const trNorm = s => s.toLocaleLowerCase('tr').replace(/[çğıöşüâîû]/g, c => ({'ç':'c','ğ':'g','ı':'i','ö':'o','ş':'s','ü':'u','â':'a','î':'i','û':'u'})[c]);
function textOf(s){
  const msg = s.msgs.map(m => m.r==='u' ? m.t : m.b.map(b => b.t==='text' ? b.v.replace(/<[^>]+>/g,'') : b.a+' '+b.o).join(' ')).join(' \n ');
  return (msg || PROMPTS[s.id] || '') + ' ' + s.outputs.join(' ');
}
// Vurgulama ve alıntı: Türkçe karakter duyarsız, her kelime ayrı ayrı (normalleştirme karakter karakter, konumlar korunur)
function hl(text, q){
  text = String(text || ''); const words = trNorm(q || '').split(/\s+/).filter(w => w.length >= 2);
  if(!words.length || text.length !== trNorm(text).length) return esc(text);
  const n = trNorm(text), mark = new Uint8Array(text.length);
  for(const w of words){ let i = n.indexOf(w); while(i >= 0){ mark.fill(1, i, i + w.length); i = n.indexOf(w, i + w.length); } }
  let out = '', open = false;
  for(let i = 0; i < text.length; i++){ if(mark[i] && !open){ out += '<mark>'; open = true; } if(!mark[i] && open){ out += '</mark>'; open = false; } out += esc(text[i]); }
  return out + (open ? '</mark>' : '');
}
function snippet(text, q){ const t = String(text || '').replace(/\s+/g,' ').trim(); if(!q) return t.slice(0,180);
  const w = trNorm(q).split(/\s+/).find(x => x.length >= 2) || ''; const i = trNorm(t).indexOf(w); if(i<0) return t.slice(0,220);
  const a = Math.max(0, i-60); return (a?'…':'') + t.slice(a, a+220); }
function inFolder(s, fid){ let f = s.folder; while(f){ if(f===fid) return true; f = fold(f)?.parent; } return false; }
function setSearch(v){ SR.open = v; renderRail(); const fe = $('#srEnter'); if(fe) fe.textContent = `Bölme ${S.active+1}'de aç`; $('#srch').classList.toggle('open', v); if(v){ SR.sel=0; renderSearch(); setTimeout(()=>{ const i=$('#sq'); i.focus(); i.select(); }, 30); } }
function renderSearch(){
  const q = SR.q.trim(), ql = q.toLowerCase();
  $('#srOpts').innerHTML = [['all','Tümü'],['title','Başlıklar'],['content','Mesajlar'],['files','Dosyalar']].map(([k,l])=>`<button class="chipb ${SR.scope===k?'on':''}" data-sscope="${k}">${l}</button>`).join('')
    + '<span class="vline"></span>' + `<button class="chipb ${!SR.folder?'on':''}" data-sfold="">Her yer</button>`
    + S.folders.filter(f=>!f.parent).map(f=>`<button class="chipb ${SR.folder===f.id?'on':''}" data-sfold="${f.id}"><span class="dot" style="background:${f.color}"></span>${esc(f.name)}</button>`).join('');
  const res = [];
  S.items.filter(id=>id[0]==='s' && !gone(id)).map(sess).forEach(s => {
    if(SR.folder && !inFolder(s, SR.folder)) return;
    const bk = SR.back && SR.backQ === q ? SR.back.get(s.id) : null;
    const body = bk ? bk.snippet : textOf(s);
    const qn = trNorm(q);
    const tHit = !q || trNorm(s.title).includes(qn) || trNorm(s.project).includes(qn);
    const cHit = q && (!!bk || trNorm(body).includes(qn));
    const fHit = q && s.outputs.some(o=>o.toLowerCase().includes(ql));
    const ok = SR.scope==='all' ? (tHit||cHit) : SR.scope==='title' ? tHit : SR.scope==='content' ? cHit : (q ? fHit : s.outputs.length);
    if(ok) res.push({s, score: (tHit ? 100000 : 0) + (bk ? bk.hits : cHit ? 1 : 0), body, hits: bk ? bk.hits : 0});
  });
  if(q) res.sort((a,b)=>b.score-a.score);
  SR.res = res; SR.sel = Math.min(SR.sel, Math.max(0,res.length-1));
  const head = q ? `${res.length} sonuç · “${esc(q)}”` : 'Son sohbetler';
  const I = SR.idx || {}; const idxTxt = I.building && I.progress ? `İçerik dizini hazırlanıyor… ${I.progress.done}/${I.progress.total}` : I.docs ? `${I.docs} sohbetin tüm içeriği aranıyor` : `${S.sessions.length} oturum`;
  $('#srList').innerHTML = `<div class="sr-gh"><span>${head}</span><span>${idxTxt}</span></div>` + (res.length ? res.map((r,i)=>{
    const s = r.s, f = fold(s.folder), p = paneOf(s.id);
    const lead = s.status==='running' ? '<span class="spin"></span>' : s.status==='elsewhere' ? '<span class="edot"></span>' : ic(SR.scope==='files'?'file':'msg');
    const sn = SR.scope==='files' ? s.outputs.map(o=>hl(o,q)).join(' · ') : hl(snippet(r.body, q), q);
    return `<div class="sr-row ${i===SR.sel?'sel':''}" data-sres="${i}">
      <span class="ico">${lead}</span>
      <div class="bd"><div class="tt">${hl(s.title,q)}</div>${sn?`<div class="sn">${sn}</div>`:''}
        <div class="mt">${r.hits?`<span class="rc-badge">${r.hits} eşleşme</span>`:''}${f?`<span class="chip"><span class="dot" style="background:${f.color}"></span>${esc(f.name)}</span>`:'<span>Klasörsüz</span>'}<span class="mono">${hl(s.project.replace('~/Desktop/',''),q)}</span><span>${s.ago}</span><span>${s.model}</span>${p?`<span class="rc-badge" style="background:var(--accent);color:#fff">Bölme ${p}</span>`:''}${s.remote?`<span class="rc-badge">${ic('cursor')}Uzaktan</span>`:''}</div></div>
      <div class="op"><span>Bölmede aç</span>${Array.from({length:nPanes()},(_,k)=>`<button data-sopen="${s.id}" data-into="${k}" class="${S.panes[k]===s.id?'cur':''}" title="Bölme ${k+1}'de aç${S.panes[k] && sess(S.panes[k]) ? ' (şu an: ' + esc(sess(S.panes[k]).title.slice(0, 30)) + ')' : ' (boş)'}">${k+1}</button>`).join('')}</div></div>`; }).join('')
    : `<div style="text-align:center;color:var(--muted);padding:60px 0"><div style="font:500 18px var(--serif);color:var(--text)">Sonuç yok</div>Farklı bir kelime dene veya filtreyi “Her yer” yap.</div>`);
  document.querySelector('.sr-row.sel')?.scrollIntoView({block:'nearest'});
}
function openFromSearch(id, i=S.active){ setSearch(false); setOrg(false); openIn(id, i); toast(`Bölme ${i+1}'de açıldı`); }

/* ---------- New-folder dialog (klasör seçme arayüzü) ---------- */
const DISK = []; // boot() içinde ~/Desktop klasörleriyle dolar
const COLORS = ['#c96442','#c08a2e','#4f8a5b','#4a7fb5','#8a7fc4','#b5577a','#75736c'];
let NF = null;
function openNewFolder(parent=null, preset=[]){
  NF = {parent, name:'', color:COLORS[S.folders.length % COLORS.length], dir:null, picked:new Set(preset), dq:'', cq:''};
  renderNF(); setTimeout(()=>$('#nfName')?.focus());
}
function renderNF(){
  let m = $('#nf'); if(!NF){ m?.remove(); return; }
  if(!m){ m = document.createElement('div'); m.id='nf'; m.className='modal-bg'; document.body.appendChild(m); }
  const par = NF.parent && fold(NF.parent);
  const dirs = DISK.filter(d=>d.toLowerCase().includes(NF.dq.toLowerCase()));
  const cands = S.sessions.filter(s=>!gone(s.id) && (!s.folder || s.folder!==NF.parent)).sort((a,b)=>(!!a.folder)-(!!b.folder));
  rebuild(m, `<div class="modal" role="dialog" aria-label="Yeni klasör">
    <div class="mh2"><h3>${par?`“${esc(par.name)}” içine alt klasör`:'Yeni klasör'}</h3><button class="ibtn" data-nf="close">${ic('x')}</button></div>
    <div class="mb">
      <label class="fl">Ad</label>
      <div style="display:flex;gap:8px;align-items:center">
        <input id="nfName" class="inp" placeholder="ör. Müşteri Siteleri" value="${esc(NF.name)}">
        <div style="display:flex;gap:5px">${COLORS.map(c=>`<button data-nf="color" data-c="${c}" style="width:20px;height:20px;border-radius:6px;background:${c};${NF.color===c?'outline:2px solid var(--text);outline-offset:2px':''}"></button>`).join('')}</div>
      </div>
      <label class="fl">Çalışma klasörü <span>· bu klasörde açılan yeni sohbetler burada başlar (isteğe bağlı)</span></label>
      <div class="picker">
        <div class="pk-h">${ic('folder')}<span class="mono">~/Desktop</span><span class="grow"></span><input class="pk-s" id="nfDq" placeholder="Filtrele" value="${esc(NF.dq)}"></div>
        <div class="pk-l">${dirs.map(d=>`<button class="pk-i ${NF.dir==='~/Desktop/'+d?'on':''}" data-nf="dir" data-d="~/Desktop/${esc(d)}">${ic('folder')}<span>${esc(d)}</span>${NF.dir==='~/Desktop/'+d?ic('chev'):''}</button>`).join('')}</div>
        <div class="pk-f"><button class="btn" data-nf="finder">${ic('ext')}Finder'da seç…</button><span class="grow"></span><span class="mono" style="color:var(--muted)">${NF.dir?esc(NF.dir):'Seçilmedi'}</span>${NF.dir?`<button class="ibtn" data-nf="nodir" title="Temizle">${ic('x')}</button>`:''}</div>
      </div>
      ${[...NF.picked].some(x=>x[0]==='f')?`<div style="font-size:12px;color:var(--muted)">${fsvg('fsm')} ${[...NF.picked].filter(x=>x[0]==='f').map(x=>esc(fold(x).name)).join(', ')} klasörü de içine taşınacak</div>`:''}
      <label class="fl" style="display:flex;align-items:center;gap:8px">İçine taşınacak sohbetler <span>· ${NF.picked.size} seçili</span><span class="grow"></span>
        <span class="nf-q">${ic('search')}<input id="nfCq" placeholder="Sohbet ara…" value="${esc(NF.cq||'')}" autocomplete="off"></span></label>
      <div class="pk-l picks" id="nfPicks">${cands.map(s=>{ const f=fold(s.folder); return `<label class="pk-c" data-q="${esc(trNorm(s.title+' '+s.project))}"><input type="checkbox" data-nf="pick" data-id="${s.id}" ${NF.picked.has(s.id)?'checked':''}><span class="lbl">${esc(s.title)}</span>${f?`<span class="dot" style="background:${f.color}"></span>`:''}<span class="mono" style="color:var(--faint)">${esc(s.project.replace('~/Desktop/',''))}</span></label>`; }).join('')}<div class="nf-none" style="display:none">Eşleşen sohbet yok</div></div>
    </div>
    <div class="mf"><span class="grow"></span><button class="btn" data-nf="close">Vazgeç</button><button class="btn pri" data-nf="create">Oluştur</button></div>
  </div>`, 'nfName', filterNFPicks);
}
// Sohbet listesini yerinde süz (yeniden çizmeden: yazarken odak kaybolmaz)
function filterNFPicks(){
  const box = $('#nfPicks'); if(!box || !NF) return;
  const words = trNorm(NF.cq || '').split(/\s+/).filter(Boolean); let shown = 0;
  box.querySelectorAll('.pk-c').forEach(l => { const ok = words.every(w => l.dataset.q.includes(w)); l.style.display = ok ? '' : 'none'; if(ok) shown++; });
  box.querySelector('.nf-none').style.display = shown ? 'none' : '';
}
function createFolder(){
  const id = 'f'+Date.now();
  const name = ($('#nfName').value.trim()) || (NF.dir ? NF.dir.split(/[\\/]/).pop() : 'Yeni klasör');
  S.folders.push({id, name, color:NF.color, parent:NF.parent, open:true, dir:NF.dir});
  S.items.push(id);
  NF.picked.forEach(x => { if(x[0]==='f'){ if(x!==id && !inside(id, x)) fold(x).parent = id; } else { sess(x).folder = id; sess(x).fresh = false; } });
  if(NF.parent) fold(NF.parent).open = true;
  const n = NF.picked.size; const NF_parent = NF.parent; NF = null; renderNF();
  if(!S.org) setOrg(true); go(NF_parent); FX.sel = new Set([id]);
  render(); toast(`"${name}" oluşturuldu${n?` · ${n} öğe taşındı`:''}`);
}

/* ---------- Panes ---------- */
// Mesaj listesi parça parça üretilir: her mesaj (ve bilgi notu) ayrı bir dizedir. Bölmede yalnızca değişen parça
// DOM'a yazılır (patchMsgs); uzun sohbette akış ya da senkron bütün geçmişi yeniden çizmez.
function msgParts(s){
  const note = t => `<div class="a" style="color:var(--muted);font-size:13.5px;font-family:var(--sans)">${t}</div>`;
  if(s.draft) return [note('Yeni sohbet · <span class="mono">'+esc(s.project)+'</span>. İlk mesajı gönderdiğinde Claude bu klasörde başlar.')];
  if(!s.loaded) return [note('<span class="spin" style="display:inline-block;vertical-align:-2px;margin-right:6px"></span>Sohbet geçmişi yükleniyor…')];
  if(s.loadErr) return [note('Yüklenemedi: '+esc(s.loadErr))];
  if(!s.msgs.length) return [note('Bu sohbette gösterilecek mesaj yok.')];
  const parts = s.skipped ? [note(`Daha eski ${s.skipped} tur gösterilmiyor (son ${s.turns - s.skipped} tur).`)] : [];
  s.msgs.forEach((m, mi) => parts.push(msgHTML(s, m, mi)));
  return parts;
}
/* ---------- Mesajdaki dosya yolları: tıkla → önizle (görsel/video) ya da aç; sağ tık → Aç, Klasörde göster, Yolu kopyala ---------- */
const FP_RX = /^(?:[A-Za-z]:[\\/]|~[\\/]|\/|\.{1,2}[\\/])?[^\s`'"<>|*?]*(?:[ ][^\s`'"<>|*?]+)*\.[A-Za-z0-9]{1,5}$/;
const FP_MEMO = new Map();
function linkPaths(html){
  if(!html.includes('<code>')) return html;
  let r = FP_MEMO.get(html); if(r !== undefined) return r;
  r = html.replace(/<code>([^<]{1,300})<\/code>/g, (all, x) => { const t = decodeEnt(x).trim();
    if(/^https?:/i.test(t) || !FP_RX.test(t) || (/\s/.test(t) && !/[\\/]/.test(t)) || /^\d+(\.\d+)+$/.test(t)) return all;
    return `<code class="fpath" data-fp="${esc(t)}" title="Tıkla: önizle / aç · sağ tık: diğer seçenekler">${x}</code>`; });
  if(FP_MEMO.size > 4000) FP_MEMO.clear(); FP_MEMO.set(html, r); return r;
}
const IMG_EXT_RX = /\.(png|jpe?g|gif|webp)$/i, VID_EXT_RX = /\.(mp4|m4v|mov|webm)$/i;
function fpResolve(el){
  const raw = el.dataset.fp || '';
  const pane = el.closest('.pane'), s = pane ? sess(S.panes[+pane.dataset.pane]) : QL ? sess(QL) : sess(S.panes[S.active]);
  if(/^(~|\/|[A-Za-z]:[\\/])/.test(raw)) return raw;
  const cwd = s && (s.cwd || s.project); if(!cwd) return raw;
  const win = /^[A-Za-z]:\\/.test(cwd) || /\\/.test(raw);
  return cwd.replace(/[\\/]+$/, '') + (win ? '\\' : '/') + raw.replace(/^\.[\\/]/, '');
}
function fpOpen(p){ API.fs.reveal(p).then(ok => ok || toast('Bulunamadı: ' + p)); }
function fpPreview(p){
  if(!IMG_EXT_RX.test(p) && !VID_EXT_RX.test(p)) return fpOpen(p);
  const src = 'cpmedia://local/' + encodeURIComponent(p);
  if(VID_EXT_RX.test(p)) return lightbox([src], 0);
  const im = new Image(); im.onload = () => lightbox([src], 0); im.onerror = () => toast('Görsel bulunamadı: ' + p); im.src = src;
}
document.addEventListener('click', e => {
  const f = e.target.closest && e.target.closest('[data-fp]'); if(!f || e.button !== 0) return;
  e.preventDefault(); e.stopPropagation(); fpPreview(fpResolve(f));
}, true);
document.addEventListener('contextmenu', e => {
  const im = e.target.closest && e.target.closest('img.md-img[data-mdimg]'); if(im){ const p = im.dataset.mdimg; e.preventDefault(); e.stopPropagation();
    menu(e.clientX, e.clientY, `<div class="mh">${esc(p.split(/[\\/]/).pop())}</div><button data-m="fpprev" data-p="${esc(p)}">${ic('search')}Önizle</button><button data-m="fpopen" data-p="${esc(p)}">${ic('ext')}Fotoğraf uygulamasında aç</button><button data-m="fpshow" data-p="${esc(p)}">${ic('folder')}Klasörde göster</button><button data-m="fpcopy" data-p="${esc(p)}">${ic('clip')}Yolu kopyala</button>`); return; }
  const f = e.target.closest && e.target.closest('[data-fp]'); if(!f) return;
  e.preventDefault(); e.stopPropagation(); const p = fpResolve(f), media = IMG_EXT_RX.test(p) || VID_EXT_RX.test(p);
  menu(e.clientX, e.clientY, `<div class="mh">${esc(p.split(/[\\/]/).pop())}</div>${media ? `<button data-m="fpprev" data-p="${esc(p)}">${ic('search')}Önizle</button>` : ''}
    <button data-m="fpopen" data-p="${esc(p)}">${ic('ext')}Aç${IMG_EXT_RX.test(p) ? ' (fotoğraf uygulamasında)' : VID_EXT_RX.test(p) ? ' (oynatıcıda)' : ''}</button>
    <button data-m="fpshow" data-p="${esc(p)}">${ic('folder')}Klasörde göster</button>
    <button data-m="fpcopy" data-p="${esc(p)}">${ic('clip')}Yolu kopyala</button>`);
}, true);
// Düzenleme araçlarında (b.d) başlıkta +N −M, açılınca renkli fark (diff.js); hata olursa araç çıktısı da altında
const toolHTML = b => { const dv = diffView.html(b.d); return `<div class="tool ${b.err?'terr':''}"><div class="tool-h">${b.running?'<span class="spin"></span>':ic('chev','chev')}${ic(b.n==='Bash'?'term':b.n==='Read'?'file':/Write|Edit/.test(b.n)?'edit':'sliders')}<b>${esc(b.n)}</b><span class="mono">${esc(b.a)}</span>${dv ? dv.badge : ''}${thumbs(b.imgs, 'th-in')}</div><div class="tool-b${dv ? ' dv-b' : ''}">${dv ? dv.html + (b.err && b.o ? `<div class="dv-o">${esc(b.o)}</div>` : '') : esc(b.o)}</div></div>`; };
// Art arda gelen araç çağrıları tek satırda toplanır ("7 araç · browser_batch ×6, Bash"); tıklayınca açılır. Açık olanlar yeniden çizimde açık kalır.
const TGOPEN = new Set();
const toolShort = n => n.replace(/^.*·\s*/, '');
function toolGroupHTML(tools, key){
  if(tools.length === 1) return toolHTML(tools[0]);
  const cnt = new Map(); tools.forEach(t => { const k = toolShort(t.n); cnt.set(k, (cnt.get(k) || 0) + 1); });
  const names = [...cnt].sort((a, b) => b[1] - a[1]).map(([k, n]) => esc(k) + (n > 1 ? ` ×${n}` : '')).slice(0, 3).join(', ') + (cnt.size > 3 ? '…' : '');
  const run = tools.find(t => t.running), err = tools.filter(t => t.err).length;
  const imgs = tools.flatMap(t => t.imgs || []).slice(-2);
  const open = TGOPEN.has(key);
  return `<div class="tgroup ${open ? 'open' : ''}" data-tg="${esc(key)}"><div class="tg-h">${run ? '<span class="spin"></span>' : ic('chev','chev')}<b>${run ? 'Çalışıyor' : tools.length + ' araç'}</b><span class="tg-n">${run ? esc(toolShort(run.n)) + ' · ' + tools.length + ' araç' : names}</span>${err ? `<span class="tg-err">${err} hata</span>` : ''}${thumbs(imgs, 'th-in')}</div><div class="tg-b">${tools.map(toolHTML).join('')}</div></div>`;
}
function nextCard(s, c, last){
  if(!c.recap && !c.ask) return '';
  return `<div class="next-card">${c.recap ? `<div class="nc-recap">${esc(c.recap)}</div>` : ''}${c.ask ? `<div class="nc-ask">${esc(c.ask)}</div>` : ''}
    ${c.actions.length ? `<div class="nc-acts">${c.actions.map((a, k) => `<button class="btn ${k ? '' : 'pri'}" ${last ? `data-reply="${esc(a)}" data-sid="${s.id}"` : 'disabled'}>${esc(a)}</button>`).join('')}</div>` : ''}</div>`;
}
function planCard(items){
  const done = items.filter(i => i.s === 'completed').length;
  return `<div class="plan-card"><div class="pc-h">${ic('note')}<b>Görevler</b><span>${done}/${items.length}</span></div>${items.map(i => `<div class="pc-i ${i.s}"><span class="pc-b">${i.s === 'completed' ? '✓' : i.s === 'in_progress' ? '<span class="spin"></span>' : ''}</span><span>${esc(i.c)}</span></div>`).join('')}</div>`;
}
function msgHTML(s, m, mi){
  if(m.r==='u') return `<div class="u">${esc(m.t)}</div>${thumbs(m.imgs, 'th-u')}${mediaHTML(s, m, mi, 'u')}`;
  const out = []; let grp = [], gi = 0;
  const flush = () => { if(grp.length){ out.push(toolGroupHTML(grp, s.id + '|' + mi + '|' + gi++)); grp = []; } };
  const last = mi === s.msgs.length - 1 && !s.run;
  for(const b of m.b){
    if(b.t === 'text'){ flush(); out.push(linkPaths(b.v)); }
    else if(b.card){ flush(); out.push(nextCard(s, b.card, last)); }
    else if('plan' in b){ if(b.plan){ flush(); out.push(planCard(b.plan)); } }   // listesiz ilerleme güncellemeleri gösterilmez
    else grp.push(b);
  }
  flush();
  return `<div class="a">${out.join('')}${m.draft?md(m.draft):''}${m.streaming?'<span class="cursor"></span>':''}${imgsHTML(s, m)}${mediaHTML(s, m, mi, 'a')}</div>`;
}
const renderMsgs = s => msgParts(s).map(p => `<div class="mw">${p}</div>`).join('');
// Parçaları kaba yerleştirir: aynı içerikli eski düğümler yeniden kullanılır (taşınır), yalnızca yeni/değişen parça çizilir.
// Böylece en eski tur listeden düşünce (kaydırma) ya da tek mesaj değişince geri kalan geçmişe dokunulmaz.
function patchMsgs(box, parts){
  const old = box._parts;
  if(!old){ box.innerHTML = parts.map(p => `<div class="mw">${p}</div>`).join(''); box._parts = parts; return true; }
  if(old.length === parts.length && old.every((p, i) => p === parts[i])) return false;
  const pool = new Map(); [...box.children].forEach((el, i) => { const k = old[i]; if(k === undefined) return el.remove(); (pool.get(k) || pool.set(k, []).get(k)).push(el); });
  const nodes = parts.map(p => { const l = pool.get(p); if(l && l.length) return l.shift();
    const d = document.createElement('div'); d.className = 'mw'; d.innerHTML = p; return d; });
  pool.forEach(l => l.forEach(el => el.remove()));
  nodes.forEach((n, i) => { if(box.children[i] !== n) box.insertBefore(n, box.children[i] || null); });
  box._parts = parts; return true;
}
// Bölme parçaları. Aynı oturumu gösteren bölme yeniden kurulmaz: yazma kutusu (odak, imleç, yazılan metin) yerinde kalır,
// yalnızca değişen başlık / izin kartı / ekler / düğme satırı / mesajlar güncellenir.
function paneParts(i){
  const s = sess(S.panes[i]);
  const num = `<span class="ph-num">${i+1}</span>`;
  const compact = (S.layout>=3 || (S.layout===2 && S.info)) ? 'compact' : '';
  if(!s){
    const recent = S.sessions.filter(x => !S.panes.includes(x.id) && !gone(x.id)).sort((a, b) => lastActivity(a.id) - lastActivity(b.id)).slice(0, 300);
    return {key:'bos', full:`<section class="pane ${i===S.active?'active':''}" data-pane="${i}" data-sid="bos">
      <div class="ph">${num}<div class="ph-main"><div class="ph-title" style="color:var(--muted);font-weight:500">Boş bölme</div></div><button class="ibtn" data-close="${i}">${ic('x')}</button></div>
      <div class="empty"><div><div class="ring dogring"><img class="dog8" src="img/dog8.png" alt=""></div><h3>Bir sohbet aç</h3><p>Sohbetler panosundan (⌘B) buraya sürükle<br>veya yeni bir sohbet başlat.</p>
      <button class="btn pri" style="margin-top:12px" data-newchat data-pane="${i}">${ic('plus')}Yeni sohbet · klasör seç</button>
      <input class="inp pick-q" data-pq="${i}" placeholder="Sohbet ara ve bu bölmede aç…" autocomplete="off" spellcheck="false">
      <div class="recent">${recent.map((r, k)=>`<button data-open="${r.id}" data-into="${i}" data-q="${esc(trNorm(r.title + ' ' + r.project))}"${k >= 6 ? ' style="display:none"' : ''}>${ic('msg')}<span>${esc(r.title)}</span><em>${esc(r.ago)}</em></button>`).join('')}<div class="m-none" style="display:none">Eşleşen sohbet yok</div></div></div></div></section>`};
  }
  const f = fold(s.folder);
  const st = s.run && s.run.pendings && s.run.pendings.length ? `<span class="status wait"><span class="sd"></span><span class="st-l">Onay bekliyor</span></span>` :
             s.status==='running' ? `<span class="status run"><span class="sd"></span><span class="st-l">Çalışıyor</span></span>` :
             s.status==='elsewhere' ? `<span class="status else" title="Bu sohbet şu an Claude uygulamasında ya da bir terminalde de açık; panel canlı izliyor. Bir şey yapman gerekmiyor."><span class="sd"></span><span class="st-l">Claude'da da açık</span></span>` :
             `<span class="status"><span class="sd"></span><span class="st-l">Boşta</span></span>`;
  return {key:s.id, cls:`pane ${i===S.active?'active':''} ${compact}`,
    head:`${num}
      <div class="ph-main"><div class="ph-title">${esc(s.title)}</div>
        <div class="ph-sub">${f?`<span class="chip"><span class="dot" style="background:${f.color}"></span>${esc(f.name)}</span><span class="sep">·</span>`:''}<span class="mono">${esc(s.project)}</span></div></div>
      ${s.remote?`<span class="rc-badge" title="Uzaktan Kontrol açık">${ic('cursor')}<span>Uzaktan</span></span>`:''}${st}<button class="ibtn" data-swap="${i}" title="Bu bölmede başka bir sohbet aç (ara)">${ic('search')}</button><button class="ibtn" data-more="${s.id}">${ic('more')}</button><button class="ibtn" data-close="${i}" title="Bölmeyi kapat">${ic('x')}</button>`,
    banner: s.status==='elsewhere' && !s.run ? `<div class="banner info"><span class="sd"></span>Claude uygulamasında da açık · canlı izleniyor</div>` : '',
    top: forkCard(s, i) + permCard(s) + queueCard(s) + authBanner(), att: attachChips(s),
    ph: s.draft ? 'İlk mesajını yaz — sohbet '+s.project.split(/[\\/]/).pop()+' klasöründe başlayacak' : s.run ? 'Sıraya almak için yaz ve Enter — tur bitince gönderilir' : 'Yanıtla…  ( / şablon · Tab tamamlar )',
    dis: !!(S.auth && !S.auth.loggedIn),
    row:`<button class="ibtn" data-attach="${i}" title="Dosya veya görsel ekle (sürükle-bırak ve yapıştır da olur)">${ic('clip')}</button>
        <button class="ibtn" data-tpl="${i}" title="Şablonlar (yazarken / ile de açılır, Tab tamamlar)">${ic('bolt')}</button>
        <button class="pill hide-c" data-pmode="${s.id}" title="İzin modu: ${esc(pmodeLabel(s))}">${ic('shield')}<span>${pmodeLabel(s)}</span></button>
        <button class="pill hide-c ctl ${controlOf(s)?'on':''}" data-control="${s.id}" title="${esc(controlTip(s))}">${ic('laptop')}<span>Kontrol</span></button>
        <button class="pill hide-c ${s.remote?'on':''}" data-rctoggle="${s.id}" title="${s.remote ? 'Uzaktan Kontrol açık: claude.ai / telefondan devam edebilirsin. Kapatmak için tıkla' : 'Uzaktan Kontrol: bu sohbeti claude.ai ve telefondan sürdürmek için aç'}">${ic('cursor')}<span>Uzaktan</span></button>
        <span class="grow"></span>
        ${usagePill()}
        <button class="pill" data-effort="${s.id}" title="Düşünme seviyesi: ${esc(effortOf(s) ? effortLabel(s) : 'Varsayılan')}">${ic('sliders')}<span>${esc(effortLabel(s))}</span></button>
        <button class="pill" data-model="${s.id}" title="Model">${esc(modelLabel(s))}</button>
        <button class="ibtn mic" data-mic="${i}" title="Sesli yaz (${IS_MAC ? 'macOS dikte: Fn tuşuna iki kez bas' : 'Windows sesle yazma · Win+H'})">${ic('mic')}</button>
        ${s.run ? `<button class="send stop busy" data-stop="${i}" title="Çalışıyor · durdurmak için tıkla (Esc)"><img class="dog8" src="img/dog8.png" alt=""><span class="sq">${ic('stop')}</span></button>` : `<button class="send" data-send="${i}" title="Gönder">${ic('up')}</button>`}`,
    parts: msgParts(s)};
}
function paneShell(i, P){
  return P.full || `<section class="${P.cls}" data-pane="${i}" data-sid="${P.key}">
    <div class="ph"></div><div class="pslot" data-ps="banner"></div>
    <div class="msgs"><div class="msgs-in"></div></div>
    <div class="comp-wrap"><div class="pslot" data-ps="top"></div><div class="comp"><div class="pslot" data-ps="att"></div>
      <div class="ta-wrap"><div class="ghost" aria-hidden="true"></div><textarea rows="1" data-ta="${i}"></textarea></div>
      <div class="comp-row"></div></div></div></section>`;
}
// Odaklı bir alan yeniden çizilirse odak, imleç ve yazılan değer geri konur (izin kartındaki not kutusu vb.)
function keepFocus(el, fn){
  const a = document.activeElement;
  if(!a || a === document.body || !el.contains(a)) return fn();
  const k = ['data-ta','data-permmsg','data-qfree'].find(x => a.hasAttribute(x));
  const v = a.value, st = a.selectionStart, en = a.selectionEnd;
  fn();
  if(!k) return;
  const b = el.querySelector(`[${k}="${CSS.escape(a.getAttribute(k))}"]`); if(!b || b === a) return;
  if(v != null) b.value = v; b.focus(); try { b.setSelectionRange(st, en); } catch {}
}
function setSlot(el, html){ if(el._h === html) return; keepFocus(el, () => { el.innerHTML = html; }); el._h = html; }
const autosize = ta => { ta.style.height = 'auto'; if(ta.value) ta.style.height = ta.scrollHeight + 'px'; };
function scrollPaneBottom(i){ const m = document.querySelector(`[data-pane="${i}"] .msgs`); if(m) m.scrollTop = m.scrollHeight; }
function renderPanes(){ renderPanesInner(); paintBadge(); }
function renderPanesInner(){
  const g = $('#grid'), n = nPanes();
  const gc = 'grid l'+S.layout; if(g.className !== gc) g.className = gc;
  while(g.children.length > n) g.lastElementChild.remove();
  for(let i = 0; i < n; i++){
    const P = paneParts(i);
    let sec = g.children[i];
    if(P.full){
      if(!sec || sec._full !== P.full){
        const old = sec && sec.querySelector('[data-pq]'), keep = old && {v: old.value, f: document.activeElement === old};
        const t = document.createElement('div'); t.innerHTML = P.full; const ns = t.firstElementChild; ns._full = P.full; sec ? sec.replaceWith(ns) : g.appendChild(ns);
        const q = ns.querySelector('[data-pq]'); if(q && keep && (keep.v || keep.f)){ q.value = keep.v; filterPanePick(q); if(keep.f){ q.focus({preventScroll:true}); q.setSelectionRange(99, 99); } }
      }
      continue;
    }
    const fresh = !sec || sec.dataset.sid !== P.key;
    if(fresh){
      const t = document.createElement('div'); t.innerHTML = paneShell(i, P); const ns = t.firstElementChild;
      sec ? sec.replaceWith(ns) : g.appendChild(ns); sec = ns;
    }
    if(sec.className !== P.cls) sec.className = P.cls;
    setSlot(sec.querySelector('.ph'), P.head);
    setSlot(sec.querySelector('[data-ps="banner"]'), P.banner);
    setSlot(sec.querySelector('[data-ps="top"]'), P.top);
    setSlot(sec.querySelector('[data-ps="att"]'), P.att);
    setSlot(sec.querySelector('.comp-row'), P.row);
    const ta = sec.querySelector('[data-ta]');
    if(ta.getAttribute('placeholder') !== P.ph) ta.setAttribute('placeholder', P.ph);
    if(ta.disabled !== P.dis) ta.disabled = P.dis;
    const sc = sec.querySelector('.msgs');
    const atBottom = fresh || sc.scrollHeight - sc.scrollTop - sc.clientHeight < 80;
    if(fresh){ const s = sess(S.panes[i]); ta.value = s.inputDraft || ''; autosize(ta); }
    if(patchMsgs(sec.querySelector('.msgs-in'), P.parts)) hydrateMedia(sec);
    if(atBottom) sc.scrollTop = sc.scrollHeight;
  }
  document.querySelectorAll('#layouts button').forEach(b => b.classList.toggle('on', +b.dataset.l===S.layout));
  const open = S.panes.slice(0,nPanes()).filter(Boolean).length;
  const running = S.sessions.filter(s=>s.status==='running').length;
  const tb = `<b>${open}</b> açık sohbet${running?` · <b>${running}</b> çalışıyor`:''}`;
  if($('#tbTitle')._h !== tb){ $('#tbTitle').innerHTML = tb; $('#tbTitle')._h = tb; }
}

/* ---------- Info panel ---------- */
function qr(seed){ let h=0; for(const c of seed) h=(h*31+c.charCodeAt(0))>>>0; let r=''; const n=11;
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){ const corner=(x<3&&y<3)||(x>7&&y<3)||(x<3&&y>7); h=(h*1103515245+12345)>>>0;
    if(corner ? !(x%10===1&&y%10===1) && ((x<3&&y<3)||(x>7&&y<3)||(x<3&&y>7)) : (h>>16)&1) r+=`<rect x="${x}" y="${y}" width="1" height="1"/>`; }
  return `<svg class="qr" viewBox="0 0 11 11" fill="#1a1a1a">${r}</svg>`; }
const fmtK = v => v>=1000 ? (v/1000).toFixed(1).replace(/\.0$/,'')+'M' : (Math.round(v*10)/10)+'k';
function renderInfo(){
  const el = $('#info'); el.classList.toggle('off', !S.info); $('#btnInfo').classList.toggle('on', S.info);
  if(!S.info) return;
  const s = sess(S.panes[S.active]);
  if(!s){ el.innerHTML = `<div class="info-h">Bölme ${S.active+1}</div><div class="isec" style="color:var(--muted)">Bu bölmede açık sohbet yok.</div>`; return; }
  const total = 1000;
  const fixedK = 16.8+10.6+10+5.2+4.9+1.1;
  const parts = [
    ['Mesajlar', Math.max(0, s.ctx - fixedK), 'var(--c-msg)'], ['MCP araçları', 16.8, 'var(--c-mcp)', 1], ['Sistem istemi', 10.6, 'var(--c-sys)'],
    ['Skill\'ler', 10, 'var(--c-skill)', 1], ['Sistem araçları', 5.2, 'var(--c-gray)'], ['MCP talimatları', 4.9, 'var(--c-gray)', 1],
    ['Hafıza dosyaları', 1.1, 'var(--c-gray)', 1], ['Sıkıştırma payı', 33, 'var(--c-dark)'],
  ];
  const used = parts.slice(0,7).reduce((a,p)=>a+p[1],0);
  const occupied = parts.reduce((a,p)=>a+p[1],0);
  const free = total - occupied;
  const pct = v => (v/total*100).toFixed(1)+'%';
  const f = fold(s.folder);
  const name = s.project.split(/[\\/]/).pop();
  const ST = {connected:'bağlı', failed:'hata', 'needs-auth':'kimlik doğrula', pending:'bağlanıyor', disabled:'kapalı'};
  const conns = s.connectorsLive && s.connectorsLive.length ? s.connectorsLive.map(m => ({name:m.name, bg: m.status==='connected' ? '#4f8a5b' : m.status==='failed' ? '#c0392b' : '#c08a2e', letter:(m.name[0]||'?').toUpperCase(), source: ST[m.status] || m.status})) : S.connectors;
  el.innerHTML = `
    <div class="info-h"><span class="ph-num" style="background:var(--accent);color:#fff">${S.active+1}</span><b>${esc(s.title)}</b></div>
    <div class="isec"><h4>Ortam</h4>
      <div class="irow">${ic('laptop')}<span class="lbl">Bu bilgisayar</span><button class="act" data-reveal="${esc(s.project)}">Klasörü aç</button></div>
      <div class="irow">${ic('folder')}<span class="lbl">${esc(name)} <span class="sub">· ${esc(s.project.slice(0, Math.max(0, s.project.length - name.length - 1)))}</span></span></div>
      ${f?`<div class="irow"><span style="width:16px;display:grid;place-items:center"><span class="dot" style="background:${f.color}"></span></span><span class="lbl">${esc(f.name)} <span class="sub">· panel klasörü</span></span></div>`:''}
      <div class="irow">${ic('cursor')}<span class="lbl">Uzaktan Kontrol</span><button class="switch ${s.remote?'on':''}" id="swRemote" data-sid="${s.id}"></button></div>
      ${s.remote?`<div class="remote-box"><div class="rt">
        <span class="st ${s.status==='elsewhere'?'ok':''}"><i></i>${s.status==='elsewhere' ? 'Terminal oturumu çalışıyor' : 'Terminal oturumu başlatıldı'}</span>
        <span>Bağlantı adresi ve QR kod Terminal penceresinde görünür. Telefonda Claude uygulaması → <b>Code</b> bölümünden veya claude.ai/code'dan bu oturuma bağlanabilirsin.</span>
        <span style="color:var(--faint)">Uzaktan Kontrol açıkken bu sohbete panelden yazarsan çatallayarak devam etmen önerilir.</span>
        <button data-copyrc="${s.id}">Terminal'i yeniden aç</button></div></div>`:''}
    </div>
    <div class="isec"><h4>Bağlam <span class="sum">dağılım tahmini</span></h4>
      <div class="ctx-top"><b>%${Math.round(used/total*100)} kullanıldı</b><span>${fmtK(used)} / 1M</span></div>
      <div class="bar">${parts.map(p=>`<i style="width:${p[1]/total*100}%;background:${p[2]}"></i>`).join('')}</div>
      <div class="leg">
        ${parts.map(p=>`<span class="sw" style="background:${p[2]}"></span><span class="n ${p[3]?'ul':''}">${p[0]}</span><span class="v">${fmtK(p[1])}</span><span class="p">${pct(p[1])}</span>`).join('')}
        <span class="sw" style="background:var(--c-free)"></span><span class="n">Boş alan</span><span class="v">${fmtK(free)}</span><span class="p">${pct(free)}</span>
        <span class="gap"></span>
        <span class="sw" style="background:var(--c-dark)"></span><span class="n dim">Ertelenmiş MCP araçları</span><span class="v dim">513.3k</span><span class="p dim">—</span>
        <span class="sw" style="background:var(--c-dark)"></span><span class="n dim">Ertelenmiş sistem araçları</span><span class="v dim">16.5k</span><span class="p dim">—</span>
      </div>
      <div style="margin-top:10px">
        <button class="exp">${ic('chev','chev')}MCP sunucuları<span>${conns.length}</span></button>
        <div class="exp-b">${conns.map(c=>esc(c.name)).join('<br>') || '—'}</div>
        <button class="exp">${ic('chev','chev')}Hafıza dosyaları<span>1</span></button>
        <div class="exp-b">~/.claude/CLAUDE.md</div>
      </div>
    </div>
    <div class="isec"><h4 class="click" id="connToggle">Bağlayıcılar <span class="tg ${S.connOpen?'open':''}">${ic('chev')}</span><span class="sum">${connSummary(s, conns)}</span></h4>
      ${!S.connOpen ? '' : `<div class="conn-list">${connRows(s, conns)}<button class="act" data-mcpcheck style="margin-top:6px;font-size:12px">${S.mcpCheck && S.mcpCheck.loading ? 'Kontrol ediliyor…' : 'Durumu şimdi kontrol et'}</button></div>`}
    </div>
    ${mediaSection(s)}
    <div class="isec"><h4>Çıktılar</h4>
      ${s.outputs.length ? s.outputs.map(o=>`<div class="irow">${ic(/\.html?$/.test(o)?'globe':/\.(md|txt|docx)$/.test(o)?'note':'file')}<span class="lbl" title="${esc(o)}">${esc(o.split(/[\\/]/).pop())}</span><span class="ok mono odir">${esc(/[\\/]/.test(o)?o.split(/[\\/]/).slice(0,-1).join('/'):'')}</span></div>`).join('') : '<div style="color:var(--faint);font-size:12.5px">Bu oturumda henüz dosya oluşturulmadı.</div>'}
    </div>`;
}
/* Son medya: sohbetin klasöründeki en yeni görsel ve videolar (2 alt klasöre kadar). 20 sn önbellek; tur bitince yenilenir. */
const MEDIA_DIRS = new Map(); // klasör → {at, list, loading}
function recentMediaOf(dir){
  const c = MEDIA_DIRS.get(dir);
  if(!c || (!c.loading && Date.now() - c.at > 20000)){
    MEDIA_DIRS.set(dir, {...(c || {}), loading:true});
    API.fs.recentMedia(dir).then(list => { MEDIA_DIRS.set(dir, {at:Date.now(), list:list || []}); if(S.info) renderInfo(); })
      .catch(() => MEDIA_DIRS.set(dir, {at:Date.now(), list:[]}));
  }
  return c && c.list;
}
const fmtAgoMs = ms => { const m = Math.round((Date.now() - ms) / 6e4); return m < 1 ? 'şimdi' : m < 60 ? m + ' dk' : m < 1440 ? Math.round(m / 60) + ' sa' : Math.round(m / 1440) + ' gün'; };
function mediaSection(s){
  const dir = s.cwd || s.project; if(!dir || dir === '(bilinmiyor)') return '';
  const list = recentMediaOf(dir);
  const imgs = (list || []).filter(x => x.kind === 'image').slice(0, 9), vids = (list || []).filter(x => x.kind === 'video').slice(0, 6);
  return `<div class="isec"><h4>Son medya <span class="sum">${list ? (list.length ? 'klasördeki en yeniler' : 'yok') : 'aranıyor…'}</span></h4>
    ${imgs.length ? `<div class="med-grid">${thumbs(imgs.map(x => x.path), 'th-med')}</div>` : ''}
    ${vids.map(v => `<div class="irow med-v">${ic('video')}<span class="lbl" title="${esc(v.path)}">${esc(v.name)}</span><span class="sub">${fmtAgoMs(v.mtimeMs)}</span><button class="media-btn" data-mopen="${esc(v.path)}" title="Varsayılan oynatıcıda aç">${ic('ext')}</button><button class="media-btn" data-mshow="${esc(v.path)}" title="Klasörde göster">${ic('folder')}</button></div>`).join('')}
    ${list && !list.length ? '<div style="color:var(--faint);font-size:12.5px">Bu klasörde görsel ya da video yok.</div>' : ''}</div>`;
}
function connSummary(s, conns){
  const live = S.mcpCheck && !S.mcpCheck.loading && S.mcpCheck.cwd === s.project ? S.mcpCheck.servers : null;
  const list = live || (s.connectorsLive && s.connectorsLive.length ? s.connectorsLive : null);
  if(!list) return conns.length ? conns.length + ' yapılandırılmış' : 'kontrol için aç';
  const bad = list.filter(x => x.status && x.status !== 'connected').length;
  return bad ? `${bad} yeniden bağlanmalı` : `${list.length} bağlı`;
}
function connRows(s, conns){
  const live = S.mcpCheck && !S.mcpCheck.loading && S.mcpCheck.cwd === s.project ? S.mcpCheck : null;
  const col = st => st==='connected' ? '#4f8a5b' : st==='needs-auth' ? '#c08a2e' : st==='failed' ? '#c0392b' : '#75736c';
  const TR = {connected:'bağlı', 'needs-auth':'kimlik doğrula', failed:'hata', pending:'bağlanıyor', unknown:'?'};
  if(live){
    if(live.error && !live.servers.length) return `<div style="color:#c0392b;font-size:12.5px">${esc(live.error)}</div>`;
    return live.servers.map(x => `<div class="irow"><span class="conn-ic" style="background:${col(x.status)}">${esc((x.name.replace(/^claude\.ai /,'')[0]||'?').toUpperCase())}</span><span class="lbl" title="${esc(x.target)}">${esc(x.name.replace(/^claude\.ai /,''))}</span>${x.status==='needs-auth' ? `<span class="warn" title="Terminal'de claude çalıştırıp /mcp ile doğrula">Kimlik doğrula</span>` : `<span class="ok">${esc(TR[x.status] || x.statusText)}</span>`}</div>`).join('') || '<div style="color:var(--faint);font-size:12.5px">MCP sunucusu yok.</div>';
  }
  return conns.map(c => `<div class="irow"><span class="conn-ic" style="background:${c.bg}">${esc(c.letter)}</span><span class="lbl">${esc(c.name)}</span><span class="ok">${esc(c.source||'')}</span></div>`).join('') || '<div style="color:var(--faint);font-size:12.5px">Durumu görmek için kontrol et.</div>';
}
function render(){ renderRail(); renderPanes(); renderInfo(); if(S.org) renderBoard(); }

/* ---------- Actions ---------- */
function setSide(v){ S.side = v; $('#org').classList.toggle('noside', !v); $('#fxSideBtn')?.classList.toggle('on', v); }
function setOrg(v){ if(v && SR.open) setSearch(false); S.org = v; $('#org').classList.toggle('open', v); setSide(S.side); $('#btnOrg').classList.toggle('on', v); renaming = null; if(v) renderBoard(); renderRail(); }
function openIn(id, i = S.active){
  const cur = S.panes.slice(0,nPanes()).indexOf(id);
  if(cur>=0 && cur!==i) S.panes[cur] = S.panes[i];
  S.panes[i] = id; S.active = i;
  const s = sess(id); if(s) s.fresh = false;
  render(); ensureLoaded(id);
}
/* Diyalogu yeniden çizerken odağı, imleç konumunu ve liste kaydırmalarını koru. Odak diyalogun içindeyken
   kaybolursa (ör. bir düğmeye tıklandı) `fallback` alanına döner: ad yazarken renk/klasör seçmek odağı kaçırmaz. */
function rebuild(m, html, fallback, after){
  const a = document.activeElement, inside = !!(a && a !== document.body && m.contains(a));
  const id = inside && a.id, sel = id && typeof a.selectionStart === 'number' ? [a.selectionStart, a.selectionEnd] : null;
  const scr = [...m.querySelectorAll('.pk-l')].map(x => x.scrollTop);
  m.innerHTML = html; if(after) after();
  m.querySelectorAll('.pk-l').forEach((x, i) => { if(scr[i]) x.scrollTop = scr[i]; });
  if(!inside) return;
  let el = id && document.getElementById(id);
  if(!el && fallback){ el = document.getElementById(fallback); if(el && typeof el.value === 'string') { const n = el.value.length; el.focus({preventScroll:true}); try{ el.setSelectionRange(n, n); }catch{} return; } }
  if(el){ el.focus({preventScroll:true}); if(sel) try{ el.setSelectionRange(sel[0], sel[1]); }catch{} }
}
/* ---------- New-chat dialog: çalışma klasörü seçmek zorunlu ---------- */
let NC = null;
function newChat(opts={}){
  // Panel klasörü varsayılan olarak "Klasörsüz"; yalnızca bir klasörün "Bu klasörde yeni sohbet" komutuyla açılırsa o klasör seçili gelir
  const group = opts.group !== undefined ? opts.group : null;
  const g = group && fold(group);
  NC = {pane: opts.pane ?? S.active, group, dir: g && g.dir ? g.dir : null, dq:'', model:'Opus 5.5', text:'', title:''};
  renderNC(); setTimeout(()=>$('#ncTitle')?.focus());
}
function recentDirs(){
  const seen = new Map();
  S.items.filter(id=>id[0]==='s').map(sess).forEach(s => { if(!seen.has(s.project)) seen.set(s.project, s.ago); });
  return [...seen].map(([dir, ago]) => ({dir, ago}));
}
function renderNC(){
  let m = $('#nc'); if(!NC){ m?.remove(); return; }
  if(!m){ m = document.createElement('div'); m.id='nc'; m.className='modal-bg'; document.body.appendChild(m); }
  const q = NC.dq.toLowerCase();
  const rec = recentDirs().filter(r => r.dir.toLowerCase().includes(q));
  const recSet = new Set(rec.map(r=>r.dir));
  const disk = DISK.map(d=>'~/Desktop/'+d).filter(d => !recentDirs().some(r=>r.dir===d) && d.toLowerCase().includes(q));
  const linked = S.folders.filter(f=>f.dir && f.dir===NC.dir);
  const row = (d, meta) => `<button class="pk-i ${NC.dir===d?'on':''}" data-nc="dir" data-d="${esc(d)}">${ic('folder')}<span>${esc(d.split(/[\\/]/).pop())} <span style="color:var(--faint)" class="mono">${esc(d.split(/[\\/]/).slice(0,-1).join('/'))}</span></span>${meta?`<span style="font-size:11px;color:var(--faint)">${meta}</span>`:''}${NC.dir===d?ic('chev'):''}</button>`;
  const gf = NC.group && fold(NC.group);
  rebuild(m, `<div class="modal" role="dialog" aria-label="Yeni sohbet">
    <div class="mh2"><h3>Yeni sohbet <span style="font:400 13px var(--sans);color:var(--muted)">· Bölme ${NC.pane+1}</span></h3><button class="ibtn" data-nc="close">${ic('x')}</button></div>
    <div class="mb">
      <label class="fl" for="ncTitle">Sohbet adı <span>· isteğe bağlı — boş bırakırsan ilk mesajdan oluşur</span></label>
      <input id="ncTitle" class="inp" placeholder="ör. Gerikoğlu web sitesi revizyonu" value="${esc(NC.title)}" autocomplete="off" spellcheck="false" maxlength="120">
      <label class="fl">Proje klasörü <span style="color:var(--accent-text)">· zorunlu</span> <span>· Claude bu klasördeki dosyalarla çalışır</span></label>
      <div class="picker ${NC.err?'err':''}">
        <div class="pk-h">${ic('search')}<input class="pk-s" id="ncDq" style="flex:1;width:auto;border:0;background:none;padding:0;font-size:13px" placeholder="Klasör ara veya yol yaz (~/Desktop/...)" value="${esc(NC.dq)}"></div>
        <div class="pk-l" style="max-height:220px">
          ${rec.length?`<div class="pk-g">Son kullanılan projeler</div>${rec.map(r=>row(r.dir, r.ago)).join('')}`:''}
          ${disk.length?`<div class="pk-g">Masaüstü</div>${disk.map(d=>row(d,'')).join('')}`:''}
          ${NC.dq.startsWith('~/')||NC.dq.startsWith('~\\')||NC.dq.startsWith('/')||/^[A-Za-z]:[\\/]/.test(NC.dq)?`<button class="pk-i" data-nc="dir" data-d="${esc(NC.dq)}">${ic('folderPlus')}<span>“${esc(NC.dq)}” yolunu kullan</span></button>`:''}
          ${!rec.length&&!disk.length&&!NC.dq.startsWith('~/')?'<div style="padding:10px;color:var(--faint);font-size:12.5px">Eşleşen klasör yok.</div>':''}
        </div>
        <div class="pk-f"><button class="btn" data-nc="finder" title="Bilgisayardan bir klasör seç (yeni klasör de oluşturabilirsin)">${ic('ext')}Gözat…</button><span class="grow"></span><span class="nc-sel ${NC.dir?'on':''}" title="${esc(NC.dir||'')}">${NC.dir?ic('folder')+'<span>'+esc(NC.dir)+'</span>':'Klasör seçilmedi'}</span></div>
      </div>
      ${NC.err?`<div style="color:#c0392b;font-size:12px">Sohbet başlatmak için bir çalışma klasörü seç veya aç.</div>`:''}
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px"><label class="fl">Panel klasörü <span>· isteğe bağlı</span></label>
          <select class="inp" id="ncGroup" style="width:100%"><option value="">Klasörsüz</option>${S.folders.map(f=>`<option value="${f.id}" ${NC.group===f.id?'selected':''}>${f.parent?'— ':''}${esc(f.name)}</option>`).join('')}</select></div>
        <div style="width:150px"><label class="fl">Model</label>
          <select class="inp" id="ncModel" style="width:100%">${['Opus 5.5','Sonnet 5.5','Haiku 5.5'].map(x=>`<option ${NC.model===x?'selected':''}>${x}</option>`).join('')}</select></div>
      </div>
      ${gf && gf.dir && gf.dir!==NC.dir?`<div style="font-size:12px;color:var(--muted)">“${esc(gf.name)}” klasörünün proje klasörü: <span class="mono">${esc(gf.dir)}</span> <button class="act" style="text-decoration:underline" data-nc="dir" data-d="${esc(gf.dir)}">Bunu kullan</button></div>`:''}
      ${linked.length && !linked.some(f=>f.id===NC.group)?`<div style="font-size:12px;color:var(--muted)">Bu dizin “${esc(linked[0].name)}” klasörüne bağlı. <button class="act" style="text-decoration:underline" data-nc="uselinked" data-f="${linked[0].id}">O klasöre koy</button></div>`:''}
      <label class="fl">İlk mesaj <span>· isteğe bağlı</span></label>
      <textarea class="inp" id="ncText" rows="3" style="resize:vertical" placeholder="Ne üzerinde çalışalım?">${esc(NC.text)}</textarea>
    </div>
    <div class="mf"><span style="font-size:12px;color:var(--faint);align-self:center">⌘↵ başlat</span><span class="grow"></span><button class="btn" data-nc="close">Vazgeç</button><button class="btn pri" data-nc="start" ${NC.dir?'':'style="opacity:.45"'}>Sohbeti başlat</button></div>
  </div>`);
}
function ncSync(){ if(!NC) return; NC.title = $('#ncTitle')?.value ?? NC.title; NC.group = $('#ncGroup')?.value || null; NC.model = $('#ncModel')?.value || NC.model; NC.text = $('#ncText')?.value ?? NC.text; }
function startChat(){
  ncSync();
  if(!NC.dir){ NC.err = true; renderNC(); return; }
  const uuid = crypto.randomUUID(), id = sid(uuid), name = NC.dir.split(/[\\/]/).pop();
  const text = NC.text.trim(), modelAlias = (NC.model || '').split(' ')[0].toLowerCase();
  const auto = text ? text.replace(/\s+/g,' ').slice(0,60) : `Yeni sohbet · ${name}`, custom = (NC.title || '').replace(/\s+/g,' ').trim();
  const s = {id, uuid, draft:true, title: custom || auto, project:NC.dir, cwd:NC.dir,
    folder:NC.group, pinned:false, trashed:false, hidden:false, lastTs:new Date().toISOString(), ago:'şimdi', model:NC.model || 'Opus', newModel:modelAlias || null,
    ctx:0, msgs:[], outputs:[], loaded:true, status:'idle', fresh:false, remote:false, localUntil:Date.now() + 10*60*1000};
  s.rawTitle = auto; // ad verildiyse title ≠ rawTitle → takma ad olarak saklanır, Claude'un başlığı onu ezmez
  S.sessions.unshift(s); S.items.unshift(id);
  const pane = NC.pane; NC = null; renderNC();
  setSearch(false); setOrg(false); openIn(id, pane);
  const ta = document.querySelector(`[data-ta="${pane}"]`);
  if(text && ta){ ta.value = text; send(pane); } else ta && ta.focus();
}

/* ---------- Context menus ---------- */
function m_updatePickCount(){ const l = document.querySelectorAll('#nf .fl span')[1]; if(l) l.textContent = '· '+NF.picked.size+' seçili'; }
function closeMenu(){ document.querySelector('.menu')?.remove(); }
function menu(x, y, html){
  closeMenu(); const m = document.createElement('div'); m.className='menu'; m.innerHTML=html;
  // Windows'ta üst 44 px pencere düğmelerine (— □ ×) ve sürükleme alanına ait: menü oraya taşmaz
  const top0 = IS_MAC ? 8 : 52; m.style.maxHeight = (innerHeight - top0 - 8) + 'px';
  document.body.appendChild(m);
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(x, innerWidth-r.width-8))+'px'; m.style.top = Math.max(top0, Math.min(y, innerHeight-r.height-8))+'px';
  const cur = m.querySelector('.m-scroll [data-cur]'); if(cur) cur.scrollIntoView({block:'nearest'});
  const q = m.querySelector('.m-q'); if(q) q.focus({preventScroll:true});
}
// Boş bölmedeki sohbet arama: yerinde süzer; boşken son 6 sohbet, yazınca eşleşen ilk 30
function filterPanePick(inp){
  const q = trNorm(inp.value.trim()), box = inp.parentElement.querySelector('.recent'); let n = 0;
  box.querySelectorAll('[data-q]').forEach(b => { const ok = (q ? b.dataset.q.includes(q) : true) && n < (q ? 30 : 6); b.style.display = ok ? '' : 'none'; n += ok; });
  box.querySelector('.m-none').style.display = n ? 'none' : 'block';
}
// Uzun klasör listesinde arama: Türkçe karakterlere duyarsız, yerinde süzer (menü yeniden çizilmez)
function filterMenuFolders(inp){
  const q = trNorm(inp.value.trim()); const box = inp.parentElement.querySelector('.m-scroll'); let n = 0;
  box.querySelectorAll('[data-q]').forEach(b => { const ok = !q || b.dataset.q.includes(q); b.style.display = ok ? '' : 'none'; n += ok; });
  box.querySelector('.m-none').style.display = n ? 'none' : 'block';
}
function sessMenu(id, x, y){
  const s = sess(id); const folds = S.folders.filter(f=>!gone(f.id));
  menu(x, y, `<div class="mh">Bölmede aç</div>
    ${Array.from({length:nPanes()},(_,i)=>`<button data-m="open" data-id="${id}" data-i="${i}">${ic('cols')}Bölme ${i+1}${S.panes[i]?` <span style="color:var(--faint);margin-left:auto;font-size:11px">${esc(sess(S.panes[i]).title.slice(0,16))}…</span>`:''}</button>`).join('')}
    <hr><div class="mh">Klasöre taşı</div>
    ${folds.length > 8 ? `<input class="m-q" placeholder="Klasör ara…" autocomplete="off" spellcheck="false">` : ''}
    <div class="m-scroll">${folds.map(f=>`<button data-m="move" data-id="${id}" data-f="${f.id}" data-q="${esc(trNorm(f.name))}"${s.folder===f.id?' data-cur':''}><span class="dot" style="background:${f.color}"></span>${f.parent?'&nbsp;&nbsp;':''}${esc(f.name)}${s.folder===f.id?' ✓':''}</button>`).join('')}<div class="m-none">Eşleşen klasör yok</div></div>
    <button data-m="move" data-id="${id}" data-f="">${ic('inbox')}Klasörsüz (üst düzey)</button><hr>
    <button data-m="ren" data-f="${id}">${ic('edit')}Yeniden adlandır</button>
    <button data-m="pin" data-id="${id}">${ic('pin')}${s.pinned?'Sabitlemeyi kaldır':'Sabitle'}</button>
    <button data-m="ext" data-id="${id}">${ic('ext')}Proje klasörünü aç</button>
    <button data-m="ql" data-id="${id}">${ic('search')}Önizle (Boşluk)</button>
    <button data-m="movedlg" data-id="${id}">${ic('folder')}Taşı…</button>
    <hr><button data-m="trash" data-id="${id}" style="color:#c0392b">${ic('trash')}Çöp Kutusuna taşı</button>`);
}
function folderMenu(fid, x, y){
  const f = fold(fid);
  menu(x, y, `<button data-m="nav" data-f="${fid}">${ic('folder')}Aç</button>
    <button data-m="newin" data-f="${fid}">${ic('plus')}Bu klasörde yeni sohbet</button><hr>
    <button data-m="ren" data-f="${fid}">${ic('edit')}Yeniden adlandır</button>
    <button data-m="sub" data-f="${fid}">${ic('folderPlus')}Alt klasör ekle</button>
    ${f.parent?`<button data-m="top" data-f="${fid}">${ic('cols')}Ana klasör yap</button>`:''}
    <button data-m="openall" data-f="${fid}">${ic('cols')}Tümünü bölmelerde aç</button>
    <div class="mh">Renk</div><div style="display:flex;gap:6px;padding:4px 9px 6px">${['#c96442','#c08a2e','#4f8a5b','#4a7fb5','#8a7fc4','#b5577a','#75736c'].map(c=>`<button data-m="color" data-f="${fid}" data-c="${c}" style="width:18px;height:18px;padding:0;border-radius:5px;background:${c};${f.color===c?'outline:2px solid var(--text);outline-offset:1px':''}"></button>`).join('')}</div>
    <button data-m="movedlg" data-id="${fid}">${ic('folder')}Taşı…</button>
    <button data-m="ql" data-id="${fid}">${ic('search')}Önizle (Boşluk)</button>
    <hr><button data-m="trash" data-id="${fid}" style="color:#c0392b">${ic('trash')}Çöp Kutusuna taşı</button>`);
}

/* ---------- Events ---------- */
document.addEventListener('click', e => {
  const t = e.target;
  const m = t.closest('.menu [data-m]');
  if(m && /^(updcheck|upddir|updgo|mirroropen|helpdlg|fontdlg)$/.test(m.dataset.m)){ const k = m.dataset.m; closeMenu();
    if(k==='fontdlg') openFonts();
    if(k==='updcheck') updCheck();
    if(k==='upddir') API.update.pickDir().then(st => { if(st){ UPD = st; paintUpd(); updToast(st, true); } });
    if(k==='updgo') updateClick();
    if(k==='mirroropen') API.mirror.open().then(ok => ok || toast('Klasör açılamadı'));
    if(k==='helpdlg') showHelp();
    return; }
  else if(m){
    const d = m.dataset;
    if(d.m==='open'){ setOrg(false); openIn(d.id, +d.i); }
    if(d.m==='move'){ sess(d.id).folder = d.f||null; sess(d.id).fresh=false; render(); toast('Taşındı'); }
    if(d.m==='pin'){ sess(d.id).pinned = !sess(d.id).pinned; render(); }
    if(d.m==='ext'){ API.fs.reveal(sess(d.id).project).then(ok => ok || toast('Klasör bulunamadı')); }
    if(d.m==='ren'){ renaming = d.f; if(!S.org) setOrg(true); renderBoard(); }
    if(d.m==='sort') setSort(d.k);
    if(d.m==='pmode'){ sess(d.id).pmode = d.v; renderPanes(); focusTa(d.id); }
    if(d.m==='model'){ sess(d.id).modelPick = d.v || null; renderPanes(); focusTa(d.id); }
    if(d.m==='ctlinstall'){ closeMenu(); installDesktop(sess(d.id)); return; }
    if(d.m==='ctlbrowser'){ closeMenu(); setControl(sess(d.id), true); return; }
    if(d.m==='effort'){ const es = sess(d.id); es.effort = d.v || null; WS.prefs = {...(WS.prefs||{}), effort:d.v || null}; renderPanes(); persist(); focusTa(d.id); }
    if(d.m==='fpprev'){ closeMenu(); fpPreview(d.p); return; }
    if(d.m==='fpopen'){ closeMenu(); fpOpen(d.p); return; }
    if(d.m==='fpshow'){ closeMenu(); API.fs.showInFolder(d.p).then(ok => ok || toast('Bulunamadı: ' + d.p)); return; }
    if(d.m==='fpcopy'){ closeMenu(); navigator.clipboard.writeText(d.p).then(() => toast('Yol kopyalandı'), () => toast('Kopyalanamadı')); return; }
    if(d.m==='tplins'){ closeMenu(); insertTemplate(+d.i, templates()[+d.k].text); return; }
    if(d.m==='tplsave'){ closeMenu(); const ta = document.querySelector(`[data-ta="${d.i}"]`); const t = ta && ta.value.trim(); if(t){ saveTemplates([...templates(), {name: t.split(/\s+/).slice(0, 4).join(' ').slice(0, 30), text: t}]); toast('Şablon eklendi · adını Şablonları düzenle\'den değiştirebilirsin'); } return; }
    if(d.m==='tpledit'){ closeMenu(); openTemplates(); return; }
    if(d.m==='sendfork'){ closeMenu(); const fs = sess(S.panes[+d.i]); if(fs) fs.askFork = false; send(+d.i, {fork:true}); return; }
    if(d.m==='sendforce'){ closeMenu(); const fs = sess(S.panes[+d.i]); if(fs) fs.askFork = false; send(+d.i, {force:true}); return; }
    const tgtIds = () => (d.id && !FX.sel.has(d.id)) ? [d.id] : [...FX.sel];
    if(d.m==='movedlg'){ closeMenu(); openMove(tgtIds()); return; }
    if(d.m==='trash'){ closeMenu(); trashItems(tgtIds()); return; }
    if(d.m==='restore'){ closeMenu(); restoreItems([...FX.sel]); return; }
    if(d.m==='hide'){ closeMenu(); [...FX.sel].forEach(id=>objOf(id).hidden=true); FX.sel.clear(); render(); return; }
    if(d.m==='cut'){ FX.clip = [...FX.sel]; renderBoard(); toast(`${FX.clip.length} öğe kesildi · hedef klasörde ⌘V`); }
    if(d.m==='withsel'){ closeMenu(); openNewFolder(curFolder(), [...FX.sel]); return; }
    if(d.m==='ql'){ closeMenu(); quickLook(d.id); return; }
    if(d.m==='bgchat'){ closeMenu(); newChat(d.f ? {group:d.f} : {}); return; }
    if(d.m==='bgfolder'){ closeMenu(); openNewFolder(d.f || null); return; }
    if(d.m==='bgpaste'){ closeMenu(); const c = FX.clip; FX.clip = null; if(c) moveInto(c, FX.cwd); return; }
    if(d.m==='bgview'){ FX.view = d.v; renderBoard(); }
    if(d.m==='bgall'){ FX.sel = new Set(listing()); paintSel(); }
    if(d.m==='bgempty'){ closeMenu(); emptyTrash(); return; }
    if(d.m==='bgreveal'){ API.fs.reveal(fold(d.f).dir).then(ok => ok || toast('Klasör bulunamadı')); }
    if(d.m==='bgsync'){ closeMenu(); syncNow(); return; }
    if(d.m==='nav'){ setOrg(true); go(d.f); }
    if(d.m==='sub') openNewFolder(d.f);
    if(d.m==='newin'){ closeMenu(); newChat({group:d.f}); return; }
    if(d.m==='top'){ fold(d.f).parent = null; renderBoard(); }
    if(d.m==='color'){ fold(d.f).color = d.c; render(); }
    if(d.m==='openall'){
      const all = id => children(id).flatMap(c => c[0]==='f' ? all(c) : [c]);
      const ids = all(d.f).slice(0,4);
      S.layout = ids.length>=4?4:Math.max(1,ids.length); ids.forEach((id,i)=>S.panes[i]=id); S.active=0; setOrg(false); render();
    }
    if(d.m==='del'){
      const f = fold(d.f); S.sessions.forEach(s=>{ if(s.folder===d.f) s.folder=f.parent; });
      S.folders.forEach(x=>{ if(x.parent===d.f) x.parent=f.parent; });
      S.folders = S.folders.filter(x=>x.id!==d.f); S.items = S.items.filter(x=>x!==d.f); render(); toast('Klasör silindi');
    }
    closeMenu(); return;
  }
  if(t.closest('.menu')) return; // menü içindeki arama kutusu / başlık: menüyü kapatma
  closeMenu();
  const mvb = t.closest('[data-mv]'); if(mvb){ MV.target = mvb.dataset.mv || null; renderMove(); return; }
  if(t.closest('[data-mvx]')){ MV=null; renderMove(); return; }
  if(t.closest('[data-mvgo]')){ const ids = MV.ids, tg = MV.target; MV=null; renderMove(); moveInto(ids, tg); return; }
  if(t.closest('[data-mvnew]')){ const ids = MV.ids, tg = MV.target; MV=null; renderMove(); openNewFolder(tg, ids); return; }
  if(MV && t.classList.contains('modal-bg')){ MV=null; renderMove(); return; }
  const qo = t.closest('[data-qlopen]'); if(qo){ const id = QL; quickLook(null); if(qo.dataset.qlopen==='f'){ go(id); } else { setOrg(false); openIn(id, +qo.dataset.qlopen); } return; }
  if(t.closest('[data-qlx]') || (QL && t.classList.contains('modal-bg'))){ quickLook(null); return; }
  const nc = t.closest('[data-nc]');
  if(nc){ const d = nc.dataset; ncSync();
    if(d.nc==='close'){ NC=null; renderNC(); return; }
    if(d.nc==='dir'){ NC.dir = d.d; NC.err = false; const lf = S.folders.find(f=>f.dir===d.d); if(lf && !NC.group) NC.group = lf.id; }
    if(d.nc==='finder'){ API.fs.pickFolder().then(p => { if(p && NC){ NC.dir = p; NC.err = false; renderNC(); } }); return; }
    if(d.nc==='mkdir'){ API.fs.pickFolder().then(p => { if(p && NC){ NC.dir = p; NC.err = false; renderNC(); } }); return; }
    if(d.nc==='uselinked') NC.group = d.f;
    if(d.nc==='start'){ startChat(); return; }
    renderNC(); return; }
  if(NC && t.classList.contains('modal-bg')){ NC=null; renderNC(); return; }
  const nf = t.closest('[data-nf]');
  if(nf){ const d = nf.dataset; NF.name = $('#nfName')?.value ?? NF.name;
    if(d.nf==='close'){ NF=null; renderNF(); return; }
    if(d.nf==='color') NF.color = d.c;
    if(d.nf==='dir') NF.dir = NF.dir===d.d ? null : d.d;
    if(d.nf==='nodir') NF.dir = null;
    if(d.nf==='finder'){ API.fs.pickFolder().then(p => { if(p && NF){ NF.dir = p; renderNF(); } }); return; }
    if(d.nf==='pick'){ nf.checked ? NF.picked.add(d.id) : NF.picked.delete(d.id); }
    if(d.nf==='create'){ createFolder(); return; }
    if(d.nf!=='pick') renderNF(); else m_updatePickCount(); return; }
  if(NF && t.classList.contains('modal-bg')){ NF=null; renderNF(); return; }
  const nb = t.closest('[data-newchat]'); if(nb){ newChat(nb.dataset.pane!==undefined ? {pane:+nb.dataset.pane} : {}); return; }
  if(t.closest('#btnOrg') || t.closest('#railOrg')){ setOrg(!S.org); return; }
  if(t.closest('#railSearch') || t.closest('[data-opensearch]')){ setSearch(!SR.open || !!t.closest('[data-opensearch]')); return; }
  const ssc = t.closest('[data-sscope]'); if(ssc){ SR.scope = ssc.dataset.sscope; SR.sel=0; renderSearch(); $('#sq').focus(); return; }
  const sfo = t.closest('[data-sfold]'); if(sfo){ SR.folder = sfo.dataset.sfold || null; SR.sel=0; renderSearch(); $('#sq').focus(); return; }
  const so = t.closest('[data-sopen]'); if(so){ openFromSearch(so.dataset.sopen, +so.dataset.into); return; }
  const sr = t.closest('[data-sres]'); if(sr){ openFromSearch(SR.res[+sr.dataset.sres].s.id); return; }
  const rp = t.closest('[data-railpane]'); if(rp){ S.active = +rp.dataset.railpane; setOrg(false); render(); return; }
  if(t.closest('#btnInfo')){ S.info = !S.info; render(); return; }
  const sw = t.closest('#swRemote') || t.closest('[data-rctoggle]'); if(sw){ const s = sess(sw.dataset.sid || sw.dataset.rctoggle); if(!s) return;
    if(s.remote){ s.remote = false; renderInfo(); renderPanes(); toast('Uzaktan Kontrol, Terminal penceresi kapanınca biter'); }
    else startRemote(s); return; }
  const rv = t.closest('[data-reveal]'); if(rv){ API.fs.reveal(rv.dataset.reveal).then(ok => ok || toast('Klasör bulunamadı')); return; }
  const cr = t.closest('[data-copyrc]'); if(cr){ const s = sess(cr.dataset.copyrc); if(s) startRemote(s); return; }
  if(t.closest('#connToggle')){ S.connOpen = !S.connOpen; renderInfo(); return; }
  const ex = t.closest('.exp'); if(ex){ ex.classList.toggle('open'); return; }
  const fm = t.closest('[data-fmenu]'); if(fm){ const r = fm.getBoundingClientRect(); folderMenu(fm.dataset.fmenu, r.left, r.bottom+4); return; }
  const as = t.closest('[data-addsub]'); if(as){ openNewFolder(as.dataset.addsub); return; }
  if(t.closest('#fxSideBtn')){ setSide(!S.side); WS.prefs = {...(WS.prefs||{}), side:S.side}; persist(); return; }
  if(t.closest('#btnFolder')){ openNewFolder(curFolder()); return; }
  const tw = t.closest('[data-tw]'); if(tw){ const f = fold(tw.dataset.tw); f.open = !f.open; renderSide(); return; }
  const nv = t.closest('[data-nav]'); if(nv){ go(nv.dataset.nav || null); return; }
  if(t.closest('#fxBack')){ goBack(); return; }
  if(t.closest('#fxFwd')){ goFwd(); return; }
  const fv = t.closest('[data-fv]'); if(fv){ FX.view = fv.dataset.fv; renderBoard(); return; }
  const so2 = t.closest('[data-sort]'); if(so2){ setSort(so2.dataset.sort); return; }
  const sm = t.closest('#fxSort'); if(sm){ const r = sm.getBoundingClientRect(); sortMenu(r.left-120, r.bottom+4); return; }
  if(t.closest('#btnFolder2')){ openNewFolder(curFolder()); return; }
  const gb = t.closest('[data-g]'); if(gb){ gAction(gb.dataset.g, gb.dataset); return; }
  if(justDragged) return;
  const it = t.closest('#fxBody [data-item]'); if(it){ if(t.closest('.rename')) return;
    if(e.detail >= 2 && !MOD(e) && !e.shiftKey){ openItem(it.dataset.item); return; }  // çift tık → klasöre gir / sohbeti aç
    selectClick(it.dataset.item, e); return; }
  if(t.closest('[data-emptytrash]')){ emptyTrash(); return; }
  if(t.closest('#fxBody') && !t.closest('button')){ if(FX.sel.size){ FX.sel.clear(); paintSel(); } return; }
  const sl = t.closest('[data-slot]'); if(sl){ S.active = +sl.dataset.slot; setOrg(false); render(); return; }
  const lb = t.closest('#layouts button'); if(lb){ S.layout = +lb.dataset.l; if(S.active >= nPanes()) S.active=0; render(); return; }
  const tgh = t.closest('.tg-h'); if(tgh){ const g = tgh.parentNode, k = g.dataset.tg; g.classList.toggle('open') ? TGOPEN.add(k) : TGOPEN.delete(k); return; }
  const th = t.closest('.tool-h'); if(th){ th.parentNode.classList.toggle('open'); return; }
  const op = t.closest('[data-open]'); if(op){ openIn(op.dataset.open, +op.dataset.into); return; }
  const cl = t.closest('[data-close]'); if(cl){ S.panes[+cl.dataset.close] = null; render(); return; }
  const sd = t.closest('[data-send]'); if(sd){ send(+sd.dataset.send); return; }
  const sp = t.closest('[data-stop]'); if(sp){ stopRun(+sp.dataset.stop); return; }
  const pb = t.closest('[data-perm]'); if(pb){ const s = sess(S.panes[+pb.closest('.pane').dataset.pane]); if(s) respondPerm(s, pb.dataset.perm); return; }
  const qaB = t.closest('[data-qa]'); if(qaB){ const s = sess(S.panes[+qaB.closest('.pane').dataset.pane]); const R = s && s.run; if(!R) return;
    const q = R.pendings[0].req.input.questions[+qaB.dataset.qa]; const cur = R.answers[q.question] || [];
    R.answers[q.question] = qaB.dataset.multi ? (cur.includes(qaB.dataset.label) ? cur.filter(x => x !== qaB.dataset.label) : [...cur, qaB.dataset.label]) : [qaB.dataset.label];
    renderPanes(); return; }
  const at = t.closest('[data-attach]'); if(at){ pickAttachments(+at.dataset.attach); return; }
  const ua = t.closest('[data-unattach]'); if(ua){ const s = sess(ua.dataset.sid); s.attach.splice(+ua.dataset.unattach, 1); renderPanes(); return; }
  if(t.closest('[data-mcpcheck]')){ const s = sess(S.panes[S.active]); if(s) checkConnectors(s); return; }
  if(t.closest('[data-login]')){ API.claude.login(); toast('Terminal açıldı: girişi tarayıcıda tamamla, sonra "Tekrar kontrol et"'); let n = 0; const iv = setInterval(async () => { n++; const a = await checkAuth(); if(a.loggedIn || n > 40){ clearInterval(iv); if(a.loggedIn) toast('Giriş tamam — artık panelden yazabilirsin'); } }, 3000); return; }
  if(t.closest('[data-authcheck]')){ checkAuth().then(a => toast(a.loggedIn ? 'Giriş tamam' : 'Hâlâ giriş yapılmamış')); return; }
  const pm = t.closest('[data-pmode]'); if(pm){ const r = pm.getBoundingClientRect(); const s = sess(pm.dataset.pmode); menu(r.left, r.top - 200, `<div class="mh">İzin modu</div>${PMODES.map(([k,l]) => `<button data-m="pmode" data-id="${s.id}" data-v="${k}">${pmodeOf(s)===k?'✓ ':'&nbsp;&nbsp;&nbsp;'}${l}</button>`).join('')}`); return; }
  const ctl = t.closest('[data-control]'); if(ctl){ const s = sess(ctl.dataset.control); const on = !controlOf(s);
    if(on && !CTRL.desktop){ const r = ctl.getBoundingClientRect();
      menu(r.left, r.top - 150, `<div class="mh">Masaüstü kontrolü için agent-desktop gerekli</div>
        <button data-m="ctlinstall" data-id="${s.id}">${ic('plus')}agent-desktop'ı kur ve aç (npm, ~1 dk)</button>
        <button data-m="ctlbrowser" data-id="${s.id}">${ic('ext')}Yalnızca tarayıcıyla aç (Chrome)</button>`); return; }
    setControl(s, on); return; }
  const us = t.closest('[data-usage]'); if(us){ const r = us.getBoundingClientRect(); usageMenu(r.left - 80, r.top - 330); return; }
  const eff = t.closest('[data-effort]'); if(eff){ const r = eff.getBoundingClientRect(); const s = sess(eff.dataset.effort); const cur = effortOf(s);
    menu(r.left - 40, r.top - 236, `<div class="mh">Düşünme seviyesi</div>${EFFORTS.map(([k,l,d]) => `<button data-m="effort" data-id="${s.id}" data-v="${k||''}" title="${esc(d)}">${cur===k?'✓ ':'&nbsp;&nbsp;&nbsp;'}${l}</button>`).join('')}`); return; }
  const mdl = t.closest('[data-model]'); if(mdl){ const r = mdl.getBoundingClientRect(); const s = sess(mdl.dataset.model); menu(r.left - 60, r.top - 160, `<div class="mh">Model</div>${MODELS.map(([k,l]) => `<button data-m="model" data-id="${s.id}" data-v="${k||''}">${(s.modelPick||null)===k?'✓ ':'&nbsp;&nbsp;&nbsp;'}${l}${k?'':' · '+esc(s.model)}</button>`).join('')}`); return; }
  const rpl = t.closest('[data-reply]'); if(rpl){ const s = sess(rpl.dataset.sid), i = S.panes.indexOf(s && s.id); const ta = i >= 0 && document.querySelector(`[data-ta="${i}"]`);
    if(ta){ ta.value = rpl.dataset.reply; s.inputDraft = ta.value; send(i); } else toast('Önce sohbeti bir bölmede aç'); return; }
  const fsd = t.closest('[data-fsend]'); if(fsd){ const i = +fsd.dataset.i, fs = sess(S.panes[i]); if(fs) fs.askFork = false; send(i, fsd.dataset.fsend === 'fork' ? {fork:true} : {force:true}); return; }
  const fx = t.closest('[data-forkx]'); if(fx){ const s = sess(fx.dataset.forkx); if(s){ s.askFork = false; renderPanes(); } return; }
  const qd = t.closest('[data-qdel]'); if(qd){ const s = sess(qd.dataset.sid); if(s && s.queue){ s.queue.splice(+qd.dataset.qdel, 1); renderPanes(); } return; }
  const qc = t.closest('[data-qclear]'); if(qc){ const s = sess(qc.dataset.qclear); if(s){ s.queue = []; s.queuePaused = false; renderPanes(); } return; }
  const qr = t.closest('[data-qresume]'); if(qr){ const s = sess(qr.dataset.qresume); if(s){ s.queuePaused = false; renderPanes(); runQueue(s); } return; }
  const mc = t.closest('[data-mic]'); if(mc){ dictate(+mc.dataset.mic); return; }
  const tp = t.closest('[data-tpl]'); if(tp){ const r = tp.getBoundingClientRect(); tplMenu(+tp.dataset.tpl, r.left, r.top - 60 - templates().length * 32); return; }
  const swp = t.closest('[data-swap]'); if(swp){ S.active = +swp.dataset.swap; SR.q = ''; const sq = $('#sq'); if(sq) sq.value = ''; renderRail(); setSearch(true); return; }
  const mo = t.closest('[data-more]'); if(mo){ const r = mo.getBoundingClientRect(); sessMenu(mo.dataset.more, r.left-160, r.bottom+4); return; }
  if(t.closest('[data-watch]')){ toast('Salt okuma modunda canlı izleniyor'); return; }
  const fk = t.closest('[data-fork]'); if(fk){
    const s = sess(fk.dataset.fork); const id='s'+Date.now();
    S.sessions.push({...s, id, title:s.title+' (çatal)', status:'idle', ago:'şimdi', msgs:[...s.msgs], pinned:false, remote:false}); S.items.splice(S.items.indexOf(s.id)+1,0,id);
    openIn(id); toast('Oturum çatallandı'); return;
  }
  if(t.closest('#btnSettings')){ const r = t.closest('#btnSettings').getBoundingClientRect(); settingsMenu(r.right + 6, r.bottom - 260); return; }
  if(t.closest('#btnUpd')){ updateClick(); return; }
  if(t.closest('#btnSync')){ syncNow(); return; }
  if(t.closest('#btnTheme')){
    const next = isDarkTheme() ? 'light' : 'dark';
    applyTheme(next); WS.prefs = {...(WS.prefs||{}), theme:next}; persist(); return;
  }
  const pane = t.closest('.pane'); if(pane){ const i=+pane.dataset.pane; if(i!==S.active){ S.active=i; document.querySelectorAll('.pane').forEach(p=>p.classList.toggle('active', +p.dataset.pane===i)); renderRail(); renderInfo(); } }
});
document.addEventListener('contextmenu', e => {
  const it = e.target.closest('[data-item]');
  if(it){ e.preventDefault(); const id = it.dataset.item; if(!FX.sel.has(id)){ FX.sel = new Set([id]); paintSel(); }
    if(FX.sel.size > 1 || FX.cwd===TRASH) selMenu(e.clientX, e.clientY);
    else id[0]==='f' ? folderMenu(id, e.clientX, e.clientY) : sessMenu(id, e.clientX, e.clientY); return; }
  const tr = e.target.closest('.fx-si[data-nav=":trash"]'); if(tr){ e.preventDefault(); const n = trashIds().length;
    menu(e.clientX, e.clientY, `<button data-m="nav" data-f="${TRASH}">${ic('trash')}Aç</button>${n ? `<hr><button data-m="bgempty" style="color:#c0392b">${ic('trash')}Çöp Kutusunu Boşalt (${n} öğe)</button>` : '<div class="mh">Çöp Kutusu boş</div>'}`); return; }
  const sf = e.target.closest('.fx-si[data-nav^="f"]'); if(sf){ e.preventDefault(); folderMenu(sf.dataset.nav, e.clientX, e.clientY); return; }
  if(e.target.closest('input,textarea')) return; // metin kutusunda sistemin kopyala/yapıştır menüsü kalsın
  if(e.target.closest('#fxBody') && FX.cwd!==GRAPH){ e.preventDefault(); if(FX.sel.size){ FX.sel.clear(); paintSel(); } bgMenu(e.clientX, e.clientY, false); return; }
  if(e.target.closest('#fxSide') && !e.target.closest('button')){ e.preventDefault(); bgMenu(e.clientX, e.clientY, true); }
});
function commitRename(inp){ const id = inp.dataset.ren, v = inp.value.trim()||'Adsız'; if(id[0]==='f'){ const f = fold(id); if(f) f.name = v; } else { const s = sess(id); if(s) s.title = v; } renaming=null; }
document.addEventListener('keydown', e => {
  if(e.target.matches('.m-q')){
    if(e.key==='Escape') closeMenu();
    if(e.key==='Enter'){ const b = [...document.querySelectorAll('.menu .m-scroll [data-q]')].find(b => b.style.display !== 'none'); if(b) b.click(); }
    e.stopPropagation(); return;
  }
  if(e.target.matches('[data-pq]')){
    if(e.key==='Enter'){ e.preventDefault(); const b = [...e.target.parentElement.querySelectorAll('.recent [data-open]')].find(b => b.style.display !== 'none'); if(b) b.click(); }
    if(e.key==='Escape' && e.target.value){ e.target.value = ''; filterPanePick(e.target); }
    e.stopPropagation(); return;
  }
  if(e.target.matches('[data-ren]')){
    if(e.key==='Enter'){ commitRename(e.target); render(); }
    if(e.key==='Escape'){ renaming=null; renderBoard(); }
    e.stopPropagation(); return;
  }
  if(e.target.matches('[data-ta]') && e.key==='Tab' && !e.shiftKey && e.target._sug){ e.preventDefault(); acceptGhost(e.target); return; }
  if(e.target.matches('[data-ta]') && e.key==='Escape' && e.target._sug){ e.preventDefault(); e.stopPropagation(); e.target._sug = null; e.target.parentElement.querySelector('.ghost').innerHTML = ''; e.target.dataset.noghost = e.target.value; return; }
  if(e.target.matches('[data-ta]') && e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(+e.target.dataset.ta); return; }
  if(NC){ if(e.target.id==='ncTitle' && e.key==='Enter' && !MOD(e)){ e.preventDefault(); if(NC.dir) $('#ncText')?.focus(); else $('#ncDq')?.focus(); return; }
    if(e.key==='Escape'){ NC=null; renderNC(); } if(e.key==='Enter' && MOD(e)){ e.preventDefault(); startChat(); } return; }
  if(MOD(e) && !e.shiftKey && !e.altKey && e.key.toLowerCase()==='n'){ e.preventDefault(); newChat(); return; }
  if(NF){ if(e.key==='Escape'){ NF=null; renderNF(); } if(e.key==='Enter' && !/^(nfDq|nfCq)$/.test(e.target.id) && e.target.tagName!=='BUTTON'){ e.preventDefault(); createFolder(); } return; }
  if(SR.open){
    if(e.key==='Escape'){ setSearch(false); return; }
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); SR.sel = Math.max(0, Math.min(SR.res.length-1, SR.sel + (e.key==='ArrowDown'?1:-1))); renderSearch(); return; }
    if(e.key==='Enter' && SR.res[SR.sel]){ e.preventDefault(); openFromSearch(SR.res[SR.sel].s.id); return; }
    if(MOD(e) && /^[1-4]$/.test(e.key) && SR.res[SR.sel] && +e.key<=nPanes()){ e.preventDefault(); openFromSearch(SR.res[SR.sel].s.id, +e.key-1); return; }
    if(MOD(e) && e.key.toLowerCase()==='k'){ e.preventDefault(); setSearch(false); return; }
  }
  if(MOD(e) && e.key==='Enter' && !S.org){ const s = sess(S.panes[S.active]); if(s && s.run && s.run.pendings && s.run.pendings.length){ e.preventDefault(); const k = s.run.pendings[0].req.tool_name; respondPerm(s, k==='AskUserQuestion' ? 'answer' : 'allow'); return; } }
  if(e.key==='Escape' && !S.org && !SR.open && !NF && !NC && !MV && !QL){ const s = sess(S.panes[S.active]); if(s && s.run){ e.preventDefault(); stopRun(S.active); return; } }
  if(QL){ if(e.key===' '||e.key==='Escape'){ e.preventDefault(); quickLook(null); } return; }
  if(MV){ if(e.key==='Escape'){ MV=null; renderMove(); } if(e.key==='Enter'){ const ids=MV.ids, tg=MV.target; MV=null; renderMove(); moveInto(ids, tg); } return; }
  if(S.org && !e.target.matches('input,textarea,select')){
    if(FX.cwd===GRAPH && gKey(e)) return;
    const sel = [...FX.sel];
    if(e.key===' ' && sel.length===1){ e.preventDefault(); quickLook(sel[0]); return; }
    if(MOD(e) && e.key.toLowerCase()==='x' && sel.length){ e.preventDefault(); FX.clip = sel; renderBoard(); toast(`${sel.length} öğe kesildi · hedef klasörde ⌘V`); return; }
    if(MOD(e) && e.key.toLowerCase()==='v' && FX.clip){ e.preventDefault(); if(FX.cwd && FX.cwd[0]===':'){ toast('Buraya yapıştırılamaz'); return; } const c = FX.clip; FX.clip = null; moveInto(c, FX.cwd); return; }
    if(MOD(e) && e.key==='Backspace' && sel.length){ e.preventDefault(); FX.cwd===TRASH ? restoreItems(sel) : trashItems(sel); return; }
    if((IS_MAC ? e.ctrlKey : e.altKey) && MOD(e) && e.key.toLowerCase()==='n' && sel.length){ e.preventDefault(); openNewFolder(curFolder(), sel); return; }
    if(e.key==='Enter' && sel.length){ e.preventDefault(); openItem(sel[0]); return; }
    if(e.key==='F2' && sel.length===1){ e.preventDefault(); renaming = sel[0]; renderBoard(); return; }
    if(e.key==='Backspace' || (MOD(e) && e.key==='ArrowUp')){ e.preventDefault(); goUp(); return; }
    if(MOD(e) && e.key==='ArrowDown' && sel.length){ e.preventDefault(); openItem(sel[0]); return; }
    if(MOD(e) && e.key==='['){ e.preventDefault(); goBack(); return; }
    if(MOD(e) && e.key===']'){ e.preventDefault(); goFwd(); return; }
    if(MOD(e) && e.key.toLowerCase()==='a'){ e.preventDefault(); FX.sel = new Set(listing()); renderBoard(); return; }
    if(MOD(e) && e.shiftKey && e.key.toLowerCase()==='n'){ e.preventDefault(); openNewFolder(curFolder()); return; }
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
      const ids = listing(); if(!ids.length) return; e.preventDefault();
      const cols = FX.view==='grid' ? Math.max(1, Math.round(($('.fx-grid')?.clientWidth||600) / (($('.fx-it')?.offsetWidth||118)+8))) : 1;
      const step = {ArrowLeft:-1, ArrowRight:1, ArrowUp:-cols, ArrowDown:cols}[e.key];
      const cur = FX.anchor && ids.includes(FX.anchor) ? ids.indexOf(FX.anchor) : -1;
      const nx = Math.max(0, Math.min(ids.length-1, cur<0 ? 0 : cur+step)); FX.sel = new Set([ids[nx]]); FX.anchor = ids[nx]; renderBoard(); return; }
  }
  if(e.key==='Escape' && S.org){ setOrg(false); return; }
  if(MOD(e) && e.key.toLowerCase()==='b'){ e.preventDefault(); setOrg(!S.org); }
  if(MOD(e) && e.key.toLowerCase()==='i'){ e.preventDefault(); S.info=!S.info; render(); }
  if(MOD(e) && e.key.toLowerCase()==='k'){ e.preventDefault(); setSearch(true); }
  if(MOD(e) && /^[1-4]$/.test(e.key)){ e.preventDefault(); const i=+e.key-1; if(i < nPanes()){ S.active=i; render(); } }
});
document.addEventListener('focusout', e => { if(e.target.matches('[data-ren]')){ if(REBUILDING || !e.target.isConnected || e.target.dataset.ren !== renaming) return; commitRename(e.target); setTimeout(render); } });
document.addEventListener('change', e => {
  if(e.target.id==='ncGroup' && NC){ ncSync(); const f = fold(NC.group); if(f && f.dir && !NC.dir){ NC.dir = f.dir; NC.err = false; } renderNC(); }
});
document.addEventListener('input', e => {
  if(e.target.id==='ncDq'){ ncSync(); NC.dq = e.target.value; renderNC(); const i=$('#ncDq'); i.focus(); i.setSelectionRange(999,999); }
  if(e.target.matches && e.target.matches('[data-qfree]')){ const s = sess(S.panes[+e.target.closest('.pane').dataset.pane]); if(s && s.run){ (s.run.free = s.run.free || {})[+e.target.dataset.qfree] = e.target.value; } }
  if(e.target.id==='sq'){ SR.q = e.target.value; SR.sel = 0; renderSearch(); backendSearch(); }
  if(e.target.id==='nfCq'){ NF.cq = e.target.value; filterNFPicks(); }
  if(e.target.matches && e.target.matches('.m-q')) filterMenuFolders(e.target);
  if(e.target.matches && e.target.matches('[data-pq]')) filterPanePick(e.target);
  if(e.target.id==='nfDq'){ NF.dq = e.target.value; NF.name = $('#nfName').value; renderNF(); const i=$('#nfDq'); i.focus(); i.setSelectionRange(99,99); }
  if(e.target.matches('[data-ta]')){ autosize(e.target); const ds = sess(S.panes[+e.target.dataset.ta]); if(ds) ds.inputDraft = e.target.value; delete e.target.dataset.noghost; updateGhost(e.target); }
});

/* drag & drop — Finder gibi:
   · öğeyi bir klasör simgesine / kenar çubuğundaki klasöre / yol çubuğundaki bir klasöre bırak → içine taşınır
   · boş alana bırak → bulunduğun klasöre taşınır · sohbeti bölme şeridine veya bir bölmeye bırak → orada açılır
   · ⌘/⇧ ile birden fazla öğe seçip birlikte sürükleyebilirsin */
const clearDrop = () => document.querySelectorAll('.drop,.dropping,.dropin,.dragging').forEach(x=>x.classList.remove('drop','dropping','dropin','dragging'));
/* İşaretçi (pointer) tabanlı sürükleme: Electron/Chrome'da HTML5 DnD'den daha güvenilir, özel "hayalet" gösterir */
let pd = null; // {id, x, y, started, ghost}
let justDragged = false;
document.addEventListener('pointerdown', e => {
  const it = e.target.closest('#fxBody [data-item]');
  if(!it || e.button!==0 || e.target.closest('.rename')) return;
  pd = {id: it.dataset.item, x: e.clientX, y: e.clientY, started:false};
});
document.addEventListener('pointermove', e => {
  if(!pd) return;
  if(!pd.started){
    if(Math.hypot(e.clientX-pd.x, e.clientY-pd.y) < 6) return;
    pd.started = true;
    if(!FX.sel.has(pd.id)){ FX.sel = new Set([pd.id]); paintSel(); }
    drag = {ids:[...FX.sel]};
    document.querySelectorAll('#fxBody [data-item]').forEach(el=>{ if(FX.sel.has(el.dataset.item)) el.classList.add('dragging'); });
    const g = document.createElement('div'); g.className = 'drag-ghost';
    const first = drag.ids[0];
    g.innerHTML = `${first[0]==='f'?fsvg('fsm', fullF(first)):ic('msg')}<span>${esc(nameOf(first))}</span>${drag.ids.length>1?`<b>${drag.ids.length}</b>`:''}`;
    document.body.appendChild(g); pd.ghost = g; document.body.classList.add('dragging-now');
  }
  pd.ghost.style.transform = `translate(${e.clientX+12}px, ${e.clientY+10}px)`;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const t = el ? dropTarget({target: el}) : null;
  document.querySelectorAll('.drop,.dropping,.dropin').forEach(x=>x.classList.remove('drop','dropping','dropin'));
  if(t) t.el.classList.add(t.cls);
  armSpring(t && t.cls==='drop' && t.el.dataset.fdrop ? t.el : null);
  pd.target = t;
});
function endPointerDrag(e, cancel){
  if(!pd) return;
  if(pd.started){
    justDragged = true; setTimeout(()=>justDragged=false, 0);
    const el = !cancel && document.elementFromPoint(e.clientX, e.clientY); // bırakma alanı gizlenmeden önce bak
    pd.ghost?.remove(); document.body.classList.remove('dragging-now');
    clearTimeout(spring.timer); spring.el = null;
    const t = el ? dropTarget({target: el}) : null;
    clearDrop(); if(t) t.act();
    drag = null;
  }
  pd = null;
}
document.addEventListener('pointerup', e => endPointerDrag(e, false));
document.addEventListener('pointercancel', e => endPointerDrag(e, true));
document.addEventListener('keydown', e => { if(e.key==='Escape' && pd && pd.started){ e.stopImmediatePropagation(); endPointerDrag(e, true); clearDrop(); } }, true);
document.addEventListener('dragstart', e => { if(e.target.closest && e.target.closest('#fxBody')) e.preventDefault(); });

/* Boş alanda sürükle-seç (Windows masaüstü / Finder gibi): dikdörtgene değen öğeler seçilir.
   ⇧ basılıysa önceki seçime eklenir, ⌘/Ctrl değenleri tersine çevirir. Kenara yaklaşınca liste kendiliğinden kayar; Esc vazgeçer. */
let LS = null; // {x0, y0: içerik koordinatı, cx, cy: imleç, base, mode, started, box, raf}
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('#fxBody');
  if(!b || e.button!==0 || FX.cwd===GRAPH || e.target.closest('[data-item],button,input,textarea,select,a,th,label')) return;
  const r = b.getBoundingClientRect();
  if(e.clientX >= r.left + b.clientLeft + b.clientWidth || e.clientY >= r.top + b.clientTop + b.clientHeight) return; // kaydırma çubuğu
  LS = {x0: e.clientX - r.left + b.scrollLeft, y0: e.clientY - r.top + b.scrollTop, cx: e.clientX, cy: e.clientY, sx: e.clientX, sy: e.clientY,
    orig: new Set(FX.sel), base: (MOD(e) || e.shiftKey) ? new Set(FX.sel) : new Set(), mode: MOD(e) ? 'toggle' : 'add', started: false, pid: e.pointerId};
});
function paintLasso(){
  const b = $('#fxBody'); if(!b || !LS) return;
  if(!LS.box.isConnected) b.appendChild(LS.box); // pano arkada yeniden çizildiyse kutuyu geri koy
  const br = b.getBoundingClientRect();
  const cl = (v, max) => Math.max(0, Math.min(max, v));
  const x1 = cl(LS.cx - br.left + b.scrollLeft, b.scrollWidth - 1), y1 = cl(LS.cy - br.top + b.scrollTop, b.scrollHeight - 1);
  const q = {l: Math.min(LS.x0, x1), t: Math.min(LS.y0, y1), r: Math.max(LS.x0, x1), b: Math.max(LS.y0, y1)};
  Object.assign(LS.box.style, {left: q.l+'px', top: q.t+'px', width: (q.r-q.l)+'px', height: (q.b-q.t)+'px'});
  const hit = new Set();
  b.querySelectorAll('[data-item]').forEach(el => { const r = el.getBoundingClientRect();
    const l = r.left - br.left + b.scrollLeft, t = r.top - br.top + b.scrollTop;
    if(l < q.r && l + r.width > q.l && t < q.b && t + r.height > q.t) hit.add(el.dataset.item); });
  const next = LS.mode==='toggle' ? new Set([...[...LS.base].filter(x => !hit.has(x)), ...[...hit].filter(x => !LS.base.has(x))]) : new Set([...LS.base, ...hit]);
  if(next.size !== FX.sel.size || [...next].some(x => !FX.sel.has(x))){ FX.sel = next; paintSel(); }
  LS.hit = hit;
}
function lassoTick(){
  if(!LS || !LS.started) return;
  const b = $('#fxBody'), r = b.getBoundingClientRect(), E = 28;
  const dy = LS.cy < r.top + E ? -Math.ceil((r.top + E - LS.cy) / 2) : LS.cy > r.bottom - E ? Math.ceil((LS.cy - r.bottom + E) / 2) : 0;
  if(dy){ const before = b.scrollTop; b.scrollTop += Math.min(40, Math.max(-40, dy)); if(b.scrollTop !== before) paintLasso(); }
  LS.raf = requestAnimationFrame(lassoTick);
}
document.addEventListener('pointermove', e => {
  if(!LS || e.pointerId !== LS.pid) return;
  LS.cx = e.clientX; LS.cy = e.clientY;
  if(!LS.started){
    if(Math.hypot(e.clientX - LS.sx, e.clientY - LS.sy) < 5) return;
    LS.started = true; closeMenu();
    const b = $('#fxBody'); LS.box = document.createElement('div'); LS.box.className = 'fx-lasso'; b.appendChild(LS.box);
    document.body.classList.add('lassoing'); try { getSelection().removeAllRanges(); } catch {}
    try { b.setPointerCapture(e.pointerId); } catch {}
    LS.raf = requestAnimationFrame(lassoTick);
  }
  paintLasso();
});
function endLasso(cancel){
  if(!LS) return;
  if(LS.started){
    justDragged = true; setTimeout(() => justDragged = false, 0); // ardından gelen tıklama seçimi temizlemesin
    cancelAnimationFrame(LS.raf); LS.box.remove(); document.body.classList.remove('lassoing');
    if(cancel){ FX.sel = LS.orig; paintSel(); } // Esc: sürüklemeden önceki seçim geri gelir
    else { const ids = listing().filter(x => FX.sel.has(x)); if(ids.length) FX.anchor = ids[0]; }
  }
  LS = null;
}
document.addEventListener('pointerup', e => { if(LS && e.pointerId === LS.pid) endLasso(false); });
document.addEventListener('pointercancel', e => { if(LS && e.pointerId === LS.pid) endLasso(true); });
document.addEventListener('keydown', e => { if(e.key==='Escape' && LS && LS.started){ e.stopImmediatePropagation(); endLasso(true); } }, true);
function moveInto(ids, target){
  let moved = 0;
  ids.forEach(id => {
    if(id[0]==='f'){ if(target && inside(target, id)) return; fold(id).parent = target; fold(id).trashed = false; }
    else { const s = sess(id); s.folder = target; s.fresh = false; s.trashed = false; }
    moved++;
  });
  FX.sel.clear(); render();
  toast(`${moved} öğe → ${target ? fold(target).name : 'Sohbetler'}`);
}
// Sürüklenenleri yeni bir klasöre koy (bulunulan klasörün içinde) ve hemen adlandırmaya geç
function newFolderWith(ids){
  const parent = FX.cwd && FX.cwd[0]==='f' ? FX.cwd : null;
  const used = new Set(S.folders.filter(f=>!f.trashed && (f.parent||null)===parent).map(f=>f.name));
  let name = 'Yeni klasör', k = 2; while(used.has(name)) name = `Yeni klasör ${k++}`;
  const id = 'f'+Date.now();
  S.folders.push({id, name, color:COLORS[S.folders.length % COLORS.length], parent, open:true, dir:null});
  S.items.push(id);
  let n = 0;
  ids.forEach(x => { if(x===id) return; if(x[0]==='f'){ if(inside(id, x)) return; fold(x).parent = id; fold(x).trashed = false; } else { const s = sess(x); s.folder = id; s.fresh = false; s.trashed = false; } n++; });
  if(parent) fold(parent).open = true;
  if(!S.org) setOrg(true);
  if(FX.cwd !== parent) go(parent);
  FX.sel = new Set([id]); renaming = id; render();
  setTimeout(() => { const i = document.querySelector(`.rename[data-ren="${id}"]`); if(i && document.activeElement !== i){ i.focus(); i.select(); } }, 30);
  toast(`"${name}" oluşturuldu · ${n} öğe taşındı — adını yaz, Enter`);
}
function dropTarget(e){
  if(!drag) return null;
  const nfd = e.target.closest('#nfDrop'); if(nfd) return {el:nfd, cls:'drop', act:()=>newFolderWith(drag.ids)};
  const onlySess = drag.ids.every(id=>id[0]==='s');
  if(onlySess){
    const slot = e.target.closest('[data-slot]'); if(slot) return {el:slot, cls:'drop', act:()=>{ setOrg(false); openIn(drag.ids[0], +slot.dataset.slot); }};
    const pane = e.target.closest('.pane'); if(pane) return {el:pane, cls:'dropping', act:()=>openIn(drag.ids[0], +pane.dataset.pane)};
  }
  const fd = e.target.closest('[data-fdrop]');
  if(fd){
    const t = fd.dataset.fdrop || null;
    if(t && drag.ids.includes(t)) return null;
    if(t && drag.ids.some(id=>id[0]==='f' && inside(t,id))) return null;
    if(drag.ids.every(id=>parentOf(id)===t)) return null;
    return {el:fd, cls:'drop', act:()=>moveInto(drag.ids, t)};
  }
  const body = e.target.closest('#fxBody');
  if(body && !(FX.cwd && FX.cwd[0]===':') && !drag.ids.every(id=>parentOf(id)===FX.cwd))
    return {el:body, cls:'dropin', act:()=>moveInto(drag.ids, FX.cwd)};
  return null;
}
let spring = {el:null, timer:null};
function armSpring(el){
  if(spring.el === el) return;
  clearTimeout(spring.timer); spring.el = el;
  const fid = el && el.dataset.fdrop; if(!fid || fid===FX.cwd) return;
  el.classList.add('spring');
  spring.timer = setTimeout(() => { if(drag && spring.el===el){ go(fid); spring.el=null; } }, 900);  // Finder gibi: üstünde bekleyince klasör açılır
}


/* ---------- Gerçek veri: ana süreçten oturumlar + ~/.claude-panel/workspace.json ---------- */
const API = window.api;
const sid = uuid => 's:' + uuid;
let WS = null;
const loading = new Map();
// Yeniden yüklemede aynı metinler tekrar tekrar markdown'a çevrilmesin (en çok 3000 kayıt, en eskisi atılır)
const MDC = new Map();
function mdMemo(t){ let h = MDC.get(t); if(h !== undefined) return h; h = md(t); MDC.set(t, h); if(MDC.size > 3000) MDC.delete(MDC.keys().next().value); return h; }
window.__errors = [];
window.addEventListener('error', e => window.__errors.push(String(e.message)));
window.addEventListener('unhandledrejection', e => window.__errors.push(String(e.reason && e.reason.message || e.reason)));

function fmtAgo(ts){
  const m = Math.max(0, Math.round((Date.now() - Date.parse(ts)) / 60000));
  if(m < 1) return 'şimdi'; if(m < 60) return m + ' dk';
  const h = Math.round(m / 60); if(h < 24) return h + ' sa';
  const d = Math.round(m / 1440); if(d === 1) return 'dün'; if(d < 7) return d + ' gün';
  return Math.round(d / 7) + ' hf';
}
const shortTool = n => n && n.startsWith('mcp__') ? n.split('__').slice(1).join(' · ') : n;
function syncLine(){ const p = new Set(S.sessions.map(s => s.project)).size; return `Senkron · ${p} proje · ${S.sessions.length} oturum`; }

// Ana süreçten gelen özet → arayüz oturumu. Kullanıcıya ait alanlar (klasör, sabitleme, takma ad, çöp) workspace'ten gelir
// ve mevcut bir oturum güncellenirken ezilmez.
// Dosyadaki son yazım panelin kendi turundan mı? (tur bittikten sonra CLI birkaç saniye daha yazabilir)
// Öyleyse oturum "başka yerde yazılıyor" sayılmaz.
const ownWrite = (s, x) => !!s.ownAt && (x.mtimeMs || 0) <= s.ownAt + 15000;
function fromSummary(x, prev){
  if(prev){
    const aliased = prev.title !== prev.rawTitle;
    Object.assign(prev, {rawTitle:x.title, project:x.project, cwd:x.cwd, lastTs:x.lastTs, ago:fmtAgo(x.lastTs), model:x.model || '—', ctx:x.ctxTokens/1000, bridge:x.bridge,
      permissionMode:x.permissionMode, status: prev.run ? 'running' : (x.live && !ownWrite(prev, x) ? 'elsewhere' : 'idle')});
    if(!aliased) prev.title = x.title;
    return prev;
  }
  const id = sid(x.id), meta = (WS.meta || {})[id] || {};
  return {id, uuid:x.id, msgs:[], outputs:[], loaded:false, remote:false,
    title: meta.alias || x.title, rawTitle:x.title, project:x.project, cwd:x.cwd,
    folder: meta.folder && fold(meta.folder) ? meta.folder : null, pinned:!!meta.pinned, trashed:!!meta.trashed, hidden:!!meta.hidden,
    ...('effort' in meta ? {effort: meta.effort} : {}), ...('control' in meta ? {control: !!meta.control} : {}),
    lastTs:x.lastTs, ago:fmtAgo(x.lastTs), model:x.model || '—', ctx:x.ctxTokens/1000, bridge:x.bridge, permissionMode:x.permissionMode, status: x.live ? 'elsewhere' : 'idle'};
}

// Başka yerde yazılan açık oturum her değişiklikte yeniden yüklenir; yükleme sürerken gelen istekler tek bir
// ardıl yüklemede birleşir ve ardıl yükleme en erken 1 sn sonra başlar (sürekli yazılan oturum paneli kilitlemesin).
async function ensureLoaded(id, force){
  const s = sess(id); if(!s || (s.loaded && !force) || s.run || s.draft) return;
  if(loading.has(id)){ if(force) s.reloadAgain = true; return loading.get(id); }
  const job = (async () => {
    try {
      const d = await API.sessions.load(s.uuid, 60);
      // Yükleme sürerken gönderilen mesaj ve canlı yanıt (local) korunur; tur bitince diskteki kayıt onları zaten içerir
      const keep = s.run ? s.msgs.filter(m => m.local) : [];
      s.msgs = d.msgs.map(m => m.r==='u' ? m : {r:'a', b:m.b.map(b => b.t==='text' ? {t:'text', v:mdMemo(b.v)} : {...b, n:shortTool(b.n)})});
      s.msgs.push(...keep);
      s.outputs = d.outputs.map(o => o.path); s.skipped = d.skipped; s.turns = d.turns; s.loadErr = null;
    } catch(e){ if(!s.msgs.length) s.loadErr = String(e && e.message || e); else console.warn('yeniden yüklenemedi', e); }
    s.loaded = true; loading.delete(id);
    if(S.panes.includes(id)) { renderPanes(); if(S.panes[S.active] === id) renderInfo(); }
    if(s.reloadAgain){ s.reloadAgain = false; setTimeout(() => ensureLoaded(id, true), 1000); }
  })();
  loading.set(id, job); return job;
}

let saveT = null;
function buildWS(){
    // Şu an listede olmayan oturumların bilgisi (klasör, ad…) silinmez: oturum listesi bir an eksik gelse de veri kaybolmaz
    const meta = {};
    Object.entries(WS.meta || {}).forEach(([k, v]) => { if(!sess(k)) meta[k] = v; });
    S.sessions.forEach(s => { const m = {};
      if(s.folder) m.folder = s.folder; if(s.pinned) m.pinned = true; if(s.title !== s.rawTitle) m.alias = s.title;
      if(s.trashed) m.trashed = true; if(s.hidden) m.hidden = true; if(s.effort !== undefined) m.effort = s.effort; if(s.control !== undefined) m.control = s.control; if(Object.keys(m).length) meta[s.id] = m; });
    const graphPos = {}; Object.entries(G.pos).forEach(([k,p]) => { if(p.fixed) graphPos[k] = {x:Math.round(p.x), y:Math.round(p.y)}; });
    WS = {...WS, firstRun:false, meta, graphPos, prefs:{...(WS.prefs||{}), fonts:{...FONT}, fontsV:2},
      folders: S.folders.map(({id,name,color,parent,open,dir,trashed,hidden}) => ({id,name,color,parent,open,dir,trashed,hidden})),
      items: S.items, links: S.links, known: S.sessions.filter(s => !s.fresh).map(s => s.id),
      layout: {layout:S.layout, panes:S.panes, active:S.active, info:S.info}};
    return WS;
}
function persist(){
  if(!WS) return;
  clearTimeout(saveT);
  saveT = setTimeout(() => { saveT = null; API.workspace.save(buildWS()).catch(e => { console.warn('kaydedilemedi', e); toast('Değişiklikler kaydedilemedi — tekrar denenecek'); setTimeout(persist, 3000); }); }, 400);
}
// Pencere kapanırken bekleyen kayıt varsa beklemeden yaz (son 0,4 sn içindeki değişiklik kaybolmasın)
window.addEventListener('beforeunload', () => { if(saveT && WS){ clearTimeout(saveT); saveT = null; try { API.workspace.saveSync(buildWS()); } catch {} } });
// her çizimden ve ağ değişikliğinden sonra kaydet
const _render = render; render = function(){ _render(); persist(); };
const _gHud = gHud; gHud = function(){ _gHud(); persist(); };

function onChanged(payload){
  const {sessions, changed} = payload;
  const byId = new Map(sessions.map(x => [sid(x.id), x]));
  // panelde yeni açılan oturumun dosyası dizine birkaç saniye geç düşebilir → kısa süre koru
  const keep = s => byId.has(s.id) || s.draft || s.run || (s.localUntil && Date.now() < s.localUntil);
  S.sessions = S.sessions.filter(keep);
  S.items = S.items.filter(id => id[0] !== 's' || (sess(id) && keep(sess(id))));
  byId.forEach((x, id) => { const prev = sess(id);
    if(prev){ fromSummary(x, prev); prev.draft = false; }
    else { const s = fromSummary(x); s.fresh = true; S.sessions.push(s); S.items.unshift(id); } });
  S.sessions.sort((a,b) => (b.lastTs || '').localeCompare(a.lastTs || ''));
  S.panes = S.panes.map(p => p && sess(p) ? p : null);
  changed.map(sid).forEach(id => { const s = sess(id); if(s && s.loaded && (S.panes.includes(id) || QL === id)) ensureLoaded(id, true); });
  // Başka bir oturum diske yazdıkça (saniyede birkaç kez) tüm arayüz yeniden kurulmaz: bölmeler yamalanır,
  // bilgi paneli yalnızca etkin bölmenin oturumu değiştiyse çizilir.
  renderRail(); renderPanes(); if(S.org) renderBoard();
  if(S.info && changed.map(sid).includes(S.panes[S.active])) renderInfo();
  persist();
}

// Tema: data-theme yoksa sistem temasını izler (CSS prefers-color-scheme). Koyu mu, rengine bakarak değil buradan anlaşılır
// (eskiden --bg rengiyle karşılaştırılıyordu; koyu temanın rengi değişince düğme hep "koyu"ya basıyordu).
const isDarkTheme = () => { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
function applyTheme(t){
  if(t === 'dark' || t === 'light') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  try { API.setTheme(isDarkTheme()); } catch {}
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if(!document.documentElement.dataset.theme) try { API.setTheme(isDarkTheme()); } catch {} });

async function boot(){
  WS = await API.workspace.load();
  // Eski sürümler hiç seçilmemiş yazı tipini de boş ('Sistem') olarak kaydediyordu: bilerek seçilmemişse yeni varsayılan geçerli
  const pf = WS.prefs && WS.prefs.fonts; if(pf && (WS.prefs.fontsV === 2 || Object.values(pf).some(Boolean))) Object.assign(FONT, pf); applyFonts();
  applyTheme((WS.prefs && WS.prefs.theme) || null);
  if(WS.prefs && SORTS.some(([k]) => k === WS.prefs.sort)) FX.sort = WS.prefs.sort;
  if(WS.prefs && WS.prefs.usage && WS.prefs.usage.w) USAGE = WS.prefs.usage;
  S.side = !(WS.prefs && WS.prefs.side === false); // Sohbetler penceresinin kenar çubuğu varsayılan açık; kullanıcı kapatırsa öyle kalır
  S.folders = (WS.folders || []).map(f => ({open:true, ...f}));
  const list = await API.sessions.list();
  const known = WS.firstRun ? null : new Set(WS.known || []);
  S.sessions = list.map(x => { const s = fromSummary(x); s.fresh = known ? !known.has(s.id) : false; return s; });
  const all = new Set([...S.folders.map(f => f.id), ...S.sessions.map(s => s.id)]);
  S.items = (WS.items || []).filter(id => all.has(id));
  all.forEach(id => { if(!S.items.includes(id)) id[0]==='s' ? S.items.unshift(id) : S.items.push(id); });
  S.links = (WS.links || []).filter(l => all.has(l.a) && all.has(l.b));
  Object.entries(WS.graphPos || {}).forEach(([k,p]) => G.pos[k] = {x:p.x, y:p.y, vx:0, vy:0, fixed:true});
  if(S.sessions.length > 40) G.labels = false;
  const L = WS.layout;
  if(L){ S.layout = L.layout || 2; S.active = L.active || 0; S.info = L.info !== false;
    S.panes = (L.panes || []).map(p => p && sess(p) && !gone(p) ? p : null); while(S.panes.length < 4) S.panes.push(null); }
  else S.panes = [S.sessions[0] ? S.sessions[0].id : null, S.sessions[1] ? S.sessions[1].id : null, null, null];
  try { S.connectors = (await API.claude.connectors()).map(c => ({name:c.name, bg:'#75736c', letter:(c.name[0]||'?').toUpperCase(), auth:true, tools:0, source:c.source})); } catch {}
  try { DISK.splice(0, DISK.length, ...(await API.fs.listDesktop())); } catch {}
  render();
  S.panes.forEach(p => p && ensureLoaded(p));
  API.sessions.onChanged(onChanged);
  if(API.mirror){ let lastErr = 0;
    API.mirror.onStatus(st => { if(!st.ok && Date.now() - lastErr > 60000){ lastErr = Date.now(); toast(`${st.root} güncellenemedi (${(st.errors[0]||'').split(':').pop().trim()}) — birkaç saniye sonra yeniden denenecek`); } });
    if(WS.restored) toast('Klasör yapısı yedekten geri yüklendi'); }
  API.run.onEvent(onRun);
  API.search.onProgress(p => { SR.idx = {...(SR.idx||{}), building: p.done < p.total, progress:p, docs: p.done === p.total ? (SR.idx && SR.idx.docs) || S.sessions.length : (SR.idx||{}).docs}; if(SR.open) { backendSearch(); renderSearch(); } });
  API.search.query('').then(r => SR.idx = r).catch(() => {});
  checkAuth();
  API.claude.control().then(c => { CTRL = c || CTRL; renderPanes(); }).catch(() => {});
  setInterval(() => { S.sessions.forEach(s => s.ago = fmtAgo(s.lastTs)); renderRail(); if(S.org && FX.cwd !== GRAPH) renderBoard(); }, 60000);
}


/* ---------- Faz 2: panelden Claude çalıştırma ---------- */
const RUNS = new Map(); // runId -> session id
const PMODES = [['acceptEdits','Dosya düzenlemeye izin'],['bypassPermissions','Tam yetki'],['auto','Otomatik (sınıflandırıcı)'],['plan','Plan modu (değişiklik yok)'],['manual','İzin gerekenleri reddet']];
const MODELS = [[null,'Oturumun modeli'],['opus','Opus'],['sonnet','Sonnet'],['haiku','Haiku']];
// Düşünme seviyesi (claude --effort). Seçim oturumda saklanır; son seçim yalnızca yeni sohbetlere varsayılan olur
// (seçimi olmayan mevcut oturumlar Claude Code'un kendi varsayılanıyla çalışır).
const EFFORTS = [[null,'Varsayılan','Claude Code ayarındaki seviye'],['low','Düşük','Hızlı, az düşünür'],['medium','Orta',''],['high','Yüksek',''],['xhigh','Çok yüksek',''],['max','En yüksek','En yavaş, en derin']];
const effortOf = s => s.effort !== undefined ? s.effort : s.draft ? ((WS.prefs && WS.prefs.effort) || null) : null;
const effortLabel = s => { const k = effortOf(s); return k ? (EFFORTS.find(e => e[0]===k) || [0,k])[1] : 'Düşünme'; }; // dar bölmeye sığsın: seçiliyse yalnızca seviye
// Bilgisayar kontrolü (tarayıcı: Claude in Chrome, masaüstü: agent-desktop). Oturumda saklanır; son seçim yeni sohbetlere varsayılan olur.
let CTRL = {desktop:null};
// Bilgisayar ve tarayıcı kontrolü varsayılan açık; sohbette kapatılırsa o sohbette kapalı kalır, son seçim yeni sohbetlere geçer
const controlOf = s => s.control !== undefined ? !!s.control : s.draft ? !(WS.prefs && WS.prefs.control === false) : true;
const controlTip = s => controlOf(s)
  ? `Bilgisayar kontrolü açık: tarayıcı (Chrome'daki Claude eklentisi)${CTRL.desktop ? ' ve masaüstü uygulamaları (agent-desktop)' : '. Masaüstü için agent-desktop kurulu değil: npm install -g agent-desktop'}`
  : 'Bilgisayar kontrolü kapalı — açınca Claude tarayıcıyı ve masaüstü uygulamalarını kullanabilir';
function setControl(s, on){
  s.control = on; WS.prefs = {...(WS.prefs||{}), control:on}; renderPanes(); persist(); focusTa(s.id);
  if(!on) return toast('Bilgisayar kontrolü kapalı');
  toast(CTRL.desktop ? 'Bilgisayar kontrolü açık: tarayıcı + masaüstü (sonraki mesajdan itibaren)' : 'Tarayıcı kontrolü açık (Chrome\'daki Claude eklentisiyle)');
  if(CTRL.desktop && CTRL.access && CTRL.access !== 'granted') toast('Masaüstü için izin gerekli: Sistem Ayarları → Gizlilik ve Güvenlik → Erişilebilirlik → Claude Panel\'i aç');
}
async function installDesktop(s){
  toast('agent-desktop kuruluyor… (npm, bir dakika sürebilir)');
  try { CTRL = await API.claude.installDesktop(); }
  catch(e){ toast(String(e && e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')); return setControl(s, true); }
  toast(CTRL.desktop ? 'agent-desktop kuruldu' : 'agent-desktop kuruldu ama bulunamadı — paneli yeniden başlatmayı dene');
  setControl(s, true);
}
// Menüden seçim yapınca odak, o oturumun açık olduğu bölmenin yazma kutusuna döner
function focusTa(id){ const i = S.panes.slice(0, nPanes()).indexOf(id); if(i < 0) return; const ta = document.querySelector(`[data-ta="${i}"]`); if(ta && !ta.disabled) ta.focus(); }
// Varsayılan: her oturum tam yetkiyle (bypassPermissions) çalışır; bölmedeki izin menüsünden oturum bazında değiştirilebilir
const DEFAULT_PMODE = 'bypassPermissions';
const pmodeOf = s => s.pmode || DEFAULT_PMODE;
const pmodeLabel = s => (PMODES.find(p => p[0]===pmodeOf(s)) || PMODES[0])[1];
const modelLabel = s => s.modelPick ? (MODELS.find(m => m[0]===s.modelPick) || [0,s.modelPick])[1] : s.model;
// Claude uygulamasının tur araçları (sessions.js turnCard ile aynı): wrap_up → sonraki adım kartı, update_plan → görev listesi
function turnCard(name, input){
  if(!input || typeof name !== 'string') return null;
  const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
  if(/(^|__)wrap_up$/.test(name)) return {card:{recap:str(input.recap, 1200), ask:str(input.ask, 300), actions:Array.isArray(input.actions) ? input.actions.map(a => str(a && a.label, 40)).filter(Boolean).slice(0, 3) : []}};
  if(/(^|__)update_plan$/.test(name)) return {plan: Array.isArray(input.items) ? input.items.slice(0, 12).map(i => ({c:str(i && i.content, 120), s:['completed','in_progress'].includes(i && i.status) ? i.status : 'pending'})) : null};
  return null;
}
const toolSum = i => { if(!i) return ''; const v = i.command || i.file_path || i.path || i.pattern || i.url || i.query || i.description || i.prompt || i.skill || ''; return String(v).replace(/\s+/g,' ').slice(0,300); };
const resText = c => typeof c === 'string' ? c : Array.isArray(c) ? c.map(x => x.type==='text' ? x.text : x.type==='image' ? '[görsel]' : '').join('\n') : '';
const prettyModelR = id => { const m = /claude-([a-z]+)-(\d+)(?:-(\d+))?/.exec(id||''); return m ? m[1][0].toUpperCase()+m[1].slice(1)+' '+m[2]+(m[3] && m[3].length<3 ? '.'+m[3] : '') : (id||''); };

async function checkAuth(){
  try { S.auth = await API.claude.auth(); } catch(e){ S.auth = {installed:false, loggedIn:false, err:String(e)}; }
  renderPanes(); return S.auth;
}
function authBanner(){
  const a = S.auth; if(!a || a.loggedIn) return '';
  if(!a.installed) return `<div class="authbar">${ic('term')}<span><b>Claude Code CLI bulunamadı.</b> Panelden mesaj göndermek için <span class="mono">claude</span> komutu kurulu olmalı.</span></div>`;
  return `<div class="authbar">${ic('shield')}<span><b>Claude Code girişi gerekli.</b> Panel, bilgisayardaki <span class="mono">claude</span> komutunu kullanır; girişi sona ermiş.</span><button class="btn pri" data-login>Giriş yap</button><button class="btn" data-authcheck>Tekrar kontrol et</button></div>`;
}

async function send(i, opt = {}){
  const s = sess(S.panes[i]); const ta = document.querySelector(`[data-ta="${i}"]`);
  if(!s || !ta) return;
  const text = ta.value.trim(); const att = s.attach || []; if(!text && !att.length) return;
  if(!S.auth || !S.auth.loggedIn){ await checkAuth(); if(!S.auth.loggedIn){ toast('Önce Claude Code girişi yapılmalı'); return; } }
  if(s.run){ // çalışırken yazılan mesaj sıraya girer; tur bitince sırayla gönderilir
    (s.queue = s.queue || []).push({text, att}); s.queuePaused = false;
    ta.value = ''; autosize(ta); s.inputDraft = ''; s.attach = []; updateGhost(ta);
    toast(`Sıraya eklendi · ${s.queue.length}. sırada`); renderPanes(); return;
  }
  if(s.status==='elsewhere' && !opt.force && !opt.fork){ s.askFork = true; renderPanes(); return; }
  s.askFork = false;
  ta.value = ''; ta.style.height = 'auto'; s.inputDraft = ''; s.attach = []; updateGhost(ta);
  if(!(await sendNow(s, text, att, opt))){
    const ta2 = document.querySelector(`[data-ta="${S.panes.indexOf(s.id)}"]`);
    if(ta2 && !ta2.value.trim()){ ta2.value = text; autosize(ta2); } s.inputDraft = text; s.attach = [...att, ...(s.attach || [])]; renderPanes();
  }
}
// Sıradaki mesajı gönder (tur başarıyla bittiyse); hata/durdurmada sıra duraklar
async function runQueue(s){
  if(!s || s.run || s.queuePaused || !s.queue || !s.queue.length) return;
  const q = s.queue.shift();
  if(!(await sendNow(s, q.text, q.att, {force:true}))){ s.queue.unshift(q); s.queuePaused = true; renderPanes(); }
}
function queueCard(s){
  if(!s.queue || !s.queue.length) return '';
  return `<div class="queue"><div class="q-head">${ic('clock')}<b>Sırada ${s.queue.length} mesaj</b><span>${s.queuePaused ? 'duraklatıldı' : s.run ? 'bu tur bitince gönderilecek' : 'gönderiliyor'}</span><span class="grow"></span>${s.queuePaused ? `<button class="btn" data-qresume="${s.id}">Devam et</button>` : ''}<button class="btn" data-qclear="${s.id}">Sırayı temizle</button></div>
    ${s.queue.map((q, k) => `<div class="q-row"><span class="q-k">${k+1}</span><span class="q-txt">${esc((q.text || '').slice(0, 200) || (q.att || []).map(a => a.name).join(', '))}</span><button class="ibtn" data-qdel="${k}" data-sid="${s.id}" title="Sıradan çıkar">${ic('x')}</button></div>`).join('')}</div>`;
}
function forkCard(s, i){
  if(!s.askFork || s.run) return '';
  return `<div class="perm fork-card"><div class="perm-h">${ic('cols')}<b>Bu sohbet şu an başka yerde de açık</b></div>
    <div class="perm-d">Claude uygulamasında ya da bir terminalde bu sohbete yazılıyor. İkisi aynı anda yazarsa kayıtlar karışabilir; mesajın nereye gitsin?</div>
    <div class="perm-acts"><button class="btn pri" data-fsend="fork" data-i="${i}">${ic('cols')}Kopyasında devam et <span class="sub">önerilen · yeni sohbet</span></button>
      <button class="btn" data-fsend="force" data-i="${i}">${ic('up')}Yine de bu sohbete gönder</button><span class="grow"></span><button class="btn" data-forkx="${s.id}">Vazgeç</button></div></div>`;
}
async function sendNow(s, text, att, opt = {}){
  const isNew = !!s.draft;
  if(isNew && s.effort === undefined) s.effort = effortOf(s); // yeni sohbet varsayılanları oturuma yazılır
  if(isNew && s.control === undefined) s.control = controlOf(s);
  const userMsg = {r:'u', t:text + (att.length ? (text ? '\n' : '') + att.map(a => '📎 ' + a.name).join('  ') : ''), ts:new Date().toISOString(), local:true};
  s.msgs.push(userMsg);
  const images = att.filter(a => a.isImage).map(a => ({media_type:a.media_type, data:a.data}));
  const files = att.filter(a => !a.isImage && a.path).map(a => a.path);
  s.attach = [];
  const live = {r:'a', b:[], streaming:true, draft:'', local:true}; s.msgs.push(live);
  const runId = crypto.randomUUID();
  s.run = {runId, live, tools:new Map(), fork:!!opt.fork, prevStatus:s.status, startedAt:Date.now()};
  s.status = 'running'; s.ago = 'şimdi'; s.lastTs = new Date().toISOString(); s.fresh = false;
  RUNS.set(runId, s.id);
  render(); { const pi = S.panes.indexOf(s.id); if(pi >= 0) scrollPaneBottom(pi); }
  try {
    await API.run.start({runId, sessionId:s.uuid, newSession:isNew, fork:!!opt.fork, cwd:s.cwd || s.project, text, images, files, model:s.modelPick || (isNew ? s.newModel : null), permissionMode:pmodeOf(s), effort:effortOf(s), control:controlOf(s)});
    s.draft = false; return true;
  } catch(e){
    RUNS.delete(runId); s.run = null; s.status = 'idle'; live.streaming = false;
    // Gönderilemedi: mesaj listeden çıkar; çağıran metni ve ekleri yazma kutusuna (ya da sıraya) geri koyar
    s.msgs = s.msgs.filter(m => m !== userMsg);
    live.b.push({t:'text', v:`<p class="run-err">Gönderilemedi: ${esc(String(e && e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))}<br>Mesajın ve eklerin geri kondu.</p>`});
    render(); return false;
  }
}

// Akış sırasında yalnızca ilgili bölmenin mesaj alanını yeniden çiz (tüm arayüzü değil)
const liveQ = new Set(); let liveRaf = 0;
function scheduleLive(s){ liveQ.add(s.id); if(!liveRaf) liveRaf = requestAnimationFrame(() => { liveRaf = 0; liveQ.forEach(paintLive); liveQ.clear(); }); }
function paintLive(id){
  const s = sess(id); if(!s) return;
  S.panes.forEach((p, i) => { if(p !== id) return;
    const el = document.querySelector(`[data-pane="${i}"] .msgs`); if(!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if(patchMsgs(el.querySelector('.msgs-in'), msgParts(s))) hydrateMedia(el);
    if(atBottom) el.scrollTop = el.scrollHeight; });
  if(QL === id) quickLook(id);
}

function forkTo(s, newUuid){
  // --fork-session: Claude yeni bir oturum kimliği verdi → bölmede yeni oturuma geç, eskisini olduğu gibi bırak
  const R = s.run; const nid = sid(newUuid);
  const userMsg = s.msgs[s.msgs.length - 2];
  s.msgs.splice(-2, 2); s.run = null; s.status = R.prevStatus || 'idle';
  const n = {...s, localUntil:Date.now() + 10*60*1000, id:nid, uuid:newUuid, title:s.title + ' (çatal)', rawTitle:s.rawTitle || s.title, msgs:[...s.msgs, userMsg, R.live], run:R, status:'running', pinned:false, trashed:false, fresh:false, loaded:true};
  S.sessions.unshift(n); S.items.unshift(nid);
  S.panes = S.panes.map(p => p === s.id ? nid : p);
  RUNS.set(R.runId, nid);
  render(); toast('Çatallandı: yeni oturumda devam ediliyor');
  return n;
}

/* ---------- Kalan kullanım ----------
   claude CLI her turda bir rate_limit_event gönderir: kullanım penceresi başına (5 saatlik, haftalık…) kullanılan oran ve
   sıfırlanma zamanı. Son bilinen değer workspace'te saklanır; gösterge her yanıttan sonra güncellenir. */
let USAGE = null; // {w:{pencere:{u, resetsAt, at}}, status, type, resetsAt, at}
const USAGE_NAMES = {five_hour:['5 saatlik', '5 sa'], seven_day:['Haftalık', 'Hafta'], seven_day_opus:['Haftalık · Opus', 'Opus'], seven_day_sonnet:['Haftalık · Sonnet', 'Sonnet']};
const uName = (k, short) => (USAGE_NAMES[k] || [k.replace(/_/g, ' '), k.replace(/_/g, ' ')])[short ? 1 : 0];
function onRateLimit(i){
  if(!i || typeof i !== 'object') return;
  const now = Date.now(), w = {...(USAGE && USAGE.w || {})};
  for(const [k, v] of Object.entries(i.unifiedWindows || {})) if(v && typeof v.utilization === 'number') w[k] = {u: v.utilization, resetsAt: v.resetsAt || null, at: now};
  if(i.rateLimitType && typeof i.utilization === 'number') w[i.rateLimitType] = {u: i.utilization, resetsAt: i.resetsAt || null, at: now};
  USAGE = {w, status: i.status || null, type: i.rateLimitType || null, resetsAt: i.resetsAt || null, at: now};
  const hist = usageMath.record((WS.prefs && WS.prefs.usageHist) || [], USAGE, now);
  WS.prefs = {...(WS.prefs||{}), usage: USAGE, usageHist: hist}; persist(); renderPanes();
}
// Pencereler: sıfırlanma zamanı geçmiş olan sıfırlanmış sayılır
function usageWins(){
  if(!USAGE) return [];
  const now = Date.now(), order = ['five_hour', 'seven_day', 'seven_day_opus', 'seven_day_sonnet'];
  return Object.entries(USAGE.w || {}).map(([k, v]) => { const reset = v.resetsAt && v.resetsAt * 1000 <= now;
    return {k, u: reset ? 0 : Math.max(0, Math.min(1, v.u)), resetsAt: reset ? null : v.resetsAt, reset}; })
    .sort((a, b) => (order.indexOf(a.k) + 1 || 99) - (order.indexOf(b.k) + 1 || 99));
}
const blocked = () => USAGE && USAGE.status === 'rejected' && USAGE.resetsAt && USAGE.resetsAt * 1000 > Date.now();
function fmtReset(sec){
  if(!sec) return '';
  const d = new Date(sec * 1000), ms = d - Date.now(), h = Math.floor(ms / 36e5), mm = Math.max(0, Math.round(ms % 36e5 / 6e4));
  const when = d.toLocaleString('tr-TR', {weekday: ms > 20 * 36e5 ? 'short' : undefined, hour: '2-digit', minute: '2-digit'});
  return `${when} (${h >= 24 ? Math.floor(h / 24) + ' gün ' + (h % 24) + ' sa' : h ? h + ' sa ' + mm + ' dk' : mm + ' dk'} sonra)`;
}
function usagePill(){
  const ws = usageWins();
  if(!ws.length) return `<button class="pill use" data-usage title="Kalan kullanım ilk yanıttan sonra görünür">${ic('gauge')}<span>Kullanım</span></button>`;
  const top = ws.reduce((a, b) => b.u > a.u ? b : a), pct = Math.round(top.u * 100), left = 100 - pct;
  const lvl = blocked() || pct >= 90 ? 'hot' : pct >= 75 ? 'warm' : '';
  const tip = ws.map(x => `${uName(x.k)}: %${Math.round(x.u * 100)} kullanıldı${x.resetsAt ? ' · sıfırlanma ' + fmtReset(x.resetsAt) : ''}`).join('\n');
  return `<button class="pill use ${lvl}" data-usage title="${esc(tip)}"><span class="ubar"><i style="width:${pct}%"></i></span><span>${blocked() ? 'Limit doldu' : `${uName(top.k, true)} · %${left} kaldı`}</span></button>`;
}
// Pencerenin başından bu yana kullanım çizgisi + "bu hızla ne zaman biter" tahmini
function usageTrend(w){
  const hist = (WS.prefs && WS.prefs.usageHist) || [], now = Date.now();
  if(w.reset) return '';
  const pts = usageMath.spark(hist, w.k, now, w.resetsAt, 240, 34);
  const f = usageMath.forecast(hist, w.k, now, w.resetsAt);
  const tip = !f ? 'Tahmin için biraz daha kullanım verisi gerekiyor' : !f.eta ? 'Son saatlerde artış yok' :
    f.beforeReset ? `Bu hızla ${new Date(f.eta).toLocaleString('tr-TR', {weekday:'long', hour:'2-digit', minute:'2-digit'})} civarı biter` : 'Bu hızla sıfırlanmadan önce bitmez';
  return `${pts.includes(' ') ? `<svg class="use-spark" viewBox="0 0 240 34" preserveAspectRatio="none"><line x1="0" y1="0.5" x2="240" y2="0.5"/><polyline points="${pts}"/></svg>` : ''}
    <div class="use-s use-f ${f && f.beforeReset && f.eta ? 'warn' : ''}">${esc(tip)}</div>`;
}
function usageMenu(x, y){
  const ws = usageWins();
  const ago = USAGE ? Math.round((Date.now() - USAGE.at) / 6e4) : 0;
  menu(x, y, `<div class="mh">Kalan kullanım</div>${ws.length ? ws.map(w => { const pct = Math.round(w.u * 100), lvl = pct >= 90 ? 'hot' : pct >= 75 ? 'warm' : '';
    return `<div class="use-row ${lvl}"><div class="use-t"><b>${uName(w.k)}</b><span>%${100 - pct} kaldı</span></div><span class="ubar big"><i style="width:${pct}%"></i></span>
      <div class="use-s">%${pct} kullanıldı${w.reset ? ' · sıfırlandı' : w.resetsAt ? ' · sıfırlanma ' + esc(fmtReset(w.resetsAt)) : ''}</div>${usageTrend(w)}</div>`; }).join('')
    : '<div class="use-s" style="padding:4px 9px 8px">Henüz bilgi yok: ilk yanıttan sonra Claude Code kalan kullanımı bildirir.</div>'}
    ${blocked() ? `<div class="use-s" style="padding:2px 9px;color:#c0392b">Limit doldu · ${esc(fmtReset(USAGE.resetsAt))} açılır</div>` : ''}
    ${USAGE ? `<div class="use-s" style="padding:6px 9px 4px;border-top:1px solid var(--line);margin-top:4px">Son güncelleme: ${ago < 1 ? 'az önce' : ago < 60 ? ago + ' dk önce' : Math.round(ago / 60) + ' sa önce'} · her yanıttan sonra yenilenir</div>` : ''}`);
}

function onRun(p){
  const id = RUNS.get(p.runId); let s = id && sess(id);
  if(!s || !s.run) return;
  const R = s.run, L = R.live;
  if(p.type === 'event'){
    const ev = p.ev;
    if(ev.type === 'system' && ev.subtype === 'init'){
      if(R.fork && ev.session_id && ev.session_id !== s.uuid) s = forkTo(s, ev.session_id);
      s.connectorsLive = ev.mcp_servers || []; if(ev.model) s.model = prettyModelR(ev.model);
      if(S.panes[S.active] === s.id) renderInfo();
      return;
    }
    if(ev.type === 'rate_limit_event'){ onRateLimit(ev.rate_limit_info); return; }
    if(ev.parent_tool_use_id) return; // alt ajan mesajları
    if(ev.type === 'stream_event' && ev.event){
      const e = ev.event;
      if(e.type === 'content_block_start' && e.content_block && e.content_block.type === 'text') L.draft = '';
      if(e.type === 'content_block_delta' && e.delta && e.delta.type === 'text_delta'){ L.draft += e.delta.text; scheduleLive(s); }
      return;
    }
    if(ev.type === 'assistant' && ev.message){
      for(const c of ev.message.content || []){
        if(c.type === 'text' && c.text && c.text.trim()){ L.b.push({t:'text', v:md(c.text)}); L.draft = ''; }
        else if(c.type === 'tool_use'){ const tool = {t:'tool', n:shortTool(c.name), a:toolSum(c.input), o:'', running:true, ...(turnCard(c.name, c.input) || {})}; const dd = diffView.data(c.name, c.input); if(dd) tool.d = dd; L.b.push(tool); R.tools.set(c.id, tool);
          const fp = c.input && (c.input.file_path || c.input.notebook_path); if(fp && /^(Write|Edit|MultiEdit|NotebookEdit)$/.test(c.name) && !s.outputs.includes(fp)) s.outputs.unshift(fp); }
      }
      const u = ev.message.usage; if(u && ev.message.model !== '<synthetic>') s.ctx = ((u.input_tokens||0) + (u.cache_read_input_tokens||0) + (u.cache_creation_input_tokens||0) + (u.output_tokens||0)) / 1000;
      scheduleLive(s); return;
    }
    if(ev.type === 'user' && ev.message && Array.isArray(ev.message.content)){
      for(const c of ev.message.content) if(c.type === 'tool_result'){ const t = R.tools.get(c.tool_use_id); if(t){ t.o = resText(c.content).slice(0,1500); t.running = false; if(c.is_error) t.err = true; const im = liveImgs(c.content); if(im.length) t.imgs = im; } }
      scheduleLive(s); return;
    }
    if(ev.type === 'result'){ R.result = ev; return; }
    return;
  }
  if(p.type === 'permission' || p.type === 'permission-cancel') return onPermission(p);
  if(p.type === 'exit') finishRun(s, p);
}

function finishRun(s, p){
  const R = s.run, L = R.live, res = R.result;
  L.streaming = false; if(L.draft){ L.b.push({t:'text', v:md(L.draft)}); L.draft = ''; }
  R.tools.forEach(t => t.running = false);
  const resultText = res && typeof res.result === 'string' ? res.result : '';
  const authFail = /authenticat|OAuth|log ?in|\/login/i.test(resultText + ' ' + (p.stderr || '') + ' ' + L.b.map(b => b.v||'').join(' ')) && (!res || res.is_error || res.terminal_reason === 'api_error');
  if(p.stopped) L.b.push({t:'text', v:'<p class="run-note">⏹ Durduruldu</p>'});
  else if(p.error || (p.code && !res)) L.b.push({t:'text', v:`<p class="run-err">Claude süreci hata verdi${p.code ? ' (çıkış '+p.code+')' : ''}. ${esc((p.error || p.stderr || '').slice(-600))}</p>`});
  else if(res && res.is_error) L.b.push({t:'text', v:`<p class="run-err">${esc(resultText || res.subtype || 'Hata')}</p>`});
  if(authFail){ S.auth = {...(S.auth||{}), loggedIn:false, installed:true}; }
  s.run = null; s.status = 'idle'; s.ownAt = Date.now(); RUNS.delete(R.runId);
  const secs = Math.round((Date.now() - R.startedAt) / 1000);
  const cost = res && res.total_cost_usd ? ` · $${res.total_cost_usd.toFixed(4)}` : '';
  const pane = S.panes.indexOf(s.id);
  if(!p.stopped && !authFail) toast(`${pane >= 0 ? 'Bölme ' + (pane+1) + ' · ' : ''}${s.title.slice(0,40)} tamamlandı (${secs} sn${cost})`);
  const failed = p.stopped || p.error || (p.code && !res) || (res && res.is_error) || authFail;
  const more = s.queue && s.queue.length && !s.queuePaused;
  if(more && failed){ s.queuePaused = true; toast('Tur yarıda kaldı: sıradaki mesajlar duraklatıldı'); }
  else if(more){ setTimeout(() => runQueue(s), 900); }
  MEDIA_DIRS.delete(s.cwd || s.project);
  if(!p.stopped && !(more && !failed) && !seenNow(s)){ s.unseen = true; notify(s, res && res.is_error || p.error ? 'Claude Panel · hata' : 'Claude Panel · tamamlandı', `${s.title}${res && res.is_error ? ' — hata verdi' : ''}`); }
  render();
  // Claude'un yazdığı .jsonl'den kanonik görünümü yeniden yükle (kısa gecikme: dosya yazımı bitsin)
  if(!authFail) setTimeout(() => ensureLoaded(s.id, true), 600);
}

function stopRun(i){ const s = sess(S.panes[i]); if(s && s.run){ API.run.stop(s.run.runId); toast('Durduruluyor…'); } }


/* ---------- Faz 3: araç izin onayları, sorular, plan onayı ---------- */
const TOOL_TR = {Bash:'Komut çalıştırmak', Edit:'Dosya düzenlemek', MultiEdit:'Dosya düzenlemek', Write:'Dosya yazmak', NotebookEdit:'Notebook düzenlemek', WebFetch:'Web sayfası okumak', WebSearch:'Web\'de aramak', Read:'Dosya okumak', Glob:'Dosya aramak', Grep:'Dosyalarda aramak', Task:'Alt ajan başlatmak', Agent:'Alt ajan başlatmak'};
function permPreview(req){
  const n = req.tool_name, i = req.input || {};
  const pre = t => `<pre class="perm-pre">${esc(String(t).slice(0, 4000))}</pre>`;
  if(n === 'Bash') return pre(i.command || '');
  if(n === 'Edit' || n === 'MultiEdit'){
    const edits = i.edits || [{old_string:i.old_string, new_string:i.new_string}];
    return `<div class="perm-file mono">${esc(i.file_path || '')}</div>` + edits.slice(0,3).map(e => `<div class="diff">${String(e.old_string||'').split('\n').slice(0,12).map(l => `<div class="dl-del">- ${esc(l)}</div>`).join('')}${String(e.new_string||'').split('\n').slice(0,12).map(l => `<div class="dl-add">+ ${esc(l)}</div>`).join('')}</div>`).join('');
  }
  if(n === 'Write') return `<div class="perm-file mono">${esc(i.file_path || '')}</div>` + pre(String(i.content || '').split('\n').slice(0, 14).join('\n'));
  if(n === 'WebFetch') return `<div class="perm-file mono">${esc(i.url || '')}</div>`;
  const j = JSON.stringify(i, null, 2); return pre(j.length > 1500 ? j.slice(0,1500) + '…' : j);
}
function permCard(s){
  const R = s.run; if(!R || !R.pendings || !R.pendings.length) return '';
  const {requestId, req} = R.pendings[0]; const more = R.pendings.length - 1;
  const i = req.input || {};
  if(req.tool_name === 'AskUserQuestion' && Array.isArray(i.questions)){
    R.answers = R.answers || {};
    return `<div class="perm ask"><div class="perm-h">${ic('msg')}<b>Claude soruyor</b>${more?`<span class="perm-more">+${more} istek</span>`:''}</div>
      ${i.questions.map((q, qi) => `<div class="q"><div class="q-t">${esc(q.question)}</div><div class="q-opts">${(q.options||[]).map(o => { const on = (R.answers[q.question]||[]).includes(o.label);
        return `<button class="q-o ${on?'on':''}" data-qa="${qi}" data-label="${esc(o.label)}" data-multi="${q.multiSelect?1:''}" title="${esc(o.description||'')}">${esc(o.label)}</button>`; }).join('')}</div>
        <input class="inp q-free" data-qfree="${qi}" placeholder="veya kendi cevabın" value="${esc((R.free||{})[qi]||'')}"></div>`).join('')}
      <div class="perm-acts"><button class="btn pri" data-perm="answer">Cevapla</button><button class="btn" data-perm="deny">Geç</button></div></div>`;
  }
  if(req.tool_name === 'ExitPlanMode'){
    return `<div class="perm plan"><div class="perm-h">${ic('note')}<b>Plan onayı</b>${more?`<span class="perm-more">+${more} istek</span>`:''}</div>
      <div class="perm-plan a">${md(i.plan || '')}</div>
      <input class="inp" data-permmsg placeholder="Reddedersen Claude'a not (isteğe bağlı)">
      <div class="perm-acts"><button class="btn pri" data-perm="allow">Planı onayla, uygula</button><button class="btn" data-perm="deny">Reddet</button></div></div>`;
  }
  const what = TOOL_TR[req.tool_name] || (req.display_name || shortTool(req.tool_name)) + ' kullanmak';
  const canAlways = (req.permission_suggestions || []).some(p => p.type === 'addRules');
  return `<div class="perm"><div class="perm-h">${ic('shield')}<b>${esc(what)} için izin istiyor</b><span class="perm-tool mono">${esc(shortTool(req.tool_name))}</span>${more?`<span class="perm-more">+${more} istek</span>`:''}</div>
    ${req.description || i.description ? `<div class="perm-d">${esc(req.description || i.description)}</div>` : ''}
    ${req.decision_reason ? `<div class="perm-d" style="color:var(--faint)">${esc(typeof req.decision_reason === 'string' ? req.decision_reason : JSON.stringify(req.decision_reason))}</div>` : ''}
    ${permPreview(req)}
    <input class="inp" data-permmsg placeholder="Reddedersen Claude'a ne yapmasını söyleyeyim? (isteğe bağlı)">
    <div class="perm-acts"><button class="btn pri" data-perm="allow">İzin ver <span class="kbd">⌘↵</span></button>${canAlways?`<button class="btn" data-perm="always" title="Bu oturum boyunca aynı türdeki isteklere sormadan izin ver">Bu oturumda hep izin ver</button>`:''}<button class="btn" data-perm="deny">Reddet</button></div></div>`;
}
function respondPerm(s, kind){
  const R = s.run; if(!R || !R.pendings || !R.pendings.length) return;
  const {requestId, req} = R.pendings.shift();
  const card = document.querySelector(`[data-pane="${S.panes.indexOf(s.id)}"] .perm`);
  const msg = card && card.querySelector('[data-permmsg]') ? card.querySelector('[data-permmsg]').value.trim() : '';
  let response;
  if(kind === 'allow') response = {behavior:'allow', updatedInput:req.input};
  else if(kind === 'always') response = {behavior:'allow', updatedInput:req.input,
    updatedPermissions:(req.permission_suggestions || []).filter(p => p.type === 'addRules').map(p => ({...p, destination:'session'}))};
  else if(kind === 'answer'){
    const answers = {};
    (req.input.questions || []).forEach((q, qi) => { const free = ((R.free||{})[qi] || '').trim(); const picked = (R.answers||{})[q.question] || [];
      answers[q.question] = free || picked.join(', '); });
    response = {behavior:'allow', updatedInput:{...req.input, answers}};
    R.answers = {}; R.free = {};
  }
  else response = {behavior:'deny', message: msg || (req.tool_name === 'AskUserQuestion' ? 'Kullanıcı soruyu cevaplamadı.' : 'Kullanıcı bu işleme izin vermedi.')};
  API.run.respond(R.runId, requestId, response);
  const label = {allow:'izin verildi', always:'bu oturumda hep izinli', answer:'cevaplandı', deny:'reddedildi'}[kind];
  (R.live.b).push({t:'text', v:`<p class="run-note">${kind==='deny'?'⛔':'✓'} ${esc(shortTool(req.tool_name))} · ${label}${kind==='deny' && msg ? ' — '+esc(msg) : ''}</p>`});
  renderPanes(); renderRail();
}
function onPermission(p){
  const id = RUNS.get(p.runId); const s = id && sess(id); if(!s || !s.run) return;
  if(p.type === 'permission-cancel'){ s.run.pendings = (s.run.pendings||[]).filter(x => x.requestId !== p.requestId); renderPanes(); renderRail(); return; }
  (s.run.pendings = s.run.pendings || []).push({requestId:p.requestId, req:p.request});
  renderPanes(); renderRail();
  const pane = S.panes.indexOf(s.id);
  toast(`${pane>=0 ? 'Bölme '+(pane+1)+': ' : ''}Claude onay bekliyor`);
  if(!seenNow(s)) notify(s, 'Claude Panel · onay bekliyor', `${s.title}: ${shortTool(p.request.tool_name)}`);
}

/* ---------- Şablonlar ve Tab ile tamamlama ----------
   Şablonlar WS.prefs.templates'te; "/ad" yazıp Tab ya da ⚡ menüsünden eklenir. Yazarken soluk öneri görünür:
   şablon, daha önce yazılmış mesaj ya da sohbette geçen bir kelime; Tab kabul eder, Esc kapatır. */
const DEFAULT_TPL = [
  {name:'Durum özeti', text:'Şu ana kadar ne yaptın, ne kaldı? Kısa bir özet ver.'},
  {name:'ChatGPT ile görsel', text:'ChatGPT (Codex) ile şu görseli üret, kontrol et ve bana göster: '},
  {name:'Premiere\'e aktar', text:'Bu klasördeki son üretilen video ve görselleri Premiere projesine aktar, sahne sırasına göre timeline\'a diz.'},
  {name:'Sesi temizle', text:'Bu klasördeki konuşma sesini Adobe Podcast ile temizle (Konuşma, Müzik, Arka Plan %0) ve temizlenen dosyayı proje klasörüne koy.'},
  {name:'Kontrol et ve doğrula', text:'Yaptıklarını baştan kontrol et, test et ve sonucu kanıtıyla söyle.'},
];
const templates = () => Array.isArray(WS.prefs && WS.prefs.templates) ? WS.prefs.templates : DEFAULT_TPL;
let GSRC = {k:'', phrases:[]}; const GWORDS = new Map();
function ghostSources(s){
  const k = S.sessions.reduce((a, x) => a + (x.msgs ? x.msgs.length : 0), 0) + ':' + templates().length;
  if(GSRC.k !== k){
    const seen = new Set(), ph = [];
    templates().forEach(t => { if(t.text && !seen.has(t.text)){ seen.add(t.text); ph.push(t.text); } });
    [...S.sessions].sort((a, b) => lastActivity(a.id) - lastActivity(b.id)).forEach(x => (x.msgs || []).slice().reverse().forEach(m => {
      if(m.r !== 'u' || !m.t) return; const t = m.t.replace(/\n?📎.*$/s, '').trim();
      if(t.length >= 4 && t.length <= 400 && !seen.has(t) && ph.length < 400){ seen.add(t); ph.push(t); } }));
    GSRC = {k, phrases:ph};
  }
  const wk = s.id + ':' + (s.msgs || []).length;
  if(!GWORDS.has(wk)){
    const texts = templates().map(t => t.text);
    (s.msgs || []).forEach(m => { if(m.r === 'u') texts.push(m.t); else (m.b || []).forEach(b => { if(b.t === 'text') texts.push(decodeEnt(b.v.replace(/<[^>]+>/g, ' '))); else texts.push(b.a || ''); }); });
    GWORDS.set(wk, complete.vocab(texts)); if(GWORDS.size > 30) GWORDS.delete(GWORDS.keys().next().value);
  }
  return {templates: templates(), phrases: GSRC.phrases, words: GWORDS.get(wk)};
}
function updateGhost(ta){
  const g = ta && ta.parentElement && ta.parentElement.querySelector('.ghost'); if(!g) return;
  const s = sess(S.panes[+ta.dataset.ta]);
  const atEnd = ta.selectionStart === ta.value.length && ta.selectionEnd === ta.value.length;
  const sug = s && atEnd && document.activeElement === ta && !ta.disabled && ta.dataset.noghost !== ta.value ? complete.suggest(ta.value, ghostSources(s)) : null;
  ta._sug = sug;
  if(!sug){ if(g.innerHTML) g.innerHTML = ''; return; }
  const cs = getComputedStyle(ta);
  g.style.font = cs.font; g.style.letterSpacing = cs.letterSpacing; g.style.padding = cs.padding;
  g.innerHTML = esc(ta.value) + `<i>${esc(sug.ghost)}</i>` + `<b class="gk">${sug.kind === 'template' ? 'Tab · şablon' : 'Tab'}</b>`;
  g.scrollTop = ta.scrollTop;
}
function acceptGhost(ta){
  const sug = ta._sug; if(!sug) return false;
  ta.value = sug.value; ta.setSelectionRange(ta.value.length, ta.value.length); autosize(ta);
  const s = sess(S.panes[+ta.dataset.ta]); if(s) s.inputDraft = ta.value;
  ta._sug = null; updateGhost(ta); return true;
}
// Sesli yazma: yazma kutusu odaklanır, işletim sisteminin dikte özelliği açılır; konuştukların kutuya yazılır
async function dictate(i){
  const ta = document.querySelector(`[data-ta="${i}"]`); if(!ta) return;
  ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  if(IS_MAC){ toast('Konuşmak için Fn (🌐) tuşuna iki kez bas · macOS dikte yazıyı bu kutuya yazar'); return; }
  const r = await API.app.dictate().catch(e => ({ok:false, error:String(e)}));
  if(r && r.ok) toast('Sesle yazma açıldı · konuş, yazı bu kutuya düşer (kapatmak için tekrar Win+H)');
  else toast('Sesle yazma açılamadı: Win+H ile dene' + (r && r.error ? ' (' + r.error.slice(0, 80) + ')' : ''));
  setTimeout(() => ta.focus(), 50);
}
function insertTemplate(i, text){
  const ta = document.querySelector(`[data-ta="${i}"]`); if(!ta) return;
  ta.value = ta.value.trim() ? ta.value.replace(/\s*$/, '\n') + text : text;
  ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); autosize(ta);
  const s = sess(S.panes[i]); if(s) s.inputDraft = ta.value; updateGhost(ta);
}
function tplMenu(i, x, y){
  const ta = document.querySelector(`[data-ta="${i}"]`), cur = ta && ta.value.trim();
  menu(x, y, `<div class="mh">Şablonlar · yazarken / ile de açılır</div>${templates().map((t, k) => `<button data-m="tplins" data-i="${i}" data-k="${k}" title="${esc(t.text)}">${ic('bolt')}<span>${esc(t.name)}</span></button>`).join('')}
    <hr>${cur ? `<button data-m="tplsave" data-i="${i}">${ic('plus')}Yazdığımı şablon yap</button>` : ''}<button data-m="tpledit">${ic('edit')}Şablonları düzenle…</button>`);
}
function saveTemplates(list){ WS.prefs = {...(WS.prefs||{}), templates: list}; GSRC.k = ''; persist(); }
function openTemplates(){
  let m = $('#tpldlg'); if(m) m.remove();
  const list = templates().map(t => ({...t}));
  m = document.createElement('div'); m.id = 'tpldlg'; m.className = 'modal-bg';
  const paint = () => { m.innerHTML = `<div class="modal" role="dialog" aria-label="Şablonlar" style="width:min(640px,100%)">
    <div class="mh2"><h3>Şablonlar</h3><button class="ibtn" data-tx="close">${ic('x')}</button></div>
    <div class="mb tpl-list">${list.map((t, k) => `<div class="tpl-row"><input class="inp" data-tn="${k}" value="${esc(t.name)}" placeholder="Ad (/ad ile çağrılır)"><textarea class="inp" data-tt="${k}" rows="2" placeholder="Metin">${esc(t.text)}</textarea><button class="ibtn" data-tdel="${k}" title="Sil">${ic('trash')}</button></div>`).join('') || '<div style="color:var(--faint)">Şablon yok.</div>'}</div>
    <div class="mf"><button class="btn" data-tx="add">${ic('plus')}Yeni şablon</button><button class="btn" data-tx="reset">Varsayılanlar</button><span class="grow"></span><button class="btn" data-tx="close">Vazgeç</button><button class="btn pri" data-tx="save">Kaydet</button></div></div>`; };
  const sync = () => m.querySelectorAll('[data-tn]').forEach(el => { const k = +el.dataset.tn; list[k].name = el.value; list[k].text = m.querySelector(`[data-tt="${k}"]`).value; });
  paint(); document.body.appendChild(m);
  m.addEventListener('click', e => {
    const d = e.target.closest('[data-tdel]'); if(d){ sync(); list.splice(+d.dataset.tdel, 1); paint(); return; }
    const x = e.target.closest('[data-tx]'); const k = x ? x.dataset.tx : e.target === m ? 'close' : null; if(!k) return;
    if(k === 'add'){ sync(); list.push({name:'', text:''}); paint(); m.querySelector(`[data-tn="${list.length-1}"]`).focus(); }
    if(k === 'reset'){ list.splice(0, list.length, ...DEFAULT_TPL.map(t => ({...t}))); paint(); }
    if(k === 'save'){ sync(); saveTemplates(list.filter(t => t.name.trim() && t.text.trim()).map(t => ({name:t.name.trim(), text:t.text}))); m.remove(); toast('Şablonlar kaydedildi'); }
    if(k === 'close') m.remove();
  });
}
document.addEventListener('focusout', e => { if(e.target.matches && e.target.matches('[data-ta]')){ e.target._sug = null; const g = e.target.parentElement.querySelector('.ghost'); if(g) g.innerHTML = ''; } });
document.addEventListener('focusin', e => { if(e.target.matches && e.target.matches('[data-ta]')) updateGhost(e.target); });
document.addEventListener('keyup', e => { if(e.target.matches && e.target.matches('[data-ta]') && /^(Arrow|Home|End|PageUp|PageDown)/.test(e.key)) updateGhost(e.target); });
document.addEventListener('scroll', e => { if(e.target.matches && e.target.matches('[data-ta]')){ const g = e.target.parentElement.querySelector('.ghost'); if(g) g.scrollTop = e.target.scrollTop; } }, true);
document.addEventListener('keydown', e => { if(e.key === 'Escape' && $('#tpldlg')){ $('#tpldlg').remove(); e.stopPropagation(); } }, true);

/* ---------- Dikkat isteyenler: bildirim + görev çubuğu sayacı ----------
   Pencere arkadayken ya da sohbet görünür bir bölmede değilken biten (görülmemiş) ve onay bekleyen sohbetler sayılır.
   Bildirime tıklayınca pencere öne gelir ve sohbet açılır; sohbet görülünce sayaçtan düşer. */
const seenNow = s => document.hasFocus() && !S.org && S.panes.slice(0, nPanes()).includes(s.id);
const waiting = s => !!(s.run && s.run.pendings && s.run.pendings.length);
const attentionCount = () => S.sessions.filter(s => !gone(s.id) && (s.unseen || waiting(s))).length;
function notify(s, title, body){
  if(!('Notification' in window)) return;
  try { const n = new Notification(title, {body}); n.onclick = () => { try { API.app.focus(); } catch {} setOrg(false); openIn(s.id); }; } catch {}
}
function badgeIcon(n){
  const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d');
  x.fillStyle = '#c0392b'; x.beginPath(); x.arc(16, 16, 15, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#fff'; x.font = `bold ${n > 9 ? 15 : 19}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(n > 9 ? '9+' : String(n), 16, 17);
  return c.toDataURL('image/png');
}
let lastBadge = 0;
function paintBadge(){
  // Görülen sohbetler sayaçtan düşer
  if(document.hasFocus() && !S.org) S.panes.slice(0, nPanes()).forEach(id => { const s = sess(id); if(s && s.unseen) s.unseen = false; });
  const n = attentionCount(); if(n === lastBadge) return;
  const up = n > lastBadge; lastBadge = n;
  try { API.app.badge(n, n ? badgeIcon(n) : null, up); } catch {}
}
window.addEventListener('focus', () => { paintBadge(); renderRail(); if(S.org) renderBoard(); });

/* ---------- Faz 3: dosya / görsel ekleme ---------- */
function attachChips(s){
  const a = s.attach || []; if(!a.length) return '';
  return `<div class="att">${a.map((x, k) => `<span class="att-c" title="${esc(x.path || x.name)}">${x.isImage ? `<img src="data:${x.media_type};base64,${x.data}" alt="">` : ic(MEDIA_VID.test(x.name) ? 'video' : MEDIA_AUD.test(x.name) ? 'music' : 'file')}<span>${esc(x.name)}</span><button data-unattach="${k}" data-sid="${s.id}">${ic('x')}</button></span>`).join('')}</div>`;
}
function addAttachments(s, items){
  if(!s || !items || !items.length) return;
  s.attach = s.attach || [];
  let dropped = 0;
  for(const it of items){ if(s.attach.some(a => a.path && a.path === it.path)) continue; if(s.attach.length >= 10){ dropped++; continue; } s.attach.push(it); }
  if(dropped) toast(`En fazla 10 ek eklenebilir — ${dropped} dosya eklenmedi`);
  const big = items.filter(i => !i.isImage && /\.(png|jpe?g|gif|webp)$/i.test(i.name));
  if(big.length) toast('5 MB üstü görseller dosya yolu olarak eklendi');
  renderPanes();
}
async function pickAttachments(i){ const s = sess(S.panes[i]); if(!s) return; addAttachments(s, await API.fs.pickFiles(s.cwd || s.project)); }
document.addEventListener('dragover', e => { const c = e.target.closest && e.target.closest('.comp'); if(c && e.dataTransfer && [...e.dataTransfer.types].includes('Files')){ e.preventDefault(); c.classList.add('dropfile'); } });
document.addEventListener('dragleave', e => { const c = e.target.closest && e.target.closest('.comp'); if(c) c.classList.remove('dropfile'); });
document.addEventListener('drop', async e => {
  const c = e.target.closest && e.target.closest('.comp'); if(!c || !e.dataTransfer || !e.dataTransfer.files.length) return;
  e.preventDefault(); c.classList.remove('dropfile');
  const i = +c.closest('.pane').dataset.pane; const s = sess(S.panes[i]);
  const paths = [...e.dataTransfer.files].map(f => API.fs.pathForFile(f)).filter(Boolean);
  addAttachments(s, await API.fs.describeFiles(paths));
});
document.addEventListener('paste', e => {
  const ta = e.target.closest && e.target.closest('[data-ta]'); if(!ta || !e.clipboardData) return;
  const all = [...e.clipboardData.items].filter(it => it.kind === 'file' && /^image\//.test(it.type));
  if(!all.length) return;
  e.preventDefault();
  // Claude yalnızca PNG, JPEG, GIF ve WebP kabul eder; diğerleri (SVG, BMP, TIFF…) turu hataya düşürmesin
  const imgs = all.filter(it => /^image\/(png|jpeg|gif|webp)$/.test(it.type));
  if(imgs.length < all.length) toast('Bu görsel türü desteklenmiyor (yalnızca PNG, JPEG, GIF, WebP)');
  const s = sess(S.panes[+ta.dataset.ta]);
  imgs.forEach((it, k) => { const f = it.getAsFile(); if(!f || f.size > 5*1024*1024){ toast('Görsel 5 MB\'tan büyük'); return; }
    const rd = new FileReader(); rd.onload = () => { const data = String(rd.result).split(',')[1];
      addAttachments(s, [{name:`yapıştırılan-${Date.now()%100000}-${k+1}.${(f.type.split(/[\\/]/)[1]||'png').replace('jpeg','jpg')}`, isImage:true, media_type:f.type, data}]); };
    rd.readAsDataURL(f); });
});

/* ---------- Faz 3: Uzaktan Kontrol + bağlayıcı durumu ---------- */
async function startRemote(s){
  if(s.run){ toast('Önce bu bölmedeki çalışmanın bitmesini bekle'); return; }
  if(s.draft){ toast('Önce ilk mesajı gönder: Uzaktan Kontrol kayıtlı bir sohbeti açar'); return; }
  try { await API.claude.remote({sessionId:s.uuid, cwd:s.cwd || s.project, name:s.title.slice(0, 40)}); s.remote = true; s.remoteAt = Date.now(); renderInfo(); renderPanes();
    toast('Terminal açıldı: Uzaktan Kontrol oturumu başlıyor'); }
  catch(e){ toast('Açılamadı: ' + String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')); }
}
async function checkConnectors(s){
  S.mcpCheck = {loading:true, cwd:s.project}; S.connOpen = true; renderInfo();
  const r = await API.claude.mcpList(s.cwd || s.project);
  S.mcpCheck = {loading:false, cwd:s.project, at:Date.now(), ...r}; renderInfo();
}

// npm run selftest için durum özeti
window.__selftest = () => ({
  sessions: S.sessions.length, folders: S.folders.length, fresh: S.sessions.filter(s => s.fresh).length,
  live: S.sessions.filter(s => s.status === 'elsewhere').map(s => s.title),
  panes: S.panes.map(p => p && {title: sess(p).title, loaded: sess(p).loaded, msgs: sess(p).msgs.length, err: sess(p).loadErr || null}),
  connectors: S.connectors.map(c => c.name), desktopDirs: DISK.length, errors: window.__errors, auth: S.auth,
});
boot().catch(e => { console.error('Açılış hatası', e); window.__errors.push('boot: ' + (e && e.message)); });

/* ---------- Faz 4: menü komutları ve kısayol yardımı ---------- */
const SHORTCUTS = [
  ['Genel', [['⌘N','Yeni sohbet (klasör seçerek)'],['⇧⌘N','Yeni klasör'],['⌘K','Tüm sohbetlerde ara'],['⌘B','Sohbetler penceresi'],['⌘G','GourceView'],['⌘I','Bilgi paneli'],['⌘R','Şimdi senkronla'],['⇧⌘L','Açık / koyu tema'],['⌘/','Bu yardım']]],
  ['Bölmeler', [['⌘1–4','Bölmeye geç (aramada: o bölmede aç)'],['⇧⌘[ ⇧⌘]','Önceki / sonraki bölme'],['⌥⌘1–4','Düzen: 1 / 2 / 3 / 2×2'],['⌥⌘W','Bölmeyi kapat'],['↵ / ⇧↵','Gönder / yeni satır'],['Esc','Çalışan turu durdur'],['⌘↵','Bekleyen izni onayla']]],
  ['Sohbetler penceresi', [['Çift tık · ↵','Aç / klasöre gir'],['⌫ · ⌘↑','Üst klasör'],['⌘[ ⌘]','Geri / ileri'],['Boşluk','Önizle'],['F2','Yeniden adlandır'],['⌘X ⌘V','Kes / yapıştır (taşı)'],['⌘⌫','Çöp Kutusuna taşı'],['⌃⌘N','Seçilenlerle yeni klasör'],['⌘A · ok tuşları','Seç / gez']]],
  ['GourceView', [['L','Bağlantı kur'],['F','Sığdır'],['⇧ + sürükle','İki düğümü bağla'],['Tekerlek','Yakınlaştır']]],
];
function showHelp(){
  let m = $('#helpdlg'); if(m){ m.remove(); return; }
  m = document.createElement('div'); m.id = 'helpdlg'; m.className = 'modal-bg';
  m.innerHTML = `<div class="modal" style="width:min(760px,100%)"><div class="mh2"><h3>Klavye kısayolları</h3><button class="ibtn" data-helpx>${ic('x')}</button></div>
    <div class="mb help-grid">${SHORTCUTS.map(([g, rows]) => `<div><div class="fl">${g}</div>${rows.map(([k, d]) => `<div class="hk"><span class="kbd">${k}</span><span>${d}</span></div>`).join('')}</div>`).join('')}</div></div>`;
  document.body.appendChild(m);
  m.addEventListener('click', e => { if(e.target === m || e.target.closest('[data-helpx]')) m.remove(); });
}
function menuAction({cmd, arg}){
  const inField = document.activeElement && document.activeElement.matches('input,textarea');
  const n = nPanes();
  switch(cmd){
    case 'newChat': newChat(); break;
    case 'newFolder': openNewFolder(S.org ? curFolder() : null); break;
    case 'search': setSearch(!SR.open); break;
    case 'sync': $('#btnSync') && $('#btnSync').click(); break;
    case 'reveal': { const s = sess(S.panes[S.active]); if(s) API.fs.reveal(s.project); break; }
    case 'selectAll': if(inField) document.execCommand('selectAll'); else if(S.org && FX.cwd !== GRAPH){ FX.sel = new Set(listing()); paintSel(); } break;
    case 'org': setOrg(!S.org); break;
    case 'graph': if(S.org && FX.cwd === GRAPH) setOrg(false); else { setOrg(true); go(GRAPH); } break;
    case 'info': S.info = !S.info; render(); break;
    case 'layout': S.layout = arg; if(S.active >= nPanes()) S.active = 0; render(); break;
    case 'theme': $('#btnTheme').click(); break;
    case 'pane':
      if(SR.open && SR.res[SR.sel] && arg < n){ openFromSearch(SR.res[SR.sel].s.id, arg); break; }
      if(arg < n){ S.active = arg; setOrg(false); render(); document.querySelector(`[data-ta="${arg}"]`)?.focus(); } break;
    case 'panePrev': S.active = (S.active - 1 + n) % n; render(); break;
    case 'paneNext': S.active = (S.active + 1) % n; render(); break;
    case 'paneClose': S.panes[S.active] = null; render(); break;
    case 'back': if(S.org) goBack(); break;
    case 'fwd': if(S.org) goFwd(); break;
    case 'help': showHelp(); break;
  }
}
API.onMenu(menuAction);


// ---------- Windows/Linux: kısayol etiketlerini Ctrl/Alt/Shift'e çevir ----------
if(!IS_MAC){
  document.documentElement.classList.add('plat-win');
  const KB = [[/⌃⌘/g,'Ctrl+Alt+'],[/⇧⌘/g,'Ctrl+Shift+'],[/⌥⌘/g,'Ctrl+Alt+'],[/⌘/g,'Ctrl+'],[/⌫/g,'Backspace'],[/⇧\s?\+/g,'Shift +'],[/⇧/g,'Shift+'],[/⌥/g,'Alt+'],[/⌃/g,'Ctrl+']];
  const RX = /[⌘⌥⌃⇧⌫]/;
  const fix = t => { for(const [a,b] of KB) t = t.replace(a,b); return t; };
  const walk = root => {
    if(root.nodeType === 3){ if(RX.test(root.nodeValue)) root.nodeValue = fix(root.nodeValue); return; }
    if(root.nodeType !== 1) return;
    if(root.title && RX.test(root.title)) root.title = fix(root.title);
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for(let n = tw.nextNode(); n; n = tw.nextNode()){
      if(n.nodeType === 3){ if(RX.test(n.nodeValue)) n.nodeValue = fix(n.nodeValue); }
      else if(n.title && RX.test(n.title)) n.title = fix(n.title);
    }
  };
  walk(document.body);
  new MutationObserver(ms => { for(const m of ms){ if(m.type === 'characterData') walk(m.target); else if(m.type === 'attributes') walk(m.target); else m.addedNodes.forEach(walk); } })
    .observe(document.body, { subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['title'] });
  // Açılışta pencere düğmelerini temaya göre renklendir
  try { API.setTheme(isDarkTheme()); } catch {}
}


/* ---------- Sohbette video / ses oynatıcı ----------
   Mesajlarda, araç komut/çıktılarında ve eklerde geçen video/ses dosyası yolları ve adresleri bulunur,
   mesajın altında oynatıcı gösterilir. Yerel dosyalar ana süreçteki cpmedia:// protokolüyle (ileri/geri
   sarma destekli) okunur. Bulunamayan/oynatılamayan dosyalar hiç görünmez.
   Oynatıcı öğeleri önbellekte tutulur ve her yeniden çizimde aynı öğe yerine taşınır: oynatma kesilmez. */
const VEXT = 'mp4|m4v|mov|webm|mkv|ogv', AEXT = 'mp3|wav|m4a|aac|ogg|oga|flac|opus';
const MEDIA_VID = new RegExp(`\\.(${VEXT})(\\?|#|$)`, 'i'), MEDIA_AUD = new RegExp(`\\.(${AEXT})(\\?|#|$)`, 'i');
const MX = `(?:${VEXT}|${AEXT})`;
const MEDIA_RX = [
  new RegExp(`https?:\\/\\/[^\\s<>"'\`)\\]]+?\\.${MX}(?:\\?[^\\s<>"'\`)\\]]*)?(?=$|[\\s<>"'\`)\\],;])`, 'gi'),        // adres
  new RegExp(`[\`"“']([^\`"“”'\\n]{1,400}?\\.${MX})[\`"”']`, 'gi'),                                                  // tırnak / kod içinde (boşluklu yol)
  new RegExp(`^[ \\t]*(?:[-*•][ \\t]+)?((?:~|\\/|[A-Za-z]:[\\\\/])[^\\n]*?\\.${MX})[ \\t]*$`, 'gim'),                 // satırın tamamı yol (ekli dosyalar listesi)
  new RegExp(`(?:^|[\\s(=:>])((?:~|\\.{0,2}[\\\\/]|[A-Za-z]:[\\\\/])?[^\\s\`'"<>|*?()]+\\.${MX})(?=$|[\\s),.;:!?<])`, 'gim'), // boşluksuz yol / dosya adı
];
const decodeEnt = t => t.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
function mediaCands(text, out){
  if(!text) return;
  for(const rx of MEDIA_RX){ rx.lastIndex = 0; for(const m of text.matchAll(rx)){ const c = (m[1] || m[0]).trim().replace(/^file:\/\//, ''); if(c) out.add(c); } }
}
function mediaAbs(c, cwd){
  if(/^https?:/i.test(c)) return c;
  if(/^(~|\/|[A-Za-z]:[\\/])/.test(c)) return c;
  if(/\s/.test(c) || !cwd) return null;                 // boşluklu göreli metin büyük olasılıkla komuttur
  const win = /^[A-Za-z]:\\/.test(cwd);
  return cwd.replace(/[\\/]+$/, '') + (win ? '\\' : '/') + c.replace(/^\.[\\/]/, '');
}
const IEXT = 'png|jpe?g|gif|webp';
const IMG_TXT_RX = [
  new RegExp(`[\`"“']([^\`"“”'\\n]{1,400}?\\.(?:${IEXT}))[\`"”']`, 'gi'),
  new RegExp(`(?:^|[\\s(=:>])((?:~|\\/|[A-Za-z]:[\\\\/])[^\\s\`'"<>|*?()]+\\.(?:${IEXT}))(?=$|[\\s),.;:!?<])`, 'gim'),
];
const IMG_MEMO = new WeakMap();
function imgList(s, m){
  if(m.r !== 'a' || m.streaming) return [];
  const sig = (s.cwd || s.project || '') + '#' + m.b.map(b => b.t === 'text' ? b.v.length : 0).join(',');
  const memo = IMG_MEMO.get(m); if(memo && memo.sig === sig) return memo.list;
  const set = new Set(), shown = new Set();
  for(const b of m.b) if(b.t === 'text'){
    for(const x of b.v.matchAll(/data-mdimg="([^"]+)"/g)) shown.add(decodeEnt(x[1]));
    const txt = decodeEnt(b.v.replace(/<img[^>]*>/g, ' ').replace(/<code>([\s\S]*?)<\/code>/g, '`$1`').replace(/<br>|<\/(p|li|h\d|div|tr|blockquote)>/g, '\n').replace(/<[^>]+>/g, ' '));
    for(const rx of IMG_TXT_RX){ rx.lastIndex = 0; for(const x of txt.matchAll(rx)) set.add(x[1].trim().replace(/^file:\/\//, '')); }
  }
  const cwd = s.cwd || s.project, list = [];
  for(const c of set){ const a = mediaAbs(c, cwd); if(!a || /^https?:/i.test(a) || shown.has(a) || list.includes(a)) continue; list.push(a); if(list.length >= 6) break; }
  IMG_MEMO.set(m, {sig, list}); return list;
}
const imgsHTML = (s, m) => { const l = imgList(s, m); return l.length ? `<div class="img-list">${l.map(p => `<img class="md-img" src="${esc(mediaSrc(p))}" data-mdimg="${esc(p)}" title="${esc(p)}" alt="" loading="lazy">`).join('')}</div>` : ''; };
const MEDIA_MEMO = new WeakMap();
function mediaList(s, m){
  const sig = (s.cwd || s.project || '') + '#' + (m.r === 'u' ? m.t.length : m.b.map(b => b.t === 'text' ? b.v.length : (b.a || '').length + '.' + (b.o || '').length).join(','));
  const memo = MEDIA_MEMO.get(m); if(memo && memo.sig === sig) return memo.list;
  const set = new Set();
  if(m.r === 'u') mediaCands(m.t, set);
  else for(const b of m.b){
    if(b.t === 'text'){
      const html = b.v;
      for(const x of html.matchAll(/<code>([\s\S]*?)<\/code>/g)) mediaCands('`' + decodeEnt(x[1]) + '`', set);
      for(const x of html.matchAll(/href="([^"]+)"/g)) mediaCands(decodeEnt(x[1]), set);
      mediaCands(decodeEnt(html.replace(/<code>[\s\S]*?<\/code>/g, ' ').replace(/<br>|<\/(p|li|h\d|div|tr|blockquote)>/g, '\n').replace(/<[^>]+>/g, ' ')), set);
    } else { mediaCands(b.a, set); mediaCands(b.o, set); }
  }
  const cwd = s.cwd || s.project;
  const seen = new Set(), list = [];
  for(const c of set){ const a = mediaAbs(c, cwd); if(!a || seen.has(a)) continue; seen.add(a); list.push(a); if(list.length >= 6) break; }
  MEDIA_MEMO.set(m, {sig, list});
  return list;
}
const mediaSrc = p => /^https?:/i.test(p) ? p : 'cpmedia://local/' + encodeURIComponent(p);
const mediaName = p => { let n = p.split(/[?#]/)[0].split(/[\\/]/).filter(Boolean).pop() || p; try { n = decodeURIComponent(n); } catch {} return n; };
function mediaHTML(s, m, mi, side){
  if(m.streaming) return '';
  const list = mediaList(s, m); if(!list.length) return '';
  return `<div class="media-list ${side==='u'?'u-media':''}">${list.map(p => { const v = MEDIA_VID.test(p), web = /^https?:/i.test(p);
    return `<div class="media ${v?'mv':'ma'}" data-mkey="${esc(s.id+'|'+mi+'|'+p)}" data-msrc="${esc(mediaSrc(p))}" data-mkind="${v?'v':'a'}">
      <div class="media-el"></div>
      <div class="media-bar">${ic(v?'video':'music')}<span class="media-name" title="${esc(p)}">${esc(mediaName(p))}</span><span class="media-meta"></span>
        ${web ? `<a class="media-btn" href="${esc(p)}" target="_blank" rel="noopener" title="Tarayıcıda aç">${ic('ext')}</a>` :
        `<button class="media-btn" data-mopen="${esc(p)}" title="Varsayılan oynatıcıda aç">${ic('ext')}</button><button class="media-btn" data-mshow="${esc(p)}" title="Klasörde göster">${ic('folder')}</button>`}</div></div>`; }).join('')}</div>`;
}
const MEDIA_CACHE = new Map(), REMOTE_OK = new Set();
const fmtDur = t => { if(!isFinite(t)) return ''; t = Math.round(t); const h = Math.floor(t/3600), mm = Math.floor(t%3600/60), ss = String(t%60).padStart(2,'0'); return h ? `${h}:${String(mm).padStart(2,'0')}:${ss}` : `${mm}:${ss}`; };
function mediaMeta(el){ return [fmtDur(el.duration), el.videoWidth ? `${el.videoWidth}×${el.videoHeight}` : ''].filter(Boolean).join(' · '); }
function showMedia(el){
  const box = el.closest('.media'); if(!box || box.classList.contains('ok')) return;
  const sc = box.closest('.msgs'); const atBottom = sc && sc.scrollHeight - sc.scrollTop - sc.clientHeight < 80;
  box.classList.add('ok'); box.querySelector('.media-meta').textContent = mediaMeta(el);
  if(atBottom) sc.scrollTop = sc.scrollHeight;
}
function hydrateMedia(root, prefix = ''){
  if(!root) return;
  root.querySelectorAll('.media[data-mkey]').forEach(box => {
    const key = prefix + box.dataset.mkey;
    // Uzak (https) medya kendiliğinden yüklenmez: istek kullanıcı tıklamadan gitmez (IP/zaman bilgisi sızmasın)
    if(/^https?:/i.test(box.dataset.msrc) && !REMOTE_OK.has(box.dataset.msrc)){
      if(!box.querySelector('[data-mload]')){ let host = ''; try { host = new URL(box.dataset.msrc).host; } catch {}
        box.classList.add('ok', 'wait');
        box.querySelector('.media-el').innerHTML = `<button class="media-load" data-mload data-mpre="${esc(prefix)}">${ic(box.dataset.mkind==='v'?'video':'music')}<span>Uzak medya · <b>${esc(host)}</b><br><span>Yüklemek için tıkla — tıklayana kadar bu adrese istek gönderilmez</span></span></button>`; }
      return;
    }
    let el = MEDIA_CACHE.get(key);
    if(!el || el.isConnected){
      el = document.createElement(box.dataset.mkind === 'v' ? 'video' : 'audio');
      el.controls = true; el.preload = 'metadata'; if(el.tagName === 'VIDEO') el.playsInline = true;
      el.addEventListener('loadedmetadata', () => { el._ok = true; showMedia(el); });
      el.addEventListener('error', () => { el._fail = true; const b = el.closest('.media'); if(b) b.remove(); });
      el.src = box.dataset.msrc;
      if(!MEDIA_CACHE.has(key) || !MEDIA_CACHE.get(key).isConnected) MEDIA_CACHE.set(key, el);
    }
    if(el._fail){ box.remove(); return; }
    box.querySelector('.media-el').appendChild(el);
    if(el._ok) showMedia(el);
  });
  // Artık ekranda olmayan oynatıcıları bırak (dosya tutamacı açık kalmasın)
  for(const [k, el] of MEDIA_CACHE) if(!el.isConnected){ try { el.pause(); el.removeAttribute('src'); el.load(); } catch {} MEDIA_CACHE.delete(k); }
}
document.addEventListener('click', e => {
  const o = e.target.closest && e.target.closest('[data-mopen]'); if(o){ e.stopPropagation(); API.fs.reveal(o.dataset.mopen).then(ok => ok || toast('Dosya bulunamadı')); return; }
  const ld = e.target.closest && e.target.closest('[data-mload]'); if(ld){ e.stopPropagation(); const box = ld.closest('.media');
    REMOTE_OK.add(box.dataset.msrc); box.classList.remove('ok', 'wait'); box.querySelector('.media-el').innerHTML = ''; hydrateMedia(box.parentElement, ld.dataset.mpre || ''); return; }
  const sh = e.target.closest && e.target.closest('[data-mshow]'); if(sh){ e.stopPropagation(); API.fs.showInFolder(sh.dataset.mshow).then(ok => ok || toast('Dosya bulunamadı')); }
}, true);


/* ---------- Güncelleme ve ayarlar ---------- */
// Windows'ta uygulama güncelleme klasöründeki (NAS) yeni sürümü kendisi bulur, arka planda indirir ve doğrular;
// hazır olunca üst çubukta "Yeniden başlat" düğmesi çıkar. Kurulum sessizdir, bitince uygulama yeniden açılır.
let UPD = {phase:'idle'}, APPV = '', MIRROR = null;
function updToast(st, manual){
  if(st.phase==='none' && manual) toast(`Güncelsin · sürüm ${st.current}`);
  if(st.phase==='error' && manual) toast(`Güncelleme denetlenemedi: ${st.error}`);
  if(st.phase==='disabled' && manual) toast('Otomatik güncelleme yalnızca Windows sürümünde çalışır');
}
function paintUpd(){
  const b = $('#btnUpd'); if(!b) return;
  const show = UPD.phase==='ready' || UPD.phase==='downloading';
  b.hidden = !show; b.classList.toggle('ready', UPD.phase==='ready');
  if(UPD.phase==='downloading') { b.innerHTML = `${ic('sync')}<span>Güncelleme indiriliyor · %${UPD.progress||0}</span>`; b.title = `Sürüm ${UPD.latest} hazırlanıyor`; }
  if(UPD.phase==='ready') { b.innerHTML = `${ic('sync')}<span>Sürüm ${esc(UPD.latest)} hazır · Yeniden başlat</span>`; b.title = (UPD.notes ? UPD.notes + '\n\n' : '') + 'Tıkla: uygulama kapanır, güncellenir ve yeniden açılır'; }
}
async function updCheck(){ toast('Güncellemeler denetleniyor…'); const st = await API.update.check(); UPD = st; paintUpd(); updToast(st, true); }
function updateClick(){
  if(UPD.phase!=='ready') return;
  const running = S.sessions.filter(s => s.run).length;
  if(running && !confirm(`${running} sohbet şu an çalışıyor. Güncellemek için durdurulacak. Devam edilsin mi?`)) return;
  try { if(saveT){ clearTimeout(saveT); saveT = null; API.workspace.saveSync(buildWS()); } } catch {}
  toast('Güncelleniyor — uygulama birkaç saniye içinde yeniden açılacak');
  API.update.install();
}
function settingsMenu(x, y){
  const st = UPD, line = st.phase==='ready' ? `Sürüm ${esc(st.latest)} kurulmaya hazır` : st.phase==='downloading' ? `Sürüm ${esc(st.latest)} indiriliyor · %${st.progress||0}` :
    st.phase==='checking' ? 'Denetleniyor…' : st.phase==='error' ? 'Son denetim başarısız' : st.phase==='disabled' ? 'Otomatik güncelleme: yalnızca Windows' : st.checkedAt ? 'Güncel' : '';
  menu(x, y, `<div class="mh">Claude Panel ${esc(APPV)}</div>
    ${line?`<div style="padding:2px 9px 6px;font-size:12px;color:var(--muted)">${line}</div>`:''}
    ${st.phase==='ready'?`<button data-m="updgo" style="color:var(--accent-text)">${ic('sync')}Yeniden başlat ve güncelle</button>`:''}
    <button data-m="updcheck">${ic('sync')}Güncellemeleri denetle</button>
    <button data-m="upddir">${ic('folder')}Güncelleme klasörü…</button>
    ${MIRROR && MIRROR.root?`<hr><button data-m="mirroropen" title="${esc(MIRROR.root)}">${ic('ext')}Diskteki kopyayı aç <span style="margin-left:auto;padding-left:12px;color:var(--faint);font-size:11px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" class="mono">${esc(MIRROR.root)}</span></button>`:''}
    <hr><button data-m="fontdlg">${ic('edit')}Yazı tipi…</button>
    <button data-m="helpdlg">${ic('search')}Klavye kısayolları</button>`);
}
(async () => {
  try { APPV = (await API.info()).version; } catch {}
  if(API.mirror) try { MIRROR = await API.mirror.info(); } catch {}
  if(!API.update) return;
  try { UPD = await API.update.state(); } catch {}
  paintUpd();
  API.update.onState(st => { const was = UPD.phase; UPD = st; paintUpd(); if(st.phase==='ready' && was!=='ready') { toast(`Yeni sürüm ${st.latest} hazır — üst çubuktan yeniden başlat`); renderRail(); } });
})();


/* ---------- Yazı tipi seçimi (Ayarlar → Yazı tipi…) ----------
   Üç ayrı seçim: arayüz (--sans), okuma — Claude'un yanıtları ve başlıklar (--serif), kod (--mono).
   Yazı tipleri uygulamaya gömülüdür (fonts.css, SIL OFL); internet gerekmez, Windows ve Mac'te aynı görünür.
   Seçim workspace'e (prefs.fonts) kaydedilir. */
const FONT_DEF = {ui:'Inter', read:'@ui', mono:'JetBrains Mono'}; // varsayılan: Inter, okuma arayüzle aynı, JetBrains Mono
const FONT = {...FONT_DEF};
const FONT_SETS = {
  ui:   {label:'Arayüz', hint:'menüler, listeler, düğmeler, senin mesajların', v:'--sans', opts:[['', 'Sistem'], ['Inter','Inter'], ['IBM Plex Sans','IBM Plex Sans'], ['Manrope','Manrope'], ['Nunito Sans','Nunito Sans']]},
  read: {label:'Okuma', hint:'Claude\'un yanıtları ve başlıklar', v:'--serif', opts:[['', 'Sistem serif'], ['Source Serif 4','Source Serif'], ['Literata','Literata'], ['Lora','Lora'], ['@ui','Arayüzle aynı']]},
  mono: {label:'Kod', hint:'komutlar, dosya yolları, kod blokları', v:'--mono', opts:[['', 'Sistem'], ['JetBrains Mono','JetBrains Mono'], ['IBM Plex Mono','IBM Plex Mono'], ['Fira Code','Fira Code']]},
};
const FONT_BASE = {};
function fontStack(kind, name){
  if(!FONT_BASE[kind]) FONT_BASE[kind] = getComputedStyle(document.documentElement).getPropertyValue(FONT_SETS[kind].v).trim();
  if(!name) return '';
  if(name === '@ui') return FONT.ui ? `"${FONT.ui}", ${FONT_BASE.ui || 'sans-serif'}` : 'var(--sans-base)';
  return `"${name}", ${FONT_BASE[kind]}`;
}
function applyFonts(){
  const r = document.documentElement.style;
  ['ui','mono','read'].forEach(k => { fontStack(k, ''); });
  if(!r.getPropertyValue('--sans-base')) r.setProperty('--sans-base', FONT_BASE.ui);
  ['ui','read','mono'].forEach(k => { const st = fontStack(k, FONT[k]); if(st) r.setProperty(FONT_SETS[k].v, st); else r.removeProperty(FONT_SETS[k].v); });
}
function openFonts(){
  let m = $('#fontdlg'); if(m) m.remove();
  m = document.createElement('div'); m.id = 'fontdlg'; m.className = 'modal-bg';
  const sample = {ui:'Sohbetler · Yeni klasör', read:'Çağrı güzel bir öğle ışığı', mono:'npm run dev // İş'};
  const paint = () => {
    m.innerHTML = `<div class="modal" role="dialog" aria-label="Yazı tipi" style="width:min(640px,100%)">
      <div class="mh2"><h3>Yazı tipi</h3><button class="ibtn" data-fx="close">${ic('x')}</button></div>
      <div class="mb">${Object.entries(FONT_SETS).map(([k, set]) => `
        <label class="fl">${set.label} <span>· ${set.hint}</span></label>
        <div class="fopts">${set.opts.map(([v, l]) => { const fam = v === '@ui' ? 'var(--sans)' : v ? `"${v}", ${FONT_BASE[k]}` : FONT_BASE[k];
          return `<button class="fopt ${FONT[k]===v?'on':''}" data-fk="${k}" data-fv="${esc(v)}"><b>${esc(l)}</b><span style="font-family:${esc(fam)}">${esc(sample[k])}</span></button>`; }).join('')}</div>`).join('')}
      </div>
      <div class="mf"><button class="btn" data-fx="reset">Varsayılana dön</button><span class="grow"></span><button class="btn pri" data-fx="close">Tamam</button></div></div>`;
  };
  ['ui','read','mono'].forEach(k => fontStack(k, ''));
  paint(); document.body.appendChild(m);
  m.addEventListener('click', e => {
    const o = e.target.closest('[data-fk]');
    if(o){ FONT[o.dataset.fk] = o.dataset.fv; applyFonts(); persist(); paint(); return; }
    const x = e.target.closest('[data-fx]');
    if(x && x.dataset.fx === 'reset'){ Object.assign(FONT, FONT_DEF); applyFonts(); persist(); paint(); return; }
    if((x && x.dataset.fx === 'close') || e.target === m) m.remove();
  });
}
document.addEventListener('keydown', e => { if(e.key === 'Escape' && $('#fontdlg')){ $('#fontdlg').remove(); e.stopPropagation(); } }, true);


/* ---------- Görseller: araç sonuçlarındaki ekran görüntüleri ve eklenen resimler ----------
   Kayıtlı oturumlarda ana süreç görselleri diske (~/.claude-panel/gorseller) yazar ve yolunu verir (cpmedia:// ile okunur);
   canlı turda görsel akıştan base64 gelir ve doğrudan gösterilir. Küçük resme tıklayınca büyük açılır. */
const imgSrc = p => /^data:image\//.test(p) ? p : 'cpmedia://local/' + encodeURIComponent(p);
function thumbs(list, cls){
  if(!list || !list.length) return '';
  const key = list.join('\n'); let id = LBID.get(key); if(!id){ id = ++LBN; LBID.set(key, id); } LBREG.set(id, list); // içerikten: yeniden yüklemede kimlik (ve HTML) değişmez
  return `<span class="thumbs ${cls}">${list.map((p, k) => `<img src="${esc(imgSrc(p))}" data-lb="${k}" data-lbg="${id}" loading="lazy" alt="">`).join('')}</span>`;
}
const LBID = new Map(), LBREG = new Map(); let LBN = 0;
// Bulunamayan görsel küçük resmi gizlenir (satır içi onerror CSP'ye takılır, bu yüzden yakalama aşamasında)
document.addEventListener('error', e => { if(e.target && e.target.matches && e.target.matches('.thumbs img, img.md-img')) e.target.remove(); }, true);
function liveImgs(content){
  const out = [];
  if(Array.isArray(content)) for(const c of content){
    if(out.length >= 8) break;
    if(c.type === 'image' && c.source && c.source.type === 'base64' && /^image\/(png|jpeg|gif|webp)$/.test(c.source.media_type)) out.push(`data:${c.source.media_type};base64,${c.source.data}`);
    else if(c.type === 'text' && c.text) for(const m of c.text.matchAll(/\[Image: source: ([^\]\n]+)\]/g)) if(/\.(png|jpe?g|gif|webp)$/i.test(m[1].trim())) out.push(m[1].trim());
  }
  return out;
}
function lightbox(list, k){
  let m = $('#lb'); if(m) m.remove();
  m = document.createElement('div'); m.id = 'lb'; m.className = 'lb';
  const show = () => { m.innerHTML = `${/\.(mp4|m4v|mov|webm)$/i.test(decodeURIComponent(list[k])) ? `<video class="lb-vid" src="${esc(list[k])}" controls autoplay></video>` : `<img class="lb-img" src="${esc(list[k])}" alt="" draggable="false">`}${list.length > 1 ? `<button class="lb-n lb-p" data-lbn="-1">‹</button><button class="lb-n lb-x" data-lbn="1">›</button><span class="lb-c">${k+1} / ${list.length}</span>` : ''}<button class="ibtn lb-close" data-lbc>${ic('x')}</button>`; };
  show(); document.body.appendChild(m);
  // Resme tıklayınca tıklanan yere yakınlaşır, fare gezdikçe görüntü kayar; yeniden tıklayınca uzaklaşır. Resim dışında bir yere tıklayınca kapanır.
  const at = (img, e) => { const r = img.getBoundingClientRect(); return `${Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 100}% ${Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) * 100}%`; };
  m.addEventListener('click', e => {
    const n = e.target.closest('[data-lbn]'); if(n){ k = (k + +n.dataset.lbn + list.length) % list.length; show(); return; }
    const img = e.target.closest('.lb-img');
    if(img){ if(img.classList.toggle('zoom')){ const z = Math.min(5, Math.max(2.2, img.naturalWidth / Math.max(1, img.clientWidth)));
        img.style.transformOrigin = at(img, e); img.style.transform = `scale(${z})`; } else img.style.transform = ''; return; }
    if(!e.target.closest('.lb-c, .lb-vid')) m.remove();
  });
  m.addEventListener('mousemove', e => { const img = m.querySelector('.lb-img.zoom'); if(img && e.target === img) img.style.transformOrigin = at(img, e); });
  m._key = e => { if(e.key === 'Escape') m.remove(); if(e.key === 'ArrowRight' || e.key === 'ArrowLeft'){ k = (k + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length; show(); } };
}
document.addEventListener('click', e => {
  const mi = e.target.closest && e.target.closest('img.md-img');
  if(mi){ e.stopPropagation(); e.preventDefault(); const all = [...(mi.closest('.a, .msgs-in, .mb') || document).querySelectorAll('img.md-img')]; lightbox(all.map(x => x.src), Math.max(0, all.indexOf(mi))); return; }
  const t = e.target.closest && e.target.closest('[data-lb]'); if(!t) return;
  e.stopPropagation(); e.preventDefault();
  const list = LBREG.get(+t.dataset.lbg); if(list) lightbox(list.map(imgSrc), +t.dataset.lb);
}, true);
document.addEventListener('keydown', e => { const m = $('#lb'); if(m && m._key){ m._key(e); e.stopPropagation(); if(e.key === 'Escape' || e.key.startsWith('Arrow')) e.preventDefault(); } }, true);
