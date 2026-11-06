// src/main/rewind.js: ek klasör / worktree adı doğrulama, worktree denetimi, rewind_files isteği ve yanıtı (saf mantık).
const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const RW = require('../src/main/rewind');

const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cp-qrwm-')));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
let n = 0;
const dir = () => { const d = path.join(TMP, 'd' + n++); fs.mkdirSync(d); return d; };
const MID = 'a1b2c3d4-0000-4000-8000-000000000001';

test('checkAddDirs: null/undefined boş liste; gerçek yol, tekrar ve çalışma klasörü atılır', () => {
  assert.deepEqual(RW.checkAddDirs(null, TMP), []);
  assert.deepEqual(RW.checkAddDirs(undefined, TMP), []);
  const cwd = dir(), a = dir();
  assert.deepEqual(RW.checkAddDirs([a, a, cwd, a + path.sep], cwd), [a]);
  assert.deepEqual(RW.checkAddDirs([cwd], path.join(TMP, 'yok')), [cwd], 'çalışma klasörü çözülemezse karşılaştırılmaz');
  assert.equal(RW.MAX_DIRS, 20);
  assert.equal(RW.checkAddDirs(Array(20).fill(a), cwd).length, 1);
});

test('checkAddDirs: "~" ev klasörüne genişler', () => {
  const home = os.homedir();
  assert.deepEqual(RW.checkAddDirs(['~'], TMP), [fs.realpathSync(home)]);
});

test('checkAddDirs: hatalar', () => {
  const cwd = dir(), f = path.join(cwd, 'f.txt'); fs.writeFileSync(f, '');
  const cases = [[{}, /listesi/], ['a', /listesi/], [Array(21).fill(cwd), /listesi/], [[null], /: Geçersiz ek klasör$/], [[''], /: Geçersiz ek klasör$/],
    [['a\0b'], /: Geçersiz ek klasör$/], [['a\rb'], /: Geçersiz ek klasör$/], [['göreli'], /mutlak yol olmalı: göreli/],
    [[path.join(cwd, 'yok')], /bulunamadı/], [[f], /bir klasör değil/]];
  for (const [v, rx] of cases) assert.throws(() => RW.checkAddDirs(v, cwd), rx, JSON.stringify(v));
});

test('worktree adı: kurallar', () => {
  for (const ok of ['a', 'deneme-1', 'A.b_c', 'x'.repeat(64)]) { assert.equal(RW.validWorktreeName(ok), true, ok); assert.equal(RW.checkWorktreeName(ok), ok); }
  for (const bad of ['', 'x'.repeat(65), 'a/b', 'a b', '-a', '.a', 'a..b', 'a.lock', 'A.LOCK', 'ş', null, 5, undefined]) {
    assert.equal(RW.validWorktreeName(bad), false, String(bad));
    assert.throws(() => RW.checkWorktreeName(bad), /Geçersiz worktree adı/);
  }
});

const gitWith = map => { const seen = []; return { seen, git: async a => { seen.push(a); return map(a); } }; };
test('worktreeInfo: git yok, depo değil, yalnız depo bilgisi, geçersiz ad, klasör ya da dal var, uygun', async () => {
  let g = gitWith(() => ({ ok: false, enoent: true }));
  assert.deepEqual(await RW.worktreeInfo(g.git, 'a'), { ok: false, repo: false, error: 'Git bulunamadı: worktree için bilgisayarda Git kurulu olmalı' });
  g = gitWith(() => ({ ok: false }));
  assert.deepEqual(await RW.worktreeInfo(g.git), { ok: false, repo: false, error: 'Bu klasör bir git deposu değil' });
  const root = dir();
  g = gitWith(a => a[0] === 'rev-parse' ? { ok: true, out: root + '\n' } : { ok: false });
  assert.deepEqual(await RW.worktreeInfo(g.git), { ok: true, repo: true, root });
  assert.deepEqual(await RW.worktreeInfo(g.git, ''), { ok: true, repo: true, root });
  assert.equal(g.seen.length, 2, 'ad yoksa yalnız rev-parse');
  assert.match((await RW.worktreeInfo(g.git, 'a/b')).error, /Geçersiz ad/);
  const ok = await RW.worktreeInfo(g.git, 'yeni');
  assert.deepEqual(ok, { ok: true, repo: true, root, dir: path.join(root, '.claude', 'worktrees', 'yeni'), branch: 'worktree-yeni' });
  assert.deepEqual(g.seen[g.seen.length - 1], ['show-ref', '--verify', '--quiet', 'refs/heads/worktree-yeni']);
  fs.mkdirSync(path.join(root, '.claude', 'worktrees', 'var'), { recursive: true });
  const ex = await RW.worktreeInfo(g.git, 'var');
  assert.equal(ex.ok, false); assert.match(ex.error, /Bu adla bir worktree zaten var/);
  g = gitWith(() => ({ ok: true, out: root }));
  const br = await RW.worktreeInfo(g.git, 'dal');
  assert.deepEqual(br, { ok: false, repo: true, root, error: '"worktree-dal" dalı zaten var; başka bir ad seç' });
});

