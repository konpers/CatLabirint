// HUD поверх игры. Отдельная сцена — чтобы не ездила вместе с камерой.

import { PALETTE, FONT } from '../config/assets.js';
import { ABILITIES } from '../config/abilities.js';
import * as progress from '../config/progress.js';

export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UI', active: false });
  }

  init(data) {
    this.levelNum = data.level || 1;
    this.hint = data.hint || '';
    this.startCoins = data.coins || 0;
    this.panel = null; // открытое меню паузы
  }

  create() {
    const { width: w } = this.scale;

    this.add
      .text(14, 12, `Уровень ${this.levelNum}`, {
        fontFamily: FONT, fontSize: '20px', color: '#FFFFFF', stroke: '#5B4A6F', strokeThickness: 4,
      })
      .setScrollFactor(0);

    // Счётчик монет — под номером уровня
    this.coinLabel = this.add
      .text(14, 40, `🪙 ${this.startCoins}`, {
        fontFamily: FONT, fontSize: '19px', color: '#FFFFFF', stroke: '#B77E1E', strokeThickness: 4,
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

    this._makeAbilityBar();

    // Экран телефона меняет размер (поворот, адресная строка) — HUD-кнопки
    // должны переехать вслед за углами.
    this.scale.on('resize', this._layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this._layout, this));
  }

  // --- Бар способностей ----------------------------------------------------
  // Правый нижний угол — там раньше жила кнопка БЕГ (её убрали, бег теперь
  // всегда включён, и это место освободилось под способности).
  //
  // Рисуем кнопку для каждой АКТИВНОЙ способности (kind: 'active' в
  // abilities.js) — сейчас это только «косточка», но цикл уже готов принять
  // вторую-третью без переделки HUD. Пассивные способности (щит) кнопки не
  // получают — применяются автоматически.

  _makeAbilityBar() {
    const { width: w, height: h } = this.scale;
    const active = ABILITIES.filter((a) => a.kind === 'active');
    this.abilityButtons = {};

    active.forEach((ability, i) => {
      const x = w - 68 - i * 76; // ряд от угла влево, если способностей станет больше
      const y = h - 92;
      const c = this.add.container(x, y).setScrollFactor(0).setDepth(500);

      const bg = this.add.circle(0, 0, 44, 0xFFFFFF, 0.35).setStrokeStyle(4, 0x5B4A6F, 0.35);
      const icon = this.add.text(0, -6, ability.id === 'bone' ? '🦴' : '✨', { fontSize: '30px' }).setOrigin(0.5);
      const badge = this.add
        .text(20, -28, '0', {
          fontFamily: FONT, fontSize: '15px', color: '#FFFFFF',
          backgroundColor: '#C4563E', padding: { x: 6, y: 2 },
        })
        .setOrigin(0.5);
      c.add([bg, icon, badge]);

      // Зона нажатия крупнее кружка — детский палец не обязан попадать точно.
      // Координаты — ЛОКАЛЬНЫЕ для кружка: начало в левом верхнем углу рамки
      // (не в центре!), центр зоны = (радиус, радиус).
      bg.setInteractive(new Phaser.Geom.Circle(44, 44, 58), Phaser.Geom.Circle.Contains);
      bg.on('pointerdown', () => this._useAbility(ability.id));

      this.abilityButtons[ability.id] = { container: c, bg, badge, count: 0 };
    });

    this._refreshAbilityButtons();
  }

  /** Разовый тап — не переключатель. Пусто, если заряд не расходуется (нет игры/сцены). */
  _useAbility(id) {
    const btn = this.abilityButtons[id];
    if (!btn || btn.count <= 0) return; // кнопка и так должна быть тусклой при 0
    const game = this.scene.get('Game');
    if (!game?.scene.isActive() || game.finished) return;
    const used = id === 'bone' ? game._useBone() : false;
    if (used) this.tweens.add({ targets: btn.container, scale: 0.88, duration: 90, yoyo: true });
  }

  /** Перечитывает остатки зарядов из прогресса и перекрашивает кнопки. */
  _refreshAbilityButtons() {
    for (const [id, btn] of Object.entries(this.abilityButtons || {})) {
      this.setAbilityCount(id, progress.getItemCount(id));
    }
  }

  /** Обновляет бейдж и "живость" кнопки способности. Дёргается из GameScene. */
  setAbilityCount(id, n) {
    const btn = this.abilityButtons?.[id];
    if (!btn) return;
    btn.count = n;
    btn.badge.setText(String(n));
    const has = n > 0;
    btn.bg.setFillStyle(has ? 0xFFD65C : 0xFFFFFF, has ? 0.85 : 0.25);
    btn.bg.setStrokeStyle(4, has ? 0xE0A83A : 0x5B4A6F, has ? 1 : 0.2);
    btn.container.setAlpha(has ? 1 : 0.5);
  }

  /** Совместимость с GameScene._useBone(), который зовёт именно этот метод. */
  setBoneCount(n) {
    this.setAbilityCount('bone', n);
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
    const box = this.add.rectangle(w / 2, h / 2, boxW, 316, 0xFFF6EC).setStrokeStyle(4, PALETTE.ui, 0.35);
    const title = this.add
      .text(w / 2, h / 2 - 120, 'Пауза', { fontFamily: FONT, fontSize: '26px', color: '#5B4A6F' })
      .setOrigin(0.5);

    const iw = boxW - 40;
    const items = [
      this._menuItem(w / 2, h / 2 - 70, iw, 0x7ED9A0, 'Продолжить', () => this._closeMenu()),
      this._menuItem(w / 2, h / 2 - 14, iw, 0xFFD65C, 'Начать заново', () => {
        // Заново ТЕКУЩИЙ уровень (с новым лабиринтом — так устроен restart)
        const { levelNum, skin } = game;
        this._closeMenu();
        game.scene.restart({ level: levelNum, skin });
        this.scene.stop(); // Game.create поднимет свежий HUD сам
      }),
      this._menuItem(w / 2, h / 2 + 42, iw, 0xFFC178, 'Магазин', () => {
        this.scene.stop('Game');
        this.scene.start('Shop');
      }),
      this._menuItem(w / 2, h / 2 + 98, iw, 0xF2A8B4, 'В главное меню', () => {
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
    Object.values(this.abilityButtons || {}).forEach((btn, i) => {
      btn.container.setPosition(w - 68 - i * 76, h - 92);
    });
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

  setCoins(n) {
    this.coinLabel?.setText(`🪙 ${n}`);
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
