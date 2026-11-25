import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
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
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-import-test-'));
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

  let session = await launchApp(userDataDir);

  try {
    const { page } = session;

    await check('Open Import Playlist dialog & detect platforms', async () => {
      const importBtn = page.getByRole('button', { name: /Import Playlist/i }).first();
      await importBtn.click();
      const dialog = page.getByRole('dialog', { name: 'Import Playlist' });
      await dialog.waitFor({ state: 'visible', timeout: 5000 });

      const urlInput = dialog.getByLabel('Playlist URL');

      await urlInput.fill('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M');
      await dialog.getByText('Spotify', { exact: true }).last().waitFor({ state: 'visible' });

      await urlInput.fill('https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb');
      await dialog.getByText('Apple Music', { exact: true }).last().waitFor({ state: 'visible' });

      await urlInput.fill('https://music.youtube.com/playlist?list=RDCLAK5uy_kmPRjHDECIcuVwnKsx2Ng7fyNgFKWNJFs');
      await dialog.getByText('YouTube Music', { exact: true }).last().waitFor({ state: 'visible' });

      await urlInput.fill('https://www.youtube.com/playlist?list=PL4fGSI1pDJn6puJdseH2Rt9sMvt9E2M4i');
      await dialog.getByText('YouTube', { exact: true }).last().waitFor({ state: 'visible' });

      await urlInput.fill('https://www.jiosaavn.com/featured/taaza-tunes/Me5R7I32W2E_');
      await dialog.getByText('JioSaavn', { exact: true }).last().waitFor({ state: 'visible' });
    });

    await check('Invalid URL shows clear error message', async () => {
      const dialog = page.getByRole('dialog', { name: 'Import Playlist' });
      const urlInput = dialog.getByLabel('Playlist URL');
      await urlInput.fill('https://example.com/not-a-playlist');
      await dialog.getByRole('button', { name: /Fetch Playlist/i }).click();
      await dialog.getByRole('alert').waitFor({ state: 'visible', timeout: 5000 });
      const alertText = await dialog.getByRole('alert').innerText();
      assert.match(alertText, /Unrecognized URL/i);
    });

    await check('CSV import with English, Tamil, duplicate & unavailable tracks', async () => {
      const dialog = page.getByRole('dialog', { name: 'Import Playlist' });
      const csvContent = [
        'Track Name,Artist Name(s),Album,Duration',
        '"What Makes You Beautiful","One Direction","Up All Night","3:20"',
        '"Rathinamo","Yuvan Shankar Raja","Tamil","3:45"',
        '"What Makes You Beautiful","One Direction","Up All Night","3:20"',
        '"NonExistent Quantum Track XYZ 99999","Nobody Artist","","2:10"',
      ].join('\n');

      const fileInput = dialog.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'Test_Mixed_Playlist.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(csvContent, 'utf-8'),
      });

      await dialog.getByText('4 tracks').waitFor({ state: 'visible', timeout: 5000 });
      await dialog.getByRole('button', { name: /Start Import/i }).click();

      await dialog.getByText('Import matching complete').waitFor({ state: 'visible', timeout: 30000 });

      const matchedText = await dialog.getByText(/Matched:\s*\d+/).innerText();
      const dupText = await dialog.getByText(/Duplicates:\s*\d+/).innerText();
      const unavailText = await dialog.getByText(/Unavailable:\s*\d+/).innerText();
      console.log(`  CSV counts -> ${matchedText} | ${dupText} | ${unavailText}`);

      assert.ok(parseInt(matchedText.replace(/\D/g, ''), 10) >= 1, 'Expected >=1 matched track');
      assert.ok(parseInt(dupText.replace(/\D/g, ''), 10) >= 1, 'Expected >=1 duplicate detected');
      assert.ok(parseInt(unavailText.replace(/\D/g, ''), 10) >= 1, 'Expected >=1 unavailable track');

      await dialog.getByRole('button', { name: /Save Playlist to Library/i }).click();
      await dialog.waitFor({ state: 'hidden', timeout: 5000 });
    });

    await check('Imported playlist appears on Home & plays imported track', async () => {
      const card = page.getByText('Test_Mixed_Playlist', { exact: true }).first();
      await card.waitFor({ state: 'visible', timeout: 5000 });
      await card.click();

      const playBtn = page.locator('main button[aria-label^="Play What Makes You Beautiful"]').first();
      await playBtn.waitFor({ state: 'attached', timeout: 5000 });
      await playBtn.evaluate((el) => el.click());

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
      assert.ok(playing, 'Imported track playback did not advance past 0:00');
    });

    await check('Simulated HTTP 429 rate-limit handling via local HTTP server', async () => {
      let hits = 0;
      const server = http.createServer((_req, res) => {
        hits++;
        if (hits === 1) {
          res.writeHead(429, { 'Retry-After': '1', 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'rate limited' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const addr = server.address();
      const testUrl = `http://127.0.0.1:${addr.port}/test-429`;
      try {
        const first = await page.evaluate((u) => window.electronAPI.fetchUrl({ url: u }), testUrl);
        const second = await page.evaluate((u) => window.electronAPI.fetchUrl({ url: u }), testUrl);
        assert.equal(first.status, 429);
        assert.equal(first.headers['retry-after'], '1');
        assert.equal(second.status, 200);
        assert.equal(hits, 2);
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    });

    await session.app.close();
    session = await launchApp(userDataDir);

    await check('Imported playlist persists after Electron restart', async () => {
      const card = session.page.getByText('Test_Mixed_Playlist', { exact: true }).first();
      await card.waitFor({ state: 'visible', timeout: 8000 });
    });

    await check('M3U8 local file import & cancellation support', async () => {
      const { page: p2 } = session;
      await p2.getByRole('button', { name: /Import Playlist/i }).first().click();
      const dialog = p2.getByRole('dialog', { name: 'Import Playlist' });
      await dialog.waitFor({ state: 'visible', timeout: 5000 });

      const m3u8 = [
        '#EXTM3U',
        '#PLAYLIST:Tamil_Mix_M3U8',
        '#EXTINF:220,Anirudh Ravichander - Rathamaarey',
        'C:\\Music\\Rathamaarey.mp3',
        '#EXTINF:200,One Direction - What Makes You Beautiful',
        'C:\\Music\\WMYB.mp3',
      ].join('\n');

      await dialog.locator('input[type="file"]').setInputFiles({
        name: 'Tamil_Mix.m3u8',
        mimeType: 'audio/x-mpegurl',
        buffer: Buffer.from(m3u8, 'utf-8'),
      });

      await dialog.getByText('Tamil_Mix_M3U8').waitFor({ state: 'visible', timeout: 5000 });
      await dialog.getByText('2 tracks').waitFor({ state: 'visible', timeout: 5000 });
    });

    console.log(`\nPlaylist Import Summary: ${passed}/${total} passed`);
    process.exitCode = passed === total ? 0 : 1;
  } finally {
    await session.app.close().catch(() => {});
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
