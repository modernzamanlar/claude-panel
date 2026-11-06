// main/claudecfg.js: yalnız bilinen dosyalar, .bak, atomik yazım, JSON doğrulama, çakışma, # notu, eklenti/ajan/stil listeleri.
// Her test kendi geçici klasörünü kullanır; gerçek ~/.claude'a hiç dokunulmaz.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createClaudeCfg, defaultRoots, FILES } = require('../src/main/claudecfg');

function tmp(t) {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cp-ccfg-')));
  t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  const home = path.join(d, 'home'), proj = path.join(d, 'proj');
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true }); fs.mkdirSync(proj);
  return { d, home, proj, cdir: path.join(home, '.claude'), cfg: createClaudeCfg({ env: { CLAUDE_PANEL_CLAUDE_HOME: home } }) };
}
const put = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };

test('defaultRoots: CLAUDE_PANEL_CLAUDE_HOME > CLAUDE_CONFIG_DIR > ~/.claude', () => {
  assert.deepStrictEqual(defaultRoots({ CLAUDE_PANEL_CLAUDE_HOME: '/x', CLAUDE_CONFIG_DIR: '/y' }), { home: path.resolve('/x'), claudeDir: path.join(path.resolve('/x'), '.claude') });
  assert.deepStrictEqual(defaultRoots({ CLAUDE_CONFIG_DIR: '/y' }), { home: os.homedir(), claudeDir: path.resolve('/y') });
  assert.deepStrictEqual(defaultRoots({}), { home: os.homedir(), claudeDir: path.join(os.homedir(), '.claude') });
  assert.strictEqual(defaultRoots().home, process.env.CLAUDE_PANEL_CLAUDE_HOME ? path.resolve(process.env.CLAUDE_PANEL_CLAUDE_HOME) : os.homedir());
  const c = createClaudeCfg({ claudeDir: '/a/b/.claude' });
  assert.deepStrictEqual(c.roots, { home: '/a/b', claudeDir: '/a/b/.claude' });
  assert.strictEqual(createClaudeCfg({ claudeDir: '/c', home: '/h' }).roots.home, '/h');
  assert.ok(createClaudeCfg().roots.claudeDir);
  assert.strictEqual(FILES.length, 7);
});

test('list: proje yokken yalnız kullanıcı dosyaları; proje varken yedi dosya', t => {
  const { cfg, proj, cdir } = tmp(t);
  assert.deepStrictEqual(cfg.list().map(f => f.key), ['user-md', 'user-settings']);
  assert.deepStrictEqual(cfg.list('').map(f => f.key), ['user-md', 'user-settings']);
  const all = cfg.list(proj);
  assert.deepStrictEqual(all.map(f => f.key), ['user-md', 'proj-md', 'proj-dot-md', 'proj-local-md', 'user-settings', 'proj-settings', 'proj-local']);
  assert.strictEqual(all.find(f => f.key === 'proj-local').path, path.join(proj, '.claude', 'settings.local.json'));
  assert.strictEqual(all.find(f => f.key === 'user-md').path, path.join(cdir, 'CLAUDE.md'));
  assert.ok(all.every(f => f.exists === false));
});
test('list: proje = ev klasörü ise kullanıcıyla çakışan proje kayıtları verilmez (Windows: büyük/küçük harf duyarsız)', t => {
  const { home } = tmp(t);
  const keys = c => c.list(home).map(f => f.key);
  assert.deepStrictEqual(keys(createClaudeCfg({ env: { CLAUDE_PANEL_CLAUDE_HOME: home }, platform: 'linux' })), ['user-md', 'proj-md', 'proj-local-md', 'user-settings', 'proj-local']);
  const up = createClaudeCfg({ claudeDir: path.join(home.toUpperCase(), '.claude'), platform: 'win32' });
  assert.deepStrictEqual(keys(up), ['user-md', 'proj-md', 'proj-local-md', 'user-settings', 'proj-local']);
});
test('projDir: geçersiz girdiler reddedilir, ~ genişletilir', t => {
  const { cfg, proj, d } = tmp(t);
  assert.throws(() => cfg.list(5), /Geçersiz/);
  assert.throws(() => cfg.list('a\0b'), /Geçersiz/);
  assert.throws(() => cfg.list('goreli/yol'), /mutlak/);
  assert.throws(() => cfg.list(path.join(proj, 'yok')), /bulunamadı/);
  put(path.join(proj, 'dosya.txt'), 'x');
  assert.throws(() => cfg.list(path.join(proj, 'dosya.txt')), /klasör değil/);
  const c2 = createClaudeCfg({ claudeDir: path.join(d, 'cd'), osHome: d });
  assert.strictEqual(c2.projDir('~/proj'), proj);
  assert.strictEqual(c2.projDir('~'), d);
  assert.strictEqual(c2.projDir('~\\proj'), proj);
  assert.throws(() => c2.projDir('~x'), /mutlak/);
  assert.strictEqual(createClaudeCfg({ claudeDir: path.join(d, 'cd') }).projDir('~'), path.resolve(os.homedir()));
});

