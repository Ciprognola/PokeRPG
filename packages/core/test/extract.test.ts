import { describe, expect, it } from 'vitest';
import {
  ExtractionError,
  createPixelBuffer,
  extractFrame,
  extractFrames,
  extractGrid,
  orderFrameFiles,
  pixelsEqual,
} from '../src/index.js';
import type { ExtractedFrame, PixelBuffer } from '../src/index.js';
import {
  makeRawFrame,
  makeRawFrames,
  makeRawGrid,
  makeRng,
  renderShapes,
} from '../src/testing/index.js';
import type { RawOptions, Rgb } from '../src/testing/index.js';

const SMALL: RawOptions = { cellWidth: 160, cellHeight: 200 };

/** Put an extracted frame back into cell coordinates. */
function toCell(f: ExtractedFrame): PixelBuffer {
  const cell = createPixelBuffer(f.cell.width, f.cell.height);
  for (let y = 0; y < f.pixels.height; y++) {
    const s = y * f.pixels.width * 4;
    cell.data.set(
      f.pixels.data.subarray(s, s + f.pixels.width * 4),
      ((y + f.origin.y) * cell.width + f.origin.x) * 4,
    );
  }
  return cell;
}

interface Compare {
  meanAlphaErr: number;
  badAlpha: number; // |Δα| > 90
  meanColourErr: number; // where truth α >= 128 and result α > 0
  haloPixels: number; // result α >= 64 but colour far from truth
  falsePositives: number; // result α >= 128 where truth α == 0
  charPixels: number;
}

function compare(result: PixelBuffer, truth: PixelBuffer): Compare {
  let alphaSum = 0;
  let alphaN = 0;
  let bad = 0;
  let colSum = 0;
  let colN = 0;
  let halo = 0;
  let fp = 0;
  let chars = 0;
  for (let i = 0; i < truth.data.length; i += 4) {
    const ta = truth.data[i + 3];
    const ra = result.data[i + 3];
    if (ta > 0 || ra > 0) {
      alphaSum += Math.abs(ta - ra);
      alphaN++;
      if (Math.abs(ta - ra) > 90) bad++;
    }
    if (ta >= 128) chars++;
    if (ta === 0 && ra >= 128) fp++;
    if (ra >= 64 && ta > 0) {
      const d = Math.max(
        Math.abs(result.data[i] - truth.data[i]),
        Math.abs(result.data[i + 1] - truth.data[i + 1]),
        Math.abs(result.data[i + 2] - truth.data[i + 2]),
      );
      if (ta >= 128) {
        colSum += d;
        colN++;
      }
      if (d > 70) halo++;
    }
  }
  return {
    meanAlphaErr: alphaN ? alphaSum / alphaN : 0,
    badAlpha: bad,
    meanColourErr: colN ? colSum / colN : 0,
    haloPixels: halo,
    falsePositives: fp,
    charPixels: chars,
  };
}

const FRAMES_TO_CHECK = [0, 3, 8, 13, 17, 23];

function checkAgainstTruth(o: RawOptions, tolerances: { alpha: number; colour: number }): void {
  const walkRows = ['down', 'left', 'right', 'up'] as const;
  for (const idx of FRAMES_TO_CHECK) {
    const dir = walkRows[Math.floor(idx / 6)]!;
    const col = idx % 6;
    const raw = makeRawFrame(dir, col, idx, o);
    const truth = makeRawFrame(dir, col, idx, {
      ...o,
      background: undefined,
      specks: 0,
      noise: 0,
      matte: undefined,
    });
    const frame = extractFrame(raw, {}, `f${idx}`);
    const c = compare(toCell(frame), truth);
    const label = `frame ${idx}`;
    expect(c.meanAlphaErr, label).toBeLessThan(tolerances.alpha);
    expect(c.badAlpha, label).toBeLessThan(c.charPixels * 0.005);
    expect(c.meanColourErr, label).toBeLessThan(tolerances.colour);
    expect(c.haloPixels, label).toBeLessThan(c.charPixels * 0.003);
    expect(c.falsePositives, label).toBeLessThan(c.charPixels * 0.003);
  }
}

