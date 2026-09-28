import { describe, expect, it } from 'vitest';
import { formatFinding, makeReport } from '../src/index.js';
import type { Finding } from '../src/index.js';

const error: Finding = {
  severity: 'error',
  check: 'ground-line',
  file: 'spr_walk_body_mira.png',
  frameKey: 'walk_up_04',
  message: 'lowest opaque row 116 (expected 119)',
};

describe('findings', () => {
  it('formats as file · frame key · message (Asset Spec §7)', () => {
    expect(formatFinding(error)).toBe(
      'spr_walk_body_mira.png · walk_up_04 · lowest opaque row 116 (expected 119)',
    );
  });

  it('omits the frame key for whole-file findings', () => {
    const { frameKey: _omit, ...whole } = error;
    expect(formatFinding(whole)).toBe(
      'spr_walk_body_mira.png · lowest opaque row 116 (expected 119)',
    );
  });

  it('a report is ok only without errors', () => {
    expect(makeReport('0.1', []).ok).toBe(true);
    expect(makeReport('0.1', [{ ...error, severity: 'warning' }]).ok).toBe(true);
    expect(makeReport('0.1', [error]).ok).toBe(false);
  });
});

describe('report shape', () => {
  it('carries version, summary and sheet list', () => {
    const report = makeReport(
      '0.1',
      [error, { ...error, severity: 'warning' }],
      [{ file: 'a.png', width: 768, height: 512 }],
    );
    expect(report).toMatchObject({
      reportVersion: 1,
      specVersion: '0.1',
      ok: false,
      summary: { errors: 1, warnings: 1 },
      sheets: [{ file: 'a.png', width: 768, height: 512 }],
    });
  });
});
