// Экран выбора котика.

import { CATS, DEFAULT_CAT } from '../config/cats.js';
import { PALETTE, FONT } from '../config/assets.js';

const SAVE_KEY = 'cat_maze_skin';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    const { width: w, height: h } = this.scale;
    this.cameras.main.setBackgroundColor(PALETTE.bg);

    this.selected = localStorage.getItem(SAVE_KEY) || DEFAULT_CAT;

    this.add
      .text(w / 2, h * 0.1, 'Котик в Лабиринте', {
        fontFamily: FONT, fontSize: '34px', color: '#FFFFFF', stroke: '#5B4A6F', strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.add
      .text(w / 2, h * 0.17, 'Выбери котика!', { fontFamily: FONT, fontSize: '20px', color: '#5B4A6F' })
      .setOrigin(0.5);

    // Сетка 2x2 — крупные карточки под детский палец
    const cardW = Math.min(140, w * 0.4);
    const cardH = cardW * 1.15;
    const gapX = w * 0.5 - cardW / 2 - 8;
    const startY = h * 0.28;

    this.cards = [];
    CATS.forEach((cat, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = w / 2 + (col === 0 ? -1 : 1) * (cardW / 2 + 8);
      const y = startY + row * (cardH + 14) + cardH / 2;
      this.cards.push(this._makeCard(cat, x, y, cardW, cardH));
    });

    this._makePlayButton(w / 2, h * 0.88);
    this._highlight();
  }

  _makeCard(cat, x, y, cw, ch) {
    const c = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, cw, ch, PALETTE.uiLight).setStrokeStyle(4, PALETTE.ui, 0.25);
    bg.setInteractive({ useHandCursor: true });
    // скругление даёт "мягкость" — важнее, чем кажется, для детского UI
    if (bg.setRadius) bg.setRadius(16);

    // На карточке котик сидит — так лучше видно мордочку и окраску
    const sprite = this.add.image(0, -ch * 0.08, `cat_${cat.id}_sit`);
    sprite.setScale(Math.min((cw * 0.62) / sprite.width, (ch * 0.5) / sprite.height));
    const name = this.add
      .text(0, ch * 0.34, cat.name, { fontFamily: FONT, fontSize: '17px', color: '#5B4A6F' })
      .setOrigin(0.5);

    c.add([bg, sprite, name]);

    bg.on('pointerover', () => this.tweens.add({ targets: c, scale: 1.05, duration: 120 }));
    bg.on('pointerout', () => this.tweens.add({ targets: c, scale: 1, duration: 120 }));
    bg.on('pointerdown', () => {
      this.selected = cat.id;
      localStorage.setItem(SAVE_KEY, cat.id);
      this._highlight();
      // котик подпрыгивает — подтверждение выбора без единого слова
      this.tweens.add({ targets: sprite, y: sprite.y - 10, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
      this.sfx?.('meow');
    });

    return { cat, container: c, bg, sprite };
  }

  _highlight() {
    for (const card of this.cards) {
      const on = card.cat.id === this.selected;
      card.bg.setStrokeStyle(on ? 6 : 4, on ? PALETTE.exit : PALETTE.ui, on ? 1 : 0.25);
      card.bg.setFillStyle(on ? 0xFFFDF5 : PALETTE.uiLight);
    }
  }

  _makePlayButton(x, y) {
    const c = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 200, 62, 0x7ED9A0).setStrokeStyle(4, 0x4FB37A);
    if (bg.setRadius) bg.setRadius(20);
    bg.setInteractive({ useHandCursor: true });
    const t = this.add
      .text(0, 0, 'ИГРАТЬ', {
        fontFamily: FONT, fontSize: '26px', color: '#FFFFFF', stroke: '#4FB37A', strokeThickness: 3,
      })
      .setOrigin(0.5);
    c.add([bg, t]);

    this.tweens.add({ targets: c, scale: 1.05, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    bg.on('pointerdown', () => {
      this.scene.start('Game', { level: 1, skin: this.selected });
    });
  }
}
