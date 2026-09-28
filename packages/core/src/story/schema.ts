/**
 * The machine-readable JSON Schema of `story.json` (docs/STORY_SCHEMA.md v0.1). Authored here,
 * written to `schemas/story.schema.json` by `npm run schema`, and kept in sync with the spec by
 * `packages/core/test/story-schema-sync.test.ts`, which reads the spec's tables and compares.
 *
 * Structure only. Whatever needs the rest of the story or the library (references, tiles, text
 * length with placeholders, …) is checked by `validateStory` (§11).
 */

/** Version of docs/STORY_SCHEMA.md this schema follows. */
export const STORY_SCHEMA_VERSION = '0.3';
/** The `schemaVersion` a story.json carries: the file format version, unchanged since v0.1 (§3). */
export const STORY_FORMAT_VERSION = '0.1';

/** Text limits from Story Schema §5.1 and §6. */
export const STORY_LIMITS = {
  /** Characters per dialogue line (page), after placeholders count as `placeholderChars`. */
  lineChars: 120,
  placeholderChars: 12,
  objectiveChars: 60,
} as const;

export const DIRECTIONS_LIST = ['down', 'left', 'right', 'up'] as const;
export const BEHAVIOURS = ['static', 'look-around', 'wander', 'patrol'] as const;
export const QUEST_STATES = ['notStarted', 'active', 'complete'] as const;
export const TASK_STATES = ['active', 'complete'] as const;
export const TASK_TYPES = ['scene', 'reach', 'talk'] as const;
export const TRIGGER_KINDS = ['storyStart', 'enterArea', 'talk'] as const;
export const SCENE_COMMANDS = [
  'say',
  'move',
  'face',
  'wait',
  'fade',
  'camera',
  'music',
  'sound',
  'show',
  'hide',
  'warp',
  'flag',
] as const;

type Json = Record<string, unknown>;

const ref = (name: string): Json => ({ $ref: `#/$defs/${name}` });
const ID = '^[a-z0-9]+(-[a-z0-9]+)*$';
const NAME = '^[a-z0-9]+([_-][a-z0-9]+)*$';

/** An object whose fields are fixed; anything else is an error. */
function strict(properties: Json, required: string[] = [], extra: Json = {}): Json {
  return { type: 'object', properties, required, additionalProperties: false, ...extra };
}

/** One variant of a discriminated object: when `key` is `value`, these fields are required/allowed. */
function variant(
  key: string,
  value: string,
  allowed: string[],
  required: string[],
  props: Json = {},
  extra: Json = {},
): Json {
  return {
    if: { properties: { [key]: { const: value } }, required: [key] },
    then: {
      required,
      propertyNames: { enum: allowed },
      properties: props,
      ...extra,
    },
  };
}

const cmd = (
  name: string,
  allowed: string[],
  required: string[],
  props: Json = {},
  extra: Json = {},
): Json =>
  variant('cmd', name, ['cmd', 'parallel', ...allowed], ['cmd', ...required], props, extra);

const taskVariant = (
  type: string,
  allowed: string[],
  required: string[],
  props: Json = {},
  extra: Json = {},
): Json =>
  variant(
    'type',
    type,
    ['id', 'type', 'objective', 'onComplete', ...allowed],
    allowedRequired(required),
    props,
    extra,
  );
const allowedRequired = (r: string[]): string[] => ['id', 'type', 'objective', ...r];

const triggerVariant = (on: string, allowed: string[], required: string[]): Json =>
  variant('on', on, ['on', 'when', 'once', 'scene', ...allowed], ['on', 'scene', ...required]);

