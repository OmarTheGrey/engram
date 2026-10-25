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
//   pyStr: repr() and str(), with Python's float repr and string quoting.
// - pyStrip, pyNormalizeWs: str.strip and re.sub(r"\s+", " ", s), on Python's
//   whitespace set (str.isspace).
// - pyRegex: a Python `re` pattern as an equivalent JavaScript RegExp (flag
//   u): \w, \d, \s and \b as Python's Unicode classes, $ also before a final
//   newline, . excluding only \n, (?P<name>) groups, \A and \Z, Python's
//   literal braces and escapes. A construct with no JavaScript equivalent
//   (atomic groups, possessive quantifiers, scoped or verbose flags, \N{...})
//   throws UntranslatablePattern rather than matching differently; a pattern
//   Python itself rejects throws SyntaxError, as re.error.
//
// Known limits: JavaScript's case folding under the i flag and its Unicode
// tables (Node's ICU) can differ from CPython's at the margins, such as
// characters added in a Unicode version one of them lacks. Python's
// \w equals [\p{L}\p{N}_] and \d equals \p{Nd} on Unicode 16 (checked
// against CPython 3.14 over every code point).

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

/** The key order Python's dict keeps, for objects parsePyJson builds. */
const ORDER = Symbol("python dict order");
type PyDict = Record<string, unknown> & { [ORDER]?: string[] };

const keysOf = (o: PyDict): string[] => o[ORDER] ?? Object.keys(o);

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
      const obj: PyDict = {};
      const order: string[] = [];
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
          const v = value();
          if (!Object.hasOwn(obj, key)) order.push(key);
          Object.defineProperty(obj, key, {
            value: v,
            enumerable: true,
            writable: true,
            configurable: true,
          });
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
      Object.defineProperty(obj, ORDER, { value: order, enumerable: false });
      return obj;
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
/** Characters an escape in a flag-u pattern may name literally. */
const SYNTAX = new Set("^$\\.*+?()[]{}|/");

const hexEscape = (c: string) => `\\u{${(c.codePointAt(0) as number).toString(16)}}`;

/**
 * A Python `re` pattern, searched with re.IGNORECASE when `ignoreCase`, as a
 * JavaScript RegExp with the same matches. Throws SyntaxError where Python
 * raises re.error, UntranslatablePattern where JavaScript has no equivalent.
 */
