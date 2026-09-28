# PokeRPG — Story Prompt Kit
*Version 0.2 · 2026-09-28 · Owner: PM · Status: draft pending PO approval*

How to write a PokeRPG story with **your own Claude Code**. Part A is for you, the author. Part B is the rulebook your Claude Code follows. The contract is the Story Schema; this kit only explains how to use it well.

---

# Part A — For the author

## A1. What you need
- **Claude Code**, plus **Node.js** and **git** on your computer.
- A clone of the public repo `Ciprognola/PokeRPG`, with `npm install` run once. The README's "Writing a story" section has the exact steps.
- **One character package per NPC**, made with the Sprite Reference Document and exported by the Slicer (Asset Spec §4). For a first test you can reuse the Story Template's characters in `templates/story_template/characters/`.
- You don't need a player character. The player always brings their own.

## A2. Plan the story (5 minutes)
Fill this in. You will paste it into Claude Code.

```
Title:
Language: (en, it, …)
Author name:
One-line pitch:
Tone: (cosy, mystery, funny, …)
Locations: (pick from the library; Claude Code lists them for you)
NPCs: name · personality · character package folder (say which package is
      which: Claude Code can't see the sprites)
Quests, in order, each with its tasks:
  Quest 1: <title>
    - <task: talk to / go to / watch a scene>
    - …
Ending: (what happens after the last task)
```

**Keep the first story small:** 1–2 quests, 3–6 tasks, 1–3 NPCs and 1–2 locations. It's quicker to grow a working story than to fix a big broken one.

## A3. Starter prompt
Open Claude Code in the repo folder and paste:

```
You are writing a PokeRPG story package. First read docs/STORY_PROMPT_KIT.md
Part B and follow it exactly. Then build this story:

<paste your A2 plan here>

My NPC character packages are in: <folder path>
Show me the story outline (locations, NPCs, quests and tasks) before writing
any JSON. After I approve it, build the package, run story:check until it
reports 0 errors, and tell me any warnings left.
```

## A4. Before you share
- [ ] `story:check` reports **0 errors**, and you've read every warning.
- [ ] You played through the outline in your head: each task says clearly where to go or who to talk to.
- [ ] No line names or describes the hero, apart from `{player.name}`.
- [ ] `version` went up by 1 if this is an update to a shared story.
- [ ] You're sharing the `story_<id>.zip`, not loose files.

## A5. What stories can't do at launch
Items, inventory, choices or branches · battles or creatures · new maps, music or sounds (library only) · code of any kind · defining the hero. These are rules, not bugs. Ask for features on the repo, don't work around them.

---

# Part B — Rules for the author's Claude Code

## B1. Read first
1. `docs/STORY_SCHEMA.md`: the contract. Every field and command you use must be in it.
2. `docs/GDD.md` §1 and §4–§8: how the game plays what you write.
3. `docs/ASSET_SPEC.md` §8.1: the library location data format.
4. `templates/story_template/`: a working example of every field and command.

## B2. Workflow
1. **Find the library.** Location files (`loc_*.json`) are in `assets/locations/`; valid `track` and `sfx` ids are in `assets/registry/audio.json`. For each location the author wants, read its `size`, `collision`, `spawns`, `exits`, `areas` and `music`. Only use locations that exist.
2. **Propose the outline** (locations, the exit → spawn links, NPCs, quests and tasks in order, scenes) and wait for the author's approval.
3. **Build the package.** Create `story_<id>/` where the README's "Writing a story" section says. Write `story.json` from scratch, using the Story Template only as a reference; never keep template content the story doesn't use. NPC `id` and `name` are the story's own and don't need to match the package name. Copy each NPC's character package, unchanged, into `characters/`.
4. **Check the package.** Run `npm run story:check -- <story folder>` (see `--help`). Fix every error and re-run until it reports **0 errors**. Then fix each warning, or tell the author why it's fine.
5. **Pack it.** Run `npm run story:pack -- <story folder>`. It writes `story_<id>.zip` (Story Schema §1) and checks it. Don't zip by hand.
6. **Report:** the file path, the counts (quests, tasks, NPCs, scenes), any remaining warnings and anything you simplified.

## B3. Hard rules
- **Schema only.** Don't invent fields, commands, task types, placeholders or condition forms. If the story needs something the schema lacks, tell the author and propose the closest thing the schema allows.
- **Library only.** Every `asset`, spawn, exit, area, `track` and `sfx` must exist in the library (B2 step 1). Don't create or edit locations, music or sounds.
- **The hero is the player's.** Never give the player a name, gender, look, age or backstory. Refer to them only as `{player.name}` or "you". `player` lines must fit any character.
- **Tiles.** Put NPC placements, spawns and `reach` targets on walkable (`.`) tiles inside the map. A scene `move` path starts at the actor's current tile, and each point is a straight line (the same x or the same y) from the previous one, crossing walkable tiles only. Check those tiles by hand against `collision`: the validator can't (Story Schema §7.1).
- **Text limits.** A line is at most 120 characters (`{player.name}` counts as 12), and an objective is at most 60. Split long speeches into more lines instead of shortening meaning away.
- **Logic.**
  - Declare every flag in `flags`.
  - The last dialogue of each NPC has no `when`.
  - Every exit the story needs is linked, and every location can be reached from `start`.
  - Each NPC that a `talk` task needs is placed and visible while that task is active.
- **Don't touch** `docs/`, `src/`, `templates/`, the library, or any file outside the story folder.

## B4. Writing quality
- **Objectives say where and who:** "Find Rosa in the bakery", not "Continue".
- **One idea per line.** Dialogue reads 1–3 short sentences per page.
- **Every NPC has a default dialogue** that fits the whole story, plus variants for key moments (use flags).
- **Keep scenes short:** under ~15 commands. Fade out and in around a `warp`.
- **Wrap up after the last task** with a short closing scene: the last task's `onComplete.scene` (Story Schema §6.1).
- **Know the runtime rules** in Story Schema §6.1 and §7.1 (when `reach` completes, what conditions see during `onComplete`, NPC behaviour in scenes, the black screen at story start).

## B5. Fixing common errors
| Message mentions | Usual fix |
|---|---|
| unknown location / spawn / exit / area | Re-read the `loc_*.json`; use the exact name |
| tile blocked or outside the map | Move it to a `.` tile inside `size` |
| path not straight | Add a corner point between the two tiles |
| line over 120 / objective over 60 | Split the line / shorten the objective |
| last dialogue has a `when` | Add a plain default dialogue at the end |
| flag not declared | Add it to `flags` |
| character errors | Re-export that NPC with the Slicer; don't edit the sheet by hand |

---

## Decision log
| Date | Decision |
|---|---|
| 2026-09-28 | v0.1: kit targets the author's own Claude Code (Brief v0.8). Part A for authors, Part B rules for Claude Code |
| 2026-09-28 | v0.2: fixes from the M2 story spike: quests with tasks in A2, library and template paths, NPC mapping by the author, write `story.json` from scratch, `story:pack`, runtime rules |
