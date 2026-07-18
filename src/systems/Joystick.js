// Виртуальный джойстик для телефона.
//
// Плавающий: база появляется там, где палец коснулся левой половины экрана,
// а не в фиксированном углу. Для детской руки это заметно удобнее — не нужно
// целиться в кружок, просто ткни куда угодно и веди.
//
// На десктопе параллельно работают стрелки и WASD (см. getVector).

const MAX_DIST = 60;   // радиус, дальше которого ручка не уходит
const DEAD_ZONE = 0.15; // чтобы дрожь пальца не считалась движением

export class Joystick {
  constructor(scene) {
    this.scene = scene;
    this.vector = { x: 0, y: 0 };
    this.force = 0;      // 0..1 — насколько сильно отклонён
    this.active = false;
    this.pointerId = null;

    const d = scene.add.container(0, 0).setDepth(9000).setScrollFactor(0).setVisible(false);
    this.base = scene.add.circle(0, 0, MAX_DIST, 0xFFFFFF, 0.25).setStrokeStyle(3, 0xFFFFFF, 0.5);
    this.knob = scene.add.circle(0, 0, 26, 0xFFFFFF, 0.7).setStrokeStyle(3, 0x5B4A6F, 0.4);
    d.add([this.base, this.knob]);
    this.container = d;

    this.keys = scene.input.keyboard
      ? scene.input.keyboard.addKeys({
          up: 'W', down: 'S', left: 'A', right: 'D',
          upArrow: 'UP', downArrow: 'DOWN', leftArrow: 'LEFT', rightArrow: 'RIGHT',
        })
      : null;

    scene.input.addPointer(2); // мультитач: джойстик + тап по кнопкам UI
    scene.input.on('pointerdown', this._onDown, this);
    scene.input.on('pointermove', this._onMove, this);
    scene.input.on('pointerup', this._onUp, this);
    scene.input.on('pointerupoutside', this._onUp, this);

    scene.events.once('shutdown', this.destroy, this);
  }

  _onDown(pointer) {
    if (this.active) return;
    // джойстик живёт только на левой половине — правая свободна для UI
    if (pointer.x > this.scene.scale.width * 0.62) return;
    this.active = true;
    this.pointerId = pointer.id;
    this.origin = { x: pointer.x, y: pointer.y };
    this.container.setPosition(pointer.x, pointer.y).setVisible(true);
    this.knob.setPosition(0, 0);
    this.scene.tweens.add({ targets: this.container, alpha: { from: 0, to: 1 }, duration: 120 });
  }

  _onMove(pointer) {
    if (!this.active || pointer.id !== this.pointerId) return;
    let dx = pointer.x - this.origin.x;
    let dy = pointer.y - this.origin.y;
    const dist = Math.hypot(dx, dy);
    if (dist > MAX_DIST) {
      dx = (dx / dist) * MAX_DIST;
      dy = (dy / dist) * MAX_DIST;
    }
    this.knob.setPosition(dx, dy);
    const f = Math.min(dist, MAX_DIST) / MAX_DIST;
    if (f < DEAD_ZONE) {
      this.vector = { x: 0, y: 0 };
      this.force = 0;
    } else {
      const len = Math.hypot(dx, dy) || 1;
      this.vector = { x: dx / len, y: dy / len };
      this.force = f;
    }
  }

  _onUp(pointer) {
    if (!this.active || pointer.id !== this.pointerId) return;
    this.active = false;
    this.pointerId = null;
    this.vector = { x: 0, y: 0 };
    this.force = 0;
    this.scene.tweens.add({
      targets: this.container, alpha: 0, duration: 150,
      onComplete: () => this.container.setVisible(false),
    });
  }

  /**
   * Единый источник ввода для котика. Бег теперь единственная скорость
   * (кнопку-переключатель убрали), поэтому здесь нет флага running.
   * @returns {{x:number, y:number, force:number}}
   */
  getVector() {
    if (this.force > 0) {
      return { ...this.vector, force: this.force };
    }
    // клавиатура — для отладки на компьютере
    if (this.keys) {
      let x = 0;
      let y = 0;
      if (this.keys.left.isDown || this.keys.leftArrow.isDown) x -= 1;
      if (this.keys.right.isDown || this.keys.rightArrow.isDown) x += 1;
      if (this.keys.up.isDown || this.keys.upArrow.isDown) y -= 1;
      if (this.keys.down.isDown || this.keys.downArrow.isDown) y += 1;
      if (x || y) {
        const len = Math.hypot(x, y);
        return { x: x / len, y: y / len, force: 1 };
      }
    }
    return { x: 0, y: 0, force: 0 };
  }

  destroy() {
    this.scene.input.off('pointerdown', this._onDown, this);
    this.scene.input.off('pointermove', this._onMove, this);
    this.scene.input.off('pointerup', this._onUp, this);
    this.scene.input.off('pointerupoutside', this._onUp, this);
    this.container.destroy();
  }
}
