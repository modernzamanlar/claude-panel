// node --test test/q-bgtasks.test.js → src/renderer/bgtasks.js (arka plan görevleri) tam kapsam
const { test } = require('node:test');
const assert = require('node:assert');
const B = require('../src/renderer/bgtasks.js');
const TS = '2026-11-06T09:00:00.000Z', T0 = Date.parse(TS);

test('use: arka plana gidebilecek araçlar bekletilir; denetim araçları görev kimliğiyle; diğerleri yok sayılır', () => {
  const st = B.newState();
  assert.equal(B.use(st, null, 'Bash', {}), false);
  assert.equal(B.use(st, 'a', 'Bash', null), false);
  assert.equal(B.use(st, 'a', 'Bash', 'x'), false);
  assert.equal(B.use(st, 'a', 'Read', { file_path: 'x' }), false);
  assert.equal(B.use(st, 'b1', 'Bash', { command: ' npm\n run   watch ', description: 'İzle' }, TS), true);
  assert.deepEqual(st.pend.get('b1'), { k: 'bash', cmd: 'npm run watch', d: 'İzle', t0: T0 });
  assert.equal(B.use(st, 'p1', 'PowerShell', { command: 'Get-Date' }, 5), true);
  assert.deepEqual(st.pend.get('p1'), { k: 'bash', cmd: 'Get-Date', d: '', t0: 5 });
  assert.equal(B.use(st, 'm1', 'Monitor', { command: 'tail -f log' }, 'bozuk'), true);
  assert.equal(st.pend.get('m1').t0, null);
  assert.equal(B.use(st, 'g1', 'Agent', { prompt: 'uzun istem', description: 'Ajan' }, TS), true);
  assert.equal(st.pend.get('g1').cmd, '', 'alt ajanın istemi komut sayılmaz');
  assert.equal(B.use(st, 'g2', 'Task', {}, TS), true);
  assert.equal(B.use(st, 's1', 'TaskStop', { task_id: 'b1' }), true); assert.deepEqual(st.pend.get('s1'), { ctl: 'stop', tid: 'b1' });
  assert.equal(B.use(st, 's2', 'KillShell', { shell_id: 'b2' }), true); assert.equal(st.pend.get('s2').tid, 'b2');
  assert.equal(B.use(st, 'o1', 'BashOutput', { bash_id: 'b3' }), true); assert.deepEqual(st.pend.get('o1'), { ctl: 'out', tid: 'b3' });
  assert.equal(B.use(st, 'o2', 'TaskOutput', { task_id: 7 }), false);
});

test('idFrom: toolUseResult alanları, CLI cümleleri, Monitor kimliği; komut çıktısındaki rastgele kimlik alınmaz', () => {
  assert.equal(B.idFrom('', { status: 'async_launched', agentId: 'a1' }, 'agent'), 'a1');
  assert.equal(B.idFrom('', { status: 'completed', agentId: 'a1' }, 'agent'), null);
  assert.equal(B.idFrom('', { status: 'async_launched', agentId: 3 }, 'agent'), null);
  assert.equal(B.idFrom('', { backgroundTaskId: 'b9' }, 'bash'), 'b9');
  assert.equal(B.idFrom('', { taskId: 'm9' }, 'monitor'), 'm9');
  assert.equal(B.idFrom('Command running in background with ID: bx-1. Output…', 'metin', 'bash'), 'bx-1');
  assert.equal(B.idFrom('Command did not complete within 120s timeout and was moved to the background (ID: by2). Output…', null, 'bash'), 'by2');
  assert.equal(B.idFrom('Monitor started, task_id: "mon42"', {}, 'monitor'), 'mon42');
  assert.equal(B.idFrom('çıktı: task id: zzzz9', {}, 'bash'), null);
  assert.equal(B.idFrom('Bir şey: Command running in background with ID: b1', {}, 'bash'), null);
  assert.equal(B.idFrom(undefined, undefined, 'monitor'), null);
});

