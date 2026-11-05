// Uygulama simgesini build/icon-kaynak.png'den üretir: npm run icon → build/icon.png (1024) → iconutil ile icon.icns
// Kaynak görsel siyah zemin üzerinde yuvarlak köşeli bir kare; kare bulunur, kenarı biraz içeriden kırpılır,
// macOS ölçüsünde (1024 içinde 824, köşe 185) yuvarlatılıp hafif gölgeyle şeffaf zemine yerleştirilir.
const { app, BrowserWindow } = require('electron');
const fs = require('fs'); const path = require('path');

const SRC = path.join(__dirname, 'icon-kaynak.png');
const OUT = path.join(__dirname, 'icon.png');

const page = `<html><body style="margin:0;background:transparent"><script>
async function make(src) {
  const img = new Image(); img.src = src; await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight;
  const c0 = document.createElement('canvas'); c0.width = W; c0.height = H;
  const x0 = c0.getContext('2d'); x0.drawImage(img, 0, 0);
  const d = x0.getImageData(0, 0, W, H).data;
  const lit = (x, y) => { const i = (y * W + x) * 4; return d[i] + d[i + 1] + d[i + 2] > 120; };
  // Ortadaki satır ve sütunda siyah zeminin bittiği yerler = karenin sınırları
  const my = H >> 1, mx = W >> 1;
  let L = 0; while (L < W && !lit(L, my)) L++;
  let R = W - 1; while (R > 0 && !lit(R, my)) R--;
  let T = 0; while (T < H && !lit(mx, T)) T++;
  let B = H - 1; while (B > 0 && !lit(mx, B)) B--;
  const inset = Math.round((R - L) * 0.02); // parlak kenar çizgisini at
  const side = Math.min(R - L, B - T) - 2 * inset; // kare kırp, görüntü esnemesin
  const sx = Math.round((L + R - side) / 2), sy = Math.round((T + B - side) / 2), sw = side, sh = side;

  const N = 1024, X = 100, S = 824, RAD = 185;
  const c = document.createElement('canvas'); c.width = N; c.height = N;
  const x = c.getContext('2d');
  const rr = () => { x.beginPath(); x.roundRect(X, X, S, S, RAD); };
  x.save(); x.shadowColor = 'rgba(0,0,0,.28)'; x.shadowBlur = 36; x.shadowOffsetY = 14;
  rr(); x.fillStyle = '#e8b98a'; x.fill(); x.restore();
  x.save(); rr(); x.clip();
  x.imageSmoothingQuality = 'high';
  x.drawImage(img, sx, sy, sw, sh, X, X, S, S);
  x.restore();
  return { bounds: [L, T, R, B], png: c.toDataURL('image/png') };
}
</script></body></html>`;

app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await w.loadURL('data:text/html,' + encodeURIComponent(page));
  const src = 'data:image/png;base64,' + fs.readFileSync(SRC).toString('base64');
  const r = await w.webContents.executeJavaScript(`make(${JSON.stringify(src)})`);
  fs.writeFileSync(OUT, Buffer.from(r.png.split(',')[1], 'base64'));
  console.log('kare sınırları', r.bounds.join(','), '→', OUT);
  app.exit(0);
});
