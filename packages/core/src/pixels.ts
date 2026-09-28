/** RGBA, 8 bits per channel, straight (non-premultiplied) alpha, row-major. DOM-free. */
export interface PixelBuffer {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function createPixelBuffer(width: number, height: number): PixelBuffer {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function alphaAt(buf: PixelBuffer, x: number, y: number): number {
  return buf.data[(y * buf.width + x) * 4 + 3];
}

/** Copy `rect` out of `src`. Areas outside `src` come out fully transparent. */
export function cropPixels(src: PixelBuffer, rect: Rect): PixelBuffer {
  const out = createPixelBuffer(rect.width, rect.height);
  blitPixels(out, src, -rect.x, -rect.y);
  return out;
}

/**
 * Copy `src` into `dst` with its top-left at (dx, dy). Pixels are overwritten, not blended, and
 * anything falling outside `dst` is clipped. Returns how many non-transparent source pixels were
 * clipped away.
 */
export function blitPixels(dst: PixelBuffer, src: PixelBuffer, dx: number, dy: number): number {
  let clipped = 0;
  for (let y = 0; y < src.height; y++) {
    const ty = y + dy;
    for (let x = 0; x < src.width; x++) {
      const tx = x + dx;
      const si = (y * src.width + x) * 4;
      if (tx < 0 || ty < 0 || tx >= dst.width || ty >= dst.height) {
        if (src.data[si + 3] > 0) clipped++;
        continue;
      }
      const di = (ty * dst.width + tx) * 4;
      dst.data[di] = src.data[si];
      dst.data[di + 1] = src.data[si + 1];
      dst.data[di + 2] = src.data[si + 2];
      dst.data[di + 3] = src.data[si + 3];
    }
  }
  return clipped;
}

export function clonePixels(src: PixelBuffer): PixelBuffer {
  return { width: src.width, height: src.height, data: new Uint8ClampedArray(src.data) };
}

export function pixelsEqual(a: PixelBuffer, b: PixelBuffer): boolean {
  if (a.width !== b.width || a.height !== b.height) return false;
  for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) return false;
  return true;
}
