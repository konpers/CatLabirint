// Игровая сцена: строит лабиринт, рулит котиком, собаками и переходами уровней.

import { MazeGenerator, WALL, FLOOR, floorTiles, deadEndTiles, spreadPick } from '../systems/MazeGenerator.js';
import { Joystick } from '../systems/Joystick.js';
import { Cat } from '../entities/Cat.js';
import { Dog, pickSpawnTile, createDogAnims } from '../entities/Dog.js';
import { getLevel, LEVELS, TILE, DOG_APPROACH_BUDGET, dogSpeedFor } from '../config/levels.js';
import { PALETTE, FONT } from '../config/assets.js';

const WALL_H = 14; // высота "боковой грани" стены — она и создаёт эффект 2.5D

// Ближе этого собака не появляется — иначе выпрыгивает котику в морду.
const DOG_SPAWN_MIN = 7;

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.levelNum = data.level || 1;
    this.skin = data.skin || 'persik';
    this.cfg = getLevel(this.levelNum);
    this.finished = false;
  }

  create() {
    this.cameras.main.setBackgroundColor(PALETTE.bg);

    this._buildMaze();
    this._drawMaze();
    this._placeObjects();
    this._setupCat();
    this._setupCamera();
    this._setupDogs();

    this.joystick = new Joystick(this);
    this.scene.launch('UI', { level: this.levelNum, hint: this.cfg.hint });
    this.ui = this.scene.get('UI');

    this.startedAt = this.time.now;
  }

  // --- Лабиринт -------------------------------------------------------

  _buildMaze() {
    const gen = new MazeGenerator(this.cfg.cols, this.cfg.rows, this.cfg.braid);
    const { grid, w, h } = gen.generate();

    // maze — общий объект: им пользуются и собаки (для BFS), и отрисовка
    this.maze = {
      grid,
      w,
      h,
      floors: floorTiles(grid),
      tileToWorld: (tx, ty) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 }),
      worldToTile: (wx, wy) => ({
        x: Math.floor(wx / TILE),
        y: Math.floor(wy / TILE),
      }),
    };

    this.physics.world.setBounds(0, 0, w * TILE, h * TILE);
  }

  _drawMaze() {
    const { grid, w, h } = this.maze;

    // Пол рисуем одним Graphics, а не тысячей спрайтов: на телефоне это разница
    // между 60 и 20 fps на пятом уровне.
    const g = this.add.graphics().setDepth(-1000);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (grid[y][x] !== FLOOR) continue;
        g.fillStyle((x + y) % 2 === 0 ? PALETTE.floor : PALETTE.floorAlt, 1);
        g.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }

    // Стены: статические тела для физики + рисованные грани для вида.
    this.walls = this.physics.add.staticGroup();
    const wg = this.add.graphics();
    const isWall = (x, y) => y < 0 || x < 0 || y >= h || x >= w || grid[y][x] === WALL;

    // Проход 1: заливка граней. Сначала все стены, потом контуры — иначе
    // соседний блок затирал бы контур предыдущего.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (grid[y][x] !== WALL) continue;
        const px = x * TILE;
        const py = y * TILE;
        const openBelow = !isWall(x, y + 1);

        // боковая грань видна, только если снизу проход — это и создаёт "высоту"
        if (openBelow) {
          wg.fillStyle(PALETTE.wallSide, 1);
          wg.fillRect(px, py + TILE - WALL_H, TILE, WALL_H);
        }
        wg.fillStyle(PALETTE.wallTop, 1);
        wg.fillRect(px, py, TILE, TILE - (openBelow ? WALL_H : 0));

        // блик по верхнему краю блока
        if (!isWall(x, y - 1)) {
          wg.fillStyle(PALETTE.wallHi, 1);
          wg.fillRect(px, py, TILE, 3);
        }
      }
    }

    // Проход 2: тёмный контур по границе стены с проходом. Именно он собирает
    // сплошную коричневую массу в читаемые блоки.
    wg.lineStyle(2, PALETTE.wallEdge, 0.9);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (grid[y][x] !== WALL) continue;
        const px = x * TILE;
        const py = y * TILE;
        if (!isWall(x, y - 1)) wg.lineBetween(px, py + 1, px + TILE, py + 1);
        if (!isWall(x, y + 1)) wg.lineBetween(px, py + TILE - 1, px + TILE, py + TILE - 1);
        if (!isWall(x - 1, y)) wg.lineBetween(px + 1, py, px + 1, py + TILE);
        if (!isWall(x + 1, y)) wg.lineBetween(px + TILE - 1, py, px + TILE - 1, py + TILE);
      }
    }
    wg.setDepth(-500);
    this.wallGfx = wg;

    // Тела коллизии — отдельным проходом, чтобы не мешались в отрисовке
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (grid[y][x] !== WALL) continue;
        const body = this.add.zone(x * TILE + TILE / 2, y * TILE + TILE / 2, TILE, TILE);
        this.physics.add.existing(body, true);
        this.walls.add(body);
      }
    }
  }

  // --- Объекты на карте -----------------------------------------------

  _placeObjects() {
    const { grid } = this.maze;
    const ends = deadEndTiles(grid);
    const floors = this.maze.floors;

    // Старт и выход — в максимально далёких друг от друга тупиках,
    // иначе уровень проходится за три шага и это скучно.
    const pool = ends.length >= 2 ? ends : floors;
    let best = { a: pool[0], b: pool[1] || pool[0], d: -1 };
    for (let i = 0; i < Math.min(pool.length, 40); i++) {
      for (let j = i + 1; j < Math.min(pool.length, 40); j++) {
        const d = Math.abs(pool[i].x - pool[j].x) + Math.abs(pool[i].y - pool[j].y);
        if (d > best.d) best = { a: pool[i], b: pool[j], d };
      }
    }
    this.startTile = best.a;
    this.exitTile = best.b;

    const ep = this.maze.tileToWorld(this.exitTile.x, this.exitTile.y);
    this.exit = this.physics.add.staticImage(ep.x, ep.y, 'exit').setDepth(ep.y - 10);
    this.tweens.add({ targets: this.exit, scale: 1.08, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Безопасные зоны — по тупикам, подальше друг от друга.
    // Старт и выход исключаем ВСЕГДА: на маленьких уровнях тупиков может быть
    // всего два (их забирают старт с выходом), и тогда коробки берутся из общих
    // тайлов — без этого фильтра коробка легко накрыла бы домик или спавн котика.
    const taken = (t) =>
      (t.x === this.startTile.x && t.y === this.startTile.y) ||
      (t.x === this.exitTile.x && t.y === this.exitTile.y);

    const preferred = ends.filter((t) => !taken(t));
    const fallback = floors.filter((t) => !taken(t));
    const candidates = preferred.length >= this.cfg.safeZones ? preferred : fallback;

    const minDist = Math.max(3, Math.floor(this.maze.w / 4));
    const spots = spreadPick(candidates, this.cfg.safeZones, minDist);

    this.safeZones = this.physics.add.staticGroup();
    for (const t of spots) {
      const p = this.maze.tileToWorld(t.x, t.y);
      // мягкое свечение под коробкой — ребёнок должен считывать «сюда можно»
      const halo = this.add.circle(p.x, p.y + 6, TILE * 0.58, PALETTE.safe, 0.5).setDepth(p.y - 30);
      this.tweens.add({ targets: halo, alpha: 0.2, duration: 1100, yoyo: true, repeat: -1 });

      // Коробка крупнее котика: он прячется ЗА ней (депth ниже), и если сделать
      // её вровень, котик закроет её целиком — на экране он будет просто стоять
      // в коридоре, хотя надпись «ты в укрытии» горит. Так видно и котика, и куда он влез.
      const box = this.safeZones.create(p.x, p.y, 'box').setDepth(p.y - 5).setScale(1.3);
      box.body.setSize(TILE * 0.8, TILE * 0.8);
      box.body.setOffset((box.width - TILE * 0.8) / 2, (box.height - TILE * 0.8) / 2);
    }
  }

  _setupCat() {
    const p = this.maze.tileToWorld(this.startTile.x, this.startTile.y);
    this.cat = new Cat(this, p.x, p.y, this.skin);
    this.physics.add.collider(this.cat, this.walls);

    this.physics.add.overlap(this.cat, this.exit, () => this._win(), null, this);

    // Появление котика
    this.cat.setScale(0);
    this.tweens.add({ targets: this.cat, scale: this.cat.baseScale, duration: 400, ease: 'Back.easeOut' });
  }

  _setupCamera() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.maze.w * TILE, this.maze.h * TILE);
    cam.startFollow(this.cat, true, 0.1, 0.1);
    this._applyZoom();

    // Экран телефона меняет размер на ходу: поворот, скрытие адресной строки.
    // Зум обязан пересчитаться, иначе лабиринт либо не дотянется до краёв,
    // либо окажется неудобно крупным.
    this.scale.on('resize', this._applyZoom, this);
    this.events.once('shutdown', () => this.scale.off('resize', this._applyZoom, this));
  }

  _applyZoom() {
    const mazeW = this.maze.w * TILE;
    const mazeH = this.maze.h * TILE;

    // Сколько хотим видеть вокруг котика: достаточно коридоров, но чтобы сам
    // котик не превращался в точку.
    const desired = Math.min(this.scale.width / (TILE * 9), this.scale.height / (TILE * 12));

    // Минимум, при котором лабиринт закрывает экран целиком. Без этого маленькие
    // карты (уровень 1) не дотягиваются до края, и снизу висит полоса пустого фона.
    const fill = Math.max(this.scale.width / mazeW, this.scale.height / mazeH);

    this.cameras.main.setZoom(Phaser.Math.Clamp(Math.max(desired, fill), 0.7, 1.8));
  }

  // --- Собаки ----------------------------------------------------------

  _setupDogs() {
    this.dogs = this.add.group({ runChildUpdate: false });
    if (!this.cfg.dogs) return;
    createDogAnims(this);

    // Насколько далеко может появиться собака: сколько тайлов она пробежит за
    // отведённое на дорогу время. Чем медленнее собака на уровне, тем ближе
    // ей приходится появляться — иначе она не дойдёт за разумный срок.
    this.dogReach = Math.floor((DOG_APPROACH_BUDGET / 1000) * dogSpeedFor(this.cfg) / TILE);

    this.physics.add.overlap(this.cat, this.dogs, this._onDogTouch, null, this);

    // Первая партия собак — через spawnDelay после старта
    for (let i = 0; i < this.cfg.dogs; i++) {
      this.time.delayedCall(this.cfg.spawnDelay + i * 700, () => this._spawnDog());
    }
    // Каждая исчезнувшая собака заменяется новой — уровень остаётся напряжённым.
    //
    // Phaser переиспользует объект сцены при restart и НЕ чистит this.events,
    // поэтому обработчик надо снимать руками на shutdown. Иначе после десятка
    // перезапусков (а ребёнок на 5-м уровне столько и погибнет) тут копятся
    // десятки слушателей, и каждый вешает свой лишний таймер.
    const onVanished = () => {
      if (this.finished) return;
      this.time.delayedCall(this.cfg.respawnGap, () => this._spawnDog());
    };
    this.events.on('dog-vanished', onVanished);
    this.events.once('shutdown', () => this.events.off('dog-vanished', onVanished));
  }

  _spawnDog() {
    if (this.finished || !this.scene.isActive()) return;
    if (this.dogs.getLength() >= this.cfg.dogs) return;

    const catTile = this.maze.worldToTile(this.cat.x, this.cat.y);
    const t = pickSpawnTile(this.maze, catTile, DOG_SPAWN_MIN, this.dogReach);
    const p = this.maze.tileToWorld(t.x, t.y);
    const dog = new Dog(this, p.x, p.y, this.maze, dogSpeedFor(this.cfg));
    this.dogs.add(dog);
    this.physics.add.collider(dog, this.walls);
  }

  _onDogTouch(cat, dog) {
    if (this.finished || dog.dead) return;
    if (cat.isSafe) return; // в коробке собака не страшна — это вся суть укрытия
    this._lose();
  }

  // --- Исходы ----------------------------------------------------------

  _lose() {
    if (this.finished) return;
    this.finished = true;
    this.cat.setVelocity(0, 0);
    this.physics.pause();
    this.cameras.main.shake(220, 0.008);
    // Мягкий проигрыш: без крови и надписи GAME OVER — просто «ой» и заново.
    this.cameras.main.flash(200, 242, 133, 109);
    this.ui?.showMessage('Ой! Попробуем ещё разок');
    this.time.delayedCall(1300, () => {
      this.scene.stop('UI');
      this.scene.restart({ level: this.levelNum, skin: this.skin }); // новый лабиринт
    });
  }

  _win() {
    if (this.finished) return;
    this.finished = true;
    this.cat.setVelocity(0, 0);
    this.physics.pause();
    this.sfx?.('win');
    this.dogs.getChildren().forEach((d) => d.vanish());

    this.tweens.add({
      targets: this.cat,
      y: this.cat.y - 20,
      scale: this.cat.baseScale * 1.2,
      duration: 300, yoyo: true, repeat: 1,
    });

    const last = this.levelNum >= LEVELS.length;
    this.ui?.showMessage(last ? 'Ура! Ты прошла всю игру!' : `Уровень ${this.levelNum} пройден!`);

    this.time.delayedCall(1600, () => {
      this.scene.stop('UI');
      if (last) this.scene.start('Menu');
      else this.scene.start('Game', { level: this.levelNum + 1, skin: this.skin });
    });
  }

  // --- Цикл ------------------------------------------------------------

  update(time, delta) {
    if (this.finished) return;

    const input = this.joystick.getVector();
    this.cat.update(input, delta);

    // В коробке или нет — проверяем каждый кадр: от этого зависит, ловит ли собака
    const wasSafe = this.cat.isSafe;
    this.cat.isSafe = this.physics.overlap(this.cat, this.safeZones);
    if (this.cat.isSafe !== wasSafe) this.ui?.setSafe(this.cat.isSafe);

    for (const dog of this.dogs.getChildren()) dog.update(this.cat, time);

    // HUD: отсчёт идёт только у собак, которые УЖЕ нашли котика. Пока собака
    // рыщет где-то по лабиринту, показываем, что она есть, но без цифры —
    // иначе таймер врал бы, что она вот-вот исчезнет.
    const alive = this.dogs.getChildren().filter((d) => !d.dead);
    const hunting = alive.filter((d) => d.noticed);
    this.ui?.setDogTimer(
      hunting.length ? Math.min(...hunting.map((d) => d.timeLeft)) : 0,
      alive.length > 0
    );
  }

  /** Звук, который не падает, если файла нет. */
  sfx(key) {
    if (this.cache.audio.exists(key)) this.sound.play(key, { volume: 0.5 });
  }
}
