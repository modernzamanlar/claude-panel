// Ekran kontrolü — işletim sistemi girdisi (fare/klavye).
// Windows: bir kez başlatılıp açık tutulan PowerShell + Add-Type C# yardımcısı (SendInput, Per-Monitor-V2 DPI).
//   Her komutta yeni süreç açılmaz; stdin'e "<no> <komut> <tam sayılar…>" satırı yazılır, stdout'tan "<no> ok …" / "<no> err …" okunur.
//   Yalnız tam sayı ve onaltılık kod birimi gider: kullanıcı/model metni hiçbir zaman komut olarak yorumlanmaz.
// Mac: henüz yok (açık hata). Claude Code CLI'nin kendi computer-use aracı macOS'ta var; panel orada onu kullanmaz.
'use strict';
const childProcess = require('child_process');

const CS = String.raw`
using System; using System.Runtime.InteropServices; using System.Threading; using System.Text;
public static class CPI {
  [StructLayout(LayoutKind.Sequential)] public struct MI { public int dx, dy, data; public uint flags, time; public IntPtr extra; }
  [StructLayout(LayoutKind.Sequential)] public struct KI { public ushort vk, scan; public uint flags, time; public IntPtr extra; }
  [StructLayout(LayoutKind.Explicit)] public struct U { [FieldOffset(0)] public MI mi; [FieldOffset(0)] public KI ki; }
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public U u; }
  [StructLayout(LayoutKind.Sequential)] public struct PT { public int X, Y; }
  [DllImport("user32.dll", SetLastError=true)] static extern uint SendInput(uint n, INPUT[] i, int size);
  [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] static extern bool GetCursorPos(out PT p);
  [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(PT p);
  [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h, uint f);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern int GetSystemMetrics(int i);
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int vk);
  [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr c);
  [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr c);
  static void Send(INPUT[] a) { SendInput((uint)a.Length, a, Marshal.SizeOf(typeof(INPUT))); }
  static INPUT M(uint f, int data) { var i = new INPUT(); i.type = 0; i.u.mi.flags = f; i.u.mi.data = data; return i; }
  static INPUT K(ushort vk, ushort scan, uint f) { var i = new INPUT(); i.type = 1; i.u.ki.vk = vk; i.u.ki.scan = scan; i.u.ki.flags = f; return i; }
  static bool Ext(int vk) { return (vk >= 0x21 && vk <= 0x28) || vk == 0x2D || vk == 0x2E || vk == 0x5B || vk == 0x5C || vk == 0x5D || vk == 0x2C; }
  public static void Init() { var c = new IntPtr(-4); if (!SetProcessDpiAwarenessContext(c)) SetThreadDpiAwarenessContext(c); }
  static void MoveTo(int x, int y) {
    int vx = GetSystemMetrics(76), vy = GetSystemMetrics(77), vw = Math.Max(2, GetSystemMetrics(78)), vh = Math.Max(2, GetSystemMetrics(79));
    var i = M(0x0001 | 0x8000 | 0x4000, 0);
    i.u.mi.dx = (int)(((long)(x - vx) * 65535) / (vw - 1)); i.u.mi.dy = (int)(((long)(y - vy) * 65535) / (vh - 1));
    Send(new[] { i }); SetCursorPos(x, y);
  }
  static void Btn(int b, bool down) { uint f = b == 2 ? (down ? 0x0008u : 0x0010u) : b == 3 ? (down ? 0x0020u : 0x0040u) : (down ? 0x0002u : 0x0004u); Send(new[] { M(f, 0) }); }
  static void Key(int vk, bool down) { uint f = (Ext(vk) ? 1u : 0u) | (down ? 0u : 2u); Send(new[] { K((ushort)vk, 0, f) }); }
  static string Win(IntPtr h) { uint pid; GetWindowThreadProcessId(h, out pid); return h.ToInt64() + " " + pid; }
  public static string Handle(string line) {
    var p = line.Trim().Split(' '); string id = p[0];
    try {
      string c = p.Length > 1 ? p[1] : "";
      Func<int, int> I = k => int.Parse(p[k]);
      if (c == "ping") return id + " ok";
      if (c == "pos") { PT q; GetCursorPos(out q); return id + " ok " + q.X + " " + q.Y; }
      if (c == "move") { MoveTo(I(2), I(3)); return id + " ok"; }
      if (c == "click") { MoveTo(I(2), I(3)); Thread.Sleep(30); for (int n = 0; n < I(5); n++) { Btn(I(4), true); Thread.Sleep(25); Btn(I(4), false); Thread.Sleep(60); } return id + " ok"; }
      if (c == "drag") {
        int x = I(2), y = I(3), x2 = I(4), y2 = I(5), st = Math.Max(2, I(6));
        MoveTo(x, y); Thread.Sleep(40); Btn(1, true); Thread.Sleep(60);
        for (int s = 1; s <= st; s++) { MoveTo(x + (x2 - x) * s / st, y + (y2 - y) * s / st); Thread.Sleep(12); }
        Thread.Sleep(60); Btn(1, false); return id + " ok";
      }
      if (c == "wheel") { MoveTo(I(2), I(3)); Thread.Sleep(30); bool h = I(5) == 1; Send(new[] { M(h ? 0x1000u : 0x0800u, h ? I(4) * 120 : -I(4) * 120) }); return id + " ok"; }
      if (c == "keys") { int n = p.Length - 2; for (int k = 0; k < n; k++) { Key(I(2 + k), true); Thread.Sleep(15); } for (int k = n - 1; k >= 0; k--) { Key(I(2 + k), false); Thread.Sleep(10); } return id + " ok"; }
      if (c == "text") {
        for (int k = 2; k < p.Length; k++) {
          int u = Convert.ToInt32(p[k], 16);
          if (u == 0x0D) continue;
          if (u == 0x0A) { Key(0x0D, true); Key(0x0D, false); }
          else if (u == 0x09) { Key(0x09, true); Key(0x09, false); }
          else Send(new[] { K(0, (ushort)u, 0x0004), K(0, (ushort)u, 0x0004 | 0x0002) });
          Thread.Sleep(4);
        }
        return id + " ok";
      }
      if (c == "hit") { var q = new PT(); q.X = I(2); q.Y = I(3); var h = WindowFromPoint(q); return id + " ok " + Win(h == IntPtr.Zero ? h : GetAncestor(h, 2)); }
      if (c == "fg") return id + " ok " + Win(GetForegroundWindow());
      if (c == "reset") {
        foreach (int vk in new[] { 0x10, 0x11, 0x12, 0x5B, 0x5C, 0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5 }) if ((GetAsyncKeyState(vk) & 0x8000) != 0) Key(vk, false);
        if ((GetAsyncKeyState(1) & 0x8000) != 0) Btn(1, false); if ((GetAsyncKeyState(2) & 0x8000) != 0) Btn(2, false); if ((GetAsyncKeyState(4) & 0x8000) != 0) Btn(3, false);
        return id + " ok";
      }
      return id + " err bilinmeyen komut";
    } catch (Exception e) { return id + " err " + e.Message.Replace('\r', ' ').Replace('\n', ' '); }
  }
}`;
const PS = `$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
${CS}
'@
[CPI]::Init()
[Console]::Out.WriteLine('hazir'); [Console]::Out.Flush()
while ($true) { $l = [Console]::In.ReadLine(); if ($l -eq $null) { break }; [Console]::Out.WriteLine([CPI]::Handle($l)); [Console]::Out.Flush() }`;

