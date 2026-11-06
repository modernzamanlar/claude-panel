// main/commands.js: "/" menüsü için skill ve özel komut taraması (geçici ev ve proje klasörüyle; gerçek ~/.claude'a dokunulmaz).
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const C = require('../src/main/commands.js');

const tmp = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cp-cmd-')));
const put = (root, rel, body) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, body); return p; };
const fm = (o, body = 'Gövde') => '---\n' + Object.entries(o).map(([k, v]) => k + ': ' + v).join('\n') + '\n---\n' + body + '\n';

beforeEach(() => C.clearCache());

test('frontmatter: düz, tırnaklı, çok satırlı değerler; ön bilgi yoksa boş', () => {
  assert.deepStrictEqual(C.frontmatter('Gövde yalnız'), {});
  assert.deepStrictEqual(C.frontmatter(null), {});
  const t = '﻿---\r\nname: ad\r\ndescription: "Çift \\"tırnak\\""\r\nArgument-Hint: \'tek \'\'tırnak\'\'\'\r\n# yorum\r\nuzun: >-\r\n  bir\r\n\r\n  iki\r\nson: |\r\n  üç\r\nbozuk: "kapanmamış\\"\r\n---\r\nGövde';
  assert.deepStrictEqual(C.frontmatter(t), { name: 'ad', description: 'Çift "tırnak"', 'argument-hint': "tek 'tırnak'", uzun: 'bir iki', son: 'üç', bozuk: 'kapanmamış\\' });
  assert.deepStrictEqual(C.frontmatter('---\nad: >\n---\n'), { ad: '' });
});

test('bodyDesc: ön bilgiden sonraki ilk dolu satır, başlık işareti atılır', () => {
  assert.strictEqual(C.bodyDesc('---\na: b\n---\n\n## Başlık burada\nsonra'), 'Başlık burada');
  assert.strictEqual(C.bodyDesc('düz satır'), 'düz satır');
  assert.strictEqual(C.bodyDesc('---\na: b\n---\n'), '');
});

test('realDir: yalnız mutlak ve var olan klasör', () => {
  const d = tmp(), f = put(d, 'a.txt', 'x');
  for (const x of [undefined, null, 3, '', 'göreli', d + '\0', 'x'.repeat(5000), f, path.join(d, 'yok')]) assert.strictEqual(C.realDir(x), null, String(x).slice(0, 30));
  assert.strictEqual(C.realDir(d), d);
  fs.rmSync(d, { recursive: true });
});

test('scanCommands: kullanıcı ve proje skill/komutları, alt klasörlü komut adları, açıklama yedeği', () => {
  const home = tmp(), cwd = tmp();
  put(home, '.claude/skills/kurgu/SKILL.md', fm({ name: 'kurgula', description: 'Kurgu yapar', 'argument-hint': '<klasör>' }));
  put(home, '.claude/skills/adsiz/SKILL.md', '# Adsız skill\nmetin');
  put(home, '.claude/skills/kotu-ad/SKILL.md', fm({ name: 'boşluklu ad', description: 'd' }));
  put(home, '.claude/skills/bos/README.md', 'SKILL.md yok');
  put(home, '.claude/skills/.gizli/SKILL.md', fm({ name: 'gizli' }));
  put(home, '.claude/skills/dosya.md', 'klasör değil');
  put(home, '.claude/commands/selam.md', fm({ description: 'Selam verir' }));
  put(home, '.claude/commands/git/pr.md', 'PR aç\n');
  put(home, '.claude/commands/notlar.txt', 'md değil');
  put(home, '.claude/commands/.gizli.md', 'gizli');
  put(home, '.claude/commands/a/b/c/d/derin.md', 'çok derin');
  put(cwd, '.claude/skills/proje-skill/SKILL.md', fm({ name: 'proje-skill', description: 'Proje' }));
  put(cwd, '.claude/commands/selam.md', fm({ description: 'Proje selamı (aynı ad: kullanıcınınki kalır)' }));
  put(cwd, '.claude/commands/derle.md', fm({ description: 'Derle' }));
  const list = C.scanCommands({ home, cwd });
  const by = Object.fromEntries(list.map(x => [x.name, x]));
  assert.deepStrictEqual(Object.keys(by).sort(), ['adsiz', 'derle', 'git:pr', 'kotu-ad', 'kurgula', 'proje-skill', 'selam']);
  assert.deepStrictEqual(by.kurgula, { name: 'kurgula', desc: 'Kurgu yapar', hint: '<klasör>', src: 'user', kind: 'skill' });
  assert.strictEqual(by.adsiz.desc, 'Adsız skill');
  assert.strictEqual(by['git:pr'].kind, 'command');
  assert.strictEqual(by['git:pr'].desc, 'PR aç');
  assert.strictEqual(by.selam.src, 'user');
  assert.strictEqual(by['proje-skill'].src, 'project');
  assert.strictEqual(by.derle.src, 'project');
  // önbellek: aynı ev+klasör için aynı liste (yeni dosya TTL içinde görünmez)
  put(home, '.claude/commands/yeni.md', 'yeni');
  assert.strictEqual(C.scanCommands({ home, cwd }), list);
  C.clearCache();
  assert.ok(C.scanCommands({ home, cwd }).some(x => x.name === 'yeni'));
  for (const d of [home, cwd]) fs.rmSync(d, { recursive: true });
});

