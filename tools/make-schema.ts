// Writes schemas/story.schema.json from the schema defined in core. Commit the result.
//   npm run schema
import { mkdirSync, writeFileSync } from 'node:fs';
import { storySchema } from '@pokerpg/core';

const dir = new URL('../schemas/', import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL('story.schema.json', dir), `${JSON.stringify(storySchema, null, 2)}\n`);
console.log('schemas/story.schema.json written');
