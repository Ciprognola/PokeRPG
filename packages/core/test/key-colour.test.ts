import { describe, expect, it } from 'vitest';
import {
  KEY_COLOUR,
  KEY_TOLERANCE,
  composeCharacter,
  extractFrame,
  extractFrames,
  extractGrid,
  formatFinding,
  pixelsEqual,
  prepareCharacter,
  validateCharacter,
} from '../src/index.js';
import type { ExtractedFrame, ExtractOptions, PixelBuffer } from '../src/index.js';
import {
  makeRawFrame,
  makeRawFrames,
  makeWalkSheetInput,
  poseGrid,
  renderShapes,
} from '../src/testing/index.js';
import type { RawOptions } from '../src/testing/index.js';

const MAGENTA: [number, number, number] = [255, 0, 255];
const GAPS: RawOptions = {
  cellWidth: 200,
  cellHeight: 260,
  background: MAGENTA,
  figure: { gaps: true },
  seed: 5,
};
const DIRS = ['down', 'left', 'right', 'up'] as const;

/** Transparent regions of the frame that do not touch its border: holes inside the silhouette. */
function enclosedHoles(f: ExtractedFrame): number[] {
  const { width: w, height: h, data } = f.pixels;
  const seen = new Uint8Array(w * h);
  const areas: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || data[start * 4 + 3] !== 0) continue;
    let area = 0;
    let touchesBorder = false;
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      area++;
      const x = i % w;
      const y = (i - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesBorder = true;
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ] as const) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (!seen[j] && data[j * 4 + 3] === 0) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    if (!touchesBorder) areas.push(area);
  }
  return areas.sort((a, b) => b - a);
}

/** Pixels with any alpha whose colour is within `tol` of the key colour. */
function keyPixels(b: PixelBuffer, tol: number, minAlpha = 1): number {
  let n = 0;
  for (let i = 0; i < b.data.length; i += 4) {
    if (
      b.data[i + 3]! >= minAlpha &&
      Math.abs(b.data[i]! - KEY_COLOUR[0]) <= tol &&
      Math.abs(b.data[i + 1]! - KEY_COLOUR[1]) <= tol &&
      Math.abs(b.data[i + 2]! - KEY_COLOUR[2]) <= tol
    ) {
      n++;
    }
  }
  return n;
}

const frameOf = (i: number, o: RawOptions): PixelBuffer =>
  makeRawFrame(DIRS[Math.floor(i / 6)]!, i % 6, i, o);

describe('enclosed key-colour pockets are removed', () => {
  it('leaves no key colour inside the character, big or tiny gaps, in every direction', () => {
    for (const i of [0, 3, 6, 9, 12, 15, 18, 22]) {
      const f = extractFrame(frameOf(i, GAPS));
      const holes = enclosedHoles(f);
      expect(holes.length, `frame ${i}`).toBe(2); // the large gap and the tiny one
      expect(holes[0]!, `frame ${i}`).toBeGreaterThan(100);
      expect(holes[1]!, `frame ${i}`).toBeGreaterThan(5);
      expect(keyPixels(f.pixels, 24), `frame ${i}`).toBe(0);
      expect(keyPixels(f.pixels, 60, 128), `frame ${i}`).toBe(0);
    }
  });

  it('the old size-limited behaviour would have kept the tiny one (the test can fail)', () => {
    const f = extractFrame(frameOf(0, GAPS), { keyPockets: false });
    expect(enclosedHoles(f)).toHaveLength(1);
    expect(keyPixels(f.pixels, 24, 128)).toBeGreaterThan(0);
  });

  it('exports with none left, and the validator agrees (whole pipeline)', () => {
    const frames = extractFrames(makeRawFrames(GAPS));
    const result = composeCharacter(
      prepareCharacter({ name: 'akimbo', layers: [{ layer: 'body', name: 'akimbo', frames }] }),
    );
    expect(result.report.findings.map(formatFinding)).toEqual([]);
    for (const s of result.sheets) expect(keyPixels(s.image, KEY_TOLERANCE, 128)).toBe(0);

    // the same character with the old behaviour is flagged by the validator, naming frame and pixel
    const old = composeCharacter(
      prepareCharacter({
        name: 'akimbo',
        layers: [
          {
            layer: 'body',
            name: 'akimbo',
            frames: extractFrames(makeRawFrames(GAPS), { keyPockets: false }),
          },
        ],
      }),
    );
    const flagged = old.report.findings.filter((f) => f.check === 'key-colour');
    expect(flagged.length).toBeGreaterThan(0);
    expect(flagged[0]).toMatchObject({ severity: 'warning', file: 'spr_walk_body_akimbo.png' });
    expect(flagged[0]!.frameKey).toMatch(/^walk_/);
    expect(flagged[0]!.pixel).toBeDefined();
    expect(formatFinding(flagged[0]!)).toMatch(
      /restano pixel del colore chiave: \d+ px vicino a #FF00FF, il primo in \(\d+, \d+\)$/,
    );
  });
});

