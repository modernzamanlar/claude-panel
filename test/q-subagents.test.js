// node --test test/q-subagents.test.js → src/renderer/subagents.js (alt ajan blokları) tam kapsam
const { test } = require('node:test');
const assert = require('node:assert');
const A = require('../src/renderer/subagents.js');

test('isAgentTool ve info: tür, açıklama sadeleşir, varsayılan general-purpose', () => {
  assert.deepEqual(['Agent', 'Task', 'TaskCreate', null].map(A.isAgentTool), [true, true, false, false]);
  assert.deepEqual(A.info('t1', { subagent_type: 'Explore', description: '  Dosyaları\n  tara ' }), { id: 't1', ty: 'Explore', d: 'Dosyaları tara', st: 'run', tools: 0 });
  assert.deepEqual(A.info('t2', null), { id: 't2', ty: 'general-purpose', d: '', st: 'run', tools: 0 });
  assert.equal(A.info('t3', { description: 'x'.repeat(200) }).d.length, 160);
});

test('onResult: arka plan başlangıcı, bitiş (araç sayısı, süre), hata, eksik alanlar', () => {
  assert.deepEqual(A.onResult(A.info('a'), { status: 'async_launched', agentId: 'ag1' }, false), { id: 'a', ty: 'general-purpose', d: '', st: 'run', tools: 0, aid: 'ag1', bg: true });
  assert.deepEqual(A.onResult(A.info('b'), { status: 'completed', agentId: 'ag2', totalToolUseCount: 4, totalDurationMs: 1500 }, false), { id: 'b', ty: 'general-purpose', d: '', st: 'done', tools: 4, aid: 'ag2', ms: 1500 });
  assert.deepEqual(A.onResult(A.info('c'), { totalToolUseCount: 'x', totalDurationMs: NaN, agentId: 5 }, false), { id: 'c', ty: 'general-purpose', d: '', st: 'done', tools: 0 });
  assert.equal(A.onResult(A.info('d'), null, true).st, 'err');
  assert.equal(A.onResult(A.info('e'), 'metin', false).st, 'done');
});

test('onNotif ve onSys: durum eşlemesi, araç sayısı, süre; ilgisiz olaylar', () => {
  const sa = A.info('a');
  assert.equal(A.onNotif(sa, null), sa);
  A.onNotif(sa, { status: 'running', tools: 2 }); assert.deepEqual([sa.st, sa.tools], ['run', 2]);
  A.onNotif(sa, { status: 'killed', ms: 9 }); assert.deepEqual([sa.st, sa.ms], ['stop', 9]);
  A.onNotif(sa, { status: 'failed' }); assert.equal(sa.st, 'err');
  A.onNotif(sa, { status: 'stopped' }); assert.equal(sa.st, 'stop');
  A.onNotif(sa, { status: 'completed', tools: null }); assert.deepEqual([sa.st, sa.tools], ['done', 2]);
  const s2 = A.info('b');
  assert.equal(A.onSys(s2, null), false);
  assert.equal(A.onSys(s2, { type: 'user' }), false);
  assert.equal(A.onSys(s2, { type: 'system', subtype: 'init' }), false);
  assert.equal(A.onSys(s2, { type: 'system', subtype: 'task_started', subagent_type: 'Plan' }), true); assert.equal(s2.ty, 'Plan');
  assert.equal(A.onSys(s2, { type: 'system', subtype: 'task_started', subagent_type: 'Başka' }), true); assert.equal(s2.ty, 'Plan', 'tür bir kez yazılır');
  assert.equal(A.onSys(A.info('z'), { type: 'system', subtype: 'task_started' }), true);
  A.onSys(s2, { type: 'system', subtype: 'task_progress', usage: { tool_uses: 3 } }); assert.equal(s2.tools, 3);
  A.onSys(s2, { type: 'system', subtype: 'task_progress', usage: { tool_uses: 1 } }); assert.equal(s2.tools, 3, 'geri gitmez');
  A.onSys(s2, { type: 'system', subtype: 'task_progress' }); assert.equal(s2.tools, 3);
  const s3 = { id: 'c', st: 'run' };
  A.onSys(s3, { type: 'system', subtype: 'task_progress', usage: { tool_uses: 2 } }); assert.equal(s3.tools, 2);
  assert.equal(A.onSys(s2, { type: 'system', subtype: 'task_notification', status: 'completed', usage: { tool_uses: 5, duration_ms: 70 } }), true);
  assert.deepEqual([s2.st, s2.tools, s2.ms], ['done', 5, 70]);
});

