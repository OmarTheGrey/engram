// No-bypass in the shell (ADR 0014, decision D10): a shell command that
// invokes a memory store's CLI is a write the gate never saw. The same check
// runs for the user's `!` commands (user_bash) and the model's bash and
// powershell tools (tool_call).
//
// Shell text cannot be parsed into a complete answer, so the check errs
// towards blocking. The command is first normalised the way a shell would
// read it, without running anything: a backslash-newline continuation is
// joined, `$'...'` (ANSI-C) quoting is decoded (so a path spelled in it is
// checked too), cmd's `^` escape is dropped, and brace expansion
// (`me{m,}0`, `mem{0..1}`) is expanded. It is then cut into words at
// whitespace and at every shell operator (`;`, `&`, `|`, parentheses,
// braces, `$`, backticks, redirections), quotes are dropped, so a
// `bash -c "..."` argument, a subshell or a substitution is searched like the
// rest. Each word, each side of an `=` or `:` in it, and each part around an
// `@` (a `name@version` package spec) is compared after removing a leading
// path, an executable suffix, leading dashes or `!` and case; it is also
// compared with backslashes removed, with C escapes (hex, octal, unicode)
// decoded, so printf or `echo -e` escapes are read as the shell reads them,
// with `+` removed (`'me'+'m0'` in Python or PowerShell), and with
// PowerShell's backtick escape removed. A word holding glob characters (`*`,
// `?`, `[...]`) with at least two literal characters is a pattern, and it
// matches when it matches a store name. Any match anywhere blocks the command, behind any
// wrapper (env, sudo, npx, uvx, xargs, python -m, ...). It also blocks
// mentions that would not run the store (`echo mem0`), which is the cost of
// erring that way.
//
// Out of reach of any text check, and not claimed: a name assembled at run
// time (`$STORE`, `x=me; ${x}m0`, `$(printf mem%s 0)`), an alias or function
// defined outside the command, a script or program that calls the store
// itself, a glob with fewer than two literal characters (`m*`, `*`, which
// would match nearly every name), and characters that only look like the
// name (another alphabet's letters name another program).

import { posix } from "node:path";

/**
 * Store CLIs blocked by default: the stores the adapters name, and the Engram
 * CLI itself, which takes --as and --member as given and so would let a model
 * write, confirm and approve as anyone (review finding P5-2).
 */
export const STORE_COMMANDS: readonly string[] = ["mem0", "letta", "engram"];

/** Suffixes an executable name may carry on Windows or as a script. */
const EXECUTABLE = /\.(exe|cmd|bat|com|ps1|sh|py|js|mjs|cjs)$/i;
/** Most words a brace expansion may produce before the check stops expanding. */
const BRACE_LIMIT = 256;

/** A C escape sequence at the start of `s` (after its backslash), decoded, with its length. */
function cEscape(s: string): [string, number] | undefined {
  const simple: Record<string, string> = {
    n: "\n",
    t: "\t",
    r: "\r",
    a: "\x07",
    b: "\b",
    e: "\x1b",
    E: "\x1b",
    f: "\f",
    v: "\v",
    "\\": "\\",
    "'": "'",
    '"': '"',
    "?": "?",
  };
  const c = s[0];
  if (c === undefined) return undefined;
  if (c in simple) return [simple[c] as string, 1];
  const hex = /^x([0-9a-fA-F]{1,2})/.exec(s);
  if (hex) return [String.fromCharCode(Number.parseInt(hex[1] as string, 16)), hex[0].length];
  const oct = /^[0-7]{1,3}/.exec(s);
  if (oct) return [String.fromCharCode(Number.parseInt(oct[0], 8) & 0xff), oct[0].length];
  const uni = /^u([0-9a-fA-F]{1,4})|^U([0-9a-fA-F]{1,8})/.exec(s);
  if (uni) {
    const code = Number.parseInt((uni[1] ?? uni[2]) as string, 16);
    return [code <= 0x10ffff ? String.fromCodePoint(code) : "", uni[0].length];
  }
  const ctl = /^c(.)/.exec(s);
  if (ctl) return [String.fromCharCode((ctl[1] as string).charCodeAt(0) & 0x1f), 2];
  return undefined;
}

