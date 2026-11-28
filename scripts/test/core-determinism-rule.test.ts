// AGENTS.md rules 4, 6 and 7 and crosswalk claim C44 (card E0.7): packages/core
// reads no clock and draws no randomness, so every decision and event time is
// the one its caller injects and a replay reaches the same decisions. The rule
// reads every source under packages/core/src as text with its comments,
// strings and regular expression literals blanked (a template literal's `${}`
// is code and stays), so the comment at src/distill/episode.ts:491 that
// quotes `new Date().toISOString()` is not a call. Refused: Date.now, a
// `new Date` with no argument, Date() called as a function, performance.now,
// process.hrtime, Math.random and the random functions of node:crypto and Web
// Crypto. The two Postgres transport files may call Date.now for their
// connection and query timeouts, and nothing else on the list. Shaped like
// pi-import-rule.test.ts: probes the rule must refuse and probes it must pass,
// then the real tree.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));
const CORE_SRC = join(root, "packages", "core", "src");

/** What may be called where: the Postgres transport's timeouts, and only them. */
const EXEMPT: Readonly<Record<string, readonly string[]>> = {
  "src/db/postgres.ts": ["Date.now"],
  "src/db/postgres-worker.ts": ["Date.now"],
};

/** The refused forms, each a name and a pattern over blanked code. */
const RULES: ReadonlyArray<readonly [string, RegExp]> = [
  ["Date.now", /\bDate\s*\??\.\s*now\b/g],
  ["new Date()", /\bnew\s+Date\s*\(\s*\)|\bnew\s+Date\b(?!\s*[(\w])/g],
  ["Date()", /(?<!\bnew\s+)(?<![\w$.])Date\s*\(/g],
  ["performance.now", /\bperformance\s*\??\.\s*now\b/g],
  ["process.hrtime", /\bprocess\s*\??\.\s*hrtime\b/g],
  ["Math.random", /\bMath\s*\??\.\s*random\b/g],
  [
    "crypto random",
    /\b(?:randomUUID|randomBytes|randomInt|randomFill|randomFillSync|getRandomValues|pseudoRandomBytes)\b/g,
  ],
];

const KEYWORDS_BEFORE_REGEX = new Set([
  "return",
  "typeof",
  "instanceof",
  "in",
  "of",
  "new",
  "delete",
  "void",
  "throw",
  "case",
  "do",
  "else",
  "yield",
  "await",
]);

/**
 * The source with every comment, string, template text and regular expression
 * literal replaced by spaces (newlines kept, so line numbers hold). A
 * template's `${...}` is code and is kept.
 */
function blank(src: string): string {
  const out = src.split("");
  const wipe = (from: number, to: number) => {
    for (let k = from; k < to; k++) if (out[k] !== "\n" && out[k] !== "\r") out[k] = " ";
  };
  // Brace depth per open template expression; the template resumes when its depth returns to 0.
  const templates: number[] = [];
  let i = 0;
  /** The last significant code character and word, to tell a regex from a division. */
  let prev = "";
  let prevWord = "";
  const regexMayStart = () =>
    prev === "" || "(,=:[!&|?{};+-*%<>~^".includes(prev) || KEYWORDS_BEFORE_REGEX.has(prevWord);

  /** Scans template text from i (just after ` or }) to its end or a `${`; returns where code resumes. */
  const templateText = (start: number): number => {
    let j = start;
    while (j < src.length) {
      if (src[j] === "\\") j += 2;
      else if (src[j] === "`") {
        wipe(start, j + 1);
        return j + 1;
      } else if (src[j] === "$" && src[j + 1] === "{") {
        wipe(start, j);
        templates.push(0);
        return j + 2;
      } else j++;
    }
    wipe(start, src.length);
    return src.length;
  };

  while (i < src.length) {
    const c = src[i] as string;
    const n = src[i + 1];
    if (c === "/" && n === "/") {
      const end = src.indexOf("\n", i);
      const stop = end === -1 ? src.length : end;
      wipe(i, stop);
      i = stop;
    } else if (c === "/" && n === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? src.length : end + 2;
      wipe(i, stop);
      i = stop;
    } else if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== c && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
      wipe(i, j + 1);
      i = j + 1;
      prev = "a";
      prevWord = "";
    } else if (c === "`") {
      wipe(i, i + 1);
      const open = templates.length;
      i = templateText(i + 1);
      // Inside a `${`, an expression starts, as after an opening brace.
      prev = templates.length > open ? "{" : "a";
      prevWord = "";
    } else if (c === "/" && regexMayStart()) {
      let j = i + 1;
      let inClass = false;
      while (j < src.length && src[j] !== "\n") {
        if (src[j] === "\\") j += 2;
        else if (src[j] === "[") (inClass = true), j++;
        else if (src[j] === "]") (inClass = false), j++;
        else if (src[j] === "/" && !inClass) break;
        else j++;
      }
      j++;
      while (j < src.length && /[a-z]/i.test(src[j] as string)) j++;
      wipe(i, j);
      i = j;
      prev = "a";
      prevWord = "";
    } else if (c === "{" && templates.length > 0) {
      templates[templates.length - 1]++;
      prev = c;
      prevWord = "";
      i++;
    } else if (c === "}" && templates.length > 0 && templates[templates.length - 1] === 0) {
      templates.pop();
      const open = templates.length;
      i = templateText(i + 1);
      prev = templates.length > open ? "{" : "a";
      prevWord = "";
    } else if (/[\w$]/.test(c)) {
      let j = i;
      while (j < src.length && /[\w$]/.test(src[j] as string)) j++;
      prevWord = src.slice(i, j);
      prev = "a";
      i = j;
    } else {
      if (c === "}" && templates.length > 0) templates[templates.length - 1]--;
      if (!/\s/.test(c)) {
        prev = c === ")" || c === "]" || c === "}" ? "a" : c;
        prevWord = "";
      }
      i++;
    }
  }
  return out.join("");
}

interface Finding {
  rule: string;
  line: number;
}

/** Every refused call in a source, with its line. */
function findings(src: string): Finding[] {
  const code = blank(src);
  const found: Finding[] = [];
  for (const [rule, pattern] of RULES) {
    for (const m of code.matchAll(pattern)) {
      found.push({ rule, line: code.slice(0, m.index).split("\n").length });
    }
  }
  return found.sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule));
}

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
const coreSources = () =>
  walk(CORE_SRC)
    .filter((f) => /\.(?:ts|mts|cts|js|mjs|cjs|tsx)$/.test(f) && !/\.lint-probe-/.test(f))
    .map((f) => ({
      file: relative(join(root, "packages", "core"), f)
        .split("\\")
        .join("/"),
      path: f,
    }));

