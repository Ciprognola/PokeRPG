# PokeRPG — Sprite Reference Document
*Version 0.1 · 2026-09-28 · Owner: PM · Status: draft for the M2 spike · Public*

How to make your own walking character with an image AI and bring it into PokeRPG.
You don't need to hit exact pixel sizes: the **Slicer** (https://ciprognola.github.io/PokeRPG/slicer/) cuts, resizes, aligns and checks everything. Your job is to give the AI clear instructions and pick good results.
The technical rules behind this guide are in the Asset Spec.

---

## 1. What you're making
- **24 frames:** your character walking in 4 directions, 6 frames each.
- **Row order:** 1 toward the viewer · 2 walking left · 3 walking right · 4 walking away.
- **Frame order in every row:** contact · down · passing · contact · down · passing. It's one walk cycle: step with one foot, then the other.
- **View:** classic top-down RPG, with the camera slightly above the character. Light comes from the top-left.

*View and lighting are provisional until the official art style is locked.*

## 2. Rules the AI must follow
| Do | Don't |
|---|---|
| Full body in every frame, head to feet | Crop the feet or the head |
| Same character, outfit and size in every frame | Change clothes, colours or proportions between frames |
| Solid flat **magenta background `#FF00FF`** | Gradients, floors, scenery, textures in the background |
| Soft painted edges are fine | Shadows on the ground (the game draws them) |
| Neutral face | Expressions (they live in dialogue portraits) |
| Keep magenta and hot pink out of the character | Text, numbers, grid lines, labels, watermarks |

**Why magenta?** The Slicer removes the background by its colour. Anything in the character that's close to magenta is removed with it.

---

## 3. Step 1 — Design your character
Make one clear image of your character first. Everything after this copies it.

**Prompt template**
> Full-body character design of {your character: age, build, hair, clothes, colours}, standing still, facing the viewer, neutral expression, arms relaxed. Hand-painted 2D game art, soft painterly brushwork, seen from slightly above like a top-down RPG, light from the top-left. Solid flat magenta background (#FF00FF). No shadow on the ground, no text.

Generate a few, keep the one you like best, and save it. This is your **concept image**.

## 4. Step 2 — Make the walk sheet (recommended: one image)
The AI draws all 24 frames in one image, which keeps the character most consistent.

1. **Download the pose templates** from the Slicer home screen. They show a grey mannequin in all 24 poses, in the right order.
2. **Aspect ratio:** 4:3, at the highest resolution available.
3. **References:** use the **grid pose template** as the composition/structure reference. Use your **concept image** as the style or image reference.
4. Prompt:

> Sprite sheet of the character from the reference image, arranged as an evenly spaced grid of 4 rows and 6 columns, one full-body figure per cell. Row 1 walking toward the viewer, row 2 walking left, row 3 walking right, row 4 walking away. Each row is one walk cycle: contact, down, passing, contact, down, passing. Same character, same outfit, same size and proportions in every cell, feet at the same height across each row. Hand-painted 2D game art, top-down RPG view, light from the top-left. Solid flat magenta background (#FF00FF). No ground, no shadows, no grid lines, no text, no numbers.

5. Generate several and keep the best. Improve it by making variations of a good result rather than writing new prompts.

## 5. Fallback — frame by frame
Use this if the one-image sheet keeps changing your character between frames.
1. For each of the 24 frames, use the matching **single-pose template** (`walk_down_00.png` … `walk_up_05.png`) as the composition reference. Use your concept image as the reference.
2. Prompt:

> The character from the reference image in exactly this pose, full body. Hand-painted 2D game art, top-down RPG view, light from the top-left. Solid flat magenta background (#FF00FF). No shadow, no text.

3. Save each result with the template's file name. The Slicer sorts frames by that name.

It takes longer, but each frame is easier to control.

---

## 6. Check before slicing
- [ ] 24 figures, in the right row and column order
- [ ] The same character in every frame (outfit, colours, hair, proportions)
- [ ] Heads and feet fully visible, and nothing touching the image edge
- [ ] A clean flat magenta background with no shadows
- [ ] No magenta or pink in the character

## 7. Slice it
1. Open the Slicer. It works on phone and desktop, including offline once installed.
2. Add your sheet (or 24 frames), name your character, and set the layer to **body**.
3. Process, then review the walk preview in all 4 directions.
4. Fix findings. **Errors** block export; **warnings** are advice. Tap a finding to jump to its frame, and nudge a frame if it sits wrong.
5. Export. You get `chr_<name>.zip`, ready to import into the game.

A fully dressed character is fine as a single **body** layer.

---

## 8. Extra layers (experimental)
Separate layers (outfit, hair, hat…) let you swap clothes later. AIs find this hard, and we're testing it in M2.
1. Slice your character first.
2. Give the AI the exported body sheet as the composition reference, and ask for **only** the new item, in the same grid, on magenta, with nothing else drawn.
3. In the Slicer, choose **Check existing sheets**, load your character, add the new layer with the right layer type, then review and nudge.

If the AI keeps drawing the whole character, go back to a single dressed body layer for now.

## 9. Adobe Firefly tips
- Use the latest Firefly image model and set the 4:3 aspect ratio before you iterate.
- **Composition reference = pose template.** Start with the strength slider around the middle to high range. If the poses drift, raise it. If your character starts to look like the grey mannequin, lower it.
- **Style reference = your concept image.** It carries palette and brushwork, but it doesn't guarantee the same face or outfit.
- If the character keeps changing, try one of the partner models in Firefly Boards that accept an uploaded image as a reference, and give it your concept image.
- Firefly tends to add ground shadows, so keep "no shadow" in every prompt.

## 10. Troubleshooting
| Problem | Try |
|---|---|
| The character changes between frames | Use frame by frame (§5), or a reference-image model (§9) |
| Rows are in the wrong order | Regenerate. The Slicer can't reorder a single grid image |
| Legs don't look like walking | Raise the composition reference strength |
| The Slicer removes parts of the character | Something is too close to magenta, so recolour it in the prompt |
| Many "lowest row" or "height" findings | Usually fine after nudging. If every frame is off, the feet are cropped or hidden |
| A pink halo around the character | Regenerate with "flat magenta, no gradient". Soft edges are fine; coloured glows aren't |

## 11. Decision log
| Date | Decision |
|---|---|
| 2026-09-28 | v0.1 for the M2 spike: magenta key colour, one-image sheet with pose templates as the main method, frame by frame as the fallback, layers experimental, Firefly-tuned tips |
