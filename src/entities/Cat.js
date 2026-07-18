// Котик: движение по джойстику + система idle-анимаций.

import { SPEED, IDLE_TIMEOUT, CAT_SIZE } from '../config/levels.js';

export class Cat extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, skinId) {
    super(scene, x, y, `cat_${skinId}_walk`);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.skinId = skinId;
    this.isSafe = false;      // в коробке ли — от этого зависит, ловит ли собака
    this.hasShield = false;   // под щитом ли — одна поимка прощается (см. GameScene)
    this.idleTimer = 0;
    this.idleBusy = false;    // проигрывается ли сейчас idle-анимация

    // Картинки крупные (96px), а тайл 48 — приводим к нужному размеру ОДИН раз.
    // Дальше везде пляшем от baseScale, иначе анимации сбросят масштаб.
    this.baseScale = CAT_SIZE / this.width;
    this.setScale(this.baseScale);
    this.setDepth(y);

    // Тело круглое и заметно меньше картинки: иначе котик цепляется хвостом
    // и усами за углы, а ребёнок думает, что игра сломалась.
    const r = this.width * 0.22;
    this.body.setCircle(r, this.width / 2 - r, this.height / 2 - r + this.height * 0.1);
    this.setCollideWorldBounds(true);
  }

  _tex(pose) {
    return `cat_${this.skinId}_${pose}`;
  }

  update(input, delta) {
    const moving = input.force > 0;

    if (moving) {
      this._cancelIdle();
      this.idleTimer = 0;

      // Бег — единственная скорость котика (кнопку-переключатель убрали).
      this.setVelocity(input.x * SPEED.catRun * input.force, input.y * SPEED.catRun * input.force);

      // разворот мордочкой по ходу движения (на картинке котик смотрит вправо)
      if (input.x < -0.1) this.setFlipX(true);
      else if (input.x > 0.1) this.setFlipX(false);

      // Покачивание при беге. Кадр всего один, поэтому «шаги» изображаем
      // лёгким пружинящим сжатием.
      const wobble = Math.sin(this.scene.time.now / 60) * 0.05;
      this.setScale(this.baseScale, this.baseScale + wobble);
    } else {
      this.setVelocity(0, 0);
      if (!this.idleBusy) {
        this.idleTimer += delta;
        if (this.idleTimer >= IDLE_TIMEOUT) {
          this.idleTimer = 0;
          this.playRandomIdle();
        }
      }
    }

    this.setDepth(this.y); // сортировка по глубине: кто ниже — рисуется поверх
  }

  // --- Idle: котик дурачится, пока Лиана думает над лабиринтом ---

  playRandomIdle() {
    const acts = [this._idleSit, this._idleSpin, this._idleJump, this._idleMeow, this._idleSleep];
    const act = acts[Math.floor(Math.random() * acts.length)];
    this.idleBusy = true;
    act.call(this);
  }

  _finishIdle() {
    // Гасим отложенный таймер позы: без этого он сработает уже посреди
    // СЛЕДУЮЩЕЙ анимации и собьёт ей позу и поворот.
    this._idleEvent?.remove();
    this._idleEvent = null;

    this.idleBusy = false;
    this.idleTimer = 0; // цикл повторится — котик продолжит дурачиться
    this.setTexture(this._tex('walk'));
    this.setScale(this.baseScale);
    this.setAngle(0);
  }

  _idleSit() {
    this.setTexture(this._tex('sit'));
    this._idleEvent = this.scene.time.delayedCall(2200, () => this._finishIdle());
  }

  // Долго стоим — котик сворачивается клубочком. Художник нарисовал эту позу,
  // и она слишком милая, чтобы её не использовать.
  _idleSleep() {
    this.setTexture(this._tex('sleep'));
    // мерное сопение
    this.scene.tweens.add({
      targets: this,
      scaleY: this.baseScale * 1.04,
      duration: 900,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
      onComplete: () => this._finishIdle(),
    });
  }

  _idleSpin() {
    this.scene.tweens.add({
      targets: this,
      angle: 360,
      duration: 900,
      ease: 'Cubic.easeInOut',
      onComplete: () => this._finishIdle(),
    });
  }

  _idleJump() {
    const y0 = this.y;
    this.scene.tweens.add({
      targets: this,
      y: y0 - 26,
      duration: 260,
      ease: 'Quad.easeOut',
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        this.y = y0;
        this._finishIdle();
      },
    });
  }

  _idleMeow() {
    this.scene.sfx?.('meow');
    this.setTexture(this._tex('sit'));
    const t = this.scene.add
      .text(this.x, this.y - 40, 'Мяу!', {
        fontFamily: '"Baloo 2", system-ui, sans-serif',
        fontSize: '20px',
        color: '#5B4A6F',
        stroke: '#FFFFFF',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(20000);
    this.scene.tweens.add({
      targets: t,
      y: t.y - 22,
      alpha: 0,
      duration: 1300,
      ease: 'Quad.easeOut',
      onComplete: () => t.destroy(),
    });
    this.scene.tweens.add({
      targets: this,
      scaleX: this.baseScale * 1.1,
      scaleY: this.baseScale * 0.94,
      duration: 160,
      yoyo: true,
      repeat: 1,
      onComplete: () => this._finishIdle(),
    });
  }

  _cancelIdle() {
    if (!this.idleBusy) return;
    this.scene.tweens.killTweensOf(this);
    this._finishIdle();
  }
}
