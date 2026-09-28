import { DIRECTIONS } from '../spec.js';
import type { Direction } from '../spec.js';

/**
 * Library data a story refers to. The real library arrives in M7; until then `assets/` holds
 * greybox test locations with the same data. The location file format is Asset Spec §8.1.
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

const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PRE = { spawn: /^spawn_/, exit: /^exit_/, edge: /^edge_/, area: /^area_/ };
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export interface LocationCheckOptions {
  /** File the data came from, e.g. `loc_harbour.json`; `id` must match it (§8.1 `id`). */
  fileName?: string;
  /** Library music ids; when given, `music` must be one of them. */
  music?: readonly string[];
}

/**
 * Check a location file against Asset Spec §8.1: every rule in the field table, one issue per
 * broken rule. Takes unparsed JSON, so a malformed file gives issues instead of a crash.
 */
export function validateLocationAsset(
  data: unknown,
  options: LocationCheckOptions = {},
): LocationIssue[] {
  const issues: LocationIssue[] = [];
  const add = (path: string, message: string): void => void issues.push({ path, message });
  if (!isRecord(data)) return [{ path: '', message: 'is not a JSON object' }];

  // id: `loc_<name>`, matches the file name
  const id = data['id'];
  if (typeof id !== 'string' || !id.startsWith('loc_') || !NAME.test(id.slice(4)))
    add('id', 'must be "loc_<name>" (lower case letters, digits and single hyphens)');
  else if (options.fileName !== undefined && options.fileName !== `${id}.json`)
    add('id', `"${id}" does not match the file name ${options.fileName}`);

  // size: [width, height] in tiles
  const sz = data['size'];
  const sizeOk =
    Array.isArray(sz) && sz.length === 2 && sz.every((n) => Number.isInteger(n) && n >= 1);
  if (!sizeOk) add('size', 'must be [width, height], two whole numbers of at least 1');
  const w = sizeOk ? (sz[0] as number) : 0;
  const h = sizeOk ? (sz[1] as number) : 0;
  const inside = (t: Tile): boolean => t[0] >= 0 && t[1] >= 0 && t[0] < w && t[1] < h;

  // collision: exactly `height` strings of `width` characters, "." and "#" only
  const col = data['collision'];
  const grid: string[] = Array.isArray(col) && col.every((r) => typeof r === 'string') ? col : [];
  if (!Array.isArray(col) || grid.length !== col.length)
    add('collision', 'must be an array of strings');
  else if (sizeOk) {
    if (col.length !== h) add('collision', `has ${col.length} rows but size says ${h}`);
    grid.forEach((row, y) => {
      if (row.length !== w) add(`collision[${y}]`, `is ${row.length} wide but size says ${w}`);
      if (/[^.#]/.test(row))
        add(`collision[${y}]`, 'may only contain "." (walkable) and "#" (blocked)');
    });
  }
  const walkable = (t: Tile): boolean => grid[t[1]]?.[t[0]] === '.';

  const named = (
    key: string,
    prefix: RegExp,
    what: string,
  ): [string, Record<string, unknown>][] => {
    const v = data[key];
    if (!isRecord(v)) {
      add(key, 'must be an object');
      return [];
    }
    const out: [string, Record<string, unknown>][] = [];
    for (const [name, def] of Object.entries(v)) {
      if (!prefix.test(name)) add(`${key}.${name}`, `name must start with "${what}"`);
      if (isRecord(def)) out.push([name, def]);
      else add(`${key}.${name}`, 'must be an object');
    }
    return out;
  };
  const tileProblem = (v: unknown, path: string): Tile | undefined => {
    if (!isTile(v)) return void add(path, 'must be [x, y], two whole numbers');
    if (!inside(v)) return void add(path, 'is outside the location');
    return v;
  };

  // spawns: `spawn_<name>` → { tile, facing }; the tile is inside the map and walkable
  for (const [name, s] of named('spawns', PRE.spawn, 'spawn_')) {
    const t = tileProblem(s['tile'], `spawns.${name}.tile`);
    if (t && !walkable(t)) add(`spawns.${name}.tile`, 'is on a blocked tile');
    if (!DIRECTIONS.includes(s['facing'] as Direction))
      add(`spawns.${name}.facing`, `must be one of ${DIRECTIONS.join(', ')}`);
  }

  // exits: `exit_<name>` → { tiles } (walkable tiles) or `edge_<name>` → { edge }
  for (const [name, e] of named('exits', /^(exit|edge)_/, 'exit_ or edge_')) {
    const path = `exits.${name}`;
    if (PRE.edge.test(name)) {
      if (!DIRECTIONS.includes(e['edge'] as Direction))
        add(`${path}.edge`, `must be one of ${DIRECTIONS.join(', ')}`);
      if ('tiles' in e) add(`${path}.tiles`, 'an edge_ exit has "edge", not "tiles"');
    } else if (PRE.exit.test(name)) {
      const tiles = e['tiles'];
      if (!Array.isArray(tiles) || tiles.length === 0) add(`${path}.tiles`, 'is empty');
      else
        tiles.forEach((tile, i) => {
          const t = tileProblem(tile, `${path}.tiles[${i}]`);
          if (t && !walkable(t)) add(`${path}.tiles[${i}]`, 'is on a blocked tile');
        });
      if ('edge' in e) add(`${path}.edge`, 'an exit_ exit has "tiles", not "edge"');
    }
  }

  // areas: `area_<name>` → { rect } fully inside the map
  for (const [name, a] of named('areas', PRE.area, 'area_')) {
    const r = a['rect'];
    const ok =
      Array.isArray(r) &&
      r.length === 4 &&
      r.every(Number.isInteger) &&
      (r[2] as number) >= 1 &&
      (r[3] as number) >= 1 &&
      (r[0] as number) >= 0 &&
      (r[1] as number) >= 0 &&
      (r[0] as number) + (r[2] as number) <= w &&
      (r[1] as number) + (r[3] as number) <= h;
    if (!ok) add(`areas.${name}.rect`, 'is not a rectangle inside the location');
  }

  // music: optional default track (library id)
  const music = data['music'];
  if (music !== undefined) {
    if (typeof music !== 'string') add('music', 'must be a track id');
    else if (options.music && !options.music.includes(music))
      add('music', `unknown track "${music}"`);
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
