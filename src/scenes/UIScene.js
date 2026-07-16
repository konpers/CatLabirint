// HUD поверх игры. Отдельная сцена — чтобы не ездила вместе с камерой.

import { PALETTE, FONT } from '../config/assets.js';

const RUN_KEY = 'cat_maze_run';

export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UI', active: false });
  }

  init(data) {
    this.levelNum = data.level || 1;
    this.hint = data.hint || '';
    // Режим бега помним между уровнями и перезапусками: включил один раз —
    // и не надо жать заново после каждой пойманной собаки.
    this.runHeld = localStorage.getItem(RUN_KEY) === '1';
    this.panel = null; // открытое меню паузы
  }

  create() {
    const { width: w } = this.scale;

    this.add
      .text(14, 12, `Уровень ${this.levelNum}`, {
        fontFamily: FONT, fontSize: '20px', color: '#FFFFFF', stroke: '#5B4A6F', strokeThickness: 4,
      })
      .setScrollFactor(0);

    // Подсказка показывается пару секунд в начале уровня и уезжает.
    // Ниже строки «Уровень N» и плашки укрытия — они налезали друг на друга.
    const hint = this.add
      .text(w / 2, 92, this.hint, {
        fontFamily: FONT, fontSize: '17px', color: '#5B4A6F',
        backgroundColor: '#FFF6EC', padding: { x: 12, y: 7 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.tweens.add({ targets: hint, alpha: 0, delay: 3200, duration: 700, onComplete: () => hint.destroy() });

    // Кнопка паузы — правый верхний угол
    this.menuBtn = this.add
      .text(w - 12, 8, '⏸', {
        fontFamily: FONT, fontSize: '30px', color: '#FFFFFF',
        stroke: '#5B4A6F', strokeThickness: 5, padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.menuBtn.on('pointerdown', () => this._openMenu());

    // Таймер собаки — левее кнопки паузы
    this.dogLabel = this.add
      .text(w - 64, 12, '', {
        fontFamily: FONT, fontSize: '19px', color: '#FFFFFF', stroke: '#C4563E', strokeThickness: 4,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0);

    // Индикатор укрытия
    this.safeLabel = this.add
      .text(w / 2, 48, '🛡 Ты в укрытии!', {
        fontFamily: FONT, fontSize: '18px', color: '#3E7D5A',
        backgroundColor: '#DFF5E6', padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setVisible(false);

    this._makeRunButton();

    // Экран телефона меняет размер (поворот, адресная строка) — HUD-кнопки
    // должны переехать вслед за углами.
    this.scale.on('resize', this._layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this._layout, this));
  }

  // --- Кнопка бега -------------------------------------------------------
  // Правый нижний угол — под большой палец правой руки (джойстик слева).
  //
  // ПЕРЕКЛЮЧАТЕЛЬ, а не «держать»: одной рукой вести джойстик и одновременно
  // удерживать кнопку неудобно (жалоба с теста). Нажал — режим бега включён и
  // держится сам, нажал ещё раз — выключен. На компьютере остаётся SHIFT.

  _makeRunButton() {
    const { width: w, height: h } = this.scale;
    const c = this.add.container(w - 68, h - 92).setScrollFactor(0).setDepth(500);

    const bg = this.add.circle(0, 0, 44, 0xFFFFFF, 0.35).setStrokeStyle(4, 0x5B4A6F, 0.35);
    const icon = this.add.text(0, -2, '💨', { fontSize: '34px' }).setOrigin(0.5);
    const label = this.add
      .text(0, 26, 'БЕГ', { fontFamily: FONT, fontSize: '13px', color: '#5B4A6F' })
      .setOrigin(0.5);
    c.add([bg, icon, label]);

    // Зона нажатия крупнее кружка — детский палец не обязан попадать точно.
    // Координаты зоны — ЛОКАЛЬНЫЕ для кружка: его начало в левом верхнем углу
    // рамки (не в центре!), поэтому центр зоны = (радиус, радиус).
    bg.setInteractive(new Phaser.Geom.Circle(44, 44, 58), Phaser.Geom.Circle.Contains);

    this._runBg = bg;
    this._runLabel = label;
    bg.on('pointerdown', () => this._toggleRun());

    this.runBtn = c;
    this._paintRun();
  }

  _toggleRun() {
    this.runHeld = !this.runHeld;
    localStorage.setItem(RUN_KEY, this.runHeld ? '1' : '0');
    this._paintRun();
    // короткий отклик на нажатие — видно, что кнопка сработала
    this.tweens.add({ targets: this.runBtn, scale: 0.9, duration: 90, yoyo: true });
  }

  /** Вид кнопки должен ясно показывать РЕЖИМ: включён бег или нет. */
  _paintRun() {
    if (!this._runBg) return;
    if (this.runHeld) {
      this._runBg.setFillStyle(0xFFD65C, 0.85);
      this._runBg.setStrokeStyle(4, 0xE0A83A, 1);
      this._runLabel.setText('БЕГ ✓').setColor('#7A5A10');
    } else {
      this._runBg.setFillStyle(0xFFFFFF, 0.35);
      this._runBg.setStrokeStyle(4, 0x5B4A6F, 0.35);
      this._runLabel.setText('БЕГ').setColor('#5B4A6F');
    }
  }

  // --- Меню паузы ----------------------------------------------------------

  _openMenu() {
    if (this.panel) return;
    const game = this.scene.get('Game');
    if (game.finished) return; // во время «уровень пройден» меню не нужно
    this.scene.pause('Game');

    const { width: w, height: h } = this.scale;
    const dim = this.add
      .rectangle(w / 2, h / 2, w * 2, h * 2, 0x000000, 0.45)
      .setInteractive(); // глушит клики по игре под панелью

    const boxW = Math.min(300, w * 0.86);
    const box = this.add.rectangle(w / 2, h / 2, boxW, 250, 0xFFF6EC).setStrokeStyle(4, PALETTE.ui, 0.35);
    const title = this.add
      .text(w / 2, h / 2 - 88, 'Пауза', { fontFamily: FONT, fontSize: '26px', color: '#5B4A6F' })
      .setOrigin(0.5);

    const items = [
      this._menuItem(w / 2, h / 2 - 34, boxW - 40, 0x7ED9A0, 'Продолжить', () => this._closeMenu()),
      this._menuItem(w / 2, h / 2 + 24, boxW - 40, 0xFFD65C, 'Начать заново', () => {
        // Заново ТЕКУЩИЙ уровень (с новым лабиринтом — так устроен restart)
        const { levelNum, skin } = game;
        this._closeMenu();
        game.scene.restart({ level: levelNum, skin });
        this.scene.stop(); // Game.create поднимет свежий HUD сам
      }),
      this._menuItem(w / 2, h / 2 + 82, boxW - 40, 0xF2A8B4, 'В главное меню', () => {
        this.scene.stop('Game');
        this.scene.start('Menu'); // start останавливает UI и открывает меню
      }),
    ];

    this.panel = this.add.container(0, 0, [dim, box, title, ...items.flat()])
      .setScrollFactor(0)
      .setDepth(2000);
  }

  _closeMenu() {
    this.panel?.destroy();
    this.panel = null;
    this.scene.resume('Game');
  }

  _menuItem(x, y, width, color, label, onClick) {
    const bg = this.add.rectangle(x, y, width, 46, color).setStrokeStyle(3, 0x5B4A6F, 0.25);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', onClick);
    const t = this.add
      .text(x, y, label, { fontFamily: FONT, fontSize: '19px', color: '#4A3D5C' })
      .setOrigin(0.5);
    return [bg, t];
  }

  // --- Раскладка при смене размера экрана ---------------------------------

  _layout() {
    const { width: w, height: h } = this.scale;
    this.menuBtn?.setPosition(w - 12, 8);
    this.dogLabel?.setPosition(w - 64, 12);
    this.runBtn?.setPosition(w - 68, h - 92);
    this.safeLabel?.setPosition(w / 2, 48);
    // Открытую паузу проще перестроить, чем двигать по частям
    if (this.panel) {
      this.panel.destroy();
      this.panel = null;
      this._openMenu();
    }
  }

  /**
   * @param {number} ms сколько осталось погони у ближайшей собаки (0 — никто не нашёл)
   * @param {boolean} anyDog есть ли на уровне собаки вообще
   */
  setDogTimer(ms, anyDog) {
    if (!this.dogLabel) return;
    if (ms > 0) {
      this.dogLabel.setText(`🐶 ${Math.ceil(ms / 1000)}`);
    } else if (anyDog) {
      // Собака где-то есть, но котика ещё не нашла — держим в напряжении,
      // но не врём цифрой.
      this.dogLabel.setText('🐶 ...');
    } else {
      this.dogLabel.setText('');
    }
  }

  setSafe(on) {
    this.safeLabel?.setVisible(on);
  }

  showMessage(text) {
    const { width: w, height: h } = this.scale;
    const t = this.add
      .text(w / 2, h / 2, text, {
        fontFamily: FONT, fontSize: '26px', color: '#FFFFFF',
        stroke: '#5B4A6F', strokeThickness: 6, align: 'center',
        wordWrap: { width: w * 0.8 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setScale(0);
    this.tweens.add({ targets: t, scale: 1, duration: 400, ease: 'Back.easeOut' });
  }
}
