// Python's ast.literal_eval, for the replies a model can give (round 2 of the
// review fix pass, defect 7). When a reply is not JSON, GateMem's
// _parse_llm_json and _coerce_answer_structured fall back to
// ast.literal_eval, so a reply written as a Python dict (single quotes, None,
// True, False, tuples) is read as that dict rather than as plain text.
//
// pyLiteralEval reproduces CPython 3.14 for this subset: str (quotes of
// either kind, triple quotes, the r and u prefixes, implicit concatenation,
// every escape but \N{...}), int in any base with underscores, float in every
// form, unary + and - on a number, True, False, None, tuples, lists, and
// dicts with str keys. It returns `{ ok: false }` wherever literal_eval
// raises (a syntax error, a name, an operator, an unhashable key), as
// upstream's `except Exception` swallows. A valid literal outside the subset
// (a set, bytes, a complex number, Ellipsis, a \N{...} escape, a key other
// than a str) throws UntranslatableLiteral: upstream would read it, the port
// cannot represent it, and a reply must never score differently in silence.
//
// The source is first stripped of leading spaces and tabs, as literal_eval
// does; line breaks are \n, \r\n or \r; a newline outside brackets ends the
// expression, an indented first token is an IndentationError, and a comment
// runs to the end of its line, all as CPython's tokenizer has them.
import { PyFloat, PyInt, PyTuple, pyDict } from "./py.ts";

/** A valid Python literal the port cannot represent; never read differently from upstream. */
export class UntranslatableLiteral extends Error {
  constructor(what: string) {
    super(`a Python literal with ${what}, which the GateMem port does not represent`);
    this.name = "UntranslatableLiteral";
  }
}

/** literal_eval raised: SyntaxError, ValueError or TypeError in Python. */
class Rejected extends Error {}
const reject = (why: string): never => {
  throw new Rejected(why);
};

type Token =
  | { t: "str"; value: string; bytes: boolean }
  | { t: "int"; value: bigint }
  | { t: "float"; value: number }
  | { t: "imag" }
  | { t: "name"; value: string }
  | { t: "op"; value: string };

const DIGITS = "[0-9](?:_?[0-9])*";
const POINT = `(?:(?:${DIGITS})?\\.${DIGITS}|${DIGITS}\\.)`;
const EXPONENT = `[eE][-+]?${DIGITS}`;
const FLOAT = `(?:${POINT}(?:${EXPONENT})?|${DIGITS}${EXPONENT})`;
const IMAG_RE = new RegExp(`^(?:${FLOAT}|${DIGITS})[jJ]`);
const FLOAT_RE = new RegExp(`^${FLOAT}`);
const RADIX_RE = /^0(?:[xX](?:_?[0-9a-fA-F])+|[oO](?:_?[0-7])+|[bB](?:_?[01])+)/;
const DECIMAL_RE = /^(?:[1-9](?:_?[0-9])*|0(?:_?0)*)/;
/** String prefixes Python accepts (any case); f and t strings are never literals. */
const PREFIXES = new Set(["", "r", "u", "b", "br", "rb", "f", "fr", "rf", "t", "tr", "rt"]);
const SIMPLE_ESCAPES: Record<string, string> = {
  "\\": "\\",
  "'": "'",
  '"': '"',
  a: "\x07",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
  v: "\v",
};
const CLOSERS: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

