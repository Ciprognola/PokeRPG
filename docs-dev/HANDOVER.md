# Handover

For the next Claude Code session. Written 2026-09-28 at the end of the PKR-013 day. Read `CLAUDE.md` first, then this. Rewrite this file (don't append) at the end of a working day.

## State of `main`

- Last commit checked: `d76a82c` (the PO's docs upload). Its CI run, and the run on the PKR-013 merge commit `ecbbcb0`, were green (typecheck, lint, format, 400 tests, build, e2e). **Check the latest run again before starting**: `gh run list --branch main --limit 3`.
- No open PRs other than the one that adds this file.
- Docs on `main` (PM-owned, never edit): Project Brief **0.9**, GDD **0.4**, Story Schema **0.4**, Story Prompt Kit **0.2**, Asset Spec **0.4**, AI Team Guide **0.2**. File-format versions in code stay `"0.1"`.

## What exists

| Area                                         | Where                                                              | Notes                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Slicer PWA (M1)                              | `packages/slicer`, `packages/core`                                 | Setup → process → review → zip; validate-only mode; pose templates. Deployed to GitHub Pages under `/slicer/` |
| Sprite validators, assembly, extraction      | `packages/core`                                                    | Asset Spec §7; `report.json`                                                                                  |
| Story validator, JSON Schema, Story Template | `packages/core/src/story`, `schemas/`, `templates/story_template/` | PKR-009 to PKR-013. See `story-validator.md`                                                                  |
| `npm run story:check` / `story:pack`         | `tools/`                                                           | `pack` writes `story_<id>.zip` next to the folder, then checks it                                             |
| Greybox library                              | `assets/locations/`, `assets/registry/audio.json`                  | 2 locations (bakery, harbour), placeholder audio ids                                                          |
| Runtime rules for M4/M5                      | `docs-dev/story-runtime-rules.md`                                  | Build-to list from Story Schema §6.1/§7.1, with the open questions                                            |

## Not built

Phaser runtime (`packages/game` is a placeholder), in-app story importer, character creator, UI shell, life tracker, account. The last three arrived in Brief v0.9 / GDD v0.4 and are **not on the roadmap yet** (Brief §8 Q6). Don't start anything from them without a ticket.

## Waiting on the PM (Spec issues, nothing implemented)

Reported at the end of the 2026-09-28 session; the PM answers, then a ticket follows.

1. GDD §9 puts the life tracker in the in-game menu, while §15 Q8 still asks where it lives.
2. GDD §10 says saves are "local only"; Brief §2 and GDD §14 add an optional account, and what syncs is open (§15 Q7).
3. GDD §12 asks for an "exact match" of Emerald's font and sounds but original assets only; the boundary between the two isn't drawn.
4. The PO's reference captures of the target UI (Brief §3): no rule says where they live. Standing rule: never in the repo.
5. The private-build overrides folder (Brief §2, §7; GDD §12) has no name or path, and the CI guard the Brief promises doesn't exist yet. Neither `.gitignore` nor a workflow mentions it.
6. GDD §14 "trusted server clock" on Firebase: what makes it trusted, and on which plan, isn't stated.
7. GDD §15 Q5 (2-line Emerald box vs 3 lines / 120 characters) would change `STORY_LIMITS`, the schema, the template and the Prompt Kit if the limit moves.

Older, from PKR-013, still open: the five runtime questions at the end of `story-runtime-rules.md` (first `move` point vs actor tile; `storyStart` trigger vs a first `scene` task; player-name length; `patrol` after a scene; what "story ends" shows), and two small doc mismatches (Kit B3 cites Schema §7.1 for something that is in §11; §11 lacks the §7.1 first-point rule).

## Known issues

- `story:pack` is verified on Windows locally and Linux in CI; macOS is unverified.
- **Slow tests flake under CPU load.** Several sprite tests (`import`, `key-colour`, `templates`, `validate`, the story-template generator check) take 1–3 s idle and hit vitest's default 5 s limit when the machine is busy (seen 2026-09-28 with a browser running: 13 of 400 timed out, then 400/400 on a rerun). Not a logic failure. `story-pack.test.ts` already sets its own 30 s limit; the others don't. If it bites CI, raise `testTimeout` in `vitest.config.ts` rather than retrying by hand.
- README's status line still says "M1 in progress" and its Docs list omits the GDD, Story Schema and Prompt Kit. Left alone: the status is the PM's call.
- Local branches for every merged PR (`feat/PKR-002` … `feat/PKR-013`, `chore/repo-setup`) still exist locally and on the remote. They are safe to delete; I didn't, without being asked.
- `stories/story_the-lost-letter/` (+ zip) is a local, git-ignored spike story built to test the Prompt Kit. It passes `story:check` with 0 errors and 0 warnings. It isn't in the repo.
- `docs-dev/location-format-proposal.md` is superseded by Asset Spec §8.1 (it says so at the top); kept as history.

## Working notes

- Ticket = branch `feat/PKR-###-slug` (or `chore/…`) = PR. Run `npm run check` before pushing; CI also runs `e2e` (Playwright) and `docs-guard`.
- `docs/` edits are denied by `.claude/settings.json` and by CI unless the PR carries the `docs-upload` label. The PM's uploads go straight to `main`, so **branch from a fresh `origin/main`** each time; a local branch can be several doc uploads behind.
- Windows: Git Bash heredocs collapse a doubled backslash, so write code containing `'\\'` with the editor tool, not a heredoc. Prettier re-pads Markdown tables, so a 3-row addition to `decisions.md` shows about 40 changed lines; check with `git diff -w`.
- Doc version numbers are not constants in code; don't add one.
- Never commit ROMs or assets from other games (Brief §2, §7).
