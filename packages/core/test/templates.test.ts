import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  composeCharacter,
  decodePng,
  extractFrames,
  extractGrid,
  frameRects,
  formatFinding,
  getAnimSet,
  orderFrameFiles,
  packageFiles,
  prepareCharacter,
  unzipFiles,
} from '../src/index.js';
import type { PixelBuffer } from '../src/index.js';
import {
  MANNEQUIN,
  POSE_TEMPLATE,
  POSE_TEMPLATE_ZIP_NAME,
  poseTemplateFiles,
  poseTemplateZip,
} from '../src/testing/index.js';

const files = poseTemplateFiles();
const byPath = new Map(files.map((f) => [f.path, f.data]));
const keys = frameRects(getAnimSet('walk')!).map((r) => r.key);
const grid = decodePng(byPath.get('pose-templates/grid-template.png')!);
const singles = keys.map((k) => decodePng(byPath.get(`pose-templates/single/${k}.png`)!));

const px = (b: PixelBuffer, x: number, y: number): [number, number, number, number] => {
  const i = (y * b.width + x) * 4;
  return [b.data[i]!, b.data[i + 1]!, b.data[i + 2]!, b.data[i + 3]!];
};
const isMagenta = (p: number[]): boolean =>
  p[0] === 255 && p[1] === 0 && p[2] === 255 && p[3] === 255;

describe('the pose template files', () => {
  it('has a README, the grid and the 24 single poses named by frame key', () => {
    expect(files.map((f) => f.path)).toEqual([
      'pose-templates/README.txt',
      'pose-templates/grid-template.png',
      ...keys.map((k) => `pose-templates/single/${k}.png`),
    ]);
    expect(keys[0]).toBe('walk_down_00');
    expect(keys[23]).toBe('walk_up_05');
  });

  it('grid is 4:3, at least 2048 px wide, 6 × 4 equal cells', () => {
    expect(grid.width).toBeGreaterThanOrEqual(2048);
    expect(grid.width * 3).toBe(grid.height * 4);
    expect(grid.width % 6).toBe(0);
    expect(grid.height % 4).toBe(0);
    expect(grid.width / 6).toBe(POSE_TEMPLATE.cellWidth);
    expect(grid.height / 4).toBe(POSE_TEMPLATE.cellHeight);
  });

  it('each single pose is exactly one grid cell', () => {
    for (const [i, s] of singles.entries()) {
      expect([s.width, s.height], keys[i]).toEqual([
        POSE_TEMPLATE.cellWidth,
        POSE_TEMPLATE.cellHeight,
      ]);
      const col = i % 6;
      const row = Math.floor(i / 6);
      const x0 = col * s.width;
      const y0 = row * s.height;
      for (const [x, y] of [
        [0, 0],
        [200, 225],
        [150, 100],
        [250, 300],
        [399, 449],
      ] as const) {
        expect(px(grid, x0 + x, y0 + y), `${keys[i]} @${x},${y}`).toEqual(px(s, x, y));
      }
    }
  });

  it('is magenta #FF00FF with nothing near the cell edges: no grid lines, no labels', () => {
    for (const b of [grid, ...singles]) {
      for (const [x, y] of [
        [0, 0],
        [b.width - 1, 0],
        [0, b.height - 1],
        [b.width - 1, b.height - 1],
      ] as const) {
        expect(isMagenta(px(b, x, y))).toBe(true);
      }
    }
    const cw = POSE_TEMPLATE.cellWidth;
    const ch = POSE_TEMPLATE.cellHeight;
    const margin = 12;
    for (let i = 0; i < 24; i++) {
      const x0 = (i % 6) * cw;
      const y0 = Math.floor(i / 6) * ch;
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          if (x >= margin && x < cw - margin && y >= margin && y < ch - margin) continue;
          if (!isMagenta(px(grid, x0 + x, y0 + y)))
            throw new Error(`cell ${i}: content at ${x},${y}`);
        }
      }
    }
  });

  it('draws only neutral grey on the magenta (edges blend the two)', () => {
    let grey = 0;
    for (const b of [grid]) {
      for (let i = 0; i < b.data.length; i += 4) {
        const [r, g, bl] = [b.data[i]!, b.data[i + 1]!, b.data[i + 2]!];
        const neutral = Math.abs(r - g) <= 10 && Math.abs(bl - g) <= 10;
        const magentaBlend = Math.abs(r - bl) <= 10 && g <= r;
        if (!neutral && !magentaBlend) throw new Error(`coloured pixel ${r},${g},${bl}`);
        if (neutral) grey++;
      }
    }
    expect(grey).toBeGreaterThan(24 * 8000); // there really is a figure in every cell
  });

  it('is deterministic, and the zip lists the same files', () => {
    expect(poseTemplateZip()).toEqual(poseTemplateZip());
    expect(
      unzipFiles(poseTemplateZip())
        .map((f) => f.path)
        .sort(),
    ).toEqual(files.map((f) => f.path).sort());
  });

  it('the committed download matches the generator (run `npm run templates` if this fails)', () => {
    const committed = readFileSync(
      fileURLToPath(
        new URL(`../../slicer/public/downloads/${POSE_TEMPLATE_ZIP_NAME}`, import.meta.url),
      ),
    );
    expect(Buffer.compare(committed, Buffer.from(poseTemplateZip()))).toBe(0);
  });
});