/** `s` with its C escapes decoded; an unknown escape keeps its character. */
function decodeEscapes(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== "\\") {
      out += s[i];
      continue;
    }
    const decoded = cEscape(s.slice(i + 1));
    if (decoded) {
      out += decoded[0];
      i += decoded[1];
    } else {
      out += s[i + 1] ?? "";
      i += 1;
    }
  }
  return out;
}

/** `$'...'` quoting decoded in place, the way bash reads it. */
function decodeAnsiC(command: string): string {
  return command.replace(/\$'((?:[^'\\]|\\.)*)'?/gs, (_, body: string) => decodeEscapes(body));
}

/** The alternatives of one brace group's body, or undefined when bash would leave it as it is. */
function braceAlternatives(body: string): string[] | undefined {
  if (body.includes(",")) return body.split(",");
  const range = /^(-?\d+|[a-zA-Z])\.\.(-?\d+|[a-zA-Z])(?:\.\.(-?\d+))?$/.exec(body);
  if (!range) return undefined;
  const [, from, to, by] = range as unknown as [string, string, string, string | undefined];
  const numeric = /\d/.test(from) && /\d/.test(to);
  const a = numeric ? Number(from) : from.charCodeAt(0);
  const b = numeric ? Number(to) : to.charCodeAt(0);
  const step = Math.max(1, Math.abs(Number(by ?? 1)));
  const out: string[] = [];
  for (let v = a; a <= b ? v <= b : v >= b; v += a <= b ? step : -step) {
    out.push(numeric ? String(v) : String.fromCharCode(v));
    if (out.length > BRACE_LIMIT) break;
  }
  return out;
}

/**
 * The words one whitespace-free word expands to under brace expansion,
 * innermost group first. A group bash would not expand (`{x}`, `${X:-y}`)
 * becomes a space, so its contents are still searched.
 */
function expandBraces(word: string): string[] {
  let words = [word];
  for (let round = 0; round < BRACE_LIMIT; round++) {
    let changed = false;
    const next: string[] = [];
    for (const w of words) {
      const m = /\{([^{}]*)\}/.exec(w);
      if (!m) {
        next.push(w);
        continue;
      }
      changed = true;
      const head = w.slice(0, m.index);
      const tail = w.slice(m.index + m[0].length);
      const alternatives = braceAlternatives(m[1] as string);
      if (alternatives === undefined) next.push(`${head} ${m[1]} ${tail}`);
      else next.push(...alternatives.map((alt) => head + alt + tail));
    }
    words = next;
    if (!changed || words.length > BRACE_LIMIT) break;
  }
  return words;
}

/** The command as a shell would read its words: continuations joined, `$'...'` decoded, `^` dropped, braces expanded. */
function normalise(command: string): string {
  const joined = decodeAnsiC(command.replace(/\\\r?\n/g, "")).replaceAll("^", "");
  return joined
    .split(/(\s+)/)
    .map((w) => (/\{[^{}]*\}/.test(w) ? expandBraces(w).join(" ") : w))
    .join("");
}

