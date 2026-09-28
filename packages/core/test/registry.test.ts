import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FRAME, REGISTRY, frameKey, frameRects, getAnimSet, sheetSize } from '../src/index.js';

const registryPath = fileURLToPath(
  new URL('../../../assets/registry/animsets.json', import.meta.url),
);

describe('animsets registry', () => {
  it('assets/registry/animsets.json matches the built-in registry', () => {
    const onDisk: unknown = JSON.parse(readFileSync(registryPath, 'utf8'));
    expect(onDisk).toEqual(REGISTRY);
  });

  it('walk set is 24 frames on a 768 x 512 sheet (Asset Spec §2.2)', () => {
    const walk = getAnimSet('walk');
    expect(walk).toBeDefined();
    if (!walk) return;
    expect(sheetSize(walk)).toEqual({ width: 768, height: 512 });
    expect(frameRects(walk)).toHaveLength(24);
  });

  it('frame rectangles tile the sheet without overlap, row-major', () => {
    const walk = getAnimSet('walk');
    if (!walk) throw new Error('walk set missing');
    const rects = frameRects(walk);
    expect(rects[0]).toMatchObject({ key: 'walk_down_00', x: 0, y: 0 });
    expect(rects[7]).toMatchObject({ key: 'walk_left_01', x: 128, y: 128 });
    expect(rects[23]).toMatchObject({ key: 'walk_up_05', x: 640, y: 384 });
    const origins = new Set(rects.map((r) => `${r.x},${r.y}`));
    expect(origins.size).toBe(24);
  });

  it('frame keys are zero-padded', () => {
    expect(frameKey('walk', 'left', 3)).toBe('walk_left_03');
  });

  it('anchor and ground row agree (Asset Spec §2.1)', () => {
    expect(FRAME.groundRow).toBe(FRAME.anchor.y - 1);
    expect(REGISTRY.character.anchor).toEqual([FRAME.anchor.x, FRAME.anchor.y]);
  });
});
