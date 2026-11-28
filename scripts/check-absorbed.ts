// The register check of ADR 0037 (decision 8, card E0.6): every row of
// docs/absorbed.md has seven cells, a full commit hash, a licence expression
// every part of which is on the copy-or-port list (CC-BY-4.0 for a mode marked
// "(data)" only), a mode of copy or port, and at least one landed path in
// backticks that exists; a copy also has an entry in NOTICE (a block between
// rule lines) that names both its source repository and one of its landed
// paths, each as a whole name. A table row the table does not hold (after a
// blank line) is reported too. Run by `make lint-docs`; the red fixture is
// fixtures/ci/absorbed-red/.
import { existsSync, readFileSync } from "node:fs";

export const REGISTER = "docs/absorbed.md";
export const NOTICE = "NOTICE";

/** Licences ADR 0037 (decision 1) allows for copy or port, as SPDX ids. */
export const COPY_OR_PORT: ReadonlySet<string> = new Set([
  "MIT",
  "ISC",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "0BSD",
  "Apache-2.0",
  "Unlicense",
  "CC0-1.0",
]);

/** Licences ADR 0037 (decision 2) allows for data only. */
export const DATA_ONLY: ReadonlySet<string> = new Set(["CC-BY-4.0"]);

/** The convention's spellings that are not SPDX ids, mapped to theirs. */
const ALIASES: Readonly<Record<string, string>> = { CC0: "CC0-1.0" };

const COLUMNS = 7;
const FULL_HASH = /^[0-9a-f]{40}$/;
const NOTICE_RULE = /^-{20,}\s*$/;
const SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
const TABLE_LINE = /^\s*\|/;
const ID = "[A-Za-z0-9.+-]+";
const EXPRESSION = new RegExp(`^${ID}(?:\\s+(?:AND|OR|WITH)\\s+${ID})*`);

/**
 * The cells of one table line, as GitHub splits them: a backslash escapes the
 * character after it, so `\|` is a pipe inside its cell and `\\|` ends one;
 * leading indentation and the outer pipes are not cells.
 */
export function splitRow(line: string): string[] {
  const body = line.trim();
  const cells: string[] = [];
  let cell = "";
  let endsOnPipe = false;
  for (let i = body.startsWith("|") ? 1 : 0; i < body.length; i++) {
    const c = body[i];
    endsOnPipe = false;
    if (c === "\\" && i + 1 < body.length) {
      const next = body[i + 1];
      cell += next === "|" ? "|" : `\\${next}`;
      i++;
    } else if (c === "|") {
      cells.push(cell.trim());
      cell = "";
      endsOnPipe = true;
    } else cell += c;
  }
  if (!endsOnPipe) cells.push(cell.trim());
  return cells;
}

/**
 * The SPDX ids of a licence cell's leading expression (joined by AND, OR or
 * WITH), with the convention's spellings ("The Unlicense", "CC0") mapped to
 * their ids; any note after the expression is ignored.
 */
export function licenceIds(cell: string): string[] {
  const text = cell.trim().replace(/^the unlicense\b/i, "Unlicense");
  const expression = text.match(EXPRESSION)?.[0] ?? "";
  if (expression === "") return [];
  return expression.split(/\s+(?:AND|OR|WITH)\s+/).map((id) => ALIASES[id] ?? id);
}

