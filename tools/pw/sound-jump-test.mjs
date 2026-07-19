// Проверка: 3 новых звука реально грузятся, и котик на батуте перепрыгивает
// собаку без проигрыша.
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './static-server.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const server = await startServer(root, 8080);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

try {
  // БЕЗ ?nosw и без заглушки звука — но браузер headless без клика не даст
  // играть звук; нам важно лишь, что файлы ДЕКОДИРОВАЛИСЬ в audio-кеш.
  await page.goto('http://127.0.0.1:8080/?nosw');
  await page.waitForFunction(() => window.game && window.game.scene.isActive('Menu'), { timeout: 15000 });
  await page.waitForTimeout(500); // дать Boot догрузить аудио

  const sounds = await page.evaluate(() => {
    const c = window.game.cache.audio;
    return { coin: c.exists('coin'), bark: c.exists('bark'), win: c.exists('win'), meow: c.exists('meow') };
  });
  console.log('audio cache:', sounds);

  // --- Перепрыгивание собаки на батуте ---
  await page.evaluate(() => window.game.scene.start('Game', { level: 5 })); // есть и собаки, и батуты
  await page.waitForTimeout(400);

  // Спавним собаку принудительно и ставим её вплотную к котику, БЕЗ буста —
  // должно ловить (контроль).
  const controlLost = await page.evaluate(async () => {
    const s = window.game.scene.getScene('Game');
    s._spawnDog();
    await new Promise((r) => setTimeout(r, 50));
    const dog = s.dogs.getChildren().find((d) => !d.dead);
    dog.frozenUntil = 0;
    dog.setPosition(s.cat.x, s.cat.y);
    s.cat.boostUntil = 0;
    s.cat.isSafe = false;
    s.cat.hasShield = false;
    s._onDogTouch(s.cat, dog); // прямой вызов обработчика касания
    return s.finished;
  });
  console.log('control (без буста) — собака поймала:', controlLost, controlLost ? 'OK' : 'FAIL');

  // Перезапуск и проверка с бустом — НЕ должно ловить
  await page.evaluate(() => window.game.scene.start('Game', { level: 5 }));
  await page.waitForTimeout(400);
  const jumpedOver = await page.evaluate(async () => {
    const s = window.game.scene.getScene('Game');
    s._spawnDog();
    await new Promise((r) => setTimeout(r, 50));
    const dog = s.dogs.getChildren().find((d) => !d.dead);
    dog.frozenUntil = 0;
    dog.setPosition(s.cat.x, s.cat.y);
    s.cat.boostUntil = s.time.now + 2000; // как будто только что с батута
    s.cat.isSafe = false;
    s.cat.hasShield = false;
    s._onDogTouch(s.cat, dog);
    return { finished: s.finished };
  });
  console.log('с бустом — перепрыгнул (finished должно быть false):', jumpedOver,
    jumpedOver.finished === false ? 'OK' : 'FAIL');

  console.log('DONE');
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
