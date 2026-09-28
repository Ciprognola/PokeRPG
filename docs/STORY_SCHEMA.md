# PokeRPG — Story Schema
*Version 0.1 · 2026-09-28 · Owner: PM · Status: draft pending PO approval*

The contract for story packages. The importer/validator enforces it, the Story Template (§10) follows it, and Claude Code builds user stories from it. Game behaviour behind each field is in the GDD; character files follow the Asset Spec.
Claude Code keeps a machine-readable JSON Schema in the repo that matches this file.

---

## 1. Package
```
story_<id>/
  story.json
  characters/
    chr_<name>/        one folder per NPC, exactly as exported by the Slicer (Asset Spec §4)
```
- Shared as `story_<id>.zip` containing that folder.
- The player's character is **never** in a story package (GDD §1).
- Locations, music and sounds are **referenced** from the asset library, never bundled.

## 2. Conventions
| Rule | Value |
|---|---|
| Encoding | UTF-8 JSON |
| Ids | Lowercase `[a-z0-9-]`, unique within their kind in the story |
| Tiles | `[x, y]` in 64 px tiles, origin top-left of the location |
| Directions | `down` · `left` · `right` · `up` |
| Durations | Milliseconds |
| Task refs | `<questId>.<taskId>`, e.g. `find-baker.talk-rosa` |
| Placeholders | Only `{player.name}` in v0.1 |

## 3. `story.json` top level
| Field | Required | Content |
|---|---|---|
| `schemaVersion` | Yes | `"0.1"` |
| `id` | Yes | `story_<id>`, matches the folder name |
| `version` | Yes | Integer, increases with every release of the story |
| `title`, `author`, `description` | Yes | Shown on the story selection screen |
| `language` | Yes | BCP 47 code, e.g. `en`, `it` |
| `start` | Yes | `{ "location", "spawn", "facing" }`: where the player appears |
| `locations` | Yes | §4 |
| `npcs` | No | §5 |
| `flags` | No | Array of flag ids. Every flag used anywhere must be declared here |
| `quests` | Yes | §6, in play order, at least one |
| `scenes` | No | §7, object of scene id → command list |
| `triggers` | No | §8 |

## 4. Locations
```json
{ "id": "harbour", "asset": "loc_harbour",
  "links": { "exit_house_door": { "location": "rosa-house", "spawn": "spawn_door_inside" } } }
```
- `id` is the story's name for this location; `asset` is the library location. The same asset can appear twice with different ids.
- `links` connects the asset's named exits to a spawn point of another story location (GDD §4). Exits without a link are blocked.

## 5. NPCs
```json
{ "id": "rosa", "name": "Rosa", "character": "chr_rosa",
  "placements": [
    { "when": { "quest": "find-baker", "is": "complete" },
      "location": "harbour", "tile": [12, 7], "facing": "down", "behaviour": { "type": "static" } },
    { "location": "rosa-house", "tile": [4, 3], "facing": "left",
      "behaviour": { "type": "wander", "radius": 2 } }
  ],
  "dialogues": [
    { "when": { "flag": "met-rosa" }, "lines": ["Back again, {player.name}?"] },
    { "lines": ["Welcome to my bakery!", "Fresh bread every morning."] }
  ] }
```
- `character` names a folder in `characters/`.
- **Placements:** the first one whose `when` is true (or has no `when`) is used. If none matches, the NPC is hidden.
- **Behaviour:** `static` · `look-around` · `wander` (`radius` in tiles) · `patrol` (`path`, see §7).
- **Dialogues:** the first one whose `when` is true plays. The last one must have no `when`.

### 5.1 Lines
A line is one dialogue page: a string, or an object `{ "speaker", "text" }`.
- `speaker` is an NPC id, `player`, or `narrator`. A plain string in NPC dialogue is spoken by that NPC; in a scene, `speaker` is required.
- **Max 120 characters per line**, after placeholders are counted at 12 characters. Longer text is split into more lines.