test('rewindRequest: dry_run yalnız istenince; geçersiz kimlik reddedilir', () => {
  assert.deepEqual(RW.rewindRequest('r1', MID, true), { type: 'control_request', request_id: 'r1', request: { subtype: 'rewind_files', user_message_id: MID, dry_run: true } });
  assert.deepEqual(RW.rewindRequest('r1', MID, false).request, { subtype: 'rewind_files', user_message_id: MID });
  for (const bad of ['x', MID + 'x', null, 5]) assert.throws(() => RW.rewindRequest('r', bad), /Geçersiz mesaj kimliği/);
});

test('rewindError: bilinen CLI hataları Türkçe; diğerleri kısaltılarak eklenir', () => {
  assert.match(RW.rewindError('File rewinding is not enabled.'), /kapalı/);
  assert.match(RW.rewindError('No file checkpoint found for this message.'), /dosya kaydı yok/);
  assert.equal(RW.rewindError('Failed to rewind: EPERM'), 'Kod geri sarılamadı: Failed to rewind: EPERM');
  assert.equal(RW.rewindError(''), 'Kod geri sarılamadı');
  assert.equal(RW.rewindError(null), 'Kod geri sarılamadı');
  assert.equal(RW.rewindError('x'.repeat(400)).length, 'Kod geri sarılamadı: '.length + 300);
});

test('rewindResult: başarı, kayıt yok, hata yanıtı, bozuk yanıt', () => {
  assert.deepEqual(RW.rewindResult({ subtype: 'success', response: { canRewind: true, filesChanged: ['/a', '', 5, '/b'], insertions: 3, deletions: 2 } }),
    { canRewind: true, files: ['/a', '/b'], insertions: 3, deletions: 2, error: null });
  assert.deepEqual(RW.rewindResult({ subtype: 'success', response: { canRewind: true, skippedLinks: 0 } }), { canRewind: true, files: [], insertions: 0, deletions: 0, error: null });
  const none = RW.rewindResult({ subtype: 'success', response: { canRewind: false, error: 'No file checkpoint found for this message.' } });
  assert.equal(none.canRewind, false); assert.match(none.error, /dosya kaydı yok/);
  assert.deepEqual(RW.rewindResult({ subtype: 'success', response: { canRewind: 'evet', insertions: -1, deletions: 1.5 } }), { canRewind: false, files: [], insertions: 0, deletions: 0, error: 'Kod geri sarılamadı' });
  assert.deepEqual(RW.rewindResult({ subtype: 'success', response: null }), { canRewind: false, files: [], insertions: 0, deletions: 0, error: 'Kod geri sarılamadı' });
  assert.deepEqual(RW.rewindResult({ subtype: 'error', error: 'Failed to rewind: x' }), { canRewind: false, files: [], insertions: 0, deletions: 0, error: 'Kod geri sarılamadı: Failed to rewind: x' });
  assert.deepEqual(RW.rewindResult(null), { canRewind: false, files: [], insertions: 0, deletions: 0, error: 'Kod geri sarılamadı' });
  assert.deepEqual(RW.rewindResult('x'), RW.rewindResult(null));
  assert.equal(RW.CHECKPOINT_ENV, 'CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING');
});
