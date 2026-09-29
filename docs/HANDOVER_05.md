# PokeRPG — Chat Handover #5
*2026-09-29 · From: PM chat #5 · Attach this file (and Claude Code's latest `docs-dev/HANDOVER.md`) to a new chat in the Project, then paste the starter prompt at the bottom.*

## Where we are
- **M0 (Foundations):** done except the Art Style Guide. UI Spec v0.1 added as a draft.
- **M1 (Slicer PWA):** done and live.
- **M2 (Pipeline spike):** passed.
- **Chat #5:** closed Handover #4 tasks 1–4. The runtime questions are decided, the platform is Italian only, and the UI Spec is drafted.

Knowledge files are the source of truth once synced. This note covers only what they don't.

## Docs (latest versions, all delivered in chat #5)
| File | Version | What changed |
|---|---|---|
| PROJECT_BRIEF | 0.12 | Phaser version reopened (PKR-015) · `overrides/` named · UI captures only in the PM chat · Italian only · Q5 decided |
| GDD | 0.7 | Five runtime defaults · Italian font and "Fine" end card · 2-line dialogue box with pagination, inline speaker names · Q4 and Q5 decided |
| STORY_SCHEMA | 0.7 | Runtime rules · Italian messages · `è` counts as 1 · a line can span pages. Format unchanged (`schemaVersion` "0.1") |
| ASSET_SPEC | 0.5 | Validation messages in Italian |
| STORY_PROMPT_KIT | 0.5 | Fully Italian · B3 cites §11 · gender-neutral Italian rule · don't write the speaker's name in the text |
| SPRITE_REFERENCE | 0.3 | Fully Italian; image-AI prompts stay English; Slicer labels Elabora, Esporta, Controlla fogli esistenti |
| UI_SPEC | 0.1 (new) | See "Decisions" |
| AI_TEAM_GUIDE | 0.2 | Unchanged |

At the end of chat #5, Project knowledge still showed Brief 0.10, GDD 0.5, Schema 0.5, Asset Spec 0.4 and Sprite Reference 0.2, and had **no STORY_PROMPT_KIT and no UI_SPEC**. Either the uploads are pending, or the knowledge sync doesn't include every `docs/` file. Check this first.

## Decisions made in chat #5
- **Runtime defaults (all five accepted):**
  - A `move` from the wrong start tile → warning, then walk from the actual tile.
  - `storyStart` triggers run before the first task.
  - Player name max 12 characters.
  - `patrol` returns to the nearest path point after a scene.
  - End card (title, author, "Fine"), then back to story selection.
- **Phaser 3 vs 4:** Claude Code evaluates both first (PKR-015); the PO decides before M4 build work. Phaser 4 has been stable since April 2026. The PM leans towards 4.
- **Language:** everything users see is **Italian only**. That covers the game, the Slicer, importer and `story:check` messages, both prompt kits and the README's user sections. Internal specs, code, ids and JSON fields stay English. Stories keep their own `language`.
- **UI Spec:**
  - 4× pixels on a 240 × 135 layout. The numbers line up: Emerald's 16 px tile × 4 = our 64 px tile, and 240 × 4 = 960.
  - 2 lines per page. The runtime paginates, and the 120-character story limit stays.
  - Speaker names appear inline in capitals when the speaker changes; there is no name plate.
  - One original font, drawn to the reference metrics.
  - Colours and layout were measured from the PO's video captures, marked ≈, and still to be verified at 1×.
- **ROM:** the PO uploaded an Emerald ROM and asked the PM to read it for assets and measurements. The PM declined and did not open it. Measurements come from screen captures only (Brief §3). Don't reopen this.

