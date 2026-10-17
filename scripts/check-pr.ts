// PR gate from AGENTS.md rule 14 and the PR template: the body names an
// acceptance command, and the diff adds or changes a valid docs/log entry.
//
// Usage: node scripts/check-pr.ts <pr-dir> [<root>]
// <pr-dir> holds body.md (the PR description) and files.txt (changed paths,
// one per line). Changed files are read from <root>, which defaults to
// <pr-dir> so a fixture PR under fixtures/ci/ carries its own files.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkLogEntry, isLogEntryPath } from "./check-log.ts";

export interface PrInput {
  body: string;
  changed: string[];
  read: (path: string) => string | undefined;
  exists: (path: string) => boolean;
}

const ACCEPTANCE = /^Acceptance:\s*`([^`]+)`\s*$/m;

export function checkPr(pr: PrInput): string[] {
  const problems: string[] = [];
  const command = ACCEPTANCE.exec(pr.body)?.[1]?.trim();
  if (!command || /^<.*>$/.test(command)) {
    problems.push("PR body must contain a line Acceptance: `<command>` naming a real command");
  }
  const entries = pr.changed.filter(isLogEntryPath);
  if (entries.length === 0) {
    problems.push("PR diff must add or change an entry under docs/log/");
  }
  for (const path of entries) {
    const text = pr.read(path);
    if (text === undefined) continue; // deleted by the diff
    problems.push(...checkLogEntry(path, text, { exists: pr.exists }));
  }
  return problems;
}

function main(argv: string[]): number {
  const prDir = argv[0];
  if (!prDir) {
    console.error("usage: node scripts/check-pr.ts <pr-dir> [<root>]");
    return 2;
  }
  const root = argv[1] ?? prDir;
  const changed = readFileSync(join(prDir, "files.txt"), "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const problems = checkPr({
    body: readFileSync(join(prDir, "body.md"), "utf8"),
    changed,
    read: (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : undefined),
    exists: (p) => existsSync(join(root, p)) || existsSync(p),
  });
  for (const p of problems) console.error(p);
  return problems.length === 0 ? 0 : 1;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
