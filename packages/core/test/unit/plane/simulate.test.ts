// The policy simulator (card E8.9) on the real plane modules: a workload is
// replayed under the plane's policy and a candidate, each on a scratch log
// and store, and the report carries decisions, the utility proxy (items reads
// returned) and evictions per policy, and the steps that differ. The plane's
// own log and store are never touched, and the same workload gives the same
// report.
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { replayWorkload, runWorkload } from "../../../src/plane/simulate.ts";
import { type Actor, InvalidCallError } from "../../../src/plane.ts";
import { loadPreset } from "../../../src/policy/load.ts";
import type { Policy } from "../../../src/schema.ts";
import type { Workload } from "../../../src/simulate.ts";
import { AT, fresh, id, item, testPolicy } from "./helpers.ts";

const FIXTURE = new URL("../../../../../fixtures/workloads/e8-9-two-presets.json", import.meta.url);
const twoPresets = (): Workload => JSON.parse(readFileSync(FIXTURE, "utf8")) as Workload;

const omar: Actor = {
  id: "person:omar",
  level: "person",
  memberships: ["person:omar"],
  source: "user",
};

type Rule = Policy["retention"][number];
const withBudget = (budget: number | null, eviction: Rule["eviction"]) =>
  testPolicy({
    id: `budget-${budget}-${eviction}`,
    retention: [{ scope: "person", class: "semantic", ttl: null, budget, eviction }],
  });

const at = (minute: number) => `2026-10-25T12:${String(minute).padStart(2, "0")}:00Z`;
const write = (n: number, minute: number, content = `fact number ${n}`) => ({
  op: "write" as const,
  as: "omar",
  at: at(minute),
  item: item(n, { scope: "person:omar", content }),
});
const read = (minute: number, text: string) => ({
  op: "read" as const,
  as: "omar",
  at: at(minute),
  text,
});

describe("acceptance (card E8.9): the fixture workload under two presets", () => {
  test("medium against strict: strict's floors deny three writes, its ttl expires one, and recall falls", async () => {
    const { plane } = fresh(loadPreset("medium"));
    const report = await plane.simulate(twoPresets(), loadPreset("strict"));
    expect(report.model_calls).toBe(0);
    expect([report.baseline.policy_id, report.candidate.policy_id]).toEqual([
      "preset.medium",
      "preset.strict",
    ]);
    expect(report.baseline.totals).toEqual({ allow: 10, deny: 0, ask: 0 });
    expect(report.candidate.totals).toEqual({ allow: 7, deny: 3, ask: 0 });
    expect(report.baseline.utility).toEqual({
      reads: 3,
      returned: 5,
      reads_with_recall: 2,
      mean_returned: 5 / 3,
    });
    expect(report.candidate.utility).toEqual({
      reads: 3,
      returned: 1,
      reads_with_recall: 1,
      mean_returned: 1 / 3,
    });
    expect(report.baseline.evictions).toEqual({ evicted: 0, expired: 0, asked: 0 });
    expect(report.candidate.evictions).toEqual({ evicted: 0, expired: 1, asked: 0 });
    expect(report.changed.map((c) => [c.step, c.op, c.candidate.policy_id])).toEqual([
      [1, "write", "preset.strict/write/team"],
      [2, "write", "preset.strict/write/org"],
      [4, "write", "preset.strict/write/person"],
      [6, "read", "preset.strict/read/person"],
      [8, "retain", "preset.strict/retention/person/episodic"],
      [9, "read", "preset.strict/read/person"],
    ]);
  });

  test("a preset against itself changes nothing", async () => {
    const { plane } = fresh(loadPreset("strict"));
    const report = await plane.simulate(twoPresets(), loadPreset("strict"));
    expect(report.changed).toEqual([]);
    expect(report.candidate).toEqual(report.baseline);
  });

  test("the same workload gives the same report", async () => {
    const { plane } = fresh(loadPreset("medium"));
    const once = await plane.simulate(twoPresets(), loadPreset("permissive"));
    expect(await plane.simulate(twoPresets(), loadPreset("permissive"))).toEqual(once);
  });

  test("the plane's own log and store are never read or written", async () => {
    const { plane, adapter } = fresh(loadPreset("medium"));
    await plane.write(omar, item(90, { scope: "person:omar", content: "held for real" }), AT);
    const before = plane.events();
    const report = await plane.simulate(
      { id: "w", actors: { omar }, steps: [read(1, "held real")] },
      loadPreset("strict"),
    );
    expect(report.baseline.utility.returned, "the real item is not in the replay").toBe(0);
    expect(plane.events()).toEqual(before);
    expect(await adapter.list("person:omar")).toHaveLength(1);
  });
});

