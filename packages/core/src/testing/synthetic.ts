import { encodePng } from '../png.js';
import { createPixelBuffer } from '../pixels.js';
import type { PixelBuffer } from '../pixels.js';
import { frameKey, frameRects, getAnimSet } from '../registry.js';
import type { Direction, LayerId } from '../spec.js';
import { FRAME } from '../spec.js';
import type { SheetInput } from '../validate.js';

/**
 * Synthetic sprite fixtures (real AI sprites do not exist until M2). Everything is deterministic.
 * Shapes are drawn in "frame units" (the 128 × 128 spec frame) and can be rendered at any scale,
 * with anti-aliasing, over a flat background, so the same figure serves the validator tests
 * (crisp, pixel-exact) and the Slicer input tests (large, soft edges, backgrounds, specks).
 */

export type Rgb = readonly [number, number, number];

export interface Shape {
  kind: 'rect' | 'ellipse';
  x: number;
  y: number;
  w: number;
  h: number;
  color: Rgb;
  /** 0–1, default 1. */
  alpha?: number;
}

export interface RenderOptions {
  /** Pixels per frame unit. Default 1. */
  scale?: number;
  /** Translation in output pixels, applied after scaling. */
  offsetX?: number;
  offsetY?: number;
  /** Samples per axis per pixel for anti-aliasing (1 = crisp, pixel-centre sampling). Default 1. */
  aa?: number;
  /** Opaque background colour. Default: transparent. */
  background?: Rgb;
}

/** Paint shapes in order onto a new buffer (straight-alpha "over" compositing). */
export function renderShapes(
  shapes: readonly Shape[],
  width: number,
  height: number,
  options: RenderOptions = {},
): PixelBuffer {
  const { scale = 1, offsetX = 0, offsetY = 0, aa = 1, background } = options;
  const buf = createPixelBuffer(width, height);
  if (background) {
    for (let i = 0; i < buf.data.length; i += 4) {
      buf.data[i] = background[0];
      buf.data[i + 1] = background[1];
      buf.data[i + 2] = background[2];
      buf.data[i + 3] = 255;
    }
  }
  for (const s of shapes) {
    const x0 = s.x * scale + offsetX;
    const y0 = s.y * scale + offsetY;
    const w = s.w * scale;
    const h = s.h * scale;
    const px0 = Math.max(0, Math.floor(x0));
    const py0 = Math.max(0, Math.floor(y0));
    const px1 = Math.min(width, Math.ceil(x0 + w));
    const py1 = Math.min(height, Math.ceil(y0 + h));
    const cx = x0 + w / 2;
    const cy = y0 + h / 2;
    const shapeAlpha = s.alpha ?? 1;
    for (let y = py0; y < py1; y++) {
      for (let x = px0; x < px1; x++) {
        let inside = 0;
        for (let sy = 0; sy < aa; sy++) {
          for (let sx = 0; sx < aa; sx++) {
            const u = x + (sx + 0.5) / aa;
            const v = y + (sy + 0.5) / aa;
            if (s.kind === 'rect') {
              if (u >= x0 && u < x0 + w && v >= y0 && v < y0 + h) inside++;
            } else {
              const nx = (u - cx) / (w / 2);
              const ny = (v - cy) / (h / 2);
              if (nx * nx + ny * ny <= 1) inside++;
            }
          }
        }
        if (inside === 0) continue;
        const c = (inside / (aa * aa)) * shapeAlpha;
        const i = (y * width + x) * 4;
        const aDst = buf.data[i + 3] / 255;
        const aOut = c + aDst * (1 - c);
        for (let k = 0; k < 3; k++) {
          buf.data[i + k] = Math.round((c * s.color[k] + aDst * (1 - c) * buf.data[i + k]) / aOut);
        }
        buf.data[i + 3] = Math.round(aOut * 255);
      }
    }
  }
  return buf;
}

// ---------------------------------------------------------------------------------------------
// The synthetic walker
// ---------------------------------------------------------------------------------------------

export interface FigureOptions {
  /** Torso centre x in frame units. Default 64. */
  cx?: number;
  /** Standing height (top of head to ground). Default 96. */
  height?: number;
  /** Ground line (feet rest at rows below it). Default 120. */
  ground?: number;
  /** How much shorter each walk column is than `height` (body bob). Default keeps within ±4. */
  bob?: readonly number[];
}

const BOB = [1, 3, 0, 1, 3, 0];
const SWING = [6, 3, 0, -6, -3, 0];

const SKIN: Rgb = [224, 172, 130];
const BLUE: Rgb = [52, 92, 200];
const BROWN: Rgb = [110, 70, 40];
const GREY: Rgb = [90, 90, 100];
const DARK: Rgb = [30, 30, 40];

