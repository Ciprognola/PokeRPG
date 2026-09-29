// Resolves a private local build's overrides/ folder (Project Brief §2, §7; GDD §12; PKR-014).
// Node-only: it touches the filesystem, so it lives in tools/, never in @pokerpg/core
// (architecture.md "Why core is DOM-free" — core must stay usable in the browser Slicer).
import { existsSync } from 'node:fs';
import { join, normalize, relative } from 'node:path';

/** The folder name, fixed by Project Brief §2: `overrides/` at the repo root. */
export const OVERRIDES_DIR = 'overrides';

export interface OverrideResolution {
  /** The path a build should actually load. */
  path: string;
  /** True when an override file was found and `path` points at it, not at the original. */
  overridden: boolean;
}

/**
 * A private build may replace a UI asset (art, font, sound, music) with a same-named,
 * same-sized file at the same relative path under `overrides/`. Given that relative path
 * and the folder that holds the original, this returns whichever file a build should load:
 * the override if one exists there, otherwise the original.
 */
export function resolveOverride(
  relativePath: string,
  originalRoot: string,
  overridesRoot: string = OVERRIDES_DIR,
): OverrideResolution {
  assertWithinRoot(relativePath);
  const overridePath = join(overridesRoot, relativePath);
  if (existsSync(overridePath)) {
    return { path: overridePath, overridden: true };
  }
  return { path: join(originalRoot, relativePath), overridden: false };
}

// A relative path that climbs out of its root (e.g. "../secrets.env") must never be honoured:
// overrides/ and the original asset tree are the only two places a build may read from here.
function assertWithinRoot(relativePath: string): void {
  const normalized = normalize(relativePath);
  if (normalized.startsWith('..') || relative('.', normalized).startsWith('..')) {
    throw new Error(`Override path escapes its root: "${relativePath}"`);
  }
}
