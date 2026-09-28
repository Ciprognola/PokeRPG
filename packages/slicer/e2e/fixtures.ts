import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  composeCharacter,
  decodePng,
  encodePng,
  extractFrames,
  frameRects,
  getAnimSet,
  measureBodyFrame,
  packageFiles,
  prepareCharacter,
  unzipFiles,
  validateCharacter,
  zipFiles,
} from '@pokerpg/core';
import type { PackageFile, PixelBuffer, Report } from '@pokerpg/core';
import { makeRawFrames, makeRawGrid, makeWalkSheet } from '@pokerpg/core/testing';
import type { RawOptions } from '@pokerpg/core/testing';

const CELL: RawOptions = { cellWidth: 160, cellHeight: 200, background: [0, 177, 64] };

export interface FixtureFiles {
  dir: string;
  bodyGrid: string;
  outfitGrid: string;
  /** 24 separate hair frames, numbered (natural sort gives spec order). */
  hairFrames: string[];
  notes: string;
}

/** Write synthetic raw-AI-style images to a temp dir (real sprites don't exist until M2). */
export function writeFixtures(): FixtureFiles {
  const dir = mkdtempSync(join(tmpdir(), 'pokerpg-e2e-'));
  const bodyGrid = join(dir, 'body-grid.png');
  const outfitGrid = join(dir, 'outfit-grid.png');
  writeFileSync(bodyGrid, encodePng(makeRawGrid({ ...CELL, layer: 'body' })));
  writeFileSync(outfitGrid, encodePng(makeRawGrid({ ...CELL, layer: 'outfit' })));
  const framesDir = join(dir, 'hair');
  mkdirSync(framesDir);
  const hairFrames = makeRawFrames({ ...CELL, layer: 'hair' }).map((f, i) => {
    const p = join(framesDir, `f${String(i + 1).padStart(2, '0')}.png`);
    writeFileSync(p, encodePng(f));
    return p;
  });
  const notes = join(dir, 'notes.txt');
  writeFileSync(notes, 'not an image');
  return { dir, bodyGrid, outfitGrid, hairFrames, notes };
}

export interface ReadPackage {
  files: PackageFile[];
  paths: string[];
  sheets: Map<string, PixelBuffer>;
  /** Validation of the decoded sheets, done independently of the app. */
  report: Report;
  reportJson: Report;
  characterJson: { id: string; layers: Record<string, Record<string, string>> };
}

/** Open an exported zip and validate its sheets from scratch with the shared validators. */
export function readPackage(zip: Uint8Array): ReadPackage {
  const files = unzipFiles(zip);
  const sheets = new Map<string, PixelBuffer>();
  const inputs = files
    .filter((f) => f.path.endsWith('.png'))
    .map((f) => {
      const image = decodePng(f.data);
      const name = f.path.split('/').pop()!;
      sheets.set(name, image);
      return { filename: name, image, bytes: f.data };
    });
  const text = (suffix: string): unknown =>
    JSON.parse(new TextDecoder().decode(files.find((f) => f.path.endsWith(suffix))!.data));
  return {
    files,
    paths: files.map((f) => f.path),
    sheets,
    report: validateCharacter(inputs),
    reportJson: text('report.json') as Report,
    characterJson: text('character.json') as ReadPackage['characterJson'],
  };
}

/** Lowest opaque row of a body frame in a decoded sheet. */
export function lowestRow(sheet: PixelBuffer, frameKey: string): number {
  const walk = getAnimSet('walk')!;
  const rect = frameRects(walk).find((r) => r.key === frameKey)!;
  return measureBodyFrame(sheet, rect).bottomRow;
}

export interface CheckFixtures {
  dir: string;
  /** chr_mira zip exactly as the slicer exports it (body + hair). */
  zip: string;
  zipBytes: Uint8Array;
  /** An outfit sheet whose feet sit 3 rows too low. */
  misalignedOutfit: string;
  /** A valid-size sheet with a name that is not a section 4 name. */
  badName: string;
  /** A valid outfit sheet with no body next to it. */
  outfitOnly: string;
}

/** Sheets for validate-only mode: a real slicer export, plus loose sheets to add or break it. */
export function writeCheckFixtures(): CheckFixtures {
  const dir = mkdtempSync(join(tmpdir(), 'pokerpg-check-'));
  const layers = (['body', 'hair'] as const).map((layer) => ({
    layer,
    name: 'mira',
    frames: extractFrames(makeRawFrames({ ...CELL, layer }), { allowEmpty: layer !== 'body' }),
  }));
  const zipBytes = zipFiles(
    packageFiles(composeCharacter(prepareCharacter({ name: 'mira', layers }))),
  );
  const zip = join(dir, 'chr_mira.zip');
  writeFileSync(zip, zipBytes);
  const misalignedOutfit = join(dir, 'spr_walk_outfit_mira.png');
  writeFileSync(misalignedOutfit, encodePng(makeWalkSheet('outfit', { dy: 3 })));
  mkdirSync(join(dir, 'outfit-only'));
  const outfitOnly = join(dir, 'outfit-only', 'spr_walk_outfit_mira.png');
  writeFileSync(outfitOnly, encodePng(makeWalkSheet('outfit')));
  const body = unzipFiles(zipBytes).find((f) => f.path.endsWith('spr_walk_body_mira.png'))!;
  const badName = join(dir, 'IMG_1234.png');
  writeFileSync(badName, body.data);
  return { dir, zip, zipBytes, misalignedOutfit, badName, outfitOnly };
}
