import { describe, expect, it } from 'vitest';
import { createPixelBuffer, measureBodyFrame } from '../src/index.js';
import type { PixelBuffer } from '../src/index.js';

function fill(buf: PixelBuffer, x: number, y: number, w: number, h: number, alpha = 255): void {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) buf.data[(j * buf.width + i) * 4 + 3] = alpha;
  }
}

const rect = { x: 0, y: 0, width: 128, height: 128 };

describe('measureBodyFrame (Asset Spec §7.1)', () => {
  it('defines height as the ground line (120) minus the top-most opaque row', () => {
    const b = createPixelBuffer(128, 128);
    fill(b, 50, 24, 28, 96); // rows 24..119
    const m = measureBodyFrame(b, rect);
    expect(m).toMatchObject({ topRow: 24, bottomRow: 119, height: 96 });
  });

  it('puts the torso centreline at the alpha centroid, pixel c covering [c, c+1)', () => {
    const b = createPixelBuffer(128, 128);
    fill(b, 49, 24, 30, 96); // columns 49..78 → centre 64
    expect(measureBodyFrame(b, rect).centreX).toBe(64);
    const off = createPixelBuffer(128, 128);
    fill(off, 52, 24, 30, 96);
    expect(measureBodyFrame(off, rect).centreX).toBe(67);
  });

  it('uses only the 35–65 % band below the top of the head', () => {
    const b = createPixelBuffer(128, 128);
    fill(b, 49, 24, 30, 96); // centred torso
    fill(b, 100, 24 + 10, 10, 10); // limb above the band (rows 34..43 rel. 10..19 → outside 34..62)
    fill(b, 20, 24 + 80, 10, 10); // limb below the band
    expect(measureBodyFrame(b, rect).centreX).toBe(64);
    expect(measureBodyFrame(b, rect).band).toEqual({ from: 24 + 34, to: 24 + 63 });
  });

  it('counts only alpha >= 128 as opaque but any alpha > 0 as content', () => {
    const faint = createPixelBuffer(128, 128);
    fill(faint, 50, 24, 28, 96, 127);
    expect(measureBodyFrame(faint, rect)).toMatchObject({ hasContent: true, hasOpaque: false });
    const solid = createPixelBuffer(128, 128);
    fill(solid, 50, 24, 28, 96, 128);
    expect(measureBodyFrame(solid, rect).hasOpaque).toBe(true);
    expect(measureBodyFrame(createPixelBuffer(128, 128), rect).hasContent).toBe(false);
  });

  it('ignores soft edges below the opaque threshold when finding the lowest row', () => {
    const b = createPixelBuffer(128, 128);
    fill(b, 50, 24, 28, 96);
    fill(b, 50, 120, 28, 2, 60); // faint halo under the feet
    expect(measureBodyFrame(b, rect).bottomRow).toBe(119);
  });

  it('measures inside a sub-rectangle of a sheet', () => {
    const sheet = createPixelBuffer(256, 128);
    fill(sheet, 128 + 49, 24, 30, 96);
    const m = measureBodyFrame(sheet, { x: 128, y: 0, width: 128, height: 128 });
    expect(m).toMatchObject({ topRow: 24, bottomRow: 119, centreX: 64 });
  });
});