/** CPython's tokenizer, for the tokens a literal can hold; anything else rejects. */
function tokenize(source: string): { tokens: Token[]; unsupported: string[] } {
  const unsupported: string[] = [];
  if (source.includes("\0")) reject("source code cannot contain null bytes");
  // ast.parse encodes the source as UTF-8, which a lone surrogate cannot be.
  if (!source.isWellFormed()) reject("surrogates not allowed");
  const src = source.replace(/^[ \t]+/, "").replace(/\r\n?/g, "\n");
  const n = src.length;
  const tokens: Token[] = [];
  const open: string[] = [];
  let i = 0;
  let lineStart = true;
  let ended = false;

  const readString = (prefix: string) => {
    const raw = prefix.includes("r");
    const bytes = prefix.includes("b");
    const q = src[i] as string;
    const triple = src.startsWith(q.repeat(3), i);
    const close = triple ? q.repeat(3) : q;
    i += close.length;
    let value = "";
    for (;;) {
      if (i >= n) reject("unterminated string literal");
      const c = src[i] as string;
      if (src.startsWith(close, i)) {
        i += close.length;
        break;
      }
      if (c === "\n" && !triple) reject("unterminated string literal");
      if (bytes && c.charCodeAt(0) > 0x7f)
        reject("bytes can only contain ASCII literal characters");
      if (c !== "\\") {
        value += c;
        i++;
        continue;
      }
      const e = src[i + 1];
      if (e === undefined) reject("unterminated string literal");
      const esc = e as string;
      if (raw) {
        value += c + esc;
        i += 2;
        continue;
      }
      i += 2;
      if (esc === "\n") continue;
      if (esc in SIMPLE_ESCAPES) {
        value += SIMPLE_ESCAPES[esc];
        continue;
      }
      if (/[0-7]/.test(esc)) {
        const digits = (esc + src.slice(i, i + 2)).match(/^[0-7]{1,3}/)?.[0] as string;
        i += digits.length - 1;
        value += String.fromCodePoint(Number.parseInt(digits, 8));
        continue;
      }
      const hex = (count: number) => {
        const h = src.slice(i, i + count);
        if (!new RegExp(`^[0-9a-fA-F]{${count}}$`).test(h)) reject(`truncated \\${esc} escape`);
        i += count;
        return Number.parseInt(h, 16);
      };
      if (esc === "x") {
        value += String.fromCodePoint(hex(2));
        continue;
      }
      if (!bytes && (esc === "u" || esc === "U")) {
        const cp = hex(esc === "u" ? 4 : 8);
        if (cp > 0x10ffff) reject("illegal Unicode character");
        value += String.fromCodePoint(cp);
        continue;
      }
      if (!bytes && esc === "N") {
        const end = src.indexOf("}", i);
        if (src[i] !== "{" || end === -1) reject("malformed \\N character escape");
        unsupported.push("a \\N{...} escape");
        i = end + 1;
        continue;
      }
      // An unknown escape keeps its backslash (a SyntaxWarning, not an error).
      value += c + esc;
    }
    tokens.push({ t: "str", value, bytes });
  };

  const readNumber = () => {
    const rest = src.slice(i);
    const imag = IMAG_RE.exec(rest);
    const float = imag ? null : FLOAT_RE.exec(rest);
    const radix = imag || float ? null : RADIX_RE.exec(rest);
    const decimal = imag || float || radix ? null : DECIMAL_RE.exec(rest);
    const m = imag ?? float ?? radix ?? decimal;
    if (!m) return reject("invalid number");
    i += m[0].length;
    if (/[0-9A-Za-z_]/.test(src[i] ?? "")) reject("invalid decimal literal");
    const text = m[0].replaceAll("_", "");
    if (imag) {
      unsupported.push("a complex number");
      tokens.push({ t: "imag" });
    } else if (float) tokens.push({ t: "float", value: Number(text) });
    else tokens.push({ t: "int", value: BigInt(text) });
  };

  while (i < n || lineStart) {
    if (lineStart && open.length === 0) {
      // The start of a line outside brackets: blank and comment lines are
      // skipped; a token here must not be indented, and must be the first.
      let col = 0;
      let j = i;
      while (j < n && " \t\f".includes(src[j] as string)) {
        col = src[j] === "\f" ? 0 : col + 1;
        j++;
      }
      if (j >= n) {
        if (col > 0) reject("unexpected indent");
        break;
      }
      if (src[j] === "\n") {
        i = j + 1;
        continue;
      }
      if (src[j] === "#") {
        const nl = src.indexOf("\n", j);
        i = nl === -1 ? n : nl;
        continue;
      }
      if (col > 0) reject("unexpected indent");
      if (ended) reject("invalid syntax");
      lineStart = false;
      i = j;
    }
    if (i >= n) break;
    const c = src[i] as string;
    if (" \t\f".includes(c)) {
      i++;
    } else if (c === "#") {
      const nl = src.indexOf("\n", i);
      i = nl === -1 ? n : nl;
    } else if (c === "\n") {
      i++;
      if (open.length === 0) {
        ended = true;
        lineStart = true;
      }
    } else if (c === "\\") {
      if (src[i + 1] !== "\n") reject("unexpected character after line continuation");
      i += 2;
      if (i >= n) reject("unexpected EOF while parsing");
    } else if (/[A-Za-z_]/.test(c)) {
      const word = /^[A-Za-z0-9_]*/.exec(src.slice(i))?.[0] as string;
      const quote = src[i + word.length];
      if ((quote === "'" || quote === '"') && word.length <= 2) {
        const prefix = word.toLowerCase();
        if (!PREFIXES.has(prefix)) reject(`invalid string prefix ${word}`);
        // An f or t string is a JoinedStr or TemplateStr: never a literal.
        if (prefix.includes("f") || prefix.includes("t")) reject("not a literal: f or t string");
        i += word.length;
        readString(prefix);
      } else {
        i += word.length;
        // A name is never a literal, except the three constants and set().
        if (!["True", "False", "None", "set"].includes(word)) reject(`not a literal: ${word}`);
        tokens.push({ t: "name", value: word });
      }
    } else if (c === "'" || c === '"') {
      readString("");
    } else if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      readNumber();
    } else if (src.startsWith("...", i)) {
      i += 3;
      unsupported.push("Ellipsis");
      tokens.push({ t: "op", value: "..." });
    } else if ("([{".includes(c)) {
      open.push(c);
      i++;
      tokens.push({ t: "op", value: c });
    } else if (c in CLOSERS) {
      if (open.pop() !== CLOSERS[c]) reject(`unmatched '${c}'`);
      i++;
      tokens.push({ t: "op", value: c });
    } else if (",:+-".includes(c)) {
      // `-` and `+` stand alone; `->`, `+=` and the like fail on their next character.
      i++;
      tokens.push({ t: "op", value: c });
    } else {
      // Any other operator or character: a syntax error or a node literal_eval refuses.
      reject(`not a literal: ${JSON.stringify(c)}`);
    }
  }
  if (open.length > 0) reject("unexpected EOF while parsing");
  return { tokens, unsupported };
}

