import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readPackage, writeCheckFixtures } from './fixtures.js';
import type { CheckFixtures } from './fixtures.js';

let fx: CheckFixtures;
test.beforeAll(() => {
  fx = writeCheckFixtures();
});

async function openCheck(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('#mode-check').click();
}

async function download(page: Page): Promise<Buffer> {
  const [d] = await Promise.all([page.waitForEvent('download'), page.locator('#export').click()]);
  return readFileSync(await d.path());
}

test('re-importing an export gives no new findings and an identical re-export', async ({
  page,
}) => {
  await openCheck(page);
  await expect(page.locator('#review')).toBeDisabled();
  await page.locator('#sheet-input').setInputFiles(fx.zip);
  await expect(page.locator('#info')).toContainText('Loaded chr_mira: 2 sheets');
  await expect(page.locator('#review')).toBeEnabled();
  await page.locator('#review').click();
  await expect(page.locator('main[data-screen="review"]')).toBeVisible();
  await expect(page.locator('h2')).toHaveText('chr_mira');
  await expect(page.locator('#summary')).toHaveAttribute('data-errors', '0');
  await expect(page.locator('#summary')).toHaveAttribute('data-warnings', '0');
  const again = await download(page);
  expect(Buffer.compare(again, Buffer.from(fx.zipBytes))).toBe(0);
});

test('a misaligned new layer shows its findings; nudging that layer fixes them', async ({
  page,
}) => {
  await openCheck(page);
  await page.locator('#sheet-input').setInputFiles(fx.zip);
  await page.locator('#sheet-input').setInputFiles(fx.misalignedOutfit); // a new layer for the loaded character
  await expect(page.locator('#sheets .entry')).toHaveCount(3);
  await page.locator('#review').click();
  await expect(page.locator('main[data-screen="review"]')).toBeVisible();

  // findings belong to the new layer only, and the body is clean
  await expect(page.locator('#summary')).toHaveAttribute('data-warnings', /[1-9]/);
  const files = await page
    .locator('#findings li')
    .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset['file']));
  expect(new Set(files)).toEqual(new Set(['spr_walk_outfit_mira.png']));

  // nudging every layer would not help (it moves the body too): scope it to the outfit, all frames
  await page.locator('#nudge-layer').selectOption('outfit');
  await page.locator('#nudge-all').check();
  for (let i = 0; i < 3; i++) await page.locator('.nudge[data-dy="-1"]').click();
  await expect(page.locator('#summary')).toHaveAttribute('data-errors', '0');
  await expect(page.locator('#summary')).toHaveAttribute('data-warnings', '0');

  const pkg = readPackage(await download(page));
  expect(pkg.report.summary).toEqual({ errors: 0, warnings: 0 });
  expect(pkg.paths).toContain('chr_mira/spr_walk_outfit_mira.png');
  expect(Object.keys(pkg.characterJson.layers)).toEqual(['body', 'outfit', 'hair']);
  // the body sheet is byte-for-byte the one that was loaded
  const orig = readPackage(Buffer.from(fx.zipBytes));
  const a = orig.files.find((f) => f.path.endsWith('spr_walk_body_mira.png'))!.data;
  const b = pkg.files.find((f) => f.path.endsWith('spr_walk_body_mira.png'))!.data;
  expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).toBe(0);
});

test('a sheet with the wrong name can be given a layer, and a missing body is explained', async ({
  page,
}) => {
  await openCheck(page);
  await page.locator('#sheet-input').setInputFiles(fx.outfitOnly);
  await expect(page.locator('#problems')).toContainText('set walk has no body sheet');
  await expect(page.locator('#review')).toBeDisabled();
  await page.locator('#sheets [aria-label^="Remove"]').click();

  await page.locator('#sheet-input').setInputFiles(fx.badName);
  await expect(page.locator('#problems')).toContainText('IMG_1234.png');
  await expect(page.locator('#review')).toBeDisabled();
  await page.locator('.rename .layer-select').selectOption('body');
  await page.locator('.rename .asset-name').fill('bob');
  await page.getByRole('button', { name: 'Rename' }).click();
  await expect(page.locator('#sheets .entry-summary')).toHaveText('spr_walk_body_bob.png');
  await expect(page.locator('#review')).toBeEnabled();
});

test('going back keeps the nudges as edits', async ({ page }) => {
  await openCheck(page);
  await page.locator('#sheet-input').setInputFiles(fx.zip);
  await page.locator('#review').click();
  await page.locator('#frames [data-key="walk_left_02"]').click();
  await page.locator('.nudge[data-dy="1"]').click();
  await expect(page.locator('#summary')).toHaveAttribute('data-warnings', /[1-9]/);
  await page.locator('#start-over').click();
  await expect(page.locator('main[data-screen="check"]')).toBeVisible();
  await page.locator('#review').click();
  await expect(page.locator('#summary')).toHaveAttribute('data-warnings', /[1-9]/);
});

test('rejects things that are not sheets, in plain words', async ({ page }) => {
  await openCheck(page);
  await page
    .locator('#sheet-input')
    .setInputFiles({ name: 'x.zip', mimeType: 'application/zip', buffer: Buffer.from('nope') });
  await expect(page.locator('#notice')).toContainText('not a valid zip');
  await page
    .locator('#sheet-input')
    .setInputFiles({ name: 'notes.png', mimeType: 'image/png', buffer: Buffer.from('nope') });
  await expect(page.locator('#notice')).toContainText('notes.png: this is not an image or a zip');
});
