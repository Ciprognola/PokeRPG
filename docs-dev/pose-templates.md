# Pose templates (PKR-007)

Grey-mannequin references that show an image AI which 24 walk poses to draw
(`docs/SPRITE_REFERENCE.md` §4–5). Downloadable as one zip from the Slicer home screen, offline too.

## What is in the zip (`pokerpg-pose-templates.zip`)

```
pose-templates/README.txt
pose-templates/grid-template.png      2400 × 1800 (4:3), 6 × 4 equal cells of 400 × 450, spec order, no lines or labels
pose-templates/single/walk_down_00.png … walk_up_05.png     one cell each, named by frame key
```

- Background: flat magenta `#FF00FF` (the Asset Spec §6 key colour). No pixel of any figure is within 12 px of a cell
  edge (tested), so nothing touches an edge and there are no grid lines.
- Figure: neutral grey (three greys, no colour), the same skeleton, walk-cycle bob and swing as the synthetic fixtures
  (`walkFrameShapes(..., { mannequin: true })`). Every figure stands in the same place in its cell (no jitter), so the
  feet line up across a row.

## Reading the pose

- **Facing**: front view has a visor band and a nose, profile has the band on the facing side with a nose sticking out
  of the silhouette, the back view has no face and a spine stripe. Tested: the face marks' centroid is centred, left,
  right, or absent per row.
- **Cycle**: contact = legs spread in a stride and arms swung; down = legs closer; passing = legs together with one foot
  lifted (alternating). From the front/back the stepping leg reaches lower. Every one of the 24 poses is different.

## Where it lives

- Generator: `packages/core/src/testing/templates.ts` (`poseTemplateFiles`, `poseTemplateZip`, `POSE_TEMPLATE`). Mannequin
  drawing: `mannequinShapes` in `synthetic.ts`. Everything is deterministic: same code, same bytes.
- `npm run templates` (`tools/make-pose-templates.ts`) writes `packages/slicer/public/downloads/pokerpg-pose-templates.zip`.
  **The zip is committed**; a test fails if it differs from what the generator produces, so change the generator, run
  `npm run templates`, commit both.
- Slicer: the home screen's "Download pose templates" card is a plain link to that file. The service worker precaches
  `*.zip`, so it works offline.

## Tests

- `packages/core/test/templates.test.ts`: file list and sizes, 4:3 / ≥ 2048 px, singles equal grid cells, magenta and
  margins, neutral grey only, facing, distinct poses, deterministic, committed zip == generator, and the acceptance
  criteria: the grid template slices with **zero findings** (no errors, no warnings) and the 24 singles (in any file
  order) give the identical report and byte-identical package.
- `packages/slicer/e2e/templates.spec.ts`: download from the home screen, unpack, slice the grid and the 24 singles
  through the real app: both error-free, identical exports.
- `packages/slicer/e2e/offline.spec.ts`: the zip downloads from the installed PWA with the network off.

## Not covered

How well a real image AI follows these references (that is the M2 spike). The mannequin is deliberately simple
(rectangles and ellipses); a nicer one only needs `mannequinShapes` changed.
