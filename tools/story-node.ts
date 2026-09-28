// Node helpers for the story tools: read a story folder or zip, load the asset library.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildLibrary,
  formatStoryFinding,
  readStoryPackage,
  unzipFiles,
  validateLocationAsset,
  validateStory,
  zipFiles,
} from '@pokerpg/core';
import type { AudioRegistry, Library, LocationAsset, PackageFile } from '@pokerpg/core';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** The files of a `story_<id>/` folder (paths start with the folder name) or of a zip. */
export function readStoryFiles(target: string): PackageFile[] {
  const path = resolve(target);
  if (!existsSync(path)) throw new Error(`${target} does not exist`);
  if (statSync(path).isFile()) {
    if (!/\.zip$/i.test(path)) throw new Error(`${target} is a file but not a .zip`);
    return unzipFiles(new Uint8Array(readFileSync(path)));
  }
  const root = basename(path);
  return walk(path).map((file) => ({
    path: `${root}/${relative(path, file).split(sep).join('/')}`,
    data: new Uint8Array(readFileSync(file)),
  }));
}

/**
 * `<assets>/locations/*.json` and `<assets>/registry/audio.json`. Every location file is checked
 * against Asset Spec §8.1 first; a broken library is a repo bug, so it throws with every issue.
 */
export function loadLibrary(assetsDir: string): Library {
  const dir = resolve(assetsDir);
  const locDir = join(dir, 'locations');
  const audioFile = join(dir, 'registry', 'audio.json');
  const audio: AudioRegistry = existsSync(audioFile)
    ? (JSON.parse(readFileSync(audioFile, 'utf8')) as AudioRegistry)
    : { specVersion: '0.1', music: [], sfx: [] };
  const problems: string[] = [];
  const locations = (existsSync(locDir) ? readdirSync(locDir) : [])
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const data: unknown = JSON.parse(readFileSync(join(locDir, f), 'utf8'));
      for (const i of validateLocationAsset(data, { fileName: f, music: audio.music }))
        problems.push(`${f} · ${i.path} · ${i.message}`);
      return data as LocationAsset;
    });
  if (problems.length)
    throw new Error(`Library locations break Asset Spec §8.1:\n${problems.join('\n')}`);
  return buildLibrary(locations, audio);
}

/**
 * Check a story folder or zip and print the report (text, or JSON with `json`). Returns the exit
 * code shared by `story:check` and `story:pack`: 0 = no errors, 1 = errors, 2 = not readable.
 */
export function checkStory(target: string, libValue?: string, json = false): number {
  try {
    const read = readStoryPackage(readStoryFiles(target));
    if (!read.input) {
      for (const e of read.errors) console.error(e);
      console.error(
        'Not a readable story package. Expected a story_<id>/ folder with story.json in it (or a .zip of one).',
      );
      return 2;
    }
    const assets = libValue ?? fileURLToPath(new URL('../assets', import.meta.url));
    const report = validateStory(read.input, loadLibrary(assets));
    if (json) {
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
    return report.ok ? 0 : 1;
  } catch (e) {
    console.error((e as Error).message);
    return 2;
  }
}

/** Files an OS drops into folders; never part of a story package. */
const JUNK = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

/**
 * Zip a `story_<id>/` folder into `story_<id>.zip` next to it (Story Schema §1): entries keep the
 * folder as their root, use "/" on every OS, and the bytes are deterministic (`zipFiles`).
 * Returns the zip's path and how many files went in. Throws with a plain message if the folder is
 * not a story folder.
 */
export function packStoryFolder(folder: string): { zipPath: string; files: number } {
  const path = resolve(folder);
  if (!existsSync(path)) throw new Error(`${folder} does not exist`);
  if (!statSync(path).isDirectory())
    throw new Error(`${folder} is not a folder: give the story_<id>/ folder, not a file`);
  if (!existsSync(join(path, 'story.json')))
    throw new Error(`${folder} has no story.json: give the story_<id>/ folder itself`);
  const files = readStoryFiles(path).filter((f) => !JUNK.has(basename(f.path)));
  const zipPath = join(dirname(path), `${basename(path)}.zip`);
  writeFileSync(zipPath, zipFiles(files));
  return { zipPath, files: files.length };
}
