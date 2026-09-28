/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BEHAVIOURS,
  DIRECTIONS_LIST,
  QUEST_STATES,
  STORY_CHECKS,
  STORY_FORMAT_VERSION,
  STORY_LIMITS,
  TASK_STATES,
  storySchema,
} from '../src/index.js';

/**
 * Keeps the machine-readable schema in sync with docs/STORY_SCHEMA.md: the spec's own tables are
 * parsed and compared with `storySchema`. If the PM changes the spec, this fails until the schema
 * (packages/core/src/story/schema.ts) and `npm run schema` catch up.
 */

const root = new URL('../../../', import.meta.url);
const md = readFileSync(fileURLToPath(new URL('docs/STORY_SCHEMA.md', root)), 'utf8').replace(
  /\r\n/g,
  '\n',
);
const schema = storySchema as any;
const defs = schema.$defs as Record<string, any>;

/** Text of the `## <n>.` section. */
function section(n: number): string {
  const start = md.indexOf(`\n## ${n}. `);
  if (start < 0) throw new Error(`section ${n} not found in STORY_SCHEMA.md`);
  const next = md.indexOf('\n## ', start + 5);
  return md.slice(start, next < 0 ? undefined : next);
}

/** Cells of every body row of the first table in `text`. */
function table(text: string): string[][] {
  const rows = text.split('\n').filter((l) => l.startsWith('|'));
  return rows.slice(2).map((r) =>
    r
      .replace(/\\\|/g, '@@PIPE@@')
      .split('|')
      .slice(1, -1)
      .map((c) => c.replace(/@@PIPE@@/g, '|').trim()),
  );
}

const ticks = (cell: string): string[] => [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]!);
/** Backticked words outside parentheses, minus literal values that are not field names. */
const fieldsOf = (cell: string, literals: string[] = []): string[] =>
  ticks(cell.replace(/\([^)]*\)/g, '')).filter((t) => !literals.includes(t));
const sorted = <T>(a: Iterable<T>): T[] => [...a].sort();
const variantsOf = (def: any, key: string): Map<string, any> =>
  new Map(def.allOf.map((v: any) => [v.if.properties[key].const, v.then]));

