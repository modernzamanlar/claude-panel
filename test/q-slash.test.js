// renderer/slash.js: "/" menüsü (şablon + komut + skill). Olay biçimleri claude 2.1.318 `-p --output-format stream-json`
// çıktısından alındı: system/init (slash_commands, skills, terminal_slash_commands) ve system/commands_changed (commands[]).
const { test } = require('node:test');
const assert = require('node:assert');
const S = require('../src/renderer/slash.js');

const TPL = [{ name: 'Durum özeti', text: 'Şu ana kadar ne yaptın?' }, { name: 'Sesi temizle', text: 'Sesi temizle.' }, { name: '', text: 'adsız' }, null, { name: 'Metinsiz' }];
const INIT = { type: 'system', subtype: 'init', slash_commands: ['premiere', 'deneme-skill', 'projekomut', 'compact', 'clear', 'context', 'doctor', 'usage', 'model', 'code-review', 'anthropic-skills:pdf', 'color', '__remote-workflow', 7],
  skills: ['premiere', 'deneme-skill', 'code-review', 'anthropic-skills:pdf'], terminal_slash_commands: ['doctor', 'color'] };
const CHANGED = { type: 'system', subtype: 'commands_changed', commands: [
  { name: 'premiere', description: 'Adobe Premiere Pro ile çalışma. (user)', argumentHint: '' },
  { name: 'deneme-skill', description: 'Proje deneme skill aciklamasi (project)', argumentHint: '' },
  { name: 'projekomut', description: 'Proje ozel komut (project)', argumentHint: '<ad>' },
  { name: 'compact', description: 'Free up context', argumentHint: '<optional>', builtin: true },
  { name: 'clear', description: 'Start a new session', aliases: ['reset', 'new'], builtin: true },
  { name: 'doctor', description: 'Diagnose', builtin: true, aliases: ['checkup'] },
  { name: 'agents', description: 'Removed wizard', builtin: true },
  { name: 'code-review', description: 'Review the current diff', aliases: ['review'], builtin: true },
  { name: 'pdf', description: 'PDF araçları (claude.ai sync)', aliases: ['anthropic-skills:pdf', 'kötü ad'] },
  { name: 'araclar:yap', description: 'Plugin komutu (araclar)' },
  { name: 'tuhaf', description: 'Sonu (çok kelimeli parantez)' },
  { name: 'premiere-kopru:guvenli_degisiklik (MCP)', description: 'Köprüyle güvenli değişiklik akışı' },
  { name: '__remote-workflow', description: 'gizli' },
  { name: 'color', description: 'Renk', builtin: true },
  null, { description: 'adsız' },
] };
const FILES = [
  { name: 'premiere', desc: 'Dosyadan açıklama', src: 'user', kind: 'skill' },
  { name: 'projekomut', desc: 'Dosyadan komut', hint: '<x>', src: 'project', kind: 'command' },
  { name: 'yeni-dosya', desc: 'CLI henüz bilmiyor', src: 'user', kind: 'command' },
  { name: 'araclar:beceri', desc: 'Plugin skill', src: 'plugin', kind: 'skill', plugin: 'araclar' },
  { name: 'clear', desc: 'kullanıcının aynı adlı komutu: yerleşik öne geçer', src: 'user', kind: 'command' },
  { name: 'boşluklu ad', desc: 'x', src: 'user', kind: 'command' }, null,
];
const names = l => l.map(x => x.name);

test('token: yalnız mesajın başındaki "/" sözcüğü; imleç ortadaysa sözcüğün sonu', () => {
  assert.deepStrictEqual(S.token('/com'), { start: 0, end: 4, q: 'com' });
  assert.deepStrictEqual(S.token('/'), { start: 0, end: 1, q: '' });
  assert.deepStrictEqual(S.token('/compact talimat', 3), { start: 0, end: 8, q: 'co' });
  assert.strictEqual(S.token('/compact talimat'), null, 'imleç argümandayken menü kapalı');
  assert.strictEqual(S.token('merhaba /co'), null);
  assert.strictEqual(S.token(' /co'), null);
  assert.strictEqual(S.token('a/b'), null);
  assert.strictEqual(S.token(5), null);
  assert.deepStrictEqual(S.token('/x', 99), { start: 0, end: 2, q: 'x' }, 'geçersiz imleç → metnin sonu');
  assert.deepStrictEqual(S.token('/x', -1), { start: 0, end: 2, q: 'x' });
});

