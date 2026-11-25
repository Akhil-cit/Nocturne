import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

async function run() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-scroll-'));
  const app = await electron.launch({
    args: [ROOT, `--user-data-dir=${userDataDir}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });

  try {
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');
    await win.waitForTimeout(1200);

    // Seed a 900-track playlist via On Repeat store (or navigate to on-repeat)
    await win.evaluate(async () => {
      const tracks = Array.from({ length: 900 }, (_, i) => ({
        id: `scroll-test-${i}`,
        title: `Track Number ${i + 1}`,
        artist: `Artist ${(i % 20) + 1}`,
        album: `Album ${(i % 10) + 1}`,
        duration: 180 + (i % 60),
        source: 'jiosaavn',
        availability: 'available',
      }));
      window.__onRepeatStore.setState({ onRepeatTracks: tracks, updatedAt: Date.now() });
      window.location.hash = '#/playlist/on-repeat';
    });
    await win.waitForTimeout(700);

    // 1. Initial expanded header visible, compact header hidden
    const expandedVisible = await win.locator('[data-testid="playlist-expanded-header"]').isVisible();
    assert.equal(expandedVisible, true, 'Expanded header should be visible at top');
    const compactOpacityTop = await win
      .locator('[data-testid="playlist-compact-header"]')
      .evaluate((el) => getComputedStyle(el).opacity);
    assert.equal(compactOpacityTop, '0', 'Compact header should be hidden at top');
    await win.screenshot({ path: path.join(ROOT, 'tests', 'playlist-before-scroll.png') });
    console.log('PASS: Initial expanded header');

    // 2. Scroll down -> compact header appears, sticky table header stays below it
    await win.evaluate(() => {
      const scroller = document.querySelector('main.overflow-y-auto') || document.querySelector('.overflow-y-auto');
      if (scroller) scroller.scrollTop = 600;
    });
    await win.waitForTimeout(400);

    const compactOpacityScrolled = await win
      .locator('[data-testid="playlist-compact-header"]')
      .evaluate((el) => getComputedStyle(el).opacity);
    assert.equal(compactOpacityScrolled, '1', 'Compact header should be visible after scrolling');

    const compactRect = await win.locator('[data-testid="playlist-compact-header"]').boundingBox();
    const tableHeaderRect = await win.locator('[data-testid="playlist-table-header"]').boundingBox();
    assert.ok(compactRect && tableHeaderRect, 'Both sticky headers should have bounding boxes');
    assert.ok(
      tableHeaderRect.y >= compactRect.y + compactRect.height - 2,
      `Table header (y=${tableHeaderRect.y}) should sit below compact header (bottom=${compactRect.y + compactRect.height})`
    );
    await win.screenshot({ path: path.join(ROOT, 'tests', 'playlist-after-scroll.png') });
    console.log('PASS: Collapsed compact header & sticky table header');

    // 3. Window resize check
    await win.setViewportSize({ width: 960, height: 640 });
    await win.waitForTimeout(250);
    const tableHeaderAfterResize = await win.locator('[data-testid="playlist-table-header"]').boundingBox();
    assert.ok(tableHeaderAfterResize && tableHeaderAfterResize.width > 500, 'Table header should adapt to resize');
    console.log('PASS: Window resize');

    // 4. Return to top -> compact header hides again
    await win.evaluate(() => {
      const scroller = document.querySelector('main.overflow-y-auto') || document.querySelector('.overflow-y-auto');
      if (scroller) scroller.scrollTop = 0;
    });
    await win.waitForTimeout(400);
    const compactOpacityBackTop = await win
      .locator('[data-testid="playlist-compact-header"]')
      .evaluate((el) => getComputedStyle(el).opacity);
    assert.equal(compactOpacityBackTop, '0', 'Compact header should hide when returning to top');
    console.log('PASS: Return to top');
  } finally {
    await app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
