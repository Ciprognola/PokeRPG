# PokeRPG

A sandbox story platform for the web: NPCs, quests and dialogue, with stories that people create with their own AI. The platform ships the engine, the tools, the specs and the asset library.

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
