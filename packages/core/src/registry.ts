import { DIRECTIONS, FRAME, SPEC_VERSION } from './spec.js';
import type { Direction, LayerId } from './spec.js';

/** Shape of assets/registry/animsets.json (docs/ASSET_SPEC.md §3). */
export interface AnimSet {
  id: string;
  version: number;
  rows: Direction[];
  framesPerRow: number;
  loop: boolean;
  mirrorable: boolean;
  groundLock: boolean;
  requiredLayers: LayerId[];
  zOrder: { default: LayerId[] } & Partial<Record<Direction, LayerId[]>>;
}

export interface AnimSetRegistry {
  specVersion: string;
  character: { frame: [number, number]; anchor: [number, number]; standardHeight: number };
  directions: Direction[];
  sets: AnimSet[];
}

/** The built-in registry, kept identical to assets/registry/animsets.json (checked by a test). */
export const REGISTRY: AnimSetRegistry = {
  specVersion: SPEC_VERSION,
  character: {
    frame: [FRAME.width, FRAME.height],
    anchor: [FRAME.anchor.x, FRAME.anchor.y],
    standardHeight: FRAME.standardHeight,
  },
  directions: [...DIRECTIONS],
  sets: [
    {
      id: 'walk',
      version: 1,
      rows: [...DIRECTIONS],
      framesPerRow: 6,
      loop: true,
      mirrorable: false,
      groundLock: true,
      requiredLayers: ['body'],
      zOrder: {
        default: ['hair-back', 'accessory-back', 'body', 'outfit', 'hair', 'headwear', 'accessory'],
        up: ['body', 'outfit', 'accessory-back', 'hair-back', 'hair', 'headwear', 'accessory'],
      },
    },
  ],
};

export function getAnimSet(id: string, registry: AnimSetRegistry = REGISTRY): AnimSet | undefined {
  return registry.sets.find((s) => s.id === id);
}

/** Sheet size in pixels for a set: rows × framesPerRow frames of the standard canvas. */
export function sheetSize(set: AnimSet): { width: number; height: number } {
  return { width: set.framesPerRow * FRAME.width, height: set.rows.length * FRAME.height };
}

export interface FrameRect {
  key: string;
  row: Direction;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Frame key `<set>_<row>_<nn>` (docs/ASSET_SPEC.md §4), e.g. `walk_left_03`. */
export function frameKey(setId: string, row: Direction, col: number): string {
  return `${setId}_${row}_${String(col).padStart(2, '0')}`;
}

/** Every frame of a set in row-major order, with its pixel rectangle inside the sheet. */
export function frameRects(set: AnimSet): FrameRect[] {
  const rects: FrameRect[] = [];
  set.rows.forEach((row, r) => {
    for (let col = 0; col < set.framesPerRow; col++) {
      rects.push({
        key: frameKey(set.id, row, col),
        row,
        col,
        x: col * FRAME.width,
        y: r * FRAME.height,
        width: FRAME.width,
        height: FRAME.height,
      });
    }
  });
  return rects;
}
