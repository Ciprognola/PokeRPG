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
  /** Neutral grey artist's mannequin instead of the coloured figure (pose templates). Body layer only. */
  mannequin?: boolean;
}

const BOB = [1, 3, 0, 1, 3, 0];
const SWING = [6, 3, 0, -6, -3, 0];

const SKIN: Rgb = [224, 172, 130];
const BLUE: Rgb = [52, 92, 200];
const BROWN: Rgb = [110, 70, 40];
const GREY: Rgb = [90, 90, 100];
const DARK: Rgb = [30, 30, 40];
export const MANNEQUIN = {
  base: [156, 158, 164],
  dark: [112, 114, 122],
  light: [196, 198, 204],
} as const satisfies Record<string, Rgb>;

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
      if (o.mannequin) return mannequinShapes(dir, col, cx, top, ground, sw, side);
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

/**
 * A grey artist's mannequin doing the same walk cycle as the coloured fixture (same skeleton, bob
 * and swing). Facing must read at a glance: the face has a visor band (and a nose that sticks out
 * of the silhouette in profile), feet point where the figure looks, and the back view has a
 * spine stripe and no face.
 */
function mannequinShapes(
  dir: Direction,
  col: number,
  cx: number,
  top: number,
  ground: number,
  sw: number,
  side: boolean,
): Shape[] {
  const { base, dark, light } = MANNEQUIN;
  // Profile: a real stride (legs spread around the hips) and arms swinging clear of the torso.
  const stride = side ? sw * 2 : 0;
  const arm = side ? sw * 2.6 : 0;
  const passing = sw === 0;
  // Which foot is in the air: on "passing" frames the trailing one is lifted; otherwise, seen from
  // the front or back, the leg that is stepping forward reaches lower than the other.
  const liftL = passing ? (col === 2 ? 0 : 6) : side ? 0 : sw > 0 ? 0 : Math.abs(sw) / 2;
  const liftR = passing ? (col === 2 ? 6 : 0) : side ? 0 : sw > 0 ? Math.abs(sw) / 2 : 0;
  const legTop = top + 60;
  const legs = side
    ? [
        { x: cx - 5 + stride, lift: liftL },
        { x: cx - 5 - stride, lift: liftR },
      ]
    : [
        { x: cx - 12, lift: liftL },
        { x: cx + 2, lift: liftR },
      ];
  const out: Shape[] = [];
  for (const leg of legs) {
    const bottom = ground - leg.lift;
    const shift = passing && leg.lift > 0 && side ? (dir === 'left' ? -3 : 3) : 0;
    out.push({ kind: 'rect', x: leg.x + shift, y: legTop, w: 10, h: bottom - legTop, color: base });
    out.push({
      kind: 'ellipse',
      x: leg.x + shift - 1,
      y: legTop + (bottom - legTop) / 2 - 5,
      w: 12,
      h: 10,
      color: light,
    });
    const toe = dir === 'left' ? -6 : dir === 'right' ? 6 : 0;
    const fx = side ? (toe < 0 ? leg.x + shift + toe : leg.x + shift) : leg.x + shift - 1;
    out.push({
      kind: 'rect',
      x: fx,
      y: bottom - 5,
      w: side ? 10 + Math.abs(toe) : 12,
      h: 5,
      color: dark,
    });
  }
  out.push(
    { kind: 'ellipse', x: cx - 12, y: legTop - 5, w: 24, h: 10, color: light },
    ...((side
      ? [
          // far arm behind the torso, near arm in front of it
          { kind: 'rect', x: cx - 3 - arm, y: top + 24, w: 6, h: 28, color: dark },
          { kind: 'rect', x: cx - 14, y: top + 22, w: 28, h: 38, color: base },
          { kind: 'rect', x: cx - 3 + arm, y: top + 24, w: 6, h: 28, color: light },
          { kind: 'ellipse', x: cx - 4 + arm, y: top + 49, w: 8, h: 8, color: dark },
          { kind: 'ellipse', x: cx - 4 - arm, y: top + 49, w: 8, h: 8, color: dark },
        ]
      : [
          { kind: 'rect', x: cx - 14, y: top + 22, w: 28, h: 38, color: base },
          { kind: 'rect', x: cx - 20, y: top + 24, w: 6, h: 28, color: base },
          { kind: 'rect', x: cx + 14, y: top + 24, w: 6, h: 28, color: base },
          { kind: 'ellipse', x: cx - 21, y: top + 49, w: 8, h: 8, color: dark },
          { kind: 'ellipse', x: cx + 13, y: top + 49, w: 8, h: 8, color: dark },
          { kind: 'ellipse', x: cx - 19, y: top + 34, w: 10, h: 8, color: light },
          { kind: 'ellipse', x: cx + 9, y: top + 34, w: 10, h: 8, color: light },
        ]) as Shape[]),
    { kind: 'rect', x: cx - 4, y: top + 19, w: 8, h: 6, color: dark },
    { kind: 'ellipse', x: cx - 11, y: top, w: 22, h: 22, color: base },
  );
  if (dir === 'down') {
    out.push(
      { kind: 'rect', x: cx - 8, y: top + 8, w: 16, h: 5, color: dark },
      { kind: 'rect', x: cx - 2, y: top + 14, w: 4, h: 4, color: dark },
    );
  } else if (dir === 'left') {
    out.push(
      { kind: 'rect', x: cx - 11, y: top + 8, w: 9, h: 5, color: dark },
      { kind: 'rect', x: cx - 15, y: top + 10, w: 5, h: 4, color: dark },
    );
  } else if (dir === 'right') {
    out.push(
      { kind: 'rect', x: cx + 2, y: top + 8, w: 9, h: 5, color: dark },
      { kind: 'rect', x: cx + 10, y: top + 10, w: 5, h: 4, color: dark },
    );
  } else {
    out.push({ kind: 'rect', x: cx - 1, y: top + 24, w: 2, h: 34, color: dark });
  }
  return out;
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

// ---------------------------------------------------------------------------------------------
// Raw "AI output" fixtures (PKR-003): big, soft-edged, on a background, with specks and noise
// ---------------------------------------------------------------------------------------------

/** Small deterministic PRNG (mulberry32). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface RawOptions {
  cellWidth?: number;
  cellHeight?: number;
  layer?: LayerId;
  /** Flat opaque background colour; omit for a transparent background. */
  background?: Rgb;
  /** Anti-aliasing samples per axis. Default 4 (soft edges). */
  aa?: number;
  /** Random offset of the figure inside its cell, in pixels. Default 6. */
  jitter?: number;
  /** Scattered 1–3 px specks in the background. */
  specks?: number;
  /** ± per-channel noise on flat background pixels (JPEG-like). */
  noise?: number;
  /** Transparent input only: colour written into partially transparent pixels (a matte halo). */
  matte?: Rgb;
  seed?: number;
  figure?: FigureOptions;
}