export function pyRegex(pattern: string, ignoreCase: boolean): RegExp {
  let p = pattern;
  let dotAll = false;
  let icase = ignoreCase;
  const global = /^\(\?([aiLmsux]+)\)/.exec(p);
  if (global) {
    for (const f of global[1] as string) {
      if (f === "i") icase = true;
      else if (f === "s") dotAll = true;
      else if (f !== "u") throw new UntranslatablePattern(pattern, `the global flag (?${f})`);
    }
    p = p.slice(global[0].length);
  }
  const chars = [...p];
  let out = "";
  let k = 0;
  const bad = (what: string): never => {
    throw new SyntaxError(`Python rejects ${JSON.stringify(pattern)}: ${what}`);
  };
  /** One escape after a backslash at chars[k]; returns its translation. */
  const escapeAt = (inClass: boolean): string => {
    const c = chars[k + 1];
    if (c === undefined) return bad("bad escape (end of pattern)");
    k += 2;
    const take = (n: number, re: RegExp) => {
      const s = chars.slice(k, k + n).join("");
      if (s.length !== n || !re.test(s)) bad(`incomplete escape \\${c}`);
      k += n;
      return s;
    };
    switch (c) {
      case "w":
        return inClass ? PY_WORD : W_CLASS;
      case "W":
        if (inClass) throw new UntranslatablePattern(pattern, "\\W inside a set");
        return NON_W_CLASS;
      case "s":
        return inClass ? PY_SPACE : `[${PY_SPACE}]`;
      case "S":
        if (inClass) throw new UntranslatablePattern(pattern, "\\S inside a set");
        return `[^${PY_SPACE}]`;
      case "d":
        return "\\p{Nd}";
      case "D":
        return "\\P{Nd}";
      case "b":
        return inClass ? "\\x08" : BOUNDARY;
      case "B":
        if (inClass) return bad("bad escape \\B");
        return NON_BOUNDARY;
      case "A":
        if (inClass) return bad("bad escape \\A");
        return "(?<![\\s\\S])";
      case "Z":
        if (inClass) return bad("bad escape \\Z");
        return END;
      case "n":
      case "t":
      case "r":
      case "f":
      case "v":
        return `\\${c}`;
      case "a":
        return "\\x07";
      case "x":
        return `\\x${take(2, /^[0-9a-fA-F]{2}$/)}`;
      case "u":
        return `\\u${take(4, /^[0-9a-fA-F]{4}$/)}`;
      case "U":
        return `\\u{${take(8, /^[0-9a-fA-F]{8}$/).replace(/^0+(?=.)/, "")}}`;
      case "N":
        throw new UntranslatablePattern(pattern, "\\N{...}");
    }
    if (/[0-9]/.test(c)) {
      // An octal escape (\0, or three octal digits) or a group reference.
      const run = [c, ...chars.slice(k, k + 2)].join("").match(/^[0-9]*/)?.[0] ?? c;
      if (c === "0" || (run.length === 3 && /^[0-7]{3}$/.test(run))) {
        const oct = (c === "0" ? run.match(/^0[0-7]{0,2}/)?.[0] : run) as string;
        k += oct.length - 1;
        return hexEscape(String.fromCodePoint(Number.parseInt(oct, 8)));
      }
      if (inClass) return bad("bad escape in a set");
      const ref = run.slice(0, 2);
      k += ref.length - 1;
      return `\\${ref}`;
    }
    if (/[A-Za-z]/.test(c)) return bad(`bad escape \\${c}`);
    if (SYNTAX.has(c) || (inClass && c === "-")) return `\\${c}`;
    return hexEscape(c);
  };

  while (k < chars.length) {
    const c = chars[k] as string;
    if (c === "\\") {
      out += escapeAt(false);
      continue;
    }
    if (c === "[") {
      k++;
      let body = "";
      if (chars[k] === "^") {
        body += "^";
        k++;
      }
      if (chars[k] === "]") {
        body += "\\]";
        k++;
      }
      // After a class escape such as \w, Python reads `-` as a literal, never a range.
      let afterSet = false;
      for (;;) {
        const d = chars[k];
        if (d === undefined) bad("unterminated character set");
        if (d === "]") {
          k++;
          break;
        }
        if (d === "\\") {
          afterSet = "wsdD".includes(chars[k + 1] ?? "");
          body += escapeAt(true);
          continue;
        }
        body += d === "[" || (d === "-" && afterSet) ? `\\${d}` : (d as string);
        afterSet = false;
        k++;
      }
      out += `[${body}]`;
      continue;
    }
    if (c === "(") {
      const rest = chars.slice(k, k + 4).join("");
      if (rest.startsWith("(?P<")) {
        out += "(?<";
        k += 4;
        continue;
      }
      if (rest.startsWith("(?P=")) {
        const close = chars.indexOf(")", k);
        if (close === -1) bad("unterminated name");
        out += `\\k<${chars.slice(k + 4, close).join("")}>`;
        k = close + 1;
        continue;
      }
      if (rest.startsWith("(?#")) {
        const close = chars.indexOf(")", k);
        if (close === -1) bad("missing ), unterminated comment");
        k = close + 1;
        continue;
      }
      if (/^\(\?[aiLmsux]+\)/.test(chars.slice(k, k + 8).join("")))
        bad("global flags not at the start of the expression");
      if (rest.startsWith("(?i:")) {
        out += "(?:";
        k += 4;
        continue;
      }
      if (/^\(\?(?:[:=!]|<[=!])/.test(rest)) {
        out += rest.startsWith("(?<") ? rest.slice(0, 4) : rest.slice(0, 3);
        k += rest.startsWith("(?<") ? 4 : 3;
        continue;
      }
      if (rest.startsWith("(?")) throw new UntranslatablePattern(pattern, `the group ${rest}`);
      out += "(";
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
      } else {
        out += "\\{";
        k++;
      }
    } else if (c === "}" || c === "]") {
      out += `\\${c}`;
      k++;
    } else if (c === ".") {
      out += dotAll ? "[\\s\\S]" : "[^\\n]";
      k++;
    } else if (c === "$") {
      out += `(?=\\n?${END})`;
      k++;
    } else {
      out += c;
      k++;
    }
    // A possessive quantifier (Python 3.11) has no JavaScript form.
    if ("*+?".includes(c) && chars[k] === "+")
      throw new UntranslatablePattern(pattern, "a possessive quantifier");
  }
  try {
    return new RegExp(out, `u${icase ? "i" : ""}${dotAll ? "s" : ""}`);
  } catch (e) {
    throw new SyntaxError(
      `${(e as Error).message} (from Python pattern ${JSON.stringify(pattern)})`,
    );
  }
}
