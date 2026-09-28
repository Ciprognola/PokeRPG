/* eslint-disable @typescript-eslint/no-explicit-any */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLibrary, readStoryPackage, validateStory } from '../src/index.js';
import type {
  AudioRegistry,
  Library,
  LocationAsset,
  PackageFile,
  StoryInput,
  StoryReport,
} from '../src/index.js';

const repo = fileURLToPath(new URL('../../../', import.meta.url));
export const templateDir = join(repo, 'templates', 'story_template');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** The template package files, paths starting with `story_template/`. */
export function templateFiles(): PackageFile[] {
  return walk(templateDir).map((f) => ({
    path: `story_template/${relative(templateDir, f).split(sep).join('/')}`,
    data: new Uint8Array(readFileSync(f)),
  }));
}

export function loadLibrary(): Library {
  const dir = join(repo, 'assets', 'locations');
  const locations = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as LocationAsset);
  const audio = JSON.parse(
    readFileSync(join(repo, 'assets', 'registry', 'audio.json'), 'utf8'),
  ) as AudioRegistry;
  return buildLibrary(locations, audio);
}

export const library = loadLibrary();
export const storyText: string = readFileSync(join(templateDir, 'story.json'), 'utf8');

/** The template as validator input (parsed once; characters are decoded PNGs). */
const read = readStoryPackage(templateFiles());
if (!read.input) throw new Error('template package unreadable');
export const baseInput: StoryInput = read.input;

/** Deep copy of the template's story.json as a plain object, for mutation. */
export const storyJson = (): Record<string, any> => JSON.parse(storyText) as Record<string, any>;

/** Validate the template after changing its parsed JSON (re-serialised with 2-space indent). */
export function withStory(
  change: (s: Record<string, any>) => void,
  input: Partial<StoryInput> = {},
): StoryReport {
  const s = storyJson();
  change(s);
  return validateStory({ ...baseInput, ...input, storyText: JSON.stringify(s, null, 2) }, library);
}

/** Validate modified raw text (to test JSON syntax and line numbers). */
export function withText(
  change: (t: string) => string,
  input: Partial<StoryInput> = {},
): StoryReport {
  return validateStory({ ...baseInput, ...input, storyText: change(storyText) }, library);
}

export const only = (r: StoryReport, check: string): StoryReport['findings'] =>
  r.findings.filter((f) => f.check === check);

export const hasFile = (p: string): boolean => existsSync(p);
