import { devices, expect, test } from '@playwright/test';
import { writeCheckFixtures, writeFixtures } from './fixtures.js';
import type { FixtureFiles } from './fixtures.js';
import { addBodyAndProcess, downloadPackage } from './helpers.js';

// Emulated Pixel 5: touch input and a phone-sized screen (a real device is not tested here).
test.use({ ...devices['Pixel 5'] });

let fx: FixtureFiles;
test.beforeAll(() => {
  fx = writeFixtures();
});

test('the whole flow works with taps and fits the screen', async ({ page }) => {
  await addBodyAndProcess(page, fx, true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  // every control is a comfortable touch target (44 px)
  const sizes = await page
    .locator('button:visible:not(.frame-btn), select:visible, input[type="text"]:visible')
    .evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { id: e.id || e.className, w: r.width, h: r.height };
      }),
    );
  expect(sizes.length).toBeGreaterThan(5);
  for (const s of sizes) expect(Math.min(s.w, s.h), JSON.stringify(s)).toBeGreaterThanOrEqual(43);

  await page.locator('#frames [data-key="walk_down_03"]').tap();
  await page.locator('.nudge[data-dx="1"]').tap();
  await expect(page.locator('#nudge-info')).toHaveAttribute('data-dx', '1');
  const pkg = await downloadPackage(page);
  expect(pkg.report.summary.errors).toBe(0);
});

test('check mode: load a zip, add a layer and nudge it with taps', async ({ page }) => {
  const check = writeCheckFixtures();
  await page.goto('/');
  await page.locator('#mode-check').tap();
  await page.locator('#sheet-input').setInputFiles(check.zip);
  await page.locator('#sheet-input').setInputFiles(check.misalignedOutfit);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.locator('#review').tap();
  await page.locator('#nudge-layer').selectOption('outfit');
  await page.locator('#nudge-all').check();
  for (let i = 0; i < 3; i++) await page.locator('.nudge[data-dy="-1"]').tap();
  await expect(page.locator('#summary')).toHaveAttribute('data-warnings', '0');
  const pkg = await downloadPackage(page);
  expect(pkg.report.summary).toEqual({ errors: 0, warnings: 0 });
});
