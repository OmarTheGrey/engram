import { describe, expect, test } from "vitest";
import { overlap } from "../../src/redteam/overlap.ts";
import { cases } from "../mem-inv-bench/fixture.ts";

describe("the overlap with MEM-INV-Bench's laundering channels", () => {
  test("maps each write-route kind to the channels whose attacker entries take its write path", () => {
    const rows = overlap(cases());
    const write = Object.fromEntries(
      rows.filter((r) => r.route === "write").map((r) => [r.kind, r.mem_inv_channels]),
    );
    expect(write).toEqual({
      user: [],
      document: ["corroborate", "direct"],
      tool: ["tool_echo"],
      model: ["summarize"],
      external: [],
    });
  });

  test("the read route shares no channel: MEM-INV-Bench writes every entry through Plane.write", () => {
    for (const r of overlap(cases()).filter((x) => x.route === "read"))
      expect(r.mem_inv_channels, r.kind).toEqual([]);
  });
});
