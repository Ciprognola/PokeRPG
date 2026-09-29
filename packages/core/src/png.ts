import { unzlibSync, zlibSync } from 'fflate';
import { createPixelBuffer } from './pixels.js';
import type { PixelBuffer } from './pixels.js';

/**
 * Minimal PNG support, DOM-free so it runs in the browser, in the game and in Node tests.
 *  - `inspectPng`: header facts for the "PNG-32 RGBA, sRGB" check (docs/ASSET_SPEC.md §7).
 *  - `decodePng`: lossless decode of non-interlaced 8/16-bit PNGs (used for on-spec sheets, never
 *    via canvas, so pixels survive a round trip exactly).
 *  - `encodePng`: deterministic RGBA8 + sRGB encoder (same input, same bytes).
 */

export const PNG_SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);

export class PngError extends Error {
  constructor(
    message: string,
    readonly kind: 'not-png' | 'corrupt' | 'unsupported',
  ) {
    super(message);
    this.name = 'PngError';
  }
}

export interface PngInfo {
  width: number;
  height: number;
  bitDepth: number;
  /** PNG colour type: 0 grey, 2 RGB, 3 palette, 4 grey+alpha, 6 RGBA. */
  colorType: number;
  interlaced: boolean;
  /** An sRGB chunk is present. */
  srgbChunk: boolean;
  /** gAMA chunk value (e.g. 0.45455), if present. */
  gamma?: number;
  /** iCCP profile name, if an embedded ICC profile is present. */
  iccProfileName?: string;
}

