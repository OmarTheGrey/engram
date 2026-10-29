// The Python semantics the GateMem port depends on (findings R6-1 and R6-12).
// Upstream parses a model's JSON with json.loads, flattens it with json.dumps
// and str(), strips with str.strip and matches patterns with `re`; where
// JavaScript's built-ins differ, a prediction would score differently. This
// module reproduces CPython 3 for the inputs a model can produce:
//
// - parsePyJson: json.loads, keeping what JSON.parse loses: whether a number
//   is an int or a float (2.0 stays a float), integers beyond 2^53, key order
//   with integer-like keys, and NaN, Infinity and -Infinity, which Python
//   accepts.
// - pyDumps: json.dumps(v, ensure_ascii=False, sort_keys=True); pyRepr and
//   pyStr: repr() and str(), with Python's float repr and string quoting, and
//   tuples (PyTuple), which literal.ts's ast.literal_eval port produces.
// - pyStrip, pyNormalizeWs: str.strip and re.sub(r"\s+", " ", s), on Python's
//   whitespace set (str.isspace).
// - pyRegex: a Python `re` pattern as an equivalent JavaScript RegExp (flag
//   u): \w, \d, \s and \b as Python's Unicode classes, $ also before a final
//   newline, . excluding only \n, (?P<name>) groups, \A and \Z, scoped i and
//   s flags, Python's literal braces, escapes and set syntax. A construct with
//   no JavaScript equivalent (atomic groups, possessive quantifiers, verbose
//   or multiline flags, \N{...}) throws UntranslatablePattern rather than
//   matching differently; a pattern Python itself rejects throws SyntaxError,
//   as re.error.
// - Case-insensitive matching (round 2, R6-12) is not JavaScript's i flag,
//   which compares case folds: Python compares the simple lowercase of the
//   text's character with the pattern's, plus the equivalences listed in
//   CPython's re/_casefix.py (i and dotless i, s and long s, the Greek symbol
//   forms). So `(?i)istanbul` matches "İstanbul" in Python and not under the
//   i flag. pyRegex therefore never sets the i flag: it expands every cased
//   literal and set into the characters Python would accept. Back references
//   under IGNORECASE, and set ranges beyond the BMP under it, which CPython
//   matches by other rules, throw UntranslatablePattern.
//
// Known limits: the Unicode tables differ by version. Node 24 has Unicode 17,
// CPython 3.14 Unicode 16; they agree on lowercase and casedness for every
// code point but the 28 pairs Unicode 17 added (U+A7CE to U+A7D5, U+16EA0 to
// U+16ED3), checked over every code point against CPython's own
// _sre.unicode_tolower and unicode_iscased. Python's \w equals [\p{L}\p{N}_]
// and \d equals \p{Nd} on Unicode 16 (checked the same way).

/** Python's whitespace (str.isspace), as the body of a character class. */
export const PY_SPACE =
  "\\t\\n\\v\\f\\r\\x1c-\\x20\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
/** Python's \w for str patterns, as the body of a character class (flag u). */
export const PY_WORD = "\\p{L}\\p{N}_";

const LEADING_SPACE = new RegExp(`^[${PY_SPACE}]+`, "u");
const TRAILING_SPACE = new RegExp(`[${PY_SPACE}]+$`, "u");
const SPACE_RUN = new RegExp(`[${PY_SPACE}]+`, "gu");

/** str.strip() */
export const pyStrip = (s: string) => s.replace(LEADING_SPACE, "").replace(TRAILING_SPACE, "");

/** re.sub(r"\s+", " ", s).strip() */
export const pyNormalizeWs = (s: string) => pyStrip(s.replace(SPACE_RUN, " "));

/** A JSON number Python parsed as an int; `digits` is its exact decimal form. */
export class PyInt {
  readonly digits: string;
  constructor(digits: string) {
    this.digits = digits;
  }
  toJSON(): number {
    return Number(this.digits);
  }
}

/** A JSON number Python parsed as a float. */
export class PyFloat {
  readonly value: number;
  constructor(value: number) {
    this.value = value;
  }
  toJSON(): number | null {
    return Number.isFinite(this.value) ? this.value : null;
  }
}

