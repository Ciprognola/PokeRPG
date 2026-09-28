import { registerSW } from 'virtual:pwa-register';
import { FRAME, SPEC_VERSION, getAnimSet, sheetSize } from '@pokerpg/core';
import { PIPELINE } from './pipeline.js';
import './style.css';

registerSW({ immediate: true });

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className !== undefined) node.className = className;
  return node;
}

function render(root: HTMLElement): void {
  const walk = getAnimSet('walk');
  const size = walk ? sheetSize(walk) : undefined;

  const header = el('header');
  header.append(el('h1', 'PokeRPG Slicer'));
  const status = el('p', '', 'status');
  const updateStatus = (): void => {
    status.textContent = navigator.onLine ? 'Online' : 'Offline (everything still works)';
  };
  updateStatus();
  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  header.append(status);

  const intro = el('section');
  intro.append(
    el(
      'p',
      `Asset Spec v${SPEC_VERSION}: ${FRAME.width}×${FRAME.height} frames, anchor (${FRAME.anchor.x}, ${FRAME.anchor.y})` +
        (size ? `, walk sheet ${size.width}×${size.height}.` : '.'),
    ),
    el('p', 'Images never leave your device. The processing pipeline arrives with milestone M1.'),
  );

  const stages = el('section');
  stages.append(el('h2', 'Pipeline'));
  const list = el('ol');
  for (const stage of PIPELINE) {
    list.append(el('li', `${stage.title} (${stage.spec})`));
  }
  stages.append(list);

  root.replaceChildren(header, intro, stages);
}

const root = document.getElementById('app');
if (root) render(root);
