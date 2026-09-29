import { describe, expect, it } from 'vitest';
import {
  AssembleError,
  FRAME,
  blitPixels,
  composeCharacter,
  createPixelBuffer,
  extractFrames,
  formatFinding,
  frameRects,
  getAnimSet,
  measureBodyFrame,
  packageFiles,
  pixelsEqual,
  prepareCharacter,
  resample,
  validateCharacter,
} from '../src/index.js';
import type { ExtractedFrame, LayerInput, PixelBuffer } from '../src/index.js';
import type { LayerId } from '../src/index.js';
import { makeRawFrames, renderShapes } from '../src/testing/index.js';
import type { RawOptions } from '../src/testing/index.js';

const walk = getAnimSet('walk')!;
const rects = frameRects(walk);

function frames(layer: LayerId, o: RawOptions): ExtractedFrame[] {
  return extractFrames(makeRawFrames({ ...o, layer }), { allowEmpty: layer !== 'body' });
}

function layers(
  o: RawOptions,
  ids: LayerId[] = ['body', 'outfit', 'hair', 'headwear', 'accessory'],
): LayerInput[] {
  return ids.map((layer) => ({ layer, name: 'mira', frames: frames(layer, o) }));
}

const frameRect = (i: number): { x: number; y: number; width: number; height: number } => rects[i]!;
const measure = (image: PixelBuffer, i: number) => measureBodyFrame(image, frameRect(i));
const sheetOf = (c: ReturnType<typeof composeCharacter>, layer: LayerId): PixelBuffer =>
  c.sheets.find((s) => s.layer === layer)!.image;

const FIXTURES: [string, RawOptions][] = [
  ['white background', { cellWidth: 200, cellHeight: 260, background: [255, 255, 255] }],
  [
    'chroma green, larger cells',
    { cellWidth: 256, cellHeight: 320, background: [0, 177, 64], jitter: 12, seed: 3 },
  ],
  [
    'magenta, noise and specks',
    { cellWidth: 240, cellHeight: 300, background: [255, 0, 255], noise: 6, specks: 30, seed: 5 },
  ],
  ['transparent', { cellWidth: 220, cellHeight: 280, seed: 9 }],
  [
    'short figure (upscale to 96 px)',
    { cellWidth: 200, cellHeight: 260, background: [255, 255, 255], figure: { height: 70 } },
  ],
  [
    'tall figure (downscale to 96 px)',
    { cellWidth: 300, cellHeight: 380, background: [128, 128, 128], figure: { height: 110 } },
  ],
];

describe.each(FIXTURES)('fixture: %s', (_name, o) => {
  const input = { name: 'mira', layers: layers(o) };
  const prepared = prepareCharacter(input);
  const result = composeCharacter(prepared);

  it('passes the shared validators with no errors (and no warnings)', () => {
    expect(result.report.findings.map(formatFinding)).toEqual([]);
    expect(result.report.ok).toBe(true);
  });

  it('measures the body at exactly 96 px in walk_down_00', () => {
    const m = measure(sheetOf(result, 'body'), 0);
    expect(FRAME.groundRow + 1 - m.topRow).toBe(96);
  });

  it('produces §4 names and 768 × 512 sheets', () => {
    expect(result.sheets.map((s) => s.filename)).toEqual([
      'spr_walk_body_mira.png',
      'spr_walk_outfit_mira.png',
      'spr_walk_hair_mira.png',
      'spr_walk_headwear_mira.png',
      'spr_walk_accessory_mira.png',
    ]);
    for (const s of result.sheets) expect([s.image.width, s.image.height]).toEqual([768, 512]);
  });
});

describe('one scale factor, never per frame', () => {
  const o: RawOptions = { cellWidth: 240, cellHeight: 300, background: [255, 255, 255], seed: 2 };
  const body = frames('body', o);
  const prepared = prepareCharacter({
    name: 'mira',
    layers: [{ layer: 'body', name: 'mira', frames: body }],
  });
  const result = composeCharacter(prepared, {}, { encode: false });
  const sheet = sheetOf(result, 'body');

  it('exposes a single scale for the whole character', () => {
    expect(typeof prepared.scale).toBe('number');
  });

  it('keeps every frame at scale × its own source height', () => {
    const scale = prepared.scale!;
    const outHeights: number[] = [];
    body.forEach((f, i) => {
      const src = measureBodyFrame(
        f.pixels,
        { x: 0, y: 0, width: f.pixels.width, height: f.pixels.height },
        'auto',
      ).height;
      const out = FRAME.groundRow + 1 - measure(sheet, i).topRow;
      outHeights.push(out);
      expect(Math.abs(out - scale * src), `frame ${i}`).toBeLessThanOrEqual(1.5);
    });
    // The walk bob is preserved: frames are NOT normalised to 96 individually.
    expect(Math.max(...outHeights) - Math.min(...outHeights)).toBeGreaterThanOrEqual(2);
  });

  it('resamples with the same factor for any input (area average, no halo)', () => {
    const src = renderShapes(
      [{ kind: 'rect', x: 0, y: 0, w: 40, h: 40, color: [200, 50, 50] }],
      40,
      40,
    );
    const out = resample(src, { x: 0, y: 0 }, 0.5, { x: 0, y: 0, width: 20, height: 20 });
    expect(Array.from(out.data.subarray(0, 4))).toEqual([200, 50, 50, 255]);
    // half-covered pixel: alpha halves, colour stays
    const half = renderShapes(
      [{ kind: 'rect', x: 0, y: 0, w: 20, h: 40, color: [200, 50, 50] }],
      40,
      40,
    );
    const o2 = resample(half, { x: 0, y: 0 }, 0.5, { x: 0, y: 0, width: 20, height: 20 });
    const mid = (5 * 20 + 10) * 4; // x = 10 is the boundary column of the 20 px source rect
    expect(o2.data[mid + 3]).toBe(0);
    expect(o2.data[(5 * 20 + 9) * 4 + 3]).toBe(255);
    expect(Array.from(o2.data.subarray((5 * 20 + 9) * 4, (5 * 20 + 9) * 4 + 3))).toEqual([
      200, 50, 50,
    ]);
  });
});