const REFUSED_PROBES: ReadonlyArray<readonly [string, string]> = [
  ["Date.now", "export const t = Date.now();\n"],
  ["Date.now", "const now = Date.now;\nexport const t = now();\n"],
  ["Date.now", "export const t = Date?.now();\n"],
  ["new Date()", "export const d = new Date();\n"],
  ["new Date()", "export const d = new Date( );\n"],
  ["new Date()", "export const d = new Date;\n"],
  ["Date()", "export const s = Date();\n"],
  ["performance.now", "export const t = performance.now();\n"],
  ["process.hrtime", "export const t = process.hrtime.bigint();\n"],
  ["Math.random", "export const r = Math.random();\n"],
  ["Math.random", "export const s = `${Math.random()}`;\n"],
  ["Math.random", "export const s = `a${`b${Math.random()}`}c`;\n"],
  ["crypto random", 'import { randomUUID } from "node:crypto";\nexport const id = randomUUID();\n'],
  ["crypto random", "export const b = crypto.getRandomValues(new Uint8Array(4));\n"],
  [
    "crypto random",
    'import { randomBytes } from "node:crypto";\nexport const b = randomBytes(8);\n',
  ],
];

const PASSING_PROBES: readonly string[] = [
  "/** pi writes ISO 8601 times (`new Date().toISOString()`); anything else is not kept. */\nexport {};\n",
  "// Date.now() and Math.random() are never called here.\nexport {};\n",
  "/* performance.now() */ export {};\n",
  'export const s = "Date.now() Math.random() new Date()";\n',
  "export const s = 'Date.now()';\n",
  "export const s = `Date.now() and ${1 + 1} new Date()`;\n",
  "export const r = /Date\\.now\\(\\)|Math.random/;\n",
  "export const d = (at: string) => new Date(at);\n",
  "export const d = (ms: number) => new Date(ms).toISOString();\n",
  "export const p = Date.parse('2026-11-28T00:00:00Z');\n",
  "export const u = Date.UTC(2026, 10, 28);\n",
  "export type T = { at: Date };\nexport const isDate = (x: unknown): x is Date => x instanceof Date;\n",
  "export const myDate = (x: number) => x;\nexport const y = myDate(1);\n",
  "export const half = (a: number, b: number) => a / b / 2;\nexport const r = (Date: string) => Date;\n",
  'import { createHash } from "node:crypto";\nexport const h = createHash("sha256");\n',
];

