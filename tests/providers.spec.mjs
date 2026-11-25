import { _electron as electron } from 'playwright';
import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const artifactDir = path.join(projectRoot, 'test-artifacts', 'playback');
fs.mkdirSync(artifactDir, { recursive: true });

async function runProviderTests() {
  const executablePath = fs.existsSync(path.join(projectRoot, 'release/win-unpacked/Nocturne.exe'))
    ? path.join(projectRoot, 'release/win-unpacked/Nocturne.exe')
    : path.join(projectRoot, 'node_modules/electron/dist/electron.exe');

  const launchArgs = executablePath.endsWith('Nocturne.exe') ? [] : [projectRoot];
  const electronApp = await electron.launch({ executablePath, args: launchArgs });
  const window = await electronApp.firstWindow();

  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(1000);

  const results = [];
  const record = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ' — ' + detail : ''}`);
    if (!ok) throw new Error(`Provider test failed: ${name} (${detail})`);
  };

  // 1. Verify "Full tracks only" filter is enabled by default & hides 30s-only Unakke Nizhalaanen
  await window.evaluate(() => { window.location.hash = '#/search'; });
  await window.waitForTimeout(500);
  const input = window.locator('input[type="text"], input[placeholder*="Search"]').first();
  await input.fill('Unakke Nizhalaanen');
  await window.waitForTimeout(3500);
  const fullOnlyText = await window.locator('main').innerText();
  record(
    'Full tracks only hides 30s-only iTunes preview by default',
    !/Unakke Nizhalaanen/i.test(fullOnlyText) || /No results found/i.test(fullOnlyText)
  );

  // Toggle "Full tracks only" off -> Unakke Nizhalaanen appears, but dblclick refuses 30s preview substitution
  const fullToggle = window.locator('button:has-text("Full tracks only")').first();
  await fullToggle.click();
  await window.waitForTimeout(500);
  const unakkeRow = window.locator('text=/Unakke Nizhalaanen/i').first();
  record('Unakke Nizhalaanen visible when Full tracks only is off', (await unakkeRow.count()) > 0);
  await unakkeRow.dblclick();
  await window.waitForTimeout(1000);
  await window.evaluate(() => { window.location.hash = '#/now-playing'; });
  await window.waitForTimeout(600);
  const npText = await window.locator('main').innerText();
  record(
    '30s iTunes preview is not silently substituted for full track',
    npText.includes('Could not play') ||
      npText.includes('30-second iTunes preview') ||
      npText.includes('Full track unavailable')
  );
  // Re-enable "Full tracks only"
  await window.evaluate(() => { window.location.hash = '#/search'; });
  await window.waitForTimeout(400);
  await window.locator('button:has-text("Full tracks only")').first().click();

  // 2. Multi-provider search for "Rathinamo" (with Full tracks only off to see iTunes/Tracks)
  await window.locator('button:has-text("Full tracks only")').first().click();
  await input.fill('Rathinamo');
  await window.waitForTimeout(3500);
  await window.screenshot({ path: path.join(artifactDir, 'provider_01_rathinamo.png') });
  const rathinamoText = await window.locator('main').innerText();
  const hasRathinamo = /rathinamo/i.test(rathinamoText) && !/No results found/i.test(rathinamoText);
  record('Search "Rathinamo" returns multi-provider results', hasRathinamo);

  // 2. Filter by iTunes provider pill
  const itunesPill = window.locator('button:has-text("iTunes")').first();
  if (await itunesPill.count()) {
    await itunesPill.click();
    await window.waitForTimeout(600);
  }
  const itunesText = await window.locator('main').innerText();
  record('iTunes provider filter shows results', /rathinamo/i.test(itunesText));

  // Switch back to All Sources
  const allPill = window.locator('button:has-text("All Sources")').first();
  if (await allPill.count()) await allPill.click();

  // 3. Tamil Unicode search ("முன்பே வா")
  await input.fill('முன்பே வா');
  await window.waitForTimeout(3500);
  const tamilBody = await window.locator('main').innerText();
  record('Tamil Unicode search returns results', !/No results found/i.test(tamilBody) && tamilBody.length > 100);

  // 4. Transliteration search ("Munbe Vaa")
  await input.fill('Munbe Vaa');
  await window.waitForTimeout(3500);
  const translitRow = window.locator('text=/Munbe Vaa/i').first();
  const hasTranslit = (await translitRow.count()) > 0;
  record('Transliteration search "Munbe Vaa" returns results', hasTranslit);

  // 5. Music Sources Settings page renders provider health & quality options
  await window.evaluate(() => { window.location.hash = '#/settings'; });
  await window.waitForTimeout(700);
  await window.screenshot({ path: path.join(artifactDir, 'provider_02_settings.png') });
  const settingsText = await window.locator('main').innerText();
  record(
    'Settings Music Sources section renders',
    settingsText.includes('Music Sources') && settingsText.includes('iTunes')
  );

  // 6. Mini player transparent window check
  await window.evaluate(() => window.electronAPI?.toggleMiniPlayer(true));
  await window.waitForTimeout(1200);
  const miniWin = electronApp.windows().find((w) => w.url().includes('mini=1'));
  record('Mini player window opens with ?mini=1', Boolean(miniWin));

  fs.writeFileSync(
    path.join(artifactDir, 'provider_results.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), executablePath, results }, null, 2)
  );

  await electronApp.close();
}

runProviderTests().catch((err) => {
  console.error(err);
  process.exit(1);
});

