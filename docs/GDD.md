# PokeRPG — Game Design Document (GDD)
*Version 0.9 · 2026-09-29 · Owner: PM · Status: draft pending PO approval*

How the player runtime behaves. The Story Schema turns these systems into story files; the Asset Spec covers asset formats, including asset packs.
The platform systems outside stories (save slots, UI shell, AGENDA, dev mode, account) are in §10 and §12–§14.
Scope is **launch (v1)**. Anything marked *later* is planned but not built for launch.

---

## 1. Principles
- **The player brings the hero.** Every story is played with the player's own character. Stories never define the hero's name, looks or gender, and dialogue refers to the player only through placeholders (§5).
- **Linear stories at launch.** A story is an ordered chain of quests. There are no items, inventory or branching choices in v1 (*later*).
- **Classic top-down RPG feel.** Grid movement, talk to people, walk to places, watch scripted scenes.
- **Stories run on the calendar.** A story is told in episodes: a calendar month by default, or a week if the author chooses. It follows the device's date and time of day (§13.3).
- **Platform systems frame the stories.** Save slots, the UI shell, AGENDA and dev mode belong to the platform. Stories fill the UI with text but can't restyle it. A story can supply monthly challenges to AGENDA (§13.1), but can't read or change coins, the shop or personal goals.
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
| Idle | The `idle` set, looping in the facing direction (≈ 4 fps, tuned in M4). A character without an `idle` sheet uses column 2 of its `walk` row (Asset Spec §2.2) |
| Collision | Blocked by the location's collision grid, NPCs and the player's own footprint tile |
| Base resolution | 960 × 540 (16:9), scaled to fit the screen with letterboxing. About 15 × 8.5 tiles visible |
| Camera | Follows the player and clamps to the location edges. Scenes can pan it (§7) |

## 4. World
- **Location:** one map from an asset pack (a town, a route, a house interior). It carries its art layers, collision grid, music and **named anchors**:
  - **Spawn points:** tiles where the player or an NPC can appear, e.g. `spawn_door_inside`.
  - **Exits:** tiles or edges that lead elsewhere, e.g. `exit_house_door`, `edge_north`.
  - **Areas:** named tile rectangles used by triggers, e.g. `area_plaza`.
- **World graph:** a story picks locations from the asset packs it declares and **connects each exit it uses to a spawn point** in another location. Unconnected exits are blocked.
- **Transitions:** walking onto an exit fades out, loads the target location and fades in at the linked spawn point, keeping the player's facing.
- **Asset packs:** there is no official library. Locations, props, poses, music and sounds come in asset packs that users make with their own image AI and the Slicer (Asset Spec §8). A story declares the packs it needs, and each slot keeps the packs it uses. The repo ships only greybox test packs.
- **Layers**, from bottom to top (Asset Spec §8.2):
  - `ground`: one painted image of the whole location: terrain, streets, paths, floors, margins.
  - `props`: separate objects (trees, stalls, a campfire), each anchored at its base.
  - Characters: the player and NPCs.
  - `overhead`: roof edges, tree canopies, arches, always drawn over characters.
  - Props and characters are sorted together by the y of their anchor, so the player can walk in front of or behind a prop.
- **Art style:** pixel-look at native resolution (64 px tiles, 96 px characters). The Location Guide recommends a bright, saturated, Emerald-like palette in neutral daylight, light from the top-left; packs may choose their own look.
- **Time of day:** the runtime tints the whole location for dawn, day, dusk and night from the device clock, and draws glow sprites at the location's light points (windows, lamps, fires). Phase times and tints are set in M7.

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
- **Box:** the Emerald-style dialogue box of the UI shell (§12, UI Spec §4), at the bottom of the screen, **2 lines per page**. Text wraps automatically, and a story line longer than one page continues on the next page after ▼. A line within the Story Schema's 120-character limit usually takes 1–2 pages; stories never overflow the box.
- **Speaker names:** no name plate. The speaker's name appears inline, in capitals ("ROSA: …"), on the first line of a dialogue and whenever the speaker changes. The narrator has no name.
- **Reveal:** typewriter effect, speed set in the settings. **A** finishes the page or advances to the next. **B** shows the whole page instantly.
- **Placeholders:** `{player.name}` in dialogue text. A player name is at most **12 characters**, the budget the Story Schema counts per placeholder, and may use accented letters. More placeholders (*later*) are added to the Story Schema, never invented by stories.
- **Speakers:** an NPC, the player (`player`), or a narrator (no name).
- **Portraits:** none at launch. Expressions and portraits come before M8 (§15 Q1).
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
These are story tasks. Real-life goals live in AGENDA (§13).

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
Public slots add dynamic scenes and live scene changes by the dev (§14.3).

### 7.3 Triggers
Scenes and task progress are started by: **story start**, **task becomes active**, **talk to NPC**, **enter area**, **task complete**. A trigger can have a condition and can be `once`. At story start, story-start triggers run before the first task becomes active.

