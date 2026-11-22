// Card D3's admission decision (ADR 0011, ADR 0026, ADR 0045 proposed): the
// held-out split is made by construction, a replay that names a task the
// candidate was induced from is refused, a replay is bound to its item and to
// the tasks of the item's own distill ref, a held-out task passes when its mean
// reward with the candidate is at or above the threshold, and the candidate
// is admitted when the passes meet the policy's replay_k of replay_n.
import { describe, expect, test } from "vitest";
import { strictContentHash } from "../../../src/content-hash.ts";
import {
  admission,
  bindingProblem,
  heldOutTasks,
  type ReplayEvidence,
  type ReplayOutcome,
  replayDigest,
  replayProblem,
  scoreReplay,
  splitProblem,
} from "../../../src/distill/validate.ts";
import type { MemoryItem, Policy } from "../../../src/schema.ts";

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

const ITEM_ID = "01920000-0000-7000-8000-000000000001";
const CONTENT = { body: "# Look first", tools: ["read"] };

/** Five held-out tasks, `passes` of them passing with the candidate, `base` without it. */
function evidence(passes: number, base = 0, over: Partial<ReplayEvidence> = {}): ReplayEvidence {
  const tasks = ["t3", "t4", "t5", "t6", "t7"];
  return {
    item_id: ITEM_ID,
    content_hash: strictContentHash(CONTENT),
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

  test("a replayed task the candidate was induced from is a split problem, not a shape one", () => {
    const leaked = evidence(4, 0, { induced_from: ["t1", "t5"] });
    expect(replayProblem(leaked)).toBeNull();
    expect(splitProblem(leaked)).toContain("t5 is a task the candidate was induced from");
    expect(splitProblem(evidence(4))).toBeNull();
  });

  test("a replay that names no item or no content hash is refused", () => {
    expect(replayProblem(evidence(4, 0, { item_id: "" }))).toContain("item");
    expect(replayProblem(evidence(4, 0, { content_hash: "x" }))).toContain("content hash");
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
    expect(record).toEqual({
      k: 4,
      n: 5,
      threshold: 1,
      baseline: 2,
      replay_sha256: replayDigest(evidence(4, 2)),
    });
    expect(tasks.map((t) => t.passed)).toEqual([true, true, true, true, false]);
    expect(tasks.map((t) => t.baseline_passed)).toEqual([true, true, false, false, false]);
  });

  test("a task's reward is its mean over the seeds", () => {
    const outcomes = ["a", "b"].flatMap((t) => [run(t, 0, 1, 1), run(t, 0, t === "a" ? 1 : 0, 2)]);
    const scored = scoreReplay({ ...evidence(0), induced_from: [], threshold: 0.5, outcomes });
    expect(scored.tasks).toEqual([
      { task: "a", runs: 2, without: 0, with: 1, passed: true, baseline_passed: false },
      { task: "b", runs: 2, without: 0, with: 0.5, passed: true, baseline_passed: false },
    ]);
    const strict = scoreReplay({ ...evidence(0), induced_from: [], threshold: 1, outcomes });
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

describe("replayDigest: the replay's sha256 the event's reason carries", () => {
  test("is the sha256 of the canonical replay: key order does not move it, a reward does", () => {
    const e = evidence(4, 2);
    expect(replayDigest(e)).toMatch(/^sha256:[0-9a-f]{64}$/);
    const reordered = Object.fromEntries(Object.entries(e).reverse()) as unknown as ReplayEvidence;
    expect(replayDigest(reordered)).toBe(replayDigest(e));
    expect(replayDigest(evidence(5, 2))).not.toBe(replayDigest(e));
  });
});

describe("bindingProblem: the replay is the item's, and its split is the item's ref", () => {
  const SESSIONS = new Map([
    ["s1", "t1"],
    ["s2", "t2"],
  ]);
  const candidate = (ref: string): MemoryItem =>
    ({
      id: ITEM_ID,
      class: "procedural",
      content: CONTENT,
      provenance: { kind: "model", ref, hash: `sha256:${"0".repeat(64)}`, actor: "person:a" },
    }) as MemoryItem;
  const REF = "distill:awm:s1,s2";

  test("a replay of the item, induced from its ref's tasks, has none", () => {
    expect(bindingProblem(candidate(REF), evidence(4), SESSIONS)).toBeNull();
  });

  test("a replay presented for another item is refused", () => {
    const other = evidence(4, 0, { item_id: "01920000-0000-7000-8000-000000000002" });
    expect(bindingProblem(candidate(REF), other, SESSIONS)?.policy_id).toBe(
      "engram/promote/replay-item",
    );
  });

  test("a replay of other content under the item's id is refused", () => {
    const stale = evidence(4, 0, { content_hash: strictContentHash({ body: "x", tools: [] }) });
    expect(bindingProblem(candidate(REF), stale, SESSIONS)?.policy_id).toBe(
      "engram/promote/replay-item",
    );
  });

  test("an empty induced_from against a ref naming t1, with t1 replayed, is refused", () => {
    const hidden = evidence(4, 0, {
      induced_from: [],
      outcomes: ["t1", "t3", "t4", "t5", "t6"].map((t) => run(t, 0, 1)),
    });
    const problem = bindingProblem(candidate("distill:rule:s1"), hidden, SESSIONS);
    expect(problem?.policy_id).toBe("engram/promote/replay-split");
    expect(problem?.reason).toContain("t1");
  });

  test("induction tasks other than the ref's are refused, even with no overlap", () => {
    const wrong = evidence(4, 0, { induced_from: ["t1"] });
    expect(bindingProblem(candidate(REF), wrong, SESSIONS)?.policy_id).toBe(
      "engram/promote/replay-split",
    );
  });

  test("a leaked split is a split problem", () => {
    const leaked = evidence(4, 0, { induced_from: ["t1", "t2", "t5"] });
    expect(bindingProblem(candidate(REF), leaked, SESSIONS)?.policy_id).toBe(
      "engram/promote/replay-split",
    );
  });

  test("a distill ref the plane cannot map to tasks is refused", () => {
    expect(bindingProblem(candidate(REF), evidence(4), undefined)?.reason).toContain(
      "no session index",
    );
    expect(bindingProblem(candidate("distill:awm:s1,s9"), evidence(4), SESSIONS)?.reason).toContain(
      "s9",
    );
  });

  test("an item with no distill ref was induced from nothing", () => {
    const byHand = candidate("doc/1");
    expect(bindingProblem(byHand, evidence(4, 0, { induced_from: [] }), SESSIONS)).toBeNull();
    expect(bindingProblem(byHand, evidence(4), SESSIONS)?.policy_id).toBe(
      "engram/promote/replay-split",
    );
  });
});
