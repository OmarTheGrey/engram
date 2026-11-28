// Card D4 of the second absorb plan: re-validation and retirement of admitted
// procedures on drift (ADR 0011 and ADR 0051 (proposed), ADR 0046).
//
// The acceptance (first describe): the runner's drift fixture
// (research/configs/d4-drift-fixture.json) replays card D3's admitted
// procedure on a task pool in which one held-out task changed, every call
// from committed cassettes with zero new calls, and wrote what it presented
// to the plane into fixtures/distill/d4-drift/revalidation.json. Presented
// here to the real Plane, under medium with `procedures.drift` on, the
// changed environment makes the re-validation due, its success rate falls
// below medium's floor, and the procedure is retired by one governed event
// naming the trigger; the retired version stays, and a re-validation on the
// environment put back restores it. The packages/runner test reruns the
// config and requires the same bytes with zero new calls.
//
// Then the rule itself (distill/drift.ts) and Plane.revalidate's refusals,
// each one event with its reason and rule (AGENTS.md rule 3).
import { readFileSync } from "node:fs";
import { createFakeAdapter } from "@engram/adapters";
import { beforeAll, describe, expect, test } from "vitest";
import { strictContentHash } from "../../../src/content-hash.ts";
import { migrate } from "../../../src/db/migrate.ts";
import { openSqlite } from "../../../src/db/sqlite.ts";
import {
  DRIFT_MEMBERSHIP_ID,
  DRIFT_NOT_DUE_ID,
  DRIFT_OFF_ID,
  DRIFT_SOURCE_ID,
  DRIFT_STATUS_ID,
  DRIFT_THRESHOLDS_ID,
  driftThresholdProblem,
  judgeDrift,
  revalidationDue,
} from "../../../src/distill/drift.ts";
import {
  REPLAY_SEEDS,
  REPLAY_THRESHOLD,
  type ReplayEvidence,
} from "../../../src/distill/validate.ts";
import { itemById } from "../../../src/items.ts";
import { offboard } from "../../../src/plane/offboard.ts";
import { type Actor, createPlane, InvalidCallError } from "../../../src/plane.ts";
import { RETIRED_CONTENT_ID } from "../../../src/policy/evaluate.ts";
import { loadPreset } from "../../../src/policy/load.ts";
import {
  PROMOTE_EXPIRED_ID,
  PROMOTE_NO_EVIDENCE_ID,
  PROMOTE_REPLAY_ITEM_ID,
  PROMOTE_REPLAY_SPLIT_ID,
} from "../../../src/policy/promotion.ts";
import { DOWNGRADE_ID } from "../../../src/policy/trust.ts";
import type { MemoryItem, Policy } from "../../../src/schema.ts";
import { AT, id, item, testPolicy } from "../plane/helpers.ts";

const FIXTURE = new URL(
  "../../../../../fixtures/distill/d4-drift/revalidation.json",
  import.meta.url,
);

interface DriftFixture {
  config: string;
  policy: Policy;
  item: MemoryItem;
  sessions: Record<string, string>;
  calls: { new: number; cached: number };
  phases: {
    name: "admission" | "drift" | "restore";
    at: string;
    replay: ReplayEvidence;
    environment: string;
  }[];
}

const hash = (c: string) => `sha256:${c.repeat(64)}`;