test('fromEvent: init ve commands_changed birleşir; ilgisiz olay bilgiyi değiştirmez', () => {
  assert.strictEqual(S.fromEvent(null, null), null);
  assert.strictEqual(S.fromEvent(undefined, { type: 'assistant' }), null);
  const a = S.fromEvent(null, INIT);
  assert.deepStrictEqual(a.names.slice(-2), ['color', '__remote-workflow'], 'metin olmayan ad atılır');
  assert.deepStrictEqual(a.terminal, ['doctor', 'color']);
  const b = S.fromEvent(a, CHANGED);
  assert.strictEqual(b.names, a.names);
  assert.strictEqual(b.list.length, CHANGED.commands.length - 2, 'adsız öğeler atılır');
  assert.strictEqual(S.fromEvent(b, { type: 'system', subtype: 'status' }), b);
  assert.strictEqual(S.fromEvent(b, { type: 'system', subtype: 'commands_changed' }), b, 'commands dizisi yoksa değişmez');
  const c = S.fromEvent(b, { type: 'system', subtype: 'init' });
  assert.deepStrictEqual([c.names, c.skills, c.terminal, c.list], [[], [], [], b.list], 'yeni init, açıklamalı listeyi korur');
});

test('parseSource: açıklama sonundaki kaynak etiketi', () => {
  assert.deepStrictEqual(S.parseSource('A (user)'), { desc: 'A', src: 'user' });
  assert.deepStrictEqual(S.parseSource('B (project)'), { desc: 'B', src: 'project' });
  assert.deepStrictEqual(S.parseSource('C (claude.ai sync)'), { desc: 'C', src: 'claude.ai' });
  assert.deepStrictEqual(S.parseSource('D (araclar)'), { desc: 'D', src: 'plugin', plugin: 'araclar' });
  assert.deepStrictEqual(S.parseSource('E (iki kelime)'), { desc: 'E (iki kelime)', src: null });
  assert.deepStrictEqual(S.parseSource('etiketsiz '), { desc: 'etiketsiz', src: null });
  assert.deepStrictEqual(S.parseSource(undefined), { desc: '', src: null });
});

test('build: CLI bilgisi yokken şablonlar + yerleşikler + dosya taraması', () => {
  const l = S.build({ templates: TPL, files: FILES });
  assert.deepStrictEqual(l.filter(x => x.sec === 'tpl').map(x => [x.name, x.src, x.text]), [['Durum özeti', 'template', 'Şu ana kadar ne yaptın?'], ['Sesi temizle', 'template', 'Sesi temizle.']]);
  assert.deepStrictEqual(names(l.filter(x => x.sec === 'cmd')), [...S.BUILTIN.map(b => b.name), 'projekomut', 'yeni-dosya']);
  assert.deepStrictEqual(names(l.filter(x => x.sec === 'skill')), ['premiere', 'araclar:beceri']);
  const clear = l.find(x => x.name === 'clear');
  assert.deepStrictEqual([clear.src, clear.action, clear.aliases], ['builtin', 'new', ['new', 'reset']]);
  assert.strictEqual(l.find(x => x.name === 'projekomut').hint, '<x>');
  assert.strictEqual(l.find(x => x.name === 'araclar:beceri').plugin, 'araclar');
  assert.deepStrictEqual(S.build(), S.build({}).slice(), 'boş girdi: yalnız yerleşikler');
  assert.strictEqual(S.build().length, S.BUILTIN.length);
  assert.deepStrictEqual(S.build({ files: 'bozuk' }).length, S.BUILTIN.length);
});

