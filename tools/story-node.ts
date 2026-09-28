// Node helpers for the story tools: read a story folder or zip, load the asset library.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';
import { buildLibrary, unzipFiles } from '@pokerpg/core';
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

/** `<assets>/locations/*.json` and `<assets>/registry/audio.json`. */
export function loadLibrary(assetsDir: string): Library {
  const dir = resolve(assetsDir);
  const locDir = join(dir, 'locations');
  const locations = existsSync(locDir)
    ? readdirSync(locDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => JSON.parse(readFileSync(join(locDir, f), 'utf8')) as LocationAsset)
    : [];
  const audioFile = join(dir, 'registry', 'audio.json');
  const audio: AudioRegistry = existsSync(audioFile)
    ? (JSON.parse(readFileSync(audioFile, 'utf8')) as AudioRegistry)
    : { specVersion: '0.1', music: [], sfx: [] };
  return buildLibrary(locations, audio);
}
