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

Stories are built by the author's **own Claude Code** in a clone of this public repo ([Project brief](docs/PROJECT_BRIEF.md) §3). There is no built-in AI, and players who only play need none of this.

1. Clone the repo and run `npm ci` (Node 24, see `.nvmrc`).
2. Start from the Story Template, [`templates/story_template/`](templates/story_template/), and follow the [Story Schema](docs/STORY_SCHEMA.md). The Story Prompt Kit for your Claude Code will be added to `docs/` when it is ready.
3. Check the story, and have Claude Code fix what it reports until it prints `0 errors`:

   ```sh
   npm run story:check -- templates/story_template     # replace with your story_<id> folder or .zip
   npm run story:check -- --help                        # usage, options, exit codes
   ```

4. Import the story in the app, which validates it again (the importer is not built yet).

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
