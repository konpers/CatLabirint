// Магазин и кастомизация. Две секции:
//   Котики — покупка за монеты + выбор персонажа (кого ведём по лабиринту).
//   Собаки — покупка пород + включение/выключение их как активных врагов.
//
// Данные берутся из cats.js / dogs.js; что открыто/выбрано/включено — из progress.

import { CATS } from '../config/cats.js';
import { DOGS } from '../config/dogs.js';
import { PALETTE, FONT } from '../config/assets.js';
import * as progress from '../config/progress.js';

export class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop');
  }

  create() {
    const { width: w, height: h } = this.scale;
    this.cameras.main.setBackgroundColor(PALETTE.bg);

    this.add
      .text(w / 2, h * 0.06, 'Магазин', {
        fontFamily: FONT, fontSize: '30px', color: '#FFFFFF', stroke: '#5B4A6F', strokeThickness: 6,
      })
      .setOrigin(0.5);

    this._makeCoinBadge(w - 16, 16);
    this._backButton(16, 16);

    // --- Секция котиков ---
    this.add
      .text(w / 2, h * 0.15, '🐱 Котики', { fontFamily: FONT, fontSize: '20px', color: '#5B4A6F' })
      .setOrigin(0.5);
    this.catCards = [];
    this._row(CATS, h * 0.19, (cat, x, y, size) => this._catCard(cat, x, y, size));

    // --- Секция собак ---
    this.add
      .text(w / 2, h * 0.52, '🐶 Враги (кто гоняется)', { fontFamily: FONT, fontSize: '20px', color: '#5B4A6F' })
      .setOrigin(0.5);
    this.dogCards = [];
    this._row(DOGS, h * 0.56, (dog, x, y, size) => this._dogCard(dog, x, y, size));

    this._hint(w / 2, h * 0.9);
  }

  /** Раскладывает элементы массива в ряд по центру, при тесноте — уменьшает. */
  _row(items, y, makeCard) {
    const { width: w } = this.scale;
    const n = items.length;
    const size = Math.min(96, (w - 24) / n - 10);
    const gap = 10;
    const rowW = n * size + (n - 1) * gap;
    const startX = (w - rowW) / 2 + size / 2;
    items.forEach((it, i) => makeCard(it, startX + i * (size + gap), y + size / 2, size));
  }

  // --- Карточка котика: куплен → выбрать; закрыт → купить ---

  _catCard(cat, x, y, size) {
    const c = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, size, size * 1.25, PALETTE.uiLight).setStrokeStyle(4, PALETTE.ui, 0.25);
    if (bg.setRadius) bg.setRadius(14);
    const sprite = this.add.image(0, -size * 0.12, `cat_${cat.id}_sit`);
    sprite.setScale(Math.min((size * 0.6) / sprite.width, (size * 0.6) / sprite.height));
    const label = this.add.text(0, size * 0.42, '', { fontFamily: FONT, fontSize: '13px', color: '#5B4A6F' }).setOrigin(0.5);
    const lock = this.add.text(0, -size * 0.12, '🔒', { fontSize: `${size * 0.4}px` }).setOrigin(0.5).setVisible(false);
    c.add([bg, sprite, label, lock]);

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => this._onCatTap(cat));

    const card = { kind: 'cat', item: cat, container: c, bg, sprite, label, lock };
    this.catCards.push(card);
    this._paintCat(card);
    return c;
  }

  _onCatTap(cat) {
    if (progress.isCatUnlocked(cat.id)) {
      progress.setSelectedCat(cat.id);
    } else if (progress.buyCat(cat.id, cat.price)) {
      progress.setSelectedCat(cat.id); // купил — сразу выбрали
      this._flashCoins();
    } else {
      this._denied(); // не хватило монет
      return;
    }
    this._refresh();
  }

  _paintCat(card) {
    const cat = card.item;
    const owned = progress.isCatUnlocked(cat.id);
    const selected = owned && progress.getSelectedCat() === cat.id;
    card.lock.setVisible(!owned);
    card.sprite.setAlpha(owned ? 1 : 0.35);

    if (!owned) {
      card.label.setText(`🪙 ${cat.price}`).setColor('#B77E1E');
      card.bg.setStrokeStyle(4, PALETTE.ui, 0.25).setFillStyle(0xEDE7DC);
    } else if (selected) {
      card.label.setText('✓ выбран').setColor('#3E7D5A');
      card.bg.setStrokeStyle(6, PALETTE.exit, 1).setFillStyle(0xFFFDF5);
    } else {
      card.label.setText(cat.name).setColor('#5B4A6F');
      card.bg.setStrokeStyle(4, PALETTE.ui, 0.25).setFillStyle(PALETTE.uiLight);
    }
  }

  // --- Карточка собаки: куплена → вкл/выкл врага; закрыта → купить ---

  _dogCard(dog, x, y, size) {
    const c = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, size, size * 1.25, PALETTE.uiLight).setStrokeStyle(4, PALETTE.ui, 0.25);
    if (bg.setRadius) bg.setRadius(14);
    const sprite = this.add.image(0, -size * 0.12, `dog_${dog.id}_run_0`);
    sprite.setScale(Math.min((size * 0.62) / sprite.width, (size * 0.62) / sprite.height));
    const label = this.add.text(0, size * 0.42, '', { fontFamily: FONT, fontSize: '13px', color: '#5B4A6F' }).setOrigin(0.5);
    const lock = this.add.text(0, -size * 0.12, '🔒', { fontSize: `${size * 0.4}px` }).setOrigin(0.5).setVisible(false);
    c.add([bg, sprite, label, lock]);

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => this._onDogTap(dog));

    const card = { kind: 'dog', item: dog, container: c, bg, sprite, label, lock };
    this.dogCards.push(card);
    this._paintDog(card);
    return c;
  }

  _onDogTap(dog) {
    if (progress.isDogUnlocked(dog.id)) {
      progress.toggleDog(dog.id); // включить/выключить как врага
    } else if (progress.buyDog(dog.id, dog.price)) {
      this._flashCoins();
    } else {
      this._denied();
      return;
    }
    this._refresh();
  }

  _paintDog(card) {
    const dog = card.item;
    const owned = progress.isDogUnlocked(dog.id);
    const on = owned && progress.isDogEnabled(dog.id);
    card.lock.setVisible(!owned);
    card.sprite.setAlpha(owned ? (on ? 1 : 0.5) : 0.35);

    if (!owned) {
      card.label.setText(`🪙 ${dog.price}`).setColor('#B77E1E');
      card.bg.setStrokeStyle(4, PALETTE.ui, 0.25).setFillStyle(0xEDE7DC);
    } else if (on) {
      card.label.setText('✓ гоняется').setColor('#C4563E');
      card.bg.setStrokeStyle(6, PALETTE.danger, 1).setFillStyle(0xFFF1EC);
    } else {
      card.label.setText('выключен').setColor('#8A7BA0');
      card.bg.setStrokeStyle(4, PALETTE.ui, 0.25).setFillStyle(PALETTE.uiLight);
    }
  }

  _refresh() {
    this.catCards.forEach((c) => this._paintCat(c));
    this.dogCards.forEach((c) => this._paintDog(c));
    this.coinBadge.setText(`🪙 ${progress.getCoins()}`);
  }

  // --- Общие элементы ---

  _makeCoinBadge(x, y) {
    this.coinBadge = this.add
      .text(x, y, `🪙 ${progress.getCoins()}`, {
        fontFamily: FONT, fontSize: '22px', color: '#FFFFFF', stroke: '#B77E1E', strokeThickness: 5,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0);
  }

  _flashCoins() {
    this.sound && this.cache.audio.exists('coin') && this.sound.play('coin', { volume: 0.5 });
    this.tweens.add({ targets: this.coinBadge, scale: 1.3, duration: 120, yoyo: true });
  }

  _denied() {
    // короткая красная тряска баланса — «не хватает монет»
    this.tweens.add({ targets: this.coinBadge, x: this.coinBadge.x - 6, duration: 60, yoyo: true, repeat: 3 });
  }

  _backButton(x, y) {
    const b = this.add
      .text(x, y, '← Назад', {
        fontFamily: FONT, fontSize: '20px', color: '#5B4A6F',
        backgroundColor: '#FFF6EC', padding: { x: 12, y: 8 },
      })
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    b.on('pointerdown', () => this.scene.start('Menu'));
  }

  _hint(x, y) {
    this.add
      .text(x, y, 'Монеты за прохождение и на карте.\nСкоро — новые зверята!', {
        fontFamily: FONT, fontSize: '14px', color: '#5B4A6F', align: 'center',
      })
      .setOrigin(0.5);
  }
}
