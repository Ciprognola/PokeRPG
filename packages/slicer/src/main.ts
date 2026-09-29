import { registerSW } from 'virtual:pwa-register';
import { SPEC_VERSION } from '@pokerpg/core';
import type { Prepared } from '@pokerpg/core';
import { buildCharacter } from './session.js';
import type { BuildProgress } from './session.js';
import { mountCheck, newCheckModel } from './ui/check.js';
import { h } from './ui/dom.js';
import { mountReview } from './ui/review.js';
import type { ReviewHandle } from './ui/review.js';
import { mountSetup, newSetupModel, resolvedEntries } from './ui/setup.js';
import { describeError, finalName } from './util.js';
import './style.css';

registerSW({ immediate: true });

const model = newSetupModel();
const checkModel = newCheckModel();
let review: ReviewHandle | undefined;

const status = h('span', { class: 'status', id: 'net-status' });
const updateStatus = (): void => {
  status.textContent = navigator.onLine ? 'Online' : 'Offline — funziona comunque tutto';
};
updateStatus();
window.addEventListener('online', updateStatus);
window.addEventListener('offline', updateStatus);

const homeBtn = h(
  'button',
  { class: 'btn small', id: 'home', type: 'button', onclick: () => showHome() },
  'Home',
);
const main = h('main', { id: 'screen' });
const app = document.getElementById('app');
app?.replaceChildren(
  h('header', { class: 'app-head' }, h('h1', { text: 'PokeRPG Slicer' }), homeBtn, status),
  main,
  h('footer', {
    class: 'app-foot',
    text: `Formato asset ${SPEC_VERSION} · le immagini non lasciano mai questo dispositivo`,
  }),
);

function leave(): void {
  review?.dispose();
  review = undefined;
}

function showHome(): void {
  leave();
  main.dataset['screen'] = 'home';
  homeBtn.hidden = true;
  main.replaceChildren(
    h('h2', { text: 'Cosa vuoi fare?' }),
    h(
      'div',
      { class: 'modes' },
      h(
        'button',
        { class: 'mode', id: 'mode-slice', type: 'button', onclick: () => showSetup() },
        h('strong', { text: 'Ritaglia le immagini' }),
        h('span', {
          text: "Trasforma i fotogrammi generati dall'IA (una griglia o 24 immagini separate) in un pacchetto personaggio conforme alle specifiche.",
        }),
      ),
      h(
        'button',
        { class: 'mode', id: 'mode-check', type: 'button', onclick: () => showCheck() },
        h('strong', { text: 'Controlla fogli esistenti' }),
        h('span', {
          text: "Carica uno zip chr_<nome> o fogli 768 × 512 (per esempio livelli ridipinti da un'IA), controllali, correggili, aggiungi un livello.",
        }),
      ),
      h(
        'a',
        {
          class: 'mode',
          id: 'download-templates',
          href: `${import.meta.env.BASE_URL}downloads/pokerpg-pose-templates.zip`,
          download: 'pokerpg-pose-templates.zip',
        },
        h('strong', { text: 'Scarica i modelli di posa' }),
        h('span', {
          text: "Riferimenti a manichino grigio per la tua IA di immagini: un'immagine griglia e le 24 pose singole. Funziona offline.",
        }),
      ),
    ),
  );
}

function showSetup(notice?: string): void {
  leave();
  main.dataset['screen'] = 'setup';
  homeBtn.hidden = false;
  mountSetup(main, model, () => void process(), notice);
}

function showCheck(notice?: string): void {
  leave();
  main.dataset['screen'] = 'check';
  homeBtn.hidden = false;
  mountCheck(
    main,
    checkModel,
    (prepared) => {
      main.dataset['screen'] = 'review';
      homeBtn.hidden = true;
      review = mountReview(main, prepared, {
        backLabel: 'Torna ai file',
        onBack: (edited) => {
          // keep the edits (nudges) as the new sheets, so more layers can be added on top
          checkModel.sheets = edited.sheets.map((s) => ({ filename: s.filename, image: s.image }));
          showCheck();
        },
      });
    },
    notice,
  );
}

function showReview(prepared: Prepared): void {
  main.dataset['screen'] = 'review';
  homeBtn.hidden = true;
  review = mountReview(main, prepared, { backLabel: 'Ricomincia', onBack: () => showSetup() });
}

async function process(): Promise<void> {
  const controller = new AbortController();
  const bar = h('progress', { max: 100, value: 0, id: 'progress' });
  const label = h('p', { id: 'busy-label', text: 'Avvio…' });
  main.dataset['screen'] = 'busy';
  homeBtn.hidden = true;
  main.replaceChildren(
    h('h2', { text: 'Elaborazione' }),
    label,
    bar,
    h('p', {
      class: 'hint',
      text: 'Ritaglio dei personaggi, ridimensionamento e allineamento in corso. Può richiedere qualche secondo.',
    }),
    h(
      'button',
      { class: 'btn', id: 'cancel', type: 'button', onclick: () => controller.abort() },
      'Annulla',
    ),
  );
  const onProgress = (p: BuildProgress): void => {
    label.textContent = `livello ${p.layer} (${p.layerIndex + 1} di ${p.layerCount}) · fotogramma ${p.done} di ${p.total}`;
    bar.value = ((p.layerIndex + p.done / p.total) / p.layerCount) * 100;
  };
  try {
    const prepared = await buildCharacter(
      finalName(model.characterName),
      resolvedEntries(model),
      onProgress,
      controller.signal,
    );
    showReview(prepared);
  } catch (e) {
    showSetup(describeError(e));
  }
}

showHome();
