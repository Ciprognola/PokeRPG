import { encodePng } from './png.js';
import { blitPixels, createPixelBuffer } from './pixels.js';
import type { PixelBuffer, Rect } from './pixels.js';
import { measureBodyFrame } from './measure.js';
import { validateCharacter } from './validate.js';
import type { Report } from './findings.js';
import type { ExtractedFrame } from './extract.js';
import { FRAME_COUNT } from './extract.js';
import { layerSheetName } from './naming.js';
import { frameRects, getAnimSet, sheetSize } from './registry.js';
import { FRAME, LAYER_IDS, SPEC_VERSION } from './spec.js';
import type { LayerId } from './spec.js';

/**
 * Normalise, align and pack (PKR-004, docs/ASSET_SPEC.md §2, §4, §6 steps 2–5).
 *
 *  1. ONE scale factor per character, fitted so the body measures exactly 96 px in `walk_down_00`.
 *     Every frame of every layer is scaled by it; no frame is ever scaled on its own.
 *  2. Each frame's whole-pixel alignment shift is computed on the BODY (lowest opaque row → 119,
 *     torso centreline → 64) and applied to every layer of that frame.
 *  3. All layers of a frame are resampled into the same window with the same transform, so they stay
 *     pixel-registered by construction.
 *  4. Sheets, Phaser JSON Hash atlases, character.json and report.json are produced; the report
 *     comes from the shared validators.
 *
 * `prepareCharacter` (expensive: scaling) and `composeCharacter` (cheap: shifts + packing) are
 * separate so a manual nudge only re-runs the second step. Validate-only mode (PKR-006) builds a
 * `Prepared` straight from on-spec sheets and reuses `composeCharacter` unchanged.
 */

export type AssembleErrorCode =
  'bad-name' | 'no-body' | 'bad-layer' | 'cell-mismatch' | 'no-reference';

export class AssembleError extends Error {
  constructor(
    readonly code: AssembleErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AssembleError';
  }
}

export interface LayerInput {
  layer: LayerId;
  /** Asset name in the sheet file name, e.g. `braid-long` (`spr_walk_hair_braid-long.png`). */
  name: string;
  variant?: string;
  /** 24 extracted frames in spec order. Empty (0 × 0) frames are allowed for non-body layers. */
  frames: readonly ExtractedFrame[];
}

export interface CharacterInput {
  /** Character name, lowercase `[a-z0-9-]`; the package folder is `chr_<name>`. */
  name: string;
  layers: readonly LayerInput[];
  setId?: string;
}

export interface Shift {
  dx: number;
  dy: number;
}
/** Manual per-frame whole-pixel shifts, keyed by frame key (`walk_up_04`). Applied to all layers. */
export type Nudges = Readonly<Record<string, Shift>>;

export interface PreparedFrame {
  key: string;
  /** The frame's pixels in its working window (or the 128 × 128 cell for on-spec sheets). */
  canvas: PixelBuffer;
}

export interface PreparedLayer {
  layer: LayerId;
  name: string;
  variant?: string;
  frames: PreparedFrame[];
}

export interface Prepared {
  characterName: string;
  setId: string;
  /** The single scale factor, or null when sheets were taken as they are (validate-only). */
  scale: number | null;
  layers: PreparedLayer[];
  /** Automatic alignment shift per frame key. */
  shift: Record<string, Shift>;
  notes: string[];
}

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function checkName(kind: string, value: string): void {
  if (!NAME_RE.test(value)) {
    throw new AssembleError(
      'bad-name',
      `${kind} "${value}" must be lowercase letters, digits and "-" only (no spaces or "_")`,
    );
  }
}

// ---------------------------------------------------------------------------------------------
// Resampling
// ---------------------------------------------------------------------------------------------

interface AxisWeights {
  first: Int32Array;
  count: Int32Array;
  weight: Float32Array;
  offset: Int32Array;
}

/** For each output index, the source pixels it covers and by how much (area weights, sum ≤ 1). */
function axisWeights(
  winStart: number,
  winSize: number,
  scale: number,
  srcOrigin: number,
  srcSize: number,
): AxisWeights {
  const first = new Int32Array(winSize);
  const count = new Int32Array(winSize);
  const offset = new Int32Array(winSize);
  const weights: number[] = [];
  for (let o = 0; o < winSize; o++) {
    const lo = (winStart + o) / scale - srcOrigin;
    const hi = (winStart + o + 1) / scale - srcOrigin;
    const a = Math.max(0, Math.floor(lo));
    const b = Math.min(srcSize - 1, Math.ceil(hi) - 1);
    first[o] = a;
    offset[o] = weights.length;
    let n = 0;
    for (let k = a; k <= b; k++) {
      weights.push((Math.min(hi, k + 1) - Math.max(lo, k)) * scale);
      n++;
    }
    count[o] = Math.max(0, n);
  }
  return { first, count, offset, weight: Float32Array.from(weights) };
}

