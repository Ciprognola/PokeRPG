import { describe, expect, it } from 'vitest';
import {
  LAYER_IDS,
  REGISTRY,
  encodePng,
  formatFinding,
  pngChunk,
  validateCharacter,
  PNG_SIGNATURE,
} from '../src/index.js';
import type { AnimSetRegistry, Finding, SheetInput } from '../src/index.js';
import { makeWalkSheet, makeWalkSheetInput } from '../src/testing/index.js';
import type { SheetOptions } from '../src/testing/index.js';
import { createPixelBuffer } from '../src/index.js';

const body = (o?: SheetOptions): SheetInput => makeWalkSheetInput('body', 'mira', o);
const byCheck = (findings: Finding[], check: string): Finding[] =>
  findings.filter((f) => f.check === check);
const check = (sheets: SheetInput[], id: string): Finding[] =>
  byCheck(validateCharacter(sheets).findings, id);

describe('a clean character', () => {
  it('has no findings with all seven layers', () => {
    const sheets = LAYER_IDS.map((l) => makeWalkSheetInput(l));
    const report = validateCharacter(sheets);
    expect(report.findings.map(formatFinding)).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.summary).toEqual({ errors: 0, warnings: 0 });
    expect(report.sheets).toHaveLength(7);
  });

  it('is deterministic regardless of input order', () => {
    const sheets = [makeWalkSheetInput('outfit'), body(), makeWalkSheetInput('hair')];
    const a = validateCharacter(sheets);
    const b = validateCharacter([...sheets].reverse());
    expect(a).toEqual(b);
  });
});

describe('png-format / srgb (error)', () => {
  it('passes a PNG-32 RGBA file', () => {
    expect(check([body()], 'png-format')).toEqual([]);
  });

  it('fails a palette PNG', () => {
    const ok = body();
    const ihdr = new Uint8Array(13);
    new DataView(ihdr.buffer).setUint32(0, 768);
    new DataView(ihdr.buffer).setUint32(4, 512);
    ihdr[8] = 8;
    ihdr[9] = 3;
    const bytes = new Uint8Array([
      ...PNG_SIGNATURE,
      ...pngChunk('IHDR', ihdr),
      ...pngChunk('IEND', new Uint8Array(0)),
    ]);
    const [f] = check([{ ...ok, bytes }], 'png-format');
    expect(f).toMatchObject({ severity: 'error', file: 'spr_walk_body_mira.png' });
    expect(f?.message).toContain('colour type 3');
  });

  it('fails bytes that are not a PNG', () => {
    const [f] = check([{ ...body(), bytes: Uint8Array.of(1, 2, 3, 4) }], 'png-format');
    expect(f?.severity).toBe('error');
  });

  function withChunk(type: string, data: Uint8Array): Uint8Array {
    const png = encodePng(makeWalkSheet('body'));
    // insert right after IHDR (8 signature + 25 IHDR bytes)
    return new Uint8Array([...png.subarray(0, 33), ...pngChunk(type, data), ...png.subarray(33)]);
  }

  it('passes a file with an sRGB chunk and fails a non-sRGB ICC profile', () => {
    expect(check([body()], 'srgb')).toEqual([]);
    const icc = Uint8Array.of(...Array.from('AdobeRGB', (c) => c.charCodeAt(0)), 0, 0);
    const [f] = check([{ ...body(), bytes: withChunk('iCCP', icc) }], 'srgb');
    expect(f).toMatchObject({ severity: 'error' });
    expect(f?.message).toContain('AdobeRGB');
    const srgbIcc = Uint8Array.of(...Array.from('sRGB IEC61966', (c) => c.charCodeAt(0)), 0, 0);
    expect(check([{ ...body(), bytes: withChunk('iCCP', srgbIcc) }], 'srgb')).toEqual([]);
  });

  it('fails a non-sRGB gamma without an sRGB chunk', () => {
    const gama = new Uint8Array(4);
    new DataView(gama.buffer).setUint32(0, 100000); // gamma 1.0
    const png = encodePng(makeWalkSheet('body'));
    // drop the sRGB chunk (13 bytes) that encodePng writes, add gAMA
    const stripped = new Uint8Array([...png.subarray(0, 33), ...png.subarray(33 + 13)]);
    const bytes = new Uint8Array([
      ...stripped.subarray(0, 33),
      ...pngChunk('gAMA', gama),
      ...stripped.subarray(33),
    ]);
    expect(check([{ ...body(), bytes }], 'srgb')[0]?.severity).toBe('error');
  });
});

describe('file-size (warning > 1 MB, error > 2 MB)', () => {
  const padded = (extra: number): SheetInput => {
    const s = body();
    const bytes = new Uint8Array(s.bytes!.length + extra);
    bytes.set(s.bytes!);
    return { ...s, bytes };
  };
  it('passes a small file', () => expect(check([body()], 'file-size')).toEqual([]));
  it('warns above 1 MB', () => {
    const [f] = check([padded(1_000_001)], 'file-size');
    expect(f?.severity).toBe('warning');
  });
  it('errors above 2 MB', () => {
    const [f] = check([padded(2_000_001)], 'file-size');
    expect(f?.severity).toBe('error');
  });
});

