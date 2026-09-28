/**
 * Validation output shared by the Slicer and the in-game importer.
 * Every message names the file, the frame key and the pixel, e.g.
 * `spr_walk_body_mira.png · walk_up_04 · lowest opaque row 116 (expected 119)`
 * (docs/ASSET_SPEC.md §7). The report shape is documented in docs-dev/report-format.md.
 */
export type Severity = 'error' | 'warning';

export interface Finding {
  severity: Severity;
  /** Stable machine id of the check, e.g. `ground-line`. */
  check: string;
  /** Sheet the finding is about; absent for character-level findings (e.g. a missing body). */
  file?: string;
  /** Frame key such as `walk_up_04`; absent for whole-file findings. */
  frameKey?: string;
  /** Offending pixel, frame-local (0–127), when a specific pixel applies. */
  pixel?: { x: number; y: number };
  message: string;
}

export interface SheetSummary {
  file: string;
  set?: string;
  layer?: string;
  name?: string;
  variant?: string;
  width: number;
  height: number;
  /** Encoded file size, when the bytes were provided. */
  bytes?: number;
}

export interface Report {
  reportVersion: 1;
  /** Asset *format* version (docs/ASSET_SPEC.md §7.1), not the document version. */
  specVersion: string;
  /** True when there are no errors (warnings are allowed). */
  ok: boolean;
  summary: { errors: number; warnings: number };
  sheets: SheetSummary[];
  findings: Finding[];
}

export function formatFinding(f: Finding): string {
  return [f.file, f.frameKey, f.message].filter((p) => p !== undefined).join(' · ');
}

export function makeReport(
  specVersion: string,
  findings: Finding[],
  sheets: SheetSummary[] = [],
): Report {
  const errors = findings.filter((f) => f.severity === 'error').length;
  return {
    reportVersion: 1,
    specVersion,
    ok: errors === 0,
    summary: { errors, warnings: findings.length - errors },
    sheets,
    findings,
  };
}
