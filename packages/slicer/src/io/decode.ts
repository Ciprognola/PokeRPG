import type { PixelBuffer, Rect } from '@pokerpg/core';

/**
 * Browser image decoding. Raw AI output can be up to 4096 × 4096 (64 MB decoded), so nothing here
 * ever copies a whole image into JS memory unless the caller asks for the whole image: pieces are
 * read out one rectangle at a time. Raw input goes through the browser decoder (any format, any
 * bit depth); on-spec sheets are decoded losslessly by core's PNG decoder instead (PKR-006).
 */

export interface DecodedImage {
  width: number;
  height: number;
  /** Read one rectangle as RGBA8 (straight alpha). */
  readRect(rect: Rect): Promise<PixelBuffer>;
  /** Free the decoded image. Always call this. */
  close(): void;
}

type Canvas2D = OffscreenCanvas | HTMLCanvasElement;

function makeCanvas(width: number, height: number): Canvas2D {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

export class ImageDecodeError extends Error {
  constructor(
    readonly fileName: string,
    message: string,
  ) {
    super(`${fileName} · ${message}`);
    this.name = 'ImageDecodeError';
  }
}

export async function openImage(blob: Blob, fileName = 'image'): Promise<DecodedImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob, { premultiplyAlpha: 'none' });
  } catch {
    throw new ImageDecodeError(fileName, 'could not read this file as an image');
  }
  let closed = false;
  return {
    width: bitmap.width,
    height: bitmap.height,
    async readRect(rect) {
      if (closed) throw new Error('image already closed');
      const canvas = makeCanvas(rect.width, rect.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true }) as
        OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
      if (!ctx) throw new ImageDecodeError(fileName, 'this browser cannot read image pixels');
      ctx.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
      const data = ctx.getImageData(0, 0, rect.width, rect.height);
      // Shrink the scratch canvas now instead of waiting for garbage collection (matters on phones).
      canvas.width = 0;
      canvas.height = 0;
      return { width: data.width, height: data.height, data: data.data };
    },
    close() {
      closed = true;
      bitmap.close();
    },
  };
}
