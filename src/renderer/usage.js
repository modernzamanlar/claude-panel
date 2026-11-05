// Kalan kullanım geçmişi ve tahmini: her turda gelen kullanım oranı saklanır, son eğilime göre
// "bu hızla ne zaman biter" hesaplanır, kullanım menüsündeki küçük çizgi grafiği için noktalar üretilir.
// Tarayıcıda window.usageMath, Node testlerinde module.exports olarak kullanılır.
(function (root) {
  const H = 36e5;
  const WIN = { five_hour: 5 * H, seven_day: 7 * 24 * H, seven_day_opus: 7 * 24 * H, seven_day_sonnet: 7 * 24 * H };
  const winMs = k => WIN[k] || 7 * 24 * H;

  // Yeni kayıt: son kayıttan 10 dk geçmediyse ve değerler aynıysa eklenmez; en fazla 600 kayıt
  function record(hist, usage, now) {
    const h = Array.isArray(hist) ? hist.slice() : [];
    if (!usage || !usage.w) return h;
    const w = {};
    for (const [k, v] of Object.entries(usage.w)) if (v && typeof v.u === 'number') w[k] = Math.round(v.u * 1000) / 1000;
    if (!Object.keys(w).length) return h;
    const last = h[h.length - 1];
    if (last && now - last.t < 10 * 60e3 && Object.keys(w).every(k => Math.abs((last.w[k] ?? -1) - w[k]) < 0.005)) return h;
    h.push({ t: now, w });
    return h.slice(-600);
  }

  // Bu pencerenin (son sıfırlanmadan beri) noktaları
  function points(hist, key, now, resetsAt) {
    const from = resetsAt ? resetsAt * 1000 - winMs(key) : now - winMs(key);
    return (hist || []).filter(e => e && e.t >= from && e.t <= now && typeof (e.w || {})[key] === 'number').map(e => [e.t, e.w[key]]);
  }

  // Son eğilim (7 günlükte son 24 sa, 5 saatlikte son 2 sa) ile doluş zamanı
  function forecast(hist, key, now, resetsAt) {
    const look = winMs(key) > 5 * H ? 24 * H : 2 * H;
    const pts = points(hist, key, now, resetsAt).filter(p => p[0] >= now - look);
    if (pts.length < 2 || pts[pts.length - 1][0] - pts[0][0] < 20 * 60e3) return null;
    const n = pts.length, mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
    let num = 0, den = 0;
    for (const [x, y] of pts) { num += (x - mx) * (y - my); den += (x - mx) * (x - mx); }
    const slope = num / den; // oran / ms
    const uNow = pts[n - 1][1];
    if (!(slope > 0)) return { rate: 0, eta: null, beforeReset: false, uNow };
    const eta = now + Math.max(0, 1 - uNow) / slope;
    return { rate: slope * H, eta, beforeReset: resetsAt ? eta < resetsAt * 1000 : true, uNow };
  }

  // Çizgi grafiği: pencerenin başından sonuna x, 0–100% y
  function spark(hist, key, now, resetsAt, w, h) {
    const end = resetsAt ? resetsAt * 1000 : now, start = end - winMs(key);
    return points(hist, key, now, resetsAt).map(([t, u]) => `${((t - start) / (end - start) * w).toFixed(1)},${(h - Math.max(0, Math.min(1, u)) * h).toFixed(1)}`).join(' ');
  }

  const api = { record, points, forecast, spark, winMs };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.usageMath = api;
})(typeof window !== 'undefined' ? window : this);
