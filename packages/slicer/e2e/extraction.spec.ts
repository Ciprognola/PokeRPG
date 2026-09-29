import { expect, test } from '@playwright/test';
import type * as ApiModule from '../src/dev/e2e-api.js';

// The app modules are imported by URL inside the browser (served by the Vite dev server).
type Api = typeof ApiModule;

test.describe('frame extraction in a real browser', () => {
  test('a grid PNG decoded by the browser gives the same frames as core', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
      const api = (await import('/src/dev/e2e-api.ts' as string)) as Api;
      const o = {
        cellWidth: 160,
        cellHeight: 200,
        background: [255, 255, 255] as [number, number, number],
        specks: 20,
        seed: 4,
      };
      const png = api.rawGridPng(o);
      const file = new File([png as BlobPart], 'grid.png', { type: 'image/png' });
      const viaBrowser = await api.extractLayer({ kind: 'grid', file });
      const viaCore = api.extractGrid(api.makeRawGrid(o));
      return {
        count: viaBrowser.length,
        same: viaBrowser.every(
          (f, i) =>
            f.origin.x === viaCore[i]!.origin.x &&
            f.origin.y === viaCore[i]!.origin.y &&
            api.pixelsEqual(f.pixels, viaCore[i]!.pixels),
        ),
      };
    });
    expect(result).toEqual({ count: 24, same: true });
  });

  test('a 4096 × 4096 grid is processed cell by cell without holding it in JS memory', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    const client = await context.newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 }); // rough stand-in for a mid-range phone CPU
    await page.evaluate(async () => {
      const api = (await import('/src/dev/e2e-api.ts' as string)) as Api;
      (window as unknown as { __file: File }).__file = await api.bigGridFile(4096, '#00b140');
    });
    const used = async (): Promise<number> => {
      const u = await client.send('Runtime.getHeapUsage');
      return u.usedSize + (u.backingStorageSize ?? 0);
    };
    await client.send('HeapProfiler.collectGarbage');
    const baseline = await used();
    let peak = baseline;
    const timer = setInterval(() => void used().then((v) => (peak = Math.max(peak, v))), 50);
    const result = await page.evaluate(async () => {
      const api = (await import('/src/dev/e2e-api.ts' as string)) as Api;
      const file = (window as unknown as { __file: File }).__file;
      const t0 = performance.now();
      const frames = await api.extractLayer({ kind: 'grid', file });
      return {
        frames: frames.length,
        ms: Math.round(performance.now() - t0),
        cellW: frames[0]!.cell.width,
        cellH: frames[0]!.cell.height,
        kinds: [...new Set(frames.map((f) => f.background.kind))],
        nonEmpty: frames.every((f) => f.pixels.width > 10 && f.pixels.height > 10),
      };
    });
    clearInterval(timer);
    const peakHeapMB = Math.round((peak - baseline) / 1e6);
    console.log('4096² extraction (4x CPU throttle):', JSON.stringify({ ...result, peakHeapMB }));
    expect(result.frames).toBe(24);
    expect(result.kinds).toEqual(['flat']);
    expect(result.nonEmpty).toBe(true);
    // The full image is 64 MB; JS heap growth must stay far below that.
    expect(peakHeapMB).toBeLessThan(150);
  });

  test('a file that is not an image gives a named error', async ({ page }) => {
    await page.goto('/');
    const message = await page.evaluate(async () => {
      const api = (await import('/src/dev/e2e-api.ts' as string)) as Api;
      try {
        await api.extractLayer({ kind: 'grid', file: new File(['not an image'], 'notes.txt') });
        return 'no error';
      } catch (e) {
        return (e as Error).message;
      }
    });
    expect(message).toBe('notes.txt · non è stato possibile leggere questo file come immagine');
  });

  test('the wrong number of frame files is rejected', async ({ page }) => {
    await page.goto('/');
    const message = await page.evaluate(async () => {
      const api = (await import('/src/dev/e2e-api.ts' as string)) as Api;
      const files = Array.from({ length: 23 }, (_, i) => new File(['x'], `f${i}.png`));
      try {
        await api.extractLayer({ kind: 'frames', files });
        return 'no error';
      } catch (e) {
        return (e as Error).message;
      }
    });
    expect(message).toBe('attese 24 immagini fotogramma, arrivate 23');
  });
});
