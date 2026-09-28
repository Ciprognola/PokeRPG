import { describe, expect, it } from 'vitest';
import {
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

describe('greybox test locations (proposed library location format)', () => {
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

  it('files are named after their id, and the audio registry lists the greybox tracks', () => {
    expect(harbour.id).toBe('loc_greybox-harbour');
    expect(library.music).toContain(harbour.music);
    expect(library.music).toContain(bakery.music);
    expect(library.sfx.length).toBeGreaterThan(0);
  });

  it('collision, bounds and areas helpers', () => {
    expect(isBlocked(harbour, [4, 2])).toBe(true);
    expect(isBlocked(harbour, [0, 0])).toBe(false);
    expect(isBlocked(harbour, [99, 0])).toBe(true);
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

  describe('validateLocationAsset finds inconsistent data', () => {
    it.each<[string, (l: LocationAsset) => void, string]>([
      ['wrong row count', (l) => l.collision.pop(), 'collision · has 11 rows but size says 12'],
      [
        'wrong row width',
        (l) => ((l.collision as string[])[0] = '...'),
        'collision[0] · is 3 wide but size says 20',
      ],
      [
        'bad character',
        (l) => ((l.collision as string[])[0] = 'x'.repeat(20)),
        'collision[0] · may only contain',
      ],
      [
        'spawn outside',
        (l) => (l.spawns['spawn_start']!.tile = [50, 1]),
        'spawns.spawn_start.tile · is outside the location',
      ],
      [
        'spawn on a wall',
        (l) => (l.spawns['spawn_start']!.tile = [4, 2]),
        'spawns.spawn_start.tile · is on a blocked tile',
      ],
      [
        'exit outside',
        (l) => (l.exits['exit_house_door'] = { tiles: [[50, 50]] }),
        'exits.exit_house_door.tiles[0] · is outside the location',
      ],
      [
        'exit without tiles',
        (l) => (l.exits['exit_house_door'] = { tiles: [] }),
        'exits.exit_house_door.tiles · is empty',
      ],
      [
        'area outside',
        (l) => (l.areas['area_plaza']!.rect = [18, 10, 5, 5]),
        'areas.area_plaza.rect · is not a rectangle inside the location',
      ],
      [
        'empty area',
        (l) => (l.areas['area_plaza']!.rect = [1, 1, 0, 2]),
        'areas.area_plaza.rect · is not a rectangle inside the location',
      ],
    ])('%s', (_n, change, expected) => {
      const l = clone(harbour);
      change(l);
      const issues = validateLocationAsset(l).map((i) => `${i.path} · ${i.message}`);
      expect(issues.some((i) => i.startsWith(expected))).toBe(true);
    });
  });
});