describe("acceptance (card D4): a fixture with a changed task retires the skill", () => {
  let fixture = {} as DriftFixture;
  beforeAll(() => {
    fixture = JSON.parse(readFileSync(FIXTURE, "utf8")) as DriftFixture;
  });
  const phase = (name: string) => {
    const p = fixture.phases.find((x) => x.name === name);
    if (!p) throw new Error(`the fixture has no ${name} phase`);
    return p;
  };

  async function admitted() {
    const db = openSqlite(":memory:");
    migrate(db);
    let n = 0;
    const plane = createPlane({
      db,
      adapter: createFakeAdapter(),
      policy: fixture.policy,
      newId: () => `01930000-0000-7000-8000-${String(++n).padStart(12, "0")}`,
      distillTasks: new Map(Object.entries(fixture.sessions)),
    });
    const owner = fixture.item.owner;
    const writer: Actor = {
      id: owner,
      level: "person",
      memberships: [fixture.item.scope],
      source: fixture.item.provenance.kind,
    };
    const operator: Actor = { ...writer, source: "user" };
    const a = phase("admission");
    expect((await plane.write(writer, fixture.item, a.at)).event.decision).toBe("allow");
    const promoted = await plane.promote(operator, fixture.item.id, fixture.item.scope, a.at, {
      replay: a.replay,
    });
    expect(promoted.decision).toBe("allow");
    return { db, plane, operator };
  }

  test("the fixture was replayed from cassettes with zero new calls, under medium with drift on", () => {
    expect(fixture.calls.new).toBe(0);
    expect(fixture.calls.cached).toBeGreaterThan(0);
    const { id: _id, procedures, ...rest } = fixture.policy;
    const { id: _m, ...medium } = loadPreset("medium");
    expect(rest).toEqual(medium);
    expect(procedures).toEqual({ drift: { environment_change: "on" } });
    expect(phase("drift").environment).not.toBe(phase("admission").environment);
    expect(phase("restore").environment).toBe(phase("admission").environment);
  });

  test("the changed environment retires the admitted procedure by one retire event naming the trigger", async () => {
    const { db, plane, operator } = await admitted();
    const a = phase("admission");
    const d = phase("drift");
    const before = plane.events().length;
    const result = await plane.revalidate(operator, fixture.item.id, d.at, {
      replay: d.replay,
      environment: { validated: a.environment, current: d.environment },
    });
    expect(result.outcome).toBe("retired");
    expect(result.trigger).toBe("environment-changed");
    expect(plane.events().length).toBe(before + 1);
    expect(result.event).toMatchObject({
      op: "retire",
      decision: "allow",
      item_id: fixture.item.id,
      policy_id: `${fixture.policy.id}/drift/environment-changed`,
    });
    expect(result.event.reason).toContain(
      `environment ${a.environment} changed to ${d.environment}`,
    );
    expect(result.event.reason).toMatch(/below the success floor 0\.700 after at least 10 trials/);
    const retired = itemById(db, fixture.item.id);
    expect(retired?.status).toBe("retired");
    // The retired version is kept: its content and version are as admitted.
    expect(retired?.content).toEqual(fixture.item.content);
  });

  test("re-validated on the environment put back, the retired version is restored", async () => {
    const { db, plane, operator } = await admitted();
    const a = phase("admission");
    const d = phase("drift");
    const r = phase("restore");
    await plane.revalidate(operator, fixture.item.id, d.at, {
      replay: d.replay,
      environment: { validated: a.environment, current: d.environment },
    });
    const retiredAs = itemById(db, fixture.item.id);
    const result = await plane.revalidate(operator, fixture.item.id, r.at, {
      replay: r.replay,
      environment: { validated: d.environment, current: r.environment },
    });
    expect(result.outcome).toBe("restored");
    expect(result.event).toMatchObject({
      op: "promote",
      decision: "allow",
      policy_id: `${fixture.policy.id}/drift/restored`,
    });
    expect(itemById(db, fixture.item.id)).toMatchObject({
      status: "active",
      version: (retiredAs?.version ?? 0) + 1,
      content: fixture.item.content,
    });
  });
});

// The rule, on hand-made replays: five held-out tasks, seeds 1 to 3.
const CONTENT = { body: "Look the order up before changing it.", tools: ["get_order"] };
const replay = (passes: number, over: Partial<ReplayEvidence> = {}): ReplayEvidence => ({
  item_id: id(1),
  content_hash: strictContentHash(CONTENT),
  induced_from: ["t1", "t2"],
  threshold: REPLAY_THRESHOLD,
  // `passes` successes in all, filled task by task, seed by seed.
  outcomes: ["t3", "t4", "t5", "t6", "t7"].flatMap((task, i) =>
    REPLAY_SEEDS.map((seed, j) => ({ task, seed, without: 0, with: i * 3 + j < passes ? 1 : 0 })),
  ),
  ...over,
});

