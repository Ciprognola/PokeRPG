// Throwaway (PKR-015). Copies the Story Template character's Slicer-exported files as-is and
// writes a small synthesized audio loop, into spikes/public/gen (git-ignored). Deterministic.
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const out = join(here, '..', 'public', 'gen');
mkdirSync(join(out, 'rosa'), { recursive: true });

const src = join(root, 'templates', 'story_template', 'characters', 'chr_rosa');
for (const layer of ['body', 'outfit', 'hair']) {
  for (const ext of ['png', 'json']) {
    const f = `spr_walk_${layer}_rosa.${ext}`;
    copyFileSync(join(src, f), join(out, 'rosa', f));
  }
}

// 44.1 kHz mono 16-bit WAV: 1 s rising sweep (intro) + 1 s steady tone (the loop body).
// The body holds a whole number of cycles, so a perfect loop is inaudible and any gap or
// click at the seam is a defect of the engine's looping, not of the file.
const sr = 44100;
const n = sr * 2;
const pcm = new Int16Array(n);
let phase = 0;
for (let i = 0; i < n; i++) {
  if (i < sr) {
    const f = 220 + (330 - 220) * (i / sr);
    phase += (2 * Math.PI * f) / sr;
    pcm[i] = Math.round(Math.sin(phase) * 9000);
  } else {
    const t = (i - sr) / sr;
    pcm[i] = Math.round(Math.sin(2 * Math.PI * 330 * t) * 9000);
  }
}
const buf = Buffer.alloc(44 + n * 2);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + n * 2, 4);
buf.write('WAVEfmt ', 8);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(1, 22);
buf.writeUInt32LE(sr, 24);
buf.writeUInt32LE(sr * 2, 28);
buf.writeUInt16LE(2, 32);
buf.writeUInt16LE(16, 34);
buf.write('data', 36);
buf.writeUInt32LE(n * 2, 40);
Buffer.from(pcm.buffer).copy(buf, 44);
writeFileSync(join(out, 'loop.wav'), buf);
console.log('spikes: assets prepared');
