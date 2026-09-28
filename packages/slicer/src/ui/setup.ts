import { LAYER_IDS } from '@pokerpg/core';
import type { LayerId } from '@pokerpg/core';
import type { LayerEntry } from '../session.js';
import { finalName, toFieldName } from '../util.js';
import { h } from './dom.js';

export interface SetupModel {
  characterName: string;
  entries: LayerEntry[];
  nextId: number;
}

export function newSetupModel(): SetupModel {
  return { characterName: '', entries: [], nextId: 1 };
}

/** The entries with their final asset names (a blank name means "use the character's"). */
export function resolvedEntries(model: SetupModel): LayerEntry[] {
  const character = finalName(model.characterName);
  return model.entries.map((e) => ({ ...e, name: finalName(e.name) || character }));
}

/** What still blocks processing, in plain words. Empty when ready. */
export function setupProblems(model: SetupModel): string[] {
  const problems: string[] = [];
  if (!finalName(model.characterName)) problems.push('Give the character a name.');
  if (!model.entries.some((e) => e.layer === 'body')) problems.push('Add the body layer.');
  const seen = new Set<LayerId>();
  for (const e of model.entries) {
    if (seen.has(e.layer))
      problems.push(`Two images use the ${e.layer} layer. Pick a different layer for one.`);
    seen.add(e.layer);
  }
  return problems;
}

const isImage = (f: File): boolean =>
  f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(f.name);

async function makeThumb(file: File): Promise<string | undefined> {
  try {
    const bitmap = await createImageBitmap(file, { resizeWidth: 120, resizeQuality: 'low' });
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
    bitmap.close();
    return canvas.toDataURL('image/png');
  } catch {
    return undefined;
  }
}

/**
 * The setup screen: name the character, add images, assign a layer to each, process.
 * `notice` is shown at the top (for example an error from the last attempt).
 */
