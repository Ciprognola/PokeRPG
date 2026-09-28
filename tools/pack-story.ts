// Packs a story folder into story_<id>.zip next to it, then checks the zip. See USAGE below.
// Exit code 0 = packed and no errors, 1 = packed but the check found errors, 2 = could not pack.
import { relative } from 'node:path';
import { checkStory, packStoryFolder } from './story-node.js';

const USAGE = `Pack a story folder into story_<id>.zip and check it (Story Schema §1).

Usage:
  npm run story:pack -- <story folder>

  <story folder>   the story_<id>/ folder (contains story.json), e.g. stories/story_my-tale

Writes story_<id>.zip next to the folder (same name, forward-slash paths, same bytes every run),
then runs the same check as "npm run story:check" on the zip.

Example:
  npm run story:pack -- stories/story_my-tale

The "--" after "story:pack" is required: it passes the rest to this tool.

Exit code: 0 = packed, no errors; 1 = packed, but the check found errors (fix them and pack again,
don't share that zip); 2 = the folder could not be packed.`;

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}

const usageError = (message: string): never => {
  console.error(`${message}\n\n${USAGE}`);
  return process.exit(2);
};

const unknown = args.find((a) => a.startsWith('-'));
if (unknown) usageError(`Unknown option "${unknown}".`);
if (args.length === 0) usageError('No story given: say which story_<id>/ folder to pack.');
if (args.length > 1) usageError('Give one story folder at a time.');

try {
  const { zipPath, files } = packStoryFolder(args[0]!);
  console.log(`Wrote ${relative(process.cwd(), zipPath) || zipPath} (${files} files)`);
  process.exit(checkStory(zipPath));
} catch (e) {
  console.error((e as Error).message);
  process.exit(2);
}
