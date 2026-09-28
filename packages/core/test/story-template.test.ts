/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  composeCharacter,
  decodePng,
  extractFrames,
  packageFiles,
  prepareCharacter,
  storySchema,
  validateStory,
} from '../src/index.js';
import type { LayerId } from '../src/index.js';
import { makeRawFrames } from '../src/testing/index.js';
import { baseInput, library, storyJson, templateDir, templateFiles } from './story-helpers.js';

const schema = storySchema as any;
const defs = schema.$defs as Record<string, any>;

const variants = (def: any, key: string): [string, string[]][] =>
  def.allOf.map((v: any) => [v.if.properties[key].const, v.then.propertyNames.enum as string[]]);

/** Every field, command, task type, trigger kind, behaviour and condition form the schema allows. */
function expectedCoverage(): Set<string> {
  const out = new Set<string>();
  const props = (prefix: string, def: any): void =>
    Object.keys(def.properties).forEach((k) => out.add(`${prefix}.${k}`));
  props('top', schema);
  props('start', defs['start']);
  props('location', defs['location']);
  props('link', defs['location'].properties.links.additionalProperties);
  props('npc', defs['npc']);
  props('placement', defs['placement']);
  props('dialogue', defs['dialogue']);
  props('quest', defs['quest']);
  props('onComplete', defs['onComplete']);
  out.add('line.string').add('line.object.speaker').add('line.object.text');
  out.add('speaker.player').add('speaker.narrator').add('speaker.npc');
  out.add('placeholder.player.name');
  for (const [type, allowed] of variants(defs['behaviour'], 'type')) {
    out.add(`behaviour.${type}`);
    allowed.filter((f) => f !== 'type').forEach((f) => out.add(`behaviour.${type}.${f}`));
  }
  const taskBase = ['id', 'type', 'objective', 'onComplete'];
  taskBase.forEach((f) => out.add(`task.${f}`));
  for (const [type, allowed] of variants(defs['task'], 'type')) {
    out.add(`task.${type}`);
    allowed.filter((f) => !taskBase.includes(f)).forEach((f) => out.add(`task.${type}.${f}`));
  }
  out.add('cmd.parallel');
  for (const [name, allowed] of variants(defs['command'], 'cmd')) {
    out.add(`cmd.${name}`);
    allowed
      .filter((f) => !['cmd', 'parallel'].includes(f))
      .forEach((f) => out.add(`cmd.${name}.${f}`));
  }
  for (const f of ['when', 'once', 'scene']) out.add(`trigger.${f}`);
  for (const [on, allowed] of variants(defs['trigger'], 'on')) {
    out.add(`trigger.${on}`);
    allowed
      .filter((f) => !['on', 'when', 'once', 'scene'].includes(f))
      .forEach((f) => out.add(`trigger.${on}.${f}`));
  }
  for (const form of defs['condition'].oneOf) {
    const keys = Object.keys(form.properties);
    out.add(`cond.${keys[0]}`);
    if (form.properties.is)
      form.properties.is.enum.forEach((s: string) => out.add(`cond.${keys[0]}.is.${s}`));
  }
  // value variants inside fields
  ['out', 'in'].forEach((v) => out.add(`cmd.fade.to.${v}`));
  ['tile', 'actor', 'player'].forEach((v) => out.add(`cmd.camera.to.${v}`));
  ['id', 'null'].forEach((v) => out.add(`cmd.music.track.${v}`));
  return out;
}