test('result: arka planda başlayan görev eklenir; hata, bilinmeyen, kimliksiz sonuç eklenmez; canlıda önce gelen görev tamamlanır', () => {
  const st = B.newState();
  assert.equal(B.result(st, 'yok', ''), null);
  B.use(st, 'e', 'Bash', { command: 'x' }, TS);
  assert.equal(B.result(st, 'e', 'Command running in background with ID: be', null, true), null);
  assert.equal(st.pend.has('e'), false);
  B.use(st, 'f', 'Bash', { command: 'ls' }, TS);
  assert.equal(B.result(st, 'f', 'dosyalar', {}, false), null, 'ön planda biten komut');
  B.use(st, 'b1', 'Bash', { command: 'npm run watch', description: 'İzle' }, TS);
  const t = B.result(st, 'b1', 'Command running in background with ID: bk1.', null, false, TS);
  assert.deepEqual(t, { id: 'bk1', tu: 'b1', k: 'bash', cmd: 'npm run watch', d: 'İzle', st: 'run', t0: T0, t1: null, out: '', code: null });
  // canlı: task_started önce geldi (cmd boş), sonuç gelince komut ve açıklama doldurulur
  B.sysEvent(st, { type: 'system', subtype: 'task_started', task_id: 'bk2', tool_use_id: 'b2', description: '', task_type: 'local_bash' }, 100);
  B.use(st, 'b2', 'Bash', { command: 'make', description: 'Derle' }, TS);
  const t2 = B.result(st, 'b2', '', { backgroundTaskId: 'bk2' }, false, TS);
  assert.deepEqual([t2.cmd, t2.d, t2.t0, st.list.length], ['make', 'Derle', 100, 2]);
  B.sysEvent(st, { type: 'system', subtype: 'task_started', task_id: 'bk3', tool_use_id: 'b3', description: 'Hazır', task_type: 'local_bash' }, 100);
  st.list.at(-1).cmd = 'eski';
  B.use(st, 'b3', 'Bash', { command: 'yeni', description: 'Yeni' }, TS);
  const t3 = B.result(st, 'b3', 'Command running in background with ID: bk3', null, false);
  assert.deepEqual([t3.cmd, t3.d], ['eski', 'Hazır'], 'dolu alanlar ezilmez');
});

test('result: TaskStop/KillShell görevi durdurur, TaskOutput son çıktıyı yazar', () => {
  const st = B.newState();
  B.use(st, 'b1', 'Bash', { command: 'x' }, TS); B.result(st, 'b1', 'Command running in background with ID: k1', null, false);
  B.use(st, 'o', 'TaskOutput', { task_id: 'k1' }); assert.equal(B.result(st, 'o', '  satır1\nsatır2  ', null, false).out, 'satır1\nsatır2');
  B.use(st, 'o2', 'TaskOutput', { task_id: 'yok' }); assert.equal(B.result(st, 'o2', 'x', null, false), null);
  B.use(st, 'o3', 'BashOutput', { bash_id: 'k1' }); B.result(st, 'o3', '   ', null, false); assert.equal(st.list[0].out, 'satır1\nsatır2', 'boş çıktı eskisini silmez');
  B.use(st, 'o4', 'BashOutput', { bash_id: 'k1' }); B.result(st, 'o4', 'z'.repeat(B.MAXO + 50), null, false); assert.equal(st.list[0].out.length, B.MAXO);
  B.use(st, 's', 'TaskStop', { task_id: 'yok' }); assert.equal(B.result(st, 's', '', null, false), null);
  B.use(st, 's2', 'KillShell', { shell_id: 'k1' }); const t = B.result(st, 's2', 'killed', null, false, TS);
  assert.deepEqual([t.st, t.t1], ['stop', T0]);
});

test('stopped / output doğrudan: girdi yoksa, hata varsa false', () => {
  const st = B.newState(); st.list.push({ id: 'k', st: 'run' });
  assert.equal(B.stopped(st, null), false);
  assert.equal(B.stopped(st, { task_id: 'k' }, true), false);
  assert.equal(B.stopped(st, { shell_id: 'k' }, false, 'bozuk'), true); assert.equal(st.list[0].t1, null);
  assert.equal(B.output(st, null, 'x'), false);
  assert.equal(B.output(st, { shell_id: 'k' }, undefined), true);
});

