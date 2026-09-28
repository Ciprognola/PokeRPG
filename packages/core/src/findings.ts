/**
 * Validation output shared by the Slicer and the in-game importer.
 * Every message must name the file, the frame key and the pixel, e.g.
 * `spr_walk_body_mira.png · walk_up_04 · lowest opaque row 116 (expected 119)`
 * (docs/ASSET_SPEC.md §7).
 */
export type Severity = 'error' | 'warning';

export interface Finding {
  severity: Severity;
  /** Stable machine id of the check, e.g. `ground-line`. */
  check: string;
  file: string;
  /** Frame key such as `walk_up_04`; absent for whole-file checks. */
  frameKey?: string;
  /** Offending pixel position inside the frame, when applicable. */
  pixel?: { x: number; y: number };
  message: string;
}

export interface Report {
  specVersion: string;
  findings: Finding[];
  ok: boolean;
}

export function formatFinding(f: Finding): string {
  return [f.file, f.frameKey, f.message].filter((p) => p !== undefined).join(' · ');
}

export function makeReport(specVersion: string, findings: Finding[]): Report {
  return { specVersion, findings, ok: !findings.some((f) => f.severity === 'error') };
}
