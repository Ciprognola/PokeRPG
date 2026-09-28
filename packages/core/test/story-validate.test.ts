/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { formatStoryFinding, validateStory } from '../src/index.js';
import type { CharacterFolder, StoryReport } from '../src/index.js';
import { makeWalkSheetInput } from '../src/testing/index.js';
import { baseInput, library, only, storyText, withStory, withText } from './story-helpers.js';

/** The messages of a report, as `path · message` (line numbers are tested separately). */
const msgs = (r: StoryReport, check?: string): string[] =>
  r.findings.filter((f) => !check || f.check === check).map((f) => `${f.path} · ${f.message}`);
const errorsOf = (r: StoryReport, check: string): string[] =>
  r.findings
    .filter((f) => f.check === check && f.severity === 'error')
    .map((f) => `${f.path} · ${f.message}`);

describe('the template (passing case for every row)', () => {
  it('has zero errors and zero warnings', () => {
    const r = validateStory(baseInput, library);
    expect(r.findings.map(formatStoryFinding)).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.storyId).toBe('story_template');
    expect(r.summary).toEqual({ errors: 0, warnings: 0 });
  });
});

describe('§11 row 1 — JSON is valid and matches the schema (Error)', () => {
  it('reports a syntax error with its line', () => {
    const r = withText((t) => t.replace('"version": 1,', '"version": 1'));
    expect(r.ok).toBe(false);
    const [f] = only(r, 'json');
    expect(f).toMatchObject({ severity: 'error', file: 'story.json' });
    expect(f!.line).toBe(storyText.split('\n').findIndex((l) => l.includes('"title"')) + 1);
    expect(f!.message).toContain('not valid JSON');
  });

  it.each<[string, (s: any) => void, string]>([
    ['missing required field', (s) => delete s.title, ' · missing required field "title"'],
    ['unknown field', (s) => (s.colour = 'red'), 'colour · unknown field "colour"'],
    ['wrong type', (s) => (s.version = '1'), 'version · expected integer'],
    ['bad schemaVersion', (s) => (s.schemaVersion = '0.2'), 'schemaVersion · must be "0.1"'],
    ['bad story id', (s) => (s.id = 'Template'), 'id · must look like story_<id>'],
    [
      'bad id pattern',
      (s) => (s.flags[0] = 'Met_Rosa'),
      'flags[0] · must be lowercase letters, digits and "-"',
    ],
    ['bad language', (s) => (s.language = 'english!'), 'language · must be a BCP 47 code'],
    [
      'unknown task type',
      (s) => (s.quests[0].tasks[0].type = 'fetch'),
      'quests[0].tasks[0].type · must be one of: scene, reach, talk',
    ],
    [
      'field of another task type',
      (s) => (s.quests[0].tasks[0].npc = 'rosa'),
      'quests[0].tasks[0].npc · field "npc" is not allowed here',
    ],
    [
      'reach without area or spawn',
      (s) => delete s.quests[0].tasks[1].area,
      'quests[0].tasks[1] · a reach task needs exactly one of "area" or "spawn"',
    ],
    [
      'reach with both',
      (s) => (s.quests[0].tasks[1].spawn = 'spawn_dock'),
      'quests[0].tasks[1] · a reach task needs exactly one of "area" or "spawn"',
    ],
    [
      'talk without lines',
      (s) => delete s.quests[0].tasks[2].lines,
      'quests[0].tasks[2] · missing required field "lines"',
    ],
    [
      'unknown command',
      (s) => (s.scenes.opening[0].cmd = 'dance'),
      'scenes.opening[0].cmd · must be one of: say, move',
    ],
    [
      'field of another command',
      (s) => (s.scenes.opening[0].path = [[1, 1]]),
      'scenes.opening[0].path · field "path" is not allowed here',
    ],
    [
      'command missing a field',
      (s) => delete s.scenes['harbour-intro'][1].ms,
      'scenes.harbour-intro[1] · missing required field "ms"',
    ],
    [
      'face without dir or toward',
      (s) => delete s.scenes['rosa-returns'][5].toward,
      'scenes.rosa-returns[5] · a face command needs exactly one of "dir" or "toward"',
    ],
    ['bad tile', (s) => (s.start.spawn = 5), 'start.spawn · expected string'],
    [
      'bad tile shape',
      (s) => (s.npcs[0].placements[0].tile = [1]),
      'npcs[0].placements[0].tile · needs at least 2 items',
    ],
    [
      'bad direction',
      (s) => (s.start.facing = 'north'),
      'start.facing · must be one of: down, left, right, up',
    ],
    [
      'bad condition',
      (s) => (s.npcs[0].placements[0].when = { flag: 'a', quest: 'b' }),
      'npcs[0].placements[0].when · must be one of',
    ],
    ['no quests', (s) => (s.quests = []), 'quests · needs at least 1 item'],
    ['no locations', (s) => (s.locations = []), 'locations · needs at least 1 item'],
    [
      'bad behaviour',
      (s) => (s.npcs[0].placements[1].behaviour = { type: 'wander' }),
      'npcs[0].placements[1].behaviour · missing required field "radius"',
    ],
    [
      'bad trigger',
      (s) => delete s.triggers[1].area,
      'triggers[1] · missing required field "area"',
    ],
    [
      'bad line',
      (s) => (s.npcs[0].dialogues[3].lines[0] = 7),
      'npcs[0].dialogues[3].lines[0] · must be a string or',
    ],
    ['empty title', (s) => (s.title = ''), 'title · must not be empty'],
  ])('%s', (_name, change, expected) => {
    const r = withStory(change);
    expect(r.ok).toBe(false);
    expect(errorsOf(r, 'schema').some((m) => m.includes(expected))).toBe(true);
  });

  it('a story that is not an object is a schema error', () => {
    const r = validateStory({ ...baseInput, storyText: '[1, 2]' }, library);
    expect(only(r, 'schema')).toHaveLength(1);
  });

  it('still finds the semantic problems in a story with structural ones', () => {
    const r = withStory((s) => {
      s.colour = 'red';
      s.quests[0].tasks[2].npc = 'rossa';
    });
    expect(only(r, 'schema')).toHaveLength(1);
    expect(errorsOf(r, 'reference')).toEqual(['quests[0].tasks[2].npc · unknown NPC "rossa"']);
  });
});

