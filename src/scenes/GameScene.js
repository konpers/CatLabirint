// Игровая сцена: строит лабиринт, рулит котиком, собаками и переходами уровней.

import { MazeGenerator, WALL, FLOOR, floorTiles, deadEndTiles, spreadPick } from '../systems/MazeGenerator.js';
import { distanceMap } from '../systems/Pathfinder.js';
import { Joystick } from '../systems/Joystick.js';
import { Cat } from '../entities/Cat.js';
import { Dog, pickSpawnTile, createDogAnims } from '../entities/Dog.js';
import { randomEnemyBreed } from '../config/dogs.js';
import {
  getLevel, TOTAL_LEVELS, TILE, DOG_APPROACH_BUDGET, dogSpeedFor, COINS_PER_LEVEL,
  BONE_RADIUS_TILES, BONE_DISTRACT_MS, SHIELD_FREEZE_MS, SHIELD_MAP_CHANCE,
} from '../config/levels.js';
import { PALETTE, FONT } from '../config/assets.js';
import * as progress from '../config/progress.js';

const WALL_H = 14; // высота "боковой грани" стены — она и создаёт эффект 2.5D

// Ближе этого собака не появляется — иначе выпрыгивает котику в морду.
const DOG_SPAWN_MIN = 7;

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.levelNum = data.level || 1;
    this.skin = data.skin || progress.getSelectedCat();
    this.cfg = getLevel(this.levelNum);
    this.finished = false;
    this.collected = 0; // монет собрано на этом уровне (банкуется только при победе)

    // Сцена переиспользуется при restart (Phaser не создаёт новый инстанс),
    // а this.shieldAura создаётся лениво внутри _applyShield — без сброса тут
    // после restart осталась бы ссылка на GameObject из ПРОШЛОГО забега,
    // уже уничтоженный вместе со старой сценой.
    this.shieldAura = null;
  }

  create() {
    this.cameras.main.setBackgroundColor(PALETTE.bg);

    this._buildMaze();
    this._drawMaze();
    this._placeObjects();
    this._placeCoins();
    this._placeShieldPickup();
    this._setupCat();
    this._setupCamera();
    this._setupDogs();

    this.joystick = new Joystick(this);
    // Стартовый баланс передаём в данных запуска: launched-сцена ещё не прошла
    // свой create(), и вызывать её setCoins() прямо сейчас нельзя (label ещё null).
    this.scene.launch('UI', { level: this.levelNum, hint: this.cfg.hint, coins: progress.getCoins() });
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
    this.boxTiles = spots.slice(); // запоминаем, чтобы не ставить монету на коробку
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

  // --- Монеты на карте -------------------------------------------------

  _placeCoins() {
    this.coinGroup = this.physics.add.group();
    const n = this.cfg.coins || 0;
    if (!n) return;

    // Разбрасываем по проходимым тайлам, исключая старт, выход и коробки —
    // монета под котиком на старте засчиталась бы «на халяву», а на выходе
    // толкала бы случайно закончить уровень.
    const taken = new Set([
      `${this.startTile.x},${this.startTile.y}`,
      `${this.exitTile.x},${this.exitTile.y}`,
      ...this.boxTiles.map((t) => `${t.x},${t.y}`),
    ]);
    const free = this.maze.floors.filter((t) => !taken.has(`${t.x},${t.y}`));
    const spots = spreadPick(free, n, 2); // разносим монеты друг от друга

    for (const t of spots) {
      const p = this.maze.tileToWorld(t.x, t.y);
      const coin = this.coinGroup.create(p.x, p.y, 'coin').setDepth(p.y - 8);
      coin.setScale(TILE * 0.55 / coin.width);
      coin.body.setCircle(coin.width * 0.4, coin.width * 0.1, coin.width * 0.1);
      // лёгкое покачивание — монетка «зовёт» её подобрать
      this.tweens.add({
        targets: coin, y: p.y - 4, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }
  }

  _collectCoin(cat, coin) {
    if (!coin.active) return;
    coin.disableBody(true, false);
    this.collected += 1;
    this.sfx('coin');
    // всплывающий "+1" и растворение монетки
    const pop = this.add
      .text(coin.x, coin.y - 6, '+1', {
        fontFamily: FONT, fontSize: '18px', color: '#E0A83A', stroke: '#FFFFFF', strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(20000);
    this.tweens.add({ targets: pop, y: pop.y - 26, alpha: 0, duration: 700, onComplete: () => pop.destroy() });
    this.tweens.add({
      targets: coin, scale: 0, angle: 180, duration: 260, ease: 'Back.easeIn',
      onComplete: () => coin.destroy(),
    });
    // HUD показывает текущий итог: сохранённые + собранные в этом забеге
    this.ui?.setCoins(progress.getCoins() + this.collected);
  }

  // --- Щит: редкий пикап на карте -------------------------------------

  // Спавнится только на уровнях, где вообще есть от чего защищаться, и
  // с вероятностью SHIELD_MAP_CHANCE — иначе игрок находил бы его каждый раз
  // и покупка в магазине потеряла бы смысл.
  _placeShieldPickup() {
    this.shieldGroup = this.physics.add.group();
    if (!this.cfg.dogs) return;
    if (Math.random() >= SHIELD_MAP_CHANCE) return;

    const coinTiles = this.coinGroup.getChildren().map((c) => this.maze.worldToTile(c.x, c.y));
    const taken = new Set([
      `${this.startTile.x},${this.startTile.y}`,
      `${this.exitTile.x},${this.exitTile.y}`,
      ...this.boxTiles.map((t) => `${t.x},${t.y}`),
      ...coinTiles.map((t) => `${t.x},${t.y}`),
    ]);
    const free = this.maze.floors.filter((t) => !taken.has(`${t.x},${t.y}`));
    if (!free.length) return;
    const t = free[Math.floor(Math.random() * free.length)];
    const p = this.maze.tileToWorld(t.x, t.y);
    const pickup = this.shieldGroup.create(p.x, p.y, 'shield').setDepth(p.y - 8);
    pickup.setScale(TILE * 0.6 / pickup.width);
    pickup.body.setCircle(pickup.width * 0.4, pickup.width * 0.1, pickup.width * 0.1);
    this.tweens.add({
      targets: pickup, y: p.y - 5, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  _collectShield(cat, pickup) {
    if (!pickup.active) return;
    pickup.destroy();
    if (!cat.hasShield) this._applyShield();
  }

  /** Надевает ауру щита на котика — источник неважен (магазин про запас или пикап). */
  _applyShield() {
    this.cat.hasShield = true;
    this.sfx('shield');
    if (!this.shieldAura) {
      this.shieldAura = this.add.circle(this.cat.x, this.cat.y, TILE * 0.62, 0x7EC8F2, 0.35)
        .setStrokeStyle(3, 0x4FA8E0, 0.8)
        .setDepth(20000);
      this.tweens.add({
        targets: this.shieldAura, scale: 1.15, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }
    this.shieldAura.setPosition(this.cat.x, this.cat.y).setVisible(true).setScale(1).setAlpha(1);
  }

  /** Щит поймал собаку вместо котика: аура лопается, собака замирает. */
  _popShield(dog) {
    this.cat.hasShield = false;
    this.sfx('shieldPop');
    dog.freeze(SHIELD_FREEZE_MS);
    if (this.shieldAura) {
      this.tweens.killTweensOf(this.shieldAura);
      this.tweens.add({
        targets: this.shieldAura, scale: 1.8, alpha: 0, duration: 250, ease: 'Quad.easeOut',
        onComplete: () => this.shieldAura?.setVisible(false),
      });
    }
    this.cameras.main.flash(120, 126, 200, 242); // мягкая вспышка щита, не тревожная
  }

  // --- Косточка: активная способность отвлечения -----------------------

  /** Вызывается из UIScene по тапу на кнопку способности. */
  _useBone() {
    if (this.finished) return false;
    if (!progress.useItemCharge('bone')) return false;

    const catTile = this.maze.worldToTile(this.cat.x, this.cat.y);
    const p = this.maze.tileToWorld(catTile.x, catTile.y);
    const bone = this.add.image(p.x, p.y, 'bone').setDepth(p.y - 6).setScale(0);
    this.tweens.add({ targets: bone, scale: TILE * 0.6 / bone.width, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: bone, y: p.y - 4, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 200,
    });

    // BFS-дистанция от косточки по лабиринту — та же утилита, что считает
    // дальность спавна собак (pickSpawnTile), только теперь от точки косточки.
    const dist = distanceMap(this.maze.grid, catTile);
    for (const dog of this.dogs.getChildren()) {
      if (dog.dead) continue;
      const dt = this.maze.worldToTile(dog.x, dog.y);
      const steps = dist.get(`${dt.x},${dt.y}`);
      if (steps !== undefined && steps <= BONE_RADIUS_TILES) dog.distract(catTile, BONE_DISTRACT_MS);
    }

    this.sfx('bone');
    this.ui?.setBoneCount(progress.getItemCount('bone'));
    this.time.delayedCall(BONE_DISTRACT_MS, () => bone.destroy());
    return true;
  }

  _setupCat() {
    const p = this.maze.tileToWorld(this.startTile.x, this.startTile.y);
    this.cat = new Cat(this, p.x, p.y, this.skin);
    this.physics.add.collider(this.cat, this.walls);

    this.physics.add.overlap(this.cat, this.exit, () => this._win(), null, this);
    this.physics.add.overlap(this.cat, this.coinGroup, this._collectCoin, null, this);
    this.physics.add.overlap(this.cat, this.shieldGroup, this._collectShield, null, this);

    // Появление котика
    this.cat.setScale(0);
    this.tweens.add({ targets: this.cat, scale: this.cat.baseScale, duration: 400, ease: 'Back.easeOut' });

    // Щит, купленный в магазине про запас, экипируется автоматически на
    // старте уровня — без кнопки, без выбора момента, заряд тратится сразу.
    if (progress.getItemCount('shield') > 0) {
      progress.useItemCharge('shield');
      this._applyShield();
    }
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
    const onVanished = (dog, reason) => {
      if (this.finished) return;
      // Истёк таймер погони у одной — уходит ВСЯ стая. С личными таймерами
      // собаки исчезали и появлялись по кругу без единой передышки (тест с
      // Лианой). Каждая уведённая собака сама назначит себе замену ниже,
      // так что стая вернётся волной после respawnGap.
      if (reason === 'chase') {
        this.dogs.getChildren().forEach((d) => {
          if (d !== dog && !d.dead) d.vanish();
        });
      }
      this.time.delayedCall(this.cfg.respawnGap, () => this._spawnDog());
    };
    this.events.on('dog-vanished', onVanished);
    this.events.once('shutdown', () => this.events.off('dog-vanished', onVanished));
  }

  _spawnDog() {
    if (this.finished || !this.scene.isActive()) return;
    // Считаем только живых: исчезающая собака ещё числится в группе, пока
    // играет анимацию растворения, и блокировала бы спавн своей замены.
    const alive = this.dogs.getChildren().filter((d) => !d.dead).length;
    if (alive >= this.cfg.dogs) return;

    const catTile = this.maze.worldToTile(this.cat.x, this.cat.y);
    const t = pickSpawnTile(this.maze, catTile, DOG_SPAWN_MIN, this.dogReach);
    const p = this.maze.tileToWorld(t.x, t.y);
    // Порода — случайная из ВКЛЮЧЁННЫХ игроком в магазине (см. progress)
    const breed = randomEnemyBreed(progress.getEnabledDogs());
    const dog = new Dog(this, p.x, p.y, this.maze, dogSpeedFor(this.cfg), breed);
    this.dogs.add(dog);
    this.physics.add.collider(dog, this.walls);
  }

  _onDogTouch(cat, dog) {
    if (this.finished || dog.dead) return;
    // Замороженная собака не ловит — это не спецэффект щита, а логика: раз она
    // оглушена и не двигается, она физически остаётся в зоне касания на кадры
    // ПОСЛЕ того, как щит уже лопнул, и без этой проверки тут же засчитывалась
    // бы вторая, нелегитимная поимка тем же прыжком.
    if (dog.frozenUntil > this.time.now) return;
    if (cat.isSafe) return; // в коробке собака не страшна — это вся суть укрытия
    if (cat.hasShield) { this._popShield(dog); return; } // щит прощает одну поимку
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

    // Банк монет — ТОЛЬКО при победе: собранные на карте + бонус за прохождение.
    // При гибели собранное сгорает, иначе фарм ломается фермой смертей.
    const earned = COINS_PER_LEVEL + this.collected;
    progress.addCoins(earned);
    progress.markLevelComplete(this.levelNum, TOTAL_LEVELS);
    this.ui?.setCoins(progress.getCoins());

    const last = this.levelNum >= TOTAL_LEVELS;
    this.ui?.showMessage(
      (last ? 'Ура! Ты прошла всю игру!' : `Уровень ${this.levelNum} пройден!`) +
        `\n+${earned} 🪙`
    );

    this.time.delayedCall(1700, () => {
      this.scene.stop('UI');
      // Обычное прохождение — на следующий уровень. Последний — на выбор уровня,
      // чтобы фарм был под рукой (перепройти любой открытый).
      if (last) this.scene.start('LevelSelect');
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

    // Аура щита ходит вместе с котиком — Cat не контейнер, поэтому позиция
    // подтягивается вручную, а не через parent/child.
    if (this.cat.hasShield && this.shieldAura) this.shieldAura.setPosition(this.cat.x, this.cat.y);

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
