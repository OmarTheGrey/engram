// Acceptance and unit tests for the pure promotion evaluator (card E2.5, ADR
// 0026): episodic to semantic only at k confirmations by distinct actors with
// trusted sources, or by a reviewer who is a user-sourced member of the
// target scope and not the owner; a procedural candidate becomes active only
// with a validation record meeting replay_k of replay_n; a widening or class
// change is judged as a write into the target scope; a status-only change is
// in place and a class or scope change a new version. Nothing here touches a
// log or a store; the plane's use is tested in test/unit/plane/promote.test.ts.
import { describe, expect, test } from "vitest";
import type { Actor } from "../../../src/actor.ts";
import { contentHash } from "../../../src/content-hash.ts";
import {
  type Confirmation,
  evaluatePromotion,
  leastTrusted,
  PROMOTE_MEMBERSHIP_ID,
  PROMOTE_NO_EVIDENCE_ID,
  PROMOTE_NOT_CANDIDATE_ID,
  PROMOTE_REVIEWER_ID,
  type PromotionEvidence,
} from "../../../src/policy/promotion.ts";
import type { MemoryItem, Policy } from "../../../src/schema.ts";

const id = (n: number) => `01920000-0000-7000-8000-${String(n).padStart(12, "0")}`;

function item(n: number, over: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: id(n),
    class: "episodic",
    scope: "person:omar",
    owner: "person:omar",
    content: "the deploy runs on tuesdays",
    provenance: { kind: "user", ref: "doc/1", hash: `sha256:${"0".repeat(64)}`, actor: "x" },
    confidence: 0.9,
    valid_from: "2026-10-01T00:00:00Z",
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 0,
    ...over,
  } as MemoryItem;
}

const procedural = (n: number, over: Partial<MemoryItem> = {}) =>
  item(n, {
    class: "procedural",
    content: { body: "run the deploy script", tools: ["bash"] },
    status: "candidate",
    ...over,
  } as Partial<MemoryItem>);

type Rule = Policy["write"][number];
const rule = (scope: Rule["scope"], over: Partial<Rule> = {}): Rule => ({
  scope,
  allowed_sources: ["user", "document", "tool", "import"],
  confidence_floor: 0.6,
  forbidden_classes: ["episodic"],
  requires_review: false,
  ...over,
});

const POLICY: Policy = {
  id: "p",
  version: 1,
  write: [
    rule("person", {
      allowed_sources: ["user", "document", "tool", "import", "model", "compaction"],
      confidence_floor: 0,
      forbidden_classes: [],
    }),
    rule("role"),
    rule("team"),
    rule("org", { requires_review: true }),
  ],
  read: {
    matrix: [{ reader: "person", may_read: ["person", "role", "team", "org"] }],
    honour_grants: true,
  },
  retention: [],
  promotion: {
    episodic_to_semantic: { confirmations: 3, or_review: true },
    procedural: { replay_k: 4, replay_n: 5 },
  },
  lints: { enabled: [], thresholds: {} },
  schema_version: 0,
};

const SCOPES = ["person:omar", "team:platform", "org"];
/** The owner, promoting with a user source. */
const omar: Actor = { id: "person:omar", level: "person", memberships: SCOPES, source: "user" };
/** Another user-sourced member of every scope: an eligible reviewer of omar's items. */
const sara: Actor = { id: "person:sara", level: "person", memberships: SCOPES, source: "user" };

const conf = (n: number, actor: string, kind: Confirmation["kind"] = "user"): Confirmation => ({
  item_id: id(n),
  actor,
  kind,
});

/** The item's own write, by its owner, plus confirmations by sara and ali: three distinct actors. */
const THREE: Confirmation[] = [
  conf(1, "person:omar"),
  conf(2, "person:sara"),
  conf(3, "person:ali", "document"),
];

/** The evaluator with nothing retired in the target unless a test says otherwise. */
const judge = (
  policy: Policy,
  actor: Actor,
  it: MemoryItem,
  target: string,
  evidence: PromotionEvidence,
  retired: ReadonlyMap<string, string> = new Map(),
) => evaluatePromotion(policy, actor, it, target, evidence, retired);

