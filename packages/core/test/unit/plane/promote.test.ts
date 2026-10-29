// Acceptance tests of promotion on the real Plane (card E2.5, ADR 0026): a
// fixture promotes only after k confirmations by different actors with
// trusted sources, counted from the log; the review path records the
// approver and refuses the owner and a model-sourced actor; a target that
// requires review asks with one gate event; a procedural candidate without a
// validation record stays candidate; a widening the target's rule forbids is
// denied. A class or scope change is a new version written to the store, its
// source retired in the same queue slot; a status-only change is in place.
import { describe, expect, test } from "vitest";
import { currentItems, rebuild } from "../../../src/events.ts";
import { itemById } from "../../../src/items.ts";
import { type Actor, InvalidCallError } from "../../../src/plane.ts";
import {
  PROMOTE_MEMBERSHIP_ID,
  PROMOTE_NO_EVIDENCE_ID,
  PROMOTE_NOT_CANDIDATE_ID,
  PROMOTE_REVIEWER_ID,
} from "../../../src/policy/promotion.ts";
import { itemsAt } from "../../../src/replay.ts";
import type { MemoryItem, Policy } from "../../../src/schema.ts";
import { AT, fresh, id, item, testPolicy } from "./helpers.ts";

const SCOPES = ["person:omar", "team:platform", "org"];
const omar: Actor = { id: "person:omar", level: "person", memberships: SCOPES, source: "user" };
/** A delegate in omar's person scope and a member of the team: an eligible reviewer. */
const sara: Actor = { id: "person:sara", level: "person", memberships: SCOPES, source: "user" };
const ali: Actor = { ...sara, id: "person:ali", source: "document" };
const pi: Actor = { ...sara, id: "agent:pi", source: "model" };
const compactor: Actor = { ...sara, id: "agent:pi-compaction", source: "compaction" };

type Rule = Policy["write"][number];
const rule = (scope: Rule["scope"], over: Partial<Rule> = {}): Rule => ({
  scope,
  allowed_sources: ["user", "document", "tool", "import"],
  confidence_floor: 0.5,
  forbidden_classes: ["episodic"],
  requires_review: false,
  ...over,
});

const POLICY = testPolicy({
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
});

const FACT = "The deploy runs on Tuesdays.";
/** An episodic record of FACT in omar's person scope, restated in the given case and spacing. */
const episode = (n: number, owner: string, content = FACT, over: Partial<MemoryItem> = {}) =>
  item(n, {
    class: "episodic",
    scope: "person:omar",
    owner,
    content,
    ...over,
  } as Partial<MemoryItem>);

/** The fixture: omar records FACT, and others restate it one by one. */
async function confirmations(plane: ReturnType<typeof fresh>["plane"]) {
  await plane.write(omar, episode(1, "person:omar"), AT);
  await plane.write(omar, episode(2, "person:omar", "the deploy runs on  TUESDAYS."), AT);
  await plane.write(pi, episode(3, "agent:pi"), AT);
  await plane.write(compactor, episode(4, "agent:pi-compaction"), AT);
  await plane.write(sara, episode(5, "person:sara", "  the deploy runs on tuesdays. "), AT);
}

