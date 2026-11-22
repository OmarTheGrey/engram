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
//
// Card E2.11 (ADR 0040) gives each case its counterpart under the trust
// options, at the end of this file: the same case with trust.unattested_floor
// and trust.protect_trusted on, now floored or denied. The cases above stay
// as they are: with the options off, the plane does what they pin.
import { describe, expect, test } from "vitest";
import { allEvents, appendEvent, currentItems } from "../../src/events.ts";
import { itemById } from "../../src/items.ts";
import { type Actor, adoptStoreItems, createPlane } from "../../src/plane.ts";
import {
  GRANT_OWNER_ID,
  GRANT_SOURCE_ID,
  RETIRED_CONTENT_ID,
  WRITE_GRANT_ID,
} from "../../src/policy/evaluate.ts";
import { loadPreset } from "../../src/policy/load.ts";
import { leastTrusted, PROMOTE_NO_EVIDENCE_ID } from "../../src/policy/promotion.ts";
import { PROTECTED_ID } from "../../src/policy/retention.ts";
import { DOWNGRADE_ID } from "../../src/policy/trust.ts";
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

// Card E2.11: each case above, under the trust options (ADR 0040).

const ON = { unattested_floor: "on", protect_trusted: "on" } as const;
/** POLICY with both trust options on. */
const POLICY_ON: Policy = { ...POLICY, trust: ON };
/** A registered preset with both trust options on: the mechanism under its rules. */
const presetOn = (name: "strict" | "medium" | "permissive"): Policy => ({
  ...loadPreset(name),
  trust: ON,
});

/** withVictim, under POLICY_ON. */
async function withVictimOn(
  victim: Kind,
  over: { class?: "episodic" | "semantic"; grants?: Grant[] } = {},
) {
  const planeOf = fresh(POLICY_ON);
  const first = await planeOf.plane.write(
    owner(victim),
    item(1, { scope: SCOPE, owner: SCOPE, content: "the owner's fact", ...over }),
    AT,
  );
  expect(first.event.decision).toBe("allow");
  return { ...planeOf, stored: first.item as MemoryItem };
}

describe("E2.11 the lattice under the trust options: a less trusted co-member changes and removes nothing", () => {
  describe.each(cells)("writer $writer, victim $victim ($label)", ({ writer, victim }) => {
    const gap = lessTrusted(writer, victim);

    test("E2.11 rewrite: denied (engram/write/downgrade) in a gap cell, allowed as before otherwise", async () => {
      const { plane, db, stored } = await withVictimOn(victim, { class: "semantic" });
      const result = await plane.write(
        coMember(writer),
        rewriteOf(stored, { content: "rewritten by a co-member" }),
        LATER,
      );
      if (!gap) {
        expect(result.event.decision).toBe("allow");
        expect(itemById(db, id(1))?.provenance.kind).toBe(writer);
        return;
      }
      expect(result.event.decision).toBe("deny");
      expect(result.event.policy_id).toBe(DOWNGRADE_ID);
      expect(result.event.reason).toContain(`a ${writer} write rewrites item ${id(1)}`);
      expect(itemById(db, id(1))).toMatchObject({
        status: "active",
        content: "the owner's fact",
        provenance: { kind: victim, actor: SCOPE },
      });
    });

    test("E2.11 retire: denied in a gap cell; the item stays active and readable", async () => {
      const { plane, db, stored } = await withVictimOn(victim, { class: "semantic" });
      const result = await plane.write(
        coMember(writer),
        rewriteOf(stored, { status: "retired" }),
        LATER,
      );
      if (!gap) {
        expect(result.event.decision).toBe("allow");
        expect(itemById(db, id(1))?.status).toBe("retired");
        return;
      }
      expect(result.event.decision).toBe("deny");
      expect(result.event.policy_id).toBe(DOWNGRADE_ID);
      expect(result.event.reason).toContain(`a ${writer} write retires item ${id(1)}`);
      expect(itemById(db, id(1))).toMatchObject({ status: "active", provenance: { kind: victim } });
      const read = await plane.read(owner(), { text: "fact", at: LATER });
      expect(read.items.map((i) => i.id)).toContain(id(1));
    });

    test("E2.11 budget eviction: in a gap cell the co-member's write is denied rather than evict the owner's item", async () => {
      const { plane, db } = await withVictimOn(victim, { class: "episodic" });
      const result = await plane.write(
        coMember(writer),
        item(2, { scope: SCOPE, owner: "agent:helper", class: "episodic", content: "new" }),
        LATER,
      );
      if (!gap) {
        expect(result.event.decision).toBe("allow");
        expect(result.retention.map((e) => [e.op, e.decision, e.item_id])).toEqual([
          ["evict", "allow", id(1)],
        ]);
        return;
      }
      expect(result.event.decision).toBe("deny");
      expect(result.event.policy_id).toBe(DOWNGRADE_ID);
      expect(result.event.reason).toContain("would have to evict an item more trusted than it");
      expect(result.event.reason).toContain("no item there is as little trusted as the write");
      // Refused at the decision, before the store is written.
      expect(result.event.reason).not.toContain("before it was committed");
      expect(result.retention).toEqual([]);
      expect(itemById(db, id(1))).toMatchObject({ status: "active", provenance: { kind: victim } });
      expect(itemById(db, id(2))).toBeUndefined();
    });
  });
});

