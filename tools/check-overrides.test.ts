import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Runs against real, throwaway git repos, the same way story-pack.test.ts runs pack-story.ts:
// git ls-files needs a real index, not a mock.
vi.setConfig({ testTimeout: 15_000, hookTimeout: 15_000 });

// node --import tsx resolves the "tsx" loader relative to the process's own cwd, so node must
// run with this real project as its cwd (where node_modules/tsx lives); the repo to check is
// passed as an explicit argument instead (tools/check-overrides.ts accepts a repo root).
const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const script = fileURLToPath(new URL('./check-overrides.ts', import.meta.url));

function run(
  targetRepo: string,
  ...args: string[]
): { code: number | null; out: string; err: string } {
  const r = spawnSync(process.execPath, ['--import', 'tsx', script, targetRepo, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

let target = '';
beforeEach(() => {
  target = mkdtempSync(join(tmpdir(), 'pkr-overrides-guard-'));
  execFileSync('git', ['init', '--quiet'], { cwd: target });
});
afterEach(() => rmSync(target, { recursive: true, force: true }));

describe('overrides:check', () => {
  it('passes when overrides/ has no tracked files (folder absent)', () => {
    const r = run(target);
    expect(r.code).toBe(0);
    expect(r.out).toContain('OK');
  });

  it('passes when overrides/ exists on disk but nothing in it is tracked', () => {
    mkdirSync(join(target, 'overrides'), { recursive: true });
    writeFileSync(join(target, 'overrides', 'menu_click.wav'), 'builder-own');
    const r = run(target);
    expect(r.code).toBe(0);
    expect(r.out).toContain('OK');
  });

  it('fails and names the file when one inside overrides/ is tracked (git add -f)', () => {
    mkdirSync(join(target, 'overrides'), { recursive: true });
    writeFileSync(join(target, 'overrides', 'menu_click.wav'), 'builder-own');
    execFileSync('git', ['add', '-f', 'overrides/menu_click.wav'], { cwd: target });
    const r = run(target);
    expect(r.code).toBe(1);
    expect(r.err).toContain('overrides/menu_click.wav');
  });

  it('is unaffected by tracked files outside overrides/', () => {
    writeFileSync(join(target, 'readme.txt'), 'fine');
    execFileSync('git', ['add', 'readme.txt'], { cwd: target });
    const r = run(target);
    expect(r.code).toBe(0);
  });

  it('rejects an unknown option and a second positional argument', () => {
    expect(run(target, '--nope').code).toBe(2);
    expect(run(target, '/some/other/dir').code).toBe(2);
  });

  it('--help prints usage and exits 0, before touching git', () => {
    const r = run('--help');
    expect(r.code).toBe(0);
    expect(r.out).toContain('npm run overrides:check');
  });
});
