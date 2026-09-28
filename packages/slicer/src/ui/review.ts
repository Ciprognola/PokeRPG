import {
  DIRECTIONS,
  composeCharacter,
  formatFinding,
  frameRects,
  getAnimSet,
  packageFiles,
  zipFiles,
} from '@pokerpg/core';
import type {
  AssembledCharacter,
  Finding,
  LayerId,
  LayerNudges,
  Nudges,
  Prepared,
  Shift,
} from '@pokerpg/core';
import { describeError } from '../util.js';
import { canvasesFor, drawFrame, drawOverlay } from './canvas.js';
import type { SheetCanvases } from './canvas.js';
import { h } from './dom.js';

const PREVIEW_FPS = 8;
const NUDGE_LIMIT = 16;
const ALL_LAYERS = '*';

export interface ReviewOptions {
  backLabel: string;
  /** Called with the character as edited (nudges baked into the sheets) when the user goes back. */
  onBack: (edited: AssembledCharacter) => void;
}

export interface ReviewHandle {
  /** Stop timers and listeners. */
  dispose(): void;
}

/** The review screen: preview, layers, findings, frame nudge, export. Shared by both modes. */
export function mountReview(
  root: HTMLElement,
  prepared: Prepared,
  options: ReviewOptions,
): ReviewHandle {
  const set = getAnimSet(prepared.setId)!;
  const rects = frameRects(set);
  /** Shifts of a frame in every layer. */
  const nudges: Record<string, Shift> = {};
  /** Shifts of one layer of a frame: `<layer>/<frameKey>`. */
  const layerNudges: Record<string, Shift> = {};
  let assembled: AssembledCharacter;
  let sheets: SheetCanvases = new Map();
  let selected = 0;
  let showOverlay = true;
  let playing = true;
  let scope: string = ALL_LAYERS;
  let allFrames = false;
  const visible = new Set<LayerId>(prepared.layers.map((l) => l.layer));

  // ---- elements ----
  const summary = h('p', { id: 'summary', class: 'summary', role: 'status' });
  const exportBtn = h(
    'button',
    { id: 'export', class: 'btn primary', type: 'button', onclick: () => void doExport() },
    'Download package',
  );
  const exportNote = h('p', { id: 'export-note', class: 'hint' });
  const notes = h('ul', { id: 'notes', class: 'notes' });

  const previewCanvases = DIRECTIONS.map((dir) => ({
    dir,
    canvas: h('canvas', {
      width: 128,
      height: 128,
      'data-dir': dir,
      class: 'frame-canvas',
      'aria-label': `Walk preview, ${dir}`,
    }),
  }));
  const previews = h(
    'div',
    { class: 'previews' },
    ...previewCanvases.map(({ dir, canvas }) =>
      h('figure', {}, canvas, h('figcaption', { text: dir })),
    ),
  );

  const layerToggles = h('div', { class: 'toggles', id: 'layers' });
  const overlayToggle = h('input', {
    type: 'checkbox',
    id: 'overlay',
    checked: true,
    onchange: () => {
      showOverlay = overlayToggle.checked;
      redraw();
    },
  });
  const playBtn = h(
    'button',
    {
      class: 'btn',
      id: 'play',
      type: 'button',
      onclick: () => {
        playing = !playing;
        playBtn.textContent = playing ? 'Pause' : 'Play';
      },
    },
    'Pause',
  );

  const thumbs = rects.map((r, i) => {
    const canvas = h('canvas', { width: 128, height: 128, class: 'thumb-canvas' });
    const button = h(
      'button',
      {
        class: 'frame-btn',
        type: 'button',
        'data-key': r.key,
        'aria-label': `Frame ${r.key}`,
        onclick: () => select(i),
      },
      canvas,
      h('span', { class: 'frame-label', text: r.key.replace('walk_', '') }),
    );
    return { button, canvas };
  });
  const grid = h('div', { id: 'frames', class: 'frame-grid' }, ...thumbs.map((t) => t.button));

  const inspector = h('canvas', {
    id: 'inspector',
    width: 128,
    height: 128,
    class: 'inspector',
    tabindex: 0,
    'aria-label': 'Selected frame',
  });
  const inspectorTitle = h('h3', { id: 'inspector-title' });
  const nudgeInfo = h('p', { id: 'nudge-info', class: 'hint' });

  const scopeSelect = h(
    'select',
    {
      id: 'nudge-layer',
      'aria-label': 'Which layers the nudge moves',
      onchange: () => {
        scope = scopeSelect.value;
        refreshSelection();
      },
    },
    h('option', { value: ALL_LAYERS, text: 'All layers' }),
    ...prepared.layers.map((l) => h('option', { value: l.layer, text: `Only ${l.layer}` })),
  );
  const allFramesBox = h('input', {
    type: 'checkbox',
    id: 'nudge-all',
    onchange: () => {
      allFrames = allFramesBox.checked;
      refreshSelection();
    },
  });
  const scopeRow = h(
    'div',
    { class: 'row wrap scope' },
    prepared.layers.length > 1 ? scopeSelect : null,
    h('label', { class: 'check' }, allFramesBox, ' All frames'),
  );

  const nudgeBtn = (label: string, dx: number, dy: number, aria: string): HTMLButtonElement =>
    h(
      'button',
      {
        class: 'btn nudge',
        type: 'button',
        'data-dx': dx,
        'data-dy': dy,
        'aria-label': aria,
        onclick: () => nudge(dx, dy),
      },
      label,
    );
  const resetBtn = h(
    'button',
    { class: 'btn', id: 'nudge-reset', type: 'button', onclick: () => resetNudge() },
    'Reset',
  );
  const pad = h(
    'div',
    { class: 'pad' },
    h('span'),
    nudgeBtn('↑', 0, -1, 'Move up 1 px'),
    h('span'),
    nudgeBtn('←', -1, 0, 'Move left 1 px'),
    resetBtn,
    nudgeBtn('→', 1, 0, 'Move right 1 px'),
    h('span'),
    nudgeBtn('↓', 0, 1, 'Move down 1 px'),
    h('span'),
  );
  inspector.addEventListener('keydown', (e) => {
    const map: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    const d = map[e.key];
    if (d) {
      e.preventDefault();
      nudge(d[0], d[1]);
    }
  });

  const findingsList = h('ul', { id: 'findings', class: 'findings' });

  root.replaceChildren(
    h(
      'div',
      { class: 'review-head' },
      h('h2', { text: `chr_${prepared.characterName}` }),
      summary,
      h(
        'div',
        { class: 'row' },
        exportBtn,
        h(
          'button',
          {
            class: 'btn',
            id: 'start-over',
            type: 'button',
            onclick: () =>
              options.onBack(
                composeCharacter(prepared, nudges as Nudges, {
                  encode: false,
                  layerNudges: layerNudges as LayerNudges,
                }),
              ),
          },
          options.backLabel,
        ),
      ),
      exportNote,
    ),
    h(
      'section',
      {},
      h('h3', { text: 'Walk preview' }),
      previews,
      h(
        'div',
        { class: 'row wrap' },
        playBtn,
        h('label', { class: 'check' }, overlayToggle, ' Ground line & anchor'),
      ),
      layerToggles,
    ),
    h('section', {}, h('h3', { text: 'Findings' }), findingsList, notes),
    h(
      'section',
      {},
      h('h3', { text: 'Frames' }),
      grid,
      h('div', { class: 'inspect' }, inspectorTitle, inspector, nudgeInfo, scopeRow, pad),
    ),
  );

  // ---- behaviour ----
  const zero: Shift = { dx: 0, dy: 0 };
  const clamp = (v: number): number => Math.max(-NUDGE_LIMIT, Math.min(NUDGE_LIMIT, v));

  /** The store and key that the current scope writes to for a frame. */
  function slot(key: string): { store: Record<string, Shift>; id: string } {
    return scope === ALL_LAYERS
      ? { store: nudges, id: key }
      : { store: layerNudges, id: `${scope}/${key}` };
  }

  function currentNudge(key: string): Shift {
    const { store, id } = slot(key);
    return store[id] ?? zero;
  }

  function nudge(dx: number, dy: number): void {
    const targets = allFrames ? rects.map((r) => r.key) : [rects[selected]!.key];
    for (const key of targets) {
      const { store, id } = slot(key);
      const cur = store[id] ?? zero;
      const next = { dx: clamp(cur.dx + dx), dy: clamp(cur.dy + dy) };
      if (next.dx === 0 && next.dy === 0) delete store[id];
      else store[id] = next;
    }
    recompose();
  }

  function resetNudge(): void {
    const targets = allFrames ? rects.map((r) => r.key) : [rects[selected]!.key];
    for (const key of targets) {
      const { store, id } = slot(key);
      delete store[id];
    }
    recompose();
  }

  function select(i: number): void {
    selected = i;
    refreshSelection();
    redraw();
  }

  /** Recompute sheets and validation after a nudge. Fast: no PNG encoding. */
  function recompose(): void {
    assembled = composeCharacter(prepared, nudges as Nudges, {
      encode: false,
      layerNudges: layerNudges as LayerNudges,
    });
    sheets = canvasesFor(assembled.sheets);
    refreshFindings();
    refreshSelection();
    redraw();
  }

  function frameSeverity(): Map<string, 'error' | 'warning'> {
    const m = new Map<string, 'error' | 'warning'>();
    for (const f of assembled.report.findings) {
      if (!f.frameKey) continue;
      if (f.severity === 'error' || !m.has(f.frameKey)) m.set(f.frameKey, f.severity);
    }
    return m;
  }

  function jumpTo(f: Finding): void {
    const i = rects.findIndex((r) => r.key === f.frameKey);
    if (i < 0) return;
    select(i);
    inspector.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    inspector.focus({ preventScroll: true });
  }

  function refreshFindings(): void {
    const { errors, warnings } = assembled.report.summary;
    summary.textContent =
      errors === 0 && warnings === 0
        ? 'No problems found.'
        : `${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}`;
    summary.dataset['errors'] = String(errors);
    summary.dataset['warnings'] = String(warnings);
    exportBtn.disabled = errors > 0;
    exportNote.textContent =
      errors > 0
        ? 'Fix the errors below (nudge frames) before exporting.'
        : warnings > 0
          ? 'Warnings do not block the export.'
          : 'PNG format and file size are checked when the package is built.';
    const items = [...assembled.report.findings]
      .sort((a, b) => Number(b.severity === 'error') - Number(a.severity === 'error'))
      .map((f) => {
        const text = h('span', { text: formatFinding(f) });
        return h(
          'li',
          {
            class: `finding ${f.severity}`,
            'data-check': f.check,
            ...(f.frameKey ? { 'data-frame': f.frameKey } : {}),
            ...(f.file ? { 'data-file': f.file } : {}),
          },
          h('span', { class: 'dot', 'aria-hidden': 'true' }),
          f.frameKey
            ? h('button', { class: 'linklike', type: 'button', onclick: () => jumpTo(f) }, text)
            : text,
        );
      });
    findingsList.replaceChildren(
      ...(items.length ? items : [h('li', { class: 'finding ok', text: 'Nothing to fix.' })]),
    );
    notes.replaceChildren(
      ...assembled.notes.map((n) => h('li', { text: n })),
      ...(assembled.scale
        ? [h('li', { text: `Scale: ×${assembled.scale.toFixed(3)} (one factor for every frame)` })]
        : []),
    );
  }

  function refreshSelection(): void {
    const key = rects[selected]!.key;
    const sev = frameSeverity();
    thumbs.forEach((t, i) => {
      const k = rects[i]!.key;
      t.button.classList.toggle('selected', i === selected);
      t.button.classList.toggle('has-error', sev.get(k) === 'error');
      t.button.classList.toggle('has-warning', sev.get(k) === 'warning');
      t.button.setAttribute('aria-pressed', String(i === selected));
    });
    const auto = prepared.shift[key] ?? zero;
    const n = currentNudge(key);
    const who = scope === ALL_LAYERS ? 'all layers' : `${scope} only`;
    const where = allFrames ? 'every frame' : 'this frame';
    inspectorTitle.textContent = key;
    nudgeInfo.textContent =
      (prepared.scale === null ? '' : `Auto shift (${auto.dx}, ${auto.dy}) · `) +
      `nudge for ${who}, ${where}: (${n.dx}, ${n.dy})`;
    nudgeInfo.dataset['dx'] = String(n.dx);
    nudgeInfo.dataset['dy'] = String(n.dy);
    resetBtn.disabled = allFrames
      ? !rects.some((r) => currentNudge(r.key) !== zero)
      : n.dx === 0 && n.dy === 0;
  }

  function redraw(): void {
    thumbs.forEach((t, i) => {
      const r = rects[i]!;
      drawFrame(t.canvas, sheets, visible, r.row, DIRECTIONS.indexOf(r.row), r.col);
    });
    const r = rects[selected]!;
    const ctx = drawFrame(inspector, sheets, visible, r.row, DIRECTIONS.indexOf(r.row), r.col);
    if (showOverlay) drawOverlay(ctx);
    drawPreview();
  }

  let col = 0;
  function drawPreview(): void {
    for (const { dir, canvas } of previewCanvases) {
      const ctx = drawFrame(canvas, sheets, visible, dir, DIRECTIONS.indexOf(dir), col);
      if (showOverlay) drawOverlay(ctx);
    }
    previews.dataset['col'] = String(col);
  }

  // Layer toggles
  for (const layer of prepared.layers) {
    const box = h('input', {
      type: 'checkbox',
      checked: true,
      'data-layer': layer.layer,
      onchange: () => {
        if (box.checked) visible.add(layer.layer);
        else visible.delete(layer.layer);
        redraw();
      },
    });
    layerToggles.append(h('label', { class: 'check' }, box, ` ${layer.layer}`));
  }

  // Animation: 8 fps, paused when the tab is hidden.
  let raf = 0;
  let last = 0;
  const tick = (t: number): void => {
    raf = requestAnimationFrame(tick);
    if (!playing || document.hidden) return;
    if (t - last >= 1000 / PREVIEW_FPS) {
      last = t;
      col = (col + 1) % set.framesPerRow;
      drawPreview();
    }
  };
  raf = requestAnimationFrame(tick);

  async function doExport(): Promise<void> {
    exportBtn.disabled = true;
    exportNote.textContent = 'Building the package…';
    await new Promise((r) => setTimeout(r, 30)); // let the message paint
    try {
      const full = composeCharacter(prepared, nudges as Nudges, {
        encode: true,
        layerNudges: layerNudges as LayerNudges,
      });
      if (!full.report.ok) {
        assembled = full;
        refreshFindings();
        exportNote.textContent =
          'The finished files have errors (see the list); nothing was exported.';
        return;
      }
      const zip = zipFiles(packageFiles(full));
      const blob = new Blob([zip as BlobPart], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = h('a', { href: url, download: `chr_${prepared.characterName}.zip` });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      refreshFindings();
      exportNote.textContent = `Saved chr_${prepared.characterName}.zip (${(zip.length / 1024).toFixed(0)} KB).`;
      exportNote.dataset['done'] = 'true';
    } catch (e) {
      exportNote.textContent = describeError(e);
      refreshFindings();
    }
  }

  recompose();
  return {
    dispose(): void {
      cancelAnimationFrame(raf);
    },
  };
}