describe('Story Schema doc ↔ JSON Schema', () => {
  it('version', () => {
    // The document's own version is deliberately not mirrored in code: a docs-only bump (v0.4 →
    // v0.5) must not turn CI red. Drift is caught by the table comparisons below; here we only
    // require the header line the PM's docs always carry, so a mangled upload is noticed.
    expect(/^\*Version \d+\.\d+ · /m.test(md)).toBe(true);
    // The field is the file format version, which stays "0.1" until the format itself changes.
    const row = table(section(3)).find((r) => r[0] === '`schemaVersion`')!;
    expect(ticks(row[2]!)).toEqual([`"${schema.properties.schemaVersion.const}"`]);
    expect(schema.properties.schemaVersion.const).toBe(STORY_FORMAT_VERSION);
  });

  it('§3 top-level fields and which are required', () => {
    const rows = table(section(3));
    const all = rows.flatMap((r) => ticks(r[0]!));
    const required = rows.filter((r) => r[1] === 'Yes').flatMap((r) => ticks(r[0]!));
    expect(sorted(Object.keys(schema.properties))).toEqual(sorted(all));
    expect(sorted(schema.required)).toEqual(sorted(required));
  });

  it('§6 task types and their fields', () => {
    const rows = table(section(6));
    const variants = variantsOf(defs['task'], 'type');
    const base = ['id', 'type', 'objective', 'onComplete'];
    expect(sorted(variants.keys())).toEqual(sorted(rows.map((r) => ticks(r[0]!)[0])));
    for (const r of rows) {
      const type = ticks(r[0]!)[0]!;
      const allowed = (variants.get(type).propertyNames.enum as string[]).filter(
        (f) => !base.includes(f),
      );
      expect(sorted(allowed), `task ${type}`).toEqual(sorted(fieldsOf(r[1]!)));
    }
    expect(sorted(defs['task'].properties.type.enum)).toEqual(
      sorted(rows.map((r) => ticks(r[0]!)[0])),
    );
    // "Every task has `id` and `objective`" and `onComplete` is optional
    expect(sorted(defs['task'].required)).toEqual(['id', 'objective', 'type']);
    expect(section(6)).toContain('`onComplete` is optional');
  });

  it('§7 scene commands and their fields', () => {
    const rows = table(section(7));
    const variants = variantsOf(defs['command'], 'cmd');
    expect(sorted(variants.keys())).toEqual(sorted(rows.map((r) => ticks(r[0]!)[0])));
    for (const r of rows) {
      const cmd = ticks(r[0]!)[0]!;
      const allowed = (variants.get(cmd).propertyNames.enum as string[]).filter(
        (f) => !['cmd', 'parallel'].includes(f),
      );
      expect(sorted(allowed), `cmd ${cmd}`).toEqual(sorted(fieldsOf(r[1]!, ['player', 'null'])));
    }
    expect(sorted(defs['command'].properties.cmd.enum)).toEqual(
      sorted(rows.map((r) => ticks(r[0]!)[0])),
    );
    expect(section(7)).toContain('"parallel": true');
    expect(defs['command'].properties.parallel.type).toBe('boolean');
  });

  it('§7 fade directions and defaults', () => {
    const fade = variantsOf(defs['command'], 'cmd').get('fade');
    expect(sorted(fade.properties.to.enum)).toEqual(['in', 'out']);
    expect(table(section(7)).find((r) => r[0] === '`fade`')![1]).toContain('`out` / `in`');
  });

  it('§8 trigger kinds and their fields', () => {
    const rows = table(section(8));
    const variants = variantsOf(defs['trigger'], 'on');
    expect(sorted(variants.keys())).toEqual(sorted(rows.map((r) => ticks(r[0]!)[0])));
    for (const r of rows) {
      const on = ticks(r[0]!)[0]!;
      const allowed = (variants.get(on).propertyNames.enum as string[]).filter(
        (f) => !['on', 'when', 'once', 'scene'].includes(f),
      );
      expect(sorted(allowed), `trigger ${on}`).toEqual(sorted(fieldsOf(r[1]!)));
    }
    // `once`, `when` and `scene` appear in the spec's trigger example
    for (const f of ['once', 'when', 'scene']) expect(section(8)).toContain(`"${f}"`);
  });

  it('§9 condition forms and states', () => {
    const rows = table(section(9));
    const forms: string[][] = rows.flatMap((r) =>
      r[0]!.split('·').map((f) => [...f.matchAll(/"(\w+)"\s*:/g)].map((m) => m[1]!)),
    );
    const schemaForms = defs['condition'].oneOf.map((v: any) => Object.keys(v.properties));
    expect(sorted(schemaForms.map((f: string[]) => sorted(f).join('+')))).toEqual(
      sorted(forms.map((f) => sorted(f).join('+'))),
    );
    const statesIn = (needle: string): string[] => {
      const cell = rows.find((r) => r[0]!.includes(needle))![0]!;
      return [...cell.slice(cell.indexOf('"is"')).matchAll(/"(\w+)"/g)].map((m) => m[1]!).slice(1);
    };
    const questForm = defs['condition'].oneOf.find((v: any) => v.properties.quest);
    const taskForm = defs['condition'].oneOf.find((v: any) => v.properties.task);
    expect(sorted(questForm.properties.is.enum)).toEqual(sorted(statesIn('"quest"')));
    expect(sorted(taskForm.properties.is.enum)).toEqual(sorted(statesIn('"task"')));
    expect(sorted(QUEST_STATES)).toEqual(sorted(questForm.properties.is.enum));
    expect(sorted(TASK_STATES)).toEqual(sorted(taskForm.properties.is.enum));
  });

  it('§5 NPC behaviours', () => {
    const line = section(5)
      .split('\n')
      .find((l) => l.startsWith('- **Behaviour:**'))!;
    const listed = fieldsOf(line);
    expect(sorted(defs['behaviour'].properties.type.enum)).toEqual(sorted(listed));
    expect(sorted(BEHAVIOURS)).toEqual(sorted(listed));
    const variants = variantsOf(defs['behaviour'], 'type');
    expect(variants.get('wander').required).toContain('radius');
    expect(variants.get('patrol').required).toContain('path');
    expect(line).toContain('`radius`');
    expect(line).toContain('`path`');
  });

  it('§2 directions, id alphabet, task refs and placeholders', () => {
    const rows = table(section(2));
    const row = (name: string): string[] => rows.find((r) => r[0] === name)!;
    expect(sorted(defs['direction'].enum)).toEqual(sorted(ticks(row('Directions')[1]!)));
    expect(sorted(DIRECTIONS_LIST)).toEqual(sorted(defs['direction'].enum));
    expect(ticks(row('Ids')[1]!)).toContain('[a-z0-9-]');
    const id = new RegExp(defs['id'].pattern);
    for (const ok of ['rosa', 'find-baker', 'a1', 'x-1-y']) expect(id.test(ok), ok).toBe(true);
    for (const bad of ['Rosa', 'a_b', '-a', 'a-', 'a--b', ''])
      expect(id.test(bad), bad).toBe(false);
    expect(ticks(row('Task refs')[1]!)).toContain('<questId>.<taskId>');
    expect(new RegExp(defs['taskRef'].pattern).test('find-baker.talk-rosa')).toBe(true);
    expect(ticks(row('Placeholders')[1]!)).toEqual(['{player.name}']);
    expect(row('Tiles')[1]).toContain('[x, y]');
    expect(defs['tile'].minItems).toBe(2);
    expect(defs['tile'].maxItems).toBe(2);
  });

  it('§5.1 / §6 text limits', () => {
    expect(Number(/\*\*Max (\d+) characters per line\*\*/.exec(md)![1])).toBe(
      STORY_LIMITS.lineChars,
    );
    expect(Number(/counted at (\d+) characters/.exec(md)![1])).toBe(STORY_LIMITS.placeholderChars);
    expect(Number(/`objective` \(max (\d+) characters\)/.exec(md)![1])).toBe(
      STORY_LIMITS.objectiveChars,
    );
  });

  it('§11 validation rows are all implemented, with the same wording and severity', () => {
    const rows = table(section(11));
    expect(rows.map((r) => r[0])).toEqual(STORY_CHECKS.map((c) => c.row));
    expect(rows.map((r) => r[1])).toEqual(STORY_CHECKS.map((c) => c.severity));
  });

  it('schemas/story.schema.json is the committed copy of the schema (run `npm run schema`)', () => {
    const committed = readFileSync(
      fileURLToPath(new URL('schemas/story.schema.json', root)),
      'utf8',
    );
    expect(JSON.parse(committed)).toEqual(JSON.parse(JSON.stringify(storySchema)));
    expect(committed).toBe(`${JSON.stringify(storySchema, null, 2)}\n`);
  });
});
