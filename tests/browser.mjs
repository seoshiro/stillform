import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';

const startServer = process.env.TEST_START_SERVER === '1';
const url = process.env.TEST_URL || (startServer ? 'http://127.0.0.1:5091' : 'http://127.0.0.1:5088');
if (!process.env.PUPPETEER_MODULE || !process.env.AXE_MODULE || !process.env.BROWSER_PATH) {
  throw new Error('Set PUPPETEER_MODULE, AXE_MODULE, and BROWSER_PATH to existing local test-tool paths. See README.md.');
}
const { default: puppeteer } = await import(pathToFileURL(process.env.PUPPETEER_MODULE).href);
const output = path.resolve('test-results');
await mkdir(output, { recursive: true });
let server;
if (startServer) {
  server = spawn(process.execPath, ['scripts/serve.mjs', ...(process.env.TEST_PRODUCTION === '1' ? ['--dist'] : [])], { cwd: process.cwd(), env: { ...process.env, PORT: new URL(url).port }, stdio: 'pipe', windowsHide: true });
  server.stderr.on('data', (data) => console.error(String(data)));
  let ready = false;
  for (let attempt = 0; attempt < 30 && !ready; attempt++) {
    try { ready = (await fetch(url)).ok; } catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  if (!ready) { server.kill(); throw new Error('The local test server could not start.'); }
}
const browser = await puppeteer.launch({ executablePath: process.env.BROWSER_PATH, headless: true, args: ['--mute-audio'], defaultViewport: { width: 1440, height: 1000 } });
const report = { date: new Date().toISOString(), browser: await browser.version(), productionBuild: process.env.TEST_PRODUCTION === '1', checks: [], accessibility: [], consoleErrors: [], screenshots: [] };
function pass(name, evidence) { report.checks.push({ name, status: 'PASS', evidence }); console.log('PASS ' + name + (evidence ? ' — ' + evidence : '')); }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const click = async (page, selector) => {
  await page.waitForSelector(selector, { visible: true });
  await page.$eval(selector, (element) => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await sleep(80);
  await page.click(selector);
};
const text = (page, selector) => page.$eval(selector, (element) => element.textContent.trim());
async function setRange(page, selector, value) { await page.$eval(selector, (element, next) => { element.value = next; element.dispatchEvent(new Event('input', { bubbles: true })); }, value); }
async function screenshot(page, name, fullPage = false) { const file = path.join(output, name + '.png'); await page.screenshot({ path: file, fullPage }); report.screenshots.push(file); }
async function axe(page, name) {
  // Evaluate the audit tool through DevTools, keeping the app's CSP enforced.
  await page.evaluate(await readFile(process.env.AXE_MODULE, 'utf8'));
  const result = await page.evaluate(async () => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
  const violations = result.violations.map(({ id, impact, nodes, description }) => ({ id, impact, description, nodes: nodes.map((node) => ({ target: node.target, summary: node.failureSummary })) }));
  report.accessibility.push({ name, violations, passes: result.passes.length, incomplete: result.incomplete.length });
  assert.equal(violations.length, 0, name + ': ' + JSON.stringify(violations));
  pass(name + ' accessibility', result.passes.length + ' axe checks passed; zero WCAG A/AA violations');
}
async function newPage(viewport) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  if (viewport) await page.setViewport(viewport);
  page.on('pageerror', (error) => report.consoleErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  await page.evaluateOnNewDocument(() => {
    const now = Date.now.bind(Date);
    window.__clockOffset = 0;
    Date.now = () => now() + window.__clockOffset;
    const NativeAudioContext = window.AudioContext;
    window.__audioContexts = [];
    window.AudioContext = class extends NativeAudioContext {
      constructor(...args) {
        super(...args);
        window.__audioContexts.push(this);
        const makeCompressor = this.createDynamicsCompressor.bind(this);
        this.createDynamicsCompressor = () => {
          const compressor = makeCompressor();
          this.__compressor = compressor;
          return compressor;
        };
      }
    };
  });
  return page;
}

try {
  const page = await newPage();
  const requests = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto(url, { waitUntil: 'networkidle0' });
  assert.match(await page.title(), /STILLFORM/);
  assert.equal(await page.evaluate(() => window.__audioContexts.length), 0);
  assert.equal(await page.$eval('#main-play', (element) => element.getAttribute('aria-pressed')), 'false');
  assert.equal(requests.filter((request) => !request.startsWith(url) && !request.startsWith('data:')).length, 0);
  pass('Initial load and privacy', 'No autoplay, external requests, or runtime dependencies');
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(9, 9, 11)');
  assert.equal(await page.evaluate(() => document.fonts.check('100px "Bodoni Moda"')), true);
  assert.equal(await page.$$eval('.brand-mark, .title-star, .manifesto-star', (elements) => elements.length), 0);
  assert.equal(await page.evaluate(() => document.body.textContent.includes('✳')), false);
  await click(page, '.sound-case[data-cover-scene="tidal"]');
  assert.equal(await text(page, '#scene-name'), 'Tidal');
  assert.equal(await page.$eval('.scene-option[data-scene-select="tidal"]', (button) => button.getAttribute('aria-pressed')), 'true');
  await click(page, '.atmosphere-tabs [data-cover-scene="orbit"]');
  assert.equal(await text(page, '#scene-name'), 'Orbit');
  assert.equal(await text(page, '#hero-play-label'), 'Listen to Orbit');
  await click(page, '.atmosphere-tabs [data-cover-scene="ember"]');
  await page.evaluate(() => scrollTo(0, 0));
  await sleep(250);
  pass('Dark gallery and cover selection', 'Local serif font loaded; star motif removed; 3D cover and category pills synchronize the mixer');
  await screenshot(page, 'desktop', true);
  await screenshot(page, 'desktop-viewport');

  await click(page, '#main-play');
  await sleep(750);
  assert.equal(await page.evaluate(() => window.__audioContexts[0].state), 'running');
  assert.equal(await page.$eval('#main-play', (element) => element.getAttribute('aria-pressed')), 'true');
  const peak = await page.evaluate(async () => {
    const ctx = window.__audioContexts[0];
    const analyser = ctx.createAnalyser();
    const silent = ctx.createGain();
    silent.gain.value = 0;
    ctx.__compressor.connect(analyser).connect(silent).connect(ctx.destination);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const samples = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(samples);
    analyser.disconnect();
    silent.disconnect();
    return Math.max(...samples.map(Math.abs));
  });
  assert.ok(peak > 0.00001 && peak < 1, 'Audio has nonzero, unclipped output');
  pass('Web Audio playback', 'AudioContext running; measured signal peak ' + peak.toFixed(5));
  await setRange(page, '#texture', 22);
  await setRange(page, '#depth', 71);
  await setRange(page, '#drift', 84);
  await setRange(page, '#master', 40);
  assert.equal(await text(page, '#texture-value'), '22%');
  assert.equal(await text(page, '#depth-value'), '71%');
  assert.equal(await text(page, '#drift-value'), '84%');
  assert.equal(await text(page, '#master-value'), '40%');
  await click(page, '[data-scene-select="tidal"]');
  assert.equal(await text(page, '#scene-name'), 'Tidal');
  assert.equal(await text(page, '#texture-value'), '80%');
  await click(page, '[data-scene-select="orbit"]');
  assert.equal(await text(page, '#scene-name'), 'Orbit');
  assert.equal(await text(page, '#drift-value'), '80%');
  assert.equal(await page.$eval('#visual-room', (element) => element.dataset.scene), 'orbit');
  await click(page, '#reset-mix');
  assert.equal(await text(page, '#texture-value'), '25%');
  await setRange(page, '#texture', 37);
  pass('Scenes and all mixer controls', 'Three palettes/presets, slider output, and reset');
  await click(page, '#main-play');
  await sleep(80);
  assert.equal(await page.evaluate(() => window.__audioContexts[0].state), 'suspended');
  pass('Pause audio', 'AudioContext suspended');

  await click(page, '#save-mix');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'mix-name');
  await page.type('#mix-name', '   ');
  await click(page, '#save-form button[type="submit"]');
  assert.match(await text(page, '#save-error'), /name/);
  await page.$eval('#mix-name', (element) => { element.value = ''; element.dispatchEvent(new Event('input')); });
  await page.type('#mix-name', 'Late-night orbit <3');
  await axe(page, 'Save dialog');
  await click(page, '#save-form button[type="submit"]');
  assert.equal(await text(page, '.saved-card h3'), 'Late-night orbit <3');
  assert.equal(await text(page, '#collection-count'), '01');
  await page.reload({ waitUntil: 'networkidle0' });
  assert.equal(await text(page, '.saved-card h3'), 'Late-night orbit <3');
  assert.equal(await text(page, '#texture-value'), '37%');
  assert.equal(await page.evaluate(() => window.__audioContexts.length), 0);
  await click(page, '[data-scene-select="ember"]');
  await click(page, '.load-mix');
  assert.equal(await text(page, '#scene-name'), 'Orbit');
  assert.equal(await text(page, '#texture-value'), '37%');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'main-play');
  pass('Save, persist, and restore', 'Named mix survives reload; exact values restored without autoplay; whitespace rejected');

  await click(page, '[data-duration="15"]');
  assert.equal((await text(page, '#timer-display')).replace(/\s/g, ''), '15:00');
  await click(page, '#timer-toggle');
  await sleep(1150);
  assert.match(await text(page, '#timer-toggle'), /Pause/);
  assert.notEqual((await text(page, '#timer-display')).replace(/\s/g, ''), '15:00');
  await click(page, '#timer-toggle');
  const pausedTime = await text(page, '#timer-display');
  await sleep(1100);
  assert.equal(await text(page, '#timer-display'), pausedTime);
  await click(page, '#timer-toggle');
  await page.evaluate(() => { window.__clockOffset += 15 * 60 * 1000; });
  await sleep(400);
  assert.equal((await text(page, '#timer-display')).replace(/\s/g, ''), '00:00');
  assert.equal(await page.$eval('.timer-progress', (element) => element.getAttribute('aria-valuenow')), '100');
  await click(page, '#timer-reset');
  assert.equal((await text(page, '#timer-display')).replace(/\s/g, ''), '15:00');
  await click(page, '[data-duration="45"]');
  assert.equal((await text(page, '#timer-display')).replace(/\s/g, ''), '45:00');
  await click(page, '[data-duration="25"]');
  pass('Focus timer', 'All durations, ticking, pause, continue, reset, and simulated wall-clock completion');

  await click(page, '#about-button');
  assert.ok(await page.$eval('#about-dialog', (element) => element.open));
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'about-button');
  await page.focus('#master');
  const beforeKey = Number(await page.$eval('#master', (element) => element.value));
  await page.keyboard.press('ArrowRight');
  assert.equal(Number(await page.$eval('#master', (element) => element.value)), beforeKey + 1);
  pass('Keyboard and dialogs', 'Native dialog Escape/focus restoration and range keyboard controls');

  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await sleep(100);
  assert.equal(await page.$eval('#motion-toggle', (element) => element.getAttribute('aria-pressed')), 'true');
  assert.equal(await page.$eval('html', (element) => getComputedStyle(element).scrollBehavior), 'auto');
  await click(page, '#motion-toggle');
  assert.equal(await page.$eval('#motion-toggle', (element) => element.getAttribute('aria-pressed')), 'false');
  await click(page, '#motion-toggle');
  pass('Reduced motion', 'System preference pauses artwork; manual toggle remains available; no smooth scroll');
  await axe(page, 'Desktop with saved mix');
  for (const width of [1920, 1440, 1024, 768, 600, 390, 320]) {
    await page.setViewport({ width, height: 1000 });
    await sleep(60);
    const layout = await page.evaluate(() => ({ inner: innerWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(layout.scroll <= layout.inner, 'No horizontal overflow at ' + width + ': ' + JSON.stringify(layout));
  }
  pass('Responsive layout', 'No horizontal overflow at 320, 390, 600, 768, 1024, 1440, and 1920px');

  const mobile = await newPage({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await mobile.goto(url, { waitUntil: 'networkidle0' });
  await screenshot(mobile, 'mobile', true);
  await screenshot(mobile, 'mobile-viewport');
  await click(mobile, '.menu-toggle');
  assert.equal(await mobile.$eval('.menu-toggle', (element) => element.getAttribute('aria-expanded')), 'true');
  await click(mobile, '#mobile-nav a[href="#collection"]');
  assert.equal(await mobile.$eval('#mobile-nav', (element) => element.hidden), true);
  await click(mobile, '#main-play');
  await sleep(100);
  assert.equal(await mobile.evaluate(() => window.__audioContexts[0].state), 'running');
  await click(mobile, '[data-scene-select="tidal"]');
  await setRange(mobile, '#texture', 59);
  await click(mobile, '#save-mix');
  await mobile.type('#mix-name', 'Pocket tide');
  await click(mobile, '#save-form button[type="submit"]');
  assert.equal(await text(mobile, '.saved-card h3'), 'Pocket tide');
  await click(mobile, '#main-play');
  await click(mobile, '.delete-mix');
  assert.equal(await mobile.$eval('#collection-empty', (element) => element.hidden), false);
  pass('Mobile touch journey', 'Menu, playback, scene, mixing, save, and remove at 390×844');
  await axe(mobile, 'Mobile');
  await mobile.setViewport({ width: 320, height: 740, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await screenshot(mobile, 'mobile-small', true);

  const corrupt = await newPage();
  await corrupt.goto(url, { waitUntil: 'networkidle0' });
  await corrupt.evaluate(() => { localStorage.setItem('stillform:settings:v1', 'null'); localStorage.setItem('stillform:mixes:v1', '{broken'); });
  await corrupt.reload({ waitUntil: 'networkidle0' });
  assert.equal(await text(corrupt, '#scene-name'), 'Ember');
  assert.equal(await text(corrupt, '#collection-count'), '00');
  await corrupt.evaluate(() => {
    localStorage.setItem('stillform:settings:v1', JSON.stringify({ scene: 'constructor' }));
    localStorage.setItem('stillform:mixes:v1', JSON.stringify([{ id: 'invalid', name: 'Invalid scene', scene: '__proto__', mix: { texture: 50, depth: 50, drift: 50 }, master: 50 }]));
  });
  await corrupt.reload({ waitUntil: 'networkidle0' });
  assert.equal(await text(corrupt, '#scene-name'), 'Ember');
  assert.equal(await text(corrupt, '#collection-count'), '00');
  pass('Corrupted local storage', 'Malformed/null data and prototype-named scenes fall back safely');

  const blocked = await newPage();
  await blocked.evaluateOnNewDocument(() => { Storage.prototype.setItem = () => { throw new DOMException('Storage blocked', 'SecurityError'); }; });
  await blocked.goto(url, { waitUntil: 'networkidle0' });
  await click(blocked, '#save-mix');
  await blocked.type('#mix-name', 'Blocked storage test');
  await click(blocked, '#save-form button[type="submit"]');
  assert.match(await text(blocked, '#save-error'), /can’t save/);
  assert.ok(await blocked.$eval('#save-dialog', (element) => element.open));
  pass('Storage denied error state', 'No false save success; explanatory message inside dialog');

  const deniedResponse = await fetch(url + '/package.json');
  assert.equal(deniedResponse.status, 404);
  const traversalResponse = await fetch(url + '/%2e%2e/README.md');
  assert.equal(traversalResponse.status, 404);
  const response = await fetch(url);
  assert.match(response.headers.get('content-security-policy'), /connect-src 'none'/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  pass('Local server boundaries', 'Project-private files/traversal unavailable; restrictive CSP and MIME protection');
  assert.equal(report.consoleErrors.length, 0, 'No browser errors: ' + report.consoleErrors.join('\n'));
  pass('Browser error check', 'Zero JavaScript and console errors across all pages');
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL';
  report.failure = error.stack;
  console.error(error);
  process.exitCode = 1;
} finally {
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  server?.kill();
  console.log('Evidence: ' + output);
}
