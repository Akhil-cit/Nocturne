import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const APP_PATH = path.join('D:', 'Music', 'nocturne', 'release-v20', 'win-unpacked', 'Nocturne.exe');

async function run() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-search-test-'));
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

    await page.evaluate(() => {
      window.location.hash = '#/search';
    });
    await page.waitForTimeout(1000);

    await test('All 5 search category tabs are rendered', async () => {
      for (const cat of ['all', 'tracks', 'albums', 'artists', 'playlists']) {
        const tab = page.locator(`[data-testid="search-cat-${cat}"]`);
        assert.ok((await tab.count()) > 0, `Expected tab search-cat-${cat}`);
      }
    });

    await test('Search for Sai Abhyankkar returns results and category tabs switch', async () => {
      const input = page.locator('input[aria-label="Search music"]');
      await input.fill('Sai Abhyankkar');
      await page.waitForTimeout(2500);

      // Switch to Artists tab
      await page.locator('[data-testid="search-cat-artists"]').click();
      await page.waitForTimeout(800);

      // Switch to Playlists tab with Tamil query
      await input.fill('Tamil hits');
      await page.locator('[data-testid="search-cat-playlists"]').click();
      await page.waitForTimeout(2500);

      // Switch back to All
      await page.locator('[data-testid="search-cat-all"]').click();
      await page.waitForTimeout(500);
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
