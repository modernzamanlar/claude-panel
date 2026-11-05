// renderer/markdown.js: asistan metnini HTML'e çeviren dönüştürücü bir XSS sınırıdır.
// Tarayıcı betiği olduğu için sahte bir `window` ile yüklenir (dosyanın kendisi değişmeden tarayıcıda çalışır).
const { test } = require('node:test');
const assert = require('node:assert');

const MOD = require.resolve('../src/renderer/markdown.js');
function load() {
  const prev = global.window;
  global.window = {};
  delete require.cache[MOD];
  require(MOD);
  const md = global.window.md;
  if (prev === undefined) delete global.window; else global.window = prev;
  return md;
}
const md = load();

// --- Güvenlik denetleyicisi: çıktıdaki her etiket beyaz listede, öznitelikler birebir izinli olmalı ---
const ALLOWED = {
  p: [], br: [], b: [], i: [], code: [], pre: [], h3: [], h4: [], h5: [], h6: [], ul: [], ol: [], li: [], blockquote: [],
  table: [], thead: [], tbody: [], tr: [], th: [], td: [],
  div: [['class', /^tbl$/]],
  // span: düz metin bağlantı ya da yerel dosya bağlantısı (yol yalnızca veri özniteliği; kaçışlanmış, tırnak/açı ayracı içermez)
  span: [[['class', /^flink$/]], [['class', /^flink$/], ['data-fp', /^[^"'<>`\u0000-\u001f]*$/]]],
  // img: yalnızca panelin yerel dosya protokolü, kodlanmış yol
  img: [[['class', /^md-img$/], ['src', /^cpmedia:\/\/local\/[A-Za-z0-9%._~!*()'-]+$/], ['data-mdimg', /^[^"'<>`\u0000-\u001f]*$/], ['alt', /^[^"'<>`]*$/], ['loading', /^lazy$/]]],
  a: [['href', /^https?:\/\/[^\s"'<>`\u0000-\u001f]+$/], ['target', /^_blank$/], ['rel', /^noopener$/]],
};
/** HTML ayrıştırıcısının göreceği etiketleri çıkarır; izinsiz etiket/öznitelik veya kaçışlanmamış '<' varsa hata verir. */
function audit(html) {
  const problems = [];
  for (let i = 0; i < html.length; i++) {
    const c = html[i];
    if (c === '"' || c === "'") { problems.push(`etiket dışında çıplak tırnak @${i}`); continue; }
    if (c === '>') { problems.push(`etiket dışında çıplak '>' @${i}`); continue; }
    if (c === '&') { if (!/^&(amp|lt|gt|quot|#39);/.test(html.slice(i))) problems.push(`tanınmayan varlık @${i}`); continue; }
    if (c !== '<') continue;
    const m = /^<(\/?)([a-z][a-z0-9]*)((?:\s+[a-z][a-z-]*="[^"]*")*)>/.exec(html.slice(i));
    if (!m) { problems.push(`ayrıştırılamayan etiket @${i}: ${html.slice(i, i + 40)}`); continue; }
    const [whole, close, name, attrStr] = m;
    const spec = ALLOWED[name];
    if (!spec) problems.push(`izinsiz etiket <${name}>`);
    else {
      const attrs = [...attrStr.matchAll(/([a-z][a-z-]*)="([^"]*)"/g)].map(a => [a[1], a[2]]);
      if (close && attrs.length) problems.push(`kapanış etiketinde öznitelik </${name}>`);
      if (!close) {
        // spec: tek öznitelik listesi ya da seçenekler (öznitelik sayısına göre seçilir)
        const alts = spec.length && Array.isArray(spec[0][0]) ? spec : [spec];
        const spec1 = alts.find(a => a.length === attrs.length);
        if (!spec1) { problems.push(`<${name}> öznitelik sayısı ${attrs.length}`); i += whole.length - 1; continue; }
        attrs.forEach(([k, v], j) => { if (!spec1[j] || spec1[j][0] !== k || !spec1[j][1].test(v)) problems.push(`<${name} ${k}="${v}"> izinsiz`); });
      }
    }
    i += whole.length - 1;
  }
  return problems;
}
const safe = (src) => { const h = md(src); assert.deepStrictEqual(audit(h), [], `girdi: ${JSON.stringify(src)}\nçıktı: ${h}`); return h; };
const hrefs = h => [...h.matchAll(/<a href="([^"]*)"/g)].map(m => m[1]);

test('denetleyici kendisi: zararlı örnekleri gerçekten yakalar', () => {
  assert.notDeepStrictEqual(audit('<script>x</script>'), []);
  assert.notDeepStrictEqual(audit('<a href="javascript:x" target="_blank" rel="noopener">a</a>'), []);
  assert.notDeepStrictEqual(audit('<a href="https://h/<span class="flink">x" target="_blank" rel="noopener">'), []);
  assert.notDeepStrictEqual(audit('<img src=x onerror=alert(1)>'), []);
  assert.notDeepStrictEqual(audit('<b onclick="x">'), []);
  assert.notDeepStrictEqual(audit('a " b'), []);
  assert.notDeepStrictEqual(audit('&#106;'), []);
  assert.deepStrictEqual(audit('<p><a href="https://x.com/a?b=1&amp;c" target="_blank" rel="noopener">x</a></p>'), []);
});

// --- Temel davranış ---
test('boş, null, undefined ve sayı girdiler', () => {
  assert.strictEqual(md(''), '');
  assert.strictEqual(md(null), '');
  assert.strictEqual(md(undefined), '');
  assert.strictEqual(md(0), '');
  assert.strictEqual(md(12), '<p>12</p>');
  assert.strictEqual(md('\n\n  \n'), '');
});

test('tarayıcı betiği olarak yüklenir: yalnızca window.md tanımlanır', () => {
  const w = {}; const prev = global.window; global.window = w; delete require.cache[MOD];
  try { require(MOD); } finally { if (prev === undefined) delete global.window; else global.window = prev; }
  assert.deepStrictEqual(Object.keys(w), ['md']);
  assert.strictEqual(typeof w.md, 'function');
  assert.deepStrictEqual(Object.keys(require.cache[MOD].exports), [], 'module.exports eklenmez');
});

test('paragraf: satırlar <br> ile birleşir, \\r atılır, boş satır paragrafı böler', () => {
  assert.strictEqual(md('a\r\nb\r\n\r\nc'), '<p>a<br>b</p><p>c</p>');
  assert.strictEqual(md('tek'), '<p>tek</p>');
});

test('kaçışlama: & < > " \' metinde güvenli varlığa çevrilir, çift kaçışlama yok', () => {
  assert.strictEqual(md(`a & b < c > d " e ' f &amp;`), '<p>a &amp; b &lt; c &gt; d &quot; e &#39; f &amp;amp;</p>');
});

test('HTML etiketleri metin olarak görünür', () => {
  assert.strictEqual(safe('<script>alert(1)</script>'), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  assert.strictEqual(safe('<img src=x onerror="alert(1)">'), '<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>');
  assert.strictEqual(safe('# <b>x</b>'), '<h3>&lt;b&gt;x&lt;/b&gt;</h3>');
});

// --- Satır içi ---
test('kalın, italik ve iç içe vurgu', () => {
  assert.strictEqual(md('**k** *i*'), '<p><b>k</b> <i>i</i></p>');
  assert.strictEqual(md('*i* başta'), '<p><i>i</i> başta</p>');
  assert.strictEqual(md('a*b*c'), '<p>a<i>b</i>c</p>');
  assert.strictEqual(md('***x***'), '<p><i><b>x</b></i></p>');
  assert.strictEqual(md('**a *b* c**'), '<p>**a <i>b</i> c**</p>');
  assert.strictEqual(md('*a **b** c*'), '<p><i>a <b>b</b> c</i></p>');
  assert.strictEqual(md('**yarım ve *yarım'), '<p>**yarım ve *yarım</p>');
  assert.strictEqual(md('**a\nb**'), '<p>**a<br>b**</p>', 'vurgu satır atlamaz');
});

test('satır içi kod: içi kaçışlanır ve biçimlendirilmez', () => {
  assert.strictEqual(md('`<b>**x**</b>` ve `[a](https://x)`'), '<p><code>&lt;b&gt;**x**&lt;/b&gt;</code> ve <code>[a](https://x)</code></p>');
  assert.strictEqual(md('`a` `b` `c`'), '<p><code>a</code> <code>b</code> <code>c</code></p>');
  assert.strictEqual(md('`"\'&`'), '<p><code>&quot;&#39;&amp;</code></p>');
  assert.strictEqual(md('tek ` tırnak'), '<p>tek ` tırnak</p>');
});

test('metindeki NUL/\\u0001 karakterleri sahte yer tutucu oluşturamaz (eski sürüm çöküyordu)', () => {
  assert.strictEqual(md('x \u00005\u0000 y'), '<p>x 5 y</p>');
  assert.strictEqual(md('\u00000\u0000 `c`'), '<p>0 <code>c</code></p>', 'kod kopyalanmaz');
  assert.strictEqual(md('\u00010\u0001 [a](https://x)'), '<p>0 <a href="https://x" target="_blank" rel="noopener">a</a></p>');
});

test('bağlantı: http/https adresleri yeni sekmede açılan <a> olur', () => {
  assert.strictEqual(md('[site](https://ornek.com/a?b=1&c=2)'), '<p><a href="https://ornek.com/a?b=1&amp;c=2" target="_blank" rel="noopener">site</a></p>');
  assert.strictEqual(md('[s](http://x.y)'), '<p><a href="http://x.y" target="_blank" rel="noopener">s</a></p>');
  assert.strictEqual(md('[a](https://1) [b](https://2)'), '<p><a href="https://1" target="_blank" rel="noopener">a</a> <a href="https://2" target="_blank" rel="noopener">b</a></p>');
  assert.strictEqual(md('[**k** *i*](https://x)'), '<p><a href="https://x" target="_blank" rel="noopener"><b>k</b> <i>i</i></a></p>');
  assert.strictEqual(md('**[a](https://x)**'), '<p><b><a href="https://x" target="_blank" rel="noopener">a</a></b></p>');
});

test('bağlantı: diğer adresler yalnızca metin (flink) olur, adres çıktıya girmez', () => {
  const F = '<span class="flink">tıkla</span>';
  for (const u of ['javascript:alert`1`', 'JAVASCRIPT:void', 'data:text/html;base64,PHNjcmlwdD4=', 'vbscript:x', 'HTTPS://x', 'https:/x', 'https://'])
    assert.strictEqual(safe(`[tıkla](${u})`), `<p>${F}</p>`, u);
  // Şemasız adres yerel dosya bağlantısı sayılır: yol yalnızca data-fp verisi olur (panel tıklayınca dosyayı açar/önizler)
  const L = fp => `<p><span class="flink" data-fp="${fp}">tıkla</span></p>`;
  assert.strictEqual(safe('[tıkla](src/app.js)'), L('src/app.js'));
  assert.strictEqual(safe('[tıkla](//evil.com)'), L('//evil.com'));
  assert.strictEqual(safe('[tıkla](file:///etc/passwd)'), L('/etc/passwd'));
  assert.strictEqual(safe('[tıkla](&#106;avascript:x)'), L('&amp;#106;avascript:x'));
  assert.strictEqual(safe('[tıkla](javascript:alert(1))'), `<p>${F})</p>`);
  assert.strictEqual(safe('[tıkla](data:text/html,<script>alert(1)</script>)'), `<p>${F}</script>)</p>`.replace('</script>', '&lt;/script&gt;'));
  assert.strictEqual(safe('[tıkla](java\tscript:x)'), '<p>[tıkla](java\tscript:x)</p>', 'sekmeli adres bağlantı sayılmaz');
  assert.strictEqual(safe('[tıkla]( https://x)'), '<p>[tıkla]( https://x)</p>', 'boşluklu adres bağlantı sayılmaz');
  assert.strictEqual(md('[app.js](src/app.js)'), '<p><span class="flink" data-fp="src/app.js">app.js</span></p>');
  assert.strictEqual(md('[x](javascript:alert(1))'), '<p><span class="flink">x</span>)</p>');
  assert.strictEqual(md('[x](`kod`)'), '<p><span class="flink">x</span></p>');
});

test('bağlantı: adresteki tırnak, açı ayracı ve kesme işareti özniteliği kıramaz', () => {
  assert.deepStrictEqual(hrefs(safe('[a](https://x"onmouseover="alert(1))')), ['https://x&quot;onmouseover=&quot;alert(1']);
  assert.deepStrictEqual(hrefs(safe("[a](https://x'onmouseover='alert(1))")), ['https://x&#39;onmouseover=&#39;alert(1']);
  assert.deepStrictEqual(hrefs(safe('[a](https://x/<script>)')), ['https://x/&lt;script&gt;']);
  assert.deepStrictEqual(hrefs(safe('[a"><img src=x onerror=alert(1)>](https://x)')), ['https://x']);
});

test('bağlantı: adresteki [ ] * ` sonraki kalıpların href içine etiket sokmasına yol açmaz (eski açık)', () => {
  // eski sürüm: <a href="https://h/<span class="flink">x" ...> — öznitelik erken kapanıyor, target/rel düşüyordu
  assert.strictEqual(safe('[a](https://h/[x) tail](z)'), '<p><a href="https://h/[x" target="_blank" rel="noopener">a</a> tail](z)</p>');
  assert.strictEqual(safe('[a](https://h/*b*)'), '<p><a href="https://h/*b*" target="_blank" rel="noopener">a</a></p>');
  assert.strictEqual(safe('[a](https://h/**b**)'), '<p><a href="https://h/**b**" target="_blank" rel="noopener">a</a></p>');
  assert.strictEqual(safe('[a](https://h/`b`)'), '<p><span class="flink">a</span></p>', 'adreste kod parçası varsa bağlantı yapılmaz');
  safe('[p [q](https://h/[r) ](z)');
  safe('[a](https://h/[x)**k](https://y/]*)*');
});

test('bağlantı ve unicode: Türkçe/emoji/sağdan-sola karakterler korunur', () => {
  assert.strictEqual(md('**Gerikoğlu** ünlü 🎉 [şık](https://ö.com/ğ)'), '<p><b>Gerikoğlu</b> ünlü 🎉 <a href="https://ö.com/ğ" target="_blank" rel="noopener">şık</a></p>');
  safe('‮[gpj.exe](https://x/‮) ​*​*');
});

// --- Bloklar ---
test('kod bloğu: dil etiketi atılır, içerik kaçışlanır ve biçimlendirilmez, kapanmazsa sona kadar sürer', () => {
  assert.strictEqual(md('```js\n<b>**x**</b>\n  a\n```\nsonra'), '<pre><code>&lt;b&gt;**x**&lt;/b&gt;\n  a</code></pre><p>sonra</p>');
  assert.strictEqual(md('  ```\nx\n  ```'), '<pre><code>x</code></pre>');
  assert.strictEqual(md('```\n```'), '<pre><code></code></pre>');
  assert.strictEqual(md('```\nkapanmadı\nhâlâ'), '<pre><code>kapanmadı\nhâlâ</code></pre>');
  assert.strictEqual(md('```'), '<pre><code></code></pre>');
});

test('başlıklar: # → h3 … #### → h6; ##### ve boşluksuz # paragraf kalır', () => {
  assert.strictEqual(md('# a\n## b\n### c\n#### *d*'), '<h3>a</h3><h4>b</h4><h5>c</h5><h6><i>d</i></h6>');
  assert.strictEqual(md('##### e'), '<p>##### e</p>');
  assert.strictEqual(md('#etiket'), '<p>#etiket</p>');
  assert.strictEqual(md('metin\n# başlık'), '<p>metin</p><h3>başlık</h3>');
});

test('liste: - * ve numaralı; devam satırları birleşir; liste dışı satırda biter', () => {
  assert.strictEqual(md('- a\n* b\n- **c**'), '<ul><li>a</li><li>b</li><li><b>c</b></li></ul>');
  assert.strictEqual(md('1. bir\n2. iki'), '<ol><li>bir</li><li>iki</li></ol>');
  assert.strictEqual(md('- a\n  devam\n   yine\n- b\nson'), '<ul><li>a devam yine</li><li>b</li></ul><p>son</p>');
  assert.strictEqual(md('- a\n  - iç'), '<ul><li>a</li><li>iç</li></ul>', 'girintili madde devam değil yeni maddedir');
  assert.strictEqual(md('- a\n tek boşluk'), '<ul><li>a</li></ul><p> tek boşluk</p>');
  assert.strictEqual(md('1. a\n- b'), '<ol><li>a</li><li>b</li></ol>', 'tür ilk maddeden belirlenir');
  assert.strictEqual(md('- a\n\n- b'), '<ul><li>a</li></ul><ul><li>b</li></ul>');
  assert.strictEqual(md('-yok'), '<p>-yok</p>');
  assert.strictEqual(md('metin\n- madde'), '<p>metin</p><ul><li>madde</li></ul>');
  assert.strictEqual(md('metin\n3. madde'), '<p>metin</p><ol><li>madde</li></ol>');
});

test('alıntı: ardışık > satırları boşlukla birleşir', () => {
  assert.strictEqual(md('> a\n>b\n  > *c*\nd'), '<blockquote>a b <i>c</i></blockquote><p>d</p>');
  assert.strictEqual(md('metin\n> alıntı'), '<p>metin</p><blockquote>alıntı</blockquote>');
});

test('tablo: başlık, ayraç, gövde; hücreler satır içi biçimlenir ve kaçışlanır', () => {
  assert.strictEqual(md('| A | **B** |\n|---|:--:|\n| 1 | <x> |\n| `2` | [l](https://x) |\nsonra'),
    '<div class="tbl"><table><thead><tr><th>A</th><th><b>B</b></th></tr></thead><tbody>' +
    '<tr><td>1</td><td>&lt;x&gt;</td></tr><tr><td><code>2</code></td><td><a href="https://x" target="_blank" rel="noopener">l</a></td></tr></tbody></table></div><p>sonra</p>');
  assert.strictEqual(md('  | a |\n  -- |'), '<div class="tbl"><table><thead><tr><th>a</th></tr></thead><tbody></tbody></table></div><p>  -- |</p>');
  assert.strictEqual(md('| a |\n| :-- |'), '<div class="tbl"><table><thead><tr><th>a</th></tr></thead><tbody></tbody></table></div>');
});

test('tablo değil: ayraç yoksa, ayraç tek tireyse ya da son satırsa satır paragraf olur', () => {
  assert.strictEqual(md('| a | b |'), '<p>| a | b |</p>');
  assert.strictEqual(md('| a |\n| - |'), '<p>| a |</p><p>| - |</p>');
  assert.strictEqual(md('| a |\nmetin'), '<p>| a |</p><p>metin</p>');
  assert.strictEqual(md('|---|\n| a |'), '<p>|---|</p><p>| a |</p>', 'önceki satır ayraç sayılmaz');
});

test('paragraf, blok başlangıcında biter; blok olmayan blok-benzeri satır tek başına paragraf olur', () => {
  assert.strictEqual(md('a\n```\nk\n```'), '<p>a</p><pre><code>k</code></pre>');
  assert.strictEqual(md('a\n| x |'), '<p>a</p><p>| x |</p>');
  assert.strictEqual(md('  # girintili'), '<p>  # girintili</p>');
  assert.strictEqual(md('a\n  # girintili\nb'), '<p>a</p><p>  # girintili</p><p>b</p>');
});

// --- Rastgele saldırı girdileri (tohumlu, tekrarlanabilir) ---
test('rastgele girdiler: çıktıda asla izinsiz etiket/öznitelik ya da javascript: href olmaz', () => {
  let seed = 20261105;
  const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const parts = ['[', ']', '(', ')', '*', '**', '`', '"', "'", '<', '>', '&', '|', '#', '# ', '- ', '1. ', '> ', '```', '\n', '\n\n', ' ', '  ',
    'https://', 'http://', 'javascript:', 'data:', 'a', 'ş', '🎉', '\u0000', '\u0001', '0', '<script>', 'onerror=', '|---|', '&quot;', '&#106;', '\\'];
  for (let n = 0; n < 4000; n++) {
    let s = ''; const len = 1 + rnd(30);
    for (let k = 0; k < len; k++) s += parts[rnd(parts.length)];
    const h = safe(s);
    for (const u of hrefs(h)) assert.match(u, /^https?:\/\//);
  }
});

// --- Yerel dosya bağlantıları ve görseller (0.2.8) ---
test('yerel dosya bağlantısı: Windows/Mac yolu, boşluklu yol, file:// ve %XX çözülür', () => {
  const fp = h => [...h.matchAll(/data-fp="([^"]*)"/g)].map(m => m[1]);
  assert.deepStrictEqual(fp(safe('[Görseller](D:\\İşler\\Gürler Piliç\\Görseller)')), ['D:\\İşler\\Gürler Piliç\\Görseller']);
  assert.deepStrictEqual(fp(safe('[a](</a b/c.png>)')), ['/a b/c.png']);
  assert.deepStrictEqual(fp(safe('[a](C:/x/y.png)')), ['C:/x/y.png']);
  assert.deepStrictEqual(fp(safe('[a](file:///C:/x/y.png)')), ['C:/x/y.png']);
  assert.deepStrictEqual(fp(safe('[a](/x/b%20c.png)')), ['/x/b c.png']);
  assert.deepStrictEqual(fp(safe('[a](/x/%E0%A4%A.png)')), ['/x/%E0%A4%A.png'], 'bozuk kodlama olduğu gibi kalır');
  assert.deepStrictEqual(fp(safe('[a](rev2.jpg)')), ['rev2.jpg']);
  assert.deepStrictEqual(fp(safe('[a](x"onmouseover="y)')), ['x&quot;onmouseover=&quot;y']);
  assert.deepStrictEqual(fp(safe('[a](/p q/"onclick="x)')), ['/p q/&quot;onclick=&quot;x']);
  assert.strictEqual(safe('[x](`kod`)'), '<p><span class="flink">x</span></p>', 'kod yer tutucusu yol sayılmaz');
});

test('görsel: yerel mutlak yol resim olur; uzak adres bağlantı; göreli/uzantısız yol metin', () => {
  const src = h => [...h.matchAll(/<img class="md-img" src="([^"]*)" data-mdimg="([^"]*)" alt="([^"]*)"/g)].map(m => [decodeURIComponent(m[1].slice(16)), m[2], m[3]]);
  assert.deepStrictEqual(src(safe('![Sahne 1](D:\\İşler\\Gürler Piliç\\3\\pano.jpg)')), [['D:\\İşler\\Gürler Piliç\\3\\pano.jpg', 'D:\\İşler\\Gürler Piliç\\3\\pano.jpg', 'Sahne 1']]);
  assert.deepStrictEqual(src(safe('![](/Users/a/b%20c.PNG)')), [['/Users/a/b c.PNG', '/Users/a/b c.PNG', '']]);
  assert.deepStrictEqual(src(safe('![x](<C:/a b/c.webp>)')), [['C:/a b/c.webp', 'C:/a b/c.webp', 'x']]);
  assert.deepStrictEqual(src(safe('![f](file:///C:/x/y.gif)')), [['C:/x/y.gif', 'C:/x/y.gif', 'f']]);
  assert.deepStrictEqual(src(safe('![f](file://srv/x/y.jpeg)')), [['/srv/x/y.jpeg', '/srv/x/y.jpeg', 'f']]);
  assert.deepStrictEqual(src(safe('![~](~/x.png)')), [['~/x.png', '~/x.png', '~']]);
  assert.deepStrictEqual(src(safe('![z](/a/"onerror=x.png)')), [['/a/"onerror=x.png', '/a/&quot;onerror=x.png', 'z']]);
  assert.deepStrictEqual(src(safe('![k](/a/%E0%A4%A.png)')), [['/a/%E0%A4%A.png', '/a/%E0%A4%A.png', 'k']]);
  assert.strictEqual(safe('![u](https://x.com/a.png)'), '<p><a href="https://x.com/a.png" target="_blank" rel="noopener">u</a></p>');
  assert.strictEqual(safe('![](https://x.com/a.png)'), '<p><a href="https://x.com/a.png" target="_blank" rel="noopener">görsel</a></p>');
  assert.strictEqual(safe('![r](rel.png)'), '<p><span class="flink">r</span></p>');
  assert.strictEqual(safe('![](rel.png)'), '<p><span class="flink">rel.png</span></p>');
  assert.strictEqual(safe('![d](/a/doc.pdf)'), '<p><span class="flink">d</span></p>');
  assert.strictEqual(safe('![x](javascript:alert(1))'), '<p><span class="flink">x</span>)</p>');
  assert.strictEqual(safe('![a *b*](/x/y.png)').includes('alt="a *b*"'), true, 'alt içinde vurgu işlenmez');
});
