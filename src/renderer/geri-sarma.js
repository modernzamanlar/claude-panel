/* ---------- Mesajı düzenle / buraya geri sar (sohbet + kod), ek klasörler (--add-dir), worktree ----------
   app.js'ten sonra yüklenir ve onun genel durumunu kullanır (S, WS, sess, esc, ic, menu, sendNow, renderPanes…).
   app.js'teki kancalar: msgHTML → userHTML · paneParts.top → rwCard · başlık → forkChip · send → rwSend · click → rwClick ·
   sendNow → s.dirs / s.worktree · onRun init → rwInit · renderInfo → dirsInfo · renderNC → ncExtraHTML · startChat → ncApply.
   Saf mantık rewind.js'te (window.rewind).

   Düzenleme (CLI ile doğrulandı): kullanıcı mesajındaki `at` (önündeki son asistan kaydı) ile
   `--resume <id> --resume-session-at <at> --fork-session` → yeni oturum o noktadan devam eder; asıl sohbet dosyası değişmez.
   Kod: `rewind_files` kontrol isteği, kullanıcı mesajının `uuid`'si ile (önce dry_run → onay → gerçek). */
const RWM = window.rewind;
ICON.rewind = '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 8v4l3 2"/>';

const rwErr = e => String(e && e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

function userHTML(s, m, mi){
  const tail = `${thumbs(m.imgs, 'th-u')}${mediaHTML(s, m, mi, 'u')}`;
  if(!RWM.canEdit(m) || s.draft) return `<div class="u">${esc(m.t)}</div>${tail}`;
  const on = !!s.rw && s.rw.mi === mi && s.rw.ts === (m.ts || null);
  const dis = s.run ? ' disabled' : '';
  const tipE = s.run ? 'Sohbet çalışırken düzenlenemez' : 'Düzenle: metin yazma kutusuna gelir; gönderince sohbet bu noktadan yeni bir kopyada devam eder, asıl sohbet olduğu gibi kalır';
  const tipR = s.run ? 'Sohbet çalışırken geri sarılamaz' : 'Buraya geri sar: sohbeti (istersen kodu da) bu mesajdan önceki hale döndür';
  return `<div class="u-line${on ? ' rw-on' : ''}"><span class="rw-acts"><button class="ibtn ue-btn" data-uedit="${mi}" data-sid="${s.id}" title="${tipE}"${dis}>${ic('edit')}</button><button class="ibtn ue-btn" data-urw="${mi}" data-sid="${s.id}" title="${tipR}"${dis}>${ic('rewind')}</button></span><div class="u">${esc(m.t)}</div></div>${tail}`;
}

// Mesajı yazma kutusuna al; code: "Sohbeti ve kodu" seçildiyse dosya kaydı hemen denetlenir (onay istenir)
function rwStart(s, mi, code){
  if(!s || s.run) return;
  const tg = RWM.target(s.msgs, mi); if(!tg) return;
  const i = S.panes.indexOf(s.id);
  const ta = i >= 0 ? document.querySelector(`[data-ta="${i}"]`) : null;
  s.rw = {...tg, code:null, busy:false, err:null, prev:(s.rw ? s.rw.prev : (s.inputDraft || ''))};
  if(ta){ ta.value = tg.text; autosize(ta); }
  s.inputDraft = tg.text;
  renderPanes();
  if(ta){ ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  if(code) rwCode(s);
}
function rwCancel(s){
  const R = s && s.rw; if(!R) return;
  s.rw = null;
  const i = S.panes.indexOf(s.id), ta = i >= 0 ? document.querySelector(`[data-ta="${i}"]`) : null;
  if(ta && ta.value.trim() === R.text.trim()){ ta.value = R.prev; autosize(ta); s.inputDraft = R.prev; }
  renderPanes();
}
function rwCard(s){
  const R = s.rw; if(!R || s.run) return '';
  const code = R.code ? `<div class="rw-code ok">${ic('rewind')}<span>Kod bu mesajdan önceki haline döndü: ${esc(RWM.changeSummary(R.code))}</span></div>`
    : R.busy ? `<div class="rw-code"><span class="spin"></span><span>Dosya kaydı denetleniyor…</span></div>`
    : R.err ? `<div class="rw-code err"><span>${esc(R.err)}</span></div>` : '';
  const btn = R.uuid && !R.code && !R.busy ? `<button class="btn" data-rwcode="${s.id}">${ic('rewind')}Kodu da geri sar…</button>` : '';
  return `<div class="perm rw-card"><div class="perm-h">${ic('edit')}<b>${R.n}. mesaj düzenleniyor</b></div>
    <div class="perm-d">${R.first ? 'Bu sohbetin ilk mesajı: gönderince aynı klasörde <b>yeni bir sohbet</b> başlar.' : `Gönderince sohbet ${R.n}. mesajdan önceki noktadan <b>yeni bir kopyada</b> devam eder.`} Asıl sohbet olduğu gibi kalır.</div>
    ${code}<div class="perm-acts">${btn}<span class="grow"></span><button class="btn" data-rwx="${s.id}">Vazgeç</button></div></div>`;
}
// Önce dry_run: hangi dosyalar değişecek → onay penceresi → gerçek geri sarma
async function rwCode(s){
  const R = s && s.rw; if(!R || !R.uuid || R.busy || R.code) return;
  R.busy = true; R.err = null; renderPanes();
  let r; try { r = await API.rewind.files({sessionId:s.uuid, cwd:s.cwd || s.project, userMessageId:R.uuid, dryRun:true}); }
  catch(e){ r = {canRewind:false, files:[], error:rwErr(e)}; }
  if(s.rw !== R) return;
  R.busy = false;
  if(!r.canRewind) R.err = r.error;
  else if(!r.files.length) R.err = 'Bu mesajdan sonra kaydedilmiş dosya değişikliği yok: geri sarılacak kod yok';
  renderPanes();
  if(r.canRewind && r.files.length) rwConfirm(s, R, r);
}
let RWD = null; // açık onay penceresi: {s, R, r}
function rwConfirm(s, R, r){ RWD = {s, R, r}; renderRwDlg(); }
function renderRwDlg(){
  let m = $('#rwdlg'); if(!RWD){ m?.remove(); return; }
  if(!m){ m = document.createElement('div'); m.id = 'rwdlg'; m.className = 'modal-bg'; document.body.appendChild(m); }
  const {s, R, r} = RWD, rows = RWM.fileRows(r.files, s.cwd || s.project);
  m.innerHTML = `<div class="modal rw-dlg" role="dialog" aria-label="Kodu geri sar">
    <div class="mh2"><h3>Kodu geri sar</h3><button class="ibtn" data-rwno>${ic('x')}</button></div>
    <div class="mb"><div style="font-size:13px">${R.n}. mesajdan (“${esc(R.text.slice(0, 80))}${R.text.length > 80 ? '…' : ''}”) sonra Claude'un değiştirdiği dosyalar o mesajdan önceki haline döner:</div>
      <div class="rw-files">${rows.map(f => `<div class="irow">${ic('file')}<span class="lbl" title="${esc(f.path)}">${esc(f.name)}${f.dir ? ` <span class="sub mono">${esc(f.dir)}</span>` : ''}</span></div>`).join('')}</div>
      <div class="rw-sum">${esc(RWM.changeSummary(r))} · bu işlem dosyaları diskte değiştirir. Claude dışında (elle ya da başka programla) yapılan değişiklikler de üzerine yazılabilir.</div>
      ${RWD.err ? `<div class="rw-code err">${esc(RWD.err)}</div>` : ''}</div>
    <div class="mf"><span class="grow"></span><button class="btn" data-rwno>Vazgeç</button><button class="btn pri" data-rwgo ${RWD.busy ? 'disabled' : ''}>${RWD.busy ? '<span class="spin"></span>' : ic('rewind')}Dosyaları geri sar</button></div></div>`;
}
async function rwGo(){
  if(!RWD || RWD.busy) return;
  const D = RWD, {s, R} = D; D.busy = true; D.err = null; renderRwDlg();
  let r; try { r = await API.rewind.files({sessionId:s.uuid, cwd:s.cwd || s.project, userMessageId:R.uuid}); }
  catch(e){ r = {canRewind:false, error:rwErr(e)}; }
  if(RWD !== D) return;
  D.busy = false;
  if(!r.canRewind){ D.err = r.error; renderRwDlg(); return; }
  RWD = null; renderRwDlg();
  if(s.rw === R){ R.code = D.r; renderPanes(); }
  MEDIA_DIRS.delete(s.cwd || s.project);
  toast(`Kod geri sarıldı · ${RWM.changeSummary(D.r)}`);
}

// Gönder: düzenlenen mesaj o noktadan yeni oturuma (çatal) gider; ilk mesajsa aynı klasörde yeni sohbet
async function rwSend(s, i, ta){
  const R = s.rw, text = ta.value.trim(), att = s.attach || [];
  if(!text && !att.length) return;
  if(R.busy){ toast('Dosya kaydı denetleniyor · bitince gönder'); return; }
  s.rw = null; s.askFork = false;
  ta.value = ''; ta.style.height = 'auto'; s.inputDraft = ''; s.attach = []; updateGhost(ta);
  let t = s;
  if(R.first){
    const uuid = crypto.randomUUID(), id = sid(uuid);
    t = {...s, id, uuid, draft:true, title:RWM.forkTitle(s.title), rawTitle:s.rawTitle || s.title, forkOf:s.id, msgs:[], outputs:[], skipped:0, turns:0, run:null, queue:[], askFork:false, rw:null,
      status:'idle', pinned:false, trashed:false, hidden:false, remote:false, fresh:false, unseen:false, loaded:true, lastTs:new Date().toISOString(), ago:'şimdi', ctx:0, localUntil:Date.now() + 10*60*1000};
    S.sessions.unshift(t); S.items.unshift(id); S.panes = S.panes.map(p => p === s.id ? id : p);
  }
  const ok = await sendNow(t, text, att, R.first ? {} : {fork:true, resumeAt:R.at, cut:R.mi});
  if(ok){ if(R.first) toast('Düzenlenen mesajla yeni sohbet başladı · asıl sohbet duruyor'); return; }
  // Gönderilemedi: metin ve ekler yazma kutusuna, düzenleme durumu geri gelir
  if(!R.first) t.rw = R;
  const ta2 = document.querySelector(`[data-ta="${S.panes.indexOf(t.id)}"]`);
  if(ta2 && !ta2.value.trim()){ ta2.value = text; autosize(ta2); } t.inputDraft = text; t.attach = [...att, ...(t.attach || [])]; renderPanes();
}
// Düzenlenen kopyanın başlığında: hangi sohbetten türediği, tıklayınca asıl sohbet açılır
function forkChip(s){
  if(!s.forkOf) return '';
  const o = sess(s.forkOf);
  return `<span class="sep">·</span><button class="chip rw-orig" data-rworig="${esc(s.forkOf)}" title="${o ? 'Asıl sohbet: ' + esc(o.title) + ' · tıkla: aç' : 'Asıl sohbet listede yok'}">${ic('rewind')}Düzenlenmiş kopya</button>`;
}
// init olayı: worktree ile başlayan sohbetin gerçek çalışma klasörü (CLI <depo>/.claude/worktrees/<ad>'a geçer)
function rwInit(s, ev){
  if(s.worktree && typeof ev.cwd === 'string' && ev.cwd){ s.cwd = ev.cwd; s.project = ev.cwd; s.worktree = null; renderPanes(); }
}

/* ---------- Ek klasörler (bilgi paneli) ---------- */
const WT_RX = /[\\/]\.claude[\\/]worktrees[\\/]([^\\/]+)[\\/]?$/;
function dirsInfo(s){
  const wt = WT_RX.exec(s.cwd || s.project || '');
  const base = d => d.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || d;
  return `${wt ? `<div class="irow">${ic('cols')}<span class="lbl">Ayrı dal (worktree) <span class="sub mono">· worktree-${esc(wt[1])}</span></span></div>` : ''}
    ${(s.dirs || []).map(d => `<div class="irow rw-dir">${ic('folderPlus')}<span class="lbl" title="${esc(d)}">${esc(base(d))} <span class="sub">· ek klasör · ${esc(d)}</span></span><button class="ibtn" data-adx="${esc(d)}" data-sid="${s.id}" title="Ek klasörü kaldır (sonraki mesajdan itibaren)">${ic('x')}</button></div>`).join('')}
    <div class="irow"><span style="width:16px"></span><button class="act" data-adadd="${s.id}" title="Claude'un bu sohbette erişebileceği ikinci bir klasör (claude --add-dir)">${ic('plus')}Ek klasör ekle…</button></div>`;
}
async function addDirTo(s){
  const p = await API.fs.pickFolder(); if(!p || !s) return;
  const before = (s.dirs || []).length;
  s.dirs = RWM.dirsAdd(s.dirs, p, s.cwd || s.project);
  if(s.dirs.length === before){ toast((s.dirs || []).length >= 20 ? 'En çok 20 ek klasör eklenebilir' : 'Bu klasör zaten ekli'); return; }
  renderInfo(); persist(); toast('Ek klasör eklendi · sonraki mesajdan itibaren geçerli');
}

/* ---------- Yeni sohbet: ek klasörler + "Ayrı dalda (worktree)" ---------- */
let NC_WT_T = 0;
function ncCheckWt(){
  clearTimeout(NC_WT_T);
  NC_WT_T = setTimeout(() => {
    if(!NC || !NC.wt || !NC.dir) return;
    const dir = NC.dir, name = NC.wtName;
    API.rewind.worktreeInfo(dir, name).then(r => { if(NC && NC.dir === dir && NC.wtName === name){ NC.wtInfo = {...r, name}; renderNC(); } })
      .catch(e => { if(NC){ NC.wtInfo = {ok:false, name, error:rwErr(e)}; renderNC(); } });
  }, 250);
}
function ncExtraHTML(){
  if(!NC) return '';
  NC.dirs = NC.dirs || [];
  if(NC.dir && NC.gitFor !== NC.dir){ // klasör değişti: git deposu mu?
    const dir = NC.dir; NC.gitFor = dir; NC.git = null; NC.wtInfo = null;
    API.rewind.worktreeInfo(dir).then(r => { if(NC && NC.gitFor === dir){ NC.git = r; if(NC.wt) ncCheckWt(); renderNC(); } })
      .catch(e => { if(NC && NC.gitFor === dir){ NC.git = {ok:false, repo:false, error:rwErr(e)}; renderNC(); } });
  }
  const G = NC.git, name = NC.wtName == null ? RWM.wtName(NC.title || ($('#ncTitle') || {}).value) : NC.wtName;
  const wi = NC.wtInfo && NC.wtInfo.name === name ? NC.wtInfo : null;
  const bad = !RWM.validWt(name) ? 'Geçersiz ad: yalnız harf, rakam, nokta, alt çizgi ve tire' : wi && !wi.ok ? wi.error : NC.wtErr;
  const wt = !NC.dir ? '' : !G ? '<div class="nc-wt sub">Klasör denetleniyor…</div>'
    : !G.repo ? (/Git bulunamad/.test(G.error || '') ? `<div class="nc-wt sub">${esc(G.error)}</div>` : '')
    : `<label class="nc-wt"><input type="checkbox" id="ncWt" ${NC.wt ? 'checked' : ''}> Ayrı dalda (worktree) <span class="sub">· Claude bu git deposunun ayrı bir kopyasında, kendi dalında çalışır; asıl klasör değişmez</span></label>
      ${NC.wt ? `<div class="nc-wtb"><input id="ncWtName" class="inp mono" value="${esc(name)}" maxlength="64" spellcheck="false" autocomplete="off" aria-label="Worktree adı">
        <div class="sub mono">${esc((G.root || '').replace(/[\\/]+$/, ''))}/.claude/worktrees/${esc(name)} · dal worktree-${esc(name)}</div>
        ${bad ? `<div class="nc-err">${esc(bad)}</div>` : ''}</div>` : ''}`;
  return `${wt}<label class="fl">Ek klasörler <span>· isteğe bağlı — Claude bunlara da erişebilir (--add-dir)</span></label>
    <div class="nc-dirs">${NC.dirs.map(d => `<span class="nc-sel on" title="${esc(d)}">${ic('folderPlus')}<span>${esc(d)}</span><button class="ibtn" data-ncadx="${esc(d)}" title="Kaldır">${ic('x')}</button></span>`).join('')}
      <button class="btn" data-ncadd>${ic('plus')}Klasör ekle…</button></div>`;
}
// startChat: ek klasörler ve worktree adı yeni oturuma yazılır; geçersizse false (diyalog açık kalır)
function ncApply(s){
  s.dirs = (NC.dirs || []).slice();
  if(NC.wt && NC.git && NC.git.repo){
    const name = NC.wtName == null ? RWM.wtName(NC.title) : NC.wtName;
    const wi = NC.wtInfo && NC.wtInfo.name === name ? NC.wtInfo : null;
    if(!RWM.validWt(name) || (wi && !wi.ok)){ NC.wtErr = !RWM.validWt(name) ? 'Geçersiz ad' : wi.error; renderNC(); return false; }
    s.worktree = name;
  }
  return true;
}

/* ---------- Tıklamalar (app.js'teki tek click dinleyicisinin başında çağrılır) ---------- */
function rwMenu(s, mi, x, y){
  const m = s.msgs[mi];
  menu(x, y, `<div class="mh">Buraya geri sar · ${RWM.target(s.msgs, mi).n}. mesaj</div>
    <button data-rwm="chat" data-sid="${s.id}" data-mi="${mi}">${ic('msg')}Yalnız sohbeti <span class="sub">· kod olduğu gibi kalır</span></button>
    ${RWM.canCode(m) ? `<button data-rwm="code" data-sid="${s.id}" data-mi="${mi}">${ic('rewind')}Sohbeti ve kodu <span class="sub">· dosyalar da döner, onay istenir</span></button>`
      : `<div class="rw-mnote">Bu mesaj için kod geri sarma yok</div>`}`);
}
function rwClick(t){
  const rm = t.closest('.menu [data-rwm]'); if(rm){ closeMenu(); rwStart(sess(rm.dataset.sid), +rm.dataset.mi, rm.dataset.rwm === 'code'); return true; }
  if(t.closest('.menu')) return false;
  const ue = t.closest('[data-uedit]'); if(ue){ closeMenu(); if(!ue.disabled) rwStart(sess(ue.dataset.sid), +ue.dataset.uedit, false); return true; }
  const ur = t.closest('[data-urw]'); if(ur){ closeMenu(); const s = sess(ur.dataset.sid); if(!ur.disabled && s && !s.run){ const r = ur.getBoundingClientRect(); rwMenu(s, +ur.dataset.urw, r.left - 200, r.bottom + 4); } return true; }
  const rc = t.closest('[data-rwcode]'); if(rc){ rwCode(sess(rc.dataset.rwcode)); return true; }
  const rx = t.closest('[data-rwx]'); if(rx){ rwCancel(sess(rx.dataset.rwx)); return true; }
  if(t.closest('[data-rwgo]')){ rwGo(); return true; }
  if(t.closest('[data-rwno]') || (RWD && t.id === 'rwdlg')){ if(RWD && !RWD.busy){ RWD = null; renderRwDlg(); } return true; }
  const ro = t.closest('[data-rworig]'); if(ro){ closeMenu(); if(sess(ro.dataset.rworig)){ const i = S.panes.indexOf(ro.dataset.rworig); i >= 0 ? (S.active = i, render()) : openIn(ro.dataset.rworig, S.active); } else toast('Asıl sohbet bulunamadı'); return true; }
  const aa = t.closest('[data-adadd]'); if(aa){ addDirTo(sess(aa.dataset.adadd)); return true; }
  const ax = t.closest('[data-adx]'); if(ax){ const s = sess(ax.dataset.sid); if(s){ s.dirs = RWM.dirsRemove(s.dirs, ax.dataset.adx); renderInfo(); persist(); toast('Ek klasör kaldırıldı · sonraki mesajdan itibaren'); } return true; }
  if(NC && t.closest('[data-ncadd]')){ ncSync(); API.fs.pickFolder().then(p => { if(p && NC){ NC.dirs = RWM.dirsAdd(NC.dirs, p, NC.dir); renderNC(); } }); return true; }
  const nx = NC && t.closest('[data-ncadx]'); if(nx){ ncSync(); NC.dirs = RWM.dirsRemove(NC.dirs, nx.dataset.ncadx); renderNC(); return true; }
  return false;
}
document.addEventListener('change', e => {
  if(NC && e.target.id === 'ncWt'){ ncSync(); NC.wt = e.target.checked; NC.wtErr = null; if(NC.wt && NC.wtName == null) NC.wtName = RWM.wtName(NC.title); if(NC.wt) ncCheckWt(); renderNC(); }
});
document.addEventListener('input', e => {
  if(NC && e.target.id === 'ncWtName'){ ncSync(); NC.wtName = e.target.value.trim(); NC.wtErr = null; ncCheckWt(); renderNC(); }
});
// Onay penceresi açıkken Esc kapatır (yazma kutusu tuşlarına dokunulmaz: yalnız pencere açıkken, yakalama evresinde)
document.addEventListener('keydown', e => {
  if(RWD && e.key === 'Escape' && !RWD.busy){ e.preventDefault(); e.stopPropagation(); RWD = null; renderRwDlg(); }
}, true);