test('read: yok / var / JSON bozuk / boş JSON / bilinmeyen anahtar / okuma hatası', t => {
  const { cfg, proj, cdir } = tmp(t);
  const r0 = cfg.read('user-md');
  assert.strictEqual(r0.exists, false); assert.strictEqual(r0.text, ''); assert.strictEqual(r0.hash, null);
  put(path.join(cdir, 'CLAUDE.md'), '# Ben');
  const r1 = cfg.read('user-md');
  assert.strictEqual(r1.exists, true); assert.strictEqual(r1.text, '# Ben'); assert.match(r1.hash, /^[0-9a-f]{40}$/); assert.ok(r1.mtimeMs > 0);
  assert.strictEqual(r1.parsed, undefined);
  put(path.join(cdir, 'settings.json'), '{"a":1,}');
  const r2 = cfg.read('user-settings');
  assert.strictEqual(r2.parsed, null); assert.strictEqual(r2.error.line, 1); assert.strictEqual(r2.error.col, 8);
  put(path.join(cdir, 'settings.json'), '');
  assert.deepStrictEqual(cfg.read('user-settings').parsed, {});
  assert.strictEqual(cfg.read('user-settings').error, null);
  assert.strictEqual(cfg.read('proj-settings', proj).parsed, undefined, 'yoksa ayrıştırma yok');
  assert.throws(() => cfg.read('../../etc/passwd'), /Bilinmeyen dosya/);
  assert.throws(() => cfg.read('proj-md'), /Bilinmeyen dosya/, 'proje verilmeden proje dosyası yok');
  fs.mkdirSync(path.join(proj, 'CLAUDE.md'));
  assert.throws(() => cfg.read('proj-md', proj), /EISDIR|illegal operation/);
});