describe("acceptance (card E2.5): the fixture promotes only after k confirmations", () => {
  test("the same actor's restatements and model or compaction writes do not count", async () => {
    const { plane, adapter, db } = fresh(POLICY);
    await confirmations(plane);
    const writes = adapter.writes;
    const before = currentItems(db);
    const result = await plane.promote(omar, id(1), "team:platform", AT);
    expect(result.decision).toBe("deny");
    expect(result.item).toBeNull();
    expect(result.event).toMatchObject({
      op: "promote",
      decision: "deny",
      item_id: id(1),
      actor: "person:omar",
      policy_id: PROMOTE_NO_EVIDENCE_ID,
    });
    // omar (twice), agent:pi (model), the compactor and sara: two distinct trusted actors.
    expect(result.event.reason).toContain("2 of the 3");
    expect(result.events).toEqual([result.event]);
    expect(adapter.writes).toBe(writes);
    expect(currentItems(db)).toEqual(before);
  });

  test("the third distinct trusted actor promotes it to a new semantic version", async () => {
    const { plane, adapter, db } = fresh(POLICY);
    await confirmations(plane);
    await plane.write(ali, episode(6, "person:ali"), AT);
    const result = await plane.promote(omar, id(1), "team:platform", AT);
    expect(result.decision).toBe("allow");
    const promoted = result.item as MemoryItem;
    expect(promoted.id).not.toBe(id(1));
    expect(promoted).toMatchObject({
      class: "semantic",
      scope: "team:platform",
      owner: "person:omar",
      content: FACT,
      status: "active",
      version: 2,
      lineage: [id(1), id(5), id(6)],
      // The least trusted of omar's user write, sara's user write and ali's document.
      provenance: { kind: "document", actor: "person:omar" },
      store_ref: { adapter: "fake", key: promoted.id },
    });
    expect(result.event).toMatchObject({
      op: "promote",
      decision: "allow",
      item_id: promoted.id,
      scope_from: "person:omar",
      scope_to: "team:platform",
      policy_id: "test/promotion/episodic-to-semantic",
      item: promoted,
    });
    expect(result.event.reason).toContain("person:omar, person:sara, person:ali");
    // The source is retired in the same queue slot, right after the promote event.
    const [, retire] = result.events;
    expect(retire).toMatchObject({
      op: "retire",
      decision: "allow",
      item_id: id(1),
      policy_id: "test/promotion/superseded",
      seq: result.event.seq + 1,
    });
    expect(retire?.reason).toContain(promoted.id);
    expect(itemById(db, id(1))?.status).toBe("retired");
    // The store holds the new version; the source's bytes stay (retire, never delete).
    expect(await adapter.read({ adapter: "fake", key: promoted.id })).toEqual(promoted);
    expect(await adapter.read({ adapter: "fake", key: id(1) })).toMatchObject({ id: id(1) });
    // A team member now reads it.
    const reader: Actor = { id: "person:ada", level: "person", memberships: ["team:platform"] };
    expect((await plane.read(reader, { at: AT })).items.map((i) => i.id)).toEqual([promoted.id]);
    // Replay reproduces it.
    const state = currentItems(db);
    rebuild(db);
    expect(currentItems(db)).toEqual(state);
    expect(itemsAt(db, plane.events().length - 1)).toEqual(state);
  });

  test("a promoted item cannot be promoted again from its retired source", async () => {
    const { plane } = fresh(POLICY);
    await confirmations(plane);
    await plane.write(ali, episode(6, "person:ali"), AT);
    // Two promotions at once: the queue lets the first land and the second
    // decide against the projection it left.
    const [first, second] = await Promise.all([
      plane.promote(omar, id(1), "team:platform", AT),
      plane.promote(omar, id(1), "team:platform", AT),
    ]);
    expect(first.decision).toBe("allow");
    expect(second.event.policy_id).toBe(PROMOTE_NOT_CANDIDATE_ID);
    expect(second.event.reason).toContain("retired");
  });
});

