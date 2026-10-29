// Prose rules from AGENTS.md: no em dashes in docs/ or any Markdown file, and
// CLAUDE.md is a byte-for-byte copy of AGENTS.md. Also: no merge-conflict
// markers in any tracked text file (review finding P5-8: a rebase once left
// them in a lead-owned convention file and nothing noticed). Run by
// `make lint-docs`.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const EM_DASH = "—";

export function findEmDashes(text: string): number[] {
  return text.split("\n").flatMap((line, i) => (line.includes(EM_DASH) ? [i + 1] : []));
}

export function isProseFile(path: string): boolean {
  return path.startsWith("docs/") || path.endsWith(".md");
}

/** A line git writes for a conflict: `<<<<<<<` or `>>>>>>>` with an optional label, or `=======` alone. */
const CONFLICT_MARKER = /^(?:<{7}(?: .*)?|={7}|>{7}(?: .*)?)$/;

/** The one-based lines of `text` that are merge-conflict markers. */
export function findConflictMarkers(text: string): number[] {
  return text
    .split("\n")
    .flatMap((line, i) => (CONFLICT_MARKER.test(line.replace(/\r$/, "")) ? [i + 1] : []));
}

/** The red fixture of the conflict check: it holds markers on purpose. */
export const CONFLICT_FIXTURE = "fixtures/ci/conflict-markers.txt";

/** Every tracked file but the red fixture is scanned for conflict markers. */
export function scannedForConflicts(path: string): boolean {
  return path !== CONFLICT_FIXTURE;
}

export function listRepoFiles(): string[] {
  const out = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"]);
  return out.toString("utf8").split("\0").filter(Boolean);
}

function main(): number {
  const problems: string[] = [];
  for (const path of listRepoFiles()) {
    let bytes: Buffer;
    try {
      bytes = readFileSync(path);
    } catch {
      continue; // deleted in the working tree but still in the index
    }
    if (bytes.includes(0)) continue; // binary
    const text = bytes.toString("utf8");
    if (isProseFile(path))
      for (const line of findEmDashes(text)) problems.push(`${path}:${line}: em dash`);
    if (scannedForConflicts(path))
      for (const line of findConflictMarkers(text))
        problems.push(`${path}:${line}: merge-conflict marker`);
  }
  if (!readFileSync("CLAUDE.md").equals(readFileSync("AGENTS.md"))) {
    problems.push("CLAUDE.md: must be an exact copy of AGENTS.md (cp AGENTS.md CLAUDE.md)");
  }
  for (const p of problems) console.error(p);
  return problems.length === 0 ? 0 : 1;
}

if (import.meta.main) process.exitCode = main();
