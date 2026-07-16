// HUD поверх игры. Отдельная сцена — чтобы не ездила вместе с камерой.

import { PALETTE, FONT } from '../config/assets.js';
import { DOG_LIFETIME } from '../config/levels.js';

export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UI', active: false });
  }

  init(data) {
    this.levelNum = data.level || 1;
    this.hint = data.hint || '';
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

    // Таймер собаки
    this.dogLabel = this.add
      .text(w - 14, 12, '', {
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