/** The words of a shell command: split at whitespace and shell operators, quotes removed. */
export function commandWords(command: string): string[] {
  return normalise(command)
    .replace(/["']/g, "")
    .split(/[\s;&|(){}<>$`]+/)
    .filter((w) => w.length > 0);
}

/** The names a word may invoke: its last path segment, under each spelling the check reads. */
function names(word: string): string[] {
  const out = new Set<string>();
  const spellings = new Set([word, word.replaceAll("+", "")]);
  for (const spelling of spellings) {
    for (const part of spelling.split(/[=:@]/)) {
      for (const variant of [part, part.replaceAll("\\", ""), decodeEscapes(part)]) {
        const last = variant.split(/[\\/]/).pop() ?? "";
        out.add(
          last
            .replace(/^[-!]+/, "")
            .replace(EXECUTABLE, "")
            .toLowerCase(),
        );
      }
    }
  }
  return [...out];
}

/** A glob word as a pattern over a whole name, if it is one with at least two literal characters. */
function globPattern(name: string): RegExp | undefined {
  if (!/[*?[]/.test(name)) return undefined;
  let source = "";
  let literals = 0;
  for (let i = 0; i < name.length; i++) {
    const c = name[i] as string;
    if (c === "*") source += ".*";
    else if (c === "?") source += ".";
    else if (c === "[") {
      const close = name.indexOf("]", i + 2);
      if (close === -1) {
        source += "\\[";
        literals++;
        continue;
      }
      let body = name.slice(i + 1, close);
      const negated = body.startsWith("!") || body.startsWith("^");
      if (negated) body = body.slice(1);
      source += `[${negated ? "^" : ""}${body.replace(/[\\\]]/g, "\\$&")}]`;
      literals++;
      i = close;
    } else {
      source += c.replace(/[.+^${}()|\\]/g, "\\$&");
      literals++;
    }
  }
  if (literals < 2) return undefined;
  try {
    return new RegExp(`^${source}$`, "i");
  } catch {
    return undefined;
  }
}

/**
 * Other spellings of a store's CLI than its name (review finding P5-18): the
 * Engram CLI is also reached as the package `@engram/cli` (npx, pnpm dlx,
 * `pnpm --filter`, with or without a version) and through its workspace
 * folder `packages/cli` (its entry script `packages/cli/src/main.ts`, `cd`
 * into it, `--filter ./packages/cli`). Each word is read with backslashes as
 * slashes and in lower case, and also as a normalised path (review finding
 * P5-20: `packages//cli`, `packages/./cli`, `packages/x/../cli`). Two more
 * spellings reach the folder or its entry script from elsewhere: `../cli`
 * (from a sibling package) and `cli/src/main.ts` under any prefix. The cost:
 * any other folder named `cli` beside the cwd, and any `cli/src/main.ts`, is
 * refused too.
 */
const ROUTES: Readonly<Record<string, readonly RegExp[]>> = {
  engram: [
    /(^|[^a-z0-9])@engram\/cli(@|$)/,
    /(^|\/)packages\/cli(\/|$)/,
    /(^|\/)\.\.\/cli(\/|$)/,
    /(^|\/)cli\/src\/main\.ts$/,
  ],
};

/** The store `command` names anywhere in it, if any (decision D10). */
export function blockedStoreCommand(
  command: string,
  stores: readonly string[],
): string | undefined {
  const byName = new Map(stores.map((s) => [s.toLowerCase(), s]));
  // PowerShell's escape character is the backtick: also read the command with it removed.
  const words = commandWords(command);
  if (command.includes("`")) words.push(...commandWords(command.replaceAll("`", "")));
  for (const word of words) {
    const slashed = word.replaceAll("\\", "/").toLowerCase();
    // As written, and as a path: `//` collapsed, `.` and `x/..` resolved (P5-20).
    const spellings = [slashed, posix.normalize(slashed)];
    for (const store of stores)
      if ((ROUTES[store.toLowerCase()] ?? []).some((r) => spellings.some((w) => r.test(w))))
        return store;
    for (const name of names(word)) {
      const store = byName.get(name);
      if (store !== undefined) return store;
      const glob = globPattern(name);
      if (glob) {
        const matched = stores.find((s) => glob.test(s));
        if (matched !== undefined) return matched;
      }
    }
  }
  return undefined;
}

/** Words of a shell command that may be paths, for the store-root check (decision D10). */
export function pathWords(command: string): string[] {
  return commandWords(command)
    .flatMap((w) => w.split("="))
    .filter((w) => /[\\/]|^~|^\./.test(w));
}
