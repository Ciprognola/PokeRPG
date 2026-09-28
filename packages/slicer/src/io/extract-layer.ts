import {
  ExtractionError,
  checkGridSize,
  extractFrame,
  frameRects,
  getAnimSet,
  gridCellRect,
  orderFrameFiles,
} from '@pokerpg/core';
import type { ExtractOptions, ExtractedFrame } from '@pokerpg/core';
import { openImage } from './decode.js';

/** One layer's raw input: a 6 × 4 grid image, or 24 separate frame images. */
export type LayerSource = { kind: 'grid'; file: File } | { kind: 'frames'; files: readonly File[] };

export interface ExtractProgress {
  done: number;
  total: number;
}

const FRAMES = 24;

const frameKeys = (): string[] => {
  const walk = getAnimSet('walk');
  return walk ? frameRects(walk).map((r) => r.key) : [];
};

/** Let the UI paint between frames so progress bars move and touches stay responsive. */
const yieldToUi = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Turn a layer's raw input into 24 clean frames. Memory stays bounded to one cell of work at a
 * time: a grid is decoded once and read cell by cell; separate files are opened one after another.
 */
export async function extractLayer(
  source: LayerSource,
  options: ExtractOptions = {},
  onProgress?: (p: ExtractProgress) => void,
): Promise<ExtractedFrame[]> {
  const keys = frameKeys();
  const frames: ExtractedFrame[] = [];
  if (source.kind === 'grid') {
    const img = await openImage(source.file, source.file.name);
    try {
      checkGridSize(img.width, img.height);
      for (let i = 0; i < FRAMES; i++) {
        const cell = await img.readRect(gridCellRect(img.width, img.height, i));
        frames.push(extractFrame(cell, options, keys[i]));
        onProgress?.({ done: i + 1, total: FRAMES });
        await yieldToUi();
      }
    } finally {
      img.close();
    }
    return frames;
  }
  if (source.files.length !== FRAMES) {
    throw new ExtractionError(
      'wrong-count',
      `expected ${FRAMES} frame images, got ${source.files.length}`,
    );
  }
  const order = orderFrameFiles(source.files.map((f) => f.name));
  for (let i = 0; i < FRAMES; i++) {
    const file = source.files[order[i]!]!;
    const img = await openImage(file, file.name);
    try {
      const whole = await img.readRect({ x: 0, y: 0, width: img.width, height: img.height });
      frames.push(extractFrame(whole, options, keys[i]));
    } finally {
      img.close();
    }
    onProgress?.({ done: i + 1, total: FRAMES });
    await yieldToUi();
  }
  return frames;
}