const obj = (v: unknown): v is Record<string, any> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** What a story actually uses, in the same vocabulary. */
function usedCoverage(story: Record<string, any>): Set<string> {
  const used = new Set<string>();
  const each = (prefix: string, o: unknown): void => {
    if (obj(o)) Object.keys(o).forEach((k) => used.add(`${prefix}.${k}`));
  };
  const text = (t: unknown): void => {
    if (typeof t === 'string' && t.includes('{player.name}')) used.add('placeholder.player.name');
  };
  const lines = (ls: unknown[]): void =>
    ls.forEach((l: any) => {
      if (typeof l === 'string') {
        used.add('line.string');
        text(l);
      } else if (obj(l)) {
        used.add('line.object.speaker');
        used.add('line.object.text');
        text(l['text']);
        used.add(
          l['speaker'] === 'player'
            ? 'speaker.player'
            : l['speaker'] === 'narrator'
              ? 'speaker.narrator'
              : 'speaker.npc',
        );
      }
    });
  const cond = (c: any): void => {
    if (!obj(c)) return;
    const key = Object.keys(c).find((k) =>
      ['flag', 'quest', 'task', 'all', 'any', 'not'].includes(k),
    )!;
    used.add(`cond.${key}`);
    if (c['is']) used.add(`cond.${key}.is.${c['is']}`);
    (c['all'] ?? c['any'] ?? []).forEach(cond);
    if (c['not']) cond(c['not']);
  };
  each('top', story);
  each('start', story['start']);
  for (const l of story['locations'] ?? []) {
    each('location', l);
    for (const link of Object.values(l.links ?? {})) each('link', link);
  }
  for (const n of story['npcs'] ?? []) {
    each('npc', n);
    for (const p of n.placements ?? []) {
      each('placement', p);
      cond(p.when);
      if (p.behaviour) {
        used.add(`behaviour.${p.behaviour.type}`);
        Object.keys(p.behaviour)
          .filter((k) => k !== 'type')
          .forEach((k) => used.add(`behaviour.${p.behaviour.type}.${k}`));
      }
    }
    for (const d of n.dialogues ?? []) {
      each('dialogue', d);
      cond(d.when);
      lines(d.lines);
    }
  }
  for (const q of story['quests'] ?? []) {
    each('quest', q);
    for (const t of q.tasks ?? []) {
      Object.keys(t).forEach((k) =>
        ['id', 'type', 'objective', 'onComplete'].includes(k)
          ? used.add(`task.${k}`)
          : used.add(`task.${t.type}.${k}`),
      );
      used.add(`task.${t.type}`);
      if (t.lines) lines(t.lines);
      each('onComplete', t.onComplete);
    }
  }
  for (const cmds of Object.values<any[]>(story['scenes'] ?? {})) {
    for (const c of cmds) {
      used.add(`cmd.${c.cmd}`);
      Object.keys(c).forEach((k) =>
        k === 'cmd'
          ? null
          : k === 'parallel'
            ? used.add('cmd.parallel')
            : used.add(`cmd.${c.cmd}.${k}`),
      );
      if (c.cmd === 'say') lines(c.lines);
      if (c.cmd === 'fade') used.add(`cmd.fade.to.${c.to}`);
      if (c.cmd === 'camera')
        used.add(
          `cmd.camera.to.${Array.isArray(c.to) ? 'tile' : c.to === 'player' ? 'player' : 'actor'}`,
        );
      if (c.cmd === 'music') used.add(`cmd.music.track.${c.track === null ? 'null' : 'id'}`);
    }
  }
  for (const t of story['triggers'] ?? []) {
    used.add(`trigger.${t.on}`);
    Object.keys(t).forEach((k) =>
      k === 'on'
        ? null
        : ['when', 'once', 'scene'].includes(k)
          ? used.add(`trigger.${k}`)
          : used.add(`trigger.${t.on}.${k}`),
    );
    cond(t.when);
  }
  return used;
}

