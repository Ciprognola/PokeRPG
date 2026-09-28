# Story validator and Story Template (PKR-009)

Implements `docs/STORY_SCHEMA.md` §10–§11 (the document's own version is not tracked in code; the `story.json` `schemaVersion` field is the file format version and stays `"0.1"`, `STORY_FORMAT_VERSION`). The runtime rules of §6.1/§7.1 are in [story-runtime-rules.md](story-runtime-rules.md). Code: `packages/core/src/story/` (pure, DOM-free, shared with the future
importer). Runtime playback is out of scope (M4–M5).

## Who runs it

The story pipeline is Project Brief §3: the author clones the repo, their **own Claude Code** builds the package from the Story Template and Story Schema, and runs `npm run story:check` until it reports 0 errors; the in-app importer then validates the same package again with the same code (`packages/core`). The Story Prompt Kit (PM-owned) tells the author's Claude Code to do exactly that. Players who only play never run it.

## Use

```
npm run story:check -- <story_<id> folder | story_<id>.zip> [--library <assets dir>] [--json]
```

`npm run story:check -- --help` prints the usage, options, examples and exit codes; no arguments, an unknown option or a missing `--library` value prints what is wrong followed by the same usage (exit 2). In text mode the last line says what to do next ("Fix the errors above and run the check again until it reports 0 errors." or "OK: no errors. The story is ready to import."); `--json` output is unchanged.

Exit code 0 = no errors (warnings allowed), 1 = errors, 2 = not a readable package.

```
npm run story:pack -- <story_<id> folder>
```

`story:pack` (`tools/pack-story.ts`, `packStoryFolder` in `tools/story-node.ts`) writes `story_<id>.zip` next to the folder, then runs the same check on the zip (the shared `checkStory`), so its exit code is the check's (0 / 1), or 2 if the folder can't be packed. Entries keep `story_<id>/` as their root and use `/` on every OS (paths are normalised when the folder is read); the bytes are deterministic (`zipFiles`: sorted, fixed timestamp), so packing twice gives the same file. OS junk (`.DS_Store`, `Thumbs.db`, `desktop.ini`) is left out. A zip is written even when the check then finds errors; the exit code 1 and the closing message say it is not to be shared. Tests: `story-pack.test.ts` runs the CLI as a real process.

Findings look like
`error · story.json:84 · quests[0].tasks[2].npc · unknown NPC "rossa"`; character findings use the Asset Spec form
`error · characters/chr_rosa/spr_walk_body_rosa.png · walk_up_04 · lowest opaque row 116 (expected 119)`.

In code: `readStoryPackage(files)` → `StoryInput`, then `validateStory(input, library)` → `StoryReport`
(`{ reportVersion: 1, storyId, ok, summary, findings[] }`, each finding `{ severity, check, file, line?, path?, frameKey?, message }`).

## How it checks

1. **Parse** (`json.ts`): a strict JSON parser that records the line of every value (`quests[0].tasks[2].npc`). Syntax errors
   and repeated keys (two scenes with the same id) are reported with their line.
2. **Structure** (`schema.ts`, checked with Ajv): the JSON Schema. Objects with variants (`task.type`, `cmd`, `trigger.on`,
   `behaviour.type`) use `if/then`, so an error says `missing required field "npc"` or `field "path" is not allowed here`
   instead of a wall of "does not match" noise. Ajv's messages are rewritten into plain sentences (`explainStructure`).
3. **Meaning** (`validate.ts`): references, tiles, text limits, dialogue defaults, empty quests, unused things. It is
   written to tolerate a story that already failed the structure check, so one run reports everything.
4. **Characters**: each NPC's `characters/chr_<name>/` folder goes through the Asset Spec §7 validator (`validateCharacter`).
   Its errors stay errors and its warnings stay warnings.

| §11 row                                                        | check id(s)                                   | severity |
| -------------------------------------------------------------- | --------------------------------------------- | -------- |
| JSON is valid and matches the schema                           | `json`, `schema`                              | error    |
| Ids unique; every reference resolves                           | `duplicate-id`, `reference`                   | error    |
| NPC characters pass Asset Spec §7                              | `character`                                   | error    |
| Tiles inside the location and not blocked; move paths straight | `tile`, `path`                                | error    |
| Line > 120, objective > 60, unknown placeholder                | `text`                                        | error    |
| Last dialogue has a `when`                                     | `dialogue-default`                            | error    |
| A quest has no tasks                                           | `quest-empty`                                 | error    |
| Declared flag / scene / NPC unused                             | `unused-flag`, `unused-scene`, `unplaced-npc` | warning  |
| Character warnings                                             | `character`                                   | warning  |

Also checked (implied by the spec, not a §11 row): `id` equals its `story_<id>` folder (`story-id`), flags used but not declared
(`reference`, §3), a plain string line in a scene has no speaker (`reference`, §5.1), a character folder no NPC uses
(`character-unused`, warning), an empty character folder (`character`).

### Choices where the spec is silent

- **Text length**: `{player.name}` counts as 12 characters (§5.1); the length is `String.length` of the text.
- **What a plain string line means**: in an NPC dialogue or a `talk` task it is spoken by that NPC; in a scene a `speaker` is
  required.
- **`move` and `camera` tiles in scenes are not checked against a location's collision grid**: the actor's location is only
  known at run time. Paths are checked for straightness between consecutive points; the first point is not compared with the
  actor's start. Tiles that name a location (`placements`, `show`, patrol paths) are checked.
- **Id shapes** enforced by the schema: library locations `loc_<name>`, characters `chr_<name>`, tracks `mus_<use>_<name>`
  (Asset Spec §8), sound effects `sfx_<name>` (Story Schema §12.2, still to be added to the Asset Spec), spawns/exits/areas
  lowercase with `-` and `_`. `language` is a BCP 47-shaped code, not a full registry check.
- **`onComplete`, `dialogues`, `placements`** are optional; an NPC with no placements is only a warning.

## Schema and spec stay in sync

`schemas/story.schema.json` is generated from `storySchema` (`npm run schema`) and committed; a test fails if they differ.
The document's version number is deliberately **not** mirrored in code (PKR-013): a docs-only bump must not turn `main` red, and the schema's own `description` no longer names it. The test only checks that the `*Version N.N · …` header exists. Real drift is caught by the table comparison. `story-schema-sync.test.ts` parses the tables of `docs/STORY_SCHEMA.md` (top-level fields and required flags, task types,
scene commands, triggers, condition forms and states, behaviours, directions, id alphabet, text limits, the §11 rows) and
compares them with the schema. When the PM changes the spec, that test fails until the schema and code catch up.

## Template (`templates/story_template/`)

A playable story with two NPCs (Rosa, Tomas), two greybox locations, four flags, two quests, seven scenes and three triggers. It uses
every schema field, task type, scene command, trigger, behaviour and condition form; `story-template.test.ts` enforces
that by walking the schema and the story (add a field to the schema and the test lists what the template lacks). The NPC
characters are real Slicer packages generated from the synthetic fixtures (`npm run story-template`; a test fails if the
committed files drift). `story.json` is hand-written.

## Library data

Stories refer to library locations and audio ids. The real library arrives in M7; until then:

- `assets/locations/loc_greybox-harbour.json` and `loc_greybox-bakery.json`: size, collision grid, spawns, exits (tiles or a
  map edge) and areas, in the format of Asset Spec §8.1 (`validateLocationAsset` checks every rule of its field table;
  `tools/story-node.ts` `loadLibrary` refuses a library that breaks one, including a file whose name differs from its `id`).
- `assets/registry/audio.json`: placeholder music and sound-effect ids.
