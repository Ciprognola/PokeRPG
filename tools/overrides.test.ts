import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OVERRIDES_DIR, resolveOverride } from './overrides.js';

// Fixtures stand in for "the original asset tree" and "a builder's overrides/ folder"
// (Project Brief §2, §7). Neither is a real UI/font/sound asset: none exist yet (PKR-014
// is infrastructure only), so the resolver is proven with synthetic files instead.
let work = '';
let originals = '';
let overrides = '';

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), 'pkr-overrides-'));
  originals = join(work, 'assets');
  overrides = join(work, OVERRIDES_DIR);
  mkdirSync(originals, { recursive: true });
  mkdirSync(overrides, { recursive: true });
});
afterEach(() => rmSync(work, { recursive: true, force: true }));

describe('resolveOverride', () => {
  it('uses the original when no override folder exists at all', () => {
    const noOverrides = join(work, 'no-such-folder');
    writeFileSync(join(originals, 'ui_font.png'), 'original');
    const r = resolveOverride('ui_font.png', originals, noOverrides);
    expect(r).toEqual({ path: join(originals, 'ui_font.png'), overridden: false });
  });

  it('uses the original when the override folder exists but lacks this file', () => {
    writeFileSync(join(originals, 'menu_click.wav'), 'original');
    const r = resolveOverride('menu_click.wav', originals, overrides);
    expect(r).toEqual({ path: join(originals, 'menu_click.wav'), overridden: false });
  });

  it('uses the override when a same-named file is present under overrides/', () => {
    writeFileSync(join(originals, 'menu_click.wav'), 'original');
    writeFileSync(join(overrides, 'menu_click.wav'), 'builder-own');
    const r = resolveOverride('menu_click.wav', originals, overrides);
    expect(r).toEqual({ path: join(overrides, 'menu_click.wav'), overridden: true });
  });

  it('resolves a nested relative path under both roots', () => {
    mkdirSync(join(originals, 'ui'), { recursive: true });
    mkdirSync(join(overrides, 'ui'), { recursive: true });
    writeFileSync(join(originals, 'ui', 'box.png'), 'original');
    writeFileSync(join(overrides, 'ui', 'box.png'), 'builder-own');
    const r = resolveOverride('ui/box.png', originals, overrides);
    expect(r).toEqual({ path: join(overrides, 'ui', 'box.png'), overridden: true });
  });

  it('never reaches outside its root via a climbing relative path', () => {
    expect(() => resolveOverride('../secrets.env', originals, overrides)).toThrow(/escapes/);
    expect(() => resolveOverride('ui/../../secrets.env', originals, overrides)).toThrow(/escapes/);
  });

  it('defaults the overrides root to OVERRIDES_DIR when none is given', () => {
    // A name unlikely to collide with a developer's own real, local overrides/ folder.
    const name = 'pkr-overrides-default-test-fixture.png';
    writeFileSync(join(originals, name), 'original');
    const r = resolveOverride(name, originals);
    expect(r).toEqual({ path: join(originals, name), overridden: false });
  });
});
