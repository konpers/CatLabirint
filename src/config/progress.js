// ============================================================
//  СОХРАНЕНИЕ ПРОГРЕССА — единая точка правды
//
//  Весь прогресс игрока — это один JSON в localStorage браузера.
//  Живёт на устройстве, переживает закрытие вкладки и офлайн, сервер не нужен.
//  Всё чтение/запись прогресса идёт ТОЛЬКО через этот модуль, чтобы формат
//  данных был в одном месте.
// ============================================================

import { CATS, DEFAULT_CAT } from './cats.js';
import { DOGS } from './dogs.js';

const SAVE_KEY = 'cat_maze_save';
const OLD_SKIN_KEY = 'cat_maze_skin'; // до введения прогресса выбор котика лежал тут

// Что доступно бесплатно с самого начала: всё, у чего price === 0.
const freeCatIds = () => CATS.filter((c) => (c.price || 0) === 0).map((c) => c.id);
const freeDogIds = () => DOGS.filter((d) => (d.price || 0) === 0).map((d) => d.id);

function defaults() {
  return {
    coins: 0,
    unlockedCats: freeCatIds(),
    unlockedDogs: freeDogIds(),
    enabledDogs: freeDogIds(), // какие породы сейчас гоняются за котиком
    selectedCat: localStorage.getItem(OLD_SKIN_KEY) || DEFAULT_CAT, // миграция
    maxLevel: 1, // до какого уровня открыт выбор
  };
}

let state = null;

function load() {
  if (state) return state;
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(SAVE_KEY)) || {};
  } catch {
    saved = {}; // повреждённое сохранение — начинаем с чистого листа, не падаем
  }
  const base = defaults();
  state = { ...base, ...saved };

  // Бесплатные скины должны быть открыты всегда, даже если сохранение старое
  // или в конфиг добавили новый бесплатный вариант.
  state.unlockedCats = unique([...freeCatIds(), ...(state.unlockedCats || [])]);
  state.unlockedDogs = unique([...freeDogIds(), ...(state.unlockedDogs || [])]);
  state.enabledDogs = (state.enabledDogs || []).filter((id) => state.unlockedDogs.includes(id));
  if (!state.enabledDogs.length) state.enabledDogs = freeDogIds(); // хотя бы одна активна
  return state;
}

function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // приватный режим / переполнение — прогресс просто не сохранится,
    // но игра продолжит работать в этой сессии
  }
}

function unique(arr) {
  return [...new Set(arr)];
}

// --- Монеты ----------------------------------------------------------------

export function getCoins() {
  return load().coins;
}

export function addCoins(n) {
  load().coins += n;
  save();
  return state.coins;
}

export function spendCoins(n) {
  const s = load();
  if (s.coins < n) return false;
  s.coins -= n;
  save();
  return true;
}

// --- Котики ----------------------------------------------------------------

export function isCatUnlocked(id) {
  return load().unlockedCats.includes(id);
}

/** Пытается купить котика. true — куплен (или уже был), false — не хватило монет. */
export function buyCat(id, price) {
  const s = load();
  if (s.unlockedCats.includes(id)) return true;
  if (!spendCoins(price)) return false;
  s.unlockedCats.push(id);
  save();
  return true;
}

export function getSelectedCat() {
  const s = load();
  // Выбранный мог оказаться недоступным (сброс сохранения) — откатываемся
  return s.unlockedCats.includes(s.selectedCat) ? s.selectedCat : s.unlockedCats[0];
}

export function setSelectedCat(id) {
  const s = load();
  if (!s.unlockedCats.includes(id)) return false;
  s.selectedCat = id;
  save();
  return true;
}

// --- Собаки (враги) --------------------------------------------------------

export function isDogUnlocked(id) {
  return load().unlockedDogs.includes(id);
}

export function buyDog(id, price) {
  const s = load();
  if (s.unlockedDogs.includes(id)) return true;
  if (!spendCoins(price)) return false;
  s.unlockedDogs.push(id);
  s.enabledDogs.push(id); // купил — сразу активна, чтобы покупка была заметна
  save();
  return true;
}

export function getEnabledDogs() {
  return load().enabledDogs.slice();
}

export function isDogEnabled(id) {
  return load().enabledDogs.includes(id);
}

/** Включает/выключает породу как активного врага. Минимум одна всегда активна. */
export function toggleDog(id) {
  const s = load();
  if (!s.unlockedDogs.includes(id)) return;
  const i = s.enabledDogs.indexOf(id);
  if (i >= 0) {
    if (s.enabledDogs.length <= 1) return; // нельзя выключить последнюю
    s.enabledDogs.splice(i, 1);
  } else {
    s.enabledDogs.push(id);
  }
  save();
}

// --- Прогресс по уровням ---------------------------------------------------

export function getMaxLevel() {
  return load().maxLevel;
}

/** Отмечает уровень пройденным: открывает следующий (не выше total). */
export function markLevelComplete(n, total) {
  const s = load();
  const next = Math.min(n + 1, total);
  if (next > s.maxLevel) {
    s.maxLevel = next;
    save();
  }
}
