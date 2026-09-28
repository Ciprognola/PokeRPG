import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { unzipFiles } from '@pokerpg/core';
import { readPackage } from './fixtures.js';

const ZIP = 'pokerpg-pose-templates.zip';

/** Save the templates the way a user gets them (a download from the home screen). */
async function downloadTemplates(page: Page): Promise<Buffer> {
  await page.goto('/');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#download-templates').click(),
  ]);
  expect(download.suggestedFilename()).toBe(ZIP);
  return readFileSync(await download.path());
}

/** Unpack a template zip to disk so it can be picked in the file chooser. */
function unpack(zip: Buffer): { grid: string; singles: string[] } {
  const dir = mkdtempSync(join(tmpdir(), 'pokerpg-templates-'));
  mkdirSync(join(dir, 'single'));
  const singles: string[] = [];
  let grid = '';
  for (const f of unzipFiles(zip)) {
    const name = f.path.split('/').pop()!;
    if (f.path.includes('/single/')) {
      const p = join(dir, 'single', name);
      writeFileSync(p, f.data);
      singles.push(p);
    } else if (name === 'grid-template.png') {
      grid = join(dir, name);
      writeFileSync(grid, f.data);
    }
  }
  return { grid, singles };
}

async function sliceAndExport(
  page: Page,
  files: string | string[],
): Promise<ReturnType<typeof readPackage>> {
  await page.goto('/');
  await page.locator('#mode-slice').click();
  await page.locator('#char-name').fill('mannequin');
  await page.locator('#file-input').setInputFiles(files);
  await page.locator('#process').click();
  await expect(page.locator('main[data-screen="review"]')).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('#summary')).toHaveAttribute('data-errors', '0');
  await expect(page.locator('#summary')).toHaveAttribute('data-warnings', '0');
  const [d] = await Promise.all([page.waitForEvent('download'), page.locator('#export').click()]);
  return readPackage(readFileSync(await d.path()));
}

test('the grid template and the 24 single templates slice to the same error-free character', async ({
  page,
}) => {
  const zip = await downloadTemplates(page);
  const names = unzipFiles(zip).map((f) => f.path);
  expect(names).toContain('pose-templates/grid-template.png');
  expect(names.filter((n) => n.includes('/single/'))).toHaveLength(24);
  expect(names).toContain('pose-templates/single/walk_down_00.png');
  expect(names).toContain('pose-templates/single/walk_up_05.png');

  const { grid, singles } = unpack(zip);
  expect(singles).toHaveLength(24);
  const fromGrid = await sliceAndExport(page, grid);
  const fromSingles = await sliceAndExport(page, singles);
  expect(fromGrid.report.summary).toEqual({ errors: 0, warnings: 0 });
  expect(fromSingles.report.summary).toEqual({ errors: 0, warnings: 0 });
  // identical, byte for byte
  expect(fromSingles.paths).toEqual(fromGrid.paths);
  for (const [i, f] of fromGrid.files.entries()) {
    expect(
      Buffer.compare(Buffer.from(f.data), Buffer.from(fromSingles.files[i]!.data)),
      f.path,
    ).toBe(0);
  }
});