describe('§11 row 2 — ids are unique (Error)', () => {
  it.each<[string, (s: any) => void, string]>([
    [
      'location',
      (s) => (s.locations[1].id = 'harbour'),
      'locations[1].id · duplicate location id "harbour"',
    ],
    ['NPC', (s) => (s.npcs[1].id = 'rosa'), 'npcs[1].id · duplicate NPC id "rosa"'],
    [
      'quest',
      (s) => (s.quests[1].id = 'find-baker'),
      'quests[1].id · duplicate quest id "find-baker"',
    ],
    [
      'task in a quest',
      (s) => (s.quests[0].tasks[1].id = 'intro'),
      'quests[0].tasks[1].id · duplicate task id "intro" in quest "find-baker"',
    ],
    ['flag', (s) => (s.flags[1] = 'met-rosa'), 'flags[1] · duplicate flag "met-rosa"'],
  ])('duplicate %s', (_n, change, expected) => {
    expect(errorsOf(withStory(change), 'duplicate-id')).toContain(expected);
  });

  it('the same task id in two different quests is fine', () => {
    expect(
      only(
        withStory((s) => (s.quests[1].tasks[0].id = 'intro')),
        'duplicate-id',
      ),
    ).toEqual([]);
  });

  it('duplicate scene ids (a repeated key in the JSON text)', () => {
    const r = withText((t) =>
      t.replace(
        '"tomas-hello": [',
        '"tour": [\n      { "cmd": "wait", "ms": 1 }\n    ],\n    "tomas-hello": [',
      ),
    );
    const [f] = only(r, 'duplicate-id');
    expect(f).toMatchObject({ path: 'scenes.tour', message: 'duplicate key "tour"' });
  });
});

