// node --test test/q-todos.test.js → src/renderer/todos.js (görev listesi kartı) tam kapsam
const { test } = require('node:test');
const assert = require('node:assert');
const T = require('../src/renderer/todos.js');

test('isTodoTool: yalnız TodoWrite / TaskCreate / TaskUpdate', () => {
  assert.deepEqual(['TodoWrite', 'TaskCreate', 'TaskUpdate', 'Task', 'Bash', undefined].map(T.isTodoTool), [true, true, true, false, false, false]);
});

test('TodoWrite: liste her çağrıda yeniden yazılır; durum, metin ve activeForm süzülür', () => {
  const st = T.newState();
  assert.equal(T.apply(st, 'Bash', { todos: [] }, 'x'), null);
  assert.equal(T.apply(st, 'TodoWrite', null, 'x'), null);
  assert.equal(T.apply(st, 'TodoWrite', 'metin', 'x'), null);
  assert.equal(T.apply(st, 'TodoWrite', { todos: 'yok' }, 'x'), null);
  const r = T.apply(st, 'TodoWrite', { todos: [{ content: 'a', status: 'in_progress', activeForm: 'A yapılıyor' }, null, 'x', { content: 5, status: 'garip' }, { content: 'c'.repeat(300), status: 'completed', activeForm: '' }] }, 't1');
  assert.deepEqual(r, [{ c: 'a', s: 'in_progress', af: 'A yapılıyor' }, { c: '', s: 'pending' }, { c: 'c'.repeat(T.MAXC), s: 'completed' }]);
  assert.deepEqual(st.items.map(i => i.id), ['w0', 'w1', 'w2']);
  r[0].c = 'değişti';
  assert.equal(st.items[0].c, 'a', 'dönen kopya durumu değiştirmez');
  const many = T.apply(st, 'TodoWrite', { todos: Array.from({ length: 70 }, (_, k) => ({ content: 'g' + k })) }, 't2');
  assert.equal(many.length, T.MAXI);
});

test('TaskCreate / TaskUpdate: birikir, kimlik sonuçtan gelir, güncellenir ve silinir', () => {
  const st = T.newState();
  T.apply(st, 'TaskCreate', { subject: 'Birinci', activeForm: 'Birinci yapılıyor' }, 'c1');
  T.apply(st, 'TaskCreate', { description: 'İkinci açıklama' }, 'c2');
  T.apply(st, 'TaskCreate', { subject: 'Üçüncü' }, 'c3');
  assert.deepEqual(st.items.map(i => [i.id, i.c]), [['?c1', 'Birinci'], ['?c2', 'İkinci açıklama'], ['?c3', 'Üçüncü']]);
  assert.equal(T.result(st, 'c1', 'Task #1 created successfully: Birinci', null, false), true);
  assert.equal(T.result(st, 'c2', '', { task: { id: 7 } }, false), true);
  assert.equal(T.result(st, 'c3', 'patladı', null, true), true, 'hatalı oluşturma listeden çıkar');
  assert.equal(T.result(st, 'yok', 'Task #9 created successfully', null, false), false);
  T.apply(st, 'TaskCreate', { subject: 'Kimliksiz' }, 'c4');
  assert.equal(T.result(st, 'c4', 'beklenmedik metin', { task: {} }, false), false);
  assert.equal(T.result(st, 'c4', undefined, undefined, false), false);
  assert.deepEqual(st.items.map(i => i.id), ['1', '7', '?c4']);
  let r = T.apply(st, 'TaskUpdate', { taskId: 1, status: 'in_progress', subject: 'Birinci (yeni)', activeForm: 'Yeni yapılıyor' }, 'u1');
  assert.deepEqual(r[0], { c: 'Birinci (yeni)', s: 'in_progress', af: 'Yeni yapılıyor' });
  r = T.apply(st, 'TaskUpdate', { taskId: '7', status: 'bilinmeyen' }, 'u2');
  assert.deepEqual(r[1], { c: 'İkinci açıklama', s: 'pending' });
  r = T.apply(st, 'TaskUpdate', { taskId: '1', status: 'deleted' }, 'u3');
  assert.deepEqual(r.map(i => i.c), ['İkinci açıklama', 'Kimliksiz']);
  r = T.apply(st, 'TaskUpdate', { taskId: '99', status: 'completed' }, 'u4');
  assert.equal(r.length, 2, 'bilinmeyen görev değişmez');
  // Sınır: en çok MAXI görev
  const big = T.newState();
  for (let k = 0; k < T.MAXI + 3; k++) T.apply(big, 'TaskCreate', { subject: 's' + k }, 'k' + k);
  assert.equal(big.items.length, T.MAXI);
});

test('cardHTML / lineHTML: sayaç, çalışan adım activeForm ile, kaçış, boş liste', () => {
  const items = [{ c: 'Bitti <b>', s: 'completed' }, { c: 'Çalışan', s: 'in_progress', af: 'Çalışıyor & "x"' }, { c: 'Bekleyen', s: 'pending' }, { c: 'Formsuz', s: 'in_progress' }];
  const h = T.cardHTML(items, '<i>ic</i>');
  assert.match(h, /^<div class="plan-card todo-card"><div class="pc-h"><i>ic<\/i><b>Görevler<\/b><span>1\/4<\/span>/);
  assert.ok(h.includes('<div class="pc-i completed"><span class="pc-b">✓</span><span>Bitti &lt;b&gt;</span></div>'));
  assert.ok(h.includes('<div class="pc-i in_progress"><span class="pc-b"><span class="spin"></span></span><span>Çalışıyor &amp; &quot;x&quot;</span></div>'));
  assert.ok(h.includes('<div class="pc-i pending"><span class="pc-b"><span class="td-o"></span></span><span>Bekleyen</span></div>'));
  assert.ok(h.includes('<span>Formsuz</span>'));
  assert.equal(T.cardHTML([]), '<div class="plan-card todo-card"><div class="pc-h"><b>Görevler</b><span>0/0</span></div><div class="pc-i">Liste boş</div></div>');
  assert.equal(T.lineHTML(items), '<div class="todo-line"><span class="pc-b">✓</span>Görevler güncellendi · 1/4 · Çalışıyor &amp; &quot;x&quot;</div>');
  assert.equal(T.lineHTML([{ c: 'a', s: 'pending' }]), '<div class="todo-line"><span class="pc-b">✓</span>Görevler güncellendi · 0/1</div>');
});