test('write: yeni dosya (klasör açılır), .bak, çakışma, force, bozuk JSON reddi, metin denetimi', t => {
  const { cfg, proj } = tmp(t);
  assert.throws(() => cfg.write('proj-md', proj, 5), /Metin/);
  const f = path.join(proj, '.claude', 'settings.json');
  const w1 = cfg.write('proj-settings', proj, '{"a":1}\n', { expectHash: null });
  assert.strictEqual(w1.ok, true); assert.strictEqual(w1.backup, null); assert.strictEqual(fs.readFileSync(f, 'utf8'), '{"a":1}\n');
  const bad = cfg.write('proj-settings', proj, '{"a":\n  1,,}', { expectHash: w1.hash });
  assert.deepStrictEqual(bad, { ok: false, invalid: true, error: 'Anahtar bekleniyordu (çift tırnaklı metin)', line: 2, col: 5 });
  assert.strictEqual(fs.readFileSync(f, 'utf8'), '{"a":1}\n', 'bozuk JSON yazılmaz');
  assert.strictEqual(cfg.write('proj-settings', proj, '[1]', { expectHash: w1.hash }).invalid, true, 'kök nesne olmalı');
  const w2 = cfg.write('proj-settings', proj, '{"a":2}', { expectHash: w1.hash });
  assert.strictEqual(w2.ok, true); assert.strictEqual(w2.backup, f + '.bak'); assert.strictEqual(fs.readFileSync(f + '.bak', 'utf8'), '{"a":1}\n');
  fs.writeFileSync(f, '{"dis":true}');
  const c = cfg.write('proj-settings', proj, '{"a":3}', { expectHash: w2.hash });
  assert.deepStrictEqual(c, { ok: false, conflict: true, path: f, exists: true });
  assert.strictEqual(fs.readFileSync(f, 'utf8'), '{"dis":true}');
  assert.strictEqual(cfg.write('proj-settings', proj, '{"a":3}', { expectHash: w2.hash, force: true }).ok, true);
  assert.strictEqual(fs.readFileSync(f + '.bak', 'utf8'), '{"dis":true}');
  assert.deepStrictEqual(cfg.write('proj-md', proj, 'x').ok, true, 'seçenek yokken yeni dosya');
  assert.strictEqual(cfg.write('proj-md', proj, 'y').conflict, true, 'var olan dosya özetsiz yazılmaz');
  fs.unlinkSync(path.join(proj, 'CLAUDE.md'));
  assert.deepStrictEqual(cfg.write('proj-md', proj, 'z', { expectHash: 'eski' }), { ok: false, conflict: true, path: path.join(proj, 'CLAUDE.md'), exists: false }, 'dışarıda silindiyse uyarılır');
  assert.deepStrictEqual(fs.readdirSync(path.join(proj, '.claude')).sort(), ['settings.json', 'settings.json.bak'], 'geçici dosya kalmaz');
});
test('write: okuma hatası iletilir; rename başarısızsa geçici dosya silinir', t => {
  const { cfg, proj } = tmp(t);
  fs.mkdirSync(path.join(proj, 'CLAUDE.local.md'));
  assert.throws(() => cfg.write('proj-local-md', proj, 'x'), /EISDIR|illegal operation/);
  const ren = t.mock.method(fs, 'renameSync', () => { throw new Error('kilitli'); });
  assert.throws(() => cfg.write('proj-md', proj, 'x'), /kilitli/);
  ren.mock.restore();
  assert.deepStrictEqual(fs.readdirSync(proj).sort(), ['CLAUDE.local.md']);
  const ren2 = t.mock.method(fs, 'renameSync', () => { throw new Error('kilitli'); });
  t.mock.method(fs, 'unlinkSync', () => { throw new Error('silinemedi'); });
  assert.throws(() => cfg.write('proj-md', proj, 'x'), /kilitli/);
  ren2.mock.restore();
});

test('appendMemory: kullanıcı ve proje CLAUDE.md sonuna madde', t => {
  const { cfg, proj, cdir } = tmp(t);
  const r = cfg.appendMemory('user', null, 'testlerde geçici klasör');
  assert.deepStrictEqual(r, { ok: true, path: path.join(cdir, 'CLAUDE.md'), label: 'Kullanıcı · ~/.claude/CLAUDE.md' });
  assert.strictEqual(fs.readFileSync(r.path, 'utf8'), '- testlerde geçici klasör\n');
  put(path.join(proj, 'CLAUDE.md'), '# Proje');
  cfg.appendMemory('proj', proj, 'iki');
  assert.strictEqual(fs.readFileSync(path.join(proj, 'CLAUDE.md'), 'utf8'), '# Proje\n- iki\n');
  assert.strictEqual(fs.readFileSync(path.join(proj, 'CLAUDE.md.bak'), 'utf8'), '# Proje');
  assert.throws(() => cfg.appendMemory('baska', proj, 'x'), /kapsam/);
  assert.throws(() => cfg.appendMemory('proj', null, 'x'), /Bilinmeyen dosya/);
  assert.throws(() => cfg.appendMemory('user', null, ' '), /boş/);
  fs.rmSync(path.join(cdir, 'CLAUDE.md')); fs.mkdirSync(path.join(cdir, 'CLAUDE.md'));
  assert.throws(() => cfg.appendMemory('user', null, 'x'), /EISDIR|illegal operation/);
});

