// Validates docs/log entries against docs/conventions/documentation.md.
// Run by `make lint-docs`. Files starting with "_" (the template) are skipped.
import { readdirSync, readFileSync } from "node:fs";
import { FrontmatterError, parseFrontmatter } from "./lib/frontmatter.ts";

export const LOG_DIR = "docs/log";

export const LOG_FIELDS = [
  "date",
  "author",
  "type",
  "card",
  "chapter",
  "pillar",
  "hypothesis",
  "evidence",
  "supersedes",
] as const;

export function checkLogEntry(path: string, text: string): string[] {
  let fields: Map<string, unknown>;
  try {
    fields = parseFrontmatter(text).fields;
  } catch (e) {
    if (e instanceof FrontmatterError) return [`${path}: ${e.message}`];
    throw e;
  }
  const problems: string[] = [];
  const known = new Set<string>(LOG_FIELDS);
  for (const f of LOG_FIELDS) if (!fields.has(f)) problems.push(`${path}: missing field ${f}`);
  for (const f of fields.keys()) if (!known.has(f)) problems.push(`${path}: unknown field ${f}`);
  const date = fields.get("date");
  const name = path.split("/").pop() ?? "";
  if (typeof date === "string" && !name.startsWith(`${date}-`)) {
    problems.push(`${path}: file name must start with the entry date ${date}`);
  }
  return problems;
}

export function listLogEntries(dir = LOG_DIR): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map((f) => `${dir}/${f}`);
}

function main(): number {
  const problems = listLogEntries().flatMap((p) => checkLogEntry(p, readFileSync(p, "utf8")));
  for (const p of problems) console.error(p);
  return problems.length === 0 ? 0 : 1;
}

if (import.meta.main) process.exit(main());
