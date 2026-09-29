# Handover

For the next Claude Code session. Written 2026-09-29 at the end of the `chore/roadmap-v014` session. Read `CLAUDE.md` first, then this. Rewrite this file (don't append) at the end of a working day.

## State of `main`

- Last commit: `981b7be` (a PM doc upload landing Project Brief **v0.14**, GDD **v0.9**, Asset Spec **v0.7**, Story Schema **v0.9**, UI Spec **v0.3**, AI Team Guide **v0.3**). `main`'s `CI` and `Deploy Slicer` runs are green as of the previous upload; **check the latest run again before starting**: `gh run list --branch main --limit 3`.
- PKR-016 (PR #26) and both docs-dev handover chores since (PR #27, PR #28) are merged. `docs/HANDOVER_05.md` no longer exists (deleted after PKR-016).
- Open PR: **`chore/roadmap-v014`** (this session) → `main`, not yet opened when this was written, will be right after. Docs-only: two stale milestone/library references fixed in `docs-dev/` (`story-validator.md`, `story-runtime-rules.md`) and this file brought current against Brief v0.14's roadmap. **Don't merge it yourself** — wait for instruction.
- Docs on `main` (PM-owned, never edit): Project Brief **0.14**, GDD **0.9**, UI Spec **0.3**, Story Schema **0.9**, Asset Spec **0.7**, Story Prompt Kit **0.5** (Italian), Sprite Reference **0.3** (Italian), AI Team Guide **0.3**. 8 files total in `docs/`. File-format versions in code stay `"0.1"`.

## Roadmap (Brief v0.14, §6) — changed again since the last rewrite

| #   | Milestone                                                                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0  | Foundations                                                                                                                                                           |
| M1  | Slicer tool (PWA)                                                                                                                                                     |
| M2  | Pipeline spike — **passed**                                                                                                                                           |
| M3  | **Location spike** (was "Style lock" before v0.14): PO tests `ground` images and props with an image AI from a draft Location Guide                                   |
| M4  | Engine core and UI shell: layered maps from greybox packs, movement, NPCs, **`idle` set**, dialogue, menus, saving                                                    |
| M5  | Quest system, world state, validator, import/export                                                                                                                   |
| M6  | **Asset packs + map tool** (new content, not just a renumbering): pack format, importer and validation, Slicer map tool, prop processing, Location Guide final        |
| M7  | Private mode: 4 save slots, AGENDA, coins + shop, dev-mode quick edit forms, episodes, date/time conditions, time-of-day tint                                         |
| M8  | Character creator + sprite importer                                                                                                                                   |
| M9  | Campaign mode: accounts, public slots, invites/roles, dev push + player sync, live scene override, dynamic scenes (templates, tags, anchors, scene poses), Edit panel |
| M10 | Official showcase story                                                                                                                                               |
| M11 | Polish and launch                                                                                                                                                     |

**There is no official asset library any more** (Brief v0.14 §2, decided at §8 Q4): locations, props, poses, dynamic-scene templates, music and sounds all come from **user-made asset packs** (`pack_<id>.zip`) that a slot's dev makes with their own AI and the Slicer, to the Asset Spec and the Location Guide. Stories declare the packs they need by id and version. The repo ships only greybox test packs; default packs may come _later_. This replaced the old "Asset library v1 + music library" milestone outright, not just its number.

Relative to the last rewrite of this file (Brief v0.13): Private mode moved **M6 → M7**, Character creator moved **M7 → M8**, and the old M8 "asset library" milestone is gone, replaced by the new **M6** "asset packs + map tool" (a different concept, not a renamed one). M3's content also changed ("Style lock" → "Location spike"), same number. M9-M11 unchanged in number; M9's dynamic-scenes scope grew (templates, tags, anchors, scene poses, all itemised now).

Fixed the two references this broke in `docs-dev/`: `story-validator.md` ("the real library arrives in M8" → rewritten: no library, asset packs instead, format finalised in M6) and `story-runtime-rules.md` ("M7 (character creation)" → **M8**). Grepped the rest of `docs-dev/` for `M[0-9]` and "library": nothing else was stale.

**New in M4**: an **`idle` animation set** (Asset Spec §2.5, §3) — 16 frames (4 rows × 4 cols, 512×512 px sheet), one looping standing-breathing cycle per direction, **optional per character** (a character without one idles on `walk` column 2 instead). Scene poses (`sit`, `sleep`…) are a separate set added later, with Campaign mode (M9).

## Spec issues #1, #2, #6 — answered (GDD v0.8, §10, §13-§14; unaffected by v0.14)

Still accurate after the roadmap change — the tracker/account/clock design itself didn't move, only the milestone that ships parts of it (Private mode) was renumbered M6→M7:

- **Tracker** is AGENDA, opened from each save slot's own start menu (GDD §13, §15 Q8 — decided).
- **Saves**: 4 slots, each **private** or **public** (GDD §10). A private slot is fully local — one device, no account — and portable only by exporting/importing the slot as a file. A public slot has one dev and several players, each on their own device with a Firebase account (§14.2), but **the account doesn't sync player saves**: only the **story content** syncs, via the dev's pushes (next week's content, a preview message, GDD §10, §14.3); each player's own save (progress, flags, position) stays on their own device and is never synced or pushed.
- **Clock**: there is no trusted server clock after all — every slot runs on the **device clock**; the server only timestamps/orders a public-slot dev's pushes (GDD §14.4). The old "which Firebase plan makes it trusted" question is moot — the trusted-clock design itself was dropped.

## What exists

| Area                                         | Where                                                                                                         | Notes                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Slicer PWA (M1)                              | `packages/slicer`, `packages/core`                                                                            | Setup → process → review → zip; validate-only mode; pose templates. Deployed to GitHub Pages under `/slicer/`. UI/findings/manifest Italian (PKR-016)                                                                                                                                                                                                                      |
| Sprite validators, assembly, extraction      | `packages/core`                                                                                               | Asset Spec §7; `report.json`; messages Italian (PKR-016)                                                                                                                                                                                                                                                                                                                   |
| Story validator, JSON Schema, Story Template | `packages/core/src/story`, `schemas/`, `templates/story_template/`                                            | PKR-009 to PKR-013, PKR-016. See `story-validator.md`. Template content Italian, gender-neutral, `language:"it"`                                                                                                                                                                                                                                                           |
| `npm run story:check` / `story:pack`         | `tools/`                                                                                                      | `pack` writes `story_<id>.zip` next to the folder, then checks it. Output and `--help` Italian (PKR-016)                                                                                                                                                                                                                                                                   |
| Greybox test data                            | `assets/locations/`, `assets/registry/audio.json`                                                             | 2 locations (bakery, harbour), placeholder audio ids. Stands in for a real asset pack until the pack format lands in M6 — there is no official library to "arrive" any more (see Roadmap above)                                                                                                                                                                            |
| Runtime rules for M4/M5                      | `docs-dev/story-runtime-rules.md`                                                                             | Build-to list from Story Schema §6.1/§7.1, current against GDD v0.7/UI Spec v0.1's dialogue-box rules (2 lines/page, pagination, inline speaker names). **Still not re-synced against GDD v0.8→v0.9 / Story Schema v0.8→v0.9** (AGENDA, save slots, asset packs, `idle` set) beyond the one milestone-number fix each round. Due a real pass next time a ticket touches it |
| Private build overrides (PKR-014)            | `overrides/` (git-ignored), `tools/overrides.ts`, `tools/check-overrides.ts`                                  | Guard + resolver only; nothing calls the resolver yet — the M4 asset loader must route every UI/font/sound/music load through `resolveOverride()`                                                                                                                                                                                                                          |
| Italian user-facing text (PKR-016)           | `packages/core`, `packages/slicer`, `tools/`, `templates/story_template/story.json`, `README.md`, `CLAUDE.md` | Merged (PR #26). Everything a Slicer user / story author / CLI caller reads is Italian; code, ids, comments, docs, `docs-dev/` stay English                                                                                                                                                                                                                                |

## Not built

Phaser runtime (`packages/game` is a placeholder), in-app story importer, character creator, asset-pack importer/map tool, UI shell, life tracker, account. All now have a milestone (M4 UI shell, M6 asset packs/map tool, M7 Private mode/tracker, M8 character creator, M9 account/Campaign mode — see Roadmap above) but nothing is built yet. Don't start anything without a ticket.

**PKR-015** (Phaser 3-vs-4 evaluation, Brief §8 Q3): still no ticket. The PM is deliberately holding it until just before M4 — don't start it early.

## Waiting on the PM (nothing implemented)

Read straight from the specs rather than restated in full here (they drift otherwise) — check `docs/GDD.md` §15, `docs/PROJECT_BRIEF.md` §8, `docs/STORY_SCHEMA.md` §12 and `docs/ASSET_SPEC.md` §9 directly for exact wording. As of the v0.14 doc family, milestone numbers in the specs themselves are already current (no renumbering needed there — only `docs-dev/`'s own prose was stale):

- GDD §15 Q1 (portraits/expressions, before M8), Q2 (items/branching scope), Q3 (title/slot/story-selection flow, before M5), Q9 (coin tiers, before M7), Q10 (shop assets, before M7), Q11 (public-slot membership/invites, before M9), Q12 (dynamic-scene cast, before M9), **Q13 new** (how a dev's asset packs reach players' devices in a public slot, and the Firebase cost — before M9).
- Story Schema §12: sound-effect naming/packaging (M6), episode/time-condition/AGENDA-challenge format (before M7), public-slot story-beat/dynamic-scene format (before M9), the `packs` field format for a story's asset-pack dependencies (M6).
- Asset Spec §9: portrait spec (no milestone yet, GDD's call), HiDPI masters (before M6), recolour/tint masks for the character creator (before M8), cross-layer registration check (after the M2 spike, which has passed — no ticket seen for it yet), dynamic-scene templates/tags/anchors/scene-pose sets (before M9), asset-pack folder layout/`pack.json`/id details (M6, after the M3 location spike).
- Brief §8 Q1 (animation method, before M8), Q2 (product name, before public release), Q3 (Phaser 3 vs 4 — still open, see PKR-015 above).
- Decided since the last rewrite of this file: Q4 (art direction — pixel-look world, no official library, asset packs instead) and Q6 (roadmap placement, see Roadmap above) both moved from open to _Decided_ in v0.14.

## Known issues

- `story:pack` is verified on Windows locally and Linux in CI; macOS is unverified.
- Slow-test flakiness under CPU load should be fixed: `vitest.config.ts` got a global `testTimeout: 15000` in the previous session (was the vitest 5000 ms default). Hasn't needed re-confirming since — no flake seen.
- Local branches for every merged PR (`feat/PKR-002` … `feat/PKR-016`, `chore/handover-*`, `chore/story-runtime-rules-ui-spec-v01`, `chore/docs-links`) still exist locally and on the remote. Safe to delete; not done, without being asked.
- `stories/story_the-lost-letter/` (+ zip) is a local, git-ignored spike story built to test the Prompt Kit. Passed `story:check` last it was checked. It isn't in the repo.
- `docs-dev/location-format-proposal.md` is superseded by Asset Spec §8.1 (it says so at the top); kept as history.
- `deploy-slicer.yml`'s overrides-content check (PKR-014) is still structural only: nothing currently emits anything named "overrides", so it hasn't been proven against a real leak. Starts doing real work once M4 wires an asset loader through `resolveOverride()`.
- `docs-dev/story-runtime-rules.md` hasn't been re-synced against GDD/Story Schema since v0.7 (see "What exists" above) — only stale milestone numbers get fixed as they're found; a real content pass is still owed.

## Working notes

- Ticket = branch `feat/PKR-###-slug` (or `chore/…`) = PR. Run `npm run check` before pushing; CI also runs `e2e` (Playwright) and `docs-guard`.
- `docs/` edits are denied by `.claude/settings.json` and by CI unless the PR carries the `docs-upload` label. The PM's uploads go straight to `main` as plain commits (not PRs) — **branch from a fresh `origin/main`** each time; a local branch can be several doc uploads behind within the same session. This has now happened at the start of three sessions in a row (v0.12→v0.13, then v0.13→v0.14 mid-session-gap) — always `git fetch && git log origin/main --oneline` before assuming what's current.
- Windows: Git Bash heredocs collapse a doubled backslash, so write code containing `'\\'` with the editor tool, not a heredoc. Prettier re-pads Markdown tables, so a small addition to `decisions.md` shows a large diff; check with `git diff -w`.
- A pure Node-side test (no CLI spawn) for a `tools/` script can be colocated as `tools/<name>.test.ts` — `vitest.config.ts`'s `include` covers `tools/**/*.test.ts` too. A CLI-spawn test needs the real repo root as the spawned `node`'s `cwd` (for `--import tsx` to resolve) — see `tools/check-overrides.test.ts` or `story-pack.test.ts`.
- Doc version numbers are not constants in code; don't add one.
- Never commit ROMs or assets from other games (Brief §2, §7). Same for PO reference captures of the target UI: PM chat only, never the repo. The PO once uploaded an Emerald ROM to the PM chat and the PM declined to open it — don't reopen that either, if it ever resurfaces here.
- Italian/English split (PKR-016, standing rule): user-facing strings (Slicer UI, CLI output/`--help`, validator messages, the Story Template's own content) are Italian; everything internal (code, comments, docs, `docs-dev/`, ids, JSON field names, file/script names, CLI flags) stays English. `CLAUDE.md`'s Conventions section has the exact wording and the maintainer-tooling exceptions (`check-overrides.ts`, the four `make-*` scripts, `validateLocationAsset`).
