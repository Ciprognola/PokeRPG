import { describe, expect, it } from 'vitest';
import { joinPath, parseJsonWithLines, pointerToPath } from '../src/index.js';

describe('JSON with line numbers', () => {
  const text = `{
  "a": 1,
  "list": [
    { "x": true },
    "two"
  ],
  "nested": { "deep": null }
}`;

  it('records the line of every value by path', () => {
    const r = parseJsonWithLines(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toEqual({ a: 1, list: [{ x: true }, 'two'], nested: { deep: null } });
    const line = (p: string): number | undefined => r.lines.get(p)?.line;
    expect(line('')).toBe(1);
    expect(line('a')).toBe(2);
    expect(line('list')).toBe(3);
    expect(line('list[0]')).toBe(4);
    expect(line('list[0].x')).toBe(4);
    expect(line('list[1]')).toBe(5);
    expect(line('nested.deep')).toBe(7);
  });

  it('parses every JSON value type and escape', () => {
    const r = parseJsonWithLines(
      '{"s":"a\\n\\u00e9\\"","n":-1.5e2,"t":true,"f":false,"z":null,"e":[],"o":{}}',
    );
    expect(r.ok && r.value).toEqual({
      s: 'a\né"',
      n: -150,
      t: true,
      f: false,
      z: null,
      e: [],
      o: {},
    });
  });

  it('reports a syntax error with line and column', () => {
    const r = parseJsonWithLines('{\n  "a": 1\n  "b": 2\n}');
    expect(r).toMatchObject({ ok: false, error: { line: 3, col: 3 } });
    if (!r.ok) expect(r.error.message).toContain('atteso "," o "}"');
  });

  it.each([
    ['{"a":}', 'imprevisto "}"'],
    ['[1,2', 'la fine del file'],
    ['{"a" 1}', 'atteso ":"'],
    ['"abc', 'stringa non terminata'],
    ['{} x', 'dopo la fine del JSON'],
    ['', 'la fine del file'],
  ])('rejects %j', (bad, part) => {
    const r = parseJsonWithLines(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain(part);
  });

  it('finds duplicate keys', () => {
    const r = parseJsonWithLines('{\n "s": {\n  "a": 1,\n  "a": 2\n }\n}');
    expect(r.ok && r.duplicates).toEqual([{ path: 's.a', line: 4 }]);
  });

  it('ignores a byte order mark', () => {
    expect(parseJsonWithLines('﻿{"a":1}').ok).toBe(true);
  });

  it('converts JSON pointers to paths', () => {
    expect(pointerToPath('/quests/0/tasks/2/npc')).toBe('quests[0].tasks[2].npc');
    expect(pointerToPath('')).toBe('');
    expect(pointerToPath('/a~1b/0')).toBe('a/b[0]');
    expect(joinPath('a', 'b')).toBe('a.b');
    expect(joinPath('', 'b')).toBe('b');
    expect(joinPath('a', 3)).toBe('a[3]');
  });
});
