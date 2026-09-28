import { unzipSync, zipSync } from 'fflate';
import type { PackageFile } from './assemble.js';

/**
 * Zip read/write for character packages. Writing is deterministic: entries are sorted by path, the
 * timestamp is fixed (1980-01-01, the earliest zip date) and the compression level is constant, so
 * the same files always give the same bytes.
 */

const FIXED_MTIME = new Date(1980, 0, 1, 0, 0, 0);

export function zipFiles(files: readonly PackageFile[]): Uint8Array {
  const entries: Record<string, [Uint8Array, { level: 6; mtime: Date }]> = {};
  for (const f of [...files].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    entries[f.path] = [f.data, { level: 6, mtime: FIXED_MTIME }];
  }
  return zipSync(entries);
}

/** Read every file of a zip. Directory entries are skipped. Throws on a corrupt archive. */
export function unzipFiles(bytes: Uint8Array): PackageFile[] {
  const entries = unzipSync(bytes);
  return Object.keys(entries)
    .filter((path) => !path.endsWith('/'))
    .sort()
    .map((path) => ({ path, data: entries[path]! }));
}
