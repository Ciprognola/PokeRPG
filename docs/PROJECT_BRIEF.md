# PokeRPG — Project Brief
*Version 0.14 · 2026-09-29 · Owner: PM · Status: draft pending PO approval*

## 1. Vision
A functional **sandbox story platform**, not a single game. We build the engine, the tools and the specs once; users create the stories and the asset packs. The app is a player and validator with a light in-game editor (dev mode); full stories are still written outside it.

- No lore, protagonist, fixed setting or official asset library is built into the platform. Each slot uses the asset packs its dev chooses, made with AI from our guides (e.g. places from Italy, Belgium and Greece).
- Stories are made of NPCs, quests and tasks. There is no combat and there are no collectible creatures.
- Stories are told in episodes (a calendar month, or a week) that follow the real date and time of day.
- Official stories with fixed, dev-made scenes serve as showcase content.
- Around the stories, the platform has fixed systems of its own (GDD §10, §12–§14):
  - an **Emerald-style UI shell**;
  - **4 save slots**, each **private** (one person as dev and player; a local productivity tracker where real-life goals earn coins for a shop) or **public** (a live campaign the dev runs for friends, e.g. alongside a tabletop D&D campaign, with pushed updates);
  - **AGENDA**, the life tracker inside each slot;
  - **dev mode**, the in-game tools for editing a slot's story;
  - an **account**, needed only for public slots.

