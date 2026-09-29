/* BAMBANG service worker v0.7.0
   Tugasnya kecil: menyimpan "kerangka" aplikasi supaya BAMBANG bisa dipasang di layar utama HP dan cepat terbuka.
   Data (catatan, antrean, status laptop) TIDAK disimpan di sini: selalu diambil langsung dari Supabase. */
const CACHE = 'bambang-shell-v0.7.0';
const SHELL = ['index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
const CDN = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('bambang-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* halaman utama: ambil yang terbaru dari internet (supaya versi baru langsung terpakai); kalau lambat/offline, pakai salinan terakhir */
async function halaman(req){
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([fetch(req), new Promise((_, no) => setTimeout(() => no(new Error('lambat')), 6000))]);
    if(res && res.ok && !res.redirected) cache.put('index.html', res.clone());
    return res;
  } catch(err){
    const hit = await cache.match('index.html');
    return hit || fetch(req);
  }
}

/* file pendukung (ikon, manifest, font, library): pakai salinan dulu, perbarui diam-diam di belakang */
async function pendukung(req){
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => { if(res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || Response.error();
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin === self.location.origin){
    e.respondWith(req.mode === 'navigate' ? halaman(req) : pendukung(req));
    return;
  }
  if(CDN.includes(url.hostname)) e.respondWith(pendukung(req));
  /* selain itu (Supabase, Instagram, Gemini, ntfy) tidak disentuh sama sekali */
});
