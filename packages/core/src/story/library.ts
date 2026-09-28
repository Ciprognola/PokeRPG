import type { Direction } from '../spec.js';

/**
 * Library data a story refers to. The real library arrives in M7; until then `assets/` holds
 * greybox test locations with the same data (Story Schema §12.1). The location file format below
 * is our PROPOSAL for the Asset Spec (see docs-dev/location-format-proposal.md); nothing in
 * `docs/` defines it yet.
 */

export type Tile = readonly [number, number];

export interface SpawnPoint {
  tile: Tile;
  facing: Direction;
}

/** An exit is a list of tiles, or a whole map edge (`edge_north` style). */
export type ExitDef = { tiles: Tile[] } | { edge: Direction };

export interface AreaDef {
  /** `[x, y, width, height]` in tiles. */
  rect: readonly [number, number, number, number];
}

/** `assets/locations/loc_<name>.json` */
export interface LocationAsset {
  specVersion: string;
  id: string;
  /** `[width, height]` in tiles. */
  size: readonly [number, number];
  /** One string per row, one character per tile: `.` walkable, `#` blocked. */
  collision: readonly string[];
  spawns: Record<string, SpawnPoint>;
  exits: Record<string, ExitDef>;
  areas: Record<string, AreaDef>;
  /** Track played on entering, if any. */
  music?: string;
}

/** What `assets/registry/audio.json` lists. */
export interface AudioRegistry {
  specVersion: string;
  music: string[];
  sfx: string[];
}

export interface Library {
  locations: Record<string, LocationAsset>;
  music: readonly string[];
  sfx: readonly string[];
}

export interface LocationIssue {
  /** Path inside the location file, e.g. `spawns.spawn_start.tile`. */
  path: string;
  message: string;
}

const isTile = (v: unknown): v is Tile =>
  Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n));

/** Check a location asset's own consistency: sizes, spawns on walkable tiles, exits and areas inside. */
export function validateLocationAsset(loc: LocationAsset): LocationIssue[] {
  const issues: LocationIssue[] = [];
  const [w, h] = loc.size;
  const inside = (t: Tile): boolean => t[0] >= 0 && t[1] >= 0 && t[0] < w && t[1] < h;
  if (loc.collision.length !== h) {
    issues.push({
      path: 'collision',
      message: `has ${loc.collision.length} rows but size says ${h}`,
    });
  }
  loc.collision.forEach((row, y) => {
    if (row.length !== w)
      issues.push({ path: `collision[${y}]`, message: `is ${row.length} wide but size says ${w}` });
    if (/[^.#]/.test(row))
      issues.push({
        path: `collision[${y}]`,
        message: 'may only contain "." (walkable) and "#" (blocked)',
      });
  });
  for (const [name, s] of Object.entries(loc.spawns)) {
    if (!isTile(s.tile) || !inside(s.tile))
      issues.push({ path: `spawns.${name}.tile`, message: 'is outside the location' });
    else if (isBlocked(loc, s.tile))
      issues.push({ path: `spawns.${name}.tile`, message: 'is on a blocked tile' });
  }
  for (const [name, e] of Object.entries(loc.exits)) {
    if ('tiles' in e) {
      if (e.tiles.length === 0) issues.push({ path: `exits.${name}.tiles`, message: 'is empty' });
      e.tiles.forEach((t, i) => {
        if (!isTile(t) || !inside(t))
          issues.push({ path: `exits.${name}.tiles[${i}]`, message: 'is outside the location' });
      });
    }
  }
  for (const [name, a] of Object.entries(loc.areas)) {
    const [x, y, rw, rh] = a.rect;
    if (
      ![x, y, rw, rh].every(Number.isInteger) ||
      rw < 1 ||
      rh < 1 ||
      x < 0 ||
      y < 0 ||
      x + rw > w ||
      y + rh > h
    ) {
      issues.push({
        path: `areas.${name}.rect`,
        message: 'is not a rectangle inside the location',
      });
    }
  }
  return issues;
}

/** Is this tile blocked by the location's collision grid? Out-of-range tiles count as blocked. */
export function isBlocked(loc: LocationAsset, t: Tile): boolean {
  const row = loc.collision[t[1]];
  return row === undefined || row[t[0]] !== '.';
}

export function inLocation(loc: LocationAsset, t: Tile): boolean {
  return t[0] >= 0 && t[1] >= 0 && t[0] < loc.size[0] && t[1] < loc.size[1];
}

export function areaContains(a: AreaDef, t: Tile): boolean {
  return (
    t[0] >= a.rect[0] &&
    t[0] < a.rect[0] + a.rect[2] &&
    t[1] >= a.rect[1] &&
    t[1] < a.rect[1] + a.rect[3]
  );
}

/** Assemble a `Library` from location assets and the audio registry. */
export function buildLibrary(locations: readonly LocationAsset[], audio: AudioRegistry): Library {
  return {
    locations: Object.fromEntries(locations.map((l) => [l.id, l])),
    music: audio.music,
    sfx: audio.sfx,
  };
}
