// "/" menüsü için skill ve özel komutları dosya sisteminden bulur (CLI'nin init olayı gelmeden önceki yedek kaynak).
// Taranan yerler: <ev>/.claude/skills/*/SKILL.md, <ev>/.claude/commands/**/*.md, aynıları <cwd>/.claude altında,
// kurulu plugin'lerin (installed_plugins.json → installPath) commands/ ve skills/ klasörleri ("plugin:ad" adıyla).
// scanCommands({home, cwd}) → [{name, desc, hint, src:'user'|'project'|'plugin', kind:'skill'|'command', plugin?}]
const fs = require('fs');
const path = require('path');

const LIM = { files: 600, depth: 4, bytes: 16384, ttl: 30000 };
const cache = new Map(); // home\0cwd → {at, list}
const CACHE_MAX = 16;

// Yalnızca var olan, mutlak, gerçek klasör yolları kabul edilir
function realDir(p) {
  if (typeof p !== 'string' || !p || p.length > 4096 || p.includes('\0') || !path.isAbsolute(p)) return null;
  try { const r = fs.realpathSync(p); return fs.statSync(r).isDirectory() ? r : null; } catch { return null; }
}

// Basit YAML ön bilgisi: "anahtar: değer" satırları; tırnaklı değerler açılır, ">"/"|" ile başlayan çok satırlı değerler birleştirilir
function frontmatter(text) {
  const out = {};
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(String(text));
  if (!m) return out;
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(lines[i]);
    if (!kv) continue;
    let v = kv[2].trim();
    if (/^[>|][+-]?$/.test(v)) {
      const parts = [];
      while (i + 1 < lines.length && /^\s+\S|^\s*$/.test(lines[i + 1])) parts.push(lines[++i].trim());
      v = parts.filter(Boolean).join(' ');
    } else if (/^"(.*)"$/.test(v)) {
      try { v = JSON.parse(v); } catch { v = v.slice(1, -1); }
    } else if (/^'(.*)'$/.test(v)) v = v.slice(1, -1).replace(/''/g, "'");
    out[kv[1].toLowerCase()] = v;
  }
  return out;
}

// Ön bilgide açıklama yoksa gövdenin ilk dolu satırı (başlık işaretleri atılır)
function bodyDesc(text) {
  const body = String(text).replace(/^﻿?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
  const line = body.split(/\r?\n/).map(l => l.replace(/^#+\s*/, '').trim()).find(Boolean);
  return line || '';
}

function readHead(file) {
  let fd;
  try { fd = fs.openSync(file, 'r'); } catch { return null; }
  let t = null;
  try { const buf = Buffer.alloc(LIM.bytes); t = buf.toString('utf8', 0, fs.readSync(fd, buf, 0, LIM.bytes, 0)); } catch {}
  fs.closeSync(fd);
  return t;
}

const clip = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 300);

// <kök>/skills/<klasör>/SKILL.md
function scanSkills(root, src, prefix, out, plugin) {
  let ents; try { ents = fs.readdirSync(path.join(root, 'skills'), { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    if (out.length >= LIM.files) return;
    if (!e.isDirectory() || e.name[0] === '.') continue; // bağlantılar (symlink) izlenmez
    const t = readHead(path.join(root, 'skills', e.name, 'SKILL.md'));
    if (t == null) continue;
    const fm = frontmatter(t);
    const name = prefix + (fm.name && /^[\w.:-]+$/.test(fm.name) ? fm.name : e.name);
    out.push({ name, desc: clip(fm.description || bodyDesc(t)), hint: clip(fm['argument-hint']), src, kind: 'skill', ...(plugin ? { plugin } : {}) });
  }
}

// <kök>/commands/**/*.md → alt klasörler ":" ile ayrılır (ör. commands/git/pr.md → git:pr)
function scanCommandDir(root, src, prefix, out, plugin) {
  const base = path.join(root, 'commands');
  const walk = (rel, depth) => {
    let ents; try { ents = fs.readdirSync(path.join(base, rel), { withFileTypes: true }); } catch { return; }
    ents.sort((a, b) => (a.name > b.name) - (a.name < b.name));
    for (const e of ents) {
      if (out.length >= LIM.files) return;
      if (e.name[0] === '.') continue;
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) { if (depth + 1 < LIM.depth) walk(r, depth + 1); continue; }
      if (!e.isFile() || !/\.md$/i.test(e.name)) continue;
      const t = readHead(path.join(base, r));
      if (t == null) continue;
      const fm = frontmatter(t);
      out.push({ name: prefix + r.replace(/\.md$/i, '').split('/').join(':'), desc: clip(fm.description || bodyDesc(t)), hint: clip(fm['argument-hint']), src, kind: 'command', ...(plugin ? { plugin } : {}) });
    }
  };
  walk('', 0);
}

// installed_plugins.json: v1 {plugins:{"ad@pazar":{installPath}}} ya da v2 {plugins:{"ad@pazar":[{installPath}]}}
function pluginRoots(home) {
  const t = readHead(path.join(home, '.claude', 'plugins', 'installed_plugins.json'));
  let j; try { j = JSON.parse(t); } catch { return []; }
  const roots = [], seen = new Set();
  const plugins = j && typeof j.plugins === 'object' && j.plugins ? j.plugins : {};
  for (const [key, v] of Object.entries(plugins)) {
    const name = key.split('@')[0];
    if (!/^[\w.-]+$/.test(name)) continue;
    for (const ent of Array.isArray(v) ? v : [v]) {
      const dir = ent && realDir(ent.installPath);
      if (dir && !seen.has(dir)) { seen.add(dir); roots.push({ name, dir }); }
    }
  }
  return roots;
}

function scanCommands(opts) {
  const home = realDir(opts && opts.home);
  const cwd = realDir(opts && opts.cwd);
  const key = (home || '') + '\0' + (cwd || ''), now = Date.now(), c = cache.get(key);
  if (c && now - c.at < LIM.ttl) return c.list;
  const out = [];
  if (home) {
    scanSkills(path.join(home, '.claude'), 'user', '', out);
    scanCommandDir(path.join(home, '.claude'), 'user', '', out);
  }
  if (cwd && cwd !== home) {
    scanSkills(path.join(cwd, '.claude'), 'project', '', out);
    scanCommandDir(path.join(cwd, '.claude'), 'project', '', out);
  }
  if (home) for (const p of pluginRoots(home)) {
    scanSkills(p.dir, 'plugin', p.name + ':', out, p.name);
    scanCommandDir(p.dir, 'plugin', p.name + ':', out, p.name);
  }
  // Aynı ad birden çok yerde varsa ilk bulunan kalır (kullanıcı → proje → plugin)
  const seen = new Set(), list = out.filter(x => !seen.has(x.name) && seen.add(x.name));
  cache.delete(key); cache.set(key, { at: now, list });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return list;
}

const clearCache = () => cache.clear();

module.exports = { scanCommands, frontmatter, bodyDesc, realDir, clearCache, LIM };
