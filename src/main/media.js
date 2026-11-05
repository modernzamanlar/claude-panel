// Sohbetin çalışma klasöründeki son görsel ve videolar (bilgi panelindeki "Son medya" önizlemesi).
// Klasör sınırlı derinlikte ve sınırlı sayıda girdiyle taranır; gizli klasörler ve bağımlılık/önbellek klasörleri atlanır.
const fsp = require('fs').promises;
const path = require('path');
const os = require('os');

const IMG = /\.(png|jpe?g|gif|webp)$/i;
const VID = /\.(mp4|m4v|mov|webm|mkv)$/i;
const SKIP = /^(node_modules|__pycache__|vendor|dist|Library|AppData|\$RECYCLE\.BIN|System Volume Information)$/i;

const expand = p => (p === '~' || /^~[\\/]/.test(p)) ? path.join(os.homedir(), p.slice(1)) : p;

async function recentMedia(dir, { max = 24, depth = 2, limit = 4000 } = {}) {
  if (typeof dir !== 'string' || !dir) return [];
  const root = expand(dir);
  if (!path.isAbsolute(root)) return [];
  try { if (!(await fsp.stat(root)).isDirectory()) return []; } catch { return []; }
  const found = [];
  let seen = 0;
  let level = [root];
  for (let d = 0; d <= depth && level.length; d++) {
    const next = [];
    for (const cur of level) {
      let ents;
      try { ents = await fsp.readdir(cur, { withFileTypes: true }); } catch { continue; }
      for (const e of ents) {
        if (++seen > limit) break;
        if (e.name.startsWith('.')) continue;
        const p = path.join(cur, e.name);
        if (e.isDirectory()) { if (!SKIP.test(e.name)) next.push(p); continue; }
        if (!e.isFile()) continue;
        const kind = IMG.test(e.name) ? 'image' : VID.test(e.name) ? 'video' : null;
        if (!kind) continue;
        try { const st = await fsp.stat(p); found.push({ path: p, name: e.name, kind, mtimeMs: st.mtimeMs, size: st.size }); } catch {}
      }
      if (seen > limit) break;
    }
    if (seen > limit) break;
    level = next;
  }
  return found.sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, max);
}

// Görev çubuğu sayacı simgesi yalnızca küçük bir PNG veri adresi olabilir
const okBadgeIcon = s => typeof s === 'string' && s.length < 40000 && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s);

// Sesli yazma: Windows'ta işletim sisteminin sesle yazma özelliği (Win+H) açılır, yazı odaktaki kutuya düşer.
// PowerShell, user32 keybd_event ile Win+H tuşlarına basar. macOS'ta dikte kullanıcı kısayoluyla (Fn/🌐 iki kez) açılır.
function dictateCommand(platform) {
  if (platform !== 'win32') return null;
  const ps = "Add-Type -Name K -Namespace W -MemberDefinition '[DllImport(\"user32.dll\")] public static extern void keybd_event(byte b, byte s, uint f, System.UIntPtr e);';" +
    '[W.K]::keybd_event(0x5B,0,0,[UIntPtr]::Zero);[W.K]::keybd_event(0x48,0,0,[UIntPtr]::Zero);[W.K]::keybd_event(0x48,0,2,[UIntPtr]::Zero);[W.K]::keybd_event(0x5B,0,2,[UIntPtr]::Zero)';
  // -EncodedCommand (UTF-16LE base64): komut satırı tırnaklama sorunu olmaz
  return { cmd: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(ps, 'utf16le').toString('base64')], script: ps };
}

module.exports = { recentMedia, okBadgeIcon, dictateCommand, IMG, VID };
