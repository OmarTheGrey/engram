// What `make run ... COUNT=1` checks before it counts (plan decision 6): a
// MEM-INV-Bench case directory holds the full case set, the fixture subset,
// or neither, by the fixture manifest's line hashes.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { checkMemInvData } from "../../src/mem-inv-bench/pinned.ts";
import { FIXTURES } from "./fixture.ts";

const COMMIT = "cf3c9a4ca9f0478000d6aa26eb268b875232d34b";

describe("MEM-INV-Bench cases against the pin", () => {
  test("the fixture directory is the subset, its full/ directory the full set", () => {
    expect(checkMemInvData(FIXTURES)).toEqual({ set: "fixture", commit: COMMIT });
    expect(checkMemInvData(join(FIXTURES, "full"))).toEqual({ set: "full", commit: COMMIT });
  });

  test("a dropped case or a missing file is unpinned", () => {
    const dir = mkdtempSync(join(tmpdir(), "engram-mem-inv-pinned-"));
    try {
      cpSync(join(FIXTURES, "full"), dir, { recursive: true });
      const lines = readFileSync(join(dir, "cases.jsonl"), "utf8").split("\n");
      writeFileSync(join(dir, "cases.jsonl"), lines.slice(1).join("\n"));
      expect(checkMemInvData(dir).set).toBe("unpinned");
      rmSync(join(dir, "cases.jsonl"));
      expect(checkMemInvData(dir).set).toBe("unpinned");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
