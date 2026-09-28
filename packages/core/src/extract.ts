import { createPixelBuffer, cropPixels } from './pixels.js';
import type { PixelBuffer, Rect } from './pixels.js';
import { REGISTRY, frameRects, getAnimSet } from './registry.js';
import { KEY_COLOUR } from './spec.js';

/**
 * Frame extraction (PKR-003, docs/ASSET_SPEC.md §6 input and step 1): turn raw image(s) into clean,
 * transparent character frames. Pure and DOM-free: works on one cell at a time, so a caller can
 * decode a huge grid image piece by piece and never hold more than one cell of work in memory.
 *
 * Per frame: detect the background (transparent or flat colour), remove it, defringe the soft
 * edge, drop specks and noise, crop to the character. The result keeps its position inside the
 * source cell (`origin`) so later stages can keep every layer of a frame registered.
 */

export const GRID_COLUMNS = 6;
export const GRID_ROWS = 4;
export const FRAME_COUNT = GRID_COLUMNS * GRID_ROWS;

export type ExtractionErrorCode =
  'wrong-count' | 'duplicate-frame' | 'bad-grid' | 'empty-cell' | 'no-background';

export class ExtractionError extends Error {
  constructor(
    readonly code: ExtractionErrorCode,
    message: string,
    readonly frameKey?: string,
  ) {
    super(frameKey ? `${frameKey} · ${message}` : message);
    this.name = 'ExtractionError';
  }
}

export type Background =
  { kind: 'transparent' } | { kind: 'flat'; color: readonly [number, number, number] };

export interface ExtractOptions {
  /** Max per-channel distance from the background colour that still counts as background. */
  bgTolerance?: number;
  /** Components smaller than this fraction of the largest one are treated as specks. */
  minComponentRatio?: number;
  /** Enclosed background-coloured holes bigger than this fraction of the character box are cut out. */
  holeRatio?: number;
  /**
   * Flat magenta key colour only: remove every enclosed pocket of it, of any size (no key colour may
   * be left inside a character), and count as pocket any pixel within `keyPocketTolerance` of it
   * so heavily blended slivers go too. Default true; false restores the size-limited behaviour.
   */
  keyPockets?: boolean;
  keyPocketTolerance?: number;
  /** Width in source pixels of the soft edge that is un-mixed from the background. 0 = automatic. */
  edgeBand?: number;
  /** Return an empty (0 × 0) frame instead of failing on a cell with no character. For optional layers. */
  allowEmpty?: boolean;
}

const DEFAULTS = {
  bgTolerance: 24,
  minComponentRatio: 0.02,
  holeRatio: 0.003,
  keyPockets: true,
  keyPocketTolerance: 72,
  edgeBand: 0,
  allowEmpty: false,
};

export interface ExtractedFrame {
  /** Character pixels, cropped to their bounding box (straight alpha, background gone). */
  pixels: PixelBuffer;
  /** Where `pixels` sits inside the source cell. Shared coordinate space for all layers of a frame. */
  origin: { x: number; y: number };
  /** Size of the source cell. */
  cell: { width: number; height: number };
  background: Background;
}

// ---------------------------------------------------------------------------------------------
// Input splitting
// ---------------------------------------------------------------------------------------------

