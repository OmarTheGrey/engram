// Acceptance for card E0.3: every fake instantiates and honours the interface
// it fakes, and the plane declares every Plane method, rejecting the ones no
// card has implemented yet with the card that will.
import { createFakeAdapter } from "@engram/adapters";
import { describe, expect, test } from "vitest";
import { migrate } from "../../src/db/migrate.ts";
import { openSqlite } from "../../src/db/sqlite.ts";
import type { Distiller, DistillMethod, Session } from "../../src/distill.ts";
import type { Linter } from "../../src/lint.ts";
import { createPlane, NotImplementedYet, type Plane } from "../../src/plane.ts";
import type { LintFinding, MemoryItem, Policy } from "../../src/schema.ts";
import type { Simulator, Workload } from "../../src/simulate.ts";
import {
  createFakeDistiller,
  createFakeLinter,
  createFakeSimulator,
  distillKey,
} from "../fakes/index.ts";

const id = (n: number) => `01920000-0000-7000-8000-${String(n).padStart(12, "0")}`;

const POLICY: Policy = {
  id: "test",
  version: 1,
  write: [],
  read: { matrix: [], honour_grants: true },
  retention: [],
  promotion: {
    episodic_to_semantic: { confirmations: 3, or_review: true },
    procedural: { replay_k: 4, replay_n: 5 },
  },
  lints: { enabled: [], thresholds: {} },
  schema_version: 0,
};

const FINDING: LintFinding = {
  id: id(100),
  lint_id: "expired-validity",
  item_id: id(1),
  tier: "deterministic",
  severity: "warn",
  message: "valid_to is in the past",
  evidence: ["valid_to=2026-01-01T00:00:00Z"],
  schema_version: 0,
};

const SKILL: MemoryItem = {
  id: id(200),
  class: "procedural",
  scope: "person:omar",
  owner: "person:omar",
  content: { body: "1. run the tests\n2. read the failure", tools: ["bash"] },
  provenance: {
    kind: "model",
    ref: "session/s1",
    hash: `sha256:${"cd".repeat(32)}`,
    actor: "agent:pi",
    model: "scripted/scripted-1",
  },
  confidence: 0.5,
  valid_from: "2026-10-25T09:00:00Z",
  valid_to: null,
  ttl: null,
  grants: [],
  version: 1,
  lineage: [],
  status: "candidate",
  store_ref: null,
  schema_version: 0,
};

const CANDIDATE: Policy = { ...POLICY, id: "candidate" };

const WORKLOAD: Workload = {
  id: "w1",
  actors: { pi: { id: "agent:pi", level: "person", memberships: ["person:omar"] } },
  steps: [
    { op: "write", as: "pi", at: "2026-10-25T09:00:00Z", item: SKILL },
    { op: "read", as: "pi", at: "2026-10-25T09:00:01Z", text: "tests" },
  ],
};

const SESSION: Session = {
  id: "s1",
  task_id: "task-1",
  entries: [
    { type: "message", id: "e01", parentId: null, timestamp: "2026-10-25T09:00:00Z" },
    { type: "message", id: "e02", parentId: "e01", timestamp: "2026-10-25T09:00:01Z" },
  ],
};
const AWM: DistillMethod = { id: "awm", model: "scripted/scripted-1", seed: 7 };