const thresholds = { "replay-drift.success-floor": 0.7, "replay-drift.min-trials": 10 };
const DRIFT = testPolicy({
  write: testPolicy().write.map((r) =>
    r.scope === "person" ? { ...r, confidence_floor: 0, forbidden_classes: [] } : r,
  ),
  lints: { enabled: [], thresholds },
  procedures: { drift: { environment_change: "on", period: 86_400 } },
});

describe("when a re-validation is due (procedures.drift)", () => {
  const env = (a: string, b: string) => ({ validated: hash(a), current: hash(b) });
  test("absent is off: nothing is ever due", () => {
    const off = { ...DRIFT, procedures: {} };
    expect(revalidationDue(off, AT, "2030-01-01T00:00:00Z", env("a", "b"))).toBeNull();
  });
  test("a changed environment hash, when environment_change is on", () => {
    expect(revalidationDue(DRIFT, AT, AT, env("a", "b"))).toBe("environment-changed");
    expect(revalidationDue(DRIFT, AT, AT, env("a", "a"))).toBeNull();
    const noEnv = { ...DRIFT, procedures: { drift: { environment_change: "off" as const } } };
    expect(revalidationDue(noEnv, AT, AT, env("a", "b"))).toBeNull();
  });
  test("the period, from the last validation, inclusive", () => {
    expect(revalidationDue(DRIFT, AT, "2026-10-26T11:59:59Z")).toBeNull();
    expect(revalidationDue(DRIFT, AT, "2026-10-26T12:00:00Z")).toBe("replay-drift");
  });
  test("drift without ADR 0011's thresholds is refused by the loader's check", () => {
    const bare = { ...DRIFT, lints: { enabled: [], thresholds: {} } };
    expect(driftThresholdProblem(bare)).toMatch(/replay-drift\.success-floor/);
    expect(
      driftThresholdProblem({
        ...bare,
        lints: { enabled: [], thresholds: { "replay-drift.success-floor": 0.7 } },
      }),
    ).toMatch(/replay-drift\.min-trials/);
    expect(driftThresholdProblem(DRIFT)).toBeNull();
    expect(driftThresholdProblem(testPolicy())).toBeNull();
  });
});

describe("whether it retires: the success floor after min-trials (ADR 0011)", () => {
  test("below the floor retires, at it keeps (compared exactly: 0.7 of 15 is 10.5)", () => {
    expect(judgeDrift(DRIFT, replay(10)).decision).toBe("retire");
    expect(judgeDrift(DRIFT, replay(11)).decision).toBe("keep");
    expect(judgeDrift(DRIFT, replay(10))).toMatchObject({ trials: 15, successes: 10 });
  });
  test("fewer trials than min-trials never retire", () => {
    const fewer = {
      ...DRIFT,
      lints: { enabled: [], thresholds: { ...thresholds, "replay-drift.min-trials": 16 } },
    };
    const j = judgeDrift(fewer, replay(0));
    expect(j.decision).toBe("keep");
    expect(j.text).toContain("fewer than the 16 trials");
  });
  test("D3's admission record is reported beside it", () => {
    const j = judgeDrift(DRIFT, replay(12));
    expect(j.record).toMatchObject({ k: 4, n: 5 });
    expect(j.admits).toBe(true);
    expect(j.text).toContain("its admission record is 4 of 5 held-out tasks (meets 4 of 5)");
  });
});

