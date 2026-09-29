import {
  LAYER_IDS,
  formatFinding,
  importSheets,
  mergeSheets,
  parseLayerSheetName,
} from '@pokerpg/core';
import type { ImportInput, LayerId, Prepared } from '@pokerpg/core';
import { readSheetFile } from '../io/sheets.js';
import { describeError, finalName, formatBytes, toFieldName } from '../util.js';
import { h } from './dom.js';

export interface CheckModel {
  sheets: ImportInput[];
  /** Character name; blank means "from the zip folder or the body sheet". */
  characterName: string;
  /** Name found in a loaded zip. */
  zipName?: string;
}

export function newCheckModel(): CheckModel {
  return { sheets: [], characterName: '' };
}

/** The name that will be used: typed, else from the zip, else the body sheet's (decided by core). */
export function effectiveName(model: CheckModel): string | undefined {
  return finalName(model.characterName) || model.zipName || undefined;
}

/**
 * "Check existing sheets": load a `chr_<name>/` zip and/or loose 768 × 512 sheets (add more layers
 * any time), see what is wrong in plain words, then open the review.
 */
export function mountCheck(
  root: HTMLElement,
  model: CheckModel,
  onReview: (prepared: Prepared) => void,
  notice?: string,
): void {
  const noticeBox = h('p', { class: 'notice error', role: 'alert', id: 'notice' });
  const infoBox = h('p', { class: 'notice info', role: 'status', id: 'info' });
  const setNotice = (msg?: string): void => {
    noticeBox.textContent = msg ?? '';
    noticeBox.hidden = !msg;
  };
  const setInfo = (msg?: string): void => {
    infoBox.textContent = msg ?? '';
    infoBox.hidden = !msg;
  };
  setNotice(notice);
  setInfo();

  const fileInput = h('input', {
    id: 'sheet-input',
    type: 'file',
    accept: '.zip,application/zip,image/*',
    multiple: true,
    hidden: true,
    onchange: () => {
      enqueue([...(fileInput.files ?? [])]);
      fileInput.value = '';
    },
  });

  const nameInput = h('input', {
    id: 'check-name',
    type: 'text',
    autocomplete: 'off',
    autocapitalize: 'none',
    spellcheck: false,
    placeholder: 'dallo zip o dal foglio body',
    value: model.characterName,
    oninput: () => {
      nameInput.value = toFieldName(nameInput.value);
      model.characterName = nameInput.value;
      refresh();
    },
  });

  const list = h('div', { id: 'sheets', class: 'entries' });
  const problems = h('ul', { id: 'problems', class: 'requirements' });
  const reviewBtn = h(
    'button',
    { id: 'review', class: 'btn primary', type: 'button', disabled: true },
    'Rivedi',
  );
  reviewBtn.addEventListener('click', () => {
    const r = importSheets(model.sheets, characterOptions());
    if (r.ok) onReview(r.prepared);
  });

  const characterOptions = (): { characterName?: string } => {
    const name = effectiveName(model);
    return name ? { characterName: name } : {};
  };

  // Selections are handled one after another: reading a zip is slower than reading a PNG, and a
  // later, faster selection must not be applied before an earlier one has finished.
  let queue: Promise<void> = Promise.resolve();
  function enqueue(files: File[]): void {
    queue = queue.then(() => addFiles(files)).catch((e: unknown) => setNotice(describeError(e)));
  }

  async function addFiles(files: File[]): Promise<void> {
    if (files.length === 0) return;
    setNotice();
    setInfo();
    const infos: string[] = [];
    const errors: string[] = [];
    for (const file of files) {
      const read = await readSheetFile(file);
      errors.push(...read.errors);
      if (read.sheets.length === 0) continue;
      if (/\.zip$/i.test(file.name) || file.type === 'application/zip') {
        // A character package replaces what is loaded.
        model.sheets = read.sheets;
        if (read.name) model.zipName = read.name;
        else delete model.zipName;
        infos.push(
          `Caricato ${read.name ? `chr_${read.name}` : file.name}: ${read.sheets.length} ${read.sheets.length === 1 ? 'foglio' : 'fogli'}.`,
        );
      } else {
        const merged = mergeSheets(model.sheets, read.sheets);
        model.sheets = merged.sheets;
        if (merged.replaced.length) infos.push(`Sostituiti: ${merged.replaced.join(', ')}.`);
      }
    }
    setNotice(errors.join(' '));
    setInfo(infos.join(' '));
    refresh();
  }

  /** Sheets whose name is not a §4 name can be given a layer and asset name here. */
  function renameControls(sheet: ImportInput): Node | null {
    if (parseLayerSheetName(sheet.filename)) return null;
    let layer: LayerId =
      LAYER_IDS.find(
        (l) => !model.sheets.some((s) => parseLayerSheetName(s.filename)?.layer === l),
      ) ?? 'body';
    let asset = finalName(model.characterName) || 'sheet';
    const apply = (): void => {
      sheet.filename = `spr_walk_${layer}_${asset}.png`;
      refresh();
    };
    const select = h(
      'select',
      {
        class: 'layer-select',
        'aria-label': `Livello per ${sheet.filename}`,
        onchange: () => (layer = select.value as LayerId),
      },
      ...LAYER_IDS.map((l) => {
        const o = h('option', { value: l, text: l });
        o.selected = l === layer;
        return o;
      }),
    );
    const name = h('input', {
      class: 'asset-name',
      type: 'text',
      autocapitalize: 'none',
      spellcheck: false,
      'aria-label': `Nome asset per ${sheet.filename}`,
      value: asset,
      oninput: () => {
        name.value = toFieldName(name.value);
        asset = finalName(name.value) || 'sheet';
      },
    });
    return h(
      'div',
      { class: 'rename' },
      h('span', {
        class: 'hint',
        text: "Questo nome non è spr_<set>_<layer>_<nome>.png. Dimmi cos'è:",
      }),
      h('label', { class: 'field' }, h('span', { text: 'Livello' }), select),
      h('label', { class: 'field' }, h('span', { text: 'Nome asset' }), name),
      h('button', { class: 'btn', type: 'button', onclick: apply }, 'Rinomina'),
    );
  }

  function refresh(): void {
    list.replaceChildren(
      ...model.sheets.map((sheet) =>
        h(
          'div',
          { class: 'entry sheet', 'data-file': sheet.filename },
          h(
            'div',
            { class: 'entry-body' },
            h('div', { class: 'entry-summary', text: sheet.filename }),
            h('div', {
              class: 'hint',
              text: `${sheet.image.width}×${sheet.image.height}${sheet.bytes ? ` · ${formatBytes(sheet.bytes.length)}` : ''}`,
            }),
            renameControls(sheet),
          ),
          h(
            'button',
            {
              class: 'btn icon',
              type: 'button',
              'aria-label': `Rimuovi ${sheet.filename}`,
              onclick: () => {
                model.sheets.splice(model.sheets.indexOf(sheet), 1);
                refresh();
              },
            },
            '✕',
          ),
        ),
      ),
    );
    if (model.sheets.length === 0) {
      problems.replaceChildren(
        h('li', { text: 'Aggiungi uno zip chr_<nome>, o fogli già a 768 × 512.' }),
      );
      reviewBtn.disabled = true;
      return;
    }
    const result = importSheets(model.sheets, characterOptions());
    reviewBtn.disabled = !result.ok;
    problems.replaceChildren(
      ...(result.ok
        ? []
        : result.report.findings.map((f) =>
            h('li', { class: 'finding error', text: formatFinding(f) }),
          )),
    );
  }

  const drop = h(
    'div',
    { class: 'drop', id: 'drop' },
    h('p', { text: 'Rilascia qui uno zip chr_<nome> o dei fogli, oppure' }),
    h(
      'button',
      { class: 'btn', id: 'add-sheets', type: 'button', onclick: () => fileInput.click() },
      'Aggiungi file',
    ),
    h('p', {
      class: 'hint',
      text: 'I fogli devono già essere 768 × 512 (non vengono mai ridimensionati). Aggiungere un foglio per un livello che hai già lo sostituisce.',
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
    enqueue([...(e.dataTransfer?.files ?? [])]);
  });

  root.replaceChildren(
    h('h2', { text: 'Controlla fogli esistenti' }),
    h('p', {
      class: 'hint',
      text: 'Tutto resta sul tuo dispositivo. Niente viene ridimensionato o riallineato a meno che tu non lo sposti.',
    }),
    noticeBox,
    infoBox,
    h('label', { class: 'field wide' }, h('span', { text: 'Nome del personaggio' }), nameInput),
    drop,
    fileInput,
    list,
    problems,
    reviewBtn,
  );
  refresh();
}