/** Rectangle of grid cell `index` (row-major, spec order) inside an image of the given size. */
export function gridCellRect(width: number, height: number, index: number): Rect {
  const col = index % GRID_COLUMNS;
  const row = Math.floor(index / GRID_COLUMNS);
  const x0 = Math.round((col * width) / GRID_COLUMNS);
  const x1 = Math.round(((col + 1) * width) / GRID_COLUMNS);
  const y0 = Math.round((row * height) / GRID_ROWS);
  const y1 = Math.round(((row + 1) * height) / GRID_ROWS);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Reject grid images too small to hold 24 frames. */
export function checkGridSize(width: number, height: number): void {
  const cell = gridCellRect(width, height, 0);
  if (cell.width < 16 || cell.height < 16) {
    throw new ExtractionError(
      'bad-grid',
      `grid image ${width}×${height} is too small for ${GRID_COLUMNS} × ${GRID_ROWS} frames`,
    );
  }
}

const FRAME_KEY_RE = /(walk_(?:down|left|right|up)_\d{2})/i;

function naturalCompare(a: string, b: string): number {
  const pa = a.toLowerCase().match(/\d+|\D+/g) ?? [];
  const pb = b.toLowerCase().match(/\d+|\D+/g) ?? [];
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
    const x = pa[i]!;
    const y = pb[i]!;
    if (x === y) continue;
    const nx = Number(x);
    const ny = Number(y);
    if (/^\d/.test(x) && /^\d/.test(y) && nx !== ny) return nx - ny;
    return x < y ? -1 : 1;
  }
  return pa.length - pb.length;
}

/**
 * Put 24 separate frame files in spec order and return their indices. Files whose names carry a
 * frame key (`walk_left_03`) are placed by it; otherwise the names are sorted naturally
 * (`f2` before `f10`), which matches numbered exports.
 */
export function orderFrameFiles(names: readonly string[]): number[] {
  if (names.length !== FRAME_COUNT) {
    throw new ExtractionError(
      'wrong-count',
      `expected ${FRAME_COUNT} frame images, got ${names.length}`,
    );
  }
  const walk = getAnimSet('walk', REGISTRY);
  const keys = walk ? frameRects(walk).map((r) => r.key) : [];
  const matched = names.map((n) => FRAME_KEY_RE.exec(n)?.[1]?.toLowerCase());
  if (matched.every((m) => m !== undefined)) {
    const order: number[] = [];
    for (const key of keys) {
      const hits = matched.flatMap((m, i) => (m === key ? [i] : []));
      if (hits.length !== 1) {
        throw new ExtractionError(
          hits.length === 0 ? 'wrong-count' : 'duplicate-frame',
          hits.length === 0 ? 'no image for this frame' : `${hits.length} images claim this frame`,
          key,
        );
      }
      order.push(hits[0]!);
    }
    return order;
  }
  return names.map((_, i) => i).sort((a, b) => naturalCompare(names[a]!, names[b]!));
}

// ---------------------------------------------------------------------------------------------
// Background
// ---------------------------------------------------------------------------------------------

const ALPHA_CUT = 8; // below this a pixel is noise, not character

export function detectBackground(cell: PixelBuffer, tolerance = DEFAULTS.bgTolerance): Background {
  const { width: w, height: h, data } = cell;
  const t = Math.max(1, Math.floor(Math.min(w, h) / 64));
  const ring: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < t || y < t || x >= w - t || y >= h - t) ring.push((y * w + x) * 4);
    }
  }
  const transparent = ring.filter((i) => data[i + 3] < 16).length;
  if (transparent >= ring.length / 2) return { kind: 'transparent' };

  const buckets = new Map<number, number>();
  for (const i of ring) {
    const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  let best = -1;
  let bestN = 0;
  for (const [k, n] of buckets) {
    if (n > bestN || (n === bestN && k < best)) {
      best = k;
      bestN = n;
    }
  }
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (const i of ring) {
    const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
    if (key === best) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    }
  }
  const color = [Math.round(r / n), Math.round(g / n), Math.round(b / n)] as const;
  const inliers = ring.filter(
    (i) =>
      Math.abs(data[i] - color[0]) <= tolerance &&
      Math.abs(data[i + 1] - color[1]) <= tolerance &&
      Math.abs(data[i + 2] - color[2]) <= tolerance,
  ).length;
  if (inliers < ring.length * 0.6) {
    throw new ExtractionError(
      'no-background',
      'the background is neither transparent nor one flat colour (check the image edges)',
    );
  }
  return { kind: 'flat', color };
}

// ---------------------------------------------------------------------------------------------
// Connected components
// ---------------------------------------------------------------------------------------------

