// offline-first: precache the shell + plates/masks, cache-first for everything same-origin after.
const V = 'myologia-v2'; // bump when a precached file changes under the same name (icons, plates, masks)
const CORE = [
  './', './index.html', './manifest.webmanifest',
  './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png',
  './plates/pl1-anterior.jpg', './plates/pl2-posterior.jpg', './plates/pl3-legs.jpg', './plates/pl4-lateral.jpg',
  ...['pl1-pec','pl1-delt','pl1-tri','pl1-abs','pl1-obl','pl2-trap','pl2-lat','pl2-rdelt',
      'pl3-quad','pl3-ham','pl3-glute','pl3-calf','pl4-sdelt','pl4-bic'].map((m) => `./masks/${m}.png`),
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // navigations: network first so new builds land, fall back to cached shell
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(V).then((c) => c.put('./index.html', copy)); return res; })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  // hashed assets, fonts, plates: cache first
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(V).then((c) => c.put(req, copy)); }
      return res;
    })),
  );
});