describe('layers stay registered with the body', () => {
  const o: RawOptions = {
    cellWidth: 240,
    cellHeight: 300,
    background: [0, 177, 64],
    jitter: 14,
    seed: 11,
  };
  const ids: LayerId[] = ['body', 'headwear'];
  const result = composeCharacter(
    prepareCharacter({ name: 'mira', layers: layers(o, ids) }),
    {},
    { encode: false },
  );

  it('a layer identical to the body comes out pixel-identical', () => {
    const body = frames('body', o);
    const clone = composeCharacter(
      prepareCharacter({
        name: 'mira',
        layers: [
          { layer: 'body', name: 'mira', frames: body },
          { layer: 'outfit', name: 'clone', frames: body },
        ],
      }),
      {},
      { encode: false },
    );
    expect(pixelsEqual(sheetOf(clone, 'body'), sheetOf(clone, 'outfit'))).toBe(true);
  });

  it('keeps a hat glued to the head in all 24 frames despite per-frame shifts', () => {
    for (let i = 0; i < 24; i++) {
      const head = measure(sheetOf(result, 'body'), i).topRow;
      const hat = measureBodyFrame(sheetOf(result, 'headwear'), frameRect(i));
      // fixture: the hat's bottom edge touches the top of the head
      expect(Math.abs(hat.bottomRow + 1 - head), `frame ${i}`).toBeLessThanOrEqual(1);
    }
  });

  it('applies one shift per frame to all layers', () => {
    const prepared = prepareCharacter({ name: 'mira', layers: layers(o, ids) });
    const shifts = new Set(Object.values(prepared.shift).map((s) => `${s.dx},${s.dy}`));
    expect(shifts.size).toBeGreaterThan(1); // jitter made frames need different shifts
    expect(Object.keys(prepared.shift)).toHaveLength(24);
  });
});

describe('manual nudges', () => {
  const o: RawOptions = { cellWidth: 200, cellHeight: 260, background: [255, 255, 255] };
  const prepared = prepareCharacter({ name: 'mira', layers: layers(o, ['body', 'outfit']) });
  const base = composeCharacter(prepared, {}, { encode: false });
  const key = 'walk_left_02';
  const idx = rects.findIndex((r) => r.key === key);

  const cellOf = (image: PixelBuffer, i: number): PixelBuffer => {
    const r = frameRect(i);
    const cell = createPixelBuffer(r.width, r.height);
    for (let y = 0; y < r.height; y++) {
      const s = ((r.y + y) * image.width + r.x) * 4;
      cell.data.set(image.data.subarray(s, s + r.width * 4), y * r.width * 4);
    }
    return cell;
  };

  it('moves that frame in every layer by whole pixels and touches nothing else', () => {
    const nudged = composeCharacter(prepared, { [key]: { dx: 2, dy: -1 } }, { encode: false });
    for (const layer of ['body', 'outfit'] as const) {
      const expected = createPixelBuffer(128, 128);
      blitPixels(expected, cellOf(sheetOf(base, layer), idx), 2, -1);
      expect(pixelsEqual(cellOf(sheetOf(nudged, layer), idx), expected), layer).toBe(true);
      for (let i = 0; i < 24; i++) {
        if (i === idx) continue;
        expect(
          pixelsEqual(cellOf(sheetOf(nudged, layer), i), cellOf(sheetOf(base, layer), i)),
        ).toBe(true);
      }
    }
  });

  it('is reflected in validation, and undoing it restores the original', () => {
    expect(base.report.findings).toEqual([]);
    const one = composeCharacter(prepared, { [key]: { dx: 0, dy: 1 } }, { encode: false });
    // one row too low: the ground line is off by 1 (warning) and the feet leave the safe box (row 120)
    expect(new Set(one.report.findings.map((f) => f.frameKey))).toEqual(new Set([key]));
    expect(new Set(one.report.findings.map((f) => `${f.check}:${f.severity}`))).toEqual(
      new Set(['ground-line:warning', 'safe-box:warning']),
    );
    const far = composeCharacter(prepared, { [key]: { dx: 0, dy: 4 } }, { encode: false });
    expect(
      far.report.findings.some((f) => f.check === 'ground-line' && f.severity === 'error'),
    ).toBe(true);
    const undone = composeCharacter(prepared, { [key]: { dx: 0, dy: 0 } }, { encode: false });
    expect(pixelsEqual(sheetOf(undone, 'body'), sheetOf(base, 'body'))).toBe(true);
  });
});