/** Label 8-connected components of `mask`; returns per-pixel labels (0 = none) and areas. */
function label(
  mask: Uint8Array,
  w: number,
  h: number,
  eight: boolean,
): { labels: Int32Array; areas: number[] } {
  const labels = new Int32Array(w * h);
  const areas: number[] = [0];
  const stack = new Int32Array(w * h);
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    const id = areas.length;
    let area = 0;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = id;
    while (sp > 0) {
      const i = stack[--sp]!;
      area++;
      const x = i % w;
      const y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((dx === 0 && dy === 0) || (!eight && dx !== 0 && dy !== 0)) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (mask[j] && !labels[j]) {
            labels[j] = id;
            stack[sp++] = j;
          }
        }
      }
    }
    areas.push(area);
  }
  return { labels, areas };
}

/** Keep only components that are not specks. Returns the largest component's area too. */
function dropSpecks(mask: Uint8Array, w: number, h: number, ratio: number): number {
  const { labels, areas } = label(mask, w, h, true);
  const largest = Math.max(0, ...areas);
  const min = Math.max(1, largest * ratio);
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] && areas[labels[i]!]! < min) mask[i] = 0;
  }
  return largest;
}

function maskBounds(mask: Uint8Array, w: number, h: number): Rect | undefined {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      y1 = y;
    }
  }
  return x1 < 0 ? undefined : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

// ---------------------------------------------------------------------------------------------
// One frame
// ---------------------------------------------------------------------------------------------

/**
 * Extract the character from one cell. Throws `ExtractionError` for an empty cell or a background
 * that is neither transparent nor flat. `frameKey` only decorates error messages.
 */
