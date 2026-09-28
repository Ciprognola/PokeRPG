# PokeRPG

A sandbox story platform for the web: NPCs, quests and dialogue, with stories that authors build with their own Claude Code. Players who only play need no AI. The platform ships the engine, the tools, the specs and the asset library.

**Status:** M1 in progress — the Slicer tool. PokeRPG is a codename; the final name is undecided.

## Docs

The product documents live in [`docs/`](docs/) and are the source of truth:

- [Project brief](docs/PROJECT_BRIEF.md) — vision, decisions, roadmap
- [Asset spec](docs/ASSET_SPEC.md) — the technical contract for sprites and assets
- [AI team guide](docs/AI_TEAM_GUIDE.md) — how work is routed and tickets are written

Engineering notes are in [`docs-dev/`](docs-dev/).

## Slicer (M1)

An installable, offline-capable web app that cuts, scales, aligns and validates character sprite sheets. It runs entirely in the browser, and images never leave your device.

Once GitHub Pages is enabled it is published at `https://<owner>.github.io/PokeRPG/slicer/`.

## Writing a story

Stories are built by the author's **own Claude Code** in a clone of this public repo ([Project brief](docs/PROJECT_BRIEF.md) §3). There is no built-in AI, and players who only play need none of this. The whole guide is the **[Story Prompt Kit](docs/STORY_PROMPT_KIT.md)**: Part A is for you, Part B is the rulebook your Claude Code follows.

1. Install Node 24 (see `.nvmrc`) and git, clone the repo and run `npm ci` once.
2. Fill in the plan (kit A2) and paste the starter prompt (kit A3) into Claude Code, opened in the repo folder. It starts from the Story Template, [`templates/story_template/`](templates/story_template/), and follows the [Story Schema](docs/STORY_SCHEMA.md).
3. **Your story lives in `stories/story_<id>/`** (create the folder from the Template there, not inside `templates/`). Its NPC character folders go in `stories/story_<id>/characters/`, and the shared file is `stories/story_<id>.zip`. Everything in `stories/` except `.gitkeep` is git-ignored, so your story never lands in the repo. Library locations to build on are in [`assets/locations/`](assets/locations/) (`loc_*.json`).
4. Check the story, and have Claude Code fix what it reports until it prints `0 errors`:

   ```sh
   npm run story:check -- stories/story_my-tale         # your folder or .zip
   npm run story:check -- templates/story_template      # the working example
   npm run story:check -- --help                        # usage, options, exit codes
   ```

5. Pack it (writes `stories/story_<id>.zip` and checks it; don't zip by hand):

   ```sh
   npm run story:pack -- stories/story_my-tale
   ```

6. Import the story in the app, which validates it again (the importer is not built yet).

Details of the checker: [`docs-dev/story-validator.md`](docs-dev/story-validator.md).

## Development

Requires Node 24 (see `.nvmrc`).

```sh
npm ci
npm run dev      # Slicer dev server
npm run check    # typecheck, lint, format check, tests, build
```

Repo layout and conventions: [`CLAUDE.md`](CLAUDE.md) and [`docs-dev/architecture.md`](docs-dev/architecture.md).

## Licence

[MIT](LICENSE)
