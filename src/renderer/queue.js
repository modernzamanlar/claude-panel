// Mesaj sırası işlemleri (saf): yer değiştirme, silme, düzenleme, yazma kutusuna geri alma. Liste yerinde değiştirilir.
// Öğe: {text, att} — att (ekler) her işlemde korunur. Tarayıcıda window.msgQueue, Node'da module.exports.
(function () {
  const ok = (q, k) => Array.isArray(q) && Number.isInteger(k) && k >= 0 && k < q.length;

  // k'deki öğeyi d (−1 yukarı, +1 aşağı) kadar kaydırır; sınırdaysa false
  function move(q, k, d) {
    const j = k + d;
    if (!ok(q, k) || !ok(q, j)) return false;
    const [it] = q.splice(k, 1); q.splice(j, 0, it);
    return true;
  }

  function remove(q, k) { return ok(q, k) ? q.splice(k, 1)[0] : null; }

  // Metni değiştirir (ekler kalır); metin de ek de kalmazsa öğe silinir → 'edited' | 'removed' | null
  function edit(q, k, text) {
    if (!ok(q, k)) return null;
    const t = String(text == null ? '' : text).trim();
    if (!t && !(q[k].att || []).length) { q.splice(k, 1); return 'removed'; }
    q[k] = { ...q[k], text: t };
    return 'edited';
  }

  // Öğeyi sıradan çıkarıp yazma kutusuna verilecek hale getirir: kutuda yazı varsa altına eklenir → {text, att} | null
  function takeBack(q, k, cur) {
    const it = remove(q, k);
    if (!it) return null;
    const c = String(cur || '').trim();
    return { text: c ? it.text + (it.text ? '\n' : '') + c : it.text || '', att: [...(it.att || [])] };
  }

  // Satırda gösterilecek kısa metin: yazı (200 karakter) ya da eklerin adları
  function label(it) {
    const t = String((it && it.text) || '').slice(0, 200);
    return t || ((it && it.att) || []).map(a => a.name).join(', ');
  }

  const api = { move, remove, edit, takeBack, label };
  globalThis.msgQueue = api;
  if (typeof module === 'object') module.exports = api;
})();
