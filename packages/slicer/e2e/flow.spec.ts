import { expect, test } from '@playwright/test';
import { lowestRow, writeFixtures } from './fixtures.js';
import { addBodyAndProcess as addBody, downloadPackage } from './helpers.js';
import type { FixtureFiles } from './fixtures.js';

let fx: FixtureFiles;
test.beforeAll(() => {
  fx = writeFixtures();
});

test.describe('desktop flow', () => {
  test('raw images → review → a zip that passes validation', async ({ page }) => {
    await page.goto('/');
    await page.locator('#char-name').fill('Mira Rose');
    await expect(page.locator('#char-name')).toHaveValue('mira-rose');
    await expect(page.locator('#process')).toBeDisabled(); // no body yet

    await page.locator('#file-input').setInputFiles(fx.bodyGrid);
    await page.locator('#file-input').setInputFiles(fx.outfitGrid);
    await page.locator('#file-input').setInputFiles(fx.hairFrames); // 24 separate frames
    await expect(page.locator('.entry')).toHaveCount(3);
    expect(
      await page
        .locator('.entry .layer-select')
        .evaluateAll((els) => els.map((e) => (e as HTMLSelectElement).value)),
    ).toEqual(['body', 'outfit', 'hair']);
    await page.locator('#process').click();

    await expect(page.locator('main[data-screen="review"]')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('#summary')).toHaveAttribute('data-errors', '0');
    await expect(page.locator('.previews canvas')).toHaveCount(4);
    await expect(page.locator('#frames .frame-btn')).toHaveCount(24);
    await expect(page.locator('#layers input')).toHaveCount(3);
    // the preview is animating
    const c0 = await page.locator('.previews').getAttribute('data-col');
    await expect.poll(async () => page.locator('.previews').getAttribute('data-col')).not.toBe(c0);

    const pkg = await downloadPackage(page);
    expect(pkg.paths).toEqual(
      [
        'chr_mira-rose/character.json',
        'chr_mira-rose/report.json',
        'chr_mira-rose/spr_walk_body_mira-rose.png',
        'chr_mira-rose/spr_walk_body_mira-rose.json',
        'chr_mira-rose/spr_walk_hair_mira-rose.png',
        'chr_mira-rose/spr_walk_hair_mira-rose.json',
        'chr_mira-rose/spr_walk_outfit_mira-rose.png',
        'chr_mira-rose/spr_walk_outfit_mira-rose.json',
      ].sort(),
    );
    expect(pkg.report.summary.errors).toBe(0);
    expect(pkg.reportJson.ok).toBe(true);
    expect(pkg.characterJson.id).toBe('chr_mira-rose');
    expect(Object.keys(pkg.characterJson.layers)).toEqual(['body', 'outfit', 'hair']);
    for (const sheet of pkg.sheets.values())
      expect([sheet.width, sheet.height]).toEqual([768, 512]);
  });

  test('a nudge shows in the preview, the validation and the export', async ({ page }) => {
    await addBody(page, fx);
    const key = 'walk_left_02';
    await expect(page.locator('#summary')).toHaveAttribute('data-errors', '0');

    // Tapping a finding jumps to its frame: first create one.
    await page.locator(`#frames [data-key="${key}"]`).click();
    await expect(page.locator('#inspector-title')).toHaveText(key);
    await page.locator('.nudge[data-dy="1"]').click();

    // validation reacts
    await expect(page.locator('#summary')).toHaveAttribute('data-warnings', /[1-9]/);
    await expect(
      page.locator(`#findings li[data-frame="${key}"][data-check="ground-line"]`),
    ).toBeVisible();
    await expect(page.locator('#nudge-info')).toHaveAttribute('data-dy', '1');
    // preview reacts: the inspector's body now rests on row 120 instead of 119
    const bottom = (): Promise<number> =>
      page.locator('#inspector').evaluate((c) => {
        const canvas = c as HTMLCanvasElement;
        const d = canvas.getContext('2d')!.getImageData(0, 0, 128, 128).data;
        for (let y = 127; y >= 0; y--) {
          for (let x = 0; x < 128; x++) if (d[(y * 128 + x) * 4 + 3]! >= 128) return y;
        }
        return -1;
      });
    // (the overlay's ground line and anchor are drawn on the canvas too: hide them first)
    await page.locator('#overlay').uncheck();
    expect(await bottom()).toBe(120);

    // jump: select another frame, then tap the finding
    await page.locator('#frames [data-key="walk_up_05"]').click();
    await expect(page.locator('#inspector-title')).toHaveText('walk_up_05');
    await page.locator(`#findings li[data-frame="${key}"] button`).first().click();
    await expect(page.locator('#inspector-title')).toHaveText(key);

    // enough nudging makes an error and blocks the export…
    for (let i = 0; i < 3; i++) await page.locator('.nudge[data-dy="1"]').click();
    await expect(page.locator('#summary')).toHaveAttribute('data-errors', /[1-9]/);
    await expect(page.locator('#export')).toBeDisabled();
    // …and undoing it brings everything back
    await page.locator('#nudge-reset').click();
    await expect(page.locator('#summary')).toHaveAttribute('data-errors', '0');
    await expect(page.locator('#summary')).toHaveAttribute('data-warnings', '0');
    await expect(page.locator('#export')).toBeEnabled();

    // export with a warning (allowed) and check the file
    await page.locator('.nudge[data-dy="1"]').click();
    await expect(page.locator('#export')).toBeEnabled();
    const pkg = await downloadPackage(page);
    const sheet = pkg.sheets.get('spr_walk_body_mira-rose.png')!;
    expect(lowestRow(sheet, key)).toBe(120); // the nudged frame
    expect(lowestRow(sheet, 'walk_left_01')).toBe(119); // its neighbour is untouched
    expect(pkg.reportJson.summary.errors).toBe(0);
    expect(
      pkg.reportJson.findings.some((f) => f.frameKey === key && f.check === 'ground-line'),
    ).toBe(true);
  });

  test('keyboard arrows nudge the selected frame', async ({ page }) => {
    await addBody(page, fx);
    await page.locator('#inspector').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#nudge-info')).toHaveAttribute('data-dx', '2');
  });

  test('says clearly what is wrong with the input', async ({ page }) => {
    await page.goto('/');
    await page.locator('#file-input').setInputFiles(fx.hairFrames.slice(0, 23));
    await expect(page.locator('#notice')).toContainText('You picked 23 images');
    await page.locator('#file-input').setInputFiles(fx.notes);
    await expect(page.locator('#notice')).toContainText('not images');
  });

  test('a file that cannot be decoded fails with a named error', async ({ page }) => {
    await page.goto('/');
    await page.locator('#char-name').fill('mira');
    // a text file renamed as an image passes the picker but cannot be decoded
    await page
      .locator('#file-input')
      .setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('nope') });
    await page.locator('#process').click();
    await expect(page.locator('#notice')).toContainText(
      'broken.png · could not read this file as an image',
    );
    await expect(page.locator('main[data-screen="setup"]')).toBeVisible();
  });
});
