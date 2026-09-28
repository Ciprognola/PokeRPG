import type { PackageFile } from '../assemble.js';
import { readSheetPng } from '../import.js';
import { PngError } from '../png.js';
import type { CharacterFolder, StoryInput } from './validate.js';

/**
 * Turn the files of a `story_<id>/` folder (or zip) into the validator's input (Story Schema §1):
 *
 *   story_<id>/story.json
 *   story_<id>/characters/chr_<name>/…   exactly as the Slicer exports a character
 *
 * Paths use "/" and may or may not include the `story_<id>/` root (a zip usually does).
 */
export interface StoryPackageRead {
  input?: StoryInput;
  /** Problems that stop something being checked, in plain words. */
  errors: string[];
  /** Files that are not part of the package layout. */
  ignored: string[];
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function readStoryPackage(files: readonly PackageFile[]): StoryPackageRead {
  const norm = files.map((f) => ({
    path: f.path.replace(/\\/g, '/').replace(/^\.\//, ''),
    data: f.data,
  }));
  const storyFiles = norm.filter((f) => f.path === 'story.json' || f.path.endsWith('/story.json'));
  if (storyFiles.length === 0) {
    return {
      errors: [
        'No story.json found. A story package is a story_<id>/ folder with story.json and characters/.',
      ],
      ignored: [],
    };
  }
  // several story.json files: keep the shallowest, say so
  storyFiles.sort((a, b) => a.path.split('/').length - b.path.split('/').length);
  const main = storyFiles[0]!;
  const root = main.path.slice(0, main.path.length - 'story.json'.length);
  const errors: string[] = [];
  if (storyFiles.length > 1) {
    errors.push(`Found ${storyFiles.length} story.json files; checking only ${main.path}.`);
  }
  const folder = root === '' ? undefined : root.replace(/\/$/, '').split('/').pop();
  const characters: Record<string, CharacterFolder> = {};
  const ignored: string[] = [];
  const charRe = new RegExp(`^${escapeRe(root)}characters/([^/]+)/(.+)$`);
  for (const f of norm) {
    if (f === main) continue;
    const m = charRe.exec(f.path);
    if (!m) {
      ignored.push(f.path);
      continue;
    }
    const chr = m[1]!;
    const rest = m[2]!;
    const entry = (characters[chr] ??= { sheets: [] });
    // only the sheets matter here: atlases, character.json and report.json are regenerated
    if (rest.includes('/') || !rest.toLowerCase().endsWith('.png')) continue;
    try {
      entry.sheets.push(readSheetPng(rest, f.data));
    } catch (e) {
      errors.push(`characters/${chr}/${rest}: ${e instanceof PngError ? e.message : 'unreadable'}`);
    }
  }
  return {
    input: {
      storyText: new TextDecoder('utf-8').decode(main.data),
      storyFile: 'story.json',
      ...(folder !== undefined && folder.startsWith('story_') ? { folder } : {}),
      characters,
    },
    errors,
    ignored,
  };
}
