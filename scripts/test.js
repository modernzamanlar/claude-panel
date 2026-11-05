#!/usr/bin/env node
// npm test: testleri kendine ait geçici bir kökle (TMPDIR/TEMP/TMP) koşar ve bitince o kökü siler.
// Böylece bir test kendi geçici klasörünü silmeyi unutsa bile diskte hiçbir şey birikmez.
// Kullanım: node scripts/test.js [test dosyaları…]  (varsayılan: test/)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-testrun-'));
const clean = () => { try { fs.rmSync(root, { recursive: true, force: true }); } catch {} };
const args = process.argv.slice(2);
const p = spawn(process.execPath, ['--test', ...(args.length ? args : ['test/'])], {
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, TMPDIR: root, TEMP: root, TMP: root },
  stdio: 'inherit',
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => p.kill(sig));
p.on('exit', (code, sig) => { clean(); process.exit(sig ? 1 : code); });