/**
 * Area-average resample of `src` (placed at `origin` in source cell space) by `scale` into `window`
 * (integer rectangle in scaled cell space). Premultiplied, so soft edges never gain a halo.
 * Anything of the window not covered by `src` is transparent.
 */
export function resample(
  src: PixelBuffer,
  origin: { x: number; y: number },
  scale: number,
  window: Rect,
): PixelBuffer {
  const out = createPixelBuffer(window.width, window.height);
  if (src.width === 0 || src.height === 0 || window.width <= 0 || window.height <= 0) return out;
  const ax = axisWeights(window.x, window.width, scale, origin.x, src.width);
  const ay = axisWeights(window.y, window.height, scale, origin.y, src.height);
  const ow = window.width;
  const tmp = new Float32Array(src.height * ow * 4); // premultiplied: r·a, g·a, b·a, a (a in 0..1)
  for (let y = 0; y < src.height; y++) {
    for (let X = 0; X < ow; X++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let k = 0; k < ax.count[X]!; k++) {
        const w = ax.weight[ax.offset[X]! + k]!;
        const i = (y * src.width + ax.first[X]! + k) * 4;
        const al = (src.data[i + 3]! / 255) * w;
        r += src.data[i]! * al;
        g += src.data[i + 1]! * al;
        b += src.data[i + 2]! * al;
        a += al;
      }
      const t = (y * ow + X) * 4;
      tmp[t] = r;
      tmp[t + 1] = g;
      tmp[t + 2] = b;
      tmp[t + 3] = a;
    }
  }
  for (let Y = 0; Y < window.height; Y++) {
    for (let X = 0; X < ow; X++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let k = 0; k < ay.count[Y]!; k++) {
        const w = ay.weight[ay.offset[Y]! + k]!;
        const t = ((ay.first[Y]! + k) * ow + X) * 4;
        r += tmp[t]! * w;
        g += tmp[t + 1]! * w;
        b += tmp[t + 2]! * w;
        a += tmp[t + 3]! * w;
      }
      const o = (Y * ow + X) * 4;
      const alpha = Math.min(1, a);
      out.data[o + 3] = Math.round(alpha * 255);
      if (a > 0) {
        out.data[o] = Math.round(r / a);
        out.data[o + 1] = Math.round(g / a);
        out.data[o + 2] = Math.round(b / a);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Prepare: scale fit, working windows, alignment
// ---------------------------------------------------------------------------------------------

function windowFor(frames: readonly ExtractedFrame[], scale: number): Rect | undefined {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const f of frames) {
    if (f.pixels.width === 0) continue;
    x0 = Math.min(x0, f.origin.x * scale);
    y0 = Math.min(y0, f.origin.y * scale);
    x1 = Math.max(x1, (f.origin.x + f.pixels.width) * scale);
    y1 = Math.max(y1, (f.origin.y + f.pixels.height) * scale);
  }
  if (x0 === Infinity) return undefined;
  const wx = Math.floor(x0) - 1;
  const wy = Math.floor(y0) - 1;
  return { x: wx, y: wy, width: Math.ceil(x1) + 1 - wx, height: Math.ceil(y1) + 1 - wy };
}

const fullRect = (b: PixelBuffer): Rect => ({ x: 0, y: 0, width: b.width, height: b.height });

/** Fit the character's single scale so the body is exactly 96 px tall in walk_down_00. */
function fitScale(reference: ExtractedFrame): number {
  const rect = fullRect(reference.pixels);
  const m0 = measureBodyFrame(reference.pixels, rect, 'auto');
  if (!m0.hasOpaque) {
    throw new AssembleError(
      'no-reference',
      'walk_down_00 · the body has no solid pixels to measure',
    );
  }
  const heightAt = (scale: number): number => {
    const canvas = resample(
      reference.pixels,
      reference.origin,
      scale,
      windowFor([reference], scale)!,
    );
    return measureBodyFrame(canvas, fullRect(canvas), 'auto').height;
  };
  // Measured height is a monotonic step function of the scale: start from the geometric guess,
  // then bisect until the body measures exactly 96 rows.
  const guess = FRAME.standardHeight / m0.height;
  if (heightAt(guess) === FRAME.standardHeight) return guess;
  let lo = guess * 0.9;
  let hi = guess * 1.1;
  let best = guess;
  let bestErr = Math.abs(heightAt(guess) - FRAME.standardHeight);
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const h = heightAt(mid);
    const err = Math.abs(h - FRAME.standardHeight);
    if (err < bestErr) {
      best = mid;
      bestErr = err;
    }
    if (h === FRAME.standardHeight) return mid;
    if (h < FRAME.standardHeight) lo = mid;
    else hi = mid;
  }
  return best;
}

