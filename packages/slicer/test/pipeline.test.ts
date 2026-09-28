import { describe, expect, it } from 'vitest';
import { PIPELINE } from '../src/pipeline.js';

describe('slicer pipeline', () => {
  it('follows the stage order of Asset Spec §6', () => {
    expect(PIPELINE.map((s) => s.id)).toEqual([
      'remove-background',
      'defringe',
      'scale',
      'align',
      'pack',
      'validate',
      'report',
    ]);
  });
});
