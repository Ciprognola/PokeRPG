# PokeRPG — Project Brief
*Version 0.11 · 2026-09-29 · Owner: PM · Status: draft pending PO approval*

## 1. Vision
A functional **sandbox story platform**, not a single game. We build the engine, the tools, the specs and the asset library once; users create the stories. The app is a player and validator, not a heavy editor.

- No lore, protagonist or fixed setting is built into the platform.
- Stories are made of NPCs, quests and tasks. There is no combat and there are no collectible creatures.
- Official stories with fixed, dev-made scenes serve as showcase content.
- Around the stories, the platform has fixed systems of its own: an **Emerald-style UI shell**, a **life tracker** where real-life tasks earn in-game coins and rewards, and an optional **account** with a real-time clock (GDD §12–§14).

## 2. Locked decisions
| Area | Decision |
|---|---|
| Platform | Web browser (HTML5) |
| Language | **Italian only** for everything users see: the game and its UI, the Slicer, the importer, `story:check` and `story:pack` output, the Story Prompt Kit, the Sprite Reference Document and the README's user sections. Internal specs, code, technical docs, JSON field names, ids and file names stay in English. Each story declares its own `language` (Story Schema §3) |
| Engine | Phaser + TypeScript + Vite. The major version (3 or 4) is chosen by the PO after Claude Code's evaluation (PKR-015), before M4 build work starts (§8 Q3) |
| Art style | 2D hand-painted world (see §8 Q4). The UI follows the UI look row |
| UI look | Exact Pokémon Emerald look and feel: dialogue box, menus, font style, cursor, text reveal, menu sounds, transitions. Fixed by the platform: stories and players cannot change it. Public builds use original, recreated assets only |
| Gameplay | NPCs, linear quests (talk, reach a place, scripted scenes), dialogue, world-state flags. Items and branching choices come after launch. No battles, no creatures |
| Player character | Always the player's own character: character creator (layered parts) or sprite import that meets the Asset Spec. Stories never define the hero |
| Sprites v1 | Walking only: 24 frames = 4 directions × 6 walk frames |
| Future animations | Modular add-on animation sets (running, fishing, gym…) on the same canvas and anchor; expressions via dialogue portraits, not body frames |
| Story creation | Story authors use **their own Claude Code** in a clone of the public repo, with the Story Prompt Kit, Story Template, Story Schema and `npm run story:check`. Players who only play need no AI |
| Asset library | Locations, maps, props, animations, music (Suno) made by our team. Users select only from the library. Story NPCs are the exception: imported character packages bundled with each story |
| Life tracker | Native platform system. Players log real-life tasks and progress, earn in-game coins, and spend them on rewards, in-game or real-life. Works without an account |
| Account and clock | Optional per player: Firebase login, set up or skipped at any time. It gives a trusted real-time clock for time and date events and coin rewards. Without an account, everything runs locally on the device clock |
| Scenes | Dev-made scenes are fixed story content, not reusable templates |
| Runs | A story run locks the exact assets and characters it uses (Run Manifest) |
| Storage | Local first (browser storage) with file export/import. Optional account (above). Online story sharing later |
| Private builds | A local build may replace UI art, font, sounds and music with the builder's own files from the **`overrides/` folder** at the repo root. It is git-ignored, CI fails if any file inside it is tracked, and the Pages deploy never includes it. Override files use the same names and sizes as the originals and are never committed, deployed or shared. The public repo and the public site ship only original assets |
| AI cost | Users bring their own AI: Claude Code for stories, any image AI for sprites. No built-in AI at launch |
| Planning | Full game planned up front, built and tested in milestones |
| Repo | Public GitHub repo `Ciprognola/PokeRPG`, MIT licence. Fully maintained by Claude Code. No ROMs, assets extracted from other games or reference captures of other games, ever |
| Docs | Repo `docs/` is the source of truth. PM writes, PO uploads, Project knowledge syncs from the repo. Claude Code reads `docs/` and chooses how to implement |

