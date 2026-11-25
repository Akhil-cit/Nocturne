import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-repro-'));
const app = await electron.launch({
  executablePath: 'D:\\Music\\nocturne\\release-v6\\win-unpacked\\Nocturne.exe',
  args: [`--user-data-dir=${dir}`],
});

const win = await app.firstWindow();
win.on('pageerror', (e) => console.error('PAGEERROR:', e.stack || e));
win.on('console', (m) => {
  if (m.type() === 'error') console.error('CONSOLE_ERR:', m.text());
});
win.on('crash', () => console.error('RENDERER_CRASHED'));

await win.waitForLoadState('domcontentloaded');
await win.waitForTimeout(1500);
await win.evaluate(() => {
  window.location.hash = '#/search';
});
await win.waitForTimeout(600);

const input = win.locator('input[aria-label="Search music"]');
await input.click();
await input.pressSequentially('naane', { delay: 180 });
await win.waitForTimeout(3000);

const bodyText = await win.evaluate(() => document.body.innerText.slice(0, 200));
console.log('BODY_AFTER_TYPING:', JSON.stringify(bodyText));

await app.close();
fs.rmSync(dir, { recursive: true, force: true });