describe("evictions are decided again under each policy", () => {
  test("recency: a budget of two evicts the oldest on the third write, and no budget evicts nothing", async () => {
    const workload: Workload = {
      id: "w",
      actors: { omar },
      steps: [write(1, 1), write(2, 2), write(3, 3)],
    };
    const tight = await runWorkload(workload, withBudget(2, "recency"));
    expect(tight.outcomes[2]?.evicted).toEqual([id(1)]);
    expect(tight.evictions.evicted).toBe(1);
    expect(tight.active).toEqual({ "person:omar": 2 });
    const open = await runWorkload(workload, withBudget(null, "recency"));
    expect(open.evictions.evicted).toBe(0);
    expect(open.active).toEqual({ "person:omar": 3 });
  });

  test("utility: the replayed reads decide which item is least used (ADR 0025, P4-5)", async () => {
    const workload: Workload = {
      id: "w",
      actors: { omar },
      steps: [
        write(1, 1, "alpha tea"),
        write(2, 2, "beta coffee"),
        read(3, "alpha"),
        read(4, "beta"),
        read(5, "alpha"),
        write(3, 6, "gamma water"),
      ],
    };
    const run = await runWorkload(workload, withBudget(2, "utility"));
    // Item 2 was returned once and item 1 twice; the new item is protected.
    expect(run.outcomes[5]?.evicted).toEqual([id(2)]);
    expect(run.utility).toEqual({ reads: 3, returned: 3, reads_with_recall: 3, mean_returned: 1 });
  });

  test("manual: an overage asks once and evicts nothing", async () => {
    const workload: Workload = {
      id: "w",
      actors: { omar },
      steps: [write(1, 1), write(2, 2)],
    };
    const run = await runWorkload(workload, withBudget(1, "manual"));
    expect(run.evictions).toEqual({ evicted: 0, expired: 0, asked: 1 });
    expect(run.totals).toEqual({ allow: 2, deny: 0, ask: 0 });
  });
});

describe("steps", () => {
  test("a write whose item fails the schema replays as the plane's schema denial", async () => {
    const run = await runWorkload(
      { id: "w", actors: { omar }, steps: [{ op: "write", as: "omar", at: AT, item: { id: 1 } }] },
      testPolicy(),
    );
    expect(run.outcomes[0]).toMatchObject({ decision: "deny", policy_id: "engram/write/schema" });
  });

  test("a promotion is judged by the candidate's review rule", async () => {
    const reviewer: Actor = {
      id: "person:lea",
      level: "person",
      memberships: ["person:omar", "org"],
      source: "user",
    };
    const workload: Workload = {
      id: "w",
      actors: { omar: { ...omar, memberships: ["person:omar", "org"] }, lea: reviewer },
      steps: [
        write(1, 1),
        { op: "promote", as: "omar", at: at(2), item_id: id(1), to_scope: "org" },
      ],
    };
    const run = await runWorkload(workload, testPolicy());
    // testPolicy's org rule requires review, and omar is not reviewing: ask.
    expect(run.outcomes[1]).toMatchObject({ op: "promote", decision: "ask", item_id: id(1) });
  });

  test("a blocked bypass replays as its bypass_blocked event under any policy (card PX2)", async () => {
    const workload: Workload = {
      id: "w",
      actors: { omar },
      steps: [
        { op: "bypass", as: "omar", at: AT, bypass: { command: "mem0 add x", store: "mem0" } },
      ],
    };
    const { run, events } = await replayWorkload(workload, testPolicy());
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ op: "bypass_blocked", decision: "deny", actor: omar.id });
    expect(run.outcomes[0]?.policy_id).toBe(events[0]?.policy_id);
    const other = await runWorkload(workload, loadPreset("strict"));
    expect(other.outcomes[0]?.decision).toBe("deny");
  });

  test("replayWorkload returns the events of its scratch log, in order", async () => {
    const { run, events } = await replayWorkload(
      { id: "w", actors: { omar }, steps: [write(1, 1), read(2, "fact")] },
      testPolicy(),
    );
    expect(events.map((e) => [e.seq, e.op])).toEqual([
      [0, "write"],
      [1, "read"],
    ]);
    expect(events[1]?.item_ids).toEqual(run.outcomes[1]?.returned);
    expect(events[0]?.item?.store_ref?.adapter).toBe("simulation");
  });

  test("a sweep by a non-member is denied as on the plane", async () => {
    const run = await runWorkload(
      { id: "w", actors: { omar }, steps: [{ op: "retain", as: "omar", at: AT, scope: "team:x" }] },
      testPolicy(),
    );
    expect(run.outcomes[0]).toMatchObject({
      decision: "deny",
      policy_id: "engram/retention/membership",
    });
  });
});

describe("an invalid workload is refused before anything runs", () => {
  test("a step naming no actor", async () => {
    const { plane } = fresh(testPolicy());
    await expect(
      plane.simulate({ id: "w", actors: {}, steps: [read(1, "x")] }, testPolicy()),
    ).rejects.toThrow(InvalidCallError);
  });

  test("a promotion naming no item id, or a sweep of no scope, is refused before anything runs", async () => {
    const { plane } = fresh(testPolicy());
    for (const step of [
      { op: "promote", as: "omar", at: AT, item_id: "not-an-id", to_scope: "org" },
      { op: "promote", as: "omar", at: AT, item_id: id(1), to_scope: "everyone" },
      { op: "retain", as: "omar", at: AT, scope: "everyone" },
    ])
      await expect(
        plane.simulate(
          { id: "w", actors: { omar }, steps: [step] } as unknown as Workload,
          testPolicy(),
        ),
      ).rejects.toThrow(/invalid workload/);
  });

  test("a malformed step", async () => {
    const { plane } = fresh(testPolicy());
    const bad = { id: "w", actors: { omar }, steps: [{ op: "forget", as: "omar", at: AT }] };
    await expect(plane.simulate(bad as unknown as Workload, testPolicy())).rejects.toThrow(
      /invalid workload/,
    );
  });
});
