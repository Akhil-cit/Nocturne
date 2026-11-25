import { _electron as electron } from 'playwright';
import path from 'path';

const projectRoot = process.cwd();

function parseTimeSec(str) {
  const m = str.match(/(\d+):(\d{2})/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

async function testTrack(page, query, expectMinDurationSec = 60) {
  await page.evaluate(() => { window.location.hash = '#/search'; });
  await page.waitForTimeout(400);

  const searchInput = page.locator('input[type="text"], input[placeholder*="Search"]').first();
  await searchInput.waitFor({ state: 'visible', timeout: 10000 });
  await searchInput.fill(query);
  await searchInput.press('Enter');

  // Wait for search results
  await page.waitForTimeout(3000);

  // Click the first track play button in main (hidden until hover)
  const firstTrack = page.locator('main button[aria-label^="Play "]').first();
  await firstTrack.waitFor({ state: 'attached', timeout: 10000 });
  const trackLabel = await firstTrack.getAttribute('aria-label');
  await firstTrack.evaluate((el) => el.click());

  // Wait up to 15s for playback time in the player bar to advance past 0:00
  let state = { currentTimeSec: 0, durationSec: 0, error: '', paused: true };
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(500);
    state = await page.evaluate(() => {
      const footer = document.querySelector('footer') || document.body;
      const text = footer.innerText || '';
      const times = [...text.matchAll(/\b(\d+:\d{2})\b/g)].map((m) => m[1]);
      const bodyText = document.body.innerText || '';
      const errMatch = bodyText.match(/(Full track unavailable\.[^\n]*|Stream server rate-limited[^\n]*|Playback stalled[^\n]*|Failed to load[^\n]*)/);
      const hasPauseBtn = Boolean(document.querySelector('button[aria-label="Pause"]'));
      return {
        times,
        hasPauseBtn,
        error: errMatch ? errMatch[1] : '',
      };
    });
    const currentTimeSec = state.times.length >= 2 ? parseTimeSec(state.times[0]) : 0;
    const durationSec = state.times.length >= 2 ? parseTimeSec(state.times[state.times.length - 1]) : 0;
    state.currentTimeSec = currentTimeSec;
    state.durationSec = durationSec;
    if (durationSec >= expectMinDurationSec && currentTimeSec >= 1) break;
  }

  const ok = state.durationSec >= expectMinDurationSec && state.currentTimeSec >= 1 && !state.error;
  console.log(`${ok ? 'PASS' : 'FAIL'} | "${query}" (${trackLabel}) | dur=${state.durationSec}s | t=${state.currentTimeSec}s | playing=${state.hasPauseBtn} | err=${state.error}`);
  if (!ok) {
    const snap = await page.evaluate(() => document.querySelector('footer')?.innerText?.replace(/\s+/g, ' ').slice(0, 140) || '');
    console.log(`  footer: ${snap}`);
  }
  return ok;
}

async function main() {
  const electronPath = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
  const app = await electron.launch({
    executablePath: electronPath,
    args: [projectRoot],
    env: { ...process.env, NODE_ENV: 'production' },
  });

  try {
    const page = await app.firstWindow();
    page.on('pageerror', (e) => console.log('[PAGEERROR]', e.message));
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const queries = [
      'What Makes You Beautiful',
      'Rathamaarey',
      'Verappa',
      'Sweater Weather',
      'Rathinamo Female Version',
      'Unakke Nizhalaanen',
      "Killin' em Scene",
    ];

    let passed = 0;
    for (const q of queries) {
      try {
        if (await testTrack(page, q)) passed++;
      } catch (err) {
        console.log(`FAIL | "${q}" | exception=${err instanceof Error ? err.message : String(err)}`);
      }
    }
    console.log(`\nSummary: ${passed}/${queries.length} passed`);
    process.exitCode = passed === queries.length ? 0 : 1;
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

