// Layer 6 (docs/conventions/testing.md), card E0.4: the `engram` binary as a
// user runs it, on each log backend (ADR 0024). Doctor first, then a smoke on
// an empty temporary memory folder: a write through the gate, a read that
// returns and explains it, and `engram explain` on that read from the log.
// SQLite always; Postgres on the embedded server core's globalSetup starts (no
// Docker), in a fresh database owned by a role whose password must never
// appear in any output. The same write, read and explain then run with
// `--store letta` on a fresh MemFS repository (card A2), whose git log must
// show the one commit the write made. The MCP handshakes are in
// mcp.e2e.test.ts (card E8.4).
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
  freshDatabase,
  hasLogTables,
  PG_PASSWORD,
  postgresTarget,
} from "../../packages/cli/test/postgres.ts";

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

interface Backend {
  name: "sqlite" | "postgres";
  skip: string | undefined;
  /** The --db value for a fresh, empty log. */
  fresh(): string;
  /** Whether that log exists yet. */
  exists(db: string): boolean;
}

const pg = postgresTarget();
const BACKENDS: Backend[] = [
  {
    name: "sqlite",
    skip: undefined,
    fresh: () => join(temp("log"), "engram.db"),
    exists: (db) => existsSync(db),
  },
  {
    name: "postgres",
    skip: "skip" in pg ? pg.skip : undefined,
    fresh: () => ("url" in pg ? freshDatabase(pg.url, "e2e") : ""),
    exists: (db) => hasLogTables(db),
  },
];

describe.each(BACKENDS)("engram end to end on $name", (backend) => {
  if (backend.skip) console.warn(`[e2e] ${backend.name} skipped: ${backend.skip}`);

  describe.skipIf(backend.skip !== undefined)("doctor, write, read, explain", () => {
    const home = temp("home");
    const work = temp("work");
    const memories = temp("memories");
    let db = "";
    let readId = "";

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
      expect(r.stdout + r.stderr).not.toContain(PG_PASSWORD);
      return { code: r.status, out: r.stdout, err: r.stderr };
    }

    it("doctor passes every check and creates no log", () => {
      db = backend.fresh();
      const r = engram("doctor", "--root", memories, "--db", db);
      expect(r.err).toBe("");
      expect(r.out).toMatch(new RegExp(`^ok\\s+log\\s+${backend.name} .*no log yet`, "m"));
      expect(r.out).toContain("doctor: all checks passed");
      expect(r.code).toBe(0);
      expect(backend.exists(db)).toBe(false);
      expect(existsSync(join(home, ".engram"))).toBe(false);
    });

    it("write puts one item in the folder through the gate", () => {
      const r = engram(
        "write",
        ...["--root", memories, "--owner", "dana", "--db", db],
        ...["--content", "The release freeze starts on Friday."],
      );
      expect(r.err).toBe("");
      expect(r.out).toMatch(/allow/);
      expect(r.code).toBe(0);
      expect(readdirSync(memories).length).toBeGreaterThan(0);
    });

    it("read returns the item with its explanation", () => {
      const r = engram("read", "release freeze", "--root", memories, "--owner", "dana", "--db", db);
      expect(r.code).toBe(0);
      expect(r.out).toContain("The release freeze starts on Friday.");
      expect(r.out).toMatch(/admitted by /);
      readId = /^read (\S+) at /m.exec(r.out)?.[1] ?? "";
      expect(readId).not.toBe("");
    });

    it("explain returns that read's explanations from the log", () => {
      const r = engram("explain", readId, "--owner", "dana", "--db", db);
      expect(r.err).toBe("");
      expect(r.out).toMatch(new RegExp(`^read ${readId}: 1 explanation`, "m"));
      expect(r.code).toBe(0);
    });

    it("doctor then finds the log up to date", () => {
      const r = engram("doctor", "--db", db);
      expect(r.out).toMatch(new RegExp(`^ok\\s+log\\s+${backend.name} .*: opens; up to date`, "m"));
      expect(r.code).toBe(0);
    });

    it("the same write, read and explain on a Letta MemFS repository, one commit for the write", () => {
      const letta = join(temp("letta"), "memory");
      const ldb = backend.fresh();
      const store = ["--store", "letta", "--root", letta, "--owner", "dana", "--db", ldb];
      const w = engram("write", ...store, "--content", "The Letta store holds the freeze date.");
      expect(w.err).toBe("");
      expect(w.out).toMatch(/allow/);
      expect(w.code).toBe(0);
      const commits = spawnSync("git", ["log", "--format=%s"], { cwd: letta, encoding: "utf8" })
        .stdout.split("\n")
        .filter(Boolean);
      expect(commits).toHaveLength(2);
      expect(commits[0]).toMatch(/^engram: write \S+ \(semantic in person:dana, version 1\)$/);
      expect(commits[1]).toBe("engram: list engram/ in MEMORY.md");

      const r = engram("read", "freeze date", ...store);
      expect(r.code).toBe(0);
      expect(r.out).toContain("The Letta store holds the freeze date.");
      const id = /^read (\S+) at /m.exec(r.out)?.[1] ?? "";
      expect(id).not.toBe("");
      const x = engram("explain", id, "--owner", "dana", "--db", ldb);
      expect(x.out).toMatch(new RegExp(`^read ${id}: 1 explanation`, "m"));
      expect(x.code).toBe(0);
    });
  });
});