/** Scale, window and align all frames of a character. */
export function prepareCharacter(input: CharacterInput): Prepared {
  const setId = input.setId ?? 'walk';
  const set = getAnimSet(setId);
  if (!set) throw new AssembleError('bad-layer', `unknown animation set "${setId}"`);
  checkName('character name', input.name);

  const seen = new Set<LayerId>();
  for (const l of input.layers) {
    checkName(`${l.layer} name`, l.name);
    if (l.variant !== undefined) checkName(`${l.layer} variant`, l.variant);
    if (seen.has(l.layer))
      throw new AssembleError('bad-layer', `two ${l.layer} layers (one per layer id)`);
    seen.add(l.layer);
    if (l.frames.length !== FRAME_COUNT) {
      throw new AssembleError(
        'bad-layer',
        `${l.layer}: expected ${FRAME_COUNT} frames, got ${l.frames.length}`,
      );
    }
  }
  const body = input.layers.find((l) => l.layer === 'body');
  if (!body) throw new AssembleError('no-body', 'a character needs a body layer');

  const cell = body.frames[0]!.cell;
  for (const l of input.layers) {
    for (const [i, f] of l.frames.entries()) {
      if (f.cell.width !== cell.width || f.cell.height !== cell.height) {
        throw new AssembleError(
          'cell-mismatch',
          `${l.layer} frame ${i} comes from a ${f.cell.width}×${f.cell.height} cell but the body uses ${cell.width}×${cell.height}; every layer must use the same frame layout`,
        );
      }
    }
  }

  const rects = frameRects(set);
  const scale = fitScale(body.frames[0]!);
  const layers: PreparedLayer[] = input.layers.map((l) => ({
    layer: l.layer,
    name: l.name,
    ...(l.variant !== undefined ? { variant: l.variant } : {}),
    frames: [],
  }));
  const shift: Record<string, Shift> = {};

  rects.forEach((rect, i) => {
    const key = rect.key;
    const bodyFrame = body.frames[i]!;
    if (bodyFrame.pixels.width === 0) {
      throw new AssembleError('no-reference', `${key} · the body frame is empty`);
    }
    const win = windowFor(
      input.layers.map((l) => l.frames[i]!),
      scale,
    )!;
    input.layers.forEach((l, li) => {
      const f = l.frames[i]!;
      layers[li]!.frames.push({ key, canvas: resample(f.pixels, f.origin, scale, win) });
    });
    const bodyCanvas = layers[input.layers.indexOf(body)]!.frames[i]!.canvas;
    const m = measureBodyFrame(bodyCanvas, fullRect(bodyCanvas), 'auto');
    if (!m.hasOpaque) {
      throw new AssembleError(
        'no-reference',
        `${key} · the body has no solid pixels after scaling`,
      );
    }
    shift[key] = {
      dx: m.centreX === undefined ? 0 : Math.round(FRAME.torsoCentreX - m.centreX),
      dy: set.groundLock ? FRAME.groundRow - m.bottomRow : 0,
    };
  });

  const notes: string[] = [];
  if (scale > 1) {
    notes.push(
      `the source frames are smaller than the target size (scale ×${scale.toFixed(2)}); the sheet is upscaled and will look soft`,
    );
  }
  return { characterName: input.name, setId, scale, layers, shift, notes };
}

// ---------------------------------------------------------------------------------------------
// Compose: shifts, packing, atlases, character.json, report
// ---------------------------------------------------------------------------------------------

export interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
  rotated: false;
  trimmed: false;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
  /** The spec anchor as a Phaser origin (0.5, 0.9375). */
  pivot: { x: number; y: number };
}

/** Phaser 3 "JSON Hash" texture atlas. */
export interface AtlasJson {
  frames: Record<string, AtlasFrame>;
  meta: {
    app: string;
    version: string;
    image: string;
    format: 'RGBA8888';
    size: { w: number; h: number };
    scale: '1';
  };
}

export interface AssembledSheet {
  layer: LayerId;
  name: string;
  variant?: string;
  filename: string;
  atlasFilename: string;
  image: PixelBuffer;
  /** Encoded PNG-32; present when composed with `encode: true`. */
  png?: Uint8Array;
  atlas: AtlasJson;
}

export interface CharacterJson {
  id: string;
  specVersion: string;
  layers: Partial<Record<LayerId, Record<string, string>>>;
}

export interface AssembledCharacter {
  name: string;
  setId: string;
  scale: number | null;
  sheets: AssembledSheet[];
  characterJson: CharacterJson;
  report: Report;
  notes: string[];
}

export interface ComposeOptions {
  /** Encode the sheets to PNG (needed for export and the file-level checks). Default true. */
  encode?: boolean;
}

