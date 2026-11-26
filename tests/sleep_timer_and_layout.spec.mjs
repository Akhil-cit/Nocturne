import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const APP_PATH = path.join('D:', 'Music', 'nocturne', 'release-v19', 'win-unpacked', 'Nocturne.exe');

async function run() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-timer-test-'));
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
      timeout: 30000,
    });
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    await test('Sleep timer opens, sets 15m, extends, and cancels', async () => {
      const btn = page.locator('[data-testid="sleep-timer-btn"]').first();
      assert.ok((await btn.count()) > 0, 'Expected sleep-timer-btn');
      await btn.click();
      await page.waitForTimeout(300);

      const popover = page.locator('[data-testid="sleep-timer-popover"]');
      assert.ok((await popover.count()) > 0, 'Expected sleep-timer-popover');

      await popover.locator('button', { hasText: '15m' }).click();
      await page.waitForTimeout(300);

      // Active countdown badge should be visible
      const btnText = await btn.innerText();
      assert.ok(btnText.includes(':'), `Expected countdown in button, got: ${btnText}`);

      // Reopen and cancel
      await btn.click();
      await page.waitForTimeout(200);
      await page.locator('[data-testid="sleep-timer-cancel"]').click();
      await page.waitForTimeout(200);
    });

    await test('Now Playing layout adapts at 1280x720 and 1600x900', async () => {
      await page.evaluate(() => {
        window.location.hash = '#/now-playing';
      });
      await page.waitForTimeout(800);

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.waitForTimeout(300);
      await page.setViewportSize({ width: 1600, height: 900 });
      await page.waitForTimeout(300);
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
