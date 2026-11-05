#!/usr/bin/env node
// Mutasyon testi: bir modüldeki operatörleri tek tek değiştirir (=== → !==, > → >=, && → ||, true → false …),
// her mutant için ilgili testleri geçici bir kopyada koşar. Testler bozulursa mutant "öldü" (iyi);
// hâlâ geçiyorsa "yaşadı" — testler o satırdaki mantığı gerçekten doğrulamıyor demektir.
// Kullanım: node scripts/mutate.js src/main/mirror.js test/mirror.test.js [daha fazla test] [--only 120-180] [--jobs 6]
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = n => { const i = argv.indexOf(n); if (i < 0) return null; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const only = opt('--only'), jobs = +(opt('--jobs') || Math.max(2, os.cpus().length - 2)), timeout = +(opt('--timeout') || 90) * 1000;
const [target, ...tests] = argv;
if (!target || !tests.length) { console.error('Kullanım: node scripts/mutate.js <modül> <test...> [--only a-b] [--jobs n]'); process.exit(2); }
const [lo, hi] = only ? only.split('-').map(Number) : [1, Infinity];
const src = fs.readFileSync(path.join(ROOT, target), 'utf8');

// --- Kod bölgelerini bul (dize, şablon, yorum, düzenli ifade dışında kalan yerler mutasyona açık) ---
function codeMask(s) {
  const mask = new Uint8Array(s.length); let i = 0, prev = '';
  const regexOk = () => /[(,=:[!&|?{};+\-*%<>~^]$|^$|\b(return|typeof|case|in|of)$/.test(prev.trimEnd());
  while (i < s.length) {
    const c = s[i], d = s[i + 1];
    if (c === '/' && d === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { const e = s.indexOf('*/', i + 2); i = e < 0 ? s.length : e + 2; continue; }
    if (c === '"' || c === "'") { i++; while (i < s.length && s[i] !== c) { if (s[i] === '\\') i++; i++; } i++; prev = 'x'; continue; }
    if (c === '`') { i++; while (i < s.length && s[i] !== '`') { if (s[i] === '\\') i++; i++; } i++; prev = 'x'; continue; }
    if (c === '/' && regexOk()) { i++; let cls = false; while (i < s.length && (s[i] !== '/' || cls)) { if (s[i] === '\\') i++; else if (s[i] === '[') cls = true; else if (s[i] === ']') cls = false; i++; } i++; while (/[a-z]/i.test(s[i] || '')) i++; prev = 'x'; continue; }
    mask[i] = 1; if (!/\s/.test(c)) prev += c; if (prev.length > 40) prev = prev.slice(-40); i++;
  }
  return mask;
}
const RULES = [
  [/===/g, '!=='], [/!==/g, '==='], [/(?<![=!<>])==(?!=)/g, '!='], [/!=(?!=)/g, '=='],
  [/(?<![=>-])>(?![=>])/g, '>='], [/(?<![<=])<(?![=<])/g, '<='], [/>=/g, '>'], [/<=/g, '<'],
  [/&&/g, '||'], [/\|\|/g, '&&'], [/\?\?/g, '||'],
  [/(?<![+\w])\+(?![+=])/g, '-'], [/(?<![-\w])-(?![-=>])(?=\s*[\w(])/g, '+'],
  [/\btrue\b/g, 'false'], [/\bfalse\b/g, 'true'],
  [/(?<![!=])!(?![=])(?=[\w(.!])/g, ''],  // olumsuzlamayı kaldır
];
const mask = codeMask(src);
const lineOf = idx => src.slice(0, idx).split('\n').length;
const mutants = [];
for (const [rx, rep] of RULES) for (const m of src.matchAll(rx)) {
  const at = m.index; if (!mask[at] || !mask[at + m[0].length - 1]) continue;
  const ln = lineOf(at); if (ln < lo || ln > hi) continue;
  mutants.push({ ln, from: m[0], to: rep, at, len: m[0].length });
}

// --- Geçici kopya ve koşum ---
const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-mut-'));
const groups = new Set(); // çalışan koşuların süreç grupları: araç yarıda kesilirse onlar da kapansın
const cleanup = () => { for (const g of groups) try { process.kill(-g, 'SIGKILL'); } catch {}
  try { fs.rmSync(tmpBase, { recursive: true, force: true, maxRetries: 5 }); } catch (e) { console.error('geçici klasör silinemedi:', tmpBase, e.code); } };
process.on('exit', cleanup);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(130));
function copyRepo(dst) { for (const d of ['src', 'test', 'package.json']) fs.cpSync(path.join(ROOT, d), path.join(dst, d), { recursive: true }); }
function run(dir) {
  return new Promise(res => {
    // Her koşu kendi geçici köküyle başlar ve bitince silinir: testlerin bıraktığı dosyalar yüzlerce koşuda birikip diski doldurmasın.
    const tmp = path.join(dir, '.tmp'); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp);
    const p = spawn(process.execPath, ['--test', ...tests], { cwd: dir, env: { ...process.env, CLAUDE_PANEL_HOME: path.join(dir, '.home'), TMPDIR: tmp, TEMP: tmp, TMP: tmp }, stdio: 'ignore', detached: process.platform !== 'win32' });
    groups.add(p.pid);
    const rm = d => { try { fs.rmSync(d, { recursive: true, force: true }); } catch {} };
    const done = status => { clearTimeout(t); rm(tmp); rm(path.join(dir, '.home')); res(status); };
    let timedOut = false;
    // Sonsuz döngüye giren mutantta yalnızca ana süreç değil, testleri koşan alt süreçler de kapanmalı (yoksa yetim kalıp CPU yakarlar):
    // süreç kendi grubunda başlatılır ve grubun tamamı öldürülür.
    const killAll = () => { try { process.kill(-p.pid, 'SIGKILL'); } catch { try { p.kill('SIGKILL'); } catch {} } };
    const t = setTimeout(() => { timedOut = true; killAll(); }, timeout);
    p.on('exit', code => { killAll(); groups.delete(p.pid); done(timedOut ? 'timeout' : code === 0 ? 'survived' : 'killed'); });
  });
}
(async () => {
  const base = path.join(tmpBase, 'base'); copyRepo(base);
  if (await run(base) !== 'survived') { console.error('Testler değişmemiş kodda bile geçmiyor — önce onları düzelt.'); process.exit(2); }
  const results = []; let next = 0, done = 0;
  const worker = async w => {
    const dir = path.join(tmpBase, 'w' + w); copyRepo(dir);
    while (next < mutants.length) {
      const m = mutants[next++];
      const code = src.slice(0, m.at) + m.to + src.slice(m.at + m.len);
      fs.writeFileSync(path.join(dir, target), code);
      let status;
      try { new (require('vm').Script)(code.replace(/^#!.*/, '')); status = await run(dir); } catch { status = 'invalid'; }
      results.push({ ...m, status }); done++;
      if (process.stdout.isTTY) process.stdout.write(`\r${done}/${mutants.length}`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(jobs, mutants.length || 1) }, (_, w) => worker(w)));
  const lines = src.split('\n');
  const live = results.filter(r => r.status === 'survived').sort((a, b) => a.ln - b.ln);
  const valid = results.filter(r => r.status !== 'invalid');
  const killed = valid.filter(r => r.status !== 'survived').length;
  console.log(`\n${target}: ${valid.length} mutant, ${killed} öldü, ${live.length} yaşadı — skor %${valid.length ? (killed / valid.length * 100).toFixed(1) : '100.0'}`);
  for (const r of live) console.log(`  YAŞADI ${target}:${r.ln}  "${r.from}" → "${r.to || '(silindi)'}"   | ${lines[r.ln - 1].trim().slice(0, 110)}`);
  process.exit(live.length ? 1 : 0); // geçici klasörü 'exit' dinleyicisi siler
})();
