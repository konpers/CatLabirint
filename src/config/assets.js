// ============================================================
//  ЕДИНАЯ ТОЧКА ПРАВДЫ ПО КАРТИНКАМ
//  Нашёл свои картинки? Положи их в assets/sprites/ и поменяй
//  путь в нужной строке ниже. Больше нигде код трогать не надо.
//  Формат не важен: .svg, .png — Phaser грузит и то, и то.
// ============================================================

import { CATS } from './cats.js';
import { DOGS, DOG_RUN_FRAMES } from './dogs.js';

export const SPRITE_SIZE = 64; // размер, к которому приводятся SVG при загрузке

// Позы котика: walk — основная, sit/sleep — для анимаций простоя.
export const CAT_POSES = ['walk', 'sit', 'sleep'];

export const IMAGES = [
  // Котики: ключ 'cat_<id>_<поза>' — id берётся из cats.js
  ...CATS.flatMap((c) =>
    CAT_POSES.map((p) => ({ key: `cat_${c.id}_${p}`, path: `assets/sprites/cat_${c.id}_${p}.png` }))
  ),

  // Собаки: у каждой породы цикл бега + поза ожидания. Породы — в dogs.js.
  ...DOGS.flatMap((d) => [
    ...Array.from({ length: DOG_RUN_FRAMES }, (_, i) => ({
      key: `dog_${d.id}_run_${i}`,
      path: `assets/sprites/dog_${d.id}_run_${i}.png`,
    })),
    { key: `dog_${d.id}_wait`, path: `assets/sprites/dog_${d.id}_wait.png` },
  ]),

  { key: 'box',  path: 'assets/sprites/box.svg' },   // безопасная зона
  { key: 'exit', path: 'assets/sprites/exit.svg' },  // выход из лабиринта
  { key: 'coin', path: 'assets/sprites/coin.svg' },  // монетка на карте
];

// Звуки. Файлов пока нет — просто положи их в assets/sfx/, игра подхватит сама.
export const SOUNDS = [
  { key: 'meow', path: 'assets/sfx/meow.mp3' },
  { key: 'win',  path: 'assets/sfx/win.mp3' },
  { key: 'bark', path: 'assets/sfx/bark.mp3' },
  { key: 'coin', path: 'assets/sfx/coin.mp3' },
];

// Сюда попадают только реально существующие звуки — заполняется в main.js.
export const AVAILABLE_SOUNDS = [];

/**
 * Проверяет, какие звуки реально лежат на диске.
 *
 * Зачем: без проверки Phaser грузит отсутствующий mp3, получает страницу 404
 * и пытается декодировать её как аудио — консоль краснеет на ровном месте.
 *
 * Почему с таймаутом: игра НЕ должна зависеть от того, ответит ли сеть.
 * Проверка ограничена сотнями миллисекунд и при любой заминке просто решает,
 * что звуков нет. Без этого зависший запрос вешал бы игру на чёрном экране —
 * ровно это и случилось на тестовом сервере, который не отвечал на HEAD.
 */
const PROBE_TIMEOUT = 800;

export async function detectSounds() {
  const probe = async (s) => {
    try {
      // GET, а не HEAD: HEAD поддерживают не все сервера (простые статик-сервера
      // и локальные заглушки на нём спотыкаются).
      const opts = AbortSignal.timeout ? { signal: AbortSignal.timeout(PROBE_TIMEOUT) } : {};
      const res = await fetch(s.path, opts);
      return res.ok ? s : null;
    } catch {
      return null; // нет файла, нет сети, таймаут — во всех случаях играем молча
    }
  };

  const found = (await Promise.all(SOUNDS.map(probe))).filter(Boolean);
  AVAILABLE_SOUNDS.push(...found);
  return AVAILABLE_SOUNDS;
}

// Палитра. Меняешь тут — меняется весь вид игры.
//
// Главное правило читаемости: стена должна быть заметно ТЕМНЕЕ пола.
// Первая версия провалилась именно на этом — светлый пол и светлая стена
// сливались, и было непонятно, где проход, а где преграда.
export const PALETTE = {
  floor:      0xEAF6EF, // пол — светлый мятный
  floorAlt:   0xDCEFE4, // шахматка пола, еле заметная
  wallTop:    0xC98F5A, // верхняя грань стены
  wallSide:   0x8A5A34, // боковая грань — то самое фейковое 2.5D
  wallEdge:   0x6E4426, // тёмный контур: превращает стены в чёткие блоки
  wallHi:     0xDCA972, // блик по верхнему краю — намёк на объём
  bg:         0xB8D8E8, // фон за пределами лабиринта
  safe:       0xF7D9A8, // подсветка безопасной зоны
  exit:       0xFFE07A,
  ui:         0x5B4A6F,
  uiLight:    0xFFF6EC,
  danger:     0xF2856D, // мягкий, не агрессивно-красный
};

export const FONT = '"Baloo 2", "Comic Sans MS", "Segoe UI Rounded", system-ui, sans-serif';
