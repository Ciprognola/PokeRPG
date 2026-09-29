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
    expect(f!.message).toContain('JSON non valido');
  });

  it.each<[string, (s: any) => void, string]>([
    ['missing required field', (s) => delete s.title, ' · campo obbligatorio assente "title"'],
    ['unknown field', (s) => (s.colour = 'red'), 'colour · campo sconosciuto "colour"'],
    ['wrong type', (s) => (s.version = '1'), 'version · atteso integer'],
    ['bad schemaVersion', (s) => (s.schemaVersion = '0.2'), 'schemaVersion · deve essere "0.1"'],
    ['bad story id', (s) => (s.id = 'Template'), 'id · deve avere la forma story_<id>'],
    [
      'bad id pattern',
      (s) => (s.flags[0] = 'Met_Rosa'),
      'flags[0] · deve avere solo lettere minuscole, cifre e "-"',
    ],
    ['bad language', (s) => (s.language = 'english!'), 'language · deve essere un codice BCP 47'],
    [
      'unknown task type',
      (s) => (s.quests[0].tasks[0].type = 'fetch'),
      'quests[0].tasks[0].type · deve essere uno tra: scene, reach, talk',
    ],
    [
      'field of another task type',
      (s) => (s.quests[0].tasks[0].npc = 'rosa'),
      'quests[0].tasks[0].npc · il campo "npc" non è permesso qui',
    ],
    [
      'reach without area or spawn',
      (s) => delete s.quests[0].tasks[1].area,
      'quests[0].tasks[1] · un compito reach richiede esattamente uno tra "area" e "spawn"',
    ],
    [
      'reach with both',
      (s) => (s.quests[0].tasks[1].spawn = 'spawn_dock'),
      'quests[0].tasks[1] · un compito reach richiede esattamente uno tra "area" e "spawn"',
    ],
    [
      'talk without lines',
      (s) => delete s.quests[0].tasks[2].lines,
      'quests[0].tasks[2] · campo obbligatorio assente "lines"',
    ],
    [
      'unknown command',
      (s) => (s.scenes.opening[0].cmd = 'dance'),
      'scenes.opening[0].cmd · deve essere uno tra: say, move',
    ],
    [
      'field of another command',
      (s) => (s.scenes.opening[0].path = [[1, 1]]),
      'scenes.opening[0].path · il campo "path" non è permesso qui',
    ],
    [
      'command missing a field',
      (s) => delete s.scenes['harbour-intro'][1].ms,
      'scenes.harbour-intro[1] · campo obbligatorio assente "ms"',
    ],
    [
      'face without dir or toward',
      (s) => delete s.scenes['rosa-returns'][5].toward,
      'scenes.rosa-returns[5] · un comando face richiede esattamente uno tra "dir" e "toward"',
    ],
    ['bad tile', (s) => (s.start.spawn = 5), 'start.spawn · atteso string'],
    [
      'bad tile shape',
      (s) => (s.npcs[0].placements[0].tile = [1]),
      'npcs[0].placements[0].tile · servono almeno 2 elementi',
    ],
    [
      'bad direction',
      (s) => (s.start.facing = 'north'),
      'start.facing · deve essere uno tra: down, left, right, up',
    ],
    [
      'bad condition',
      (s) => (s.npcs[0].placements[0].when = { flag: 'a', quest: 'b' }),
      'npcs[0].placements[0].when · deve essere una tra',
    ],
    ['no quests', (s) => (s.quests = []), 'quests · serve almeno 1 elemento'],
    ['no locations', (s) => (s.locations = []), 'locations · serve almeno 1 elemento'],
    [
      'bad behaviour',
      (s) => (s.npcs[0].placements[1].behaviour = { type: 'wander' }),
      'npcs[0].placements[1].behaviour · campo obbligatorio assente "radius"',
    ],
    [
      'bad trigger',
      (s) => delete s.triggers[1].area,
      'triggers[1] · campo obbligatorio assente "area"',
    ],
    [
      'bad line',
      (s) => (s.npcs[0].dialogues[3].lines[0] = 7),
      'npcs[0].dialogues[3].lines[0] · deve essere una stringa o',
    ],
    ['empty title', (s) => (s.title = ''), 'title · non può essere vuoto'],
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
    expect(errorsOf(r, 'reference')).toEqual(['quests[0].tasks[2].npc · PNG sconosciuto "rossa"']);
  });
});

