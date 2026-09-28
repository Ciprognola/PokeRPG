import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readStoryPackage, validateStory, zipFiles } from '../src/index.js';
import { library, templateDir, templateFiles } from './story-helpers.js';

describe('readStoryPackage', () => {
  const files = templateFiles();

  it('reads the template with its story_<id>/ root', () => {
    const r = readStoryPackage(files);
    expect(r.errors).toEqual([]);
    expect(r.input!.folder).toBe('story_template');
    expect(Object.keys(r.input!.characters).sort()).toEqual(['chr_rosa', 'chr_tomas']);
    expect(r.input!.characters['chr_rosa']!.sheets.map((s) => s.filename)).toContain(
      'spr_walk_body_rosa.png',
    );
    expect(r.input!.characters['chr_rosa']!.sheets.every((s) => s.bytes !== undefined)).toBe(true);
    expect(validateStory(r.input!, library).ok).toBe(true);
  });

  it('reads a package without the root folder (no folder name to compare)', () => {
    const bare = files.map((f) => ({ ...f, path: f.path.replace('story_template/', '') }));
    const r = readStoryPackage(bare);
    expect(r.input!.folder).toBeUndefined();
    expect(validateStory(r.input!, library).ok).toBe(true);
  });

  it('says what is missing', () => {
    expect(readStoryPackage([]).errors[0]).toContain('No story.json found');
    expect(
      readStoryPackage([{ path: 'x/readme.txt', data: Uint8Array.of(1) }]).input,
    ).toBeUndefined();
  });

  it('names a sheet it cannot read, and lists what it ignores', () => {
    const r = readStoryPackage([
      ...files,
      {
        path: 'story_template/characters/chr_rosa/spr_walk_extra_rosa.png',
        data: Uint8Array.of(1, 2, 3),
      },
      { path: 'story_template/notes.txt', data: Uint8Array.of(65) },
    ]);
    expect(r.errors[0]).toContain('characters/chr_rosa/spr_walk_extra_rosa.png');
    expect(r.ignored).toEqual(['story_template/notes.txt']);
  });

  it('checks the shallowest story.json when there are several', () => {
    const r = readStoryPackage([
      ...files,
      { path: 'story_template/backup/story.json', data: Uint8Array.of(123, 125) },
    ]);
    expect(r.errors[0]).toContain('Found 2 story.json files');
    expect(validateStory(r.input!, library).ok).toBe(true);
  });

  it('a story_<id> folder name is only used when it starts with story_', () => {
    const renamed = files.map((f) => ({
      ...f,
      path: f.path.replace('story_template/', 'my-story/'),
    }));
    expect(readStoryPackage(renamed).input!.folder).toBeUndefined();
  });
});

