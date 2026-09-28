import { extractLayer } from './io/extract-layer.js';
import type { LayerSource } from './io/extract-layer.js';
import { prepareCharacter } from '@pokerpg/core';
import type { LayerId, LayerInput, Prepared } from '@pokerpg/core';

/** One layer the user has added on the setup screen. */
export interface LayerEntry {
  id: number;
  layer: LayerId;
  /** Asset name in the file name (`spr_walk_<layer>_<name>.png`). */
  name: string;
  source: LayerSource;
  /** What was picked, e.g. "grid: sheet.png" or "24 frames". */
  summary: string;
  /** Small preview image (data URL), when it could be made. */
  thumb?: string;
}

export interface BuildProgress {
  layer: LayerId;
  layerIndex: number;
  layerCount: number;
  done: number;
  total: number;
}

/**
 * Extract every layer (one at a time, so memory stays bounded) and prepare the character:
 * scale, align, ready to compose. The body is extracted first; an empty cell is an error there but
 * fine in an optional layer (a hat may be absent in some frames).
 */
export async function buildCharacter(
  characterName: string,
  entries: readonly LayerEntry[],
  onProgress: (p: BuildProgress) => void,
  signal?: AbortSignal,
): Promise<Prepared> {
  const ordered = [...entries].sort(
    (a, b) => Number(b.layer === 'body') - Number(a.layer === 'body'),
  );
  const layers: LayerInput[] = [];
  for (const [layerIndex, entry] of ordered.entries()) {
    const frames = await extractLayer(
      entry.source,
      { allowEmpty: entry.layer !== 'body' },
      (p) => onProgress({ layer: entry.layer, layerIndex, layerCount: ordered.length, ...p }),
      signal,
    ).catch((e: unknown) => {
      if (e instanceof Error && !(e instanceof DOMException))
        e.message = `${entry.layer} layer · ${e.message}`;
      throw e;
    });
    layers.push({ layer: entry.layer, name: entry.name, frames });
  }
  signal?.throwIfAborted();
  return prepareCharacter({ name: characterName, layers });
}