describe('flat-colour backgrounds', () => {
  const backgrounds: [string, Rgb][] = [
    ['white', [255, 255, 255]],
    ['chroma green', [0, 177, 64]],
    ['magenta', [255, 0, 255]],
    ['mid grey', [128, 128, 128]],
  ];
  it.each(backgrounds)('removes a %s background without a halo', (_name, background) => {
    checkAgainstTruth({ ...SMALL, background }, { alpha: 14, colour: 10 });
  });

  it('detects the colour automatically', () => {
    const f = extractFrame(makeRawFrame('down', 0, 0, { ...SMALL, background: [12, 200, 90] }));
    expect(f.background).toEqual({ kind: 'flat', color: [12, 200, 90] });
  });

  it('tolerates JPEG-like noise and stray specks', () => {
    checkAgainstTruth(
      { ...SMALL, background: [255, 255, 255], noise: 8, specks: 60 },
      { alpha: 16, colour: 12 },
    );
  });

  it('crops to the character and reports where it sat in the cell', () => {
    const raw = makeRawFrame('left', 2, 8, { ...SMALL, background: [255, 255, 255] });
    const f = extractFrame(raw);
    expect(f.cell).toEqual({ width: 160, height: 200 });
    expect(f.origin.x).toBeGreaterThan(0);
    expect(f.pixels.width + f.origin.x).toBeLessThanOrEqual(160);
    // no fully transparent rows/columns at the crop edges
    const row = (y: number): boolean =>
      Array.from(
        { length: f.pixels.width },
        (_, x) => f.pixels.data[(y * f.pixels.width + x) * 4 + 3],
      ).some((a) => a > 0);
    expect(row(0)).toBe(true);
    expect(row(f.pixels.height - 1)).toBe(true);
  });

  it('cuts out enclosed background holes but keeps small highlights', () => {
    const white: Rgb = [255, 255, 255];
    const img = renderShapes(
      [
        { kind: 'ellipse', x: 30, y: 30, w: 100, h: 100, color: [200, 60, 40] },
        { kind: 'ellipse', x: 60, y: 60, w: 30, h: 30, color: white }, // big hole
        { kind: 'ellipse', x: 100, y: 55, w: 4, h: 4, color: white }, // small eye highlight
      ],
      160,
      160,
      { background: white },
    );
    const f = extractFrame(img);
    const cell = toCell(f);
    const alphaAt = (x: number, y: number): number => cell.data[(y * 160 + x) * 4 + 3];
    expect(alphaAt(75, 75)).toBe(0); // hole
    expect(alphaAt(102, 57)).toBe(255); // highlight stays
    expect(alphaAt(50, 50)).toBe(255); // body
  });
});

describe('transparent backgrounds', () => {
  it('keeps the alpha and colours of a clean transparent image', () => {
    checkAgainstTruth({ ...SMALL }, { alpha: 1, colour: 1 });
  });

  it('removes a white matte halo from soft edges', () => {
    checkAgainstTruth({ ...SMALL, matte: [255, 255, 255] }, { alpha: 1, colour: 12 });
    const raw = makeRawFrame('down', 0, 0, { ...SMALL, matte: [255, 255, 255] });
    const f = extractFrame(raw);
    let whiteish = 0;
    for (let i = 0; i < f.pixels.data.length; i += 4) {
      const a = f.pixels.data[i + 3];
      if (
        a > 0 &&
        a < 255 &&
        f.pixels.data[i] > 235 &&
        f.pixels.data[i + 1] > 235 &&
        f.pixels.data[i + 2] > 235
      )
        whiteish++;
    }
    expect(whiteish).toBe(0);
  });

  it('ignores faint stray specks', () => {
    checkAgainstTruth({ ...SMALL, specks: 60 }, { alpha: 2, colour: 2 });
  });

  it('detects a transparent background', () => {
    expect(extractFrame(makeRawFrame('down', 0, 0, SMALL)).background).toEqual({
      kind: 'transparent',
    });
  });
});

