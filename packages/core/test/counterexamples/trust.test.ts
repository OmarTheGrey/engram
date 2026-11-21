// Characterisation tests for the two suspected trust gaps (card E2.7, ADR
// 0040 part 1: prove first). Each case asserts what the plane does today,
// green whichever way it comes out: a confirmed gap is pinned by a case that
// shows it, a refuted cell by a case that shows the safe behaviour. Nothing
// here changes the plane; the fix, opt-in, is card E2.11.
//
// GH-39, the floor (docs/research/absorb/19-github-scout.md): a write whose
// actor names no source keeps the provenance kind and actor its caller
// claims (ADR 0004, decision D4; `withPlaneProvenance`, plane/write.ts).
//
// GH-38, the lattice: for each pair of the seven provenance kinds as writer
// and victim, and each of rewrite, retire and budget eviction, whether a
// writer less trusted than an active item changes or removes it when the
// item's owner does not act. "Less trusted" is core's own order (`TRUST_ORDER`
// through `leastTrusted`, policy/promotion.ts); this file adds no second one.
//
// Absorbed as ideas (ADR 0037, mode idea, cited here and in the card):
// dent8 (Apache-2.0 or MIT), the exhaustive kind by kind by operation lattice
// as a test shape; Veracium (MIT), the expectation that an unattested write
// lands at the least trusted kind.
import { describe, expect, test } from "vitest";
import { itemById } from "../../src/items.ts";
import { type Actor, adoptStoreItems } from "../../src/plane.ts";
import {
  GRANT_OWNER_ID,
  GRANT_SOURCE_ID,
  RETIRED_CONTENT_ID,
  WRITE_GRANT_ID,
} from "../../src/policy/evaluate.ts";
import { loadPreset } from "../../src/policy/load.ts";
import { leastTrusted, PROMOTE_NO_EVIDENCE_ID } from "../../src/policy/promotion.ts";
import type { Grant, MemoryItem, Policy, Provenance } from "../../src/schema.ts";
import type { Workload } from "../../src/simulate.ts";
import { AT, fresh, id, item, testPolicy } from "../unit/plane/helpers.ts";

type Kind = Provenance["kind"];

/** The seven provenance kinds, in the schema's order; trust is judged by core's leastTrusted. */
const KINDS: readonly Kind[] = [
  "user",
  "document",
  "tool",
  "model",
  "import",
  "compaction",
  "external",
];

/** Is `writer` strictly less trusted than `victim` in core's order? */
const lessTrusted = (writer: Kind, victim: Kind) =>
  writer !== victim && leastTrusted([writer, victim]) === writer;

const LATER = "2026-10-25T13:00:00Z";
const SCOPE = "person:alice";

/** The item's owner, writing as source `kind`. */
const owner = (kind?: Kind): Actor => ({
  id: SCOPE,
  level: "person",
  memberships: [SCOPE],
  ...(kind ? { source: kind } : {}),
});

/** A co-member of the owner's scope who is not its owner (another id), writing as `kind`. */
const coMember = (kind: Kind): Actor => ({
  id: "agent:helper",
  level: "person",
  memberships: [SCOPE],
  source: kind,
});

/** A co-member of the owner's scope with no harness-set source. */
const coMemberNoSource: Actor = { id: "agent:helper", level: "person", memberships: [SCOPE] };

/**
 * Every kind admitted in person scope with no floor and no review, so only
 * the trust question decides, and a budget of one person-scope episodic item
 * evicted by recency. The registered presets admit fewer kinds (none admits
 * `external`); the plane's mechanism is the subject here, not a preset.
 */
const POLICY: Policy = testPolicy({
  id: "trust",
  write: [
    {
      scope: "person",
      allowed_sources: [...KINDS],
      confidence_floor: 0,
      forbidden_classes: [],
      requires_review: false,
    },
  ],
  retention: [{ scope: "person", class: "episodic", ttl: null, budget: 1, eviction: "recency" }],
});

const GRANT: Grant = {
  to: "person:bob",
  class: "semantic",
  mode: "read",
  expires: "2027-01-01T00:00:00Z",
};

