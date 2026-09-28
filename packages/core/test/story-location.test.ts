/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DIRECTIONS,
  areaContains,
  buildLibrary,
  inLocation,
  isBlocked,
  validateLocationAsset,
} from '../src/index.js';
import type { LocationAsset } from '../src/index.js';
import { library } from './story-helpers.js';

const harbour = library.locations['loc_greybox-harbour']!;
const bakery = library.locations['loc_greybox-bakery']!;
const clone = (l: LocationAsset): LocationAsset => JSON.parse(JSON.stringify(l)) as LocationAsset;
const root = new URL('../../../', import.meta.url);

describe('greybox test locations (Asset Spec §8.1)', () => {
  it('there are at least two, with spawns, exits and areas', () => {
    expect(Object.keys(library.locations).length).toBeGreaterThanOrEqual(2);
    for (const l of [harbour, bakery]) {
      expect(Object.keys(l.spawns).length).toBeGreaterThan(0);
      expect(Object.keys(l.exits).length).toBeGreaterThan(0);
      expect(Object.keys(l.areas).length).toBeGreaterThan(0);
      expect(validateLocationAsset(l)).toEqual([]);
    }
    expect(harbour.exits['edge_south']).toEqual({ edge: 'down' });
    expect('tiles' in bakery.exits['exit_house_door']!).toBe(true);
  });

  it('every file in assets/locations passes, is named after its id and uses a library track', () => {
    const dir = fileURLToPath(new URL('assets/locations/', root));
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThanOrEqual(2);
    for (const f of files) {
      const data: unknown = JSON.parse(readFileSync(dir + f, 'utf8'));
      expect(validateLocationAsset(data, { fileName: f, music: library.music }), f).toEqual([]);
    }
    expect(harbour.id).toBe('loc_greybox-harbour');
    expect(library.sfx.length).toBeGreaterThan(0);
  });

  it('collision, bounds and areas helpers', () => {
    expect(isBlocked(harbour, [4, 2])).toBe(true);
    expect(isBlocked(harbour, [0, 0])).toBe(false);
    expect(isBlocked(harbour, [99, 0])).toBe(true);
    expect(isBlocked(harbour, [-1, 0])).toBe(true);
    expect(inLocation(harbour, [19, 11])).toBe(true);
    expect(inLocation(harbour, [20, 0])).toBe(false);
    expect(areaContains(harbour.areas['area_plaza']!, [8, 4])).toBe(true);
    expect(areaContains(harbour.areas['area_plaza']!, [14, 4])).toBe(false);
  });

  it('buildLibrary indexes by id', () => {
    const lib = buildLibrary([harbour], { specVersion: '0.1', music: ['mus_a'], sfx: [] });
    expect(lib.locations['loc_greybox-harbour']).toBe(harbour);
    expect(lib.music).toEqual(['mus_a']);
  });
});

// Every rule of the Asset Spec §8.1 field table has a passing case (this block) and a failing
// case (next block), each naming the path and the rule.
describe('§8.1 rules: passing cases', () => {
  it.each<[string, (l: LocationAsset) => void]>([
    ['a spawn on the last tile', (l) => (l.spawns['spawn_start']!.tile = [19, 11])],
    ['a spawn facing up', (l) => (l.spawns['spawn_start']!.facing = 'up')],
    ['an exit on a walkable tile', (l) => (l.exits['exit_house_door'] = { tiles: [[0, 0]] })],
    ['an edge exit to the left', (l) => (l.exits['edge_south'] = { edge: 'left' })],
    ['an area filling the map', (l) => (l.areas['area_plaza']!.rect = [0, 0, 20, 12])],
    ['a 1 × 1 area in the corner', (l) => (l.areas['area_plaza']!.rect = [19, 11, 1, 1])],
    ['no music', (l) => delete l.music],
  ])('%s', (_n, change) => {
    const l = clone(harbour);
    change(l);
    expect(validateLocationAsset(l, { music: library.music })).toEqual([]);
  });

  it('a 1 × 1 map', () => {
    const l: LocationAsset = {
      specVersion: '0.1',
      id: 'loc_tiny',
      size: [1, 1],
      collision: ['.'],
      spawns: { spawn_a: { tile: [0, 0], facing: 'down' } },
      exits: {},
      areas: {},
    };
    expect(validateLocationAsset(l, { fileName: 'loc_tiny.json' })).toEqual([]);
  });

  it('the id matches the file name', () => {
    expect(validateLocationAsset(harbour, { fileName: 'loc_greybox-harbour.json' })).toEqual([]);
  });
});

