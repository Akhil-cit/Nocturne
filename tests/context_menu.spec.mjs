import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const APP_PATH = path.join('D:', 'Music', 'nocturne', 'release-v22', 'win-unpacked', 'Nocturne.exe');

async function run() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-ctx-test-'));
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
      timeout: 60000,
    });
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    await page.evaluate(() => {
      window.location.hash = '#/search';
    });
    await page.waitForTimeout(800);

    await test('Search Minnalvala, open three-dot context menu, open playlist picker', async () => {
      const input = page.locator('input[aria-label="Search music"]');
      await input.fill('Minnalvala');
      await page.waitForTimeout(3000);

      const moreBtn = page.locator('[data-testid="track-more-btn"]').first();
      assert.ok((await moreBtn.count()) > 0, 'Expected track-more-btn');
      await moreBtn.click({ force: true });
      await page.waitForTimeout(300);

      const menu = page.locator('[data-testid="track-context-menu"]');
      assert.ok((await menu.count()) > 0, 'Expected track-context-menu to be visible');

      await page.locator('[data-testid="ctx-add-to-playlist"]').click();
      await page.waitForTimeout(300);

      const picker = page.locator('[data-testid="playlist-picker-modal"]');
      assert.ok((await picker.count()) > 0, 'Expected playlist-picker-modal to be visible');

      await page.locator('[data-testid="picker-done-btn"]').click();
      await page.waitForTimeout(200);
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
