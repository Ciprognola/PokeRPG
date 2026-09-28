# CLAUDE.md — PokeRPG

Standing brief for Claude Code. Keep it short; the product truth is in `docs/`.

## What this is

A sandbox story platform (Phaser 3 + TypeScript + Vite, web/HTML5), not a single game. Roadmap, decisions and risks: `docs/PROJECT_BRIEF.md`.

**Built so far:** the **Slicer** (M1: an installable, offline PWA that turns raw AI-generated sprite frames into spec-compliant layered sheets), and the **story pipeline** (validator, JSON Schema, Story Template, greybox library, `story:check`, `story:pack`). **Not built:** the Phaser runtime (`packages/game` is a placeholder; M4/M5), the in-app importer, the UI shell, life tracker and account (Brief v0.9 / GDD v0.4, not yet placed in the roadmap).

**Start of every session:** read `docs-dev/HANDOVER.md` (what is merged, open and known), then `git fetch` and check `main`'s latest CI run before starting a ticket.

**Story pipeline** (Brief §3): authors build stories with **their own Claude Code** in a clone of this public repo, from the Story Template and Story Schema, and run `npm run story:check` until it reports 0 errors; the in-app importer then validates the same package again. Players who only play need no AI. The author-facing guide is `docs/STORY_PROMPT_KIT.md` (Part B is the rulebook for the author's Claude Code); author stories live in the git-ignored `stories/` folder (`stories/story_<id>/`), never in the repo.

## Source of truth: `docs/`

- `PROJECT_BRIEF.md` (vision, roadmap) · `ASSET_SPEC.md` (the technical contract for sprites and library data) · `GDD.md` (how the player runtime behaves) · `STORY_SCHEMA.md` (the story package contract) · `STORY_PROMPT_KIT.md` (rulebook for authors' Claude Code) · `AI_TEAM_GUIDE.md` (workflow, ticket template).
- The runtime rules of Story Schema §6.1/§7.1 are recorded for M4/M5 in `docs-dev/story-runtime-rules.md` (build-to list, open questions).
- **Read the relevant doc fresh at the start of every task. Never edit `docs/`** (denied in `.claude/settings.json`, enforced by the `docs-guard` CI check). The PM writes it, the owner uploads it.
- If a spec is unclear, wrong, or blocks good engineering: **stop** and report
  `Spec issue: <file> §<section> — <problem> — <suggestion>`. Do not work around it and do not guess.
- Spec numbers live in code once, in `packages/core/src/spec.ts` (cites the section). When the spec changes, update that file and `assets/registry/animsets.json` together; a test keeps the registry JSON and code in sync.
- **Doc version numbers are never constants in code** (PKR-013): a docs-only version bump must not turn `main` red. Only file-format constants (`SPEC_VERSION`, `STORY_FORMAT_VERSION`, both `"0.1"`) exist; the sync tests compare the specs' tables with the code.

## Layout

```
packages/core/     pure TS, shared by Slicer + game importer: spec constants, registry, naming, findings, sprite and story validators
packages/slicer/   M1 PWA (Vite, vanilla TS, vite-plugin-pwa)
packages/game/     Phaser runtime placeholder (M4)
assets/registry/   animsets.json (content defined by Asset Spec §3)
docs-dev/          technical docs owned by Claude Code (architecture, decisions, HANDOVER.md, story-runtime-rules.md)
tools/             repo scripts (pose templates, story check, schema)
assets/            library data: registry, greybox locations
templates/         story_template/ (the starting point for user stories)
stories/           author stories (git-ignored except .gitkeep)
schemas/           story.schema.json (generated)
```

**Boundary rule:** `packages/core` must not touch the DOM, Phaser, or other packages (ESLint enforces it). Image
work takes plain pixel buffers (`{width,height,data:Uint8ClampedArray}`), so validators run in Node tests, in the Slicer, and in the game.

## Commands (Node 24, see `.nvmrc`)

`npm ci` · `npm run dev` (Slicer) · `npm run check` (typecheck + lint + format:check + test + build — run before every PR) · `npm test` · `npm run templates` (regenerate the pose-template zip; commit it) · `npm run story:check -- <folder|zip>` (validate a story) · `npm run story:pack -- <folder>` (zip a story next to its folder, then check the zip) · `npm run schema` / `npm run story-template` (regenerate the committed schema / template characters) · `npm run e2e` (Playwright in real Chromium; first time: `npx playwright install chromium`; CI runs it as its own job — run it when you touch the Slicer app, atlases or the PNG/zip code).
Single-package build with the Pages path: `BASE_PATH=/PokeRPG/slicer/ npm run build -w @pokerpg/slicer`
(Git Bash on Windows rewrites `/…` args: prefix `MSYS_NO_PATHCONV=1`).

## Workflow

- One ticket (`PKR-###`) = one branch = one PR; CI must be green. Branches: `feat/PKR-###-slug`, `fix/…`, `chore/…`. Work on a branch, never commit to `main`.
- Non-trivial or new area: propose a short plan first. Tickets state the outcome; the approach is yours.
- Definition of done: tests added · CI green · `docs-dev/` and this file updated if behaviour changed · PR opened with a "Not verified" section.
- Related tickets share a session; start fresh between unrelated groups.
- **CI tests the PR merged with `main`, not the branch alone.** A PR that conflicts with `main` gets no CI run at all, so "no checks" means "resolve the conflict" (merge `main` into the branch, never rebase). After a doc upload lands on `main`, the doc-sync tests may go red there until the next ticket catches the code up; that is expected. Merge-ready = the latest run is green on the PR as merged.

## Conventions

- Behaviour that must be reproducible (PNG encoding, zip, report, atlases) stays deterministic: no timestamps, no random, no locale-dependent output.
- English everywhere (code, UI, docs). Strict TypeScript, ESM, Prettier defaults in `.prettierrc.json`. Text files are LF.
- Validation messages follow Asset Spec §7: file · frame key · pixel, e.g. `spr_walk_body_mira.png · walk_up_04 · lowest opaque row 116 (expected 119)`.
- Images never leave the user's device (no upload, no analytics, no remote fonts/CDNs in the Slicer).
- Repo is public: no secrets, tokens or personal data in commits.
- **Never commit ROMs, or art, fonts, sounds or screenshots taken from other games** (Brief §2, §7). Only original assets, ever; that includes the PO's reference captures of a target UI, which stay out of the repo, PRs, CI artifacts and `docs/`. A private-build overrides folder (Brief §2) will be git-ignored and CI-guarded, but its name and the guard are not specified yet (see HANDOVER open items): don't create one until they are.
- "Poke" is a codename with an IP risk (Brief §7): keep it out of anything user-facing beyond the current tool titles until the name is decided. The Emerald-style UI adds to that risk, which is why original assets only.

## Reporting

Say plainly what was and wasn't verified. Real-device behaviour (Android install, touch, offline on a phone, performance on slow devices) is never verified in headless tests: flag it every time.
