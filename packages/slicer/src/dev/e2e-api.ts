/**
 * Test-only entry point. The app never imports this, so it is not part of the production bundle.
 * Playwright loads it through the dev server: `await import('/src/dev/e2e-api.ts')`.
 */
import { encodePng, extractGrid, pixelsEqual } from '@pokerpg/core';
import { makeRawGrid, walkFrameShapes } from '@pokerpg/core/testing';
import type { RawOptions } from '@pokerpg/core/testing';
import { extractLayer } from '../io/extract-layer.js';

export { encodePng, extractGrid, extractLayer, makeRawGrid, pixelsEqual };
export type { RawOptions };

/** PNG bytes of a synthetic raw grid (small: made and encoded by core). */
export function rawGridPng(o: RawOptions): Uint8Array {
  return encodePng(makeRawGrid(o));
}

/**
 * A 6 × 4 grid drawn with the browser's own canvas, so a 4096 × 4096 test image costs no JS
 * memory to build. Returns a PNG file.
 */
export async function bigGridFile(size: number, background: string): Promise<File> {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, size, size);
  const cw = size / 6;
  const ch = size / 4;
  const walkRows = ['down', 'left', 'right', 'up'] as const;
  const s = (ch * 0.72) / 96;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 6; col++) {
      const ox = col * cw + cw / 2 - 64 * s;
      const oy = row * ch + ch * 0.88 - 120 * s;
      for (const shape of walkFrameShapes('body', walkRows[row]!, col)) {
        ctx.fillStyle = `rgb(${shape.color.join(',')})`;
        ctx.beginPath();
        if (shape.kind === 'rect') {
          ctx.rect(ox + shape.x * s, oy + shape.y * s, shape.w * s, shape.h * s);
        } else {
          ctx.ellipse(
            ox + (shape.x + shape.w / 2) * s,
            oy + (shape.y + shape.h / 2) * s,
            (shape.w / 2) * s,
            (shape.h / 2) * s,
            0,
            0,
            Math.PI * 2,
          );
        }
        ctx.fill();
      }
    }
  }
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new File([blob], `grid-${size}.png`, { type: 'image/png' });
}
