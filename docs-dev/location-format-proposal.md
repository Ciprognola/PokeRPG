# Proposal: library location data format

> **Spec issue: docs/ASSET_SPEC.md §8 / §9.1 and docs/STORY_SCHEMA.md §12.1 — the file format for a location's size, collision grid and named anchors is not defined — suggestion below.**
> This is the same text as the GitHub issue. Not built into `docs/` (Claude Code never edits it); the PM decides.

## Problem

GDD §4 says a location carries "its art, collision grid, music and named anchors" (spawn points, exits, areas). Story Schema §4 and
§11 refer to them (`spawn`, `exit`, `area`, "tiles inside the location and not blocked"). Story Schema §12.1 says the format belongs
in the Asset Spec. It is not there, so the story validator (PKR-009) needed something concrete. Asset Spec §9.1 (tilesets or
painted backgrounds) is still open, and this format works with either: it describes gameplay data, not art.

## Proposal: `loc_<name>.json`, one file per library location

```json
{
  "specVersion": "0.1",
  "id": "loc_greybox-harbour",
  "size": [20, 12],
  "collision": ["....................", "....####............"],
  "spawns": { "spawn_start": { "tile": [10, 6], "facing": "down" } },
  "exits": {
    "exit_house_door": { "tiles": [[5, 5]] },
    "edge_south": { "edge": "down" }
  },
  "areas": { "area_plaza": { "rect": [8, 4, 6, 4] } },
  "music": "mus_town_greybox"
}
```

| Field       | Rule                                                                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`        | `loc_<name>`, equals the file name without `.json`. Stories refer to it as `asset`                                                                                              |
| `size`      | `[width, height]` in 64 px tiles (Asset Spec §1)                                                                                                                                |
| `collision` | `height` strings of `width` characters. `.` walkable, `#` blocked. Row 0 is the top. Out-of-range tiles count as blocked                                                        |
| `spawns`    | Name → `{ tile, facing }`. Names start with `spawn_`. The tile must be walkable                                                                                                 |
| `exits`     | Name → `{ tiles: [[x, y], …] }` (walking onto any of them leaves) or `{ edge: "up"\|"down"\|"left"\|"right" }` (walking off that map edge). Names start with `exit_` or `edge_` |
| `areas`     | Name → `{ rect: [x, y, width, height] }`, inside the map. Names start with `area_`                                                                                              |
| `music`     | Optional default track id                                                                                                                                                       |

Anchor names are the ones stories use: `links` keys are `exits`, `reach.spawn` and `warp.spawn` are `spawns`, `area` fields are `areas`.

## Open points for the PM

- Should `#`/`.` grow (water, ledges, doors) or stay two-valued until M7?
- Edge exits use `up/down/left/right` (the schema's directions), not compass names like `edge_north`.
- Whether the art belongs in the same file (`background` image reference) or next to it.
- Sound effects need the same treatment (`sfx_<name>`, Story Schema §12.2): the placeholder registry is `assets/registry/audio.json`.

## In the repo today

Two greybox locations (`assets/locations/loc_greybox-harbour.json`, `loc_greybox-bakery.json`) follow this format, and
`validateLocationAsset` (`packages/core/src/story/library.ts`) checks a file's own consistency (row count and width, spawns on
walkable tiles, exits and areas inside the map). If the PM changes the format, only that file, the two greybox files and the
story validator's few lookups change.