const ev = (over: Partial<PromotionEvidence> = {}): PromotionEvidence => ({
  confirmations: [],
  review: false,
  ...over,
});

describe("acceptance (card E2.5): episodic to semantic only after k confirmations", () => {
  test("promotes at k confirmations by distinct actors with trusted sources", () => {
    const d = judge(POLICY, omar, item(1), "team:platform", ev({ confirmations: THREE }));
    expect(d).toMatchObject({
      decision: "allow",
      check: "confirmed",
      policy_id: "p/promotion/episodic-to-semantic",
      transition: "new-version",
      confirmations: 3,
      confirming: [id(2), id(3)],
    });
    expect(d.reason).toContain("3 confirmations");
    expect(d.promoted).toMatchObject({
      class: "semantic",
      scope: "team:platform",
      status: "active",
      version: 2,
      lineage: [id(1), id(2), id(3)],
      provenance: { kind: "document", actor: "person:omar" },
    });
  });

  test("does not promote one confirmation short of k (the k boundary)", () => {
    const d = judge(
      POLICY,
      omar,
      item(1),
      "team:platform",
      ev({ confirmations: THREE.slice(0, 2) }),
    );
    expect(d).toMatchObject({
      decision: "deny",
      check: "no-evidence",
      policy_id: PROMOTE_NO_EVIDENCE_ID,
      promoted: null,
    });
    expect(d.reason).toContain("2 of the 3");
  });

  test("the same actor writing the content k times counts once", () => {
    const same = [conf(1, "person:omar"), conf(2, "person:omar"), conf(3, "person:omar")];
    const d = judge(POLICY, omar, item(1), "team:platform", ev({ confirmations: same }));
    expect(d).toMatchObject({ decision: "deny", check: "no-evidence", confirmations: 1 });
  });

  test.each(["model", "compaction", "import"] as const)(
    "a %s-sourced write never counts as a confirmation",
    (kind) => {
      const d = judge(
        POLICY,
        omar,
        item(1),
        "team:platform",
        ev({ confirmations: [...THREE.slice(0, 2), conf(3, "agent:pi", kind)] }),
      );
      expect(d).toMatchObject({ decision: "deny", check: "no-evidence", confirmations: 2 });
    },
  );

  test("a tool-sourced write by another actor counts", () => {
    const d = judge(
      POLICY,
      omar,
      item(1),
      "team:platform",
      ev({ confirmations: [...THREE.slice(0, 2), conf(3, "agent:ci", "tool")] }),
    );
    expect(d).toMatchObject({ decision: "allow", confirmations: 3 });
    // The least trusted source is the tool's.
    expect(d.promoted?.provenance.kind).toBe("tool");
  });

  test("one item counts once, by the first actor who wrote it", () => {
    const d = judge(
      POLICY,
      omar,
      item(1),
      "team:platform",
      ev({
        confirmations: [conf(1, "person:omar"), conf(2, "person:sara"), conf(2, "person:ali")],
      }),
    );
    expect(d).toMatchObject({ decision: "deny", confirmations: 2 });
  });

  test("the episodic item becomes semantic in its own scope as a new version", () => {
    const d = judge(POLICY, omar, item(1), "person:omar", ev({ confirmations: THREE }));
    expect(d).toMatchObject({ decision: "allow", transition: "new-version" });
    expect(d.promoted).toMatchObject({ class: "semantic", scope: "person:omar" });
  });
});

