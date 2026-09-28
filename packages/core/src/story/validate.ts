import Ajv2020 from 'ajv/dist/2020.js';
import type { ErrorObject, ValidateFunction } from 'ajv/dist/2020.js';
import type { Severity } from '../findings.js';
import { validateCharacter } from '../validate.js';
import type { SheetInput } from '../validate.js';
import { joinPath, parseJsonWithLines, pointerToPath } from './json.js';
import type { Position } from './json.js';
import { inLocation, isBlocked } from './library.js';
import type { Library, LocationAsset, Tile } from './library.js';
import { STORY_LIMITS, storySchema } from './schema.js';

/**
 * Story validator (PKR-009, docs/STORY_SCHEMA.md §11). Shared with the future importer: pure,
 * DOM-free. Structure comes from the JSON Schema; everything that needs the rest of the story or
 * the library is checked here. Messages name file, JSON path and line:
 * `story.json:84 · quests[0].tasks[2].npc · unknown NPC "rossa"`.
 */

export interface StoryFinding {
  severity: Severity;
  /** Stable machine id, see `STORY_CHECKS`. */
  check: string;
  file: string;
  /** Line in `file` (story.json findings). */
  line?: number;
  /** JSON path inside story.json. */
  path?: string;
  /** For NPC character findings: the Asset Spec frame key. */
  frameKey?: string;
  message: string;
}

export interface StoryReport {
  reportVersion: 1;
  storyId?: string;
  ok: boolean;
  summary: { errors: number; warnings: number };
  findings: StoryFinding[];
}

export interface CharacterFolder {
  /** The character's sheets, decoded, with their PNG bytes when known (as the Slicer exports them). */
  sheets: SheetInput[];
}

export interface StoryInput {
  /** Text of story.json. */
  storyText: string;
  /** Name used in messages. Default `story.json`. */
  storyFile?: string;
  /** Name of the `story_<id>` folder (or zip root), to check it matches `id`. */
  folder?: string;
  /** `chr_<name>` → the character folder's contents. */
  characters: Record<string, CharacterFolder>;
}

/** The rows of Story Schema §11, with the check ids that implement them (a test keeps these equal to the spec). */
export const STORY_CHECKS: readonly {
  row: string;
  severity: 'Error' | 'Warning';
  checks: readonly string[];
}[] = [
  { row: 'JSON is valid and matches this schema', severity: 'Error', checks: ['json', 'schema'] },
  {
    row: 'Ids unique; every reference (location, spawn, exit, area, NPC, character, flag, quest, task, scene, track, sfx) resolves',
    severity: 'Error',
    checks: ['duplicate-id', 'reference'],
  },
  {
    row: 'Every NPC character passes the Asset Spec §7 validator with zero errors',
    severity: 'Error',
    checks: ['character'],
  },
  {
    row: 'Placement, spawn and task tiles inside the location and not blocked (Asset Spec §8.1); scene `move` paths straight between points',
    severity: 'Error',
    checks: ['tile', 'path'],
  },
  {
    row: 'Line over 120 characters, objective over 60, unknown placeholder',
    severity: 'Error',
    checks: ['text'],
  },
  {
    row: 'The last dialogue of an NPC has a `when`',
    severity: 'Error',
    checks: ['dialogue-default'],
  },
  { row: 'A quest has no tasks', severity: 'Error', checks: ['quest-empty'] },
  {
    row: 'Declared flag never used · scene never used · NPC never placed',
    severity: 'Warning',
    checks: ['unused-flag', 'unused-scene', 'unplaced-npc'],
  },
  {
    row: 'Character warnings from the Asset Spec validator',
    severity: 'Warning',
    checks: ['character'],
  },
];

export function formatStoryFinding(f: StoryFinding): string {
  const where = f.line !== undefined ? `${f.file}:${f.line}` : f.file;
  return [where, f.path, f.frameKey, f.message]
    .filter((p) => p !== undefined && p !== '')
    .join(' · ');
}

