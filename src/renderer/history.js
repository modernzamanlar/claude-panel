// Yazma kutusunda ↑/↓ ile önceki mesajlar (terminaldeki gibi). Kutu boşken ya da imleç ilk satırdayken ↑ bir önceki
// gönderilen mesajı getirir; geçmişte gezinirken imleç son satırdayken ↓ sonrakine, en sonda yazılmakta olan taslağa döner.
// Durum: {idx, draft} — idx -1: gezinmiyor; 0: en yeni mesaj. Tarayıcıda window.inputHistory, Node'da module.exports.
(function () {
  // Oturumun kullanıcı mesajları (eskiden yeniye); ek satırı (📎) atılır, art arda aynı mesaj bir kez alınır
  function entries(msgs) {
    const out = [];
    for (const m of msgs || []) {
      if (!m || m.r !== 'u' || typeof m.t !== 'string') continue;
      const t = m.t.replace(/\n?📎.*$/s, '').trim();
      if (t && out[out.length - 1] !== t) out.push(t);
    }
    return out;
  }

  const firstLine = (text, caret) => !String(text).slice(0, caret).includes('\n');
  const lastLine = (text, caret) => !String(text).slice(caret).includes('\n');

  // ↑ geçerli mi: seçim yok ve (kutu boş ya da imleç ilk satırda)
  const canUp = (text, a, b) => a === b && (!text || firstLine(text, a));
  // ↓ geçerli mi: geçmişte geziniyor, seçim yok ve imleç son satırda
  const canDown = (st, text, a, b) => !!st && st.idx >= 0 && a === b && lastLine(text, a);

  // dir: -1 (↑, daha eski) ya da +1 (↓, daha yeni) → {state, text} ya da null (hareket yok)
  function step(st, list, dir, text) {
    st = st && st.idx >= 0 ? st : { idx: -1, draft: '' };
    const n = (list || []).length;
    if (dir < 0) {
      if (st.idx + 1 >= n) return null;
      const idx = st.idx + 1;
      return { state: { idx, draft: st.idx < 0 ? String(text || '') : st.draft }, text: list[n - 1 - idx] };
    }
    if (st.idx < 0) return null;
    if (st.idx === 0) return { state: { idx: -1, draft: '' }, text: st.draft };
    const idx = st.idx - 1;
    return { state: { idx, draft: st.draft }, text: list[n - 1 - idx] };
  }

  const api = { entries, canUp, canDown, step, firstLine, lastLine };
  globalThis.inputHistory = api;
  if (typeof module === 'object') module.exports = api;
})();