test('build: yalnız init geldiyse skill\'ler alınır, açıklama dosyadan; bilinmeyen yerleşik ve terminal komutları alınmaz', () => {
  const cli = S.fromEvent(null, INIT);
  const l = S.build({ cli, files: FILES });
  const by = Object.fromEntries(l.map(x => [x.name, x]));
  assert.ok(!by.doctor && !by.color && !by['__remote-workflow'], 'terminal ve gizli komutlar yok');
  assert.ok(!by['yeni-dosya'], 'CLI listesinde olmayan dosya alınmaz (CLI bilgisi daha doğru)');
  assert.deepStrictEqual([by.premiere.sec, by.premiere.desc, by.premiere.src], ['skill', 'Dosyadan açıklama', 'user']);
  assert.deepStrictEqual([by['deneme-skill'].sec, by['deneme-skill'].desc, by['deneme-skill'].src], ['skill', '', 'builtin']);
  assert.deepStrictEqual([by.projekomut.sec, by.projekomut.hint], ['cmd', '<x>']);
  assert.ok(by['code-review'] && by['anthropic-skills:pdf']);
  // init'te olmayan, panelin CLI'ye gönderdiği yerleşikler listelenmez; panel işlevli olanlar hep var
  assert.ok(by.compact && by.context && by.usage && by.clear && by.model && by.effort);
  assert.ok(!by.init && !by.recap, 'init listesinde yok');
  // dosyası olmayan, skill olmayan ad (ör. "doctor" dışındaki bilinmeyen yerleşik) atlanır
  assert.ok(!S.build({ cli: S.fromEvent(null, { ...INIT, slash_commands: ['bilinmeyen'], skills: [], terminal_slash_commands: [] }) }).some(x => x.name === 'bilinmeyen'));
  const sk = S.build({ cli: S.fromEvent(null, { ...INIT, slash_commands: ['sk'], skills: ['sk'] }), files: [{ name: 'sk', desc: 'd', src: 'user', kind: 'command' }] });
  assert.strictEqual(sk.find(x => x.name === 'sk').sec, 'skill');
  const fk = S.build({ cli: S.fromEvent(null, { ...INIT, slash_commands: ['fk'], skills: [] }), files: [{ name: 'fk', desc: 'd', kind: 'skill' }] });
  assert.deepStrictEqual([fk.find(x => x.name === 'fk').sec, fk.find(x => x.name === 'fk').src], ['skill', undefined]);
});

