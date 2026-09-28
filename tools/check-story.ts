// Validates a story package: a story_<id>/ folder or a story_<id>.zip. See USAGE below.
// Exit code 0 = no errors (warnings are allowed), 1 = errors, 2 = could not read the package.
import { checkStory } from './story-node.js';

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

process.exit(checkStory(target!, libValue, flag('--json')));