describe("fakes", () => {
  test("the fake linter returns the findings scripted for a scope and none for another", async () => {
    const linter: Linter = createFakeLinter({ "team:a": [FINDING] });
    expect(await linter.lint("team:a")).toEqual([FINDING]);
    expect(await linter.lint("team:b")).toEqual([]);
  });

  test("the fake linter refuses a finding that does not parse", () => {
    expect(() =>
      createFakeLinter({ "team:a": [{ ...FINDING, severity: "fatal" as "warn" }] }),
    ).toThrow();
  });

  test("the fake simulator allows every step under both policies when unscripted, with zero model calls", async () => {
    const simulator: Simulator = createFakeSimulator({ baseline: POLICY });
    const report = await simulator.simulate(WORKLOAD, CANDIDATE);
    expect(report).toMatchObject({ workload_id: "w1", changed: [], model_calls: 0 });
    expect([report.baseline.policy_id, report.candidate.policy_id]).toEqual(["test", "candidate"]);
    expect(report.candidate.totals).toEqual({ allow: 2, deny: 0, ask: 0 });
    expect(report.candidate.outcomes.map((o) => [o.step, o.op, o.actor])).toEqual([
      [0, "write", "agent:pi"],
      [1, "read", "agent:pi"],
    ]);
  });

  test("the fake simulator reports the steps a scripted candidate decides differently", async () => {
    const simulator = createFakeSimulator({
      baseline: POLICY,
      decide: (step, _i, policy) =>
        policy.id === "candidate" && step.op === "write" ? "deny" : "allow",
    });
    const report = await simulator.simulate(WORKLOAD, CANDIDATE);
    expect(report.changed.map((c) => [c.step, c.baseline.decision, c.candidate.decision])).toEqual([
      [0, "allow", "deny"],
    ]);
    expect(report.candidate.totals).toEqual({ allow: 1, deny: 1, ask: 0 });
  });

  test("a fake simulator decision names the deciding rule of its policy, not the policy", async () => {
    // Review finding R2-6: a step's policy_id is the id of the deciding rule,
    // in the format of MemoryEvent.policy_id; each run's policy_id and
    // policy_version name its policy.
    const scripted = await createFakeSimulator({ baseline: POLICY, decide: () => "deny" }).simulate(
      WORKLOAD,
      CANDIDATE,
    );
    expect(scripted.candidate.outcomes.map((d) => d.policy_id)).toEqual([
      "candidate/scripted",
      "candidate/scripted",
    ]);
    const ruled = await createFakeSimulator({
      baseline: POLICY,
      decide: (_s, i) => ({ decision: "ask", policy_id: `test/write/person#${i}`, reason: "r" }),
    }).simulate(WORKLOAD, CANDIDATE);
    expect(ruled.candidate.outcomes.map((d) => [d.decision, d.policy_id, d.reason])).toEqual([
      ["ask", "test/write/person#0", "r"],
      ["ask", "test/write/person#1", "r"],
    ]);
  });

  test("the fake distiller answers from its table and fails loudly on an unknown key", async () => {
    const distiller: Distiller = createFakeDistiller({ [distillKey([SESSION], AWM)]: [SKILL] });
    expect(await distiller.distill([SESSION], AWM)).toEqual([SKILL]);
    await expect(distiller.distill([SESSION], { ...AWM, seed: 8 })).rejects.toThrow(/no scripted/);
  });

  test("the fake distiller refuses a scripted item that is not a procedural candidate", () => {
    expect(() => createFakeDistiller({ k: [{ ...SKILL, status: "active" }] })).toThrow(
      /procedural candidate/,
    );
  });

  test("the plane instantiates over the fake adapter and declares every Plane method", async () => {
    const db = openSqlite(":memory:");
    migrate(db);
    let n = 0;
    const plane: Plane = createPlane({
      db,
      adapter: createFakeAdapter(),
      policy: POLICY,
      newId: () => id(++n),
    });
    const pending: [string, string, () => Promise<unknown>][] = [
      ["lint", "L1", () => plane.lint("team:a")],
      ["distill", "D2", () => plane.distill([SESSION], AWM)],
    ];
    for (const [method, card, call] of pending) {
      const error = await call().then(
        () => undefined,
        (e: unknown) => e,
      );
      expect(error, method).toBeInstanceOf(NotImplementedYet);
      expect((error as NotImplementedYet).card, method).toBe(card);
      expect((error as Error).message, method).toContain(`Plane.${method}`);
    }
    expect(plane.events()).toEqual([]);
    db.close();
  });
});
