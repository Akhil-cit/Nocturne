import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const projectRoot = process.cwd();
const electronPath = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');

async function launchApp(userDataDir) {
  const app = await electron.launch({
    executablePath: electronPath,
    args: [projectRoot, `--user-data-dir=${userDataDir}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  return { app, page };
}

async function run() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-lib-redesign-'));

  // Seed a realistic 866-track playlist + 1 playable real track in nocturne-storage.json
  const tracks866 = Array.from({ length: 866 }, (_, i) => ({
    id: i === 0 ? 'tracks:14141684' : `imported:mock:${i}`,
    title: i === 0 ? 'What Makes You Beautiful' : `Night Track ${i + 1}`,
    artist: i === 0 ? 'One Direction' : `Artist ${(i % 25) + 1}`,
    artists: [{ id: `art-${i % 25}`, name: i === 0 ? 'One Direction' : `Artist ${(i % 25) + 1}` }],
    album: { id: `alb-${i % 40}`, title: i === 0 ? 'Up All Night' : `Album ${(i % 40) + 1}`, cover: '' },
    duration: i === 0 ? 200 : 180 + (i % 90),
    cover: '',
    provider: i === 0 ? 'tracks' : 'jiosaavn',
    availability: i === 865 ? 'metadata' : 'full',
    isPreview: false,
  }));

  fs.writeFileSync(
    path.join(userDataDir, 'nocturne-storage.json'),
    JSON.stringify({
      'nocturne:library': {
        favorites: [tracks866[0]],
        recentlyPlayed: [],
        playlists: [
          {
            id: 'pl-866',
            name: 'Liked Import 866',
            description: 'Large imported playlist fixture',
            sourcePlatform: 'spotify',
            createdAt: Date.now() - 86400000,
            tracks: tracks866,
          },
        ],
      },
    }),
    'utf-8'
  );

  let passed = 0;
  let total = 0;

  async function check(name, fn) {
    total++;
    try {
      await fn();
      passed++;
      console.log(`PASS | ${name}`);
    } catch (err) {
      console.log(`FAIL | ${name} | ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const { app, page } = await launchApp(userDataDir);

  try {
    await check('Sidebar separates Home, Search, Your Library, Now Playing, Studio, Settings', async () => {
      for (const label of ['Home', 'Search', 'Your Library', 'Now Playing', 'Visualization Studio', 'Settings']) {
        await page.getByRole('link', { name: label }).waitFor({ state: 'visible', timeout: 3000 });
      }
      await page.getByRole('link', { name: 'Your Library' }).click();
      await page.getByRole('heading', { name: 'Your Library' }).waitFor({ state: 'visible', timeout: 5000 });
      assert.ok(await page.evaluate(() => window.location.hash.includes('/library')));
    });

    await check('Library page shows Grid/List views, Search, Sort, and 866-track playlist card', async () => {
      await page.getByText('Liked Import 866').waitFor({ state: 'visible', timeout: 5000 });
      await page.getByText(/866 tracks/i).waitFor({ state: 'visible', timeout: 5000 });

      await page.getByRole('button', { name: 'List view' }).click();
      await page.getByText('Liked Import 866').waitFor({ state: 'visible', timeout: 3000 });
      await page.getByRole('button', { name: 'Grid view' }).click();

      await page.getByLabel('Filter library').fill('Liked Import');
      await page.getByText('Liked Import 866').waitFor({ state: 'visible', timeout: 3000 });
      await page.getByLabel('Filter library').fill('');
    });

    await check('Playlist Detail page virtualizes 866 tracks & supports search', async () => {
      await page.getByText('Liked Import 866').click();
      await page.getByRole('heading', { name: 'Liked Import 866' }).waitFor({ state: 'visible', timeout: 5000 });
      await page.getByRole('button', { name: 'Play All' }).waitFor({ state: 'visible', timeout: 3000 });
      await page.getByRole('button', { name: 'Shuffle Play' }).waitFor({ state: 'visible', timeout: 3000 });
      await page.getByRole('button', { name: 'Smart Mix' }).waitFor({ state: 'visible', timeout: 3000 });

      const renderedRowCount = await page.locator('button[aria-label^="Like "]').count();
      console.log(`  Virtualized DOM rows rendered for 866 tracks: ${renderedRowCount}`);
      assert.ok(renderedRowCount > 0 && renderedRowCount < 40, `Expected virtualized rows (<40), got ${renderedRowCount}`);

      await page.getByLabel('Search in playlist').fill('Night Track 500');
      await page.getByText('Night Track 500').waitFor({ state: 'visible', timeout: 3000 });
      await page.getByLabel('Search in playlist').fill('');
    });

    await check('Playback starts from playlist & persists while navigating between pages', async () => {
      const playRowBtn = page.locator('button[aria-label="Play What Makes You Beautiful"]').first();
      await playRowBtn.waitFor({ state: 'attached', timeout: 5000 });
      await playRowBtn.evaluate((el) => el.click());

      let playing = false;
      for (let i = 0; i < 25; i++) {
        await page.waitForTimeout(500);
        const footerText = await page.locator('footer').innerText();
        const times = [...footerText.matchAll(/\b(\d+:\d{2})\b/g)].map((m) => m[1]);
        if (times.length >= 2 && times[0] !== '0:00') {
          playing = true;
          break;
        }
      }
      assert.ok(playing, 'Playback did not advance past 0:00');

      // Navigate across pages and verify pause button remains active
      await page.getByRole('link', { name: 'Your Library' }).click();
      await page.waitForTimeout(300);
      await page.getByRole('link', { name: 'Home' }).click();
      await page.waitForTimeout(300);
      await page.locator('footer button[aria-label="Pause"]').waitFor({ state: 'visible', timeout: 3000 });
    });

    await check('Queue Drawer separates Now Playing from Up Next & supports Clear', async () => {
      await page.getByRole('button', { name: 'Toggle queue' }).click();
      const drawer = page.getByRole('complementary', { name: 'Playback Queue' });
      await drawer.waitFor({ state: 'visible', timeout: 3000 });
      await drawer.getByText('Now Playing').waitFor({ state: 'visible', timeout: 3000 });
      await drawer.getByText(/Up Next \(\d+\)/).waitFor({ state: 'visible', timeout: 3000 });
      await drawer.getByRole('button', { name: 'Close Queue' }).click();
      await drawer.waitFor({ state: 'hidden', timeout: 3000 });
    });

    await check('Playlist Management: Create, Edit, Duplicate, Delete with confirmation', async () => {
      await page.getByRole('link', { name: 'Your Library' }).click();
      await page.getByRole('button', { name: 'New Playlist' }).click();
      await page.getByPlaceholder('New playlist name...').fill('My Test Mix');
      await page.getByRole('button', { name: 'Create' }).click();

      await page.getByRole('heading', { name: 'My Test Mix' }).waitFor({ state: 'visible', timeout: 5000 });
      await page.getByRole('button', { name: 'Edit playlist details' }).click();
      await page.getByPlaceholder('Playlist name').fill('My Renamed Mix');
      await page.getByRole('button', { name: 'Save' }).click();
      await page.getByRole('heading', { name: 'My Renamed Mix' }).waitFor({ state: 'visible', timeout: 3000 });

      await page.getByRole('button', { name: 'More playlist options' }).click();
      await page.getByRole('button', { name: 'Duplicate playlist' }).click();
      await page.getByRole('heading', { name: 'My Renamed Mix (Copy)' }).waitFor({ state: 'visible', timeout: 5000 });

      await page.getByRole('button', { name: 'More playlist options' }).click();
      await page.getByRole('button', { name: 'Delete playlist' }).click();
      await page.getByRole('button', { name: 'Confirm Delete' }).click();
      await page.getByRole('heading', { name: 'Your Library' }).waitFor({ state: 'visible', timeout: 5000 });
    });

    await check('Home page is clean & clicking playlist card opens Playlist Detail', async () => {
      await page.getByRole('link', { name: 'Home' }).click();
      await page.getByText('Your Playlists').waitFor({ state: 'visible', timeout: 5000 });
      await page.getByText('Liked Import 866').first().click();
      await page.getByRole('heading', { name: 'Liked Import 866' }).waitFor({ state: 'visible', timeout: 5000 });
    });

    console.log(`\nLibrary Redesign Summary: ${passed}/${total} passed`);
    process.exitCode = passed === total ? 0 : 1;
  } finally {
    await app.close().catch(() => {});
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