## 2. Locked decisions
| Area | Decision |
|---|---|
| Platform | Web browser (HTML5) |
| Language | **Italian only** for everything users see: the game and its UI, the Slicer, the importer, `story:check` and `story:pack` output, the Story Prompt Kit, the Sprite Reference Document and the README's user sections. Internal specs, code, technical docs, JSON field names, ids and file names stay in English. Each story declares its own `language` (Story Schema §3) |
| Engine | Phaser + TypeScript + Vite. The major version (3 or 4) is chosen by the PO after Claude Code's evaluation (PKR-015), before M4 build work starts (§8 Q3) |
| Art style | World in **pixel-look at native resolution** (64 px tiles, 96 px characters), made with image AIs. The Location Guide recommends a bright, saturated, Emerald-like palette in neutral daylight with light from the top-left; packs may choose their own look. The engine tints locations for the time of day. The UI follows the UI look row |
| UI look | Exact Pokémon Emerald look and feel: dialogue box, menus, font style, cursor, text reveal, menu sounds, transitions. Fixed by the platform: stories and players cannot change it. Shown at 4× pixels on a 240 × 135 layout (UI Spec). AGENDA, the shop and dev mode use the same shell. Public builds use original, recreated assets only |
| Gameplay | NPCs, linear quests (talk, reach a place, scripted scenes), dialogue, world-state flags. Stories are told in monthly or weekly episodes on the device's date and time of day. Items and branching choices come after launch. No battles, no creatures |
| Save slots and modes | 4 slots on the title screen. **Private:** one person as dev and player, local only, mainly a productivity tracker. **Public:** one dev plus players, each with an account; one timeline set by the dev, with the story's scene order by default and live dev override. Every device keeps its own date and time of day |
| Player character | Always the player's own character: character creator (layered parts) or sprite import that meets the Asset Spec. Stories never define the hero |
| Sprites v1 | Walking only: 24 frames = 4 directions × 6 walk frames |
| Future animations | Modular add-on animation sets on the same canvas and anchor: `idle` from M4, scene poses (`sit`, `sleep`…) with Campaign mode (M9), others (running, fishing…) later. Expressions via dialogue portraits, not body frames |
| Story creation | Story authors use **their own Claude Code** in a clone of the public repo, with the Story Prompt Kit, Story Template, Story Schema and `npm run story:check`. A slot's dev can also adjust the story in-game with dev mode. Players who only play need no AI |
| Dev mode | Toggled in OPZIONI by the slot's dev. Quick edit forms for small changes, an Edit panel for bigger ones. Every edit is checked with the `story:check` rules. Private edits stay on the device; public edits are pushed to players, who receive them when they sync. No AI prompting at launch |
| Asset packs | **No official library.** Locations, props, poses, dynamic scene templates, music and sounds come in asset packs (`pack_<id>.zip`) that users make with their own AI and the Slicer, following the Asset Spec and the Location Guide. Stories declare the packs they need, by id and version; each slot keeps its packs. The repo ships only greybox test packs; default packs may come *later*. Story NPCs stay bundled with each story |
| Life tracker | **AGENDA**, a native platform system in each slot: daily and weekly goals set in-game, monthly challenges from the story files. Place tasks run a focus timer in an in-game place. In private slots, tasks are productivity goals that earn coins in platform-fixed tiers, spent in a shop the dev fills and prices (in-game assets or real-life rewards). In public slots, the dev sets the campaign's tasks and there are no coins |
| Account and clock | Firebase login, **required only for public slots** (dev and players). Private slots never need it. There is **no trusted server clock**: every slot runs on the device clock; the server only timestamps and orders the dev's pushes |
| Scenes | Story scenes are fixed story content, not reusable templates. Dynamic scene templates (e.g. a campfire) are pack assets placed in tagged locations, used by public slots |
| Runs | A story run locks the exact asset pack versions and characters it uses (Run Manifest). Dev edits and pushes create a new story version for the slot (GDD §11) |
| Storage | Local first (browser storage). Private slots export and import as files. Public slots receive the dev's content through the account. Online story sharing later |
| Private builds | A local build may replace UI art, font, sounds and music with the builder's own files from the **`overrides/` folder** at the repo root. It is git-ignored, CI fails if any file inside it is tracked, and the Pages deploy never includes it. Override files use the same names and sizes as the originals and are never committed, deployed or shared. The public repo and the public site ship only original assets |
| AI cost | Users bring their own AI: Claude Code for stories, any image AI for sprites. No built-in AI at launch |
| Planning | Full game planned up front, built and tested in milestones |
| Repo | Public GitHub repo `Ciprognola/PokeRPG`, MIT licence. Fully maintained by Claude Code. No ROMs, assets extracted from other games or reference captures of other games, ever. User asset packs are user content: they stay with the slot or are shared as files, never in the repo |
| Docs | Repo `docs/` is the source of truth. PM writes, PO uploads, Project knowledge syncs from the repo. Claude Code reads `docs/` and chooses how to implement |

## 3. Pipelines
**Story pipeline**
Author clones the public repo → prompts their own Claude Code with the Story Prompt Kit → Claude Code builds the story package (JSON + asset references + NPC character folders) from the Story Template → Claude Code runs `npm run story:check` and fixes until there are 0 errors → import into a slot → the in-app importer validates again → play.

**Campaign pipeline (public slots)**
The dev writes episodes with the story pipeline → loads them into a public slot → adjusts them in dev mode (quick edits, Edit panel, live scene changes) → pushes updates → players sync and see them on their own device's date and time.

**Sprite pipeline**
User generates 24 raw frames with an image AI using the Sprite Reference Document → **Slicer tool** cuts, resizes, aligns and packs them into a layered, spec-compliant sheet → the layered sheet goes back to the AI for skins, costumes and accessories → Slicer re-validates → import.
The Sprite Reference Document is public so users get consistent AI quality, and we can test that quality.

**Asset pack pipeline**
Author generates location images (`ground`), props and poses with an image AI using the Location Guide → the Slicer processes props and sprites → the Slicer's map tool builds each location (grid, collision, `overhead` painting, props, spawns, exits, areas, light points) → the Slicer exports and validates `pack_<id>.zip` → import into a slot.