describe('§11 row 2 — every reference resolves (Error)', () => {
  // [kind, mutation, expected "path · message"]
  const cases: [string, (s: any) => void, string][] = [
    [
      'location (start)',
      (s) => (s.start.location = 'habour'),
      'start.location · unknown location "habour"',
    ],
    [
      'location (placement)',
      (s) => (s.npcs[0].placements[0].location = 'nowhere'),
      'npcs[0].placements[0].location · unknown location "nowhere"',
    ],
    [
      'location (link target)',
      (s) => (s.locations[0].links.exit_house_door.location = 'shop'),
      'locations[0].links.exit_house_door.location · unknown location "shop"',
    ],
    [
      'location (task)',
      (s) => (s.quests[0].tasks[1].location = 'nowhere'),
      'quests[0].tasks[1].location · unknown location "nowhere"',
    ],
    [
      'location (trigger)',
      (s) => (s.triggers[1].location = 'nowhere'),
      'triggers[1].location · unknown location "nowhere"',
    ],
    [
      'location (show)',
      (s) => (s.scenes['rosa-returns'][2].location = 'nowhere'),
      'scenes.rosa-returns[2].location · unknown location "nowhere"',
    ],
    [
      'location (warp)',
      (s) => (s.scenes.tour[1].location = 'nowhere'),
      'scenes.tour[1].location · unknown location "nowhere"',
    ],
    [
      'library location',
      (s) => (s.locations[0].asset = 'loc_missing'),
      'locations[0].asset · unknown library location "loc_missing"',
    ],
    [
      'spawn (start)',
      (s) => (s.start.spawn = 'spawn_nope'),
      'start.spawn · unknown spawn "spawn_nope" in loc_greybox-harbour',
    ],
    [
      'spawn (link)',
      (s) => (s.locations[0].links.exit_house_door.spawn = 'spawn_nope'),
      'locations[0].links.exit_house_door.spawn · unknown spawn "spawn_nope" in loc_greybox-bakery',
    ],
    [
      'spawn (reach task)',
      (s) => (s.quests[1].tasks[0].spawn = 'spawn_nope'),
      'quests[1].tasks[0].spawn · unknown spawn "spawn_nope" in loc_greybox-harbour',
    ],
    [
      'spawn (warp)',
      (s) => (s.scenes.tour[1].spawn = 'spawn_nope'),
      'scenes.tour[1].spawn · unknown spawn "spawn_nope" in loc_greybox-bakery',
    ],
    [
      'exit',
      (s) => (s.locations[0].links.exit_moon = { location: 'bakery', spawn: 'spawn_door_inside' }),
      'locations[0].links.exit_moon · unknown exit "exit_moon" in loc_greybox-harbour',
    ],
    [
      'area (reach task)',
      (s) => (s.quests[0].tasks[1].area = 'area_moon'),
      'quests[0].tasks[1].area · unknown area "area_moon" in loc_greybox-harbour',
    ],
    [
      'area (trigger)',
      (s) => (s.triggers[1].area = 'area_moon'),
      'triggers[1].area · unknown area "area_moon" in loc_greybox-harbour',
    ],
    [
      'NPC (talk task)',
      (s) => (s.quests[0].tasks[2].npc = 'rossa'),
      'quests[0].tasks[2].npc · unknown NPC "rossa"',
    ],
    [
      'NPC (trigger)',
      (s) => (s.triggers[2].npc = 'rossa'),
      'triggers[2].npc · unknown NPC "rossa"',
    ],
    [
      'NPC (show)',
      (s) => (s.scenes['rosa-returns'][2].npc = 'rossa'),
      'scenes.rosa-returns[2].npc · unknown NPC "rossa"',
    ],
    [
      'NPC (hide)',
      (s) => (s.scenes['boat-leaves'][2].npc = 'rossa'),
      'scenes.boat-leaves[2].npc · unknown NPC "rossa"',
    ],
    [
      'actor (move)',
      (s) => (s.scenes['rosa-returns'][4].actor = 'rossa'),
      'scenes.rosa-returns[4].actor · unknown actor "rossa" (an NPC id or "player")',
    ],
    [
      'actor (face toward)',
      (s) => (s.scenes['rosa-returns'][5].toward = 'rossa'),
      'scenes.rosa-returns[5].toward · unknown actor "rossa" (an NPC id or "player")',
    ],
    [
      'actor (camera)',
      (s) => (s.scenes['harbour-intro'][2].to = 'rossa'),
      'scenes.harbour-intro[2].to · unknown actor "rossa" (an NPC id or "player")',
    ],
    [
      'character',
      (s) => (s.npcs[0].character = 'chr_ghost'),
      'npcs[0].character · unknown character "chr_ghost" (no folder characters/chr_ghost)',
    ],
    [
      'flag (condition)',
      (s) => (s.npcs[0].dialogues[1].when = { flag: 'met-nobody' }),
      'npcs[0].dialogues[1].when.flag · flag "met-nobody" is not declared in "flags"',
    ],
    [
      'flag (onComplete)',
      (s) => (s.quests[1].tasks[1].onComplete.flags = { nope: true }),
      'quests[1].tasks[1].onComplete.flags.nope · flag "nope" is not declared in "flags"',
    ],
    [
      'flag (flag command)',
      (s) => (s.scenes['boat-leaves'][5].set = { nope: true }),
      'scenes.boat-leaves[5].set.nope · flag "nope" is not declared in "flags"',
    ],
    [
      'quest',
      (s) => (s.npcs[0].dialogues[1].when = { quest: 'nope', is: 'active' }),
      'npcs[0].dialogues[1].when.quest · unknown quest "nope"',
    ],
    [
      'task (unknown quest)',
      (s) => (s.npcs[1].dialogues[0].when = { task: 'nope.talk-tomas', is: 'complete' }),
      'npcs[1].dialogues[0].when.task · unknown quest "nope" in task reference "nope.talk-tomas"',
    ],
    [
      'task (unknown task)',
      (s) => (s.npcs[1].dialogues[0].when = { task: 'deliver-note.nope', is: 'complete' }),
      'npcs[1].dialogues[0].when.task · unknown task "deliver-note.nope"',
    ],
    [
      'scene (task)',
      (s) => (s.quests[0].tasks[0].scene = 'nope'),
      'quests[0].tasks[0].scene · unknown scene "nope"',
    ],
    [
      'scene (onComplete)',
      (s) => (s.quests[0].tasks[2].onComplete.scene = 'nope'),
      'quests[0].tasks[2].onComplete.scene · unknown scene "nope"',
    ],
    [
      'scene (trigger)',
      (s) => (s.triggers[0].scene = 'nope'),
      'triggers[0].scene · unknown scene "nope"',
    ],
    [
      'track',
      (s) => (s.scenes.opening[1].track = 'mus_town_nope'),
      'scenes.opening[1].track · unknown track "mus_town_nope"',
    ],
    [
      'sfx',
      (s) => (s.scenes['harbour-intro'][4].sfx = 'sfx_nope'),
      'scenes.harbour-intro[4].sfx · unknown sound effect "sfx_nope"',
    ],
    [
      'speaker (dialogue line)',
      (s) => (s.npcs[1].dialogues[2].lines[1].speaker = 'rossa'),
      'npcs[1].dialogues[2].lines[1].speaker · unknown speaker "rossa" (an NPC id, "player" or "narrator")',
    ],
    [
      'speaker (scene line)',
      (s) => (s.scenes.opening[2].lines[0].speaker = 'rossa'),
      'scenes.opening[2].lines[0].speaker · unknown speaker "rossa" (an NPC id, "player" or "narrator")',
    ],
  ];

  it.each(cases)('%s', (_kind, change, expected) => {
    const r = withStory(change);
    expect(errorsOf(r, 'reference')).toContain(expected);
    expect(r.ok).toBe(false);
  });

  it('names file, line and JSON path, like the spec example', () => {
    const lines = storyText.split('\n');
    const talkNpc = lines.findIndex(
      (l, i) =>
        l.includes('"npc": "rosa"') && lines[i + 1]!.includes('"objective": "Find the baker"'),
    );
    const r = withText((t) =>
      t.replace(
        '"npc": "rosa",' + '\n' + '          "objective": "Find the baker"',
        '"npc": "rossa",' + '\n' + '          "objective": "Find the baker"',
      ),
    );
    const [f] = only(r, 'reference');
    expect(f!.line).toBe(talkNpc + 1);
    expect(formatStoryFinding(f!)).toBe(
      `story.json:${talkNpc + 1} · quests[0].tasks[2].npc · unknown NPC "rossa"`,
    );
  });

  it('a plain line in a scene needs a speaker', () => {
    const r = withStory((s) => (s.scenes.opening[2].lines = ['no speaker']));
    expect(errorsOf(r, 'reference')).toContain(
      'scenes.opening[2].lines[0] · a line in a scene needs a "speaker": use { "speaker", "text" }',
    );
  });

  it('the story id must match its folder', () => {
    expect(
      only(validateStory({ ...baseInput, folder: 'story_template' }, library), 'story-id'),
    ).toEqual([]);
    const [f] = only(validateStory({ ...baseInput, folder: 'story_other' }, library), 'story-id');
    expect(f!.message).toBe('story id "story_template" does not match its folder "story_other"');
  });
});

