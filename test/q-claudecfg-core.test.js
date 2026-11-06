// renderer/claudecfg-core.js: izin kuralları, hook ağacı, JSON denetimi, frontmatter, # notu, Markdown dışa aktarım.
const { test } = require('node:test');
const assert = require('node:assert');
const C = require('../src/renderer/claudecfg-core.js');

test('jsonCheck: geçerli, boş, nesne değil, satır/sütun', () => {
  assert.deepStrictEqual(C.jsonCheck('{"a":1}'), { ok: true, value: { a: 1 } });
  assert.deepStrictEqual(C.jsonCheck('  ', { allowEmpty: true }), { ok: true, value: {} });
  assert.strictEqual(C.jsonCheck(null).ok, false);
  assert.strictEqual(C.jsonCheck('').error, 'Dosya boş');
  assert.strictEqual(C.jsonCheck('[1]', { object: true }).ok, false);
  assert.strictEqual(C.jsonCheck('[1]').ok, true);
  assert.deepStrictEqual(C.jsonCheck('{\n  "a": 1,\n  "b": }\n'), { ok: false, error: 'Beklenmeyen karakter: }', line: 3, col: 8 });
  assert.deepStrictEqual(C.jsonCheck('{"a":'), { ok: false, error: 'Beklenmeyen dosya sonu', line: 1, col: 6 });
});
test('scanJson: hata türleri ve konumları', () => {
  const at = s => { const r = C.scanJson(s); return r && [r.pos, r.msg]; };
  assert.strictEqual(C.scanJson(' {"a":[1,-2.5e3,true,false,null,"x\\n\\u00e7"],"b":{}, "c":[]} '), null);
  assert.deepStrictEqual(at('{"a":1,}'), [7, 'Anahtar bekleniyordu (çift tırnaklı metin)']);
  assert.deepStrictEqual(at('{"a" 1}'), [5, '":" bekleniyordu']);
  assert.deepStrictEqual(at('{"a":1 "b":2}'), [7, '"," ya da "}" bekleniyordu']);
  assert.deepStrictEqual(at('[1 2]'), [3, '"," ya da "]" bekleniyordu']);
  assert.deepStrictEqual(at('"\\u12"'), [1, 'Geçersiz \\u kaçışı']);
  assert.deepStrictEqual(at('"\\x"'), [1, 'Geçersiz kaçış dizisi (\\)']);
  assert.deepStrictEqual(at('"\\'), [1, 'Geçersiz kaçış dizisi (\\)']);
  assert.deepStrictEqual(at('"a\nb"'), [2, 'Metin içinde satır sonu ya da kontrol karakteri: tırnak kapanmamış olabilir']);
  assert.deepStrictEqual(at('"abc'), [4, 'Kapanmamış metin: " eksik']);
  assert.deepStrictEqual(at('{} x'), [3, 'JSON bittikten sonra fazladan içerik']);
  assert.deepStrictEqual(at("{'a':1}"), [1, 'Anahtar bekleniyordu (çift tırnaklı metin)']);
  assert.strictEqual(C.scanJson('['.repeat(200000)), null, 'yığın taşması: konum bilinmiyor');
});
test('jsonCheck: tarayıcı konum bulamazsa V8 iletisi ve dosya sonu', t => {
  const orig = JSON.parse;
  t.after(() => { JSON.parse = orig; });
  JSON.parse = () => { throw new SyntaxError('V8 iletisi'); };
  assert.deepStrictEqual(C.jsonCheck('{}\n'), { ok: false, error: 'V8 iletisi', line: 2, col: 1 });
  JSON.parse = () => { throw 'tuhaf'; };
  assert.deepStrictEqual(C.jsonCheck('{}'), { ok: false, error: 'tuhaf', line: 1, col: 3 });
  JSON.parse = () => { throw null; };
  assert.deepStrictEqual(C.jsonCheck('{}'), { ok: false, error: 'null', line: 1, col: 3 });
});
test('stringify ve posToLineCol', () => {
  assert.strictEqual(C.stringify({ a: 1 }), '{\n  "a": 1\n}\n');
  assert.deepStrictEqual(C.posToLineCol('a\nbc', 3), { line: 2, col: 2 });
});