/** The owner writes the victim, item 1, at kind `victim` (the plane sets it from the source). */
async function withVictim(
  victim: Kind,
  over: { class?: "episodic" | "semantic"; grants?: Grant[] } = {},
) {
  const planeOf = fresh(POLICY);
  const first = await planeOf.plane.write(
    owner(victim),
    item(1, { scope: SCOPE, owner: SCOPE, content: "the owner's fact", ...over }),
    AT,
  );
  expect(first.event.decision).toBe("allow");
  expect(first.item?.provenance.kind).toBe(victim);
  return { ...planeOf, stored: first.item as MemoryItem };
}

/** A rewrite of `stored`: the same id and owner, the next version, `change` applied. */
const rewriteOf = (stored: MemoryItem, change: Partial<MemoryItem>): MemoryItem =>
  ({ ...stored, version: stored.version + 1, store_ref: null, ...change }) as MemoryItem;

const cells = KINDS.flatMap((writer) =>
  KINDS.map((victim) => ({
    writer,
    victim,
    label: lessTrusted(writer, victim) ? "gap cell, writer less trusted" : "not a gap cell",
  })),
);

describe("GH-38 lattice: a co-member who is not the owner, writer kind by victim kind", () => {
  test("the lattice covers 49 pairs, 21 of them a less trusted writer", () => {
    expect(cells).toHaveLength(49);
    expect(cells.filter((c) => lessTrusted(c.writer, c.victim))).toHaveLength(21);
  });

  describe.each(cells)("writer $writer, victim $victim ($label)", ({ writer, victim }) => {
    test("GH-38 rewrite: allowed under the person write rule; the item takes the writer's content and kind", async () => {
      const { plane, db, stored } = await withVictim(victim, { class: "semantic" });
      const result = await plane.write(
        coMember(writer),
        rewriteOf(stored, { content: "rewritten by a co-member" }),
        LATER,
      );
      expect(result.event.decision).toBe("allow");
      expect(result.event.policy_id).toBe("trust/write/person");
      expect(result.event.reason).toContain(`provenance set by the plane: source ${writer}`);
      const after = itemById(db, id(1));
      expect(after?.status).toBe("active");
      expect(after?.content).toBe("rewritten by a co-member");
      expect(after?.provenance).toMatchObject({ kind: writer, actor: "agent:helper" });
      expect(after?.owner).toBe(SCOPE);
    });

    test("GH-38 retire: a rewrite to status retired is allowed; the item leaves reads at the writer's kind", async () => {
      const { plane, db, stored } = await withVictim(victim, { class: "semantic" });
      const result = await plane.write(
        coMember(writer),
        rewriteOf(stored, { status: "retired" }),
        LATER,
      );
      expect(result.event.decision).toBe("allow");
      expect(result.event.policy_id).toBe("trust/write/person");
      const after = itemById(db, id(1));
      expect(after?.status).toBe("retired");
      expect(after?.provenance.kind).toBe(writer);
      const read = await plane.read(owner(), { text: "fact", at: LATER });
      expect(read.items.map((i) => i.id)).not.toContain(id(1));
    });

    test("GH-38 budget eviction: the co-member's new write evicts the owner's item, whose kind is not consulted", async () => {
      const { plane, db } = await withVictim(victim, { class: "episodic" });
      const result = await plane.write(
        coMember(writer),
        item(2, { scope: SCOPE, owner: "agent:helper", class: "episodic", content: "new" }),
        LATER,
      );
      expect(result.event.decision).toBe("allow");
      expect(result.event.policy_id).toBe("trust/write/person");
      expect(
        result.retention.map((e) => [e.op, e.decision, e.item_id, e.actor, e.policy_id]),
      ).toEqual([["evict", "allow", id(1), "agent:helper", "trust/retention/person/episodic"]]);
      const victimAfter = itemById(db, id(1));
      expect(victimAfter?.status).toBe("retired");
      expect(victimAfter?.provenance.kind).toBe(victim);
      expect(itemById(db, id(2))?.provenance.kind).toBe(writer);
    });
  });
});