describe("the core determinism rule", () => {
  test.each(REFUSED_PROBES)("refuses %s in %j", (rule, source) => {
    expect(findings(source).map((f) => f.rule)).toContain(rule);
  });

  test.each(PASSING_PROBES)("passes %j", (source) => {
    expect(findings(source)).toEqual([]);
  });

  test("blanking keeps the length and every line break, so a finding's line is the source's", () => {
    const src = "// a\nconst x = `t\n${Date.now()}`; /* b\n c */ 'd';\n";
    const code = blank(src);
    expect(code).toHaveLength(src.length);
    expect(code.split("\n")).toHaveLength(src.split("\n").length);
    expect(findings(src)).toEqual([{ rule: "Date.now", line: 3 }]);
  });

  test("a template expression is code, a regular expression inside it included", () => {
    expect(findings("export const s = `${/x/.test(y) ? Date.now() : 0}`;\n")).toEqual([
      { rule: "Date.now", line: 1 },
    ]);
  });

  test("the transport's Date.now calls are found at the lines crosswalk claim C44 names, so each file is read to its end", () => {
    const lines = (file: string) =>
      findings(readFileSync(join(root, "packages", "core", file), "utf8")).map((f) => f.line);
    expect(lines("src/db/postgres-worker.ts")).toEqual([34, 41, 54]);
    expect(lines("src/db/postgres.ts")).toEqual([211, 229]);
  });

  test("every core source blanks to balanced brackets, so no string, comment or regex was misread", () => {
    const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
    const unbalanced = coreSources().flatMap(({ file, path }) => {
      const stack: string[] = [];
      for (const ch of blank(readFileSync(path, "utf8"))) {
        if (ch === "(" || ch === "[" || ch === "{") stack.push(ch);
        else if (ch in pairs && stack.pop() !== pairs[ch]) return [file];
      }
      return stack.length === 0 ? [] : [file];
    });
    expect(unbalanced).toEqual([]);
  });

  test("the comment at src/distill/episode.ts that quotes new Date() passes", () => {
    const text = readFileSync(join(CORE_SRC, "distill", "episode.ts"), "utf8");
    expect(text).toContain("`new Date().toISOString()`");
    expect(findings(text)).toEqual([]);
  });

  test("no source under packages/core/src reads the clock or draws randomness, outside the Postgres transport's timeouts", () => {
    const sources = coreSources();
    expect(sources.length).toBeGreaterThan(50);
    const refused = sources.flatMap(({ file, path }) =>
      findings(readFileSync(path, "utf8"))
        .filter((f) => !(EXEMPT[file] ?? []).includes(f.rule))
        .map((f) => `${file}:${f.line} ${f.rule}`),
    );
    expect(refused).toEqual([]);
  });

  test("each exemption is still used, so a stale one is removed rather than kept", () => {
    for (const [file, rules] of Object.entries(EXEMPT)) {
      const used = new Set(
        findings(readFileSync(join(root, "packages", "core", file), "utf8")).map((f) => f.rule),
      );
      for (const rule of rules) expect(used.has(rule), `${file} ${rule}`).toBe(true);
    }
  });
});
