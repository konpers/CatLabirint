// Проверка: батуты/щиты/косточки реально появляются на карте, и подбор
// косточки даёт заряд в инвентарь.
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
  await page.goto('http://127.0.0.1:8080/?nosw');
  await page.waitForFunction(() => window.game && window.game.scene.isActive('Menu'), { timeout: 15000 });

  // Прогоняем каждый уровень несколько раз (пикапы вероятностные) и считаем средние
  const stats = {};
  for (const lvl of [1, 3, 5, 8, 10]) {
    let tramp = 0, shield = 0, bone = 0;
    const RUNS = 6;
    for (let i = 0; i < RUNS; i++) {
      const r = await page.evaluate((n) => new Promise((resolve) => {
        window.game.scene.start('Game', { level: n });
        // дождёмся создания сцены
        const check = () => {
          const s = window.game.scene.getScene('Game');
          if (s && s.trampolineGroup && s.boneGroup && s.shieldGroup) {
            resolve({
              tramp: s.trampolineGroup.getChildren().length,
              shield: s.shieldGroup.getChildren().length,
              bone: s.boneGroup.getChildren().length,
              trampCfg: s.cfg.trampolines,
            });
          } else {
            setTimeout(check, 50);
          }
        };
        setTimeout(check, 100);
      }), lvl);
      tramp += r.tramp; shield += r.shield; bone += r.bone;
      stats[lvl] = stats[lvl] || { trampCfg: r.trampCfg };
    }
    stats[lvl].trampAvg = (tramp / RUNS).toFixed(1);
    stats[lvl].shieldAvg = (shield / RUNS).toFixed(1);
    stats[lvl].boneAvg = (bone / RUNS).toFixed(1);
  }
  console.log('Средние за 6 прогонов на уровень:');
  for (const [lvl, s] of Object.entries(stats)) {
    console.log(`  L${lvl}: батуты ${s.trampAvg} (cfg ${s.trampCfg}), щиты ${s.shieldAvg}, косточки ${s.boneAvg}`);
  }

  // Подбор косточки даёт заряд. Проверяем через кнопку способности в UI —
  // она читает тот же экземпляр progress, что и сцена (в отличие от import()
  // из тестового контекста, который создал бы второй state — ловушка из CLAUDE.md).
  const boneGrant = await page.evaluate(() => new Promise((resolve) => {
    window.game.scene.start('Game', { level: 5 });
    const check = () => {
      const s = window.game.scene.getScene('Game');
      if (!s || !s.boneGroup || !s.ui?.abilityButtons?.bone) { setTimeout(check, 50); return; }
      // гарантируем наличие косточки — если не выпала, разложим принудительно
      if (!s.boneGroup.getChildren().length) s._placeBonePickup();
      const bone = s.boneGroup.getChildren()[0];
      if (!bone) { resolve({ error: 'косточка не разместилась (нет свободных тайлов?)' }); return; }
      const before = s.ui.abilityButtons.bone.count;
      s._collectBone(s.cat, bone);
      const after = s.ui.abilityButtons.bone.count;
      const destroyed = !bone.active;
      resolve({ before, after, destroyed });
    };
    setTimeout(check, 150);
  }));
  console.log('подбор косточки → заряд (UI badge):', boneGrant,
    boneGrant.after === boneGrant.before + 1 && boneGrant.destroyed ? 'OK' : 'FAIL');

  console.log('DONE');
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