**UI shell pipeline**
PO provides reference captures of the target UI **to the PM chat only** → PM writes the UI spec (layout, proportions, colours, timings) → original assets are drawn to match it → Claude Code builds the shell from the UI spec. The captures never enter the repo, and Claude Code never needs them. Private overrides use the same file names and sizes, so they are a straight swap.

## 4. Product modules
- **Player runtime** (Phaser): maps, movement, NPCs, dialogue, quests, saving.
- **UI shell**: the fixed Emerald-style dialogue box, menus and transitions shared by every story and platform screen.
- **Save slots**: 4 slots, private or public.
- **AGENDA**: daily, weekly and monthly tasks, place tasks, coins and the shop.
- **Dev mode**: quick edit forms, the Edit panel and live scene control.
- **Account and sync service** (public slots): Firebase login, dev pushes, player sync.
- **Importer/validator**: story and sprite validation with clear, line-specific errors; import/export.
- **Character creator**: layered painted parts.
- **Slicer tool**: turns AI images into game-ready assets: sprites, props and, with the map tool, locations.
- **Asset packs**: the pack format, importer and validation. The repo holds only greybox test packs.
- **Run Manifest**: locks a run's assets.
- **Prompt kits**: the Story Prompt Kit (for the author's Claude Code), the Sprite Reference Document and the Location Guide (for image AIs).

## 5. Slicer tool — platform
Build it first as a **local browser tool (installable PWA)** in the same TypeScript codebase. One build runs on desktop and Android, works offline, keeps images on the user's device, and shares validation code with the in-game importer. A native Android app is built later only if the PWA proves insufficient.
From M6 the Slicer also processes props and includes the **map tool**: load a `ground` image, see the 64 px grid, tap tiles to set collision, paint the `overhead` layer, place props, spawns, exits, areas, anchors and light points, then export a validated location.

## 6. Roadmap
| # | Milestone | Owner(s) |
|---|---|---|
| M0 | Foundations: this brief, AI Team Guide, GDD, Story Schema, Asset Spec, UI Spec, prompt kits (Story Prompt Kit, Sprite Reference, Location Guide) | PM |
| M1 | Slicer tool (PWA) | Claude Code |
| M2 | Pipeline spike: PO tests story + sprite pipelines with real AIs | PO, PM |
| M3 | Location spike: PO tests `ground` images and props with an image AI from a draft Location Guide | PO, PM |
| M4 | Engine core and UI shell: layered maps from greybox packs, movement, NPCs, `idle` set, dialogue, menus, saving | Claude Code |
| M5 | Quest system, world state, validator, import/export | Claude Code |
| M6 | Asset packs + map tool: pack format, importer and validation, Slicer map tool and prop processing, Location Guide final | Claude Code, PM |
| M7 | Private mode: 4 save slots, AGENDA (daily, weekly and monthly tasks, place tasks), coins and shop, dev mode quick edit forms, episodes, date/time conditions and time-of-day tint. Local only | Claude Code |
| M8 | Character creator + sprite importer | Claude Code |
| M9 | Campaign mode: accounts, public slots, invites and roles, dev push and player sync, live scene override, dynamic scenes (templates, tags, anchors, scene poses), Edit panel | Claude Code |
| M10 | Official showcase story: a campaign demo with fixed dev scenes | PM, Claude Code |
| M11 | Polish and launch | All |
| Later | Default asset packs, online sharing hub, optional built-in AI (including AI prompting in dev mode), native Android slicer | TBD |

## 7. Risks
- **Sprite consistency across frames.** Image AIs struggle to keep one character identical across 24 frames. Mitigation: reference document, Slicer alignment, M2 spike, fallback to fewer poses or creator-based bodies.
- **Style mismatch of user assets.** Technical spec can be enforced; style only guided, and each pack chooses its own look. Mitigation: Sprite Reference and Location Guide, the M3 spike, palette checks later.
- **Story package drift.** Mitigation: strict schema, template, validator in CI, in the author's `story:check`, in-app and on every dev-mode edit.
- **Story authoring needs Claude Code.** Only people with Claude Code can write full stories. Accepted by the PO. Dev mode covers small and medium changes in-game, and everyone can still play shared stories.
- **Scope growth.** Asset packs, the map tool, Private and Campaign modes add tools, in-game editing and a sync backend. Mitigation: each has its own milestone (M6, M7, M9); Private mode is local only and ships first; AI prompting and default packs stay *later*.
- **Real places in packs.** Locations based on real places may come from photos with people or from pictures the author has no rights to. Mitigation: the Location Guide asks for the author's own photos or photos they have rights to, with no identifiable people; packs never enter the repo.
- **Nintendo IP.** The codename and the Emerald-style UI make the project read as a Pokémon fan game, a category that is routinely taken down. Mitigation: only original assets in the public repo and site; no ROMs, extracted assets or reference captures in the repo; the `overrides/` folder is git-ignored and guarded in CI (PKR-014); final name before any public release.
- **Account data.** Public slots need an account for the dev and every player, so we store friends' personal data (EU, GDPR). Mitigation: private slots need no account; the account stores minimal data and ships with a privacy notice.
- **Device clock.** Changing the device clock can farm coins or trigger date events. Accepted: it only affects that device, and coins exist only in private slots, where the player is also the dev.
- **Italian-only audience.** Everything users see is Italian, which limits the audience outside Italy. Accepted by the PO.
- **Pixel grid mismatch.** The UI is true pixel art at 4×, while the pixel-look world isn't snapped to that grid. Accepted by the PO.

## 8. Open questions
1. Long-term animation method: frame-by-frame sets vs skeletal/cutout rig (one painted body in parts, animations as data). Decide before M8.
2. Final product name. Before any public release.
3. Phaser 3 or Phaser 4 (stable since April 2026). Claude Code evaluates both against our needs (PKR-015); the PO decides before M4 build work.
4. *Decided (v0.14):* pixel-look world at native resolution; painted `ground` images with props and a painted `overhead` layer, built in the Slicer's map tool; time of day as an engine tint plus glow sprites; no official library, user-made asset packs instead (§2).
5. *Decided (v0.12):* the Emerald UI adapts to 16:9 with 4× pixels on a 240 × 135 layout; the dialogue box shows 2 lines per page and paginates, keeping the 120-character story limit (UI Spec).
6. *Decided (v0.13, updated v0.14):* the UI shell is built in M4, asset packs and the map tool in M6, Private mode in M7 and Campaign mode in M9 (§6).
7. *Decided (v0.13):* tracker, save slots, dev mode, account and clock (GDD §10, §13–§14). Remaining details are in GDD §15 Q9–Q12, Story Schema §12 and Asset Spec §9.

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
| 2026-09-29 | v0.12: UI Spec v0.1: 4× pixels on a 240 × 135 layout, 2-line dialogue box with pagination, inline speaker names |
| 2026-09-29 | v0.13: tracker design (GDD v0.8). 4 save slots, private (local productivity tracker) or public (live campaign for friends); monthly or weekly episodes on the device's date and time; AGENDA with coin tiers and a dev-filled shop; dev mode in OPZIONI; account required only for public slots; trusted server clock dropped. Roadmap: UI shell in M4, new M6 Private mode and M9 Campaign mode, later milestones renumbered (§8 Q6–Q7 decided) |
| 2026-09-29 | v0.14: art direction and assets. Pixel-look world at native resolution with a recommended bright Emerald-like palette; layered locations (`ground`, `props`, `overhead`) built in a Slicer map tool; time of day as an engine tint plus glow sprites; `idle` set in M4, scene poses in M9. No official library: user-made asset packs, declared by stories, kept per slot. Roadmap: M3 becomes a location spike, M6 asset packs + map tool, Private mode moves to M7, character creator to M8, the asset library milestone is removed (§8 Q4 decided) |
