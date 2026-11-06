// Claude ayarları: saf mantık (izin kuralları, hook ağacı, JSON denetimi, frontmatter, # hafıza notu, Markdown dışa aktarım).
// Tarayıcıda window.ccfgCore, Node'da module.exports (ana süreç claudecfg.js de buradan jsonCheck/appendNote kullanır).
// Dosyalardaki bilinmeyen anahtarlar korunur: her değişiklik nesnenin kopyası üzerinde yalnız ilgili yolu değiştirir.
(function (root) {
  'use strict';
  const clone = o => JSON.parse(JSON.stringify(o));
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

  // ---------- JSON denetimi (hata satır/sütunla) ----------
  function posToLineCol(text, pos) {
    const before = text.slice(0, pos).split('\n');
    return { line: before.length, col: before[before.length - 1].length + 1 };
  }
  // Küçük JSON doğrulayıcı: ilk hatanın konumu ve Türkçe açıklaması ({pos, msg}); geçerliyse null
  function scanJson(s) {
    let i = 0;
    const NUM = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
    const fail = msg => { throw { pos: i, msg }; };
    const ws = () => { while (i < s.length && ' \t\n\r'.includes(s[i])) i++; };
    const str = () => {
      i++;
      while (i < s.length) {
        const c = s[i];
        if (c === '"') { i++; return; }
        if (c === '\\') {
          const n = s[i + 1];
          if (n === 'u') { if (!/^[0-9a-fA-F]{4}$/.test(s.substr(i + 2, 4))) fail('Geçersiz \\u kaçışı'); i += 6; continue; }
          if (n === undefined || !'"\\/bfnrt'.includes(n)) fail('Geçersiz kaçış dizisi (\\)');
          i += 2; continue;
        }
        if (c < ' ') fail('Metin içinde satır sonu ya da kontrol karakteri: tırnak kapanmamış olabilir');
        i++;
      }
      fail('Kapanmamış metin: " eksik');
    };
    const val = () => {
      ws();
      const c = s[i];
      if (c === '{') {
        i++; ws(); if (s[i] === '}') { i++; return; }
        for (;;) {
          ws(); if (s[i] !== '"') fail('Anahtar bekleniyordu (çift tırnaklı metin)');
          str(); ws(); if (s[i] !== ':') fail('":" bekleniyordu');
          i++; val(); ws();
          if (s[i] === ',') { i++; continue; }
          if (s[i] === '}') { i++; return; }
          fail('"," ya da "}" bekleniyordu');
        }
      }
      if (c === '[') {
        i++; ws(); if (s[i] === ']') { i++; return; }
        for (;;) { val(); ws(); if (s[i] === ',') { i++; continue; } if (s[i] === ']') { i++; return; } fail('"," ya da "]" bekleniyordu'); }
      }
      if (c === '"') return str();
      NUM.lastIndex = i; const m = NUM.exec(s);
      if (m) { i += m[0].length; return; }
      for (const w of ['true', 'false', 'null']) if (s.startsWith(w, i)) { i += w.length; return; }
      fail(i >= s.length ? 'Beklenmeyen dosya sonu' : `Beklenmeyen karakter: ${c}`);
    };
    try { val(); ws(); if (i < s.length) fail('JSON bittikten sonra fazladan içerik'); return null; }
    catch (e) { return e && typeof e.pos === 'number' ? e : null; } // ör. çok derin iç içe yapı: yığın taşar, konum dosya sonu sayılır
  }
  function jsonCheck(text, opts = {}) {
    const src = String(text == null ? '' : text);
    if (!src.trim()) {
      if (opts.allowEmpty) return { ok: true, value: {} };
      return { ok: false, error: 'Dosya boş', line: 1, col: 1 };
    }
    let value;
    try { value = JSON.parse(src); } catch (e) {
      // V8'in iletisi sürüme göre konum vermiyor (Node 24: yalnız alıntı); konumu kendi tarayıcımız bulur
      const f = scanJson(src) || { pos: src.length, msg: String((e && e.message) || e) };
      const { line, col } = posToLineCol(src, f.pos);
      return { ok: false, error: f.msg, line, col };
    }
    if (opts.object && !isObj(value)) return { ok: false, error: 'Kök bir JSON nesnesi ({ … }) olmalı', line: 1, col: 1 };
    return { ok: true, value };
  }
  const stringify = obj => JSON.stringify(obj, null, 2) + '\n';

  // ---------- İzin kuralları ----------
  const KINDS = ['allow', 'ask', 'deny'];
  const KNOWN_TOOLS = ['Agent', 'Bash', 'Edit', 'Glob', 'Grep', 'LS', 'MultiEdit', 'NotebookEdit', 'NotebookRead', 'PowerShell', 'Read',
    'Skill', 'SlashCommand', 'Task', 'TodoWrite', 'WebFetch', 'WebSearch', 'Write', 'ExitPlanMode', 'BashOutput', 'KillShell', 'Monitor'];
  // "Araç" ya da "Araç(belirteç)"; mcp__sunucu, mcp__sunucu__araç, mcp__sunucu__* biçimleri de geçerli
  function parseRule(str) {
    const s = String(str == null ? '' : str).trim();
    const m = /^([A-Za-z][A-Za-z0-9_*-]*)(?:\((.*)\))?$/s.exec(s);
    if (!m) return null;
    return { tool: m[1], spec: m[2] === undefined ? null : m[2] };
  }
  function validateRule(str) {
    const s = String(str == null ? '' : str).trim();
    if (!s) return { ok: false, error: 'Kural boş' };
    if (/[\r\n]/.test(s)) return { ok: false, error: 'Kural tek satır olmalı' };
    const open = s.indexOf('(');
    if (open >= 0 && !s.endsWith(')')) return { ok: false, error: 'Parantez kapanmamış: kural ")" ile bitmeli' };
    if (open < 0 && s.includes(')')) return { ok: false, error: 'Açılmamış parantez' };
    const r = parseRule(s);
    if (!r) return { ok: false, error: 'Geçersiz araç adı (ör. Bash, Read, mcp__sunucu__araç)' };
    if (r.spec !== null && !r.spec.trim()) return { ok: false, error: 'Parantez içi boş: belirteci yaz ya da parantezi kaldır' };
    let depth = 0;
    for (const ch of r.spec || '') { if (ch === '(') depth++; if (ch === ')') depth--; if (depth < 0) break; }
    if (depth !== 0) return { ok: false, error: 'Parantezler dengeli değil' };
    const warn = r.tool.startsWith('mcp__') || KNOWN_TOOLS.includes(r.tool) ? null : `"${r.tool}" bilinen bir araç adı değil`;
    if (r.tool.startsWith('mcp__') && r.spec !== null) return { ok: false, error: 'MCP kuralları parantez almaz (ör. mcp__sunucu__araç)' };
    return { ok: true, rule: s, tool: r.tool, spec: r.spec, warn };
  }
  // sources: [{key, label, obj}] → [{key, label, kind, index, rule}]
  function listRules(sources) {
    const out = [];
    for (const src of sources || []) {
      const p = src && isObj(src.obj) && isObj(src.obj.permissions) ? src.obj.permissions : null;
      if (!p) continue;
      for (const kind of KINDS) (Array.isArray(p[kind]) ? p[kind] : []).forEach((rule, index) => {
        out.push({ key: src.key, label: src.label, kind, index, rule: String(rule) });
      });
    }
    return out;
  }
  function permInfo(obj) {
    const p = isObj(obj) && isObj(obj.permissions) ? obj.permissions : {};
    return { defaultMode: typeof p.defaultMode === 'string' ? p.defaultMode : null,
      additionalDirectories: Array.isArray(p.additionalDirectories) ? p.additionalDirectories.map(String) : [] };
  }
  function withPerm(obj, kind) {
    if (!KINDS.includes(kind)) throw new Error('Bilinmeyen kural türü: ' + kind);
    const o = isObj(obj) ? clone(obj) : {};
    if (!isObj(o.permissions)) o.permissions = {};
    if (!Array.isArray(o.permissions[kind])) o.permissions[kind] = [];
    return o;
  }
  function addRule(obj, kind, rule) {
    const v = validateRule(rule); if (!v.ok) throw new Error(v.error);
    const o = withPerm(obj, kind);
    if (o.permissions[kind].includes(v.rule)) throw new Error('Bu kural zaten var');
    o.permissions[kind].push(v.rule);
    return o;
  }
  function editRule(obj, kind, index, rule) {
    const v = validateRule(rule); if (!v.ok) throw new Error(v.error);
    const o = withPerm(obj, kind), list = o.permissions[kind];
    if (!(index >= 0 && index < list.length)) throw new Error('Kural bulunamadı');
    if (list.some((r, i) => i !== index && r === v.rule)) throw new Error('Bu kural zaten var');
    list[index] = v.rule;
    return o;
  }
  function removeRule(obj, kind, index) {
    const o = withPerm(obj, kind), list = o.permissions[kind];
    if (!(index >= 0 && index < list.length)) throw new Error('Kural bulunamadı');
    list.splice(index, 1);
    return o;
  }

  // ---------- Hook'lar: olay → eşleştirici grubu → komut listesi ----------
  const HOOK_EVENTS = ['PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'Notification', 'UserPromptSubmit', 'SessionStart', 'SessionEnd',
    'Stop', 'StopFailure', 'SubagentStart', 'SubagentStop', 'PreCompact', 'PostCompact', 'PermissionRequest', 'PermissionDenied'];
  // claude.exe 2.1.318'in tanıdığı tüm olaylar (düzenleyici listede yalnız sık kullanılanları önerir)
  const ALL_HOOK_EVENTS = HOOK_EVENTS.concat(['PostToolBatch', 'UserPromptExpansion', 'PreModelSwitch', 'PostModelSwitch', 'Setup', 'TeammateIdle',
    'TaskCreated', 'TaskCompleted', 'Elicitation', 'ElicitationResult', 'ConfigChange', 'WorktreeCreate', 'WorktreeRemove', 'InstructionsLoaded',
    'CwdChanged', 'FileChanged', 'DirectoryAdded', 'MessageDisplay']);
  const MATCHER_EVENTS = ['PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'PermissionRequest', 'PermissionDenied', 'SessionStart', 'PreCompact', 'PostCompact', 'Notification', 'SubagentStart', 'SubagentStop'];
  // → [{event, gi, hi, matcher, type, command, timeout, extra}]  (extra: komutun bilinmeyen alanları, ör. args)
  function hookRows(obj) {
    const out = [];
    const h = isObj(obj) && isObj(obj.hooks) ? obj.hooks : {};
    for (const event of Object.keys(h)) {
      (Array.isArray(h[event]) ? h[event] : []).forEach((g, gi) => {
        const hooks = isObj(g) && Array.isArray(g.hooks) ? g.hooks : [];
        hooks.forEach((x, hi) => {
          const c = isObj(x) ? x : {};
          const { type, command, timeout, ...extra } = c;
          out.push({ event, gi, hi, matcher: isObj(g) && typeof g.matcher === 'string' ? g.matcher : '', type: type || 'command',
            command: typeof command === 'string' ? command : (c.prompt ? String(c.prompt) : ''), timeout: typeof timeout === 'number' ? timeout : null,
            extra: Object.keys(extra).length ? extra : null });
        });
      });
    }
    return out;
  }
  function hookCheck(h) {
    if (!h || !ALL_HOOK_EVENTS.includes(h.event)) throw new Error('Bilinmeyen olay: ' + (h && h.event));
    if (!String(h.command || '').trim()) throw new Error('Komut boş');
    if (h.timeout != null && h.timeout !== '' && !(Number(h.timeout) > 0)) throw new Error('Zaman aşımı pozitif bir sayı (saniye) olmalı');
  }
  const hookEntry = (h, base = {}) => {
    const e = { ...base, type: base.type || 'command', command: String(h.command).trim() };
    if (h.timeout != null && h.timeout !== '') e.timeout = Number(h.timeout); else delete e.timeout;
    return e;
  };
  function addHook(obj, h) {
    hookCheck(h);
    const o = isObj(obj) ? clone(obj) : {};
    if (!isObj(o.hooks)) o.hooks = {};
    if (!Array.isArray(o.hooks[h.event])) o.hooks[h.event] = [];
    const matcher = String(h.matcher || '').trim();
    let g = o.hooks[h.event].find(g => isObj(g) && (g.matcher || '') === matcher && Array.isArray(g.hooks));
    if (!g) { g = matcher ? { matcher, hooks: [] } : { hooks: [] }; o.hooks[h.event].push(g); }
    g.hooks.push(hookEntry(h));
    return o;
  }
  function pruneHooks(o, event) {
    o.hooks[event] = o.hooks[event].filter(g => !(isObj(g) && Array.isArray(g.hooks) && !g.hooks.length));
    if (!o.hooks[event].length) delete o.hooks[event];
    if (!Object.keys(o.hooks).length) delete o.hooks;
    return o;
  }
  function groupAt(o, event, gi, hi) {
    const g = isObj(o.hooks) && Array.isArray(o.hooks[event]) ? o.hooks[event][gi] : null;
    if (!isObj(g) || !Array.isArray(g.hooks) || !(hi >= 0 && hi < g.hooks.length)) throw new Error('Hook bulunamadı');
    return g;
  }
  function removeHook(obj, event, gi, hi) {
    const o = clone(obj || {});
    groupAt(o, event, gi, hi).hooks.splice(hi, 1);
    return pruneHooks(o, event);
  }
  // Düzenleme: olay ya da eşleştirici değiştiyse eskisi silinip yenisi eklenir; değişmediyse yerinde güncellenir (bilinmeyen alanlar korunur)
  function editHook(obj, event, gi, hi, h) {
    hookCheck(h);
    const o = clone(obj || {}), g = groupAt(o, event, gi, hi);
    const matcher = String(h.matcher || '').trim();
    if (h.event === event && matcher === (g.matcher || '')) { g.hooks[hi] = hookEntry(h, isObj(g.hooks[hi]) ? g.hooks[hi] : {}); return o; }
    const old = isObj(g.hooks[hi]) ? g.hooks[hi] : {};
    const moved = addHook(pruneHooks((g.hooks.splice(hi, 1), o), event), h);
    const ng = moved.hooks[h.event].find(x => (x.matcher || '') === matcher);
    ng.hooks[ng.hooks.length - 1] = hookEntry(h, old);
    return moved;
  }

  // ---------- Output style, statusline, eklentiler ----------
  const BUILTIN_STYLES = ['default', 'Explanatory', 'Learning', 'Proactive', 'Concise']; // claude.exe 2.1.318 yerleşikleri
  function setOutputStyle(obj, name) {
    const o = isObj(obj) ? clone(obj) : {};
    if (!name) delete o.outputStyle; else o.outputStyle = String(name);
    return o;
  }
  function setStatusLine(obj, sl) {
    const o = isObj(obj) ? clone(obj) : {};
    if (!sl || !String(sl.command || '').trim()) { delete o.statusLine; return o; }
    const base = isObj(o.statusLine) ? o.statusLine : {};
    const out = { ...base, type: 'command', command: String(sl.command).trim() };
    if (sl.padding === '' || sl.padding == null) delete out.padding;
    else if (Number.isInteger(Number(sl.padding)) && Number(sl.padding) >= 0) out.padding = Number(sl.padding);
    else throw new Error('Padding 0 ya da pozitif bir tam sayı olmalı');
    o.statusLine = out;
    return o;
  }
  function setPluginEnabled(obj, id, on) {
    if (!/^[^\s@]+@[^\s@]+$/.test(String(id || ''))) throw new Error('Geçersiz eklenti kimliği: ' + id);
    const o = isObj(obj) ? clone(obj) : {};
    if (!isObj(o.enabledPlugins)) o.enabledPlugins = {};
    o.enabledPlugins[id] = !!on;
    return o;
  }
  // Etkin değer: yerel > proje > kullanıcı (Claude Code ayar önceliği). layers: [{key,label,obj}] yüksek öncelik önce
  function pluginState(id, layers) {
    for (const l of layers || []) {
      const ep = l && isObj(l.obj) && isObj(l.obj.enabledPlugins) ? l.obj.enabledPlugins : null;
      if (ep && typeof ep[id] === 'boolean') return { on: ep[id], source: l.key, label: l.label };
    }
    return { on: false, source: null, label: null };
  }
  // installed_plugins.json (sürüm 2): { version: 2, plugins: { "ad@pazar": [{scope, installPath, version, projectPath?, …}] } }
  function parseInstalled(obj) {
    const out = [];
    const p = isObj(obj) && isObj(obj.plugins) ? obj.plugins : {};
    for (const id of Object.keys(p)) {
      const at = id.lastIndexOf('@');
      for (const r of (Array.isArray(p[id]) ? p[id] : [p[id]]).filter(isObj)) {
        out.push({ id, name: at > 0 ? id.slice(0, at) : id, marketplace: at > 0 ? id.slice(at + 1) : '', scope: r.scope || 'user',
          version: r.version ? String(r.version) : '', installPath: r.installPath ? String(r.installPath) : '', projectPath: r.projectPath ? String(r.projectPath) : '' });
      }
    }
    return out;
  }

  // ---------- Frontmatter (ajan / output style dosyaları) ----------
  function parseFrontmatter(text) {
    const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(String(text || ''));
    const out = {};
    if (!m) return out;
    let listKey = null;
    for (const raw of m[1].split(/\r?\n/)) {
      const li = /^\s+-\s+(.*)$/.exec(raw);
      if (li && listKey) { out[listKey].push(unq(li[1])); continue; }
      const kv = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(raw);
      if (!kv) continue;
      listKey = null;
      const v = kv[2].trim();
      if (!v) { out[kv[1]] = []; listKey = kv[1]; continue; }
      if (/^\[.*\]$/.test(v)) out[kv[1]] = v.slice(1, -1).split(',').map(unq).filter(Boolean);
      else out[kv[1]] = unq(v);
    }
    return out;
  }
  function unq(s) { s = String(s).trim(); return /^(["']).*\1$/.test(s) ? s.slice(1, -1) : s; }
  function agentInfo(text, file) {
    const fm = parseFrontmatter(text);
    const tools = Array.isArray(fm.tools) ? fm.tools : typeof fm.tools === 'string' ? fm.tools.split(',').map(s => s.trim()).filter(Boolean) : [];
    return { name: typeof fm.name === 'string' && fm.name ? fm.name : String(file || '').replace(/\.md$/i, ''),
      description: typeof fm.description === 'string' ? fm.description : '', model: typeof fm.model === 'string' ? fm.model : '', tools };
  }

  // ---------- "#" ile başlayan mesaj → hafıza notu ----------
  // Tek satır, "#" ile başlar, "##" değil (Markdown başlığı yapıştırmak not sayılmasın), "#" sonrası boş değil
  function memoryNote(text) {
    const s = String(text || '').trim();
    if (!s.startsWith('#') || s.startsWith('##') || /\n/.test(s)) return null;
    const note = s.slice(1).trim();
    return note || null;
  }
  function appendNote(existing, note) {
    const n = String(note || '').replace(/\s+/g, ' ').trim();
    if (!n) throw new Error('Not boş');
    let t = String(existing || '');
    if (t && !t.endsWith('\n')) t += '\n';
    return t + '- ' + n + '\n';
  }

  // ---------- Markdown dışa aktarım ----------
  const pad = n => String(n).padStart(2, '0');
  function fmtTs(ts) {
    const d = ts ? new Date(ts) : null;
    if (!d || isNaN(d)) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const oneLine = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
  function toMarkdown(s, opts = {}) {
    const msgs = Array.isArray(s && s.msgs) ? s.msgs : [];
    const L = [`# ${oneLine(s && s.title, 200) || 'Sohbet'}`, ''];
    const meta = [];
    if (s && s.project) meta.push(`- Proje: \`${s.project}\``);
    if (s && s.id) meta.push(`- Oturum: \`${s.id}\``);
    if (s && s.model) meta.push(`- Model: ${s.model}`);
    meta.push(`- Dışa aktarıldı: ${fmtTs(opts.now || Date.now())}`);
    if (s && s.skipped) meta.push(`- Not: ilk ${s.skipped} tur dahil değil`);
    L.push(...meta, '');
    for (const m of msgs) {
      if (!m || (m.r !== 'u' && m.r !== 'a')) continue;
      const ts = fmtTs(m.ts);
      L.push('---', '', `### ${m.r === 'u' ? 'Kullanıcı' : 'Claude'}${ts ? ' · ' + ts : ''}`, '');
      if (m.r === 'u') { L.push(String(m.t || '').trim() || '_(boş)_', ''); continue; }
      for (const b of Array.isArray(m.b) ? m.b : []) {
        if (b.t === 'text') L.push(String(b.v || '').trim(), '');
        else if (b.t === 'tool') L.push(`> Araç: \`${b.n}\`${b.a ? ' — ' + oneLine(b.a, 160).replace(/`/g, "'") : ''}${b.err ? ' (hata)' : ''}`, '');
      }
    }
    return L.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  }
  function exportName(title, now) {
    const base = oneLine(title, 60).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/[. ]+$/, '').trim() || 'sohbet';
    const d = new Date(now || Date.now());
    return `${base} ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.md`;
  }

  const api = { jsonCheck, scanJson, stringify, posToLineCol, KINDS, KNOWN_TOOLS, parseRule, validateRule, listRules, permInfo, addRule, editRule, removeRule,
    HOOK_EVENTS, ALL_HOOK_EVENTS, MATCHER_EVENTS, hookRows, addHook, editHook, removeHook, BUILTIN_STYLES, setOutputStyle, setStatusLine, setPluginEnabled, pluginState,
    parseInstalled, parseFrontmatter, agentInfo, memoryNote, appendNote, fmtTs, toMarkdown, exportName };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ccfgCore = api;
})(typeof window !== 'undefined' ? window : this);