describe("GH-38 the owner's rules that protect today, and where they stop", () => {
  test("GH-38 grant-carrying item, rewrite by a model-sourced co-member: denied by the owner rule (card RV7), the item stays user", async () => {
    const { plane, db, stored } = await withVictim("user", { grants: [GRANT] });
    const result = await plane.write(
      coMember("model"),
      rewriteOf(stored, { content: "rewritten" }),
      LATER,
    );
    expect(result.event.decision).toBe("deny");
    expect(result.event.policy_id).toBe(GRANT_OWNER_ID);
    expect(itemById(db, id(1))).toMatchObject({
      content: "the owner's fact",
      status: "active",
      provenance: { kind: "user", actor: SCOPE },
    });
  });

  test("GH-38 grant-carrying item, retire by a tool-sourced co-member: denied by the owner rule, the item stays active and user", async () => {
    const { plane, db, stored } = await withVictim("user", { grants: [GRANT] });
    const result = await plane.write(
      coMember("tool"),
      rewriteOf(stored, { status: "retired" }),
      LATER,
    );
    expect(result.event.decision).toBe("deny");
    expect(result.event.policy_id).toBe(GRANT_OWNER_ID);
    expect(itemById(db, id(1))).toMatchObject({ status: "active", provenance: { kind: "user" } });
  });

  test("GH-38 grant-carrying item, rewrite by the owner's own id as source tool: allowed, the item becomes tool (the owner rule keys on the id, not the source)", async () => {
    const { plane, db, stored } = await withVictim("user", { grants: [GRANT] });
    const result = await plane.write(
      owner("tool"),
      rewriteOf(stored, { content: "rewritten" }),
      LATER,
    );
    expect(result.event.decision).toBe("allow");
    expect(result.event.policy_id).toBe("trust/write/person");
    expect(itemById(db, id(1))).toMatchObject({
      content: "rewritten",
      provenance: { kind: "tool", actor: SCOPE },
      grants: [GRANT],
    });
  });

  test("GH-38 grant-carrying item, rewrite by the owner's own id as source model: denied by the grant rule (model content carries no grants), the item stays user", async () => {
    const { plane, db, stored } = await withVictim("user", { grants: [GRANT] });
    const result = await plane.write(
      owner("model"),
      rewriteOf(stored, { content: "rewritten" }),
      LATER,
    );
    expect(result.event.decision).toBe("deny");
    expect(result.event.policy_id).toBe(WRITE_GRANT_ID);
    expect(itemById(db, id(1))?.provenance.kind).toBe("user");
  });

  test("GH-38 item without grants, rewrite by the owner's own id as source model (how the pi extension and MCP server label the person's agent): allowed, the item becomes model", async () => {
    const { plane, db, stored } = await withVictim("user");
    const result = await plane.write(
      owner("model"),
      rewriteOf(stored, { content: "rewritten by the agent" }),
      LATER,
    );
    expect(result.event.decision).toBe("allow");
    expect(result.event.policy_id).toBe("trust/write/person");
    expect(itemById(db, id(1))?.provenance).toMatchObject({ kind: "model", actor: SCOPE });
  });

  test("GH-38 the owner acting as user rewrites a document item: allowed (ADR 0040's exemption, and today's behaviour)", async () => {
    const { plane, db, stored } = await withVictim("document");
    const result = await plane.write(
      owner("user"),
      rewriteOf(stored, { content: "corrected" }),
      LATER,
    );
    expect(result.event.decision).toBe("allow");
    expect(itemById(db, id(1))?.provenance.kind).toBe("user");
  });

  test("GH-38 grant-carrying user item, budget eviction by a model-sourced co-member's write: allowed, eviction consults neither grants nor kind", async () => {
    const episodicGrant: Grant = { ...GRANT, class: "episodic" };
    const { plane, db } = await withVictim("user", { class: "episodic", grants: [episodicGrant] });
    const result = await plane.write(
      coMember("model"),
      item(2, { scope: SCOPE, owner: "agent:helper", class: "episodic", content: "new" }),
      LATER,
    );
    expect(result.retention.map((e) => [e.op, e.decision, e.item_id, e.policy_id])).toEqual([
      ["evict", "allow", id(1), "trust/retention/person/episodic"],
    ]);
    expect(itemById(db, id(1))).toMatchObject({
      status: "retired",
      provenance: { kind: "user" },
      grants: [episodicGrant],
    });
  });

  test("GH-38 adoption of a hand-edited store record of a user item: allowed as the owner with source import, the item takes the edit at kind import", async () => {
    const { plane, db, deps, adapter, stored } = await withVictim("user");
    // The store's record edited outside the plane (a person editing the file).
    await adapter.write({ ...stored, content: "edited in the store" } as MemoryItem);
    const report = await adoptStoreItems(deps, owner(), SCOPE, LATER);
    expect(report).toMatchObject({ allowed: 1, denied: 0 });
    const event = plane.events().at(-1);
    expect(event).toMatchObject({
      item_id: id(1),
      decision: "allow",
      policy_id: "trust/write/person",
    });
    expect(itemById(db, id(1))).toMatchObject({
      content: "edited in the store",
      provenance: { kind: "import", actor: SCOPE },
    });
  });
});

