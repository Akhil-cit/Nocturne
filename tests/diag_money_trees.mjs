import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-diag-'));
const app = await electron.launch({
  args: ['D:\\Music\\nocturne', `--user-data-dir=${dir}`],
  env: { ...process.env, NODE_ENV: 'production' },
});
const win = await app.firstWindow();
await win.waitForLoadState('domcontentloaded');
await win.waitForTimeout(1500);

win.on('console', (m) => {
  if (m.type() === 'error' || m.text().includes('tracks') || m.text().includes('MEDIA') || m.text().includes('DIAG')) {
    console.log('[CONSOLE]', m.text());
  }
});

await win.evaluate(() => {
  window.location.hash = '#/search';
});
await win.waitForTimeout(500);

const input = win.locator('input[placeholder*="Search"]').first();
await input.fill('Money Trees - Speed Ren');
await input.press('Enter');
await win.waitForTimeout(5000);

const buttons = await win.locator('button').allTextContents();
const matching = buttons.filter((t) => t.toLowerCase().includes('money trees'));
console.log('Matching buttons:', matching.slice(0, 5));

if (matching.length > 0) {
  await win.locator('button:has-text("Money Trees")').first().click();
  await win.waitForTimeout(6000);
}

await app.close();
fs.rmSync(dir, { recursive: true, force: true });
