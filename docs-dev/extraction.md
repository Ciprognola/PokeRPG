# Frame extraction (PKR-003)

`packages/core/src/extract.ts` (pure, DOM-free) and `packages/slicer/src/io/` (browser decoding). Implements
`docs/ASSET_SPEC.md` §6 input and step 1.

## Inputs

- **Grid**: one image, 6 columns × 4 rows, spec order (row-major: down, left, right, up × walk columns 0–5). Cell
  boundaries are `round(i × size / n)`, so sizes that don't divide evenly still work. Images whose cells would be
  under 16 px are rejected (`bad-grid`).
- **24 files**: `orderFrameFiles(names)` places them by frame key if every name contains one (`walk_left_03`), else by
  natural sort of the names (`f2` before `f10`). Not exactly 24, or a frame claimed twice → named error.
- Both feed the same per-cell `extractFrame`, so they give identical frames.

## Per frame (`extractFrame`)

1. **Background detection** from the cell border ring: ≥ 50 % transparent → transparent; otherwise the dominant colour
   of the ring, accepted if ≥ 60 % of the ring is within `bgTolerance` (24 per channel). Neither → `no-background`.
2. **Character mask**: flat colour — flood-fill the background inwards from the border; transparent — alpha ≥ 8.
3. **Specks**: 8-connected components smaller than 2 % of the largest are dropped. A cell with nothing left →
   `empty-cell`.
4. **Enclosed holes** (flat only): background-coloured regions fully inside the character are cut out when larger than
   0.3 % of the character's bounding box (a gap between arm and body goes; a small eye highlight stays).
5. **Soft edge**: pixels within `edgeBand` (2–6 px, scaled with cell size) of the outside are un-mixed. Flat: the alpha
   is the projection of the pixel onto the background→character colour line (the character colour is the local
   average of interior pixels) and the colour is recovered as `bg + (p − bg) / α`, so an edge over green does not stay
   greenish. Transparent: partially transparent pixels take the local interior colour (kills white/black mattes).
6. **Crop** to the remaining pixels. The result keeps its `origin` inside the source cell, so several layers of the
   same frame stay registered (they share the cell's coordinate system).

Limits: a character colour within `bgTolerance` of the key colour is taken for background (avoid e.g. black art on a
black key). The Sprite Reference Document (PM) should specify a key colour far from typical art.

## Memory (up to 4096 × 4096)

Nothing holds a whole raw image in JS. `openImage` decodes once with `createImageBitmap` and `readRect` copies out one
cell; a grid is processed cell by cell (`extractLayer`), yielding to the UI between cells. Measured in headless Chromium
with 4× CPU throttle: a 4096² grid, 24 frames, ~6 s, JS heap growth peak ~70 MB (mostly the 24 retained cropped
frames). **Not measured on a real phone**; the browser's own decoded bitmap (up to 64 MB) sits outside the JS heap.

## Tests

- `packages/core/test/extract.test.ts`: transparent and four flat backgrounds (white, chroma green, magenta, grey)
  checked pixel-wise against the ground-truth transparent render (alpha error, colour error, halo pixels, false
  positives), noise + specks, holes, grid == 24 files, ordering, every error. The halo metric was checked to fail on a
  naive key-out (455 halo pixels vs a limit of 17).
- `packages/slicer/e2e/extraction.spec.ts` (Playwright, `npm run e2e`): browser-decoded grid equals core's result; 4096²
  run; decode and count errors.
