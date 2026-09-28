import { describe, expect, it } from 'vitest';
import { layerSheetName, parseLayerSheetName } from '../src/index.js';

describe('layer sheet names (Asset Spec §4)', () => {
  it('parses the spec examples', () => {
    expect(parseLayerSheetName('spr_walk_hair_braid-long.png')).toEqual({
      set: 'walk',
      layer: 'hair',
      name: 'braid-long',
    });
    expect(parseLayerSheetName('spr_walk_body_mira.png')).toEqual({
      set: 'walk',
      layer: 'body',
      name: 'mira',
    });
  });

  it('handles hyphenated layer ids and variants', () => {
    expect(parseLayerSheetName('spr_walk_hair-back_braid_dark.png')).toEqual({
      set: 'walk',
      layer: 'hair-back',
      name: 'braid',
      variant: 'dark',
    });
  });

  it.each([
    'walk_body_mira.png',
    'spr_walk_body.png',
    'spr_walk_body_mira.jpg',
    'spr_walk_shoes_mira.png',
    'spr_walk_body_Mira.png',
    'spr_walk_body_mi ra.png',
    'spr_walk_body_mira_a_b.png',
    'spr_walk_body__mira.png',
  ])('rejects %s', (name) => {
    expect(parseLayerSheetName(name)).toBeUndefined();
  });

  it('round-trips', () => {
    const name = 'spr_walk_hair-back_braid_dark.png';
    const parsed = parseLayerSheetName(name);
    expect(parsed && layerSheetName(parsed)).toBe(name);
  });
});