describe('characters without key-colour pockets are unchanged', () => {
  const same = (a: ExtractedFrame, b: ExtractedFrame, label: string): void => {
    expect(a.origin, label).toEqual(b.origin);
    expect(pixelsEqual(a.pixels, b.pixels), label).toBe(true);
  };

  /** True when the frame still holds pixels that are mostly key colour and (nearly) solid. */
  const hasKeyish = (f: ExtractedFrame): boolean => keyPixels(f.pixels, 72, 128) > 0;

  it('a shape with no gaps at all is identical, pixel for pixel', () => {
    const blob = renderShapes(
      [
        { kind: 'ellipse', x: 40, y: 20, w: 90, h: 70, color: [200, 60, 40] },
        { kind: 'rect', x: 60, y: 80, w: 50, h: 80, color: [40, 60, 200] },
      ],
      170,
      190,
      { background: MAGENTA, aa: 4 },
    );
    same(extractFrame(blob), extractFrame(blob, { keyPockets: false }), 'blob');
  });

  it.each<[string, RawOptions]>([
    ['plain', { cellWidth: 200, cellHeight: 260, background: MAGENTA }],
    [
      'jitter, noise and specks',
      {
        cellWidth: 240,
        cellHeight: 300,
        background: MAGENTA,
        noise: 6,
        specks: 30,
        seed: 5,
        jitter: 12,
      },
    ],
    ['outfit layer', { cellWidth: 200, cellHeight: 260, background: MAGENTA, layer: 'outfit' }],
  ])('%s: a frame only changes if the old output still had key colour in it', (_n, o) => {
    let untouched = 0;
    for (const [i, raw] of makeRawFrames(o).entries()) {
      const opts: ExtractOptions = { allowEmpty: true };
      const now = extractFrame(raw, opts);
      const before = extractFrame(raw, { ...opts, keyPockets: false });
      if (pixelsEqual(now.pixels, before.pixels)) {
        untouched++;
        same(now, before, `frame ${i}`);
      } else {
        expect(
          hasKeyish(before),
          `frame ${i} changed although the old output had no key colour`,
        ).toBe(true);
      }
      expect(hasKeyish(now), `frame ${i}`).toBe(false);
    }
    expect(untouched).toBeGreaterThanOrEqual(0);
  });

  it('pose templates: frames without an enclosed gap are identical to before', () => {
    const grid = poseGrid();
    const a = extractGrid(grid);
    const b = extractGrid(grid, { keyPockets: false });
    let identical = 0;
    a.forEach((f, i) => {
      if (enclosedHoles(f).length === 0 && enclosedHoles(b[i]!).length === 0) {
        same(f, b[i]!, `template frame ${i}`);
        identical++;
      }
      expect(keyPixels(f.pixels, 24, 128), `template frame ${i}`).toBe(0);
    });
    // (the mannequin's knees and hips do enclose tiny gaps in some poses; those may differ)
    expect(identical).toBeGreaterThan(0);
  });

  it('other background colours keep the size-limited rule (a white highlight survives)', () => {
    const o: RawOptions = { ...GAPS, background: [255, 255, 255] };
    const f = extractFrame(frameOf(0, o));
    expect(enclosedHoles(f)).toHaveLength(1); // only the large gap goes; the tiny one stays
    same(f, extractFrame(frameOf(0, o), { keyPockets: false }), 'white background');
  });
});

