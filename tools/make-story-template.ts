// Regenerates the NPC character packages of templates/story_template/ (deterministic, from the
// synthetic fixtures, through the real Slicer pipeline). story.json itself is hand-written.
//   npm run story-template
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { composeCharacter, extractFrames, packageFiles, prepareCharacter } from '@pokerpg/core';
import type { LayerId } from '@pokerpg/core';
import { makeRawFrames } from '@pokerpg/core/testing';

const root = new URL('../templates/story_template/characters/', import.meta.url);

function character(name: string, layers: LayerId[], seed: number): void {
  const input = layers.map((layer) => ({
    layer,
    name,
    frames: extractFrames(
      makeRawFrames({ cellWidth: 256, cellHeight: 320, background: [255, 0, 255], layer, seed }),
      { allowEmpty: layer !== 'body' },
    ),
  }));
  const result = composeCharacter(prepareCharacter({ name, layers: input }));
  if (!result.report.ok) throw new Error(`chr_${name} has errors`);
  rmSync(new URL(`chr_${name}/`, root), { recursive: true, force: true });
  for (const f of packageFiles(result)) {
    const url = new URL(f.path, root);
    mkdirSync(dirname(url.pathname.replace(/^\/([A-Za-z]:)/, '$1')), { recursive: true });
    writeFileSync(url, f.data);
  }
  console.log(`chr_${name}: ${layers.join(', ')}`);
}

character('rosa', ['body', 'outfit', 'hair'], 1);
character('tomas', ['body', 'headwear'], 2);
