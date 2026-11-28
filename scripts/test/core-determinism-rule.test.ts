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

/** The objects whose members read the clock or draw randomness. */
const SOURCES = String.raw`(?:Date|Math|performance|process|crypto|Intl|Temporal|globalThis)`;
/** Their members that do. */
const MEMBERS = String.raw`(?:now|random|hrtime|randomUUID|randomBytes|randomInt|randomFill|randomFillSync|getRandomValues|pseudoRandomBytes)`;
/** `globalThis.` before a name, or nothing. */
const G = String.raw`(?:globalThis\s*\??\.\s*)?`;

/**
 * The refused forms, each a name and a pattern over blanked code. What a text
 * rule cannot see is named in docs/conventions/testing.md and in crosswalk
 * claim C44's limits: an alias of Math, performance, process or crypto through
 * another name, a stored Intl formatter's format(), eval or Function, Reflect,
 * and code core imports from a dependency.
 */
const RULES: ReadonlyArray<readonly [string, RegExp]> = [
  ["Date.now", /\bDate\s*\??\.\s*now\b/g],
  [
    "new Date()",
    new RegExp(
      String.raw`\bnew\s+(?:\(\s*${G}Date\s*\)|${G}Date)\s*\(\s*\)|\bnew\s+(?:\(\s*${G}Date\s*\)|${G}Date\b)(?!\s*[(\w.])`,
      "g",
    ),
  ],
  ["Date()", new RegExp(String.raw`(?<!\bnew\s+)(?<![\w$.])${G}Date\s*\(`, "g")],
  ["performance.now", /\bperformance\s*\??\.\s*now\b/g],
  ["hrtime", /\bhrtime\b/g],
  ["Math.random", /\bMath\s*\??\.\s*random\b/g],
  [
    "crypto random",
    /\b(?:randomUUID|randomBytes|randomInt|randomFill|randomFillSync|getRandomValues|pseudoRandomBytes)\b/g,
  ],
  // A member read by a computed name: after blanking, `Date['now']` is `Date[     ]`.
  ["computed access", new RegExp(String.raw`\b${SOURCES}\s*(?:\?\.)?\s*\[`, "g")],
  [
    "destructured",
    new RegExp(String.raw`\{[^{}]*\b${MEMBERS}\b[^{}]*\}\s*=\s*${G}${SOURCES}\b`, "g"),
  ],
  // Date passed or bound as a value, so its now() is reached through another name.
  // A type alias (`type D = Date;`) is a type, not a value.
  [
    "Date as a value",
    new RegExp(String.raw`(?:(?<!\btype\s+[\w$]+\s*)=|[(,?])\s*${G}Date\s*(?=[;,)])`, "g"),
  ],
  // An argument-free format() of a fresh DateTimeFormat formats the current time.
  ["Intl clock", /\bDateTimeFormat\s*\([^()]*\)\s*\.\s*format(?:ToParts)?\s*\(\s*\)/g],
  ["Temporal.Now", /\bTemporal\s*\??\.\s*Now\b/g],
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
  /** An operand just ended (a name, a literal, a closing bracket), not a keyword such as return. */
  const operandEnded = () => prev === "a" && !KEYWORDS_BEFORE_REGEX.has(prevWord);
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
        else if (src[j] === "[" || src[j] === "]") {
          inClass = src[j] === "[";
          j++;
        } else if (src[j] === "/" && !inClass) break;
        else j++;
      }
      j++;
      while (j < src.length && /[a-z]/i.test(src[j] as string)) j++;
      wipe(i, j);
      i = j;
      prev = "a";
      prevWord = "";
    } else if (c === "{" && templates.length > 0) {
      templates[templates.length - 1] = (templates[templates.length - 1] ?? 0) + 1;
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
    } else if (operandEnded() && c === "!" && src[i + 1] !== "=") {
      // A non-null assertion (`x!`) ends an operand; `!=` and `!==` are operators.
      prevWord = "";
      i++;
    } else if (operandEnded() && (c === "+" || c === "-") && src[i + 1] === c) {
      // A postfix ++ or -- ends an operand.
      prevWord = "";
      i += 2;
    } else {
      if (c === "}" && templates.length > 0)
        templates[templates.length - 1] = (templates[templates.length - 1] ?? 0) - 1;
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
  ["hrtime", "export const t = process.hrtime.bigint();\n"],
  ["hrtime", 'import { hrtime } from "node:process";\nexport const t = hrtime();\n'],
  ["Math.random", "export const r = Math.random();\n"],
  // biome-ignore lint/suspicious/noTemplateCurlyInString: probe source text, not a template
  ["Math.random", "export const s = `${Math.random()}`;\n"],
  // biome-ignore lint/suspicious/noTemplateCurlyInString: probe source text, not a template
  ["Math.random", "export const s = `a${`b${Math.random()}`}c`;\n"],
  ["crypto random", 'import { randomUUID } from "node:crypto";\nexport const id = randomUUID();\n'],
  ["crypto random", "export const b = crypto.getRandomValues(new Uint8Array(4));\n"],
  [
    "crypto random",
    'import { randomBytes } from "node:crypto";\nexport const b = randomBytes(8);\n',
  ],
  // A division after a non-null assertion or a postfix ++ or -- is not a regex (review finding 1).
  ["Date.now", "export const r = (total: number) => total! / Date.now();\n"],
  ["Date.now", "export const z = (arr: number[]) => arr[0]! / Date.now();\n"],
  ["Date.now", "let i = 0;\nexport const x = i++ / 2 + Date.now() / 3;\n"],
  ["Date.now", "let a = 0;\nexport const x = a-- / Date.now();\n"],
  // Aliased and indirect forms a text rule can see (review finding 2).
  ["computed access", "export const t = Date['now']();\n"],
  ["computed access", 'export const r = Math["random"]();\n'],
  ["computed access", "export const r = globalThis['Math'].random;\n"],
  ["destructured", "const { now } = Date;\nexport const t = now();\n"],
  ["destructured", "const { random: r } = Math;\nexport const x = r();\n"],
  ["destructured", "const { hrtime } = process;\nexport const t = hrtime;\n"],
  ["Date as a value", "const D = Date;\nexport const t = D.now();\n"],
  ["Date as a value", "export const f = (make: (c: DateConstructor) => number) => make(Date);\n"],
  ["new Date()", "export const d = new globalThis.Date();\n"],
  ["new Date()", "export const d = new (Date)();\n"],
  ["Date()", "export const s = globalThis.Date();\n"],
  ["Intl clock", "export const s = new Intl.DateTimeFormat('en').format();\n"],
  ["Intl clock", "export const s = Intl.DateTimeFormat().formatToParts();\n"],
  ["Temporal.Now", "export const t = Temporal.Now.instant();\n"],
];

