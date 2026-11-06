// Yazma kutusunda "@" ile dosya anma: imlecin solundaki @ belirtecini bulur, seçilen dosyayı yerine koyar.
// Claude Code gibi boşluklu yollar tırnakla yazılır: @"alt klasör/a b.txt" (claude -p bunu da açar; @a\ b.txt açılmaz).
// Tarayıcıda window.mention, Node testlerinde module.exports olarak kullanılır.
(function () {
  // {start, end, q, quoted} ya da null. @ satır başında ya da boşluktan sonra olmalı (e-posta adresleri açmaz).
  function token(text, caret) {
    if (typeof text !== 'string') return null;
    if (!Number.isInteger(caret) || caret < 0 || caret > text.length) caret = text.length;
    const m = /(^|\s)@("[^"\n]*|[^\s"]*)$/.exec(text.slice(0, caret));
    if (!m) return null;
    const quoted = m[2][0] === '"';
    const after = (quoted ? /^[^"\n]*"?/ : /^[^\s"]*/).exec(text.slice(caret))[0]; // imleç belirtecin ortasındaysa sonu da değişir
    return { start: m.index + m[1].length, end: caret + after.length, q: quoted ? m[2].slice(1) : m[2], quoted };
  }

  // Klasörlerin sonuna "/" eklenir; boşluk ya da tırnak içeren yol tırnaklanır
  function format(item) {
    const p = item.rel + (item.dir ? '/' : '');
    return /[\s"]/.test(p) ? '@"' + p + '"' : '@' + p;
  }

  // Seçileni belirtecin yerine koyar → {text, caret}. Dosyadan sonra boşluk gelir (öneri kapanır);
  // klasörde tırnak açık kalır ve boşluk eklenmez, böylece içindekiler önerilmeye devam eder.
  function apply(text, tok, item) {
    let ins = format(item);
    const after = text.slice(tok.end);
    if (item.dir) { if (ins.endsWith('"')) ins = ins.slice(0, -1); }
    else if (!/^\s/.test(after)) ins += ' ';
    const out = text.slice(0, tok.start) + ins + after;
    return { text: out, caret: tok.start + ins.length + (!item.dir && /^\s/.test(after) ? 1 : 0) };
  }

  const api = { token, format, apply };
  globalThis.mention = api;
  if (typeof module === 'object') module.exports = api;
})();
