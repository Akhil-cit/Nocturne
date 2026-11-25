import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

async function run() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-search-reg-'));
  const app = await electron.launch({
    args: [ROOT, `--user-data-dir=${userDataDir}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });

  const errors = [];
  try {
    const win = await app.firstWindow();
    win.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    win.on('crash', () => errors.push('renderer crashed'));

    await win.waitForLoadState('domcontentloaded');
    await win.waitForTimeout(1200);

    await win.evaluate(() => {
      window.location.hash = '#/search';
    });
    await win.waitForTimeout(500);

    // Ensure native <datalist> is removed
    const datalistCount = await win.locator('datalist').count();
    assert.equal(datalistCount, 0, 'Native <datalist> should not be present');

    // Seed malformed track in libraryStore to verify normalize() never crashes on undefined fields
    await win.evaluate(() => {
      const store = window.__nocturneLibraryStore;
      if (store?.setState) {
        store.setState((s) => ({
          recentlyPlayed: [{ id: 'malformed-1', title: 'Naan Un', artist: undefined, album: {} }, ...(s.recentlyPlayed || [])],
        }));
      }
    });

    const input = win.locator('input[aria-label="Search music"]');
    await input.click();

    // 1. Letter-by-letter "naane"
    await input.pressSequentially('naane', { delay: 180 });
    await win.waitForTimeout(1500);
    const body1 = await win.evaluate(() => document.body.innerText.trim());
    assert.ok(body1.length > 0, 'Page should not be blank after typing naane');
    console.log('PASS: Letter-by-letter "naane"');

    // 2. Rapidly delete & change query
    await input.fill('');
    await win.waitForTimeout(150);
    await input.pressSequentially('anirudh', { delay: 40 });
    await win.waitForTimeout(200);
    await input.fill('நானே');
    await win.waitForTimeout(1200);
    const body2 = await win.evaluate(() => document.body.innerText.trim());
    assert.ok(body2.length > 0, 'Page should not be blank after rapid/Tamil Unicode search');
    console.log('PASS: Rapid typing, delete, and Tamil Unicode search');

    // 3. Navigate away during active search
    await input.fill('ar rahman');
    await win.evaluate(() => {
      window.location.hash = '#/';
    });
    await win.waitForTimeout(500);
    const homeVisible = await win.locator('[data-testid="home-greeting"]').isVisible();
    assert.equal(homeVisible, true, 'Navigating away during search should render Home cleanly');
    console.log('PASS: Navigate away during active search');

    assert.equal(errors.length, 0, `Unexpected errors: ${errors.join('; ')}`);
  } finally {
    await app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
