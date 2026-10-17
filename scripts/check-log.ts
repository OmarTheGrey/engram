// Validates docs/log entries against docs/conventions/documentation.md: the
// fixed field set, enum values, evidence paths that exist, and the body shape.
// Run by `make lint-docs`. Files starting with "_" (the template) are skipped.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { FrontmatterError, type FrontmatterValue, parseFrontmatter } from "./lib/frontmatter.ts";

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

const ENUMS: Record<string, readonly string[]> = {
  type: ["decision", "finding", "failure", "measurement", "change", "milestone"],
  chapter: [
    "design",
    "implementation",
    "evaluation",
    "results",
    "discussion",
    "limitations",
    "related-work",
  ],
  pillar: ["govern", "twin", "distill", "plane", "research"],
};

const NEEDS_EVIDENCE = new Set(["finding", "failure", "measurement"]);
const SECTIONS = ["What", "Why", "Result", "Consequence"];
const MAX_WORDS = 150;

export interface CheckOptions {
  exists?: (path: string) => boolean;
}

export function isLogEntryPath(path: string): boolean {
  return /^docs\/log\/[^_/][^/]*\.md$/.test(path);
}

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

// An evidence item with whitespace is a command; an http(s) item is a link;
// anything else is a repository path that must exist.
function isPathEvidence(item: string): boolean {
  return !/\s/.test(item) && !/^https?:\/\//.test(item);
}

function checkFields(
  path: string,
  fields: Map<string, FrontmatterValue>,
  exists: (p: string) => boolean,
): string[] {
  const problems: string[] = [];
  const scalar = (key: string) => {
    const v = fields.get(key);
    return typeof v === "string" ? v : undefined;
  };

  for (const [key, allowed] of Object.entries(ENUMS)) {
    const v = scalar(key);
    if (v !== undefined && !allowed.includes(v)) {
      problems.push(`${path}: ${key} must be one of ${allowed.join(", ")}`);
    }
  }
  const hypothesis = scalar("hypothesis");
  if (hypothesis !== undefined && !/^(H[1-5]|none)$/.test(hypothesis)) {
    problems.push(`${path}: hypothesis must be H1 to H5 or none`);
  }
  const date = scalar("date");
  if (date !== undefined && !isRealDate(date)) {
    problems.push(`${path}: date must be a real YYYY-MM-DD date`);
  }

  const evidence = fields.get("evidence");
  if (typeof evidence === "string") {
    problems.push(`${path}: evidence must be a list`);
  } else if (evidence !== undefined) {
    const type = scalar("type") ?? "";
    if (NEEDS_EVIDENCE.has(type) && evidence.length === 0) {
      problems.push(`${path}: type ${type} needs at least one evidence item`);
    }
    for (const item of evidence.filter(isPathEvidence)) {
      if (!exists(item)) problems.push(`${path}: evidence path does not exist: ${item}`);
    }
  }

  const supersedes = scalar("supersedes");
  if (supersedes !== undefined && supersedes !== "none") {
    if (!isLogEntryPath(supersedes) || !exists(supersedes)) {
      problems.push(`${path}: supersedes must be none or an existing docs/log entry`);
    }
  }
  return problems;
}

function checkBody(path: string, body: string): string[] {
  const problems: string[] = [];
  const found = [...body.matchAll(/\*\*(\w+)\.\*\*/g)].map((m) => m[1]);
  if (found.join(",") !== SECTIONS.join(",")) {
    problems.push(`${path}: body must have ${SECTIONS.join(", ")} in that order`);
  }
  const words = body.split(/\s+/).filter(Boolean).length;
  if (words > MAX_WORDS) {
    problems.push(`${path}: body has ${words} words, at most ${MAX_WORDS} allowed`);
  }
  return problems;
}

export function checkLogEntry(path: string, text: string, opts: CheckOptions = {}): string[] {
  const exists = opts.exists ?? existsSync;
  let parsed: ReturnType<typeof parseFrontmatter>;
  try {
    parsed = parseFrontmatter(text);
  } catch (e) {
    if (e instanceof FrontmatterError) return [`${path}: ${e.message}`];
    throw e;
  }
  const { fields, body } = parsed;
  const problems: string[] = [];
  const known = new Set<string>(LOG_FIELDS);
  for (const f of LOG_FIELDS) if (!fields.has(f)) problems.push(`${path}: missing field ${f}`);
  for (const f of fields.keys()) if (!known.has(f)) problems.push(`${path}: unknown field ${f}`);
  const date = fields.get("date");
  const name = path.split("/").pop() ?? "";
  if (typeof date === "string" && !name.startsWith(`${date}-`)) {
    problems.push(`${path}: file name must start with the entry date ${date}`);
  }
  return [...problems, ...checkFields(path, fields, exists), ...checkBody(path, body)];
}

export function listLogEntries(dir = LOG_DIR): string[] {
  return readdirSync(dir)
    .map((f) => `${dir}/${f}`)
    .filter(isLogEntryPath);
}

function main(): number {
  const problems = listLogEntries().flatMap((p) => checkLogEntry(p, readFileSync(p, "utf8")));
  for (const p of problems) console.error(p);
  return problems.length === 0 ? 0 : 1;
}

if (import.meta.main) process.exitCode = main();
