// Layer 6 (docs/conventions/testing.md), card E0.4: the `engram` binary as a
// user runs it, on the SQLite log. Doctor first, then a smoke on an empty
// temporary memory folder: a write through the gate, a read that returns and
// explains it, and `engram explain` on that read from the log. No Docker:
// Postgres joins this file with card E1.1, from the embedded-postgres package.
// The MCP handshakes join with card E8.4.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const REPO = resolve(fileURLToPath(import.meta.url), "../../..");
const MAIN = join(REPO, "packages/cli/src/main.ts");
const dirs: string[] = [];
const temp = (prefix: string) => {
  const dir = mkdtempSync(join(tmpdir(), `engram-e2e-${prefix}-`));
  dirs.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

const home = temp("home");
const work = temp("work");
const memories = temp("memories");
const log = join(work, "engram.db");

/** The binary in a child process, with a temporary home and no ENGRAM_DB_URL from the caller's shell. */
function engram(...args: string[]) {
  const env: Record<string, string | undefined> = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
  };
  delete env.ENGRAM_DB_URL;
  const r = spawnSync(process.execPath, [MAIN, ...args], {
    cwd: work,
    encoding: "utf8",
    timeout: 60_000,
    env,
  });
  if (r.error) throw r.error;
  return { code: r.status, out: r.stdout, err: r.stderr };
}

const owner = ["--root", memories, "--owner", "dana", "--db", log];

describe("engram end to end on SQLite", () => {
  it("doctor passes every check and creates no log", () => {
    const r = engram("doctor", "--root", memories, "--db", log);
    expect(r.err).toBe("");
    expect(r.out).toContain("doctor: all checks passed");
    expect(r.out).not.toMatch(/^fail/m);
    expect(r.code).toBe(0);
    expect(existsSync(log)).toBe(false);
    expect(existsSync(join(home, ".engram"))).toBe(false);
  });

  let readId = "";

  it("write puts one item in the folder through the gate", () => {
    const r = engram("write", ...owner, "--content", "The release freeze starts on Friday.");
    expect(r.err).toBe("");
    expect(r.out).toMatch(/allow/);
    expect(r.code).toBe(0);
    expect(readdirSync(memories).length).toBeGreaterThan(0);
  });

  it("read returns the item with its explanation", () => {
    const r = engram("read", "release freeze", ...owner);
    expect(r.code).toBe(0);
    expect(r.out).toContain("The release freeze starts on Friday.");
    expect(r.out).toMatch(/admitted by /);
    readId = /^read (\S+) at /m.exec(r.out)?.[1] ?? "";
    expect(readId).not.toBe("");
  });

  it("explain returns that read's explanations from the log", () => {
    const r = engram("explain", readId, "--owner", "dana", "--db", log);
    expect(r.err).toBe("");
    expect(r.out).toMatch(new RegExp(`^read ${readId}: 1 explanation`, "m"));
    expect(r.code).toBe(0);
  });

  it("doctor then finds the log up to date", () => {
    const r = engram("doctor", "--db", log);
    expect(r.out).toMatch(/^ok\s+log\s+sqlite .*engram\.db: opens; up to date/m);
    expect(r.code).toBe(0);
  });
});
