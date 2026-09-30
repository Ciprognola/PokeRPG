// Throwaway (PKR-015): headless probe of both built spikes. Serves spikes/dist under
// /PokeRPG/spikes/, walks the character, checks errors, SW scope, audio loop events,
// takes screenshots and prints frame stats. Headless GPU = software rendering, so the
// frame numbers are indicative only; real-device numbers come from the PO's phone.
// Usage: node spikes/scripts/probe.mjs   (after building both spikes with BASE_PATH=/PokeRPG/spikes/)
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');
const shots = process.env.SHOTS ?? join(here, '..', 'dist', 'shots');
mkdirSync(shots, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.wav': 'audio/wav', '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  const p = decodeURIComponent((req.url ?? '/').split('?')[0]).replace('/PokeRPG/spikes/', '/');
  let f = join(dist, p);
  if (f.endsWith('/') || f.endsWith('\\')) f = join(f, 'index.html');
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const v of [3, 4]) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('response', (r) => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://localhost:${port}/PokeRPG/spikes/phaser${v}/`);
  await page.waitForFunction(() => window.__spike && window.__stats, null, { timeout: 20000 }).catch((e) => { console.log('TIMEOUT', errors); throw e; });
  await page.screenshot({ path: join(shots, `p${v}-start.png`) });
  const start = await page.evaluate(() => window.__spike.tile.join(','));
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: join(shots, `p${v}-walk.png`) });
  await page.waitForTimeout(3000);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(600);
  const end = await page.evaluate(() => window.__spike.tile.join(','));
  // walk into the props (harbour prop block around x 4-7, y 2-4) and keep going up
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(2500);
  await page.keyboard.up('ArrowUp');
  await page.screenshot({ path: join(shots, `p${v}-end.png`) });
  // y-sort: stand just above the top prop row (feet behind the prop) and just below the bottom row (in front)
  await page.evaluate(() => { const sp = window.__spike; sp.tile = [5, 1]; sp.face = 'down'; sp.place(); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(shots, `p${v}-behind.png`) });
  await page.evaluate(() => { const sp = window.__spike; sp.tile = [5, 5]; sp.face = 'up'; sp.place(); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(shots, `p${v}-front.png`) });
  // frame stats while walking
  await page.keyboard.down('ArrowLeft');
  const samples = [];
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(500);
    samples.push(await page.evaluate(() => window.__stats));
  }
  const stats = { avg: samples.reduce((a, b) => a + b.avg, 0) / samples.length, max: Math.max(...samples.map((x) => x.max)) };
  await page.keyboard.up('ArrowLeft');
  // audio through the engine's own sound API
  await page.click('#aud');
  await page.waitForTimeout(5500);
  const hud = await page.evaluate(() => document.getElementById('hud').textContent);
  await page.click('#aud');
  const regs = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map((r) => r.scope));
  const layers = await page.evaluate(() => window.__spike.layers.map((s) => [s.originX, s.originY, s.frame.name]));
  console.log(JSON.stringify({ phaser: v, start, end, stats: { avg: stats.avg, max: stats.max }, layers, regs, errors }, null, 1));
  console.log(hud);
  await ctx.close();
}
await browser.close();
server.close();
