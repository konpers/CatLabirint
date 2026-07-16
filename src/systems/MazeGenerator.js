// Процедурная генерация лабиринта.
//
// Алгоритм: recursive backtracker (DFS). Он гарантирует, что из любой точки
// достижима любая другая — то есть выход никогда не окажется замурован.
//
// Представление «толстое»: ячейка занимает 1 тайл, стена между ячейками — тоже
// 1 тайл. Поэтому карта в тайлах = (2*cols+1) x (2*rows+1), и по краям всегда
// сплошная рамка.
//
//   grid[y][x] === WALL — непроходимо
//   grid[y][x] === FLOOR — можно ходить

export const WALL = 1;
export const FLOOR = 0;

export class MazeGenerator {
  /**
   * @param {number} cols   ширина в ЯЧЕЙКАХ
   * @param {number} rows   высота в ЯЧЕЙКАХ
   * @param {number} braid  0..1 — доля тупиков, пробиваемых в петли
   */
  constructor(cols, rows, braid = 0) {
    this.cols = cols;
    this.rows = rows;
    this.braid = braid;
    this.w = cols * 2 + 1;
    this.h = rows * 2 + 1;
  }

  generate() {
    const grid = [];
    for (let y = 0; y < this.h; y++) grid.push(new Array(this.w).fill(WALL));

    // --- DFS с явным стеком (рекурсия на 17x17 не страшна, но стек честнее) ---
    const visited = [];
    for (let y = 0; y < this.rows; y++) visited.push(new Array(this.cols).fill(false));

    const startC = Math.floor(Math.random() * this.cols);
    const startR = Math.floor(Math.random() * this.rows);
    const stack = [[startC, startR]];
    visited[startR][startC] = true;
    grid[startR * 2 + 1][startC * 2 + 1] = FLOOR;

    const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

    while (stack.length) {
      const [c, r] = stack[stack.length - 1];
      const options = [];
      for (const [dc, dr] of DIRS) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc >= 0 && nc < this.cols && nr >= 0 && nr < this.rows && !visited[nr][nc]) {
          options.push([nc, nr, dc, dr]);
        }
      }
      if (!options.length) {
        stack.pop();
        continue;
      }
      const [nc, nr, dc, dr] = options[Math.floor(Math.random() * options.length)];
      visited[nr][nc] = true;
      // пробиваем стену между текущей ячейкой и соседней
      grid[r * 2 + 1 + dr][c * 2 + 1 + dc] = FLOOR;
      grid[nr * 2 + 1][nc * 2 + 1] = FLOOR;
      stack.push([nc, nr]);
    }

    if (this.braid > 0) this._braid(grid);

    return { grid, w: this.w, h: this.h };
  }

  // Пробиваем часть тупиков — появляются петли, у котика есть куда отступать.
  _braid(grid) {
    const deadEnds = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = c * 2 + 1;
        const y = r * 2 + 1;
        let exits = 0;
        if (grid[y - 1][x] === FLOOR) exits++;
        if (grid[y + 1][x] === FLOOR) exits++;
        if (grid[y][x - 1] === FLOOR) exits++;
        if (grid[y][x + 1] === FLOOR) exits++;
        if (exits === 1) deadEnds.push([c, r]);
      }
    }

    shuffle(deadEnds);
    const count = Math.floor(deadEnds.length * this.braid);

    for (let i = 0; i < count; i++) {
      const [c, r] = deadEnds[i];
      const x = c * 2 + 1;
      const y = r * 2 + 1;
      // ищем стену, за которой есть другая ячейка, и сносим её
      const walls = [];
      if (r > 0 && grid[y - 1][x] === WALL) walls.push([x, y - 1]);
      if (r < this.rows - 1 && grid[y + 1][x] === WALL) walls.push([x, y + 1]);
      if (c > 0 && grid[y][x - 1] === WALL) walls.push([x - 1, y]);
      if (c < this.cols - 1 && grid[y][x + 1] === WALL) walls.push([x + 1, y]);
      if (!walls.length) continue;
      const [wx, wy] = walls[Math.floor(Math.random() * walls.length)];
      grid[wy][wx] = FLOOR;
    }
  }
}

// --- Утилиты, которыми пользуется GameScene при расстановке объектов ---

/** Все проходимые тайлы карты. */
export function floorTiles(grid) {
  const out = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (grid[y][x] === FLOOR) out.push({ x, y });
    }
  }
  return out;
}

/** Тупики — тайлы ровно с одним выходом. Лучшие места для коробок. */
export function deadEndTiles(grid) {
  const out = [];
  for (let y = 1; y < grid.length - 1; y++) {
    for (let x = 1; x < grid[y].length - 1; x++) {
      if (grid[y][x] !== FLOOR) continue;
      let exits = 0;
      if (grid[y - 1][x] === FLOOR) exits++;
      if (grid[y + 1][x] === FLOOR) exits++;
      if (grid[y][x - 1] === FLOOR) exits++;
      if (grid[y][x + 1] === FLOOR) exits++;
      if (exits === 1) out.push({ x, y });
    }
  }
  return out;
}

/**
 * Раскидывает n точек из candidates так, чтобы они не липли друг к другу.
 * Жадный отбор: берём точку, только если она дальше minDist от уже взятых.
 * Если кандидатов не хватило — отдаём сколько получилось (лучше 3 коробки, чем краш).
 */
export function spreadPick(candidates, n, minDist) {
  const pool = candidates.slice();
  shuffle(pool);
  const picked = [];
  for (const p of pool) {
    if (picked.length >= n) break;
    const ok = picked.every((q) => Math.abs(q.x - p.x) + Math.abs(q.y - p.y) >= minDist);
    if (ok) picked.push(p);
  }
  // не набрали — добираем без учёта дистанции
  if (picked.length < n) {
    for (const p of pool) {
      if (picked.length >= n) break;
      if (!picked.includes(p)) picked.push(p);
    }
  }
  return picked;
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
