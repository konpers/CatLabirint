import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { LevelSelectScene } from './scenes/LevelSelectScene.js';
import { ShopScene } from './scenes/ShopScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';
import { PALETTE, detectSounds } from './config/assets.js';

// Узнаём, какие звуки существуют, ДО старта игры: иначе Phaser попробует
// декодировать 404-страницу как mp3 и завалит консоль ошибками.
//
// Гонка с таймером — страховка: что бы ни случилось с сетью, игра стартует
// максимум через секунду. Запуск игры не должен зависеть от ответа сервера,
// иначе ребёнок смотрит в чёрный экран.
await Promise.race([
  detectSounds().catch(() => {}),
  new Promise((resolve) => setTimeout(resolve, 1000)),
]);

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: PALETTE.bg,
  scale: {
    // RESIZE, а не FIT: канвас всегда равен экрану, без чёрных полей.
    // За «влезание» лабиринта отвечает зум камеры (см. GameScene._setupCamera).
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: '100%',
    height: '100%',
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
  // roundPixels: спрайты рисуются по целым пикселям. Без этого при дробном
  // зуме камеры (~0.87) движущийся котик попадает «между пикселями» и
  // размазывается — жалоба с теста на телефоне.
  render: { antialias: true, roundPixels: true },
  scene: [BootScene, MenuScene, LevelSelectScene, ShopScene, GameScene, UIScene],
};

const game = new Phaser.Game(config);

// Для отладки из консоли браузера: game.scene.getScene('Game') и т.д.
window.game = game;

// Экран телефона меняет размер при повороте и при появлении адресной строки —
// пересобираем сцену меню, чтобы карточки не уехали за край.
window.addEventListener('resize', () => {
  game.scale.refresh();
});

export default game;