describe("acceptance (card E2.5): the review path records the approver", () => {
  test("a user-sourced member of the target who is not the owner approves below k", async () => {
    const { plane } = fresh(POLICY);
    await plane.write(omar, episode(1, "person:omar"), AT);
    const result = await plane.promote(sara, id(1), "team:platform", AT, { review: true });
    expect(result.decision).toBe("allow");
    expect(result.event).toMatchObject({
      actor: "person:sara",
      policy_id: "test/promotion/review",
    });
    expect(result.event.reason).toContain("approved by person:sara");
    expect(result.item?.provenance.actor).toBe("person:sara");
    expect(result.item?.lineage).toEqual([id(1)]);
  });

  test.each([
    ["the owner", omar, "owns item"],
    ["a model-sourced actor", pi, "only a user-sourced actor can approve"],
  ])("%s cannot approve", async (_label, actor, text) => {
    const { plane, adapter } = fresh(POLICY);
    await plane.write(omar, episode(1, "person:omar"), AT);
    const writes = adapter.writes;
    const result = await plane.promote(actor, id(1), "team:platform", AT, { review: true });
    expect(result.decision).toBe("deny");
    expect(result.event.policy_id).toBe(PROMOTE_REVIEWER_ID);
    expect(result.event.reason).toContain(text);
    expect(adapter.writes).toBe(writes);
  });

  test("a target that requires review asks, with a null item and one gate event", async () => {
    const { plane, adapter, db } = fresh(POLICY);
    await confirmations(plane);
    await plane.write(ali, episode(6, "person:ali"), AT);
    const before = currentItems(db);
    const writes = adapter.writes;
    const result = await plane.promote(omar, id(1), "org", AT);
    expect(result.decision).toBe("ask");
    expect(result.item).toBeNull();
    expect(result.events).toEqual([result.event]);
    expect(result.event).toMatchObject({
      op: "gate",
      decision: "ask",
      item_id: id(1),
      scope_from: "person:omar",
      scope_to: "org",
      policy_id: "test/promotion/review",
    });
    expect(currentItems(db)).toEqual(before);
    expect(adapter.writes).toBe(writes);
    // A reviewer's approval of the same request lands it, active.
    const approved = await plane.promote(sara, id(1), "org", AT, { review: true });
    expect(approved.decision).toBe("allow");
    expect(approved.item).toMatchObject({ scope: "org", status: "active" });
    expect(approved.event.actor).toBe("person:sara");
  });

  test("a candidate held for review becomes active in place", async () => {
    const { plane, adapter, db } = fresh(POLICY);
    const written = await plane.write(omar, item(1, { scope: "org" }), AT);
    expect(written.item?.status).toBe("candidate");
    const asked = await plane.promote(omar, id(1), "org", AT);
    expect(asked.decision).toBe("ask");
    const result = await plane.promote(sara, id(1), "org", AT, { review: true });
    expect(result.decision).toBe("allow");
    expect(result.item).toEqual({ ...written.item, status: "active", version: 2 });
    expect(result.events).toEqual([result.event]);
    expect(itemById(db, id(1))).toEqual(result.item);
    expect(await adapter.read({ adapter: "fake", key: id(1) })).toEqual(result.item);
  });
});

describe("acceptance (card E2.5): procedural candidates need a validation record", () => {
  test("a procedural candidate without a validation record stays candidate", async () => {
    const { plane, db } = fresh(POLICY);
    const skill = item(1, {
      class: "procedural",
      scope: "person:omar",
      status: "candidate",
      content: { body: "run the deploy script", tools: ["bash"] },
    } as Partial<MemoryItem>);
    await plane.write(omar, skill, AT);
    const result = await plane.promote(sara, id(1), "person:omar", AT, { review: true });
    expect(result.decision).toBe("deny");
    expect(result.event.policy_id).toBe(PROMOTE_NO_EVIDENCE_ID);
    expect(result.event.reason).toContain("validation record");
    expect(itemById(db, id(1))?.status).toBe("candidate");
  });
});

describe("acceptance (card E2.5): a widening is judged as a write into the target", () => {
  test("a widening the target's rule forbids is denied under that rule", async () => {
    const { plane, adapter } = fresh(POLICY);
    await plane.write(omar, episode(1, "person:omar", FACT, { confidence: 0.4 }), AT);
    const writes = adapter.writes;
    const result = await plane.promote(sara, id(1), "team:platform", AT, { review: true });
    expect(result.decision).toBe("deny");
    expect(result.event.policy_id).toBe("test/write/team");
    expect(result.event.reason).toContain("below the team floor");
    expect(adapter.writes).toBe(writes);
  });

  test("model-written content stays in person scope, however reviewed", async () => {
    const { plane } = fresh(POLICY);
    await plane.write(pi, episode(1, "person:omar"), AT);
    const result = await plane.promote(sara, id(1), "team:platform", AT, { review: true });
    expect(result.decision).toBe("deny");
    expect(result.event.policy_id).toBe("test/write/team");
    expect(result.event.reason).toContain("source model is not allowed");
  });
});