## 6. Quests and tasks
```json
{ "id": "find-baker", "title": "The missing baker",
  "tasks": [
    { "id": "intro", "type": "scene", "scene": "harbour-intro",
      "objective": "Look around the harbour" },
    { "id": "reach-plaza", "type": "reach", "location": "harbour", "area": "area_plaza",
      "objective": "Go to the plaza" },
    { "id": "talk-rosa", "type": "talk", "npc": "rosa",
      "objective": "Find the baker",
      "lines": ["Oh! You found me.", { "speaker": "player", "text": "Everyone is looking for you." }],
      "onComplete": { "flags": { "met-rosa": true }, "scene": "rosa-returns" } }
  ] }
```
| Task type | Required fields |
|---|---|
| `scene` | `scene` |
| `reach` | `location` plus one of `area` or `spawn` |
| `talk` | `npc`, `lines` |

Every task has `id` and `objective` (max 60 characters). `onComplete` is optional: `flags` to set and/or a `scene` to run.

## 7. Scenes
A scene is an array of commands. Each runs to completion before the next, unless it has `"parallel": true`.

| Command | Fields |
|---|---|
| `say` | `lines` (§5.1) |
| `move` | `actor` (NPC id or `player`), `path`: tiles, each in a straight line from the previous one |
| `face` | `actor`, plus `dir` or `toward` (an actor) |
| `wait` | `ms` |
| `fade` | `to` (`out` / `in`), optional `ms` (default 400) |
| `camera` | `to`: a tile, an actor, or `player`; optional `ms` |
| `music` | `track` (library id) or `null` to stop |
| `sound` | `sfx` (library id) |
| `show` | `npc`, `location`, `tile`, `facing` (lasts until the player leaves the location) |
| `hide` | `npc` |
| `warp` | `location`, `spawn`, optional `facing` |
| `flag` | `set`: object of flag id → true/false |

Example: `{ "cmd": "move", "actor": "rosa", "path": [[12, 7], [12, 4], [9, 4]], "parallel": true }`

## 8. Triggers
Triggers start scenes outside the task flow.
```json
{ "on": "enterArea", "location": "harbour", "area": "area_docks", "once": true,
  "when": { "not": { "flag": "saw-boat" } }, "scene": "boat-leaves" }
```
| `on` | Extra fields |
|---|---|
| `storyStart` | — |
| `enterArea` | `location`, `area` |
| `talk` | `npc` |

**Talking priority:** an active `talk` task for that NPC → a matching `talk` trigger → the NPC's dialogues.
Task-based events use the task itself (`scene` tasks and `onComplete`), not triggers.

## 9. Conditions
Used by `when` fields.
| Form | True when |
|---|---|
| `{ "flag": "met-rosa" }` | The flag is true |
| `{ "quest": "<id>", "is": "notStarted" \| "active" \| "complete" }` | The quest is in that state |
| `{ "task": "<questId>.<taskId>", "is": "active" \| "complete" }` | The task is in that state |
| `{ "all": [ … ] }` · `{ "any": [ … ] }` · `{ "not": { … } }` | Combinations |

## 10. Story Template
Claude Code maintains `templates/story_template/` in the repo: a small, playable story that uses **every** field and command in this file at least once, with two NPCs and two test locations. It passes validation and is the starting point for every user story.

## 11. Validation (importer and CI)
| Check | Severity |
|---|---|
| JSON is valid and matches this schema | Error |
| Ids unique; every reference (location, spawn, exit, area, NPC, character, flag, quest, task, scene, track, sfx) resolves | Error |
| Every NPC character passes the Asset Spec §7 validator with zero errors | Error |
| Tiles inside the location and not blocked; move paths straight between points | Error |
| Line over 120 characters, objective over 60, unknown placeholder | Error |
| The last dialogue of an NPC has a `when` | Error |
| A quest has no tasks | Error |
| Declared flag never used · scene never used · NPC never placed | Warning |
| Character warnings from the Asset Spec validator | Warning |

Every message names the file, the JSON path and the line, e.g. `story.json:84 · quests[0].tasks[2].npc · unknown NPC "rossa"`.

## 12. Open items
1. **Library location data:** the file format for a location's size, collision grid and named anchors belongs in the Asset Spec. Until M7, Claude Code provides greybox test locations with the same data.
2. **Sound effects:** the library and naming (`sfx_<name>`) are added to the Asset Spec with M7.
3. **Localisation:** one language per story in v0.1. Translations *later*.

## 13. Decision log
| Date | Decision |
|---|---|
| 2026-09-28 | v0.1: `story_<id>` package with bundled NPC characters; locations, music and sounds by library reference; linear quests with `scene`, `reach` and `talk` tasks; scenes, triggers, flags and conditions per GDD v0.2 |