## 8. World state
- **Flags:** named true/false values owned by the story, all false at the start. Only scenes and task completion set them.
- **Conditions:** used by NPC visibility, placements, dialogue variants and triggers. A condition tests flags, the active quest/task, or whether a quest is complete, combined with `all` / `any` / `not`. Date and time-of-day conditions are planned (§13.3).
- NPC positions changed by a scene last until the location is left. Lasting changes use flags and conditional placements.

## 9. Menu and UI
- **Look:** every screen, menu and box uses the UI shell (§12).
- **Start menu:** MISSIONI (quest log: current objective and completed quests) · AGENDA (§13) · SALVA · OPZIONI · ACCOUNT (§14.2) · TITOLO · ANNULLA (UI Spec §5.1).
- **Settings (OPZIONI):** text speed, music and sound volume, touch control size, and, for the slot's dev only, dev mode and the editor (§14.1, UI Spec §7).
- **HUD:** none while walking. The current objective appears briefly when a task starts.

## 10. Save slots and saving
- **4 save slots** on the title screen, shared by all stories. Each slot holds one story run with its player character, its AGENDA and, in private slots, its shop.
- **Mode**, chosen when the slot is created:
  - **Private:** one person is both dev and player. Everything stays on the device and needs no account. Mainly a productivity tracker (§13).
  - **Public:** one dev and several players, each on their own device with an account (§14). Mainly a live campaign, e.g. to accompany a tabletop D&D campaign.
- **Autosave** when a task completes and on every location change, plus a manual save in the menu.
- A save holds the story id and version, the Run Manifest id, the player character, location, tile, facing, flags, quest/task progress and the AGENDA state.
- Saving is blocked during scenes, and a load always restores a non-scene moment.
- **Export/import:** a private slot can be exported to a file and imported into a free slot. In a public slot the story content comes from the dev (§14.3); each player's own save stays on their device.
- How a slot is created and picks its story and character is §15 Q3.

## 11. Run Manifest
Starting a story creates a Run Manifest that **locks** the story package version, the player's character package, the versions of the asset packs the story uses, the NPC character packages and the animation-set versions. Saves point to their manifest, so later pack or story updates never break a run in progress.
Dev edits are the exception, by design: a dev-mode edit or a dev push (§14) creates a new story version for that slot, and the run moves to it at the next non-scene moment.

## 12. UI shell
- **Look and feel:** an exact match to Pokémon Emerald: dialogue box, menus, font style, cursor, text reveal, menu sounds and screen transitions. A UI spec, written from the PO's reference captures, fixes layout, proportions, colours and timings.
- **Language:** Italian only (Brief §2). The font covers the Italian alphabet, including accented letters (à è é ì ò ù and their capitals) and the apostrophe.
- **Fixed:** stories and players cannot restyle it. Stories only supply content (text, names, objectives).
- **Platform screens:** AGENDA, the shop and the dev tools use the same shell, so they read as part of the Emerald-style menu (UI Spec §6–§8).
- **Assets:** public builds use original, recreated art, font and sounds. A private build may swap them for the builder's own files from the git-ignored overrides folder (Brief §2). Override files use the same names and sizes as the originals.
- **Screen fit:** the UI uses 4× pixels on a 240 × 135 layout that covers the 960 × 540 screen (UI Spec §1).
- **Details:** layout, colours, font and timings are in the UI Spec.

## 13. AGENDA (life tracker)
Each slot has its own AGENDA, opened from the start menu. Its pages are laid out in UI Spec §6.2.

### 13.1 Tasks
| Kind | Set by | Covers |
|---|---|---|
| Daily goals | In-game: the player in a private slot, the dev in a public slot | One day |
| Weekly goals | In-game, as above | One week |
| Monthly challenges | The story files, written by the author. Dev mode can edit them in-game only as a backdoor for urgent fixes | One episode |

- **Private slots:** tasks are productivity goals.
- **Public slots:** tasks are set by the dev and belong to the storyline or campaign.
- **Place tasks:** a task can ask the player to stay in an in-game place for a set time. Entering the place starts a focus timer, and the place shows its own to-do list. The task completes when the time is up. No real-world location is used.

### 13.2 Coins and shop (private slots only)
- Completing a task earns coins. The platform fixes coins per task through difficulty tiers (§15 Q9); the tier is chosen when the task is set.
- **Shop:** the dev fills it and sets every price. Each entry is either an in-game asset from the slot's asset packs or a real-life reward. A real-life reward ("buy X", "do X") is something the player gives themselves once it is bought.
- Which in-game assets the shop can sell, and what they do, is §15 Q10.
- Public slots have no coins and no shop.

### 13.3 Episodes and time
- A story is told one episode at a time: a calendar month by default, or a week if the author chooses. Each episode brings new story content and new monthly challenges.
- Stories can react to the device's date and time of day. The Story Schema format for episodes, time conditions and monthly challenges is open (Story Schema §12).
- Every slot uses the device clock (§14.4).

## 14. Dev mode, account and public slots

