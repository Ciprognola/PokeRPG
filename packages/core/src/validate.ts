import { makeReport } from './findings.js';
import type { Finding, Report, SheetSummary } from './findings.js';
import { OPAQUE_ALPHA, measureBodyFrame } from './measure.js';
import { parseLayerSheetName } from './naming.js';
import type { LayerSheetName } from './naming.js';
import { PngError, inspectPng } from './png.js';
import type { PixelBuffer } from './pixels.js';
import { REGISTRY, frameRects, getAnimSet, sheetSize } from './registry.js';
import type { AnimSetRegistry } from './registry.js';
import {
  FRAME,
  KEY_COLOUR,
  KEY_TOLERANCE,
  SHEET_FILE_LIMITS,
  SPEC_VERSION,
  TOLERANCES,
} from './spec.js';
import type { LayerId } from './spec.js';

/**
 * Shared sprite validator (docs/ASSET_SPEC.md §7 and §7.1). Reports only; never fixes.
 * Used by the Slicer and, unchanged, by the in-game importer.
 */

export interface SheetInput {
  /** File name only, e.g. `spr_walk_body_mira.png`. */
  filename: string;
  /** Decoded pixels. */
  image: PixelBuffer;
  /**
   * The encoded PNG file. Optional: without it the file-level checks (PNG-32 RGBA, sRGB, file
   * size) are skipped. Provide it whenever the sheet is about to be shipped.
   */
  bytes?: Uint8Array;
}

export interface ValidateOptions {
  registry?: AnimSetRegistry;
  /** Set assumed for a sheet whose filename cannot be parsed. Default `walk`. */
  fallbackSet?: string;
}

/** Layers whose content may reach into the overflow zone above the safe box (§2.1). */
const OVERFLOW_LAYERS: readonly LayerId[] = ['headwear', 'accessory', 'accessory-back'];

const add = (list: Finding[], f: Finding): void => void list.push(f);

/** Validate a whole character: every sheet plus the character-level rules. */
export function validateCharacter(
  sheets: readonly SheetInput[],
  options: ValidateOptions = {},
): Report {
  const registry = options.registry ?? REGISTRY;
  const ordered = [...sheets].sort((a, b) => (a.filename < b.filename ? -1 : 1));
  const findings: Finding[] = [];
  const parsed = ordered.map((s) => ({ input: s, name: parseLayerSheetName(s.filename) }));

  // ---- Character-level rules (§2.3, §2.4, §3 rule 4) ----
  const bySet = new Map<string, Map<LayerId, string[]>>();
  for (const { input, name } of parsed) {
    if (!name) continue;
    const layers = bySet.get(name.set) ?? new Map<LayerId, string[]>();
    layers.set(name.layer, [...(layers.get(name.layer) ?? []), input.filename]);
    bySet.set(name.set, layers);
  }
  for (const [setId, layers] of [...bySet].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const set = getAnimSet(setId, registry);
    for (const [layer, files] of layers) {
      for (const file of files.slice(1)) {
        add(findings, {
          severity: 'error',
          check: 'duplicate-layer',
          file,
          message: `second ${layer} sheet for set ${setId} (already have ${files[0]}); one file per layer per set`,
        });
      }
    }
    for (const required of set?.requiredLayers ?? ['body']) {
      if (!layers.has(required)) {
        add(findings, {
          severity: 'error',
          check: 'missing-required-layer',
          message: `set ${setId} has no ${required} sheet`,
        });
      }
    }
    for (const layer of allLayersOf(bySet)) {
      if (!layers.has(layer) && layer !== 'body') {
        add(findings, {
          severity: 'warning',
          check: 'layer-missing-for-set',
          message: `layer ${layer} has a sheet in another set but none for set ${setId}`,
        });
      }
    }
  }

  // ---- Per sheet ----
  const summaries: SheetSummary[] = [];
  for (const { input, name } of parsed) {
    summaries.push({
      file: input.filename,
      ...(name ? { set: name.set, layer: name.layer, name: name.name } : {}),
      ...(name?.variant !== undefined ? { variant: name.variant } : {}),
      width: input.image.width,
      height: input.image.height,
      ...(input.bytes ? { bytes: input.bytes.length } : {}),
    });
    findings.push(...validateSheet(input, name, registry, options.fallbackSet ?? 'walk'));
  }
  return makeReport(SPEC_VERSION, findings, summaries);
}