describe('validator: "key-colour pixels remain" (warning)', () => {
  const body = () => makeWalkSheetInput('body');
  const paint = (
    sheet: ReturnType<typeof body>,
    x: number,
    y: number,
    rgba: [number, number, number, number],
  ) => {
    const image = { ...sheet.image, data: new Uint8ClampedArray(sheet.image.data) };
    image.data.set(rgba, (y * image.width + x) * 4);
    return { ...sheet, image, bytes: undefined };
  };
  const keyFindings = (s: ReturnType<typeof body>[]) =>
    validateCharacter(s).findings.filter((f) => f.check === 'key-colour');

  it('passes a clean sheet', () => expect(keyFindings([body()])).toEqual([]));

  it('warns on an opaque magenta pixel and names file, frame and pixel', () => {
    // walk_right_02 = column 2, row 2 → origin (256, 256); pixel (64, 80) is inside the torso
    const [f] = keyFindings([paint(body(), 256 + 64, 256 + 80, [255, 0, 255, 255])]);
    expect(f).toMatchObject({
      severity: 'warning',
      file: 'spr_walk_body_mira.png',
      frameKey: 'walk_right_02',
      pixel: { x: 64, y: 80 },
    });
    expect(formatFinding(f!)).toBe(
      'spr_walk_body_mira.png · walk_right_02 · restano pixel del colore chiave: 1 px vicino a #FF00FF, il primo in (64, 80)',
    );
  });

  it('counts pixels and reports the first in scan order', () => {
    let s = paint(body(), 64, 80, [255, 0, 255, 255]);
    s = paint(s, 60, 90, [250, 10, 250, 255]);
    const [f] = keyFindings([s]);
    expect(f!.message).toBe(
      'restano pixel del colore chiave: 2 px vicino a #FF00FF, il primo in (64, 80)',
    );
  });

  it('uses §7.1: 24 per channel counts, 25 and pink do not; alpha > 0 counts, alpha 0 does not', () => {
    expect(keyFindings([paint(body(), 64, 80, [255 - 24, 24, 255 - 24, 255])])).toHaveLength(1);
    expect(keyFindings([paint(body(), 64, 80, [255 - 25, 25, 255, 255])])).toEqual([]);
    expect(keyFindings([paint(body(), 64, 80, [255, 105, 180, 255])])).toEqual([]);
    expect(keyFindings([paint(body(), 64, 80, [255, 0, 255, 127])])).toHaveLength(1);
    expect(keyFindings([paint(body(), 64, 80, [255, 0, 255, 1])])).toHaveLength(1);
    expect(keyFindings([paint(body(), 64, 80, [255, 0, 255, 0])])).toEqual([]);
  });

  it('checks every layer, not only the body', () => {
    const outfit = paint(makeWalkSheetInput('outfit'), 64, 80, [255, 0, 255, 255]);
    const [f] = keyFindings([body(), outfit]);
    expect(f).toMatchObject({ file: 'spr_walk_outfit_mira.png', frameKey: 'walk_down_00' });
  });

  it('is a warning: it does not make the report fail', () => {
    const report = validateCharacter([paint(body(), 64, 80, [255, 0, 255, 255])]);
    expect(report.summary.errors).toBe(0);
    expect(report.ok).toBe(true);
  });
});
