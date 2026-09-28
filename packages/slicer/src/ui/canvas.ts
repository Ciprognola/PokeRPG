import { FRAME, REGISTRY, getAnimSet } from '@pokerpg/core';
import type { AssembledSheet, Direction, LayerId, PixelBuffer } from '@pokerpg/core';

/** A sheet's pixels as a canvas, ready to be drawn from. */
export function sheetToCanvas(buf: PixelBuffer): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = buf.width;
  canvas.height = buf.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('this browser cannot draw images');
  ctx.putImageData(
    new ImageData(buf.data as Uint8ClampedArray<ArrayBuffer>, buf.width, buf.height),
    0,
    0,
  );
  return canvas;
}

export type SheetCanvases = Map<LayerId, HTMLCanvasElement>;

export function canvasesFor(sheets: readonly AssembledSheet[]): SheetCanvases {
  return new Map(sheets.map((s) => [s.layer, sheetToCanvas(s.image)]));
}

/** Layer stacking order, back to front, for one row (Asset Spec §2.3: it is data in the registry). */
export function zOrderFor(direction: Direction, setId = 'walk'): readonly LayerId[] {
  const set = getAnimSet(setId, REGISTRY);
  return set?.zOrder[direction] ?? set?.zOrder.default ?? [];
}

/** Draw one frame (all visible layers, in z-order) at 1:1 into a 128 × 128 canvas. */
export function drawFrame(
  canvas: HTMLCanvasElement,
  sheets: SheetCanvases,
  visible: ReadonlySet<LayerId>,
  direction: Direction,
  rowIndex: number,
  col: number,
): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, FRAME.width, FRAME.height);
  for (const layer of zOrderFor(direction)) {
    const sheet = sheets.get(layer);
    if (!sheet || !visible.has(layer)) continue;
    ctx.drawImage(
      sheet,
      col * FRAME.width,
      rowIndex * FRAME.height,
      FRAME.width,
      FRAME.height,
      0,
      0,
      FRAME.width,
      FRAME.height,
    );
  }
  return ctx;
}

/** Ground line, anchor, torso centreline and safe box (Asset Spec §2.1), drawn over a frame. */
export function drawOverlay(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.lineWidth = 1;
  // safe box
  ctx.strokeStyle = 'rgba(120, 200, 255, 0.55)';
  const { x0, y0, x1, y1 } = FRAME.safeBox;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0, y1 - y0);
  // torso centreline
  ctx.strokeStyle = 'rgba(255, 220, 90, 0.55)';
  ctx.beginPath();
  ctx.moveTo(FRAME.torsoCentreX, 0);
  ctx.lineTo(FRAME.torsoCentreX, FRAME.height);
  ctx.stroke();
  // ground line (y = 120)
  ctx.strokeStyle = 'rgba(255, 90, 90, 0.9)';
  ctx.beginPath();
  ctx.moveTo(0, FRAME.anchor.y + 0.5);
  ctx.lineTo(FRAME.width, FRAME.anchor.y + 0.5);
  ctx.stroke();
  // anchor
  ctx.fillStyle = 'rgba(255, 90, 90, 1)';
  ctx.fillRect(FRAME.anchor.x - 2, FRAME.anchor.y - 2, 5, 5);
  ctx.restore();
}