## Claude Code status
- **PKR-014** (PR #23): reviewed and passes. `overrides/` is guarded and `resolveOverride()` is in `tools/`. **Follow-up:** the M4 asset-loading ticket must route every UI, font, sound and music load through `resolveOverride()`, with a test.
- **PR #24:** Claude Code's handover chore.
- **Claude Code's 7 spec issues** (on Brief v0.9 / GDD v0.4):
  - #3, #4, #5 and #7 are answered: the font in UI Spec §2, captures and `overrides/` in Brief v0.10, the pointer in Story Schema §5.1.
  - #1, #2 and #6 (tracker location, saves with an account, the trusted clock) go to the tracker design.
- **PKR-016** (Italian user-facing text): written in chat #5, not yet confirmed as sent. The full message is below.
- **PKR-015** (Phaser evaluation + M4 plan): drafted in chat #5 and deferred until just before M4. Rewrite it from the Brief when M4 comes up.

### PKR-016 message (paste into a new Claude Code session)
````
Read CLAUDE.md and docs-dev/HANDOVER.md first. docs/ now has Brief v0.12: everything users see is Italian only. Propose a short plan before building.

ID: PKR-016            Milestone: M4 (prep)
Title: Italian user-facing text
Goal: Everything a user sees today reads in Italian.
Read: docs/PROJECT_BRIEF.md §2 (Language); docs/ASSET_SPEC.md §7; docs/STORY_SCHEMA.md §5.1, §11; docs/SPRITE_REFERENCE.md §7–§8; docs/STORY_PROMPT_KIT.md A1, B2
Constraints: Italian only, no language switch. Ids, JSON field names, frame keys, layer ids, file names, npm script names and CLI flags stay unchanged. Slicer buttons use the labels the Sprite Reference names (Elabora, Esporta, Controlla fogli esistenti). Messages keep their shape (file · path or frame · detail). Line length counts Unicode NFC characters, so an accented letter counts as 1.
Out of scope: docs/, docs-dev/, code comments and CLAUDE.md prose stay English; the game runtime (not built yet).
Acceptance criteria:
- [ ] Every user-visible string in the Slicer (UI, findings, PWA manifest name and description) is Italian
- [ ] Every Asset Spec §7 and Story Schema §11 message is Italian, and tests assert the Italian text
- [ ] story:check and story:pack output and --help are Italian
- [ ] README user sections are Italian, including a section titled "Scrivere una storia"
- [ ] Story Template text (title, objectives, dialogue) is Italian and gender-neutral toward the player, with language "it", and still passes story:check
- [ ] A test covers the 120-character limit on a line with accented letters
- [ ] CLAUDE.md states the rule: user-facing text Italian, internal English
Approach: Claude Code's choice.
Definition of done: tests added · CI green · technical docs updated · PR opened

Also: docs/UI_SPEC.md v0.1 is new (no build work yet). Update docs-dev/story-runtime-rules.md: the five runtime answers are in Story Schema v0.7; a story line may span several 2-line pages, and speaker names are added inline by the runtime (Story Schema §5.1, GDD §6).
````

## Next tasks (in order)
1. **PO actions** (see the checklist in chat #5's last message): upload the docs, fix the knowledge sync, merge #23 and #24, send PKR-016, update the Project instructions.
2. **Tracker, account and clock design:**
   - GDD §15 Q6–Q8 and Brief §8 Q6 (roadmap placement of the UI shell, tracker and account).
   - Answer Claude Code's spec issues #1, #2 and #6.
   - Name the tracker's start-menu entry (UI Spec §5.1).
   - Decide whether the reserved pocket-list and card layouts suit it (UI Spec §6.2).
   - Ask the PO one question at a time, each with a recommendation.
3. **Art Style Guide** (prepares M3):
   - Map construction: tilesets or painted backgrounds.
   - Hand-painted or pixel-art world (Brief §8 Q4). M2 Firefly output already reads as pixel art, and the 4× scale means 16 px pixel-art tiles map exactly onto our 64 px grid.
4. **PKR-015** before M4: the Phaser evaluation and the M4 ticket plan, including the `resolveOverride()` follow-up.
5. **UI Spec verification:** the PO supplies 1× captures (240 × 160 PNG, no filters) and recordings: yes/no prompt, naming screen, text speeds, menu, door transition (UI Spec §14).
6. **M8 showcase story inputs** from the PO.

## Open decisions and their deadlines
- **Art direction** and **map construction:** before M3.
- **Phaser 3 or 4:** before M4 build.
- **Roadmap placement of UI shell, tracker, account:** before M4.
- **Title and story-selection flow:** before M5.
- **Portraits and expressions**, **animation method:** before M6.
- **Cross-layer registration check:** after M2 layer data.
- **Character metadata** (`description` in `character.json`): not urgent.
- **Product name:** before any public release.

## Context not in the docs
- **Docs workflow:** the PM delivers complete updated files, only the changed ones, and ends with an "Upload to docs/:" list. The PO uploads them to `main`. The PM can't push to GitHub.
- **Claude Code:** tickets state the outcome and acceptance criteria; Claude Code picks the approach and reports `Spec issue` instead of working around a spec. Use one session per ticket group.
- **Doc uploads no longer break CI** (confirmed after PKR-013).
- **PO style:** short answers, tappable options, one question at a time, a recommendation with each option. The PO uses GitHub from a phone, so spell out the steps. The PO's app language is Italian, but chat with the PM happens in English.

## New Project instructions ("What this is" section)
Replace the old description. Roles and working rules stay as they are.
```
What this is
PokeRPG (codename) is a browser-based sandbox story platform: a top-down RPG engine where players bring their own character and play stories made of NPCs, quests and tasks. No combat, no creatures. Authors make stories with their own Claude Code and sprites with their own image AI, following our templates. Around the stories the platform has fixed systems of its own: an exact Pokémon Emerald-style UI (recreated with original assets in public builds), a life tracker where real-life tasks earn in-game coins and rewards, and an optional account (Firebase) with a real-time clock. Everything users see is in Italian. Full context: PROJECT_BRIEF.md.
IP rule: the public repo and site hold only original assets. ROMs and assets taken from other games never enter the repo or this chat's work; UI references come only from screen captures. The builder's own files may live only in the git-ignored overrides/ folder of a local build.
```

## Starter prompt for the new chat
```
Continue as PM for PokeRPG. Read the attached HANDOVER_05.md and Claude Code's HANDOVER.md, then start the first next task that's still open. Ask me only what blocks it.
```
