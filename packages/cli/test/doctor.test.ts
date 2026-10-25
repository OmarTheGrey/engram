// `engram doctor`: the db opens and migrates, the policy loads, the store root
// is readable, the adapters the CLI can open; the rest reported as not checked.
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, FIXTURE, tempDir } from "./helpers.ts";

describe("engram doctor", () => {
  it("passes on a fresh log, a preset and a readable root", async () => {
    const db = join(await tempDir(), "engram.db");
    const { code, out } = await cli(["doctor", "--db", db, "--root", FIXTURE]);
    expect(code).toBe(0);
    expect(out).toMatch(/^ok\s+db\s+.*migrations 1(, \d+)* applied/m);
    expect(out).toMatch(/^ok\s+policy\s+preset\.medium v1/m);
    expect(out).toMatch(/^ok\s+store\s+.*4 memory files/m);
    expect(out).toMatch(/^ok\s+adapter files\s/m);
    expect(out).toMatch(/^skip\s+adapter mem0\s/m);
    expect(out).toMatch(/^skip\s+provider keys\s+not checked yet \(card E0\.4\)/m);
    expect(out).toMatch(/^skip\s+benchmark pins\s+not checked yet \(card B1\)/m);
    expect(out).toContain("doctor: all checks passed");
  });

  it("reports an up-to-date log on the second run", async () => {
    const db = join(await tempDir(), "engram.db");
    await cli(["doctor", "--db", db]);
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

  it("skips the store check when no root is given", async () => {
    const { out } = await cli(["doctor", "--db", join(await tempDir(), "e.db")]);
    expect(out).toMatch(/^skip\s+store\s+no --root given/m);
  });
});
