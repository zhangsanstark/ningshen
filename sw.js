// 离线缓存：网络优先，失败时用缓存（保证更新后能及时生效）
// 新增文件时要加进 ASSETS，并把 CACHE 版本号加一
const CACHE = 'ningshen-v6';
const ASSETS = [
  './', 'index.html', 'style.css', 'manifest.webmanifest', 'icon.svg',
  'js/main.js', 'js/ui.js', 'js/art.js', 'js/figures.js', 'js/store.js', 'js/focus.js',
  'js/games/common.js', 'js/games/schulte.js', 'js/games/stroop.js', 'js/games/sart.js',
  'js/games/nback.js', 'js/games/mot.js', 'js/games/arith.js', 'js/games/breath.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  const req = e.request.mode === 'navigate' ? e.request : new Request(e.request.url, { cache: 'no-cache' });
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))),
  );
});