describe('§11 row 3 — NPC characters pass the Asset Spec §7 validator (Error)', () => {
  const rosa = baseInput.characters['chr_rosa']!;
  const swap = (chr: string, folder: CharacterFolder): StoryReport =>
    validateStory(
      { ...baseInput, characters: { ...baseInput.characters, [chr]: folder } },
      library,
    );

  it('a missing body sheet is an error naming the character folder', () => {
    const r = swap('chr_rosa', {
      sheets: rosa.sheets.filter((s) => !s.filename.includes('_body_')),
    });
    const errs = r.findings.filter((f) => f.check === 'character' && f.severity === 'error');
    expect(errs.map((f) => f.message)).toContain('set walk has no body sheet');
    expect(r.ok).toBe(false);
  });

  it('a sheet with an error names file and frame like the Asset Spec does', () => {
    const bad = makeWalkSheetInput('body', 'rosa', {
      frameShift: { walk_up_04: { dx: 0, dy: -3 } },
    });
    const r = swap('chr_rosa', { sheets: [bad] });
    const f = r.findings.find(
      (x) => x.check === 'character' && x.severity === 'error' && x.frameKey === 'walk_up_04',
    )!;
    expect(formatStoryFinding(f)).toBe(
      'characters/chr_rosa/spr_walk_body_rosa.png · walk_up_04 · lowest opaque row 116 (expected 119)',
    );
  });

  it('a folder with no sheets is an error', () => {
    const r = swap('chr_rosa', { sheets: [] });
    expect(
      r.findings.some(
        (f) => f.check === 'character' && f.severity === 'error' && f.message.includes('no sheets'),
      ),
    ).toBe(true);
  });

  it('the template characters pass', () => {
    expect(only(validateStory(baseInput, library), 'character')).toEqual([]);
  });
});

