// Service Worker: кладёт игру в кеш, чтобы она работала без интернета.
//
// ВАЖНО: поменял любой файл — подними версию в CACHE_NAME. Иначе у игрока
// останется старая версия из кеша, и он будет уверять, что твоя правка не работает.

const CACHE_NAME = 'cat-maze-v9';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './vendor/phaser.min.js',

  './src/main.js',
  './src/config/assets.js',
  './src/config/cats.js',
  './src/config/dogs.js',
  './src/config/levels.js',
  './src/config/progress.js',
  './src/config/abilities.js',
  './src/scenes/BootScene.js',
  './src/scenes/MenuScene.js',
  './src/scenes/LevelSelectScene.js',
  './src/scenes/ShopScene.js',
  './src/scenes/GameScene.js',
  './src/scenes/UIScene.js',
  './src/systems/MazeGenerator.js',
  './src/systems/Pathfinder.js',
  './src/systems/Joystick.js',
  './src/entities/Cat.js',
  './src/entities/Dog.js',

  './assets/sprites/box.svg',
  './assets/sprites/exit.svg',
  './assets/sprites/coin.svg',
  './assets/sprites/bone.svg',
  './assets/sprites/shield.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/sfx/meow.mp3',
];

// Котики: 4 окраски x 3 позы. Собаки: 2 породы x (6 кадров бега + поза ожидания).
// Собираем списком, чтобы не перечислять три десятка строк руками.
// Добавил породу или скин — впиши сюда, иначе офлайн их не будет.
for (const id of ['ugolek', 'zefir', 'persik', 'dymok', 'bengal', 'cornish', 'mainecoon', 'kolli']) {
  for (const pose of ['walk', 'sit', 'sleep']) {
    ASSETS.push(`./assets/sprites/cat_${id}_${pose}.png`);
  }
}
for (const id of ['beagle', 'bull', 'bear_black', 'bear_brown', 'bear_white', 'pitbull', 'shepherd']) {
  for (let i = 0; i < 6; i++) ASSETS.push(`./assets/sprites/dog_${id}_run_${i}.png`);
  ASSETS.push(`./assets/sprites/dog_${id}_wait.png`);
}

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
