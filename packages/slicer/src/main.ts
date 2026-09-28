import { registerSW } from 'virtual:pwa-register';
import { SPEC_VERSION } from '@pokerpg/core';
import type { Prepared } from '@pokerpg/core';
import { buildCharacter } from './session.js';
import type { BuildProgress } from './session.js';
import { h } from './ui/dom.js';
import { mountReview } from './ui/review.js';
import type { ReviewHandle } from './ui/review.js';
import { mountSetup, newSetupModel, resolvedEntries } from './ui/setup.js';
import { describeError, finalName } from './util.js';
import './style.css';

registerSW({ immediate: true });

const model = newSetupModel();
let review: ReviewHandle | undefined;

const status = h('span', { class: 'status', id: 'net-status' });
const updateStatus = (): void => {
  status.textContent = navigator.onLine ? 'Online' : 'Offline — everything still works';
};
updateStatus();
window.addEventListener('online', updateStatus);
window.addEventListener('offline', updateStatus);

const main = h('main', { id: 'screen' });
const app = document.getElementById('app');
app?.replaceChildren(
  h('header', { class: 'app-head' }, h('h1', { text: 'PokeRPG Slicer' }), status),
  main,
  h('footer', {
    class: 'app-foot',
    text: `Asset format ${SPEC_VERSION} · images never leave this device`,
  }),
);

function showSetup(notice?: string): void {
  review?.dispose();
  review = undefined;
  main.dataset['screen'] = 'setup';
  mountSetup(main, model, () => void process(), notice);
}

function showReview(prepared: Prepared): void {
  main.dataset['screen'] = 'review';
  review = mountReview(main, prepared, () => showSetup());
}

async function process(): Promise<void> {
  const controller = new AbortController();
  const bar = h('progress', { max: 100, value: 0, id: 'progress' });
  const label = h('p', { id: 'busy-label', text: 'Starting…' });
  main.dataset['screen'] = 'busy';
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

showSetup();