## 3. Pipelines
**Story pipeline**
Author clones the public repo → prompts their own Claude Code with the Story Prompt Kit → Claude Code builds the story package (JSON + asset references + NPC character folders) from the Story Template → Claude Code runs `npm run story:check` and fixes until there are 0 errors → import → the in-app importer validates again → play.

**Sprite pipeline**
User generates 24 raw frames with an image AI using the Sprite Reference Document → **Slicer tool** cuts, resizes, aligns and packs them into a layered, spec-compliant sheet → the layered sheet goes back to the AI for skins, costumes and accessories → Slicer re-validates → import.
The Sprite Reference Document is public so users get consistent AI quality, and we can test that quality.

**Asset library pipeline**
PM writes batch brief → Firefly generates from the locked style reference → Slicer normalizes → Claude Code integrates into the library.

**UI shell pipeline**
PO provides reference captures of the target UI **to the PM chat only** → PM writes the UI spec (layout, proportions, colours, timings) → original assets are drawn to match it → Claude Code builds the shell from the UI spec. The captures never enter the repo, and Claude Code never needs them. Private overrides use the same file names and sizes, so they are a straight swap.

## 4. Product modules
- **Player runtime** (Phaser): maps, movement, NPCs, dialogue, quests, saving.
- **UI shell**: the fixed Emerald-style dialogue box, menus and transitions shared by every story.
- **Life tracker**: real-life tasks, coins and rewards.
- **Account service** (optional): Firebase login and trusted time.
- **Importer/validator**: story and sprite validation with clear, line-specific errors; import/export.
- **Character creator**: layered painted parts.
- **Slicer tool**: sprite pipeline processing.
- **Asset library**: official locations, props, animations, music.
- **Run Manifest**: locks a run's assets.
- **Prompt kits**: the Story Prompt Kit (for the author's Claude Code) and the Sprite Reference Document (for image AIs).

## 5. Slicer tool — platform
Build it first as a **local browser tool (installable PWA)** in the same TypeScript codebase. One build runs on desktop and Android, works offline, keeps images on the user's device, and shares validation code with the in-game importer. A native Android app is built later only if the PWA proves insufficient.

## 6. Roadmap
| # | Milestone | Owner(s) |
|---|---|---|
| M0 | Foundations: this brief, AI Team Guide, GDD, Story Schema, Asset Spec, Art Style Guide, prompt kits | PM |
| M1 | Slicer tool (PWA) | Claude Code |
| M2 | Pipeline spike: PO tests story + sprite pipelines with real AIs | PO, PM |
| M3 | Style lock: reference style approved and frozen | Firefly, PO |
| M4 | Engine core: maps, movement, NPCs, dialogue, saving | Claude Code |
| M5 | Quest system, world state, validator, import/export | Claude Code |
| M6 | Character creator + sprite importer | Claude Code |
| M7 | Asset library v1 + music library | Firefly, Suno, Claude Code |
| M8 | Official showcase story (fixed dev scenes) | PM, Claude Code |
| M9 | Polish and launch | All |
| Later | Online sharing hub, optional built-in AI, native Android slicer | TBD |

The UI shell, life tracker and account are not placed in the roadmap yet (§8 Q6).

## 7. Risks
- **Sprite consistency across frames.** Image AIs struggle to keep one character identical across 24 frames. Mitigation: reference document, Slicer alignment, M2 spike, fallback to fewer poses or creator-based bodies.
- **Style mismatch of user sprites.** Technical spec can be enforced; style only guided. Mitigation: prompt kit, palette checks later.
- **Story package drift.** Mitigation: strict schema, template, validator in CI, in the author's `story:check` and in-app.
- **Story authoring needs Claude Code.** Only players with Claude Code can write stories. Accepted by the PO; everyone can still play shared stories.
- **Nintendo IP.** The codename and the Emerald-style UI make the project read as a Pokémon fan game, a category that is routinely taken down. Mitigation: only original assets in the public repo and site; no ROMs, extracted assets or reference captures in the repo; the `overrides/` folder is git-ignored and guarded in CI (PKR-014); final name before any public release.
- **Account data.** A login stores personal data (EU, GDPR). Mitigation: the account stays optional, stores minimal data, and ships with a privacy notice.
- **Clock cheating without an account.** Changing the device clock can farm coins or trigger date events. Accepted: the account is the fix for players who care.
- **Italian-only audience.** Everything users see is Italian, which limits the audience outside Italy. Accepted by the PO.
- **Art direction split.** A pixel-art UI over a hand-painted world may clash. Mitigation: decide in the Art Style Guide (§8 Q4).

## 8. Open questions
1. Long-term animation method: frame-by-frame sets vs skeletal/cutout rig (one painted body in parts, animations as data). Decide before M6.
2. Final product name. Before any public release.
3. Phaser 3 or Phaser 4 (stable since April 2026). Claude Code evaluates both against our needs (PKR-015); the PO decides before M4 build work.
4. Art direction: keep a hand-painted world, or move the world to pixel art to match the UI (M2 Firefly output already reads as crisp pixel art). Decide in the Art Style Guide, before M3.
5. Emerald UI on a 16:9 screen: letterbox to 3:2 or adapt the layout; Emerald's 2-line dialogue box vs our 3-line, 120-character page. Decide in the UI spec, before M4.
6. Roadmap placement of the UI shell, life tracker and account. Decide before M4.
7. Life tracker and clock details: GDD §15.

## 9. Decision log
| Date | Decision |
|---|---|
| 2026-09-28 | Web/HTML5, 2D hand-painted, full plan up front |
| 2026-09-28 | No battles or creatures; NPC/quest sandbox platform |
| 2026-09-28 | Users bring own AI; Claude Code builds story files from templates |
| 2026-09-28 | Local first, sharing later; dev scenes are fixed content |
| 2026-09-28 | Slicer tool added; GitHub fully maintained by Claude Code |
| 2026-09-28 | Slicer built first as local PWA (desktop + Android); native app only if needed |
| 2026-09-28 | Sprites v1 walking only (4×6); future animations as modular sets |
| 2026-09-28 | Asset Spec v0.1: 128×128 frame, 64 px tiles, anchor (64, 120), 96 px height, layered sheets, animation-set registry |
| 2026-09-28 | Docs live in repo `docs/`; PO uploads PM files; Claude Code reads docs and picks the approach |
| 2026-09-28 | Repo public with MIT licence; Slicer PWA deployed to GitHub Pages (offline install confirmed on Android) |
| 2026-09-28 | M1 Slicer built (PKR-002 to PKR-006). M2 sprite spike uses Adobe Firefly; key colour magenta `#FF00FF` |
| 2026-09-28 | M2 sprite spike: first Firefly character sliced with zero errors and consistent frames |
| 2026-09-28 | Player always brings their own character; launch quests are linear (talk, reach, scenes); items and branching after launch. GDD v0.1 |
| 2026-09-28 | Story NPCs are imported character packages bundled with the story (GDD v0.2); Story Schema v0.1 |
| 2026-09-28 | Story authors use their own Claude Code in a clone of the public repo; the Story Prompt Kit targets Claude Code, not generic chat AIs (v0.8) |
| 2026-09-28 | v0.9: Project description reconciled. Native life tracker (real-life tasks → coins → in-game or real-life rewards); optional Firebase account with real-time clock; exact Emerald-style UI, fixed by the platform, recreated with original assets in public builds; private builds may override UI and music from a git-ignored folder, never committed or deployed |
| 2026-09-29 | v0.10: Phaser major version reopened; Claude Code evaluates 3 vs 4 (PKR-015), PO decides before M4 build. Overrides folder named `overrides/` with a CI guard (spec issue #5). UI reference captures go to the PM chat only, never the repo (spec issue #4) |
| 2026-09-29 | v0.11: everything users see is Italian only, including the Slicer, `story:check`, the Story Prompt Kit and the Sprite Reference Document. Internal specs, code and ids stay in English |