const encoded = () => Buffer.from(PS, 'utf16le').toString('base64');

/**
 * Girdi yardımcısı. deps.spawn testte değiştirilir. Komutlar sırayla çalışır; cancel() bekleyenleri iptal eder ve
 * basılı kalmış olabilecek tuş/düğmeleri bırakır (reset).
 */
function createInput({ platform = process.platform, spawn = childProcess.spawn, timeoutMs = 15000 } = {}) {
  let proc = null, ready = null, buf = '', seq = 0, gen = 0;
  const waiting = new Map(); // no -> {resolve, reject, timer}
  const failAll = msg => { for (const [, w] of waiting) { clearTimeout(w.timer); w.reject(new Error(msg)); } waiting.clear(); };
  function start() {
    if (platform !== 'win32') return Promise.reject(new Error('Ekranda fare/klavye denetimi şimdilik yalnız Windows\'ta var (macOS: Claude Code\'un kendi computer-use aracı)'));
    if (ready) return ready;
    ready = new Promise((resolve, reject) => {
      const p = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded()], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      proc = p; let err = '', ok = false;
      p.stdout.setEncoding('utf8');
      p.stdout.on('data', d => {
        buf += d; let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!ok) { if (line === 'hazir') { ok = true; resolve(); } continue; }
          const m = /^(\d+) (ok|err) ?(.*)$/.exec(line); if (!m) continue;
          const w = waiting.get(+m[1]); if (!w) continue;
          waiting.delete(+m[1]); clearTimeout(w.timer);
          if (m[2] === 'ok') w.resolve(m[3] ? m[3].split(' ') : []); else w.reject(new Error('Girdi hatası: ' + m[3]));
        }
      });
      p.stderr.setEncoding('utf8'); p.stderr.on('data', d => { err = (err + d).slice(-800); });
      p.stdin.on('error', () => {});
      const dead = msg => { if (proc === p) { proc = null; ready = null; buf = ''; } failAll(msg); if (!ok) reject(new Error(msg)); };
      p.on('error', e => dead('Girdi yardımcısı başlatılamadı: ' + e.message));
      p.on('exit', code => dead('Girdi yardımcısı kapandı (' + code + ') ' + err.trim().slice(-300)));
    });
    return ready;
  }
  async function send(cmd, ...args) {
    if (!args.every(a => typeof a === 'string' ? /^[0-9a-f]+$/.test(a) : Number.isInteger(a))) throw new Error('Geçersiz girdi argümanı');
    const g = gen;
    await start();
    if (g !== gen) throw new Error('Ekran kontrolü durduruldu');
    const no = ++seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { waiting.delete(no); reject(new Error('Girdi yardımcısı yanıt vermedi')); }, timeoutMs);
      waiting.set(no, { resolve, reject, timer });
      proc.stdin.write(`${no} ${cmd}${args.length ? ' ' + args.join(' ') : ''}\n`);
    });
  }
  /** Acil durdurma: bekleyen komutlar iptal, basılı tuşlar bırakılır. */
  function cancel() {
    gen++;
    failAll('Ekran kontrolü durduruldu');
    if (proc) proc.stdin.write(`${++seq} reset\n`);
  }
  function close() { gen++; failAll('Girdi yardımcısı kapatıldı'); if (proc) { try { proc.stdin.end(); proc.kill(); } catch {} } proc = null; ready = null; }
  return { send, cancel, close, get running() { return !!proc; } };
}

module.exports = { createInput, _test: { PS, CS } };