/** Shapes of one layer of one walk frame, in frame units. */
export function walkFrameShapes(
  layer: LayerId,
  dir: Direction,
  col: number,
  o: FigureOptions = {},
): Shape[] {
  const cx = o.cx ?? FRAME.torsoCentreX;
  const ground = o.ground ?? FRAME.anchor.y;
  const height = (o.height ?? FRAME.standardHeight) - (o.bob ?? BOB)[col];
  const top = ground - height;
  const sw = SWING[col];
  const side = dir === 'left' || dir === 'right';
  const legs = (grow: number): Shape[] => {
    // Anti-phase leg swing; the planted leg reaches the ground, the other is 2 px shorter.
    const a = side ? sw : 0;
    const lift = side ? 0 : Math.sign(sw) * 2;
    const legTop = top + 60;
    return [
      {
        kind: 'rect',
        x: cx - 12 - grow + a,
        y: legTop,
        w: 10 + grow * 2,
        h: ground - legTop - Math.max(lift, 0),
        color: DARK,
      },
      {
        kind: 'rect',
        x: cx + 2 - grow - a,
        y: legTop,
        w: 10 + grow * 2,
        h: ground - legTop - Math.max(-lift, 0),
        color: DARK,
      },
    ];
  };
  const legsFor = (color: Rgb, grow: number): Shape[] => legs(grow).map((s) => ({ ...s, color }));

  switch (layer) {
    case 'body': {
      const eyes: Shape[] =
        dir === 'down'
          ? [
              { kind: 'rect', x: cx - 6, y: top + 9, w: 3, h: 3, color: DARK },
              { kind: 'rect', x: cx + 3, y: top + 9, w: 3, h: 3, color: DARK },
            ]
          : dir === 'left'
            ? [{ kind: 'rect', x: cx - 8, y: top + 9, w: 3, h: 3, color: DARK }]
            : dir === 'right'
              ? [{ kind: 'rect', x: cx + 5, y: top + 9, w: 3, h: 3, color: DARK }]
              : [];
      const armSwing = side ? sw : 0;
      return [
        ...legsFor(SKIN, 0),
        { kind: 'rect', x: cx - 14, y: top + 22, w: 28, h: 38, color: SKIN },
        { kind: 'rect', x: cx - 20 + armSwing, y: top + 24, w: 6, h: 28, color: SKIN },
        { kind: 'rect', x: cx + 14 - armSwing, y: top + 24, w: 6, h: 28, color: SKIN },
        { kind: 'ellipse', x: cx - 11, y: top, w: 22, h: 22, color: SKIN },
        ...eyes,
      ];
    }
    case 'outfit':
      return [
        ...legsFor(BLUE, 1),
        { kind: 'rect', x: cx - 15, y: top + 22, w: 30, h: 38, color: BLUE },
      ];
    case 'hair':
      return [{ kind: 'ellipse', x: cx - 12, y: top, w: 24, h: 14, color: BROWN }];
    case 'hair-back':
      return [{ kind: 'rect', x: cx - 12, y: top + 8, w: 24, h: 26, color: BROWN }];
    case 'headwear':
      return [{ kind: 'rect', x: cx - 13, y: top - 8, w: 26, h: 8, color: GREY }];
    case 'accessory':
      return [{ kind: 'rect', x: cx + 16, y: top + 36, w: 8, h: 12, color: GREY }];
    case 'accessory-back':
      return [{ kind: 'rect', x: cx - 14, y: top + 22, w: 28, h: 40, color: GREY }];
  }
}

export interface SheetOptions extends FigureOptions {
  /** Shift every frame of the sheet by whole pixels. */
  dx?: number;
  dy?: number;
  /** Per-frame extra shift, keyed by frame key (e.g. `walk_up_04`). */
  frameShift?: Readonly<Record<string, { dx: number; dy: number }>>;
}

/** A full 768 × 512 `walk` layer sheet, crisp (no anti-aliasing). */
export function makeWalkSheet(layer: LayerId, o: SheetOptions = {}): PixelBuffer {
  const walk = getAnimSet('walk');
  if (!walk) throw new Error('walk set missing');
  const sheet = createPixelBuffer(walk.framesPerRow * FRAME.width, walk.rows.length * FRAME.height);
  for (const rect of frameRects(walk)) {
    const extra = o.frameShift?.[rect.key];
    const shapes = walkFrameShapes(layer, rect.row, rect.col, o);
    const frame = renderShapes(shapes, FRAME.width, FRAME.height, {
      offsetX: (o.dx ?? 0) + (extra?.dx ?? 0),
      offsetY: (o.dy ?? 0) + (extra?.dy ?? 0),
    });
    for (let y = 0; y < FRAME.height; y++) {
      const s = y * FRAME.width * 4;
      const d = ((rect.y + y) * sheet.width + rect.x) * 4;
      sheet.data.set(frame.data.subarray(s, s + FRAME.width * 4), d);
    }
  }
  return sheet;
}

/** A validator input for a synthetic layer sheet, with real PNG bytes. */
export function makeWalkSheetInput(
  layer: LayerId,
  name = 'mira',
  o: SheetOptions = {},
): SheetInput {
  const image = makeWalkSheet(layer, o);
  return { filename: `spr_walk_${layer}_${name}.png`, image, bytes: encodePng(image) };
}

export { frameKey };
