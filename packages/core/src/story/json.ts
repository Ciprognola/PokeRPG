/**
 * A small strict JSON parser that remembers where every value is, so story messages can name the
 * line (docs/STORY_SCHEMA.md §11: `story.json:84 · quests[0].tasks[2].npc · unknown NPC "rossa"`).
 * Paths look like `quests[0].tasks[2].npc`; the root is the empty string.
 */

export interface Position {
  line: number;
  col: number;
}

export interface JsonParseError {
  message: string;
  line: number;
  col: number;
}

export interface JsonDuplicate {
  /** Path of the repeated key, e.g. `scenes.harbour-intro`. */
  path: string;
  line: number;
}

export type JsonParse =
  | { ok: true; value: unknown; lines: Map<string, Position>; duplicates: JsonDuplicate[] }
  | { ok: false; error: JsonParseError };

class Fail extends Error {
  constructor(
    message: string,
    readonly line: number,
    readonly col: number,
  ) {
    super(message);
  }
}

/** `quests[0].tasks` style path from a JSON pointer such as `/quests/0/tasks`. */
export function pointerToPath(pointer: string): string {
  let out = '';
  for (const raw of pointer.split('/').slice(1)) {
    const seg = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (/^\d+$/.test(seg)) out += `[${seg}]`;
    else out += out === '' ? seg : `.${seg}`;
  }
  return out;
}

export function joinPath(base: string, key: string | number): string {
  if (typeof key === 'number') return `${base}[${key}]`;
  return base === '' ? key : `${base}.${key}`;
}

export function parseJsonWithLines(text: string): JsonParse {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  let i = 0;
  let line = 1;
  let lineStart = 0;
  const lines = new Map<string, Position>();
  const duplicates: JsonDuplicate[] = [];

  const pos = (): Position => ({ line, col: i - lineStart + 1 });
  const fail = (message: string): never => {
    const p = pos();
    throw new Fail(message, p.line, p.col);
  };
  const skip = (): void => {
    while (i < src.length) {
      const c = src[i]!;
      if (c === '\n') {
        line++;
        lineStart = i + 1;
        i++;
      } else if (c === ' ' || c === '\t' || c === '\r') i++;
      else break;
    }
  };
  const describe = (): string => (i >= src.length ? 'la fine del file' : `"${src[i]}"`);

  function parseString(): string {
    if (src[i] !== '"') fail(`attesa una stringa, trovato ${describe()}`);
    i++;
    let out = '';
    for (;;) {
      if (i >= src.length) fail('stringa non terminata');
      const c = src[i]!;
      if (c === '"') {
        i++;
        return out;
      }
      if (c === '\n') fail('una stringa non può contenere un a capo');
      if (c === '\\') {
        const n = src[i + 1];
        const simple: Record<string, string> = {
          '"': '"',
          '\\': '\\',
          '/': '/',
          b: '\b',
          f: '\f',
          n: '\n',
          r: '\r',
          t: '\t',
        };
        if (n === 'u') {
          const hex = src.slice(i + 2, i + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail('sequenza \\u non valida');
          out += String.fromCharCode(parseInt(hex, 16));
          i += 6;
        } else if (n !== undefined && n in simple) {
          out += simple[n];
          i += 2;
        } else fail('sequenza di escape non valida nella stringa');
      } else {
        out += c;
        i++;
      }
    }
  }

  function parseValue(path: string, at: Position): unknown {
    lines.set(path, at);
    skip();
    const c = src[i];
    if (c === '{') return parseObject(path);
    if (c === '[') return parseArray(path);
    if (c === '"') return parseString();
    if (src.startsWith('true', i)) {
      i += 4;
      return true;
    }
    if (src.startsWith('false', i)) {
      i += 5;
      return false;
    }
    if (src.startsWith('null', i)) {
      i += 4;
      return null;
    }
    const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(src.slice(i, i + 40));
    if (m) {
      i += m[0].length;
      return Number(m[0]);
    }
    return fail(`imprevisto ${describe()}`);
  }

  function parseObject(path: string): Record<string, unknown> {
    i++; // {
    const obj: Record<string, unknown> = {};
    skip();
    if (src[i] === '}') {
      i++;
      return obj;
    }
    for (;;) {
      skip();
      const keyPos = pos();
      const key = parseString();
      skip();
      if (src[i] !== ':') fail(`atteso ":" dopo "${key}", trovato ${describe()}`);
      i++;
      const childPath = joinPath(path, key);
      if (Object.prototype.hasOwnProperty.call(obj, key))
        duplicates.push({ path: childPath, line: keyPos.line });
      skip();
      obj[key] = parseValue(childPath, keyPos);
      skip();
      if (src[i] === ',') {
        i++;
        continue;
      }
      if (src[i] === '}') {
        i++;
        return obj;
      }
      fail(`atteso "," o "}", trovato ${describe()}`);
    }
  }

  function parseArray(path: string): unknown[] {
    i++; // [
    const arr: unknown[] = [];
    skip();
    if (src[i] === ']') {
      i++;
      return arr;
    }
    for (;;) {
      skip();
      arr.push(parseValue(joinPath(path, arr.length), pos()));
      skip();
      if (src[i] === ',') {
        i++;
        continue;
      }
      if (src[i] === ']') {
        i++;
        return arr;
      }
      fail(`atteso "," o "]", trovato ${describe()}`);
    }
  }

  try {
    skip();
    const value = parseValue('', pos());
    skip();
    if (i < src.length) fail(`imprevisto ${describe()} dopo la fine del JSON`);
    return { ok: true, value, lines, duplicates };
  } catch (e) {
    if (e instanceof Fail)
      return { ok: false, error: { message: e.message, line: e.line, col: e.col } };
    throw e;
  }
}
