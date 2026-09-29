import { AssembleError, ExtractionError } from '@pokerpg/core';
import { ImageDecodeError } from './io/decode.js';

/** Turn what a person typed into a valid name field: lowercase `[a-z0-9-]` (Asset Spec §1, §4). */
export function toFieldName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '');
}

/** Same, and without a trailing dash: the value to actually use. */
export const finalName = (input: string): string => toFieldName(input).replace(/-+$/, '');

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** A message a person can act on, whatever went wrong. */
export function describeError(e: unknown): string {
  if (e instanceof ExtractionError || e instanceof AssembleError || e instanceof ImageDecodeError) {
    return e.message;
  }
  if (e instanceof DOMException && e.name === 'AbortError') return 'Annullato.';
  if (e instanceof Error) return `Qualcosa è andato storto: ${e.message}`;
  return 'Qualcosa è andato storto.';
}
