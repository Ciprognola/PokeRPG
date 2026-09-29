# PokeRPG — UI Spec
*Version 0.2 · 2026-09-29 · Owner: PM · Status: draft pending PO approval*

The contract for the fixed UI shell (GDD §12): layout, proportions, colours, timings and behaviour. It was written from reference captures that stay in the PM chat and never enter the repo (Brief §3). **All UI assets are original**, drawn to match this spec; nothing is traced or extracted from another game.
Values marked **≈** were measured on scaled video captures. They are verified against 1× captures before UI art is drawn (§14).

---

## 1. Units and scale
| Rule | Value |
|---|---|
| UI unit (u) | 1 u = **4 screen px** at the 960 × 540 base resolution (GDD §3) |
| UI canvas | **240 × 135 u**, covering the whole screen |
| Art resolution | UI art is drawn at 1× (1 px = 1 u) and shown at 4× |
| Filtering | Nearest-neighbour only. Never smoothed |
| Positions | Whole u only, so every UI pixel lands on the 4 px grid |
| World reference | One 64 px tile = 16 u. The screen is 15 tiles wide, like the reference |
| Overlays | The dialogue box, start menu and prompts sit on top of the world, anchored to screen edges |
| Full-screen screens | Use the whole 240 × 135 canvas. Compared with the 160 u tall reference, lists show one or two fewer rows and scroll |

## 2. Font
- **One original pixel font**, drawn fresh to the metrics below, never traced from a reference font. The shapes are new; only size, spacing and style match.
- Variable width, upper and lower case, digits, common punctuation, and the full Italian set: à è é ì ò ù and their capitals, plus the apostrophe (GDD §12).
- Symbols: ▼ (next page) and ▶ (cursor) are separate sprites, not glyphs.
- **Line pitch 16 u.** Cap height ≈ 10 u.
- **Drop shadow:** every glyph has a shadow 1 u right and 1 u down, in the shadow colour of its text style (§10).
- A text width of ≈ 208 u holds about 30–35 characters of mixed Italian text.

## 3. Window frame
- Windows are 9-slice frames: fixed corners, repeating edges, flat fill.
- **Two frame styles:**
  - `dialogue`: a double teal border, used only by the dialogue box.
  - `menu`: a dark grey-violet border, used by menus, prompts and panels.
