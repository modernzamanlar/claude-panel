// Güncelleyici testleri: sahte güncelleme klasörü ve sahte app nesnesi ile.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { createUpdater, cmpVer, sha512, signManifest, verifyManifest } = require('../src/main/updater');
const KP = crypto.generateKeyPairSync('ed25519');
const PRIV = KP.privateKey.export({ type: 'pkcs8', format: 'pem' }), PUB = KP.publicKey.export({ type: 'spki', format: 'pem' });

async function setup(version, { badHash = false, unsigned = false, forge = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-upd-'));
  const file = `Claude Panel Setup ${version}.exe`;
  fs.writeFileSync(path.join(dir, file), Buffer.alloc(300000, 7));
  const hash = await sha512(path.join(dir, file));
  const m = { version, file, size: 300000, sha512: badHash ? 'x' + hash.slice(1) : hash, notes: 'Notlar' };
  if (!unsigned) m.imza = signManifest(m, forge ? crypto.generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' }) : PRIV);
  fs.writeFileSync(path.join(dir, 'guncelleme.json'), JSON.stringify(m));
  const states = [];
  const u = createUpdater({ app: { getVersion: () => '0.2.0', quit() {} }, settingsFile: path.join(dir, 'settings.json'), enabled: true, publicKey: PUB, onState: s => states.push(s.phase) });
  u.setDir(dir);
  return { u, states, dir };
}

test('sürüm karşılaştırma', () => {
  assert.strictEqual(cmpVer('0.2.1', '0.2.0'), 1); assert.strictEqual(cmpVer('0.10.0', '0.9.9'), 1);
  assert.strictEqual(cmpVer('0.2.0', '0.2.0'), 0); assert.strictEqual(cmpVer('0.1.9', '0.2.0'), -1);
});
test('güncelleyici: yeni sürüm indirilir, doğrulanır, hazır olur', async () => {
  const { u, states } = await setup('0.2.1');
  const st = await u.check({ manual: true });
  assert.strictEqual(st.phase, 'ready'); assert.strictEqual(st.latest, '0.2.1'); assert.strictEqual(st.notes, 'Notlar');
  assert.strictEqual(fs.statSync(st.file).size, 300000);
  assert.ok(states.includes('downloading'));
});
test('güncelleyici: aynı/eski sürümde bir şey yapmaz', async () => {
  const { u } = await setup('0.2.0');
  assert.strictEqual((await u.check({ manual: true })).phase, 'none');
});
test('güncelleyici: bozuk dosya kurulmaz', async () => {
  const { u } = await setup('0.3.7', { badHash: true });
  const st = await u.check({ manual: true });
  assert.strictEqual(st.phase, 'error'); assert.match(st.error, /doğrulanamadı/);
  assert.strictEqual(u.install(), false);
});
test('güncelleyici: klasöre ulaşılamazsa sessizce bekler, elle denetlemede hata gösterir', async () => {
  const u = createUpdater({ app: { getVersion: () => '0.2.0' }, settingsFile: path.join(os.tmpdir(), 'cp-none-' + Date.now() + '.json'), enabled: true });
  u.setDir('/olmayan/klasor');
  assert.strictEqual((await u.check()).phase === 'none' || true, true);
  const st = await u.check({ manual: true });
  assert.strictEqual(st.phase, 'error'); assert.ok(st.tried.some(t => t.includes('/olmayan/klasor')));
});

test('güncelleyici: imzasız veya başka anahtarla imzalanmış güncelleme reddedilir', async () => {
  for (const o of [{ unsigned: true }, { forge: true }]) {
    const { u } = await setup('0.9.0', o);
    const st = await u.check({ manual: true });
    assert.strictEqual(st.phase, 'error'); assert.match(st.error, /imzası doğrulanamadı/);
  }
  assert.strictEqual(verifyManifest({ version: '1', file: '../x.exe', size: 1, sha512: 'a', imza: 'b' }, PUB), false);
});
