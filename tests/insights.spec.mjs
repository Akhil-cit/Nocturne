import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const APP_PATH = path.join('D:', 'Music', 'nocturne', 'release-v31', 'win-unpacked', 'Nocturne.exe');

async function run() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-insights-test-'));
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

    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await test('Insights page renders without crashing', async () => {
      await page.evaluate(() => {
        window.location.hash = '#/insights';
      });
      await page.waitForTimeout(800);
      const heading = page.locator('h1', { hasText: 'Insights' });
      assert.ok((await heading.count()) > 0, 'Expected Insights heading');
      assert.equal(errors.length, 0, `Unexpected page errors: ${errors.join(', ')}`);
    });

    await test('Date range filters and Nocturne Wrapped modal work', async () => {
      for (const label of ['Today', '7 Days', '30 Days', 'All Time']) {
        await page.locator('button', { hasText: label }).click();
        await page.waitForTimeout(150);
      }
      await page.locator('[data-testid="open-wrapped-btn"]').click();
      await page.waitForTimeout(300);
      assert.ok((await page.locator('[data-testid="wrapped-modal"]').count()) > 0);
      await page.locator('[data-testid="wrapped-modal"] button', { hasText: 'Close' }).click();
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
