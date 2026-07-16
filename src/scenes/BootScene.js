// Загрузка ассетов + прогресс-бар.

import { IMAGES, AVAILABLE_SOUNDS, SPRITE_SIZE, PALETTE, FONT } from '../config/assets.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    const { width: w, height: h } = this.scale;

    this.add.text(w / 2, h / 2 - 60, '🐱', { fontSize: '64px' }).setOrigin(0.5);
    this.add
      .text(w / 2, h / 2 + 10, 'Загружаем...', { fontFamily: FONT, fontSize: '22px', color: '#5B4A6F' })
      .setOrigin(0.5);

    const barW = Math.min(260, w * 0.7);
    this.add.rectangle(w / 2, h / 2 + 50, barW, 18, 0xFFFFFF, 0.6).setStrokeStyle(2, PALETTE.ui, 0.3);
    const fill = this.add.rectangle(w / 2 - barW / 2 + 3, h / 2 + 50, 0, 12, PALETTE.exit).setOrigin(0, 0.5);
    this.load.on('progress', (p) => fill.setSize((barW - 6) * p, 12));

    // SVG грузим с явным размером — иначе Phaser растеризует его в исходном
    // масштабе, и на ретине картинка мылит
    for (const img of IMAGES) {
      if (img.path.endsWith('.svg')) {
        this.load.svg(img.key, img.path, { width: SPRITE_SIZE, height: SPRITE_SIZE });
      } else {
        this.load.image(img.key, img.path);
      }
    }
    // Только те звуки, которые реально существуют (проверка в main.js).
    // Пока файлов нет — игра молча обходится без них.
    for (const s of AVAILABLE_SOUNDS) this.load.audio(s.key, s.path);

    this.load.on('loaderror', (file) => console.warn('Не загрузилось:', file.key));
  }

  create() {
    this.scene.start('Menu');
  }
}