describe('outputs', () => {
  const o: RawOptions = { cellWidth: 200, cellHeight: 260, background: [255, 255, 255] };
  const input = { name: 'mira', layers: layers(o, ['body', 'hair-back', 'hair']) };
  const result = composeCharacter(prepareCharacter(input));

  it('writes a Phaser JSON Hash atlas per sheet with §4 frame keys', () => {
    const atlas = result.sheets[0]!.atlas;
    const keys = Object.keys(atlas.frames);
    expect(keys).toHaveLength(24);
    expect(keys[0]).toBe('walk_down_00');
    expect(keys[6]).toBe('walk_left_00');
    expect(keys[23]).toBe('walk_up_05');
    expect(atlas.frames['walk_right_03']).toMatchObject({
      frame: { x: 384, y: 256, w: 128, h: 128 },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: 128, h: 128 },
      sourceSize: { w: 128, h: 128 },
      pivot: { x: 0.5, y: 0.9375 },
    });
    expect(atlas.meta).toMatchObject({
      image: 'spr_walk_body_mira.png',
      size: { w: 768, h: 512 },
      format: 'RGBA8888',
    });
    expect(result.sheets.map((s) => s.atlasFilename)).toContain('spr_walk_hair-back_mira.json');
  });

  it('writes character.json in layer order', () => {
    expect(result.characterJson).toEqual({
      id: 'chr_mira',
      specVersion: '0.1',
      layers: {
        body: { walk: 'spr_walk_body_mira.png' },
        hair: { walk: 'spr_walk_hair_mira.png' },
        'hair-back': { walk: 'spr_walk_hair-back_mira.png' },
      },
    });
  });

  it('produces a package whose sheets re-validate with zero errors', () => {
    const files = packageFiles(result);
    expect(files.map((f) => f.path)).toContain('chr_mira/character.json');
    expect(files.map((f) => f.path)).toContain('chr_mira/report.json');
    const report = validateCharacter(
      result.sheets.map((s) => ({ filename: s.filename, image: s.image, bytes: s.png! })),
    );
    expect(report.summary.errors).toBe(0);
    expect(
      JSON.parse(new TextDecoder().decode(files.find((f) => f.path.endsWith('report.json'))!.data)),
    ).toEqual(result.report);
  });

  it('is deterministic byte for byte', () => {
    const again = packageFiles(composeCharacter(prepareCharacter(input)));
    const first = packageFiles(result);
    expect(again.map((f) => f.path)).toEqual(first.map((f) => f.path));
    again.forEach((f, i) => expect(f.data).toEqual(first[i]!.data));
  });
});

describe('errors', () => {
  const o: RawOptions = { cellWidth: 160, cellHeight: 200, background: [255, 255, 255] };
  const body = layers(o, ['body'])[0]!;

  it('needs a body layer', () => {
    expect(() => prepareCharacter({ name: 'mira', layers: layers(o, ['hair']) })).toThrow(
      AssembleError,
    );
    expect(() => prepareCharacter({ name: 'mira', layers: layers(o, ['hair']) })).toThrow(
      'un personaggio ha bisogno di un livello body',
    );
  });

  it('rejects names outside the §4 alphabet', () => {
    expect(() => prepareCharacter({ name: 'Mira Rose', layers: [body] })).toThrow(
      /nome del personaggio "Mira Rose"/,
    );
    expect(() => prepareCharacter({ name: 'mira', layers: [{ ...body, name: 'a_b' }] })).toThrow(
      /nome body "a_b"/,
    );
  });

  it('rejects two layers with the same id and a wrong frame count', () => {
    expect(() => prepareCharacter({ name: 'mira', layers: [body, body] })).toThrow(
      /due livelli body/,
    );
    expect(() =>
      prepareCharacter({ name: 'mira', layers: [{ ...body, frames: body.frames.slice(0, 23) }] }),
    ).toThrow(/attesi 24 fotogrammi, arrivati 23/);
  });

  it('rejects layers cut from a different frame layout than the body', () => {
    const other = layers({ ...o, cellWidth: 200 }, ['hair'])[0]!;
    expect(() => prepareCharacter({ name: 'mira', layers: [body, other] })).toThrow(
      /ogni livello deve usare lo stesso layout di fotogramma/,
    );
  });

  it('names an empty body frame', () => {
    const broken = {
      ...body,
      frames: body.frames.map((f, i) => (i === 3 ? { ...f, pixels: createPixelBuffer(0, 0) } : f)),
    };
    expect(() => prepareCharacter({ name: 'mira', layers: [broken] })).toThrow(
      'walk_down_03 · il fotogramma del corpo è vuoto',
    );
  });
});
