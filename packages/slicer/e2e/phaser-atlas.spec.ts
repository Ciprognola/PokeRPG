import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type * as ApiModule from '../src/dev/e2e-api.js';

type Api = typeof ApiModule;
const distFile = (pkg: string): string =>
  fileURLToPath(new URL(`../../../node_modules/${pkg}/dist/phaser.min.js`, import.meta.url));

// Phaser 3 is the locked engine (Brief §2); Phaser 4 is checked too so a later upgrade is not a surprise.
for (const pkg of ['phaser', 'phaser4']) {
  test(`the atlas loads in ${pkg} as a JSON Hash with §4 frame keys`, async ({ page }) => {
    await page.goto('/');
    await page.addScriptTag({ path: distFile(pkg) });
    const result = await page.evaluate(async () => {
      const api = (await import('/src/dev/e2e-api.ts' as string)) as Api;
      const fx = api.assembledBodyFixture();
      const bytes = Uint8Array.from(atob(fx.png), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
      interface Frame {
        width: number;
        height: number;
        cutX: number;
        cutY: number;
        customPivot: boolean;
        pivotX: number;
        pivotY: number;
      }
      interface Scene {
        load: { atlas: (key: string, url: string, atlas: unknown) => void };
        textures: {
          get: (key: string) => { getFrameNames: () => string[]; get: (name: string) => Frame };
        };
        add: {
          sprite: (
            x: number,
            y: number,
            key: string,
            frame: string,
          ) => { originX: number; originY: number };
        };
      }
      const Phaser = (
        window as unknown as {
          Phaser: { VERSION: string; CANVAS: number; Game: new (config: unknown) => unknown };
        }
      ).Phaser;
      return await new Promise<Record<string, unknown>>((resolve) => {
        new Phaser.Game({
          type: Phaser.CANVAS,
          width: 128,
          height: 128,
          banner: false,
          scene: {
            preload(this: Scene) {
              this.load.atlas('body', url, fx.atlas);
            },
            create(this: Scene) {
              const texture = this.textures.get('body');
              const names: string[] = texture.getFrameNames();
              const f = texture.get('walk_left_03');
              const sprite = this.add.sprite(64, 120, 'body', 'walk_down_00');
              resolve({
                version: Phaser.VERSION,
                sameKeys: JSON.stringify(names) === JSON.stringify(fx.frameKeys),
                count: names.length,
                first: names[0],
                last: names[names.length - 1],
                width: f.width,
                height: f.height,
                cutX: f.cutX,
                cutY: f.cutY,
                customPivot: f.customPivot,
                pivotX: f.pivotX,
                pivotY: f.pivotY,
                originX: sprite.originX,
                originY: sprite.originY,
              });
            },
          },
        });
      });
    });
    console.log(pkg, JSON.stringify(result));
    expect(result).toMatchObject({
      sameKeys: true,
      count: 24,
      first: 'walk_down_00',
      last: 'walk_up_05',
      width: 128,
      height: 128,
      cutX: 384, // walk_left_03 = column 3, row 1
      cutY: 128,
      customPivot: true,
      pivotX: 0.5,
      pivotY: 0.9375,
    });
    expect(result['originX']).toBeCloseTo(0.5);
    expect(result['originY']).toBeCloseTo(0.9375);
  });
}
