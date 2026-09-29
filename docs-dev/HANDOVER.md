# Handover

For the next Claude Code session. Written 2026-09-29 at the end of the PKR-014 session. Read `CLAUDE.md` first, then this. Rewrite this file (don't append) at the end of a working day.

## State of `main`

- Last commit checked: `c0758fd` (a PM docs upload landing Project Brief **v0.10**, GDD **v0.5**, Story Schema **v0.5**). Its CI run and the Deploy Slicer run were both green. **Check the latest run again before starting**: `gh run list --branch main --limit 3`.
- Open PR: **#23** `feat/PKR-014-overrides-guard` → `main`. Two commits: the PKR-014 ticket itself, and a small docs-dev-only sync of `story-runtime-rules.md` (requested mid-session, not part of the ticket). `npm run check` was green locally before pushing; CI (`check`, `e2e`) was still running as this was written, `docs-guard` had already passed (the PR touches no `docs/` file). Check its status before starting anything else: `gh pr checks 23`.
- Docs on `main` (PM-owned, never edit): Project Brief **0.10**, GDD **0.5**, Story Schema **0.5**, Story Prompt Kit **0.2**, Asset Spec **0.4**, AI Team Guide **0.2**. File-format versions in code stay `"0.1"`.

## What exists

| Area                                         | Where                                                                        | Notes                                                                                                                                                   |
| -------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Slicer PWA (M1)                              | `packages/slicer`, `packages/core`                                           | Setup → process → review → zip; validate-only mode; pose templates. Deployed to GitHub Pages under `/slicer/`                                           |
| Sprite validators, assembly, extraction      | `packages/core`                                                              | Asset Spec §7; `report.json`                                                                                                                            |
| Story validator, JSON Schema, Story Template | `packages/core/src/story`, `schemas/`, `templates/story_template/`           | PKR-009 to PKR-013. See `story-validator.md`                                                                                                            |
| `npm run story:check` / `story:pack`         | `tools/`                                                                     | `pack` writes `story_<id>.zip` next to the folder, then checks it                                                                                       |
| Greybox library                              | `assets/locations/`, `assets/registry/audio.json`                            | 2 locations (bakery, harbour), placeholder audio ids                                                                                                    |
| Runtime rules for M4/M5                      | `docs-dev/story-runtime-rules.md`                                            | Build-to list from Story Schema §6.1/§7.1. All five open runtime questions are now answered (GDD v0.5/Schema v0.5)                                      |
| Private build overrides (PKR-014, PR #23)    | `overrides/` (git-ignored), `tools/overrides.ts`, `tools/check-overrides.ts` | Guard + resolver only; nothing calls the resolver yet — no UI/font/sound asset or loader exists to wire it into (M4's job). See `docs-dev/overrides.md` |

## Not built

Phaser runtime (`packages/game` is a placeholder), in-app story importer, character creator, UI shell, life tracker, account. The last three arrived in Brief v0.9 / GDD v0.4 and are **not on the roadmap yet** (Brief §8 Q6). Don't start anything from them without a ticket.

New in Project Brief v0.10: **PKR-015**, a Phaser 3-vs-4 evaluation for Claude Code to do before the PO decides (Brief §8 Q3) — no ticket for it exists yet, don't start it without one.

## Waiting on the PM (Spec issues, nothing implemented)

Two of the five items from the 2026-09-28 session (#4, #5) were answered by Brief v0.10 and are done (#5 via PKR-014, PR #23). Still open:

1. GDD §9 puts the life tracker in the in-game menu, while §15 Q8 still asks where it lives.
2. GDD §10 says saves are "local only"; Brief §2 and GDD §14 add an optional account, and what syncs is open (§15 Q7).
3. GDD §12 asks for an "exact match" of Emerald's font and sounds but original assets only; the boundary between the two isn't drawn.
4. GDD §14 "trusted server clock" on Firebase: what makes it trusted, and on which plan, isn't stated.
5. GDD §15 Q5 (2-line Emerald box vs 3 lines / 120 characters) would change `STORY_LIMITS`, the schema, the template and the Prompt Kit if the limit moves.

Resolved this session (docs-dev synced, no ticket needed — they were already answered by the spec, not implementation work): the five PKR-013 runtime questions (`move`'s wrong start tile, `storyStart` vs. a first `scene` task, player name length, `patrol` after a scene, what "story ends" shows) — see `story-runtime-rules.md`'s "Resolved" section. One of the two small doc mismatches from that list is also fixed (Schema §11 now cites §7.1 for the move-start-tile rule). Still open, PM's to fix in the Kit: the Story Prompt Kit (B3, still v0.2) cites Schema §7.1 for the "validator can't check collision" claim; Schema now states that in §11.

## Known issues

- `story:pack` is verified on Windows locally and Linux in CI; macOS is unverified.
- **Slow tests flake under CPU load.** Several sprite tests (`import`, `key-colour`, `templates`, `validate`, the story-template generator check) take 1–3 s idle and hit vitest's default 5 s limit when the machine is busy (seen 2026-09-28 with a browser running: 13 of 400 timed out, then 400/400 on a rerun). Not a logic failure. `story-pack.test.ts` and the new `tools/check-overrides.test.ts`/`overrides.test.ts` already set their own longer limits where they spawn a real process or git; the others don't. If it bites CI, raise `testTimeout` in `vitest.config.ts` rather than retrying by hand.
- README's status line still says "M1 in progress" and its Docs list omits the GDD, Story Schema and Prompt Kit. Left alone: the status is the PM's call.
- Local branches for every merged PR (`feat/PKR-002` … `feat/PKR-013`, `chore/repo-setup`, `chore/handover-docs-sync`) still exist locally and on the remote. They are safe to delete; I didn't, without being asked.
- `stories/story_the-lost-letter/` (+ zip) is a local, git-ignored spike story built to test the Prompt Kit. It passes `story:check` with 0 errors and 0 warnings. It isn't in the repo.
- `docs-dev/location-format-proposal.md` is superseded by Asset Spec §8.1 (it says so at the top); kept as history.
- `deploy-slicer.yml`'s new overrides-content check (PKR-014) is structural only: nothing in the current build currently emits anything named "overrides", so the check hasn't yet been proven against a real leak. It will start doing real work once M4 wires an asset loader through `resolveOverride()`.

## Working notes

- Ticket = branch `feat/PKR-###-slug` (or `chore/…`) = PR. Run `npm run check` before pushing; CI also runs `e2e` (Playwright) and `docs-guard`.
- `docs/` edits are denied by `.claude/settings.json` and by CI unless the PR carries the `docs-upload` label. The PM's uploads go straight to `main`, so **branch from a fresh `origin/main`** each time; a local branch can be several doc uploads behind. (This bit twice in one day this session: the ticket's brief referenced Brief v0.10 and, mid-session, GDD/Schema v0.5, neither of which were on `main` yet when the session started — both landed via a PM upload minutes into the session. Re-`git fetch origin` if a ticket cites a doc version you don't see locally; don't guess at what it says.)
- Windows: Git Bash heredocs collapse a doubled backslash, so write code containing `'\\'` with the editor tool, not a heredoc. Prettier re-pads Markdown tables, so a 3-row addition to `decisions.md` shows about 40 changed lines; check with `git diff -w`.
- A pure Node-side test (no CLI spawn) for a `tools/` script can be colocated as `tools/<name>.test.ts` and picked up directly — `vitest.config.ts`'s `include` now covers `tools/**/*.test.ts` as well as `packages/*/test/**/*.test.ts` (PKR-014). A CLI-spawn test still needs the real repo root as the spawned `node`'s `cwd` (for `--import tsx` to resolve), with whatever it's testing passed as an argument instead — see `tools/check-overrides.test.ts` for the pattern, and `story-pack.test.ts` for the original.
- Doc version numbers are not constants in code; don't add one.
- Never commit ROMs or assets from other games (Brief §2, §7). Same for PO reference captures of the target UI: those go to the PM chat only (Brief v0.10), never the repo.
