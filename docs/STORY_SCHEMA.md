# PokeRPG — Story Schema
*Version 0.7 · 2026-09-29 · Owner: PM · Status: draft pending PO approval*

The contract for story packages. The importer/validator enforces it, the Story Template (§10) follows it, and the story author's own Claude Code builds stories from it (Project Brief §3). Game behaviour behind each field is in the GDD; character files follow the Asset Spec.
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
| `schemaVersion` | Yes | `"0.1"`: the file format version. It changes only when the format changes, not with this document's version |
| `id` | Yes | `story_<id>`, matches the folder name |
| `version` | Yes | Integer, increases with every release of the story |
| `title`, `author`, `description` | Yes | Shown on the story selection screen |
| `language` | Yes | BCP 47 code, e.g. `it`, `en`. The platform is Italian (Brief §2); a story may be written in any language |
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
A line is one dialogue message: a string, or an object `{ "speaker", "text" }`.
- `speaker` is an NPC id, `player`, or `narrator`. A plain string in NPC dialogue is spoken by that NPC; in a scene, `speaker` is required.
- **Max 120 characters per line**, after placeholders are counted at 12 characters. Longer text is split into more lines.
- `{player.name}` counts as 12 because a player name is at most 12 characters (GDD §6).
- Characters are counted as the reader sees them (Unicode NFC): an accented letter such as `è` counts as 1.
- The dialogue box shows 2 rendered lines per page (GDD §6). The runtime wraps each line and splits it across pages as needed, usually 1–2 pages; authors only count characters.
- The runtime adds the speaker's name inline (GDD §6). It doesn't count towards the 120 characters.
- The 120-character limit was kept when the box was fixed at 2 lines (GDD §15 Q5). Changing it is a format change: this file, the JSON Schema, the Story Template and the Story Prompt Kit change together.

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

### 6.1 Task runtime rules
- **`reach`** completes when the player is in the area (or on the spawn) **while the task is active**, however they got there: walking, an exit or a `warp`. If the player is already there when the task becomes active, it completes at once. Visits before the task was active don't count.
- **Completion order:** the task is marked complete → if it was the quest's last task, the quest is marked complete → `onComplete.flags` are set → `onComplete.scene` runs → the next task becomes active. Conditions checked during the `onComplete` scene already see the task (and quest) as complete.
- **Story end:** after the last task of the last quest, its `onComplete` scene plays in full, then the story ends and the platform shows its end card (GDD §7.1). Use that scene for the closing; a trailing `scene` task also works.

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

### 7.1 Scene runtime rules
- **`move` paths start where the actor stands:** the first point is the actor's current tile. A corner needs three points (start, corner, end). If the first point isn't the actor's tile, the runtime logs a warning and walks from the actor's actual tile.
- **NPC behaviour during scenes:** every NPC's `behaviour` pauses while a scene runs. Afterwards it resumes from the NPC's new tile (a `wander` radius is centred there; a `patrol` NPC first walks back to the nearest point on its path, then continues the loop) until the player leaves the location; then placements apply again (GDD §8).
- **Screen at story start:** the story opens on a black screen. A scene may `fade` in itself; if the screen is still black when the player gets control, the runtime fades in (400 ms).

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
**Start order:** at story start, `storyStart` triggers run first, in the order listed, then the first task becomes active (a first `scene` task starts after them).
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
| Placement, spawn and task tiles inside the location and not blocked (Asset Spec §8.1); scene `move` paths straight between points | Error |
| Line over 120 characters, objective over 60, unknown placeholder | Error |
| The last dialogue of an NPC has a `when` | Error |
| A quest has no tasks | Error |
| Declared flag never used · scene never used · NPC never placed | Warning |
| Character warnings from the Asset Spec validator | Warning |

Scene `move` and `camera` tiles are not checked against collision at import, and neither is the rule that a `move` path starts on the actor's tile (§7.1), because the actor's location and tile are only known at run time. The runtime handles both.

Messages are in Italian (Brief §2); file names, JSON paths, ids and field names stay as written. Every message names the file, the JSON path and the line, e.g. `story.json:84 · quests[0].tasks[2].npc · PNG sconosciuto "rossa"`.

## 12. Open items
1. **Sound effects:** the library and naming (`sfx_<name>`) are added to the Asset Spec with M7.
2. **Localisation:** one language per story in v0.1. Translations *later*.

## 13. Decision log
| Date | Decision |
|---|---|
| 2026-09-28 | v0.1: `story_<id>` package with bundled NPC characters; locations, music and sounds by library reference; linear quests with `scene`, `reach` and `talk` tasks; scenes, triggers, flags and conditions per GDD v0.2 |
| 2026-09-28 | v0.2: location data now defined in Asset Spec §8.1; scene tiles are checked for straightness only (collision at run time) |
| 2026-09-28 | v0.3: stories are built by the author's own Claude Code; `schemaVersion` is the file format version and stays `"0.1"` until the format changes |
| 2026-09-28 | v0.4: runtime rules from the M2 story spike: `reach` completion, completion order and story end (§6.1); `move` start tile, NPC behaviour in scenes, screen at story start (§7.1); 120 characters always fit one page (§5.1). Format unchanged |
| 2026-09-29 | v0.5: open runtime questions decided: wrong `move` start tile → warning, walk from the actual tile; `patrol` returns to the nearest path point after a scene; `storyStart` triggers run before the first task; player name max 12 characters; end card after the story (§5.1, §6.1, §7.1, §8). §11 notes the `move` start tile is checked at run time; §5.1 points to GDD §15 Q5. Format unchanged |
| 2026-09-29 | v0.6: validation messages in Italian (§11); accented letters count as 1 character (§5.1); any story language allowed (§3). Format unchanged |
| 2026-09-29 | v0.7: a line is a message shown on one or more 2-line pages; speaker names are added inline by the runtime (§5.1). Format unchanged |
