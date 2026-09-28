/**
 * Asset Spec constants (docs/ASSET_SPEC.md, v0.2). This file is the code-side
 * copy of the spec: change the spec first, then here. Every number cites its section.
 */

/** Asset format version (Asset Spec §7.1: stays 0.1 until the file format itself changes). */
export const SPEC_VERSION = '0.1';

/** §1 */
export const TILE_SIZE = 64;
export const MAX_TEXTURE_SIZE = 2048;

/** §2.1 */
export const FRAME = {
  width: 128,
  height: 128,
  anchor: { x: 64, y: 120 },
  /** Lowest opaque pixel row of a grounded frame (anchor.y - 1). */
  groundRow: 119,
  standardHeight: 96,
  safeBox: { x0: 16, y0: 20, x1: 111, y1: 119 },
  /** Headwear and accessories may reach up to this row. */
  overflowTop: 8,
  emptyBorder: 4,
  torsoCentreX: 64,
} as const;

/** §2.2 */
export const DIRECTIONS = ['down', 'left', 'right', 'up'] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** §2.3 */
export const LAYER_IDS = [
  'body',
  'outfit',
  'hair',
  'hair-back',
  'headwear',
  'accessory',
  'accessory-back',
] as const;
export type LayerId = (typeof LAYER_IDS)[number];
export const MAX_LAYERS = 7;

/** §2.4 and §7 */
export const SHEET_FILE_LIMITS = { warnBytes: 1_000_000, errorBytes: 2_000_000 } as const;

/** §7 tolerances */
export const TOLERANCES = {
  groundWarnPx: 1,
  groundErrorPx: 2,
  torsoCentreWarnPx: 2,
  bodyHeightWarnPx: 4,
  bodyHeightErrorPx: 8,
} as const;
