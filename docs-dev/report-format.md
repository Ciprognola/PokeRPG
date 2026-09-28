# `report.json` format

Produced by `validateCharacter()` in `@pokerpg/core` (`packages/core/src/validate.ts`). The Slicer writes it into every
export, and the in-game importer reuses the same code. Measurement definitions are in `docs/ASSET_SPEC.md` §7.1.

```jsonc
{
  "reportVersion": 1, // shape of this file; bumped only when the shape changes
  "specVersion": "0.1", // asset FORMAT version (Asset Spec §7.1), not the document version
  "ok": false, // true when there are no errors (warnings are allowed)
  "summary": { "errors": 1, "warnings": 2 },
  "sheets": [
    {
      "file": "spr_walk_body_mira.png",
      "set": "walk", // only when the file name parsed
      "layer": "body",
      "name": "mira",
      "variant": "dark", // optional
      "width": 768,
      "height": 512,
      "bytes": 48213, // only when the encoded file was provided
    },
  ],
  "findings": [
    {
      "severity": "error", // "error" | "warning"
      "check": "ground-line", // stable machine id, see below
      "file": "spr_walk_body_mira.png", // absent for character-level findings
      "frameKey": "walk_up_04", // absent for whole-file findings
      "pixel": { "x": 70, "y": 116 }, // frame-local 0–127, when a specific pixel applies
      "message": "lowest opaque row 116 (expected 119)",
    },
  ],
}
```

Human-readable form (`formatFinding`): `file · frameKey · message`, e.g.
`spr_walk_body_mira.png · walk_up_04 · lowest opaque row 116 (expected 119)`.

Output is deterministic: sheets are processed in file-name order, findings in a fixed order (character-level, then per
sheet: file-level, then per frame in row-major order), and the report contains no timestamps.

## Checks

| `check`                  | Severity                                   | Scope                           | Rule (Asset Spec §)                                                                                                 |
| ------------------------ | ------------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `png-format`             | error                                      | file                            | PNG-32 RGBA: colour type 6, 8-bit (§7). Needs `bytes`                                                               |
| `srgb`                   | error                                      | file                            | non-sRGB ICC profile, or gAMA ≠ 0.45455 with no sRGB chunk (§7). Needs `bytes`                                      |
| `file-size`              | warning > 1 000 000 B, error > 2 000 000 B | file                            | §2.4, §7. Needs `bytes`                                                                                             |
| `filename`               | error                                      | file                            | `spr_<set>_<layer>_<name>[_<variant>].png`, lowercase `[a-z0-9-]` (§4)                                              |
| `unknown-set`            | error                                      | file                            | set id not in the registry (§3)                                                                                     |
| `sheet-size`             | error                                      | file                            | sheet size ≠ the set's grid (walk: 768 × 512). Frames are not checked further (§7)                                  |
| `border`                 | error                                      | frame, all layers               | any alpha > 0 within 4 px of the frame edge (§2.1, §7.1)                                                            |
| `safe-box`               | warning                                    | frame, all layers               | opaque (alpha ≥ 128) pixels outside x 16–111, y 20–119; headwear, accessory and accessory-back may reach y 8 (§2.1) |
| `empty-frame`            | error                                      | frame, body                     | no pixel with alpha > 0 (§7)                                                                                        |
| `no-opaque-body`         | error                                      | frame, body                     | content exists but nothing reaches alpha 128, so nothing can be measured                                            |
| `ground-line`            | warning 1–2 px, error > 2 px               | frame, body, ground-locked sets | lowest opaque row ≠ 119 (§7)                                                                                        |
| `body-height`            | warning outside 96 ± 4, error outside ± 8  | frame, body                     | 120 − top-most opaque row, every frame (§7, §7.1)                                                                   |
| `torso-centre`           | warning                                    | frame, body                     | alpha centroid of the 35–65 % band ≠ 64 ± 2 (§7, §7.1)                                                              |
| `missing-required-layer` | error                                      | character                       | a set present has no `body` sheet (§3 rule 4, §7)                                                                   |
| `duplicate-layer`        | error                                      | file                            | second sheet for the same layer and set (§2.4: one file per layer per set)                                          |
| `layer-missing-for-set`  | warning                                    | character                       | a layer has a sheet in another set but none for this one (§3 rule 4)                                                |

Body-only checks: `empty-frame`, `no-opaque-body`, `ground-line`, `body-height`, `torso-centre`. Other layers get format,
filename, grid, border, safe box and file size only; there is no cross-layer registration check in this version (§7.1).

File-level checks are skipped when a sheet is validated without its encoded `bytes` (for example a live preview).
Validate the encoded output before shipping it.

## Measurement conventions used in code

`packages/core/src/measure.ts` (`measureBodyFrame`) implements §7.1. Where the spec leaves a detail open the code fixes it:

- `x` is continuous: pixel column _c_ covers [_c_, _c_ + 1), so a figure spanning columns 49–78 has its centreline at 64.0.
- The torso band is rows `top + ceil(0.35 × H)` up to, excluding, `top + ceil(0.65 × H)`, where `top` is the top-most
  opaque row and `H` the body height.
- The centroid weights each opaque pixel by its alpha.
- The 1 MB / 2 MB limits are decimal (1 000 000 / 2 000 000 bytes).
