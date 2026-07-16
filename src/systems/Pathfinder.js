// Поиск пути для собаки: BFS в ширину по сетке лабиринта.
//
// Почему BFS, а не A*: карта максимум 35x35 = ~1200 тайлов, из них проходима
// половина. BFS обходит их за доли миллисекунды и даёт гарантированно
// кратчайший путь без эвристик и приоритетных очередей. A* тут — лишний код.
//
// Собака пересчитывает путь не каждый кадр, а раз в ~500 мс (см. Dog.js):
// и дешевле, и выглядит живее — будто собака на секунду задумывается.

import { FLOOR } from './MazeGenerator.js';

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/**
 * @returns {Array<{x,y}>} путь ОТ start (не включая) ДО goal (включая),
 *                         или [] если пути нет
 */
export function findPath(grid, start, goal) {
  const h = grid.length;
  const w = grid[0].length;

  if (!inBounds(grid, goal.x, goal.y) || grid[goal.y][goal.x] !== FLOOR) return [];
  if (start.x === goal.x && start.y === goal.y) return [];

  const key = (x, y) => y * w + x;
  const cameFrom = new Map();
  const queue = [start];
  let head = 0; // индекс вместо shift() — shift на массиве это O(n)
  cameFrom.set(key(start.x, start.y), null);

  while (head < queue.length) {
    const cur = queue[head++];
    if (cur.x === goal.x && cur.y === goal.y) return rebuild(cameFrom, key, cur);

    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (grid[ny][nx] !== FLOOR) continue;
      const k = key(nx, ny);
      if (cameFrom.has(k)) continue;
      cameFrom.set(k, cur);
      queue.push({ x: nx, y: ny });
    }
  }
  return []; // недостижимо (не должно случаться — DFS даёт связный лабиринт)
}

function rebuild(cameFrom, key, node) {
  const path = [];
  let cur = node;
  while (cur) {
    path.push({ x: cur.x, y: cur.y });
    cur = cameFrom.get(key(cur.x, cur.y));
  }
  path.reverse();
  path.shift(); // убираем стартовый тайл — собака уже на нём стоит
  return path;
}

export function inBounds(grid, x, y) {
  return y >= 0 && y < grid.length && x >= 0 && x < grid[0].length;
}

/** Расстояние в шагах по лабиринту (не по прямой) — для честного спавна собаки. */
export function pathDistance(grid, a, b) {
  const p = findPath(grid, a, b);
  return p.length ? p.length : Infinity;
}

/**
 * Расстояния в шагах ОТ точки from ДО всех проходимых тайлов — за один обход.
 * Нужно для выбора места спавна: дешевле сделать один BFS на всю карту,
 * чем гонять findPath к каждому кандидату по очереди.
 * @returns {Map<string, number>} ключ 'x,y' → число шагов
 */
export function distanceMap(grid, from) {
  const h = grid.length;
  const w = grid[0].length;
  const dist = new Map();
  if (grid[from.y]?.[from.x] !== FLOOR) return dist;

  dist.set(`${from.x},${from.y}`, 0);
  const queue = [from];
  let head = 0;

  while (head < queue.length) {
    const cur = queue[head++];
    const d = dist.get(`${cur.x},${cur.y}`);
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (grid[ny][nx] !== FLOOR) continue;
      const k = `${nx},${ny}`;
      if (dist.has(k)) continue;
      dist.set(k, d + 1);
      queue.push({ x: nx, y: ny });
    }
  }
  return dist;
}
