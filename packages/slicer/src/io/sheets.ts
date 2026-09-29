import { PngError, readPackageZip, readSheetPng } from '@pokerpg/core';
import type { ImportInput } from '@pokerpg/core';
import { ImageDecodeError, openImage } from './decode.js';

export interface SheetFileRead {
  sheets: ImportInput[];
  /** Character name found in a `chr_<name>/` zip. */
  name?: string;
  ignored: string[];
  errors: string[];
}

const MAX_SIDE = 4096;

/**
 * Read one dropped/picked file: a `chr_<name>/` zip, or a single sheet image. PNGs are decoded
 * losslessly by core (so an on-spec sheet keeps every pixel exactly); other formats, and PNGs core
 * cannot read (interlaced, 1–4 bit), go through the browser decoder.
 */
export async function readSheetFile(file: File): Promise<SheetFileRead> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (/\.zip$/i.test(file.name) || file.type === 'application/zip') {
    return readPackageZip(bytes);
  }
  try {
    return { sheets: [readSheetPng(file.name, bytes)], ignored: [], errors: [] };
  } catch (e) {
    if (!(e instanceof PngError)) throw e;
  }
  try {
    const img = await openImage(file, file.name);
    try {
      if (img.width > MAX_SIDE || img.height > MAX_SIDE) {
        return {
          sheets: [],
          ignored: [],
          errors: [
            `${file.name}: ${img.width}×${img.height} è molto più grande di un foglio 768 × 512.`,
          ],
        };
      }
      const image = await img.readRect({ x: 0, y: 0, width: img.width, height: img.height });
      return { sheets: [{ filename: file.name, image, bytes }], ignored: [], errors: [] };
    } finally {
      img.close();
    }
  } catch (e) {
    if (e instanceof ImageDecodeError) {
      return {
        sheets: [],
        ignored: [],
        errors: [`${file.name}: non è un'immagine né uno zip.`],
      };
    }
    throw e;
  }
}
