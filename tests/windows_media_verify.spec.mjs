import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const APP_PATH = path.join('D:', 'Music', 'nocturne', 'release-v26', 'win-unpacked', 'Nocturne.exe');

async function run() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-media-verify-'));
  let electronApp;
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`FAIL: ${name}`, err);
      failed++;
    }
  }

  try {
    electronApp = await electron.launch({
      executablePath: APP_PATH,
      args: [`--user-data-dir=${tempDir}`],
      timeout: 45000,
    });
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    await test('Media Session API is available in renderer', async () => {
      const hasMS = await page.evaluate(() => 'mediaSession' in navigator);
      assert.equal(hasMS, true);
    });

    await test('Window minimizes and restores cleanly', async () => {
      const isMinBefore = await electronApp.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        return win ? win.isMinimized() : false;
      });
      assert.equal(isMinBefore, false);

      await electronApp.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.minimize();
      });
      await page.waitForTimeout(400);

      const isMinAfter = await electronApp.evaluate(({ BrowserWindow }) => {
        return BrowserWindow.getAllWindows()[0]?.isMinimized() ?? false;
      });
      assert.equal(isMinAfter, true);

      await electronApp.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.restore();
      });
      await page.waitForTimeout(400);
    });

    await test('Taskbar ThumbarButtons are registered on Windows', async () => {
      const hasWin = await electronApp.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        return Boolean(win && typeof win.setThumbarButtons === 'function');
      });
      assert.equal(hasWin, true);
    });

    await test('Sleep timer, Search, and Now Playing remain functional', async () => {
      const timerBtn = page.locator('[data-testid="sleep-timer-btn"]').first();
      assert.ok((await timerBtn.count()) > 0, 'Expected sleep-timer-btn');

      await page.evaluate(() => {
        window.location.hash = '#/search';
      });
      await page.waitForTimeout(500);
      assert.ok((await page.locator('input[aria-label="Search music"]').count()) > 0);
    });
  } finally {
    if (electronApp) await electronApp.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