describe("promotion events and calls", () => {
  test("an unknown item and an item the actor cannot access get the same refusal", async () => {
    const { plane } = fresh(POLICY);
    await plane.write(omar, episode(1, "person:omar"), AT);
    const eve: Actor = { id: "person:eve", level: "person", memberships: ["team:platform"] };
    const hidden = await plane.promote(eve, id(1), "team:platform", AT);
    const unknown = await plane.promote(eve, id(2), "team:platform", AT);
    for (const [r, n] of [
      [hidden, 1],
      [unknown, 2],
    ] as const) {
      expect(r.decision).toBe("deny");
      expect(r.event).toMatchObject({
        op: "promote",
        item_id: id(n),
        scope_from: null,
        policy_id: PROMOTE_MEMBERSHIP_ID,
        reason: `item ${id(n)} is not one person:eve can access, so it cannot promote it`,
      });
      expect(r.event.item).toBeUndefined();
    }
  });

  test("a promotion that takes a scope over budget evicts in the same queue slot", async () => {
    const policy = {
      ...POLICY,
      retention: [
        {
          scope: "team" as const,
          class: "semantic" as const,
          ttl: null,
          budget: 1,
          eviction: "recency" as const,
        },
      ],
    };
    const { plane, db } = fresh(policy);
    await plane.write(omar, item(9, { scope: "team:platform" }), AT);
    await plane.write(omar, episode(1, "person:omar"), AT);
    const result = await plane.promote(sara, id(1), "team:platform", AT, { review: true });
    expect(result.events.map((e) => [e.op, e.decision, e.item_id])).toEqual([
      ["promote", "allow", result.item?.id],
      ["retire", "allow", id(1)],
      ["evict", "allow", id(9)],
    ]);
    expect(itemById(db, id(9))?.status).toBe("retired");
  });

  test("a promotion landing in a full scope is never itself evicted", async () => {
    // Utility order: the item already there has been read and the promoted
    // version has not, so without protection the promotion would evict itself.
    const policy = {
      ...POLICY,
      retention: [
        {
          scope: "team" as const,
          class: "semantic" as const,
          ttl: null,
          budget: 1,
          eviction: "utility" as const,
        },
      ],
    };
    const { plane, db } = fresh(policy);
    await plane.write(omar, item(9, { scope: "team:platform", content: "read often" }), AT);
    for (let i = 0; i < 3; i++) await plane.read(omar, { text: "read often", at: AT });
    await plane.write(omar, episode(1, "person:omar"), AT);
    const result = await plane.promote(sara, id(1), "team:platform", AT, { review: true });
    const promoted = result.item as MemoryItem;
    expect(result.events.map((e) => [e.op, e.item_id])).toEqual([
      ["promote", promoted.id],
      ["retire", id(1)],
      ["evict", id(9)],
    ]);
    expect(itemById(db, promoted.id)?.status).toBe("active");
  });

  test("a store failure after the gate allowed leaves a deny event and rethrows", async () => {
    const { plane, adapter, db } = fresh(POLICY);
    await plane.write(omar, episode(1, "person:omar"), AT);
    adapter.fault = async () => {
      throw new Error("disk full");
    };
    const before = currentItems(db);
    await expect(plane.promote(sara, id(1), "team:platform", AT, { review: true })).rejects.toThrow(
      "disk full",
    );
    const last = plane.events().at(-1);
    expect(last).toMatchObject({ op: "promote", decision: "deny", item_id: id(1) });
    expect(last?.reason).toContain("disk full");
    expect(currentItems(db)).toEqual(before);
  });

  test.each([
    ["an invalid actor", { id: "", level: "person", memberships: [] }, id(1), "org", AT],
    ["an invalid time", omar, id(1), "org", "yesterday"],
    ["an invalid item id", omar, "not-an-id", "org", AT],
    ["an invalid scope", omar, id(1), "everywhere", AT],
  ])("refuses %s before the log is touched", async (_label, actor, itemId, scope, at) => {
    const { plane } = fresh(POLICY);
    await expect(
      plane.promote(actor as Actor, itemId as string, scope as string, at as string),
    ).rejects.toThrow(InvalidCallError);
    expect(plane.events()).toEqual([]);
  });
});