test('parseNotif: alanlar, çıkış kodu, usage, birden çok kimlik, iç kimlikler (__) atılır; bildirim değilse null', () => {
  assert.equal(B.parseNotif('düz metin'), null);
  assert.equal(B.parseNotif(null), null);
  const n = B.parseNotif('<task-notification>\n<task-id>b1</task-id>\n<tool-use-id>tu1</tool-use-id>\n<status>failed</status>\n<summary>Background command "x" failed with exit code -2</summary>\n<result>hata metni</result>\n<usage><tool_uses>4</tool_uses><duration_ms>900</duration_ms></usage>\n</task-notification>');
  assert.deepEqual(n, { ids: ['b1'], tu: 'tu1', status: 'failed', summary: 'Background command "x" failed with exit code -2', result: 'hata metni', code: -2, tools: 4, ms: 900 });
  const m = B.parseNotif('<task-notification><task-id>__grup</task-id><task-id>a</task-id><summary>3 tasks done. Task ids: a, b, c.</summary></task-notification>');
  assert.deepEqual([m.ids, m.tu, m.status, m.code, m.tools, m.ms, m.result], [['a', 'b', 'c'], null, '', null, null, null, '']);
});

test('notif: listedeki görevi bitirir; yoksa türüyle ekler; kimliksiz bildirim araç kimliğiyle', () => {
  const st = B.newState();
  B.use(st, 'b1', 'Bash', { command: 'x' }, TS); B.result(st, 'b1', 'Command running in background with ID: k1', null, false, TS);
  assert.equal(B.notif(st, 'metin', TS), null);
  const n = B.notif(st, '<task-notification><task-id>k1</task-id><status>completed</status><summary>Background command "x" completed (exit code 0)</summary></task-notification>', '2026-11-06T09:00:05.000Z');
  assert.equal(n.code, 0);
  assert.deepEqual([st.list[0].st, st.list[0].code, st.list[0].t1 - T0, st.list[0].out], ['done', 0, 5000, 'Background command "x" completed (exit code 0)']);
  B.notif(st, '<task-notification><task-id>m1</task-id><status>killed</status><summary>MCP task "y" stopped</summary></task-notification>');
  B.notif(st, '<task-notification><task-id>a1</task-id><status>weird</status><summary>Agent "z" completed</summary><result>sonuç</result></task-notification>');
  B.notif(st, '<task-notification><task-id>c1</task-id><summary></summary></task-notification>');
  B.notif(st, '<task-notification><tool-use-id>tq</tool-use-id><status>completed</status><summary>s</summary></task-notification>');
  B.notif(st, '<task-notification><status>completed</status></task-notification>');
  assert.deepEqual(st.list.slice(1).map(t => [t.id, t.k, t.st, t.out, t.tu]), [
    ['m1', 'mcp', 'stop', 'MCP task "y" stopped', null], ['a1', 'agent', 'done', 'sonuç', null], ['c1', 'bash', 'done', '', null], ['tq', 'bash', 'done', 's', 'tq'], ['?', 'bash', 'done', '', null]]);
  // Birden çok kimlik: ilki araç kimliğiyle de eşleşir, diğerleri yalnız kimlikle
  B.notif(st, '<task-notification><task-id>k1</task-id><tool-use-id>b1</tool-use-id><status>stopped</status><summary>2 tasks. Task ids: k1, yeni</summary></task-notification>');
  assert.equal(st.list[0].st, 'stop'); assert.equal(st.list.at(-1).id, 'yeni'); assert.equal(st.list.at(-1).tu, null);
});

test('liste en çok MAXL görev tutar (eskiler düşer)', () => {
  const st = B.newState();
  for (let k = 0; k < B.MAXL + 5; k++) B.notif(st, `<task-notification><task-id>t${k}</task-id><status>completed</status><summary>s</summary></task-notification>`);
  assert.equal(st.list.length, B.MAXL); assert.equal(st.list[0].id, 't5');
});