test('parseRule / validateRule', () => {
  assert.deepStrictEqual(C.parseRule('Bash(npm run test:*)'), { tool: 'Bash', spec: 'npm run test:*' });
  assert.deepStrictEqual(C.parseRule('Read'), { tool: 'Read', spec: null });
  assert.strictEqual(C.parseRule(null), null);
  assert.strictEqual(C.parseRule('1x'), null);
  const ok = C.validateRule(' Read(./src/**) ');
  assert.deepStrictEqual(ok, { ok: true, rule: 'Read(./src/**)', tool: 'Read', spec: './src/**', warn: null });
  assert.strictEqual(C.validateRule('mcp__premiere-kopru__*').ok, true);
  assert.strictEqual(C.validateRule('mcp__x__y').warn, null);
  assert.match(C.validateRule('Foo').warn, /bilinen/);
  assert.match(C.validateRule('Bash(echo (a)').error, /dengeli/);
  assert.match(C.validateRule('Bash(a)(b)').error, /dengeli/);
  assert.match(C.validateRule('Bash(ls').error, /kapanmamış/);
  assert.match(C.validateRule('Bash)').error, /Açılmamış/);
  assert.match(C.validateRule('Bash()').error, /boş/);
  assert.match(C.validateRule('').error, /boş/);
  assert.match(C.validateRule(undefined).error, /boş/);
  assert.match(C.validateRule('Bash\nx').error, /tek satır/);
  assert.match(C.validateRule('9a(x)').error, /araç adı/);
  assert.match(C.validateRule('mcp__a(x)').error, /MCP/);
});
test('listRules, permInfo', () => {
  const rows = C.listRules([{ key: 'u', label: 'K', obj: { permissions: { allow: ['Read'], deny: ['Bash(rm:*)'], ask: 'bozuk' } } },
    { key: 'p', label: 'P', obj: { permissions: null } }, { key: 'x', label: 'X', obj: null }, null]);
  assert.deepStrictEqual(rows, [{ key: 'u', label: 'K', kind: 'allow', index: 0, rule: 'Read' }, { key: 'u', label: 'K', kind: 'deny', index: 0, rule: 'Bash(rm:*)' }]);
  assert.deepStrictEqual(C.listRules(), []);
  assert.deepStrictEqual(C.permInfo({ permissions: { defaultMode: 'plan', additionalDirectories: ['../a', 3] } }), { defaultMode: 'plan', additionalDirectories: ['../a', '3'] });
  assert.deepStrictEqual(C.permInfo(null), { defaultMode: null, additionalDirectories: [] });
  assert.deepStrictEqual(C.permInfo({ permissions: { defaultMode: 5 } }), { defaultMode: null, additionalDirectories: [] });
});
test('addRule / editRule / removeRule: bilinmeyen anahtarlar korunur, kopya üzerinde çalışır', () => {
  const src = { theme: 'dark', permissions: { allow: ['Read'], extra: 1 }, hooks: { x: 1 } };
  const a = C.addRule(src, 'deny', 'Bash(rm:*)');
  assert.deepStrictEqual(a, { theme: 'dark', permissions: { allow: ['Read'], extra: 1, deny: ['Bash(rm:*)'] }, hooks: { x: 1 } });
  assert.deepStrictEqual(src.permissions.deny, undefined, 'özgün değişmez');
  assert.deepStrictEqual(C.addRule(null, 'allow', 'Read'), { permissions: { allow: ['Read'] } });
  assert.deepStrictEqual(C.addRule({ permissions: 'x' }, 'ask', 'Write'), { permissions: { ask: ['Write'] } });
  assert.throws(() => C.addRule(src, 'allow', 'Read'), /zaten/);
  assert.throws(() => C.addRule(src, 'allow', 'Bash('), /kapanmamış/);
  assert.throws(() => C.addRule(src, 'nope', 'Read'), /Bilinmeyen/);
  const e = C.editRule(a, 'allow', 0, 'Read(./src/**)');
  assert.deepStrictEqual(e.permissions.allow, ['Read(./src/**)']);
  assert.throws(() => C.editRule(a, 'allow', 5, 'Read'), /bulunamadı/);
  assert.throws(() => C.editRule(a, 'allow', 0, ''), /boş/);
  assert.throws(() => C.editRule({ permissions: { allow: ['A', 'Read'] } }, 'allow', 0, 'Read'), /zaten/);
  assert.deepStrictEqual(C.editRule(a, 'allow', 0, 'Read').permissions.allow, ['Read'], 'kendisiyle aynı kalabilir');
  assert.deepStrictEqual(C.removeRule(a, 'deny', 0).permissions.deny, []);
  assert.throws(() => C.removeRule(a, 'deny', -1), /bulunamadı/);
});