const PASSING_PROBES: readonly string[] = [
  "/** pi writes ISO 8601 times (`new Date().toISOString()`); anything else is not kept. */\nexport {};\n",
  "// Date.now() and Math.random() are never called here.\nexport {};\n",
  "/* performance.now() */ export {};\n",
  'export const s = "Date.now() Math.random() new Date()";\n',
  "export const s = 'Date.now()';\n",
  // biome-ignore lint/suspicious/noTemplateCurlyInString: probe source text, not a template
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
  "export const ok = (x: number | undefined) => x! / 2 + /re/.test('a') ? 1 : 0;\n",
  "export const n = (a: boolean) => !a ? /x/.source : '';\n",
  "export const ne = (a: number, b: number) => a !== b;\n",
  "export const d = (at: string) => new globalThis.Date(at);\n",
  "export type Clockless = { at: Date; f: () => Date };\ntype D = Date;\nexport const x: D | undefined = undefined;\n",
  "export const m = (x: Map<string, Date>, y: Array<[string, Date]>) => [x, y];\n",
  "export const fmt = (ms: number) => new Intl.DateTimeFormat('en').format(ms);\n",
  "const { env } = process;\nexport const e = env;\n",
  "export const k = (s: string) => {\n  return !/x/.test(s) ? 1 : 0;\n};\n",
  "export const j = (s: string) => {\n  return ++s.length / 2;\n};\n",
];

describe("the core determinism rule", () => {
  test.each(REFUSED_PROBES)("refuses %s in %j", (rule, source) => {
    expect(findings(source).map((f) => f.rule)).toContain(rule);
  });

  test.each(PASSING_PROBES)("passes %j", (source) => {
    expect(findings(source)).toEqual([]);
  });

  test("blanking keeps the length and every line break, so a finding's line is the source's", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: probe source text, not a template
    const src = "// a\nconst x = `t\n${Date.now()}`; /* b\n c */ 'd';\n";
    const code = blank(src);
    expect(code).toHaveLength(src.length);
    expect(code.split("\n")).toHaveLength(src.split("\n").length);
    expect(findings(src)).toEqual([{ rule: "Date.now", line: 3 }]);
  });

  test("a template expression is code, a regular expression inside it included", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: probe source text, not a template
    expect(findings("export const s = `${/x/.test(y) ? Date.now() : 0}`;\n")).toEqual([
      { rule: "Date.now", line: 1 },
    ]);
  });

  test("the transport's Date.now calls are found at lines 34, 41, 54 and 211, 229, so each file is read to its end", () => {
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