describe('§8.1 rules: failing cases', () => {
  type Change = (l: Record<string, any>) => void;
  const edit = (change: Change, options = {}): string[] => {
    const l = clone(harbour) as unknown as Record<string, any>;
    change(l);
    return validateLocationAsset(l, options).map((i) => `${i.path} · ${i.message}`);
  };
  const none: Change = () => undefined;
  const ID = 'id · must be "loc_<name>"';
  const SIZE = 'size · must be [width, height]';
  const RECT = 'areas.area_plaza.rect · is not a rectangle inside the location';
  const spawn = (l: Record<string, any>): Record<string, any> => l['spawns']['spawn_start'];
  const area = (l: Record<string, any>): Record<string, any> => l['areas']['area_plaza'];

  it.each<[string, Change, string, object?]>([
    // id
    ['id without loc_', (l) => (l['id'] = 'harbour'), ID],
    ['id upper case', (l) => (l['id'] = 'loc_Harbour'), ID],
    ['id missing', (l) => delete l['id'], ID],
    [
      'id differs from the file name',
      none,
      'id · "loc_greybox-harbour" does not match the file name loc_other.json',
      { fileName: 'loc_other.json' },
    ],
    // size
    ['size not a pair', (l) => (l['size'] = [20]), SIZE],
    ['size not whole numbers', (l) => (l['size'] = [20.5, 12]), SIZE],
    ['size zero', (l) => (l['size'] = [0, 12]), SIZE],
    // collision
    ['too few rows', (l) => l['collision'].pop(), 'collision · has 11 rows but size says 12'],
    [
      'too many rows',
      (l) => l['collision'].push('.'.repeat(20)),
      'collision · has 13 rows but size says 12',
    ],
    [
      'row too short',
      (l) => (l['collision'][0] = '...'),
      'collision[0] · is 3 wide but size says 20',
    ],
    [
      'row too long',
      (l) => (l['collision'][2] = '.'.repeat(21)),
      'collision[2] · is 21 wide but size says 20',
    ],
    [
      'a character other than "." and "#"',
      (l) => (l['collision'][0] = 'x'.repeat(20)),
      'collision[0] · may only contain "." (walkable) and "#" (blocked)',
    ],
    [
      'water is not in v0.1',
      (l) => (l['collision'][0] = '~'.repeat(20)),
      'collision[0] · may only contain "." (walkable) and "#" (blocked)',
    ],
    [
      'collision not strings',
      (l) => (l['collision'] = [1, 2]),
      'collision · must be an array of strings',
    ],
    // spawns
    [
      'spawn without the prefix',
      (l) => (l['spawns']['start'] = spawn(l)),
      'spawns.start · name must start with "spawn_"',
    ],
    [
      'spawn outside (x)',
      (l) => (spawn(l)['tile'] = [20, 1]),
      'spawns.spawn_start.tile · is outside the location',
    ],
    [
      'spawn outside (negative)',
      (l) => (spawn(l)['tile'] = [-1, 1]),
      'spawns.spawn_start.tile · is outside the location',
    ],
    [
      'spawn on a wall',
      (l) => (spawn(l)['tile'] = [4, 2]),
      'spawns.spawn_start.tile · is on a blocked tile',
    ],
    [
      'spawn tile malformed',
      (l) => (spawn(l)['tile'] = 'here'),
      'spawns.spawn_start.tile · must be [x, y]',
    ],
    [
      'spawn facing unknown',
      (l) => (spawn(l)['facing'] = 'north'),
      'spawns.spawn_start.facing · must be one of down, left, right, up',
    ],
    [
      'spawn facing missing',
      (l) => delete spawn(l)['facing'],
      'spawns.spawn_start.facing · must be one of down, left, right, up',
    ],
    // exits
    [
      'exit without exit_ or edge_',
      (l) => (l['exits']['door'] = { tiles: [[5, 5]] }),
      'exits.door · name must start with "exit_ or edge_"',
    ],
    [
      'exit outside',
      (l) => (l['exits']['exit_house_door'] = { tiles: [[50, 50]] }),
      'exits.exit_house_door.tiles[0] · is outside the location',
    ],
    [
      'exit on a blocked tile',
      (l) => (l['exits']['exit_house_door'] = { tiles: [[4, 2]] }),
      'exits.exit_house_door.tiles[0] · is on a blocked tile',
    ],
    [
      'second exit tile blocked',
      (l) =>
        (l['exits']['exit_house_door'] = {
          tiles: [
            [5, 5],
            [4, 2],
          ],
        }),
      'exits.exit_house_door.tiles[1] · is on a blocked tile',
    ],
    [
      'exit without tiles',
      (l) => (l['exits']['exit_house_door'] = { tiles: [] }),
      'exits.exit_house_door.tiles · is empty',
    ],
    [
      'exit_ with an edge instead of tiles',
      (l) => (l['exits']['exit_house_door'] = { edge: 'down' }),
      'exits.exit_house_door.tiles · is empty',
    ],
    [
      'exit_ with both tiles and edge',
      (l) => (l['exits']['exit_house_door'] = { tiles: [[5, 5]], edge: 'down' }),
      'exits.exit_house_door.edge · an exit_ exit has "tiles", not "edge"',
    ],
    [
      'edge with an unknown direction',
      (l) => (l['exits']['edge_south'] = { edge: 'south' }),
      'exits.edge_south.edge · must be one of down, left, right, up',
    ],
    [
      'edge_ with tiles instead of an edge',
      (l) => (l['exits']['edge_south'] = { tiles: [[5, 5]] }),
      'exits.edge_south.edge · must be one of down, left, right, up',
    ],
    [
      'edge_ with both',
      (l) => (l['exits']['edge_south'] = { edge: 'down', tiles: [[5, 5]] }),
      'exits.edge_south.tiles · an edge_ exit has "edge", not "tiles"',
    ],
    // areas
    [
      'area without the prefix',
      (l) => (l['areas']['plaza'] = { rect: [1, 1, 2, 2] }),
      'areas.plaza · name must start with "area_"',
    ],
    ['area outside', (l) => (area(l)['rect'] = [18, 10, 5, 5]), RECT],
    ['area one tile too wide', (l) => (area(l)['rect'] = [19, 0, 2, 1]), RECT],
    ['area one tile too tall', (l) => (area(l)['rect'] = [0, 11, 1, 2]), RECT],
    ['area with a negative origin', (l) => (area(l)['rect'] = [-1, 0, 2, 2]), RECT],
    ['area without width', (l) => (area(l)['rect'] = [1, 1, 0, 2]), RECT],
    ['area with three numbers', (l) => (area(l)['rect'] = [1, 1, 2]), RECT],
    // music
    ['music not a string', (l) => (l['music'] = 5), 'music · must be a track id'],
    [
      'music not in the library',
      (l) => (l['music'] = 'mus_nope'),
      'music · unknown track "mus_nope"',
      { music: library.music },
    ],
  ])('%s', (_n, change, expected, options) => {
    const issues = edit(change, options);
    expect(
      issues.some((i) => i.startsWith(expected)),
      issues.join('\n'),
    ).toBe(true);
  });

  it('a file that is not an object gives one issue, not a crash', () => {
    for (const junk of [null, 5, 'x', []])
      expect(validateLocationAsset(junk)).toEqual([{ path: '', message: 'is not a JSON object' }]);
  });

  it('a file missing every field lists them all instead of crashing', () => {
    const paths = validateLocationAsset({}).map((i) => i.path);
    expect(paths).toEqual(
      expect.arrayContaining(['id', 'size', 'collision', 'spawns', 'exits', 'areas']),
    );
  });
});