describe("acceptance (card E2.5): the review path records the approver", () => {
  test("a user-sourced member of the target who is not the owner may promote below k", () => {
    const d = judge(POLICY, sara, item(1), "team:platform", ev({ review: true }));
    expect(d).toMatchObject({
      decision: "allow",
      check: "reviewed",
      policy_id: "p/promotion/review",
    });
    expect(d.reason).toContain("approved by person:sara");
    expect(d.promoted?.provenance.actor).toBe("person:sara");
  });

  test("the owner cannot approve their own item", () => {
    const d = judge(POLICY, omar, item(1), "team:platform", ev({ review: true }));
    expect(d).toMatchObject({
      decision: "deny",
      check: "reviewer",
      policy_id: PROMOTE_REVIEWER_ID,
    });
    expect(d.reason).toContain("owns");
  });

  test.each([
    ["a model-sourced actor", { ...sara, source: "model" as const }, "only a user-sourced actor"],
    ["an actor with no source", { ...sara, source: undefined }, "only a user-sourced actor"],
    [
      "a non-member of the target",
      { ...sara, memberships: ["person:omar"] },
      "not a member of team:platform",
    ],
  ])("%s cannot approve", (_label, actor, text) => {
    const d = judge(POLICY, actor, item(1), "team:platform", ev({ review: true }));
    // A non-member of the target is refused by the write rule first.
    expect(d.decision).toBe("deny");
    expect(d.reason).toContain(text);
  });

  test("review below k is no evidence when the policy has no review path", () => {
    const policy = {
      ...POLICY,
      promotion: {
        ...POLICY.promotion,
        episodic_to_semantic: { confirmations: 3, or_review: false },
      },
    };
    const d = judge(policy, sara, item(1), "team:platform", ev({ review: true }));
    expect(d).toMatchObject({ decision: "deny", check: "no-evidence" });
  });

  test("a target whose rule requires review asks when the actor is not reviewing", () => {
    const d = judge(POLICY, omar, item(1), "org", ev({ confirmations: THREE }));
    expect(d).toMatchObject({
      decision: "ask",
      check: "review-needed",
      policy_id: "p/promotion/review",
      promoted: null,
    });
  });

  test("a reviewer's approval lands it in a scope that requires review, active", () => {
    const d = judge(POLICY, sara, item(1), "org", ev({ confirmations: THREE, review: true }));
    expect(d).toMatchObject({ decision: "allow", policy_id: "p/promotion/episodic-to-semantic" });
    expect(d.promoted?.status).toBe("active");
    expect(d.reason).toContain("approved by person:sara");
  });

  test("a candidate held for review becomes active in place through a reviewer", () => {
    const candidate = item(1, { class: "semantic", scope: "org", status: "candidate" });
    const d = judge(POLICY, sara, candidate, "org", ev({ review: true }));
    expect(d).toMatchObject({ decision: "allow", check: "reviewed", transition: "in-place" });
    expect(d.promoted).toEqual({ ...candidate, status: "active", version: 2 });
  });

  test("a candidate held for review asks without a reviewer", () => {
    const candidate = item(1, { class: "semantic", scope: "org", status: "candidate" });
    const d = judge(POLICY, omar, candidate, "org", ev());
    expect(d).toMatchObject({ decision: "ask", promoted: null });
  });
});

describe("acceptance (card E2.5): procedural candidates need a validation record", () => {
  test("a candidate without a validation record stays candidate", () => {
    const d = judge(POLICY, sara, procedural(1), "person:omar", ev({ review: true }));
    expect(d).toMatchObject({ decision: "deny", check: "no-evidence", promoted: null });
    expect(d.reason).toContain("validation record");
  });

  test("a record meeting replay_k of replay_n makes it active in place", () => {
    const d = judge(POLICY, omar, procedural(1), "person:omar", ev({ validation: { k: 4, n: 5 } }));
    expect(d).toMatchObject({
      decision: "allow",
      check: "validated",
      policy_id: "p/promotion/procedural",
      transition: "in-place",
    });
    expect(d.promoted).toEqual({ ...procedural(1), status: "active", version: 2 });
  });

  test.each([
    [{ k: 3, n: 5 }, "fewer passes than replay_k"],
    [{ k: 4, n: 4 }, "fewer runs than replay_n"],
    [{ k: 4, n: 100 }, "a pass rate below replay_k of replay_n"],
  ])("a record of %j is not enough (%s)", (validation) => {
    const d = judge(POLICY, omar, procedural(1), "person:omar", ev({ validation }));
    expect(d).toMatchObject({ decision: "deny", check: "no-evidence" });
  });

  test("a larger record at the same pass rate is enough", () => {
    const d = judge(
      POLICY,
      omar,
      procedural(1),
      "person:omar",
      ev({ validation: { k: 8, n: 10 } }),
    );
    expect(d.decision).toBe("allow");
  });
});

