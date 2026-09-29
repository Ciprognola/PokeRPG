// Fails if any file inside overrides/ is tracked by git (Project Brief §2, §7; PKR-014).
// .gitignore keeps a normal `git add overrides/…` out, but `git add -f` can still slip one in;
// this is the independent CI check that catches that. Exit 0 = clean, 1 = a tracked file found.
import { execFileSync } from 'node:child_process';

const USAGE = `Fail if any tracked file sits inside overrides/ (Project Brief §2, §7).

Usage:
  npm run overrides:check [-- <repo root>]

  <repo root>   defaults to the current directory; the repo checked out for this build.

overrides/ is git-ignored and never committed, deployed or shared (PKR-014). This guards
against a file forced past .gitignore with "git add -f".

Exit code: 0 = no tracked file inside overrides/; 1 = at least one was found (listed above).`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}

const unknown = args.find((a) => a.startsWith('-'));
if (unknown) {
  console.error(`Unknown option "${unknown}".\n\n${USAGE}`);
  process.exit(2);
}
if (args.length > 1) {
  console.error(`Give at most one repo root.\n\n${USAGE}`);
  process.exit(2);
}
const root = args[0] ?? process.cwd();

const out = execFileSync('git', ['-C', root, 'ls-files', '--', 'overrides'], { encoding: 'utf8' });
const files = out.split('\n').filter((line) => line.length > 0);

if (files.length > 0) {
  console.error('Tracked file(s) found inside overrides/ (must never be committed):');
  for (const f of files) console.error(`  ${f}`);
  console.error('\nUntrack them, e.g.: git rm --cached <file>');
  process.exit(1);
}

console.log('OK: no tracked file inside overrides/');
process.exit(0);
