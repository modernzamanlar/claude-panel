// Yazma kutusundaki model menüsü: seçenekler, tam model kimliği, bağlam penceresi; hızlı mod durum metinleri.
// Tarayıcıda window.modelInfo, Node testlerinde module.exports.
//
// Liste Claude Code CLI 2.1.318'de doğrulandı (model çağrılmadan, `claude -p /context --no-session-persistence --model <ad>`
// çıktısındaki "Model:" ve "Tokens: … / <pencere>" satırları; ikilideki provider_alias_targets):
//   opus → claude-opus-5-5 · 1m, sonnet → claude-sonnet-5-5 · 1m, haiku → claude-haiku-5-5 · 1m, fable → claude-fable-5-1 · 1m.
//   "opus[1m]", "haiku[1m]" ve tam kimlikler aynı modele ve aynı 1m pencereye çözülür: bu sürümde 200K'lık ayrı bir
//   varyant yok, bu yüzden "[1m]" için ayrı seçenek konmaz. Eski kimliklerden claude-sonnet-4-5 200k pencerelidir.
// Pencere, tur bitince result.modelUsage[*].contextWindow'dan (gerçek değer) güncellenir; tablo yalnızca o gelene kadar kullanılır.
(function (root) {
  const LIST = [
    { alias: 'opus', id: 'claude-opus-5-5', label: 'Opus 5.5', window: 1e6 },
    { alias: 'sonnet', id: 'claude-sonnet-5-5', label: 'Sonnet 5.5', window: 1e6 },
    { alias: 'haiku', id: 'claude-haiku-5-5', label: 'Haiku 5.5', window: 1e6 },
    { alias: 'fable', id: 'claude-fable-5-1', label: 'Fable 5.1', window: 1e6 },
  ];
  // Menüde olmayan ama oturum kayıtlarında görülebilen, penceresi doğrulanmış kimlikler
  const KNOWN = { 'claude-fable-5': 1e6, 'claude-sonnet-4-5': 2e5 };

  const base = v => String(v || '').trim().replace(/\[1m\]$/i, '').toLowerCase();
  /** Takma ad ya da kimlik ("opus", "claude-opus-5-5", "claude-opus-5-5[1m]") → menü kaydı | null */
  function find(v) {
    const b = base(v);
    return LIST.find(m => m.alias === b || m.id === b) || null;
  }
  /** Bağlam penceresi (token) | null: "[1m]" soneki her zaman 1M; bilinmeyen kimlikte null (tahmin yok) */
  function windowOf(v) {
    if (/\[1m\]$/i.test(String(v || '').trim())) return 1e6;
    const m = find(v);
    return m ? m.window : KNOWN[base(v)] || null;
  }
  const fmtWindow = w => (!w ? '' : w >= 1e6 ? (w / 1e6) + 'M' : Math.round(w / 1e3) + 'K');

  // result.fast_mode_disabled_reason (CLI şeması: free, preference, extra_usage_disabled, network_error, unknown,
  // not_first_party, disabled_by_env, model_not_allowed, sdk_opt_in_required, pending)
  const WHY = {
    extra_usage_disabled: 'hesapta ek kullanım (extra usage) kapalı',
    model_not_allowed: 'bu model hızlı modu desteklemiyor',
    not_first_party: 'yalnızca doğrudan Anthropic API ile kullanılabilir',
    disabled_by_env: 'ortam değişkeniyle kapatılmış',
    sdk_opt_in_required: 'açıkça istenmedi',
    preference: 'kuruluş ayarıyla kapalı',
    free: 'ücretsiz planda yok',
    network_error: 'erişilebilirlik denetlenemedi (ağ hatası)',
    pending: 'erişilebilirlik denetleniyor',
    unknown: 'kullanılamıyor (neden bilinmiyor)',
  };
  /** Son turun hızlı mod durumu → kısa metin | '' (bilgi yoksa) */
  function fastNote(f) {
    if (!f || !f.state) return '';
    if (f.state === 'on') return 'Son turda hızlı modda çalıştı';
    if (f.state === 'cooldown') return 'Hız sınırı nedeniyle beklemede';
    return f.reason ? 'Son turda kullanılamadı: ' + (WHY[f.reason] || f.reason) : 'Son turda kapalıydı';
  }

  const api = { LIST, find, windowOf, fmtWindow, fastNote, WHY };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.modelInfo = api;
})(typeof window !== 'undefined' ? window : this);