- Border thickness ≈ 3 u. Fill `#F8F8F8`.
- The frame style is fixed at launch. A selectable frame option (like the reference's "Cornice") is *later*.

## 4. Dialogue box
| Property | Value |
|---|---|
| Position | Bottom of the screen, full width: outer box ≈ x 2–238, y 90–133 u |
| Lines per page | **2** |
| Text area | Starts ≈ 13 u in from the box's left edge and ≈ 8 u below its top. Width ≈ 208 u |
| Text style | `body` (§10) |
| Next-page arrow | Red ▼, placed right after the last character of the page, with a small bob (§11) |

**Pagination.** The runtime word-wraps each story line (Story Schema §5.1) to the text width. Every 2 rendered lines make a page; ▼ ends each page, and **A** advances. A word is split only if it is longer than a whole line. A 120-character line usually takes 1–2 pages.

**Speaker names.** There is no name plate. The speaker's name appears inline, in capitals, followed by `: `, at the start of the text:
- on the first line of every dialogue (an NPC dialogue, a `talk` task's lines, or a `say` command), and
- on any later line whose speaker differs from the line before.
- The narrator never gets a name. The player's name comes from `{player.name}`.
- The name is added by the runtime and doesn't count towards the 120 characters.

**Reveal.** Typewriter, at the speed chosen in OPZIONI (§7). **A** during the reveal finishes the page; **B** shows the whole page at once (GDD §6).

## 5. Menus

### 5.1 Start menu
| Property | Value |
|---|---|
| Opens with | Menu (GDD §2). B or ANNULLA closes it |
| Window | `menu` frame, anchored top-right, width ≈ 70 u (≈ x 170–240), height fits the entries |
| Entries | Capitals, style `body`, pitch 16 u, text ≈ 16 u in from the window's left edge |
| Cursor | Black ▶, ≈ 6 u left of the selected entry. Up and down wrap around |
| Entries (GDD §9) | MISSIONI · AGENDA · SALVA · OPZIONI · ACCOUNT · TITOLO · ANNULLA |
| Limit | At most **7 entries** fit the 135 u canvas, and all 7 are used. New tools go inside an existing entry, as dev mode does in OPZIONI (§7) |

### 5.2 Yes/no prompt
A small `menu` window with SÌ / NO and the ▶ cursor, placed above the dialogue box on the right. B means NO. Exact size and position are TBD (§14).

### 5.3 Title panels
Used by the title screen and story selection (the flow is GDD §15 Q3).
- Background `#9090F8`.
- Full-width stacked panels, ≈ x 10–230 u, ≈ 29 u tall, ≈ 3 u apart, `menu` frame.
- Selected panel fill `#F8F8F8`; the others `#909090`. There is no cursor: the white panel is the selection.
- Text in capitals, style `body`, ≈ 6 u in from the panel's left edge.
- The title screen shows the **4 save slots** (GDD §10) as 4 panels, which fit the canvas. What each slot panel shows is decided with GDD §15 Q3.

### 5.4 Quick edit window
With dev mode on (§7), pressing A on an item in MISSIONI, AGENDA or the shop opens a small `menu` window of edit actions, with the ▶ cursor, like the yes/no prompt (§5.2). Its entries and position are TBD (§14).

## 6. Full-screen layouts

### 6.1 Header and list (OPZIONI and similar)
- A **header panel** at the top (≈ x 10–230, y 2–30 u) holds the screen title in the `label` style.
- A **list panel** below it fills the rest of the canvas. Rows have a 16 u pitch, and the list scrolls when the rows don't fit (§1).
- The **current row** has fill `#F8F8F8`; the other rows `#C0C0C0`.
- Row labels use the `label` style on the left. Values start ≈ 118 u from the left edge. The chosen value uses `chosen`; the others use `value`.
- Up and down move between rows; left and right change the value. The last row is ESCI.

### 6.2 Pocket list (AGENDA and the shop)
- **Layout:** a title bar with ◀ ▶ arrows and page dots on the left, a picture and a description box below it, and a scrolling list on the right ending with ESCI.
- **AGENDA** (GDD §13) is a pocket list with the pages GIORNO · SETTIMANA · MESE, plus NEGOZIO in private slots. Left and right change the page.
- On a task page, the list holds that page's tasks. The picture and description box show the selected task: its place, time and coins.
- On NEGOZIO, the list holds the shop entries with their prices. The picture and description box show the selected entry.
- Exact positions, row content and the coin display are TBD (§14).

### 6.3 Card (reserved)
A framed card with labelled fields on the left and a picture on the right. It has no use yet and stays reserved.

## 7. OPZIONI
Uses the header and list layout (§6.1).

| Row | Values |
|---|---|
| VELOC. TESTO | LENTA · MEDIA · VELOCE |
| MUSICA | 0–10 |
| EFFETTI | 0–10 |
| COMANDI | PICCOLI · MEDI · GRANDI (touch control size; the row is hidden on devices without touch) |
| MODALITÀ DEV | SÌ · NO (shown only to the slot's dev, GDD §14.1) |
| EDITOR | Opens the Edit panel (§8). Shown only while dev mode is on |
| ESCI | — |

## 8. Other screens
| Screen | Status |
|---|---|
| Title and save slots | Title panels (§5.3). The flow is open (GDD §15 Q3) |
| Quest log (MISSIONI) | Header and list (§6.1): current objective first, then completed quests. Detail TBD at M5 |
| AGENDA and shop | Pocket list (§6.2). Detail TBD before M6 |
| Edit panel | Full-screen, built from the header and list layout (§6.1) and the dialogue box for text input. Detail TBD: quick edits before M6, the full panel before M9 |
| Save | Yes/no prompt (§5.2), then a confirmation line in the dialogue box |
| End card | Story title, author and "Fine" (GDD §7.1). Layout TBD |
| Naming screen | Needed by the character creator (M7). TBD (§14) |
| Account | Sign-in state, sign in and out, privacy notice (GDD §14.2). Layout TBD before M9 |

## 9. Transitions
- Location change: fade out, load, fade in (GDD §4). Duration TBD (§11).
- Scene `fade` defaults to 400 ms (Story Schema §7).
- Menus open and close instantly, as in the reference. To be confirmed from recordings.

## 10. Colours
All values ≈ and snapped to 15-bit colour (multiples of 8), as the reference uses.

| Use | Colour |
|---|---|
| Window fill | `#F8F8F8` |
| `dialogue` frame | teal `#00F8A0` · `#00D0C0` · `#70C8A8` |
| `menu` frame | `#706880` · `#484868`, outline `#283030` |
| Title background | `#9090F8` |
| Unselected panel | `#909090` |
| Unselected list row | `#C0C0C0` |
| Next-page arrow ▼ | `#E80808` |

| Text style | Text | Shadow |
|---|---|---|
| `body` | `#606060` | `#D8D8D0` |
| `label` (headers, option names) | `#986000` | `#C08840` |
| `chosen` (selected value) | `#C02010` | `#C06860` |
| `value` (other values) | `#383838` | `#A0A098` |

## 11. Timings
All TBD from screen recordings (§14): text reveal at each speed, ▼ bob, cursor movement, location fade. Until then Claude Code uses placeholders and keeps every timing in one config file.

## 12. Sounds
Cursor move, confirm, cancel, menu open and save. All are **original** sounds made to match; which moments play a sound, and their character, are confirmed from recordings (§14).

## 13. Assets and overrides
- UI asset ids use the pattern `ui_<name>`, e.g. `ui_frame_dialogue`, `ui_frame_menu`, `ui_cursor`, `ui_arrow_next`, `ui_font_main`. UI sounds use `sfx_ui_<name>`.
- Every UI asset has a fixed file name and 1× size, listed in a registry file that Claude Code maintains.
- A private build replaces them 1:1 from `overrides/`, with the same names and sizes (Brief §2).

## 14. Open items
1. **Verify every ≈ value** against 1× captures (240 × 160 PNG, no filters) of: the dialogue box, the start menu, OPZIONI and the title panels.
2. **Captures still needed:** the yes/no prompt, the naming screen, a pocket-list screen, and recordings of text at each speed, the menu, and a door transition.
3. **Platform screens:** AGENDA and shop detail, the quick edit window and the save slot panels before M6; the Edit panel and the account screen before M9.

## 15. Decision log
| Date | Decision |
|---|---|
| 2026-09-29 | v0.1: adapt to 16:9 with 4× pixels on a 240 × 135 layout; 2 lines per page with runtime pagination and the 120-character story limit kept; speaker names inline in capitals when the speaker changes, no name plate; one original font drawn to the reference metrics (answers Claude Code spec issue #3); layouts and colours measured from the PO's video captures, to verify at 1× |
| 2026-09-29 | v0.2: tracker design (GDD v0.8). AGENDA is the tracker's start-menu entry (§5.1); the title screen shows 4 save slots (§5.3); quick edit window (§5.4); AGENDA and the shop use the pocket-list layout, the card layout stays reserved (§6.2–§6.3); OPZIONI gains MODALITÀ DEV and EDITOR for the slot's dev (§7); screens list updated, naming screen moves to M7 (§8) |
