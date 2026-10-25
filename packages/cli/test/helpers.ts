// Shared fixtures for the CLI tests: the synthetic Claude Code memory folder,
// temp folders cleaned after each file, and `cli`, which runs one command in
// process with captured output and a fixed clock.
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll } from "vitest";
import { run } from "../src/run.ts";

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

const dirs: string[] = [];
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

export async function cli(args: string[], cwd = tmpdir()): Promise<CliResult> {
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
    now: () => NOW,
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
