// Card L3 (layer 1, through the real Plane): Plane.lint runs the model-based
// lints the policy enables when the plane was built with a lint model
// (PlaneDeps.lintModel, a ModelCall injected at construction), after the
// deterministic ones, and records each finding as one `lint` event of L1's
// shape that also carries the call's usage (ADR 0017). Without a lint model
// they do not run. A call that fails leaves the log as it was.
import { describe, expect, test } from "vitest";
import type { Actor } from "../../../src/actor.ts";
import { strictContentHash } from "../../../src/content-hash.ts";
import { appendEvent, currentItems } from "../../../src/events.ts";
import type { ModelLintSetup } from "../../../src/lint/model.ts";
import { createPlane, planModelLints } from "../../../src/plane.ts";
import type { MemoryItem, Policy } from "../../../src/schema.ts";
import { reply, scriptedLintModel, USAGE } from "../../fakes/lint-model.ts";
import { AT, fresh, id, item, testPolicy } from "./helpers.ts";

const ACTOR: Actor = {
  id: "person:omar",
  level: "person",
  memberships: ["person:omar", "team:platform"],
  source: "user",
};

const enabled = (lints: string[]): Policy =>
  testPolicy({ lints: { enabled: lints, thresholds: {} } });

/** A plane whose log holds `items` as written, over the fake adapter, with `lintModel` when given. */
function seeded(items: MemoryItem[], policy: Policy, lintModel?: ModelLintSetup) {
  const base = fresh(policy);
  const env = {
    ...base,
    plane: createPlane({ ...base.deps, ...(lintModel === undefined ? {} : { lintModel }) }),
  };
  for (const [n, it] of items.entries())
    appendEvent(env.db, {
      id: id(500 + n),
      ts: "2026-10-01T00:00:00Z",
      op: "write",
      item_id: it.id,
      actor: "person:omar",
      scope_from: null,
      scope_to: it.scope,
      decision: "allow",
      reason: "seeded",
      policy_id: "test/write/team",
      item: it,
      schema_version: 1,
    });
  return env;
}

const friday = item(1, { content: "The freeze starts on Friday." });
const monday = item(2, { content: "The freeze starts on Monday." });
const claim = item(3, {
  content: "The freeze starts on Sunday.",
  provenance: {
    kind: "user",
    ref: friday.id,
    hash: strictContentHash(friday.content),
    actor: "person:omar",
  },
});
const twin = item(4, { content: "The freeze starts on Friday." });