describe('§11 row 9 — character warnings are warnings (Warning)', () => {
  it('a warning in a character does not fail the story', () => {
    const shifted = makeWalkSheetInput('body', 'rosa', {
      frameShift: { walk_left_02: { dx: 0, dy: 1 } },
    });
    const r = validateStory(
      { ...baseInput, characters: { ...baseInput.characters, chr_rosa: { sheets: [shifted] } } },
      library,
    );
    const warn = r.findings.filter((f) => f.check === 'character');
    expect(warn.length).toBeGreaterThan(0);
    expect(
      warn.every((f) => f.severity === 'warning' && f.file.startsWith('characters/chr_rosa/')),
    ).toBe(true);
    expect(r.ok).toBe(true);
    expect(r.summary.warnings).toBe(warn.length);
  });

  it('a character folder no NPC uses is a warning', () => {
    const r = validateStory(
      {
        ...baseInput,
        characters: { ...baseInput.characters, chr_extra: baseInput.characters['chr_rosa']! },
      },
      library,
    );
    const [f] = only(r, 'character-unused');
    expect(f).toMatchObject({ severity: 'warning', file: 'characters/chr_extra' });
  });
});

describe('§11 row 4 — tiles are inside the location and not blocked; move paths are straight (Error)', () => {
  it.each<[string, (s: any) => void, string]>([
    [
      'outside (placement)',
      (s) => (s.npcs[0].placements[0].tile = [40, 2]),
      'npcs[0].placements[0].tile · tile [40, 2] is outside loc_greybox-harbour (20 × 12)',
    ],
    [
      'blocked (placement)',
      (s) => (s.npcs[0].placements[0].tile = [4, 2]),
      'npcs[0].placements[0].tile · tile [4, 2] is a blocked tile in loc_greybox-harbour',
    ],
    [
      'blocked (bakery wall)',
      (s) => (s.npcs[0].placements[1].tile = [0, 0]),
      'npcs[0].placements[1].tile · tile [0, 0] is a blocked tile in loc_greybox-bakery',
    ],
    [
      'blocked (patrol)',
      (s) =>
        (s.npcs[1].placements[0].behaviour.path = [
          [17, 7],
          [17, 10],
        ]),
      'npcs[1].placements[0].behaviour.path[1] · patrol tile [17, 10] is a blocked tile in loc_greybox-harbour',
    ],
    [
      'outside (show)',
      (s) => (s.scenes['boat-leaves'][4].tile = [13, 99]),
      'scenes.boat-leaves[4].tile · tile [13, 99] is outside loc_greybox-harbour (20 × 12)',
    ],
  ])('%s', (_n, change, expected) => {
    expect(errorsOf(withStory(change), 'tile')).toContain(expected);
  });

  it('a move path that turns diagonally is an error, a straight one is fine', () => {
    expect(
      only(
        withStory(() => {}),
        'path',
      ),
    ).toEqual([]);
    const r = withStory(
      (s) =>
        (s.scenes['rosa-returns'][4].path = [
          [9, 5],
          [10, 7],
          [11, 7],
        ]),
    );
    expect(errorsOf(r, 'path')).toEqual([
      'scenes.rosa-returns[4].path[1] · path is not straight: [9, 5] → [10, 7] changes both x and y',
    ]);
  });

  it('a one-point path and staying on the same row or column are fine', () => {
    expect(
      only(
        withStory((s) => (s.scenes['rosa-returns'][4].path = [[9, 5]])),
        'path',
      ),
    ).toEqual([]);
    expect(
      only(
        withStory(
          (s) =>
            (s.scenes['rosa-returns'][4].path = [
              [9, 5],
              [9, 5],
              [9, 9],
            ]),
        ),
        'path',
      ),
    ).toEqual([]);
  });
});