/** Where two files differ: first differing byte and, for PNGs, the first differing pixel. */
function describeDifference(committed: Uint8Array, generated: Uint8Array): string {
  let firstByte = -1;
  for (let i = 0; i < Math.max(committed.length, generated.length); i++) {
    if (committed[i] !== generated[i]) {
      firstByte = i;
      break;
    }
  }
  let detail = `sizes ${committed.length} vs ${generated.length}, first differing byte ${firstByte}`;
  try {
    const a = decodePng(committed);
    const b = decodePng(generated);
    let count = 0;
    let first = '';
    for (let i = 0; i < a.data.length; i++) {
      if (a.data[i] !== b.data[i]) {
        if (count === 0) {
          const px = Math.floor(i / 4);
          first = `pixel (${px % a.width}, ${Math.floor(px / a.width)}) channel ${i % 4}: committed ${a.data[i]} generated ${b.data[i]}`;
        }
        count++;
      }
    }
    detail += `; decoded pixels differ in ${count} values${count ? ` (${first})` : ' (pixel data identical, only the PNG encoding differs)'}`;
  } catch {
    detail += '; not a decodable PNG';
  }
  return detail;
}

describe('templates/story_template', () => {
  it('passes validation with zero errors and zero warnings', () => {
    const r = validateStory(baseInput, library);
    expect(r.summary).toEqual({ errors: 0, warnings: 0 });
  });

  it('uses every field, scene command, task type, trigger, behaviour and condition at least once', () => {
    const used = usedCoverage(storyJson());
    const missing = [...expectedCoverage()].filter((k) => !used.has(k)).sort();
    expect(missing).toEqual([]);
  });

  it('the coverage check can fail (a story missing a command is reported)', () => {
    const s = storyJson();
    for (const cmds of Object.values<any[]>(s.scenes)) {
      cmds.splice(0, cmds.length, ...cmds.filter((c) => c.cmd !== 'camera'));
    }
    const missing = [...expectedCoverage()].filter((k) => !usedCoverage(s).has(k));
    expect(missing).toContain('cmd.camera');
    expect(missing).toContain('cmd.camera.ms');
  });

  it('has two NPCs and two test locations', () => {
    const s = storyJson();
    expect(s.npcs).toHaveLength(2);
    expect(s.locations).toHaveLength(2);
    expect(new Set(s.locations.map((l: any) => l.asset)).size).toBe(2);
  });

  it('ships a Slicer-exported character package for each NPC', () => {
    const paths = templateFiles().map((f) => f.path);
    for (const chr of ['chr_rosa', 'chr_tomas']) {
      for (const f of ['character.json', 'report.json'])
        expect(paths).toContain(`story_template/characters/${chr}/${f}`);
      expect(
        paths.some(
          (p) =>
            p.startsWith(`story_template/characters/${chr}/spr_walk_body_`) && p.endsWith('.png'),
        ),
      ).toBe(true);
      expect(
        paths.some(
          (p) =>
            p.startsWith(`story_template/characters/${chr}/spr_walk_body_`) && p.endsWith('.json'),
        ),
      ).toBe(true);
    }
  });

  it('the committed characters are what `npm run story-template` generates', () => {
    const build = (name: string, layers: LayerId[], seed: number): Map<string, Uint8Array> => {
      const input = layers.map((layer) => ({
        layer,
        name,
        frames: extractFrames(
          makeRawFrames({
            cellWidth: 256,
            cellHeight: 320,
            background: [255, 0, 255],
            layer,
            seed,
          }),
          { allowEmpty: layer !== 'body' },
        ),
      }));
      return new Map(
        packageFiles(composeCharacter(prepareCharacter({ name, layers: input }))).map((f) => [
          f.path,
          f.data,
        ]),
      );
    };
    for (const [name, layers, seed] of [
      ['rosa', ['body', 'outfit', 'hair'], 1],
      ['tomas', ['body', 'headwear'], 2],
    ] as [string, LayerId[], number][]) {
      for (const [path, data] of build(name, layers, seed)) {
        const committed = readFileSync(join(templateDir, 'characters', path));
        if (Buffer.compare(committed, Buffer.from(data)) !== 0) {
          expect.fail(`${path}: ${describeDifference(committed, data)}`);
        }
      }
    }
  });
});
