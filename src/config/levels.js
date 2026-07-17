// Настройки 8 уровней. Крутить баланс — здесь.
//
// cols/rows   — размер сетки В ЯЧЕЙКАХ (реальная карта в тайлах: 2*n+1).
//               Держим ≤19 ячеек (39 тайлов): BFS и камера проверены до 35×35.
// braid       — доля тупиков, которые пробиваются в петли (0 = чистый лабиринт,
//               больше = больше путей обхода, легче убегать от собак)
// dogs        — сколько собак живёт на уровне одновременно (ТЗ: 0,0,1,1,2,2,3,3)
// dogSpeed    — скорость собаки ДОЛЕЙ от скорости бегущего котика.
//               Растёт от уровня к уровню: сначала от собаки легко убежать,
//               к финалу она почти догоняет. Держать строго < 1, иначе
//               убежать невозможно в принципе и остаётся только коробка.
// coins       — сколько монет разбросано по карте (кроме +5 за прохождение)
// safeZones   — сколько коробок-укрытий разбросано по карте
// spawnDelay  — через сколько мс после старта появляется первая собака
// respawnGap  — пауза между исчезновением собаки и появлением следующей

export const DOG_LIFETIME = 15000; // 15 сек ПОГОНИ — из ГДД
export const IDLE_TIMEOUT = 20000; // 20 сек простоя до idle-анимации — из ГДД

export const COINS_PER_LEVEL = 5; // монет за прохождение уровня (кроме собранных)

// --- Как собака находит котика ---
//
// Собака появляется в случайном месте и бежит искать. Её 15 секунд начинают
// идти только когда она ЗАМЕТИЛА котика (подбежала ближе DOG_NOTICE_TILES).
// Иначе далёкая собака тратила бы всю жизнь на дорогу и не доходила: карта
// в лабиринтных шагах огромная (до 326 тайлов), а за 15 сек собака пробегает ~40.
export const DOG_NOTICE_TILES = 10;

// Сколько секунд собака готова потратить на дорогу. Это же ограничивает и
// дальность спавна: дальше собака просто не успеет прийти за разумное время,
// и ребёнок будет минуту ждать пустоты.
export const DOG_APPROACH_BUDGET = 22000;

// Страховка: если котик всё это время убегал и собака так и не сблизилась —
// она сдаётся и исчезает. Без этого собака бегала бы за котиком вечно.
export const DOG_APPROACH_MAX = 32000;

export const LEVELS = [
  {
    n: 1, cols: 7, rows: 7, braid: 0.30, dogs: 0, coins: 3, safeZones: 4,
    spawnDelay: 0, respawnGap: 0,
    hint: 'Веди котика к домику! Собирай монетки.',
  },
  {
    n: 2, cols: 9, rows: 9, braid: 0.18, dogs: 0, coins: 5, safeZones: 5,
    spawnDelay: 0, respawnGap: 0,
    hint: 'Лабиринт стал больше. Не заблудись!',
  },
  {
    n: 3, cols: 11, rows: 11, braid: 0.20, dogs: 1, dogSpeed: 0.70, coins: 6, safeZones: 6,
    spawnDelay: 5000, respawnGap: 4000,
    hint: 'Осторожно, собака! Прячься в коробку.',
  },
  {
    n: 4, cols: 13, rows: 13, braid: 0.22, dogs: 1, dogSpeed: 0.75, coins: 8, safeZones: 6,
    spawnDelay: 4500, respawnGap: 3500,
    hint: 'Собака стала шустрее!',
  },
  {
    n: 5, cols: 15, rows: 15, braid: 0.25, dogs: 2, dogSpeed: 0.80, coins: 10, safeZones: 7,
    spawnDelay: 4000, respawnGap: 3000,
    hint: 'Теперь их двое!',
  },
  {
    n: 6, cols: 17, rows: 17, braid: 0.27, dogs: 2, dogSpeed: 0.85, coins: 8, safeZones: 7,
    spawnDelay: 3500, respawnGap: 3000,
    hint: 'Две собаки, и лабиринт больше.',
  },
  {
    n: 7, cols: 19, rows: 19, braid: 0.30, dogs: 3, dogSpeed: 0.90, coins: 6, safeZones: 8,
    spawnDelay: 3000, respawnGap: 2500,
    hint: 'Три собаки! Держись укрытий.',
  },
  {
    n: 8, cols: 19, rows: 19, braid: 0.32, dogs: 3, dogSpeed: 0.95, coins: 5, safeZones: 8,
    spawnDelay: 2500, respawnGap: 2200,
    hint: 'Финал! Самые быстрые собаки. Удачи!',
  },
];

export const TOTAL_LEVELS = LEVELS.length;

export const SPEED = {
  catWalk: 110,
  catRun: 170,
};

/** Скорость собаки на уровне в пикселях/сек. Считается от скорости БЕГА котика. */
export function dogSpeedFor(cfg) {
  return SPEED.catRun * (cfg.dogSpeed || 0.8);
}

export const TILE = 48; // размер тайла в пикселях (мир, не экран)

// Насколько крупными персонажи выглядят относительно тайла. Меньше 1 —
// чтобы котик пролезал в коридор и не тёрся боками об углы.
export const CAT_SIZE = TILE * 0.95;
export const DOG_SIZE = TILE * 1.0;

export function getLevel(n) {
  const i = Math.min(Math.max(n - 1, 0), LEVELS.length - 1);
  return LEVELS[i];
}
