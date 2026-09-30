# Phaser 3 vs Phaser 4 (PKR-015)

Technical evaluation for Project Brief §8 Q3. Written by Claude Code, 2026-09-30. The PO decides; this is the input.
Versions tested: **Phaser 3.90.0** (last 3.x, 2025-05-23) and **Phaser 4.2.1** (2026-07-09). Both were already
devDependencies of `packages/slicer` (unused there), so nothing new was installed.

## Recommendation

**Phaser 4.2.1**, conditional on the PO's Android Chrome test of the spike passing (steady frame rate, crisp pixels,
audio loop without a gap).

Reasons:

1. **For our needs the two behave the same.** One unmodified TypeScript source (no `if (v4)` branch anywhere) runs on both and produced
   identical behaviour in every check below. The parts that changed most in 4 (new WebGL renderer, filters/FX, masks,
   `DynamicTexture`, `Point`→`Vector2`) are not in our feature list.
2. **Greenfield, so migration is free now and expensive later.** M4 has not started. Starting on 3 means a forced
   port later if 3 stops receiving fixes; starting on 4 costs nothing extra today.
3. **Maintenance outlook favours 4.** 3.90.0 is from May 2025 and there has been no 3.x release since, while 4.0.0 (2026-04-10),
   4.1.0, 4.2.0 and 4.2.1 followed in three months. The 4.2.1 package also ships its own docs and per-topic skill notes
   (`node_modules/phaser4/docs`, `skills`). I could not verify an official end-of-life statement for 3.x; this is inferred from the release history.
4. **The price is small.** +177 KB raw / +38 KB gzip over Phaser 3 (see below), cached once by the PWA service worker.

Against 4: it is 2.5 months old with a shorter track record, and most tutorials, plugins and answers online are still for 3.
Phaser 4's own pixel-art guide says rounded pixel art "should avoid scaling, rotating, and zooming". Our world is drawn 1:1 (no
scaling), but the UI is drawn at 1× and shown at 4×. That rendered crisp in the spike (see UI), but it is the first thing to confirm on the phone.

If the phone test shows a problem specific to 4, the same spike source falls back to 3 by changing one import alias.

## What was built

`spikes/` (throwaway, outside the npm workspaces; `packages/*` and the Slicer build never see it). One source, `spikes/src/main.ts`,
built twice by `spikes/vite.config.ts` (`SPIKE_PHASER=3|4` aliases `phaser` to `node_modules/phaser` or `node_modules/phaser4`):

- greybox location `assets/locations/loc_greybox-harbour.json` (20×12 tiles = 1280×768, larger than the 960×540 screen), ground in
  two images, one prop per `#` collision cell, y-sorted with the character;
- the Story Template character `chr_rosa` (body, outfit, hair: three layer sheets) loaded from the **Slicer-exported atlas JSON as-is**;
- grid movement at 4 tiles/s, walk set at 12 fps, keyboard and on-screen d-pad, camera follow clamped to the location;
- UI probe: a 240×135 layout drawn at 1× and shown at 4×;
- audio loop probe through each version's own Sound API (`sound.add`, `addMarker`, `loop`);
- an FPS/frame-time/canvas HUD;
- per-spike PWA service worker.

## Needs, one by one

