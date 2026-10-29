import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { FIXTURES, type Manifest, readJson } from "./fixture.ts";

const PORTED = ["schema.ts", "prompt.ts", "score.ts"];

describe("MEM-INV-Bench's MIT licence travels with what is derived from it", () => {
  test("UPSTREAM-LICENSE is the upstream LICENSE, byte for byte, with its copyright line", () => {
    const text = readFileSync(`${FIXTURES}UPSTREAM-LICENSE`);
    const manifest = readJson<Manifest>("manifest.json");
    expect(createHash("sha256").update(text).digest("hex")).toBe(manifest.upstream_sha256.LICENSE);
    expect(text.toString("utf8")).toMatch(/^MIT License\s+Copyright \(c\) 2026 Yedidel Louck/);
  });

  test("every ported source file names the notice and where its text is", () => {
    for (const file of PORTED) {
      const head = readFileSync(
        new URL(`../../src/mem-inv-bench/${file}`, import.meta.url),
        "utf8",
      ).slice(0, 300);
      expect(head, file).toContain("MIT, Copyright (c) 2026 Yedidel Louck");
      expect(head, file).toContain("fixtures/bench/mem-inv-bench/UPSTREAM-LICENSE");
    }
  });

  test("the vendoring script, which ports build_memory and build_legit_memory, names the notice too", () => {
    const head = readFileSync(
      new URL("../../scripts/vendor-mem-inv-bench.py", import.meta.url),
      "utf8",
    ).slice(0, 400);
    expect(head).toContain("MIT, Copyright (c) 2026 Yedidel Louck");
    expect(head).toContain("fixtures/bench/mem-inv-bench/UPSTREAM-LICENSE");
    expect(head).toContain("build_memory");
  });
});
