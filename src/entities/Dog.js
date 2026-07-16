// Собака: появляется, бежит к котику в обход стен, через 15 секунд исчезает.

import { findPath, distanceMap } from '../systems/Pathfinder.js';
import {
  DOG_LIFETIME, DOG_SIZE, DOG_NOTICE_TILES, DOG_APPROACH_MAX, TILE,
} from '../config/levels.js';
import { DOGS, DOG_RUN_FRAMES } from '../config/dogs.js';

const REPATH_MS = 500;   // как часто пересчитывать маршрут
const ARRIVE_EPS = 5;    // считаем, что дошли до узла пути

/** Анимации живут в глобальном менеджере — создаём по одной на породу. */
export function createDogAnims(scene) {
  for (const d of DOGS) {
    const key = `dog_${d.id}_run`;
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: Array.from({ length: DOG_RUN_FRAMES }, (_, i) => ({ key: `dog_${d.id}_run_${i}` })),
      frameRate: 12,
      repeat: -1,
    });
  }
}

export class Dog extends Phaser.Physics.Arcade.Sprite {
  /**
   * @param {number} speed скорость в пикселях/сек — задаётся уровнем (см. levels.js)
   * @param {string} breed порода из dogs.js — определяет спрайты и анимацию
   */
  constructor(scene, x, y, maze, speed, breed) {
    super(scene, x, y, `dog_${breed}_run_0`);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.maze = maze;
    this.speed = speed;
    this.breed = breed;
    this.path = [];
    this.repathAt = 0;
    this.dead = false;

    this.baseScale = DOG_SIZE / this.width;
    this.setScale(this.baseScale);
    this.setDepth(y);
    this.play(this._anim);

    const r = this.width * 0.22;
    this.body.setCircle(r, this.width / 2 - r, this.height / 2 - r + this.height * 0.08);

    // появление: пшик из ничего, чтобы было заметно, но не страшно
    this.setScale(0);
    scene.tweens.add({ targets: this, scale: this.baseScale, duration: 350, ease: 'Back.easeOut' });
    scene.sfx?.('bark');

    this.spawnedAt = scene.time.now;
    this.noticed = false;    // заметила ли котика (тогда пошёл отсчёт 15 секунд)
    this.noticedAt = 0;
  }

  get _anim() {
    return `dog_${this.breed}_run`;
  }

  /**
   * Сколько мс погони осталось. Пока котик не замечен — полные 15 секунд:
   * отсчёт начнётся только со встречи.
   */
  get timeLeft() {
    if (!this.noticed) return DOG_LIFETIME;
    return Math.max(0, DOG_LIFETIME - (this.scene.time.now - this.noticedAt));
  }

  /**
   * Отсчёт жизни. Вынесен отдельно и вызывается ВСЕГДА — даже когда котик сидит
   * в коробке. Иначе спрятавшегося котика собака сторожила бы вечно, а по ГДД
   * она должна через 15 секунд уйти.
   */
  _updateLife(cat, time) {
    if (!this.noticed) {
      // «Заметила» = подошла близко по лабиринту, а не по прямой: за стеной
      // в соседнем коридоре собака котика не видит.
      // Пустой путь означает, что собака уже стоит на тайле котика — это тоже
      // «заметила», иначе вплотную подошедшая собака так и не начнёт отсчёт.
      const steps = this.path.length;
      const near =
        (steps > 0 && steps <= DOG_NOTICE_TILES) ||
        Math.hypot(this.x - cat.x, this.y - cat.y) < TILE * 2;
      if (near) {
        this.noticed = true;
        this.noticedAt = time;
        this.scene.sfx?.('bark'); // залаяла — ребёнку понятно, что её нашли
      } else if (time - this.spawnedAt >= DOG_APPROACH_MAX) {
        this.vanish(); // так и не нашла — сдаётся
      }
      return;
    }
    // Погоня кончилась. Причина 'chase' говорит сцене увести ВСЮ стаю разом:
    // иначе у каждой собаки свой таймер, и они исчезают/появляются по кругу —
    // ребёнок вообще не получает передышки (жалоба с теста).
    if (time - this.noticedAt >= DOG_LIFETIME) this.vanish('chase');
  }