| Need                                                                   | Phaser 3.90.0                                                                                                                                 | Phaser 4.2.1                                                                                                   | Notes                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crisp nearest-neighbour at 960×540, letterboxed                        | Works. `pixelArt: true`, `roundPixels: true`, `Scale.FIT` + `CENTER_BOTH`.                                                                    | Same config, same result.                                                                                      | Headless screenshots at 1:1 CSS scale are pixel-crisp on both. **Fractional CSS scaling on a phone** (e.g. 960→~870 px) is not covered by headless tests; check on the device. Integer-only scaling is not automatic in either version.                                                                                                                        |
| UI at 4× on 240×135                                                    | A 240×135 canvas texture scaled ×4 stays crisp.                                                                                               | Same, despite the "avoid scaling" note in 4's pixel-art guide.                                                 | Only a text-on-canvas probe: no bitmap font exists in the repo yet.                                                                                                                                                                                                                                                                                            |
| Slicer JSON Hash atlases                                               | `load.atlas` reads all 3 layer atlases unchanged; `generateFrameNames` (`walk_down_00…05`) works.                                             | Same.                                                                                                          | The atlas `pivot` (0.5, 0.9375) is applied to the sprite automatically in **both** (`customPivot` true, origin 0.5/0.9375 before any `setOrigin`).                                                                                                                                                                                                             |
| Large locations: several ground images + y-sorted props and characters | Works with `setDepth` = anchor y (+0.001 per layer to keep body/outfit/hair in order).                                                        | Same.                                                                                                          | Checked by screenshot: standing above the prop block, the prop covers the feet; standing below, the character draws over it.                                                                                                                                                                                                                                   |
| Grid movement 4 tiles/s, walk at 12 fps                                | 256 px/s, whole-pixel positions, 12 fps animation; one tile per 0.25 s.                                                                       | Same.                                                                                                          | Movement is a small hand-rolled state machine in `update()`; neither engine helps or hinders.                                                                                                                                                                                                                                                                  |
| Touch input                                                            | On-screen d-pad via DOM pointer events, works.                                                                                                | Same.                                                                                                          | Real touch is **not verified** headlessly (mouse/keyboard only).                                                                                                                                                                                                                                                                                               |
| Audio with loop points                                                 | `sound.add` + `addMarker({start:1,duration:1,config:{loop:true}})`: 1 s intro then a looping body. 5 `looped` events in 5.5 s, 1000 ms apart. | Same API and behaviour; events 990–1007 ms apart.                                                              | Neither exposes `loopStart`/`loopEnd`; a looped marker is the only route, implemented by the engine scheduling a second buffer source. The event times only show the loop keeps running: they are frame-sampled and do **not** prove the seam is gapless. Judge that by ear on the phone. Test tone is a whole number of cycles, so any click is the engine's. |
| TypeScript types                                                       | Bundled `types/phaser.d.ts` (~107k lines). Strict mode passes.                                                                                | Bundled `types/phaser.d.ts` (~135k lines). Strict mode passes.                                                 | Same source type-checks against both with `strict`, `verbatimModuleSyntax`. `import Phaser from 'phaser'` needs `allowSyntheticDefaultImports` for 3's `export =` typing.                                                                                                                                                                                      |
| Vite bundle size                                                       | 1,203.8 kB raw / **321.8 kB gzip**                                                                                                            | 1,380.6 kB raw / **360.0 kB gzip**                                                                             | Whole engine, no custom build. Precache: 1,422 KiB (3) vs 1,595 KiB (4), including the character sheets and test audio. Neither tree-shakes meaningfully through `import Phaser`. 4 ships an ESM build (`dist/phaser.esm.js`); a custom feature-trimmed build is a possible later saving and was not tried.                                                    |
| Offline / PWA                                                          | Works with `vite-plugin-pwa`; service worker registers.                                                                                       | Same.                                                                                                          | Each spike's worker has its own scope (`/PokeRPG/spikes/phaserN/`), cache name (`spike-phaserN`) and manifest id. Workbox's outdated-cache cleanup only touches caches carrying its own scope, so the installed Slicer PWA (`/PokeRPG/slicer/`) is unaffected. Offline reload was not tested.                                                                  |
| Mobile performance                                                     | Not measurable here.                                                                                                                          | Not measurable here.                                                                                           | See below.                                                                                                                                                                                                                                                                                                                                                     |
| Maturity, docs, maintenance                                            | 3.90.0 from 2025-05; huge body of tutorials/plugins; no 3.x release since.                                                                    | 4.0.0 2026-04-10, then 4.1.0 (04-30), 4.2.0 (06-19), 4.2.1 (07-09); ships docs and skill notes in the package. | See recommendation.                                                                                                                                                                                                                                                                                                                                            |
| Migration risk                                                         | Later port to 4 if we start on 3. Renderer rewrite means anything touching pipelines, FX, masks or `DynamicTexture` needs rework.             | Nothing to migrate. Third-party 3.x plugins may not work.                                                      | We use no plugins today.                                                                                                                                                                                                                                                                                                                                       |

## Frame rate (indicative only)

Headless Chromium on the dev machine (Windows 11, software WebGL via SwiftShader, 960×540, no GPU), walking for 8 s:

|               | avg frame         | max frame |
| ------------- | ----------------- | --------- |
| Phaser 3.90.0 | 16.67 ms (60 fps) | 16.68 ms  |
| Phaser 4.2.1  | 16.67 ms (60 fps) | 16.68 ms  |

Both hold the display's 60 fps on a workload this light. One earlier run, made while two probes overlapped on the same CPU, was noisy (20–47 ms average) for both versions; a run with nothing else going was clean. So this number says "no engine-level regression", not "fast on a phone". **Real-device frame rate must come from the PO's phone** (checklist below).