export function mountSetup(
  root: HTMLElement,
  model: SetupModel,
  onProcess: () => void,
  notice?: string,
): void {
  const noticeBox = h('p', { class: 'notice error', role: 'alert', id: 'notice' });
  const showNotice = (msg?: string): void => {
    noticeBox.textContent = msg ?? '';
    noticeBox.hidden = !msg;
  };
  showNotice(notice);

  const nameInput = h('input', {
    id: 'char-name',
    type: 'text',
    autocomplete: 'off',
    autocapitalize: 'none',
    spellcheck: false,
    placeholder: 'e.g. mira',
    value: model.characterName,
    'aria-describedby': 'name-hint',
    oninput: () => {
      nameInput.value = toFieldName(nameInput.value);
      model.characterName = nameInput.value;
      renderList();
      updateProcess();
    },
  });

  const fileInput = h('input', {
    id: 'file-input',
    type: 'file',
    accept: 'image/*',
    multiple: true,
    hidden: true,
    onchange: () => {
      void addFiles([...(fileInput.files ?? [])]);
      fileInput.value = '';
    },
  });

  const list = h('div', { id: 'entries', class: 'entries' });
  const requirements = h('ul', { id: 'requirements', class: 'requirements' });
  const processBtn = h(
    'button',
    { id: 'process', class: 'btn primary', type: 'button', onclick: onProcess },
    'Process',
  );

  function updateProcess(): void {
    const problems = setupProblems(model);
    processBtn.disabled = problems.length > 0;
    requirements.replaceChildren(...problems.map((p) => h('li', { text: p })));
  }

  async function addFiles(files: File[]): Promise<void> {
    if (files.length === 0) return;
    showNotice();
    let source: LayerEntry['source'];
    let summary: string;
    if (files.length === 1) {
      source = { kind: 'grid', file: files[0]! };
      summary = `grid image: ${files[0]!.name}`;
    } else if (files.length === 24) {
      source = { kind: 'frames', files };
      summary = '24 separate frames';
    } else {
      showNotice(
        `You picked ${files.length} images. For each layer pick one grid image (6 columns × 4 rows) or exactly 24 separate frame images.`,
      );
      return;
    }
    if (!files.every(isImage)) {
      showNotice('Some of those files are not images.');
      return;
    }
    const used = new Set(model.entries.map((e) => e.layer));
    const free = LAYER_IDS.find((l) => !used.has(l));
    if (!free) {
      showNotice('All seven layers are already in use. Remove one first.');
      return;
    }
    const entry: LayerEntry = { id: model.nextId++, layer: free, name: '', source, summary };
    model.entries.push(entry);
    renderList();
    updateProcess();
    const first = source.kind === 'grid' ? source.file : source.files[0]!;
    const thumb = await makeThumb(first);
    if (thumb && model.entries.includes(entry)) {
      entry.thumb = thumb;
      renderList();
    }
  }

  function renderList(): void {
    const cards = model.entries
      .slice()
      .sort((a, b) => LAYER_IDS.indexOf(a.layer) - LAYER_IDS.indexOf(b.layer))
      .map((entry) => {
        const taken = new Set(model.entries.filter((e) => e !== entry).map((e) => e.layer));
        const select = h(
          'select',
          {
            class: 'layer-select',
            'aria-label': `Layer for ${entry.summary}`,
            onchange: () => {
              entry.layer = select.value as LayerId;
              renderList();
              updateProcess();
            },
          },
          ...LAYER_IDS.filter((l) => !taken.has(l)).map((l) => {
            const o = h('option', { value: l, text: l });
            o.selected = l === entry.layer;
            return o;
          }),
        );
        const nameField = h('input', {
          class: 'asset-name',
          type: 'text',
          autocomplete: 'off',
          autocapitalize: 'none',
          spellcheck: false,
          'aria-label': `Asset name for the ${entry.layer} layer`,
          placeholder: finalName(model.characterName) || 'asset name',
          value: entry.name,
          oninput: () => {
            nameField.value = toFieldName(nameField.value);
            entry.name = nameField.value;
          },
        });
        return h(
          'div',
          { class: 'entry', 'data-layer': entry.layer },
          entry.thumb
            ? h('img', { class: 'thumb', src: entry.thumb, alt: '' })
            : h('div', { class: 'thumb placeholder', 'aria-hidden': 'true' }),
          h(
            'div',
            { class: 'entry-body' },
            h('div', { class: 'entry-summary', text: entry.summary }),
            h('label', { class: 'field' }, h('span', { text: 'Layer' }), select),
            h('label', { class: 'field' }, h('span', { text: 'Asset name' }), nameField),
          ),
          h(
            'button',
            {
              class: 'btn icon',
              type: 'button',
              'aria-label': `Remove ${entry.layer} layer`,
              onclick: () => {
                model.entries.splice(model.entries.indexOf(entry), 1);
                renderList();
                updateProcess();
              },
            },
            '✕',
          ),
        );
      });
    list.replaceChildren(...cards);
  }

  const drop = h(
    'div',
    { class: 'drop', id: 'drop' },
    h('p', { text: 'Drop images here, or' }),
    h(
      'button',
      { class: 'btn', id: 'add', type: 'button', onclick: () => fileInput.click() },
      'Add images',
    ),
    h('p', {
      class: 'hint',
      text: 'One layer at a time: a grid image (6 columns × 4 rows) or exactly 24 separate frames. Start with the body.',
    }),
  );
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    void addFiles([...(e.dataTransfer?.files ?? [])]);
  });

  root.replaceChildren(
    h('h2', { text: 'New character' }),
    h('p', { class: 'hint' }, 'Everything stays on your device. Images are never uploaded.'),
    noticeBox,
    h('label', { class: 'field wide' }, h('span', { text: 'Character name' }), nameInput),
    h('p', { id: 'name-hint', class: 'hint', text: 'Lowercase letters, digits and "-" only.' }),
    drop,
    fileInput,
    list,
    requirements,
    processBtn,
  );
  renderList();
  updateProcess();
}
