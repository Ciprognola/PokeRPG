# PokeRPG

A sandbox story platform for the web: NPCs, quests and dialogue, with stories that authors build with their own Claude Code. Players who only play need no AI. The platform ships the engine, the tools, the specs and the asset library.

**Status:** M1 done, M2 passed. PokeRPG is a codename; the final name is undecided.

## Docs

The product documents live in [`docs/`](docs/) and are the source of truth:

- [Project brief](docs/PROJECT_BRIEF.md) — vision, decisions, roadmap
- [GDD](docs/GDD.md) — how the player runtime behaves
- [UI Spec](docs/UI_SPEC.md) — the fixed UI shell: layout, proportions, colours, timings
- [Asset spec](docs/ASSET_SPEC.md) — the technical contract for sprites and assets
- [Story Schema](docs/STORY_SCHEMA.md) — the story package contract
- [Story Prompt Kit](docs/STORY_PROMPT_KIT.md) — the rulebook for authors' Claude Code
- [Sprite Reference](docs/SPRITE_REFERENCE.md) — the author-facing guide to generating character sprites with an image AI
- [AI team guide](docs/AI_TEAM_GUIDE.md) — how work is routed and tickets are written

Engineering notes are in [`docs-dev/`](docs-dev/).

## Slicer (M1)

Un'app web installabile e utilizzabile offline che ritaglia, ridimensiona, allinea e valida i fogli sprite dei personaggi. Funziona interamente nel browser, e le immagini non lasciano mai il tuo dispositivo.

Una volta attivato GitHub Pages, è pubblicata su `https://<owner>.github.io/PokeRPG/slicer/`.

## Scrivere una storia

Le storie sono costruite dal **tuo Claude Code** in un clone di questo repo pubblico ([Project brief](docs/PROJECT_BRIEF.md) §3). Non c'è un'IA integrata, e chi gioca soltanto non ha bisogno di niente di tutto questo. La guida completa è il **[Kit di prompt per le storie](docs/STORY_PROMPT_KIT.md)**: la Parte A è per te, la Parte B è il regolamento che il tuo Claude Code segue.

1. Installa Node 24 (vedi `.nvmrc`) e git, clona il repo ed esegui `npm ci` una volta.
2. Compila il piano (kit A2) e incolla il prompt iniziale (kit A3) in Claude Code, aperto nella cartella del repo. Parte dal Story Template, [`templates/story_template/`](templates/story_template/), e segue lo [Story Schema](docs/STORY_SCHEMA.md).
3. **La tua storia vive in `stories/story_<id>/`** (crea lì la cartella a partire dal Template, non dentro `templates/`). Le cartelle personaggio dei PNG vanno in `stories/story_<id>/characters/`, e il file da condividere è `stories/story_<id>.zip`. Tutto ciò che è in `stories/` tranne `.gitkeep` è git-ignored, quindi la tua storia non finisce mai nel repo. I luoghi della libreria su cui costruire sono in [`assets/locations/`](assets/locations/) (`loc_*.json`).
4. Controlla la storia, e fai correggere a Claude Code quello che segnala finché non stampa `0 errori`:

   ```sh
   npm run story:check -- stories/story_my-tale         # your folder or .zip
   npm run story:check -- templates/story_template      # the working example
   npm run story:check -- --help                        # usage, options, exit codes
   ```

5. Impacchettala (scrive `stories/story_<id>.zip` e la controlla; non creare lo zip a mano):

   ```sh
   npm run story:pack -- stories/story_my-tale
   ```

6. Importa la storia nell'app, che la valida di nuovo (l'importer non è ancora stato costruito).

Dettagli del controllo: [`docs-dev/story-validator.md`](docs-dev/story-validator.md).

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