export function extractFrame(
  cell: PixelBuffer,
  options: ExtractOptions = {},
  frameKey?: string,
): ExtractedFrame {
  const o = { ...DEFAULTS, ...options };
  const { width: w, height: h } = cell;
  const n = w * h;
  const src = cell.data;
  let background: Background;
  try {
    background = detectBackground(cell, o.bgTolerance);
  } catch (e) {
    if (e instanceof ExtractionError) throw new ExtractionError(e.code, e.message, frameKey);
    throw e;
  }
  const emptyFrame = (): ExtractedFrame => ({
    pixels: createPixelBuffer(0, 0),
    origin: { x: 0, y: 0 },
    cell: { width: w, height: h },
    background,
  });
  const band =
    o.edgeBand > 0 ? o.edgeBand : Math.min(6, Math.max(2, Math.round(Math.min(w, h) / 150)));
  const flat = background.kind === 'flat' ? background.color : undefined;

  // 1. Which pixels are character?
  const keep = new Uint8Array(n);
  const near = (i: number): boolean =>
    Math.abs(src[i * 4]! - flat![0]) <= o.bgTolerance &&
    Math.abs(src[i * 4 + 1]! - flat![1]) <= o.bgTolerance &&
    Math.abs(src[i * 4 + 2]! - flat![2]) <= o.bgTolerance;
  if (flat) {
    // Flood the background inwards from the border; everything it cannot reach is character.
    const isBg = new Uint8Array(n);
    const queue = new Int32Array(n);
    let qh = 0;
    let qt = 0;
    const seed = (i: number): void => {
      if (!isBg[i] && near(i)) {
        isBg[i] = 1;
        queue[qt++] = i;
      }
    };
    for (let x = 0; x < w; x++) {
      seed(x);
      seed((h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
      seed(y * w);
      seed(y * w + w - 1);
    }
    while (qh < qt) {
      const i = queue[qh++]!;
      const x = i % w;
      if (x > 0) seed(i - 1);
      if (x < w - 1) seed(i + 1);
      if (i >= w) seed(i - w);
      if (i < n - w) seed(i + w);
    }
    for (let i = 0; i < n; i++) keep[i] = isBg[i] ? 0 : 1;
  } else {
    for (let i = 0; i < n; i++) keep[i] = src[i * 4 + 3]! >= ALPHA_CUT ? 1 : 0;
  }

  // 2. Specks and noise.
  dropSpecks(keep, w, h, o.minComponentRatio);
  const box = maskBounds(keep, w, h);
  if (!box) {
    if (o.allowEmpty) return emptyFrame();
    throw new ExtractionError('empty-cell', 'no character found (the cell is empty)', frameKey);
  }

  // 3. Enclosed holes that show the background (gap between an arm and the body, ...).
  // On the magenta key colour nothing of it may stay inside the character: every enclosed pocket
  // goes, however small, and slivers that are mostly key colour count as pocket too.
  const isKey =
    flat !== undefined &&
    o.keyPockets &&
    flat.every((c, k) => Math.abs(c - KEY_COLOUR[k]!) <= o.bgTolerance);
  const pocketTol = isKey ? Math.max(o.bgTolerance, o.keyPocketTolerance) : o.bgTolerance;
  const nearKey = (i: number): boolean =>
    isKey &&
    Math.abs(src[i * 4]! - flat![0]) <= pocketTol &&
    Math.abs(src[i * 4 + 1]! - flat![1]) <= pocketTol &&
    Math.abs(src[i * 4 + 2]! - flat![2]) <= pocketTol;
  if (flat) {
    const holeCandidates = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      if (!keep[i]) continue;
      holeCandidates[i] = (isKey ? nearKey(i) : near(i)) ? 1 : 0;
    }
    const { labels, areas } = label(holeCandidates, w, h, false);
    // A wide-tolerance component only counts as a pocket if it contains real key colour: the
    // blended rim on the OUTSIDE of the character is left to the soft-edge step below.
    const seeded = new Uint8Array(areas.length);
    if (isKey) for (let i = 0; i < n; i++) if (holeCandidates[i] && near(i)) seeded[labels[i]!] = 1;
    const min = o.holeRatio * box.width * box.height;
    for (let i = 0; i < n; i++) {
      if (!holeCandidates[i]) continue;
      const l = labels[i]!;
      if (isKey ? seeded[l] === 1 : areas[l]! >= min) keep[i] = 0;
    }
  }

  // 4. Soft edge: distance (in pixels) from the background, up to `band`.
  const edge = new Uint8Array(n); // 0 = interior/outside, 1..band = distance from outside
  const front: number[] = [];
  for (let i = 0; i < n; i++) {
    if (keep[i]) continue;
    const x = i % w;
    if (
      (x > 0 && keep[i - 1]) ||
      (x < w - 1 && keep[i + 1]) ||
      (i >= w && keep[i - w]) ||
      (i < n - w && keep[i + w])
    ) {
      front.push(i);
    }
  }
  let ring = front;
  for (let d = 1; d <= band && ring.length; d++) {
    const next: number[] = [];
    for (const i of ring) {
      const x = i % w;
      const neighbours = [
        x > 0 ? i - 1 : -1,
        x < w - 1 ? i + 1 : -1,
        i >= w ? i - w : -1,
        i < n - w ? i + w : -1,
      ];
      for (const j of neighbours) {
        if (j >= 0 && keep[j] && !edge[j]) {
          edge[j] = d;
          next.push(j);
        }
      }
    }
    ring = next;
  }

  // 5. Build the output, un-mixing the edge from the background / bleeding colour from the inside.
  const out = createPixelBuffer(w, h);
  const isCore = (i: number): boolean =>
    keep[i] === 1 && (flat ? edge[i] === 0 : src[i * 4 + 3]! >= 250);
  const coreColour = (x: number, y: number): [number, number, number] | undefined => {
    for (let r = band + 3; r <= (band + 3) * 3; r *= 3) {
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let c = 0;
      for (let yy = Math.max(0, y - r); yy <= Math.min(h - 1, y + r); yy++) {
        for (let xx = Math.max(0, x - r); xx <= Math.min(w - 1, x + r); xx++) {
          const j = yy * w + xx;
          if (isCore(j)) {
            sr += src[j * 4]!;
            sg += src[j * 4 + 1]!;
            sb += src[j * 4 + 2]!;
            c++;
          }
        }
      }
      if (c > 0) return [sr / c, sg / c, sb / c];
    }
    return undefined;
  };
  const clamp255 = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

  for (let i = 0; i < n; i++) {
    if (!keep[i]) continue;
    const x = i % w;
    const y = (i - x) / w;
    let r = src[i * 4]!;
    let g = src[i * 4 + 1]!;
    let b = src[i * 4 + 2]!;
    let a = flat ? 255 : src[i * 4 + 3]!;
    // Pixels that are mostly key colour are un-mixed wherever they are, not only near the outside:
    // a blended sliver between two limbs must not survive as an opaque magenta speck.
    if (flat && (edge[i] || nearKey(i))) {
      const F = coreColour(x, y);
      if (F) {
        const u = [F[0] - flat[0], F[1] - flat[1], F[2] - flat[2]];
        const v = [r - flat[0], g - flat[1], b - flat[2]];
        const uu = u[0]! * u[0]! + u[1]! * u[1]! + u[2]! * u[2]!;
        if (uu >= (2 * o.bgTolerance) ** 2) {
          const alpha = Math.min(
            1,
            Math.max(0, (v[0]! * u[0]! + v[1]! * u[1]! + v[2]! * u[2]!) / uu),
          );
          if (alpha < 0.02) {
            continue; // effectively background
          } else if (alpha < 0.97) {
            a = Math.round(alpha * 255);
            if (alpha >= 0.25) {
              r = clamp255(flat[0] + v[0]! / alpha);
              g = clamp255(flat[1] + v[1]! / alpha);
              b = clamp255(flat[2] + v[2]! / alpha);
            } else {
              [r, g, b] = [clamp255(F[0]), clamp255(F[1]), clamp255(F[2])];
            }
          }
        }
      }
    } else if (!flat && a < 250) {
      const F = coreColour(x, y);
      if (F) [r, g, b] = [clamp255(F[0]), clamp255(F[1]), clamp255(F[2])];
    }
    out.data[i * 4] = r;
    out.data[i * 4 + 1] = g;
    out.data[i * 4 + 2] = b;
    out.data[i * 4 + 3] = a;
  }

  // 6. Crop to what is left.
  const finalMask = new Uint8Array(n);
  for (let i = 0; i < n; i++) finalMask[i] = out.data[i * 4 + 3]! > 0 ? 1 : 0;
  const bounds = maskBounds(finalMask, w, h);
  if (!bounds) {
    if (o.allowEmpty) return emptyFrame();
    throw new ExtractionError('empty-cell', 'no character found (the cell is empty)', frameKey);
  }
  return {
    pixels: cropPixels(out, bounds),
    origin: { x: bounds.x, y: bounds.y },
    cell: { width: w, height: h },
    background,
  };
}

// ---------------------------------------------------------------------------------------------
// Whole layers
// ---------------------------------------------------------------------------------------------

function keyAt(index: number): string {
  const walk = getAnimSet('walk', REGISTRY);
  return walk ? frameRects(walk)[index]!.key : `frame_${index}`;
}

/** Extract all 24 frames of a grid image held in memory (spec order). */
export function extractGrid(image: PixelBuffer, options: ExtractOptions = {}): ExtractedFrame[] {
  checkGridSize(image.width, image.height);
  const frames: ExtractedFrame[] = [];
  for (let i = 0; i < FRAME_COUNT; i++) {
    const rect = gridCellRect(image.width, image.height, i);
    frames.push(extractFrame(cropPixels(image, rect), options, keyAt(i)));
  }
  return frames;
}

/** Extract 24 separate frame images already put in spec order (see `orderFrameFiles`). */
export function extractFrames(
  images: readonly PixelBuffer[],
  options: ExtractOptions = {},
): ExtractedFrame[] {
  if (images.length !== FRAME_COUNT) {
    throw new ExtractionError(
      'wrong-count',
      `expected ${FRAME_COUNT} frame images, got ${images.length}`,
    );
  }
  return images.map((img, i) => extractFrame(img, options, keyAt(i)));
}
