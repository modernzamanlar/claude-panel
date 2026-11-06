// Güncelleme düğmesi: Mac'te de Windows'takiyle aynı düğme ve metin kullanılır (yeni düğme biçimi yok).
// Yalnız arayüz denetimi: durum elle verilir, sonra eski durum geri konur (gerçek akış test/q-updater-mac.test.js'de).
(async()=>{
  const b = document.querySelector('#btnUpd'), save = UPD;
  UPD = {phase:'ready', latest:'9.9.9', notes:'', current:'0.2.8'}; paintUpd();
  const ready = !b.hidden && b.classList.contains('ready') && b.textContent.includes('Sürüm 9.9.9 hazır · Yeniden başlat');
  UPD = {phase:'downloading', latest:'9.9.9', progress:42}; paintUpd();
  const dl = !b.hidden && b.textContent.includes('%42');
  UPD = {phase:'error', error:'Güncelleme otomatik kurulamadı: x', guide:'y'}; paintUpd();
  const hiddenOnError = b.hidden;
  UPD = save; paintUpd();
  return {name: 'güncelleme düğmesi (Mac ve Windows aynı)', ok: ready && dl && hiddenOnError, ready, dl, hiddenOnError};
})()
