// Породы собак. Чтобы добавить новую:
//   1. Положи контактный лист в images/
//   2. Впиши породу в $breeds в tools/cut_dogs.ps1 и прогони скрипт
//   3. Допиши объект сюда — дальше всё подхватится само (assets.js, sw.js, анимации)
//
// Каждой породе нужны кадры бега dog_<id>_run_0..N и поза dog_<id>_wait
// (собака потеряла котика и ждёт у коробки).
//
// price — цена в монетах. 0 = бесплатная, доступна с начала. Платные породы
// открываются в магазине; какие из открытых реально гоняются за котиком, игрок
// включает сам (см. progress.getEnabledDogs).

export const DOG_RUN_FRAMES = 6;

export const DOGS = [
  // Бесплатные (доступны с начала)
  { id: 'beagle', name: 'Бигль',      price: 0 },
  { id: 'bull',   name: 'Бультерьер', price: 0 },
  // Платные (покупаются в магазине). Картинки — dog_<id>_run_0..5 + dog_<id>_wait.
  { id: 'bear_black', name: 'Охотник', price: 50 },
  { id: 'bear_brown', name: 'Бурый',   price: 50 },
  { id: 'bear_white', name: 'Глыба',   price: 50 },
  { id: 'pitbull',    name: 'Тайсон',  price: 80 },
  { id: 'shepherd',   name: 'Убийца',  price: 100 },
];

export function getDog(id) {
  return DOGS.find((d) => d.id === id) || DOGS[0];
}

export function getDogPrice(id) {
  return getDog(id).price || 0;
}

/**
 * Порода для новой собаки. Тянем ТОЛЬКО из включённых игроком пород (enabled).
 * Fallback на всякий случай, чтобы никогда не остаться без врага:
 * enabled → все породы. randomEnemyBreed вызывается с готовым списком enabled,
 * который считает GameScene из progress (модуль progress тут не импортируем,
 * чтобы не тянуть localStorage в чистый конфиг).
 */
export function randomEnemyBreed(enabled) {
  const pool = enabled && enabled.length ? enabled : DOGS.map((d) => d.id);
  return pool[Math.floor(Math.random() * pool.length)];
}
