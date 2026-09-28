# Slicer app (PKR-005)

`packages/slicer/src`. Vanilla TypeScript, no UI framework, everything local. Flow: **add images → name the character and
assign a layer to each image → process → review → export**.

## Screens (`main.ts`)

- **Setup** (`ui/setup.ts`): character name (sanitised to `[a-z0-9-]`), _Add images_ / drag-drop. One image = a grid
  layer (6 × 4); exactly 24 images = a frames layer; any other count gets a plain-words message. Each layer card has a
  layer selector (a layer already used is not offered), an asset name (blank = the character's name) and a remove
  button. _Process_ stays disabled, with the reason listed, until there is a name and a body layer.
- **Busy**: progress per layer and frame, _Cancel_ (AbortSignal). Layers are extracted one at a time (`session.ts`,
  body first) so memory stays bounded; errors come back to the setup screen prefixed with the layer
  (`outfit layer · walk_left_03 · no character found (the cell is empty)`).
- **Review** (`ui/review.ts`): animated walk preview per direction (8 fps, paused when the tab is hidden), layer
  toggles, ground line / anchor / torso centreline / safe box overlay, 24 frame thumbnails (amber/red borders mark
  frames with findings), the findings list (tap one → jumps to that frame), and a selected-frame inspector with a
  nudge pad. _Download package_ is disabled while there are errors and allowed with warnings.

## Nudge

Whole-pixel shift of one frame, applied to **all layers** of that frame (±16 px). It is stored as `nudges[frameKey]`;
every change calls `composeCharacter(prepared, nudges, { encode: false })` (cheap, no PNG encoding), then redraws the
previews and re-renders the findings. Keyboard: arrows with the inspector focused. Reset removes it.

## Export

`composeCharacter(..., { encode: true })` → re-validated with the file-level checks (PNG-32, sRGB, size) → if still
`ok`, `zipFiles(packageFiles(...))` downloads `chr_<name>.zip` containing `chr_<name>/` with the sheets, atlases,
`character.json`, `report.json`. The zip is byte-reproducible.

## Layout and touch

Single column, works down to 360 px wide. Every button, select and text field is ≥ 44 px (asserted in the phone test);
`touch-action: manipulation`; no hover-only controls.

## Tests (Playwright, `npm run e2e`)

- `flow.spec.ts` (desktop): 3 layers (2 grids + 24 separate frames) → review → zip, opened and re-validated from scratch
  with core (zero errors); nudge shows in the inspector pixels, in validation and in the exported sheet; finding →
  frame jump; errors block the export; input errors are named.
- `phone.spec.ts`: emulated Pixel 5 (touch, `tap()`), no horizontal overflow, 44 px targets, full flow.
- `offline.spec.ts`: production build under `vite preview`; service worker installs, page reloads offline, whole flow
  and export work with the network off.
- Fixtures are synthetic (`@pokerpg/core/testing`); the tests write them to a temp folder.