test('sysEvent: task_started (arka plan / ön plan), task_updated (arka plana alma, durum, hata), task_notification', () => {
  const st = B.newState(), sys = o => ({ type: 'system', ...o });
  assert.equal(B.sysEvent(st, null), null);
  assert.equal(B.sysEvent(st, { type: 'user', task_id: 'x' }), null);
  assert.equal(B.sysEvent(st, sys({ subtype: 'task_started' })), null);
  const t = B.sysEvent(st, sys({ subtype: 'task_started', task_id: 'b1', tool_use_id: 'tu1', description: ' Uzun\n iş ', task_type: 'local_bash', is_backgrounded: true }), 10);
  assert.deepEqual(t, { id: 'b1', tu: 'tu1', k: 'bash', cmd: '', d: 'Uzun iş', st: 'run', t0: 10, t1: null, out: '', code: null });
  B.sysEvent(st, sys({ subtype: 'task_started', task_id: 'm1', task_type: 'monitor' }), 11);
  B.sysEvent(st, sys({ subtype: 'task_started', task_id: 'x1', task_type: 'garip' }), 11);
  assert.deepEqual(st.list.slice(1).map(x => [x.k, x.tu]), [['monitor', null], ['bash', null]]);
  // Sonuçtan önce eklenmiş görev (araç kimliğiyle) yeniden başlarsa kimlik ve açıklama tamamlanır
  st.list.push({ id: '?', tu: 'tu9', k: 'bash', d: '', st: 'run' });
  B.sysEvent(st, sys({ subtype: 'task_started', task_id: 'b9', tool_use_id: 'tu9', description: 'Dokuz' }), 12);
  assert.deepEqual([st.list.at(-1).id, st.list.at(-1).d], ['b9', 'Dokuz']);
  B.sysEvent(st, sys({ subtype: 'task_started', task_id: 'b9', description: 'Başka' }), 12);
  assert.equal(st.list.at(-1).d, 'Dokuz');
  // Ön planda alt ajan: listeye girmez; arka plana alınınca girer
  assert.equal(B.sysEvent(st, sys({ subtype: 'task_started', task_id: 'a1', tool_use_id: 'ta', description: 'Ajan', task_type: 'local_agent', is_backgrounded: false }), 13), null);
  assert.equal(B.sysEvent(st, sys({ subtype: 'task_started', task_id: 'f2', is_backgrounded: false }), 13), null);
  assert.deepEqual(st.pend.get('fg:f2'), { k: 'bash', d: '', tu: null });
  assert.equal(B.sysEvent(st, sys({ subtype: 'task_updated', task_id: 'a1', patch: { status: 'running' } }), 14), null, 'arka plana alınmadan güncelleme');
  assert.equal(B.sysEvent(st, sys({ subtype: 'task_updated', task_id: 'yok', patch: { is_backgrounded: true } }), 14), null);
  const a = B.sysEvent(st, sys({ subtype: 'task_updated', task_id: 'a1', patch: { is_backgrounded: true } }), 15);
  assert.deepEqual([a.k, a.d, a.tu, a.t0, a.st], ['agent', 'Ajan', 'ta', 15, 'run']);
  assert.equal(B.sysEvent(st, sys({ subtype: 'task_updated', task_id: 'b1' }), 16), null, 'patch yok');
  assert.equal(B.sysEvent(st, sys({ subtype: 'task_updated', task_id: 'b1', patch: 'x' }), 16), null);
  B.sysEvent(st, sys({ subtype: 'task_updated', task_id: 'b1', patch: { status: 'killed', end_time: 99, error: 'öldürüldü' } }), 16);
  assert.deepEqual([t.st, t.t1, t.out], ['stop', 99, 'öldürüldü']);
  B.sysEvent(st, sys({ subtype: 'task_updated', task_id: 'b1', patch: { status: 'bilinmez', end_time: 'x', error: '' } }), 16);
  assert.deepEqual([t.st, t.t1, t.out], ['stop', 99, 'öldürüldü']);
  // Bildirim
  assert.equal(B.sysEvent(st, sys({ subtype: 'task_notification', task_id: 'f2' }), 17), null);
  assert.equal(st.pend.has('fg:f2'), false, 'ön plan kaydı temizlenir');
  const m = B.sysEvent(st, sys({ subtype: 'task_notification', task_id: 'm1', status: 'failed', summary: 'Monitor  failed with exit code 3' }), 18);
  assert.deepEqual([m.st, m.t1, m.out, m.code], ['err', 18, 'Monitor failed with exit code 3', 3]);
  const x = B.sysEvent(st, sys({ subtype: 'task_notification', task_id: 'x1', status: '?' }), 19);
  assert.deepEqual([x.st, x.t1, x.out, x.code], ['done', 19, '', null]);
  const b = B.sysEvent(st, sys({ subtype: 'task_notification', task_id: 'b1', status: 'stopped', summary: '' }), 20);
  assert.deepEqual([b.t1, b.out], [99, 'öldürüldü'], 'bitiş zamanı ve çıktı korunur');
  assert.equal(B.sysEvent(st, sys({ subtype: 'task_progress', task_id: 'b1' }), 21), null);
  assert.equal(B.running(st.list), 2);
  assert.equal(B.running(null), 0);
});

