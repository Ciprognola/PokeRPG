# Normalise, align and pack (PKR-004)

`packages/core/src/assemble.ts`. Implements `docs/ASSET_SPEC.md` §6 steps 2–5 with the §7.1 measurements. Pure and
DOM-free; deterministic (same input → same bytes).

## Two steps

- `prepareCharacter(input)` — the expensive part. Fits the scale, resamples every frame of every layer, computes each
  frame's automatic shift. Returns a `Prepared`.
- `composeCharacter(prepared, nudges, { encode })` — cheap. Applies shifts (automatic + manual nudges), packs 768 × 512
  sheets, builds atlases and `character.json`, encodes PNGs (optional), runs `validateCharacter`. A manual nudge only
  re-runs this step. Use `encode: false` for live feedback (file-level checks are then skipped) and `encode: true` for
  export.
- `assembleCharacter` = both. `packageFiles(assembled)` lists the `chr_<name>/…` files (sheets, atlases,
  `character.json`, `report.json`).

Validate-only mode (PKR-006) builds a `Prepared` directly from on-spec sheets (scale `null`, zero shifts) and reuses
`composeCharacter`, so review, nudge and export are the same code.

## Rules, and how each is enforced

1. **One scale per character.** `fitScale` measures the body of `walk_down_00` and bisects the scale until the body is
   exactly 96 rows (measured with the §7.1 definitions after resampling). Every frame of every layer then uses that one
   number (`Prepared.scale`). Walk bob is preserved: frames keep their own relative heights.
2. **Alignment from the body only.** Per frame: `dy = 119 − lowest opaque body row`, `dx = round(64 − torso centreline)`.
   The same `(dx, dy)` is applied to every layer of that frame.
3. **Layers stay registered.** All layers of a frame are resampled into the same window (the union of their scaled
   boxes) with the same transform, from the shared source-cell coordinate space that extraction preserves (`origin`).
   All layers must come from the same frame layout (cell size), else `cell-mismatch`.
4. **Resampling** (`resample`): separable area average on premultiplied alpha, so soft edges never gain a halo.
5. **Names** follow §4: `spr_walk_<layer>_<name>[_<variant>].png`, atlas `…json`, `chr_<name>/`. Names are checked
   against `[a-z0-9-]`.

## Outputs

- Atlas: Phaser JSON Hash, keys `walk_down_00 … walk_up_05`, each frame 128 × 128, plus `pivot {0.5, 0.9375}` (the spec
  anchor). Loads in Phaser 3.90 and 4.2.1 (Playwright test): frame names, cut rectangles, and sprite origin taken from
  the pivot.
- `character.json`: `{ id: "chr_<name>", specVersion, layers: { <layer>: { walk: <file> } } }` in layer order.
- `report.json`: see [report-format.md](report-format.md).

## Notes and limits

- Optional layers may have empty frames (`allowEmpty` in extraction gives a 0 × 0 frame); the body may not.
- If the source frames are smaller than the target (scale > 1) the sheet is upscaled and a note is added.
- Content pushed outside its 128 × 128 frame by a nudge is cut off (and counted in `notes`); the border/safe-box checks
  already flag such frames.
- Memory: extracted frames of all layers are held until `prepareCharacter` finishes (cropped to the character, ~0.9 MB
  per frame for a 4096² source, ~22 MB per layer). The prepared canvases are tiny. For very many layers on a phone the
  Slicer app (PKR-005) extracts one layer at a time and can drop a layer's frames once prepared.
