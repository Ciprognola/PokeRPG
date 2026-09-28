import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readPackage } from './fixtures.js';
import type { FixtureFiles } from './fixtures.js';

export async function addBodyAndProcess(page: Page, fx: FixtureFiles, tap = false): Promise<void> {
  await page.goto('/');
  await page.locator('#char-name').fill('Mira Rose');
  await page.locator('#file-input').setInputFiles(fx.bodyGrid);
  await expect(page.locator('.entry')).toHaveCount(1);
  if (tap) await page.locator('#process').tap();
  else await page.locator('#process').click();
  await expect(page.locator('main[data-screen="review"]')).toBeVisible({ timeout: 60_000 });
}

export async function downloadPackage(page: Page): Promise<ReturnType<typeof readPackage>> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#export').click(),
  ]);
  return readPackage(readFileSync(await download.path()));
}
