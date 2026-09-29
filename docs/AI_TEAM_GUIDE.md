# PokeRPG — AI Team Guide
*Version 0.3 · 2026-09-29 · Owner: PM*

How work flows: **PO decides → PM updates `docs/` and writes the brief → PO uploads docs and pastes the brief to the right AI → output comes back → PM reviews against acceptance criteria.**

## 1. Routing
| Task | Goes to | Never to |
|---|---|---|
| Specs, schemas, GDD, tickets, prompt kits, reviews | Claude chat (PM) | — |
| Uploading `docs/` files to GitHub | PO | — |
| Any code, repo setup, CI, tools, story package files, technical docs | Claude Code | Claude chat |
| Images: locations, props, sprites, UI art | Firefly or another image AI | Claude chat |
| Turning AI images into sprites, props and locations | Slicer tool (map tool from M6) | Any AI (after M1) |
| Music tracks | Suno (batched) | — |

Rule of thumb: repeated task → tool. Judgment task → AI. Images are never processed in chat once a tool exists.

## 2. Claude Code (Dev)
**Ownership**
- `docs/` holds PM-owned product docs (brief, guide, specs). Claude Code reads them and never edits them.
- Claude Code owns everything else: code, `CLAUDE.md`, CI, repo layout, and technical docs (kept outside `docs/`).
- If a spec is unclear, wrong or blocks good engineering, Claude Code stops and reports `Spec issue: <file> §<section> — <problem> — <suggestion>`. The PM fixes the spec first.

**How Claude Code works**
- Tickets state the outcome, the relevant docs and the acceptance criteria. **Claude Code chooses the approach**: architecture, libraries, file layout.
- For new areas or non-trivial work, Claude Code proposes a short plan before building.
- `CLAUDE.md` is Claude Code's standing brief; Claude Code keeps it short and pointing to `docs/`.
- Group related tickets into one session; start a fresh session between unrelated groups.
- One ticket = one branch = one PR. CI must pass.

**Ticket template**
```
ID: PKR-###            Milestone: M#
Title:
Goal: (one sentence, user-facing outcome)
Read: docs/<file> §<section>
Constraints: (only what the spec or PO requires)
Out of scope:
Acceptance criteria:
- [ ]
Approach: Claude Code's choice. Plan first if non-trivial.
Definition of done: tests added · CI green · technical docs updated if behaviour changed · PR opened
```

## 3. Firefly (Art)
There is no official library or locked house style (Brief §2). Image AIs make the PO's own asset packs and the test images for the spikes.

**Rules**
- Follow the Location Guide and the Sprite Reference Document. Each asset pack keeps one consistent style of its own, set by a reference image.
- Batch by asset type (all trees together, all interiors together).
- Iterate with variations of an approved image, not new prompts.
- Raw output always goes through the Slicer before use.
- Real places: use your own photos, or photos you have rights to, with no identifiable people.

**Batch brief template**
```
Batch ID: ART-###       Asset type:
Pack:                   Count:
Output size / aspect:
Style reference: <the pack's reference image>
Structure reference: <if needed>
Prompt template: "<base prompt> {variable}"
Variables: [list]
Naming: <type>_<name>_<variant>.png
Acceptance: matches the pack's style reference · lighting direction · no text/watermarks · matches Asset Spec
```

## 4. Suno (Music)
**Two-call rule:** one bulk request for a pack's whole track list, then one refinement batch for rejects. No single-track requests.

**Bulk brief template**
```
Batch ID: MUS-###
Pack:
Global style: <genre, instrumentation, mood family>
Tracks (one per line): name · use (town/route/interior/event) · mood · BPM · length · loop-friendly yes/no
Naming: mus_<use>_<name>.mp3
```
Loop points and fades are handled in the engine, not regenerated.

## 5. PM duties
- Keep every file in `docs/` current. Deliver complete updated files, only the changed ones, batched where possible, each with a version bump and decision-log rows.
- End each delivery with **Upload to docs/:** followed by the file list.
- Write tickets and batch briefs in the templates above.
- Review outputs against acceptance criteria before they are marked done.
- Write the user-facing prompt kits (Story Prompt Kit, Sprite Reference Document, Location Guide).

## 6. Docs workflow
1. **Source of truth:** repo `docs/`. Project knowledge is a synced, read-only copy.
2. PM delivers updated files in chat.
3. PO uploads them to `docs/` on GitHub (Add file → Upload files; same filename overwrites) and commits to `main`.
4. PO taps **Sync** on the repo in Project knowledge.
5. Claude Code reads `docs/` fresh for each task.

## 7. Decision log
| Date | Decision |
|---|---|
| 2026-09-28 | v0.1–v0.2: routing, Claude Code ownership and ticket template, Firefly and Suno batch rules, PM duties, docs workflow |
| 2026-09-29 | v0.3: no official library or locked style (Brief v0.14): Firefly batches serve the PO's asset packs and the spikes, with a per-pack style reference; the Slicer processes sprites, props and locations; the PM also writes the Location Guide |
