# PokeRPG — Project Brief
*Version 0.5 · 2026-09-28 · Owner: PM · Status: draft pending PO approval*

## 1. Vision
A functional **sandbox story platform**, not a single game. We build the engine, the tools, the specs and the asset library once; users create the stories. The app is a player and validator, not a heavy editor.

- No lore, protagonist or fixed setting is built into the platform.
- Stories are made of NPCs, quests and tasks. There is no combat and there are no collectible creatures.
- Official stories with fixed, dev-made scenes serve as showcase content.

## 2. Locked decisions
| Area | Decision |
|---|---|
| Platform | Web browser (HTML5) |
| Engine | Phaser 3 + TypeScript + Vite |
| Art style | 2D hand-painted |
| Gameplay | NPCs, quests, tasks, dialogue, items, world state. No battles, no creatures |
| Player character | Character creator (layered parts) + sprite import that must meet the Asset Spec |
| Sprites v1 | Walking only: 24 frames = 4 directions × 6 walk frames |
| Future animations | Modular add-on animation sets (running, fishing, gym…) on the same canvas and anchor; expressions via dialogue portraits, not body frames |
| Story creation | Users prompt their own AI; files are produced by Claude Code following our Story Template and Schema |
| Asset library | Locations, maps, props, animations, music made by our team. Users select only from the library |
| Scenes | Dev-made scenes are fixed story content, not reusable templates |
| Runs | A story run locks the exact assets and characters it uses (Run Manifest) |
| Storage | Local first (browser storage) with file export/import. Online sharing later |
| AI cost | Users bring their own AI. No built-in AI at launch |
| Planning | Full game planned up front, built and tested in milestones |
| Repo | Public GitHub repo `Ciprognola/PokeRPG`, MIT licence. Fully maintained by Claude Code |
| Docs | Repo `docs/` is the source of truth. PM writes, PO uploads, Project knowledge syncs from the repo. Claude Code reads `docs/` and chooses how to implement |

## 3. Pipelines
**Story pipeline**
User prompts an AI with the Story Prompt Kit → Claude Code builds the story package (JSON + asset references) from the Story Template → validator checks it against the Story Schema → import → play.

**Sprite pipeline**
User generates 24 raw frames with an image AI using the Sprite Reference Document → **Slicer tool** cuts, resizes, aligns and packs them into a layered, spec-compliant sheet → the layered sheet goes back to the AI for skins, costumes and accessories → Slicer re-validates → import.
The Sprite Reference Document is public so users get consistent AI quality, and we can test that quality.

**Asset library pipeline**
PM writes batch brief → Firefly generates from the locked style reference → Slicer normalizes → Claude Code integrates into the library.

## 4. Product modules
- **Player runtime** (Phaser): maps, movement, NPCs, dialogue, quests, saving.
- **Importer/validator**: story and sprite validation with clear, line-specific errors; import/export.
- **Character creator**: layered painted parts.
- **Slicer tool**: sprite pipeline processing.
- **Asset library**: official locations, props, animations, music.
- **Run Manifest**: locks a run's assets.
- **Prompt kits**: user-facing guides for text and image AIs.

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

## 7. Risks
- **Sprite consistency across frames.** Image AIs struggle to keep one character identical across 24 frames. Mitigation: reference document, Slicer alignment, M2 spike, fallback to fewer poses or creator-based bodies.
- **Style mismatch of user sprites.** Technical spec can be enforced; style only guided. Mitigation: prompt kit, palette checks later.
- **Story package drift.** Mitigation: strict schema, template, validator in CI and in-app.
- **Codename.** "Poke" risks confusion with Nintendo IP at launch. Review before any public release.

## 8. Open questions
1. Long-term animation method: frame-by-frame sets vs skeletal/cutout rig (one painted body in parts, animations as data). Decide before M6.
2. Final product name.
3. Phaser 3 (locked) or Phaser 4 (now the current major). Decide before M4.

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