/** The backticked spans of a cell that are paths (they hold a slash). */
export function landedPaths(cell: string): string[] {
  return [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? "").filter((s) => s.includes("/"));
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Whether `text` names `name` whole: not inside a longer word, repository or
 * path. A sentence's closing period, comma or bracket may follow it. A
 * repository may follow a slash (`github.com/<owner>/<repo>`); a path may not,
 * so `x/a/b.ts` does not name `a/b.ts`. Either may be followed by a slash: a
 * repository by a path inside it, a landed folder by a file inside it.
 */
export function namesWhole(text: string, name: string, kind: "repo" | "path"): boolean {
  const before = kind === "repo" ? "(?<![A-Za-z0-9_.\\-])" : "(?<![A-Za-z0-9_.\\-/])";
  const after = "(?![A-Za-z0-9_\\-]|\\.[A-Za-z0-9_\\-])";
  return new RegExp(`${before}${escapeRegExp(name)}${after}`, "i").test(text);
}

export interface RegisterInput {
  registerPath: string;
  register: string;
  notice: string;
  exists: (path: string) => boolean;
}

/** Every problem of the register, as `<path>:<line>: <message>`, in line order. */
export function checkRegister(input: RegisterInput): string[] {
  const lines = input.register.split("\n").map((l) => l.replace(/\r$/, ""));
  const header = lines.findIndex((l) => TABLE_LINE.test(l) && splitRow(l)[0] === "source");
  if (header < 0) return [`${input.registerPath}: no table with a \`source\` header row`];
  if (!SEPARATOR.test(lines[header + 1] ?? ""))
    return [
      `${input.registerPath}:${header + 2}: the header row is not followed by a separator row`,
    ];
  const entries = input.notice.split("\n").reduce<string[]>(
    (acc, l) => {
      if (NOTICE_RULE.test(l)) acc.push("");
      else acc[acc.length - 1] += `${l}\n`;
      return acc;
    },
    [""],
  );
  const problems: string[] = [];
  let i = header + 2;
  for (; i < lines.length && TABLE_LINE.test(lines[i] ?? ""); i++) {
    const at = `${input.registerPath}:${i + 1}:`;
    const cells = splitRow(lines[i] ?? "");
    if (cells.length !== COLUMNS) {
      problems.push(
        `${at} has ${cells.length} cells, expected ${COLUMNS} (escape a pipe inside a cell as \\|)`,
      );
      continue;
    }
    const [source = "", commit = "", licenceCell = "", mode = "", , landed = ""] = cells;
    if (!FULL_HASH.test(commit))
      problems.push(`${at} commit ${commit} is not a full 40-character hash`);
    const ids = licenceIds(licenceCell);
    const data = /\(data\)/.test(mode);
    if (ids.length === 0) problems.push(`${at} licence cell does not start with a licence id`);
    for (const id of ids) {
      if (DATA_ONLY.has(id)) {
        if (!data)
          problems.push(`${at} licence ${id} is allowed for data only, and the mode is ${mode}`);
      } else if (!COPY_OR_PORT.has(id))
        problems.push(`${at} licence ${id} is not in ADR 0037's copy-or-port list`);
    }
    const copy = /\bcopy\b/.test(mode);
    if (!copy && !/\bport\b/.test(mode))
      problems.push(`${at} mode ${mode} is neither copy nor port`);
    const paths = landedPaths(landed);
    if (paths.length === 0) problems.push(`${at} names no landed path in backticks`);
    for (const p of paths)
      if (!input.exists(p)) problems.push(`${at} landed path ${p} does not exist`);
    if (copy) {
      const repo = source.split(",")[0]?.trim() ?? "";
      const named = entries.some(
        (e) => namesWhole(e, repo, "repo") && paths.some((p) => namesWhole(e, p, "path")),
      );
      if (!named)
        problems.push(
          `${at} copy from ${repo} has no NOTICE entry naming its source and a landed path`,
        );
    }
  }
  for (; i < lines.length; i++)
    if (TABLE_LINE.test(lines[i] ?? ""))
      problems.push(
        `${input.registerPath}:${i + 1}: a table row outside the register's table (a blank line or other text ended it)`,
      );
  return problems;
}

function main(argv: string[]): number {
  const [registerPath = REGISTER, noticePath = NOTICE] = argv;
  const problems = checkRegister({
    registerPath,
    register: readFileSync(registerPath, "utf8"),
    notice: readFileSync(noticePath, "utf8"),
    exists: existsSync,
  });
  for (const p of problems) console.error(p);
  return problems.length === 0 ? 0 : 1;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
