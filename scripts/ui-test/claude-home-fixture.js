// UI testi için geçici Claude ev klasörü: node claude-home-fixture.js <klasör>
// <klasör>/.claude (CLAUDE.md, settings.json, agents, output-styles, plugins) ve <klasör>/proj (proje CLAUDE.md, .claude/settings.json).
// Uygulama CLAUDE_PANEL_CLAUDE_HOME=<klasör> ile açılır; gerçek ~/.claude'a dokunulmaz.
const fs = require('fs');
const path = require('path');
const root = process.argv[2];
if (!root) { console.error('kullanım: node claude-home-fixture.js <klasör>'); process.exit(1); }
const put = (rel, text) => { const f = path.join(root, ...rel.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
const json = o => JSON.stringify(o, null, 2) + '\n';
put('.claude/CLAUDE.md', '# Genel kurallar\n\n- Arayüz dili Türkçe\n');
put('.claude/settings.json', json({
  theme: 'dark',
  permissions: { allow: ['Read(./src/**)', 'Bash(git status)'], deny: ['Bash(rm -rf:*)'], defaultMode: 'acceptEdits', additionalDirectories: ['../ortak'] },
  hooks: { Stop: [{ hooks: [{ type: 'command', command: 'python', args: ['kontrol.py'], timeout: 30 }] }],
    PreToolUse: [{ matcher: 'Bash|Edit', hooks: [{ type: 'command', command: 'npx prettier --check', timeout: 15 }] }] },
  enabledPlugins: { 'bicimci@resmi': true },
  bilinmeyenAnahtar: { korunmali: true },
}));
put('.claude/agents/kod-inceleme.md', '---\nname: kod-inceleme\ndescription: Değişiklikleri inceler, hata arar\nmodel: sonnet\ntools: Read, Grep, Glob\n---\nSen dikkatli bir gözden geçiricisin.\n');
put('.claude/output-styles/kisa.md', '---\nname: Kısa ve öz\ndescription: Tek paragraf yanıt\n---\nKısa yaz.\n');
const ip = path.join(root, '.claude', 'plugins', 'cache', 'resmi', 'bicimci', '1.0.0');
put('.claude/plugins/cache/resmi/bicimci/1.0.0/.claude-plugin/plugin.json', json({ name: 'bicimci', description: 'Kodu kaydederken biçimlendirir', version: '1.0.0' }));
const ip2 = path.join(root, '.claude', 'plugins', 'cache', 'resmi', 'notlar', '0.3.1');
put('.claude/plugins/cache/resmi/notlar/0.3.1/.claude-plugin/plugin.json', json({ name: 'notlar', description: 'Toplantı notu şablonları' }));
put('.claude/plugins/installed_plugins.json', json({ version: 2, plugins: {
  'bicimci@resmi': [{ scope: 'user', installPath: ip, version: '1.0.0', installedAt: '2026-11-01T10:00:00.000Z', lastUpdated: '2026-11-01T10:00:00.000Z' }],
  'notlar@resmi': [{ scope: 'user', installPath: ip2, version: '0.3.1', installedAt: '2026-11-02T10:00:00.000Z', lastUpdated: '2026-11-02T10:00:00.000Z' }] } }));
put('proj/CLAUDE.md', '# Proje\n\nTestler geçici klasörde çalışır.\n');
put('proj/.claude/settings.json', json({ permissions: { ask: ['WebFetch(domain:example.com)'] } }));
put('proj/.claude/agents/belge-yazari.md', '---\nname: belge-yazari\ndescription: README günceller\n---\n');
console.log(root);
