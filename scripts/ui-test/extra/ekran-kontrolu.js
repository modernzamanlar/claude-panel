// Ekran kontrolü: durdurma bildirimi köprüsü var ve bildirim gelince kısa uyarı gösterilir (ana süreç olayı taklit edilemez;
// köprünün varlığı ve uyarı öğesi denetlenir). Asıl uçtan uca deneme gerçek Windows'ta yapılır (PLAN/rapor).
(async () => {
  const fn = window.api && window.api.screen && window.api.screen.onStopped;
  const toastEl = document.getElementById('toast');
  return { name: 'ekran kontrolü: durdurma bildirimi köprüsü', ok: typeof fn === 'function' && !!toastEl };
})()