describe('filename (error)', () => {
  it('passes a §4 name and fails others', () => {
    expect(check([body()], 'filename')).toEqual([]);
    const bad = { ...body(), filename: 'Body Sheet.png' };
    const [f] = check([bad], 'filename');
    expect(f).toMatchObject({ severity: 'error', file: 'Body Sheet.png' });
  });
});

describe('sheet-size and unknown-set (error)', () => {
  it('fails a sheet that is not 768 × 512', () => {
    const s = { ...body(), image: createPixelBuffer(800, 512) };
    const [f] = check([s], 'sheet-size');
    expect(f?.message).toBe('sheet is 800×512 (expected 768×512 for set walk)');
    expect(f?.severity).toBe('error');
  });
  it('does not slice an off-grid sheet', () => {
    const s = { ...body(), image: createPixelBuffer(800, 512) };
    const findings = validateCharacter([s]).findings;
    expect(findings.every((f) => !f.frameKey)).toBe(true);
  });
  it('fails an unknown animation set', () => {
    const s = { ...body(), filename: 'spr_run_body_mira.png' };
    expect(check([s], 'unknown-set')[0]?.severity).toBe('error');
  });
});

describe('character-level rules', () => {
  it('errors when the body sheet is missing (§7) and passes when present', () => {
    const [f] = check([makeWalkSheetInput('outfit')], 'missing-required-layer');
    expect(f).toMatchObject({ severity: 'error', message: 'set walk has no body sheet' });
    expect(f?.file).toBeUndefined();
    expect(check([body(), makeWalkSheetInput('outfit')], 'missing-required-layer')).toEqual([]);
  });

  it('errors on two sheets for the same layer and set (§2.4)', () => {
    const second = { ...body(), filename: 'spr_walk_body_other.png' };
    const [f] = check([body(), second], 'duplicate-layer');
    expect(f).toMatchObject({ severity: 'error', file: 'spr_walk_body_other.png' });
    expect(check([body()], 'duplicate-layer')).toEqual([]);
  });

  it('warns when a layer exists for one set but not another (§3 rule 4)', () => {
    const walk = REGISTRY.sets[0]!;
    const registry: AnimSetRegistry = { ...REGISTRY, sets: [walk, { ...walk, id: 'run' }] };
    const run = (layer: 'body' | 'outfit'): SheetInput => {
      const s = makeWalkSheetInput(layer);
      return { ...s, filename: s.filename.replace('walk', 'run') };
    };
    const full = [body(), makeWalkSheetInput('outfit'), run('body'), run('outfit')];
    expect(
      byCheck(validateCharacter(full, { registry }).findings, 'layer-missing-for-set'),
    ).toEqual([]);
    const partial = [body(), makeWalkSheetInput('outfit'), run('body')];
    const [f] = byCheck(validateCharacter(partial, { registry }).findings, 'layer-missing-for-set');
    expect(f).toMatchObject({ severity: 'warning', message: expect.stringContaining('outfit') });
  });
});

describe('empty-frame and no-opaque-body (error, body only)', () => {
  function blankFrame(s: SheetInput, x: number, y: number, alphaOnly?: number): SheetInput {
    const image = { ...s.image, data: new Uint8ClampedArray(s.image.data) };
    for (let j = 0; j < 128; j++) {
      for (let i = 0; i < 128; i++) {
        const k = ((y + j) * image.width + x + i) * 4;
        if (alphaOnly === undefined) image.data[k + 3] = 0;
        else if (image.data[k + 3] > 0) image.data[k + 3] = alphaOnly;
      }
    }
    return { ...s, image };
  }
  it('fails an empty body frame and names it', () => {
    const [f] = check([blankFrame(body(), 128, 128)], 'empty-frame');
    expect(f).toMatchObject({ severity: 'error', frameKey: 'walk_left_01' });
    expect(check([body()], 'empty-frame')).toEqual([]);
  });
  it('does not require other layers to have content in every frame', () => {
    const hair = blankFrame(makeWalkSheetInput('hair'), 0, 0);
    expect(check([body(), hair], 'empty-frame')).toEqual([]);
  });
  it('fails a body frame with no opaque pixel', () => {
    const [f] = check([blankFrame(body(), 0, 0, 100)], 'no-opaque-body');
    expect(f).toMatchObject({ severity: 'error', frameKey: 'walk_down_00' });
  });
});

describe('border (error, all layers)', () => {
  it('passes a clean sheet', () => expect(check([body()], 'border')).toEqual([]));
  it('fails content, even faint, inside the 4 px border and names the pixel', () => {
    const s = body();
    const image = { ...s.image, data: new Uint8ClampedArray(s.image.data) };
    // frame walk_right_02 = column 2, row 2 → origin (256, 256); pixel (2, 60)
    image.data[((256 + 60) * image.width + 256 + 2) * 4 + 3] = 1;
    const [f] = check([{ ...s, image }], 'border');
    expect(f).toMatchObject({
      severity: 'error',
      frameKey: 'walk_right_02',
      pixel: { x: 2, y: 60 },
    });
    expect(f?.message).toContain('(2, 60)');
  });
  it('applies to non-body layers too', () => {
    const s = makeWalkSheetInput('hair');
    const image = { ...s.image, data: new Uint8ClampedArray(s.image.data) };
    image.data[3] = 255; // pixel (0, 0) of walk_down_00
    expect(check([body(), { ...s, image }], 'border')).toHaveLength(1);
  });
});

