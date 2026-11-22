// Card D3's admission decision (ADR 0011, ADR 0026, ADR 0045 proposed): the
// held-out split is made by construction, a replay that names a task the
// candidate was induced from is refused, a replay is bound to its item and to
// the tasks of the item's own distill ref, a held-out task passes when its mean
// reward with the candidate is at least the registered 2/3 and no lower than
// its mean without it (the lead's answers of 2026-11-22 to review findings
// D3-1 and D3-2), a replay has exactly replay_n held-out tasks, and the
// candidate is admitted when the passes meet the policy's replay_k of replay_n.
import { describe, expect, test } from "vitest";
import { strictContentHash } from "../../../src/content-hash.ts";
import {
  admission,
  bindingProblem,
  heldOutTasks,
  REPLAY_THRESHOLD,
  type ReplayEvidence,
  type ReplayOutcome,
  replayDigest,
  replayProblem,
  scoreReplay,
  sizeProblem,
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

/** Outcomes over seeds 1 to 3 per task: its rewards without and with the candidate, seed by seed. */
function seeded(byTask: Record<string, { without: number[]; with: number[] }>): ReplayOutcome[] {
  return Object.entries(byTask).flatMap(([task, r]) =>
    r.with.map((w, i) => run(task, r.without[i] as number, w, i + 1)),
  );
}

const ITEM_ID = "01920000-0000-7000-8000-000000000001";
const CONTENT = { body: "# Look first", tools: ["read"] };

/** Five held-out tasks, `passes` of them passing with the candidate, `base` without it. */
function evidence(passes: number, base = 0, over: Partial<ReplayEvidence> = {}): ReplayEvidence {
  const tasks = ["t3", "t4", "t5", "t6", "t7"];
  return {
    item_id: ITEM_ID,
    content_hash: strictContentHash(CONTENT),
    induced_from: ["t1", "t2"],
    threshold: REPLAY_THRESHOLD,
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
    [{ threshold: 1 }, "registered 2/3"],
    [{ threshold: 0.5 }, "registered 2/3"],
    [{ threshold: 0.67 }, "registered 2/3"],
    [{ threshold: 0 }, "threshold"],
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

describe("scoreReplay: k of n held-out tasks pass", () => {
  test("counts the tasks whose reward with the candidate reaches 2/3 and the baseline", () => {
    const { record, tasks } = scoreReplay(evidence(4, 2));
    expect(record).toEqual({
      k: 4,
      n: 5,
      threshold: REPLAY_THRESHOLD,
      baseline: 2,
      replay_sha256: replayDigest(evidence(4, 2)),
    });
    expect(tasks.map((t) => t.passed)).toEqual([true, true, true, true, false]);
    expect(tasks.map((t) => t.baseline_passed)).toEqual([true, true, false, false, false]);
  });

  test("a task's reward is its mean over the seeds: 2 of 3 seeds reach 2/3, 1 of 3 does not", () => {
    const outcomes = seeded({
      a: { without: [0, 0, 0], with: [1, 1, 0] },
      b: { without: [0, 0, 0], with: [1, 0, 0] },
    });
    const scored = scoreReplay({ ...evidence(0), induced_from: [], outcomes });
    expect(scored.tasks).toEqual([
      { task: "a", runs: 3, without: 0, with: 2 / 3, passed: true, baseline_passed: false },
      { task: "b", runs: 3, without: 0, with: 1 / 3, passed: false, baseline_passed: false },
    ]);
  });

  test("a task that reaches 2/3 but falls below its baseline fails (D3-1, no worse)", () => {
    const outcomes = seeded({
      even: { without: [1, 1, 0], with: [0, 1, 1] },
      below: { without: [1, 1, 1], with: [1, 1, 0] },
    });
    const scored = scoreReplay({ ...evidence(0), induced_from: [], outcomes });
    expect(scored.tasks.map((t) => [t.task, t.passed])).toEqual([
      ["even", true],
      ["below", false],
    ]);
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
      "4 of 5 held-out tasks pass with the procedure (a mean reward of at least 2/3 over the seeds, and no lower than without it; 2 of 5 reach 2/3 without it) meets 4 of 5",
    );
  });

  test("3 of 5 leaves it a candidate, the counts in the reason", () => {
    const a = admission(POLICY, evidence(3, 4));
    expect(a.decision).toBe("refuse");
    expect(a.reason).toBe(
      "3 of 5 held-out tasks pass with the procedure (a mean reward of at least 2/3 over the seeds, and no lower than without it; 4 of 5 reach 2/3 without it) does not meet 4 of 5",
    );
  });

  test("a replay of other than replay_n held-out tasks is refused, all passing or not (D3-1)", () => {
    const four = evidence(5);
    const short = { ...four, outcomes: four.outcomes.slice(0, 4) };
    expect(sizeProblem(POLICY, short)).toContain(
      "4 held-out tasks, and the policy's replay_n is 5",
    );
    expect(admission(POLICY, short)).toMatchObject({ decision: "refuse", record: { k: 4, n: 4 } });
    const six = { ...four, outcomes: [...four.outcomes, run("t8", 0, 1)] };
    expect(sizeProblem(POLICY, six)).toContain("6 held-out tasks");
    expect(admission(POLICY, six).decision).toBe("refuse");
    expect(sizeProblem(POLICY, evidence(5))).toBeNull();
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

describe("the lead's rule of 2026-11-22 (D3-1, D3-2, D3-7)", () => {
  test("4 of 5 with the candidate against 5 of 5 without it is refused: the four fall below baseline", () => {
    const outcomes = seeded({
      t3: { without: [1, 1, 1], with: [1, 1, 0] },
      t4: { without: [1, 1, 1], with: [1, 0, 1] },
      t5: { without: [1, 1, 1], with: [0, 1, 1] },
      t6: { without: [1, 1, 1], with: [1, 1, 0] },
      t7: { without: [1, 1, 1], with: [0, 0, 0] },
    });
    const a = admission(POLICY, { ...evidence(0), outcomes });
    // Four tasks reach 2/3 with it, but each is below its baseline of 1.
    expect(a.tasks.filter((t) => t.with >= REPLAY_THRESHOLD).length).toBe(4);
    expect(a).toMatchObject({ decision: "refuse", record: { k: 0, n: 5, baseline: 5 } });
  });

  test("pooled success does not decide: 11 of 15 against 8 of 15 is refused when only 3 tasks pass", () => {
    const outcomes = seeded({
      t3: { without: [1, 0, 0], with: [1, 1, 1] },
      t4: { without: [1, 0, 0], with: [1, 1, 1] },
      t5: { without: [1, 0, 0], with: [1, 1, 1] },
      t6: { without: [1, 1, 1], with: [1, 0, 0] },
      t7: { without: [1, 1, 0], with: [1, 0, 0] },
    });
    const pooled = (arm: "with" | "without") => outcomes.reduce((n, o) => n + o[arm], 0);
    expect([pooled("with"), pooled("without")]).toEqual([11, 8]);
    expect(admission(POLICY, { ...evidence(0), outcomes })).toMatchObject({
      decision: "refuse",
      record: { k: 3, n: 5 },
    });
  });

  test("the same pooled rates are admitted when 4 tasks each pass", () => {
    const outcomes = seeded({
      t3: { without: [1, 1, 0], with: [1, 1, 1] },
      t4: { without: [1, 1, 0], with: [1, 1, 1] },
      t5: { without: [1, 1, 0], with: [1, 1, 1] },
      t6: { without: [1, 1, 0], with: [1, 1, 0] },
      t7: { without: [0, 0, 0], with: [0, 0, 0] },
    });
    const pooled = (arm: "with" | "without") => outcomes.reduce((n, o) => n + o[arm], 0);
    expect([pooled("with"), pooled("without")]).toEqual([11, 8]);
    expect(admission(POLICY, { ...evidence(0), outcomes })).toMatchObject({
      decision: "admit",
      record: { k: 4, n: 5 },
    });
  });

  test("the threshold is fixed at 2/3 in core", () => {
    expect(REPLAY_THRESHOLD).toBe(2 / 3);
  });
});
