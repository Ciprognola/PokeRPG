# Handover

For the next Claude Code session. Written 2026-09-29 at the end of the PKR-016 session. Read `CLAUDE.md` first, then this. Rewrite this file (don't append) at the end of a working day.

## State of `main`

- Last commit: `aa8e8e7` (merge of PR #25, a docs-dev sync of `story-runtime-rules.md` with UI Spec v0.1 / GDD v0.7). `main`'s `CI` and `Deploy Slicer` runs are both green. **Check the latest run again before starting**: `gh run list --branch main --limit 3`.
- Open PR: **#26** `feat/PKR-016-italian-text` → `main`, all-Italian user-facing text (PKR-016). Two commits: the ticket itself, plus a same-session fix (see below). CI (`check`, `e2e`, `guard`) is green: `gh pr checks 26`. Not yet reviewed by the PO/PM — wait for merge instruction, don't merge it yourself.
- Docs on `main` (PM-owned, never edit): Project Brief **0.12**, GDD **0.7**, Story Schema **0.7**, Story Prompt Kit **0.5** (now itself written in Italian), Asset Spec **0.5**, Sprite Reference **0.3**, AI Team Guide **0.2**, and a new **UI_SPEC.md 0.1**. File-format versions in code stay `"0.1"`.
- **`CLAUDE.md`'s own "Source of truth: docs/" list (line ~17) doesn't mention `UI_SPEC.md` or `SPRITE_REFERENCE.md`**, both of which now exist and matter (UI Spec backs the dialogue-box pagination rules in `story-runtime-rules.md`; Sprite Reference is the author-facing prompt guide PKR-016 made Italian). Not fixed this session (out of scope for the ticket) — worth a one-line addition next time CLAUDE.md is touched for something else.
- **`docs/HANDOVER_05.md` is new on `main`** (landed with PR #25's "Add files via upload" commits). It's the **PM chat's own** handover note (chat #5 → a new PM chat), not a Claude Code file — don't confuse it with this file (`docs-dev/HANDOVER.md`), the names are one digit apart. It's where PKR-016's ticket text actually came from; everything it asked for is done (see below). What it flags as still open, for the PM/PO side, not a ticket yet: tracker/account/clock design (GDD §15 Q6-Q8, Brief §8 Q6), an Art Style Guide (before M3), the PKR-015 Phaser evaluation (deferred to just before M4), UI Spec 1× verification captures from the PO, and M8 showcase story inputs. Nothing here to start without a ticket.

## This session (PKR-016 review, PR #26)

Reviewed PR #26 against its acceptance criteria (from `docs/HANDOVER_05.md`'s PKR-016 message) with a file path for each:

- README user sections are Italian, section titled "Scrivere una storia" → [README.md:17-46](../README.md#L17-L46).
- Tests assert the Italian text of Asset Spec §7 / Story Schema §11 messages → `packages/core/test/validate.test.ts:241`, `packages/core/test/story-validate.test.ts` (many, e.g. lines 56, 313, 580).
- A test covers the 120-character limit on a line with accented letters → `packages/core/test/story-validate.test.ts:584-595` (precomposed and NFC-decomposed accents both checked).
- Story Template is gender-neutral toward the player, `language: "it"` → `templates/story_template/story.json:8` for language; **found and fixed a gap** (see below).
- `CLAUDE.md` states the Italian/English split rule → `CLAUDE.md` §"Conventions", the "User-facing text is Italian..." bullet.

**Gap found and fixed on the same branch**: `templates/story_template/story.json` line 49 had Rosa call the player "un visitatore" — a masculine noun, violating the Prompt Kit's B3 gender-neutral rule (`docs/STORY_PROMPT_KIT.md` line 85: no line may describe the hero or attribute a gender, `{player.name}`/"tu" only). No automated check catches this — B3 is a manual-review rule, not validator logic. Reworded to "Oh, c'è qualcuno. Un momento." (a generic pronoun, same pattern the template already uses elsewhere — "tutti"). `npm run story:check -- templates/story_template` still reports 0 errori. Commit `47a95ec`, pushed to `feat/PKR-016-italian-text`; PR #26 CI re-ran green afterwards.

Scanned the rest of the template's dialogue lines by hand for the same pattern (gendered adjectives/nouns applied to the player) — nothing else found.

## What exists

| Area                                         | Where                                                                                                         | Notes                                                                                                                                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Slicer PWA (M1)                              | `packages/slicer`, `packages/core`                                                                            | Setup → process → review → zip; validate-only mode; pose templates. Deployed to GitHub Pages under `/slicer/`. UI/findings/manifest now Italian (PKR-016)                                                        |
| Sprite validators, assembly, extraction      | `packages/core`                                                                                               | Asset Spec §7; `report.json`; messages now Italian (PKR-016)                                                                                                                                                     |
| Story validator, JSON Schema, Story Template | `packages/core/src/story`, `schemas/`, `templates/story_template/`                                            | PKR-009 to PKR-013, PKR-016. See `story-validator.md`. Template content Italian, gender-neutral, `language:"it"`                                                                                                 |
| `npm run story:check` / `story:pack`         | `tools/`                                                                                                      | `pack` writes `story_<id>.zip` next to the folder, then checks it. Output and `--help` now Italian (PKR-016)                                                                                                     |
| Greybox library                              | `assets/locations/`, `assets/registry/audio.json`                                                             | 2 locations (bakery, harbour), placeholder audio ids                                                                                                                                                             |
| Runtime rules for M4/M5                      | `docs-dev/story-runtime-rules.md`                                                                             | Build-to list from Story Schema §6.1/§7.1, now current against GDD v0.7/UI Spec v0.1: **2 lines per page**, runtime paginates a `line` across pages, speaker name added inline (not part of the 120-char budget) |
| Private build overrides (PKR-014)            | `overrides/` (git-ignored), `tools/overrides.ts`, `tools/check-overrides.ts`                                  | Guard + resolver only; nothing calls the resolver yet — the M4 asset loader must route every UI/font/sound/music load through `resolveOverride()`, per `docs/HANDOVER_05.md`                                     |
| Italian user-facing text (PKR-016, PR #26)   | `packages/core`, `packages/slicer`, `tools/`, `templates/story_template/story.json`, `README.md`, `CLAUDE.md` | Everything a Slicer user / story author / CLI caller reads is Italian; code, ids, comments, docs, `docs-dev/` stay English. Not yet merged                                                                       |

## Not built

Phaser runtime (`packages/game` is a placeholder), in-app story importer, character creator, UI shell, life tracker, account. Not on the roadmap yet (Brief §8 Q6). Don't start anything from them without a ticket.

**PKR-015** (Phaser 3-vs-4 evaluation, Brief §8 Q3): still no ticket. Per `docs/HANDOVER_05.md`, the PM has drafted it but is deliberately holding it until just before M4 — don't start it early.

## Waiting on the PM (Spec issues, nothing implemented)

Current open questions, read straight from the specs rather than restated here (they'll drift otherwise) — check `docs/GDD.md` §15 and `docs/PROJECT_BRIEF.md` §8 directly for the exact wording:

- GDD §15 Q1 (portraits/expressions), Q2 (items/branching scope), Q3 (title/story-selection flow), Q6 (life tracker rules: rewards, task kinds, coins), Q7 (time/date events, what an account syncs), Q8 (where the tracker lives).
- GDD §14: "a trusted server clock" — what makes it trusted, on which Firebase plan, is still unstated. Per `docs/HANDOVER_05.md` this folds into the tracker/account design work, not a standalone fix.
- Brief §8 Q1 (animation method), Q2 (product name), Q4 (art direction — hand-painted vs pixel-art world, decide in the Art Style Guide before M3), Q6 (roadmap placement of UI shell/tracker/account, same as GDD Q8).
- Q3 (Phaser 3 vs 4) and Q5 (UI scale/pagination) are resolved — see PKR-015 above and `story-runtime-rules.md`.

## Known issues

- `story:pack` is verified on Windows locally and Linux in CI; macOS is unverified.
- **Slow tests flake under CPU load.** Several sprite tests (`import`, `key-colour`, `templates`, `validate`, the story-template generator check) take 1-3 s idle and hit vitest's default 5 s limit when the machine is busy. Not a logic failure. `story-pack.test.ts` and `tools/check-overrides.test.ts`/`overrides.test.ts` already set their own longer limits where they spawn a real process or git; the others don't. If it bites CI, raise `testTimeout` in `vitest.config.ts` rather than retrying by hand.
- README's status line still says "M1 in progress", and its Docs list now omits **five** of the seven `docs/` files (GDD, Story Schema, Prompt Kit, UI Spec, Sprite Reference — only Project Brief, Asset Spec and AI Team Guide are linked). Left alone both times: the status/list is the PM's call, not something to fix unprompted.
- `CLAUDE.md`'s own doc list has the same gap for UI Spec and Sprite Reference — see "State of `main`" above.
- Local branches for every merged PR (`feat/PKR-002` … `feat/PKR-014`, `chore/handover-*`, `chore/story-runtime-rules-ui-spec-v01`) still exist locally and on the remote. Safe to delete; not done, without being asked.
- `stories/story_the-lost-letter/` (+ zip) is a local, git-ignored spike story built to test the Prompt Kit. Passed `story:check` last it was checked. It isn't in the repo.
- `docs-dev/location-format-proposal.md` is superseded by Asset Spec §8.1 (it says so at the top); kept as history.
- `deploy-slicer.yml`'s overrides-content check (PKR-014) is still structural only: nothing currently emits anything named "overrides", so it hasn't been proven against a real leak. Starts doing real work once M4 wires an asset loader through `resolveOverride()`.
- `docs/HANDOVER_05.md` (new, see "State of `main`") sits in `docs/` next to the PM's specs even though it's chat-continuity material, not a spec — noted here so it isn't mistaken for one; not something to move or delete without being asked, `docs/` edits are denied anyway.

## Working notes

- Ticket = branch `feat/PKR-###-slug` (or `chore/…`) = PR. Run `npm run check` before pushing; CI also runs `e2e` (Playwright) and `docs-guard`.
- `docs/` edits are denied by `.claude/settings.json` and by CI unless the PR carries the `docs-upload` label. The PM's uploads go straight to `main` as plain commits (not PRs) — **branch from a fresh `origin/main`** each time; a local branch can be several doc uploads behind within the same session, as it was twice this round (`docs/HANDOVER_05.md` landed mid-session).
- Windows: Git Bash heredocs collapse a doubled backslash, so write code containing `'\\'` with the editor tool, not a heredoc. Prettier re-pads Markdown tables, so a small addition to `decisions.md` shows a large diff; check with `git diff -w`.
- A pure Node-side test (no CLI spawn) for a `tools/` script can be colocated as `tools/<name>.test.ts` — `vitest.config.ts`'s `include` covers `tools/**/*.test.ts` too. A CLI-spawn test needs the real repo root as the spawned `node`'s `cwd` (for `--import tsx` to resolve) — see `tools/check-overrides.test.ts` or `story-pack.test.ts`.
- Doc version numbers are not constants in code; don't add one.
- Never commit ROMs or assets from other games (Brief §2, §7). Same for PO reference captures of the target UI: PM chat only, never the repo. Per `docs/HANDOVER_05.md`: the PO uploaded an Emerald ROM to the PM chat once and the PM declined to open it — don't reopen that either, if it ever resurfaces here.
- Italian/English split (PKR-016, now the standing rule): user-facing strings (Slicer UI, CLI output/`--help`, validator messages, the Story Template's own content) are Italian; everything internal (code, comments, docs, `docs-dev/`, ids, JSON field names, file/script names, CLI flags) stays English. `CLAUDE.md`'s Conventions section has the exact wording and the maintainer-tooling exceptions (`check-overrides.ts`, the four `make-*` scripts, `validateLocationAsset`).
