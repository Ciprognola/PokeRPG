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
  status.textContent = navigator.onLine ? 'Online' : 'Offline — everything still works';
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
    text: `Asset format ${SPEC_VERSION} · images never leave this device`,
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
    h('h2', { text: 'What do you want to do?' }),
    h(
      'div',
      { class: 'modes' },
      h(
        'button',
        { class: 'mode', id: 'mode-slice', type: 'button', onclick: () => showSetup() },
        h('strong', { text: 'Slice raw images' }),
        h('span', {
          text: 'Turn AI-generated frames (a grid or 24 separate images) into a spec-compliant character package.',
        }),
      ),
      h(
        'button',
        { class: 'mode', id: 'mode-check', type: 'button', onclick: () => showCheck() },
        h('strong', { text: 'Check existing sheets' }),
        h('span', {
          text: 'Load a chr_<name> zip or 768 × 512 sheets (for example layers repainted by an AI), check them, fix them, add a layer.',
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
        h('strong', { text: 'Download pose templates' }),
        h('span', {
          text: 'Grey-mannequin references for your image AI: one grid image and the 24 single poses. Works offline.',
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
        backLabel: 'Back to files',
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
  review = mountReview(main, prepared, { backLabel: 'Start over', onBack: () => showSetup() });
}

async function process(): Promise<void> {
  const controller = new AbortController();
  const bar = h('progress', { max: 100, value: 0, id: 'progress' });
  const label = h('p', { id: 'busy-label', text: 'Starting…' });
  main.dataset['screen'] = 'busy';
  homeBtn.hidden = true;
  main.replaceChildren(
    h('h2', { text: 'Processing' }),
    label,
    bar,
    h('p', {
      class: 'hint',
      text: 'Cutting out the characters, scaling and aligning. This can take a few seconds.',
    }),
    h(
      'button',
      { class: 'btn', id: 'cancel', type: 'button', onclick: () => controller.abort() },
      'Cancel',
    ),
  );
  const onProgress = (p: BuildProgress): void => {
    label.textContent = `${p.layer} layer (${p.layerIndex + 1} of ${p.layerCount}) · frame ${p.done} of ${p.total}`;
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
