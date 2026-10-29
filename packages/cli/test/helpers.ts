// Shared fixtures for the CLI tests: the synthetic Claude Code memory folder,
// temp folders cleaned after each file, and `cli`, which runs one command in
// process with captured output, a fixed clock, a temporary home and ids
// from a counter.
import { mkdtempSync } from "node:fs";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { allEvents, type MemoryEvent, openSqlite } from "@engram/core";
import { afterAll } from "vitest";
import { type Io, run } from "../src/run.ts";

/** The repository checkout the tests run in. */
export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
export const FIXTURE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/stores/claude-code-memory",
);
export const FIXTURE_FILES = [
  "feedback_review_style.md",
  "project_release_freeze.md",
  "reference_runbook.md",
  "user_role.md",
];
/** The clock every in-process command reads, unless the test passes --at. */
export const NOW = "2026-10-25T12:00:00.000Z";
/** valid_from for the imported fixture files, so recency is fixed. */
export const VALID_FROM = "2026-10-01T00:00:00.000Z";

/** The home every in-process command sees unless the test passes one: never the real one. */
export const HOME = mkdtempSync(join(tmpdir(), "engram-cli-home-"));
const dirs: string[] = [HOME];
export async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "engram-cli-"));
  dirs.push(dir);
  return dir;
}
export async function fixtureCopy(): Promise<string> {
  const dir = await tempDir();
  await cp(FIXTURE, dir, { recursive: true });
  return dir;
}
afterAll(async () => {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});

export interface CliResult {
  code: number;
  out: string;
  err: string;
}

let idCount = 0;
/** The ids `cli` injects: a counter, so a run is reproducible; never repeats within a test file. */
export const testId = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, "0")}`;

export interface CliOptions {
  cwd?: string;
  home?: string;
  /** The environment the command sees; empty unless the test gives one, never the real one. */
  env?: Record<string, string | undefined>;
  nodeVersion?: string;
  /** The checkout doctor reads pins from; the real one unless the test gives one. */
  repo?: string;
  /** Wraps every client call's fetch (counting tests). */
  transport?: Io["transport"];
  /** Stops serve and mcp. */
  stop?: AbortSignal;
  /** The hook's JSON. */
  stdin?: NodeJS.ReadableStream;
  /** Doctor's store probes to use instead of the real ones (Io.doctorProbes). */
  doctorProbes?: Io["doctorProbes"];
}

export async function cli(
  args: string[],
  {
    cwd = tmpdir(),
    home = HOME,
    env = {},
    nodeVersion = process.versions.node,
    repo = REPO,
    transport,
    stop,
    stdin,
    doctorProbes,
  }: CliOptions = {},
): Promise<CliResult> {
  let out = "";
  let err = "";
  const code = await run(args, {
    out: (s) => {
      out += s;
    },
    err: (s) => {
      err += s;
    },
    cwd,
    home,
    now: () => NOW,
    newId: () => testId(++idCount),
    env,
    nodeVersion,
    repo,
    ...(transport ? { transport } : {}),
    ...(stop ? { stop } : {}),
    ...(stdin ? { stdin } : {}),
    ...(doctorProbes ? { doctorProbes } : {}),
  });
  return { code, out, err };
}

/** `engram read` over the fixture as its owner, dana, with a fresh log in `db`. */
export const readArgs = (db: string, root = FIXTURE, ...more: string[]) => [
  "read",
  ...more,
  "--store",
  "files",
  "--root",
  root,
  "--owner",
  "dana",
  "--import-valid-from",
  VALID_FROM,
  "--db",
  db,
];

/** The events in the log at `db`, read after the command closed it. */
export function logEvents(db: string): MemoryEvent[] {
  const log = openSqlite(db);
  try {
    return allEvents(log);
  } finally {
    log.close();
  }
}
