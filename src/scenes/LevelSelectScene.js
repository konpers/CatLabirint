// Экран выбора уровня. Открыты уровни ≤ maxLevel (см. progress), дальше — замок.
// Это же экран фарма: перепроходи любой открытый уровень ради монет.

import { LEVELS, TOTAL_LEVELS } from '../config/levels.js';
import { PALETTE, FONT } from '../config/assets.js';
import * as progress from '../config/progress.js';

export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelect');
  }

  create() {
    const { width: w, height: h } = this.scale;
    this.cameras.main.setBackgroundColor(PALETTE.bg);

    this.add
      .text(w / 2, h * 0.08, 'Выбери уровень', {
        fontFamily: FONT, fontSize: '30px', color: '#FFFFFF', stroke: '#5B4A6F', strokeThickness: 6,
      })
      .setOrigin(0.5);

    this._coinBadge(w - 16, 16);
    this._backButton(16, 16);

    const maxLevel = progress.getMaxLevel();

    // Сетка узлов: 2 колонки × 4 ряда для 8 уровней
    const cols = 2;
    const cell = Math.min(120, w * 0.36);
    const gap = 18;
    const gridW = cols * cell + (cols - 1) * gap;
    const startX = (w - gridW) / 2 + cell / 2;
    const startY = h * 0.2;

    LEVELS.forEach((lvl, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cell + gap);
      const y = startY + row * (cell + gap) + cell / 2;
      this._levelNode(lvl, x, y, cell, lvl.n <= maxLevel);
    });

    this._shopButton(w / 2, h * 0.93);
  }

  _levelNode(lvl, x, y, size, unlocked) {
    const c = this.add.container(x, y);
    const bg = this.add
      .rectangle(0, 0, size, size, unlocked ? 0xFFF6EC : 0xD8D2C4)
      .setStrokeStyle(4, unlocked ? PALETTE.exit : PALETTE.ui, unlocked ? 1 : 0.3);
    if (bg.setRadius) bg.setRadius(18);
    c.add(bg);

    if (unlocked) {
      const num = this.add
        .text(0, -8, `${lvl.n}`, { fontFamily: FONT, fontSize: '40px', color: '#5B4A6F' })
        .setOrigin(0.5);
      // маленькая подпись про врагов, чтобы уровень «читался»
      const sub = this.add
        .text(0, size * 0.28, lvl.dogs ? `🐶 ×${lvl.dogs}` : 'без собак', {
          fontFamily: FONT, fontSize: '14px', color: '#8A7BA0',
        })
        .setOrigin(0.5);
      c.add([num, sub]);

      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => this.tweens.add({ targets: c, scale: 1.06, duration: 120 }));
      bg.on('pointerout', () => this.tweens.add({ targets: c, scale: 1, duration: 120 }));
      bg.on('pointerdown', () => {
        this.scene.start('Game', { level: lvl.n, skin: progress.getSelectedCat() });
      });
    } else {
      const lock = this.add.text(0, 0, '🔒', { fontSize: '40px' }).setOrigin(0.5);
      c.add(lock);
    }
    return c;
  }

  // --- Общие элементы (те же в Menu и Shop) ---

  _coinBadge(x, y) {
    this.add
      .text(x, y, `🪙 ${progress.getCoins()}`, {
        fontFamily: FONT, fontSize: '22px', color: '#FFFFFF', stroke: '#B77E1E', strokeThickness: 5,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0);
  }

  _backButton(x, y) {
    const b = this.add
      .text(x, y, '← Меню', {
        fontFamily: FONT, fontSize: '20px', color: '#5B4A6F',
        backgroundColor: '#FFF6EC', padding: { x: 12, y: 8 },
      })
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    b.on('pointerdown', () => this.scene.start('Menu'));
  }

  _shopButton(x, y) {
    const c = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 200, 56, 0xFFC178).setStrokeStyle(4, 0xE0A83A);
    if (bg.setRadius) bg.setRadius(18);
    bg.setInteractive({ useHandCursor: true });
    const t = this.add
      .text(0, 0, '🛒 Магазин', { fontFamily: FONT, fontSize: '22px', color: '#7A5A10' })
      .setOrigin(0.5);
    c.add([bg, t]);
    bg.on('pointerdown', () => this.scene.start('Shop'));
  }
}
