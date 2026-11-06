// Windows girdi yardımcısı: süreç bir kez açılır, satır protokolü, iptal/kapanma/zaman aşımı (süreç taklit edilir).
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const { PassThrough } = require('stream');
const { createInput, _test } = require('../src/main/screenctl-input');

function fakeSpawn(opts = {}) {
  const procs = [];
  const spawn = (file, args, o) => {
    const p = new EventEmitter();
    p.file = file; p.args = args; p.opts = o; p.lines = [];
    p.stdout = new PassThrough(); p.stderr = new PassThrough();
    p.stdin = { write: l => { p.lines.push(l.trim()); if (opts.auto) opts.auto(p, l.trim()); }, end: () => { p.ended = true; }, on() {} };
    p.kill = () => { p.killed = true; };
    p.say = s => p.stdout.write(s + '\n');
    procs.push(p);
    if (opts.onSpawn) opts.onSpawn(p);
    return p;
  };
  return { spawn, procs };
}
const auto = (p, l) => { const [no, cmd] = l.split(' '); if (cmd === 'pos') p.say(`${no} ok 10 -20`); else if (cmd === 'bad') p.say(`${no} err patladı`); else if (cmd !== 'reset' && cmd !== 'hang') p.say(`${no} ok`); };

test('Windows dışında açık hata (Mac: henüz yok)', async () => {
  const i = createInput({ platform: 'darwin', spawn: () => assert.fail('başlatılmamalı') });
  await assert.rejects(i.send('pos'), /yalnız Windows/);
  assert.equal(i.running, false);
});

test('tek süreç: hazır el sıkışması, ok/err yanıtları, sıralı numaralar, PowerShell argümanları', async () => {
  const f = fakeSpawn({ auto, onSpawn: p => setImmediate(() => { p.stdout.write('çöp satır\nhazir\n'); p.stderr.write('uyarı'); }) });
  const i = createInput({ platform: 'win32', spawn: f.spawn });
  assert.deepEqual(await i.send('pos'), ['10', '-20']);
  assert.deepEqual(await i.send('click', -5, 3, 1, 2), []);
  await assert.rejects(i.send('bad'), /Girdi hatası: patladı/);
  assert.deepEqual(await i.send('text', 'c7', '11f'), []);
  assert.equal(f.procs.length, 1);
  const p = f.procs[0];
  assert.deepEqual(p.lines, ['1 pos', '2 click -5 3 1 2', '3 bad', '4 text c7 11f']);
  assert.equal(p.file, 'powershell.exe');
  assert.deepEqual(p.args.slice(0, 6), ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand']);
  assert.equal(Buffer.from(p.args[6], 'base64').toString('utf16le'), _test.PS);
  assert.equal(p.opts.windowsHide, true);
  assert.equal(i.running, true);
  // bilinmeyen numara ve biçimsiz satır yok sayılır
  p.say('77 ok 1'); p.say('rastgele');
  // yalnız tam sayı ve küçük harf onaltılık kabul edilir: metin komut olarak yorumlanamaz
  for (const bad of [['x; rm'], ['A1'], [1.5], [{}], ['1 2']]) await assert.rejects(i.send('text', ...bad), /Geçersiz girdi argümanı/);
  i.close();
  assert.equal(p.ended, true); assert.equal(p.killed, true); assert.equal(i.running, false);
  i.close(); // ikinci kez sorun yok
});

test('C# yardımcısı: DPI farkındalığı, SendInput, Unicode metin, kök pencere', () => {
  assert.match(_test.CS, /SetProcessDpiAwarenessContext\(c\)\) SetThreadDpiAwarenessContext\(c\)/);
  assert.match(_test.CS, /new IntPtr\(-4\)/); // PER_MONITOR_AWARE_V2
  assert.match(_test.CS, /K\(0, \(ushort\)u, 0x0004\)/); // KEYEVENTF_UNICODE
  assert.match(_test.CS, /GetAncestor\(h, 2\)/); // GA_ROOT
  assert.match(_test.PS, /\[Console\]::In\.ReadLine\(\)/);
});

test('zaman aşımı, süreç kapanınca bekleyenler reddedilir ve sonraki çağrı yeni süreç açar', async () => {
  const f = fakeSpawn({ auto, onSpawn: p => setImmediate(() => p.say('hazir')) });
  const i = createInput({ platform: 'win32', spawn: f.spawn, timeoutMs: 30 });
  await assert.rejects(i.send('hang'), /yanıt vermedi/);
  const w = i.send('hang');
  await new Promise(r => setImmediate(r));
  f.procs[0].stderr.write('çöktü');
  await new Promise(r => setImmediate(r));
  f.procs[0].emit('exit', 1);
  await assert.rejects(w, /Girdi yardımcısı kapandı \(1\) çöktü/);
  assert.deepEqual(await i.send('pos'), ['10', '-20']);
  assert.equal(f.procs.length, 2);
  f.procs[0].emit('exit', 1); // eski sürecin geç gelen olayı yenisini bozmaz
  assert.equal(i.running, true);
  i.close();
});

test('başlatma hatası ve hazır olmadan kapanma', async () => {
  const f1 = fakeSpawn({ onSpawn: p => setImmediate(() => p.emit('error', new Error('ENOENT'))) });
  await assert.rejects(createInput({ platform: 'win32', spawn: f1.spawn }).send('pos'), /başlatılamadı: ENOENT/);
  const f2 = fakeSpawn({ onSpawn: p => setImmediate(() => p.emit('exit', 5)) });
  const i2 = createInput({ platform: 'win32', spawn: f2.spawn });
  await assert.rejects(i2.send('pos'), /kapandı \(5\)/);
  await assert.rejects(i2.send('pos'), /kapandı/); // yeniden dener
  assert.equal(f2.procs.length, 2);
});

test('cancel: bekleyenler iptal, basılı tuşlar bırakılır (reset); başlarken iptal edilen çağrı gönderilmez', async () => {
  const f = fakeSpawn({ auto, onSpawn: p => setTimeout(() => p.say('hazir'), 20) });
  const i = createInput({ platform: 'win32', spawn: f.spawn });
  i.cancel(); // süreç yokken: yalnız sayaç
  const early = i.send('pos');
  await new Promise(r => setImmediate(r));
  i.cancel();
  await assert.rejects(early, /durduruldu/);
  const w = i.send('hang');
  await new Promise(r => setTimeout(r, 5));
  i.cancel();
  await assert.rejects(w, /durduruldu/);
  assert.equal(f.procs[0].lines.at(-1).split(' ')[1], 'reset');
  assert.deepEqual(await i.send('pos'), ['10', '-20']); // iptalden sonra yeniden çalışır
  i.close();
});
