# Engineering decisions

Product decisions are logged in `docs/PROJECT_BRIEF.md` §9. This file records engineering choices made by Claude Code.

| Date       | Decision                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| 2026-09-28 | Monorepo with npm workspaces: `core` (pure TS, shared), `slicer` (PWA), `game` (Phaser, M4). Owner-approved   |
| 2026-09-28 | Slicer deploys to GitHub Pages under `/<repo>/slicer/` via GitHub Actions. Owner-approved                     |
| 2026-09-28 | English for code, UI and docs; ticket prefix `PKR-###`                                                        |
| 2026-09-28 | `core` may not touch the DOM or Phaser (lint-enforced); image checks operate on plain pixel buffers           |
| 2026-09-28 | Registry JSON and its in-code copy are kept in sync by a test                                                 |
| 2026-09-28 | TypeScript pinned to `~6.0` until typescript-eslint supports 7                                                |
| 2026-09-28 | `docs/` is protected twice: a Claude Code permission deny rule and a CI guard (label `docs-upload` overrides) |
| 2026-09-28 | Licence stays as committed by the owner (MIT); no second licence file                                         |
