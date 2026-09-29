# Private build overrides (PKR-014)

Technical notes owned by Claude Code. The product decision is Project Brief §2 ("Private builds")
and §7 ("Nintendo IP"); GDD §12 covers the UI shell asset swap. This file is the how, not the why.

## What it is

A builder's own machine may hold an `overrides/` folder at the repo root, next to `package.json`.
It can hold the builder's own UI art, font, sound and music files, in place of the platform's
original, recreated assets — for example to preview against real Emerald captures locally, without
ever putting those captures in the repo (spec issue #4, resolved in Brief v0.10).

- **Git-ignored** (`.gitignore`): a normal `git add` never picks it up.
- **CI-guarded** (`tools/check-overrides.ts`, run as `npm run overrides:check`, part of `npm run
check` and the CI `check` job): fails the build if a file inside it is tracked anyway, e.g. via
  `git add -f`. This is independent of `.gitignore` on purpose — belt and suspenders.
- **Never deployed**: `deploy-slicer.yml` verifies the assembled Pages site carries nothing named
  `overrides` after every build.
- **A straight swap**: an override file uses the exact same relative path and file name as the
  original it replaces, and should match its size/dimensions, so no code has to know it exists.

## How a builder sets one up

1. Create `overrides/` at the repo root (it is not committed, so it starts absent for everyone).
2. Inside it, recreate the relative path of whatever original asset is being replaced — same
   structure as wherever that asset actually lives (e.g. an asset registered at `assets/ui/box.png`
   is overridden at `overrides/ui/box.png`).
3. Run the app locally. Nothing needs to be told the folder exists: the resolver in
   `tools/overrides.ts` checks `overrides/<relative path>` first and falls back to the original.
4. Delete the folder (or the one file) to go back to the original assets. Nothing to undo in git.

## What exists today vs. what's still to come

This ticket (PKR-014) is infrastructure only:

- `tools/overrides.ts` exports `resolveOverride(relativePath, originalRoot, overridesRoot?)`,
  proven with synthetic fixtures in `tools/overrides.test.ts` (no real UI/font/sound assets exist
  yet — see CLAUDE.md "Not built"). It is Node-only (uses `node:fs`), so it lives in `tools/`, not
  `@pokerpg/core` (architecture.md "Why core is DOM-free").
- Nothing calls `resolveOverride` yet. There is no UI shell, no font/sound loader and no asset
  registry entry it would resolve for (M4 placeholder). Wiring it into whichever loader M4 builds
  (most likely a Vite plugin or a Phaser loader plugin, resolved at build/load time, not baked into
  the deployed bundle) is that milestone's job, not this ticket's.
- "Same names and sizes as the originals" (Brief §2) is a rule for the builder to follow by hand
  for now. Once real assets and their registry entries exist, `resolveOverride`'s caller can add a
  dimension/size check reusing the existing sprite measurement code (`packages/core/src/measure.ts`)
  for images; there is nothing to measure against yet.

## Guard against path traversal

`resolveOverride` rejects a `relativePath` that climbs outside its root (e.g. `../secrets.env`).
Neither `overrides/` nor the original asset tree should ever be reachable from outside themselves
through this function.
