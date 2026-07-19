// Магазин и кастомизация. Три секции:
//   Персонажи  — покупка за монеты + выбор, кого ведём по лабиринту.
//   Враги      — покупка пород + включение/выключение как активных врагов.
//   Способности — расходники (стек зарядов, не разовая разблокировка).
//
// Данные берутся из cats.js / dogs.js / abilities.js; что открыто/выбрано/
// включено/сколько зарядов на руках — из progress.
//
// Контента больше, чем помещается на экран — вся сетка карточек скроллится
// вертикально (драг пальцем/мышью + колесо мыши). Шапка (заголовок/монеты/
// назад) зафиксирована и в скролл не попадает.

import { CATS } from '../config/cats.js';
import { DOGS } from '../config/dogs.js';
import { ABILITIES } from '../config/abilities.js';
import { PALETTE, FONT } from '../config/assets.js';
import * as progress from '../config/progress.js';

const DRAG_THRESHOLD = 10; // px сдвига пальца — меньше считаем тапом, не скроллом

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

    // Ниже шапки — скроллируемая зона со всеми карточками.
    const headerH = h * 0.12;
    this.scrollTop = headerH;
    this.scrollBottom = h;
    this.scrollY = 0;
    this.dragDistance = 0;
    this.scrollContent = this.add.container(0, headerH);

    // Меньше колонок — крупнее карточки. Раньше size ограничивался ещё и
    // высотой экрана, чтобы всё влезало без скролла — теперь скролл есть,
    // ограничение только по ширине экрана.
    const cols = 3;
    const size = Math.min(104, (w - 24) / cols - 10);

    this.catCards = [];
    this.dogCards = [];
    this.abilityCards = [];

    let y = 20;
    y = this._section('🐾 Персонажи', CATS, cols, size, (cat, x, yy, s) => this._catCard(cat, x, yy, s), y);
    y = this._section('🐶 Враги (кто гоняется)', DOGS, cols, size, (dog, x, yy, s) => this._dogCard(dog, x, yy, s), y + 28);
    y = this._section('🎒 Способности', ABILITIES, cols, size, (ab, x, yy, s) => this._abilityCard(ab, x, yy, s), y + 28);

    const hint = this._hint(w / 2, y + 26);
    this.contentHeight = hint.y + hint.height + 20;
    this.maxScroll = Math.max(0, this.contentHeight - (this.scrollBottom - this.scrollTop));

    this._setupScrollMask();
    this._setupScrollbar();
    this._setupScrollInput();
  }

  /** Заголовок секции + сетка карточек. Возвращает y нижнего края сетки. */
  _section(title, items, cols, size, makeCard, y) {
    const { width: w } = this.scale;
    const label = this.add.text(w / 2, y, title, { fontFamily: FONT, fontSize: '20px', color: '#5B4A6F' }).setOrigin(0.5);
    this.scrollContent.add(label);
    return this._grid(items, y + 26, cols, size, makeCard);
  }

  /**
   * Раскладывает элементы сеткой по cols колонок, по центру, добавляя каждую
   * карточку в scrollContent.
   * @returns {number} y нижнего края сетки (для позиционирования следующей секции)
   */
  _grid(items, top, cols, size, makeCard) {
    const { width: w } = this.scale;
    const gap = 14;
    const cellH = size * 1.25 + 16;
    const rows = Math.ceil(items.length / cols);
    items.forEach((it, i) => {
      const row = Math.floor(i / cols);
      // последний ряд может быть неполным — центрируем его
      const inRow = Math.min(cols, items.length - row * cols);
      const rowW = inRow * size + (inRow - 1) * gap;
      const startX = (w - rowW) / 2 + size / 2;
      const cIn = i - row * cols;
      const card = makeCard(it, startX + cIn * (size + gap), top + row * cellH + size * 0.62, size);
      this.scrollContent.add(card);
    });
    return top + rows * cellH;
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
    bg.on('pointerup', () => { if (this.dragDistance < DRAG_THRESHOLD) this._onCatTap(cat); });

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
    bg.on('pointerup', () => { if (this.dragDistance < DRAG_THRESHOLD) this._onDogTap(dog); });

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

  // --- Карточка способности: не лочится, всегда докупается заряд ---

  _abilityCard(ability, x, y, size) {
    const c = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, size, size * 1.25, PALETTE.uiLight).setStrokeStyle(4, PALETTE.ui, 0.25);
    if (bg.setRadius) bg.setRadius(14);
    const sprite = this.add.image(0, -size * 0.12, ability.id);
    sprite.setScale(Math.min((size * 0.55) / sprite.width, (size * 0.55) / sprite.height));
    const label = this.add
      .text(0, size * 0.42, `🪙 ${ability.price}`, { fontFamily: FONT, fontSize: '13px', color: '#B77E1E' })
      .setOrigin(0.5);
    // бейдж "на руках" в углу — стек, не замок
    const owned = this.add
      .text(size * 0.36, -size * 0.5, '', {
        fontFamily: FONT, fontSize: '14px', color: '#FFFFFF',
        backgroundColor: '#3E7D5A', padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5);
    c.add([bg, sprite, label, owned]);

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerup', () => { if (this.dragDistance < DRAG_THRESHOLD) this._onAbilityTap(ability); });

    const card = { kind: 'ability', item: ability, container: c, bg, sprite, label, owned };
    this.abilityCards.push(card);
    this._paintAbility(card);
    return c;
  }

  _onAbilityTap(ability) {
    if (progress.buyItemCharge(ability.id, ability.price)) {
      this._flashCoins();
      this._refresh();
    } else {
      this._denied();
    }
  }

  _paintAbility(card) {
    const n = progress.getItemCount(card.item.id);
    card.owned.setText(`×${n}`).setVisible(n > 0);
  }

  _refresh() {
    this.catCards.forEach((c) => this._paintCat(c));
    this.dogCards.forEach((c) => this._paintDog(c));
    this.abilityCards.forEach((c) => this._paintAbility(c));
    this.coinBadge.setText(`🪙 ${progress.getCoins()}`);
  }

  // --- Скролл: scrollContent зажат геометрической маской по высоте, драг/колесо двигают его y ---

  _setupScrollMask() {
    const { width: w } = this.scale;
    // add:false — графика служит только источником формы для маски, в display list не попадает.
    const shape = this.make.graphics({ x: 0, y: 0, add: false });
    shape.fillStyle(0xffffff);
    shape.fillRect(0, this.scrollTop, w, this.scrollBottom - this.scrollTop);
    this.scrollContent.setMask(shape.createGeometryMask());
    this._maskShape = shape;
    this.events.once('shutdown', () => this._maskShape.destroy());
  }

  _setupScrollbar() {
    if (this.maxScroll <= 0) return; // весь контент влез — полоса не нужна
    const { width: w } = this.scale;
    const trackH = this.scrollBottom - this.scrollTop;
    const thumbH = Math.max(30, (trackH * trackH) / this.contentHeight);
    this._scrollbarThumbH = thumbH;
    this.add.rectangle(w - 6, this.scrollTop + trackH / 2, 4, trackH, 0x000000, 0.08).setOrigin(0.5);
    this.scrollbarThumb = this.add.rectangle(w - 6, this.scrollTop + thumbH / 2, 4, thumbH, 0x5B4A6F, 0.5).setOrigin(0.5);
  }

  _setupScrollInput() {
    this.input.on('pointerdown', (p) => {
      this._dragStartY = p.y;
      this._dragStartScroll = this.scrollY;
      this.dragDistance = 0;
    });
    this.input.on('pointermove', (p) => {
      if (!p.isDown) return;
      const dy = p.y - this._dragStartY;
      this.dragDistance = Math.max(this.dragDistance, Math.abs(dy));
      this._setScroll(this._dragStartScroll - dy);
    });
    this.input.on('wheel', (_p, _over, _dx, dy) => this._setScroll(this.scrollY + dy * 0.5));
  }

  _setScroll(y) {
    this.scrollY = Phaser.Math.Clamp(y, 0, this.maxScroll);
    this.scrollContent.y = this.scrollTop - this.scrollY;
    if (this.scrollbarThumb) {
      const trackH = this.scrollBottom - this.scrollTop;
      const ratio = this.maxScroll > 0 ? this.scrollY / this.maxScroll : 0;
      this.scrollbarThumb.y = this.scrollTop + this._scrollbarThumbH / 2 + ratio * (trackH - this._scrollbarThumbH);
    }
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
    const t = this.add
      .text(x, y, 'Монеты за прохождение и на карте.\nСкоро — новые зверята!', {
        fontFamily: FONT, fontSize: '14px', color: '#5B4A6F', align: 'center',
      })
      .setOrigin(0.5, 0);
    this.scrollContent.add(t);
    return t;
  }
}