function allLayersOf(bySet: Map<string, Map<LayerId, string[]>>): LayerId[] {
  const seen = new Set<LayerId>();
  for (const layers of bySet.values()) for (const l of layers.keys()) seen.add(l);
  return [...seen].sort();
}

function validateSheet(
  input: SheetInput,
  name: LayerSheetName | undefined,
  registry: AnimSetRegistry,
  fallbackSet: string,
): Finding[] {
  const file = input.filename;
  const out: Finding[] = [];
  const { image, bytes } = input;

  if (!name) {
    add(out, {
      severity: 'error',
      check: 'filename',
      file,
      message: `name does not match spr_<set>_<layer>_<name>[_<variant>].png (lowercase a-z 0-9 -, "_" only between fields)`,
    });
  }

  // File-level: PNG-32 RGBA, sRGB, size (only when the encoded bytes are known).
  if (bytes) {
    checkPngFormat(bytes, file, out);
    const { warnBytes, errorBytes } = SHEET_FILE_LIMITS;
    if (bytes.length > errorBytes) {
      add(out, {
        severity: 'error',
        check: 'file-size',
        file,
        message: `file is ${bytes.length} bytes (limit ${errorBytes})`,
      });
    } else if (bytes.length > warnBytes) {
      add(out, {
        severity: 'warning',
        check: 'file-size',
        file,
        message: `file is ${bytes.length} bytes (over ${warnBytes}; error above ${errorBytes})`,
      });
    }
  }

  const setId = name?.set ?? fallbackSet;
  const set = getAnimSet(setId, registry);
  if (!set) {
    add(out, {
      severity: 'error',
      check: 'unknown-set',
      file,
      message: `unknown animation set "${setId}"`,
    });
    return out;
  }
  const expected = sheetSize(set);
  if (image.width !== expected.width || image.height !== expected.height) {
    add(out, {
      severity: 'error',
      check: 'sheet-size',
      file,
      message: `sheet is ${image.width}×${image.height} (expected ${expected.width}×${expected.height} for set ${set.id})`,
    });
    return out; // cannot slice frames of an off-grid sheet
  }

  const layer = name?.layer;
  const isBody = layer === 'body';
  const overflow = layer !== undefined && OVERFLOW_LAYERS.includes(layer);
  const box = {
    x0: FRAME.safeBox.x0,
    x1: FRAME.safeBox.x1,
    y0: overflow ? FRAME.overflowTop : FRAME.safeBox.y0,
    y1: FRAME.safeBox.y1,
  };

  for (const rect of frameRects(set)) {
    const base = { file, frameKey: rect.key };
    const px = (x: number, y: number): number =>
      image.data[((rect.y + y) * image.width + rect.x + x) * 4 + 3];

    // 4 px empty border, all layers (Empty = alpha 0).
    const b = FRAME.emptyBorder;
    let borderCount = 0;
    let borderFirst: { x: number; y: number } | undefined;
    for (let y = 0; y < rect.height; y++) {
      for (let x = 0; x < rect.width; x++) {
        if (x >= b && x < rect.width - b && y >= b && y < rect.height - b) continue;
        if (px(x, y) > 0) {
          borderCount++;
          borderFirst ??= { x, y };
        }
      }
    }
    if (borderFirst) {
      add(out, {
        severity: 'error',
        check: 'border',
        ...base,
        pixel: borderFirst,
        message: `content at (${borderFirst.x}, ${borderFirst.y}) inside the ${b} px border (${borderCount} px)`,
      });
    }

    // Safe box / overflow zone, all layers (Opaque = alpha >= 128).
    let boxCount = 0;
    let boxFirst: { x: number; y: number } | undefined;
    for (let y = 0; y < rect.height; y++) {
      for (let x = 0; x < rect.width; x++) {
        if (x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1) continue;
        if (px(x, y) >= OPAQUE_ALPHA) {
          boxCount++;
          boxFirst ??= { x, y };
        }
      }
    }
    if (boxFirst) {
      add(out, {
        severity: 'warning',
        check: 'safe-box',
        ...base,
        pixel: boxFirst,
        message: `opaque content at (${boxFirst.x}, ${boxFirst.y}) outside the ${overflow ? 'overflow zone' : 'safe box'} x ${box.x0}–${box.x1}, y ${box.y0}–${box.y1} (${boxCount} px)`,
      });
    }

    // Key colour left in any layer (§7, §7.1): a pixel with alpha > 0 and every channel within 24.
    let keyCount = 0;
    let keyFirst: { x: number; y: number } | undefined;
    for (let y = 0; y < rect.height; y++) {
      for (let x = 0; x < rect.width; x++) {
        const i = ((rect.y + y) * image.width + rect.x + x) * 4;
        if (
          image.data[i + 3]! > 0 &&
          Math.abs(image.data[i]! - KEY_COLOUR[0]) <= KEY_TOLERANCE &&
          Math.abs(image.data[i + 1]! - KEY_COLOUR[1]) <= KEY_TOLERANCE &&
          Math.abs(image.data[i + 2]! - KEY_COLOUR[2]) <= KEY_TOLERANCE
        ) {
          keyCount++;
          keyFirst ??= { x, y };
        }
      }
    }
    if (keyFirst) {
      add(out, {
        severity: 'warning',
        check: 'key-colour',
        ...base,
        pixel: keyFirst,
        message: `key-colour pixels remain: ${keyCount} px near #FF00FF, first at (${keyFirst.x}, ${keyFirst.y})`,
      });
    }

    if (!isBody) continue;

    // ---- Body-only checks (§7.1) ----
    const m = measureBodyFrame(image, rect);
    if (!m.hasContent) {
      add(out, {
        severity: 'error',
        check: 'empty-frame',
        ...base,
        message: 'body frame is empty',
      });
      continue;
    }
    if (!m.hasOpaque) {
      add(out, {
        severity: 'error',
        check: 'no-opaque-body',
        ...base,
        message: `body has content but no opaque pixel (alpha >= ${OPAQUE_ALPHA})`,
      });
      continue;
    }

    if (set.groundLock) {
      const off = Math.abs(m.bottomRow - FRAME.groundRow);
      if (off > 0) {
        add(out, {
          severity: off > TOLERANCES.groundErrorPx ? 'error' : 'warning',
          check: 'ground-line',
          ...base,
          pixel: m.bottomPixel,
          message: `lowest opaque row ${m.bottomRow} (expected ${FRAME.groundRow})`,
        });
      }
    }

    const heightOff = Math.abs(m.height - FRAME.standardHeight);
    if (heightOff > TOLERANCES.bodyHeightWarnPx) {
      add(out, {
        severity: heightOff > TOLERANCES.bodyHeightErrorPx ? 'error' : 'warning',
        check: 'body-height',
        ...base,
        pixel: m.topPixel,
        message: `body height ${m.height} (expected ${FRAME.standardHeight} ± ${TOLERANCES.bodyHeightWarnPx}, top opaque row ${m.topRow})`,
      });
    }

    if (
      m.centreX !== undefined &&
      Math.abs(m.centreX - FRAME.torsoCentreX) > TOLERANCES.torsoCentreWarnPx
    ) {
      add(out, {
        severity: 'warning',
        check: 'torso-centre',
        ...base,
        pixel: { x: Math.floor(m.centreX), y: Math.floor((m.band.from + m.band.to) / 2) },
        message: `torso centreline x ${m.centreX.toFixed(1)} (expected ${FRAME.torsoCentreX} ± ${TOLERANCES.torsoCentreWarnPx})`,
      });
    }
  }
  return out;
}

