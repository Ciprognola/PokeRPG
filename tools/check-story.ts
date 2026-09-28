// Validates a story package: a story_<id>/ folder or a story_<id>.zip.
//   npm run story:check -- <folder|zip> [--library <assets dir>] [--json]
// Exit code 0 = no errors (warnings are allowed), 1 = errors, 2 = could not read the package.
import { fileURLToPath } from 'node:url';
import { formatStoryFinding, readStoryPackage, validateStory } from '@pokerpg/core';
import { loadLibrary, readStoryFiles } from './story-node.js';

const args = process.argv.slice(2);
const flag = (name: string): boolean => args.includes(name);
const value = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const target = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--library');

if (!target) {
  console.error(
    'Usage: npm run story:check -- <story_<id> folder | .zip> [--library <assets dir>] [--json]',
  );
  process.exit(2);
}

try {
  const read = readStoryPackage(readStoryFiles(target));
  if (!read.input) {
    for (const e of read.errors) console.error(e);
    process.exit(2);
  }
  const assets = value('--library') ?? fileURLToPath(new URL('../assets', import.meta.url));
  const report = validateStory(read.input, loadLibrary(assets));
  if (flag('--json')) {
    console.log(JSON.stringify({ ...report, packageErrors: read.errors }, null, 2));
  } else {
    for (const e of read.errors) console.log(`warning · ${e}`);
    for (const f of report.findings) console.log(`${f.severity} · ${formatStoryFinding(f)}`);
    const { errors, warnings } = report.summary;
    console.log(
      `${report.storyId ?? target}: ${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}`,
    );
  }
  process.exit(report.ok ? 0 : 1);
} catch (e) {
  console.error((e as Error).message);
  process.exit(2);
}
