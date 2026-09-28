# Story runtime rules (PKR-013)

What the player runtime (M4 engine, M5 story player) must do so that a story checked by `story:check` plays as its author was told it would. **No runtime code exists yet**; this is the build-to list. The specs own the wording: `docs/STORY_SCHEMA.md` §6.1 and §7.1, and the GDD passages named below. If this file and a spec disagree, the spec wins and this file is stale.

The validator can't check any of this, because it needs a running game. Each rule below is written so it can become a test on the M4/M5 state machine.

## Tasks (Story Schema §6.1, GDD §7.1)

**Exactly one task is active at a time.** Tasks run in order across quests.

### `reach`

- Completes when the player is in the task's area (or on its spawn tile) **while the task is active**, however they got there: walking, an exit, or a `warp` scene command.
- **Check on activation too:** if the player is already inside the area when the task becomes active, it completes at once. Whoever builds the state machine must evaluate the condition at activation, not only on movement or arrival events.
- **Visits before activation don't count.** Don't remember past area entries.
- Consequence for authors: entering the destination early is harmless; the task completes when it activates while they stand there, or when they next arrive.

### Completion order

When a task completes, in this order and nothing else:

1. The task is marked complete.
2. If it was the quest's last task, the quest is marked complete.
3. `onComplete.flags` are set.
4. `onComplete.scene` runs to the end.
5. The next task becomes active (its own start rules apply: a `scene` task starts its scene, a `reach` task checks the player's position, §6.1 above).

Conditions evaluated **during** the `onComplete` scene (and by any NPC dialogue or placement shown during it) already see the task and, if it was the last one, the quest as complete. The next task is **not** yet active, so `{ task: <next>, is: "active" }` is false during the scene.

Autosave (GDD §10) fires when a task completes, and saving is blocked during scenes. The specs don't say where in the order above the autosave lands. Our reading is after step 4, so a load never restores a moment inside the scene; confirm with the PM when M5 builds saving.

### Story end

After the last task of the last quest, its `onComplete` scene plays in full, then the story ends. There is no "story complete" screen in the specs yet, so M5 has to decide what "ends" shows; the rule only fixes the order: scene first, then the end.

A trailing `scene` task is equivalent for the player. Both are valid stories.

## Scenes (Story Schema §7.1, GDD §5, §7.2)

### `move`

- `path[0]` is the actor's **current tile**; the actor then walks straight to each next point. A corner needs three points (start, corner, end).
- The validator only checks that consecutive points are straight lines. It does not check collision (the actor's location is unknown before run time) and does not compare `path[0]` with the actor's start. So the runtime meets stories whose first point is wrong (see open question 1).

### NPC behaviour during and after scenes

- **All NPC `behaviour` pauses while any scene runs**, for every NPC in the location, not only the ones the scene names. GDD §5 already said "while talking"; scenes are the addition.
- **Afterwards** an NPC's behaviour resumes from its **new tile**: a `wander` radius is centred on where the scene left it.
- This lasts **until the player leaves the location**. Then the NPC's placements apply again (GDD §8: "NPC positions changed by a scene last until the location is left"). `show` follows the same lifetime (Story Schema §7 table).
- `move` therefore never changes which placement is current. Lasting changes belong to flags and conditional placements.

### Screen at story start

- The story **opens on a black screen**.
- A scene may `fade` in itself. A story whose first scene doesn't (or that has none) must not stay black: **if the screen is still black when the player gets control, fade in at 400 ms.**
- "Player gets control" means the first moment input is unlocked after story start, with no scene running.

## Dialogue box (Story Schema §5.1, GDD §6)

- The runtime guarantees that **any line up to 120 characters fits one page** (3 rendered lines). Authors count characters only; they never split for layout.
- This is a runtime obligation: size the box and font from the worst case. `{player.name}` counts as 12 characters in the 120 (the validator does the same), so the real name length is not a story concern, but the **player name limit** must be chosen with the box in mind (open question 3).
- Test to write with M4: render a 120-character line of wide letters (`WWW…`) in the smallest supported viewport and assert it stays within three lines. Also do this with the longest allowed player name substituted, if the limit exceeds 12.

## Open questions for the PM

The specs are silent on these. None blocks the current work; each will need an answer before the matching runtime piece is built. Raise as `Spec issue` when the milestone starts.

1. **`move` path whose first point isn't the actor's tile.** Snap the actor there, walk to it first, or skip the scene command with a console warning? (Story Schema §7.1 says the first point is the current tile but not what happens when it isn't. The validator doesn't compare either.)
2. **`storyStart` trigger and a first `scene` task.** Both fire at story start (Story Schema §8, §6). The Story Template has both. Which runs first, or do they queue? (Story Schema §6.1 fixes the order of completion, not of activation.)
3. **Player name length limit.** Not in the specs; §5.1 counts `{player.name}` as 12, which implies a limit of 12. Confirm, and decide where it is enforced (M6 character creation).
4. **`patrol` after a scene moved the NPC.** `wander` re-centres on the new tile (Story Schema §7.1). A patrol's `path` points are absolute: resume from the nearest path tile, or from the new tile? Not stated.
5. **What "the story ends" shows** (see Story end).
