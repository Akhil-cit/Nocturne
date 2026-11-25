import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const { _electron: electron } = await import('playwright').then(m => m.default ?? m);
const executablePath = path.resolve(process.argv[2] || path.join(root, 'release/win-unpacked/Nocturne.exe'));
const phase = process.argv[3] || 'current';
const suite = process.argv[4] || 'all';
if (!/^[\w-]+$/.test(phase)) throw new Error('Invalid report name');
const output = path.join(root, 'test-artifacts', 'recovery', phase);
fs.mkdirSync(output, { recursive: true });
const profile = fs.mkdtempSync(path.join(output, 'profile-'));
const report = { started: new Date().toISOString(), executablePath, suite, checks: [], catalog: [], network: [], errors: [] };
const save = () => fs.writeFileSync(path.join(output, suite + '.json'), JSON.stringify(report, null, 2));
let app;
let page;
async function check(name, fn) {
  try {
    report.checks.push({ name, pass: true, detail: await fn() });
  } catch (e) {
    report.checks.push({ name, pass: false, error: e.message });
  }
  save();
  console.log(report.checks.at(-1).pass ? 'PASS' : 'FAIL', name, report.checks.at(-1).error || '');
}
const navigate = route => page.evaluate(route => { window.location.hash = '#/' + route; }, route);
const snapshot = () => page.evaluate(() => {
  const a = window.testAudio;
  return a && { time: a.currentTime, duration: a.duration, paused: a.paused, ended: a.ended, status: a.readyState,
    providerHost: a.currentSrc && new URL(a.currentSrc).host, protocol: a.currentSrc && new URL(a.currentSrc).protocol, code: a.error?.code };
});
function fixture() {
  const seconds = 38, sampleRate = 16000, data = Buffer.alloc(44 + seconds * sampleRate * 2);
  data.write('RIFF'); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(sampleRate, 24); data.writeUInt32LE(sampleRate * 2, 28);
  data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36);
  data.writeUInt32LE(data.length - 44, 40);
  for (let i = 0; i < sampleRate * seconds; i++) data.writeInt16LE(Math.round(200 * Math.sin(i * 2 * Math.PI * 440 / sampleRate)), 44 + i * 2);
  const wav = path.join(output, 'Owned recording.wav');
  fs.writeFileSync(wav, data);
  const lrc = path.join(output, 'Owned recording.lrc');
  fs.writeFileSync(lrc, '[00:00.00]First line\n[00:05.00]தமிழ் வரி\n[00:32.00]Last line\n');
  return { wav, lrc };
}
async function respondDialog(file) {
  await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, file);
}
async function localChecks() {
  const { wav, lrc } = fixture();
  await navigate('');
  await respondDialog(wav);
  await check('Owned WAV opens through the native picker', async () => {
    await page.getByRole('button', {name: /open local files/i}).first().click();
    await page.waitForFunction(() => window.testAudio?.currentTime > 0.3);
    const state = await snapshot();
    assert.equal(state.duration, 38); return state;
  });
  await navigate('now-playing');
  await check('Imported LRC changes active line with the media clock', async () => {
    await respondDialog(lrc);
    await page.getByTitle('Import .lrc file').click();
    await page.waitForFunction(() => [...document.querySelectorAll('p.font-semibold')].some(p => p.textContent === 'தமிழ் வரி'), null, { timeout: 12000 });
    const state = await snapshot();
    assert.ok(state.time >= 5 && state.time < 32 && !state.paused);
    return state;
  });
  await check('Immersive constellation renders while media advances', async () => {
    await page.getByLabel('Enter immersive mode').last().click();
    const canvas = page.getByLabel('Constellation lyrics visualization');
    await canvas.waitFor();
    const first = await canvas.evaluate(c => c.toDataURL());
    await page.waitForTimeout(400);
    assert.ok(await canvas.evaluate((c, before) => c.width > 0 && c.height > 0 && c.toDataURL() !== before, first));
    assert.equal((await snapshot()).paused, false);
    await page.screenshot({ path: path.join(output, 'immersive.png') });
  });
  await page.keyboard.press('Escape');
  await check('Floating mini player opens from the player bar', async () => {
    await page.locator('button[aria-label="Toggle mini player"]').click();
    const mini = await findWindow('mini=1');
    await mini.waitForLoadState('domcontentloaded');
    return await mini.locator('body').innerText();
  });
  await check('Desktop overlay opens from Studio', async () => {
    await navigate('studio');
    const toggle = page.getByText('Desktop Edge Overlay', { exact: true }).locator('../../..').getByRole('button');
    await toggle.click();
    const overlay = await findWindow('overlay=1');
    await overlay.locator('canvas').first().waitFor({state:'attached'});
    await toggle.click();
  });
  await check('Local playback naturally crosses 30 seconds and completes', async () => {
    await page.waitForFunction(() => window.testAudio.currentTime > 30, null, { timeout: 42000 });
    await page.waitForFunction(() => window.testMediaEvents.some(e => e.event === 'ended' && e.time === 38), null, { timeout: 12000 });
    report.fixtureEvents = await page.evaluate(() => window.testMediaEvents.slice());
    assert.ok(!report.fixtureEvents.some(e => e.event === 'seeked' && e.time > 1));
    return await snapshot();
  });
  await check('Audio quality and full-track filter survive renderer reload', async () => {
    await navigate('search');
    const full = page.getByRole('button', { name: 'Full tracks only' });
    const initial = await full.getAttribute('class');
    await full.click();
    await navigate('settings');
    await page.getByLabel('Preferred provider audio quality').selectOption('high');
    await page.reload();
    assert.equal(await page.getByLabel('Preferred provider audio quality').inputValue(), 'high');
    await navigate('search');
    assert.notEqual(await full.getAttribute('class'), initial);
    await full.click();
  });
}
async function findWindow(query) {
  for (let i = 0; i < 50; i++) {
    const match = app.windows().find(w => w.url().includes(query));
    if (match) return match;
    await page.waitForTimeout(100);
  }
  throw new Error('Missing window ' + query);
}

