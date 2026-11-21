// Card D3's admission decision (ADR 0011, ADR 0026, ADR 0045 proposed): the
// held-out split is made by construction, a replay that names a task the
// candidate was induced from is refused, a held-out task passes when its mean
// reward with the candidate is at or above the threshold, and the candidate
// is admitted when the passes meet the policy's replay_k of replay_n.
import { describe, expect, test } from "vitest";
import {
  admission,
  heldOutTasks,
  type ReplayEvidence,
  type ReplayOutcome,
  replayProblem,
  scoreReplay,
} from "../../../src/distill/validate.ts";
import type { Policy } from "../../../src/schema.ts";

const POLICY = {
  promotion: {
    episodic_to_semantic: { confirmations: 3, or_review: true },
    procedural: { replay_k: 4, replay_n: 5 },
  },
} as Policy;

const run = (task: string, without: number, withIt: number, seed = 1): ReplayOutcome => ({
  task,
  seed,
  without,
  with: withIt,
});

/** Five held-out tasks, `passes` of them passing with the candidate, `base` without it. */
function evidence(passes: number, base = 0, over: Partial<ReplayEvidence> = {}): ReplayEvidence {
  const tasks = ["t3", "t4", "t5", "t6", "t7"];
  return {
    induced_from: ["t1", "t2"],
    threshold: 1,
    outcomes: tasks.map((t, i) => run(t, i < base ? 1 : 0, i < passes ? 1 : 0)),
    ...over,
  };
}

describe("heldOutTasks: the split by construction", () => {
  test("leaves out every task the candidate was induced from, in the pool's order", () => {
    expect(heldOutTasks(["t1", "t2", "t3", "t4"], ["t3", "t1"])).toEqual(["t2", "t4"]);
  });

  test("never returns an induction task, for any pool and induction set", () => {
    const pool = ["a", "b", "c", "d", "e", "f"];
    for (let mask = 0; mask < 1 << pool.length; mask++) {
      const induced = pool.filter((_, i) => mask & (1 << i));
      const held = heldOutTasks(pool, induced);
      expect(held.filter((t) => induced.includes(t))).toEqual([]);
      expect(held.length + induced.length).toBe(pool.length);
    }
  });

  test("a task the pool names twice is held out once", () => {
    expect(heldOutTasks(["t1", "t2", "t2"], [])).toEqual(["t1", "t2"]);
  });
});

describe("replayProblem: what makes a replay unusable", () => {
  test("a well-formed replay has none", () => {
    expect(replayProblem(evidence(4))).toBeNull();
  });

  test("a replayed task the candidate was induced from is refused (leakage)", () => {
    const leaked = evidence(4, 0, { induced_from: ["t1", "t5"] });
    expect(replayProblem(leaked)).toContain("t5 is a task the candidate was induced from");
  });

  test.each([
    [{ threshold: 0 }, "threshold"],
    [{ threshold: 1.5 }, "threshold"],
    [{ threshold: Number.NaN }, "threshold"],
    [{ outcomes: [] }, "no held-out"],
  ])("%j is refused", (over, says) => {
    expect(replayProblem(evidence(4, 0, over as Partial<ReplayEvidence>))).toContain(says);
  });

  test("a reward outside 0 to 1 is refused", () => {
    const bad = evidence(4);
    const outcomes = [...bad.outcomes, run("t8", 0, 2)];
    expect(replayProblem({ ...bad, outcomes })).toContain("reward");
  });

  test("the same task and seed twice is refused", () => {
    const twice = evidence(4);
    expect(replayProblem({ ...twice, outcomes: [...twice.outcomes, run("t3", 1, 1)] })).toContain(
      "twice",
    );
  });

  test("tasks run on different seeds are refused", () => {
    const uneven = evidence(4);
    const outcomes = [...uneven.outcomes, run("t3", 0, 1, 2)];
    expect(replayProblem({ ...uneven, outcomes })).toContain("seeds");
  });
});

describe("scoreReplay: k of n held-out tasks at or above the threshold", () => {
  test("counts the tasks whose reward with the candidate reaches the threshold", () => {
    const { record, tasks } = scoreReplay(evidence(4, 2));
    expect(record).toEqual({ k: 4, n: 5, threshold: 1, baseline: 2 });
    expect(tasks.map((t) => t.passed)).toEqual([true, true, true, true, false]);
    expect(tasks.map((t) => t.baseline_passed)).toEqual([true, true, false, false, false]);
  });

  test("a task's reward is its mean over the seeds", () => {
    const outcomes = ["a", "b"].flatMap((t) => [run(t, 0, 1, 1), run(t, 0, t === "a" ? 1 : 0, 2)]);
    const scored = scoreReplay({ induced_from: [], threshold: 0.5, outcomes });
    expect(scored.tasks).toEqual([
      { task: "a", runs: 2, without: 0, with: 1, passed: true, baseline_passed: false },
      { task: "b", runs: 2, without: 0, with: 0.5, passed: true, baseline_passed: false },
    ]);
    const strict = scoreReplay({ induced_from: [], threshold: 1, outcomes });
    expect(strict.record.k).toBe(1);
  });

  test("throws on a replay with a problem", () => {
    expect(() => scoreReplay(evidence(4, 0, { induced_from: ["t3"] }))).toThrow("induced from");
  });
});

describe("admission: the policy's replay_k of replay_n decides", () => {
  test("4 of 5 at the threshold admits under 4 of 5", () => {
    const a = admission(POLICY, evidence(4, 2));
    expect(a.decision).toBe("admit");
    expect(a.reason).toBe(
      "4 of 5 held-out tasks at or above 1 with the procedure (2 of 5 without it) meets 4 of 5",
    );
  });

  test("3 of 5 leaves it a candidate, the counts in the reason", () => {
    const a = admission(POLICY, evidence(3, 4));
    expect(a.decision).toBe("refuse");
    expect(a.reason).toBe(
      "3 of 5 held-out tasks at or above 1 with the procedure (4 of 5 without it) does not meet 4 of 5",
    );
  });

  test("fewer held-out tasks than replay_n never admits, even all passing", () => {
    const four = evidence(4);
    const a = admission(POLICY, { ...four, outcomes: four.outcomes.slice(0, 4) });
    expect(a).toMatchObject({ decision: "refuse", record: { k: 4, n: 4 } });
  });

  test("the strict preset's 5 of 5 refuses what medium's 4 of 5 admits", () => {
    const strict = {
      promotion: { ...POLICY.promotion, procedural: { replay_k: 5, replay_n: 5 } },
    } as Policy;
    expect(admission(strict, evidence(4)).decision).toBe("refuse");
    expect(admission(strict, evidence(5)).decision).toBe("admit");
  });
});
