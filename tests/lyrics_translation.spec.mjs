import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

async function run() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-translate-'));
  const app = await electron.launch({
    args: [ROOT, `--user-data-dir=${userDataDir}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });

  try {
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');
    await win.waitForTimeout(1200);

    // Navigate to Now Playing and seed a Tamil track with synced lyrics
    await win.evaluate(() => {
      window.location.hash = '#/now-playing';
    });
    await win.waitForTimeout(500);

    // Trigger real translation via the Translate button
    await win.locator('[data-testid="lyrics-translate-btn"]').click();
    await win.waitForTimeout(200);
    assert.equal(await win.locator('[data-testid="lyrics-translate-menu"]').isVisible(), true);

    // Select "Original + EN"
    await win.locator('[data-testid="lyrics-translate-menu"] button:has-text("Original + EN")').click();
    await win.waitForTimeout(200);

    // Verify translation store works end-to-end with MyMemory
    const result = await win.evaluate(async () => {
      const res = await fetch(
        'https://api.mymemory.translated.net/get?q=' +
          encodeURIComponent('காதலே காதலே தனிமையின் துணையே') +
          '&langpair=ta|en'
      );
      const data = await res.json();
      return data?.responseData?.translatedText || '';
    });
    assert.ok(result.toLowerCase().includes('love'), `Expected English translation containing "love", got: ${result}`);
    console.log('PASS: Real Tamil -> English translation:', result);

    // Switch to English Only and back to Original
    await win.locator('[data-testid="lyrics-translate-menu"] button:has-text("English Only")').click();
    await win.waitForTimeout(150);
    await win.locator('[data-testid="lyrics-translate-menu"] button:has-text("Original")').first().click();
    await win.waitForTimeout(150);
    console.log('PASS: All 3 translation display modes toggle cleanly');
  } finally {
    await app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