// ---------------------------------------------------------------------------------------------
// Structure (JSON Schema)
// ---------------------------------------------------------------------------------------------

let compiled: ValidateFunction | undefined;
function structureValidator(): ValidateFunction {
  compiled ??= new Ajv2020({ allErrors: true, strict: false, verbose: true }).compile(storySchema);
  return compiled;
}

interface Issue {
  path: string;
  message: string;
}

/** Turn Ajv's technical errors into plain sentences, dropping the noise around them. */
function explainStructure(errors: readonly ErrorObject[]): Issue[] {
  const groups = errors.filter((e) => e.keyword === 'oneOf' || e.keyword === 'anyOf');
  const keep = errors.filter((e) => {
    if (e.keyword === 'if' || e.keyword === 'then') return false;
    if (e.schemaPath.includes('/propertyNames/') && e.keyword === 'enum') return false;
    // details of the branches of a oneOf are replaced by the oneOf's own message
    return !groups.some(
      (g) =>
        g !== e &&
        e.schemaPath.startsWith(`${g.schemaPath}/`) &&
        e.instancePath.startsWith(g.instancePath),
    );
  });
  const out: Issue[] = [];
  const seen = new Set<string>();
  const push = (path: string, message: string): void => {
    const key = `${path}|${message}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ path, message });
    }
  };
  for (const e of keep) {
    const here = pointerToPath(e.instancePath);
    const p = e.params as Record<string, unknown>;
    const hint = (e.parentSchema as Record<string, unknown> | undefined)?.['x-hint'];
    switch (e.keyword) {
      case 'required':
        push(here, `missing required field "${String(p['missingProperty'])}"`);
        break;
      case 'additionalProperties':
        push(
          joinPath(here, String(p['additionalProperty'])),
          `unknown field "${String(p['additionalProperty'])}"`,
        );
        break;
      case 'propertyNames':
        push(
          joinPath(here, String(p['propertyName'])),
          `field "${String(p['propertyName'])}" is not allowed here`,
        );
        break;
      case 'type':
        push(here, `expected ${String(p['type'])}`);
        break;
      case 'enum':
        push(here, `must be one of: ${(p['allowedValues'] as unknown[]).map(String).join(', ')}`);
        break;
      case 'const':
        push(here, `must be ${JSON.stringify(p['allowedValue'])}`);
        break;
      case 'pattern':
        push(here, typeof hint === 'string' ? hint : 'has the wrong format');
        break;
      case 'minItems':
        push(here, `needs at least ${String(p['limit'])} item${p['limit'] === 1 ? '' : 's'}`);
        break;
      case 'maxItems':
        push(here, `can have at most ${String(p['limit'])} items`);
        break;
      case 'minLength':
        push(here, 'must not be empty');
        break;
      case 'minimum':
        push(here, `must be at least ${String(p['limit'])}`);
        break;
      case 'oneOf':
      case 'anyOf':
      case 'not':
        push(here, typeof hint === 'string' ? hint : 'does not match any allowed form');
        break;
      default:
        push(here, e.message ?? `fails ${e.keyword}`);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Helpers for tolerant traversal (the story may be structurally wrong)
// ---------------------------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const tileOf = (v: unknown): Tile | undefined =>
  Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n))
    ? ([v[0], v[1]] as Tile)
    : undefined;
const keysOf = (v: unknown): string[] => (isObj(v) ? Object.keys(v) : []);

const PLACEHOLDER = /\{([^{}]*)\}/g;
const KNOWN_PLACEHOLDERS = new Set(['player.name']);

// ---------------------------------------------------------------------------------------------
// The validator
// ---------------------------------------------------------------------------------------------

interface LocEntry {
  path: string;
  asset: LocationAsset | undefined;
}

type LineCtx = { kind: 'npc'; npc: string | undefined } | { kind: 'scene' };

export function validateStory(input: StoryInput, library: Library): StoryReport {
  const file = input.storyFile ?? 'story.json';
  const findings: StoryFinding[] = [];
  let lines = new Map<string, Position>();

  const lineFor = (path: string): number | undefined => {
    let p = path;
    for (;;) {
      const at = lines.get(p);
      if (at) return at.line;
      if (p === '') return undefined;
      const cut = Math.max(p.lastIndexOf('.'), p.lastIndexOf('['));
      p = cut <= 0 ? '' : p.slice(0, cut);
    }
  };
  const add = (severity: Severity, check: string, path: string, message: string): void => {
    const line = lineFor(path);
    findings.push({
      severity,
      check,
      file,
      ...(line !== undefined ? { line } : {}),
      path,
      message,
    });
  };
  const error = (check: string, path: string, message: string): void =>
    add('error', check, path, message);

  const finish = (storyId?: string): StoryReport => {
    // Story findings in reading order, then characters; stable within a line.
    const ordered = findings
      .map((f, i) => ({ f, i }))
      .sort((a, b) => {
        const fa = a.f.file === file ? 0 : 1;
        const fb = b.f.file === file ? 0 : 1;
        if (fa !== fb) return fa - fb;
        return (a.f.line ?? 0) - (b.f.line ?? 0) || a.i - b.i;
      })
      .map((x) => x.f);
    const errors = ordered.filter((f) => f.severity === 'error').length;
    return {
      reportVersion: 1,
      ...(storyId !== undefined ? { storyId } : {}),
      ok: errors === 0,
      summary: { errors, warnings: ordered.length - errors },
      findings: ordered,
    };
  };

  // ---- 1. JSON and structure ----
  const parsed = parseJsonWithLines(input.storyText);
  if (!parsed.ok) {
    findings.push({
      severity: 'error',
      check: 'json',
      file,
      line: parsed.error.line,
      message: `not valid JSON (column ${parsed.error.col}): ${parsed.error.message}`,
    });
    return finish();
  }
  lines = parsed.lines;
  for (const d of parsed.duplicates)
    error('duplicate-id', d.path, `duplicate key "${d.path.slice(d.path.lastIndexOf('.') + 1)}"`);
  const validate = structureValidator();
  if (!validate(parsed.value)) {
    for (const issue of explainStructure(validate.errors ?? []))
      error('schema', issue.path, issue.message);
  }
  if (!isObj(parsed.value)) return finish();
  const story = parsed.value;
  const storyId = str(story['id']);

  if (input.folder !== undefined && storyId !== undefined && storyId !== input.folder) {
    error('story-id', 'id', `story id "${storyId}" does not match its folder "${input.folder}"`);
  }

  // ---- 2. Indexes and duplicate ids ----
  const locations = new Map<string, LocEntry>();
  arr(story['locations']).forEach((l, i) => {
    if (!isObj(l)) return;
    const id = str(l['id']);
    const base = `locations[${i}]`;
    const asset = str(l['asset']);
    if (asset !== undefined && !library.locations[asset])
      error('reference', `${base}.asset`, `unknown library location "${asset}"`);
    if (id === undefined) return;
    if (locations.has(id)) error('duplicate-id', `${base}.id`, `duplicate location id "${id}"`);
    else
      locations.set(id, {
        path: base,
        asset: asset !== undefined ? library.locations[asset] : undefined,
      });
  });

  const npcs = new Map<string, string>();
  arr(story['npcs']).forEach((n, i) => {
    const id = isObj(n) ? str(n['id']) : undefined;
    if (id === undefined) return;
    if (npcs.has(id)) error('duplicate-id', `npcs[${i}].id`, `duplicate NPC id "${id}"`);
    else npcs.set(id, `npcs[${i}]`);
  });

  const quests = new Map<string, Map<string, string>>();
  arr(story['quests']).forEach((q, i) => {
    if (!isObj(q)) return;
    const id = str(q['id']);
    const tasks = new Map<string, string>();
    arr(q['tasks']).forEach((t, j) => {
      const tid = isObj(t) ? str(t['id']) : undefined;
      if (tid === undefined) return;
      if (tasks.has(tid))
        error(
          'duplicate-id',
          `quests[${i}].tasks[${j}].id`,
          `duplicate task id "${tid}" in quest "${id ?? '?'}"`,
        );
      else tasks.set(tid, `quests[${i}].tasks[${j}]`);
    });
    if (id === undefined) return;
    if (quests.has(id)) error('duplicate-id', `quests[${i}].id`, `duplicate quest id "${id}"`);
    else quests.set(id, tasks);
  });

  const sceneIds = new Set(keysOf(story['scenes']));
  const declaredFlags = new Set<string>();
  arr(story['flags']).forEach((f, i) => {
    const id = str(f);
    if (id === undefined) return;
    if (declaredFlags.has(id)) error('duplicate-id', `flags[${i}]`, `duplicate flag "${id}"`);
    declaredFlags.add(id);
  });

  const usedFlags = new Set<string>();
  const usedScenes = new Set<string>();
  const shownNpcs = new Set<string>();

  // ---- reference helpers ----
  const needLocation = (id: unknown, path: string): LocEntry | undefined => {
    const s = str(id);
    if (s === undefined) return undefined;
    const loc = locations.get(s);
    if (!loc) error('reference', path, `unknown location "${s}"`);
    return loc;
  };
  const needSpawn = (loc: LocEntry | undefined, spawn: unknown, path: string): void => {
    const s = str(spawn);
    if (s !== undefined && loc?.asset && !loc.asset.spawns[s])
      error('reference', path, `unknown spawn "${s}" in ${loc.asset.id}`);
  };
  const needArea = (loc: LocEntry | undefined, area: unknown, path: string): void => {
    const s = str(area);
    if (s !== undefined && loc?.asset && !loc.asset.areas[s])
      error('reference', path, `unknown area "${s}" in ${loc.asset.id}`);
  };
  const needNpc = (id: unknown, path: string): void => {
    const s = str(id);
    if (s !== undefined && !npcs.has(s)) error('reference', path, `unknown NPC "${s}"`);
  };
  const needActor = (id: unknown, path: string): void => {
    const s = str(id);
    if (s !== undefined && s !== 'player' && !npcs.has(s))
      error('reference', path, `unknown actor "${s}" (an NPC id or "player")`);
  };
  const needScene = (id: unknown, path: string): void => {
    const s = str(id);
    if (s === undefined) return;
    usedScenes.add(s);
    if (!sceneIds.has(s)) error('reference', path, `unknown scene "${s}"`);
  };
  const useFlag = (id: string, path: string): void => {
    usedFlags.add(id);
    if (!declaredFlags.has(id)) error('reference', path, `flag "${id}" is not declared in "flags"`);
  };
  const useFlagMap = (m: unknown, path: string): void => {
    for (const k of keysOf(m)) useFlag(k, joinPath(path, k));
  };
  const checkTile = (
    loc: LocEntry | undefined,
    tile: unknown,
    path: string,
    what: string,
  ): void => {
    const t = tileOf(tile);
    if (!t || !loc?.asset) return;
    if (!inLocation(loc.asset, t))
      error(
        'tile',
        path,
        `${what} [${t[0]}, ${t[1]}] is outside ${loc.asset.id} (${loc.asset.size[0]} × ${loc.asset.size[1]})`,
      );
    else if (isBlocked(loc.asset, t))
      error('tile', path, `${what} [${t[0]}, ${t[1]}] is a blocked tile in ${loc.asset.id}`);
  };

  const checkText = (text: string, path: string): void => {
    let length = text.length;
    for (const m of text.matchAll(PLACEHOLDER)) {
      if (KNOWN_PLACEHOLDERS.has(m[1]!)) length += STORY_LIMITS.placeholderChars - m[0].length;
      else error('text', path, `unknown placeholder "${m[0]}" (only {player.name} exists in v0.1)`);
    }
    if (length > STORY_LIMITS.lineChars) {
      error(
        'text',
        path,
        `line is ${length} characters (max ${STORY_LIMITS.lineChars}; {player.name} counts as ${STORY_LIMITS.placeholderChars}). Split it into more lines`,
      );
    }
  };

  const checkLines = (value: unknown, path: string, ctx: LineCtx): void => {
    arr(value).forEach((line, i) => {
      const lp = `${path}[${i}]`;
      if (typeof line === 'string') {
        if (ctx.kind === 'scene')
          error('reference', lp, 'a line in a scene needs a "speaker": use { "speaker", "text" }');
        checkText(line, lp);
      } else if (isObj(line)) {
        const speaker = str(line['speaker']);
        if (
          speaker !== undefined &&
          speaker !== 'player' &&
          speaker !== 'narrator' &&
          !npcs.has(speaker)
        ) {
          error(
            'reference',
            `${lp}.speaker`,
            `unknown speaker "${speaker}" (an NPC id, "player" or "narrator")`,
          );
        }
        const text = str(line['text']);
        if (text !== undefined) checkText(text, `${lp}.text`);
      }
    });
  };

  const checkCondition = (c: unknown, path: string): void => {
    if (!isObj(c)) return;
    const flag = str(c['flag']);
    if (flag !== undefined) useFlag(flag, `${path}.flag`);
    const quest = str(c['quest']);
    if (quest !== undefined && !quests.has(quest))
      error('reference', `${path}.quest`, `unknown quest "${quest}"`);
    const task = str(c['task']);
    if (task !== undefined) {
      const [q, t] = task.split('.');
      const tasks = q !== undefined ? quests.get(q) : undefined;
      if (!tasks)
        error(
          'reference',
          `${path}.task`,
          `unknown quest "${q ?? ''}" in task reference "${task}"`,
        );
      else if (t === undefined || !tasks.has(t))
        error('reference', `${path}.task`, `unknown task "${task}"`);
    }
    for (const key of ['all', 'any'] as const)
      arr(c[key]).forEach((x, i) => checkCondition(x, `${path}.${key}[${i}]`));
    if (c['not'] !== undefined) checkCondition(c['not'], `${path}.not`);
  };

  // ---- 3. start and locations ----
  if (isObj(story['start'])) {
    const loc = needLocation(story['start']['location'], 'start.location');
    needSpawn(loc, story['start']['spawn'], 'start.spawn');
  }
  arr(story['locations']).forEach((l, i) => {
    if (!isObj(l) || !isObj(l['links'])) return;
    const asset = locations.get(str(l['id']) ?? '')?.asset;
    for (const [exit, link] of Object.entries(l['links'])) {
      const lp = `locations[${i}].links.${exit}`;
      if (asset && !asset.exits[exit])
        error('reference', lp, `unknown exit "${exit}" in ${asset.id}`);
      if (!isObj(link)) continue;
      const target = needLocation(link['location'], `${lp}.location`);
      needSpawn(target, link['spawn'], `${lp}.spawn`);
    }
  });

  // ---- 4. NPCs ----
  const referencedCharacters = new Set<string>();
  arr(story['npcs']).forEach((n, i) => {
    if (!isObj(n)) return;
    const base = `npcs[${i}]`;
    const id = str(n['id']);
    const character = str(n['character']);
    if (character !== undefined) {
      referencedCharacters.add(character);
      if (!input.characters[character])
        error(
          'reference',
          `${base}.character`,
          `unknown character "${character}" (no folder characters/${character})`,
        );
    }
    const placements = arr(n['placements']);
    placements.forEach((p, j) => {
      if (!isObj(p)) return;
      const pp = `${base}.placements[${j}]`;
      checkCondition(p['when'], `${pp}.when`);
      const loc = needLocation(p['location'], `${pp}.location`);
      checkTile(loc, p['tile'], `${pp}.tile`, 'tile');
      const b = p['behaviour'];
      if (isObj(b) && b['type'] === 'patrol')
        arr(b['path']).forEach((t, k) =>
          checkTile(loc, t, `${pp}.behaviour.path[${k}]`, 'patrol tile'),
        );
    });
    const dialogues = arr(n['dialogues']);
    dialogues.forEach((d, j) => {
      if (!isObj(d)) return;
      checkCondition(d['when'], `${base}.dialogues[${j}].when`);
      checkLines(d['lines'], `${base}.dialogues[${j}].lines`, { kind: 'npc', npc: id });
    });
    const last = dialogues[dialogues.length - 1];
    if (isObj(last) && last['when'] !== undefined) {
      error(
        'dialogue-default',
        `${base}.dialogues[${dialogues.length - 1}].when`,
        'the last dialogue must have no "when" (it is the default)',
      );
    }
  });

  // ---- 5. Quests and tasks ----
  arr(story['quests']).forEach((q, i) => {
    if (!isObj(q)) return;
    const base = `quests[${i}]`;
    const tasks = arr(q['tasks']);
    if (tasks.length === 0)
      error(
        'quest-empty',
        q['tasks'] === undefined ? base : `${base}.tasks`,
        `quest "${str(q['id']) ?? '?'}" has no tasks`,
      );
    tasks.forEach((t, j) => {
      if (!isObj(t)) return;
      const tp = `${base}.tasks[${j}]`;
      const objective = str(t['objective']);
      if (objective !== undefined && objective.length > STORY_LIMITS.objectiveChars) {
        error(
          'text',
          `${tp}.objective`,
          `objective is ${objective.length} characters (max ${STORY_LIMITS.objectiveChars})`,
        );
      }
      needScene(t['scene'], `${tp}.scene`);
      if (t['type'] === 'reach' || t['location'] !== undefined) {
        const loc = needLocation(t['location'], `${tp}.location`);
        needArea(loc, t['area'], `${tp}.area`);
        needSpawn(loc, t['spawn'], `${tp}.spawn`);
      }
      if (t['type'] === 'talk' || t['npc'] !== undefined) needNpc(t['npc'], `${tp}.npc`);
      if (t['lines'] !== undefined)
        checkLines(t['lines'], `${tp}.lines`, { kind: 'npc', npc: str(t['npc']) });
      if (isObj(t['onComplete'])) {
        useFlagMap(t['onComplete']['flags'], `${tp}.onComplete.flags`);
        needScene(t['onComplete']['scene'], `${tp}.onComplete.scene`);
      }
    });
  });

  // ---- 6. Scenes ----
  const straight = (path: string, points: unknown): void => {
    const tiles = arr(points).map(tileOf);
    for (let k = 1; k < tiles.length; k++) {
      const a = tiles[k - 1];
      const b = tiles[k];
      if (a && b && a[0] !== b[0] && a[1] !== b[1]) {
        error(
          'path',
          `${path}[${k}]`,
          `path is not straight: [${a[0]}, ${a[1]}] → [${b[0]}, ${b[1]}] changes both x and y`,
        );
      }
    }
  };
  if (isObj(story['scenes'])) {
    for (const [sceneId, commands] of Object.entries(story['scenes'])) {
      arr(commands).forEach((c, i) => {
        if (!isObj(c)) return;
        const cp = `scenes.${sceneId}[${i}]`;
        switch (c['cmd']) {
          case 'say':
            checkLines(c['lines'], `${cp}.lines`, { kind: 'scene' });
            break;
          case 'move':
            needActor(c['actor'], `${cp}.actor`);
            straight(`${cp}.path`, c['path']);
            break;
          case 'face':
            needActor(c['actor'], `${cp}.actor`);
            needActor(c['toward'], `${cp}.toward`);
            break;
          case 'camera':
            if (typeof c['to'] === 'string') needActor(c['to'], `${cp}.to`);
            break;
          case 'music': {
            const track = str(c['track']);
            if (track !== undefined && !library.music.includes(track))
              error('reference', `${cp}.track`, `unknown track "${track}"`);
            break;
          }
          case 'sound': {
            const sfx = str(c['sfx']);
            if (sfx !== undefined && !library.sfx.includes(sfx))
              error('reference', `${cp}.sfx`, `unknown sound effect "${sfx}"`);
            break;
          }
          case 'show': {
            needNpc(c['npc'], `${cp}.npc`);
            const npc = str(c['npc']);
            if (npc !== undefined) shownNpcs.add(npc);
            const loc = needLocation(c['location'], `${cp}.location`);
            checkTile(loc, c['tile'], `${cp}.tile`, 'tile');
            break;
          }
          case 'hide':
            needNpc(c['npc'], `${cp}.npc`);
            break;
          case 'warp': {
            const loc = needLocation(c['location'], `${cp}.location`);
            needSpawn(loc, c['spawn'], `${cp}.spawn`);
            break;
          }
          case 'flag':
            useFlagMap(c['set'], `${cp}.set`);
            break;
          default:
            break;
        }
      });
    }
  }

  // ---- 7. Triggers ----
  arr(story['triggers']).forEach((t, i) => {
    if (!isObj(t)) return;
    const tp = `triggers[${i}]`;
    checkCondition(t['when'], `${tp}.when`);
    needScene(t['scene'], `${tp}.scene`);
    if (t['on'] === 'enterArea') {
      const loc = needLocation(t['location'], `${tp}.location`);
      needArea(loc, t['area'], `${tp}.area`);
    }
    if (t['on'] === 'talk') needNpc(t['npc'], `${tp}.npc`);
  });

  // ---- 8. Warnings: unused things ----
  arr(story['flags']).forEach((f, i) => {
    const id = str(f);
    if (id !== undefined && !usedFlags.has(id))
      add('warning', 'unused-flag', `flags[${i}]`, `flag "${id}" is declared but never used`);
  });
  for (const id of sceneIds) {
    if (!usedScenes.has(id))
      add('warning', 'unused-scene', `scenes.${id}`, `scene "${id}" is never used`);
  }
  arr(story['npcs']).forEach((n, i) => {
    if (!isObj(n)) return;
    const id = str(n['id']);
    if (arr(n['placements']).length === 0 && !(id !== undefined && shownNpcs.has(id))) {
      add(
        'warning',
        'unplaced-npc',
        `npcs[${i}]`,
        `NPC "${id ?? '?'}" is never placed (no placements and no "show" command)`,
      );
    }
  });

  // ---- 9. Characters (Asset Spec §7) ----
  const characterNames = new Set([...referencedCharacters, ...Object.keys(input.characters)]);
  for (const name of [...characterNames].sort()) {
    const folder = input.characters[name];
    if (!folder) continue;
    const dir = `characters/${name}`;
    if (!referencedCharacters.has(name)) {
      findings.push({
        severity: 'warning',
        check: 'character-unused',
        file: dir,
        message: 'no NPC uses this character folder',
      });
    }
    if (folder.sheets.length === 0) {
      findings.push({
        severity: 'error',
        check: 'character',
        file: dir,
        message: 'the folder has no sheets (Asset Spec §4: spr_walk_<layer>_<name>.png)',
      });
      continue;
    }
    for (const f of validateCharacter(folder.sheets).findings) {
      findings.push({
        severity: f.severity,
        check: 'character',
        file: f.file ? `${dir}/${f.file}` : dir,
        ...(f.frameKey ? { frameKey: f.frameKey } : {}),
        message: f.message,
      });
    }
  }

  return finish(storyId);
}