/** A Python tuple: repr() prints it in parentheses, json.dumps as a list, and it is not a list. */
export class PyTuple {
  readonly items: readonly unknown[];
  constructor(items: readonly unknown[]) {
    this.items = items;
  }
}

/** The key order Python's dict keeps, for objects parsePyJson builds. */
const ORDER = Symbol("python dict order");
type PyDict = Record<string, unknown> & { [ORDER]?: string[] };

const keysOf = (o: PyDict): string[] => o[ORDER] ?? Object.keys(o);

/**
 * A dict built from key-value pairs as Python builds one: a repeated key
 * keeps its first position and takes its last value, and any key, even
 * `__proto__`, is an own property.
 */
export function pyDict(entries: Iterable<readonly [string, unknown]>): Record<string, unknown> {
  const obj: PyDict = {};
  const order: string[] = [];
  for (const [key, v] of entries) {
    if (!Object.hasOwn(obj, key)) order.push(key);
    Object.defineProperty(obj, key, {
      value: v,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  Object.defineProperty(obj, ORDER, { value: order, enumerable: false });
  return obj;
}

/** A plain object or one parsePyJson built: what Python calls a dict. */
export function isPyDict(v: unknown): v is Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/** json.loads for one JSON text; throws SyntaxError where Python raises JSONDecodeError. */
export function parsePyJson(text: string): unknown {
  let i = 0;
  const fail = (what: string): never => {
    throw new SyntaxError(`${what} at offset ${i}`);
  };
  const ws = () => {
    while (i < text.length && " \t\n\r".includes(text[i] as string)) i++;
  };
  const literal = (word: string, value: unknown) => {
    if (!text.startsWith(word, i)) fail(`expected ${word}`);
    i += word.length;
    return value;
  };
  const string = (): string => {
    i++; // the opening quote
    let out = "";
    for (;;) {
      if (i >= text.length) fail("unterminated string");
      const c = text[i] as string;
      if (c === '"') {
        i++;
        return out;
      }
      if (c.charCodeAt(0) < 0x20) fail("invalid control character");
      if (c !== "\\") {
        out += c;
        i++;
        continue;
      }
      const e = text[i + 1];
      const simple: Record<string, string> = {
        '"': '"',
        "\\": "\\",
        "/": "/",
        b: "\b",
        f: "\f",
        n: "\n",
        r: "\r",
        t: "\t",
      };
      if (e !== undefined && e in simple) {
        out += simple[e];
        i += 2;
      } else if (e === "u" && /^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) {
        out += String.fromCharCode(Number.parseInt(text.slice(i + 2, i + 6), 16));
        i += 6;
      } else fail("invalid escape");
    }
  };
  const number = (): PyInt | PyFloat => {
    const m = /^-?(?:0|[1-9][0-9]*)(\.[0-9]+)?([eE][-+]?[0-9]+)?/.exec(text.slice(i));
    if (!m) return fail("expected a value");
    i += m[0].length;
    if (m[1] === undefined && m[2] === undefined) return new PyInt(BigInt(m[0]).toString());
    return new PyFloat(Number(m[0]));
  };
  const value = (): unknown => {
    ws();
    const c = text[i];
    if (c === "{") {
      i++;
      const entries: [string, unknown][] = [];
      ws();
      if (text[i] === "}") {
        i++;
      } else {
        for (;;) {
          ws();
          if (text[i] !== '"') fail("expected a property name");
          const key = string();
          ws();
          if (text[i] !== ":") fail("expected ':'");
          i++;
          entries.push([key, value()]);
          ws();
          if (text[i] === ",") {
            i++;
            continue;
          }
          if (text[i] === "}") {
            i++;
            break;
          }
          fail("expected ',' or '}'");
        }
      }
      return pyDict(entries);
    }
    if (c === "[") {
      i++;
      const arr: unknown[] = [];
      ws();
      if (text[i] === "]") {
        i++;
        return arr;
      }
      for (;;) {
        arr.push(value());
        ws();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === "]") {
          i++;
          return arr;
        }
        fail("expected ',' or ']'");
      }
    }
    if (c === '"') return string();
    if (c === "t") return literal("true", true);
    if (c === "f") return literal("false", false);
    if (c === "n") return literal("null", null);
    if (c === "N") return literal("NaN", new PyFloat(Number.NaN));
    if (c === "I") return literal("Infinity", new PyFloat(Number.POSITIVE_INFINITY));
    if (c === "-" && text[i + 1] === "I")
      return literal("-Infinity", new PyFloat(Number.NEGATIVE_INFINITY));
    return number();
  };
  const result = value();
  ws();
  if (i !== text.length) fail("extra data");
  return result;
}

/** float.__repr__ for a finite double: the shortest round-trip digits, Python's layout. */
function finiteFloatRepr(x: number): string {
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  const sign = x < 0 ? "-" : "";
  const [mantissa = "", exp = "0"] = Math.abs(x).toExponential().split("e");
  const digits = mantissa.replace(".", "");
  const e = Number(exp);
  if (e < -4 || e >= 16) {
    const rest = digits.slice(1);
    const sci = `${digits[0]}${rest ? `.${rest}` : ""}`;
    const ex = `${e < 0 ? "-" : "+"}${String(Math.abs(e)).padStart(2, "0")}`;
    return `${sign}${sci}e${ex}`;
  }
  if (e < 0) return `${sign}0.${"0".repeat(-e - 1)}${digits}`;
  const whole = digits.slice(0, e + 1).padEnd(e + 1, "0");
  const frac = digits.slice(e + 1);
  return `${sign}${whole}.${frac || "0"}`;
}

const floatText = (x: number, json: boolean) => {
  if (Number.isNaN(x)) return json ? "NaN" : "nan";
  if (!Number.isFinite(x)) return `${x < 0 ? "-" : ""}${json ? "Infinity" : "inf"}`;
  return finiteFloatRepr(x);
};

/** A number as Python holds it: PyInt, PyFloat, or a JavaScript number (int when integral). */
function numberText(v: PyInt | PyFloat | number, json: boolean): string {
  if (v instanceof PyInt) return v.digits;
  if (v instanceof PyFloat) return floatText(v.value, json);
  return Number.isInteger(v) ? BigInt(v).toString() : floatText(v, json);
}

const isNumber = (v: unknown): v is PyInt | PyFloat | number =>
  typeof v === "number" || v instanceof PyInt || v instanceof PyFloat;

/** Python's str ordering: by code point, not by UTF-16 unit. */
function codePointCompare(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  for (let k = 0; k < Math.min(x.length, y.length); k++) {
    const d = (x[k]?.codePointAt(0) ?? 0) - (y[k]?.codePointAt(0) ?? 0);
    if (d !== 0) return d;
  }
  return x.length - y.length;
}

/** The string encoder json.dumps uses with ensure_ascii=False. */
function dumpString(s: string): string {
  const named: Record<string, string> = {
    '"': '\\"',
    "\\": "\\\\",
    "\n": "\\n",
    "\r": "\\r",
    "\t": "\\t",
    "\b": "\\b",
    "\f": "\\f",
  };
  let out = '"';
  for (const c of s) {
    const code = c.codePointAt(0) as number;
    out += named[c] ?? (code < 0x20 ? `\\u${code.toString(16).padStart(4, "0")}` : c);
  }
  return `${out}"`;
}

/** json.dumps(value, ensure_ascii=False, sort_keys=True) */
export function pyDumps(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (value === true) return "true";
  if (value === false) return "false";
  if (isNumber(value)) return numberText(value, true);
  if (typeof value === "string") return dumpString(value);
  if (Array.isArray(value)) return `[${value.map(pyDumps).join(", ")}]`;
  if (value instanceof PyTuple) return `[${value.items.map(pyDumps).join(", ")}]`;
  const o = value as PyDict;
  const keys = [...keysOf(o)].sort(codePointCompare);
  return `{${keys.map((k) => `${dumpString(k)}: ${pyDumps(o[k])}`).join(", ")}}`;
}

const NOT_PRINTABLE = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\p{Zl}\p{Zp}\p{Zs}]/u;

/** repr() of a str: Python's quote choice and escapes. */
function reprString(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = quote;
  for (const c of s) {
    const code = c.codePointAt(0) as number;
    if (c === quote || c === "\\") out += `\\${c}`;
    else if (c === "\t") out += "\\t";
    else if (c === "\n") out += "\\n";
    else if (c === "\r") out += "\\r";
    else if (code < 0x20 || code === 0x7f) out += `\\x${code.toString(16).padStart(2, "0")}`;
    else if (code < 0x7f || c === " " || !NOT_PRINTABLE.test(c)) out += c;
    else if (code <= 0xff) out += `\\x${code.toString(16).padStart(2, "0")}`;
    else if (code <= 0xffff) out += `\\u${code.toString(16).padStart(4, "0")}`;
    else out += `\\U${code.toString(16).padStart(8, "0")}`;
  }
  return `${out}${quote}`;
}

/** repr() */
export function pyRepr(value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  if (isNumber(value)) return numberText(value, false);
  if (typeof value === "string") return reprString(value);
  if (Array.isArray(value)) return `[${value.map(pyRepr).join(", ")}]`;
  if (value instanceof PyTuple)
    return `(${value.items.map(pyRepr).join(", ")}${value.items.length === 1 ? "," : ""})`;
  const o = value as PyDict;
  return `{${keysOf(o)
    .map((k) => `${reprString(k)}: ${pyRepr(o[k])}`)
    .join(", ")}}`;
}

/** str() */
export const pyStr = (value: unknown): string =>
  typeof value === "string" ? value : pyRepr(value);

/** A Python `re` construct with no JavaScript equivalent; never matched approximately. */
export class UntranslatablePattern extends Error {
  constructor(pattern: string, what: string) {
    super(
      `Python pattern ${JSON.stringify(pattern)} uses ${what}, which has no JavaScript equivalent`,
    );
    this.name = "UntranslatablePattern";
  }
}

const W_CLASS = `[${PY_WORD}]`;
const NON_W_CLASS = `[^${PY_WORD}]`;
const BOUNDARY = `(?:(?<=${W_CLASS})(?!${W_CLASS})|(?<!${W_CLASS})(?=${W_CLASS}))`;
const NON_BOUNDARY = `(?:(?<=${W_CLASS})(?=${W_CLASS})|(?<!${W_CLASS})(?!${W_CLASS}))`;
const END = "(?![\\s\\S])";

/**
 * CPython's re/_casefix.py (_EXTRA_CASES) at 3.14, as groups: lowercase
 * characters that match one another under IGNORECASE although their
 * lowercase differs, because they share an uppercase (i and dotless i, s and
 * long s, the Greek symbol forms, the Cyrillic variants).
 */
const EXTRA_CASE_GROUPS: readonly (readonly number[])[] = [
  [0x0069, 0x0131],
  [0x0073, 0x017f],
  [0x00b5, 0x03bc],
  [0x0345, 0x03b9, 0x1fbe],
  [0x0390, 0x1fd3],
  [0x03b0, 0x1fe3],
  [0x03b2, 0x03d0],
  [0x03b5, 0x03f5],
  [0x03b8, 0x03d1],
  [0x03ba, 0x03f0],
  [0x03c0, 0x03d6],
  [0x03c1, 0x03f1],
  [0x03c2, 0x03c3],
  [0x03c6, 0x03d5],
  [0x0432, 0x1c80],
  [0x0434, 0x1c81],
  [0x043e, 0x1c82],
  [0x0441, 0x1c83],
  [0x0442, 0x1c84, 0x1c85],
  [0x044a, 0x1c86],
  [0x0463, 0x1c87],
  [0x1c88, 0xa64b],
  [0x1e61, 0x1e9b],
  [0xfb05, 0xfb06],
];
const EXTRA_CASES = new Map<number, readonly number[]>(
  EXTRA_CASE_GROUPS.flatMap((g) => g.map((c) => [c, g.filter((x) => x !== c)] as const)),
);

/** _sre.unicode_tolower: the first character of the full lowercase mapping. */
const lowerOf = (cp: number) => String.fromCodePoint(cp).toLowerCase().codePointAt(0) as number;
const upperOf = (cp: number) => String.fromCodePoint(cp).toUpperCase().codePointAt(0) as number;
/** _sre.unicode_iscased */
const isCased = (cp: number) => lowerOf(cp) !== cp || upperOf(cp) !== cp;

let lowerSources: Map<number, number[]> | undefined;
/** Every character whose lowercase is another character, by that lowercase; built once, lazily. */
function sourcesOfLower(): Map<number, number[]> {
  if (lowerSources) return lowerSources;
  const map = new Map<number, number[]>();
  for (let cp = 0; cp <= 0x10ffff; cp++) {
    if (cp === 0xd800) cp = 0xe000;
    const lo = lowerOf(cp);
    if (lo === cp) continue;
    const list = map.get(lo);
    if (list) list.push(cp);
    else map.set(lo, [cp]);
  }
  lowerSources = map;
  return map;
}

/**
 * The characters Python's IGNORECASE accepts for a set of lowered pattern
 * characters: those whose lowercase is in the set or in its CPython
 * equivalences (sre's LITERAL_UNI_IGNORE and IN_UNI_IGNORE).
 */
function caseMembers(lowered: Iterable<number>): number[] {
  const accepted = new Set<number>();
  for (const c of lowered) {
    accepted.add(c);
    for (const x of EXTRA_CASES.get(c) ?? []) accepted.add(x);
  }
  const members = new Set<number>();
  const sources = sourcesOfLower();
  for (const c of accepted) {
    if (accepted.has(lowerOf(c))) members.add(c);
    for (const s of sources.get(c) ?? []) members.add(s);
  }
  return [...members].sort((a, b) => a - b);
}

/** One code point in a flag-u pattern: ASCII letters and digits as they are, the rest escaped. */
const cpOut = (cp: number) =>
  (cp >= 0x30 && cp <= 0x39) || (cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a)
    ? String.fromCodePoint(cp)
    : `\\u{${cp.toString(16)}}`;

const rangeOut = (lo: number, hi: number) =>
  lo === hi ? cpOut(lo) : hi === lo + 1 ? cpOut(lo) + cpOut(hi) : `${cpOut(lo)}-${cpOut(hi)}`;

/** Sorted code points as the body of a character class, runs as ranges. */
function runsOut(cps: readonly number[]): string {
  let out = "";
  for (let k = 0; k < cps.length; ) {
    let j = k;
    while (j + 1 < cps.length && cps[j + 1] === (cps[j] as number) + 1) j++;
    out += rangeOut(cps[k] as number, cps[j] as number);
    k = j + 1;
  }
  return out;
}

/** A literal character, under IGNORECASE as the set of characters Python accepts for it. */
const literalOut = (cp: number, icase: boolean) =>
  icase && isCased(cp) ? `[${runsOut(caseMembers([lowerOf(cp)]))}]` : cpOut(cp);

/** A member of a Python set: a character, a range of them, or a class such as \w. */
type SetItem = { lo: number; hi: number; literal: boolean } | { cat: string };

/**
 * A Python set as a JavaScript class. Under IGNORECASE a set with a cased
 * member tests the lowercase of the text's character against its members
 * lowered, with their equivalences (sre's _optimize_charset); a set without
 * one matches exactly, as sre's IN does.
 */
function setOut(items: readonly SetItem[], negate: boolean, icase: boolean, pattern: string) {
  const cats = items.flatMap((i) => ("cat" in i ? [i.cat] : []));
  const ranges = items.flatMap((i) => ("cat" in i ? [] : [i]));
  const cased = (r: { lo: number; hi: number; literal: boolean }) => {
    if (r.literal) return isCased(lowerOf(r.lo));
    for (let c = r.lo; c <= r.hi; c++) if (isCased(c)) return true;
    return false;
  };
  const hasCased = icase && ranges.some(cased);
  if (hasCased && ranges.some((r) => !r.literal && r.hi > 0xffff && cased(r)))
    throw new UntranslatablePattern(pattern, "a set range beyond the BMP under IGNORECASE");
  let body: string;
  if (hasCased) {
    const lowered = new Set<number>();
    for (const r of ranges) for (let c = r.lo; c <= r.hi; c++) lowered.add(lowerOf(c));
    body = runsOut(caseMembers(lowered));
  } else body = ranges.map((r) => rangeOut(r.lo, r.hi)).join("");
  return `[${negate ? "^" : ""}${body}${cats.join("")}]`;
}

/** What one escape stands for: a character, a class, an assertion or a group reference. */
type Esc = { lit: number } | { cat: string; outside: string } | { at: string } | { ref: string };

interface Flags {
  icase: boolean;
  dotAll: boolean;
}

/** Characters an unescaped Python pattern passes to JavaScript as they are. */
const META = new Set("^|*+?");

const compiled = new Map<string, RegExp>();

/**
 * A Python `re` pattern, searched with re.IGNORECASE when `ignoreCase`, as a
 * JavaScript RegExp with the same matches. Throws SyntaxError where Python
 * raises re.error, UntranslatablePattern where JavaScript has no equivalent.
 */
export function pyRegex(pattern: string, ignoreCase: boolean): RegExp {
  const key = `${ignoreCase ? "i" : "-"}${pattern}`;
  let re = compiled.get(key);
  if (!re) {
    re = translate(pattern, ignoreCase);
    compiled.set(key, re);
  }
  return re;
}

function translate(pattern: string, ignoreCase: boolean): RegExp {
  let p = pattern;
  let flags: Flags = { icase: ignoreCase, dotAll: false };
  const global = /^\(\?([aiLmsux]+)\)/.exec(p);
  if (global) {
    for (const f of global[1] as string) {
      if (f === "i") flags.icase = true;
      else if (f === "s") flags.dotAll = true;
      else if (f !== "u") throw new UntranslatablePattern(pattern, `the global flag (?${f})`);
    }
    p = p.slice(global[0].length);
  }
  const chars = [...p];
  let out = "";
  let k = 0;
  /** The flags in force outside each open group, so `)` restores them. */
  const outer: Flags[] = [];
  const bad = (what: string): never => {
    throw new SyntaxError(`Python rejects ${JSON.stringify(pattern)}: ${what}`);
  };
  const octal = (digits: string): number => {
    const v = Number.parseInt(digits, 8);
    if (v > 0o377) bad(`octal escape value \\${digits} outside of range 0-0o377`);
    return v;
  };
  /** One escape after a backslash at chars[k] (sre_parse's _escape and _class_escape). */
  const escapeAt = (inClass: boolean): Esc => {
    const c = chars[k + 1];
    if (c === undefined) return bad("bad escape (end of pattern)");
    k += 2;
    const take = (n: number, re: RegExp) => {
      const s = chars.slice(k, k + n).join("");
      if (s.length !== n || !re.test(s)) bad(`incomplete escape \\${c}`);
      k += n;
      return Number.parseInt(s, 16);
    };
    switch (c) {
      case "w":
        return { cat: PY_WORD, outside: W_CLASS };
      case "W":
        if (inClass) throw new UntranslatablePattern(pattern, "\\W inside a set");
        return { at: NON_W_CLASS };
      case "s":
        return { cat: PY_SPACE, outside: `[${PY_SPACE}]` };
      case "S":
        if (inClass) throw new UntranslatablePattern(pattern, "\\S inside a set");
        return { at: `[^${PY_SPACE}]` };
      case "d":
        return { cat: "\\p{Nd}", outside: "\\p{Nd}" };
      case "D":
        return { cat: "\\P{Nd}", outside: "\\P{Nd}" };
      case "b":
        return inClass ? { lit: 0x08 } : { at: BOUNDARY };
      case "B":
        if (inClass) return bad("bad escape \\B");
        return { at: NON_BOUNDARY };
      case "A":
        if (inClass) return bad("bad escape \\A");
        return { at: "(?<![\\s\\S])" };
      case "Z":
        if (inClass) return bad("bad escape \\Z");
        return { at: END };
      case "a":
        return { lit: 0x07 };
      case "f":
        return { lit: 0x0c };
      case "n":
        return { lit: 0x0a };
      case "r":
        return { lit: 0x0d };
      case "t":
        return { lit: 0x09 };
      case "v":
        return { lit: 0x0b };
      case "x":
        return { lit: take(2, /^[0-9a-fA-F]{2}$/) };
      case "u":
        return { lit: take(4, /^[0-9a-fA-F]{4}$/) };
      case "U": {
        const v = take(8, /^[0-9a-fA-F]{8}$/);
        if (v > 0x10ffff) bad("bad escape \\U");
        return { lit: v };
      }
      case "N":
        throw new UntranslatablePattern(pattern, "\\N{...}");
    }
    if (/[0-9]/.test(c)) {
      const next = chars.slice(k, k + 2).join("");
      if (inClass) {
        // In a set every octal digit starts an octal escape of up to three digits.
        if (!/[0-7]/.test(c)) return bad(`bad escape \\${c}`);
        const digits = (c + next).match(/^[0-7]{1,3}/)?.[0] as string;
        k += digits.length - 1;
        return { lit: octal(digits) };
      }
      if (c === "0") {
        const digits = (c + next).match(/^0[0-7]{0,2}/)?.[0] as string;
        k += digits.length - 1;
        return { lit: Number.parseInt(digits, 8) };
      }
      // Three octal digits are an octal escape; otherwise one or two digits name a group.
      if (/^[0-7]{3}/.test(c + next)) {
        k += 2;
        return { lit: octal(c + next) };
      }
      const ref = (c + next).match(/^[0-9]{1,2}/)?.[0] as string;
      k += ref.length - 1;
      return { ref };
    }
    if (/[A-Za-z]/.test(c)) return bad(`bad escape \\${c}`);
    return { lit: c.codePointAt(0) as number };
  };
  /** A back reference compares case-insensitively by sre's own rule; refused under IGNORECASE. */
  const backReference = (js: string) => {
    if (flags.icase) throw new UntranslatablePattern(pattern, "a back reference under IGNORECASE");
    out += js;
  };
  /** One Python set, from just after its `[` (sre_parse's set syntax). */
  const setAt = (): string => {
    const items: SetItem[] = [];
    let negate = false;
    if (chars[k] === "^") {
      negate = true;
      k++;
    }
    const member = (): SetItem => {
      const d = chars[k] as string;
      if (d === "\\") {
        const e = escapeAt(true);
        if ("lit" in e) return { lo: e.lit, hi: e.lit, literal: true };
        if ("cat" in e) return { cat: e.cat };
        return bad("bad escape in a set");
      }
      k++;
      const cp = d.codePointAt(0) as number;
      return { lo: cp, hi: cp, literal: true };
    };
    for (;;) {
      const d = chars[k];
      if (d === undefined) return bad("unterminated character set");
      if (d === "]" && items.length > 0) {
        k++;
        break;
      }
      const first = member();
      if (chars[k] !== "-") {
        items.push(first);
        continue;
      }
      k++;
      const that = chars[k];
      if (that === undefined) return bad("unterminated character set");
      if (that === "]") {
        k++;
        items.push(first, { lo: 0x2d, hi: 0x2d, literal: true });
        break;
      }
      const second = member();
      // A class such as \w at either end of a range is an error, never a literal `-`.
      if ("cat" in first || "cat" in second || second.lo < first.lo)
        return bad("bad character range");
      items.push({ lo: first.lo, hi: second.lo, literal: false });
    }
    return setOut(items, negate, flags.icase, pattern);
  };

  while (k < chars.length) {
    const c = chars[k] as string;
    if (c === "\\") {
      const e = escapeAt(false);
      if ("lit" in e) out += literalOut(e.lit, flags.icase);
      else if ("cat" in e) out += e.outside;
      else if ("at" in e) out += e.at;
      else backReference(`\\${e.ref}`);
      continue;
    }
    if (c === "[") {
      k++;
      out += setAt();
      continue;
    }
    if (c === "(") {
      const rest = chars.slice(k, k + 4).join("");
      if (rest.startsWith("(?P=")) {
        const close = chars.indexOf(")", k);
        if (close === -1) bad("unterminated name");
        backReference(`\\k<${chars.slice(k + 4, close).join("")}>`);
        k = close + 1;
        continue;
      }
      if (rest.startsWith("(?#")) {
        const close = chars.indexOf(")", k);
        if (close === -1) bad("missing ), unterminated comment");
        k = close + 1;
        continue;
      }
      const head = chars.slice(k, k + 12).join("");
      if (/^\(\?[aiLmsux]+\)/.test(head)) bad("global flags not at the start of the expression");
      outer.push({ ...flags });
      if (rest.startsWith("(?P<")) {
        out += "(?<";
        k += 4;
        continue;
      }
      if (/^\(\?(?:[:=!]|<[=!])/.test(rest)) {
        const n = rest.startsWith("(?<") ? 4 : 3;
        out += rest.slice(0, n);
        k += n;
        continue;
      }
      const scoped = /^\(\?([aiLmsux]*)(?:(-)([a-zA-Z]*))?:/.exec(head);
      if (scoped && (scoped[1] || scoped[2])) {
        const on = scoped[1] as string;
        const off = scoped[3] ?? "";
        if (scoped[2] && !off) bad("missing flag");
        if ([...off].some((f) => !"imsx".includes(f)))
          bad("bad inline flags: cannot turn off flag");
        if ([...on].some((f) => off.includes(f))) bad("bad inline flags: flag turned on and off");
        for (const f of on + off)
          if (!"isu".includes(f))
            throw new UntranslatablePattern(pattern, `the scoped flag ${f} in ${scoped[0]}`);
        if (on.includes("i")) flags.icase = true;
        if (off.includes("i")) flags.icase = false;
        if (on.includes("s")) flags.dotAll = true;
        if (off.includes("s")) flags.dotAll = false;
        out += "(?:";
        k += scoped[0].length;
        continue;
      }
      if (rest.startsWith("(?")) throw new UntranslatablePattern(pattern, `the group ${rest}`);
      out += "(";
      k++;
      continue;
    }
    if (c === ")") {
      flags = outer.pop() ?? flags;
      out += ")";
      k++;
      continue;
    }
    if (c === "{") {
      const m = /^\{([0-9]*)(,([0-9]*))?\}/.exec(chars.slice(k).join(""));
      if (m && !(m[1] === "" && m[2] === undefined)) {
        const lo = m[1] || "0";
        out += m[2] === undefined ? `{${lo}}` : `{${lo},${m[3] ?? ""}}`;
        k += m[0].length;
        if (chars[k] === "+") throw new UntranslatablePattern(pattern, "a possessive quantifier");
        continue;
      }
      out += literalOut(0x7b, false);
      k++;
    } else if (c === "}" || c === "]") {
      out += `\\${c}`;
      k++;
    } else if (c === ".") {
      out += flags.dotAll ? "[\\s\\S]" : "[^\\n]";
      k++;
    } else if (c === "$") {
      out += `(?=\\n?${END})`;
      k++;
    } else if (META.has(c)) {
      out += c;
      k++;
    } else {
      out += literalOut(c.codePointAt(0) as number, flags.icase);
      k++;
    }
    // A possessive quantifier (Python 3.11) has no JavaScript form.
    if ("*+?".includes(c) && chars[k] === "+")
      throw new UntranslatablePattern(pattern, "a possessive quantifier");
  }
  try {
    return new RegExp(out, "u");
  } catch (e) {
    throw new SyntaxError(
      `${(e as Error).message} (from Python pattern ${JSON.stringify(pattern)})`,
    );
  }
}

/**
 * re.escape: a backslash before each character Python 3.7 and later escape
 * (`()[]{}?*+-|^$\.&~#`, space and the whitespace controls).
 */
export const pyEscape = (s: string) =>
  [...s].map((c) => ("()[]{}?*+-|^$\\.&~# \t\n\r\v\f".includes(c) ? `\\${c}` : c)).join("");
