# Validate-only mode (PKR-006)

"Check existing sheets" on the home screen. Loads sheets that are already on spec (for example layers repainted by an AI
from a Slicer export), checks them, lets the user nudge and add layers, and exports with the same review, nudge and
export as the slicing flow.

## Core (`packages/core/src/import.ts`)

- `importSheets(sheets, { characterName })`: runs `validateCharacter` on the sheets as loaded. If something makes it
  impossible to cut them into frames or identify the character — `filename`, `unknown-set`, `sheet-size`,
  `duplicate-layer`, `missing-required-layer`, or sheets from several animation sets — the result is `ok: false` with
  exactly those findings. Otherwise it returns a `Prepared` with `scale: null` and zero automatic shifts, so
  **on-spec sheets are never rescaled or re-aligned**, and `composeCharacter` (shared with the slicing flow) does the rest.
- File-format findings (`png-format`, `srgb`, `file-size`) do not block: they become notes, because the export
  re-encodes every sheet as PNG-32 with an sRGB chunk.
- `mergeSheets(existing, added)`: adding a sheet for a layer that is already loaded replaces it.
- `readPackageZip(bytes)`: reads a `chr_<name>/` zip (name from the folder, else `character.json`), decodes PNGs
  losslessly, lists what it ignores (atlases, `character.json`, `report.json` are regenerated) and names any sheet it
  cannot read or a zip that holds several characters.

## Adding a layer, "checked against the character's body"

The new sheet is validated together with the loaded ones: the character must have a body for the set, one file per
layer per set, the same grid, and every §7 check applies to the new layer (border, safe box, file size). Per §7.1 there
is **no cross-layer registration check in this version**, so a layer that is offset relative to the body is caught only
where the offset pushes content out of the safe box or border (for example feet below row 119). Fixing it needs a
nudge that moves that layer alone.

## Nudge scope (shared with the slicing flow)

The review screen's nudge has a scope: **all layers** (default, as PKR-005) or **only one layer**, and **this frame** or
**all frames**. Layer-only shifts are `composeCharacter`'s `layerNudges` (`<layer>/<frameKey>`), applied on top of the
all-layer `nudges`. In this mode pixels pushed out of the 128 × 128 frame are cut in the export but kept while
reviewing, so a nudge can be undone.

## App (`ui/check.ts`, `io/sheets.ts`)

Add files (zip and/or sheets; drag-drop too). A loaded zip replaces the current set; loose sheets are merged. A sheet
whose name is not `spr_<set>_<layer>_<name>.png` gets a layer and name control to rename it. Problems are listed in
plain words next to a disabled _Review_. Going back from the review keeps the nudges as edits (baked into the sheets),
so another layer can be added on top.

PNG sheets are decoded by core (lossless: every pixel survives). Other formats and PNGs core cannot read
(interlaced, 1–4 bit) go through the browser decoder.

## Guarantees, tested

- Re-importing a Slicer export gives the same findings (zero new) and a **byte-identical zip** on re-export (core test
  and Playwright through the real app). This relies on the deterministic PNG encoder and zip writer.
- A misaligned new layer shows its findings against the character; a layer-only nudge clears them and leaves the
  body sheet byte-identical; an all-layer nudge does not clear them.
