import { describe, expect, it } from "vitest";
import { runCells } from "../../src/merit/config.ts";
import type { LedgerRow, MeritCellRun, MeritRow } from "../../src/merit/launch.ts";
import { compareWithReference, countCalls } from "../../src/merit/summary.ts";

const usage = (hit: boolean, input: number, cost: number): LedgerRow => ({
  cell: "c",
  key: "k",
  model: "scripted/merit-d1",
  hit,
  input_tokens: hit ? 0 : input,
  output_tokens: hit ? 0 : 2,
  cost_usd: hit ? 0 : cost,
  ...(hit ? { cached: { input_tokens: input, output_tokens: 2, cost_usd: cost } } : {}),
});

const row = (episode: number, extra: Partial<MeritRow> = {}): MeritRow => ({
  seed: 0,
  condition: "C1",
  arc_id: "arc0-000",
  episode_index: episode,
  corrupt_mode: "none",
  corrupt_rate: 0,
  task_id: `arc0-000-e${episode}-indep-refund`,
  kind: "I_refund",
  dependent: false,
  success: true,
  pre_satisfied: false,
  memory_had_fact: false,
  memory_utilized: false,
  prompt_tokens: 10,
  completion_tokens: 1,
  ...extra,
});

const cellOf = (condition: "C1" | "C2", rows: MeritRow[]): MeritCellRun => {
  const run = runCells({
    name: "t",
    kind: "pipeline",
    benchmark: "merit",
    cells: [{ domain: "d1", difficulty: "easy", arcs: 1, episodes: 2 }],
    world_seeds: 1,
    conditions: [condition],
    stores: ["fake"],
    seeds: [1],
    preset: "medium",
    model: "scripted/merit-d1",
    cassettes: "x",
  })[0];
  if (run === undefined) throw new Error("no run cell");
  return { run, rows, events: [] };
};

describe("the MERIT summary", () => {
  it("counts a replay's calls as from cassettes, paying nothing, with the recorded cost beside", () => {
    const c = countCalls([usage(true, 100, 0.5), usage(true, 50, 0.25), usage(false, 10, 0.1)]);
    expect(c).toEqual({
      calls: 3,
      new: 1,
      from_cassettes: 2,
      paid: { input_tokens: 10, output_tokens: 2, cost_usd: 0.1 },
      recorded: { input_tokens: 150, output_tokens: 4, cost_usd: 0.75 },
    });
  });

  it("matches the slice's tasks with the reference run's and compares C1 with MERIT's C1", () => {
    const ours = cellOf("C1", [row(0), row(1, { success: false })]);
    const reference = [row(0, { condition: "C0" }), row(0), row(1), row(0, { condition: "C2" })];
    const c = compareWithReference(ours, reference);
    expect(c.episodes_matched).toBe(2);
    expect(c.episodes_mismatched).toEqual([]);
    expect(c.reference_condition).toBe("C1");
    expect(c.reference_success?.success).toBe(2);
  });

  it("compares only the reference's rows of the same corruption setting", () => {
    const ours = cellOf("C1", [row(0)]);
    const stale = row(0, { corrupt_mode: "stale", corrupt_rate: 0.3, success: false });
    const c = compareWithReference(ours, [row(0), stale]);
    expect(c.reference_success?.episodes).toBe(1);
    expect(c.reference_success?.success).toBe(1);
    expect(compareWithReference(ours, [stale]).episodes_mismatched).toEqual([
      "arc0-000-e0-indep-refund",
    ]);
  });

  it("names an episode whose task differs from the reference run's", () => {
    const ours = cellOf("C2", [row(0), row(1)]);
    const reference = [row(0), row(1, { task_id: "arc0-000-e1-probe-addr", kind: "T_addr" })];
    const c = compareWithReference(ours, reference);
    expect(c.episodes_mismatched).toEqual(["arc0-000-e1-indep-refund"]);
    expect(c.reference_condition).toBeNull();
  });
});
