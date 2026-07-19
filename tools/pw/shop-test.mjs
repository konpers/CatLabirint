// Headless-прогон магазина: открывает Shop-сцену, снимает скрин до и после
// свайпа вниз, проверяет что скролл действительно сдвинул контент.
// Запуск: npm run shop  (внутри tools/pw)
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startServer } from './static-server.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const shotsDir = path.resolve(__dirname, '..', '_shots');
fs.mkdirSync(shotsDir, { recursive: true });

const PORT = 8080;
const server = await startServer(root, PORT);
console.log(`static server: http://127.0.0.1:${PORT}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('console', (msg) => console.log('[page]', msg.text()));
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

try {
  await page.goto(`http://127.0.0.1:${PORT}/?nosw`);
  // Boot грузит ассеты и сам стартует Menu в create() — ждём этого, чтобы
  // спрайты магазина (cat_*_sit и т.д.) уже были в текстур-кеше.
  await page.waitForFunction(() => window.game && window.game.scene.isActive('Menu'), { timeout: 15000 });

  await page.evaluate(() => window.game.scene.start('Shop'));
  await page.waitForTimeout(300);

  await page.screenshot({ path: path.join(shotsDir, 'shop_top.png') });
  console.log('saved shop_top.png');

  const before = await page.evaluate(() => {
    const s = window.game.scene.getScene('Shop');
    return { scrollY: s.scrollY, maxScroll: s.maxScroll };
  });
  console.log('before scroll:', before);

  // Свайп вверх пальцем (тянем контент вверх) — должен доскроллить до низа.
  await page.mouse.move(195, 700);
  await page.mouse.down();
  for (let i = 1; i <= 15; i++) {
    await page.mouse.move(195, 700 - i * 40, { steps: 3 });
  }
  await page.mouse.up();
  await page.waitForTimeout(150);

  await page.screenshot({ path: path.join(shotsDir, 'shop_scrolled.png') });
  console.log('saved shop_scrolled.png');

  const after = await page.evaluate(() => {
    const s = window.game.scene.getScene('Shop');
    return { scrollY: s.scrollY, maxScroll: s.maxScroll };
  });
  console.log('after scroll:', after);

  if (after.maxScroll <= 0) {
    console.error('FAIL: maxScroll <= 0 — контент помещается без скролла, тест неинформативен для этой цели');
  } else if (after.scrollY <= before.scrollY) {
    console.error('FAIL: scrollY не увеличился после свайпа — скролл не сработал');
  } else {
    console.log(`OK: scrollY ${before.scrollY} -> ${after.scrollY} (max ${after.maxScroll})`);
  }

  // Короткий тап (без драга) по первой карточке не должен требовать нескольких попыток.
  const tapResult = await page.evaluate(() => {
    const s = window.game.scene.getScene('Shop');
    return { dragDistance: s.dragDistance };
  });
  console.log('dragDistance after release:', tapResult.dragDistance);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