test('feed: alt ajan metin ve araç blokları eklenir; kısmi akış ve geçersiz olaylar atlanır; sınır aşılınca eskiler kesilir', () => {
  const sa = A.info('a'); const made = [];
  const mk = c => { const t = { t: 'tool', n: c.name }; made.push(c.id); return t; };
  assert.equal(A.feed(sa, null, mk), false);
  assert.equal(A.feed(sa, { type: 'stream_event' }, mk), false);
  assert.equal(A.feed(sa, { type: 'assistant' }, mk), false);
  assert.equal(A.feed(sa, { type: 'assistant', message: { content: 'x' } }, mk), false);
  assert.equal(A.feed(sa, { type: 'assistant', message: { content: [{ type: 'text', text: 'Merhaba' }, { type: 'text', text: '  ' }, { type: 'text' }, { type: 'tool_use', id: 'u1', name: 'Grep' }, { type: 'thinking', thinking: 'x' }] } }, mk), true);
  assert.deepEqual(sa.b, [{ t: 'text', v: 'Merhaba' }, { t: 'tool', n: 'Grep' }]);
  assert.deepEqual([sa.tools, made], [1, ['u1']]);
  const big = { id: 'b', st: 'run' };
  A.feed(big, { type: 'assistant', message: { content: [{ type: 'text', text: 'y'.repeat(A.MAXT + 5) }] } }, mk);
  assert.equal(big.b[0].v.length, A.MAXT);
  assert.equal(big.tools, undefined);
  A.feed(big, { type: 'assistant', message: { content: Array.from({ length: A.MAXB + 10 }, (_, k) => ({ type: 'text', text: 't' + k })) } }, mk);
  assert.equal(big.b.length, A.MAXB); assert.equal(big.cut, 11); assert.equal(big.b.at(-1).v, 't' + (A.MAXB + 9));
  A.feed(big, { type: 'assistant', message: { content: [{ type: 'text', text: 'son' }] } }, mk);
  assert.equal(big.cut, 12);
});

test('blockHTML: başlık her zaman, gövde yalnız açıkken; durum, süre, kaçış', () => {
  const sa = { id: 't"1', ty: 'Ex<p>', d: 'a & b', st: 'run', tools: 0 };
  const h = A.blockHTML(sa, 'k<1>', false, () => { throw new Error('kapalıyken çağrılmamalı'); }, '<i>c</i>');
  assert.equal(h, '<div class="sa-blk run " data-sa="k&lt;1&gt;" data-said="t&quot;1"><div class="sa-h"><span class="spin"></span><b>Alt ajan</b><span class="sa-ty">Ex&lt;p&gt;</span><span class="sa-d">a &amp; b</span><span class="sa-m"></span><span class="sa-st">çalışıyor</span></div></div>');
  const d = { id: 'x', ty: 'Plan', d: '', st: 'done', tools: 3, ms: 65000, bg: true };
  const o = A.blockHTML(d, 'k', true, () => 'GÖVDE', '<i>c</i>');
  assert.ok(o.startsWith('<div class="sa-blk done open"'));
  assert.ok(o.includes('<i>c</i><b>Alt ajan</b>'));
  assert.ok(o.includes('<span class="sa-m">3 araç · 1 dk 5 sn · arka planda</span><span class="sa-st">bitti</span>'));
  assert.ok(o.endsWith('<div class="sa-b">GÖVDE</div></div>'));
  assert.ok(A.blockHTML({ ...d, st: 'err', ms: 4400, tools: 0, bg: false }, 'k', true).includes('<span class="sa-m">4 sn</span><span class="sa-st">hata</span></div><div class="sa-b"></div>'));
  assert.ok(A.blockHTML({ ...d, st: 'stop' }, 'k', false).includes('<div class="sa-h"><b>Alt ajan</b>'));
  assert.ok(A.blockHTML({ ...d, st: 'stop' }, 'k', false).includes('durduruldu'));
  assert.ok(A.blockHTML({ ...d, st: '?' }, 'k', false).includes('<span class="sa-st"></span>'));
});

test('tarayıcıda window.<ad> olarak yüklenir (window yoksa genel nesneye)', () => {
  const fs = require('fs'), vm = require('vm');
  for (const f of ['subagents', 'todos', 'bgtasks']) {
    const MOD = require.resolve('../src/renderer/' + f + '.js'), src = fs.readFileSync(MOD, 'utf8');
    const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(src, ctx, { filename: MOD });
    assert.equal(typeof ctx.window[f].MAXC === 'number' || typeof ctx.window[f].MAXB === 'number' || typeof ctx.window[f].MAXL === 'number', true);
    const ctx2 = {}; vm.createContext(ctx2); vm.runInContext(src, ctx2, { filename: MOD });
    assert.equal(typeof ctx2[f], 'object');
  }
});