export const storySchema: Json = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://ciprognola.github.io/PokeRPG/schemas/story.schema.json',
  title: 'PokeRPG story.json',
  description: `Story Schema v${STORY_SCHEMA_VERSION} (docs/STORY_SCHEMA.md). Structure only; references, tiles and text length are checked by the story validator.`,
  ...strict(
    {
      schemaVersion: { const: STORY_FORMAT_VERSION },
      id: {
        type: 'string',
        pattern: '^story_[a-z0-9]+(-[a-z0-9]+)*$',
        'x-hint': 'must look like story_<id> (lowercase letters, digits and "-")',
      },
      version: { type: 'integer', minimum: 1 },
      title: { type: 'string', minLength: 1 },
      author: { type: 'string', minLength: 1 },
      description: { type: 'string', minLength: 1 },
      language: {
        type: 'string',
        pattern: '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$',
        'x-hint': 'must be a BCP 47 code such as "en" or "it"',
      },
      start: ref('start'),
      locations: { type: 'array', minItems: 1, items: ref('location') },
      npcs: { type: 'array', items: ref('npc') },
      flags: { type: 'array', items: ref('id') },
      quests: { type: 'array', minItems: 1, items: ref('quest') },
      scenes: { type: 'object', additionalProperties: ref('scene'), propertyNames: ref('id') },
      triggers: { type: 'array', items: ref('trigger') },
    },
    [
      'schemaVersion',
      'id',
      'version',
      'title',
      'author',
      'description',
      'language',
      'start',
      'locations',
      'quests',
    ],
  ),
  $defs: {
    id: { type: 'string', pattern: ID, 'x-hint': 'must be lowercase letters, digits and "-"' },
    /** A tile `[x, y]` in 64 px tiles, origin top-left of the location. */
    tile: { type: 'array', items: { type: 'integer', minimum: 0 }, minItems: 2, maxItems: 2 },
    direction: { enum: [...DIRECTIONS_LIST] },
    libraryLocation: {
      type: 'string',
      pattern: '^loc_[a-z0-9-]+(_[a-z0-9-]+)*$',
      'x-hint': 'must look like loc_<name>',
    },
    anchor: {
      type: 'string',
      pattern: NAME,
      'x-hint': 'must be lowercase letters, digits, "-" and "_"',
    },
    character: {
      type: 'string',
      pattern: '^chr_[a-z0-9-]+$',
      'x-hint': 'must look like chr_<name>',
    },
    track: {
      type: 'string',
      pattern: '^mus_[a-z0-9-]+(_[a-z0-9-]+)*$',
      'x-hint': 'must look like mus_<use>_<name>',
    },
    sfx: { type: 'string', pattern: '^sfx_[a-z0-9-]+$', 'x-hint': 'must look like sfx_<name>' },
    taskRef: {
      type: 'string',
      pattern: '^[a-z0-9-]+\\.[a-z0-9-]+$',
      'x-hint': 'must look like <questId>.<taskId>',
    },
    flagMap: {
      type: 'object',
      additionalProperties: { type: 'boolean' },
      propertyNames: ref('id'),
    },

    start: strict({ location: ref('id'), spawn: ref('anchor'), facing: ref('direction') }, [
      'location',
      'spawn',
      'facing',
    ]),

    location: strict(
      {
        id: ref('id'),
        asset: ref('libraryLocation'),
        links: {
          type: 'object',
          propertyNames: ref('anchor'),
          additionalProperties: strict({ location: ref('id'), spawn: ref('anchor') }, [
            'location',
            'spawn',
          ]),
        },
      },
      ['id', 'asset'],
    ),

    npc: strict(
      {
        id: ref('id'),
        name: { type: 'string', minLength: 1 },
        character: ref('character'),
        placements: { type: 'array', items: ref('placement') },
        dialogues: { type: 'array', items: ref('dialogue') },
      },
      ['id', 'name', 'character'],
    ),

    placement: strict(
      {
        when: ref('condition'),
        location: ref('id'),
        tile: ref('tile'),
        facing: ref('direction'),
        behaviour: ref('behaviour'),
      },
      ['location', 'tile', 'facing'],
    ),

    behaviour: {
      type: 'object',
      properties: { type: { enum: [...BEHAVIOURS] } },
      required: ['type'],
      allOf: [
        variant('type', 'static', ['type'], ['type']),
        variant('type', 'look-around', ['type'], ['type']),
        variant('type', 'wander', ['type', 'radius'], ['type', 'radius'], {
          radius: { type: 'integer', minimum: 1 },
        }),
        variant('type', 'patrol', ['type', 'path'], ['type', 'path'], {
          path: { type: 'array', minItems: 2, items: ref('tile') },
        }),
      ],
    },

    dialogue: strict(
      { when: ref('condition'), lines: { type: 'array', minItems: 1, items: ref('line') } },
      ['lines'],
    ),

    /** One dialogue page: a string, or `{ speaker, text }`. */
    line: {
      oneOf: [
        { type: 'string' },
        strict({ speaker: { type: 'string', minLength: 1 }, text: { type: 'string' } }, [
          'speaker',
          'text',
        ]),
      ],
      'x-hint': 'must be a string or { "speaker", "text" }',
    },

    quest: strict(
      {
        id: ref('id'),
        title: { type: 'string', minLength: 1 },
        tasks: { type: 'array', items: ref('task') },
      },
      ['id', 'title'],
    ),

    task: {
      type: 'object',
      properties: {
        id: ref('id'),
        type: { enum: [...TASK_TYPES] },
        objective: { type: 'string', minLength: 1 },
        onComplete: ref('onComplete'),
      },
      required: ['id', 'type', 'objective'],
      allOf: [
        taskVariant('scene', ['scene'], ['scene'], { scene: ref('id') }),
        taskVariant(
          'reach',
          ['location', 'area', 'spawn'],
          ['location'],
          { location: ref('id'), area: ref('anchor'), spawn: ref('anchor') },
          {
            oneOf: [{ required: ['area'] }, { required: ['spawn'] }],
            'x-hint': 'a reach task needs exactly one of "area" or "spawn"',
          },
        ),
        taskVariant('talk', ['npc', 'lines'], ['npc', 'lines'], {
          npc: ref('id'),
          lines: { type: 'array', minItems: 1, items: ref('line') },
        }),
      ],
    },

    onComplete: strict({ flags: ref('flagMap'), scene: ref('id') }),

    scene: { type: 'array', items: ref('command') },

    command: {
      type: 'object',
      properties: { cmd: { enum: [...SCENE_COMMANDS] }, parallel: { type: 'boolean' } },
      required: ['cmd'],
      allOf: [
        cmd('say', ['lines'], ['lines'], {
          lines: { type: 'array', minItems: 1, items: ref('line') },
        }),
        cmd('move', ['actor', 'path'], ['actor', 'path'], {
          actor: ref('id'),
          path: { type: 'array', minItems: 1, items: ref('tile') },
        }),
        cmd(
          'face',
          ['actor', 'dir', 'toward'],
          ['actor'],
          { actor: ref('id'), dir: ref('direction'), toward: ref('id') },
          {
            oneOf: [{ required: ['dir'] }, { required: ['toward'] }],
            'x-hint': 'a face command needs exactly one of "dir" or "toward"',
          },
        ),
        cmd('wait', ['ms'], ['ms'], { ms: { type: 'integer', minimum: 0 } }),
        cmd('fade', ['to', 'ms'], ['to'], {
          to: { enum: ['out', 'in'] },
          ms: { type: 'integer', minimum: 0 },
        }),
        cmd('camera', ['to', 'ms'], ['to'], {
          to: {
            oneOf: [ref('tile'), ref('id')],
            'x-hint': 'must be a tile [x, y], an actor id or "player"',
          },
          ms: { type: 'integer', minimum: 0 },
        }),
        cmd('music', ['track'], ['track'], {
          track: {
            oneOf: [ref('track'), { type: 'null' }],
            'x-hint': 'must be a track id (mus_…) or null to stop',
          },
        }),
        cmd('sound', ['sfx'], ['sfx'], { sfx: ref('sfx') }),
        cmd('show', ['npc', 'location', 'tile', 'facing'], ['npc', 'location', 'tile', 'facing'], {
          npc: ref('id'),
          location: ref('id'),
          tile: ref('tile'),
          facing: ref('direction'),
        }),
        cmd('hide', ['npc'], ['npc'], { npc: ref('id') }),
        cmd('warp', ['location', 'spawn', 'facing'], ['location', 'spawn'], {
          location: ref('id'),
          spawn: ref('anchor'),
          facing: ref('direction'),
        }),
        cmd('flag', ['set'], ['set'], { set: ref('flagMap') }),
      ],
    },

    trigger: {
      type: 'object',
      properties: {
        on: { enum: [...TRIGGER_KINDS] },
        once: { type: 'boolean' },
        when: ref('condition'),
        scene: ref('id'),
        location: ref('id'),
        area: ref('anchor'),
        npc: ref('id'),
      },
      required: ['on', 'scene'],
      allOf: [
        triggerVariant('storyStart', [], []),
        triggerVariant('enterArea', ['location', 'area'], ['location', 'area']),
        triggerVariant('talk', ['npc'], ['npc']),
      ],
    },

    /** Conditions (§9): exactly one of the forms. */
    condition: {
      oneOf: [
        strict({ flag: ref('id') }, ['flag']),
        strict({ quest: ref('id'), is: { enum: [...QUEST_STATES] } }, ['quest', 'is']),
        strict({ task: ref('taskRef'), is: { enum: [...TASK_STATES] } }, ['task', 'is']),
        strict({ all: { type: 'array', minItems: 1, items: ref('condition') } }, ['all']),
        strict({ any: { type: 'array', minItems: 1, items: ref('condition') } }, ['any']),
        strict({ not: ref('condition') }, ['not']),
      ],
      'x-hint':
        'must be one of { "flag" }, { "quest", "is" }, { "task", "is" }, { "all" }, { "any" } or { "not" }',
    },
  },
};
