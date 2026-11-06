// Claude Code yapılandırmasını okuma/yazma (Claude ayarları penceresi).
// Yalnız bilinen dosyalar: anahtar → yol eşlemesi burada sabit; arayüzden yol alınmaz (yol geçişi yok).
// Yazım: JSON ise önce doğrulanır (bozuk JSON yazılmaz), var olan dosya <ad>.bak'a kopyalanır, geçici dosya + rename ile atomik yazılır.
// Dosya biz okuduktan sonra dışarıda değiştiyse (içerik özeti farklı) force verilmedikçe yazılmaz: { conflict: true }.
// Kök klasörler parametredir; testler ve selftest geçici klasör verir (CLAUDE_PANEL_CLAUDE_HOME).
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const core = require('../renderer/claudecfg-core');

// home: Claude Code'un "ev" klasörü (~). claudeDir verilmezse <home>/.claude.
// Ortam: CLAUDE_PANEL_CLAUDE_HOME (yalnız test/selftest) > CLAUDE_CONFIG_DIR (Claude Code'un kendi değişkeni) > ~/.claude
function defaultRoots(env = process.env) {
  if (env.CLAUDE_PANEL_CLAUDE_HOME) { const home = path.resolve(env.CLAUDE_PANEL_CLAUDE_HOME); return { home, claudeDir: path.join(home, '.claude') }; }
  const home = os.homedir();
  return { home, claudeDir: env.CLAUDE_CONFIG_DIR ? path.resolve(env.CLAUDE_CONFIG_DIR) : path.join(home, '.claude') };
}

// Bilinen dosyalar: [anahtar, kapsam, etiket, kök ('user' | 'proj'), göreli yol, json?]
const FILES = [
  ['user-md', 'user', 'Kullanıcı · ~/.claude/CLAUDE.md', 'user', ['CLAUDE.md'], false],
  ['proj-md', 'proj', 'Proje · CLAUDE.md', 'proj', ['CLAUDE.md'], false],
  ['proj-dot-md', 'proj', 'Proje · .claude/CLAUDE.md', 'proj', ['.claude', 'CLAUDE.md'], false],
  ['proj-local-md', 'proj', 'Proje (yerel) · CLAUDE.local.md', 'proj', ['CLAUDE.local.md'], false],
  ['user-settings', 'user', 'Kullanıcı · ~/.claude/settings.json', 'user', ['settings.json'], true],
  ['proj-settings', 'proj', 'Proje · .claude/settings.json', 'proj', ['.claude', 'settings.json'], true],
  ['proj-local', 'proj', 'Proje (yerel) · .claude/settings.local.json', 'proj', ['.claude', 'settings.local.json'], true],
];
const sha = t => crypto.createHash('sha1').update(t).digest('hex');

