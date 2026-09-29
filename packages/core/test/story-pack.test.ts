import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { unzipFiles } from '../src/index.js';
import { templateDir } from './story-helpers.js';

/**
 * `npm run story:pack` (PKR-013), run as a real process: it must write story_<id>.zip next to the
 * folder with forward-slash paths (Story Schema §1), then check the zip. The runner is
 * `node --import tsx`, the same loader the npm script uses, so no shell or `.cmd` shim is involved.
 */

// Each test starts a Node process (~0.5 s idle); the default 5 s limit flakes on a busy machine.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const script = join(repo, 'tools', 'pack-story.ts');

function pack(...args: string[]): { code: number | null; out: string } {
  const r = spawnSync(process.execPath, ['--import', 'tsx', script, ...args], {
    cwd: repo,
    encoding: 'utf8',
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

let work = '';
let folder = '';
let zip = '';

beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), 'pkr-pack-'));
  folder = join(work, 'story_template');
  zip = join(work, 'story_template.zip');
});
afterAll(() => rmSync(work, { recursive: true, force: true }));

describe('story:pack', () => {
  it('writes story_<id>.zip next to the folder, then checks it', () => {
    cpSync(templateDir, folder, { recursive: true });
    writeFileSync(join(folder, '.DS_Store'), 'junk');
    const r = pack(folder);
    expect(r.code).toBe(0);
    expect(existsSync(zip)).toBe(true);
    expect(r.out).toContain('Scritto ');
    expect(r.out).toContain('0 errori');
    expect(r.out).toContain('OK: nessun errore');

    const names = unzipFiles(new Uint8Array(readFileSync(zip))).map((f) => f.path);
    expect(names).toContain('story_template/story.json');
    expect(names.some((n) => n.startsWith('story_template/characters/chr_rosa/'))).toBe(true);
    // Story Schema §1: the folder is the root, and paths never use a backslash
    expect(names.every((n) => n.startsWith('story_template/'))).toBe(true);
    expect(names.some((n) => n.includes('\\'))).toBe(false);
    expect(names.some((n) => n.endsWith('.DS_Store'))).toBe(false);
  });

  it('gives the same bytes every run', () => {
    const first = readFileSync(zip);
    expect(pack(folder).code).toBe(0);
    expect(readFileSync(zip).equals(first)).toBe(true);
  });

  it('accepts a trailing slash on the folder', () => {
    expect(pack(`${folder}/`).code).toBe(0);
  });

  it('exits 1 when the packed story has errors, and says so', () => {
    const path = join(folder, 'story.json');
    const story = JSON.parse(readFileSync(path, 'utf8')) as { quests: unknown[] };
    story.quests = [];
    writeFileSync(path, JSON.stringify(story));
    const r = pack(folder);
    expect(r.code).toBe(1);
    expect(r.out).toContain('error ·');
    expect(r.out).toContain('Correggi gli errori sopra');
  });

  it('exits 2 with usage for a missing argument, a zip, a missing folder or no story.json', () => {
    expect(pack().code).toBe(2);
    expect(pack().out).toContain('Uso:');
    expect(pack(zip).code).toBe(2);
    expect(pack(join(work, 'nope')).code).toBe(2);
    expect(pack(join(folder, 'characters')).out).toContain('non ha story.json');
    expect(pack('--nope').code).toBe(2);
  });

  it('--help prints the usage and exits 0', () => {
    const r = pack('--help');
    expect(r.code).toBe(0);
    expect(r.out).toContain('npm run story:pack');
  });
});
