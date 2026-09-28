# PokeRPG — Asset Spec
*Version 0.4 · 2026-09-28 · Owner: PM · Status: draft pending PO approval*

The technical contract for every visual and audio asset: official library, user sprites and Slicer output. The Slicer, importer/validator and engine all enforce this file. **Anything off-spec gets fixed here first, then in the work.**
Style (palette, lighting, brushwork) belongs to the Art Style Guide (M3), not this file.

---

## 1. Global rules
| Rule | Value |
|---|---|
| Image format | PNG-32 (RGBA), sRGB, straight (non-premultiplied) alpha |
| Units | Pixels. 1 asset px = 1 world px at camera zoom 1 |
| Grid | **64 px tiles** |
| Max texture | 2048 × 2048 per file (mobile-safe) |
| Forbidden | Text, logos, watermarks, signatures, painted drop shadows (the engine draws shadows) |
| Edges | Painted soft edges are allowed. No coloured halos from the background: the Slicer defringes |
| Names | Lowercase `[a-z0-9-]`, with `_` used only as a field separator |

---

## 2. Character sprites

### 2.1 Frame
| Property | Value |
|---|---|
| Frame canvas | **128 × 128 px** |
| Anchor / pivot | **(64, 120)**: bottom-centre, where the feet touch the ground. Phaser origin `(0.5, 0.9375)` |
| Ground line | Feet rest on y = 120, so the lowest opaque pixel row is **119** |
| Standard height | **96 px** from the ground line to the top of the head (1.5 tiles) |
| Body safe box | x 16–111, y 20–119. Body, outfit and hair stay inside it |
| Overflow zone | Headwear and accessories may extend to y 8 |
| Empty border | At least 4 px of full transparency on every edge (prevents texture bleeding) |
| Footprint | 32 × 16 ellipse centred on the anchor. Used for engine collision; nothing is painted |
| Face | Neutral. Expressions live in dialogue portraits (§5) |

### 2.2 Walk set (`walk`), the first animation set
- **24 frames = 4 rows × 6 columns.** Sheet size **768 × 512 px**, no padding (padding is added at atlas build time).
- **Row order:** 0 `down` (facing camera) · 1 `left` · 2 `right` · 3 `up` (facing away).
- **Left and right are both painted.** No mirroring, because hand-painted lighting and asymmetric outfits would break.
- **Column order (one loop):**

| Col | Pose |
|---|---|
| 0 | Contact: right foot forward |
| 1 | Down: weight on right foot, body lowest |
| 2 | Passing: left leg passes, body highest |
| 3 | Contact: left foot forward |
| 4 | Down: weight on left foot |
| 5 | Passing: right leg passes |

- **Idle:** column 2 of each row is the standing pose until an `idle` set exists.
- **Ground lock:** every walk frame keeps its lowest opaque body pixel on row 119. Body bob (up to 4 px) happens above the feet.
- **Horizontal:** the torso centreline sits on x = 64 ± 2 px in every frame. Swinging limbs don't count.
- Playback fps and walk speed are defined in the GDD, not here.

### 2.3 Layers
Each layer is a **full sheet with the identical grid and anchor**, transparent wherever the layer has no content. The character is these sheets stacked.

| Layer id | Required | Content |
|---|---|---|
| `body` | Yes | Skin, head, neutral face, base underclothes |
| `outfit` | No | Clothing and shoes |
| `hair` | No | Hair in front of and around the head |
| `hair-back` | No | Hair that falls behind the body (long hair) |
| `headwear` | No | Hats, helmets, hoods |
| `accessory` | No | Glasses, bags, held items (front parts) |
| `accessory-back` | No | Capes, backpacks (back parts) |

Occlusion is painted into each frame. The z-order below only fixes the stacking, from back to front:

| Rows | Z-order |
|---|---|
| down, left, right | hair-back → accessory-back → body → outfit → hair → headwear → accessory |
| up | body → outfit → accessory-back → hair-back → hair → headwear → accessory |

The z-order is data in the registry (§3), so sets can override it.

### 2.4 Sheet limits
- One file per layer per set. Maximum 7 layers per character.
- File size: a warning above 1 MB per sheet, an error above 2 MB.

---

## 3. Animation-set registry (future-proofing)
New animations (run, fish, gym, idle…) are **new registry entries, never changes to `walk`**. Every character set shares the same frame canvas, anchor and standard height, so existing layers and characters keep working.

File: `assets/registry/animsets.json` (Claude Code maintains the file; this spec defines its content).

