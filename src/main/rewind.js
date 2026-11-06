// Geri sarma (sohbet + kod) ve ek klasör / worktree için ana süreç tarafındaki saf mantık.
// Gerçek CLI ile doğrulandı (claude 2.1.318):
//  - Kod geri sarma: stream-json kontrol isteği {subtype:'rewind_files', user_message_id, dry_run?}. Yalnız CLI süreci
//    CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING ile başlatılmışsa çalışır; yoksa "File rewinding is not enabled." döner.
//    Kayıtlar (~/.claude/file-history/<oturum>) değişikliği yapan süreçte de bu değişken açıksa tutulur.
//    Yeni bir `--resume <id>` sürecinde kullanıcı mesajı göndermeden istenebilir (model çağrısı yok).
//  - Ek klasör: `--add-dir <klasör>`; worktree: `--worktree <ad>` (-p ile çalışır; <depo>/.claude/worktrees/<ad>, dal worktree-<ad>).
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHECKPOINT_ENV = 'CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DIRS = 20;
const expand = p => (/^~(?=$|[\\/])/.test(p) ? path.join(os.homedir(), p.slice(1)) : p);

/** Ek klasörler: her biri var olan bir klasör, mutlak yol; gerçek yola (realpath) çevrilir, tekrarlar ve çalışma klasörü atılır. */
function checkAddDirs(list, cwd) {
  if (list == null) return [];
  if (!Array.isArray(list) || list.length > MAX_DIRS) throw new Error('Geçersiz ek klasör listesi');
  let base = null; try { base = fs.realpathSync(cwd); } catch {}
  const out = [];
  for (const raw of list) {
    if (typeof raw !== 'string' || !raw || /[\0\r\n]/.test(raw)) throw new Error('Geçersiz ek klasör');
    const p = expand(raw);
    if (!path.isAbsolute(p)) throw new Error('Ek klasör mutlak yol olmalı: ' + raw);
    let real; try { real = fs.realpathSync(p); } catch { throw new Error('Ek klasör bulunamadı: ' + raw); }
    if (!fs.statSync(real).isDirectory()) throw new Error('Ek klasör bir klasör değil: ' + raw);
    if (real !== base && !out.includes(real)) out.push(real);
  }
  return out;
}

// Worktree adı: CLI harf, rakam, nokta, alt çizgi ve tire kabul ediyor; panel ayrıca "/" (alt klasör), baştaki nokta/tire
// (seçenek sanılmasın), ".." ve ".lock" (git dal adı kuralları) içeren adları reddeder.
const WT_RX = /^[A-Za-z0-9._-]{1,64}$/;
function validWorktreeName(n) { return typeof n === 'string' && WT_RX.test(n) && !/^[.-]/.test(n) && !n.includes('..') && !/\.lock$/i.test(n); }
function checkWorktreeName(n) {
  if (!validWorktreeName(n)) throw new Error('Geçersiz worktree adı: yalnız harf, rakam, nokta, alt çizgi ve tire (en çok 64 karakter)');
  return n;
}

/**
 * Yeni sohbet diyaloğu için: klasör bir git deposu mu, verilen adla worktree açılabilir mi?
 * git(args) → Promise<{ok, out, enoent}> (execFile ile `git -C <klasör> …`, kabuk yok).
 */
async function worktreeInfo(git, name) {
  const top = await git(['rev-parse', '--show-toplevel']);
  if (top.enoent) return { ok: false, repo: false, error: 'Git bulunamadı: worktree için bilgisayarda Git kurulu olmalı' };
  if (!top.ok) return { ok: false, repo: false, error: 'Bu klasör bir git deposu değil' };
  const root = path.normalize(String(top.out).trim());
  if (name == null || name === '') return { ok: true, repo: true, root };
  if (!validWorktreeName(name)) return { ok: false, repo: true, root, error: 'Geçersiz ad: yalnız harf, rakam, nokta, alt çizgi ve tire' };
  const dir = path.join(root, '.claude', 'worktrees', name), branch = 'worktree-' + name;
  if (fs.existsSync(dir)) return { ok: false, repo: true, root, error: 'Bu adla bir worktree zaten var: ' + dir };
  const br = await git(['show-ref', '--verify', '--quiet', 'refs/heads/' + branch]);
  if (br.ok) return { ok: false, repo: true, root, error: `"${branch}" dalı zaten var; başka bir ad seç` };
  return { ok: true, repo: true, root, dir, branch };
}

/** `rewind_files` kontrol isteği (stdin'e yazılacak satır nesnesi). */
function rewindRequest(requestId, userMessageId, dryRun) {
  if (typeof userMessageId !== 'string' || !UUID.test(userMessageId)) throw new Error('Geçersiz mesaj kimliği');
  return { type: 'control_request', request_id: requestId, request: { subtype: 'rewind_files', user_message_id: userMessageId, ...(dryRun ? { dry_run: true } : {}) } };
}
// CLI'nin İngilizce hata metinleri → kullanıcıya anlaşılır Türkçe
function rewindError(e) {
  const s = String(e || '').trim();
  if (/not enabled/i.test(s)) return 'Dosya kaydı (checkpoint) kapalı olduğu için kod geri sarılamıyor';
  if (/no file checkpoint/i.test(s)) return 'Bu mesaj için dosya kaydı yok. Kayıt yalnız panelin bu sürümünden sonra panelden gönderilen mesajlarda tutulur';
  return 'Kod geri sarılamadı' + (s ? ': ' + s.slice(0, 300) : '');
}
const num = v => (Number.isInteger(v) && v >= 0 ? v : 0);
/** control_response.response → {canRewind, files, insertions, deletions, error} */
function rewindResult(resp) {
  if (!resp || typeof resp !== 'object') return { canRewind: false, files: [], insertions: 0, deletions: 0, error: rewindError('') };
  if (resp.subtype !== 'success') return { canRewind: false, files: [], insertions: 0, deletions: 0, error: rewindError(resp.error) };
  const r = resp.response && typeof resp.response === 'object' ? resp.response : {};
  const files = Array.isArray(r.filesChanged) ? r.filesChanged.filter(f => typeof f === 'string' && f) : [];
  return { canRewind: r.canRewind === true, files, insertions: num(r.insertions), deletions: num(r.deletions), error: r.error ? rewindError(r.error) : (r.canRewind === true ? null : rewindError('')) };
}

module.exports = { CHECKPOINT_ENV, MAX_DIRS, checkAddDirs, validWorktreeName, checkWorktreeName, worktreeInfo, rewindRequest, rewindError, rewindResult };