describe("acceptance (card E2.5): a widening is judged as a write into the target", () => {
  test("a widening the target's rule forbids is denied under that rule", () => {
    const low = item(1, { confidence: 0.4 });
    const d = judge(POLICY, omar, low, "team:platform", ev({ confirmations: THREE }));
    expect(d).toMatchObject({ decision: "deny", check: "write", policy_id: "p/write/team" });
    expect(d.reason).toContain("below the team floor");
  });

  test("model content never leaves person scope, however confirmed", () => {
    const written = item(1, { provenance: { ...item(1).provenance, kind: "model" } });
    // Even a team rule listing model as a source does not let it in.
    const lax = {
      ...POLICY,
      write: POLICY.write.map((r) =>
        r.scope === "team"
          ? { ...r, allowed_sources: [...r.allowed_sources, "model" as const] }
          : r,
      ),
    };
    const d = judge(
      lax,
      sara,
      written,
      "team:platform",
      ev({ confirmations: THREE, review: true }),
    );
    expect(d).toMatchObject({ decision: "deny", policy_id: "engram/write/source-isolation" });
    // In person scope the same item may become semantic, as model content.
    const own = judge(POLICY, omar, written, "person:omar", ev({ confirmations: THREE }));
    expect(own.decision).toBe("allow");
    expect(own.promoted?.provenance.kind).toBe("model");
  });

  test("a promoter who is not a member of the target is refused as a writer", () => {
    const outsider = { ...omar, memberships: ["person:omar"] };
    const d = judge(POLICY, outsider, item(1), "team:platform", ev({ confirmations: THREE }));
    expect(d).toMatchObject({ decision: "deny", policy_id: "engram/write/membership" });
  });

  test("a restatement of content retired in the target by a tool source is refused", () => {
    const tool = item(1, { provenance: { ...item(1).provenance, kind: "tool" } });
    const retired = new Map([[contentHash(tool.content), id(99)]]);
    const d = judge(POLICY, omar, tool, "team:platform", ev({ confirmations: THREE }), retired);
    expect(d).toMatchObject({ decision: "deny", policy_id: "engram/write/retired-content" });
  });
});

describe("what is not a candidate", () => {
  test("an actor who is not a member of the item's scope learns nothing about it", () => {
    const eve: Actor = { id: "person:eve", level: "person", memberships: ["team:platform"] };
    const d = judge(POLICY, eve, item(1), "team:platform", ev({ confirmations: THREE }));
    expect(d).toMatchObject({ decision: "deny", policy_id: PROMOTE_MEMBERSHIP_ID });
    expect(d.reason).not.toContain("person:omar");
    expect(d.reason).not.toContain("episodic");
  });

  test.each([
    ["a retired item", item(1, { status: "retired" }), "team:platform"],
    ["an active semantic item in its own scope", item(1, { class: "semantic" }), "person:omar"],
    ["a narrowing", item(1, { scope: "team:platform", class: "semantic" }), "person:omar"],
    ["a sideways move", item(1, { scope: "team:platform", class: "semantic" }), "team:other"],
  ])("%s is not a candidate", (_label, it, target) => {
    const actor = { ...omar, memberships: [...SCOPES, "team:other"] };
    const d = judge(POLICY, actor, it, target, ev({ confirmations: THREE, review: true }));
    expect(d).toMatchObject({ decision: "deny", policy_id: PROMOTE_NOT_CANDIDATE_ID });
  });

  test("an active semantic item widens only through a reviewer", () => {
    const fact = item(1, { class: "semantic" });
    expect(judge(POLICY, omar, fact, "team:platform", ev()).decision).toBe("deny");
    const d = judge(POLICY, sara, fact, "team:platform", ev({ review: true }));
    expect(d).toMatchObject({ decision: "allow", transition: "new-version" });
    expect(d.promoted).toMatchObject({ class: "semantic", scope: "team:platform" });
  });
});

describe("leastTrusted", () => {
  test("orders user, document, import, tool, model, compaction from most to least trusted", () => {
    expect(leastTrusted(["user", "document"])).toBe("document");
    expect(leastTrusted(["import", "document", "user"])).toBe("import");
    expect(leastTrusted(["tool", "import"])).toBe("tool");
    expect(leastTrusted(["user", "model", "tool"])).toBe("model");
    expect(leastTrusted(["compaction", "model"])).toBe("compaction");
  });
});
