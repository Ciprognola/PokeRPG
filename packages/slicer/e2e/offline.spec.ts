import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { readPackage, writeFixtures } from './fixtures.js';

// The production build served by `vite preview`: the real service worker and manifest.
test.use({ baseURL: 'http://127.0.0.1:5198' });

test('installs, then runs the whole flow with no network', async ({ page, context }) => {
  const fx = writeFixtures();
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload(); // now controlled by the service worker
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  const manifest = await page.evaluate(async () => {
    const href = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!.href;
    return (await fetch(href)).json() as Promise<{ display: string; icons: { sizes: string }[] }>;
  });
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.map((i) => i.sizes)).toContain('512x512');

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#net-status')).toContainText('Offline');

  await page.locator('#mode-slice').click();
  await page.locator('#char-name').fill('offline-mira');
  await page.locator('#file-input').setInputFiles(fx.bodyGrid);
  await page.locator('#process').click();
  await expect(page.locator('main[data-screen="review"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('#summary')).toHaveAttribute('data-errors', '0');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#export').click(),
  ]);
  const pkg = readPackage(readFileSync(await download.path()));
  expect(pkg.paths).toContain('chr_offline-mira/spr_walk_body_offline-mira.png');
  expect(pkg.report.summary.errors).toBe(0);
});
