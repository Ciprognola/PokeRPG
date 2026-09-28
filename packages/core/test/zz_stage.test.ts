import { createHash } from 'node:crypto';
import { it } from 'vitest';
import { composeCharacter, extractFrames, prepareCharacter } from '../src/index.js';
import { makeRawFrames } from '../src/testing/index.js';

const md5 = (parts: Uint8Array[]): string => {
  const h = createHash('md5');
  for (const p of parts) h.update(p);
  return h.digest('hex');
};

it('stage hashes', () => {
  const raw = makeRawFrames({ cellWidth: 256, cellHeight: 320, background: [255, 0, 255], layer: 'body', seed: 1 });
  const ext = extractFrames(raw);
  const prepared = prepareCharacter({ name: 'rosa', layers: [{ layer: 'body', name: 'rosa', frames: ext }] });
  const sheet = composeCharacter(prepared, {}, { encode: false }).sheets[0]!.image;
  const perFrame = prepared.layers[0]!.frames.map((f) => md5([new Uint8Array(f.canvas.data.buffer)]).slice(0, 6));
  const lines = [
    `STAGE raw ${md5(raw.map((r) => new Uint8Array(r.data.buffer)))}`,
    `STAGE extracted ${md5(ext.map((e) => new Uint8Array(e.pixels.data.buffer)))} origins ${md5([Uint8Array.from(ext.flatMap((e) => [e.origin.x, e.origin.y, e.pixels.width, e.pixels.height]))])}`,
    `STAGE scale ${prepared.scale}`,
    `STAGE shifts ${JSON.stringify(prepared.shift).length} ${md5([new TextEncoder().encode(JSON.stringify(prepared.shift))])}`,
    `STAGE canvases ${perFrame.join(',')}`,
    `STAGE sheet ${md5([new Uint8Array(sheet.data.buffer)])}`,
  ];
  throw new Error(`\n${lines.join('\n')}`);
});
