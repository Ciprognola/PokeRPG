import type { Prepared, PreparedFrame, PackageFile } from './assemble.js';
import { makeReport } from './findings.js';
import type { Finding, Report } from './findings.js';
import { parseLayerSheetName } from './naming.js';
import { cropPixels } from './pixels.js';
import { PngError, decodePng } from './png.js';
import { frameRects, getAnimSet } from './registry.js';
import { LAYER_IDS, SPEC_VERSION } from './spec.js';
import { validateCharacter } from './validate.js';
import type { SheetInput } from './validate.js';
import { unzipFiles } from './zip.js';

/**
 * Validate-only mode (PKR-006, docs/ASSET_SPEC.md §6 Output, §7): take sheets that are already on
 * spec, check them and make them reviewable/nudgeable/exportable through the same `Prepared` →
 * `composeCharacter` path as a freshly sliced character. Sheets are never rescaled or re-aligned:
 * the automatic shift is zero and the scale is `null`.
 */

export type ImportInput = SheetInput;

/** Problems that make it impossible to cut a sheet into frames or to identify the character. */
const BLOCKING = new Set([
  'filename',
  'unknown-set',
  'sheet-size',
  'duplicate-layer',
  'missing-required-layer',
  'mixed-sets',
]);

/** File-format findings that re-encoding on export fixes. */
const FIXED_ON_EXPORT = new Set(['png-format', 'srgb', 'file-size']);

export type ImportResult =
  { ok: true; prepared: Prepared; report: Report } | { ok: false; report: Report };

export interface ImportOptions {
  /** Character name (`chr_<name>`). Default: the asset name of the body sheet. */
  characterName?: string;
}

/** Put `added` sheets into `existing`: a sheet replaces the one for the same set and layer. */
export function mergeSheets(
  existing: readonly ImportInput[],
  added: readonly ImportInput[],
): { sheets: ImportInput[]; replaced: string[] } {
  const keyOf = (s: ImportInput): string => {
    const n = parseLayerSheetName(s.filename);
    return n ? `${n.set}/${n.layer}` : `file/${s.filename}`;
  };
  const replaced: string[] = [];
  const kept = existing.filter((old) => {
    const clash = added.find((a) => keyOf(a) === keyOf(old));
    if (clash) replaced.push(old.filename);
    return !clash;
  });
  return { sheets: [...kept, ...added], replaced };
}

/**
 * Check sheets and, if they can be cut into frames, prepare them for review.
 * When something makes that impossible (bad name, wrong size, no body, …) the result is
 * `ok: false` with exactly those findings.
 */
export function importSheets(
  sheets: readonly ImportInput[],
  options: ImportOptions = {},
): ImportResult {
  const full = validateCharacter(sheets);
  const blocking: Finding[] = full.findings.filter((f) => BLOCKING.has(f.check));
  const parsed = sheets.map((s) => ({ s, name: parseLayerSheetName(s.filename) }));
  const setIds = new Set(parsed.flatMap((p) => (p.name ? [p.name.set] : [])));
  if (setIds.size > 1) {
    blocking.push({
      severity: 'error',
      check: 'mixed-sets',
      message: `sheets from several animation sets (${[...setIds].sort().join(', ')}); load one set at a time`,
    });
  }
  if (blocking.length > 0 || setIds.size === 0) {
    return { ok: false, report: makeReport(SPEC_VERSION, blocking, full.sheets) };
  }

  const setId = [...setIds][0]!;
  const set = getAnimSet(setId)!;
  const rects = frameRects(set);
  const layers = parsed
    .filter((p): p is { s: ImportInput; name: NonNullable<typeof p.name> } => p.name !== undefined)
    .sort((a, b) => LAYER_IDS.indexOf(a.name.layer) - LAYER_IDS.indexOf(b.name.layer))
    .map(({ s, name }) => ({
      layer: name.layer,
      name: name.name,
      ...(name.variant !== undefined ? { variant: name.variant } : {}),
      frames: rects.map((r): PreparedFrame => ({ key: r.key, canvas: cropPixels(s.image, r) })),
    }));
  const body = layers.find((l) => l.layer === 'body')!;
  const notes = full.findings
    .filter((f) => FIXED_ON_EXPORT.has(f.check))
    .map(
      (f) => `${f.file ?? 'a sheet'}: ${f.message} — it is re-saved as a clean PNG-32 on export`,
    );
  const shift: Prepared['shift'] = {};
  for (const r of rects) shift[r.key] = { dx: 0, dy: 0 };
  return {
    ok: true,
    prepared: {
      characterName: options.characterName ?? body.name,
      setId,
      scale: null,
      layers,
      shift,
      notes,
    },
    report: full,
  };
}

// ---------------------------------------------------------------------------------------------
// Reading files
// ---------------------------------------------------------------------------------------------

/** Decode a PNG file losslessly. Throws `PngError` for formats core cannot read. */
export function readSheetPng(filename: string, bytes: Uint8Array): ImportInput {
  return { filename, image: decodePng(bytes), bytes };
}

export interface PackageRead {
  /** Character name from the `chr_<name>/` folder or `character.json`, when found. */
  name?: string;
  sheets: ImportInput[];
  /** Files in the zip that are not sheets (atlases, character.json, report.json: regenerated). */
  ignored: string[];
  /** Sheets that could not be read, and other problems, in plain words. */
  errors: string[];
}

const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

/** Read a `chr_<name>/` zip (or a zip of loose sheets). */
export function readPackageZip(bytes: Uint8Array): PackageRead {
  let files: PackageFile[];
  try {
    files = unzipFiles(bytes);
  } catch {
    return { sheets: [], ignored: [], errors: ['This is not a valid zip file.'] };
  }
  const roots = new Set(
    files.flatMap((f) => (f.path.includes('/') ? [f.path.slice(0, f.path.indexOf('/'))] : [])),
  );
  const chrRoots = [...roots].filter((r) => /^chr_/.test(r));
  const errors: string[] = [];
  if (chrRoots.length > 1) {
    errors.push(
      `The zip holds more than one character (${chrRoots.join(', ')}). Load one at a time.`,
    );
  }
  let name = chrRoots.length === 1 ? chrRoots[0]!.slice('chr_'.length) : undefined;
  const sheets: ImportInput[] = [];
  const ignored: string[] = [];
  for (const f of files) {
    const base = baseName(f.path);
    if (base.startsWith('.') || base === '') continue;
    if (base === 'character.json' && name === undefined) {
      try {
        const id = (JSON.parse(new TextDecoder().decode(f.data)) as { id?: unknown }).id;
        if (typeof id === 'string' && id.startsWith('chr_')) name = id.slice('chr_'.length);
      } catch {
        /* ignore: it is regenerated anyway */
      }
    }
    if (!base.toLowerCase().endsWith('.png')) {
      ignored.push(base);
      continue;
    }
    try {
      sheets.push(readSheetPng(base, f.data));
    } catch (e) {
      const why = e instanceof PngError ? e.message : 'unreadable';
      errors.push(`${base}: ${why}. Extract it and load the file directly.`);
    }
  }
  return { ...(name !== undefined ? { name } : {}), sheets, ignored, errors };
}