```json
{
  "specVersion": "0.1",
  "character": { "frame": [128, 128], "anchor": [64, 120], "standardHeight": 96 },
  "directions": ["down", "left", "right", "up"],
  "sets": [
    {
      "id": "walk",
      "version": 1,
      "rows": ["down", "left", "right", "up"],
      "framesPerRow": 6,
      "loop": true,
      "mirrorable": false,
      "groundLock": true,
      "requiredLayers": ["body"],
      "zOrder": {
        "default": ["hair-back", "accessory-back", "body", "outfit", "hair", "headwear", "accessory"],
        "up": ["body", "outfit", "accessory-back", "hair-back", "hair", "headwear", "accessory"]
      }
    }
  ]
}
```

**Rules for new sets**
1. Keep the 128 × 128 frame and the (64, 120) anchor. If a pose truly needs more room (e.g. a fishing rod), the frame may grow **in 64 px steps**. The anchor stays at the feet with an 8 px bottom margin: a 256 × 128 frame has its anchor at (128, 120).
2. A set declares its own rows, frame count, loop, `mirrorable` and `groundLock` (false for jumps and similar).
3. A set's `version` only increases. Runs pin set versions through the Run Manifest.
4. Validation: a character can use a set only if it has a `body` sheet for that set. Each optional layer it wears must also have a sheet for that set, or the validator returns a warning (it can be raised to an error per set).
5. A skeletal or cutout rig remains an option to evaluate before M6. If adopted, it will become a new registry type; it does not replace this spec.

---

## 4. Naming and packaging
| Item | Pattern | Example |
|---|---|---|
| Layer sheet | `spr_<set>_<layer>_<name>[_<variant>].png` | `spr_walk_hair_braid-long.png` |
| Atlas | same basename + `.json` (Phaser JSON Hash) | `spr_walk_hair_braid-long.json` |
| Frame key | `<set>_<row>_<nn>` | `walk_left_03` |
| Character folder | `chr_<name>/` + `character.json` | `chr_mira/` |

`character.json` minimal shape (the full schema belongs in the Story Schema):
```json
{
  "id": "chr_mira",
  "specVersion": "0.1",
  "layers": {
    "body": { "walk": "spr_walk_body_mira.png" },
    "outfit": { "walk": "spr_walk_outfit_farmer-overalls.png" }
  }
}
```

---

## 5. Dialogue portraits
Placeholder: this carries expressions. Canvas size, expression list and naming are **TBD in the GDD**. Portraits are separate from sprites and never change sprite frames.

---

## 6. Slicer contract (M1)
**Input:** raw AI output at any size, in one of two forms:
- **Grid image:** 6 columns × 4 rows of equal cells in §2.2 row and column order, at any overall aspect ratio. No grid lines or labels.
- **24 separate frames:** named by frame key (`walk_down_00.png` … `walk_up_05.png`), otherwise ordered by natural sort.

The background is transparent or flat **magenta `#FF00FF`** (the key colour; the Sprite Reference Document explains it to users). The Slicer detects which one automatically. Optional extra layers use the same frame layout as the body.

**Processing (required result, not the method):**
1. Remove the background, including key-colour pockets enclosed by the character (e.g. between the legs), and defringe.
2. Scale **once per character**, using one factor for every frame and every layer, so the `body` measures 96 px in `walk_down_00`. Frames are never scaled individually, because that makes the animation jitter.
3. Align each frame so its body is on the ground line (row 119) and its torso centreline is on x = 64. **Apply the same per-frame offset to every layer of that frame** so the layers never drift apart.
4. Pack each layer into a 768 × 512 sheet and write the atlas JSON.
5. Run validation (§7) and produce a report.

**Output:** layer sheets + atlases + `report.json`. The importer reuses the same validation code.

---

## 7. Validation checks (shared by Slicer and importer)
| Check | Severity |
|---|---|
| PNG-32 RGBA, sRGB | Error |
| Sheet exactly 768 × 512 (walk) and grid matches the set | Error |
| Filename matches the pattern in §4 | Error |
| `body` sheet present | Error |
| No frame completely empty (body layer) | Error |
| 4 px empty border in every frame | Error |
| Key-colour pixels remain (any layer) | Warning |
| Lowest opaque body pixel on row 119 ± 0 (ground-locked sets) | Error if > 2 px off, warning if 1–2 px |
| Torso centreline x = 64 ± 2 | Warning |
| Body height 96 ± 4 px in every body frame (bob included) | Warning, error if outside ± 8 |
| Content outside the safe box / overflow zone | Warning |
| Sheet file > 1 MB / > 2 MB | Warning / Error |

Every message names the file, the frame key and the pixel, e.g. `spr_walk_body_mira.png · walk_up_04 · lowest opaque row 116 (expected 119)`.

