// Card D3: the replay validation gate through the runner. The fixture config
// (research/configs/d3-validate-fixture.json) replays its committed cassettes
// with zero new calls: every held-out task runs once without the candidate
// and once with it installed, the task's own check scores each session, and
// Plane.promote admits the candidate at the policy's replay_k of replay_n.
// The split test holds for every candidate of the fixture.
import { join, resolve } from "node:path";
import { memoryCache } from "@engram/model";
import { describe, expect, test } from "vitest";
import {
  applyActions,
  countReplayConfig,
  loadReplayFixture,
  procedureBlock,
  readReplayConfig,
  replayPlan,
  runReplayConfig,
  type Task,
  taskReward,
  tau2Reward,
} from "../src/replay-validate.ts";

const REPO = resolve(import.meta.dirname, "../../..");
const FIXTURE = join(REPO, "research/configs/d3-validate-fixture.json");

describe("the split by construction (card D3, step 1)", () => {
  const config = readReplayConfig(FIXTURE);
  const fixture = loadReplayFixture(config);
  const plan = replayPlan(fixture);

  test.each(fixture.candidates.map((c) => [c.name, c] as const))(
    "%s is never replayed on a task it was induced from",
    (name, candidate) => {
      const held = plan.held_out[name] ?? [];
      expect(held.length).toBeGreaterThan(0);
      expect(held.filter((t) => candidate.induced_from.includes(t))).toEqual([]);
      // Every pool task is either an induction task or held out, never both.
      const pool = fixture.tasks.map((t) => t.id);
      expect([...held, ...candidate.induced_from].sort()).toEqual([...pool].sort());
    },
  );

  test("every induction task the fixture names is in the pool", () => {
    const pool = new Set(fixture.tasks.map((t) => t.id));
    for (const c of fixture.candidates)
      for (const t of c.induced_from) expect(pool.has(t)).toBe(true);
  });
});

describe("the oracle: the task's own check (card D3, step 3)", () => {
  const task = (check: Task["check"]): Task => ({
    id: "x",
    prompt: "p",
    db: { orders: { W1: { status: "pending", address: "a", items: [], refunded: [] } } },
    check,
  });
  const change = [{ name: "update_address", arguments: { order_id: "W1", address: "b" } }];

  test("a database-state hash: 1 when the final database is the gold actions' database", () => {
    const t = task({ kind: "db-hash", gold: change });
    expect(taskReward(t, { db: applyActions(t.db, change), text: "" })).toBe(1);
    expect(taskReward(t, { db: t.db, text: "" })).toBe(0);
  });

  test("the hash ignores key order, as a canonical encoding does", () => {
    const t = task({ kind: "db-hash", gold: [] });
    const reordered = {
      orders: { W1: { refunded: [], items: [], address: "a", status: "pending" } },
    };
    expect(taskReward(t, { db: reordered, text: "" })).toBe(1);
  });

  test("a stated outcome: 1 when the final reply names it", () => {
    const t = task({ kind: "stated", outcome: "delivered" });
    expect(taskReward(t, { db: t.db, text: "Order W1 has been Delivered." })).toBe(1);
    expect(taskReward(t, { db: t.db, text: "It is pending." })).toBe(0);
  });

  test("a tau2-bench task row: its database hash check (card B11's row)", () => {
    expect(tau2Reward({ db_match: true, db_reward: 1 })).toBe(1);
    expect(tau2Reward({ db_match: false, db_reward: 0 })).toBe(0);
    expect(() => tau2Reward({ db_match: true, db_reward: 0 })).toThrow("disagree");
  });
});

describe("the installed candidate", () => {
  test("the with-candidate session's system prompt carries its body and allowlist", () => {
    const fixture = loadReplayFixture(readReplayConfig(FIXTURE));
    const c = fixture.candidates[0];
    if (!c) throw new Error("no candidate");
    const block = procedureBlock(c);
    expect(block).toContain(c.body.trim());
    expect(block).toContain(`tools="${c.tools.join(" ")}"`);
  });
});

describe("acceptance (card D3): the replayed fixture admits one candidate and refuses one", () => {
  test("from the committed cassettes, zero new calls", async () => {
    const config = readReplayConfig(FIXTURE);
    const result = await runReplayConfig(config, { offline: true });
    expect(result.calls.new).toBe(0);
    expect(result.calls.cached).toBeGreaterThan(0);
    const by = Object.fromEntries(result.candidates.map((c) => [c.name, c]));
    expect(by["lookup-first"]).toMatchObject({
      status: "active",
      record: { k: 4, n: 5, threshold: 1, baseline: 2 },
      event: { op: "promote", decision: "allow", policy_id: "preset.medium/promotion/procedural" },
    });
    expect(by["lookup-first"]?.event.reason).toContain(
      "the validation record 4 of 5 held-out tasks at or above 1 with the procedure (2 of 5 without it) meets 4 of 5",
    );
    expect(by["delivered-assumption"]).toMatchObject({
      status: "candidate",
      record: { k: 3, n: 5, threshold: 1, baseline: 4 },
      event: { op: "promote", decision: "deny", policy_id: "engram/promote/no-evidence" },
    });
    expect(by["delivered-assumption"]?.event.reason).toContain("3 of 5");
    // Every replayed session ran a held-out task of its candidate.
    for (const row of result.rows)
      if (row.candidate !== null)
        expect(by[row.candidate]?.induced_from.includes(row.task)).toBe(false);
    expect(result.mismatches).toEqual([]);
  });

  test("a replay against an empty cache is a miss, never a call", async () => {
    const config = readReplayConfig(FIXTURE);
    await expect(
      runReplayConfig(config, { offline: true, cache: memoryCache() }),
    ).rejects.toThrow();
  });
});

describe("COUNT=1", () => {
  test("counts the sessions without calling a model", () => {
    const count = countReplayConfig(readReplayConfig(FIXTURE));
    expect(count).toMatchObject({ baseline_sessions: 8, candidate_sessions: 10, sessions: 18 });
    expect(count.candidates.map((c) => c.held_out.length)).toEqual([5, 5]);
  });
});