describe("Plane.lint with a lint model", () => {
  test("records each model finding as a lint event with its usage, after the deterministic ones", async () => {
    const model = scriptedLintModel((lint) =>
      lint === "contradiction" ? reply("contradiction", "different days") : reply("unsupported"),
    );
    const { plane } = seeded(
      [friday, monday, claim, twin],
      enabled(["contradiction", "unsupported-claim", "duplicate"]),
      { call: model.call, model: "scripted/lint-1", seed: 3 },
    );
    const report = await plane.lint(ACTOR, AT, "team:platform");
    expect(report.findings.map((f) => [f.tier, f.lint_id, f.item_id])).toEqual([
      ["deterministic", "duplicate", id(4)],
      ["model", "contradiction", id(2)],
      ["model", "contradiction", id(3)],
      ["model", "contradiction", id(3)],
      ["model", "contradiction", id(4)],
      ["model", "contradiction", id(4)],
      ["model", "unsupported-claim", id(3)],
    ]);
    const event = report.events[1];
    expect(event).toMatchObject({
      op: "lint",
      decision: "allow",
      item_id: id(2),
      scope_to: "team:platform",
      policy_id: "test/lint/contradiction",
      reason: `contradiction (warn): it contradicts ${id(1)}, an earlier active semantic item in team:platform, as scripted/lint-1 judged it; evidence: contradicts ${id(1)}; model scripted/lint-1, seed 3; reason: different days`,
      usage: USAGE,
    });
    expect(event?.item).toBeUndefined();
    expect(report.events[0]?.usage).toBeUndefined();
    expect(report.findings.map((f) => f.id)).toEqual(report.events.map((e) => e.id));
    expect(plane.events().slice(-7)).toEqual(report.events);
    // Five pairs (1 and 4 are exact duplicates, left to the duplicate lint) and one claim.
    expect(report.judgments?.length).toBe(6);
    expect(model.requests.every((r) => r.seed === 3 && r.model === "scripted/lint-1")).toBe(true);
  });

  test("without a lint model the model lints do not run and the report has no judgments", async () => {
    const { plane } = seeded([friday, monday], enabled(["contradiction", "unsupported-claim"]));
    const report = await plane.lint(ACTOR, AT, "team:platform");
    expect(report.findings).toEqual([]);
    expect(report.judgments).toBeUndefined();
  });

  test("with no model lint enabled it calls no model", async () => {
    const model = scriptedLintModel(() => reply("contradiction"));
    const { plane } = seeded([friday, monday], enabled(["duplicate"]), {
      call: model.call,
      model: "scripted/lint-1",
      seed: 1,
    });
    const report = await plane.lint(ACTOR, AT, "team:platform");
    expect(report.findings).toEqual([]);
    expect(report.judgments).toEqual([]);
    expect(model.requests).toEqual([]);
  });

  test("a refused or malformed reply is a judgment and no event", async () => {
    const model = scriptedLintModel((_l, input) => (input.A === friday.content ? "" : "no idea"));
    const { plane } = seeded([friday, monday], enabled(["contradiction"]), {
      call: model.call,
      model: "scripted/lint-1",
      seed: 1,
    });
    const before = plane.events().length;
    const report = await plane.lint(ACTOR, AT, "team:platform");
    expect(report.events).toEqual([]);
    expect(plane.events().length).toBe(before);
    expect(report.judgments?.map((j) => j.outcome)).toEqual(["refused"]);
  });

  test("a member who may not read the scope is refused before any model call", async () => {
    const model = scriptedLintModel(() => reply("contradiction"));
    const { plane } = seeded([friday, monday], enabled(["contradiction"]), {
      call: model.call,
      model: "scripted/lint-1",
      seed: 1,
    });
    const outsider: Actor = { ...ACTOR, memberships: ["person:omar"] };
    const report = await plane.lint(outsider, AT, "team:platform");
    expect(report.decision).toBe("deny");
    expect(model.requests).toEqual([]);
  });

  test("a call that fails rejects the lint and appends nothing, deterministic findings included", async () => {
    const { db, plane } = seeded([friday, twin, monday], enabled(["duplicate", "contradiction"]), {
      call: async () => {
        throw new Error("offline: no cassette");
      },
      model: "scripted/lint-1",
      seed: 1,
    });
    const before = plane.events();
    const items = currentItems(db);
    await expect(plane.lint(ACTOR, AT, "team:platform")).rejects.toThrow("offline: no cassette");
    expect(plane.events()).toEqual(before);
    expect(currentItems(db)).toEqual(items);
  });
});

describe("planModelLints", () => {
  test("lists the units Plane.lint would send, calling no model and appending nothing", async () => {
    const model = scriptedLintModel(() => reply("consistent"));
    const policy = enabled(["contradiction", "unsupported-claim"]);
    const { db, plane } = seeded([friday, monday, claim], policy, {
      call: model.call,
      model: "scripted/lint-1",
      seed: 2,
    });
    const before = plane.events();
    const planned = planModelLints({ db, policy }, ACTOR, AT, "team:platform", {
      model: "scripted/lint-1",
      seed: 2,
    });
    expect(plane.events()).toEqual(before);
    expect(model.requests).toEqual([]);
    const report = await plane.lint(ACTOR, AT, "team:platform");
    expect(planned.map((u) => u.unit)).toEqual(report.judgments?.map((j) => j.unit));
    expect(model.requests).toEqual(planned.map((u) => u.request));
  });
  test("plans nothing for an actor who may not read the scope", () => {
    const policy = enabled(["contradiction"]);
    const { db } = seeded([friday, monday], policy);
    const outsider: Actor = { ...ACTOR, memberships: ["person:omar"] };
    expect(
      planModelLints({ db, policy }, outsider, AT, "team:platform", { model: "m/x", seed: 1 }),
    ).toEqual([]);
  });
});