describe("GH-38 under the registered presets: team scope, where no synthetic policy is needed", () => {
  const TEAM = "team:platform";
  /** The owner, a member of the team. */
  const alice = (source: Kind): Actor => ({
    id: "person:alice",
    level: "person",
    memberships: ["person:alice", TEAM],
    source,
  });
  /** A co-member of the team who is not the item's owner. */
  const bob = (source: Kind): Actor => ({
    id: "person:bob",
    level: "person",
    memberships: ["person:bob", TEAM],
    source,
  });
  const teamItem = () => item(1, { scope: TEAM, owner: "person:alice", content: "alice's fact" });

  async function ownerWrote(preset: "strict" | "medium" | "permissive", victim: Kind) {
    const planeOf = fresh(loadPreset(preset));
    const first = await planeOf.plane.write(alice(victim), teamItem(), AT);
    expect(first.event.decision).toBe("allow");
    return { ...planeOf, stored: itemById(planeOf.db, id(1)) as MemoryItem };
  }

  const pairs: [Kind, Kind][] = [
    ["tool", "user"],
    ["tool", "document"],
    ["import", "user"],
    ["document", "user"],
  ];
  const presetCells = (["medium", "permissive"] as const).flatMap((preset) =>
    pairs.map(([writer, victim]) => ({ preset, writer, victim })),
  );

  describe.each(presetCells)(
    "preset $preset, writer $writer, victim $victim",
    ({ preset, writer, victim }) => {
      test("GH-38 preset rewrite: the co-member's rewrite is allowed under the team write rule; the owner's item takes its text and kind", async () => {
        const { plane, db, stored } = await ownerWrote(preset, victim);
        expect(stored).toMatchObject({ status: "active", provenance: { kind: victim } });
        const result = await plane.write(
          bob(writer),
          rewriteOf(stored, { content: "bob's text" }),
          LATER,
        );
        expect(result.event.decision).toBe("allow");
        expect(result.event.policy_id).toBe(`preset.${preset}/write/team`);
        expect(itemById(db, id(1))).toMatchObject({
          status: "active",
          owner: "person:alice",
          content: "bob's text",
          provenance: { kind: writer, actor: "person:bob" },
        });
      });

      test("GH-38 preset retire: the co-member's retire is allowed under the team write rule; the owner's item is retired at the writer's kind", async () => {
        const { plane, db, stored } = await ownerWrote(preset, victim);
        const result = await plane.write(
          bob(writer),
          rewriteOf(stored, { status: "retired" }),
          LATER,
        );
        expect(result.event.decision).toBe("allow");
        expect(result.event.policy_id).toBe(`preset.${preset}/write/team`);
        expect(itemById(db, id(1))).toMatchObject({
          status: "retired",
          provenance: { kind: writer },
        });
      });
    },
  );

  /** Under strict, team scope requires review: the owner's item lands a candidate and a reviewer promotes it in place. */
  async function strictActive() {
    const planeOf = await ownerWrote("strict", "user");
    expect(planeOf.stored.status).toBe("candidate");
    const reviewer: Actor = {
      id: "person:rev",
      level: "person",
      memberships: ["person:rev", TEAM],
      source: "user",
    };
    const promoted = await planeOf.plane.promote(reviewer, id(1), TEAM, AT, { review: true });
    expect(promoted.event.decision).toBe("allow");
    const stored = itemById(planeOf.db, id(1)) as MemoryItem;
    expect(stored).toMatchObject({ status: "active", provenance: { kind: "user" } });
    return { ...planeOf, stored };
  }

  test("GH-38 strict retire: a tool-sourced co-member retires the reviewed, active user item; allowed with no review (requires_review only turns active into candidate)", async () => {
    const { plane, db, stored } = await strictActive();
    const result = await plane.write(bob("tool"), rewriteOf(stored, { status: "retired" }), LATER);
    expect(result.event.decision).toBe("allow");
    expect(result.event.policy_id).toBe("preset.strict/write/team");
    expect(itemById(db, id(1))).toMatchObject({ status: "retired", provenance: { kind: "tool" } });
  });

  test("GH-38 strict rewrite: a tool-sourced co-member's rewrite turns the reviewed, active user item back into a candidate, which reads no longer return", async () => {
    const { plane, db, stored } = await strictActive();
    const before = await plane.read(alice("user"), { text: "fact", at: LATER });
    expect(before.items.map((i) => i.id)).toContain(id(1));
    const result = await plane.write(
      bob("tool"),
      rewriteOf(stored, { content: "bob's fact" }),
      LATER,
    );
    expect(result.event.decision).toBe("allow");
    expect(result.event.policy_id).toBe("preset.strict/write/team");
    expect(result.event.reason).toContain("team scope requires review");
    expect(itemById(db, id(1))).toMatchObject({
      status: "candidate",
      content: "bob's fact",
      provenance: { kind: "tool" },
    });
    const after = await plane.read(alice("user"), { text: "fact", at: LATER });
    expect(after.items.map((i) => i.id)).not.toContain(id(1));
  });

  test("GH-38 strict, a refuted cell: an import-sourced co-member is refused by the team rule's sources, and the item stays active and user", async () => {
    const { plane, db, stored } = await strictActive();
    const result = await plane.write(
      bob("import"),
      rewriteOf(stored, { status: "retired" }),
      LATER,
    );
    expect(result.event.decision).toBe("deny");
    expect(result.event.policy_id).toBe("preset.strict/write/team");
    expect(result.event.reason).toContain("source import is not allowed in team scope");
    expect(itemById(db, id(1))).toMatchObject({ status: "active", provenance: { kind: "user" } });
  });

  test.each(["strict", "medium", "permissive"] as const)(
    "GH-38 preset %s, person scope: a model-sourced non-owner co-member rewrites the owner's user item; allowed, the item becomes model",
    async (preset) => {
      const { plane, db } = fresh(loadPreset(preset));
      await plane.write(
        owner("user"),
        item(1, { scope: SCOPE, owner: SCOPE, content: "the owner's fact" }),
        AT,
      );
      const stored = itemById(db, id(1)) as MemoryItem;
      const result = await plane.write(
        coMember("model"),
        rewriteOf(stored, { content: "the agent's text" }),
        LATER,
      );
      expect(result.event.decision).toBe("allow");
      expect(result.event.policy_id).toBe(`preset.${preset}/write/person`);
      expect(itemById(db, id(1))).toMatchObject({
        content: "the agent's text",
        provenance: { kind: "model", actor: "agent:helper" },
      });
    },
  );
});

