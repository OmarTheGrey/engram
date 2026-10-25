// `engram doctor`: the db opens and migrates (never created by doctor), the
// policy loads, the store root is a readable folder, the adapters the CLI can
// open; the rest reported as not checked.
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, FIXTURE, readArgs, tempDir } from "./helpers.ts";

describe("engram doctor", () => {
  it("passes with no log yet, a preset and a readable root, and creates nothing", async () => {
    const db = join(await tempDir(), "engram.db");
    const { code, out } = await cli(["doctor", "--db", db, "--root", FIXTURE]);
    expect(code).toBe(0);
    expect(out).toMatch(/^ok\s+db\s+.*no log yet; the first read or write creates it/m);
    expect(existsSync(db)).toBe(false);
    expect(out).toMatch(/^ok\s+policy\s+preset\.medium v1/m);
    expect(out).toMatch(/^ok\s+store\s+.*is a readable folder/m);
    expect(out).toMatch(/^ok\s+adapter files\s/m);
    expect(out).toMatch(/^skip\s+adapter mem0\s/m);
    expect(out).toMatch(/^skip\s+provider keys\s+not checked yet \(card E0\.4\)/m);
    expect(out).toMatch(/^skip\s+benchmark pins\s+not checked; no card checks them yet/m);
    expect(out).toContain("doctor: all checks passed");
  });

  it("reports an up-to-date log that a read created", async () => {
    const db = join(await tempDir(), "engram.db");
    await cli(readArgs(db));
    const { out } = await cli(["doctor", "--db", db]);
    expect(out).toMatch(/^ok\s+db\s+.*up to date/m);
  });

  it("fails on a policy file that does not validate, naming the line", async () => {
    const dir = await tempDir();
    const policy = join(dir, "bad.yaml");
    await writeFile(policy, "id: broken\nversion: 1\n");
    const { code, out } = await cli(["doctor", "--db", join(dir, "e.db"), "--policy", policy]);
    expect(code).toBe(1);
    expect(out).toMatch(/^fail\s+policy\s+.*bad\.yaml:\d+:\d+/m);
    expect(out).toContain("doctor: 1 check failed");
  });

  it("fails on a store root that does not exist", async () => {
    const dir = await tempDir();
    const { code, out } = await cli([
      "doctor",
      "--db",
      join(dir, "e.db"),
      "--root",
      join(dir, "nowhere"),
    ]);
    expect(code).toBe(1);
    expect(out).toMatch(/^fail\s+store\s/m);
  });

  it("looks for the default log under the home folder", async () => {
    const home = await tempDir();
    const { out } = await cli(["doctor"], { home });
    expect(out).toContain(join(home, ".engram", "engram.db"));
    expect(existsSync(join(home, ".engram"))).toBe(false);
  });

  it("skips the store check when no root is given", async () => {
    const { out } = await cli(["doctor", "--db", join(await tempDir(), "e.db")]);
    expect(out).toMatch(/^skip\s+store\s+no --root given/m);
  });
});
