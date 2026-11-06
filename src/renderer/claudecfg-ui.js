/* Claude ayarları penceresi (Hafıza · İzinler · Ayarlar · Eklentiler ve ajanlar), "#" hafıza notu ve Markdown dışa aktarım.
   app.js'e yalnız kancalar eklenir: menü öğeleri (data-m="ccOpen" / "ccExport" / "ccNote"), send() içinde CCUI.sendHook.
   Dosya okuma/yazma ana süreçte (main/claudecfg.js: yalnız bilinen dosyalar, .bak, atomik, JSON doğrulama, çakışma denetimi).
   Saf mantık claudecfg-core.js'de (window.ccfgCore). Panel hook komutlarını çalıştırmaz, yalnız düzenler. */
(function () {
  'use strict';
  const C = window.ccfgCore;
  const api = () => window.api && window.api.ccfg;
  const h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = n => (typeof ic === 'function' ? ic(n) : '');
  const say = t => (typeof toast === 'function' ? toast(t) : console.log(t));
  const MD_KEYS = ['user-md', 'proj-md', 'proj-dot-md', 'proj-local-md'];
  const SET_KEYS = ['user-settings', 'proj-settings', 'proj-local'];
  const TABS = [['mem', 'Hafıza'], ['perm', 'İzinler'], ['set', 'Ayarlar'], ['ext', 'Eklentiler ve ajanlar']];
  const SUBS = [['raw', 'Ham JSON'], ['hooks', "Hook'lar"], ['style', 'Output style'], ['status', 'Statusline']];
  const KIND_L = { allow: 'İzin ver', ask: 'Sor', deny: 'Reddet' };

  const CC = { tab: 'mem', cwd: null, cwdErr: null, files: [], cache: {}, drafts: {}, mem: 'user-md', set: 'user-settings', sub: 'raw',
    extras: null, warn: null, err: null, editRule: null, editHook: null, plugTarget: 'user-settings', busy: false, note: null };
  const el = () => document.getElementById('ccfg');
  const fileOf = k => CC.files.find(f => f.key === k);
  const label = k => (fileOf(k) || {}).label || k;
  const short = k => label(k).split(' · ')[0];

  function cwdOf(s) { const d = s && (s.cwd || s.project); return d && d !== '(bilinmiyor)' ? d : null; }
  function activeSess() { try { return sess(S.panes[S.active]); } catch { return null; } }

  async function load() {
    const A = api();
    let r;
    try { r = await A.list(CC.cwd); CC.cwdErr = null; }
    catch (e) { CC.cwdErr = String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''); CC.cwd = null; r = await A.list(null); }
    CC.files = r.files; CC.roots = r.roots;
    await Promise.all(CC.files.map(f => reload(f.key)));
    try { CC.extras = await A.extras(CC.cwd); } catch (e) { CC.extras = { styles: [], agents: [], plugins: { list: [], error: String(e.message || e) } }; }
    if (!fileOf(CC.mem)) CC.mem = 'user-md';
    if (!fileOf(CC.set)) CC.set = 'user-settings';
    if (!fileOf(CC.plugTarget)) CC.plugTarget = 'user-settings';
  }
  async function reload(key) { CC.cache[key] = await api().read(key, CC.cwd); delete CC.drafts[key]; }

  async function open(o = {}) {
    if (!api()) return;
    const s = o.sid ? sess(o.sid) : activeSess();
    CC.cwd = o.cwd !== undefined ? o.cwd : cwdOf(s);
    if (o.tab) CC.tab = o.tab;
    CC.warn = CC.err = CC.editRule = CC.editHook = null;
    let m = el();
    if (!m) { m = document.createElement('div'); m.id = 'ccfg'; m.className = 'modal-bg'; document.body.appendChild(m); m.addEventListener('click', onClick); m.addEventListener('input', onInput); m.addEventListener('change', onChange); }
    m.innerHTML = '<div class="modal cc-modal"><div class="mb">Yükleniyor…</div></div>';
    await load(); paint();
  }
  function close() { const m = el(); if (m) m.remove(); }

  // ---------- Çizim ----------
  function paint() {
    const m = el(); if (!m) return;
    const sc = m.querySelector('.cc-body'); const top = sc ? sc.scrollTop : 0;
    const proj = CC.cwd ? `<span class="mono" title="${h(CC.cwd)}">${h(CC.cwd)}</span>` : '<span>proje seçili değil · yalnız kullanıcı dosyaları</span>';
    m.innerHTML = `<div class="modal cc-modal" role="dialog" aria-label="Claude ayarları">
      <div class="mh2"><h3>Claude ayarları<div class="cc-sub">Proje: ${proj}${CC.cwdErr ? ` <span class="cc-bad">(${h(CC.cwdErr)})</span>` : ''}</div></h3><button class="ibtn" data-cc="close">${icon('x')}</button></div>
      <div class="cc-tabs">${TABS.map(([k, l]) => `<button data-cc="tab" data-k="${k}" class="${CC.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${CC.warn ? `<div class="cc-warn">${icon('shield')}<span><b>${h(short(CC.warn.key))} dosyası panel dışında değişti.</b> Üzerine yazarsan o değişiklik kaybolur (eski içerik .bak'ta kalır).</span><button class="btn" data-cc="reloadw">Yeniden yükle</button><button class="btn pri" data-cc="force">Üzerine yaz</button></div>` : ''}
      ${CC.err ? `<div class="cc-err">${h(CC.err)}<button class="ibtn" data-cc="errx">${icon('x')}</button></div>` : ''}
      <div class="cc-body">${CC.tab === 'mem' ? memTab() : CC.tab === 'perm' ? permTab() : CC.tab === 'set' ? setTab() : extTab()}</div></div>`;
    const nb = m.querySelector('.cc-body'); if (nb) nb.scrollTop = top;
    if (CC.tab === 'set' && CC.sub === 'raw') checkRaw();
  }
  const fileBtn = (k, cur, attr) => { const f = CC.cache[k]; return `<button data-cc="${attr}" data-k="${k}" class="cc-file ${cur === k ? 'on' : ''}"><b>${h(short(k))}</b><span>${h(label(k).split(' · ')[1] || '')}</span>${f && f.exists ? '' : '<em>yok</em>'}${f && f.error ? '<em class="cc-bad">bozuk</em>' : ''}</button>`; };
  const pathLine = f => `<div class="cc-path mono" title="${h(f.path)}">${h(f.path)}</div>`;

  function memTab() {
    const keys = MD_KEYS.filter(fileOf), f = CC.cache[CC.mem];
    const val = CC.drafts[CC.mem] !== undefined ? CC.drafts[CC.mem] : f.text;
    return `<div class="cc-split"><div class="cc-files">${keys.map(k => fileBtn(k, CC.mem, 'mem')).join('')}
        <div class="cc-hint">Mesaj kutusunda <b>#</b> ile başlayan tek satır gönderilmez; seçtiğin CLAUDE.md'nin sonuna madde olarak eklenir.</div></div>
      <div class="cc-ed">${pathLine(f)}${f.exists ? '' : '<div class="cc-hint">Dosya yok · kaydedince oluşturulur.</div>'}
        <textarea class="cc-ta mono" data-cc-ta="${CC.mem}" spellcheck="false" placeholder="# Proje notları">${h(val)}</textarea>
        <div class="cc-acts"><button class="btn" data-cc="revert" data-k="${CC.mem}">Geri al</button><span class="grow"></span><button class="btn pri" data-cc="savetext" data-k="${CC.mem}">${f.exists ? 'Kaydet' : 'Oluştur ve kaydet'}</button></div></div></div>`;
  }
  const setKeys = () => SET_KEYS.filter(fileOf);
  const badJson = k => { const f = CC.cache[k]; return f && f.exists && f.error ? `<div class="cc-err">${h(label(k))}: JSON hatası, satır ${f.error.line}, sütun ${f.error.col} · ${h(f.error.error)}. Düzeltmek için Ayarlar → Ham JSON.</div>` : ''; };

  function permTab() {
    const keys = setKeys();
    const rows = C.listRules(keys.map(k => ({ key: k, label: short(k), obj: CC.cache[k].parsed })));
    const ed = CC.editRule;
    const row = r => (ed && ed.key === r.key && ed.kind === r.kind && ed.index === r.index)
      ? `<tr class="cc-editing"><td colspan="3"><input class="inp mono" id="ccRuleEd" value="${h(r.rule)}"><div class="cc-msg" id="ccRuleEdMsg"></div></td><td class="cc-ra"><button class="btn pri" data-cc="ruleok">Kaydet</button><button class="btn" data-cc="rulecancel">Vazgeç</button></td></tr>`
      : `<tr><td class="mono">${h(r.rule)}</td><td><span class="cc-kind ${r.kind}">${KIND_L[r.kind]}</span></td><td>${h(r.label)}</td>
        <td class="cc-ra"><button class="ibtn" data-cc="ruleedit" data-k="${r.key}" data-kind="${r.kind}" data-i="${r.index}" title="Düzenle">${icon('edit')}</button><button class="ibtn" data-cc="ruledel" data-k="${r.key}" data-kind="${r.kind}" data-i="${r.index}" title="Sil">${icon('trash')}</button></td></tr>`;
    const info = keys.map(k => { const p = C.permInfo(CC.cache[k].parsed); return `<div class="cc-kv"><b>${h(short(k))}</b><span>defaultMode: <span class="mono">${h(p.defaultMode || '—')}</span></span><span>additionalDirectories: ${p.additionalDirectories.length ? p.additionalDirectories.map(d => `<span class="mono">${h(d)}</span>`).join(', ') : '—'}</span></div>`; }).join('');
    return `${keys.map(badJson).join('')}
      <div class="cc-add"><input class="inp mono" id="ccRule" placeholder="ör. Bash(npm run test:*) · Read(./src/**) · WebFetch(domain:example.com)">
        <select class="inp cc-sel" id="ccKind">${C.KINDS.map(k => `<option value="${k}">${KIND_L[k]}</option>`).join('')}</select>
        <select class="inp cc-sel" id="ccSrc">${keys.map(k => `<option value="${k}">${h(short(k))}</option>`).join('')}</select>
        <button class="btn pri" data-cc="ruleadd">${icon('plus')}Ekle</button></div>
      <div class="cc-msg" id="ccRuleMsg"></div>
      ${rows.length ? `<table class="cc-tbl"><thead><tr><th>Kural</th><th>Tür</th><th>Kaynak</th><th></th></tr></thead><tbody>${rows.map(row).join('')}</tbody></table>` : '<div class="cc-empty">Tanımlı izin kuralı yok.</div>'}
      <div class="fl">Diğer izin ayarları <span>· yalnız görüntülenir; Ham JSON'dan değiştirilebilir</span></div>${info}
      <div class="cc-hint">Öncelik: Reddet → Sor → İzin ver; yerel ayar projeyi, proje kullanıcıyı geçersiz kılar. Panelin kendi izin modu bu ayarlardan bağımsızdır.</div>`;
  }

  function setTab() {
    const keys = setKeys(), f = CC.cache[CC.set];
    return `<div class="cc-row"><div class="seg">${keys.map(k => `<button data-cc="set" data-k="${k}" class="${CC.set === k ? 'on' : ''}">${h(short(k))}</button>`).join('')}</div>
      <span class="grow"></span><div class="seg">${SUBS.map(([k, l]) => `<button data-cc="sub" data-k="${k}" class="${CC.sub === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      ${pathLine(f)}${f.exists ? '' : '<div class="cc-hint">Dosya yok · kaydedince oluşturulur.</div>'}
      ${CC.sub === 'raw' ? rawSub(f) : f.exists && f.error ? badJson(CC.set) : CC.sub === 'hooks' ? hookSub(f) : CC.sub === 'style' ? styleSub(f) : statusSub(f)}`;
  }
  function rawSub(f) {
    const val = CC.drafts[CC.set] !== undefined ? CC.drafts[CC.set] : (f.exists ? f.text : '{\n}\n');
    return `<textarea class="cc-ta cc-raw mono" data-cc-ta="${CC.set}" spellcheck="false">${h(val)}</textarea>
      <div class="cc-acts"><span class="cc-msg" id="ccRawMsg"></span><span class="grow"></span><button class="btn" data-cc="revert" data-k="${CC.set}">Geri al</button><button class="btn pri" data-cc="saveraw" data-k="${CC.set}">Kaydet</button></div>`;
  }
  function hookSub(f) {
    const rows = C.hookRows(f.parsed), ed = CC.editHook;
    const cur = ed ? rows.find(r => r.event === ed.event && r.gi === ed.gi && r.hi === ed.hi) : null;
    const v = cur || { event: 'PreToolUse', matcher: '', command: '', timeout: '' };
    return `<div class="cc-hint">Panel hook komutlarını <b>çalıştırmaz</b>, yalnız düzenler; komutları Claude Code çalıştırır. Bilinmeyen alanlar (ör. <span class="mono">args</span>) korunur.</div>
      ${rows.length ? `<table class="cc-tbl"><thead><tr><th>Olay</th><th>Eşleştirici</th><th>Komut</th><th>Süre</th><th></th></tr></thead><tbody>${rows.map(r => `<tr class="${cur === r ? 'cc-editing' : ''}"><td>${h(r.event)}</td><td class="mono">${h(r.matcher || '—')}</td>
        <td class="mono cc-cmd">${h(r.command)}${r.extra && r.extra.args ? ` <span class="cc-faint">${h(JSON.stringify(r.extra.args))}</span>` : ''}${r.type !== 'command' ? ` <em>(${h(r.type)})</em>` : ''}</td><td>${r.timeout == null ? '—' : r.timeout + ' sn'}</td>
        <td class="cc-ra"><button class="ibtn" data-cc="hookedit" data-ev="${h(r.event)}" data-gi="${r.gi}" data-hi="${r.hi}" title="Düzenle">${icon('edit')}</button><button class="ibtn" data-cc="hookdel" data-ev="${h(r.event)}" data-gi="${r.gi}" data-hi="${r.hi}" title="Sil">${icon('trash')}</button></td></tr>`).join('')}</tbody></table>` : '<div class="cc-empty">Bu dosyada hook yok.</div>'}
      <div class="fl">${cur ? 'Hook\'u düzenle' : 'Yeni hook'}</div>
      <div class="cc-add"><select class="inp cc-sel" id="ccHEv">${[...new Set(C.HOOK_EVENTS.concat(v.event))].map(e => `<option ${e === v.event ? 'selected' : ''}>${h(e)}</option>`).join('')}</select>
        <input class="inp mono cc-w1" id="ccHMt" placeholder="eşleştirici (ör. Bash|Edit) · boş = tümü" value="${h(v.matcher)}">
        <input class="inp cc-w0" id="ccHTo" placeholder="sn" value="${h(v.timeout == null ? '' : v.timeout)}"></div>
      <div class="cc-add"><input class="inp mono" id="ccHCmd" placeholder="komut (ör. npx prettier --write)" value="${h(v.command)}">
        ${cur ? `<button class="btn" data-cc="hookcancel">Vazgeç</button><button class="btn pri" data-cc="hooksave">Kaydet</button>` : `<button class="btn pri" data-cc="hookadd">${icon('plus')}Ekle</button>`}</div>`;
  }
  function styleSub(f) {
    const cur = f.parsed && typeof f.parsed.outputStyle === 'string' ? f.parsed.outputStyle : '';
    const styles = (CC.extras && CC.extras.styles) || C.BUILTIN_STYLES.map(name => ({ name, source: 'yerleşik' }));
    const opts = styles.slice(); if (cur && !opts.some(s => s.name === cur)) opts.push({ name: cur, source: 'dosyada · bulunamadı' });
    return `<div class="fl">outputStyle <span>· şu an: ${cur ? `<span class="mono">${h(cur)}</span>` : 'ayarlanmamış (üst katman ya da varsayılan)'}</span></div>
      <div class="cc-add"><select class="inp" id="ccStyle"><option value="">(ayarlanmamış)</option>${opts.map(s => `<option value="${h(s.name)}" ${s.name === cur ? 'selected' : ''}>${h(s.name)} · ${h(s.source)}</option>`).join('')}</select>
        <button class="btn pri" data-cc="stylesave">Kaydet</button></div>
      <div class="cc-hint">Seçenekler: yerleşikler + <span class="mono">~/.claude/output-styles/*.md</span>${CC.cwd ? ' + <span class="mono">.claude/output-styles/*.md</span>' : ''}. Panelden gönderilen mesajlarda da Claude Code bu ayarı okur.</div>`;
  }
  function statusSub(f) {
    const sl = f.parsed && f.parsed.statusLine && typeof f.parsed.statusLine === 'object' ? f.parsed.statusLine : {};
    return `<div class="fl">statusLine <span>· Claude Code terminal arayüzünün durum satırı (type: command)</span></div>
      <div class="cc-add"><input class="inp mono" id="ccSlCmd" placeholder="komut (ör. ~/.claude/statusline.sh)" value="${h(sl.command || '')}">
        <input class="inp cc-w0" id="ccSlPad" placeholder="padding" value="${h(sl.padding == null ? '' : sl.padding)}"></div>
      <div class="cc-acts"><span class="grow"></span>${sl.command ? '<button class="btn" data-cc="slremove">Kaldır</button>' : ''}<button class="btn pri" data-cc="slsave">Kaydet</button></div>`;
  }

  function extTab() {
    const ex = CC.extras || {}, P = ex.plugins || { list: [] }, keys = setKeys();
    const layers = keys.slice().reverse().map(k => ({ key: k, label: short(k), obj: CC.cache[k].parsed }));
    const plug = P.list.map(p => { const st = C.pluginState(p.id, layers);
      return `<div class="cc-item"><label class="cc-sw"><input type="checkbox" data-cc-plug="${h(p.id)}" ${st.on ? 'checked' : ''}><span></span></label>
        <div class="cc-it"><b>${h(p.name)}</b> <span class="cc-faint">${h(p.marketplace)}${p.version ? ' · ' + h(p.version) : ''} · ${h(p.scope)}</span>
        <div>${h(p.description || '')}</div><div class="cc-faint">${st.source ? `${st.on ? 'Açık' : 'Kapalı'} · ${h(st.label)} ayarından` : 'enabledPlugins içinde yok'}</div></div></div>`; }).join('');
    const ag = (ex.agents || []).map(a => `<div class="cc-item"><div class="cc-it"><b>${h(a.name)}</b> <span class="cc-faint">${a.scope === 'user' ? 'kullanıcı' : 'proje'} · ${h(a.file)}${a.model ? ' · model: ' + h(a.model) : ''}</span>
        <div>${h(a.description)}</div>${a.tools.length ? `<div class="cc-faint">araçlar: ${a.tools.map(h).join(', ')}</div>` : ''}</div>
        <button class="btn" data-cc="agentopen" data-scope="${a.scope}" data-file="${h(a.file)}">${icon('ext')}Aç</button></div>`).join('');
    return `${keys.map(badJson).join('')}<div class="cc-row"><div class="fl" style="margin:0">Eklentiler</div><span class="grow"></span><span class="cc-faint">anahtar şuraya yazılır:</span>
        <select class="inp cc-sel" id="ccPlugT">${keys.map(k => `<option value="${k}" ${CC.plugTarget === k ? 'selected' : ''}>${h(short(k))}</option>`).join('')}</select></div>
      ${P.error ? `<div class="cc-err">${h(P.error)}</div>` : ''}
      ${plug || `<div class="cc-empty">Kurulu eklenti yok <span class="cc-faint">(${h(P.file || 'installed_plugins.json')} bulunamadı ya da boş)</span>.</div>`}
      <div class="fl">Ajanlar <span>· ~/.claude/agents ve .claude/agents</span></div>
      ${ag || '<div class="cc-empty">Tanımlı ajan yok.</div>'}
      <div class="cc-hint">Claude Code'da ajanlar için ayrı bir "kapalı" ayarı yok; bir ajanı kapatmak için dosyasını kaldır ya da taşı.</div>`;
  }

  // ---------- Yazma ----------
  function errMsg(e) { return String((e && e.message) || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''); }
  async function doWrite(key, text, force) {
    const f = CC.cache[key];
    let r;
    try { r = await api().write(key, CC.cwd, text, { expectHash: f ? f.hash : null, force: !!force }); }
    catch (e) { CC.err = errMsg(e); paint(); return false; }
    if (r.conflict) { CC.warn = { key, text }; paint(); return false; }
    if (r.invalid) { CC.err = `Kaydedilmedi: JSON hatası, satır ${r.line}, sütun ${r.col} · ${r.error}`; paint(); return false; }
    CC.warn = null; CC.err = null;
    await reload(key);
    if (key.endsWith('settings') || key === 'proj-local') try { CC.extras = await api().extras(CC.cwd); } catch {}
    say('Kaydedildi · ' + short(key) + (r.backup ? ' (önceki hali .bak)' : '')); paint();
    return true;
  }
  async function mutate(key, fn) {
    const f = CC.cache[key];
    if (f.exists && f.error) { CC.err = `${label(key)} bozuk JSON içeriyor; önce Ham JSON'dan düzelt.`; paint(); return false; }
    let o; try { o = fn(f.parsed || {}); } catch (e) { CC.err = errMsg(e); paint(); return false; }
    return doWrite(key, C.stringify(o));
  }
  function checkRaw() {
    const ta = el() && el().querySelector('.cc-raw'), msg = el() && el().querySelector('#ccRawMsg'); if (!ta || !msg) return null;
    const c = C.jsonCheck(ta.value, { object: true });
    msg.className = 'cc-msg ' + (c.ok ? 'ok' : 'bad');
    msg.textContent = c.ok ? 'Geçerli JSON' : `Satır ${c.line}, sütun ${c.col}: ${c.error}`;
    const b = el().querySelector('[data-cc="saveraw"]'); if (b) b.disabled = !c.ok;
    return c;
  }
  function ruleMsg(inp, out) {
    if (!inp || !out) return null;
    const v = inp.value.trim() ? C.validateRule(inp.value) : null;
    out.className = 'cc-msg ' + (!v ? '' : v.ok ? (v.warn ? 'warn' : 'ok') : 'bad');
    out.textContent = !v ? '' : v.ok ? (v.warn ? 'Uyarı: ' + v.warn : 'Geçerli kural') : v.error;
    return v;
  }
  const val = id => { const x = el().querySelector('#' + id); return x ? x.value : ''; };

  async function onClick(e) {
    const m = el(); if (e.target === m) { close(); return; }
    const b = e.target.closest('[data-cc]'); if (!b || b.disabled) return;
    const d = b.dataset, k = d.cc;
    if (k === 'close') return close();
    if (k === 'errx') { CC.err = null; return paint(); }
    if (k === 'tab') { CC.tab = d.k; CC.editRule = CC.editHook = null; return paint(); }
    if (k === 'mem') { CC.mem = d.k; return paint(); }
    if (k === 'set') { CC.set = d.k; CC.editHook = null; return paint(); }
    if (k === 'sub') { CC.sub = d.k; CC.editHook = null; return paint(); }
    if (k === 'revert') { await reload(d.k); CC.err = null; return paint(); }
    if (k === 'reloadw') { const w = CC.warn; CC.warn = null; if (w) await reload(w.key); return paint(); }
    if (k === 'force') { const w = CC.warn; if (w) await doWrite(w.key, w.text, true); return; }
    if (k === 'savetext') { const ta = m.querySelector(`[data-cc-ta="${d.k}"]`); return doWrite(d.k, ta ? ta.value : ''); }
    if (k === 'saveraw') { const c = checkRaw(); if (!c || !c.ok) { CC.err = 'Kaydedilmedi: JSON geçersiz.'; return paint(); } return doWrite(d.k, m.querySelector('.cc-raw').value); }
    if (k === 'ruleadd') {
      const v = ruleMsg(m.querySelector('#ccRule'), m.querySelector('#ccRuleMsg')); if (!v || !v.ok) { if (!v) say('Önce bir kural yaz'); return; }
      const kind = val('ccKind'), src = val('ccSrc');
      if (await mutate(src, o => C.addRule(o, kind, v.rule))) say(`Kural eklendi · ${KIND_L[kind]} · ${short(src)}`);
      return;
    }
    if (k === 'ruleedit') { CC.editRule = { key: d.k, kind: d.kind, index: +d.i }; paint(); const i = m.querySelector('#ccRuleEd'); if (i) i.focus(); return; }
    if (k === 'rulecancel') { CC.editRule = null; return paint(); }
    if (k === 'ruleok') { const r = CC.editRule; if (!r) return; const ok = await mutate(r.key, o => C.editRule(o, r.kind, r.index, val('ccRuleEd'))); if (ok) { CC.editRule = null; paint(); } return; }
    if (k === 'ruledel') { const rule = (((CC.cache[d.k].parsed || {}).permissions || {})[d.kind] || [])[+d.i]; if (await mutate(d.k, o => C.removeRule(o, d.kind, +d.i))) say('Kural silindi · ' + rule); return; }
    const hookIn = () => ({ event: val('ccHEv'), matcher: val('ccHMt'), command: val('ccHCmd'), timeout: val('ccHTo').trim() });
    if (k === 'hookadd') { if (await mutate(CC.set, o => C.addHook(o, hookIn()))) say('Hook eklendi'); return; }
    if (k === 'hookedit') { CC.editHook = { event: d.ev, gi: +d.gi, hi: +d.hi }; return paint(); }
    if (k === 'hookcancel') { CC.editHook = null; return paint(); }
    if (k === 'hooksave') { const x = CC.editHook; if (x && await mutate(CC.set, o => C.editHook(o, x.event, x.gi, x.hi, hookIn()))) { CC.editHook = null; paint(); } return; }
    if (k === 'hookdel') { if (await mutate(CC.set, o => C.removeHook(o, d.ev, +d.gi, +d.hi))) { CC.editHook = null; paint(); } return; }
    if (k === 'stylesave') return mutate(CC.set, o => C.setOutputStyle(o, val('ccStyle')));
    if (k === 'slsave') return mutate(CC.set, o => C.setStatusLine(o, { command: val('ccSlCmd'), padding: val('ccSlPad').trim() }));
    if (k === 'slremove') return mutate(CC.set, o => C.setStatusLine(o, null));
    if (k === 'agentopen') { try { if (!(await api().openAgent(d.scope, d.file, CC.cwd))) say('Dosya açılamadı'); } catch (er) { say(errMsg(er)); } return; }
  }
  function onInput(e) {
    const t = e.target;
    if (t.matches('[data-cc-ta]')) { CC.drafts[t.dataset.ccTa] = t.value; if (t.classList.contains('cc-raw')) checkRaw(); return; }
    if (t.id === 'ccRule') ruleMsg(t, el().querySelector('#ccRuleMsg'));
    if (t.id === 'ccRuleEd') ruleMsg(t, el().querySelector('#ccRuleEdMsg'));
  }
  async function onChange(e) {
    const t = e.target;
    if (t.id === 'ccPlugT') { CC.plugTarget = t.value; return; }
    if (t.matches('[data-cc-plug]')) {
      const id = t.dataset.ccPlug, on = t.checked;
      if (await mutate(CC.plugTarget, o => C.setPluginEnabled(o, id, on))) say(`${id} ${on ? 'açıldı' : 'kapatıldı'} · ${short(CC.plugTarget)} · yeni sohbetlerde geçerli`);
      else paint();
    }
  }
  // Pencere açıkken klavye olayları uygulamanın kısayollarına gitmez (yazarken ⌘N, ⌫ vb. tetiklenmesin); Esc kapatır, Enter ekler
  document.addEventListener('keydown', e => {
    const m = el(); if (!m) return;
    if (document.querySelector('.menu') && e.key === 'Escape') return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (CC.editRule || CC.editHook) { CC.editRule = CC.editHook = null; paint(); } else close(); return; }
    if (!m.contains(e.target) && e.target !== document.body) return;
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey && e.target.matches('input')) {
      e.preventDefault();
      const map = { ccRule: 'ruleadd', ccRuleEd: 'ruleok', ccHCmd: CC.editHook ? 'hooksave' : 'hookadd', ccSlCmd: 'slsave' };
      const b = map[e.target.id] && m.querySelector(`[data-cc="${map[e.target.id]}"]`); if (b) b.click();
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); const b = m.querySelector('[data-cc="savetext"],[data-cc="saveraw"]'); if (b) b.click(); }
  }, true);

  // ---------- "#" hafıza notu (send() kancası) ----------
  // true dönerse mesaj gönderilmez: kapsam seçimi gösterilir, seçilince not eklenir ve yazma kutusu temizlenir
  function sendHook(i, s, text, ta) {
    const note = C.memoryNote(text);
    if (!note || !api() || (s.attach && s.attach.length)) return false;
    const cwd = cwdOf(s);
    CC.note = { i, sid: s.id, note, text, cwd };
    const r = ta.getBoundingClientRect();
    menu(r.left, r.top - 120, `<div class="mh">Hafızaya not ekle · gönderilmez</div>
      <button data-m="ccNote" data-scope="user">${icon('note')}Kullanıcı <span class="cc-mfaint">~/.claude/CLAUDE.md</span></button>
      ${cwd ? `<button data-m="ccNote" data-scope="proj">${icon('folder')}Proje <span class="cc-mfaint">${h(String(cwd).split(/[\\/]/).pop())}/CLAUDE.md</span></button>` : '<div class="mh">Proje: klasörü bilinmiyor</div>'}`);
    return true;
  }
  async function addNote(scope) {
    const n = CC.note; CC.note = null; if (!n) return;
    try {
      const r = await api().note(scope, scope === 'proj' ? n.cwd : null, n.note);
      const ta = document.querySelector(`[data-ta="${n.i}"]`);
      if (ta && ta.value.trim() === n.text) { ta.value = ''; ta.dispatchEvent(new Event('input', { bubbles: true })); }
      const s = sess(n.sid); if (s) s.inputDraft = '';
      say('Hafızaya eklendi · ' + r.path);
      if (el()) { await load(); paint(); }
    } catch (e) { say('Not eklenemedi: ' + errMsg(e)); }
  }

  // ---------- Markdown dışa aktarım ----------
  async function exportMd(id) {
    const s = sess(id); if (!s) return;
    let msgs = s.msgs || [], skipped = 0;
    if (!s.draft) try { const full = await window.api.sessions.load(id, 1e6); if (full && Array.isArray(full.msgs)) { msgs = full.msgs; skipped = full.skipped || 0; } } catch {}
    const md = C.toMarkdown({ title: s.title, project: s.project, id: s.draft ? null : s.id, model: s.model, msgs, skipped });
    try { const fp = await api().exportMd(C.exportName(s.title), md); say(fp ? 'Dışa aktarıldı · ' + fp : 'Dışa aktarma iptal edildi'); return fp; }
    catch (e) { say('Dışa aktarılamadı: ' + errMsg(e)); return null; }
  }

  // Menü kancası (app.js tıklama işleyicisi: data-m="cc…")
  function onMenu(d) {
    if (d.m === 'ccOpen') return open({ sid: d.id || null });
    if (d.m === 'ccExport') return exportMd(d.id);
    if (d.m === 'ccNote') return addNote(d.scope);
  }
  const menuItems = id => `<button data-m="ccOpen" data-id="${h(id)}">${icon('sliders')}Claude ayarları…</button><button data-m="ccExport" data-id="${h(id)}">${icon('file')}Dışa aktar (Markdown)</button>`;

  window.CCUI = { open, close, sendHook, onMenu, menuItems, exportMd, _state: CC };
})();