type Node =
  | { t: "str"; value: string }
  | { t: "bytes" }
  | { t: "int"; value: bigint }
  | { t: "float"; value: number }
  | { t: "imag" }
  | { t: "const"; value: boolean | null }
  | { t: "ellipsis" }
  | { t: "tuple" | "list" | "set"; items: Node[] }
  | { t: "dict"; keys: Node[]; values: Node[] }
  | { t: "emptyset" }
  | { t: "unary"; minus: boolean; operand: Node }
  | { t: "binop"; minus: boolean; left: Node; right: Node };

/** The expression grammar, for the tokens tokenize admits. */
function parse(tokens: readonly Token[]): Node {
  let k = 0;
  const peek = (value: string) => {
    const tok = tokens[k];
    return tok?.t === "op" && tok.value === value;
  };
  const accept = (value: string) => {
    if (!peek(value)) return false;
    k++;
    return true;
  };
  const expect = (value: string) => {
    if (!accept(value)) reject(`invalid syntax: expected '${value}'`);
  };
  /** expression (`,` expression)* [`,`], a tuple when there is a comma, up to `closer`. */
  const items = (closer: string | undefined): Node => {
    const first = expression();
    if (!peek(",")) return first;
    const list = [first];
    while (accept(",")) {
      if (closer === undefined ? k >= tokens.length : peek(closer)) break;
      list.push(expression());
    }
    return { t: "tuple", items: list };
  };
  const sequence = (closer: string): Node[] => {
    const list: Node[] = [];
    while (!peek(closer)) {
      list.push(expression());
      if (!accept(",")) break;
    }
    expect(closer);
    return list;
  };
  const expression = (): Node => {
    let left = factor();
    while (peek("+") || peek("-")) {
      const minus = (tokens[k++] as { value: string }).value === "-";
      left = { t: "binop", minus, left, right: factor() };
    }
    return left;
  };
  const factor = (): Node => {
    if (peek("+") || peek("-")) {
      const minus = (tokens[k++] as { value: string }).value === "-";
      return { t: "unary", minus, operand: factor() };
    }
    const node = atom();
    // A call or subscript after an atom is never a literal (set() aside, in atom).
    if (peek("(") || peek("[")) reject("not a literal: call or subscript");
    return node;
  };
  const atom = (): Node => {
    const tok = tokens[k++];
    if (tok === undefined) return reject("unexpected EOF while parsing");
    switch (tok.t) {
      case "str": {
        let value = tok.value;
        let bytes = tok.bytes;
        let next = tokens[k];
        while (next?.t === "str") {
          if (next.bytes !== bytes) reject("cannot mix bytes and nonbytes literals");
          value += next.value;
          bytes = next.bytes;
          next = tokens[++k];
        }
        return bytes ? { t: "bytes" } : { t: "str", value };
      }
      case "int":
        return { t: "int", value: tok.value };
      case "float":
        return { t: "float", value: tok.value };
      case "imag":
        return { t: "imag" };
      case "name":
        if (tok.value === "True") return { t: "const", value: true };
        if (tok.value === "False") return { t: "const", value: false };
        if (tok.value === "None") return { t: "const", value: null };
        if (tok.value !== "set") reject(`not a literal: ${tok.value}`);
        expect("(");
        expect(")");
        return { t: "emptyset" };
      case "op":
        break;
    }
    if (tok.value === "...") return { t: "ellipsis" };
    if (tok.value === "(") {
      if (accept(")")) return { t: "tuple", items: [] };
      const inner = items(")");
      expect(")");
      return inner;
    }
    if (tok.value === "[") return { t: "list", items: sequence("]") };
    if (tok.value === "{") {
      if (accept("}")) return { t: "dict", keys: [], values: [] };
      const first = expression();
      if (!accept(":")) {
        if (accept(",")) return { t: "set", items: [first, ...sequence("}")] };
        expect("}");
        return { t: "set", items: [first] };
      }
      const keys = [first];
      const values = [expression()];
      while (accept(",")) {
        if (peek("}")) break;
        keys.push(expression());
        expect(":");
        values.push(expression());
      }
      expect("}");
      return { t: "dict", keys, values };
    }
    return reject(`invalid syntax at '${tok.value}'`);
  };
  const node = items(undefined);
  if (k !== tokens.length) reject("invalid syntax");
  return node;
}