describe('ground-line (error > 2 px, warning 1–2 px)', () => {
  it('passes at row 119', () => expect(check([body()], 'ground-line')).toEqual([]));
  it.each([
    [1, 'warning'],
    [2, 'warning'],
    [3, 'error'],
    [-1, 'warning'],
    [-3, 'error'],
  ] as const)('shift %i px → %s', (dy, severity) => {
    const [f] = check([body({ dy })], 'ground-line');
    expect(f?.severity).toBe(severity);
  });
  it('matches the spec example message exactly', () => {
    const s = body({ frameShift: { walk_up_04: { dx: 0, dy: -3 } } });
    const [f] = check([s], 'ground-line');
    expect(formatFinding(f!)).toBe(
      'spr_walk_body_mira.png · walk_up_04 · lowest opaque row 116 (expected 119)',
    );
    expect(f?.pixel).toMatchObject({ y: 116 });
  });
});

describe('torso-centre (warning outside 64 ± 2)', () => {
  it('passes centred and within tolerance', () => {
    expect(check([body()], 'torso-centre')).toEqual([]);
    expect(check([body({ dx: 1 })], 'torso-centre')).toEqual([]);
  });
  it('warns beyond 2 px', () => {
    const [f] = check([body({ dx: 3 })], 'torso-centre');
    expect(f).toMatchObject({ severity: 'warning', frameKey: 'walk_down_00' });
    expect(f?.message).toBe('torso centreline x 67.0 (expected 64 ± 2)');
  });
});

describe('body-height (warning outside 96 ± 4, error outside ± 8)', () => {
  it('passes the natural walk bob (93–96)', () =>
    expect(check([body()], 'body-height')).toEqual([]));
  it.each([
    [92, undefined],
    [91, 'warning'],
    [88, 'warning'],
    [87, 'error'],
    [101, 'warning'],
  ] as const)('standing height %i → %s', (height, severity) => {
    // bob 0 so every frame is exactly `height`
    const findings = check([body({ height, bob: [0, 0, 0, 0, 0, 0] })], 'body-height');
    if (!severity) expect(findings).toEqual([]);
    else expect(new Set(findings.map((f) => f.severity))).toEqual(new Set([severity]));
  });
  it('checks every body frame, bob included', () => {
    const findings = check([body({ bob: [0, 6, 0, 0, 0, 0] })], 'body-height');
    expect(findings.map((f) => f.frameKey)).toEqual([
      'walk_down_01',
      'walk_left_01',
      'walk_right_01',
      'walk_up_01',
    ]);
  });
  it('is body-only', () => {
    expect(
      check([body(), makeWalkSheetInput('outfit', 'x', { height: 60 })], 'body-height'),
    ).toEqual([]);
  });
});

describe('safe-box / overflow zone (warning, all layers)', () => {
  it('passes the default layers, including headwear in the overflow zone', () => {
    const sheets = LAYER_IDS.map((l) => makeWalkSheetInput(l));
    expect(check(sheets, 'safe-box')).toEqual([]);
  });
  it('warns when body or outfit leave the safe box', () => {
    const [f] = check([body(), makeWalkSheetInput('outfit', 'x', { dx: 40 })], 'safe-box');
    expect(f).toMatchObject({ severity: 'warning', file: 'spr_walk_outfit_x.png' });
  });
  it('lets headwear and accessories rise to y 8 but not beyond', () => {
    // headwear top is y 16 by default: raise it 8 → y 8 (allowed), 9 → y 7 (warning)
    expect(check([body(), makeWalkSheetInput('headwear', 'x', { dy: -8 })], 'safe-box')).toEqual(
      [],
    );
    const findings = check([body(), makeWalkSheetInput('headwear', 'x', { dy: -9 })], 'safe-box');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.message).toContain('overflow zone');
  });
  it('holds hair to the plain safe box (y 20)', () => {
    expect(check([body(), makeWalkSheetInput('hair', 'x', { dy: -4 })], 'safe-box')).toEqual([]);
    expect(
      check([body(), makeWalkSheetInput('hair', 'x', { dy: -5 })], 'safe-box').length,
    ).toBeGreaterThan(0);
  });
  it('ignores faint pixels (alpha < 128)', () => {
    const s = body();
    const image = { ...s.image, data: new Uint8ClampedArray(s.image.data) };
    image.data[(10 * image.width + 64) * 4 + 3] = 127; // y 10 of walk_down_00: outside box, faint
    expect(check([{ ...s, image }], 'safe-box')).toEqual([]);
  });
});
