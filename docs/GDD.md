# PokeRPG — Game Design Document (GDD)
*Version 0.6 · 2026-09-29 · Owner: PM · Status: draft pending PO approval*

How the player runtime behaves. The Story Schema turns these systems into story files; the Asset Spec covers asset formats.
The platform systems outside stories (UI shell, life tracker, account) are in §12–§14.
Scope is **launch (v1)**. Anything marked *later* is planned but not built for launch.

---

## 1. Principles
- **The player brings the hero.** Every story is played with the player's own character. Stories never define the hero's name, looks or gender, and dialogue refers to the player only through placeholders (§5).
- **Linear stories at launch.** A story is an ordered chain of quests. There are no items, inventory or branching choices in v1 (*later*).
- **Classic top-down RPG feel.** Grid movement, talk to people, walk to places, watch scripted scenes.
- **Platform systems sit outside stories.** The UI shell, life tracker and account belong to the platform. Stories fill the UI with text but can't restyle it, and can't read or change tracker data in v1.
- **Stories are data.** Everything a story does is expressible in the Story Schema. Stories contain no code.

## 2. Controls
| Action | Keyboard | Touch (phone) | Gamepad |
|---|---|---|---|
| Move | Arrows / WASD | On-screen D-pad (left) | D-pad / left stick |
| **A**: interact, advance text | Z / Space / Enter | A button (right) | South face button |
| **B**: speed up text, cancel | X / Backspace | B button (right) | East face button |
| **Menu** | Esc | Menu button (top corner) | Start |

- Phones play in **landscape**. Touch controls are drawn only on touch devices.
- Running (hold B) is *later* and needs the `run` animation set.

## 3. Movement and camera
| Rule | Value |
|---|---|
| Movement | Grid-locked: every step moves exactly one 64 px tile, in 4 directions |
| Turning | A short tap on a new direction turns the player in place without stepping |
| Walk speed | **4 tiles/s** (256 px/s) |
| Walk animation | `walk` set at **12 fps**. One 6-frame cycle covers 2 tiles |
| Idle | Column 2 of the facing row (Asset Spec §2.2) |
| Collision | Blocked by the location's collision grid, NPCs and the player's own footprint tile |
| Base resolution | 960 × 540 (16:9), scaled to fit the screen with letterboxing. About 15 × 8.5 tiles visible |
| Camera | Follows the player and clamps to the location edges. Scenes can pan it (§7) |

## 4. World
- **Location:** one map from the asset library (a town, a route, a house interior). It carries its art, collision grid, music and **named anchors**:
  - **Spawn points:** tiles where the player or an NPC can appear, e.g. `spawn_door_inside`.
  - **Exits:** tiles or edges that lead elsewhere, e.g. `exit_house_door`, `edge_north`.
  - **Areas:** named tile rectangles used by triggers, e.g. `area_plaza`.
- **World graph:** a story picks locations from the library and **connects each exit it uses to a spawn point** in another location. Unconnected exits are blocked.
- **Transitions:** walking onto an exit fades out, loads the target location and fades in at the linked spawn point, keeping the player's facing.
- How locations are built (tilesets or painted backgrounds) is open in Asset Spec §9. The rules above work either way.

## 5. NPCs
| Property | Rule |
|---|---|
| Identity | `id` (unique in the story), display `name`, and `character`: a character package **bundled with the story** (made with the Sprite Reference Document and the Slicer, same Asset Spec as player characters) |
| Placement | Location, tile and facing. Several placements can exist with conditions, e.g. the baker is in the shop until a quest completes, then in the plaza |
| Behaviour | `static` · `look-around` (turns randomly) · `wander` (random steps inside a radius) · `patrol` (loops a tile path). All pause while talking and while any scene runs. After a scene, a `patrol` NPC walks back to the nearest point on its path (Story Schema §7.1) |
| Visibility | Shown or hidden by a condition on world state (§8) |
| Talking | The player faces the NPC and presses A. The NPC turns to face the player and its dialogue plays |
| Dialogue variants | An NPC has an ordered list of dialogues with conditions. The **first one whose condition is true** plays; the last one has no condition and is the default |