describe('§11 row 5 — text limits and placeholders (Error)', () => {
  const say = (text: string) => (s: any) => (s.npcs[0].dialogues[3].lines = [text]);

  it('120 characters pass, 121 fail', () => {
    expect(only(withStory(say('x'.repeat(120))), 'text')).toEqual([]);
    expect(errorsOf(withStory(say('x'.repeat(121))), 'text')).toEqual([
      'npcs[0].dialogues[3].lines[0] · line is 121 characters (max 120; {player.name} counts as 12). Split it into more lines',
    ]);
  });

  it('{player.name} counts as 12 characters, wherever it appears', () => {
    expect(only(withStory(say(`${'x'.repeat(108)}{player.name}`)), 'text')).toEqual([]); // 108 + 12 = 120
    expect(errorsOf(withStory(say(`${'x'.repeat(109)}{player.name}`)), 'text')).toHaveLength(1); // 121
    expect(only(withStory(say(`{player.name}${'x'.repeat(96)}{player.name}`)), 'text')).toEqual([]); // 12 + 96 + 12
  });

  it('applies to scene lines, talk-task lines and line objects', () => {
    const long = 'y'.repeat(121);
    expect(
      errorsOf(
        withStory((s) => (s.scenes.opening[2].lines[0].text = long)),
        'text',
      )[0],
    ).toContain('scenes.opening[2].lines[0].text');
    expect(
      errorsOf(
        withStory((s) => (s.quests[0].tasks[2].lines[1].text = long)),
        'text',
      )[0],
    ).toContain('quests[0].tasks[2].lines[1].text');
    expect(
      errorsOf(
        withStory((s) => (s.quests[0].tasks[2].lines[0] = long)),
        'text',
      )[0],
    ).toContain('quests[0].tasks[2].lines[0]');
  });

  it('an unknown placeholder is an error', () => {
    expect(errorsOf(withStory(say('Hello {name}')), 'text')).toEqual([
      'npcs[0].dialogues[3].lines[0] · unknown placeholder "{name}" (only {player.name} exists in v0.1)',
    ]);
    expect(only(withStory(say('Hello {player.name}')), 'text')).toEqual([]);
  });

  it('an objective is limited to 60 characters', () => {
    expect(
      only(
        withStory((s) => (s.quests[0].tasks[0].objective = 'o'.repeat(60))),
        'text',
      ),
    ).toEqual([]);
    expect(
      errorsOf(
        withStory((s) => (s.quests[0].tasks[0].objective = 'o'.repeat(61))),
        'text',
      ),
    ).toEqual(['quests[0].tasks[0].objective · objective is 61 characters (max 60)']);
  });
});