describe('Asset Spec §8.1 ↔ validator', () => {
  const md = readFileSync(fileURLToPath(new URL('docs/ASSET_SPEC.md', root)), 'utf8').replace(
    /\r\n/g,
    '\n',
  );
  const start = md.indexOf('\n### 8.1 ');
  const spec = md.slice(start, md.indexOf('\n## ', start + 5));
  const rowOf = (field: string): string =>
    spec.split('\n').find((l) => l.startsWith(`| \`${field}\``))!;

  it('the field table lists exactly the fields the validator knows', () => {
    const rows = spec.split('\n').filter((l) => /^\| `\w+` \|/.test(l));
    expect(rows.map((r) => /`(\w+)`/.exec(r)![1])).toEqual([
      'id',
      'size',
      'collision',
      'spawns',
      'exits',
      'areas',
      'music',
    ]);
  });

  it('collision characters, edge directions and name prefixes are the ones in the table', () => {
    expect(rowOf('collision')).toContain('`.` walkable, `#` blocked');
    expect(rowOf('collision')).toContain('No other characters in v0.1');
    const dirs = /edge: ([a-z |\\]+) \}/.exec(rowOf('exits'))![1]!.split(/\s*\\?\|\s*/);
    expect([...dirs].sort()).toEqual([...DIRECTIONS].sort());
    expect(rowOf('exits')).toContain('(walkable tiles)');
    expect(rowOf('spawns')).toContain('walkable');
    for (const p of ['spawn_<name>', 'exit_<name>', 'edge_<name>', 'area_<name>', 'loc_<name>'])
      expect(spec).toContain(`\`${p}\``);
    expect(rowOf('music')).toContain('Optional');
  });

  it('the spec example has the same top-level fields as the greybox files', () => {
    const json = /```json\n([\s\S]*?)```/.exec(spec)![1]!;
    expect(Object.keys(JSON.parse(json) as object)).toEqual(Object.keys(harbour));
  });
});