const SCOPES = ["person:omar", "team:platform", "org"];
const omar: Actor = { id: "person:omar", level: "person", memberships: SCOPES, source: "user" };
const SESSIONS = new Map([
  ["s1", "t1"],
  ["s2", "t2"],
]);
const procedure = () =>
  ({
    ...item(1, { kind: "model" }),
    class: "procedural",
    scope: "person:omar",
    status: "candidate",
    content: CONTENT,
    provenance: { ...item(1).provenance, kind: "model", ref: "distill:awm:s1,s2" },
  }) as MemoryItem;

async function active(policy: Policy = DRIFT, proc: MemoryItem = procedure()) {
  const writer = proc.provenance.kind;
  const db = openSqlite(":memory:");
  migrate(db);
  let n = 0;
  const deps = {
    db,
    adapter: createFakeAdapter(),
    policy,
    newId: () => id(900_000 + ++n),
    distillTasks: SESSIONS,
  };
  const plane = createPlane(deps);
  await plane.write({ ...omar, source: writer }, proc, AT);
  const p = await plane.promote(omar, id(1), proc.scope, AT, { replay: replay(15) });
  expect(p.decision, p.event.reason).toBe("allow");
  return { db, plane, deps };
}

const changed = { validated: hash("a"), current: hash("b") };

