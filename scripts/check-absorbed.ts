// The register check of ADR 0037 (decision 8, card E0.6): every row of
// docs/absorbed.md has seven cells, a full commit hash, a licence from the
// copy-or-port list (CC-BY-4.0 for data only), a mode of copy or port, and at
// least one landed path in backticks that exists; a copy also has an entry in
// NOTICE (a block between rule lines) that names both its source repository
// and one of its landed paths. Run by `make lint-docs`; the red fixture is
// fixtures/ci/absorbed-red/.
import { existsSync, readFileSync } from "node:fs";

export const REGISTER = "docs/absorbed.md";
export const NOTICE = "NOTICE";

/** Licences ADR 0037 allows for copy or port, as SPDX ids. */
export const COPY_OR_PORT = new Set([
  "MIT",
  "ISC",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "0BSD",
  "Apache-2.0",
  "Unlicense",
  "CC0-1.0",
]);

/** Licences ADR 0037 allows for data only. */
export const DATA_ONLY = new Set(["CC-BY-4.0"]);

const COLUMNS = 7;
const FULL_HASH = /^[0-9a-f]{40}$/;
const NOTICE_RULE = /^-{20,}\s*$/;

/** The cells of one table line, outer pipes dropped, `\|` kept as a pipe inside its cell. */
export function splitRow(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "\\" && body[i + 1] === "|") {
      cell += "|";
      i++;
    } else if (body[i] === "|") {
      cells.push(cell.trim());
      cell = "";
    } else cell += body[i];
  }
  cells.push(cell.trim());
  return cells;
}

/** The leading SPDX id of a licence cell; any note after it is ignored. */
export function licenceId(cell: string): string {
  return cell.trim().match(/^[A-Za-z0-9.+-]+/)?.[0] ?? "";
}

/** The backticked spans of a cell that are paths (they hold a slash). */
export function landedPaths(cell: string): string[] {
  return [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? "").filter((s) => s.includes("/"));
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
  const header = lines.findIndex((l) => l.startsWith("|") && splitRow(l)[0] === "source");
  if (header < 0) return [`${input.registerPath}: no table with a \`source\` header row`];
  const entries = input.notice
    .split("\n")
    .reduce<string[]>(
      (acc, l) => {
        if (NOTICE_RULE.test(l)) acc.push("");
        else acc[acc.length - 1] += `${l}\n`;
        return acc;
      },
      [""],
    )
    .map((e) => e.toLowerCase());
  const problems: string[] = [];
  for (let i = header + 2; i < lines.length && lines[i]?.startsWith("|"); i++) {
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
    const licence = licenceId(licenceCell);
    const data = /\(data\)/.test(mode);
    if (DATA_ONLY.has(licence)) {
      if (!data)
        problems.push(`${at} licence ${licence} is allowed for data only, and the mode is ${mode}`);
    } else if (!COPY_OR_PORT.has(licence))
      problems.push(`${at} licence ${licence} is not in ADR 0037's copy-or-port list`);
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
        (e) => e.includes(repo.toLowerCase()) && paths.some((p) => e.includes(p.toLowerCase())),
      );
      if (!named)
        problems.push(
          `${at} copy from ${repo} has no NOTICE entry naming its source and a landed path`,
        );
    }
  }
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