const HOOKS = { hooks: {
  Stop: [{ hooks: [{ type: 'command', command: 'python', args: ['k.py'], timeout: 30 }] }],
  PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'a' }, { type: 'prompt', prompt: 'p' }] }, 'bozuk', { matcher: 5, hooks: [null] }],
  Bad: 'x',
}, other: true };
test('hookRows: düz satırlar, bilinmeyen alanlar extra, bozuk girdiler atlanır', () => {
  const rows = C.hookRows(HOOKS);
  assert.deepStrictEqual(rows, [
    { event: 'Stop', gi: 0, hi: 0, matcher: '', type: 'command', command: 'python', timeout: 30, extra: { args: ['k.py'] } },
    { event: 'PreToolUse', gi: 0, hi: 0, matcher: 'Bash', type: 'command', command: 'a', timeout: null, extra: null },
    { event: 'PreToolUse', gi: 0, hi: 1, matcher: 'Bash', type: 'prompt', command: 'p', timeout: null, extra: { prompt: 'p' } },
    { event: 'PreToolUse', gi: 2, hi: 0, matcher: '', type: 'command', command: '', timeout: null, extra: null },
  ]);
  assert.deepStrictEqual(C.hookRows(null), []);
  assert.ok(C.ALL_HOOK_EVENTS.includes('FileChanged') && C.MATCHER_EVENTS.includes('PreToolUse'));
});
test('addHook: grup bulunur ya da açılır; doğrulama', () => {
  const a = C.addHook(HOOKS, { event: 'PreToolUse', matcher: ' Bash ', command: ' b ', timeout: '10' });
  assert.deepStrictEqual(a.hooks.PreToolUse[0].hooks[2], { type: 'command', command: 'b', timeout: 10 });
  assert.strictEqual(a.other, true);
  const b = C.addHook(null, { event: 'Stop', command: 'x' });
  assert.deepStrictEqual(b, { hooks: { Stop: [{ hooks: [{ type: 'command', command: 'x' }] }] } });
  const c = C.addHook({ hooks: { Stop: 'x' } }, { event: 'Stop', matcher: 'm', command: 'x', timeout: '' });
  assert.deepStrictEqual(c.hooks.Stop, [{ matcher: 'm', hooks: [{ type: 'command', command: 'x' }] }]);
  assert.deepStrictEqual(C.addHook({ hooks: 'x' }, { event: 'Stop', command: 'x', timeout: null }).hooks.Stop.length, 1);
  assert.deepStrictEqual(C.addHook({ hooks: { Stop: ['x'] } }, { event: 'Stop', command: 'y' }).hooks.Stop, ['x', { hooks: [{ type: 'command', command: 'y' }] }]);
  assert.deepStrictEqual(C.addHook({ hooks: { Stop: [{ hooks: [] }] } }, { event: 'Stop', command: 'z' }).hooks.Stop, [{ hooks: [{ type: 'command', command: 'z' }] }]);
  assert.throws(() => C.addHook({}, { event: 'Yok', command: 'x' }), /Bilinmeyen olay/);
  assert.throws(() => C.addHook({}, null), /Bilinmeyen olay: null/);
  assert.throws(() => C.addHook({}, { event: 'Stop', command: ' ' }), /Komut boş/);
  assert.throws(() => C.addHook({}, { event: 'Stop', command: 'x', timeout: '-1' }), /Zaman aşımı/);
});
test('removeHook: boşalan grup ve olay temizlenir', () => {
  const one = { hooks: { Stop: [{ hooks: [{ command: 'x' }] }] }, keep: 1 };
  assert.deepStrictEqual(C.removeHook(one, 'Stop', 0, 0), { keep: 1 });
  const r = C.removeHook(HOOKS, 'PreToolUse', 0, 0);
  assert.strictEqual(r.hooks.PreToolUse[0].hooks.length, 1);
  assert.strictEqual(HOOKS.hooks.PreToolUse[0].hooks.length, 2, 'özgün değişmez');
  const two = { hooks: { Stop: [{ hooks: [{ command: 'x' }] }], Notification: [{ hooks: [{ command: 'n' }] }] } };
  assert.deepStrictEqual(C.removeHook(two, 'Stop', 0, 0), { hooks: { Notification: [{ hooks: [{ command: 'n' }] }] } });
  assert.throws(() => C.removeHook(HOOKS, 'Stop', 0, 9), /bulunamadı/);
  assert.throws(() => C.removeHook(HOOKS, 'Yok', 0, 0), /bulunamadı/);
  assert.throws(() => C.removeHook(null, 'Stop', 0, 0), /bulunamadı/);
  assert.throws(() => C.removeHook(HOOKS, 'PreToolUse', 1, 0), /bulunamadı/);
});
test('editHook: yerinde güncelleme (extra korunur) ve olay/eşleştirici değişince taşıma', () => {
  const e1 = C.editHook(HOOKS, 'Stop', 0, 0, { event: 'Stop', matcher: '', command: 'py', timeout: '' });
  assert.deepStrictEqual(e1.hooks.Stop[0].hooks[0], { type: 'command', command: 'py', args: ['k.py'] });
  const e2 = C.editHook(HOOKS, 'Stop', 0, 0, { event: 'PreToolUse', matcher: 'Bash', command: 'py', timeout: 5 });
  assert.strictEqual(e2.hooks.Stop, undefined);
  assert.deepStrictEqual(e2.hooks.PreToolUse[0].hooks[2], { type: 'command', command: 'py', args: ['k.py'], timeout: 5 });
  const e3 = C.editHook({ hooks: { Stop: [{ hooks: [null] }] } }, 'Stop', 0, 0, { event: 'Stop', matcher: 'yeni', command: 'z' });
  assert.deepStrictEqual(e3, { hooks: { Stop: [{ matcher: 'yeni', hooks: [{ type: 'command', command: 'z' }] }] } });
  const e4 = C.editHook({ hooks: { Stop: [{ hooks: [null] }] } }, 'Stop', 0, 0, { event: 'Stop', matcher: '', command: 'z' });
  assert.deepStrictEqual(e4.hooks.Stop[0].hooks[0], { type: 'command', command: 'z' });
  const e5 = C.editHook(HOOKS, 'PreToolUse', 0, 0, { event: 'Notification', matcher: '', command: 'n' });
  assert.deepStrictEqual(e5.hooks.Notification, [{ hooks: [{ type: 'command', command: 'n' }] }]);
  assert.throws(() => C.editHook(null, 'Stop', 0, 0, { event: 'Stop', command: 'x' }), /bulunamadı/);
  assert.throws(() => C.editHook(HOOKS, 'Stop', 0, 0, { event: 'Stop', command: '' }), /Komut/);
});
test('setOutputStyle, setStatusLine, setPluginEnabled', () => {
  assert.deepStrictEqual(C.setOutputStyle({ a: 1 }, 'Explanatory'), { a: 1, outputStyle: 'Explanatory' });
  assert.deepStrictEqual(C.setOutputStyle({ outputStyle: 'x' }, ''), {});
  assert.deepStrictEqual(C.setOutputStyle(null, 'Learning'), { outputStyle: 'Learning' });
  assert.ok(C.BUILTIN_STYLES.includes('default'));
  assert.deepStrictEqual(C.setStatusLine({ statusLine: { type: 'command', command: 'a', refreshInterval: 5 } }, { command: ' b ', padding: '2' }),
    { statusLine: { type: 'command', command: 'b', refreshInterval: 5, padding: 2 } });
  assert.deepStrictEqual(C.setStatusLine({ statusLine: { padding: 1 } }, { command: 'b', padding: '' }), { statusLine: { type: 'command', command: 'b' } });
  assert.deepStrictEqual(C.setStatusLine(null, { command: 'b' }), { statusLine: { type: 'command', command: 'b' } });
  assert.deepStrictEqual(C.setStatusLine({ statusLine: {}, x: 1 }, null), { x: 1 });
  assert.deepStrictEqual(C.setStatusLine({ statusLine: {} }, { command: ' ' }), {});
  assert.deepStrictEqual(C.setStatusLine({ statusLine: 1 }, {}), {});
  assert.throws(() => C.setStatusLine({}, { command: 'b', padding: '-1' }), /Padding/);
  assert.throws(() => C.setStatusLine({}, { command: 'b', padding: 'x' }), /Padding/);
  assert.deepStrictEqual(C.setPluginEnabled({ enabledPlugins: { 'a@m': true } }, 'b@m', false), { enabledPlugins: { 'a@m': true, 'b@m': false } });
  assert.deepStrictEqual(C.setPluginEnabled(null, 'b@m', 1), { enabledPlugins: { 'b@m': true } });
  assert.throws(() => C.setPluginEnabled({}, 'yok', true), /Geçersiz/);
  assert.throws(() => C.setPluginEnabled({}, null, true), /Geçersiz/);
});
test('pluginState: ilk tanımlı katman kazanır', () => {
  const L = [{ key: 'l', label: 'Yerel', obj: { enabledPlugins: { 'a@m': 'evet' } } }, { key: 'p', label: 'Proje', obj: null },
    { key: 'u', label: 'Kullanıcı', obj: { enabledPlugins: { 'a@m': false, 'b@m': true } } }, null];
  assert.deepStrictEqual(C.pluginState('a@m', L), { on: false, source: 'u', label: 'Kullanıcı' });
  assert.deepStrictEqual(C.pluginState('b@m', L), { on: true, source: 'u', label: 'Kullanıcı' });
  assert.deepStrictEqual(C.pluginState('c@m', L), { on: false, source: null, label: null });
  assert.deepStrictEqual(C.pluginState('c@m'), { on: false, source: null, label: null });
});
test('parseInstalled: sürüm 2 kayıtları', () => {
  const out = C.parseInstalled({ version: 2, plugins: {
    'fmt@resmi': [{ scope: 'user', installPath: '/p/fmt', version: '1.0.0' }, { scope: 'project', projectPath: '/proj', installPath: '/p/fmt2' }, 'bozuk'],
    tek: { version: 3 } } });
  assert.deepStrictEqual(out, [
    { id: 'fmt@resmi', name: 'fmt', marketplace: 'resmi', scope: 'user', version: '1.0.0', installPath: '/p/fmt', projectPath: '' },
    { id: 'fmt@resmi', name: 'fmt', marketplace: 'resmi', scope: 'project', version: '', installPath: '/p/fmt2', projectPath: '/proj' },
    { id: 'tek', name: 'tek', marketplace: '', scope: 'user', version: '3', installPath: '', projectPath: '' }]);
  assert.deepStrictEqual(C.parseInstalled(null), []);
});
test('parseFrontmatter / agentInfo', () => {
  const t = '---\nname: "kod-inceleme"\ndescription: Kodu inceler\nmodel: sonnet\ntools: Read, Grep\nbos:\n  - a\n  - \'b\'\ndizi: [x, "y"]\n# yorum\n---\nGövde';
  assert.deepStrictEqual(C.parseFrontmatter(t), { name: 'kod-inceleme', description: 'Kodu inceler', model: 'sonnet', tools: 'Read, Grep', bos: ['a', 'b'], dizi: ['x', 'y'] });
  assert.deepStrictEqual(C.parseFrontmatter('gövde'), {});
  assert.deepStrictEqual(C.parseFrontmatter(null), {});
  assert.deepStrictEqual(C.parseFrontmatter('---\r\nname: a\r\n---'), { name: 'a' });
  assert.deepStrictEqual(C.parseFrontmatter('---\n  - yetim\n---\n'), {});
  assert.deepStrictEqual(C.agentInfo(t, 'x.md'), { name: 'kod-inceleme', description: 'Kodu inceler', model: 'sonnet', tools: ['Read', 'Grep'] });
  assert.deepStrictEqual(C.agentInfo('---\ntools:\n  - Bash\n---\n', 'ajan.md'), { name: 'ajan', description: '', model: '', tools: ['Bash'] });
  assert.deepStrictEqual(C.agentInfo('', null), { name: '', description: '', model: '', tools: [] });
  assert.deepStrictEqual(C.agentInfo('---\nname: [a]\n---\n', 'b.md').name, 'b');
});
test('memoryNote / appendNote', () => {
  assert.strictEqual(C.memoryNote('# testlerde gerçek ~/.claude kullanma '), 'testlerde gerçek ~/.claude kullanma');
  assert.strictEqual(C.memoryNote('#not'), 'not');
  assert.strictEqual(C.memoryNote('## Başlık'), null);
  assert.strictEqual(C.memoryNote('# a\nb'), null);
  assert.strictEqual(C.memoryNote('#   '), null);
  assert.strictEqual(C.memoryNote('merhaba #'), null);
  assert.strictEqual(C.memoryNote(null), null);
  assert.strictEqual(C.appendNote('', 'a'), '- a\n');
  assert.strictEqual(C.appendNote(null, ' a  b '), '- a b\n');
  assert.strictEqual(C.appendNote('# X', 'a'), '# X\n- a\n');
  assert.strictEqual(C.appendNote('# X\n', 'a'), '# X\n- a\n');
  assert.throws(() => C.appendNote('x', ' '), /boş/);
  assert.throws(() => C.appendNote('x'), /boş/);
});
test('fmtTs, toMarkdown, exportName', () => {
  const ts = new Date(2026, 10, 6, 9, 5).toISOString();
  assert.strictEqual(C.fmtTs(ts), '2026-11-06 09:05');
  assert.strictEqual(C.fmtTs('bozuk'), '');
  assert.strictEqual(C.fmtTs(null), '');
  const now = new Date(2026, 10, 6, 10, 0).getTime();
  const md = C.toMarkdown({ title: 'Deneme', project: '~/p', id: 'abc', model: 'Opus', skipped: 2, msgs: [
    { r: 'u', t: 'Merhaba', ts }, { r: 'a', ts, b: [{ t: 'text', v: 'Selam\n' }, { t: 'tool', n: 'Bash', a: 'ls `-la`\n', err: true }, { t: 'tool', n: 'Read' }, { t: 'x' }, { t: 'text' }] },
    { r: 'u', t: '' }, { r: 'a', b: null }, { r: 's' }, null] }, { now });
  assert.strictEqual(md, [
    '# Deneme', '', '- Proje: `~/p`', '- Oturum: `abc`', '- Model: Opus', '- Dışa aktarıldı: 2026-11-06 10:00', '- Not: ilk 2 tur dahil değil', '',
    '---', '', '### Kullanıcı · 2026-11-06 09:05', '', 'Merhaba', '',
    '---', '', '### Claude · 2026-11-06 09:05', '', 'Selam', '', "> Araç: `Bash` — ls '-la' (hata)", '', '> Araç: `Read`', '',
    '---', '', '### Kullanıcı', '', '_(boş)_', '', '---', '', '### Claude', ''].join('\n'));
  assert.match(C.toMarkdown(null), /^# Sohbet\n\n- Dışa aktarıldı: /);
  assert.strictEqual(C.toMarkdown({ title: 'x'.repeat(300), msgs: [] }, { now }).split('\n')[0].length, 2 + 200);
  assert.strictEqual(C.exportName('a/b:c?', now), 'abc 2026-11-06.md');
  assert.strictEqual(C.exportName('', now), 'sohbet 2026-11-06.md');
  assert.strictEqual(C.exportName('son. ', now), 'son 2026-11-06.md');
  assert.match(C.exportName('x'), /^x \d{4}-\d\d-\d\d\.md$/);
});
test('tarayıcıda window.ccfgCore olarak yüklenir', () => {
  const vm = require('vm'), fs = require('fs');
  const ctx = { window: {} }; vm.createContext(ctx);
  const MOD = require.resolve('../src/renderer/claudecfg-core.js');
  vm.runInContext(fs.readFileSync(MOD, 'utf8'), ctx, { filename: MOD });
  assert.strictEqual(typeof ctx.window.ccfgCore.toMarkdown, 'function');
  const ctx2 = {}; vm.createContext(ctx2); vm.runInContext(fs.readFileSync(MOD, 'utf8'), ctx2, { filename: MOD });
  assert.strictEqual(typeof ctx2.ccfgCore, 'object', 'window yoksa genel nesneye yazılır');
});
