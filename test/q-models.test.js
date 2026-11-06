// renderer/models.js: model menüsü kayıtları, tam kimlik, bağlam penceresi ve hızlı mod durum metinleri.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');
const MOD = require.resolve('../src/renderer/models.js');
const M = require(MOD);

test('LIST: CLI 2.1.318 takma adları ve tam kimlikleri; hepsi 1M pencereli', () => {
  assert.deepStrictEqual(M.LIST.map(m => [m.alias, m.id, m.window]), [
    ['opus', 'claude-opus-5-5', 1e6], ['sonnet', 'claude-sonnet-5-5', 1e6], ['haiku', 'claude-haiku-5-5', 1e6], ['fable', 'claude-fable-5-1', 1e6]]);
});

test('find: takma ad, tam kimlik, [1m] soneki, büyük harf ve boşluk; bilinmeyen null', () => {
  assert.strictEqual(M.find('opus').id, 'claude-opus-5-5');
  assert.strictEqual(M.find(' Claude-Haiku-5-5[1M] ').alias, 'haiku');
  assert.strictEqual(M.find('fable[1m]').id, 'claude-fable-5-1');
  assert.strictEqual(M.find('claude-sonnet-4-5'), null);
  assert.strictEqual(M.find(null), null);
  assert.strictEqual(M.find(''), null);
});

test('windowOf: [1m] her zaman 1M; menüdeki model; doğrulanmış eski kimlik; bilinmeyen null (tahmin yok)', () => {
  assert.strictEqual(M.windowOf('claude-unknown-9[1m]'), 1e6);
  assert.strictEqual(M.windowOf('sonnet'), 1e6);
  assert.strictEqual(M.windowOf('claude-sonnet-4-5'), 2e5);
  assert.strictEqual(M.windowOf('claude-fable-5'), 1e6);
  assert.strictEqual(M.windowOf('claude-unknown-9'), null);
  assert.strictEqual(M.windowOf(undefined), null);
});

test('fmtWindow: 1M, 200K; boş', () => {
  assert.strictEqual(M.fmtWindow(1e6), '1M');
  assert.strictEqual(M.fmtWindow(2e6), '2M');
  assert.strictEqual(M.fmtWindow(2e5), '200K');
  assert.strictEqual(M.fmtWindow(null), '');
  assert.strictEqual(M.fmtWindow(0), '');
});

test('fastNote: açık, beklemede, nedenli kapalı (bilinen/bilinmeyen neden), nedensiz kapalı, bilgi yok', () => {
  assert.strictEqual(M.fastNote({ state: 'on' }), 'Son turda hızlı modda çalıştı');
  assert.strictEqual(M.fastNote({ state: 'cooldown' }), 'Hız sınırı nedeniyle beklemede');
  assert.strictEqual(M.fastNote({ state: 'off', reason: 'extra_usage_disabled' }), 'Son turda kullanılamadı: hesapta ek kullanım (extra usage) kapalı');
  assert.strictEqual(M.fastNote({ state: 'off', reason: 'yeni_neden' }), 'Son turda kullanılamadı: yeni_neden');
  assert.strictEqual(M.fastNote({ state: 'off' }), 'Son turda kapalıydı');
  assert.strictEqual(M.fastNote({}), '');
  assert.strictEqual(M.fastNote(null), '');
  for (const k of ['free', 'preference', 'extra_usage_disabled', 'network_error', 'unknown', 'not_first_party', 'disabled_by_env', 'model_not_allowed', 'sdk_opt_in_required', 'pending']) assert.ok(M.WHY[k], k);
});

test('tarayıcıda window.modelInfo olarak yüklenir', () => {
  const window = {};
  vm.runInNewContext(fs.readFileSync(MOD, 'utf8'), { window }, { filename: MOD });
  assert.strictEqual(window.modelInfo.find('opus').label, 'Opus 5.5');
});