test('fmtDur: sn, dk, sa; geçersiz süre boş', () => {
  assert.deepEqual([B.fmtDur(null), B.fmtDur(-5), B.fmtDur(NaN), B.fmtDur(0), B.fmtDur(59400), B.fmtDur(61000), B.fmtDur(3725000)], ['', '', '', '0 sn', '59 sn', '1 dk 1 sn', '1 sa 2 dk']);
});

test('listHTML: boş liste; çalışanlar üstte; durdur düğmesi yalnız izinli, çalışan ve kimlikli görevde; kaçış; sınır', () => {
  assert.equal(B.listHTML([]), '<div class="bgt-none">Bu sohbette arka plan görevi yok.</div>');
  assert.equal(B.listHTML(null), '<div class="bgt-none">Bu sohbette arka plan görevi yok.</div>');
  const list = [
    { id: 'd1', k: 'bash', cmd: 'echo <x>', d: 'Bitmiş', st: 'done', t0: 0, t1: 3000, out: 'ok & bitti', code: 0 },
    { id: 'r1', k: 'monitor', cmd: 'tail', d: '', st: 'run', t0: 1000, t1: null, out: '', code: null },
    { id: '?x', k: 'agent', cmd: '', d: 'Ajan "a"', st: 'run', t0: null, t1: null, out: '', code: null },
    { id: 's1', k: 'garip', cmd: '', d: '', st: 'stop', t0: 5, t1: null, out: '', code: 1 },
  ];
  const h = B.listHTML(list, { now: 61000, canStop: true, sid: 's"1' });
  const rows = h.split('<div class="bgt ').slice(1);
  assert.deepEqual(rows.map(r => r.split('"')[0]), ['run', 'run', 'stop', 'done']);
  assert.ok(rows[1].includes('<span class="bgt-t" title="tail">tail</span><button class="act bgt-stop" data-bgstop="r1" data-sid="s&quot;1" title="Görevi durdur (Claude Code stop_task)">Durdur</button>'));
  assert.ok(rows[1].includes('<span>İzleme</span><span>çalışıyor</span><span>1 dk 0 sn</span><span class="mono">r1</span>'));
  assert.ok(!rows[1].includes('bgt-c'), 'komut başlıkla aynıysa ayrıca yazılmaz');
  assert.ok(!rows[0].includes('data-bgstop'), 'kimliği bilinmeyen görev durdurulamaz');
  assert.ok(rows[0].includes('<span class="spin"></span>') && rows[0].includes('Ajan &quot;a&quot;') && !rows[0].includes('sn</span>'));
  assert.ok(rows[2].includes('<span>Görev</span><span>durduruldu · çıkış 1</span><span>0 sn</span><span class="mono">s1</span>') && rows[2].includes('title="s1">s1<'));
  assert.ok(rows[3].includes('<span>Komut</span><span>bitti · çıkış 0</span><span>3 sn</span>'));
  assert.ok(rows[3].includes('<div class="bgt-c mono" title="echo &lt;x&gt;">echo &lt;x&gt;</div><div class="bgt-o">ok &amp; bitti</div>'));
  assert.ok(!B.listHTML(list, { canStop: false }).includes('data-bgstop'));
  assert.ok(B.listHTML([list[1]], { canStop: true }).includes('data-sid=""'));
  assert.ok(B.listHTML([list[1]]).includes('<span>çalışıyor</span><span>'), 'now verilmezse şimdiki zaman');
  const many = Array.from({ length: 15 }, (_, k) => ({ id: 'g' + k, k: 'bash', cmd: '', d: '', st: 'done', t0: null, out: '', code: null }));
  const m = B.listHTML(many, { max: 4 });
  assert.equal(m.split('<div class="bgt ').length - 1, 4);
  assert.ok(m.endsWith('<div class="bgt-none">+11 eski görev</div>'));
  assert.ok(m.indexOf('g14') < m.indexOf('g13'), 'en yeni üstte');
  assert.equal(B.listHTML(many).split('<div class="bgt ').length - 1, 12);
});
