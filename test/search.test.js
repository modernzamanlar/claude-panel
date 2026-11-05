// İçerik araması: metin çıkarma, Türkçe karakter duyarsızlık, çok kelime (VE), alıntı
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { SearchIndex, norm, extractText } = require('../src/main/search');

test('normalleştirme Türkçe karakterleri sadeleştirir, uzunluğu korur', () => {
  assert.equal(norm('GETİRİLEMEDİ Şablon Çiçek'), 'getirilemedi sablon cicek');
  const t = 'İstanbul ŞIK'; assert.equal(norm(t).length, t.length);
});

test('dizin ve sorgu', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-search-'));
  const file = path.join(dir, 'a1.jsonl');
  const L = [
    { type: 'user', message: { content: 'Search Console sitemap için "Getirilemedi" diyor' } },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'Teklif şablonunu güncelledim.' }, { type: 'tool_use', name: 'Bash', input: { command: 'curl -sI https://ornek.com/sitemap.xml' } }] } },
    { type: 'user', message: { content: [{ type: 'tool_result', content: 'GİZLİ ÇIKTI' }] } },
  ];
  fs.writeFileSync(file, L.map(x => JSON.stringify(x)).join('\n'));
  const txt = await extractText(file);
  assert.match(txt, /\[Bash\] curl/); assert.doesNotMatch(txt, /GİZLİ/);
  const st = fs.statSync(file);
  const si = new SearchIndex(dir);
  await si.sync([{ id: 'a1', file, mtimeMs: st.mtimeMs, size: st.size }]);
  assert.equal(si.query('getirilemedi')[0].id, 'a1');
  assert.equal(si.query('sablon teklif').length, 1);         // iki kelime, sıra fark etmez, ş=s
  assert.equal(si.query('sablon yokboylebirsey').length, 0); // VE
  assert.equal(si.query('sitemap')[0].hits, 2);
  assert.match(si.query('GETİRİLEMEDİ')[0].snippet, /Getirilemedi/);
});

// ---------- FTS5 dizini: kalıcılık, artan güncelleme, Türkçe ----------
function writeSession(dir, id, lines) {
  const file = path.join(dir, id + '.jsonl');
  fs.writeFileSync(file, lines.map(x => JSON.stringify(x)).join('\n'));
  const st = fs.statSync(file);
  return { id, file, mtimeMs: st.mtimeMs, size: st.size };
}
test('FTS: dizin diske yazılır, yeniden açınca taramadan aranır; değişmeyen oturum yeniden işlenmez', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-fts-'));
  const a = writeSession(dir, 'a', [{ type: 'user', message: { content: 'Iğdır ılık ışık' } }]);
  const b = writeSession(dir, 'b', [{ type: 'assistant', message: { content: [{ type: 'text', text: 'Rezervasyon formu hazır' }] } }]);
  const si = new SearchIndex(dir);
  await si.sync([a, b]);
  assert.equal(si.docs.size, 2);
  assert.equal(si.query('igdir ilik')[0].id, 'a');        // ı/ğ → i/g
  assert.equal(si.query('rezerv')[0].id, 'b');            // önek
  assert.match(si.query('rezerv')[0].snippet, /Rezervasyon formu/);
  si.close();
  const si2 = new SearchIndex(dir);                        // yeniden aç: sync olmadan sonuç var
  assert.equal(si2.query('ışık')[0].id, 'a');
  let calls = 0; await si2.sync([a, b], () => calls++);
  assert.equal(si2.progress.total, 0);                     // hiçbiri değişmedi
  await si2.sync([b]);                                     // a silindi
  assert.equal(si2.query('igdir').length, 0);
  assert.equal(si2.docs.size, 1);
  si2.close();
});
test('FTS: kelimeler farklı mesajlarda olsa da oturum bulunur (VE oturum düzeyinde)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-fts-'));
  const s = writeSession(dir, 'c', [
    { type: 'user', message: { content: 'robots.txt dosyasını düzelt' } },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'Canonical etiketleri eklendi' }] } },
  ]);
  const si = new SearchIndex(dir); await si.sync([s]);
  assert.equal(si.query('robots canonical').length, 1);
  assert.equal(si.query('robots.txt')[0].id, 'c');
  assert.equal(si.query('"tırnak" robots').length, 0);
  si.close();
});