describe("E2.11 the owner's rules under the trust options", () => {
  test("E2.11 grant-carrying item, rewrite by a model-sourced co-member: still denied by the owner rule, which is checked first", async () => {
    const { plane, db, stored } = await withVictimOn("user", { grants: [GRANT] });
    const result = await plane.write(
      coMember("model"),
      rewriteOf(stored, { content: "rewritten" }),
      LATER,
    );
    expect(result.event.policy_id).toBe(GRANT_OWNER_ID);
    expect(itemById(db, id(1))?.content).toBe("the owner's fact");
  });

  test("E2.11 grant-carrying item, retire by a tool-sourced co-member: still denied by the owner rule", async () => {
    const { plane, db, stored } = await withVictimOn("user", { grants: [GRANT] });
    const result = await plane.write(
      coMember("tool"),
      rewriteOf(stored, { status: "retired" }),
      LATER,
    );
    expect(result.event.policy_id).toBe(GRANT_OWNER_ID);
    expect(itemById(db, id(1))?.status).toBe("active");
  });

  test("E2.11 grant-carrying item, rewrite by the owner's own id as source tool: now denied (engram/write/downgrade), the item stays user", async () => {
    const { plane, db, stored } = await withVictimOn("user", { grants: [GRANT] });
    const result = await plane.write(
      owner("tool"),
      rewriteOf(stored, { content: "rewritten" }),
      LATER,
    );
    expect(result.event.decision).toBe("deny");
    expect(result.event.policy_id).toBe(DOWNGRADE_ID);
    expect(itemById(db, id(1))).toMatchObject({
      content: "the owner's fact",
      provenance: { kind: "user" },
      grants: [GRANT],
    });
  });

  test("E2.11 grant-carrying item, rewrite by the owner's own id as source model: still denied by the grant rule", async () => {
    const { plane, stored } = await withVictimOn("user", { grants: [GRANT] });
    const result = await plane.write(
      owner("model"),
      rewriteOf(stored, { content: "rewritten" }),
      LATER,
    );
    expect(result.event.policy_id).toBe(WRITE_GRANT_ID);
  });

  test("E2.11 item without grants, rewrite by the owner's own id as source model: now denied, only the owner acting as user is exempt", async () => {
    const { plane, db, stored } = await withVictimOn("user");
    const result = await plane.write(
      owner("model"),
      rewriteOf(stored, { content: "rewritten by the agent" }),
      LATER,
    );
    expect(result.event.decision).toBe("deny");
    expect(result.event.policy_id).toBe(DOWNGRADE_ID);
    expect(result.event.reason).toContain(`only its owner ${SCOPE}, acting as user, may`);
    expect(itemById(db, id(1))?.provenance).toMatchObject({ kind: "user", actor: SCOPE });
  });

  test("E2.11 the owner acting as user rewrites and then retires a document item: both allowed", async () => {
    const { plane, db, stored } = await withVictimOn("document");
    const rewritten = await plane.write(
      owner("user"),
      rewriteOf(stored, { content: "corrected" }),
      LATER,
    );
    expect(rewritten.event.decision).toBe("allow");
    const retired = await plane.write(
      owner("user"),
      rewriteOf(rewritten.item as MemoryItem, { status: "retired" }),
      LATER,
    );
    expect(retired.event.decision).toBe("allow");
    expect(itemById(db, id(1))).toMatchObject({ status: "retired", provenance: { kind: "user" } });
  });

  test("E2.11 grant-carrying user item, budget eviction by a model-sourced co-member's write: the write is denied, the item stays", async () => {
    const episodicGrant: Grant = { ...GRANT, class: "episodic" };
    const { plane, db } = await withVictimOn("user", {
      class: "episodic",
      grants: [episodicGrant],
    });
    const result = await plane.write(
      coMember("model"),
      item(2, { scope: SCOPE, owner: "agent:helper", class: "episodic", content: "new" }),
      LATER,
    );
    expect(result.event.decision).toBe("deny");
    expect(result.event.policy_id).toBe(DOWNGRADE_ID);
    expect(result.retention).toEqual([]);
    expect(itemById(db, id(1))).toMatchObject({ status: "active", grants: [episodicGrant] });
  });

  test("E2.11 adoption of a hand-edited store record of a user item: denied (engram/write/downgrade), once; the plane keeps the user item", async () => {
    const { plane, db, deps, adapter, stored } = await withVictimOn("user");
    await adapter.write({ ...stored, content: "edited in the store" } as MemoryItem);
    const report = await adoptStoreItems(deps, owner(), SCOPE, LATER);
    expect(report).toMatchObject({ allowed: 0, denied: 1, retired: 0 });
    const event = plane.events().at(-1);
    expect(event).toMatchObject({ item_id: id(1), decision: "deny", policy_id: DOWNGRADE_ID });
    expect(event?.reason).toContain("adopted from store");
    expect(event?.reason).toContain("a import write rewrites item");
    expect(itemById(db, id(1))).toMatchObject({
      status: "active",
      content: "the owner's fact",
      provenance: { kind: "user", actor: SCOPE },
    });
    // The same store content is not gated again on the next adoption.
    const events = plane.events().length;
    const again = await adoptStoreItems(deps, owner(), SCOPE, LATER);
    expect(again).toMatchObject({ allowed: 0, denied: 0, unchanged: 1 });
    expect(plane.events()).toHaveLength(events);
    // The owner makes the edit through the plane, as user.
    const made = await plane.write(
      owner("user"),
      rewriteOf(itemById(db, id(1)) as MemoryItem, { content: "edited in the store" }),
      LATER,
    );
    expect(made.event.decision).toBe("allow");
  });

  test("E2.11 an agent's sweep evicts no more trusted item, a person's sweep does", async () => {
    // Two user items land under a budget of two; the budget is then one, so
    // the overage is the sweep's, under a plane over the same log.
    const roomy: Policy = {
      ...POLICY_ON,
      retention: [
        { scope: "person", class: "episodic", ttl: null, budget: 2, eviction: "recency" },
      ],
    };
    const { plane, deps } = fresh(roomy);
    for (const n of [1, 2])
      await plane.write(
        owner("user"),
        item(n, { scope: SCOPE, owner: SCOPE, class: "episodic", content: `fact ${n}` }),
        AT,
      );
    const tight = createPlane({ ...deps, policy: POLICY_ON });
    const byAgent = await tight.retain(coMember("model"), SCOPE, LATER);
    expect(byAgent.evicted).toEqual([]);
    const unattested = await tight.retain(coMemberNoSource, SCOPE, LATER);
    expect(unattested.evicted).toEqual([]);
    const byPerson = await tight.retain(owner("user"), SCOPE, LATER);
    expect(byPerson.evicted).toEqual([id(1)]);
  });

  test("E2.11 a sweep held back by protect_trusted records its shortfall once per state (review E2.11-5)", async () => {
    const roomy: Policy = {
      ...POLICY_ON,
      retention: [
        { scope: "person", class: "episodic", ttl: null, budget: 2, eviction: "recency" },
      ],
    };
    const { plane, deps, db } = fresh(roomy);
    for (const n of [1, 2])
      await plane.write(
        owner("user"),
        item(n, { scope: SCOPE, owner: SCOPE, class: "episodic", content: `fact ${n}` }),
        AT,
      );
    const tight = createPlane({ ...deps, policy: POLICY_ON });
    const byAgent = await tight.retain(coMember("model"), SCOPE, LATER);
    expect(byAgent.evicted).toEqual([]);
    expect(byAgent.events.map((e) => [e.op, e.decision, e.item_id, e.policy_id])).toEqual([
      ["evict", "deny", null, PROTECTED_ID],
    ]);
    expect(byAgent.events[0]?.reason).toContain("trust.protect_trusted");
    expect(byAgent.events[0]?.reason).toContain("1 over");
    // Nothing changed: the shortfall is not recorded again.
    const again = await tight.retain(coMember("model"), SCOPE, LATER);
    expect(again.events).toEqual([]);
    // A change in the class: recorded again.
    await plane.write(
      owner("user"),
      {
        ...(itemById(db, id(2)) as MemoryItem),
        version: 2,
        store_ref: null,
        content: "fact 2b",
      } as MemoryItem,
      LATER,
    );
    const later = await tight.retain(coMember("model"), SCOPE, LATER);
    expect(later.events.map((e) => [e.op, e.decision, e.policy_id])).toEqual([
      ["evict", "deny", PROTECTED_ID],
    ]);
    // With the option off, the same sweep evicts and records no shortfall.
    const off = createPlane({ ...deps, policy: { ...POLICY_ON, trust: {} } });
    const unprotected = await off.retain(coMember("model"), SCOPE, LATER);
    expect(unprotected.events.map((e) => [e.op, e.decision])).toEqual([["evict", "allow"]]);
  });

  test("E2.11 another handle fills the scope between the decision and the commit: the write is refused there, and the store put back", async () => {
    const { plane, db, adapter } = fresh(POLICY_ON);
    const theirs = item(1, {
      scope: SCOPE,
      owner: SCOPE,
      class: "episodic",
      content: "landed meanwhile",
      provenance: { kind: "user", ref: "doc/1", hash: `sha256:${"0".repeat(64)}`, actor: SCOPE },
    });
    adapter.fault = async (written, store) => {
      adapter.fault = null;
      // Another handle's allowed write of a user item, committed meanwhile.
      const ref = await store.write(theirs);
      appendEvent(db, {
        id: id(800_001),
        ts: AT,
        op: "write",
        item_id: theirs.id,
        actor: SCOPE,
        scope_from: null,
        scope_to: SCOPE,
        decision: "allow",
        reason: "another handle's write",
        policy_id: "trust/write/person",
        item: { ...theirs, store_ref: ref },
        schema_version: 1,
      });
      return store.write(written);
    };
    const result = await plane.write(
      coMember("model"),
      item(2, { scope: SCOPE, owner: "agent:helper", class: "episodic", content: "new" }),
      LATER,
    );
    expect(result.event.decision).toBe("deny");
    expect(result.event.policy_id).toBe(DOWNGRADE_ID);
    expect(result.event.reason).toContain("before it was committed");
    expect(itemById(db, id(1))?.status).toBe("active");
    expect(itemById(db, id(2))).toBeUndefined();
    expect(allEvents(db).filter((e) => e.op === "evict")).toEqual([]);
  });

  test("E2.11 Plane.checkWrite reports the budget refusal the write would get, before anything is stored", async () => {
    const { plane, adapter } = await withVictimOn("user", { class: "episodic" });
    const writes = adapter.writes;
    const check = await plane.checkWrite(
      coMember("model"),
      item(2, { scope: SCOPE, owner: "agent:helper", class: "episodic", content: "new" }),
      LATER,
    );
    expect(check.decision).toBe("deny");
    expect(check.policy_id).toBe(DOWNGRADE_ID);
    expect(check.reason).toContain("would have to evict an item more trusted than it");
    expect(check.reason).not.toContain("before it was committed");
    expect(adapter.writes).toBe(writes);
  });

  test("E2.11 a promotion whose landing would evict a more trusted item is denied", async () => {
    const policy: Policy = {
      ...POLICY_ON,
      retention: [
        { scope: "person", class: "semantic", ttl: null, budget: 1, eviction: "recency" },
      ],
      promotion: {
        ...POLICY.promotion,
        episodic_to_semantic: { confirmations: 1, or_review: true },
      },
    };
    const { plane, db } = fresh(policy);
    await plane.write(owner("user"), item(1, { scope: SCOPE, owner: SCOPE, content: "kept" }), AT);
    await plane.write(
      owner("tool"),
      item(2, { scope: SCOPE, owner: SCOPE, class: "episodic", content: "a tool note" }),
      AT,
    );
    const promoted = await plane.promote(owner("tool"), id(2), SCOPE, LATER);
    expect(promoted.event).toMatchObject({
      op: "promote",
      decision: "deny",
      policy_id: DOWNGRADE_ID,
    });
    expect(itemById(db, id(1))?.status).toBe("active");
    expect(itemById(db, id(2))?.status).toBe("active");
  });

  test("E2.11 a promotion is refused at the decision, never after the store is written (review E2.11-9)", async () => {
    const policy: Policy = {
      ...POLICY_ON,
      retention: [
        { scope: "person", class: "semantic", ttl: null, budget: 1, eviction: "recency" },
      ],
      promotion: {
        ...POLICY.promotion,
        episodic_to_semantic: { confirmations: 1, or_review: true },
      },
    };
    const { plane, adapter } = fresh(policy);
    await plane.write(owner("user"), item(1, { scope: SCOPE, owner: SCOPE, content: "kept" }), AT);
    await plane.write(
      owner("tool"),
      item(2, { scope: SCOPE, owner: SCOPE, class: "episodic", content: "a tool note" }),
      AT,
    );
    const writes = adapter.writes;
    const promoted = await plane.promote(owner("tool"), id(2), SCOPE, LATER);
    expect(promoted.event).toMatchObject({
      op: "promote",
      decision: "deny",
      policy_id: DOWNGRADE_ID,
    });
    expect(promoted.event.reason).toContain("would have to evict an item more trusted than it");
    expect(promoted.event.reason).not.toContain("before it was committed");
    expect(adapter.writes).toBe(writes);
  });

  test("E2.11 another handle fills the target between a promotion's decision and its commit: the promotion is refused there (review E2.11-1)", async () => {
    const budget = 1;
    const policy: Policy = {
      ...POLICY_ON,
      retention: [{ scope: "person", class: "semantic", ttl: null, budget, eviction: "recency" }],
      promotion: {
        ...POLICY.promotion,
        episodic_to_semantic: { confirmations: 1, or_review: true },
      },
    };
    const { plane, db, adapter } = fresh(policy);
    await plane.write(
      owner("tool"),
      item(2, { scope: SCOPE, owner: SCOPE, class: "episodic", content: "a tool note" }),
      AT,
    );
    const theirs = item(1, {
      scope: SCOPE,
      owner: SCOPE,
      content: "landed meanwhile",
      provenance: { kind: "user", ref: "doc/1", hash: `sha256:${"0".repeat(64)}`, actor: SCOPE },
    });
    adapter.fault = async (written, store) => {
      adapter.fault = null;
      // Another handle's allowed write of a user semantic item, committed meanwhile.
      const ref = await store.write(theirs);
      appendEvent(db, {
        id: id(800_001),
        ts: AT,
        op: "write",
        item_id: theirs.id,
        actor: SCOPE,
        scope_from: null,
        scope_to: SCOPE,
        decision: "allow",
        reason: "another handle's write",
        policy_id: "trust/write/person",
        item: { ...theirs, store_ref: ref },
        schema_version: 1,
      });
      return store.write(written);
    };
    const promoted = await plane.promote(owner("tool"), id(2), SCOPE, LATER);
    expect(promoted.event).toMatchObject({
      op: "promote",
      decision: "deny",
      policy_id: DOWNGRADE_ID,
    });
    expect(promoted.event.reason).toContain("before it was committed");
    const active = currentItems(db).filter(
      (i) => i.scope === SCOPE && i.class === "semantic" && i.status === "active",
    );
    expect(active.length).toBeLessThanOrEqual(budget);
    expect(itemById(db, id(1))?.status).toBe("active");
    expect(allEvents(db).filter((e) => e.op === "evict")).toEqual([]);
  });
});

