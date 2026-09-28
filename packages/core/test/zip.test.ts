import { describe, expect, it } from 'vitest';
import { unzipFiles, zipFiles } from '../src/index.js';

const files = [
  { path: 'chr_mira/b.json', data: new TextEncoder().encode('{"b":1}') },
  { path: 'chr_mira/a.png', data: Uint8Array.from({ length: 300 }, (_, i) => i % 251) },
];

describe('zip', () => {
  it('round-trips files', () => {
    const back = unzipFiles(zipFiles(files));
    expect(back.map((f) => f.path)).toEqual(['chr_mira/a.png', 'chr_mira/b.json']);
    expect(back[0]!.data).toEqual(files[1]!.data);
    expect(back[1]!.data).toEqual(files[0]!.data);
  });

  it('is deterministic and independent of input order', () => {
    expect(zipFiles(files)).toEqual(zipFiles([...files].reverse()));
    expect(zipFiles(files)).toEqual(zipFiles(files));
  });

  it('rejects a corrupt archive', () => {
    expect(() => unzipFiles(Uint8Array.of(1, 2, 3, 4))).toThrow();
  });
});
