import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { Case } from "../../src/mem-inv-bench/schema.ts";
import { cases, FIXTURES, type Manifest, readJson } from "./fixture.ts";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

describe("the vendored MEM-INV-Bench subset", () => {
  test("loads 24 cases: 5 per laundering channel and 4 benign", () => {
    const all = cases();
    expect(all).toHaveLength(24);
    const per = (ch: string) => all.filter((c) => c.channel === ch).length;
    expect([per("direct"), per("summarize"), per("tool_echo"), per("corroborate")]).toEqual([
      5, 5, 5, 5,
    ]);
    expect(all.filter((c) => c.family === "legit").map((c) => c.vouchers)).toEqual(
      expect.arrayContaining([0, 1, 2]),
    );
  });

  test("was vendored at the commit the PINS.md candidate row records", () => {
    const manifest = readJson<Manifest>("manifest.json");
    const pins = readFileSync(new URL("../../PINS.md", import.meta.url), "utf8");
    expect(manifest.source.commit).toBe("cf3c9a4ca9f0478000d6aa26eb268b875232d34b");
    expect(pins).toContain(manifest.source.commit);
    expect(pins).toContain(manifest.source.dataset_revision);
  });

  test("every line of every vendored file matches its manifest hash", () => {
    const manifest = readJson<Manifest>("manifest.json");
    expect(Object.keys(manifest.files).sort()).toEqual([
      "cases.jsonl",
      "full/cases.jsonl",
      "probe-script.json",
      "script.json",
      "upstream-golden.json",
    ]);
    for (const [name, hashes] of Object.entries(manifest.files)) {
      const lines = readFileSync(`${FIXTURES}${name}`, "utf8").split("\n");
      expect(lines.pop(), name).toBe("");
      expect(lines.map(sha256), name).toEqual(hashes);
    }
  });

  test("case ids are mib-01 to mib-24 in a drawn order: neither id nor position follows family or channel", () => {
    const all = cases();
    expect(all.map((c) => c.case_id)).toEqual(
      Array.from({ length: 24 }, (_, i) => `mib-${String(i + 1).padStart(2, "0")}`),
    );
    // The ids still index labelled data; they only must not encode it in blocks.
    const benign = all.flatMap((c, i) => (c.family === "legit" ? [i] : []));
    expect(benign).not.toEqual([20, 21, 22, 23]);
    const runs = all.filter((c, i) => i > 0 && c.channel === all[i - 1]?.channel).length;
    expect(runs).toBeLessThan(10);
  });

  test("each laundering channel writes its memory through the channels upstream build_memory uses", () => {
    const shape = (c: Case) => c.memory.map((e) => `${e.channel}<${e.derived_from.join(",")}>`);
    for (const c of cases()) {
      const expected = {
        direct: ["web<>", "erp<>"],
        summarize: ["agent<web>", "erp<>"],
        tool_echo: ["tool<web>", "erp<>"],
        corroborate: ["web<>", "inbox<>", "erp<>"],
        legit: ["web<>", "erp<>", "bank<>"].slice(0, 1 + (c.vouchers ?? 0)),
      }[c.channel];
      expect(shape(c), c.case_id).toEqual(expected);
    }
  });

  test("the strict schema refuses an unknown field, so a new label cannot slip past stripping", () => {
    const first = cases()[0] as Case;
    expect(Case.safeParse({ ...first, expected_outcome: "HIT" }).success).toBe(false);
    expect(Case.safeParse({ ...first, memory: [{ ...first.memory[0], origin: 0 }] }).success).toBe(
      false,
    );
  });
});
