// Service Worker: кладёт игру в кеш, чтобы она работала без интернета.
//
// ВАЖНО: поменял любой файл — подними версию в CACHE_NAME. Иначе у игрока
// останется старая версия из кеша, и он будет уверять, что твоя правка не работает.

const CACHE_NAME = 'cat-maze-v4';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './vendor/phaser.min.js',

  './src/main.js',
  './src/config/assets.js',
  './src/config/cats.js',
  './src/config/levels.js',
  './src/scenes/BootScene.js',
  './src/scenes/MenuScene.js',
  './src/scenes/GameScene.js',
  './src/scenes/UIScene.js',
  './src/systems/MazeGenerator.js',
  './src/systems/Pathfinder.js',
  './src/systems/Joystick.js',
  './src/entities/Cat.js',
  './src/entities/Dog.js',

  './assets/sprites/box.svg',
  './assets/sprites/exit.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/sfx/meow.mp3',
];

// Котики: 4 окраски x 3 позы, и 6 кадров бега собаки + поза "сижу".
// Собираем списком, чтобы не перечислять 19 строк руками.
for (const id of ['ugolek', 'zefir', 'persik', 'dymok']) {
  for (const pose of ['walk', 'sit', 'sleep']) {
    ASSETS.push(`./assets/sprites/cat_${id}_${pose}.png`);
  }
}
for (let i = 0; i < 6; i++) ASSETS.push(`./assets/sprites/dog_run_${i}.png`);
ASSETS.push('./assets/sprites/dog_sit.png');

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // addAll падает целиком, если хоть один файл не нашёлся (например, звуки,
      // которых пока нет). Кладём по одному и переживаем пропажи.
      Promise.all(ASSETS.map((url) => cache.add(url).catch((err) => console.warn('SW: пропущен', url, err))))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  // Cache-first: игра статическая, свежесть не важна, скорость и офлайн — важны.
  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      return fetch(e.request)
        .then((res) => {
          // кешируем только успешные ответы со своего origin
          if (res.ok && new URL(e.request.url).origin === location.origin) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => {
          // Офлайн и в кеше нет. Подменять index.html можно ТОЛЬКО переход по
          // странице. Если отдавать его на любой запрос, то проверка «есть ли
          // такой файл» получит HTML со статусом 200 и решит, что файл есть —
          // игра поверит в несуществующий mp3 и подавится им при декодировании.
          if (e.request.mode === 'navigate') return caches.match('./index.html');
          return new Response('', { status: 504, statusText: 'Offline' });
        });
    })
  );
});
