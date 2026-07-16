// Породы собак. Чтобы добавить новую:
//   1. Положи контактный лист в images/
//   2. Впиши породу в $breeds в tools/cut_dogs.ps1 и прогони скрипт
//   3. Допиши объект сюда — дальше всё подхватится само (assets.js, sw.js, анимации)
//
// Каждой породе нужны кадры бега dog_<id>_run_0..N и поза dog_<id>_wait
// (собака потеряла котика и ждёт у коробки).

export const DOG_RUN_FRAMES = 6;

export const DOGS = [
  { id: 'beagle', name: 'Бигль' },
  { id: 'bull',   name: 'Бультерьер' },
];

/** Порода для новой собаки — случайная, чтобы стая была разношёрстной. */
export function randomDogBreed() {
  return DOGS[Math.floor(Math.random() * DOGS.length)].id;
}