describe("GH-39 floor: a write whose actor names no source", () => {
  const medium = loadPreset("medium");
  /** A caller with no harness-set source, a member of the team scope. */
  const unattested: Actor = {
    id: "person:omar",
    level: "person",
    memberships: ["person:omar", "team:platform"],
  };
  /** Claims a user write by someone else. */
  const claimed = item(1, {
    scope: "team:platform",
    kind: "user",
    provenance: {
      kind: "user",
      ref: "doc/1",
      hash: `sha256:${"0".repeat(64)}`,
      actor: "person:carol",
    },
  });

  test("GH-39 Plane.write with no source, claiming kind user into team scope under preset medium: allowed, kind user and the claimed actor stand", async () => {
    const { plane, db } = fresh(medium);
    const result = await plane.write(unattested, claimed, AT);
    expect(result.event.decision).toBe("allow");
    expect(result.event.policy_id).toBe("preset.medium/write/team");
    expect(result.event.reason).toContain("provenance as claimed by the caller");
    expect(result.event.actor).toBe("person:omar");
    expect(itemById(db, id(1))?.provenance).toMatchObject({ kind: "user", actor: "person:carol" });
  });

  test("GH-39 control: the same item from the same caller labelled model is denied by the team write rule, at kind model", async () => {
    const { plane, db } = fresh(medium);
    const result = await plane.write({ ...unattested, source: "model" }, claimed, AT);
    expect(result.event.decision).toBe("deny");
    expect(result.event.policy_id).toBe("preset.medium/write/team");
    expect(result.event.reason).toContain("source model is not allowed in team scope");
    expect(result.event.reason).toContain("provenance set by the plane: source model");
    expect(itemById(db, id(1))).toBeUndefined();
  });

  test("GH-39 Plane.checkWrite with no source reports the same allow as the write", async () => {
    const { plane } = fresh(medium);
    const check = await plane.checkWrite(unattested, claimed, AT);
    expect(check.decision).toBe("allow");
    expect(check.policy_id).toBe("preset.medium/write/team");
    expect(check.reason).toContain("provenance as claimed by the caller");
  });

  test("GH-39 a first write with no source, claiming user, may carry a grant: allowed, the grant stands", async () => {
    const { plane, db } = fresh(medium);
    const granted = { ...claimed, grants: [GRANT] } as MemoryItem;
    const result = await plane.write(unattested, granted, AT);
    expect(result.event.decision).toBe("allow");
    expect(itemById(db, id(1))).toMatchObject({ provenance: { kind: "user" }, grants: [GRANT] });
  });

  test("GH-39 control: the same granted item labelled model is denied by the grant rule", async () => {
    const { plane, db } = fresh(medium);
    const granted = { ...claimed, grants: [GRANT] } as MemoryItem;
    const result = await plane.write({ ...unattested, source: "model" }, granted, AT);
    expect(result.event.decision).toBe("deny");
    expect(result.event.policy_id).toBe(WRITE_GRANT_ID);
    expect(itemById(db, id(1))).toBeUndefined();
  });

  test("GH-39 where the floor holds today: a rewrite with no source that changes the grants is denied (engram/grant/source), the item keeps none", async () => {
    const { plane, db } = fresh(medium);
    const first = await plane.write(unattested, claimed, AT);
    const stored = first.item as MemoryItem;
    const result = await plane.write(unattested, rewriteOf(stored, { grants: [GRANT] }), LATER);
    expect(result.event.decision).toBe("deny");
    expect(result.event.policy_id).toBe(GRANT_SOURCE_ID);
    expect(itemById(db, id(1))).toMatchObject({ provenance: { kind: "user" }, grants: [] });
  });

  test("GH-39 where the floor holds today: adoption with no source records a record claiming user at kind import", async () => {
    const { deps, adapter, db } = fresh(POLICY);
    // A record the plane never wrote, claiming a user write.
    await adapter.write(item(5, { scope: SCOPE, owner: SCOPE, kind: "user" }));
    const report = await adoptStoreItems(deps, owner(), SCOPE, AT);
    expect(report).toMatchObject({ allowed: 1, denied: 0 });
    expect(itemById(db, id(5))?.provenance).toMatchObject({ kind: "import", actor: SCOPE });
  });

  /** Two writers with no source (or labelled `source`) each write `content` into person:alice claiming user. */
  async function confirmers(plane: ReturnType<typeof fresh>["plane"], source?: Kind) {
    const out = [];
    for (const [n, who] of [
      [2, "agent:x"],
      [3, "agent:y"],
    ] as const) {
      const writer: Actor = {
        id: who,
        level: "person",
        memberships: [SCOPE],
        ...(source ? { source } : {}),
      };
      out.push(
        await plane.write(
          writer,
          item(n, {
            scope: SCOPE,
            owner: who,
            class: "episodic",
            content: "same fact",
            kind: "user",
          }),
          AT,
        ),
      );
    }
    return out;
  }

  test("GH-39 promotion: two sourceless writers claiming user confirm the owner's episodic item under medium; the promotion is allowed and the promoted item is user", async () => {
    const { plane } = fresh(medium);
    await plane.write(
      owner("user"),
      item(1, { scope: SCOPE, owner: SCOPE, class: "episodic", content: "same fact" }),
      AT,
    );
    const writes = await confirmers(plane);
    expect(writes.map((w) => [w.event.decision, w.item?.provenance.kind])).toEqual([
      ["allow", "user"],
      ["allow", "user"],
    ]);
    const promoted = await plane.promote(owner("user"), id(1), SCOPE, LATER);
    expect(promoted.event.decision).toBe("allow");
    expect(promoted.event.policy_id).toBe("preset.medium/promotion/episodic-to-semantic");
    expect(promoted.event.reason).toContain("3 confirmations by distinct actors");
    expect(promoted.item).toMatchObject({ class: "semantic", provenance: { kind: "user" } });
  });

  test("GH-39 promotion control: the same two writers labelled model do not confirm; the promotion is denied (engram/promote/no-evidence)", async () => {
    const { plane } = fresh(medium);
    await plane.write(
      owner("user"),
      item(1, { scope: SCOPE, owner: SCOPE, class: "episodic", content: "same fact" }),
      AT,
    );
    const writes = await confirmers(plane, "model");
    expect(writes.map((w) => [w.event.decision, w.item?.provenance.kind])).toEqual([
      ["allow", "model"],
      ["allow", "model"],
    ]);
    const promoted = await plane.promote(owner("user"), id(1), SCOPE, LATER);
    expect(promoted.event.decision).toBe("deny");
    expect(promoted.event.policy_id).toBe(PROMOTE_NO_EVIDENCE_ID);
    expect(promoted.item).toBeNull();
  });

  /** The owner's item 1, then item 2 whose write evicts it over a budget of one: item 1's content is retired. */
  async function withRetiredContent() {
    const planeOf = fresh(POLICY);
    const { plane } = planeOf;
    await plane.write(
      owner("user"),
      item(1, { scope: SCOPE, owner: SCOPE, class: "episodic", content: "an evicted fact" }),
      AT,
    );
    const second = await plane.write(
      owner("user"),
      item(2, { scope: SCOPE, owner: SCOPE, class: "episodic", content: "another fact" }),
      AT,
    );
    expect(second.retention.map((e) => [e.op, e.item_id])).toEqual([["evict", id(1)]]);
    return planeOf;
  }
  /** Item 3, restating the evicted content, claiming user. */
  const restating = item(3, {
    scope: SCOPE,
    owner: SCOPE,
    class: "episodic",
    content: "an evicted fact",
    kind: "user",
  });

  test("GH-39 retired content: a sourceless write claiming user restates content an eviction retired; allowed, at kind user", async () => {
    const { plane, db } = await withRetiredContent();
    const result = await plane.write(coMemberNoSource, restating, LATER);
    expect(result.event.decision).toBe("allow");
    expect(result.event.policy_id).toBe("trust/write/person");
    expect(itemById(db, id(3))).toMatchObject({ status: "active", provenance: { kind: "user" } });
  });

  test("GH-39 retired content control: the same write labelled model is denied (engram/write/retired-content)", async () => {
    const { plane, db } = await withRetiredContent();
    const result = await plane.write({ ...coMemberNoSource, source: "model" }, restating, LATER);
    expect(result.event.decision).toBe("deny");
    expect(result.event.policy_id).toBe(RETIRED_CONTENT_ID);
    expect(itemById(db, id(3))).toBeUndefined();
  });

  test("GH-39 the simulator judges a workload actor with no source as the plane does: its claimed user item into team scope is allowed under medium", async () => {
    const { plane } = fresh(medium);
    const workload: Workload = {
      id: "e2-7-floor",
      actors: { unattested, agent: { ...unattested, source: "model" } },
      steps: [
        { op: "write", as: "unattested", at: AT, item: claimed },
        { op: "write", as: "agent", at: AT, item: { ...claimed, id: id(2) } },
      ],
    } as unknown as Workload;
    const report = await plane.simulate(workload, medium);
    expect(report.baseline.outcomes.map((o) => [o.decision, o.policy_id])).toEqual([
      ["allow", "preset.medium/write/team"],
      ["deny", "preset.medium/write/team"],
    ]);
  });
});