### 7.1 Measurement definitions
The Slicer and the validator use these definitions identically.

| Term | Definition |
|---|---|
| Opaque | Alpha ≥ 128. Used for ground row, body height, torso centreline and safe box |
| Empty | Alpha = 0. Any alpha > 0 counts as content. Used for the empty-frame and 4 px border checks |
| Body height | Ground line (y = 120) minus the top-most opaque row of the `body` layer |
| Torso centreline | x of the alpha centroid of opaque `body` pixels in the band 35–65 % of body height, measured down from the top of the head |
| Body-only checks | Empty frame, ground row, torso centreline, body height |
| Near the key colour | Every RGB channel within 24 of `#FF00FF`, on a pixel with alpha > 0 |
| Other layers | Format, filename, grid, 4 px border, key colour, safe box and file size. No cross-layer registration check in this version |

The `specVersion` field in JSON files is the asset format version. It stays `"0.1"` until the file format itself changes.

---

## 8. World assets (baseline, to be expanded with the Art Style Guide)
| Asset | Rule |
|---|---|
| Grid | 64 px tiles. Movement and collision use this grid |
| Props | Canvas in 64 px multiples. Anchor at bottom-centre ground contact, 8 px bottom margin, like characters |
| Scale references | Character 96 px tall · door 64 × 128 · adult-height counter 64 px |
| Naming | `<type>_<name>_<variant>.png` (AI Team Guide), e.g. `prop_barrel_01.png`, `loc_harbour_day.png` |
| Music | MP3, 44.1 kHz stereo, `mus_<use>_<name>.mp3`. Loop points live in the asset registry, not in the audio file |

### 8.1 Library location data
Every library location has a gameplay data file, **`loc_<name>.json`**, separate from its art. It works with tilesets or painted backgrounds (§9 item 1).

```json
{
  "specVersion": "0.1",
  "id": "loc_harbour",
  "size": [20, 12],
  "collision": ["....................", "....####............"],
  "spawns": { "spawn_start": { "tile": [10, 6], "facing": "down" } },
  "exits": { "exit_house_door": { "tiles": [[5, 5]] }, "edge_south": { "edge": "down" } },
  "areas": { "area_plaza": { "rect": [8, 4, 6, 4] } },
  "music": "mus_town_harbour"
}
```

| Field | Rule |
|---|---|
| `id` | `loc_<name>`, matches the file name |
| `size` | `[width, height]` in 64 px tiles |
| `collision` | Exactly `height` strings of `width` characters. `.` walkable, `#` blocked. Tiles outside the map count as blocked. No other characters in v0.1 |
| `spawns` | `spawn_<name>` → `{ tile, facing }`. The tile is inside the map and walkable |
| `exits` | `exit_<name>` → `{ tiles: [[x, y], …] }` (walkable tiles), or `edge_<name>` → `{ edge: down \| left \| right \| up }` |
| `areas` | `area_<name>` → `{ rect: [x, y, width, height] }`, fully inside the map |
| `music` | Optional default track (library id) |

- Coordinates are `[x, y]` tiles from the top-left, as in the Story Schema.
- The art reference is added to this file when §9 item 1 (map construction) is decided.
- Until M7, the library contains only greybox test locations in this format.

---

## 9. Open items (non-blocking)
1. **Map construction:** tilesets vs painted location backgrounds with a collision grid. Decide before the M3 style lock.
2. Portrait spec (§5), to be decided in the GDD.
3. HiDPI: keep @2× masters (256 px frames) from Firefly/AI output and ship 1× for now? Decide before M7.
4. Recolour/tint masks for the character creator, to be decided before M6.
5. Cross-layer registration check (a repainted layer offset from its body). Decide after the M2 spike shows how real AI layers drift.

## 10. Decision log
| Date | Decision |
|---|---|
| 2026-09-28 | Character frame 128 × 128, 64 px tiles, anchor (64, 120), standard height 96 px |
| 2026-09-28 | Walk set = 4 rows (down, left, right, up) × 6 frames; no mirroring |
| 2026-09-28 | Modular animation-set registry with a shared canvas and anchor |
| 2026-09-28 | v0.2: §7.1 measurement definitions (opaque, empty, height, torso centreline, layer checks), from Claude Code's M1 plan |
| 2026-09-28 | v0.3: §6 input forms fixed (equal-cell grid, frame-key file names) and key colour magenta `#FF00FF`; §9 adds cross-layer registration |
| 2026-09-28 | v0.4: enclosed key-colour pockets removed; `key-colour` warning and "near the key colour" defined (PKR-008); §8.1 library location data format adopted from Spec issue #17 |