## 6. Dialogue
- **Box:** the Emerald-style dialogue box of the UI shell (§12), at the bottom of the screen, speaker name plate, up to **3 lines per page**. Text wraps automatically. The box and font are sized so that any line within the Story Schema's 120-character limit fits one page; stories never overflow it.
- **Reveal:** typewriter effect, speed set in the settings. **A** finishes the page or advances to the next. **B** shows the whole page instantly.
- **Placeholders:** `{player.name}` in dialogue text. A player name is at most **12 characters**, the budget the Story Schema counts per placeholder, and may use accented letters. More placeholders (*later*) are added to the Story Schema, never invented by stories.
- **Speakers:** an NPC, the player (`player`), or a narrator (no name plate).
- **Portraits:** none at launch. Expressions and portraits come before M6 (§15 Q1).
- **Choices:** none at launch (*later*, with branching).

## 7. Quests, tasks and scenes

### 7.1 Structure
**Story → quests (in order) → tasks (in order).** Exactly one task is active at a time. Completing the last task of the last quest ends the story, after its `onComplete` scene has played (Story Schema §6.1). An **end card** then shows the story's title, author and "Fine", and the player returns to story selection (§15 Q3).

| Task type | Completes when |
|---|---|
| `talk` | The player talks to the named NPC. Its task dialogue plays instead of its normal dialogue |
| `reach` | The player is in a named area or on a spawn point of a location while the task is active, including on arrival by exit or warp (Story Schema §6.1) |
| `scene` | A scene (§7.2) finishes. It starts automatically when the task becomes active |

Each task has **objective text** shown in the menu's quest log, e.g. "Find the baker in the plaza". Each task can run a scene **on complete**, and can set flags (§8).

### 7.2 Scenes (scripts)
A scene is an ordered list of commands that runs to the end while player input is locked. Commands run one after another unless marked `parallel`.

| Command | Does |
|---|---|
| `say` | Shows dialogue (§6) |
| `move` | Walks an actor (NPC or player) along a tile path, at walk speed |
| `face` | Turns an actor to a direction or toward another actor |
| `wait` | Pauses for a duration |
| `fade` | Fades the screen out or in |
| `camera` | Pans the camera to a tile or actor, or returns it to the player |
| `music` | Changes or stops the music |
| `sound` | Plays a sound effect |
| `show` / `hide` | Shows or hides an NPC at a placement |
| `warp` | Moves the player to a spawn point in any location |
| `flag` | Sets a flag (§8) |

A story opens on a black screen; scenes may fade in themselves, otherwise the runtime fades in when the player gets control (Story Schema §7.1).

### 7.3 Triggers
Scenes and task progress are started by: **story start**, **task becomes active**, **talk to NPC**, **enter area**, **task complete**. A trigger can have a condition and can be `once`. At story start, story-start triggers run before the first task becomes active.

## 8. World state
- **Flags:** named true/false values owned by the story, all false at the start. Only scenes and task completion set them.
- **Conditions:** used by NPC visibility, placements, dialogue variants and triggers. A condition tests flags, the active quest/task, or whether a quest is complete, combined with `all` / `any` / `not`.
- NPC positions changed by a scene last until the location is left. Lasting changes use flags and conditional placements.

## 9. Menu and UI
- **Look:** every screen, menu and box uses the UI shell (§12).
- **Menu:** quest log (current objective and completed quests), life tracker (§13), save, settings, account (§14), return to title.
- **Settings:** text speed, music and sound volume, touch control size.
- **HUD:** none while walking. The current objective appears briefly when a task starts.

## 10. Saving
- **Local only** (browser storage), with file export/import of a save (Brief §2).
- **Autosave** when a task completes and on every location change, plus a manual save in the menu. **3 slots per story.**
- A save holds the story id and version, the Run Manifest id, the player character, location, tile, facing, flags and quest/task progress.
- Saving is blocked during scenes, and a load always restores a non-scene moment.
- Life tracker and account data are platform data, stored separately from story saves (§13, §14).

## 11. Run Manifest
Starting a story creates a Run Manifest that **locks** the story package version, the player's character package, every library asset version the story uses (locations, NPC characters, music, sounds) and the animation-set versions. Saves point to their manifest, so later library or story updates never break a run in progress.