### 14.1 Dev mode
- The slot's dev turns it on in OPZIONI (UI Spec §7). In a private slot the dev is the player; in a public slot only the dev sees the option.
- **Quick edit forms** for small changes: with dev mode on, the lists in MISSIONI, AGENDA and the shop offer edit actions on their items.
- **Edit panel** for bigger changes (monthly quests, scenario changes), opened from EDITOR in OPZIONI.
- Every edit is checked with the same rules as `story:check` before it is saved or pushed.
- **Private slot:** edits are saved on the device. **Public slot:** the dev pushes them (§14.3).
- No AI prompting in the dev tools at launch (*later*).

### 14.2 Account
- **Firebase login.** Required for everyone in a public slot, dev and players. Private slots never need it.
- ACCOUNT in the start menu signs in and out and shows the privacy notice.
- **Privacy:** minimal data; a privacy notice ships with the account.

### 14.3 Public slots
- **One timeline, set by the dev.** Every player follows the same story; there is no per-player branching.
- **Scene order:** the story sets the default order of scenes and story beats. The dev can override it live: switch to another scene or beat, or pick another location among the legal ones. In a private slot the dev has full control at all times.
- **Dynamic scenes:** a scene template (a looping animation, e.g. the party around a campfire) placed in a pack location whose tags allow it. The player watches and doesn't need to move; idle animations and scene poses (`sit`, `sleep`…, M9) carry most of what's on screen. For example, 7 of a campaign's 15 locations may be tagged for camping. A dynamic scene plays until the next scene or story beat. Templates, tags and anchor points are open in Asset Spec §9.
- **Push and sync:** the dev pushes updates to the running campaign, e.g. next week's content with a preview message. Players receive them when they sync. Pushes are data, never code.
- Each player's device keeps its own date and time of day.

### 14.4 Clock
- Every slot runs on the device clock. There is no trusted server clock.
- The server only timestamps and orders the dev's pushes.
- Changing the device clock affects only that device. Coins exist only in private slots, where the player is also the dev.

## 15. Open questions
1. **Portraits and expressions:** canvas, expression list and whether the player's character needs a portrait. Decide before M8. Asset Spec §5 points here.
2. **Items and branching choices:** scope and timing after launch.
3. **Title, slots and story selection:** how a slot is created, picks its story and character, and what its title panel shows (UI Spec §5.3). Decide before M5.
4. *Decided (v0.7):* the Emerald UI adapts to 16:9 with 4× pixels on a 240 × 135 layout (UI Spec §1).
5. *Decided (v0.7):* 2 lines per page; the runtime splits longer lines across pages, and the 120-character story limit stays (§6, Story Schema §5.1).
6. *Decided (v0.8):* daily and weekly goals are set in-game, monthly challenges come from the story, coins use platform-fixed tiers, and the dev fills and prices the shop (§13).
7. *Decided (v0.8):* device clock everywhere; stories follow the date and time of day; public slots sync the dev's pushes (§13.3, §14). Still open: date events beyond this (e.g. holidays).
8. *Decided (v0.8):* the tracker is AGENDA, in each slot's start menu (§13).
9. **Coin tiers:** how many difficulty tiers, and coins per tier. Decide before M7.
10. **Shop assets:** which in-game assets the shop sells and how they're used, given there are no items or inventory at launch (§1). Decide before M7.
11. **Public slot membership:** how the dev invites players, how players leave, and what a player sees offline. Decide before M9.
12. **Dynamic scene cast:** which characters appear in a dynamic scene (the players' own characters, NPCs, or both). Decide before M9.
13. **Packs in public slots:** how the dev's asset packs reach the players' devices (large files), and what that costs on Firebase. Decide before M9.

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
| 2026-09-29 | v0.7: UI Spec v0.1 adopted. UI at 4× pixels on a 240 × 135 layout; dialogue box 2 lines per page with pagination; inline speaker names instead of a name plate (§6, §12, §15 Q4–Q5 decided) |
| 2026-09-29 | v0.8: tracker design. 4 save slots, private (local productivity tracker) or public (live campaign, account required) (§10); stories told in monthly or weekly episodes on the device's date and time (§13.3); AGENDA with daily, weekly and monthly tasks, place tasks with a focus timer, platform coin tiers and a dev-filled shop (§13); dev mode in OPZIONI with quick edit forms and an Edit panel (§14.1); public slots: one dev-set timeline, story order with live dev override, dynamic scenes, push and sync (§14.3); trusted server clock dropped (§14.4). Q6–Q8 decided; Q9–Q12 added. Answers Claude Code spec issues #1, #2 and #6 |
| 2026-09-29 | v0.9: no official asset library: locations, props, poses and audio come in user-made asset packs declared by stories (§4); location layers `ground`, `props`, characters, `overhead`; pixel-look art at native resolution with a recommended bright Emerald-like palette; time of day as an engine tint plus glow sprites (§4); `idle` animation set from M4 (§3); dynamic scenes are watched, not walked (§14.3); milestone references follow Brief v0.14; Q13 added |