/** A value literal_eval would build that the port does not represent. */
class Opaque {
  readonly hashable: boolean;
  constructor(hashable: boolean) {
    this.hashable = hashable;
  }
}

/** Whether Python could hash the value: lists, dicts and sets cannot be keys or set members. */
function hashable(v: unknown): boolean {
  if (v instanceof Opaque) return v.hashable;
  if (v instanceof PyTuple) return v.items.every(hashable);
  return !(
    Array.isArray(v) ||
    (typeof v === "object" && v !== null && !(v instanceof PyInt || v instanceof PyFloat))
  );
}

/** ast.literal_eval's _convert, on the parsed tree. */
function convert(node: Node, unsupported: string[]): unknown {
  const num = (n: Node): { int: bigint } | { float: number } | "imag" => {
    if (n.t === "int") return { int: n.value };
    if (n.t === "float") return { float: n.value };
    if (n.t === "imag") return "imag";
    return reject("malformed node or string");
  };
  const signed = (n: Node) => {
    if (n.t !== "unary") return num(n);
    const v = num(n.operand);
    if (v === "imag" || !n.minus) return v;
    return "int" in v ? { int: -v.int } : { float: -v.float };
  };
  switch (node.t) {
    case "str":
      return node.value;
    case "int":
      return new PyInt(node.value.toString());
    case "float":
      return new PyFloat(node.value);
    case "const":
      return node.value;
    case "bytes":
      unsupported.push("bytes");
      return new Opaque(true);
    case "imag":
      return new Opaque(true);
    case "ellipsis":
      return new Opaque(true);
    case "emptyset":
      unsupported.push("a set");
      return new Opaque(false);
    case "tuple":
      return new PyTuple(node.items.map((n) => convert(n, unsupported)));
    case "list":
      return node.items.map((n) => convert(n, unsupported));
    case "set": {
      const members = node.items.map((n) => convert(n, unsupported));
      if (!members.every(hashable)) reject("unhashable type in a set");
      unsupported.push("a set");
      return new Opaque(false);
    }
    case "dict": {
      const entries: [string, unknown][] = [];
      for (const [j, keyNode] of node.keys.entries()) {
        const key = convert(keyNode, unsupported);
        const value = convert(node.values[j] as Node, unsupported);
        if (!hashable(key)) reject("unhashable dict key");
        if (typeof key === "string") entries.push([key, value]);
        else unsupported.push("a dict key that is not a str");
      }
      return pyDict(entries);
    }
    case "binop": {
      // Only a real number plus or minus an imaginary one: a complex number.
      const left = signed(node.left);
      const right = num(node.right);
      if (left !== "imag" && right === "imag") return new Opaque(true);
      return reject("malformed node or string");
    }
    case "unary": {
      const v = signed(node);
      if (v === "imag") return new Opaque(true);
      return "int" in v ? new PyInt(v.int.toString()) : new PyFloat(v.float);
    }
  }
}

/**
 * ast.literal_eval(source): `{ ok: true, value }` with dicts, tuples, ints
 * and floats as py.ts represents them, or `{ ok: false }` where Python
 * raises. Throws UntranslatableLiteral for a valid literal outside the subset.
 */
export function pyLiteralEval(source: string): { ok: true; value: unknown } | { ok: false } {
  let value: unknown;
  const unsupported: string[] = [];
  try {
    const lexed = tokenize(source);
    unsupported.push(...lexed.unsupported);
    value = convert(parse(lexed.tokens), unsupported);
  } catch (e) {
    if (e instanceof Rejected) return { ok: false };
    throw e;
  }
  if (unsupported.length > 0) throw new UntranslatableLiteral([...new Set(unsupported)].join(", "));
  return { ok: true, value };
}
