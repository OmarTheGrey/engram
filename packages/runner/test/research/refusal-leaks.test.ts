// The checkpoints where a plain refusal is itself scored as a leak (PR 4,
// part A, review fix pass, item 9): their ids, for H1's sensitivity table.
// The scoring is GateMem's rule-based scorer through `refusalLeaks`, the same
// function the reachable-leak measure counts with (PR 2).
import { join } from "node:path";
import { gatemem } from "@engram/bench";
import { loadPreset } from "@engram/core";
import { describe, expect, test } from "vitest";
import { reachRows, refusalLeaks } from "../../src/research/gatemem-reach.ts";
import { refusalRows } from "../../src/research/refusal-leaks.ts";

const FIXTURES = join(import.meta.dirname, "../../../../fixtures/bench/gatemem");
const domains = gatemem.loadDataset(FIXTURES);
const REFUSALS = ["No, I can't share that.", "No.", "I can't help with that request."];

const planted = (targets: string[], kind: "privacy" | "safety") =>
  ({
    checkpoint_id: "planted_ckpt_01",
    episode_id: "planted",
    as_of_turn_id: "t001",
    asker: { principal_id: "a", role: "r" },
    query_type: kind,
    query_text: "q",
    expected_action: kind === "privacy" ? "refuse" : "no_memory",
    judge_spec: { not_include: [] },
    leak_targets: targets,
  }) as unknown as gatemem.Checkpoint;

describe("a refusal scored as a leak", () => {
  test("a bare 'no' target turns the plain refusals that say no into leaks", () => {
    expect(refusalLeaks(planted(["no"], "privacy"), REFUSALS)).toEqual([
      "No, I can't share that.",
      "No.",
    ]);
    expect(refusalLeaks(planted(["no"], "safety"), REFUSALS)).toHaveLength(2);
  });

  test("a specific target leaves every plain refusal unscored", () => {
    expect(refusalLeaks(planted(["Harbor State Exchange Center"], "privacy"), REFUSALS)).toEqual(
      [],
    );
  });
});

describe("the refusal-leak rows", () => {
  test("name every access and forgetting checkpoint with its scored refusals, as the reach rows count them", async () => {
    const policy = loadPreset("medium");
    for (const domain of domains) {
      const rows = refusalRows(domain, REFUSALS);
      const reach = await reachRows(domain, policy, REFUSALS);
      expect(rows.map((r) => r.checkpoint_id)).toEqual(reach.map((r) => r.checkpoint_id));
      expect(rows.map((r) => r.refusals.length)).toEqual(reach.map((r) => r.refusal_leaks));
      for (const r of rows) expect(["access", "forgetting"]).toContain(r.kind);
    }
  }, 120_000);
});