describe('grid and 24-file input', () => {
  it('produce the same 24 frames in the same order', () => {
    const o: RawOptions = { ...SMALL, background: [255, 255, 255], specks: 10, seed: 7 };
    const fromGrid = extractGrid(makeRawGrid(o));
    const fromFiles = extractFrames(makeRawFrames(o));
    expect(fromGrid).toHaveLength(24);
    fromGrid.forEach((g, i) => {
      expect(g.origin, `frame ${i}`).toEqual(fromFiles[i]!.origin);
      expect(pixelsEqual(g.pixels, fromFiles[i]!.pixels), `frame ${i}`).toBe(true);
    });
  });

  it('puts frame files in spec order from their names', () => {
    const frames = makeRawFrames({ ...SMALL, background: [255, 255, 255] });
    const names = frames.map((_, i) => `frame_${i + 1}.png`);
    const rng = makeRng(3);
    const shuffled = names.map((n, i) => ({ n, i, r: rng() })).sort((a, b) => a.r - b.r);
    const order = orderFrameFiles(shuffled.map((s) => s.n));
    expect(order.map((k) => shuffled[k]!.i)).toEqual(Array.from({ length: 24 }, (_, i) => i));
  });

  it('sorts numbered names naturally (f2 before f10)', () => {
    const names = Array.from({ length: 24 }, (_, i) => `f${i + 1}.png`).reverse();
    const order = orderFrameFiles(names);
    expect(order.map((k) => names[k])).toEqual(
      Array.from({ length: 24 }, (_, i) => `f${i + 1}.png`),
    );
  });

  it('places files by frame key when the names carry one', () => {
    const keys: string[] = [];
    for (const dir of ['down', 'left', 'right', 'up'])
      for (let c = 0; c < 6; c++) keys.push(`walk_${dir}_0${c}`);
    const shuffled = [...keys].reverse();
    const order = orderFrameFiles(shuffled.map((k) => `${k}.png`));
    expect(order.map((k) => shuffled[k])).toEqual(keys);
  });
});

describe('clear errors', () => {
  it('names a wrong frame count', () => {
    expect(() => orderFrameFiles(Array.from({ length: 23 }, (_, i) => `f${i}.png`))).toThrow(
      'expected 24 frame images, got 23',
    );
    expect(() => extractFrames(makeRawFrames(SMALL).slice(0, 23))).toThrow(ExtractionError);
  });

  it('names a frame claimed twice by its key', () => {
    const keys: string[] = [];
    for (const dir of ['down', 'left', 'right', 'up'])
      for (let c = 0; c < 6; c++) keys.push(`walk_${dir}_0${c}.png`);
    keys[5] = keys[4]!;
    expect(() => orderFrameFiles(keys)).toThrow(/2 images claim this frame/);
  });

  it('names the frame with an empty cell', () => {
    const frames = makeRawFrames({ ...SMALL, background: [255, 255, 255] });
    const blank = createPixelBuffer(160, 200);
    for (let i = 0; i < blank.data.length; i += 4) blank.data.set([255, 255, 255, 255], i);
    frames[9] = blank; // walk_left_03
    try {
      extractFrames(frames);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ExtractionError);
      expect((e as ExtractionError).code).toBe('empty-cell');
      expect((e as Error).message).toBe('walk_left_03 · no character found (the cell is empty)');
    }
  });

  it('rejects a grid image that is too small', () => {
    expect(() => extractGrid(createPixelBuffer(60, 40))).toThrow(/too small/);
  });

  it('rejects a background that is neither transparent nor flat', () => {
    const noisy = createPixelBuffer(120, 120);
    const rng = makeRng(5);
    for (let i = 0; i < noisy.data.length; i += 4)
      noisy.data.set([rng() * 256, rng() * 256, rng() * 256, 255], i);
    expect(() => extractFrame(noisy, {}, 'walk_up_05')).toThrow(
      /walk_up_05 · the background is neither transparent nor one flat colour/,
    );
  });
});