## Risks

- **Phaser 4 is young.** Ecosystem, StackOverflow answers and LLM training data lean 3. Our own Claude Code sessions will sometimes suggest 3 APIs; the bundled 4 docs/skills help.
- **Pixel-art guide caveat** (above): 4's rounded pixel-art mode is documented for unscaled content; the 4× UI is the exception. Confirm on the phone; fallback is per-object filtering or pre-scaled UI textures.
- **iOS Safari** is the usual weak spot for both (WebGL context loss, audio unlock, PWA storage limits). Not verified.
- **Bundle size** grows ~38 KB gzip on 4; irrelevant next to the art and audio packs, but visible in first-load time on mobile data.
- Everything here is a one-screen spike. Behaviour at M4 scale (many sprites, tinting for time of day, dialogue text) is unmeasured.

## Not verified

- Any real device: Android Chrome frame rate, touch feel, fractional-scale crispness and audio-loop gap are for the PO's phone; iOS Safari is **not verified** unless someone tests it.
- Audible gaplessness of the loop (headless has no audio output).
- Offline reload and PWA install of the spikes; service-worker scope checked by registration list and generated `sw.js`, not by an install test.
- Time-of-day tint, bitmap fonts, tap-to-turn, NPC collision: not part of the spike.

## PO phone test

Spikes go live at the Pages URLs once the PR is merged to `main` (the deploy runs only from `main`):

- `https://ciprognola.github.io/PokeRPG/spikes/phaser3/`
- `https://ciprognola.github.io/PokeRPG/spikes/phaser4/`

Open each in Chrome on Android, in landscape. The green box top-left is the HUD; `◀▲▶▼` at bottom-left walks; "audio loop" at bottom-right plays the loop probe (headphones or speaker, volume up).

| #   | Check (each of Phaser 3 and Phaser 4)                                                                        | Android Chrome | iOS Safari   |
| --- | ------------------------------------------------------------------------------------------------------------ | -------------- | ------------ |
| 1   | Loads without a blank screen; HUD says the right Phaser version and `WebGL`                                  | ☐              | not verified |
| 2   | Hold ▶: walks smoothly; HUD `fps` stays near 60, `max` stays low (note the numbers)                          | ☐              | not verified |
| 3   | Pixels are crisp (no blur or shimmering on the character, the boxes or the white dialogue box text)          | ☐              | not verified |
| 4   | White dialogue box: text edges crisp, box and text look the same size in both versions                       | ☐              | not verified |
| 5   | Walk to the brown blocks (up-left): character passes behind the top of the blocks and in front of the bottom | ☐              | not verified |
| 6   | Tap "audio loop": a rising tone (1 s), then a steady tone repeating **with no click or gap** at the seam     | ☐              | not verified |
| 7   | Rotate the phone: the picture keeps 16:9 with black bars                                                     | ☐              | not verified |
| 8   | Any visible difference between the two versions (say which)                                                  | ☐              | not verified |

Write down the HUD `canvas … css …` line for each (it shows the CSS scale factor the phone applies).

## Cleanup after the decision

Delete `spikes/` and the step "Build PKR-015 Phaser spikes" in `.github/workflows/deploy-slicer.yml`. Also drop the `'spikes/**'` entry in
`eslint.config.js`, the `spikes` line in `.prettierignore`, and (if 3 is not chosen) the unused engine devDependency from
`packages/slicer/package.json`, then move the winner to `packages/game`. Nothing else references the spikes. Optional: keep `spikes/scripts/probe.mjs`'s
approach for M4's own headless checks.

## Reproduce

```
node spikes/scripts/prepare.mjs
for v in 3 4; do SPIKE_PHASER=$v BASE_PATH=/PokeRPG/spikes/ npx vite build --config spikes/vite.config.ts; done   # Git Bash: MSYS_NO_PATHCONV=1
node spikes/scripts/probe.mjs        # headless: walks, screenshots to spikes/dist/shots, stats, errors, SW scope
npx tsc -p spikes/tsconfig.phaser3.json && npx tsc -p spikes/tsconfig.phaser4.json
```

Local view without Pages: `SPIKE_PHASER=4 npx vite --config spikes/vite.config.ts --host` (after `prepare.mjs`), then open the LAN URL plus `/phaser4/` on the phone (the dev base path).
