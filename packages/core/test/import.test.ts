import { describe, expect, it } from 'vitest';
import {
  composeCharacter,
  extractFrames,
  frameRects,
  getAnimSet,
  importSheets,
  makeReport,
  mergeSheets,
  packageFiles,
  pixelsEqual,
  prepareCharacter,
  readPackageZip,
  unzipFiles,
  zipFiles,
} from '../src/index.js';
import type { ImportInput, LayerId, LayerNudges, Nudges } from '../src/index.js';
import { makeRawFrames, makeWalkSheetInput } from '../src/testing/index.js';
import type { RawOptions } from '../src/testing/index.js';

const keys = frameRects(getAnimSet('walk')!).map((r) => r.key);

/** A character exported by the slicer pipeline (PKR-005's output), as zip bytes. */
function exportedZip(nudges: Nudges = {}): Uint8Array {
  const o: RawOptions = { cellWidth: 180, cellHeight: 230, background: [255, 255, 255], seed: 3 };
  const layers = (['body', 'outfit', 'hair'] as LayerId[]).map((layer) => ({
    layer,
    name: 'mira',
    frames: extractFrames(makeRawFrames({ ...o, layer }), { allowEmpty: layer !== 'body' }),
  }));
  const prepared = prepareCharacter({ name: 'mira', layers });
  return zipFiles(packageFiles(composeCharacter(prepared, nudges)));
}

function reexport(zip: Uint8Array): {
  zip: Uint8Array;
  report: ReturnType<typeof composeCharacter>['report'];
} {
  const read = readPackageZip(zip);
  expect(read.errors).toEqual([]);
  const result = importSheets(read.sheets, read.name ? { characterName: read.name } : {});
  if (!result.ok) throw new Error('import blocked');
  const composed = composeCharacter(result.prepared);
  return { zip: zipFiles(packageFiles(composed)), report: composed.report };
}

describe('re-importing an export', () => {
  it('gives zero findings and a byte-identical re-export', () => {
    const original = exportedZip();
    const again = reexport(original);
    expect(again.report.findings).toEqual([]);
    expect(again.zip).toEqual(original);
  });

  it('keeps existing warnings (no new ones) and stays byte-identical', () => {
    const original = exportedZip({ walk_left_02: { dx: 0, dy: 1 } });
    const originalReport = JSON.parse(
      new TextDecoder().decode(
        unzipFiles(original).find((f) => f.path.endsWith('report.json'))!.data,
      ),
    ) as { findings: unknown[] };
    expect(originalReport.findings.length).toBeGreaterThan(0);
    const again = reexport(original);
    expect(again.report.findings).toEqual(originalReport.findings);
    expect(again.zip).toEqual(original);
  });

  it('reads the character name from the chr_ folder and lists what it ignores', () => {
    const read = readPackageZip(exportedZip());
    expect(read.name).toBe('mira');
    expect(read.sheets.map((s) => s.filename)).toEqual([
      'spr_walk_body_mira.png',
      'spr_walk_hair_mira.png',
      'spr_walk_outfit_mira.png',
    ]);
    expect(read.ignored).toContain('character.json');
    expect(read.ignored).toContain('report.json');
  });
});

describe('on-spec sheets are never rescaled', () => {
  it('imports pixels exactly and reports no scale', () => {
    const sheets = [makeWalkSheetInput('body'), makeWalkSheetInput('outfit')];
    const result = importSheets(sheets);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.prepared.scale).toBeNull();
    expect(Object.values(result.prepared.shift).every((s) => s.dx === 0 && s.dy === 0)).toBe(true);
    const composed = composeCharacter(result.prepared, {}, { encode: false });
    sheets.forEach((s, i) => {
      const out = composed.sheets.find((x) => x.filename === s.filename)!;
      expect(pixelsEqual(out.image, s.image), `sheet ${i}`).toBe(true);
    });
  });

  it('takes the character name from the body sheet unless told otherwise', () => {
    const sheets = [makeWalkSheetInput('body', 'rowan')];
    const a = importSheets(sheets);
    const b = importSheets(sheets, { characterName: 'rowan-the-bold' });
    expect(a.ok && a.prepared.characterName).toBe('rowan');
    expect(b.ok && b.prepared.characterName).toBe('rowan-the-bold');
  });
});

