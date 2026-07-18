// Главное меню: выбор котика + вход в магазин и к игре.

import { CATS } from '../config/cats.js';
import { PALETTE, FONT } from '../config/assets.js';
import * as progress from '../config/progress.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    const { width: w, height: h } = this.scale;
    this.cameras.main.setBackgroundColor(PALETTE.bg);

    this.selected = progress.getSelectedCat();

    this.add
      .text(w / 2, h * 0.09, 'Котик в Лабиринте', {
        fontFamily: FONT, fontSize: '32px', color: '#FFFFFF', stroke: '#5B4A6F', strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.add
      .text(w / 2, h * 0.16, 'Выбери котика!', { fontFamily: FONT, fontSize: '20px', color: '#5B4A6F' })
      .setOrigin(0.5);

    // Баланс монет — правый верхний угол
    this.add
      .text(w - 16, 16, `🪙 ${progress.getCoins()}`, {
        fontFamily: FONT, fontSize: '22px', color: '#FFFFFF', stroke: '#B77E1E', strokeThickness: 5,
      })
      .setOrigin(1, 0);

    // Показываем только КУПЛЕННЫХ персонажей (изначально 4, растёт после покупок).
    // Новых покупают в магазине — здесь только выбор из своих.
    const owned = CATS.filter((c) => progress.isCatUnlocked(c.id));

    // Колонок больше, когда персонажей много, чтобы уместить без прокрутки.
    const cols = owned.length <= 4 ? 2 : owned.length <= 6 ? 3 : 4;
    const rows = Math.ceil(owned.length / cols);
    const gap = 10;
    const cardW = Math.min(140, (w - 24) / cols - gap);
    const cardH = cardW * 1.15;
    const startY = h * 0.26;

    this.cards = [];
    owned.forEach((cat, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const inRow = Math.min(cols, owned.length - row * cols);
      const rowW = inRow * cardW + (inRow - 1) * gap;
      const x = (w - rowW) / 2 + cardW / 2 + col * (cardW + gap);
      const y = startY + row * (cardH + 14) + cardH / 2;
      this.cards.push(this._makeCard(cat, x, y, cardW, cardH));
    });

    this._makeShopButton(w / 2, h * 0.82);
    this._makePlayButton(w / 2, h * 0.92);
    this._highlight();
  }

  _makeCard(cat, x, y, cw, ch) {
    const c = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, cw, ch, PALETTE.uiLight).setStrokeStyle(4, PALETTE.ui, 0.25);
    bg.setInteractive({ useHandCursor: true });
    if (bg.setRadius) bg.setRadius(16);

    // На карточке котик сидит — так лучше видно мордочку и окраску
    const sprite = this.add.image(0, -ch * 0.08, `cat_${cat.id}_sit`);
    sprite.setScale(Math.min((cw * 0.62) / sprite.width, (ch * 0.5) / sprite.height));
    const name = this.add
      .text(0, ch * 0.34, cat.name, { fontFamily: FONT, fontSize: '17px', color: '#5B4A6F' })
      .setOrigin(0.5);
    // Замок на закрытом котике — тап ведёт в магазин
    const lock = this.add.text(0, -ch * 0.08, '🔒', { fontSize: '40px' }).setOrigin(0.5).setVisible(false);

    c.add([bg, sprite, name, lock]);

    bg.on('pointerover', () => this.tweens.add({ targets: c, scale: 1.05, duration: 120 }));
    bg.on('pointerout', () => this.tweens.add({ targets: c, scale: 1, duration: 120 }));
    bg.on('pointerdown', () => {
      if (!progress.isCatUnlocked(cat.id)) {
        this.scene.start('Shop'); // закрытого котика покупают в магазине
        return;
      }
      this.selected = cat.id;
      progress.setSelectedCat(cat.id);
      this._highlight();
      this.tweens.add({ targets: sprite, y: sprite.y - 10, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
      this.sfx?.('meow');
    });

    return { cat, container: c, bg, sprite, lock };
  }

  _highlight() {
    for (const card of this.cards) {
      const owned = progress.isCatUnlocked(card.cat.id);
      const on = owned && card.cat.id === this.selected;
      card.lock.setVisible(!owned);
      card.sprite.setAlpha(owned ? 1 : 0.35);
      card.bg.setStrokeStyle(on ? 6 : 4, on ? PALETTE.exit : PALETTE.ui, on ? 1 : 0.25);
      card.bg.setFillStyle(on ? 0xFFFDF5 : PALETTE.uiLight);
    }
  }

  _makeShopButton(x, y) {
    const c = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 200, 52, 0xFFC178).setStrokeStyle(4, 0xE0A83A);
    if (bg.setRadius) bg.setRadius(18);
    bg.setInteractive({ useHandCursor: true });
    const t = this.add
      .text(0, 0, '🛒 Магазин', { fontFamily: FONT, fontSize: '22px', color: '#7A5A10' })
      .setOrigin(0.5);
    c.add([bg, t]);
    bg.on('pointerdown', () => this.scene.start('Shop'));
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

    // К выбору уровня — оттуда можно начать или перепройти любой открытый
    bg.on('pointerdown', () => this.scene.start('LevelSelect'));
  }
}