test('build: commands_changed listesi birincil kaynak; kaynak etiketleri ve takma adlar', () => {
  const cli = S.fromEvent(S.fromEvent(null, INIT), CHANGED);
  const l = S.build({ cli, files: FILES, templates: TPL });
  const by = Object.fromEntries(l.map(x => [x.name, x]));
  assert.deepStrictEqual([by.premiere.desc, by.premiere.src, by.premiere.sec], ['Adobe Premiere Pro ile çalışma.', 'user', 'skill']);
  assert.deepStrictEqual([by['deneme-skill'].src, by['deneme-skill'].sec], ['project', 'skill']);
  assert.deepStrictEqual([by.projekomut.src, by.projekomut.sec, by.projekomut.hint], ['project', 'cmd', '<ad>']);
  assert.deepStrictEqual([by['code-review'].src, by['code-review'].sec, by['code-review'].aliases], ['builtin', 'skill', ['review']], 'yerleşik skill');
  assert.deepStrictEqual([by.pdf.src, by.pdf.sec, by.pdf.aliases], ['claude.ai', 'skill', ['anthropic-skills:pdf']], 'skill takma adıyla tanınır; boşluklu takma ad atılır');
  assert.deepStrictEqual([by['araclar:yap'].src, by['araclar:yap'].plugin, by['araclar:yap'].sec], ['plugin', 'araclar', 'cmd']);
  assert.deepStrictEqual([by.tuhaf.desc, by.tuhaf.src], ['Sonu (çok kelimeli parantez)', 'user'], 'etiket yoksa kullanıcı sayılır');
  assert.ok(!by.agents && !by.doctor && !by.color, 'denenmemiş/terminal yerleşikler yok');
  assert.ok(!Object.keys(by).some(n => n.includes(' ')), 'MCP istemi (boşluklu ad) yok');
  assert.ok(!by['yeni-dosya'] && !by['araclar:beceri'], 'liste varken dosya taraması eklenmez');
  assert.strictEqual(by.clear.desc, 'Yeni sohbet aç (aynı klasörde)', 'yerleşik, panel açıklamasıyla');
  assert.ok(by.compact && by.context && by.usage, 'CLI listesinde adı geçen yerleşikler');
  assert.ok(!by.init, 'CLI bildirmediği yerleşik yok');
  assert.deepStrictEqual(l.map(x => x.sec).join(''), l.map(x => x.sec).sort((a, b) => ['tpl', 'cmd', 'skill'].indexOf(a) - ['tpl', 'cmd', 'skill'].indexOf(b)).join(''), 'bölüm sırası');
  // yalnız commands_changed varsa (init yok) yerleşikler listedeki ada göre
  const only = S.build({ cli: S.fromEvent(null, CHANGED) });
  assert.ok(only.some(x => x.name === 'compact') && !only.some(x => x.name === 'context'));
  // açıklamasız öğe dosyadan tamamlanır; kaynağı yoksa dosyanınki
  const fill = S.build({ cli: { list: [{ name: 'projekomut' }, { name: 'premiere', description: '' }] }, files: FILES });
  assert.deepStrictEqual(fill.filter(x => !x.src || x.src !== 'builtin').map(x => [x.name, x.desc, x.src, x.sec]), [['projekomut', 'Dosyadan komut', 'project', 'cmd'], ['premiere', 'Dosyadan açıklama', 'user', 'skill']]);
  const long = S.build({ cli: { list: [{ name: 'uzun', description: 'x'.repeat(400) }] } }).find(x => x.name === 'uzun');
  assert.strictEqual(long.desc.length, 160); assert.ok(long.desc.endsWith('…'));
});

test('filter: ad başı, parça başı, takma ad, içerir; bölüm sırası ve özgün sıra korunur', () => {
  const cli = S.fromEvent(S.fromEvent(null, INIT), CHANGED);
  const l = S.build({ cli, files: FILES, templates: TPL });
  assert.strictEqual(S.filter(l, '').length, l.length);
  assert.strictEqual(S.filter(l).length, l.length);
  assert.deepStrictEqual(names(S.filter(l, 'dur')), ['Durum özeti']);
  assert.deepStrictEqual(names(S.filter(l, 'DUR')), ['Durum özeti'], 'büyük/küçük harf duyarsız');
  assert.deepStrictEqual(names(S.filter(l, 'öze')), ['Durum özeti'], 'şablon adının ikinci kelimesi (parça başı)');
  assert.deepStrictEqual(names(S.filter(l, 'co')), ['compact', 'context', 'config', 'code-review'].filter(n => l.some(x => x.name === n)));
  assert.deepStrictEqual(names(S.filter(l, 'review')), ['code-review'], '"-" sonrası parça başı');
  assert.deepStrictEqual(names(S.filter(l, 'rese')), ['clear'], 'takma ad');
  assert.deepStrictEqual(names(S.filter(l, 'xt')), ['context'], 'içerir');
  assert.deepStrictEqual(names(S.filter(l, 'yap')), ['araclar:yap'], '":" sonrası parça başı');
  assert.deepStrictEqual(S.filter(l, 'qqzz'), []);
  assert.deepStrictEqual(S.filter(null, 'a'), []);
  // aynı bölümde önek eşleşmesi içerir eşleşmesinin önüne geçer
  assert.deepStrictEqual(names(S.filter([{ sec: 'cmd', name: 'aba' }, { sec: 'cmd', name: 'ba' }], 'ba')), ['ba', 'aba']);
});

