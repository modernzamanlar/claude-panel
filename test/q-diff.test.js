// renderer/diff.js: düzenleme araçlarının fark verisi ve renkli fark görünümü (HTML kaçışlama dahil).
const { test } = require('node:test');
const assert = require('node:assert');
const MOD = require.resolve('../src/renderer/diff.js');
const D = require(MOD);
const { data, lines, hunks, html, esc } = D;
const ks = ops => ops.map(o => o === null ? '|' : o.k + o.t).join(' ');

test('esc: & < > " \' kaçışlanır', () => {
  assert.strictEqual(esc(`<a href="x" title='y'>&</a>`), '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  assert.strictEqual(esc(5), '5');
});

test('data: araç türleri; diğer araçlar ve geçersiz girdi null', () => {
  assert.deepStrictEqual(data('Edit', { old_string: 'a', new_string: 'b' }), { e: [{ o: 'a', n: 'b' }] });
  assert.deepStrictEqual(data('MultiEdit', { edits: [{ old_string: 'a', new_string: 'b' }, null, { old_string: 'c' }, { new_string: 'd' }, {}] }),
    { e: [{ o: 'a', n: 'b' }, { o: 'c', n: '' }, { o: '', n: 'd' }] }, 'boş ve geçersiz düzenlemeler atlanır');
  assert.deepStrictEqual(data('Write', { content: 'x\ny\n' }), { e: [{ o: '', n: 'x\ny\n' }] });
  assert.deepStrictEqual(data('NotebookEdit', { new_source: 'print(1)' }), { e: [{ o: '', n: 'print(1)' }] });
  assert.strictEqual(data('MultiEdit', { edits: 'yok' }), null);
  assert.strictEqual(data('Edit', { old_string: 5, new_string: null }), null, 'metin olmayan alanlar boş sayılır');
  assert.strictEqual(data('Write', {}), null);
  assert.strictEqual(data('Bash', { command: 'ls' }), null);
  for (const x of [null, undefined, 'metin', 3]) assert.strictEqual(data('Edit', x), null);
});

test('data: her taraf 4000 karakter / 200 satırla sınırlı; aşılırsa cut', () => {
  const w = data('Write', { content: 'x\n'.repeat(500) });
  assert.strictEqual(w.cut, true); assert.strictEqual(w.e[0].n.split('\n').length, 200); assert.strictEqual(w.e[0].o, '');
  const c = data('Edit', { old_string: 'a'.repeat(5000), new_string: 'b' });
  assert.strictEqual(c.cut, true); assert.strictEqual(c.e[0].o.length, 4000); assert.strictEqual(c.e[0].n, 'b');
  // Bütçe düzenlemeler arasında paylaşılır: ilk düzenleme eski tarafı doldurunca sonrakiler bırakılır
  const m = data('MultiEdit', { edits: [{ old_string: 'o'.repeat(4000), new_string: 'n' }, { old_string: 'p', new_string: 'q' }] });
  assert.deepStrictEqual(m.e.length, 1); assert.strictEqual(m.cut, true);
  const m2 = data('MultiEdit', { edits: [{ old_string: 'o', new_string: 'n'.repeat(4000) }, { old_string: 'p', new_string: 'q' }] });
  assert.deepStrictEqual(m2.e.length, 1); assert.strictEqual(m2.cut, true);
  // Bir taraf dolu ama sonraki düzenleme o tarafı kullanmıyorsa devam edilir
  const m3 = data('MultiEdit', { edits: [{ old_string: 'o'.repeat(4000), new_string: 'n' }, { old_string: '', new_string: 'q' }] });
  assert.deepStrictEqual(m3, { e: [{ o: 'o'.repeat(4000), n: 'n' }, { o: '', n: 'q' }] });
  const m4 = data('MultiEdit', { edits: [{ old_string: 'o', new_string: 'n'.repeat(4000) }, { old_string: 'p', new_string: '' }] });
  assert.deepStrictEqual(m4.e.length, 2); assert.strictEqual(m4.cut, undefined);
  const l = data('MultiEdit', { edits: [{ old_string: 'a\n'.repeat(150), new_string: 'b' }, { old_string: 'c\n'.repeat(100), new_string: 'd' }] });
  assert.strictEqual(l.cut, true); assert.strictEqual(l.e[1].o.split('\n').length, 49, 'satır bütçesi de paylaşılır');
});

test('lines: ortak baş/son, değişen satırlar; önce silinen sonra eklenen', () => {
  assert.strictEqual(ks(lines('a\nb\nc\n', 'a\nB\nc\n')), ' a -b +B  c');
  assert.strictEqual(ks(lines('x\ny\nz', 'y')), '-x  y -z');
  assert.strictEqual(ks(lines('', 'p\nq')), '+p +q');
  assert.strictEqual(ks(lines('p\r\nq\r\n', '')), '-p -q', 'CRLF satır sonu');
  assert.strictEqual(ks(lines('a\nb', 'a\nb\n')), ' a  b', 'sondaki satır sonu fark sayılmaz');
  assert.strictEqual(ks(lines('k\na\nb\nl', 'k\nb\na\nl')), ' k -a  b +a  l');
  assert.deepStrictEqual(lines('', ''), []);
});

test('hunks: değişikliğin çevresinde 3 satır bağlam; aradaki atlanan kısım ayraç', () => {
  const A = 'a\nb\nc\nd\ne\nf\ng\nh\ni\nj\nk\nl\nm\n';
  assert.strictEqual(ks(hunks(lines(A, A.replace('a\n', 'A\n').replace('m\n', 'M\n')))), '-a +A  b  c  d |  j  k  l -m +M');
  assert.strictEqual(ks(hunks(lines(A, A.replace('f\n', 'F\n')))), ' c  d  e -f +F  g  h  i', 'baş ve sondaki bağlam dışı satırlarda ayraç yok');
  assert.deepStrictEqual(hunks(lines(A, A)), [], 'değişiklik yoksa satır yok');
});

test('html: renkli satırlar, sayılar, düzenlemeler arası ayraç, kısaltma notu', () => {
  const d = { e: [{ o: 'a\nb\n', n: 'a\nB\nC\n' }, null, { o: '', n: 'yeni' }] };
  const r = html(d);
  assert.strictEqual(r.added, 3); assert.strictEqual(r.removed, 1);
  assert.strictEqual(r.badge, '<span class="dv-n"><span class="dv-pa">+3</span><span class="dv-pd">−1</span></span>');
  assert.ok(r.html.startsWith('<div class="dv">') && r.html.endsWith('</div>'));
  assert.ok(r.html.includes('<div class="dv-l dv-c"><span class="dv-s"> </span><span class="dv-t">a</span></div>'));
  assert.ok(r.html.includes('<div class="dv-l dv-d"><span class="dv-s">−</span><span class="dv-t">b</span></div>'));
  assert.ok(r.html.includes('<div class="dv-l dv-a"><span class="dv-s">+</span><span class="dv-t">B</span></div>'));
  assert.strictEqual(r.html.split('<div class="dv-gap">⋯</div>').length, 3, 'üç düzenleme → iki ayraç');
  assert.ok(!r.html.includes('kısaltıldı'));
  assert.strictEqual(html(d), r, 'aynı veri için önbellekten');
  const big = 'x\n'.repeat(10);
  const g = html({ e: [{ o: 'A\n' + big + 'B\n', n: 'a\n' + big + 'b\n' }], cut: true });
  assert.ok(g.html.includes('<div class="dv-gap">⋯</div>'), 'parça arası ayraç');
  assert.ok(g.html.endsWith('<div class="dv-gap">… kısaltıldı</div></div>'));
  assert.ok(g.badge.endsWith('</span>…</span>'));
  assert.strictEqual(html({ e: [{ o: 'silinen', n: '' }] }).badge, '<span class="dv-n"><span class="dv-pd">−1</span></span>');
  assert.strictEqual(html({ e: [{ o: 'ayni', n: 'ayni' }] }).badge, '<span class="dv-n"></span>');
  for (const x of [null, undefined, {}, { e: 'x' }]) assert.strictEqual(html(x), null);
});

test('html: kod içindeki etiketler ve tırnaklar kaçışlanır (enjeksiyon yok)', () => {
  const bad = `<script>alert("x")</script>\n<img src=x onerror='alert(1)'>\n&amp;`;
  const r = html(data('Edit', { old_string: '<b>eski</b>', new_string: bad }));
  assert.ok(!/<script|<img|<b>/i.test(r.html), r.html);
  assert.ok(r.html.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'));
  assert.ok(r.html.includes('&lt;img src=x onerror=&#39;alert(1)&#39;&gt;'));
  assert.ok(r.html.includes('&amp;amp;') && r.html.includes('&lt;b&gt;eski&lt;/b&gt;'));
  const w = html(data('Write', { content: '"><svg onload=alert(1)>' }));
  assert.ok(!w.html.includes('<svg') && w.html.includes('&quot;&gt;&lt;svg onload=alert(1)&gt;'));
});

test('tarayıcıda window.diffView olarak yüklenir, module.exports olmadan', () => {
  const vm = require('vm'); const src = require('fs').readFileSync(MOD, 'utf8');
  const ctx = { window: {}, WeakMap, Uint32Array }; vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: MOD });
  assert.deepStrictEqual(Object.keys(ctx.window.diffView).sort(), ['data', 'esc', 'html', 'hunks', 'lines']);
  assert.strictEqual(ctx.window.diffView.html(ctx.window.diffView.data('Edit', { old_string: 'a', new_string: 'b' })).added, 1);
  const ctx2 = {}; vm.createContext(ctx2); vm.runInContext(src, ctx2, { filename: MOD });
  assert.strictEqual(typeof ctx2.diffView, 'object', 'window yoksa genel nesneye yazılır');
});