function checkPngFormat(bytes: Uint8Array, file: string, out: Finding[]): void {
  try {
    const info = inspectPng(bytes);
    if (info.colorType !== 6 || info.bitDepth !== 8) {
      add(out, {
        severity: 'error',
        check: 'png-format',
        file,
        message: `not PNG-32 RGBA (colour type ${info.colorType}, ${info.bitDepth}-bit; expected colour type 6, 8-bit)`,
      });
    }
    if (info.iccProfileName !== undefined && !/srgb/i.test(info.iccProfileName)) {
      add(out, {
        severity: 'error',
        check: 'srgb',
        file,
        message: `embedded colour profile "${info.iccProfileName}" is not sRGB`,
      });
    } else if (
      info.iccProfileName === undefined &&
      !info.srgbChunk &&
      info.gamma !== undefined &&
      Math.abs(info.gamma - 0.45455) > 0.005
    ) {
      add(out, {
        severity: 'error',
        check: 'srgb',
        file,
        message: `gamma ${info.gamma} is not sRGB (0.45455) and there is no sRGB chunk`,
      });
    }
  } catch (e) {
    if (!(e instanceof PngError)) throw e;
    add(out, {
      severity: 'error',
      check: 'png-format',
      file,
      message: `not a valid PNG: ${e.message}`,
    });
  }
}
