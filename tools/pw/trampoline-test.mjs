// Проверка батута + уровней 9-10 + раскладки LevelSelect на 10 узлов.
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
const browser = await chromium.launch();

async function withPage(viewport, fn) {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  try {
    await page.goto(`http://127.0.0.1:${PORT}/?nosw`);
    await page.waitForFunction(() => window.game && window.game.scene.isActive('Menu'), { timeout: 15000 });
    await fn(page);
  } finally {
    await page.close();
  }
}

try {
  // 1. LevelSelect на трёх размерах экрана — 10 узлов не должны наезжать на кнопку "Магазин"
  for (const vp of [{ width: 360, height: 740 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
    await withPage(vp, async (page) => {
      await page.evaluate(() => window.game.scene.start('LevelSelect'));
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(shotsDir, `levelselect_${vp.width}x${vp.height}.png`) });
      console.log(`saved levelselect_${vp.width}x${vp.height}.png`);
    });
  }

  // 2. Уровни 9 и 10 — лабиринт строится, видно батуты
  for (const lvl of [9, 10]) {
    await withPage({ width: 390, height: 844 }, async (page) => {
      await page.evaluate((n) => window.game.scene.start('Game', { level: n }), lvl);
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(shotsDir, `level${lvl}.png`) });
      const info = await page.evaluate(() => {
        const s = window.game.scene.getScene('Game');
        return {
          levelNum: s.levelNum,
          dogsConfigured: s.cfg.dogs,
          trampolineCount: s.trampolineGroup.getChildren().length,
        };
      });
      console.log(`level ${lvl}:`, info);
    });
  }

  // 3. Механика буста + кулдаун на уровне 1 (trampolines:1, без собак — проще довести котика)
  await withPage({ width: 390, height: 844 }, async (page) => {
    await page.evaluate(() => window.game.scene.start('Game', { level: 1 }));
    await page.waitForTimeout(300);

    const before = await page.evaluate(() => {
      const s = window.game.scene.getScene('Game');
      const t = s.trampolineGroup.getChildren()[0];
      return { catBoostUntil: s.cat.boostUntil, now: s.time.now, trampoline: { x: t.x, y: t.y }, cat: { x: s.cat.x, y: s.cat.y } };
    });
    console.log('before:', before);

    // Телепортируем котика прямо на батут через физику сцены (симуляция "дошёл сам" —
    // цель теста — сама механика overlap/буст, не прохождение джойстиком).
    await page.evaluate(() => {
      const s = window.game.scene.getScene('Game');
      const t = s.trampolineGroup.getChildren()[0];
      s.cat.setPosition(t.x, t.y);
    });
    await page.waitForTimeout(150); // дать overlap отработать хотя бы один физический тик

    const afterTouch = await page.evaluate(() => {
      const s = window.game.scene.getScene('Game');
      return { boostUntil: s.cat.boostUntil, now: s.time.now };
    });
    console.log('after touch:', afterTouch, 'boosted:', afterTouch.boostUntil > afterTouch.now);

    // Кулдаун: остаёмся на той же клетке ещё некоторое время, boostUntil не должен расти дальше
    await page.waitForTimeout(300);
    const stillOn = await page.evaluate(() => {
      const s = window.game.scene.getScene('Game');
      const t = s.trampolineGroup.getChildren()[0];
      s.cat.setPosition(t.x, t.y); // на случай если физика сдвинула
      return { boostUntil: s.cat.boostUntil, readyAt: t.readyAt, now: s.time.now };
    });
    await page.waitForTimeout(150);
    const afterSecondTick = await page.evaluate(() => {
      const s = window.game.scene.getScene('Game');
      return { boostUntil: s.cat.boostUntil, now: s.time.now };
    });
    console.log('cooldown check — boostUntil should NOT have grown further while readyAt not passed:',
      stillOn, '-> after another tick:', afterSecondTick,
      'unchanged:', stillOn.boostUntil === afterSecondTick.boostUntil);

    // Ждём окончания буста и кулдауна, трогаем снова — должно сработать по новой
    await page.waitForTimeout(2200);
    const rearmed = await page.evaluate(() => {
      const s = window.game.scene.getScene('Game');
      const t = s.trampolineGroup.getChildren()[0];
      s.cat.setPosition(t.x, t.y);
      return { readyAtBefore: t.readyAt, now: s.time.now };
    });
    await page.waitForTimeout(150);
    const afterRearm = await page.evaluate(() => {
      const s = window.game.scene.getScene('Game');
      return { boostUntil: s.cat.boostUntil, now: s.time.now };
    });
    console.log('re-arm after cooldown elapsed:', rearmed, '-> boosted again:', afterRearm.boostUntil > afterRearm.now);
  });

  // 4. Офлайн-кеш: убедиться, что trampoline.svg попал в новый CACHE_NAME.
  // Тут НЕ используем ?nosw — наоборот, нужно дать SW реально установиться.
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    await page.goto(`http://127.0.0.1:${PORT}/`);
    await page.waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker?.ready, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500); // дать install-событию докешировать ASSETS
    const cacheCheck = await page.evaluate(async () => {
      const names = await caches.keys();
      const target = names.find((n) => n.startsWith('cat-maze'));
      if (!target) return { names, hasTrampoline: false };
      const cache = await caches.open(target);
      const keys = await cache.keys();
      const hasTrampoline = keys.some((k) => k.url.includes('trampoline.svg'));
      return { names, target, hasTrampoline };
    });
    console.log('cache check:', cacheCheck);
    await page.close();
  }

  console.log('ALL DONE');
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