test('outputStyles: yerleşikler + kullanıcı + proje (frontmatter adı, tekrar yok)', t => {
  const { cfg, proj, cdir } = tmp(t);
  assert.deepStrictEqual(cfg.outputStyles().map(s => s.name), ['default', 'Explanatory', 'Learning', 'Proactive', 'Concise']);
  put(path.join(cdir, 'output-styles', 'kisa.md'), '---\nname: Kısa\ndescription: Kısa yanıt\n---\n');
  put(path.join(cdir, 'output-styles', 'adsiz.md'), 'gövde');
  put(path.join(cdir, 'output-styles', 'Learning.md'), 'tekrar');
  put(path.join(cdir, 'output-styles', 'not.txt'), 'x');
  fs.mkdirSync(path.join(cdir, 'output-styles', 'klasor.md'));
  put(path.join(proj, '.claude', 'output-styles', 'proje.md'), '---\nname: [liste]\n---\n');
  put(path.join(proj, '.claude', 'output-styles', 'buyuk.md'), '---\nname: Büyük\n---\n' + 'x'.repeat(300 * 1024));
  const s = cfg.outputStyles(proj);
  assert.deepStrictEqual(s.slice(5), [
    { name: 'adsiz', source: 'kullanıcı', description: '' }, { name: 'Kısa', source: 'kullanıcı', description: 'Kısa yanıt' },
    { name: 'buyuk', source: 'proje', description: '' }, { name: 'proje', source: 'proje', description: '' }]);
});
test('agents ve agentPath', t => {
  const { cfg, proj, cdir } = tmp(t);
  assert.deepStrictEqual(cfg.agents(), []);
  put(path.join(cdir, 'agents', 'inceleme.md'), '---\nname: kod-inceleme\ndescription: İnceler\nmodel: haiku\ntools: Read, Grep\n---\n');
  put(path.join(proj, '.claude', 'agents', 'yaz.md'), 'frontmatter yok');
  const a = cfg.agents(proj);
  assert.deepStrictEqual(a, [
    { scope: 'user', file: 'inceleme.md', path: path.join(cdir, 'agents', 'inceleme.md'), name: 'kod-inceleme', description: 'İnceler', model: 'haiku', tools: ['Read', 'Grep'] },
    { scope: 'proj', file: 'yaz.md', path: path.join(proj, '.claude', 'agents', 'yaz.md'), name: 'yaz', description: '', model: '', tools: [] }]);
  assert.strictEqual(cfg.agentPath('proj', 'yaz.md', proj), a[1].path);
  assert.throws(() => cfg.agentPath('user', '../settings.json', proj), /bulunamadı/);
  assert.throws(() => cfg.agentPath('proj', 'yaz.md'), /bulunamadı/);
});
test('plugins: dosya yok / bozuk / geçerli (manifest açıklaması)', t => {
  const { cfg, cdir, d } = tmp(t);
  const file = path.join(cdir, 'plugins', 'installed_plugins.json');
  assert.deepStrictEqual(cfg.plugins(), { file, list: [], error: null });
  put(file, '{bozuk');
  assert.match(cfg.plugins().error, /okunamadı/);
  const ip = path.join(d, 'cache', 'fmt');
  put(path.join(ip, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'fmt', description: 'Biçimlendirir' }));
  const ip2 = path.join(d, 'cache', 'bos'); put(path.join(ip2, '.claude-plugin', 'plugin.json'), '{"description":5}');
  put(file, JSON.stringify({ version: 2, plugins: { 'fmt@resmi': [{ scope: 'user', installPath: ip, version: '1.2.0' }],
    'bos@resmi': [{ installPath: ip2 }], 'goreli@x': [{ installPath: 'goreli/yol' }], 'kayip@x': [{ installPath: path.join(d, 'yok') }] } }));
  const r = cfg.plugins();
  assert.strictEqual(r.error, null);
  assert.deepStrictEqual(r.list.map(p => [p.id, p.description]), [['fmt@resmi', 'Biçimlendirir'], ['bos@resmi', ''], ['goreli@x', ''], ['kayip@x', '']]);
  assert.strictEqual(r.list[0].version, '1.2.0');
});