## 12. UI shell
- **Look and feel:** an exact match to Pokémon Emerald: dialogue box, menus, font style, cursor, text reveal, menu sounds and screen transitions. A UI spec, written from the PO's reference captures, fixes layout, proportions, colours and timings.
- **Language:** Italian only (Brief §2). The font covers the Italian alphabet, including accented letters (à è é ì ò ù and their capitals) and the apostrophe.
- **Fixed:** stories and players cannot restyle it. Stories only supply content (text, names, objectives).
- **Assets:** public builds use original, recreated art, font and sounds. A private build may swap them for the builder's own files from the git-ignored overrides folder (Brief §2). Override files use the same names and sizes as the originals.
- **Screen fit** and **lines per page** are open (§15 Q4, Q5).

## 13. Life tracker
- **What:** the player's own real-life tasks and progress, kept outside any story.
- **Coins:** completing a real-life task earns in-game coins.
- **Rewards:** coins unlock rewards, in-game or real-life. A real-life reward is something the player gives themselves once it is unlocked.
- **Storage:** works without an account. Data is local and is included in file export. With an account, time checks use the trusted clock (§14).
- Details are open (§15 Q6, Q8).

## 14. Account and real-time clock
- **Optional per player:** Firebase login. A player can set it up or skip it at any time; nothing in stories requires it.
- **With an account:** a trusted server clock drives time and date events and coin rewards, so changing the device clock has no effect.
- **Without an account:** everything runs locally on the device clock.
- **Privacy:** minimal data; a privacy notice ships with the account.
- Which time and date events exist, and what syncs, is open (§15 Q7).

## 15. Open questions
1. **Portraits and expressions:** canvas, expression list and whether the player's character needs a portrait. Decide before M6. Asset Spec §5 points here.
2. **Items and branching choices:** scope and timing after launch.
3. **Title and story selection flow:** how the player picks a story and a character. Decide before M5.
4. **Emerald UI on 16:9:** Emerald was built for 240 × 160 (3:2). Letterbox (for example 240 × 160 at 3× = 720 × 480 inside 960 × 540) or adapt the layout. Decide in the UI spec, before M4.
5. **Lines per page:** Emerald's box shows 2 lines; §6 promises 3 lines and any 120-character line (Story Schema §5.1). Matching Emerald may lower the line limit, which is a story format change (Story Schema §5.1 carries the matching pointer). Italian text runs longer than English, which weighs against fewer lines. Decide in the UI spec, before M4.
6. **Life tracker rules:** who sets rewards and their prices, task kinds (one-off, recurring, streaks), coins per task, and what coins buy in-game.
7. **Time and date events:** which exist (day/night, calendar dates, holidays), whether stories can use time conditions (a Story Schema change), and what an account syncs (tracker, saves, settings).
8. **Where the tracker lives:** title screen, in-game menu, or both.

## 16. Decision log
| Date | Decision |
|---|---|
| 2026-09-28 | v0.1: player always brings the hero; linear quests with `talk`, `reach` and `scene` tasks; scripted scenes; flags; no items or choices at launch |
| 2026-09-28 | Grid movement at 4 tiles/s, walk at 12 fps, 960 × 540 base resolution, landscape on phones, A/B/Menu controls |
| 2026-09-28 | v0.2: NPC characters are imported character packages bundled with each story |
| 2026-09-28 | v0.3: M2 story spike rules: dialogue box fits any 120-character line; `reach` completes on arrival while active; story ends after the last `onComplete` scene; NPC behaviour pauses during scenes; story opens on black |
| 2026-09-28 | v0.4: platform systems outside stories: Emerald-style UI shell (fixed, recreated assets, private overrides), life tracker with coins and rewards, optional Firebase account with a trusted real-time clock. Open questions added for screen fit, lines per page, tracker rules and time events |
| 2026-09-29 | v0.5: runtime defaults: player name max 12 characters (§6); end card after the story (§7.1); `patrol` returns to its path after a scene (§5); story-start triggers before the first task (§7.3). §15 Q5 cross-referenced from Story Schema §5.1 |
| 2026-09-29 | v0.6: UI is Italian only; the font covers accented letters; player names may use them; the end card reads "Fine" (§6, §7.1, §12, §15 Q5) |