describe('command line: npm run story:check', () => {
  const repo = fileURLToPath(new URL('../../../', import.meta.url));
  const tsx = join(repo, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const run = (...args: string[]): { code: number; out: string; err: string } => {
    const r = spawnSync(process.execPath, [tsx, join(repo, 'tools', 'check-story.ts'), ...args], {
      cwd: repo,
      encoding: 'utf8',
    });
    return { code: r.status ?? -1, out: r.stdout, err: r.stderr };
  };
  const copy = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'pokerpg-story-'));
    cpSync(templateDir, join(dir, 'story_template'), { recursive: true });
    return join(dir, 'story_template');
  };

  it('validates a story folder: exit 0, no findings', () => {
    const r = run(templateDir);
    expect(r.err).toBe('');
    expect(r.out).toContain('story_template: 0 errors, 0 warnings');
    expect(r.code).toBe(0);
  }, 30_000);

  it('validates a zip', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pokerpg-zip-'));
    const zip = join(dir, 'story_template.zip');
    writeFileSync(zip, zipFiles(templateFiles()));
    const r = run(zip);
    expect(r.out).toContain('0 errors, 0 warnings');
    expect(r.code).toBe(0);
  }, 30_000);

  it('reports errors with file, line and path, and exits 1', () => {
    const dir = copy();
    const file = join(dir, 'story.json');
    const text = readFileSync(file, 'utf8');
    writeFileSync(
      file,
      text.replace(
        '"npc": "rosa",\n          "objective"',
        '"npc": "rossa",\n          "objective"',
      ),
    );
    const r = run(dir);
    expect(r.out).toMatch(
      /error · story\.json:\d+ · quests\[0\]\.tasks\[2\]\.npc · unknown NPC "rossa"/,
    );
    expect(r.out).toContain('1 error, 0 warnings');
    expect(r.code).toBe(1);
    rmSync(dir, { recursive: true, force: true });
  }, 30_000);

  it('reports a broken character with the Asset Spec message, and exits 1', () => {
    const dir = copy();
    rmSync(join(dir, 'characters', 'chr_rosa', 'spr_walk_body_rosa.png'));
    const r = run(dir);
    expect(r.out).toContain('error · characters/chr_rosa · set walk has no body sheet');
    expect(r.code).toBe(1);
    rmSync(dir, { recursive: true, force: true });
  }, 30_000);

  it('warnings alone do not fail it', () => {
    const dir = copy();
    const file = join(dir, 'story.json');
    writeFileSync(
      file,
      readFileSync(file, 'utf8').replace('"flags": ["met-rosa"', '"flags": ["spare", "met-rosa"'),
    );
    const r = run(dir);
    expect(r.out).toContain('warning · story.json:');
    expect(r.out).toContain('flag "spare" is declared but never used');
    expect(r.code).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  }, 30_000);

  it('--json prints the report', () => {
    const r = run(templateDir, '--json');
    const report = JSON.parse(r.out) as {
      ok: boolean;
      summary: { errors: number };
      storyId: string;
    };
    expect(report).toMatchObject({
      ok: true,
      storyId: 'story_template',
      summary: { errors: 0, warnings: 0 },
    });
  }, 30_000);

  it('exits 2 for things that are not a story package', () => {
    expect(run().code).toBe(2);
    expect(run(join(repo, 'nope')).code).toBe(2);
    expect(run(join(repo, 'docs')).code).toBe(2); // a folder without story.json
    expect(run(join(repo, 'package.json')).code).toBe(2); // a file that is not a zip
  }, 60_000);

  it('--help and -h print the usage on stdout and exit 0', () => {
    for (const flag of ['--help', '-h']) {
      const r = run(flag);
      expect(r.code).toBe(0);
      expect(r.err).toBe('');
      expect(r.out).toContain('npm run story:check -- <story folder | story .zip>');
      expect(r.out).toContain('templates/story_template');
      expect(r.out).toContain('until it prints "0 errors"');
    }
  }, 30_000);

  it('a missing story or an unknown option says what is wrong, then shows the usage (exit 2)', () => {
    const none = run();
    expect(none.code).toBe(2);
    expect(none.err).toContain('No story given');
    expect(none.err).toContain('Usage:');
    const bad = run(templateDir, '--fix');
    expect(bad.code).toBe(2);
    expect(bad.err).toContain('Unknown option "--fix"');
    const lib = run(templateDir, '--library');
    expect(lib.code).toBe(2);
    expect(lib.err).toContain('--library needs a folder');
  }, 60_000);

  it('tells the author what to do next', () => {
    const ok = run(templateDir);
    expect(ok.out).toContain('OK: no errors. The story is ready to import.');
    const dir = copy();
    rmSync(join(dir, 'characters', 'chr_rosa', 'spr_walk_body_rosa.png'));
    const bad = run(dir);
    expect(bad.out).toContain(
      'Fix the errors above and run the check again until it reports 0 errors.',
    );
    rmSync(dir, { recursive: true, force: true });
  }, 60_000);

  it('a folder that is not a story explains what a story package is', () => {
    const r = run(join(repo, 'docs'));
    expect(r.code).toBe(2);
    expect(r.err).toContain('Not a readable story package');
  }, 30_000);
});

describe('author stories folder (README "Writing a story")', () => {
  const repo = fileURLToPath(new URL('../../../', import.meta.url));
  const git = (...args: string[]): { code: number; out: string } => {
    const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
    return { code: r.status ?? -1, out: r.stdout };
  };
  const inGit = git('rev-parse', '--git-dir').code === 0;

  it.skipIf(!inGit)('stories/ is kept, and everything an author puts in it is git-ignored', () => {
    expect(git('check-ignore', '-q', 'stories/story_my-tale/story.json').code).toBe(0);
    expect(git('check-ignore', '-q', 'stories/story_my-tale/characters/chr_a/a.png').code).toBe(0);
    expect(git('check-ignore', '-q', 'stories/story_my-tale.zip').code).toBe(0);
    expect(git('check-ignore', '-q', 'stories/.gitkeep').code).toBe(1);
    expect(git('ls-files', 'stories/.gitkeep').out.trim()).toBe('stories/.gitkeep');
  });

  it('a story copied from the template into stories/ passes story:check', () => {
    const dir = join(repo, 'stories', 'story_template');
    cpSync(templateDir, dir, { recursive: true });
    try {
      const tsx = join(repo, 'node_modules', 'tsx', 'dist', 'cli.mjs');
      const r = spawnSync(
        process.execPath,
        [tsx, join(repo, 'tools', 'check-story.ts'), 'stories/story_template'],
        { cwd: repo, encoding: 'utf8' },
      );
      expect(r.stdout).toContain('story_template: 0 errors, 0 warnings');
      expect(r.status).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});
