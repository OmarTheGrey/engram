// Generates packages/core/src/vendor/gitleaks-rules.ts from gitleaks' rule
// file at a pinned commit (card E2.9, ADR 0039, ADR 0037 mode port, as
// generated data). Only the rules that translate to a JavaScript regular
// expression and pass admission (scripts/admission.ts: growth under 6 times
// from n to 4n, and cost under 20 times gitleaks' keyword prefix, both ratios
// of timings on one machine, so the verdict does not depend on its speed)
// are admitted; every other rule is listed in the output with why it was
// left out. `make gitleaks-rules` runs it.
//
//   node packages/core/scripts/gitleaks-rules.ts [--toml <gitleaks.toml>] [--out <file.ts>]
//
// Without --toml the file is read from .engram/upstream/ and fetched there at
// the pinned commit when missing (data only; refused under ENGRAM_OFFLINE=1).
// Its sha256 is checked against the pin either way.
//
// Translation from Go's RE2 to JavaScript:
// - a leading `(?i)` becomes the `i` flag; a later `(?i)` becomes a `(?i:...)`
//   modifier group running to the end of its enclosing group, reopened after
//   each `|` of that group, which is what the flag means in RE2;
// - POSIX classes inside a bracket (`[[:alnum:]]`) become ranges;
// - `\z` and `\A` become `$` and `^` (no multiline flag, so the same);
// - `(?P<name>` becomes `(?<name>`;
// - anything else RE2 has and JavaScript lacks (`\Q`, `\p`, other inline
//   flags) leaves the rule out.
// A rule scoped to a file path (`path =`) or with no regex leaves out too,
// since memory content has no path. An allowlist that only names paths, or
// that needs a path (condition AND), is dropped, since it can never apply.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { admission } from "./admission.ts";

export const GITLEAKS_REPOSITORY = "gitleaks/gitleaks";
export const GITLEAKS_COMMIT = "5f6ec56cfa6f8c67648d863582c7ae2f206d5c1c";
export const GITLEAKS_TOML_SHA256 =
  "e163e53b9e7e8a8511e77271e2b323ed057759542a6d988258afe3a1fa329caf";

const REPO = resolve(import.meta.dirname, "../../..");
const DEFAULT_TOML = join(
  REPO,
  `.engram/upstream/gitleaks_gitleaks@${GITLEAKS_COMMIT.slice(0, 12)}/config/gitleaks.toml`,
);
const DEFAULT_OUT = join(REPO, "packages/core/src/vendor/gitleaks-rules.ts");

// ---------------------------------------------------------------------------
// A reader for the subset of TOML gitleaks.toml uses: comments, `[table]`,
// `[[array.of.tables]]`, and `key = value` with literal (''') or basic (")
// strings, numbers, and arrays of strings that may span lines.

type Value = string | number | Value[];
type Table = Record<string, Value>;

export interface Toml {
  allowlist: Table;
  rules: (Table & { allowlists: Table[] })[];
}

