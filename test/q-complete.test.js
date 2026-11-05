// renderer/complete.js: yazma kutusunda Tab ile tamamlama önerileri.
const { test } = require('node:test');
const assert = require('node:assert');
const MOD = require.resolve('../src/renderer/complete.js');
const { suggest, vocab, norm } = require(MOD);

const T = [{ name: 'Durum özeti', text: 'Şu ana kadar ne yaptın?' }, { name: 'İşi bitir', text: 'Kalanları bitir.' }, { name: '', text: 'adsız' }, null, { name: 'Metinsiz' }];

test('norm: Türkçe harfler sadeleşir, uzunluk korunur', () => {
  assert.strictEqual(norm('İŞÇĞÜÖIı âîû'), 'iscguoii aiu');
  for (const s of ['İstanbul', 'IŞIK', 'Gürler Piliç']) assert.strictEqual(norm(s).length, s.length);
  assert.strictEqual(norm(42), '42');
});

test('suggest: boş ya da metin olmayan girdi', () => {
  for (const x of [undefined, null, 5, '', '   ']) assert.strictEqual(suggest(x, { templates: T }), null);
  assert.strictEqual(suggest('merhaba'), null, 'kaynak yoksa öneri yok');
});

test('suggest: "/ad" şablonu önerir; Tab metni koyar; Türkçe büyük harf duyarsız', () => {
  assert.deepStrictEqual(suggest('/dur', { templates: T }), { kind: 'template', ghost: 'um özeti', value: 'Şu ana kadar ne yaptın?', name: 'Durum özeti' });
  assert.deepStrictEqual(suggest('/', { templates: T }).name, 'Durum özeti');
  assert.strictEqual(suggest('/isi', { templates: T }).name, 'İşi bitir');
  assert.strictEqual(suggest('/yok', { templates: T }), null);
  assert.strictEqual(suggest('/met', { templates: T }), null, 'metinsiz şablon önerilmez');
  assert.strictEqual(suggest('/dur', {}), null);
  assert.strictEqual(suggest('/dur um', { templates: T, phrases: [] }), null, 'boşluktan sonra şablon araması bitmiş sayılır');
});

test('suggest: yazılanla başlayan mesaj/şablon metni; en az 3 harf; sonda boşluk varsa öneri yok', () => {
  const src = { phrases: ['Görseller onaylı, Flow\'da videoya geç', 'gö', 42, 'Kısa'] };
  assert.deepStrictEqual(suggest('gör', src), { kind: 'phrase', ghost: 'seller onaylı, Flow\'da videoya geç', value: 'görseller onaylı, Flow\'da videoya geç' });
  assert.strictEqual(suggest('go', src), null, '2 harfte cümle önerilmez');
  assert.strictEqual(suggest('GÖRSELLER ONAYLI', src).ghost, ', Flow\'da videoya geç');
  assert.strictEqual(suggest('kısa', src), null, 'aynı uzunluk önerilmez');
  assert.strictEqual(suggest('görseller ', src), null);
});

test('suggest: son kelime sohbetteki kelimelerden tamamlanır', () => {
  const src = { phrases: ['başka bir şey'], words: ['sahneler-pano.jpg', 'Gerikoğlu', 'sah'] };
  assert.deepStrictEqual(suggest('dosya sahn', src), { kind: 'word', ghost: 'eler-pano.jpg', value: 'dosya sahneler-pano.jpg' });
  assert.strictEqual(suggest('ve geri', src).ghost, 'koğlu');
  assert.strictEqual(suggest('ve ge', src), null, '3 harften kısa kelime tamamlanmaz');
  assert.strictEqual(suggest('ve xyz', src), null);
  assert.strictEqual(suggest('ve sah', src).ghost, 'neler-pano.jpg', 'aynı uzunluktaki kelime atlanır');
  assert.strictEqual(suggest('…!', src), null, 'harfle bitmeyen metin');
});

test('vocab: 5+ harfli kelimeler sıklığa göre; sondaki nokta/tire atılır; metin olmayanlar atlanır', () => {
  const v = vocab(['Gürler Piliç Gürler sahne1.png sahne1.png sahne1.png', 'kısa ab', null, 42, 'deneme.', 'Gürler-', 'abcd- abcd.'], 10);
  assert.deepStrictEqual(v.slice(0, 2), ['Gürler', 'sahne1.png'], 'Gürler 3 kez (Gürler- dahil), eşitlikte kısa olan önce');
  assert.ok(v.includes('Piliç') && v.includes('deneme'));
  assert.ok(!v.includes('kısa') && !v.includes('abcd') && !v.includes('abcd-'));
  assert.deepStrictEqual(vocab(['aaaaa bbbbbbb aaaaa bbbbbbb'], 1), ['aaaaa'], 'eşit sıklıkta kısa olan önce, en çok max');
  assert.deepStrictEqual(vocab(), []);
  assert.deepStrictEqual(vocab(['tekrar tekrar']).length, 1);
});

test('tarayıcıda window.complete olarak yüklenir, module.exports olmadan', () => {
  const vm = require('vm'); const ctx = { window: {} }; vm.createContext(ctx);
  vm.runInContext(require('fs').readFileSync(MOD, 'utf8'), ctx, { filename: MOD });
  assert.deepStrictEqual(Object.keys(ctx.window.complete).sort(), ['norm', 'suggest', 'vocab']);
  const ctx2 = {}; vm.createContext(ctx2); vm.runInContext(require('fs').readFileSync(MOD, 'utf8'), ctx2, { filename: MOD });
  assert.strictEqual(typeof ctx2.complete, 'object', 'window yoksa genel nesneye yazılır');
});