async function fallbackChecks() {
  const { wav } = fixture();
  const catalogUrl = 'https://commons.wikimedia.org/w/api.php*';
  const stream = 'https://upload.wikimedia.org/wikipedia/commons/test/owned-recording.wav';
  const pageFixture = {
    pageid: 777, title: 'File:Owned recording.wav',
    videoinfo: [{ url: stream, mime: 'audio/wav', width:0, height:0, duration:38,
      size:fs.statSync(wav).size, extmetadata:{ LicenseShortName:{value:'Public domain'}, Artist:{value:'Unknown Artist'} } }],
  };
  await page.route(catalogUrl, route => route.fulfill({json:{query:{pages:[pageFixture]}}}));
  await page.route(stream, route => route.fulfill({status:200, contentType:'audio/wav', body:fs.readFileSync(wav), headers:{'Access-Control-Allow-Origin':'*'}}));
  await navigate('settings');
  await page.getByLabel('Preferred provider audio quality').selectOption('lossless');
  await page.getByLabel(/Priority for .*Commons/i).selectOption('1');
  await navigate('search');
  await page.getByRole('button',{name:'Commons',exact:true}).click();
  await page.getByRole('textbox',{name:'Search music'}).fill('Owned recording');
  const row = page.locator('main div.group.grid').filter({hasText:'Owned recording'}).first();
  await check('Controlled Commons catalog selects supported WAV when FLAC is absent', async () => {
    await row.dblclick();
    await page.waitForFunction(() => window.testAudio.currentTime > 0.3);
    assert.equal((await snapshot()).providerHost, 'upload.wikimedia.org');
    await navigate('now-playing');
    await page.locator('button[title*="stream details"]').click();
    const ui = (await page.locator('main').innerText()).split(/\nLYRICS\b/i)[0];
    assert.match(ui,/WAV/i);
    return ui;
  });
  await navigate('');
  await respondDialog(wav);
  await page.getByRole('button', {name:/open local files/i}).first().click();
  await page.waitForFunction(() => ['file:', 'blob:'].includes(new URL(window.testAudio.currentSrc).protocol) && !window.testAudio.paused);
  let failures = 0;
  await page.unroute(stream);
  await page.route(stream, route => { failures++; return route.fulfill({status:503, headers:{'Access-Control-Allow-Origin':'*'},body:'Controlled failure'}); });
  await navigate('search');
  await page.getByRole('button',{name:'Commons',exact:true}).click();
  await page.getByRole('textbox',{name:'Search music'}).fill('Owned recording');
  await check('Controlled Commons media failure falls back to matching local recording', async () => {
    await row.dblclick();
    await page.waitForFunction(() => window.testAudio.currentTime > 1 && /^(?:blob|file):/.test(window.testAudio.currentSrc) && !window.testAudio.paused, null, {timeout:30000});
    assert.ok(failures >= 1);
    await navigate('now-playing');
    const details = page.locator('button[title*="stream details"]');
    if (!await page.getByText('Playback Provider',{exact:true}).isVisible()) await details.click();
    const ui = (await page.locator('main').innerText()).split(/\nLYRICS\b/i)[0];
    assert.match(ui,/Playback Provider\s+local/i);
    return {failures,ui, media:await snapshot()};
  });
}
async function catalogChecks() {
  // Start from a fresh profile for catalog-only runs. Explicitly include metadata rows.
  await navigate('search');
  const full = page.getByRole('button', {name:'Full tracks only'});
  if ((await full.getAttribute('class')).includes('emerald')) await full.click();
  if (phase.startsWith('baseline')) await page.getByRole('button', {name:'iTunes',exact:true}).click();
  const searches = [
    ['Rathinamo', /rathinamo.*female/i, /saurav|tanisha/i],
    ['Unakke Nizhalaanen', /unakke nizhalaanen/i, /scene/i],
    ["Killin' em", /killin['’\s]*em/i, /scene/i],
    ['The Star-Spangled Banner', /star.spangled banner/i, /solo vocalist.*navy band/i],
  ];
  for (const [query, title, identity] of searches) {
    await navigate('search');
    const input = page.getByRole('textbox', {name:'Search music'});
    await input.fill(query);
    await page.waitForTimeout(550);
    await page.locator('main .space-y-6.animate-pulse').waitFor({state:'hidden', timeout:18000});
    const data = await page.locator('main div.group.grid').evaluateAll(rows => rows.map(row => ({
      title: row.querySelector('p.text-sm')?.textContent, text: row.innerText,
    })));
    const idx = data.findIndex(r => title.test(r.title) && identity.test(r.text));
    const result = {query, top: data.slice(0,4), selected: data[idx], status: 'matching recording absent', summary: (await page.locator('main').innerText()).slice(0,850)};
    if (idx >= 0 && !(phase.startsWith('baseline') && query === 'The Star-Spangled Banner')) {
      await page.evaluate(() => { window.testMediaEvents.length = 0; });
      await page.locator('main div.group.grid').nth(idx).dblclick();
      await navigate('now-playing');
      await page.waitForTimeout(2400);
      const details = page.locator('button[title*="stream details"]');
      if (await details.count()) await details.first().click();
      result.ui = (await page.locator('main').innerText()).split(/\nLYRICS\b/i)[0].slice(0,1400);
      result.media = await snapshot();
      if (result.media?.time > 0 && !result.media.paused) {
        try {
          await page.waitForFunction(() => window.testAudio.currentTime > 30, null, {timeout:38000});
          result.status = 'advanced past 30s';
          if (query === 'The Star-Spangled Banner' && result.media.duration <= 180) {
            await page.waitForFunction(() => window.testMediaEvents.some(e => e.event === 'ended'), null, {timeout:Math.ceil(result.media.duration * 1000)});
            result.status = 'completed naturally';
          }
        } catch { result.status = 'did not pass 30s'; }
      } else result.status = 'did not start';
      result.finalMedia = await snapshot();
      result.events = await page.evaluate(() => window.testMediaEvents.slice());
    }
    report.catalog.push(result); save();
    console.log(query, result.status, data.length, 'rows');
  }
}
try {
  const args = ['--user-data-dir=' + profile];
  if (/electron\.exe$/i.test(executablePath)) args.push(path.resolve(root));
  app = await electron.launch({executablePath, args, timeout:30000});
  assert.equal(path.resolve(await app.evaluate(({app}) => app.getPath('userData'))).toLowerCase(), path.resolve(profile).toLowerCase());
  page = await app.firstWindow();
  page.setDefaultTimeout(6500);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('requestfailed', req => {
    if (/^https?:/.test(req.url())) report.network.push({host: new URL(req.url()).host, failure:req.failure()?.errorText});
  });
  page.on('response', res => {
    const url = new URL(res.url());
    if (/^https?:/.test(url.protocol) && ['fetch','xhr','media'].includes(res.request().resourceType()))
      report.network.push({ host:url.host, path:url.pathname.split('/').slice(0,2).join('/'), status:res.status(), type:res.headers()['content-type'] });
  });
  await page.addInitScript(() => {
    window.testMediaEvents = [];
    window.Audio = class extends window.Audio {
      constructor(...args) {
        super(...args);
        if (window.testAudio) return; // Duration probes create separate Audio elements.
        window.testAudio = this;
        for (const event of ['loadedmetadata','play','playing','pause','waiting','stalled','error','ended','seeked'])
          this.addEventListener(event, () => window.testMediaEvents.push({event, time:this.currentTime, duration:this.duration, code:this.error?.code}));
      }
    };
  });
  await page.reload();
  if (suite === 'local' || suite === 'all') await localChecks();
  if (suite === 'fallback') await fallbackChecks();
  if (suite === 'catalog' || suite === 'all') await catalogChecks();
} catch (e) {
  report.errors.push(e.message);
  console.error(e.message);
  process.exitCode = 1;
} finally {
  if (app) await app.close();
  if (path.dirname(profile) === output && path.basename(profile).startsWith('profile-')) {
    fs.rmSync(profile, {recursive:true, force:true, maxRetries:4, retryDelay:500});
  }
  report.finished = new Date().toISOString();
  save();
  if (report.checks.some(c => !c.pass)) process.exitCode = 1;
}