describe('§11 row 6 — the last dialogue of an NPC has no `when` (Error)', () => {
  it('passes when the last dialogue is the default', () => {
    expect(
      only(
        withStory(() => {}),
        'dialogue-default',
      ),
    ).toEqual([]);
  });

  it('fails when the last one has a condition', () => {
    const r = withStory((s) => (s.npcs[0].dialogues[3].when = { flag: 'met-rosa' }));
    expect(errorsOf(r, 'dialogue-default')).toEqual([
      'npcs[0].dialogues[3].when · the last dialogue must have no "when" (it is the default)',
    ]);
  });

  it('fails when the only dialogue has a condition; an NPC without dialogues is fine', () => {
    expect(
      errorsOf(
        withStory((s) => (s.npcs[1].dialogues = [{ when: { flag: 'met-tomas' }, lines: ['x'] }])),
        'dialogue-default',
      ),
    ).toHaveLength(1);
    expect(
      only(
        withStory((s) => delete s.npcs[1].dialogues),
        'dialogue-default',
      ),
    ).toEqual([]);
  });
});

describe('§11 row 7 — a quest has no tasks (Error)', () => {
  it('fails for an empty or missing task list and passes otherwise', () => {
    expect(
      only(
        withStory(() => {}),
        'quest-empty',
      ),
    ).toEqual([]);
    expect(
      errorsOf(
        withStory((s) => (s.quests[1].tasks = [])),
        'quest-empty',
      ),
    ).toEqual(['quests[1].tasks · quest "deliver-note" has no tasks']);
    expect(
      errorsOf(
        withStory((s) => delete s.quests[1].tasks),
        'quest-empty',
      ),
    ).toEqual(['quests[1] · quest "deliver-note" has no tasks']);
  });
});

describe('§11 row 8 — unused things are warnings (Warning)', () => {
  it('a flag declared but never used', () => {
    const r = withStory((s) => s.flags.push('spare'));
    expect(msgs(r, 'unused-flag')).toEqual(['flags[4] · flag "spare" is declared but never used']);
    expect(r.ok).toBe(true);
    expect(r.findings[0]!.severity).toBe('warning');
  });

  it('a scene never used', () => {
    const r = withStory((s) => (s.scenes.spare = [{ cmd: 'wait', ms: 1 }]));
    expect(msgs(r, 'unused-scene')).toEqual(['scenes.spare · scene "spare" is never used']);
    expect(r.ok).toBe(true);
  });

  it('an NPC never placed (no placements, and never shown by a scene)', () => {
    const r = withStory((s) => {
      s.npcs.push({ id: 'ghost', name: 'Ghost', character: 'chr_rosa' });
    });
    expect(msgs(r, 'unplaced-npc')).toEqual([
      'npcs[2] · NPC "ghost" is never placed (no placements and no "show" command)',
    ]);
    expect(r.ok).toBe(true);
  });

  it('an NPC without placements is fine if a scene shows it', () => {
    const r = withStory((s) => {
      delete s.npcs[0].placements;
      s.scenes['boat-leaves'].push({
        cmd: 'show',
        npc: 'rosa',
        location: 'harbour',
        tile: [9, 5],
        facing: 'down',
      });
    });
    expect(only(r, 'unplaced-npc')).toEqual([]);
  });

  it('a flag used only in a condition counts as used', () => {
    const r = withStory((s) => {
      s.flags.push('cond-only');
      s.npcs[1].dialogues[2].when = {
        any: [{ not: { flag: 'met-tomas' } }, { flag: 'cond-only' }],
      };
    });
    expect(only(r, 'unused-flag')).toEqual([]);
  });
});

describe('the report', () => {
  it('lists story findings in reading order and counts them', () => {
    const r = withStory((s) => {
      s.quests[0].tasks[2].npc = 'rossa';
      s.start.spawn = 'spawn_nope';
    });
    expect(r.findings.map((f) => f.path)).toEqual(['start.spawn', 'quests[0].tasks[2].npc']);
    expect(r.summary).toEqual({ errors: 2, warnings: 0 });
    expect(r.reportVersion).toBe(1);
  });
});
