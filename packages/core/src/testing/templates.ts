import { createPixelBuffer } from '../pixels.js';
import type { PixelBuffer } from '../pixels.js';
import { encodePng } from '../png.js';
import { frameRects, getAnimSet } from '../registry.js';
import type { PackageFile } from '../assemble.js';
import { zipFiles } from '../zip.js';
import { makeRawFrame } from './synthetic.js';
import type { Rgb } from './synthetic.js';

/**
 * Pose templates (PKR-007, docs/SPRITE_REFERENCE.md §4–5): grey-mannequin references that show an
 * image AI which 24 walk poses to draw. Built from the synthetic walk fixtures, so they are always
 * exactly the geometry the Slicer is tested with, and generated deterministically (`npm run
 * templates` writes the zip the Slicer serves).
 *
 * The grid is 4:3 and 2400 px wide: 6 × 4 equal cells of 400 × 450, in spec order, no lines or
 * labels. The single poses are one cell each, named by frame key.
 */

export const POSE_TEMPLATE = {
  cellWidth: 400,
  cellHeight: 450,
  columns: 6,
  rows: 4,
  /** Flat key colour (Asset Spec §6). */
  background: [255, 0, 255] as Rgb,
} as const;

const FOLDER = 'pose-templates';
export const POSE_TEMPLATE_ZIP_NAME = 'pokerpg-pose-templates.zip';

const README = `PokeRPG pose templates
======================

Grey-mannequin references that show an image AI the 24 walk poses of a character.
Full instructions: docs/SPRITE_REFERENCE.md in the repository, sections 4 and 5.

grid-template.png     One image, 4:3 (2400 x 1800), 6 columns x 4 rows, no lines or labels.
                      Rows: toward you, walking left, walking right, walking away.
                      Columns: contact, down, passing, contact, down, passing.
                      Use it as the composition reference for a one-image sprite sheet.

single/               The same 24 poses as separate images, named walk_down_00.png ...
                      walk_up_05.png. Use them for the frame-by-frame fallback and keep
                      the file names: the Slicer orders frames by them.

The background is flat magenta (#FF00FF). Keep magenta and hot pink out of your character.
`;

/** One pose, as a single-cell image. */
export function poseFrame(row: number, col: number): PixelBuffer {
  const walk = getAnimSet('walk')!;
  const dir = walk.rows[row]!;
  return makeRawFrame(dir, col, row * walk.framesPerRow + col, {
    cellWidth: POSE_TEMPLATE.cellWidth,
    cellHeight: POSE_TEMPLATE.cellHeight,
    background: POSE_TEMPLATE.background,
    figure: { mannequin: true },
    jitter: 0, // every figure stands at the same place in its cell, so feet line up across a row
  });
}

/** The 24 poses in one image. */
export function poseGrid(): PixelBuffer {
  const { cellWidth: cw, cellHeight: ch, columns, rows } = POSE_TEMPLATE;
  const grid = createPixelBuffer(cw * columns, ch * rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const cell = poseFrame(row, col);
      for (let y = 0; y < ch; y++) {
        const src = y * cw * 4;
        grid.data.set(
          cell.data.subarray(src, src + cw * 4),
          ((row * ch + y) * grid.width + col * cw) * 4,
        );
      }
    }
  }
  return grid;
}

/** Every file of the download, in package form. */
export function poseTemplateFiles(): PackageFile[] {
  const walk = getAnimSet('walk')!;
  const files: PackageFile[] = [
    { path: `${FOLDER}/README.txt`, data: new TextEncoder().encode(README) },
    { path: `${FOLDER}/grid-template.png`, data: encodePng(poseGrid()) },
  ];
  for (const r of frameRects(walk)) {
    const row = walk.rows.indexOf(r.row);
    files.push({ path: `${FOLDER}/single/${r.key}.png`, data: encodePng(poseFrame(row, r.col)) });
  }
  return files;
}

/** The download: one deterministic zip. */
export function poseTemplateZip(): Uint8Array {
  return zipFiles(poseTemplateFiles());
}