test('scanCommands: geçersiz girdiler; ev = proje klasörü iki kez taranmaz; sınırlar', () => {
  assert.deepStrictEqual(C.scanCommands(), []);
  assert.deepStrictEqual(C.scanCommands({ home: 'göreli', cwd: 5 }), []);
  const home = tmp();
  put(home, '.claude/commands/a.md', 'a');
  const l = C.scanCommands({ home, cwd: home });
  assert.deepStrictEqual(l.map(x => [x.name, x.src]), [['a', 'user']]);
  // dosya sınırı ve okuma sınırı
  const old = { ...C.LIM };
  C.LIM.files = 2; C.LIM.bytes = 8; C.clearCache();
  put(home, '.claude/skills/s1/SKILL.md', fm({ name: 's1' }));
  put(home, '.claude/skills/s2/SKILL.md', fm({ name: 's2' }));
  put(home, '.claude/skills/s3/SKILL.md', fm({ name: 's3' }));
  const lim = C.scanCommands({ home });
  assert.strictEqual(lim.length, 2);
  assert.ok(lim.every(x => x.kind === 'skill'), 'sınır dolunca komutlara geçilmez');
  assert.deepStrictEqual([lim[0].name, lim[0].desc], ['s1', '---'], 'yalnız ilk 8 bayt okunur: ön bilgi kapanmadığından ad klasörden, açıklama ilk satırdan');
  C.LIM.files = 3; C.clearCache();
  put(home, '.claude/commands/b.md', 'b');
  assert.strictEqual(C.scanCommands({ home }).length, 3, 'komut taraması da sınırda durur');
  Object.assign(C.LIM, old);
  fs.rmSync(home, { recursive: true });
});

test('scanCommands: kurulu plugin komutları ve skill\'leri "plugin:ad" olarak', () => {
  const home = tmp(), p1 = tmp(), p2 = tmp();
  put(p1, 'commands/yap.md', fm({ description: 'Plugin komutu' }));
  put(p1, 'skills/beceri/SKILL.md', fm({ name: 'beceri', description: 'Plugin skill' }));
  put(p2, 'commands/iki.md', 'İkinci plugin');
  put(home, '.claude/plugins/installed_plugins.json', JSON.stringify({ version: 2, plugins: {
    'araclar@pazar': [{ installPath: p1 }, { installPath: p1 }],
    'eski@pazar': { installPath: p2 },
    'kotu ad@pazar': [{ installPath: p1 }],
    'yolsuz@pazar': [{ installPath: path.join(home, 'yok') }, null],
  } }));
  const by = Object.fromEntries(C.scanCommands({ home }).map(x => [x.name, x]));
  assert.deepStrictEqual(Object.keys(by).sort(), ['araclar:beceri', 'araclar:yap', 'eski:iki']);
  assert.deepStrictEqual(by['araclar:yap'], { name: 'araclar:yap', desc: 'Plugin komutu', hint: '', src: 'plugin', kind: 'command', plugin: 'araclar' });
  assert.strictEqual(by['araclar:beceri'].kind, 'skill');
  // bozuk ya da eksik json
  put(home, '.claude/plugins/installed_plugins.json', '{bozuk'); C.clearCache();
  assert.deepStrictEqual(C.scanCommands({ home }), []);
  put(home, '.claude/plugins/installed_plugins.json', 'null'); C.clearCache();
  assert.deepStrictEqual(C.scanCommands({ home }), []);
  put(home, '.claude/plugins/installed_plugins.json', '{"plugins":null}'); C.clearCache();
  assert.deepStrictEqual(C.scanCommands({ home }), []);
  for (const d of [home, p1, p2]) fs.rmSync(d, { recursive: true });
});

test('okunamayan komut dosyası atlanır', () => {
  const home = tmp();
  const bad = put(home, '.claude/commands/kilitli.md', 'x'); put(home, '.claude/commands/acik.md', 'açık');
  const open = fs.openSync, read = fs.readSync;
  fs.openSync = (p, ...a) => { if (p === bad) throw Object.assign(new Error('EACCES'), { code: 'EACCES' }); return open(p, ...a); };
  try { assert.deepStrictEqual(C.scanCommands({ home }).map(x => x.name), ['acik']); } finally { fs.openSync = open; }
  // açılıp okunamayan (ör. EISDIR, EIO) dosya da atlanır ve kapatılır
  fs.readSync = () => { throw new Error('EIO'); }; C.clearCache();
  try { assert.deepStrictEqual(C.scanCommands({ home }), []); } finally { fs.readSync = read; }
  fs.rmSync(home, { recursive: true });
});

test('önbellek en çok 16 klasör tutar', () => {
  const home = tmp(), dirs = [];
  for (let i = 0; i < 18; i++) dirs.push(tmp());
  const first = C.scanCommands({ home, cwd: dirs[0] });
  for (const d of dirs.slice(1)) C.scanCommands({ home, cwd: d });
  assert.notStrictEqual(C.scanCommands({ home, cwd: dirs[0] }), first, 'en eski kayıt atıldı');
  for (const d of [home, ...dirs]) fs.rmSync(d, { recursive: true });
});
