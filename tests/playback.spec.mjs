import { _electron as electron } from 'playwright';
import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const artifactDir = path.join(projectRoot, 'test-artifacts', 'playback');
fs.mkdirSync(artifactDir, { recursive: true });

function createTestWav(filePath, durationSec = 12, freq = 440) {
  const sampleRate = 22050;
  const numSamples = sampleRate * durationSec;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.round(Math.sin((2 * Math.PI * freq * i) / sampleRate) * 4000);
    buffer.writeInt16LE(sample, 44 + i * 2);
  }
  fs.writeFileSync(filePath, buffer);
}

async function runTests() {
  const wav1 = path.join(artifactDir, 'fixture_track_1.wav');
  const wav2 = path.join(artifactDir, 'fixture_track_2.wav');
  const lrc1 = path.join(artifactDir, 'fixture_track_1.lrc');
  createTestWav(wav1, 12, 440);
  createTestWav(wav2, 10, 523);
  fs.writeFileSync(
    lrc1,
    '[00:00.00]First line of regression track\n[00:08.50]Second line after seek\n',
    'utf8'
  );

  const executablePath = fs.existsSync(path.join(projectRoot, 'release/win-unpacked/Nocturne.exe'))
    ? path.join(projectRoot, 'release/win-unpacked/Nocturne.exe')
    : path.join(projectRoot, 'node_modules/electron/dist/electron.exe');

  const launchArgs = executablePath.endsWith('Nocturne.exe') ? [] : [projectRoot];
  console.log('Launching:', executablePath);

  const electronApp = await electron.launch({ executablePath, args: launchArgs });
  const window = await electronApp.firstWindow();

  await window.addInitScript(() => {
    window.__testMedia = { el: null, events: [] };
    const OrigAudio = window.Audio;
    window.Audio = function (...args) {
      const a = new OrigAudio(...args);
      if (!window.__testMedia.el) {
        window.__testMedia.el = a;
        ['play', 'playing', 'pause', 'waiting', 'stalled', 'error', 'ended', 'seeked'].forEach((ev) => {
          a.addEventListener(ev, () => {
            window.__testMedia.events.push({ ev, t: a.currentTime, paused: a.paused, rs: a.readyState });
          });
        });
      }
      return a;
    };
    window.Audio.prototype = OrigAudio.prototype;
  });

  await window.waitForLoadState('domcontentloaded');
  await window.reload();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(1000);

  const results = [];
  const record = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ' — ' + detail : ''}`);
    if (!ok) throw new Error(`Test failed: ${name} (${detail})`);
  };

  // 1. Open two local audio fixtures via Electron dialog
  await electronApp.evaluate(({ dialog }, files) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: files });
  }, [wav1, wav2]);
  await window.locator('button:has-text("Open Local Files"), button:has-text("Open local files")').first().click();
  await window.waitForTimeout(2000);

  // 2. Verify playback position advances
  const t0 = await window.evaluate(() => window.__testMedia.el?.currentTime ?? 0);
  await window.waitForTimeout(1500);
  const snap = await window.evaluate(() => ({
    t1: window.__testMedia.el?.currentTime ?? 0,
    paused1: window.__testMedia.el?.paused ?? true,
  }));
  record('Audio playback advances', snap.t1 > t0 && !snap.paused1, `t0=${t0.toFixed(2)} -> t1=${snap.t1.toFixed(2)}`);

  // 3. Pause and resume repeatedly (respects intentional pause)
  await window.evaluate(() => { window.location.hash = '#/now-playing'; });
  await window.waitForTimeout(400);
  const toggleBtn = window.locator('button[aria-label="Pause"], button[aria-label="Play"]').first();
  await toggleBtn.click(); // Pause
  await window.waitForTimeout(500);
  const pausedAfterClick = await window.evaluate(() => window.__testMedia.el?.paused);
  const tPaused1 = await window.evaluate(() => window.__testMedia.el?.currentTime ?? 0);
  await window.waitForTimeout(700);
  const tPaused2 = await window.evaluate(() => window.__testMedia.el?.currentTime ?? 0);
  record('Intentional pause holds position', pausedAfterClick === true && Math.abs(tPaused2 - tPaused1) < 0.05);

  await toggleBtn.click(); // Resume
  await window.waitForTimeout(700);
  const pausedAfterResume = await window.evaluate(() => window.__testMedia.el?.paused);
  record('Resume from intentional pause', pausedAfterResume === false);

  // 4. Import LRC & Seek forward via lyric line
  await electronApp.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  }, lrc1);
  await window.locator('button:has-text(".lrc")').first().click();
  await window.waitForTimeout(600);

  await window.locator('text=Second line after seek').click();
  await window.waitForTimeout(500);
  const tAfterSeek = await window.evaluate(() => window.__testMedia.el?.currentTime ?? 0);
  record('Seek forward via lyric line', tAfterSeek >= 8.0, `t=${tAfterSeek.toFixed(2)}`);

  // 5. Switch Normal <-> Immersive mode without stopping playback
  await window.locator('button:has-text("Immersive")').first().click();
  await window.waitForTimeout(700);
  const playingInImmersive = await window.evaluate(() => !window.__testMedia.el?.paused);
  record('Continuous playback in Immersive mode', playingInImmersive);
  await window.keyboard.press('Escape');
  await window.waitForTimeout(400);

  // 6. Verify queue auto-transition on track end
  await window.evaluate(() => {
    if (window.__testMedia.el) window.__testMedia.el.currentTime = 11.4;
  });
  await window.waitForTimeout(1800);
  const currentTitleAfterEnd = await window.locator('h1').first().textContent();
  record('Queue transitions to next track on end', currentTitleAfterEnd?.includes('fixture_track_2'), `title=${currentTitleAfterEnd}`);

  // 7. Rapid next/prev track switching
  const nextBtn = window.locator('button[aria-label="Next track"]').first();
  const prevBtn = window.locator('button[aria-label="Previous track"]').first();
  await prevBtn.click();
  await nextBtn.click();
  await window.waitForTimeout(800);
  const playingAfterRapid = await window.evaluate(() => !window.__testMedia.el?.paused);
  record('Rapid track switching remains stable', playingAfterRapid);

  // 8. Minimize and restore Electron window during playback
  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.minimize();
  });
  await window.waitForTimeout(400);
  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.restore();
  });
  await window.waitForTimeout(400);
  const playingAfterRestore = await window.evaluate(() => !window.__testMedia.el?.paused);
  record('Playback continues across minimize/restore', playingAfterRestore);

  // 9. Search & play live authorized track ("Verappa")
  await window.evaluate(() => { window.location.hash = '#/search'; });
  await window.waitForTimeout(400);
  const searchInput = window.locator('input[type="text"], input[placeholder*="Search"]').first();
  await searchInput.fill('Verappa');
  const verappaRow = window.locator('text=/Verappa/i').first();
  await verappaRow.waitFor({ state: 'visible', timeout: 15000 });
  await verappaRow.dblclick();
  await window.waitForTimeout(3000);
  const liveTime1 = await window.evaluate(() => window.__testMedia.el?.currentTime ?? 0);
  await window.waitForTimeout(2000);
  const liveTime2 = await window.evaluate(() => window.__testMedia.el?.currentTime ?? 0);
  record('Live search & stream playback advances', liveTime2 > liveTime1, `t1=${liveTime1.toFixed(2)} -> t2=${liveTime2.toFixed(2)}`);

  // 10. Simulate transient media network failure (503 once, then 200) and verify automatic recovery
  let interceptedCount = 0;
  await window.route('https://tracks.monochrome.st/track/**', async (route) => {
    interceptedCount += 1;
    if (interceptedCount === 1) {
      await route.fulfill({ status: 503, body: 'Service Unavailable' });
    } else {
      await route.continue();
    }
  });
  await window.evaluate(() => { window.location.hash = '#/search'; });
  await window.waitForTimeout(300);
  const searchInput2 = window.locator('input[type="text"], input[placeholder*="Search"]').first();
  await searchInput2.fill('Reflections');
  const refRow = window.locator('text=/Reflections/i').first();
  await refRow.waitFor({ state: 'visible', timeout: 15000 });
  await refRow.dblclick();
  await window.waitForTimeout(4500);
  const recT1 = await window.evaluate(() => window.__testMedia.el?.currentTime ?? 0);
  await window.waitForTimeout(2000);
  const recT2 = await window.evaluate(() => window.__testMedia.el?.currentTime ?? 0);
  await window.unroute('https://tracks.monochrome.st/track/**');
  record(
    'Transient 503 stream failure recovers automatically',
    interceptedCount >= 2 && recT2 > recT1,
    `intercepts=${interceptedCount} t1=${recT1.toFixed(2)} -> t2=${recT2.toFixed(2)}`
  );

  fs.writeFileSync(
    path.join(artifactDir, 'regression_results.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), executablePath, results }, null, 2)
  );

  await electronApp.close();
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});

