// The `engram` binary as a process: Node runs src/main.ts directly (type
// stripping), the clock is the real one unless --at is given, and the exit
// code is the command's.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FIXTURE, tempDir, VALID_FROM } from "./helpers.ts";

const MAIN = resolve(fileURLToPath(import.meta.url), "../../src/main.ts");
/** Runs the binary with a temporary home, so the default log never lands in the real one. */
const engram = (args: string[], cwd: string, home = cwd) =>
  spawnSync(process.execPath, [MAIN, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 30_000,
    env: { ...process.env, HOME: home, USERPROFILE: home },
  });

describe("the engram binary", () => {
  it("reads the fixture folder with the current time and exits 0", {
    timeout: 40_000,
  }, async () => {
    const cwd = await tempDir();
    const home = await tempDir();
    const r = engram(
      ["read", "--root", FIXTURE, "--owner", "dana", "--import-valid-from", VALID_FROM],
      cwd,
      home,
    );
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("4 items returned, 0 filtered");
    // The default log is per user, under the home folder, never the working directory (D9).
    expect(r.stdout).toContain(`log ${join(home, ".engram", "engram.db")}`);
    expect(existsSync(join(cwd, ".engram"))).toBe(false);
  });

  it("exits 2 for a command whose card has not landed", { timeout: 40_000 }, async () => {
    const r = engram(["lint"], await tempDir());
    expect(r.status).toBe(2);
    expect(r.stderr).toBe("engram lint: not implemented yet (card L1)\n");
  });

  it("exits 1 when a write is denied", { timeout: 40_000 }, async () => {
    const cwd = await tempDir();
    const r = engram(
      [
        "write",
        "--root",
        cwd,
        "--owner",
        "dana",
        "--db",
        ":memory:",
        "--content",
        "x",
        "--scope",
        "team:platform",
        "--class",
        "episodic",
        "--member",
        "team:platform",
      ],
      cwd,
    );
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("policy preset.medium/write/team");
  });
});
