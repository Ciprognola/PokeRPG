import { FRAME } from './spec.js';
import type { PixelBuffer, Rect } from './pixels.js';

/**
 * Measurement definitions, docs/ASSET_SPEC.md §7.1. The Slicer and the validator both use these.
 *
 *  - Opaque: alpha >= 128 (ground row, body height, torso centreline, safe box).
 *  - Empty: alpha = 0; any alpha > 0 is content (empty-frame and 4 px border checks).
 *  - Body height: ground line (y = 120) minus the top-most opaque row of the body.
 *  - Torso centreline: x of the alpha centroid of opaque body pixels in the band 35–65 % of the
 *    body height, measured down from the top of the head.
 *
 * Coordinates are frame-local. x is continuous: pixel column c covers [c, c + 1), so a symmetric
 * figure spanning columns 49..78 has its centreline at x = 64.
 */

export const OPAQUE_ALPHA = 128;
export const TORSO_BAND = { from: 0.35, to: 0.65 } as const;

export interface FrameMeasure {
  /** Any pixel with alpha > 0. */
  hasContent: boolean;
  /** Any pixel with alpha >= 128. */
  hasOpaque: boolean;
  /** Top-most / lowest opaque rows (frame-local). */
  topRow: number;
  bottomRow: number;
  /** First opaque pixel (scan order) on `topRow` / `bottomRow`. */
  topPixel: { x: number; y: number };
  bottomPixel: { x: number; y: number };
  /** Ground line minus `topRow` (§7.1). */
  height: number;
  /** Torso centreline x, or undefined when the band holds no opaque pixel. */
  centreX: number | undefined;
  /** Band rows actually used, [from, to). */
  band: { from: number; to: number };
}

const NONE: FrameMeasure = {
  hasContent: false,
  hasOpaque: false,
  topRow: 0,
  bottomRow: 0,
  topPixel: { x: 0, y: 0 },
  bottomPixel: { x: 0, y: 0 },
  height: 0,
  centreX: undefined,
  band: { from: 0, to: 0 },
};

/**
 * Measure a body frame inside `rect` of `buf`.
 * `groundRow` is the frame row where the feet should rest (default: the spec's 120 line).
 * The Slicer passes the lowest opaque row + 1 while it aligns, which equals 120 once aligned.
 */
export function measureBodyFrame(
  buf: PixelBuffer,
  rect: Rect,
  groundLine: number | 'auto' = FRAME.anchor.y,
): FrameMeasure {
  let hasContent = false;
  let top = -1;
  let bottom = -1;
  let topX = 0;
  let bottomX = 0;
  for (let y = 0; y < rect.height; y++) {
    let firstOpaque = -1;
    for (let x = 0; x < rect.width; x++) {
      const a = buf.data[((rect.y + y) * buf.width + rect.x + x) * 4 + 3];
      if (a > 0) hasContent = true;
      if (a >= OPAQUE_ALPHA && firstOpaque < 0) firstOpaque = x;
    }
    if (firstOpaque >= 0) {
      if (top < 0) {
        top = y;
        topX = firstOpaque;
      }
      bottom = y;
      bottomX = firstOpaque;
    }
  }
  if (top < 0) return { ...NONE, hasContent };

  const ground = groundLine === 'auto' ? bottom + 1 : groundLine;
  const height = ground - top;
  const bandFrom = top + Math.ceil(TORSO_BAND.from * height);
  const bandTo = top + Math.ceil(TORSO_BAND.to * height);
  let sum = 0;
  let weight = 0;
  for (let y = bandFrom; y < bandTo && y < rect.height; y++) {
    if (y < 0) continue;
    for (let x = 0; x < rect.width; x++) {
      const a = buf.data[((rect.y + y) * buf.width + rect.x + x) * 4 + 3];
      if (a >= OPAQUE_ALPHA) {
        sum += (x + 0.5) * a;
        weight += a;
      }
    }
  }
  return {
    hasContent,
    hasOpaque: true,
    topRow: top,
    bottomRow: bottom,
    topPixel: { x: topX, y: top },
    bottomPixel: { x: bottomX, y: bottom },
    height,
    centreX: weight > 0 ? sum / weight : undefined,
    band: { from: bandFrom, to: bandTo },
  };
}