describe('facing direction is readable in every row', () => {
  const DARK = MANNEQUIN.dark;
  /** Centroid x offset (from the cell centre) of the dark face marks in the head zone, and their count. */
  function faceMarks(i: number): { offset: number; count: number } {
    const cw = POSE_TEMPLATE.cellWidth;
    const ch = POSE_TEMPLATE.cellHeight;
    const x0 = (i % 6) * cw;
    const y0 = Math.floor(i / 6) * ch;
    let top = -1;
    for (let y = 0; y < ch && top < 0; y++) {
      for (let x = 0; x < cw; x++)
        if (px(grid, x0 + x, y0 + y)[1] >= 140) {
          top = y;
          break;
        }
    }
    let sum = 0;
    let count = 0;
    for (let y = top; y < top + 70; y++) {
      for (let x = 0; x < cw; x++) {
        const p = px(grid, x0 + x, y0 + y);
        if (p[0] === DARK[0] && p[1] === DARK[1] && p[2] === DARK[2]) {
          sum += x - cw / 2;
          count++;
        }
      }
    }
    return { offset: count ? sum / count : 0, count };
  }

  it('down: a centred face; left / right: the face sits on that side; up: no face at all', () => {
    for (let col = 0; col < 6; col++) {
      expect(Math.abs(faceMarks(col).offset), `down ${col}`).toBeLessThan(6);
      expect(faceMarks(col).count).toBeGreaterThan(200);
      expect(faceMarks(6 + col).offset, `left ${col}`).toBeLessThan(-15);
      expect(faceMarks(12 + col).offset, `right ${col}`).toBeGreaterThan(15);
      expect(faceMarks(18 + col).count, `up ${col}`).toBe(0);
    }
  });

  it('every pose in the cycle is drawn differently', () => {
    const seen = new Set<string>();
    for (const s of singles) seen.add(Buffer.from(s.data).toString('base64'));
    expect(seen.size).toBe(24);
    // and within a walking row the legs really move: contact and passing frames differ a lot
    for (const row of [1, 2]) {
      const a = singles[row * 6]!;
      const b = singles[row * 6 + 2]!;
      let diff = 0;
      for (let i = 0; i < a.data.length; i += 4) if (a.data[i + 1] !== b.data[i + 1]) diff++;
      expect(diff, `row ${row}`).toBeGreaterThan(3000);
    }
  });
});

describe('slicing the templates in the Slicer pipeline', () => {
  const build = (frames: ReturnType<typeof extractGrid>) =>
    composeCharacter(
      prepareCharacter({
        name: 'mannequin',
        layers: [{ layer: 'body', name: 'mannequin', frames }],
      }),
    );

  const fromGrid = build(extractGrid(grid));

  it('the grid template gives zero errors', () => {
    expect(fromGrid.report.findings.map(formatFinding)).toEqual([]); // no warnings either
    expect(fromGrid.report.summary.errors).toBe(0);
    expect(fromGrid.report.ok).toBe(true);
  });

  it('the 24 single templates give the same result (any file order)', () => {
    const names = keys.map((k) => `${k}.png`);
    const shuffled = names
      .map((n, i) => ({ n, i, r: Math.sin(i * 12.9898) }))
      .sort((a, b) => a.r - b.r);
    const order = orderFrameFiles(shuffled.map((s) => s.n));
    const ordered = order.map((k) => singles[shuffled[k]!.i]!);
    const fromSingles = build(extractFrames(ordered));
    expect(fromSingles.report).toEqual(fromGrid.report);
    const a = packageFiles(fromGrid);
    const b = packageFiles(fromSingles);
    expect(b.map((f) => f.path)).toEqual(a.map((f) => f.path));
    b.forEach((f, i) => expect(f.data).toEqual(a[i]!.data));
  });
});