function makeAtlas(setId: string, image: string): AtlasJson {
  const set = getAnimSet(setId)!;
  const size = sheetSize(set);
  const frames: Record<string, AtlasFrame> = {};
  for (const r of frameRects(set)) {
    frames[r.key] = {
      frame: { x: r.x, y: r.y, w: r.width, h: r.height },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: r.width, h: r.height },
      sourceSize: { w: r.width, h: r.height },
      pivot: { x: FRAME.anchor.x / FRAME.width, y: FRAME.anchor.y / FRAME.height },
    };
  }
  return {
    frames,
    meta: {
      app: 'PokeRPG Slicer',
      version: '1',
      image,
      format: 'RGBA8888',
      size: { w: size.width, h: size.height },
      scale: '1',
    },
  };
}

/** Apply shifts (automatic + manual nudges), pack the sheets, and validate. */
export function composeCharacter(
  prepared: Prepared,
  nudges: Nudges = {},
  options: ComposeOptions = {},
): AssembledCharacter {
  const encode = options.encode ?? true;
  const set = getAnimSet(prepared.setId)!;
  const size = sheetSize(set);
  const rects = frameRects(set);
  let clipped = 0;

  const sheets: AssembledSheet[] = prepared.layers.map((layer) => {
    const image = createPixelBuffer(size.width, size.height);
    layer.frames.forEach((pf, i) => {
      const rect = rects[i]!;
      const auto = prepared.shift[pf.key] ?? { dx: 0, dy: 0 };
      const nudge = nudges[pf.key] ?? { dx: 0, dy: 0 };
      const cell = createPixelBuffer(rect.width, rect.height);
      clipped += blitPixels(cell, pf.canvas, auto.dx + nudge.dx, auto.dy + nudge.dy);
      for (let y = 0; y < rect.height; y++) {
        const s = y * rect.width * 4;
        image.data.set(
          cell.data.subarray(s, s + rect.width * 4),
          ((rect.y + y) * image.width + rect.x) * 4,
        );
      }
    });
    const filename = layerSheetName({
      set: prepared.setId,
      layer: layer.layer,
      name: layer.name,
      ...(layer.variant !== undefined ? { variant: layer.variant } : {}),
    });
    return {
      layer: layer.layer,
      name: layer.name,
      ...(layer.variant !== undefined ? { variant: layer.variant } : {}),
      filename,
      atlasFilename: filename.replace(/\.png$/, '.json'),
      image,
      ...(encode ? { png: encodePng(image) } : {}),
      atlas: makeAtlas(prepared.setId, filename),
    };
  });

  const layers: CharacterJson['layers'] = {};
  for (const id of LAYER_IDS) {
    const s = sheets.find((x) => x.layer === id);
    if (s) layers[id] = { [prepared.setId]: s.filename };
  }
  const notes = [...prepared.notes];
  if (clipped > 0)
    notes.push(`${clipped} content pixels were pushed outside their 128 × 128 frame and cut off`);

  return {
    name: prepared.characterName,
    setId: prepared.setId,
    scale: prepared.scale,
    sheets,
    characterJson: { id: `chr_${prepared.characterName}`, specVersion: SPEC_VERSION, layers },
    report: validateCharacter(
      sheets.map((s) => ({
        filename: s.filename,
        image: s.image,
        ...(s.png ? { bytes: s.png } : {}),
      })),
    ),
    notes,
  };
}

/** Scale, align, pack and validate in one go. */
export function assembleCharacter(
  input: CharacterInput,
  nudges: Nudges = {},
  options: ComposeOptions = {},
): AssembledCharacter {
  return composeCharacter(prepareCharacter(input), nudges, options);
}

// ---------------------------------------------------------------------------------------------
// Package files
// ---------------------------------------------------------------------------------------------

export interface PackageFile {
  /** Path inside the package, e.g. `chr_mira/spr_walk_body_mira.png`. */
  path: string;
  data: Uint8Array;
}

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

/**
 * The files of a `chr_<name>/` package: sheets, atlases, character.json, report.json.
 * Requires a character composed with `encode: true`. Order and bytes are deterministic.
 */
export function packageFiles(c: AssembledCharacter): PackageFile[] {
  const dir = `chr_${c.name}`;
  const files: PackageFile[] = [];
  for (const s of c.sheets) {
    if (!s.png) throw new Error('compose the character with encode: true before packaging');
    files.push({ path: `${dir}/${s.filename}`, data: s.png });
    files.push({
      path: `${dir}/${s.atlasFilename}`,
      data: utf8(`${JSON.stringify(s.atlas, null, 2)}\n`),
    });
  }
  files.push({
    path: `${dir}/character.json`,
    data: utf8(`${JSON.stringify(c.characterJson, null, 2)}\n`),
  });
  files.push({ path: `${dir}/report.json`, data: utf8(`${JSON.stringify(c.report, null, 2)}\n`) });
  return files;
}
