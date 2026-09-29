# Story runtime rules (PKR-013, PKR-014)

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

After the last task of the last quest, its `onComplete` scene plays in full, then the story ends and the platform shows an **end card**: the story's title, its author and "The End" (GDD v0.5 §7.1, Story Schema v0.5 §6.1). The player then returns to story selection. M5 still owns the exact screen — the specs fix only what it shows and that it follows the closing scene, not its layout.

A trailing `scene` task is equivalent for the player. Both are valid stories.

## Scenes (Story Schema §7.1, GDD §5, §7.2)

### `move`

- `path[0]` is the actor's **current tile**; the actor then walks straight to each next point. A corner needs three points (start, corner, end).
- **If `path[0]` isn't the actor's actual tile**, the runtime logs a warning and walks the path from the actor's real tile instead of `path[0]` (GDD/Story Schema v0.5). It never snaps the actor to the story's stated first point and never skips the command.
- The validator only checks that consecutive points are straight lines. It does not check collision (the actor's location is unknown before run time) and, per Story Schema §11, does not compare `path[0]` with the actor's actual start either — both are the runtime's job, per the rule above.

### NPC behaviour during and after scenes

- **All NPC `behaviour` pauses while any scene runs**, for every NPC in the location, not only the ones the scene names. GDD §5 already said "while talking"; scenes are the addition.
- **Afterwards** an NPC's behaviour resumes from its **new tile**:
  - `wander`'s radius is centred on where the scene left it.
  - `patrol` first walks back to the **nearest point on its own path**, then continues the loop from there (GDD/Story Schema v0.5). The path itself is unchanged; only where the NPC re-enters it moves.
- This lasts **until the player leaves the location**. Then the NPC's placements apply again (GDD §8: "NPC positions changed by a scene last until the location is left"). `show` follows the same lifetime (Story Schema §7 table).
- `move` therefore never changes which placement is current. Lasting changes belong to flags and conditional placements.

### Screen at story start

- The story **opens on a black screen**.
- A scene may `fade` in itself. A story whose first scene doesn't (or that has none) must not stay black: **if the screen is still black when the player gets control, fade in at 400 ms.**
- "Player gets control" means the first moment input is unlocked after story start, with no scene running.

## Triggers and story start (Story Schema §8, GDD §7.3)

- **`storyStart` triggers run first, in the order they're listed**, then the first task becomes active. A first `scene` task (if the story has one) starts only after every `storyStart` trigger has run (GDD/Story Schema v0.5). The two never race and never queue against each other by any other rule.

## Dialogue box (Story Schema §5.1, GDD §6)

- The runtime guarantees that **any line up to 120 characters fits one page** (3 rendered lines). Authors count characters only; they never split for layout.
- **Player name is at most 12 characters** (GDD v0.5 §6). `{player.name}` counts as 12 in the 120-character budget for exactly this reason — the real name never needs more room than the placeholder already reserves. M6 (character creation) enforces the limit at input.
- This is a runtime obligation: size the box and font from the worst case. Test to write with M4: render a 120-character line of wide letters (`WWW…`) and a 12-character player name substituted into `{player.name}`, in the smallest supported viewport, and assert it stays within three lines.
- The 120-character figure itself still depends on the dialogue box, which is open (GDD §15 Q5, Story Schema §5.1) — a change there is a story-format change (schema, JSON Schema, template and Prompt Kit together), not a runtime-rules change.

## Resolved (GDD v0.5 / Story Schema v0.5, 2026-09-29)

The five questions this file used to leave open are answered above; kept here only as a pointer from the ticket that closed them (PKR-014's docs-dev sync):

1. `move` path whose first point isn't the actor's tile → warns, walks from the actor's real tile. See "`move`" above.
2. `storyStart` trigger vs. a first `scene` task → `storyStart` triggers run first. See "Triggers and story start" above.
3. Player name length limit → 12 characters. See "Dialogue box" above.
4. `patrol` after a scene moved the NPC → returns to the nearest path point, then resumes the loop. See "NPC behaviour during and after scenes" above.
5. What "the story ends" shows → an end card (title, author, "The End"), then story selection. See "Story end" above.

Still open, not part of this file's scope: Story Schema §5.1's 120-character limit depends on GDD §15 Q5 (screen fit); the Story Prompt Kit (v0.2, unchanged this round) cites Schema §7.1 for the "validator can't check collision" claim in its Tiles guidance (B3), which Schema now states in §11 instead — a small citation mismatch, not a runtime-behaviour question, left for the PM to fix in the Kit's own next revision.
