import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

async function run() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-pip-greet-'));
  const app = await electron.launch({
    args: [ROOT, `--user-data-dir=${userDataDir}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });

  try {
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');
    await win.waitForTimeout(1200);

    // 1. Greeting boundary checks via mocked system time
    const checkGreetingAtHour = async (hour, expected) => {
      await win.evaluate((h) => {
        const RealDate = Date;
        const fixed = new RealDate(2026, 10, 26, h, 15, 0);
        window.Date = class extends RealDate {
          constructor(...args) {
            if (args.length === 0) return fixed;
            return new RealDate(...args);
          }
          static now() {
            return fixed.getTime();
          }
        };
        window.dispatchEvent(new Event('focus'));
      }, hour);
      await win.waitForTimeout(150);
      const text = await win.locator('[data-testid="home-greeting"]').textContent();
      assert.equal(text?.trim(), expected, `Hour ${hour} should show "${expected}"`);
    };

    await checkGreetingAtHour(5, 'Good morning');
    await checkGreetingAtHour(11, 'Good morning');
    await checkGreetingAtHour(12, 'Good afternoon');
    await checkGreetingAtHour(16, 'Good afternoon');
    await checkGreetingAtHour(17, 'Good evening');
    await checkGreetingAtHour(21, 'Good evening');
    await checkGreetingAtHour(22, 'Good night');
    await checkGreetingAtHour(3, 'Good night');
    console.log('PASS: Greeting boundaries (morning/afternoon/evening/night)');

    // 2. Mini Player -> Expand button & double-click restore to Now Playing
    await win.evaluate(async () => {
      await window.electronAPI?.toggleMiniPlayer(true);
    });
    await win.waitForTimeout(800);

    const miniWin = app.windows().find((w) => w.url().includes('mini=1'));
    if (miniWin) {
      await miniWin.waitForLoadState('domcontentloaded');
      await miniWin.waitForTimeout(400);

      // Click expand icon
      await miniWin.locator('[data-testid="mini-expand-btn"]').click();
      await win.waitForTimeout(500);
      const hashAfterExpand = await win.evaluate(() => window.location.hash);
      assert.equal(hashAfterExpand, '#/now-playing', 'Expand button should navigate main window to Now Playing');
      console.log('PASS: Mini player expand button opens Now Playing');

      // Re-open mini player and test double-click on card
      await win.evaluate(() => {
        window.location.hash = '#/';
      });
      await win.evaluate(async () => {
        await window.electronAPI?.toggleMiniPlayer(true);
      });
      await win.waitForTimeout(800);
      const miniWin2 = app.windows().find((w) => w.url().includes('mini=1'));
      if (miniWin2) {
        await miniWin2.waitForLoadState('domcontentloaded');
        await miniWin2.locator('[data-testid="mini-player-card"]').dblclick();
        await win.waitForTimeout(500);
        const hashAfterDbl = await win.evaluate(() => window.location.hash);
        assert.equal(hashAfterDbl, '#/now-playing', 'Double-clicking mini player should open Now Playing');
        console.log('PASS: Mini player double-click opens Now Playing');
      }
    } else {
      console.log('SKIP: Mini player window not opened in headless test');
    }
  } finally {
    await app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
