Ek UI test adımları. Her `.js` dosyası bir ya da daha fazla adım içerir (`//--` ile ayrılır). Adım bir async IIFE'dir ve
`{name: 'kontrol adı', ok: true|false, ...ayrıntılar}` döndürür. `run.js` bunları steps.js adımlarından sonra koşar ve
her birini ayrı bir kontrol olarak sayar. Adım, değiştirdiği arayüz durumunu geri almalı (bölmeler, S.layout, menüler).
Yardımcılar steps.js'in ilk adımında tanımlı: `W(ms)` bekleme.
