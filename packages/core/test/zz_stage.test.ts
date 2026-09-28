import { it } from 'vitest';
import { extractFrame } from '../src/index.js';
import { makeRawFrame } from '../src/testing/index.js';

it('frame 8 edge pixels', () => {
  const raw = makeRawFrame('left', 2, 8, {
    cellWidth: 256,
    cellHeight: 320,
    background: [255, 0, 255],
    layer: 'body',
    seed: 1,
  });
  const dbg: unknown[] = [];
  (globalThis as { __dbg?: (v: unknown) => void }).__dbg = (v) => dbg.push(v);
  const f = extractFrame(raw);
  const { width: w, data } = f.pixels;
  const lines: string[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! > 0 && data[i + 3]! < 255) {
      const p = i / 4;
      lines.push(
        `EDGE ${p % w},${Math.floor(p / w)}:${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`,
      );
    }
  }
  throw new Error(
    `\nDBG ${JSON.stringify(dbg)}\nEDGECOUNT ${lines.length} size ${w}x${f.pixels.height}\n${lines.join('\n')}`,
  );
});