describe('§11 row 2 — ids are unique (Error)', () => {
  it.each<[string, (s: any) => void, string]>([
    [
      'location',
      (s) => (s.locations[1].id = 'harbour'),
      'locations[1].id · id del luogo duplicato "harbour"',
    ],
    ['NPC', (s) => (s.npcs[1].id = 'rosa'), 'npcs[1].id · id PNG duplicato "rosa"'],
    [
      'quest',
      (s) => (s.quests[1].id = 'find-baker'),
      'quests[1].id · id della missione duplicato "find-baker"',
    ],
    [
      'task in a quest',
      (s) => (s.quests[0].tasks[1].id = 'intro'),
      'quests[0].tasks[1].id · id del compito duplicato "intro" nella missione "find-baker"',
    ],
    ['flag', (s) => (s.flags[1] = 'met-rosa'), 'flags[1] · flag duplicato "met-rosa"'],
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
    expect(f).toMatchObject({ path: 'scenes.tour', message: 'chiave duplicata "tour"' });
  });
});

describe('§11 row 2 — every reference resolves (Error)', () => {
  // [kind, mutation, expected "path · message"]
  const cases: [string, (s: any) => void, string][] = [
    [
      'location (start)',
      (s) => (s.start.location = 'habour'),
      'start.location · luogo sconosciuto "habour"',
    ],
    [
      'location (placement)',
      (s) => (s.npcs[0].placements[0].location = 'nowhere'),
      'npcs[0].placements[0].location · luogo sconosciuto "nowhere"',
    ],
    [
      'location (link target)',
      (s) => (s.locations[0].links.exit_house_door.location = 'shop'),
      'locations[0].links.exit_house_door.location · luogo sconosciuto "shop"',
    ],
    [
      'location (task)',
      (s) => (s.quests[0].tasks[1].location = 'nowhere'),
      'quests[0].tasks[1].location · luogo sconosciuto "nowhere"',
    ],
    [
      'location (trigger)',
      (s) => (s.triggers[1].location = 'nowhere'),
      'triggers[1].location · luogo sconosciuto "nowhere"',
    ],
    [
      'location (show)',
      (s) => (s.scenes['rosa-returns'][2].location = 'nowhere'),
      'scenes.rosa-returns[2].location · luogo sconosciuto "nowhere"',
    ],
    [
      'location (warp)',
      (s) => (s.scenes.tour[1].location = 'nowhere'),
      'scenes.tour[1].location · luogo sconosciuto "nowhere"',
    ],
    [
      'library location',
      (s) => (s.locations[0].asset = 'loc_missing'),
      'locations[0].asset · luogo della libreria sconosciuto "loc_missing"',
    ],
    [
      'spawn (start)',
      (s) => (s.start.spawn = 'spawn_nope'),
      'start.spawn · punto di comparsa sconosciuto "spawn_nope" in loc_greybox-harbour',
    ],
    [
      'spawn (link)',
      (s) => (s.locations[0].links.exit_house_door.spawn = 'spawn_nope'),
      'locations[0].links.exit_house_door.spawn · punto di comparsa sconosciuto "spawn_nope" in loc_greybox-bakery',
    ],
    [
      'spawn (reach task)',
      (s) => (s.quests[1].tasks[0].spawn = 'spawn_nope'),
      'quests[1].tasks[0].spawn · punto di comparsa sconosciuto "spawn_nope" in loc_greybox-harbour',
    ],
    [
      'spawn (warp)',
      (s) => (s.scenes.tour[1].spawn = 'spawn_nope'),
      'scenes.tour[1].spawn · punto di comparsa sconosciuto "spawn_nope" in loc_greybox-bakery',
    ],
    [
      'exit',
      (s) => (s.locations[0].links.exit_moon = { location: 'bakery', spawn: 'spawn_door_inside' }),
      'locations[0].links.exit_moon · uscita sconosciuta "exit_moon" in loc_greybox-harbour',
    ],
    [
      'area (reach task)',
      (s) => (s.quests[0].tasks[1].area = 'area_moon'),
      'quests[0].tasks[1].area · area sconosciuta "area_moon" in loc_greybox-harbour',
    ],
    [
      'area (trigger)',
      (s) => (s.triggers[1].area = 'area_moon'),
      'triggers[1].area · area sconosciuta "area_moon" in loc_greybox-harbour',
    ],
    [
      'NPC (talk task)',
      (s) => (s.quests[0].tasks[2].npc = 'rossa'),
      'quests[0].tasks[2].npc · PNG sconosciuto "rossa"',
    ],
    [
      'NPC (trigger)',
      (s) => (s.triggers[2].npc = 'rossa'),
      'triggers[2].npc · PNG sconosciuto "rossa"',
    ],
    [
      'NPC (show)',
      (s) => (s.scenes['rosa-returns'][2].npc = 'rossa'),
      'scenes.rosa-returns[2].npc · PNG sconosciuto "rossa"',
    ],
    [
      'NPC (hide)',
      (s) => (s.scenes['boat-leaves'][2].npc = 'rossa'),
      'scenes.boat-leaves[2].npc · PNG sconosciuto "rossa"',
    ],
    [
      'actor (move)',
      (s) => (s.scenes['rosa-returns'][4].actor = 'rossa'),
      'scenes.rosa-returns[4].actor · attore sconosciuto "rossa" (un id PNG o "player")',
    ],
    [
      'actor (face toward)',
      (s) => (s.scenes['rosa-returns'][5].toward = 'rossa'),
      'scenes.rosa-returns[5].toward · attore sconosciuto "rossa" (un id PNG o "player")',
    ],
    [
      'actor (camera)',
      (s) => (s.scenes['harbour-intro'][2].to = 'rossa'),
      'scenes.harbour-intro[2].to · attore sconosciuto "rossa" (un id PNG o "player")',
    ],
    [
      'character',
      (s) => (s.npcs[0].character = 'chr_ghost'),
      'npcs[0].character · personaggio sconosciuto "chr_ghost" (nessuna cartella characters/chr_ghost)',
    ],
    [
      'flag (condition)',
      (s) => (s.npcs[0].dialogues[1].when = { flag: 'met-nobody' }),
      'npcs[0].dialogues[1].when.flag · il flag "met-nobody" non è dichiarato in "flags"',
    ],
    [
      'flag (onComplete)',
      (s) => (s.quests[1].tasks[1].onComplete.flags = { nope: true }),
      'quests[1].tasks[1].onComplete.flags.nope · il flag "nope" non è dichiarato in "flags"',
    ],
    [
      'flag (flag command)',
      (s) => (s.scenes['boat-leaves'][5].set = { nope: true }),
      'scenes.boat-leaves[5].set.nope · il flag "nope" non è dichiarato in "flags"',
    ],
    [
      'quest',
      (s) => (s.npcs[0].dialogues[1].when = { quest: 'nope', is: 'active' }),
      'npcs[0].dialogues[1].when.quest · missione sconosciuta "nope"',
    ],
    [
      'task (unknown quest)',
      (s) => (s.npcs[1].dialogues[0].when = { task: 'nope.talk-tomas', is: 'complete' }),
      'npcs[1].dialogues[0].when.task · missione sconosciuta "nope" nel riferimento al compito "nope.talk-tomas"',
    ],
    [
      'task (unknown task)',
      (s) => (s.npcs[1].dialogues[0].when = { task: 'deliver-note.nope', is: 'complete' }),
      'npcs[1].dialogues[0].when.task · compito sconosciuto "deliver-note.nope"',
    ],
    [
      'scene (task)',
      (s) => (s.quests[0].tasks[0].scene = 'nope'),
      'quests[0].tasks[0].scene · scena sconosciuta "nope"',
    ],
    [
      'scene (onComplete)',
      (s) => (s.quests[0].tasks[2].onComplete.scene = 'nope'),
      'quests[0].tasks[2].onComplete.scene · scena sconosciuta "nope"',
    ],
    [
      'scene (trigger)',
      (s) => (s.triggers[0].scene = 'nope'),
      'triggers[0].scene · scena sconosciuta "nope"',
    ],
    [
      'track',
      (s) => (s.scenes.opening[1].track = 'mus_town_nope'),
      'scenes.opening[1].track · traccia sconosciuta "mus_town_nope"',
    ],
    [
      'sfx',
      (s) => (s.scenes['harbour-intro'][4].sfx = 'sfx_nope'),
      'scenes.harbour-intro[4].sfx · effetto sonoro sconosciuto "sfx_nope"',
    ],
    [
      'speaker (dialogue line)',
      (s) => (s.npcs[1].dialogues[2].lines[1].speaker = 'rossa'),
      'npcs[1].dialogues[2].lines[1].speaker · speaker sconosciuto "rossa" (un id PNG, "player" o "narrator")',
    ],
    [
      'speaker (scene line)',
      (s) => (s.scenes.opening[2].lines[0].speaker = 'rossa'),
      'scenes.opening[2].lines[0].speaker · speaker sconosciuto "rossa" (un id PNG, "player" o "narrator")',
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
        l.includes('"npc": "rosa"') && lines[i + 1]!.includes('"objective": "Trova il fornaio"'),
    );
    const r = withText((t) =>
      t.replace(
        '"npc": "rosa",' + '\n' + '          "objective": "Trova il fornaio"',
        '"npc": "rossa",' + '\n' + '          "objective": "Trova il fornaio"',
      ),
    );
    const [f] = only(r, 'reference');
    expect(f!.line).toBe(talkNpc + 1);
    expect(formatStoryFinding(f!)).toBe(
      `story.json:${talkNpc + 1} · quests[0].tasks[2].npc · PNG sconosciuto "rossa"`,
    );
  });

  it('a plain line in a scene needs a speaker', () => {
    const r = withStory((s) => (s.scenes.opening[2].lines = ['no speaker']));
    expect(errorsOf(r, 'reference')).toContain(
      'scenes.opening[2].lines[0] · una battuta in una scena richiede uno "speaker": usa { "speaker", "text" }',
    );
  });

  it('the story id must match its folder', () => {
    expect(
      only(validateStory({ ...baseInput, folder: 'story_template' }, library), 'story-id'),
    ).toEqual([]);
    const [f] = only(validateStory({ ...baseInput, folder: 'story_other' }, library), 'story-id');
    expect(f!.message).toBe(
      'l\'id della storia "story_template" non corrisponde alla cartella "story_other"',
    );
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
    expect(errs.map((f) => f.message)).toContain('il set walk non ha il foglio body');
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
      'characters/chr_rosa/spr_walk_body_rosa.png · walk_up_04 · riga opaca più bassa 116 (attesa 119)',
    );
  });

  it('a folder with no sheets is an error', () => {
    const r = swap('chr_rosa', { sheets: [] });
    expect(
      r.findings.some(
        (f) =>
          f.check === 'character' && f.severity === 'error' && f.message.includes('non ha fogli'),
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
      'npcs[0].placements[0].tile · la casella [40, 2] è fuori da loc_greybox-harbour (20 × 12)',
    ],
    [
      'blocked (placement)',
      (s) => (s.npcs[0].placements[0].tile = [4, 2]),
      'npcs[0].placements[0].tile · la casella [4, 2] è una casella bloccata in loc_greybox-harbour',
    ],
    [
      'blocked (bakery wall)',
      (s) => (s.npcs[0].placements[1].tile = [0, 0]),
      'npcs[0].placements[1].tile · la casella [0, 0] è una casella bloccata in loc_greybox-bakery',
    ],
    [
      'blocked (patrol)',
      (s) =>
        (s.npcs[1].placements[0].behaviour.path = [
          [17, 7],
          [17, 10],
        ]),
      'npcs[1].placements[0].behaviour.path[1] · la casella del patrol [17, 10] è una casella bloccata in loc_greybox-harbour',
    ],
    [
      'outside (show)',
      (s) => (s.scenes['boat-leaves'][4].tile = [13, 99]),
      'scenes.boat-leaves[4].tile · la casella [13, 99] è fuori da loc_greybox-harbour (20 × 12)',
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
      'scenes.rosa-returns[4].path[1] · il percorso non è rettilineo: [9, 5] → [10, 7] cambia sia x che y',
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
      'npcs[0].dialogues[3].lines[0] · la battuta è di 121 caratteri (massimo 120; {player.name} conta 12). Dividila in più battute',
    ]);
  });

  it('an accented letter counts as 1 character (Unicode NFC), precomposed or not', () => {
    // Precomposed form: "è" is already a single code point (1 UTF-16 unit).
    expect(only(withStory(say('è'.repeat(120))), 'text')).toEqual([]);
    expect(errorsOf(withStory(say('è'.repeat(121))), 'text')).toHaveLength(1);
    // Decomposed form: base letter "e" + a combining acute accent (U+0301) is 2 UTF-16 units
    // that *look* like one "é" to the reader. Without NFC normalisation this would measure as
    // 240 characters, not 120, and wrongly reject a line the author sees as exactly the limit.
    const decomposed = 'é'.repeat(120);
    expect(decomposed.length).toBe(240); // sanity check: raw JS length before normalising
    expect(only(withStory(say(decomposed)), 'text')).toEqual([]);
    expect(errorsOf(withStory(say(`${decomposed}x`)), 'text')).toHaveLength(1);
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
      'npcs[0].dialogues[3].lines[0] · segnaposto sconosciuto "{name}" (in v0.1 esiste solo {player.name})',
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
    ).toEqual(["quests[0].tasks[0].objective · l'obiettivo è di 61 caratteri (massimo 60)"]);
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
      'npcs[0].dialogues[3].when · l\'ultimo dialogo non deve avere "when" (è quello predefinito)',
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
    ).toEqual(['quests[1].tasks · la missione "deliver-note" non ha compiti']);
    expect(
      errorsOf(
        withStory((s) => delete s.quests[1].tasks),
        'quest-empty',
      ),
    ).toEqual(['quests[1] · la missione "deliver-note" non ha compiti']);
  });
});

describe('§11 row 8 — unused things are warnings (Warning)', () => {
  it('a flag declared but never used', () => {
    const r = withStory((s) => s.flags.push('spare'));
    expect(msgs(r, 'unused-flag')).toEqual([
      'flags[4] · il flag "spare" è dichiarato ma non è mai usato',
    ]);
    expect(r.ok).toBe(true);
    expect(r.findings[0]!.severity).toBe('warning');
  });

  it('a scene never used', () => {
    const r = withStory((s) => (s.scenes.spare = [{ cmd: 'wait', ms: 1 }]));
    expect(msgs(r, 'unused-scene')).toEqual(['scenes.spare · la scena "spare" non è mai usata']);
    expect(r.ok).toBe(true);
  });

  it('an NPC never placed (no placements, and never shown by a scene)', () => {
    const r = withStory((s) => {
      s.npcs.push({ id: 'ghost', name: 'Ghost', character: 'chr_rosa' });
    });
    expect(msgs(r, 'unplaced-npc')).toEqual([
      'npcs[2] · il PNG "ghost" non è mai posizionato (nessun placement e nessun comando "show")',
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