function createClaudeCfg(opts = {}) {
  const roots = opts.claudeDir ? { home: opts.home || path.dirname(opts.claudeDir), claudeDir: opts.claudeDir } : defaultRoots(opts.env);
  const HOME = roots.home, CDIR = roots.claudeDir;
  const expand = p => (typeof p === 'string' && (p === '~' || p.startsWith('~/') || p.startsWith('~\\')) ? path.join(opts.osHome || os.homedir(), p.slice(1)) : p);

  // Proje klasörü: mutlak, var olan bir klasör olmalı; yoksa proje dosyaları sunulmaz
  function projDir(cwd) {
    if (cwd == null || cwd === '') return null;
    if (typeof cwd !== 'string' || cwd.includes('\0')) throw new Error('Geçersiz proje klasörü');
    const p = expand(cwd);
    if (!path.isAbsolute(p)) throw new Error('Proje klasörü mutlak yol olmalı');
    let st; try { st = fs.statSync(p); } catch { throw new Error('Proje klasörü bulunamadı: ' + cwd); }
    if (!st.isDirectory()) throw new Error('Proje klasörü bir klasör değil: ' + cwd);
    return path.resolve(p);
  }
  const same = (a, b) => ((opts.platform || process.platform) === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
  // Anahtar → tam yol. Proje dosyası kullanıcı dosyasıyla aynı yere düşüyorsa (cwd = ev klasörü) proje kaydı verilmez.
  function list(cwd) {
    const pd = projDir(cwd);
    const out = [];
    for (const [key, scope, label, base, rel, json] of FILES) {
      if (base === 'proj' && !pd) continue;
      const file = path.join(base === 'user' ? CDIR : pd, ...rel);
      if (base === 'proj' && FILES.some(f => f[3] === 'user' && same(path.join(CDIR, ...f[4]), file))) continue;
      out.push({ key, scope, label, path: file, json, exists: fs.existsSync(file) });
    }
    return out;
  }
  function resolve(key, cwd) {
    const f = list(cwd).find(x => x.key === key);
    if (!f) throw new Error('Bilinmeyen dosya: ' + key);
    return f;
  }
  function read(key, cwd) {
    const f = resolve(key, cwd);
    let text = '', exists = false, mtimeMs = 0;
    try { text = fs.readFileSync(f.path, 'utf8'); exists = true; mtimeMs = fs.statSync(f.path).mtimeMs; } catch (e) { if (e.code !== 'ENOENT') throw e; }
    const out = { ...f, exists, text, mtimeMs, hash: exists ? sha(text) : null };
    if (f.json && exists) { const c = core.jsonCheck(text, { object: true, allowEmpty: true }); out.parsed = c.ok ? c.value : null; out.error = c.ok ? null : c; }
    return out;
  }
  function atomicWrite(file, text) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak');
    const tmp = file + '.' + process.pid + '.' + Date.now() + '.tmp';
    const fd = fs.openSync(tmp, 'wx');
    try { fs.writeSync(fd, text); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    try { fs.renameSync(tmp, file); } catch (e) { try { fs.unlinkSync(tmp); } catch {} throw e; }
  }
  // expectHash: okuduğumuz içeriğin özeti (yeni dosya için null). Dosyadaki şimdiki içerik farklıysa ve force yoksa çakışma döner.
  function write(key, cwd, text, o = {}) {
    if (typeof text !== 'string') throw new Error('Metin bekleniyordu');
    const f = resolve(key, cwd);
    if (f.json) { const c = core.jsonCheck(text, { object: true }); if (!c.ok) return { ok: false, invalid: true, error: c.error, line: c.line, col: c.col }; }
    let cur = null; try { cur = fs.readFileSync(f.path, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    const curHash = cur === null ? null : sha(cur);
    if (!o.force && curHash !== (o.expectHash || null)) return { ok: false, conflict: true, path: f.path, exists: cur !== null };
    atomicWrite(f.path, text);
    return { ok: true, path: f.path, hash: sha(text), backup: cur !== null ? f.path + '.bak' : null };
  }
  // "#" notu: kullanıcı ~/.claude/CLAUDE.md ya da proje <cwd>/CLAUDE.md sonuna "- not" eklenir (her zaman güncel içerik üstüne)
  function appendMemory(scope, cwd, note) {
    const key = scope === 'user' ? 'user-md' : scope === 'proj' ? 'proj-md' : null;
    if (!key) throw new Error('Geçersiz kapsam');
    const f = resolve(key, cwd);
    let cur = ''; try { cur = fs.readFileSync(f.path, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    atomicWrite(f.path, core.appendNote(cur, note));
    return { ok: true, path: f.path, label: f.label };
  }
  const mdFiles = dir => { try { return fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isFile() && /\.md$/i.test(e.name)).map(e => e.name).sort(); } catch { return []; } };
  const readSmall = f => { try { const st = fs.statSync(f); return st.size > 256 * 1024 ? '' : fs.readFileSync(f, 'utf8'); } catch { return ''; } };
  function outputStyles(cwd) {
    const pd = projDir(cwd);
    const out = core.BUILTIN_STYLES.map(name => ({ name, source: 'yerleşik' }));
    const add = (dir, source) => mdFiles(dir).forEach(n => {
      const fm = core.parseFrontmatter(readSmall(path.join(dir, n)));
      const name = typeof fm.name === 'string' && fm.name ? fm.name : n.replace(/\.md$/i, '');
      if (!out.some(s => s.name === name)) out.push({ name, source, description: typeof fm.description === 'string' ? fm.description : '' });
    });
    add(path.join(CDIR, 'output-styles'), 'kullanıcı');
    if (pd) add(path.join(pd, '.claude', 'output-styles'), 'proje');
    return out;
  }
  function agents(cwd) {
    const pd = projDir(cwd);
    const out = [];
    const add = (dir, scope) => mdFiles(dir).forEach(n => { const p = path.join(dir, n); out.push({ scope, file: n, path: p, ...core.agentInfo(readSmall(p), n) }); });
    add(path.join(CDIR, 'agents'), 'user');
    if (pd) add(path.join(pd, '.claude', 'agents'), 'proj');
    return out;
  }
  // Ajan dosyasının yolu yalnız listede varsa verilir (arayüzden gelen ad yola dönüştürülmez)
  function agentPath(scope, file, cwd) {
    const a = agents(cwd).find(x => x.scope === scope && x.file === file);
    if (!a) throw new Error('Ajan dosyası bulunamadı: ' + file);
    return a.path;
  }
  // Kurulu eklentiler: <claudeDir>/plugins/installed_plugins.json; açıklama <installPath>/.claude-plugin/plugin.json'dan
  function plugins() {
    const file = path.join(CDIR, 'plugins', 'installed_plugins.json');
    let raw; try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return { file, list: [], error: e.code === 'ENOENT' ? null : 'installed_plugins.json okunamadı: ' + e.message }; }
    const list = core.parseInstalled(raw).map(p => {
      let description = '';
      if (p.installPath && path.isAbsolute(p.installPath)) {
        try { const m = JSON.parse(readSmall(path.join(p.installPath, '.claude-plugin', 'plugin.json'))); if (m && typeof m.description === 'string') description = m.description; } catch {}
      }
      return { ...p, description };
    });
    return { file, list, error: null };
  }
  return { roots: { home: HOME, claudeDir: CDIR }, list, read, write, appendMemory, outputStyles, agents, agentPath, plugins, projDir };
}

module.exports = { createClaudeCfg, defaultRoots, FILES };