describe("E2.11 the registered presets with the trust options on, and the medium-trust preset", () => {
  const TEAM = "team:platform";
  const alice = (source: Kind): Actor => ({
    id: "person:alice",
    level: "person",
    memberships: ["person:alice", TEAM],
    source,
  });
  const bob = (source: Kind): Actor => ({
    id: "person:bob",
    level: "person",
    memberships: ["person:bob", TEAM],
    source,
  });
  const teamItem = () => item(1, { scope: TEAM, owner: "person:alice", content: "alice's fact" });
  async function ownerWroteOn(policy: Policy, victim: Kind) {
    const planeOf = fresh(policy);
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
  const policies: [string, Policy][] = [
    ["medium", presetOn("medium")],
    ["permissive", presetOn("permissive")],
    ["medium-trust", loadPreset("medium-trust")],
  ];
  const presetCells = policies.flatMap(([name, policy]) =>
    pairs.map(([writer, victim]) => ({ name, policy, writer, victim })),
  );

  describe.each(presetCells)(
    "$name, writer $writer, victim $victim",
    ({ policy, writer, victim }) => {
      test("E2.11 preset rewrite: denied (engram/write/downgrade); the owner's item keeps its text and kind", async () => {
        const { plane, db, stored } = await ownerWroteOn(policy, victim);
        const result = await plane.write(
          bob(writer),
          rewriteOf(stored, { content: "bob's text" }),
          LATER,
        );
        expect(result.event.decision).toBe("deny");
        expect(result.event.policy_id).toBe(DOWNGRADE_ID);
        expect(itemById(db, id(1))).toMatchObject({
          status: "active",
          content: "alice's fact",
          provenance: { kind: victim, actor: "person:alice" },
        });
      });

      test("E2.11 preset retire: denied; the owner's item stays active", async () => {
        const { plane, db, stored } = await ownerWroteOn(policy, victim);
        const result = await plane.write(
          bob(writer),
          rewriteOf(stored, { status: "retired" }),
          LATER,
        );
        expect(result.event.policy_id).toBe(DOWNGRADE_ID);
        expect(itemById(db, id(1))).toMatchObject({
          status: "active",
          provenance: { kind: victim },
        });
      });
    },
  );

  /** Strict with the options on: the owner's team item, reviewed into active. */
  async function strictActiveOn() {
    const planeOf = await ownerWroteOn(presetOn("strict"), "user");
    const reviewer: Actor = {
      id: "person:rev",
      level: "person",
      memberships: ["person:rev", TEAM],
      source: "user",
    };
    const promoted = await planeOf.plane.promote(reviewer, id(1), TEAM, AT, { review: true });
    expect(promoted.event.decision).toBe("allow");
    return { ...planeOf, stored: itemById(planeOf.db, id(1)) as MemoryItem };
  }

  test("E2.11 strict retire: the tool-sourced co-member's retire of the reviewed user item is denied", async () => {
    const { plane, db, stored } = await strictActiveOn();
    const result = await plane.write(bob("tool"), rewriteOf(stored, { status: "retired" }), LATER);
    expect(result.event.policy_id).toBe(DOWNGRADE_ID);
    expect(itemById(db, id(1))).toMatchObject({ status: "active", provenance: { kind: "user" } });
  });

  test("E2.11 strict rewrite: denied; the reviewed item stays active and reads still return it", async () => {
    const { plane, db, stored } = await strictActiveOn();
    const result = await plane.write(
      bob("tool"),
      rewriteOf(stored, { content: "bob's fact" }),
      LATER,
    );
    expect(result.event.policy_id).toBe(DOWNGRADE_ID);
    expect(itemById(db, id(1))?.status).toBe("active");
    const after = await plane.read(alice("user"), { text: "fact", at: LATER });
    expect(after.items.map((i) => i.id)).toContain(id(1));
  });

  test("E2.11 strict, the refuted cell: still denied, now by the trust rule, which is checked before the team rule's sources", async () => {
    const { plane, db, stored } = await strictActiveOn();
    const result = await plane.write(
      bob("import"),
      rewriteOf(stored, { status: "retired" }),
      LATER,
    );
    expect(result.event.decision).toBe("deny");
    expect(result.event.policy_id).toBe(DOWNGRADE_ID);
    expect(itemById(db, id(1))).toMatchObject({ status: "active", provenance: { kind: "user" } });
  });

  test.each(["strict", "medium", "permissive", "medium-trust"] as const)(
    "E2.11 %s, person scope: the model-sourced non-owner co-member's rewrite of the owner's user item is denied",
    async (name) => {
      const policy = name === "medium-trust" ? loadPreset(name) : presetOn(name);
      const { plane, db } = fresh(policy);
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
      expect(result.event.policy_id).toBe(DOWNGRADE_ID);
      expect(itemById(db, id(1))).toMatchObject({
        content: "the owner's fact",
        provenance: { kind: "user", actor: SCOPE },
      });
    },
  );
});

describe("E2.11 GH-39 under the trust options: a write whose actor names no source is floored", () => {
  const trusted = loadPreset("medium-trust");
  const unattested: Actor = {
    id: "person:omar",
    level: "person",
    memberships: ["person:omar", "team:platform"],
  };
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

  test("E2.11 Plane.write with no source, claiming user into team scope under medium-trust: floored to external, denied by the team rule", async () => {
    const { plane, db } = fresh(trusted);
    const result = await plane.write(unattested, claimed, AT);
    expect(result.event.decision).toBe("deny");
    expect(result.event.policy_id).toBe("preset.medium-trust/write/team");
    expect(result.event.reason).toContain("source external is not allowed in team scope");
    expect(result.event.reason).toContain(
      "provenance floored by the plane (trust.unattested_floor)",
    );
    expect(result.event.reason).toContain("not as the claimed user by person:carol");
    expect(itemById(db, id(1))).toBeUndefined();
  });

  test("E2.11 the same write into the writer's person scope lands, at kind external and as the writer's", async () => {
    const { plane, db } = fresh(trusted);
    const mine = { ...claimed, scope: "person:omar", owner: "person:omar" } as MemoryItem;
    const result = await plane.write(unattested, mine, AT);
    expect(result.event.decision).toBe("allow");
    expect(itemById(db, id(1))?.provenance).toMatchObject({
      kind: "external",
      actor: "person:omar",
    });
  });

  test("E2.11 control: labelled model, the write is denied as before", async () => {
    const { plane } = fresh(trusted);
    const result = await plane.write({ ...unattested, source: "model" }, claimed, AT);
    expect(result.event.decision).toBe("deny");
    expect(result.event.reason).toContain("source model is not allowed in team scope");
  });

  test("E2.11 Plane.checkWrite with no source reports the same floored deny", async () => {
    const { plane } = fresh(trusted);
    const check = await plane.checkWrite(unattested, claimed, AT);
    expect(check.decision).toBe("deny");
    expect(check.policy_id).toBe("preset.medium-trust/write/team");
    expect(check.reason).toContain("provenance floored by the plane");
  });

  test("E2.11 a first write with no source may carry no grant: denied by the grant rule (external content carries none)", async () => {
    const { plane, db } = fresh(trusted);
    const granted = { ...claimed, grants: [GRANT] } as MemoryItem;
    const result = await plane.write(unattested, granted, AT);
    expect(result.event.decision).toBe("deny");
    expect(result.event.policy_id).toBe(WRITE_GRANT_ID);
    expect(itemById(db, id(1))).toBeUndefined();
  });

  test("E2.11 control: the granted item labelled model is denied by the grant rule, as before", async () => {
    const { plane } = fresh(trusted);
    const granted = { ...claimed, grants: [GRANT] } as MemoryItem;
    const result = await plane.write({ ...unattested, source: "model" }, granted, AT);
    expect(result.event.policy_id).toBe(WRITE_GRANT_ID);
  });

  test("E2.11 where the floor held already: a sourceless rewrite that changes the grants is still denied (engram/grant/source)", async () => {
    const { plane, db } = fresh(trusted);
    const first = await plane.write({ ...unattested, source: "user" }, claimed, AT);
    const stored = first.item as MemoryItem;
    const result = await plane.write(unattested, rewriteOf(stored, { grants: [GRANT] }), LATER);
    expect(result.event.policy_id).toBe(GRANT_SOURCE_ID);
    expect(itemById(db, id(1))).toMatchObject({ provenance: { kind: "user" }, grants: [] });
  });

  test("E2.11 where the floor held already: adoption with no source records a record claiming user at kind import", async () => {
    const { deps, adapter, db } = fresh(POLICY_ON);
    await adapter.write(item(5, { scope: SCOPE, owner: SCOPE, kind: "user" }));
    const report = await adoptStoreItems(deps, owner(), SCOPE, AT);
    expect(report).toMatchObject({ allowed: 1, denied: 0 });
    expect(itemById(db, id(5))?.provenance).toMatchObject({ kind: "import", actor: SCOPE });
  });

  /** Two writers with no source (or labelled `source`) each write `content` into person:alice claiming user. */
  async function confirmersOn(plane: ReturnType<typeof fresh>["plane"], source?: Kind) {
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

  test("E2.11 promotion: two sourceless writers claiming user land at external and confirm nothing; the promotion is denied", async () => {
    const { plane } = fresh(trusted);
    await plane.write(
      owner("user"),
      item(1, { scope: SCOPE, owner: SCOPE, class: "episodic", content: "same fact" }),
      AT,
    );
    const writes = await confirmersOn(plane);
    expect(writes.map((w) => [w.event.decision, w.item?.provenance.kind])).toEqual([
      ["allow", "external"],
      ["allow", "external"],
    ]);
    const promoted = await plane.promote(owner("user"), id(1), SCOPE, LATER);
    expect(promoted.event.decision).toBe("deny");
    expect(promoted.event.policy_id).toBe(PROMOTE_NO_EVIDENCE_ID);
  });

  test("E2.11 promotion control: labelled model, denied as before", async () => {
    const { plane } = fresh(trusted);
    await plane.write(
      owner("user"),
      item(1, { scope: SCOPE, owner: SCOPE, class: "episodic", content: "same fact" }),
      AT,
    );
    await confirmersOn(plane, "model");
    const promoted = await plane.promote(owner("user"), id(1), SCOPE, LATER);
    expect(promoted.event.policy_id).toBe(PROMOTE_NO_EVIDENCE_ID);
  });

  /** withRetiredContent under POLICY_ON: the owner's own write evicts the owner's item. */
  async function withRetiredContentOn() {
    const planeOf = fresh(POLICY_ON);
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
  const restatingOn = item(3, {
    scope: SCOPE,
    owner: SCOPE,
    class: "episodic",
    content: "an evicted fact",
    kind: "user",
  });

  test("E2.11 retired content: the sourceless write claiming user is floored to external and denied (engram/write/retired-content)", async () => {
    const { plane, db } = await withRetiredContentOn();
    const result = await plane.write(coMemberNoSource, restatingOn, LATER);
    expect(result.event.decision).toBe("deny");
    expect(result.event.policy_id).toBe(RETIRED_CONTENT_ID);
    expect(result.event.reason).toContain("a external source cannot bring it back");
    expect(itemById(db, id(3))).toBeUndefined();
  });

  test("E2.11 retired content control: labelled model, denied as before", async () => {
    const { plane } = await withRetiredContentOn();
    const result = await plane.write({ ...coMemberNoSource, source: "model" }, restatingOn, LATER);
    expect(result.event.policy_id).toBe(RETIRED_CONTENT_ID);
  });

  test("E2.11 the simulator judges the sourceless workload actor as the plane does: floored and denied under medium-trust", async () => {
    const { plane } = fresh(trusted);
    const workload: Workload = {
      id: "e2-11-floor",
      actors: { unattested, agent: { ...unattested, source: "model" } },
      steps: [
        { op: "write", as: "unattested", at: AT, item: claimed },
        { op: "write", as: "agent", at: AT, item: { ...claimed, id: id(2) } },
      ],
    } as unknown as Workload;
    const report = await plane.simulate(workload, trusted);
    expect(report.baseline.outcomes.map((o) => [o.decision, o.policy_id])).toEqual([
      ["deny", "preset.medium-trust/write/team"],
      ["deny", "preset.medium-trust/write/team"],
    ]);
  });
});