test('sections: ardışık bölümler başlıklarıyla; k düz sıradır', () => {
  const g = S.sections([{ sec: 'tpl', name: 'a' }, { sec: 'cmd', name: 'b' }, { sec: 'cmd', name: 'c' }, { sec: 'skill', name: 'd' }, { sec: 'xyz', name: 'e' }]);
  assert.deepStrictEqual(g.map(x => [x.title, x.items.map(i => i.k)]), [['Şablonlar', [0]], ['Komutlar', [1, 2]], ["Skill'ler", [3]], ['xyz', [4]]]);
  assert.deepStrictEqual(S.sections(), []);
});

test('apply: şablon metni koyar; komut "/ad " ekler; panel komutu metni siler ve işlevi döndürür', () => {
  const tpl = { sec: 'tpl', name: 'Durum özeti', text: 'Özet ver.' };
  assert.deepStrictEqual(S.apply('/dur', S.token('/dur'), tpl), { text: 'Özet ver.', caret: 9 });
  assert.deepStrictEqual(S.apply('/dur devam', S.token('/dur devam', 4), tpl), { text: 'Özet ver. devam', caret: 9 });
  const cmd = { sec: 'cmd', name: 'compact' };
  assert.deepStrictEqual(S.apply('/com', S.token('/com'), cmd), { text: '/compact ', caret: 9 });
  assert.deepStrictEqual(S.apply('/co   kısa tut', S.token('/co   kısa tut', 3), cmd), { text: '/compact kısa tut', caret: 9 });
  assert.strictEqual(S.token('/compact ', 9), null, 'eklendikten sonra menü kapanır');
  assert.deepStrictEqual(S.apply('/cl', S.token('/cl'), { sec: 'cmd', name: 'clear', action: 'new' }), { text: '', caret: 0, action: 'new' });
  assert.deepStrictEqual(S.apply('/mo  x', S.token('/mo  x', 3), { sec: 'cmd', name: 'model', action: 'model' }), { text: 'x', caret: 0, action: 'model' });
});

test('intercept: tek satırlık panel komutları (takma adlar dahil)', () => {
  assert.deepStrictEqual(S.intercept('/clear'), { action: 'new', arg: '' });
  assert.deepStrictEqual(S.intercept('  /new  '), { action: 'new', arg: '' });
  assert.deepStrictEqual(S.intercept('/reset'), { action: 'new', arg: '' });
  assert.deepStrictEqual(S.intercept('/model sonnet'), { action: 'model', arg: 'sonnet' });
  assert.deepStrictEqual(S.intercept('/effort\thigh'), { action: 'effort', arg: 'high' });
  for (const t of ['/compact', '/context', '/clear\nikinci satır', 'clear', '/bilinmeyen', '', null, undefined]) assert.strictEqual(S.intercept(t), null, String(t));
});

test('srcLabel, move, norm ve genel ad', () => {
  assert.strictEqual(S.srcLabel({ src: 'plugin', plugin: 'araclar' }), 'plugin · araclar');
  assert.strictEqual(S.srcLabel({ src: 'plugin' }), 'plugin');
  assert.strictEqual(S.srcLabel({ src: 'builtin' }), 'yerleşik');
  assert.strictEqual(S.srcLabel({ src: 'template' }), 'şablon');
  assert.strictEqual(S.srcLabel({ src: 'garip' }), 'garip');
  assert.strictEqual(S.srcLabel({}), '');
  assert.deepStrictEqual([S.move(0, 3, -1), S.move(2, 3, 1), S.move(1, 3, 1), S.move(5, 0, 1)], [2, 0, 2, 0]);
  assert.strictEqual(S.norm('ŞABLON Özeti'), 'sablon ozeti');
  assert.strictEqual(globalThis.slash, S);
});
