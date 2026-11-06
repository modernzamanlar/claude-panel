#!/usr/bin/env node
// npm test: testleri kendine ait geçici bir kökle (TMPDIR/TEMP/TMP) koşar ve bitince o kökü siler.
// Böylece bir test kendi geçici klasörünü silmeyi unutsa bile diskte hiçbir şey birikmez.
// Kullanım: node scripts/test.js [test dosyaları…]  (varsayılan: test/*.test.js)
// Klasör `node --test`'e verilmez: Node 24 Windows'ta "test/" argümanını modül sanıyor; dosyalar burada listelenir.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const cwd = path.join(__dirname, '..');
const defaults = () => fs.readdirSync(path.join(cwd, 'test'))
  .filter((f) => f.endsWith('.test.js'))
  .sort()
  .map((f) => path.join('test', f));

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-testrun-'));
const clean = () => { try { fs.rmSync(root, { recursive: true, force: true }); } catch {} };
const args = process.argv.slice(2);
const p = spawn(process.execPath, ['--test', ...(args.length ? args : defaults())], {
  cwd,
  env: { ...process.env, TMPDIR: root, TEMP: root, TMP: root },
  stdio: 'inherit',
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => p.kill(sig));
p.on('exit', (code, sig) => { clean(); process.exit(sig ? 1 : code); });