describe("Plane.revalidate", () => {
  test("a due re-validation at or above the floor keeps it: one retire deny event with the counts", async () => {
    const { db, plane } = await active();
    const r = await plane.revalidate(omar, id(1), AT, { replay: replay(12), environment: changed });
    expect(r.outcome).toBe("kept");
    expect(r.event).toMatchObject({
      op: "retire",
      decision: "deny",
      policy_id: "test/drift/environment-changed",
    });
    expect(r.event.reason).toContain(
      "a success rate of 0.800 (12 of 15 trials with the procedure)",
    );
    expect(itemById(db, id(1))?.status).toBe("active");
  });

  test("the period retires under replay-drift, counted from the last validation", async () => {
    const { db, plane } = await active();
    const early = await plane.revalidate(omar, id(1), "2026-10-26T11:00:00Z", {
      replay: replay(3),
    });
    expect(early.event.policy_id).toBe(DRIFT_NOT_DUE_ID);
    expect(early.event.reason).toContain(
      "the period of 86400 seconds since its last validation at 2026-10-25T12:00:00Z has not passed",
    );
    const due = await plane.revalidate(omar, id(1), "2026-10-26T12:00:00Z", { replay: replay(3) });
    expect(due.outcome).toBe("retired");
    expect(due.event.policy_id).toBe("test/drift/replay-drift");
    expect(itemById(db, id(1))?.status).toBe("retired");
  });

  test("a kept re-validation restarts the period", async () => {
    const { plane } = await active();
    const kept = await plane.revalidate(omar, id(1), "2026-10-26T12:00:00Z", {
      replay: replay(15),
    });
    expect(kept.outcome).toBe("kept");
    const next = await plane.revalidate(omar, id(1), "2026-10-27T11:00:00Z", { replay: replay(0) });
    expect(next.event.policy_id).toBe(DRIFT_NOT_DUE_ID);
  });

  test("a drift-retired procedure is restored only when it meets the admission rule again", async () => {
    const { db, plane } = await active();
    await plane.revalidate(omar, id(1), AT, { replay: replay(3), environment: changed });
    // 11 of 15 reaches the floor but passes only 3 of 5 tasks at 2/3: it stays retired.
    const spread = replay(0, {
      outcomes: replay(0).outcomes.map((o) => ({
        ...o,
        with: ["t3", "t4", "t5"].includes(o.task) || o.seed === 1 ? 1 : 0,
      })),
    });
    const short = await plane.revalidate(omar, id(1), AT, { replay: spread });
    // The promotion gate judges it, with the replay: 3 of 5 does not meet 4 of 5.
    expect(short).toMatchObject({
      outcome: "refused",
      event: { op: "promote", decision: "deny", policy_id: PROMOTE_NO_EVIDENCE_ID },
    });
    expect(short.event.reason).toMatch(
      /^drift restore of item .*, retired under test\/drift\/environment-changed/,
    );
    expect(itemById(db, id(1))?.status).toBe("retired");
    // Below the floor, the gate is never asked.
    const below = await plane.revalidate(omar, id(1), AT, { replay: replay(3) });
    expect(below.event).toMatchObject({
      op: "promote",
      decision: "deny",
      policy_id: "test/drift/restored",
    });
    const back = await plane.revalidate(omar, id(1), AT, { replay: replay(15) });
    expect(back.outcome).toBe("restored");
    expect(back.event).toMatchObject({
      op: "promote",
      decision: "allow",
      policy_id: "test/drift/restored",
    });
    // The in-place promotion: same id, version plus one, active.
    expect(itemById(db, id(1))).toMatchObject({ status: "active", version: 3 });
  });

  test("a restore the budget refuses stays retired (trust.protect_trusted)", async () => {
    const policy: Policy = {
      ...DRIFT,
      trust: { protect_trusted: "on" },
      retention: [
        { scope: "team", class: "procedural", ttl: null, budget: 1, eviction: "recency" },
      ],
    };
    // A team procedure from a document source: less trusted than a user's.
    const doc = procedure();
    const team = {
      ...doc,
      scope: "team:platform",
      provenance: { ...doc.provenance, kind: "document" },
    } as MemoryItem;
    const { db, plane } = await active(policy, team);
    await plane.revalidate(omar, id(1), AT, { replay: replay(3), environment: changed });
    // Another member's user-written procedure takes the one slot.
    const ana: Actor = {
      id: "person:ana",
      level: "person",
      memberships: ["team:platform"],
      source: "user",
    };
    const theirs = {
      ...item(5, { scope: "team:platform", owner: "person:ana" }),
      class: "procedural",
      content: { body: "Run the tests before pushing.", tools: ["bash"] },
      provenance: { ...item(5).provenance, actor: "person:ana" },
    } as MemoryItem;
    const w = await plane.write(ana, theirs, AT);
    expect(w.event.decision, w.event.reason).toBe("allow");
    const r = await plane.revalidate(omar, id(1), AT, { replay: replay(15) });
    expect(r).toMatchObject({
      outcome: "refused",
      event: { op: "promote", decision: "deny", policy_id: DOWNGRADE_ID },
    });
    expect(itemById(db, id(1))?.status).toBe("retired");
    expect(itemById(db, id(5))?.status).toBe("active");
  });

  test("an item past its ttl is not restored", async () => {
    const short = { ...procedure(), valid_from: AT, ttl: 2 * 86_400 } as MemoryItem;
    const { db, plane } = await active(DRIFT, short);
    await plane.revalidate(omar, id(1), AT, { replay: replay(3), environment: changed });
    const r = await plane.revalidate(omar, id(1), "2026-10-28T12:00:00Z", { replay: replay(15) });
    expect(r).toMatchObject({
      outcome: "refused",
      event: { op: "promote", decision: "deny", policy_id: PROMOTE_EXPIRED_ID },
    });
    expect(itemById(db, id(1))?.status).toBe("retired");
  });

  test("a procedure retired by its ttl, a budget eviction or an offboarding is not restored", async () => {
    // ttl: the sweep retires it.
    const short = { ...procedure(), valid_from: AT, ttl: 2 * 86_400 } as MemoryItem;
    const ttl = await active(DRIFT, short);
    const later = "2026-10-28T12:00:00Z";
    expect((await ttl.plane.retain(omar, "person:omar", later)).expired).toEqual([id(1)]);
    const t = await ttl.plane.revalidate(omar, id(1), later, { replay: replay(15) });
    expect(t.event.policy_id).toBe(DRIFT_STATUS_ID);
    expect(t.event.reason).toContain("retired other than by drift");
    expect(itemById(ttl.db, id(1))?.status).toBe("retired");
    // Eviction: a budget of one, and a newer procedure takes it.
    const budget: Policy = {
      ...DRIFT,
      retention: [
        { scope: "person", class: "procedural", ttl: null, budget: 1, eviction: "recency" },
      ],
    };
    const ev = await active(budget);
    const newer = {
      ...item(5, { scope: "person:omar" }),
      class: "procedural",
      content: { body: "Run the tests before pushing.", tools: ["bash"] },
    } as MemoryItem;
    expect((await ev.plane.write(omar, newer, "2026-10-25T13:00:00Z")).event.decision).toBe(
      "allow",
    );
    expect(itemById(ev.db, id(1))?.status).toBe("retired");
    const e = await ev.plane.revalidate(omar, id(1), "2026-10-25T13:00:00Z", {
      replay: replay(15),
    });
    expect(e.event.policy_id).toBe(DRIFT_STATUS_ID);
    expect(e.event.reason).toContain("retired other than by drift");
    // Offboarding: erased, so it is gone, and refused as an unknown id.
    const off = await active();
    await off.plane.revalidate(omar, id(1), AT, { replay: replay(3), environment: changed });
    await offboard(off.deps, omar, { person: "person:omar", roles: [] }, AT);
    expect(itemById(off.db, id(1))).toBeUndefined();
    const o = await off.plane.revalidate(omar, id(1), AT, { replay: replay(15) });
    expect(o.event).toMatchObject({ policy_id: DRIFT_MEMBERSHIP_ID, scope_from: null });
  });

  test("while drift retired, its content counts as retired: a model rewrite is refused", async () => {
    const { plane } = await active();
    await plane.revalidate(omar, id(1), AT, { replay: replay(3), environment: changed });
    const again = { ...procedure(), id: id(6), status: "active" } as MemoryItem;
    const w = await plane.write({ ...omar, source: "model" }, again, AT);
    expect(w.event).toMatchObject({ decision: "deny", policy_id: RETIRED_CONTENT_ID });
  });

  test("a drift retirement under a policy since renamed is still restored", async () => {
    const { db, plane, deps } = await active();
    await plane.revalidate(omar, id(1), AT, { replay: replay(3), environment: changed });
    const renamed = createPlane({ ...deps, policy: { ...DRIFT, id: "test-v2" } });
    const r = await renamed.revalidate(omar, id(1), AT, { replay: replay(15) });
    expect(r.event).toMatchObject({
      op: "promote",
      decision: "allow",
      policy_id: "test-v2/drift/restored",
    });
    expect(itemById(db, id(1))?.status).toBe("active");
  });

  test("a member whose level may not read the scope is answered as an outsider", async () => {
    const { plane } = await active();
    // A team-level reader may read team and org scopes only (testPolicy's matrix).
    const blind: Actor = {
      id: "person:bo",
      level: "team",
      memberships: ["person:omar"],
      source: "user",
    };
    const r = await plane.revalidate(blind, id(1), AT, { replay: replay(0), environment: changed });
    expect(r.event).toMatchObject({
      policy_id: DRIFT_MEMBERSHIP_ID,
      scope_from: null,
      scope_to: null,
    });
  });

  test("off by default: a policy without procedures.drift refuses, and nothing retires", async () => {
    const off = { ...DRIFT, procedures: undefined } as Policy;
    delete (off as { procedures?: unknown }).procedures;
    const { db, plane } = await active(off);
    const r = await plane.revalidate(omar, id(1), AT, { replay: replay(0), environment: changed });
    expect(r).toMatchObject({
      outcome: "refused",
      event: { op: "retire", decision: "deny", policy_id: DRIFT_OFF_ID },
    });
    expect(itemById(db, id(1))?.status).toBe("active");
  });

  test("every registered preset is off", () => {
    for (const name of ["strict", "medium", "permissive"] as const)
      expect(loadPreset(name).procedures?.drift).toBeUndefined();
  });

  test("drift set without the thresholds is refused under its own rule", async () => {
    const bare = { ...DRIFT, lints: { enabled: [], thresholds: {} } };
    const { plane } = await active(bare);
    const r = await plane.revalidate(omar, id(1), AT, { replay: replay(0), environment: changed });
    expect(r.event.policy_id).toBe(DRIFT_THRESHOLDS_ID);
  });

  test("an agent presenting a re-validation is refused (ADR 0046, point 4)", async () => {
    const { db, plane } = await active();
    const r = await plane.revalidate({ ...omar, source: "model" }, id(1), AT, {
      replay: replay(0),
      environment: changed,
    });
    expect(r.event.policy_id).toBe(DRIFT_SOURCE_ID);
    expect(itemById(db, id(1))?.status).toBe("active");
  });

  test("a non-member is refused opaquely, its event naming no scope", async () => {
    const { plane } = await active();
    const stranger: Actor = {
      id: "person:eve",
      level: "person",
      memberships: ["person:eve"],
      source: "user",
    };
    const r = await plane.revalidate(stranger, id(1), AT, {
      replay: replay(0),
      environment: changed,
    });
    expect(r.event).toMatchObject({
      policy_id: DRIFT_MEMBERSHIP_ID,
      scope_from: null,
      scope_to: null,
    });
    const unknown = await plane.revalidate(omar, id(77), AT, {
      replay: replay(0, { item_id: id(77) }),
    });
    expect(unknown.event.reason.replace(id(77), "X")).toBe(
      r.event.reason.replace(id(1), "X").replace("person:eve", "person:omar"),
    );
  });

  test("a candidate and a non-procedure are not re-validated", async () => {
    const db = openSqlite(":memory:");
    migrate(db);
    let n = 0;
    const plane = createPlane({
      db,
      adapter: createFakeAdapter(),
      policy: DRIFT,
      newId: () => id(900_000 + ++n),
      distillTasks: SESSIONS,
    });
    await plane.write({ ...omar, source: "model" }, procedure(), AT);
    const r = await plane.revalidate(omar, id(1), AT, { replay: replay(0), environment: changed });
    expect(r.event.policy_id).toBe(DRIFT_STATUS_ID);
    expect(r.event.reason).toContain("a candidate; Plane.promote admits it");
    await plane.write(omar, item(2, { scope: "person:omar" }), AT);
    const s = await plane.revalidate(omar, id(2), AT, {
      replay: replay(0, { item_id: id(2) }),
      environment: changed,
    });
    expect(s.event.reason).toContain("only procedures are re-validated");
  });

  test("a replay that is not the item's is refused under D3's rules", async () => {
    const { plane } = await active();
    const other = await plane.revalidate(omar, id(1), AT, {
      replay: replay(0, { item_id: id(2) }),
      environment: changed,
    });
    expect(other.event.policy_id).toBe(PROMOTE_REPLAY_ITEM_ID);
    const fewer = replay(0);
    const four = await plane.revalidate(omar, id(1), AT, {
      replay: { ...fewer, outcomes: fewer.outcomes.filter((o) => o.task !== "t7") },
      environment: changed,
    });
    expect(four.event.policy_id).toBe(PROMOTE_REPLAY_SPLIT_ID);
  });

  test("a malformed replay or environment is refused before the log is touched", async () => {
    const { plane } = await active();
    const before = plane.events().length;
    await expect(
      plane.revalidate(omar, id(1), AT, { replay: replay(0, { threshold: 0.5 }) }),
    ).rejects.toThrow(InvalidCallError);
    await expect(
      plane.revalidate(omar, id(1), AT, {
        replay: replay(0),
        environment: { validated: "a", current: "b" },
      }),
    ).rejects.toThrow(InvalidCallError);
    await expect(plane.revalidate(omar, "nope", AT, { replay: replay(0) })).rejects.toThrow(
      InvalidCallError,
    );
    expect(plane.events().length).toBe(before);
  });
});