interface Chunk {
  type: string;
  data: Uint8Array;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u32(bytes: Uint8Array, at: number): number {
  return ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
}

function ascii(bytes: Uint8Array, from: number, to: number): string {
  let s = '';
  for (let i = from; i < to; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

/** Build one PNG chunk (length, type, data, CRC). Exported so tests can craft odd files. */
export function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function readChunks(bytes: Uint8Array): Chunk[] {
  if (bytes.length < 8 || PNG_SIGNATURE.some((b, i) => bytes[i] !== b)) {
    throw new PngError('firma PNG assente', 'not-png');
  }
  const chunks: Chunk[] = [];
  let at = 8;
  while (at + 12 <= bytes.length) {
    const len = u32(bytes, at);
    const type = ascii(bytes, at + 4, at + 8);
    if (at + 12 + len > bytes.length) throw new PngError(`chunk ${type} troncato`, 'corrupt');
    chunks.push({ type, data: bytes.subarray(at + 8, at + 8 + len) });
    at += 12 + len;
    if (type === 'IEND') break;
  }
  if (chunks.length === 0 || chunks[0].type !== 'IHDR' || chunks[0].data.length < 13) {
    throw new PngError('chunk IHDR assente', 'corrupt');
  }
  return chunks;
}

function infoFromChunks(chunks: Chunk[]): PngInfo {
  const ihdr = chunks[0].data;
  const info: PngInfo = {
    width: u32(ihdr, 0),
    height: u32(ihdr, 4),
    bitDepth: ihdr[8],
    colorType: ihdr[9],
    interlaced: ihdr[12] === 1,
    srgbChunk: false,
  };
  for (const c of chunks) {
    if (c.type === 'sRGB') info.srgbChunk = true;
    else if (c.type === 'gAMA' && c.data.length >= 4) info.gamma = u32(c.data, 0) / 100000;
    else if (c.type === 'iCCP') {
      const end = c.data.indexOf(0);
      info.iccProfileName = ascii(c.data, 0, end < 0 ? c.data.length : end);
    }
  }
  return info;
}

/** Read the PNG header and colour-space chunks without decoding pixels. */
export function inspectPng(bytes: Uint8Array): PngInfo {
  return infoFromChunks(readChunks(bytes));
}

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Decode a non-interlaced 8/16-bit PNG (any colour type) to RGBA8. */
export function decodePng(bytes: Uint8Array): PixelBuffer {
  const chunks = readChunks(bytes);
  const info = infoFromChunks(chunks);
  const { width, height, bitDepth, colorType } = info;
  const channels = CHANNELS[colorType];
  if (channels === undefined) throw new PngError(`tipo colore non valido ${colorType}`, 'corrupt');
  if (info.interlaced) throw new PngError('PNG interlacciato non supportato', 'unsupported');
  if (bitDepth !== 8 && bitDepth !== 16) {
    throw new PngError(`PNG a ${bitDepth} bit non supportato`, 'unsupported');
  }
  const bpp = (channels * bitDepth) / 8;
  const stride = width * bpp;

  const idat = chunks.filter((c) => c.type === 'IDAT');
  const joined = new Uint8Array(idat.reduce((n, c) => n + c.data.length, 0));
  let o = 0;
  for (const c of idat) {
    joined.set(c.data, o);
    o += c.data.length;
  }
  let raw: Uint8Array;
  try {
    raw = unzlibSync(joined);
  } catch {
    throw new PngError('dati immagine corrotti', 'corrupt');
  }
  if (raw.length < (stride + 1) * height)
    throw new PngError('dati immagine troppo corti', 'corrupt');

  // Undo the per-row filters in place.
  const px = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const ft = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const row = y * stride;
    for (let i = 0; i < stride; i++) {
      const left = i >= bpp ? px[row + i - bpp] : 0;
      const up = y > 0 ? px[row - stride + i] : 0;
      const upLeft = y > 0 && i >= bpp ? px[row - stride + i - bpp] : 0;
      const v = raw[src + i];
      let add: number;
      switch (ft) {
        case 0:
          add = 0;
          break;
        case 1:
          add = left;
          break;
        case 2:
          add = up;
          break;
        case 3:
          add = (left + up) >> 1;
          break;
        case 4:
          add = paeth(left, up, upLeft);
          break;
        default:
          throw new PngError(`tipo di filtro non valido ${ft}`, 'corrupt');
      }
      px[row + i] = (v + add) & 0xff;
    }
  }

  const palette = chunks.find((c) => c.type === 'PLTE')?.data;
  const trns = chunks.find((c) => c.type === 'tRNS')?.data;
  if (colorType === 3 && !palette) throw new PngError('chunk PLTE assente', 'corrupt');
  const step = bitDepth / 8; // bytes per sample
  const sample = (row: number, index: number): number =>
    step === 1 ? px[row + index] : (px[row + index * 2] << 8) | px[row + index * 2 + 1];
  const to8 = (v: number): number => (step === 1 ? v : v >> 8);

  const out = createPixelBuffer(width, height);
  for (let y = 0; y < height; y++) {
    const row = y * stride;
    for (let x = 0; x < width; x++) {
      const di = (y * width + x) * 4;
      const s = x * channels;
      let r: number, g: number, b: number, a: number;
      switch (colorType) {
        case 0: {
          const v = sample(row, s);
          r = g = b = to8(v);
          a = trns && v === ((trns[0] << 8) | trns[1]) ? 0 : 255;
          break;
        }
        case 2: {
          const rv = sample(row, s);
          const gv = sample(row, s + 1);
          const bv = sample(row, s + 2);
          r = to8(rv);
          g = to8(gv);
          b = to8(bv);
          a =
            trns &&
            rv === ((trns[0] << 8) | trns[1]) &&
            gv === ((trns[2] << 8) | trns[3]) &&
            bv === ((trns[4] << 8) | trns[5])
              ? 0
              : 255;
          break;
        }
        case 3: {
          const idx = sample(row, s);
          r = palette![idx * 3];
          g = palette![idx * 3 + 1];
          b = palette![idx * 3 + 2];
          a = trns && idx < trns.length ? trns[idx] : 255;
          break;
        }
        case 4:
          r = g = b = to8(sample(row, s));
          a = to8(sample(row, s + 1));
          break;
        default:
          r = to8(sample(row, s));
          g = to8(sample(row, s + 1));
          b = to8(sample(row, s + 2));
          a = to8(sample(row, s + 3));
      }
      out.data[di] = r;
      out.data[di + 1] = g;
      out.data[di + 2] = b;
      out.data[di + 3] = a;
    }
  }
  return out;
}

/** Choose the row filter with the smallest sum of absolute residuals (deterministic). */
function filterRow(
  row: Uint8Array,
  prev: Uint8Array | undefined,
  bpp: number,
): { type: number; bytes: Uint8Array } {
  const n = row.length;
  let best = { type: 0, bytes: row, score: Infinity };
  for (let type = 0; type < 5; type++) {
    const out = new Uint8Array(n);
    let score = 0;
    for (let i = 0; i < n; i++) {
      const left = i >= bpp ? row[i - bpp] : 0;
      const up = prev ? prev[i] : 0;
      const upLeft = prev && i >= bpp ? prev[i - bpp] : 0;
      let pred = 0;
      if (type === 1) pred = left;
      else if (type === 2) pred = up;
      else if (type === 3) pred = (left + up) >> 1;
      else if (type === 4) pred = paeth(left, up, upLeft);
      const v = (row[i] - pred) & 0xff;
      out[i] = v;
      score += v < 128 ? v : 256 - v;
    }
    if (score < best.score) best = { type, bytes: out, score };
  }
  return { type: best.type, bytes: best.bytes };
}

/** Encode RGBA8 as PNG-32 with an explicit sRGB chunk. Deterministic. */
export function encodePng(buf: PixelBuffer): Uint8Array {
  const { width, height, data } = buf;
  const stride = width * 4;
  const raw = new Uint8Array((stride + 1) * height);
  let prev: Uint8Array | undefined;
  for (let y = 0; y < height; y++) {
    const row = new Uint8Array(data.buffer, data.byteOffset + y * stride, stride);
    const f = filterRow(row, prev, 4);
    raw[y * (stride + 1)] = f.type;
    raw.set(f.bytes, y * (stride + 1) + 1);
    prev = row;
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const parts = [
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('sRGB', Uint8Array.of(0)),
    pngChunk('IDAT', zlibSync(raw, { level: 6 })),
    pngChunk('IEND', new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