describe('adding a layer to an existing character', () => {
  const body = makeWalkSheetInput('body');
  const misaligned = makeWalkSheetInput('outfit', 'mira', { dy: 3 }); // feet 3 rows below the body's

  it('shows the new layer’s findings against the character', () => {
    const result = importSheets([body, misaligned]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const composed = composeCharacter(result.prepared, {}, { encode: false });
    const findings = composed.report.findings;
    expect(findings.length).toBeGreaterThan(0);
    expect(new Set(findings.map((f) => f.file))).toEqual(new Set(['spr_walk_outfit_mira.png']));
    expect(findings.every((f) => f.check === 'safe-box')).toBe(true);
  });

  it('is fixed by nudging that layer only', () => {
    const result = importSheets([body, misaligned]);
    if (!result.ok) throw new Error('blocked');
    const layerNudges: Record<string, { dx: number; dy: number }> = {};
    for (const k of keys) layerNudges[`outfit/${k}`] = { dx: 0, dy: -3 };
    const fixed = composeCharacter(
      result.prepared,
      {},
      { encode: true, layerNudges: layerNudges as LayerNudges },
    );
    expect(fixed.report.findings).toEqual([]);
    // the body did not move
    const bodyOut = fixed.sheets.find((s) => s.layer === 'body')!;
    expect(pixelsEqual(bodyOut.image, body.image)).toBe(true);
  });

  it('is NOT fixed by an all-layer nudge (that moves the body too)', () => {
    const result = importSheets([body, misaligned]);
    if (!result.ok) throw new Error('blocked');
    const nudges: Record<string, { dx: number; dy: number }> = {};
    for (const k of keys) nudges[k] = { dx: 0, dy: -3 };
    const composed = composeCharacter(result.prepared, nudges as Nudges, { encode: false });
    expect(composed.report.findings.some((f) => f.file === 'spr_walk_body_mira.png')).toBe(true);
  });

  it('replaces an existing layer when a new sheet for it is added', () => {
    const other = { ...misaligned, filename: 'spr_walk_outfit_other.png' };
    const { sheets, replaced } = mergeSheets([body, misaligned], [other]);
    expect(replaced).toEqual(['spr_walk_outfit_mira.png']);
    expect(sheets.map((s) => s.filename)).toEqual([
      'spr_walk_body_mira.png',
      'spr_walk_outfit_other.png',
    ]);
  });

  it('a layer-only nudge moves just that layer of that frame', () => {
    const result = importSheets([body, makeWalkSheetInput('outfit')]);
    if (!result.ok) throw new Error('blocked');
    const base = composeCharacter(result.prepared, {}, { encode: false });
    const moved = composeCharacter(
      result.prepared,
      {},
      { encode: false, layerNudges: { 'outfit/walk_up_04': { dx: 0, dy: -1 } } },
    );
    expect(pixelsEqual(moved.sheets[0]!.image, base.sheets[0]!.image)).toBe(true); // body
    expect(pixelsEqual(moved.sheets[1]!.image, base.sheets[1]!.image)).toBe(false); // outfit
  });
});

describe('what cannot be imported', () => {
  const body = makeWalkSheetInput('body');
  const blocked = (sheets: ImportInput[]) => {
    const r = importSheets(sheets);
    expect(r.ok).toBe(false);
    return r.report.findings.map((f) => f.check);
  };

  it('needs a body', () =>
    expect(blocked([makeWalkSheetInput('outfit')])).toEqual(['missing-required-layer']));
  it('rejects names outside §4', () =>
    expect(blocked([{ ...body, filename: 'Body 1.png' }])).toContain('filename'));
  it('rejects a sheet that is not 768 × 512', () => {
    const wrong = {
      ...body,
      image: { width: 800, height: 512, data: new Uint8ClampedArray(800 * 512 * 4) },
    };
    expect(blocked([wrong])).toEqual(['sheet-size']);
  });
  it('rejects an unknown animation set', () =>
    expect(blocked([{ ...body, filename: 'spr_run_body_mira.png' }])).toContain('unknown-set'));
  it('rejects two sheets for one layer', () =>
    expect(blocked([body, { ...body, filename: 'spr_walk_body_other.png' }])).toContain(
      'duplicate-layer',
    ));
  it('rejects an empty selection', () => expect(importSheets([]).ok).toBe(false));

  it('turns file-format findings into notes instead of blocking', () => {
    const notPng = { ...body, bytes: Uint8Array.of(1, 2, 3) };
    const r = importSheets([notPng]);
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(r.prepared.notes[0]).toContain("risalvato come PNG-32 pulito all'esportazione");
  });
});

describe('reading zips', () => {
  it('rejects a corrupt zip and more than one character', () => {
    expect(readPackageZip(Uint8Array.of(1, 2, 3)).errors).toEqual([
      'Questo non è un file zip valido.',
    ]);
    const two = zipFiles([
      { path: 'chr_a/x.txt', data: Uint8Array.of(1) },
      { path: 'chr_b/x.txt', data: Uint8Array.of(1) },
    ]);
    expect(readPackageZip(two).errors[0]).toContain('più di un personaggio');
  });

  it('names a sheet it cannot decode', () => {
    const zip = zipFiles([{ path: 'chr_a/spr_walk_body_a.png', data: Uint8Array.of(1, 2, 3) }]);
    const read = readPackageZip(zip);
    expect(read.sheets).toEqual([]);
    expect(read.errors[0]).toContain('spr_walk_body_a.png');
  });

  it('falls back to character.json for the name', () => {
    const zip = zipFiles([
      { path: 'character.json', data: new TextEncoder().encode('{"id":"chr_zed"}') },
    ]);
    expect(readPackageZip(zip).name).toBe('zed');
  });

  it('makeReport is exported for the blocked view', () => {
    expect(makeReport('0.1', []).ok).toBe(true);
  });
});
