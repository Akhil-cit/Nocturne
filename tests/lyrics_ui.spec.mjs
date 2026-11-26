/**
 * Playwright Electron tests for:
 * 1. No horizontal scrollbar in normal lyrics panel
 * 2. Spotify-style lyrics mode activation and display
 * 3. Translation integration in both modes
 * 4. Mode switching & persistence
 */
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const APP_PATH = path.join('D:', 'Music', 'nocturne', 'release-v14', 'win-unpacked', 'Nocturne.exe');

async function run() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-lyrics-test-'));
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

    // Navigate to Now Playing
    await page.evaluate(() => {
      if (window.location.hash !== undefined) window.location.hash = '#/now-playing';
    });
    await page.waitForTimeout(1500);

    await test('Normal lyrics panel has no horizontal scrollbar (overflow-x: hidden)', async () => {
      const lyricsPanel = page.locator('.overflow-x-hidden.overflow-y-auto').first();
      const count = await lyricsPanel.count();
      assert.ok(count > 0, 'Expected lyrics panel with overflow-x-hidden overflow-y-auto');
      const overflowX = await lyricsPanel.evaluate((el) => getComputedStyle(el).overflowX);
      assert.equal(overflowX, 'hidden');
    });

    await test('Spotify-style mode toggle exists and switches modes', async () => {
      const liveBtn = page.locator('button', { hasText: '♪ Live' });
      assert.ok((await liveBtn.count()) > 0, 'Expected ♪ Live button');
      await liveBtn.click();
      await page.waitForTimeout(400);

      const spotifyBadge = page.locator('text=Spotify Style');
      assert.ok((await spotifyBadge.count()) > 0, 'Expected Spotify Style badge');

      const normalBtn = page.locator('button', { hasText: 'Normal' });
      assert.ok((await normalBtn.count()) > 0, 'Expected Normal button');
      await normalBtn.click();
      await page.waitForTimeout(400);

      assert.ok((await liveBtn.count()) > 0, 'Expected ♪ Live button after switching back');
    });

    await test('Spotify mode persists across navigations', async () => {
      const liveBtn = page.locator('button', { hasText: '♪ Live' });
      await liveBtn.click();
      await page.waitForTimeout(400);

      await page.evaluate(() => {
        window.location.hash = '#/';
      });
      await page.waitForTimeout(800);
      await page.evaluate(() => {
        window.location.hash = '#/now-playing';
      });
      await page.waitForTimeout(800);

      const spotifyBadge = page.locator('text=Spotify Style');
      assert.ok((await spotifyBadge.count()) > 0, 'Expected Spotify Style to persist');

      const normalBtn = page.locator('button', { hasText: 'Normal' });
      await normalBtn.click();
      await page.waitForTimeout(300);
    });

    await test('Translation controls work in Spotify mode', async () => {
      const liveBtn = page.locator('button', { hasText: '♪ Live' });
      await liveBtn.click();
      await page.waitForTimeout(400);

      const translateBtn = page.locator('[data-testid="lyrics-translate-btn"]');
      assert.ok((await translateBtn.count()) > 0, 'Expected translate button in Spotify mode');
      await translateBtn.click();
      await page.waitForTimeout(300);

      assert.ok((await page.locator('button', { hasText: 'Original' }).count()) > 0);
      assert.ok((await page.locator('button', { hasText: 'Original + EN' }).count()) > 0);
      assert.ok((await page.locator('button', { hasText: 'English Only' }).count()) > 0);

      await translateBtn.click();
      await page.locator('button', { hasText: 'Normal' }).click();
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
