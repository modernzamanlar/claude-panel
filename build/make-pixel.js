// 8-bit köpek: uygulama simgesinin karesi küçük bir piksel ızgarasına indirilir ve renkleri azaltılır.
// npx electron build/make-pixel.js → src/renderer/img/dog8.png (32×32, arayüzde image-rendering:pixelated ile büyütülür)
const { app, BrowserWindow } = require('electron');
const fs = require('fs'); const path = require('path');
const SRC = path.join(__dirname, 'icon.png');
const OUT = path.join(__dirname, '..', 'src', 'renderer', 'img', 'dog8.png');
const page = `<html><body><script>
async function make(src, N){
  const img = new Image(); img.src = src; await img.decode();
  const c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d');
  x.imageSmoothingQuality = 'high';
  // simgede kare 1024 içinde 100..924; köşeleri yuvarlak kalsın diye biraz içeriden alınır
  x.drawImage(img, 200, 170, 624, 624, 0, 0, N, N);
  const d = x.getImageData(0, 0, N, N), p = d.data;
  const q = v => Math.min(255, Math.round(v / 51) * 51); // kanal başına 6 düzey (8-bit görünüm)
  for (let i = 0; i < p.length; i += 4) { p[i] = q(p[i]); p[i+1] = q(p[i+1]); p[i+2] = q(p[i+2]); p[i+3] = p[i+3] < 128 ? 0 : 255; }
  // köşeler: 1 piksellik yuvarlama
  for (const [cx, cy] of [[0,0],[N-1,0],[0,N-1],[N-1,N-1]]) p[(cy*N+cx)*4+3] = 0;
  x.putImageData(d, 0, 0);
  return c.toDataURL('image/png');
}
</script></body></html>`;
app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await w.loadURL('data:text/html,' + encodeURIComponent(page));
  const r = await w.webContents.executeJavaScript(`make(${JSON.stringify('data:image/png;base64,' + fs.readFileSync(SRC).toString('base64'))}, 32)`);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(r.split(',')[1], 'base64'));
  console.log('→', OUT);
  app.exit(0);
});
