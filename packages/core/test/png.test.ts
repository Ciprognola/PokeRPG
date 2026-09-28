import { zlibSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  PNG_SIGNATURE,
  PngError,
  createPixelBuffer,
  decodePng,
  encodePng,
  inspectPng,
  pixelsEqual,
  pngChunk,
} from '../src/index.js';
import { makeWalkSheet } from '../src/testing/index.js';

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** Build a PNG with unfiltered rows and the given header/extra chunks (for odd-format tests). */
function craftPng(
  width: number,
  height: number,
  bitDepth: number,
  colorType: number,
  rows: number[][],
  extra: Uint8Array[] = [],
): Uint8Array {
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, width);
  v.setUint32(4, height);
  ihdr[8] = bitDepth;
  ihdr[9] = colorType;
  const raw = Uint8Array.from(rows.flatMap((r) => [0, ...r]));
  return concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    ...extra,
    pngChunk('IDAT', zlibSync(raw)),
    pngChunk('IEND', new Uint8Array(0)),
  ]);
}

describe('png codec', () => {
  it('round-trips pixels exactly, including semi-transparent ones', () => {
    const buf = createPixelBuffer(3, 2);
    buf.data.set([
      255, 0, 0, 255, 10, 200, 30, 77, 0, 0, 0, 0, 1, 2, 3, 4, 250, 251, 252, 253, 9, 9, 9, 128,
    ]);
    const back = decodePng(encodePng(buf));
    expect(pixelsEqual(back, buf)).toBe(true);
  });

  it('round-trips a full sheet and is deterministic', () => {
    const sheet = makeWalkSheet('body');
    const a = encodePng(sheet);
    const b = encodePng(sheet);
    expect(a).toEqual(b);
    expect(pixelsEqual(decodePng(a), sheet)).toBe(true);
  });

  it('writes PNG-32 RGBA with an sRGB chunk', () => {
    const info = inspectPng(encodePng(createPixelBuffer(4, 4)));
    expect(info).toMatchObject({ width: 4, height: 4, bitDepth: 8, colorType: 6, srgbChunk: true });
  });

  it('decodes RGB and palette PNGs to RGBA', () => {
    const rgb = craftPng(2, 1, 8, 2, [[10, 20, 30, 40, 50, 60]]);
    expect(Array.from(decodePng(rgb).data)).toEqual([10, 20, 30, 255, 40, 50, 60, 255]);
    const pal = craftPng(
      2,
      1,
      8,
      3,
      [[1, 0]],
      [pngChunk('PLTE', Uint8Array.of(1, 2, 3, 4, 5, 6)), pngChunk('tRNS', Uint8Array.of(255, 9))],
    );
    expect(Array.from(decodePng(pal).data)).toEqual([4, 5, 6, 9, 1, 2, 3, 255]);
  });

  it('decodes 16-bit RGBA by keeping the high byte', () => {
    const png = craftPng(1, 1, 16, 6, [[0xff, 0x00, 0x80, 0x00, 0x00, 0x00, 0xaa, 0xbb]]);
    expect(Array.from(decodePng(png).data)).toEqual([255, 128, 0, 170]);
  });

  it('reports non-PNG, truncated and unsupported input distinctly', () => {
    expect(() => inspectPng(Uint8Array.of(1, 2, 3))).toThrow(PngError);
    expect(() => decodePng(craftPng(1, 1, 4, 0, [[0]]))).toThrow(/not supported/);
    const good = encodePng(createPixelBuffer(2, 2));
    expect(() => decodePng(good.subarray(0, 40))).toThrow(PngError);
  });
});
