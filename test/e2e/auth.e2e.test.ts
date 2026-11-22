// Layer 6, card E8.12 (ADR 0042): verified actors as a user runs them. The
// `engram` binary creates an API key, `engram serve --keys` runs as a child
// process, `engram write --server` with ENGRAM_TOKEN is allowed and without
// it refused, and the SQLite log's side table attests the one event the
// write appended, with the key's id. No Docker; loopback only.
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const REPO = resolve(fileURLToPath(import.meta.url), "../../..");
const MAIN = join(REPO, "packages/cli/src/main.ts");
const dir = mkdtempSync(join(tmpdir(), "engram-e2e-auth-"));
let child: ChildProcess | undefined;
afterAll(() => {
  child?.kill();
  rmSync(dir, { recursive: true, force: true });
});

const env = (extra: Record<string, string> = {}) => ({
  ...(process.env as Record<string, string>),
  HOME: dir,
  USERPROFILE: dir,
  ENGRAM_DB_URL: "",
  ENGRAM_SERVER_URL: "",
  ENGRAM_TOKEN: "",
  ...extra,
});
const engram = (args: string[], extra: Record<string, string> = {}) =>
  spawnSync(process.execPath, [MAIN, ...args], { cwd: dir, env: env(extra), encoding: "utf8" });

describe("engram serve with an API key", () => {
  it("allows the key's write, refuses a tokenless one, and attests the event", async () => {
    const keys = join(dir, "keys.json");
    const db = join(dir, "engram.db");
    const created = engram([
      ...["key", "create", "--keys", keys, "--as", "person:dana"],
      ...["--member", "person:dana", "--source", "user", "--expires", "2099-01-01T00:00:00Z"],
    ]);
    expect(created.status).toBe(0);
    const key = created.stdout.split("\n")[0] ?? "";
    expect(key.startsWith("egk_")).toBe(true);

    child = spawn(
      process.execPath,
      [MAIN, "serve", "--port", "0", "--db", db, "--root", dir, "--owner", "dana", "--keys", keys],
      { cwd: dir, env: env() },
    );
    const url = await new Promise<string>((done, fail) => {
      let out = "";
      const timer = setTimeout(() => fail(new Error(`serve did not start: ${out}`)), 30_000);
      child?.stdout?.on("data", (chunk: Buffer) => {
        out += chunk.toString();
        const m = /listening on (\S+)/.exec(out);
        if (m?.[1]) {
          clearTimeout(timer);
          expect(out).toContain("authenticated, resource");
          done(m[1]);
        }
      });
      child?.stderr?.on("data", (chunk: Buffer) => {
        out += chunk.toString();
      });
    });

    const args = ["write", "--server", url, "--owner", "dana", "--content", "Verified."];
    const refused = engram(args);
    expect(refused.status).toBe(1);
    expect(refused.stderr).toContain("needs a bearer credential");
    const allowed = engram(args, { ENGRAM_TOKEN: key });
    expect(allowed.stderr).toBe("");
    expect(allowed.status).toBe(0);

    child.kill();
    await new Promise((done) => child?.once("exit", done));
    const log = new DatabaseSync(db, { readOnly: true });
    try {
      const events = log.prepare("SELECT seq, actor FROM events ORDER BY seq").all();
      const rows = log
        .prepare("SELECT seq, surface, method, actor, subject FROM event_attestations ORDER BY seq")
        .all();
      expect(events).toHaveLength(1);
      expect(rows).toEqual([
        {
          seq: events[0]?.seq,
          surface: "http",
          method: "api_key",
          actor: "person:dana",
          subject: key.slice(4, 16),
        },
      ]);
    } finally {
      log.close();
    }
  });
});
