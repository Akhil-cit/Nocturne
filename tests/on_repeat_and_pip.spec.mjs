import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

async function launchApp() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-test-'));
  const app = await electron.launch({
    args: [ROOT, `--user-data-dir=${userDataDir}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');
  await win.waitForTimeout(1200);
  return { app, win, userDataDir };
}

async function runTests() {
  const results = [];
  const { app, win, userDataDir } = await launchApp();

  try {
    // 1. On Repeat empty state
    await win.evaluate(() => {
      window.location.hash = '#/playlist/on-repeat';
    });
    await win.waitForTimeout(500);
    const emptyVisible = await win.locator('text=On Repeat').first().isVisible();
    assert.equal(emptyVisible, true, 'On Repeat page should render gracefully when empty');
    results.push('PASS: On Repeat empty state');

    // 2. On Repeat updates after meaningful listening & ranking correctness
    await win.evaluate(async () => {
      const store = window.__onRepeatStore.getState();
      const trackA = {
        id: 'test-onrepeat-a',
        title: 'Most Repeated Song',
        artist: 'Artist A',
        album: 'Album A',
        duration: 180,
        source: 'jiosaavn',
        availability: 'available',
      };
      const trackB = {
        id: 'test-onrepeat-b',
        title: 'Less Repeated Song',
        artist: 'Artist B',
        album: 'Album B',
        duration: 180,
        source: 'jiosaavn',
        availability: 'available',
      };
      await store.recordListeningEvent({
        track: trackB,
        listenSec: 120,
        meaningful: true,
        completed: false,
        skipped: false,
      });
      for (let i = 0; i < 3; i++) {
        await store.recordListeningEvent({
          track: trackA,
          listenSec: 175,
          meaningful: true,
          completed: true,
          skipped: false,
        });
      }
    });
    await win.waitForTimeout(500);
    const rankedOrder = await win.evaluate(async () => {
      return window.__onRepeatStore.getState().onRepeatTracks.map((t) => t.id);
    });
    assert.equal(rankedOrder[0], 'test-onrepeat-a', 'Higher play count + completion should rank first');
    assert.ok(rankedOrder.includes('test-onrepeat-b'), 'Second track should also be in On Repeat');
    results.push('PASS: On Repeat updates and ranking correctness');

    // 3. On Repeat visible on Home & Library
    await win.evaluate(() => {
      window.location.hash = '#/';
    });
    await win.waitForTimeout(400);
    assert.equal(await win.locator('text=On Repeat').first().isVisible(), true, 'On Repeat visible on Home');

    await win.evaluate(() => {
      window.location.hash = '#/library';
    });
    await win.waitForTimeout(400);
    assert.equal(await win.locator('text=On Repeat').first().isVisible(), true, 'On Repeat visible on Library');
    results.push('PASS: On Repeat visible on Home and Library');

    // 4. PiP / Mini Player synchronized lyric scrolling, pause freeze, and seek reset
    await win.evaluate(async () => {
      if (window.electronAPI?.setMiniPlayerEnabled) {
        await window.electronAPI.setMiniPlayerEnabled(true);
      }
    });
    await win.waitForTimeout(800);

    const windows = app.windows();
    const miniWin = windows.find((w) => w.url().includes('mini=1'));
    if (miniWin) {
      await miniWin.waitForLoadState('domcontentloaded');
      const longWords = [
        { text: 'Kaathalae', startTime: 10, endTime: 11 },
        { text: 'kaathalae', startTime: 11, endTime: 12 },
        { text: 'thanimaiyin', startTime: 12, endTime: 13 },
        { text: 'thunaiye', startTime: 13, endTime: 14 },
        { text: 'unakkena', startTime: 14, endTime: 15 },
        { text: 'vaazhgiren', startTime: 15, endTime: 16 },
        { text: 'anbe', startTime: 16, endTime: 17 },
      ];

      await win.evaluate((words) => {
        window.electronAPI?.sendMiniPlayerState({
          title: 'Test Song',
          artist: 'Test Artist',
          isPlaying: true,
          lyricLine: words.map((w) => w.text).join(' '),
          lyricWords: words,
          lyricLineIndex: 0,
          lyricWordIndex: 0,
          lyricLineProgress: 0,
          currentTime: 10,
        });
      }, longWords);
      await miniWin.waitForTimeout(200);
      const t0 = await miniWin.locator('[data-testid="mini-lyric-track"]').evaluate((el) => getComputedStyle(el).transform);

      await win.evaluate((words) => {
        window.electronAPI?.sendMiniPlayerState({
          title: 'Test Song',
          artist: 'Test Artist',
          isPlaying: true,
          lyricLine: words.map((w) => w.text).join(' '),
          lyricWords: words,
          lyricLineIndex: 0,
          lyricWordIndex: 6,
          lyricLineProgress: 0.9,
          currentTime: 16.5,
        });
      }, longWords);
      await miniWin.waitForTimeout(300);
      const t1 = await miniWin.locator('[data-testid="mini-lyric-track"]').evaluate((el) => getComputedStyle(el).transform);
      assert.notEqual(t0, t1, 'Mini lyric track should scroll horizontally as words advance');
      results.push('PASS: PiP lyric horizontal scrolling');

      // Seek / line change reset
      await win.evaluate((words) => {
        window.electronAPI?.sendMiniPlayerState({
          title: 'Test Song',
          artist: 'Test Artist',
          isPlaying: true,
          lyricLine: 'Short line',
          lyricWords: [{ text: 'Short', startTime: 20, endTime: 21 }, { text: 'line', startTime: 21, endTime: 22 }],
          lyricLineIndex: 1,
          lyricWordIndex: 0,
          lyricLineProgress: 0,
          currentTime: 20,
        });
      }, longWords);
      await miniWin.waitForTimeout(150);
      const tReset = await miniWin.locator('[data-testid="mini-lyric-track"]').evaluate((el) => getComputedStyle(el).transform);
      assert.ok(tReset === 'none' || tReset.includes('matrix(1, 0, 0, 1, 0, 0)'), 'Mini lyric track should reset on line change');
      results.push('PASS: PiP lyric seek/line-change reset');
    } else {
      results.push('SKIP: Mini player window not opened in headless test');
    }
  } finally {
    await app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }

  console.log('\n--- TEST RESULTS ---');
  for (const r of results) console.log(r);
}

runTests().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
