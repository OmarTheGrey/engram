// Prose rules from AGENTS.md: no em dashes in docs/ or any Markdown file, and
// CLAUDE.md is a byte-for-byte copy of AGENTS.md. Run by `make lint-docs`.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const EM_DASH = "\u2014";

export function findEmDashes(text: string): number[] {
  return text.split("\n").flatMap((line, i) => (line.includes(EM_DASH) ? [i + 1] : []));
}

export function isProseFile(path: string): boolean {
  return path.startsWith("docs/") || path.endsWith(".md");
}

export function listRepoFiles(): string[] {
  const out = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"]);
  return out.toString("utf8").split("\0").filter(Boolean);
}

function main(): number {
  const problems: string[] = [];
  for (const path of listRepoFiles().filter(isProseFile)) {
    let text: string;
    try {
      text = readFileSync(path, "utf8");
    } catch {
      continue; // deleted in the working tree but still in the index
    }
    for (const line of findEmDashes(text)) problems.push(`${path}:${line}: em dash`);
  }
  if (!readFileSync("CLAUDE.md").equals(readFileSync("AGENTS.md"))) {
    problems.push("CLAUDE.md: must be an exact copy of AGENTS.md (cp AGENTS.md CLAUDE.md)");
  }
  for (const p of problems) console.error(p);
  return problems.length === 0 ? 0 : 1;
}

if (import.meta.main) process.exit(main());
