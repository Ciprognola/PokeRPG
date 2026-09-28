import { LAYER_IDS } from './spec.js';
import type { LayerId } from './spec.js';

/** Lowercase [a-z0-9-]; `_` is reserved as the field separator (docs/ASSET_SPEC.md §1). */
const FIELD = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface LayerSheetName {
  set: string;
  layer: LayerId;
  name: string;
  variant?: string;
}

export function isLayerId(value: string): value is LayerId {
  return (LAYER_IDS as readonly string[]).includes(value);
}

/**
 * Parse `spr_<set>_<layer>_<name>[_<variant>].png` (docs/ASSET_SPEC.md §4).
 * Returns undefined when the filename does not match the pattern.
 */
export function parseLayerSheetName(filename: string): LayerSheetName | undefined {
  if (!filename.endsWith('.png')) return undefined;
  const parts = filename.slice(0, -'.png'.length).split('_');
  if (parts.length < 4 || parts.length > 5 || parts[0] !== 'spr') return undefined;
  const [, set, layer, name, variant] = parts as [string, string, string, string, string?];
  if (!isLayerId(layer)) return undefined;
  const fields = variant === undefined ? [set, name] : [set, name, variant];
  if (!fields.every((f) => FIELD.test(f))) return undefined;
  return variant === undefined ? { set, layer, name } : { set, layer, name, variant };
}

export function layerSheetName(n: LayerSheetName): string {
  const fields = ['spr', n.set, n.layer, n.name];
  if (n.variant !== undefined) fields.push(n.variant);
  return `${fields.join('_')}.png`;
}