export function readToml(text: string): Toml {
  const doc: Toml = { allowlist: {}, rules: [] };
  let table: Table = {};
  let i = 0;
  const ws = () => {
    while (i < text.length) {
      if (text[i] === "#") while (i < text.length && text[i] !== "\n") i++;
      else if (/\s/.test(text[i] as string)) i++;
      else break;
    }
  };
  const value = (): Value => {
    if (text.startsWith("'''", i)) {
      const end = text.indexOf("'''", i + 3);
      const v = text.slice(i + 3, end);
      i = end + 3;
      return v;
    }
    if (text[i] === "'") {
      const end = text.indexOf("'", i + 1);
      const v = text.slice(i + 1, end);
      i = end + 1;
      return v;
    }
    if (text[i] === '"') {
      let j = i + 1;
      while (text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      const v = JSON.parse(text.slice(i, j + 1)) as string;
      i = j + 1;
      return v;
    }
    if (text[i] === "[") {
      i++;
      const items: Value[] = [];
      for (;;) {
        ws();
        if (text[i] === "]") {
          i++;
          return items;
        }
        items.push(value());
        ws();
        if (text[i] === ",") i++;
      }
    }
    const m = /^-?\d+(?:\.\d+)?/.exec(text.slice(i));
    if (!m) throw new Error(`gitleaks.toml: unreadable value at offset ${i}`);
    i += m[0].length;
    return Number(m[0]);
  };
  for (;;) {
    ws();
    if (i >= text.length) return doc;
    if (text.startsWith("[[", i)) {
      const end = text.indexOf("]]", i);
      const name = text.slice(i + 2, end).trim();
      i = end + 2;
      if (name === "rules") {
        const rule = { allowlists: [] as Table[] };
        doc.rules.push(rule as Toml["rules"][number]);
        table = rule as unknown as Table;
      } else if (name === "rules.allowlists") {
        table = {};
        (doc.rules.at(-1) as Toml["rules"][number]).allowlists.push(table);
      } else throw new Error(`gitleaks.toml: unknown table [[${name}]]`);
      continue;
    }
    if (text[i] === "[") {
      const end = text.indexOf("]", i);
      const name = text.slice(i + 1, end).trim();
      i = end + 1;
      if (name !== "allowlist") throw new Error(`gitleaks.toml: unknown table [${name}]`);
      table = doc.allowlist;
      continue;
    }
    const m = /^([A-Za-z0-9_]+)\s*=\s*/.exec(text.slice(i));
    if (!m) throw new Error(`gitleaks.toml: unreadable line at offset ${i}`);
    i += m[0].length;
    table[m[1] as string] = value();
  }
}

// ---------------------------------------------------------------------------
// RE2 to JavaScript.

const POSIX: Record<string, string> = {
  alnum: "A-Za-z0-9",
  alpha: "A-Za-z",
  digit: "0-9",
  xdigit: "0-9A-Fa-f",
  upper: "A-Z",
  lower: "a-z",
  space: " \\t\\r\\n\\v\\f",
  word: "A-Za-z0-9_",
};

export type Translated = { source: string; flags: string } | { error: string };

export function translate(pattern: string): Translated {
  let flags = "";
  let s = pattern;
  if (s.startsWith("(?i)")) {
    flags = "i";
    s = s.slice(4);
  }
  let out = "";
  let inClass = false;
  let depth = 0;
  // The group depths at which a `(?i:` this translation opened is still open.
  const open: number[] = [];
  const closeAt = (d: number) => {
    let n = 0;
    while (open.at(-1) === d) {
      open.pop();
      n++;
    }
    return n;
  };
  for (let i = 0; i < s.length; i++) {
    const c = s[i] as string;
    if (c === "\\") {
      const n = s[i + 1];
      if (n === undefined) return { error: "a trailing backslash" };
      i++;
      if (!inClass && n === "z") out += "$";
      else if (!inClass && n === "A") out += "^";
      else if ("QEpPCZ".includes(n)) return { error: `\\${n} has no JavaScript equivalent` };
      else out += c + n;
      continue;
    }
    if (inClass) {
      if (c === "[" && s[i + 1] === ":") {
        const end = s.indexOf(":]", i + 2);
        const range = POSIX[s.slice(i + 2, end)];
        if (end === -1 || range === undefined)
          return { error: "a POSIX class with no JavaScript range" };
        out += range;
        i = end + 1;
        continue;
      }
      if (c === "]") inClass = false;
      out += c;
      continue;
    }
    if (c === "[") {
      inClass = true;
      out += c;
      if (s[i + 1] === "^") {
        out += "^";
        i++;
      }
      if (s[i + 1] === "]") {
        out += "\\]";
        i++;
      }
      continue;
    }
    if (c === "(") {
      if (s.startsWith("(?i)", i)) {
        out += "(?i:";
        open.push(depth);
        i += 3;
        continue;
      }
      if (s.startsWith("(?P<", i)) {
        out += "(?<";
        i += 3;
        depth++;
        continue;
      }
      if (s[i + 1] === "?" && !/^\(\?(?::|=|!|<=|<!|<[A-Za-z]|-i:|i:)/.test(s.slice(i)))
        return { error: "an inline flag JavaScript does not have" };
      depth++;
      out += c;
      continue;
    }
    if (c === "|") {
      const n = closeAt(depth);
      if (n > 0) {
        out += `${")".repeat(n)}|(?i:`;
        open.push(depth);
      } else out += c;
      continue;
    }
    if (c === ")") {
      out += ")".repeat(closeAt(depth));
      depth--;
      out += c;
      continue;
    }
    out += c;
  }
  out += ")".repeat(open.length);
  try {
    new RegExp(out, `${flags}g`);
  } catch (e) {
    return { error: `JavaScript refuses it: ${(e as Error).message}` };
  }
  return { source: out, flags };
}

// ---------------------------------------------------------------------------
// The output.

interface OutAllow {
  target: "secret" | "match" | "line";
  regexes: [string, string][];
  stopwords: string[];
}

interface OutRule {
  id: string;
  source: string;
  flags: string;
  keywords: string[];
  entropy?: number;
  group?: number;
  allow?: OutAllow[];
}

const strings = (v: Value | undefined): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

function allowOf(t: Table, dropped: string[], where: string): OutAllow | null {
  const regexes = strings(t.regexes);
  const stopwords = strings(t.stopwords).map((w) => w.toLowerCase());
  if (t.condition === "AND" && t.paths !== undefined) return null;
  if (regexes.length === 0 && stopwords.length === 0) return null;
  const kept: [string, string][] = [];
  for (const r of regexes) {
    const tr = translate(r);
    if ("error" in tr) dropped.push(`${where}: an allowlist regex is dropped (${tr.error})`);
    else kept.push([tr.source, tr.flags]);
  }
  const target = (t.regexTarget ?? "secret") as OutAllow["target"];
  return { target, regexes: kept, stopwords };
}

export function generate(text: string): string {
  const doc = readToml(text);
  const notes: string[] = [];
  const left: [string, string][] = [];
  const rules: OutRule[] = [];
  for (const r of doc.rules) {
    const id = String(r.id);
    if (typeof r.regex !== "string") {
      left.push([id, "it has no regex"]);
      continue;
    }
    if (r.path !== undefined) {
      left.push([id, "it applies to a file path only"]);
      continue;
    }
    const tr = translate(r.regex);
    if ("error" in tr) {
      left.push([id, tr.error]);
      continue;
    }
    const keywords = strings(r.keywords).map((k) => k.toLowerCase());
    const admitted = admission(tr.source, tr.flags, keywords);
    if (!admitted.admitted) {
      left.push([id, admitted.why]);
      continue;
    }
    const out: OutRule = { id, source: tr.source, flags: tr.flags, keywords };
    if (typeof r.entropy === "number") out.entropy = r.entropy;
    if (typeof r.secretGroup === "number") out.group = r.secretGroup;
    const allow = r.allowlists
      .map((t) => allowOf(t, notes, id))
      .filter((a): a is OutAllow => a !== null);
    if (allow.length > 0) out.allow = allow;
    rules.push(out);
  }
  const global = allowOf(doc.allowlist, notes, "global") as OutAllow;
  const json = (v: unknown) => JSON.stringify(v, null, 2);
  return `// GENERATED by packages/core/scripts/gitleaks-rules.ts; do not edit by hand.
//
// Ported (ADR 0037, mode port, as generated data) from gitleaks
// (https://github.com/${GITLEAKS_REPOSITORY}), config/gitleaks.toml at commit
// ${GITLEAKS_COMMIT} (sha256 ${GITLEAKS_TOML_SHA256}).
// Copyright (c) 2019 Zachary Rice. Licensed under the MIT License.
// The rule ids, regular expressions (translated from RE2 to JavaScript),
// keywords, entropy floors and allowlists are gitleaks'; descriptions,
// file-path rules and path allowlists are left out (card E2.9).
//
// ${rules.length} of ${doc.rules.length} rules admitted; ${left.length} left out (GITLEAKS_LEFT_OUT).

/** One gitleaks rule as JavaScript: its source and flags are compiled with \`g\` added. */
export interface GitleaksRule {
  id: string;
  source: string;
  flags: string;
  /** The rule runs only on content holding one of these, lower-cased. */
  keywords: string[];
  /** The Shannon entropy floor of the secret, when the rule has one. */
  entropy?: number;
  /** The capture group holding the secret; else the first non-empty group, else the match. */
  group?: number;
  allow?: GitleaksAllow[];
}

/** An allowlist: a finding whose target matches a regex, or whose secret holds a stopword, is dropped. */
export interface GitleaksAllow {
  target: "secret" | "match" | "line";
  regexes: [source: string, flags: string][];
  stopwords: string[];
}

export const GITLEAKS_RULES: readonly GitleaksRule[] = ${json(rules)};

/** The global allowlist, applied to every gitleaks rule's secret. */
export const GITLEAKS_ALLOW: GitleaksAllow = ${json(global)};

/** The rules not admitted, with why. */
export const GITLEAKS_LEFT_OUT: readonly [id: string, why: string][] = ${json(left)};

/** What was dropped from the admitted rules' allowlists, with why. */
export const GITLEAKS_NOTES: readonly string[] = ${json(notes)};
`;
}

async function tomlText(path: string): Promise<string> {
  if (!existsSync(path)) {
    if (process.env.ENGRAM_OFFLINE === "1")
      throw new Error(`${path} is missing and ENGRAM_OFFLINE=1 forbids the fetch`);
    const url = `https://raw.githubusercontent.com/${GITLEAKS_REPOSITORY}/${GITLEAKS_COMMIT}/config/gitleaks.toml`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`fetch ${url}: ${response.status}`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, Buffer.from(await response.arrayBuffer()));
  }
  const bytes = readFileSync(path);
  const sha = createHash("sha256").update(bytes).digest("hex");
  if (sha !== GITLEAKS_TOML_SHA256)
    throw new Error(`${path}: sha256 ${sha} differs from the pin ${GITLEAKS_TOML_SHA256}`);
  return bytes.toString("utf8");
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: { toml: { type: "string" }, out: { type: "string" } },
  });
  const text = await tomlText(values.toml ?? DEFAULT_TOML);
  const out = values.out ?? DEFAULT_OUT;
  writeFileSync(out, generate(text));
  console.log(`gitleaks-rules: wrote ${out}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (e: unknown) => {
      console.error(e instanceof Error ? e.message : e);
      process.exitCode = 1;
    },
  );