  update(cat, time) {
    if (this.dead || !this.active) return;

    // Маршрут считаем ВСЕГДА: по его длине определяется, заметила ли собака
    // котика. Без этого спрятавшегося котика она бы искала вечно.
    if (time >= this.repathAt) {
      this.repathAt = time + REPATH_MS;
      const from = this.maze.worldToTile(this.x, this.y);
      const to = this.maze.worldToTile(cat.x, cat.y);
      this.path = findPath(this.maze.grid, from, to);
    }

    this._updateLife(cat, time);
    if (this.dead) return;

    // Котик в коробке, а собака добежала вплотную — она его потеряла: садится
    // рядом и озадаченно ждёт. Садиться надо именно ВПЛОТНУЮ, а не как только
    // заметила: иначе собака замирает за десяток тайлов, ребёнок её не видит
    // и не понимает, что коробка сработала.
    if (cat.isSafe && Math.hypot(this.x - cat.x, this.y - cat.y) < TILE * 1.3) {
      if (this.anims.isPlaying) {
        this.anims.stop();
        this.setTexture(`dog_${this.breed}_wait`);
      }
      this.setVelocity(0, 0);
      this.setDepth(this.y);
      return;
    }

    if (!this.anims.isPlaying) {
      this.setTexture(`dog_${this.breed}_run_0`);
      this.play(this._anim);
    }

    this._followPath();
    this.setDepth(this.y);
  }

  _followPath() {
    if (!this.path.length) {
      this.setVelocity(0, 0);
      return;
    }
    const node = this.path[0];
    const target = this.maze.tileToWorld(node.x, node.y);
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < ARRIVE_EPS) {
      this.path.shift();
      return;
    }
    this.setVelocity((dx / dist) * this.speed, (dy / dist) * this.speed);
    // на картинке собака смотрит вправо
    if (dx < -0.5) this.setFlipX(true);
    else if (dx > 0.5) this.setFlipX(false);
  }

  /** @param {string} reason 'chase' — истёк таймер погони (уводит всю стаю) */
  vanish(reason = '') {
    if (this.dead) return;
    this.dead = true;
    this.setVelocity(0, 0);
    if (this.body) this.body.enable = false;

    // Сигнал — СРАЗУ, не после анимации растворения. Иначе стая получает
    // команду уходить на 400 мс позже, и собака, чей таймер истекает в эту
    // щель, успевает исчезнуть «сама по себе» — уход перестаёт быть дружным.
    this.scene.events.emit('dog-vanished', this, reason);

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: this.baseScale * 0.4,
      duration: 400,
      ease: 'Back.easeIn',
      onComplete: () => this.destroy(),
    });
  }

}

/**
 * Выбирает случайное место для спавна собаки в «окне» дистанции от котика.
 *
 * Нижняя граница: собака не должна возникнуть прямо в морду — это обидно.
 * Верхняя граница: сколько собака успевает пробежать за отведённое на дорогу
 * время. Дальше не спавним не из-за 15 секунд погони (они теперь идут только
 * со встречи), а чтобы ребёнок не ждал собаку с другого конца карты по минуте:
 * карта в лабиринтных шагах огромная — до 326 тайлов.
 *
 * Расстояния берём одним BFS от котика на всю карту — дешевле, чем считать
 * путь к каждому кандидату отдельно.
 */
export function pickSpawnTile(maze, catTile, minSteps = 8, maxSteps = 20) {
  const dist = distanceMap(maze.grid, catTile);

  const inBand = [];
  const reachable = [];
  for (const t of maze.floors) {
    const d = dist.get(`${t.x},${t.y}`);
    if (d === undefined) continue;
    reachable.push({ t, d });
    if (d >= minSteps && d <= maxSteps) inBand.push(t);
  }

  if (inBand.length) return inBand[Math.floor(Math.random() * inBand.length)];

  // Окно пустое (крошечная карта) — берём самый дальний достижимый тайл:
  // лучше слишком близко, чем недостижимо далеко.
  reachable.sort((a, b) => b.d - a.d);
  return reachable.length ? reachable[0].t : catTile;
}