/** One raw frame image, with placement jitter derived from (seed, frameIndex). */
export function makeRawFrame(
  dir: Direction,
  col: number,
  frameIndex: number,
  o: RawOptions = {},
): PixelBuffer {
  const w = o.cellWidth ?? 256;
  const h = o.cellHeight ?? 320;
  const s = (h * 0.72) / FRAME.standardHeight;
  const rng = makeRng((o.seed ?? 1) * 1000 + frameIndex);
  const jitter = o.jitter ?? 6;
  const offsetX = w / 2 - FRAME.torsoCentreX * s + (rng() * 2 - 1) * jitter;
  const offsetY = h * 0.88 - FRAME.anchor.y * s + (rng() * 2 - 1) * jitter;
  const shapes = walkFrameShapes(o.layer ?? 'body', dir, col, o.figure);
  const img = renderShapes(shapes, w, h, {
    scale: s,
    offsetX,
    offsetY,
    aa: o.aa ?? 4,
    ...(o.background ? { background: o.background } : {}),
  });
  const d = img.data;
  if (!o.background && o.matte) {
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 0 && d[i + 3] < 255) [d[i], d[i + 1], d[i + 2]] = o.matte;
    }
  }
  if (o.background && o.noise) {
    const [br, bg, bb] = o.background;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] === br && d[i + 1] === bg && d[i + 2] === bb) {
        for (let k = 0; k < 3; k++)
          d[i + k] = Math.max(0, Math.min(255, d[i + k] + Math.round((rng() * 2 - 1) * o.noise)));
      }
    }
  }
  for (let n = 0; n < (o.specks ?? 0); n++) {
    const size = 1 + Math.floor(rng() * 3);
    const x = Math.floor(rng() * (w - size));
    const y = Math.floor(rng() * (h - size));
    const colour: Rgb = [Math.floor(rng() * 256), Math.floor(rng() * 256), Math.floor(rng() * 256)];
    // Only speck the background, never touch the character.
    const bgLike = (i: number): boolean =>
      o.background
        ? Math.abs(d[i] - o.background[0]) < 40 &&
          Math.abs(d[i + 1] - o.background[1]) < 40 &&
          Math.abs(d[i + 2] - o.background[2]) < 40
        : d[i + 3] === 0;
    let free = true;
    for (let j = -3; j < size + 3 && free; j++) {
      for (let i = -3; i < size + 3; i++) {
        const xx = x + i;
        const yy = y + j;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        if (!bgLike((yy * w + xx) * 4)) free = false;
      }
    }
    if (!free) continue;
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const k = ((y + j) * w + x + i) * 4;
        d[k] = colour[0];
        d[k + 1] = colour[1];
        d[k + 2] = colour[2];
        d[k + 3] = o.background ? 255 : 40;
      }
    }
  }
  return img;
}

/** 24 separate raw frames in spec order. */
export function makeRawFrames(o: RawOptions = {}): PixelBuffer[] {
  const walk = getAnimSet('walk');
  if (!walk) throw new Error('walk set missing');
  return frameRects(walk).map((r, i) => makeRawFrame(r.row, r.col, i, o));
}

/** One image holding the 24 raw frames as a 6 × 4 grid. */
export function makeRawGrid(o: RawOptions = {}): PixelBuffer {
  const frames = makeRawFrames(o);
  const cw = o.cellWidth ?? 256;
  const ch = o.cellHeight ?? 320;
  const grid = createPixelBuffer(cw * 6, ch * 4);
  frames.forEach((f, i) => {
    const gx = (i % 6) * cw;
    const gy = Math.floor(i / 6) * ch;
    for (let y = 0; y < ch; y++) {
      const src = y * cw * 4;
      grid.data.set(f.data.subarray(src, src + cw * 4), ((gy + y) * grid.width + gx) * 4);
    }
  });
  return grid;
}
