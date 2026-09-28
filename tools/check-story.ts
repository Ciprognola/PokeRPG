// Validates a story package: a story_<id>/ folder or a story_<id>.zip. See USAGE below.
// Exit code 0 = no errors (warnings are allowed), 1 = errors, 2 = could not read the package.
import { fileURLToPath } from 'node:url';
import { formatStoryFinding, readStoryPackage, validateStory } from '@pokerpg/core';
import { loadLibrary, readStoryFiles } from './story-node.js';

const USAGE = `Check a story package against the Story Schema (docs/STORY_SCHEMA.md).

Usage:
  npm run story:check -- <story folder | story .zip> [--json] [--library <assets dir>]

  <story folder>   a story_<id>/ folder (contains story.json), e.g. templates/story_template
  <story .zip>     the same folder zipped
  --json           print the full report as JSON instead of text
  --library <dir>  asset library to check locations, music and sounds against (default: assets/)
  --help, -h       show this message

Examples:
  npm run story:check -- templates/story_template
  npm run story:check -- stories/story_my-tale

The "--" after "story:check" is required: it passes the rest to this tool.

Each line is "severity · file:line · path · message". Errors must be fixed; warnings may stay.
Run the check again after every fix until it prints "0 errors".

Exit code: 0 = no errors, 1 = errors found, 2 = the package could not be read.`;

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}

const KNOWN = new Set(['--json', '--library']);
const unknown = args.find((a) => a.startsWith('-') && !KNOWN.has(a));
const flag = (name: string): boolean => args.includes(name);
const libIndex = args.indexOf('--library');
const libValue = libIndex >= 0 ? args[libIndex + 1] : undefined;
const target = args.find((a, i) => !a.startsWith('-') && args[i - 1] !== '--library');

const usageError = (message: string): never => {
  console.error(`${message}\n\n${USAGE}`);
  return process.exit(2);
};

if (unknown) usageError(`Unknown option "${unknown}".`);
if (libIndex >= 0 && (libValue === undefined || libValue.startsWith('-')))
  usageError('--library needs a folder, e.g. --library assets');
if (!target) usageError('No story given: say which folder or .zip to check.');

try {
  const read = readStoryPackage(readStoryFiles(target!));
  if (!read.input) {
    for (const e of read.errors) console.error(e);
    console.error(
      'Not a readable story package. Expected a story_<id>/ folder with story.json in it (or a .zip of one).',
    );
    process.exit(2);
  }
  const assets = libValue ?? fileURLToPath(new URL('../assets', import.meta.url));
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
    console.log(
      report.ok
        ? 'OK: no errors. The story is ready to import.'
        : 'Fix the errors above and run the check again until it reports 0 errors.',
    );
  }
  process.exit(report.ok ? 0 : 1);
} catch (e) {
  console.error((e as Error).message);
  process.exit(2);
}
